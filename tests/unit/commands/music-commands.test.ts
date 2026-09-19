import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceType } from '@eolian/data/@types';
import { NOT_PLAYING } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { BACK_COMMAND } from '@eolian/commands/music/back-command';
import { BASSBOOST_COMMAND } from '@eolian/commands/music/bassboost-command';
import { NIGHTCORE_COMMAND } from '@eolian/commands/music/nightcore-command';
import { PAUSE_COMMAND } from '@eolian/commands/music/pause-command';
import { PLAY_COMMAND, PLAY_MESSAGE_COMMAND } from '@eolian/commands/music/play-command';
import { RESUME_COMMAND } from '@eolian/commands/music/resume-command';
import { SHOW_COMMAND } from '@eolian/commands/music/show-command';
import { SKIP_COMMAND } from '@eolian/commands/music/skip-command';
import { STOP_COMMAND } from '@eolian/commands/music/stop-command';
import { VOLUME_COMMAND } from '@eolian/commands/music/volume-command';
import {
  createClient,
  createContext,
  createInteraction,
  createPlayer,
  createQueue,
  createServerState,
  createUser,
  createVoice,
  identifier,
  track,
} from './command-test-utils';

const resolverMocks = vi.hoisted(() => ({
  getSourceFetcher: vi.fn(),
  getSourceResolver: vi.fn(),
}));
const progressMocks = vi.hoisted(() => ({
  done: vi.fn().mockResolvedValue(undefined),
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
vi.mock('@eolian/framework/message-progress-updater', () => ({
  MessageProgressUpdater: vi.fn(function MessageProgressUpdater() {
    return progressMocks;
  }),
}));

describe('music commands', () => {
  beforeEach(() => {
    resolverMocks.getSourceFetcher.mockReset();
    resolverMocks.getSourceResolver.mockReset();
    progressMocks.done.mockClear();
  });

  it('plays the existing queue after joining the user voice channel', async () => {
    const voice = createVoice();
    const user = createUser({ getVoice: vi.fn().mockReturnValue(voice) });
    const interaction = createInteraction(user);
    const player = createPlayer();
    const server = createServerState({ player });
    const client = createClient({
      getVoice: vi.fn().mockReturnValueOnce(undefined).mockReturnValue({ channelId: voice.id }),
    });
    const context = createContext({ interaction, server, client });

    await PLAY_COMMAND.execute(context, {});

    expect(voice.join).toHaveBeenCalled();
    expect(interaction.react).toHaveBeenNthCalledWith(1, '👋');
    expect(server.display.player.setChannel).toHaveBeenCalledWith(interaction.channel, interaction);
    expect(player.play).toHaveBeenCalledWith(progressMocks);
    expect(interaction.react).toHaveBeenNthCalledWith(2, '🎵');
    expect(progressMocks.done).toHaveBeenCalled();
  });

  it('resolves an identifier, adds it at the head, and skips the current track', async () => {
    const saved = identifier();
    const fetcher = { fetch: vi.fn().mockResolvedValue({ tracks: [track('New')] }) };
    resolverMocks.getSourceFetcher.mockResolvedValue(fetcher);
    const user = createUser({
      getVoice: vi.fn().mockReturnValue(createVoice()),
      get: vi.fn().mockResolvedValue({ _id: 'user-id', identifiers: { favorite: saved } }),
    });
    const interaction = createInteraction(user);
    const queue = createQueue({ size: vi.fn().mockResolvedValue(1) });
    const player = createPlayer({ isStreaming: true });
    const server = createServerState({ queue, player });
    const client = createClient({ getVoice: vi.fn().mockReturnValue({ channelId: 'voice-id' }) });

    await PLAY_COMMAND.execute(createContext({ interaction, server, client }), {
      IDENTIFIER: 'favorite',
    });

    expect(resolverMocks.getSourceFetcher).toHaveBeenCalledWith(
      saved,
      expect.anything(),
      expect.objectContaining({ IDENTIFIER: 'favorite' }),
    );
    expect(queue.add).toHaveBeenCalledWith([track('New')], true);
    expect(player.skip).toHaveBeenCalledWith(progressMocks);
    expect(interaction.react).toHaveBeenCalledWith('👌');
  });

  it('resolves a searched track and edits the resolver selection message', async () => {
    const selectionMessage = { edit: vi.fn().mockResolvedValue(undefined) };
    const fetcher = { fetch: vi.fn().mockResolvedValue({ tracks: [track('Found')] }) };
    resolverMocks.getSourceResolver.mockReturnValue({
      resolve: vi.fn().mockResolvedValue({
        name: 'Found',
        authors: ['Artist'],
        identifier: identifier(),
        selectionMessage,
        fetcher,
      }),
    });
    const user = createUser({ getVoice: vi.fn().mockReturnValue(createVoice()) });
    const queue = createQueue({ size: vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1) });
    const server = createServerState({ queue });
    const client = createClient({ getVoice: vi.fn().mockReturnValue({ channelId: 'voice-id' }) });

    await PLAY_COMMAND.execute(
      createContext({ interaction: createInteraction(user), server, client }),
      {
        SEARCH: 'found',
      },
    );

    expect(selectionMessage.edit).toHaveBeenCalledWith(
      expect.stringContaining('to be played immediately'),
    );
    expect(queue.add).toHaveBeenCalledWith([track('Found')], true);
  });

  it.each([
    ['missing voice', createUser(), {}, 'You need to be in a voice channel!'],
    [
      'unjoinable voice',
      createUser({ getVoice: vi.fn().mockReturnValue(createVoice({ joinable: false })) }),
      {},
      'I do not have permission to join your voice channel!',
    ],
    [
      'unknown identifier',
      createUser({
        getVoice: vi.fn().mockReturnValue(createVoice()),
        get: vi.fn().mockResolvedValue({ _id: 'user-id' }),
      }),
      { IDENTIFIER: 'missing' },
      'That identifier is unrecognized!',
    ],
    [
      'non-song identifier',
      createUser({
        getVoice: vi.fn().mockReturnValue(createVoice()),
        get: vi.fn().mockResolvedValue({
          _id: 'user-id',
          identifiers: { list: identifier(ResourceType.Playlist) },
        }),
      }),
      { IDENTIFIER: 'list' },
      'Use the `add` command instead!',
    ],
  ])('rejects %s', async (_name, user, commandOptions, message) => {
    await expect(
      PLAY_COMMAND.execute(createContext({ interaction: createInteraction(user) }), commandOptions),
    ).rejects.toThrow(message);
  });

  it('rejects an empty queue and additions over the configured limit', async () => {
    const user = createUser({ getVoice: vi.fn().mockReturnValue(createVoice()) });
    const emptyQueue = createQueue({ size: vi.fn().mockResolvedValue(0) });
    await expect(
      PLAY_COMMAND.execute(
        createContext({
          interaction: createInteraction(user),
          server: createServerState({ queue: emptyQueue }),
        }),
        {},
      ),
    ).rejects.toThrow('There are no songs in the queue!');

    const fetcher = { fetch: vi.fn().mockResolvedValue({ tracks: [track('Overflow')] }) };
    resolverMocks.getSourceResolver.mockReturnValue({
      resolve: vi.fn().mockResolvedValue({
        name: 'Overflow',
        authors: ['Artist'],
        identifier: identifier(),
        fetcher,
      }),
    });
    const queue = createQueue({ size: vi.fn().mockResolvedValue(1) });
    const details = createServerState().details;
    vi.mocked(details.get).mockResolvedValue({ _id: 'guild-id', queueLimit: 1 });
    const server = createServerState({ queue, details });

    await expect(
      PLAY_COMMAND.execute(createContext({ interaction: createInteraction(user), server }), {
        SEARCH: 'overflow',
      }),
    ).rejects.toThrow('queue limit is capped at 1');
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('validates message play input and prefers a URL over parsed search text', async () => {
    const context = createContext();
    expect(() => PLAY_MESSAGE_COMMAND.execute(context, {})).toThrow(
      'This message must contain something',
    );

    const options = {
      URL: { source: 2, value: 'https://example.test/song' },
      SEARCH: 'ignored',
    };
    const user = createUser({ getVoice: vi.fn().mockReturnValue(createVoice()) });
    const queue = createQueue({ size: vi.fn().mockResolvedValue(0) });
    resolverMocks.getSourceResolver.mockReturnValue({
      resolve: vi.fn().mockResolvedValue(undefined),
    });
    await expect(
      PLAY_MESSAGE_COMMAND.execute(
        createContext({
          interaction: createInteraction(user),
          server: createServerState({ queue }),
        }),
        options,
      ),
    ).rejects.toThrow('There are no songs');
    expect(options.SEARCH).toBeUndefined();
  });

  it.each([
    [PAUSE_COMMAND, 'pause', { isStreaming: true, paused: false }, '⏸'],
    [RESUME_COMMAND, 'resume', { isStreaming: true, paused: true }, '▶'],
  ])('executes %s for reactable interactions', async (command, method, state, emoji) => {
    const player = createPlayer(state);
    const interaction = createInteraction();
    await command.execute(
      createContext({ interaction, server: createServerState({ player }) }),
      {},
    );
    expect(player[method as 'pause' | 'resume']).toHaveBeenCalled();
    expect(interaction.react).toHaveBeenCalledWith(emoji);
  });

  it('uses public messages for non-reactable pause, resume, and stop', async () => {
    const interaction = createInteraction(undefined, undefined, { reactable: false });
    const player = createPlayer({ isStreaming: true });
    const context = createContext({ interaction, server: createServerState({ player }) });

    await PAUSE_COMMAND.execute(context, {});
    Object.defineProperty(player, 'paused', { value: true });
    await RESUME_COMMAND.execute(context, {});
    await STOP_COMMAND.execute(context, {});

    expect(interaction.send).toHaveBeenNthCalledWith(1, '⏸️', { ephemeral: false });
    expect(interaction.send).toHaveBeenNthCalledWith(2, '▶️', { ephemeral: false });
    expect(interaction.send).toHaveBeenNthCalledWith(3, '⏹️', { ephemeral: false });
    expect(player.stop).toHaveBeenCalled();
  });

  it.each([
    [PAUSE_COMMAND, { isStreaming: false }, NOT_PLAYING],
    [PAUSE_COMMAND, { isStreaming: true, paused: true }, 'Playback is already paused!'],
    [RESUME_COMMAND, { isStreaming: false }, NOT_PLAYING],
    [RESUME_COMMAND, { isStreaming: true, paused: false }, 'Playback is not paused!'],
    [STOP_COMMAND, { isStreaming: false }, NOT_PLAYING],
    [SKIP_COMMAND, { isStreaming: false }, NOT_PLAYING],
    [SHOW_COMMAND, { isStreaming: false }, NOT_PLAYING],
  ])('rejects invalid playback state for %s', async (command, state, message) => {
    const server = createServerState({ player: createPlayer(state) });
    await expect(command.execute(createContext({ server }), {})).rejects.toThrow(message);
  });

  it('skips with progress cleanup even when the reaction fails', async () => {
    const interaction = createInteraction(undefined, undefined, {
      react: vi.fn().mockRejectedValue(new Error('reaction failed')),
    });
    const player = createPlayer({ isStreaming: true });

    await SKIP_COMMAND.execute(
      createContext({ interaction, server: createServerState({ player }) }),
      {},
    );

    expect(player.skip).toHaveBeenCalledWith(progressMocks);
    expect(progressMocks.done).toHaveBeenCalled();
  });

  it('shows the player in the current channel', async () => {
    const interaction = createInteraction();
    const server = createServerState({ player: createPlayer({ isStreaming: true }) });
    await SHOW_COMMAND.execute(createContext({ interaction, server }), {});
    expect(server.display.player.setChannel).toHaveBeenCalledWith(interaction.channel, interaction);
    expect(server.display.player.refresh).toHaveBeenCalled();
  });

  it('goes back, skips active playback, and reports non-reactable success', async () => {
    const interaction = createInteraction(undefined, undefined, { reactable: false });
    const queue = createQueue();
    const player = createPlayer({ isStreaming: true });
    await BACK_COMMAND.execute(
      createContext({ interaction, server: createServerState({ queue, player }) }),
      {},
    );
    expect(queue.unpop).toHaveBeenCalledWith(2);
    expect(player.skip).toHaveBeenCalled();
    expect(interaction.send).toHaveBeenCalledWith('⏪', { ephemeral: false });
  });

  it('rejects going back without history', async () => {
    const queue = createQueue({ unpop: vi.fn().mockResolvedValue(false) });
    await expect(
      BACK_COMMAND.execute(createContext({ server: createServerState({ queue }) }), {}),
    ).rejects.toThrow('There are no previous songs!');
  });

  it.each([
    [NIGHTCORE_COMMAND, 'nightcore', 'setNightcore', 'Nightcore'],
    [BASSBOOST_COMMAND, 'bass', 'setBassBoost', 'Bass Boost'],
  ] as const)('toggles and reports %s', async (command, property, setter, label) => {
    const enabledPlayer = createPlayer({ [property]: false, isStreaming: true });
    const enabledInteraction = createInteraction();
    await command.execute(
      createContext({
        interaction: enabledInteraction,
        server: createServerState({ player: enabledPlayer }),
      }),
      { ENABLE: true },
    );
    expect(enabledPlayer[setter]).toHaveBeenCalledWith(true);
    expect(enabledInteraction.send).toHaveBeenCalledWith(
      expect.stringContaining('Settings will take effect'),
      { ephemeral: false },
    );

    const disabledPlayer = createPlayer({ [property]: true });
    const disabledInteraction = createInteraction();
    await command.execute(
      createContext({
        interaction: disabledInteraction,
        server: createServerState({ player: disabledPlayer }),
      }),
      { DISABLE: true },
    );
    expect(disabledPlayer[setter]).toHaveBeenCalledWith(false);

    await command.execute(
      createContext({ server: createServerState({ player: createPlayer({ [property]: true }) }) }),
      {},
    );
    expect(command.name).toBe(label === 'Nightcore' ? 'nightcore' : 'bassboost');
  });

  it.each([
    [NIGHTCORE_COMMAND, { nightcore: true }, { ENABLE: true }, 'Nightcore is already enabled!'],
    [NIGHTCORE_COMMAND, { nightcore: false }, { DISABLE: true }, 'Nightcore is already disabled!'],
    [BASSBOOST_COMMAND, { bass: true }, { ENABLE: true }, 'Bass Boost is already enabled!'],
    [BASSBOOST_COMMAND, { bass: false }, { DISABLE: true }, 'Bass Boost is already disabled!'],
  ])('rejects redundant effect changes', async (command, state, commandOptions, message) => {
    await expect(
      command.execute(
        createContext({ server: createServerState({ player: createPlayer(state) }) }),
        commandOptions,
      ),
    ).rejects.toThrow(EolianUserError);
    await expect(
      command.execute(
        createContext({ server: createServerState({ player: createPlayer(state) }) }),
        commandOptions,
      ),
    ).rejects.toThrow(message);
  });

  it('gets, raises, lowers, and directly sets volume with the appropriate response', async () => {
    const player = createPlayer({ volume: 0.5 });
    const interaction = createInteraction();
    const context = createContext({ interaction, server: createServerState({ player }) });

    await VOLUME_COMMAND.execute(context, {});
    await VOLUME_COMMAND.execute(context, { MORE: true });
    await VOLUME_COMMAND.execute(context, { LESS: true });
    await VOLUME_COMMAND.execute(context, { NUMBER: [75] });

    expect(interaction.send).toHaveBeenNthCalledWith(1, '🔊  **50%**  🔊');
    expect(player.setVolume).toHaveBeenNthCalledWith(1, 0.6);
    expect(player.setVolume).toHaveBeenNthCalledWith(2, 0.4);
    expect(player.setVolume).toHaveBeenNthCalledWith(3, 0.75);
  });

  it('reacts to streaming volume changes and validates the range', async () => {
    const player = createPlayer({ volume: 0.5, isStreaming: true });
    const interaction = createInteraction();
    await VOLUME_COMMAND.execute(
      createContext({ interaction, server: createServerState({ player }) }),
      { NUMBER: [40] },
    );
    expect(interaction.react).toHaveBeenCalledWith('🔉');

    await expect(VOLUME_COMMAND.execute(createContext(), { NUMBER: [101] })).rejects.toThrow(
      'Volume must be between 0-100!',
    );
  });
});
