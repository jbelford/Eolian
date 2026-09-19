import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyntaxType } from '@eolian/command-options/@types';
import { CONFIG_COMMAND } from '@eolian/commands/settings/config-command';
import {
  createContext,
  createInteraction,
  createPlayer,
  createServerDetails,
  createServerState,
} from './command-test-utils';

const createServerDetailsEmbed = vi.hoisted(() => vi.fn());

vi.mock('@eolian/embed', () => ({
  createServerDetailsEmbed,
}));

describe('settings commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the current server configuration as an embed', async () => {
    const dto = { _id: 'guild-id', prefix: '$', volume: 0.4 };
    const details = createServerDetails({ get: vi.fn().mockResolvedValue(dto) });
    const embed = { title: 'Server configuration' };
    createServerDetailsEmbed.mockReturnValue(embed);
    const interaction = createInteraction();

    await CONFIG_COMMAND.execute(
      createContext({ interaction, server: createServerState({ details }) }),
      {},
    );

    expect(createServerDetailsEmbed).toHaveBeenCalledWith(details, dto);
    expect(interaction.sendEmbed).toHaveBeenCalledWith(embed);
  });

  it('sets prefix, syntax, and preferred channel', async () => {
    const details = createServerDetails();
    const interaction = createInteraction();
    const context = createContext({ interaction, server: createServerState({ details }) });

    await CONFIG_COMMAND.execute(context, { ARG: ['prefix', '?'] });
    await CONFIG_COMMAND.execute(context, { ARG: ['syntax', 'traditional'] });
    await CONFIG_COMMAND.execute(context, { ARG: ['channel', '<#12345>'] });

    expect(details.setPrefix).toHaveBeenCalledWith('?');
    expect(details.setSyntax).toHaveBeenCalledWith(SyntaxType.TRADITIONAL);
    expect(details.setChannel).toHaveBeenCalledWith('12345');
    expect(interaction.send).toHaveBeenLastCalledWith(
      '✨ I have set the preferred channel to <#12345>!',
    );
  });

  it('sets persisted volume and updates an idle player only', async () => {
    const details = createServerDetails();
    const idlePlayer = createPlayer({ isStreaming: false });
    const context = createContext({
      server: createServerState({ details, player: idlePlayer }),
    });

    await CONFIG_COMMAND.execute(context, { ARG: ['volume', '75'] });

    expect(details.setVolume).toHaveBeenCalledWith(0.75);
    expect(idlePlayer.setVolume).toHaveBeenCalledWith(0.75);

    const streamingPlayer = createPlayer({ isStreaming: true });
    await CONFIG_COMMAND.execute(
      createContext({ server: createServerState({ details, player: streamingPlayer }) }),
      { ARG: ['volume', '25'] },
    );
    expect(streamingPlayer.setVolume).not.toHaveBeenCalled();
  });

  it('adds and removes DJ roles and reports missing roles', async () => {
    const details = createServerDetails({
      addDjRole: vi.fn().mockResolvedValue(true),
      removeDjRole: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false),
    });
    const interaction = createInteraction();
    const context = createContext({ interaction, server: createServerState({ details }) });

    await CONFIG_COMMAND.execute(context, { ARG: ['dj_add', '<@&12345>'] });
    await CONFIG_COMMAND.execute(context, { ARG: ['dj_remove', '12345'] });
    await CONFIG_COMMAND.execute(context, { ARG: ['dj_remove', '12345'] });

    expect(details.addDjRole).toHaveBeenCalledWith('12345');
    expect(details.removeDjRole).toHaveBeenCalledWith('12345');
    expect(interaction.send).toHaveBeenLastCalledWith('The role <@&12345> is not set as DJ role!');
  });

  it('enables and disables limited DJ permissions', async () => {
    const details = createServerDetails();
    const interaction = createInteraction();
    const context = createContext({ interaction, server: createServerState({ details }) });

    await CONFIG_COMMAND.execute(context, { ARG: ['dj_limited', 'true'] });
    await CONFIG_COMMAND.execute(context, { ARG: ['dj_limited', 'false'] });

    expect(details.setDjLimited).toHaveBeenNthCalledWith(1, true);
    expect(details.setDjLimited).toHaveBeenNthCalledWith(2, false);
    expect(interaction.send).toHaveBeenLastCalledWith('✨ I have removed limited DJ permissions!');
  });

  it.each([
    [{ ARG: ['prefix'] }, 'require two arguments'],
    [{ ARG: ['unknown', 'value'] }, 'There is no config for `unknown`'],
    [{ ARG: ['prefix', '!!'] }, 'only 1 character'],
    [{ ARG: ['volume', '101'] }, 'between 0 and 100'],
    [{ ARG: ['syntax', 'slash'] }, 'Unrecognized syntax type'],
    [{ ARG: ['channel', 'general'] }, 'is not a channel'],
    [{ ARG: ['dj_add', 'role'] }, 'is not a role'],
    [{ ARG: ['dj_limited', 'maybe'] }, 'Provide `true` or `false`'],
  ])('rejects invalid configuration %#', async (commandOptions, message) => {
    await expect(CONFIG_COMMAND.execute(createContext(), commandOptions)).rejects.toThrow(message);
  });

  it('enforces the DJ role limit and rejects unknown role IDs', async () => {
    const details = createServerDetails({
      get: vi.fn().mockResolvedValue({
        _id: 'guild-id',
        djRoleIds: Array.from({ length: 10 }, (_, index) => String(index)),
      }),
    });
    await expect(
      CONFIG_COMMAND.execute(createContext({ server: createServerState({ details }) }), {
        ARG: ['dj_add', '12345'],
      }),
    ).rejects.toThrow('only have up to 10 DJ roles');

    const missing = createServerDetails({ addDjRole: vi.fn().mockResolvedValue(false) });
    await expect(
      CONFIG_COMMAND.execute(createContext({ server: createServerState({ details: missing }) }), {
        ARG: ['dj_add', '12345'],
      }),
    ).rejects.toThrow('role with ID 12345 does not exist');
  });
});
