import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Track, TrackSource } from '@eolian/api/@types';
import { IDLE_TIMEOUT_MINS } from '@eolian/common/constants';
import { ContextClient, ContextMusicQueue } from '@eolian/framework/@types';

const voiceMocks = vi.hoisted(() => ({
  createAudioPlayer: vi.fn(),
  createAudioResource: vi.fn(),
}));

vi.mock('@discordjs/voice', () => ({
  AudioPlayerStatus: {
    Buffering: 'buffering',
    Idle: 'idle',
    Paused: 'paused',
    Playing: 'playing',
  },
  NoSubscriberBehavior: { Pause: 'pause' },
  StreamType: { Raw: 'raw' },
  VoiceConnectionStatus: { Disconnected: 'disconnected' },
  createAudioPlayer: voiceMocks.createAudioPlayer,
  createAudioResource: voiceMocks.createAudioResource,
}));

const songMocks = vi.hoisted(() => ({
  instances: [] as MockSongStream[],
  setups: [] as ((song: MockSongStream) => void)[],
}));

class MockSongStream extends EventEmitter {
  readonly stream = new Readable({ read() {} });
  readonly setStreamTrack = vi.fn().mockResolvedValue(true);
  readonly close = vi.fn().mockResolvedValue(undefined);
  readonly end = vi.fn();
  volume: number;

  constructor(volume: number) {
    super();
    this.volume = volume;
  }
}

vi.mock('@eolian/framework/voice/song-stream', async () => {
  const { EventEmitter } = await import('node:events');
  const { Readable } = await import('node:stream');
  return {
    SongStream: class extends EventEmitter {
      readonly stream = new Readable({ read() {} });
      readonly setStreamTrack = vi.fn().mockResolvedValue(true);
      readonly close = vi.fn().mockResolvedValue(undefined);
      readonly end = vi.fn();
      volume: number;

      constructor(volume: number) {
        super();
        this.volume = volume;
        songMocks.instances.push(this as unknown as MockSongStream);
        songMocks.setups.shift()?.(this as unknown as MockSongStream);
      }
    },
  };
});

const loggerMocks = vi.hoisted(() => ({
  debug: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@eolian/common/logger', () => ({ logger: loggerMocks }));
vi.mock('@eolian/common/env', () => ({ environment: { debug: false } }));

import { AudioPlayerStatus, StreamType, VoiceConnectionStatus } from '@discordjs/voice';
import { DiscordPlayer } from '@eolian/framework/voice/discord-player';

class MockAudioPlayer extends EventEmitter {
  readonly play = vi.fn();
  readonly stop = vi.fn().mockReturnValue(true);
  readonly pause = vi.fn().mockReturnValue(true);
  readonly unpause = vi.fn().mockReturnValue(true);
}

function track(id: string): Track {
  return {
    id,
    title: `Track ${id}`,
    poster: 'Artist',
    url: `https://example.com/${id}`,
    src: TrackSource.YouTube,
  };
}

function createQueue(tracks: Track[] = [track('one')]) {
  const items = [...tracks];
  return {
    loop: false,
    idle: false,
    setLoopMode: vi.fn(),
    size: vi.fn(async () => items.length),
    unpop: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
    move: vi.fn(),
    add: vi.fn(),
    shuffle: vi.fn(),
    clear: vi.fn(),
    pop: vi.fn(async () => items.shift()),
    peek: vi.fn(async () => items[0]),
    peekReverse: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  } as unknown as ContextMusicQueue;
}

function harness(tracks: Track[] = [track('one')]) {
  const audioPlayer = new MockAudioPlayer();
  const discordConnection = new EventEmitter();
  const channel = {
    id: 'voice',
    joinable: true,
    join: vi.fn(),
    hasPeopleListening: vi.fn().mockReturnValue(true),
  };
  const connection = {
    discordConnection,
    subscribe: vi.fn().mockReturnValue(true),
    awaitReconnect: vi.fn().mockResolvedValue(true),
    close: vi.fn().mockResolvedValue(undefined),
    getChannel: vi.fn().mockReturnValue(channel),
  };
  const client = {
    getVoice: vi.fn().mockReturnValue(connection),
  } as unknown as ContextClient;
  const queue = createQueue(tracks);
  const progress = { init: vi.fn(), update: vi.fn(), done: vi.fn() };
  voiceMocks.createAudioPlayer.mockReturnValue(audioPlayer);
  voiceMocks.createAudioResource.mockReturnValue({ resource: true });
  const player = new DiscordPlayer(client, queue, 0.4);
  player.on('error', vi.fn());
  return { player, audioPlayer, connection, discordConnection, channel, client, queue, progress };
}

async function play(h: ReturnType<typeof harness>) {
  await h.player.play(h.progress);
  return songMocks.instances.at(-1)!;
}

describe('DiscordPlayer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    songMocks.instances.length = 0;
    songMocks.setups.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('constructs the audio player lazily with production listeners and options', async () => {
    const h = harness();

    expect(voiceMocks.createAudioPlayer).not.toHaveBeenCalled();
    await play(h);

    expect(voiceMocks.createAudioPlayer).toHaveBeenCalledWith({
      debug: false,
      behaviors: { noSubscriber: 'pause', maxMissedFrames: Number.MAX_VALUE },
    });
    expect(h.audioPlayer.listenerCount('error')).toBe(1);
    expect(h.audioPlayer.listenerCount(AudioPlayerStatus.Idle)).toBe(1);
    expect(h.audioPlayer.listenerCount(AudioPlayerStatus.Buffering)).toBe(0);
  });

  it('does not construct an audio player when stopped before playback', () => {
    const h = harness();

    h.player.stop();

    expect(voiceMocks.createAudioPlayer).not.toHaveBeenCalled();
    expect(h.connection.close).toHaveBeenCalledOnce();
  });

  it('reports setup progress and safely handles playback without a connection', async () => {
    const h = harness();
    vi.mocked(h.client.getVoice).mockReturnValue(undefined);
    const onError = vi.fn();
    h.player.removeAllListeners('error');
    h.player.on('error', onError);

    await h.player.play(h.progress);

    expect(h.progress.init).toHaveBeenCalledWith('⚡ Setting up player...');
    expect(h.player.isStreaming).toBe(false);
    expect(onError).toHaveBeenCalledOnce();
    expect(voiceMocks.createAudioPlayer).not.toHaveBeenCalled();
  });

  it('creates, plays, and subscribes a raw resource after popping the next track', async () => {
    const h = harness();
    const onNext = vi.fn();
    h.player.on('next', onNext);

    const song = await play(h);

    expect(song.setStreamTrack).toHaveBeenCalledWith(
      track('one'),
      { nightcore: false, bass: false },
      false,
      undefined,
      h.progress,
    );
    expect(h.queue.pop).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledWith(track('one'));
    expect(voiceMocks.createAudioResource).toHaveBeenCalledWith(song.stream, {
      inputType: StreamType.Raw,
      inlineVolume: false,
      silencePaddingFrames: 30,
    });
    expect(h.audioPlayer.play).toHaveBeenCalledWith({ resource: true });
    expect(h.connection.subscribe).toHaveBeenCalledWith(h.audioPlayer);
    expect(h.discordConnection.listenerCount(VoiceConnectionStatus.Disconnected)).toBe(1);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('cleans up and emits error when subscription fails', async () => {
    const h = harness();
    h.connection.subscribe.mockReturnValue(false);
    const onError = vi.fn();
    h.player.removeAllListeners('error');
    h.player.on('error', onError);

    await play(h);

    expect(onError).toHaveBeenCalledOnce();
    expect(h.player.isStreaming).toBe(false);
    expect(h.audioPlayer.stop).toHaveBeenCalledOnce();
    expect(h.connection.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('tries at most five failed tracks, emits failures, and never subscribes', async () => {
    const tracks = Array.from({ length: 6 }, (_, index) => track(`${index + 1}`));
    const h = harness(tracks);
    const onFailure = vi.fn();
    const onError = vi.fn();
    h.player.on('trackFailure', onFailure);
    h.player.removeAllListeners('error');
    h.player.on('error', onError);

    songMocks.setups.push(song => song.setStreamTrack.mockResolvedValue(false));
    await h.player.play();
    const song = songMocks.instances[0];

    expect(song.setStreamTrack).toHaveBeenCalledTimes(5);
    expect(onFailure.mock.calls.map(([failed]) => failed.id)).toEqual(['1', '2', '3', '4', '5']);
    expect(h.queue.pop).toHaveBeenCalledTimes(5);
    expect(h.queue.peek).toHaveBeenCalledTimes(6);
    expect(h.connection.subscribe).not.toHaveBeenCalled();
    expect(voiceMocks.createAudioResource).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledOnce();
  });

  it('does not subscribe after stream setup throws', async () => {
    const h = harness();
    songMocks.setups.push(song =>
      song.setStreamTrack.mockRejectedValue(new Error('stream failed')),
    );

    await h.player.play();

    expect(h.connection.subscribe).not.toHaveBeenCalled();
    expect(h.player.isStreaming).toBe(false);
  });

  it('skips to a new stream when items remain and stops when none remain', async () => {
    const h = harness([track('one'), track('two')]);
    const first = await play(h);
    h.queue.size = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    await h.player.skip(h.progress);
    const second = songMocks.instances[1];

    expect(h.progress.init).toHaveBeenLastCalledWith('📀 Swapping records...');
    expect(first.close).toHaveBeenCalledOnce();
    expect(second.setStreamTrack).toHaveBeenCalledWith(
      track('two'),
      { nightcore: false, bass: false },
      false,
      undefined,
      h.progress,
    );
    expect(h.connection.subscribe).toHaveBeenCalledTimes(1);

    await h.player.skip(h.progress);
    expect(h.player.isStreaming).toBe(false);
    expect(h.connection.close).toHaveBeenCalledOnce();
  });

  it('routes skip setup failures through cleanup', async () => {
    const h = harness([track('one'), track('two')]);
    await play(h);
    h.queue.size = vi.fn().mockResolvedValue(1);
    songMocks.setups.push(song => song.setStreamTrack.mockRejectedValue(new Error('skip failed')));

    await expect(h.player.skip(h.progress)).resolves.toBeUndefined();

    expect(h.player.isStreaming).toBe(false);
    expect(h.connection.close).toHaveBeenCalledOnce();
  });

  it('updates pause and resume state only when the SDK transition succeeds', async () => {
    const h = harness();
    const onUpdate = vi.fn();
    h.player.on('update', onUpdate);
    await play(h);

    h.audioPlayer.pause.mockReturnValueOnce(false);
    await h.player.pause();
    expect(h.player.paused).toBe(false);

    await h.player.pause();
    expect(h.player.paused).toBe(true);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    h.audioPlayer.unpause.mockReturnValueOnce(false);
    await h.player.resume();
    expect(h.player.paused).toBe(true);

    await h.player.resume();
    expect(h.player.paused).toBe(false);
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  it('clamps volume, forwards it to the stream, and emits updates', async () => {
    const h = harness();
    const onUpdate = vi.fn();
    h.player.on('update', onUpdate);

    h.player.setVolume(-2);
    expect(h.player.volume).toBe(0);
    await play(h);
    h.player.setVolume(4);

    expect(h.player.volume).toBe(1);
    expect(songMocks.instances[0].volume).toBe(1);
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  it('forwards effect flags when selecting a track', async () => {
    const h = harness();
    h.player.setNightcore(true);
    h.player.setBassBoost(true);

    const song = await play(h);

    expect(h.player.nightcore).toBe(true);
    expect(h.player.bass).toBe(true);
    expect(song.setStreamTrack.mock.calls[0][1]).toEqual({ nightcore: true, bass: true });
  });

  it('tracks idle time for stopped and paused playback', async () => {
    const h = harness();
    expect(h.player.idle).toBe(false);

    await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MINS * 1000);
    expect(h.player.idle).toBe(true);

    await play(h);
    expect(h.player.idle).toBe(false);
    await h.player.pause();
    await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MINS * 1000);
    expect(h.player.idle).toBe(true);
  });

  it('emits idle and stops after the channel has no listeners at a timeout check', async () => {
    const h = harness();
    const onIdle = vi.fn();
    const onDone = vi.fn();
    h.player.on('idle', onIdle);
    h.player.on('done', onDone);
    await play(h);
    h.channel.hasPeopleListening.mockReturnValue(false);

    await vi.advanceTimersByTimeAsync(3 * 60 * 1000);

    expect(onIdle).toHaveBeenCalledOnce();
    expect(onDone).toHaveBeenCalledOnce();
    expect(h.player.isStreaming).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps playback on a successful reconnect and cleans up on failure', async () => {
    const success = harness();
    await play(success);
    success.discordConnection.emit(VoiceConnectionStatus.Disconnected);
    await vi.waitFor(() => expect(success.connection.awaitReconnect).toHaveBeenCalledOnce());
    expect(success.player.isStreaming).toBe(true);

    const failure = harness();
    failure.connection.awaitReconnect.mockResolvedValue(false);
    await play(failure);
    failure.discordConnection.emit(VoiceConnectionStatus.Disconnected);
    await vi.waitFor(() => expect(failure.connection.close).toHaveBeenCalledOnce());
    expect(failure.player.isStreaming).toBe(false);
  });

  it('loads the next track into the persistent stream when the stream ends', async () => {
    const h = harness([track('one'), track('two')]);
    const onNext = vi.fn();
    h.player.on('next', onNext);
    const song = await play(h);

    song.emit('end');
    await vi.waitFor(() => expect(song.setStreamTrack).toHaveBeenCalledTimes(2));

    expect(song.setStreamTrack.mock.calls[1][0]).toEqual(track('two'));
    expect(onNext).toHaveBeenLastCalledWith(track('two'));
    expect(song.end).not.toHaveBeenCalled();
    expect(voiceMocks.createAudioResource).toHaveBeenCalledOnce();
  });

  it('ends the persistent stream when nobody is listening or no track remains', async () => {
    const noListeners = harness([track('one')]);
    const onIdle = vi.fn();
    noListeners.player.on('idle', onIdle);
    const firstSong = await play(noListeners);
    noListeners.channel.hasPeopleListening.mockReturnValue(false);
    firstSong.emit('end');
    await vi.waitFor(() => expect(firstSong.end).toHaveBeenCalledOnce());
    expect(onIdle).toHaveBeenCalledOnce();

    const empty = harness([track('one')]);
    const secondSong = await play(empty);
    secondSong.emit('end');
    await vi.waitFor(() => expect(secondSong.end).toHaveBeenCalledOnce());
  });

  it('forwards retry, update, done, idle, error, and track failure events', async () => {
    const h = harness([track('one'), track('bad')]);
    const events = {
      retry: vi.fn(),
      update: vi.fn(),
      done: vi.fn(),
      idle: vi.fn(),
      error: vi.fn(),
      trackFailure: vi.fn(),
    };
    h.player.on('retry', events.retry);
    h.player.on('update', events.update);
    h.player.on('done', events.done);
    h.player.on('idle', events.idle);
    h.player.removeAllListeners('error');
    h.player.on('error', events.error);
    h.player.on('trackFailure', events.trackFailure);
    const song = await play(h);

    song.emit('retry');
    h.player.setVolume(0.5);
    song.setStreamTrack.mockResolvedValue(false);
    song.emit('end');
    await vi.waitFor(() => expect(song.end).toHaveBeenCalledOnce());
    h.channel.hasPeopleListening.mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000);

    expect(events.retry).toHaveBeenCalledOnce();
    expect(events.update).toHaveBeenCalledOnce();
    expect(events.trackFailure).toHaveBeenCalledWith(track('bad'));
    expect(events.idle).toHaveBeenCalledOnce();
    expect(events.done).toHaveBeenCalledOnce();

    const errorHarness = harness();
    errorHarness.player.removeAllListeners('error');
    errorHarness.player.on('error', events.error);
    await play(errorHarness);
    errorHarness.audioPlayer.emit('error', new Error('audio failed'));
    expect(events.error).toHaveBeenCalledOnce();
  });

  it('handles audio-player errors safely when no player error listener exists', async () => {
    const h = harness();
    h.player.removeAllListeners('error');
    await play(h);

    expect(() => h.audioPlayer.emit('error', new Error('audio failed'))).not.toThrow();
    expect(h.player.isStreaming).toBe(false);
    expect(loggerMocks.warn).toHaveBeenCalled();
  });

  it('stop removes the timer and disconnect listener and closes active resources', async () => {
    const h = harness();
    const onDone = vi.fn();
    h.player.on('done', onDone);
    const song = await play(h);

    h.player.stop();

    expect(h.discordConnection.listenerCount(VoiceConnectionStatus.Disconnected)).toBe(0);
    expect(h.audioPlayer.stop).toHaveBeenCalledOnce();
    expect(song.close).toHaveBeenCalledOnce();
    expect(onDone).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('close removes SDK listeners and permits a fresh lazy audio player', async () => {
    const h = harness([track('one'), track('two')]);
    await play(h);

    await h.player.close();

    expect(h.audioPlayer.eventNames()).toEqual([]);
    const replacement = new MockAudioPlayer();
    voiceMocks.createAudioPlayer.mockReturnValue(replacement);
    vi.mocked(h.client.getVoice).mockReturnValue(h.connection as never);
    await h.player.play();
    expect(voiceMocks.createAudioPlayer).toHaveBeenCalledTimes(2);
  });
});
