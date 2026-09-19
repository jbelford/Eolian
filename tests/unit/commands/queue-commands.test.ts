import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserPermission } from '@eolian/common/constants';
import { ResourceType } from '@eolian/data/@types';
import { ADD_COMMAND, ADD_MESSAGE_COMMAND } from '@eolian/commands/queue/add-command';
import { LIST_COMMAND } from '@eolian/commands/queue/list-command';
import { LOOP_COMMAND } from '@eolian/commands/queue/loop-command';
import { MOVE_COMMAND } from '@eolian/commands/queue/move-command';
import { REMOVE_COMMAND } from '@eolian/commands/queue/remove-command';
import {
  createContext,
  createInteraction,
  createMessage,
  createQueue,
  createServerState,
  createUser,
  identifier,
  track,
} from './command-test-utils';

const resolverMocks = vi.hoisted(() => ({
  getSourceFetcher: vi.fn(),
  getSourceResolver: vi.fn(),
}));

vi.mock('@eolian/resolvers', () => ({
  getSourceFetcher: resolverMocks.getSourceFetcher,
  getSourceResolver: resolverMocks.getSourceResolver,
  RESOURCE_TYPE_DETAILS: {
    0: { name: 'Playlist' },
    1: { name: 'Album' },
    2: { name: 'Likes' },
    3: { name: 'Artist' },
    4: { name: 'Song' },
    5: { name: 'Tracks' },
  },
}));

describe('queue commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('add', () => {
    it('validates source inputs and saved identifiers', async () => {
      await expect(ADD_COMMAND.execute(createContext(), {})).rejects.toThrow(
        'provide me a SEARCH, URL or IDENTIFIER',
      );
      await expect(
        ADD_COMMAND.execute(createContext(), {
          SEARCH: 'one',
          URL: { source: 2, value: 'https://example.test' },
        }),
      ).rejects.toThrow('only include 1 SEARCH, URL, or IDENTIFIER');

      const user = createUser({ get: vi.fn().mockResolvedValue({ _id: 'user-id' }) });
      await expect(
        ADD_COMMAND.execute(createContext({ interaction: createInteraction(user) }), {
          IDENTIFIER: 'missing',
        }),
      ).rejects.toThrow('identifier is unrecognized');
    });

    it('fetches a saved identifier and adds its tracks next', async () => {
      const saved = identifier(ResourceType.Playlist);
      const tracks = [track('One'), track('Two')];
      resolverMocks.getSourceFetcher.mockResolvedValue({
        fetch: vi.fn().mockResolvedValue({ tracks }),
      });
      const user = createUser({
        get: vi.fn().mockResolvedValue({ _id: 'user-id', identifiers: { mix: saved } }),
      });
      const interaction = createInteraction(user);
      const queue = createQueue({ size: vi.fn().mockResolvedValue(2) });

      await ADD_COMMAND.execute(
        createContext({ interaction, server: createServerState({ queue }) }),
        { IDENTIFIER: 'mix', NEXT: true },
      );

      expect(resolverMocks.getSourceFetcher).toHaveBeenCalledWith(
        saved,
        expect.anything(),
        expect.objectContaining({ IDENTIFIER: 'mix' }),
      );
      expect(queue.add).toHaveBeenCalledWith(tracks, true);
      expect(interaction.channel.send).toHaveBeenCalledWith('✨ Added 2 songs to be played next!', {
        ephemeral: false,
      });
    });

    it('resolves a resource, edits the selection, and applies an unoptimized range', async () => {
      const selectionMessage = createMessage();
      resolverMocks.getSourceResolver.mockReturnValue({
        resolve: vi.fn().mockResolvedValue({
          name: 'Results',
          authors: ['Artist'],
          identifier: identifier(),
          selectionMessage,
          fetcher: {
            fetch: vi.fn().mockResolvedValue({
              tracks: [track('One'), track('Two'), track('Three')],
              rangeOptimized: false,
            }),
          },
        }),
      });
      const queue = createQueue({ size: vi.fn().mockResolvedValue(0) });
      const context = createContext({ server: createServerState({ queue }) });

      await ADD_COMMAND.execute(context, {
        SEARCH: 'results',
        TOP: { start: 2, stop: 3 },
      });

      expect(selectionMessage.edit).toHaveBeenCalledWith(expect.stringContaining('Selected'));
      expect(queue.add).toHaveBeenCalledWith([track('Two'), track('Three')], undefined);
      expect(context.interaction.channel.send).toHaveBeenCalledWith(
        '✨ Added 2 songs to the queue!',
        { ephemeral: false },
      );
    });

    it.each([
      [{ resolve: vi.fn().mockResolvedValue(undefined) }, 'Could not find any tracks to add'],
      [
        {
          resolve: vi.fn().mockResolvedValue({
            name: 'Empty',
            authors: [],
            identifier: identifier(),
            fetcher: { fetch: vi.fn().mockResolvedValue({ tracks: [] }) },
          }),
        },
        'No tracks at the provided resource',
      ],
    ])('rejects missing resolver output %#', async (resolver, message) => {
      resolverMocks.getSourceResolver.mockReturnValue(resolver);
      await expect(ADD_COMMAND.execute(createContext(), { SEARCH: 'nothing' })).rejects.toThrow(
        message,
      );
    });

    it('enforces the configured queue limit before mutating the queue', async () => {
      resolverMocks.getSourceResolver.mockReturnValue({
        resolve: vi.fn().mockResolvedValue({
          name: 'Song',
          authors: ['Artist'],
          identifier: identifier(),
          fetcher: { fetch: vi.fn().mockResolvedValue({ tracks: [track()] }) },
        }),
      });
      const queue = createQueue({ size: vi.fn().mockResolvedValue(1) });
      const details = createServerState().details;
      vi.mocked(details.get).mockResolvedValue({ _id: 'guild-id', queueLimit: 1 });
      const server = createServerState({ queue, details });

      await expect(
        ADD_COMMAND.execute(createContext({ server }), { SEARCH: 'song' }),
      ).rejects.toThrow('queue limit is capped at 1');
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('validates message input and prefers URL over search', async () => {
      expect(() => ADD_MESSAGE_COMMAND.execute(createContext(), {})).toThrow(
        'This message must contain something',
      );
      const commandOptions = {
        URL: { source: 2, value: 'https://example.test/song' },
        SEARCH: 'ignored',
      };
      resolverMocks.getSourceResolver.mockReturnValue({
        resolve: vi.fn().mockResolvedValue(undefined),
      });

      await expect(ADD_MESSAGE_COMMAND.execute(createContext(), commandOptions)).rejects.toThrow(
        'Could not find any tracks',
      );
      expect(commandOptions.SEARCH).toBeUndefined();
    });
  });

  describe('list and loop', () => {
    it('reports empty queues and displays populated queue ranges', async () => {
      const emptyInteraction = createInteraction();
      await LIST_COMMAND.execute(
        createContext({
          interaction: emptyInteraction,
          server: createServerState({ queue: createQueue({ size: vi.fn().mockResolvedValue(0) }) }),
        }),
        {},
      );
      expect(emptyInteraction.send).toHaveBeenCalledWith('🕳 The queue is empty!');

      const songs = [track('Two'), track('Three')];
      const queue = createQueue({
        size: vi.fn().mockResolvedValue(4),
        get: vi.fn().mockResolvedValue([songs, [track('Loop')]]),
      });
      const interaction = createInteraction();
      const server = createServerState({ queue });
      await LIST_COMMAND.execute(createContext({ interaction, server }), {
        TOP: { start: 2, stop: 3 },
      });
      expect(queue.get).toHaveBeenCalledWith(1, 2);
      expect(server.display.queue.setChannel).toHaveBeenCalledWith(
        interaction.channel,
        interaction,
      );
      expect(server.display.queue.send).toHaveBeenCalledWith(songs, [track('Loop')], 1, 4);
    });

    it('clears and shuffles only for DJs', async () => {
      const limited = createInteraction(createUser({ permission: UserPermission.DJLimited }));
      await expect(
        LIST_COMMAND.execute(createContext({ interaction: limited }), { CLEAR: true }),
      ).rejects.toThrow('permission to clear');
      await expect(
        LIST_COMMAND.execute(createContext({ interaction: limited }), { SHUFFLE: true }),
      ).rejects.toThrow('permission to shuffle');

      const queue = createQueue();
      const interaction = createInteraction();
      const context = createContext({ interaction, server: createServerState({ queue }) });
      await LIST_COMMAND.execute(context, { CLEAR: true });
      await LIST_COMMAND.execute(context, { SHUFFLE: true });
      expect(queue.clear).toHaveBeenCalled();
      expect(queue.shuffle).toHaveBeenCalled();
    });

    it('toggles loop mode, reports status, and rejects redundant changes', async () => {
      const queue = createQueue({ loop: false });
      const interaction = createInteraction();
      const context = createContext({ interaction, server: createServerState({ queue }) });

      await LOOP_COMMAND.execute(context, {});
      await LOOP_COMMAND.execute(context, { ENABLE: true });
      expect(queue.setLoopMode).toHaveBeenCalledWith(true);
      expect(interaction.send).toHaveBeenNthCalledWith(1, '🔁 Loop mode is currently disabled!');

      const enabled = createQueue({ loop: true });
      await LOOP_COMMAND.execute(createContext({ server: createServerState({ queue: enabled }) }), {
        DISABLE: true,
      });
      expect(enabled.setLoopMode).toHaveBeenCalledWith(false);

      await expect(LOOP_COMMAND.execute(context, { DISABLE: true })).rejects.toThrow(
        'already disabled',
      );
    });
  });

  describe('move and remove', () => {
    it('moves one song next and moves a range to a numbered position', async () => {
      const queue = createQueue({ size: vi.fn().mockResolvedValue(10) });
      const context = createContext({ server: createServerState({ queue }) });

      await MOVE_COMMAND.execute(context, { NUMBER: [5], NEXT: true });
      await MOVE_COMMAND.execute(context, {
        NUMBER: [2],
        TOP: { start: 4, stop: 6 },
      });

      expect(queue.move).toHaveBeenNthCalledWith(1, 0, 4, 1);
      expect(queue.move).toHaveBeenNthCalledWith(2, 1, 3, 3);
    });

    it.each([
      [{}, 'provide NEXT keyword or NUMBER'],
      [{ NUMBER: [1] }, 'Queue is empty'],
    ])('rejects invalid move input %#', async (commandOptions, message) => {
      const queue = createQueue({ size: vi.fn().mockResolvedValue(0) });
      await expect(
        MOVE_COMMAND.execute(
          createContext({ server: createServerState({ queue }) }),
          commandOptions,
        ),
      ).rejects.toThrow(message);
    });

    it('validates move positions and whole numbers', async () => {
      const queue = createQueue({ size: vi.fn().mockResolvedValue(3) });
      const context = createContext({ server: createServerState({ queue }) });

      await expect(MOVE_COMMAND.execute(context, { NUMBER: [1.5], NEXT: true })).rejects.toThrow(
        'whole numbers',
      );
      await expect(MOVE_COMMAND.execute(context, { NUMBER: [4], NEXT: true })).rejects.toThrow(
        'within the queue',
      );
      await expect(MOVE_COMMAND.execute(context, { NUMBER: [2] })).rejects.toThrow(
        'position to move to',
      );
    });

    it('removes next, numbered, and ranged songs', async () => {
      const queue = createQueue({
        size: vi.fn().mockResolvedValue(8),
        remove: vi.fn().mockResolvedValue(3),
      });
      const interaction = createInteraction();
      const context = createContext({ interaction, server: createServerState({ queue }) });

      await REMOVE_COMMAND.execute(context, { NEXT: true });
      await REMOVE_COMMAND.execute(context, { NUMBER: [2, -1, 4] });
      await REMOVE_COMMAND.execute(context, { TOP: { start: 2, stop: 4 } });

      expect(queue.pop).toHaveBeenCalled();
      expect(queue.remove).toHaveBeenNthCalledWith(1, 3, 1);
      expect(queue.remove).toHaveBeenNthCalledWith(2, 1, 1);
      expect(queue.remove).toHaveBeenNthCalledWith(3, 1, 3);
      expect(interaction.send).toHaveBeenLastCalledWith(
        'Removed songs 2 to 4 from the queue! (3 total)',
        { ephemeral: false },
      );
    });

    it('rejects ambiguous removal and an empty queue', async () => {
      await expect(REMOVE_COMMAND.execute(createContext(), {})).rejects.toThrow(
        'must provide NUMBER, TOP, BOTTOM, or NEXT',
      );
      await expect(
        REMOVE_COMMAND.execute(createContext(), { NEXT: true, NUMBER: [1] }),
      ).rejects.toThrow('provide only 1');
      const queue = createQueue({ size: vi.fn().mockResolvedValue(0) });
      await expect(
        REMOVE_COMMAND.execute(createContext({ server: createServerState({ queue }) }), {
          NEXT: true,
        }),
      ).rejects.toThrow('Queue is already empty');
    });
  });
});
