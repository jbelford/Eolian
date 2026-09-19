import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChannelType, PermissionsBitField } from 'discord.js';
import { SyntaxType } from '@eolian/command-options/@types';
import { UserPermission } from '@eolian/common/constants';

const adapterMocks = vi.hoisted(() => ({
  userDto: { _id: 'user' } as Record<string, unknown>,
  userInstances: [] as unknown[],
  channelInstances: [] as unknown[],
}));

vi.mock('@eolian/framework/discord-user', () => ({
  getPermissionLevel: vi.fn(() => UserPermission.User),
  DiscordUser: class {
    id: string;
    permission: UserPermission;
    get = vi.fn(async () => adapterMocks.userDto);
    send = vi.fn();
    sendEmbed = vi.fn();
    updatePermissions = vi.fn();
    constructor(user: { id: string }, _users: unknown, permission: UserPermission) {
      this.id = user.id;
      this.permission = permission;
      adapterMocks.userInstances.push(this);
    }
  },
}));

vi.mock('@eolian/framework/discord-channel', () => ({
  DiscordTextChannel: class {
    id: string;
    isDm = true;
    visible = true;
    reactable = true;
    constructor(channel: { id: string }) {
      this.id = channel.id;
      adapterMocks.channelInstances.push(this);
    }
  },
}));

vi.mock('@eolian/framework/discord-channel-sender', () => ({
  DiscordChannelSender: class {
    sendable = true;
    send = vi.fn();
    sendEmbed = vi.fn();
    sendSelection = vi.fn();
  },
}));

vi.mock('@eolian/framework/discord-message', () => ({
  DiscordMessage: class {
    id: string;
    text: string;
    react: ReturnType<typeof vi.fn>;
    constructor(message: { id: string; content: string; react?: ReturnType<typeof vi.fn> }) {
      this.id = message.id;
      this.text = message.content;
      this.react = message.react ?? vi.fn();
    }
  },
}));

vi.mock('@eolian/commands', () => ({
  MESSAGE_COMMANDS: { safeGet: vi.fn() },
  COMMANDS: { safeGet: vi.fn() },
  SlashCommandOptionParser: class {},
}));

import { DiscordButtonInteraction } from '@eolian/framework/interaction/discord-button-interaction';
import { DiscordInteraction } from '@eolian/framework/interaction/discord-interaction';
import { DiscordInteractionOptionProvider } from '@eolian/framework/interaction/discord-interaction-option-provider';
import { DiscordMessageInteraction } from '@eolian/framework/interaction/discord-message-interaction';

const users = { get: vi.fn().mockResolvedValue(null) };
const auth = {};
const registry = { getButton: vi.fn(), register: vi.fn(), unregister: vi.fn() };

function channel() {
  return {
    id: 'channel',
    type: ChannelType.DM,
    send: vi.fn(),
    createMessageCollector: vi.fn(),
  };
}

describe('DiscordInteraction adapters', () => {
  beforeEach(() => {
    adapterMocks.userDto = { _id: 'user' };
    adapterMocks.userInstances.length = 0;
    adapterMocks.channelInstances.length = 0;
  });
  it('normalizes absent slash options to undefined', () => {
    const interaction = {
      options: {
        getBoolean: vi.fn().mockReturnValue(null),
        getString: vi.fn().mockReturnValue(null),
      },
    };
    const provider = new DiscordInteractionOptionProvider(interaction as never);
    expect(provider.getBoolean('flag')).toBeUndefined();
    expect(provider.getString('query')).toBeUndefined();
  });

  it('lazily wraps interaction users/channels and delegates deferral', async () => {
    const raw = {
      user: { id: 'user', username: 'Ada', avatarURL: () => null },
      memberPermissions: new PermissionsBitField(),
      member: null,
      channel: channel(),
      replied: false,
      deferReply: vi.fn().mockResolvedValue(undefined),
    };
    const interaction = new DiscordInteraction(
      raw as never,
      registry as never,
      users as never,
      auth as never,
    );

    expect(interaction.user).toBe(interaction.user);
    expect(interaction.user.permission).toBe(UserPermission.User);
    expect(interaction.channel).toBe(interaction.channel);
    expect(interaction.channel.id).toBe('channel');
    expect(interaction.hasReplied).toBe(false);
    await interaction.defer(false);
    expect(raw.deferReply).toHaveBeenCalledWith({ ephemeral: false });
  });

  it('wraps a button message once, filters action rows, and delegates deferUpdate', async () => {
    const rawMessage = {
      id: 'message',
      content: '',
      editable: true,
      components: [{ type: 1 }, { type: 2 }],
    };
    const raw = {
      user: { id: 'user', username: 'Ada', avatarURL: () => null },
      memberPermissions: null,
      member: null,
      channel: channel(),
      replied: false,
      message: rawMessage,
      deferUpdate: vi.fn().mockResolvedValue(undefined),
    };
    const interaction = new DiscordButtonInteraction(
      raw as never,
      registry as never,
      users as never,
      auth as never,
    );

    expect(interaction.message).toBe(interaction.message);
    expect(interaction.message.id).toBe('message');
    await interaction.deferUpdate();
    expect(raw.deferUpdate).toHaveBeenCalledOnce();
  });
});

describe('DiscordMessageInteraction', () => {
  beforeEach(() => {
    adapterMocks.userDto = { _id: 'user' };
  });
  function createMessage(content = '<@123> play song') {
    return {
      id: 'message',
      content,
      author: { id: 'user', username: 'Ada', avatarURL: () => null },
      member: null,
      channel: channel(),
      reply: vi.fn().mockResolvedValue({ id: 'reply' }),
      react: vi.fn().mockResolvedValue(undefined),
      editable: true,
      deletable: true,
      client: { user: { id: 'bot' } },
    };
  }

  it('removes Discord mentions and prefers user syntax while parsing commands', async () => {
    const parser = { parseCommand: vi.fn().mockResolvedValue({ command: {}, options: {} }) };
    const raw = createMessage();
    adapterMocks.userDto = { _id: 'user', syntax: SyntaxType.TRADITIONAL };
    const interaction = new DiscordMessageInteraction(
      raw as never,
      parser as never,
      registry as never,
      users as never,
      auth as never,
    );

    await interaction.getCommand({ get: vi.fn() } as never);
    expect(parser.parseCommand).toHaveBeenCalledWith(
      'play song',
      UserPermission.User,
      SyntaxType.TRADITIONAL,
    );
    expect(interaction.toString()).toBe('<@123> play song');
    expect(interaction.hasReplied).toBe(false);
  });

  it('falls back to server syntax and delegates message reactions', async () => {
    const parser = { parseCommand: vi.fn().mockResolvedValue({ command: {}, options: {} }) };
    const raw = createMessage('<@!321> queue');
    adapterMocks.userDto = { _id: 'user' };
    const interaction = new DiscordMessageInteraction(
      raw as never,
      parser as never,
      registry as never,
      users as never,
      auth as never,
    );
    const details = {
      get: vi.fn().mockResolvedValue({ _id: 'guild', syntax: SyntaxType.KEYWORD }),
    };

    await interaction.getCommand(details as never);
    expect(parser.parseCommand).toHaveBeenCalledWith(
      'queue',
      UserPermission.User,
      SyntaxType.KEYWORD,
    );
    await interaction.react('✅');
    expect(raw.react).toHaveBeenCalledWith('✅');
    await expect(interaction.defer()).resolves.toBeUndefined();
  });
});
