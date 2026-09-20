import { describe, expect, it, vi } from 'vitest';
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { EolianUserError } from '@eolian/common/errors';

vi.mock('@eolian/embed', () => ({
  createSelectionEmbed: vi.fn((question: string) => ({ title: question })),
}));

import { DiscordChannelSender } from '@eolian/framework/discord-channel-sender';
import { DiscordTextChannel } from '@eolian/framework/discord-channel';

function createCollector() {
  return {
    once: vi.fn(),
    stop: vi.fn(),
  };
}

function createGuildChannel(allowed: bigint) {
  const permissions = {
    has: vi.fn((required: bigint) => (allowed & required) === required),
  };
  return {
    channel: {
      id: 'channel',
      type: ChannelType.GuildText,
      lastMessageId: null,
      guild: { members: { me: {} } },
      permissionsFor: vi.fn(() => permissions),
      send: vi.fn().mockResolvedValue({ id: 'sent' }),
      createMessageCollector: vi.fn(() => createCollector()),
    },
    permissions,
  };
}

describe('DiscordChannelSender', () => {
  it('caches the complete send permission check and blocks ordinary sends', async () => {
    const { channel, permissions } = createGuildChannel(PermissionFlagsBits.ViewChannel);
    const sender = new DiscordChannelSender(channel as never, {} as never, channel as never);

    expect(sender.sendable).toBe(false);
    expect(sender.sendable).toBe(false);
    expect(permissions.has).toHaveBeenCalledOnce();
    await expect(sender.send('blocked')).resolves.toBeUndefined();
    expect(channel.send).not.toHaveBeenCalled();
  });

  it('allows a forced text response but never forces an embed', async () => {
    const { channel } = createGuildChannel(0n);
    const sender = new DiscordChannelSender(channel as never, {} as never, channel as never);

    expect(await sender.send('forced', { force: true })).toBeDefined();
    expect(channel.send).toHaveBeenCalledWith({ content: 'forced' }, undefined, undefined);
    expect(await sender.sendEmbed({ title: 'blocked' }, { force: true })).toBeUndefined();
    expect(channel.send).toHaveBeenCalledTimes(1);
  });

  it('accepts DM channels without querying guild permissions', () => {
    const channel = {
      id: 'dm',
      type: ChannelType.DM,
      send: vi.fn(),
      createMessageCollector: vi.fn(),
    };
    expect(new DiscordChannelSender(channel as never, {} as never, channel as never).sendable).toBe(
      true,
    );
  });

  it('resolves a text selection, deletes the response, and releases buttons', async () => {
    const collector = createCollector();
    const selectedMessage = {
      content: '2',
      deletable: true,
      delete: vi.fn().mockResolvedValue(undefined),
    };
    collector.once.mockImplementation((_event, cb) => {
      queueMicrotask(() => cb({ first: () => selectedMessage }));
      return collector;
    });
    const sentEmbed = { releaseButtons: vi.fn() };
    const channel = {
      id: 'dm',
      type: ChannelType.DM,
      send: vi.fn().mockResolvedValue({
        id: 'selection',
        content: '',
        editable: true,
        deletable: true,
      }),
      createMessageCollector: vi.fn(() => collector),
    };
    const sender = new DiscordChannelSender(channel as never, {} as never, channel as never);
    vi.spyOn(sender, 'sendEmbed').mockResolvedValue(sentEmbed as never);

    await expect(
      sender.sendSelection('Choose', ['one', 'two'], {
        id: 'user',
        name: 'Ada',
      } as never),
    ).resolves.toEqual({ message: sentEmbed, selected: 1 });
    expect(selectedMessage.delete).toHaveBeenCalledOnce();
    expect(sentEmbed.releaseButtons).toHaveBeenCalledOnce();
  });

  it('turns selection timeout into a contextual user error', async () => {
    const collector = createCollector();
    collector.once.mockImplementation((_event, cb) => {
      queueMicrotask(() => cb({ first: () => undefined }));
      return collector;
    });
    const sentEmbed = { releaseButtons: vi.fn() };
    const channel = {
      id: 'dm',
      type: ChannelType.DM,
      send: vi.fn(),
      createMessageCollector: vi.fn(() => collector),
    };
    const sender = new DiscordChannelSender(channel as never, {} as never, channel as never);
    vi.spyOn(sender, 'sendEmbed').mockResolvedValue(sentEmbed as never);

    const error = await sender
      .sendSelection('Choose', ['one'], { id: 'user', name: 'Ada' } as never)
      .catch(reason => reason);
    expect(error).toBeInstanceOf(EolianUserError);
    expect(error.message).toBe('Nothing selected 😢');
    expect(error.context).toBe(sentEmbed);
  });
});

describe('DiscordTextChannel', () => {
  it('exposes identity and separate visibility/reaction permissions', () => {
    const { channel } = createGuildChannel(
      PermissionFlagsBits.ViewChannel | PermissionFlagsBits.AddReactions,
    );
    channel.lastMessageId = 'last' as never;
    const wrapper = new DiscordTextChannel(channel as never, {} as never);

    expect(wrapper.id).toBe('channel');
    expect(wrapper.lastMessageId).toBe('last');
    expect(wrapper.isDm).toBe(false);
    expect(wrapper.visible).toBe(true);
    expect(wrapper.reactable).toBe(true);
  });
});
