import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Track, TrackSource } from '@eolian/api/@types';
import { UserPermission } from '@eolian/common/constants';
import {
  ContextButtonInteraction,
  ContextMessage,
  ContextMusicQueue,
  ContextSendable,
  ContextTextChannel,
  ContextVoiceChannel,
  EmbedMessage,
  QueueDisplay,
} from '@eolian/framework/@types';
import { DiscordPlayerDisplay } from '@eolian/framework/discord-player-display';
import { Player } from '@eolian/framework/voice/@types';

const progress = vi.hoisted(() => ({
  instances: [] as Array<{ done: ReturnType<typeof vi.fn> }>,
}));
const embeds = vi.hoisted(() => ({
  basic: vi.fn((description: string) => ({ description })),
  playing: vi.fn((current: Track, volume: number, nightcore: boolean, bass: boolean) => ({
    current,
    volume,
    nightcore,
    bass,
  })),
}));

vi.mock('@eolian/framework/message-progress-updater', () => ({
  MessageProgressUpdater: class {
    readonly done = vi.fn().mockResolvedValue(undefined);

    constructor() {
      progress.instances.push(this);
    }
  },
}));
vi.mock('@eolian/embed', () => ({
  createBasicEmbed: embeds.basic,
  createPlayingEmbed: embeds.playing,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function track(id: number): Track {
  return {
    id: String(id),
    title: `Track ${id}`,
    poster: `Artist ${id}`,
    src: TrackSource.YouTube,
    url: `https://example.test/${id}`,
  };
}

class FakeMessage implements ContextMessage {
  readonly text = '';
  readonly edit = vi.fn<(message: string) => Promise<void>>().mockResolvedValue(undefined);
  readonly editEmbed = vi.fn<(embed: EmbedMessage) => Promise<void>>().mockResolvedValue(undefined);
  readonly react = vi.fn<(emoji: string) => Promise<void>>().mockResolvedValue(undefined);
  readonly releaseButtons = vi.fn<() => void>();
  readonly delete = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

  constructor(readonly id: string) {}
}

class FakeSendable implements ContextSendable {
  readonly sendable = true;
  readonly send = vi.fn().mockResolvedValue(undefined);
  readonly sendSelection = vi.fn();
  readonly sendEmbed = vi.fn<(embed: EmbedMessage) => Promise<ContextMessage | undefined>>();

  constructor(message?: ContextMessage) {
    this.sendEmbed.mockResolvedValue(message);
  }
}

class FakeChannel extends FakeSendable implements ContextTextChannel {
  readonly id = 'text';
  readonly isDm = false;
  readonly visible = true;
  readonly reactable = true;
  lastMessageId?: string;
}

class FakeQueue extends EventEmitter implements ContextMusicQueue {
  loop = false;
  idle = false;
  readonly setLoopMode = vi.fn().mockResolvedValue(undefined);
  readonly size = vi.fn<(loop?: boolean) => Promise<number>>().mockResolvedValue(1);
  readonly unpop = vi.fn().mockResolvedValue(true);
  readonly get = vi
    .fn<(index: number, count: number) => Promise<[Track[], Track[]]>>()
    .mockResolvedValue([[track(2)], []]);
  readonly remove = vi.fn().mockResolvedValue(0);
  readonly move = vi.fn().mockResolvedValue(undefined);
  readonly add = vi.fn().mockResolvedValue(undefined);
  readonly shuffle = vi.fn().mockResolvedValue(true);
  readonly clear = vi.fn().mockResolvedValue(true);
  readonly pop = vi.fn().mockResolvedValue(undefined);
  readonly peek = vi.fn().mockResolvedValue(undefined);
  readonly peekReverse = vi.fn<() => Promise<Track | undefined>>().mockResolvedValue(track(0));
}

class FakePlayer extends EventEmitter implements Player {
  readonly isStreaming = true;
  paused = false;
  volume = 0.5;
  nightcore = false;
  bass = false;
  idle = false;
  voiceChannel: ContextVoiceChannel | undefined = { id: 'voice' } as ContextVoiceChannel;
  readonly getChannel = vi.fn(() => this.voiceChannel);
  readonly setVolume = vi.fn();
  readonly setNightcore = vi.fn();
  readonly setBassBoost = vi.fn();
  readonly play = vi.fn().mockResolvedValue(undefined);
  readonly skip = vi.fn().mockResolvedValue(undefined);
  readonly stop = vi.fn();
  readonly pause = vi.fn().mockResolvedValue(undefined);
  readonly resume = vi.fn().mockResolvedValue(undefined);
  readonly close = vi.fn().mockResolvedValue(undefined);

  constructor(readonly queue: FakeQueue) {
    super();
  }
}

class FakeQueueDisplay implements QueueDisplay {
  readonly setChannel = vi.fn();
  readonly removeIdle = vi.fn().mockResolvedValue(undefined);
  readonly send = vi.fn().mockResolvedValue(undefined);
  readonly delete = vi.fn().mockResolvedValue(undefined);
  readonly close = vi.fn().mockResolvedValue(undefined);
}

function buttonInteraction(voiceId: string | undefined = 'voice') {
  const message = new FakeMessage('interaction');
  return {
    message,
    user: {
      getVoice: vi.fn(() => (voiceId ? { id: voiceId } : undefined)),
    },
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(message),
  } as unknown as ContextButtonInteraction;
}

function sentEmbed(send: ReturnType<typeof vi.fn>, call = 0): EmbedMessage {
  return send.mock.calls[call][0] as EmbedMessage;
}

function fixture(sendable?: ContextSendable) {
  const queue = new FakeQueue();
  const player = new FakePlayer(queue);
  const queueDisplay = new FakeQueueDisplay();
  const message = new FakeMessage('player');
  const channel = new FakeChannel(message);
  channel.lastMessageId = message.id;
  const display = new DiscordPlayerDisplay(player, queueDisplay);
  display.setChannel(channel, sendable);
  return { queue, player, queueDisplay, message, channel, display };
}

async function start(f: ReturnType<typeof fixture>, current = track(1)) {
  f.player.emit('next', current);
  await vi.waitFor(() => expect(f.channel.sendEmbed).toHaveBeenCalled());
}

describe('DiscordPlayerDisplay', () => {
  beforeEach(() => {
    progress.instances.length = 0;
  });

  it('registers all player and queue listeners and removes them on close', async () => {
    const f = fixture();
    for (const event of ['next', 'update', 'idle', 'done', 'error', 'retry', 'trackFailure']) {
      expect(f.player.listenerCount(event)).toBe(1);
    }
    expect(f.queue.listenerCount('add')).toBe(1);
    expect(f.queue.listenerCount('remove')).toBe(1);

    await f.display.close();

    for (const event of ['next', 'update', 'idle', 'done', 'error', 'retry', 'trackFailure']) {
      expect(f.player.listenerCount(event)).toBe(0);
    }
    expect(f.queue.listenerCount('add')).toBe(0);
    expect(f.queue.listenerCount('remove')).toBe(0);
  });

  it('uses a one-shot sendable, then edits or replaces the player message as needed', async () => {
    const interactionMessage = new FakeMessage('interaction-player');
    const sendable = new FakeSendable(interactionMessage);
    const f = fixture(sendable);

    f.player.emit('next', track(1));
    await vi.waitFor(() => expect(sendable.sendEmbed).toHaveBeenCalledOnce());
    expect(f.channel.sendEmbed).not.toHaveBeenCalled();

    f.player.emit('update');
    await vi.waitFor(() => expect(interactionMessage.editEmbed).toHaveBeenCalledOnce());
    await f.display.refresh();
    expect(interactionMessage.delete).toHaveBeenCalledOnce();
    expect(f.channel.sendEmbed).toHaveBeenCalledOnce();

    f.channel.lastMessageId = 'newer-message';
    f.player.emit('next', track(2));
    await vi.waitFor(() => expect(f.channel.sendEmbed).toHaveBeenCalledTimes(2));
    expect(f.message.delete).toHaveBeenCalledOnce();
  });

  it('generates queue, history, pause, skip, and stop button states', async () => {
    const f = fixture();
    f.queue.size.mockResolvedValue(0);
    f.queue.peekReverse.mockResolvedValue(undefined);
    f.player.paused = true;
    await start(f);

    const buttons = sentEmbed(f.channel.sendEmbed).buttons!;
    expect(buttons.map(({ emoji, disabled, permission }) => [emoji, disabled, permission])).toEqual(
      [
        ['⏏', true, UserPermission.DJLimited],
        ['⏪', true, UserPermission.DJ],
        ['▶️', undefined, UserPermission.DJ],
        ['⏩', undefined, UserPermission.DJ],
        ['⏹', undefined, UserPermission.DJ],
      ],
    );

    f.queue.loop = true;
    f.queue.peekReverse.mockResolvedValue(track(0));
    f.queue.emit('add');
    await vi.waitFor(() => expect(f.message.editEmbed).toHaveBeenCalledOnce());
    expect(f.message.editEmbed.mock.calls[0][0].buttons?.[0].disabled).toBe(false);
  });

  it('toggles the queue display and waits for each operation', async () => {
    const f = fixture();
    await start(f);
    const queueButton = sentEmbed(f.channel.sendEmbed).buttons![0];
    const interaction = buttonInteraction();
    const sending = deferred<void>();
    f.queueDisplay.send.mockReturnValueOnce(sending.promise);

    const opening = queueButton.onClick(interaction, '⏏');
    await vi.waitFor(() => expect(f.queueDisplay.send).toHaveBeenCalledOnce());
    expect(f.queueDisplay.setChannel).toHaveBeenCalledWith(f.channel);
    let finished = false;
    void opening.then(() => {
      finished = true;
    });
    await Promise.resolve();
    expect(finished).toBe(false);

    sending.resolve();
    await expect(opening).resolves.toBe(false);
    await queueButton.onClick(interaction, '⏏');
    expect(f.queueDisplay.delete).toHaveBeenCalledOnce();
  });

  it('pauses and resumes while rejecting users outside the player voice channel', async () => {
    const f = fixture();
    await start(f);
    const pauseButton = sentEmbed(f.channel.sendEmbed).buttons![2];
    const listener = buttonInteraction();

    await pauseButton.onClick(listener, '⏸️');
    expect(listener.deferUpdate).toHaveBeenCalledOnce();
    expect(f.player.pause).toHaveBeenCalledOnce();

    f.player.paused = true;
    await pauseButton.onClick(listener, '▶️');
    expect(f.player.resume).toHaveBeenCalledOnce();

    const outsider = buttonInteraction('other-voice');
    await pauseButton.onClick(outsider, '⏸️');
    expect(outsider.send).toHaveBeenCalledWith(
      'You are not currently listening! Join my voice channel and try again.',
      { ephemeral: true },
    );
    expect(f.player.pause).toHaveBeenCalledOnce();
  });

  it('locks input until an operation completes', async () => {
    const f = fixture();
    await start(f);
    const pauseButton = sentEmbed(f.channel.sendEmbed).buttons![2];
    const waiting = deferred<void>();
    f.player.pause.mockReturnValueOnce(waiting.promise);
    const first = buttonInteraction();
    const second = buttonInteraction();

    const pending = pauseButton.onClick(first, '⏸️');
    await vi.waitFor(() => expect(f.player.pause).toHaveBeenCalledOnce());
    await pauseButton.onClick(second, '⏸️');
    expect(second.send).toHaveBeenCalledWith('Please wait for another operation to complete.', {
      ephemeral: true,
    });

    waiting.resolve();
    await pending;
  });

  it('backs, skips, completes progress on failure, and removes a stale player message', async () => {
    const f = fixture();
    await start(f);
    const buttons = sentEmbed(f.channel.sendEmbed).buttons!;
    const interaction = buttonInteraction();

    await buttons[1].onClick(interaction, '⏪');
    expect(f.queue.unpop).toHaveBeenCalledWith(2);
    expect(f.player.skip).toHaveBeenCalledOnce();
    expect(progress.instances[0].done).toHaveBeenCalledOnce();

    f.channel.lastMessageId = 'newer-message';
    await buttons[3].onClick(interaction, '⏩');
    expect(progress.instances[1].done).toHaveBeenCalledOnce();
    expect(f.message.delete).toHaveBeenCalledOnce();

    f.player.skip.mockRejectedValueOnce(new Error('skip failed'));
    await expect(buttons[3].onClick(interaction, '⏩')).rejects.toThrow('skip failed');
    expect(progress.instances[2].done).toHaveBeenCalledOnce();
  });

  it('does not skip when history cannot be restored and stops playback', async () => {
    const f = fixture();
    f.queue.unpop.mockResolvedValue(false);
    await start(f);
    const buttons = sentEmbed(f.channel.sendEmbed).buttons!;
    const interaction = buttonInteraction();

    await buttons[1].onClick(interaction, '⏪');
    expect(f.player.skip).not.toHaveBeenCalled();

    await buttons[4].onClick(interaction, '⏹');
    expect(interaction.deferUpdate).toHaveBeenCalledOnce();
    expect(f.player.stop).toHaveBeenCalledOnce();
    expect(f.message.delete).toHaveBeenCalledOnce();
  });

  it('handles idle, end, error, retry, and track failure events', async () => {
    const f = fixture();
    await start(f);

    f.player.emit('done');
    await vi.waitFor(() => expect(f.message.edit).toHaveBeenCalledWith('Goodbye 👋'));
    expect(f.message.releaseButtons).toHaveBeenCalledOnce();

    f.player.emit('next', track(2));
    await vi.waitFor(() => expect(f.channel.sendEmbed).toHaveBeenCalledTimes(2));
    f.player.emit('retry');
    f.player.emit('trackFailure', track(9));
    await vi.waitFor(() => expect(f.channel.send).toHaveBeenCalledTimes(2));
    expect(f.channel.send).toHaveBeenCalledWith('Error occured while streaming. Retrying...');
    expect(f.channel.send).toHaveBeenCalledWith(
      '❌ I could not find stream for **Track 9** by **Artist 9**. Skipping.',
    );

    f.player.emit('error');
    await vi.waitFor(() =>
      expect(f.channel.send).toHaveBeenCalledWith(expect.stringContaining('known issue')),
    );
    expect(f.message.delete).toHaveBeenCalledOnce();

    f.player.emit('done');
    await vi.waitFor(() => expect(f.channel.send).toHaveBeenCalledWith('Goodbye 👋'));

    f.player.emit('next', track(3));
    await vi.waitFor(() => expect(f.channel.sendEmbed).toHaveBeenCalledTimes(3));
    const replacement = f.channel.sendEmbed.mock.results[1].value;
    await replacement;
    f.player.emit('idle');
    await vi.waitFor(() =>
      expect(f.message.editEmbed).toHaveBeenCalledWith(
        expect.objectContaining({ description: '**Player has been removed due to idle**' }),
      ),
    );
    expect(f.message.releaseButtons).toHaveBeenCalledTimes(2);
  });
});
