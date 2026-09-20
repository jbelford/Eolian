import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { Track, TrackSource } from '@eolian/api/@types';
import { UserPermission } from '@eolian/common/constants';
import {
  ContextButtonInteraction,
  ContextMessage,
  ContextMusicQueue,
  ContextSendable,
  ContextTextChannel,
  EmbedMessage,
} from '@eolian/framework/@types';
import { DiscordQueueDisplay, QUEUE_PAGE_LENGTH } from '@eolian/framework/discord-queue-display';

const embeds = vi.hoisted(() => ({
  basic: vi.fn((description: string) => ({ description })),
  queue: vi.fn(
    (tracks: Track[], loop: Track[], start: number, total: number, looping: boolean) => ({
      tracks,
      loop,
      start,
      total,
      looping,
    }),
  ),
}));

vi.mock('@eolian/embed', () => ({
  createBasicEmbed: embeds.basic,
  createQueueEmbed: embeds.queue,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
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
  readonly size = vi.fn<(loop?: boolean) => Promise<number>>().mockResolvedValue(0);
  readonly unpop = vi.fn().mockResolvedValue(false);
  readonly get = vi
    .fn<(index: number, count: number) => Promise<[Track[], Track[]]>>()
    .mockResolvedValue([[], []]);
  readonly remove = vi.fn().mockResolvedValue(0);
  readonly move = vi.fn().mockResolvedValue(undefined);
  readonly add = vi.fn().mockResolvedValue(undefined);
  readonly shuffle = vi.fn().mockResolvedValue(true);
  readonly clear = vi.fn().mockResolvedValue(true);
  readonly pop = vi.fn().mockResolvedValue(undefined);
  readonly peek = vi.fn().mockResolvedValue(undefined);
  readonly peekReverse = vi.fn().mockResolvedValue(undefined);
}

function buttonInteraction() {
  return {
    deferUpdate: vi.fn().mockResolvedValue(undefined),
  } as unknown as ContextButtonInteraction;
}

function sentEmbed(send: ReturnType<typeof vi.fn>, call = 0): EmbedMessage {
  return send.mock.calls[call][0] as EmbedMessage;
}

describe('DiscordQueueDisplay', () => {
  it('registers its update listener and removes it on close', async () => {
    const queue = new FakeQueue();
    const display = new DiscordQueueDisplay(queue);

    expect(queue.listenerCount('update')).toBe(1);
    await display.close();
    expect(queue.listenerCount('update')).toBe(0);
  });

  it('requires a channel, prefers a one-shot sendable, and deletes the stale message', async () => {
    const queue = new FakeQueue();
    const display = new DiscordQueueDisplay(queue);
    await expect(display.send([track(1)], [])).rejects.toThrow('Channel is not set!');

    const channelMessage = new FakeMessage('channel-message');
    const interactionMessage = new FakeMessage('interaction-message');
    const channel = new FakeChannel(channelMessage);
    const sendable = new FakeSendable(interactionMessage);
    display.setChannel(channel, sendable);

    await display.send([track(1)], []);
    expect(sendable.sendEmbed).toHaveBeenCalledOnce();
    expect(channel.sendEmbed).not.toHaveBeenCalled();

    await display.send([track(2)], []);
    expect(channel.sendEmbed).toHaveBeenCalledOnce();
    expect(interactionMessage.delete).toHaveBeenCalledOnce();
  });

  it('bounds queue and loop tracks and generates button states and permissions', async () => {
    const queue = new FakeQueue();
    const channel = new FakeChannel(new FakeMessage('queue'));
    const display = new DiscordQueueDisplay(queue);
    display.setChannel(channel);

    const tracks = Array.from({ length: QUEUE_PAGE_LENGTH + 2 }, (_, index) => track(index));
    await display.send(tracks, [track(100)], 3, tracks.length);
    const embed = sentEmbed(channel.sendEmbed);

    expect(embed).toMatchObject({
      tracks: tracks.slice(0, QUEUE_PAGE_LENGTH),
      loop: [],
      start: 3,
      total: tracks.length,
      looping: false,
    });
    expect(
      embed.buttons?.map(({ emoji, disabled, permission }) => [emoji, disabled, permission]),
    ).toEqual([
      ['🔀', false, UserPermission.DJ],
      ['⬅', false, UserPermission.DJLimited],
      ['➡', false, UserPermission.DJLimited],
    ]);
  });

  it('shuffles and wraps pagination in both directions', async () => {
    const queue = new FakeQueue();
    queue.size.mockResolvedValue(20);
    queue.get.mockImplementation(async start => [[track(start)], []]);
    const message = new FakeMessage('queue');
    const channel = new FakeChannel(message);
    const display = new DiscordQueueDisplay(queue);
    display.setChannel(channel);
    await display.send([track(0)], [], 0, 20);
    const buttons = sentEmbed(channel.sendEmbed).buttons!;
    const interaction = buttonInteraction();

    await buttons[0].onClick(interaction, '🔀');
    await buttons[2].onClick(interaction, '➡');
    expect(queue.shuffle).toHaveBeenCalledOnce();
    expect(queue.get).toHaveBeenLastCalledWith(QUEUE_PAGE_LENGTH, QUEUE_PAGE_LENGTH);

    await buttons[2].onClick(interaction, '➡');
    expect(queue.get).toHaveBeenLastCalledWith(0, QUEUE_PAGE_LENGTH);

    await buttons[1].onClick(interaction, '⬅');
    expect(queue.get).toHaveBeenLastCalledWith(5, QUEUE_PAGE_LENGTH);
    expect(interaction.deferUpdate).toHaveBeenCalledTimes(4);
  });

  it('updates button state without dropping permissions and deletes an empty queue', async () => {
    const queue = new FakeQueue();
    queue.size.mockResolvedValueOnce(1);
    queue.get.mockResolvedValueOnce([[track(1)], []]);
    const message = new FakeMessage('queue');
    const display = new DiscordQueueDisplay(queue);
    display.setChannel(new FakeChannel(message));
    await display.send([track(1)], [], 0, 20);

    queue.emit('update');
    await vi.waitFor(() => expect(message.editEmbed).toHaveBeenCalledOnce());
    expect(message.editEmbed.mock.calls[0][0].buttons?.map(button => button.permission)).toEqual([
      UserPermission.DJ,
      UserPermission.DJLimited,
      UserPermission.DJLimited,
    ]);
    expect(message.editEmbed.mock.calls[0][0].buttons?.map(button => button.disabled)).toEqual([
      true,
      true,
      true,
    ]);

    queue.size.mockResolvedValueOnce(0);
    queue.emit('update');
    await vi.waitFor(() => expect(message.delete).toHaveBeenCalledOnce());
  });

  it('coalesces overlapping updates and renders the latest queue state', async () => {
    const queue = new FakeQueue();
    const firstSize = deferred<number>();
    queue.size.mockImplementationOnce(() => firstSize.promise).mockResolvedValueOnce(2);
    queue.get.mockResolvedValue([[track(2)], []]);
    const message = new FakeMessage('queue');
    const display = new DiscordQueueDisplay(queue);
    display.setChannel(new FakeChannel(message));
    await display.send([track(1)], []);

    queue.emit('update');
    queue.emit('update');
    firstSize.resolve(1);

    await vi.waitFor(() => expect(queue.size).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(message.editEmbed).toHaveBeenCalledTimes(2));
    expect(message.editEmbed.mock.calls[1][0]).toMatchObject({ total: 2 });
  });

  it('releases buttons for idle and deletes explicitly', async () => {
    const queue = new FakeQueue();
    const first = new FakeMessage('first');
    const second = new FakeMessage('second');
    const channel = new FakeChannel(first);
    channel.sendEmbed.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const display = new DiscordQueueDisplay(queue);
    display.setChannel(channel);

    await display.send([track(1)], []);
    await display.removeIdle();
    expect(first.releaseButtons).toHaveBeenCalledOnce();
    expect(first.editEmbed).toHaveBeenCalledWith(
      expect.objectContaining({ description: '**Queue has been removed due to idle**' }),
    );

    await display.send([track(2)], []);
    await display.delete();
    expect(second.delete).toHaveBeenCalledOnce();
    await display.delete();
    expect(second.delete).toHaveBeenCalledOnce();
  });
});
