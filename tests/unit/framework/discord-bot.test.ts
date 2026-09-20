import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserPermission } from '@eolian/common/constants';
import { environment } from '@eolian/common/env';
import { EolianUserError } from '@eolian/common/errors';

const mocks = vi.hoisted(() => ({
  clients: [] as Array<{
    handlers: Map<string, (...args: never[]) => unknown>;
    login: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    generateInvite: ReturnType<typeof vi.fn>;
    readyTimestamp: number | null;
    user: { setPresence: ReturnType<typeof vi.fn> };
  }>,
  guildStores: [] as Array<{
    active: number;
    close: ReturnType<typeof vi.fn>;
    getState: ReturnType<typeof vi.fn>;
    getDetails: ReturnType<typeof vi.fn>;
  }>,
  registerGuild: vi.fn(),
  buttonUserPermission: 1,
  buttonInteractions: [] as Array<{
    user: { permission: number; updatePermissions: ReturnType<typeof vi.fn> };
    message: { releaseButtons: ReturnType<typeof vi.fn> };
    send: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock('discord.js', () => ({
  Client: class {
    handlers = new Map<string, (...args: never[]) => unknown>();
    login = vi.fn().mockResolvedValue(undefined);
    destroy = vi.fn();
    generateInvite = vi.fn(() => 'invite');
    readyTimestamp: number | null = null;
    user = { setPresence: vi.fn() };
    guilds = { cache: new Map() };
    constructor() {
      mocks.clients.push(this);
    }
    once(event: string, handler: (...args: never[]) => unknown) {
      this.handlers.set(event, handler);
      return this;
    }
    on(event: string, handler: (...args: never[]) => unknown) {
      this.handlers.set(event, handler);
      return this;
    }
  },
  GatewayIntentBits: {
    Guilds: 1,
    GuildInvites: 2,
    GuildVoiceStates: 3,
    GuildMessages: 4,
    GuildMessageReactions: 5,
    DirectMessages: 6,
    DirectMessageReactions: 7,
    MessageContent: 8,
  },
  Partials: { Channel: 1 },
  ActivityType: { Custom: 4 },
  ChannelType: { DM: 1, GuildText: 0, GuildVoice: 2 },
}));

vi.mock('@eolian/data', () => ({
  LockManager: class {
    isLocked = vi.fn().mockResolvedValue(false);
    lock = vi.fn().mockResolvedValue(undefined);
    unlock = vi.fn().mockResolvedValue(undefined);
  },
  feature: { enabled: vi.fn(() => false) },
}));

vi.mock('@eolian/framework/state/discord-guild-store', () => ({
  DiscordGuildStore: class {
    active = 0;
    close = vi.fn().mockResolvedValue(undefined);
    getState = vi.fn();
    getDetails = vi.fn();
    constructor() {
      mocks.guildStores.push(this);
    }
  },
}));

vi.mock('@eolian/framework/discord-client', () => ({
  INVITE_SCOPES: [],
  DISCORD_INVITE_PERMISSIONS: [],
  DiscordClient: class {},
  DiscordGuildClient: class {},
}));

vi.mock('@eolian/framework/interaction', () => ({
  DiscordCommandInteraction: class {},
  DiscordMessageCommandInteraction: class {},
  DiscordMessageInteraction: class {},
  DiscordButtonInteraction: class {
    user = {
      permission: mocks.buttonUserPermission,
      updatePermissions: vi.fn().mockResolvedValue(undefined),
    };
    message = { releaseButtons: vi.fn() };
    send = vi.fn().mockResolvedValue(undefined);
    constructor() {
      mocks.buttonInteractions.push(this);
    }
  },
}));

vi.mock('@eolian/framework/discord-slash-commands', () => ({
  registerGuildSlashCommands: mocks.registerGuild,
}));

import { DiscordEolianBot } from '@eolian/framework/discord-bot';

function createBot(parser: Record<string, unknown> = {}) {
  return new DiscordEolianBot({
    parser: parser as never,
    db: { users: {}, servers: {} } as never,
    auth: {} as never,
  });
}

function commandInteraction(overrides: Record<string, unknown> = {}) {
  const user = {
    id: 'user',
    permission: UserPermission.User,
    updatePermissions: vi.fn().mockResolvedValue(undefined),
    send: vi.fn().mockResolvedValue(undefined),
  };
  const command = {
    dmAllowed: true,
    noDefaultReply: false,
    execute: vi.fn().mockResolvedValue(undefined),
  };
  return {
    interaction: {
      user,
      channel: { id: 'channel', isDm: false, visible: true },
      sendable: true,
      send: vi.fn().mockResolvedValue(undefined),
      getCommand: vi.fn().mockResolvedValue({ command, options: { value: true } }),
      toString: () => 'command',
      ...overrides,
    },
    user,
    command,
  };
}

describe('DiscordEolianBot', () => {
  beforeEach(() => {
    mocks.clients.length = 0;
    mocks.guildStores.length = 0;
    mocks.buttonInteractions.length = 0;
    mocks.buttonUserPermission = UserPermission.User;
    mocks.registerGuild.mockResolvedValue(true);
    (environment as { e2eBotId?: string }).e2eBotId = undefined;
  });

  it('registers handlers without connecting and supports start/close lifecycle', async () => {
    const bot = createBot();
    const client = mocks.clients[0];
    expect(client.handlers.has('clientReady')).toBe(true);
    expect(client.handlers.has('messageCreate')).toBe(true);
    expect(client.handlers.has('interactionCreate')).toBe(true);

    await bot.start();
    expect(client.login).toHaveBeenCalledWith(environment.tokens.discord.main);
    await bot.close();
    expect(mocks.guildStores[0].close).toHaveBeenCalledOnce();
    expect(client.destroy).toHaveBeenCalledOnce();
  });

  it('ignores ordinary bots but allows the configured E2E bot through invocation detection', async () => {
    const messageInvokesBot = vi.fn().mockReturnValue(false);
    createBot({ messageInvokesBot });
    const handler = mocks.clients[0].handlers.get('messageCreate')!;
    const message = {
      author: { bot: true, id: 'test-bot' },
      channel: { type: 0 },
      content: '!play',
      guild: undefined,
      mentions: { has: vi.fn().mockReturnValue(false) },
    };

    await handler(message as never);
    expect(messageInvokesBot).not.toHaveBeenCalled();

    (environment as { e2eBotId?: string }).e2eBotId = 'test-bot';
    await handler(message as never);
    expect(messageInvokesBot).toHaveBeenCalledWith('!play', undefined);
  });

  it('executes a DM-capable command and returns its default-reply contract', async () => {
    const bot = createBot();
    const { interaction, user, command } = commandInteraction();

    const noDefault = await (
      bot as never as {
        onBotInvoked(interaction: unknown): Promise<boolean>;
      }
    ).onBotInvoked(interaction);

    expect(user.updatePermissions).toHaveBeenCalledWith(undefined);
    expect(command.execute).toHaveBeenCalledWith(
      { interaction, server: undefined, client: expect.anything() },
      { value: true },
    );
    expect(noDefault).toBe(false);
  });

  it('rejects guild-only commands in DMs before execution', async () => {
    const bot = createBot();
    const { interaction, command } = commandInteraction({
      channel: { id: 'dm', isDm: true, visible: true },
    });
    command.dmAllowed = false;

    await (
      bot as never as {
        onBotInvoked(interaction: unknown): Promise<boolean>;
      }
    ).onBotInvoked(interaction);
    expect(interaction.send).toHaveBeenCalledWith(
      'Sorry, this command is not allowed via DM. Try again in a guild channel.',
    );
    expect(command.execute).not.toHaveBeenCalled();
  });

  it('edits contextual user errors and rethrows unexpected failures after replying', async () => {
    const bot = createBot();
    const contextual = commandInteraction();
    const context = { edit: vi.fn().mockResolvedValue(undefined) };
    contextual.command.execute.mockRejectedValueOnce(
      new EolianUserError('bad input', context as never),
    );

    await expect(
      (
        bot as never as {
          onBotInvoked(interaction: unknown): Promise<boolean>;
        }
      ).onBotInvoked(contextual.interaction),
    ).resolves.toBe(false);
    expect(context.edit).toHaveBeenCalledWith('bad input');

    const unexpected = commandInteraction();
    unexpected.command.execute.mockRejectedValueOnce(new Error('broken'));
    await expect(
      (
        bot as never as {
          onBotInvoked(interaction: unknown): Promise<boolean>;
        }
      ).onBotInvoked(unexpected.interaction),
    ).rejects.toThrow('broken');
    expect(unexpected.interaction.send).toHaveBeenCalledWith(
      'Hmm.. I tried to do that but something in my internals is broken. Try again later.',
    );
  });

  it('enforces button user and permission restrictions before invoking handlers', async () => {
    const bot = createBot();
    const registry = (bot as never as { registry: { register: Function } }).registry;
    const restricted = { emoji: '✅', userId: 'allowed', onClick: vi.fn() };
    registry.register('message', new Map([['button', restricted]]));
    const raw = {
      message: { id: 'message' },
      customId: 'button',
      user: { id: 'other' },
    };

    await (
      bot as never as {
        onButtonClickHandler(interaction: unknown): Promise<void>;
      }
    ).onButtonClickHandler(raw);
    expect(restricted.onClick).not.toHaveBeenCalled();

    const permissionButton = {
      emoji: '🔒',
      permission: UserPermission.Admin,
      onClick: vi.fn(),
    };
    registry.register('message', new Map([['button', permissionButton]]));
    raw.user.id = 'allowed';
    await (
      bot as never as {
        onButtonClickHandler(interaction: unknown): Promise<void>;
      }
    ).onButtonClickHandler(raw);
    expect(permissionButton.onClick).not.toHaveBeenCalled();
  });

  it('invokes an allowed button and releases its registration when requested', async () => {
    const bot = createBot();
    const registry = (bot as never as { registry: { register: Function } }).registry;
    const button = {
      emoji: '✅',
      onClick: vi.fn().mockResolvedValue(true),
    };
    registry.register('message', new Map([['button', button]]));
    const raw = {
      message: { id: 'message' },
      customId: 'button',
      user: { id: 'user' },
    };

    await (
      bot as never as {
        onButtonClickHandler(interaction: unknown): Promise<void>;
      }
    ).onButtonClickHandler(raw);

    const interaction = mocks.buttonInteractions[0];
    expect(button.onClick).toHaveBeenCalledWith(interaction, '✅');
    expect(interaction.message.releaseButtons).toHaveBeenCalledOnce();
  });
});
