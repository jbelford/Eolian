import { afterEach, describe, expect, it, vi } from 'vitest';
import { KICK_COMMAND } from '@eolian/commands/owner/kick-command';
import { KICK_OLD_COMMAND } from '@eolian/commands/owner/kick-old-command';
import { KICK_UNUSED_COMMAND } from '@eolian/commands/owner/kick-unused-command';
import { UPDATE_SLASH_COMMAND } from '@eolian/commands/owner/update-slash-command';
import {
  createClient,
  createContext,
  createInteraction,
  createSelection,
} from './command-test-utils';

describe('owner commands', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    [true, 'I have left guild-id'],
    [false, "I don't recognize that guild!"],
  ])('reports direct kick result %s', async (success, message) => {
    const client = createClient({ leave: vi.fn().mockResolvedValue(success) });
    const interaction = createInteraction();

    await KICK_COMMAND.execute(createContext({ client, interaction }), ['guild-id']);

    expect(client.leave).toHaveBeenCalledWith('guild-id');
    expect(interaction.send).toHaveBeenCalledWith(message);
  });

  it.each([
    [true, 'Request to update commands sent successfully!'],
    [false, 'I failed to update commands. Check the logs.'],
  ])('reports slash command update result %s', async (success, message) => {
    const client = createClient({ updateCommands: vi.fn().mockResolvedValue(success) });
    const interaction = createInteraction();

    await UPDATE_SLASH_COMMAND.execute(createContext({ client, interaction }), []);

    expect(interaction.send).toHaveBeenCalledWith(message);
  });

  it('lists and leaves every unused server after confirmation', async () => {
    const servers = [
      { id: 'one', name: 'One', members: 1, owner: 'owner-one' },
      { id: 'two', name: 'Two', members: 2, owner: 'owner-two' },
    ];
    const client = createClient({ getUnusedServers: vi.fn().mockResolvedValue(servers) });
    const selection = createSelection(0);
    const interaction = createInteraction(undefined, undefined, {
      sendSelection: vi.fn().mockResolvedValue(selection),
    });

    await KICK_UNUSED_COMMAND.execute(createContext({ client, interaction }), []);

    expect(interaction.send).toHaveBeenCalledWith('0. one\n1. two');
    expect(client.leave).toHaveBeenCalledWith('one');
    expect(client.leave).toHaveBeenCalledWith('two');
    expect(selection.message.edit).toHaveBeenCalledWith('I have left all 2 servers');
  });

  it('cancels unused-server removal and rejects an empty result', async () => {
    const selection = createSelection(1);
    const client = createClient({
      getUnusedServers: vi
        .fn()
        .mockResolvedValue([{ id: 'one', name: 'One', members: 1, owner: 'owner-one' }]),
    });
    const interaction = createInteraction(undefined, undefined, {
      sendSelection: vi.fn().mockResolvedValue(selection),
    });

    await KICK_UNUSED_COMMAND.execute(createContext({ client, interaction }), []);
    expect(client.leave).not.toHaveBeenCalled();
    expect(selection.message.edit).toHaveBeenCalledWith('Cancelled kick');

    await expect(
      KICK_UNUSED_COMMAND.execute(
        createContext({
          client: createClient({ getUnusedServers: vi.fn().mockResolvedValue([]) }),
        }),
        [],
      ),
    ).rejects.toThrow('No servers!');
  });

  it('queries idle servers from a deterministic cutoff and removes confirmed results', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-19T12:00:00.000Z'));
    const servers = [
      { _id: 'one', lastUsage: new Date('2026-09-01T00:00:00.000Z') },
      { _id: 'two' },
    ];
    const client = createClient({ getIdleServers: vi.fn().mockResolvedValue(servers) });
    const selection = createSelection(0);
    const interaction = createInteraction(undefined, undefined, {
      sendSelection: vi.fn().mockResolvedValue(selection),
    });

    await KICK_OLD_COMMAND.execute(createContext({ client, interaction }), ['7']);

    expect(client.getIdleServers).toHaveBeenCalledWith(new Date('2026-09-12T12:00:00.000Z'));
    expect(interaction.send).toHaveBeenCalledWith('0. one Tue, 01 Sep 2026 00:00:00 GMT\n1. two ');
    expect(client.leave).toHaveBeenCalledWith('one');
    expect(client.leave).toHaveBeenCalledWith('two');
  });

  it('validates idle-day input and reports no idle servers', async () => {
    await expect(KICK_OLD_COMMAND.execute(createContext(), ['later'])).rejects.toThrow(
      'provide a number for days',
    );
    await expect(KICK_OLD_COMMAND.execute(createContext(), ['30'])).rejects.toThrow('No servers!');
  });
});
