import { SyntaxType } from '@eolian/command-options/@types';
import { DEFAULT_VOLUME } from '@eolian/common/constants';
import { environment } from '@eolian/common/env';
import { DiscordBotManagement, DiscordManagementError } from '@eolian/framework/discord-management';
import { ChannelType, Collection } from 'discord.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function guild() {
  return {
    id: '100',
    name: 'Guild',
    memberCount: 42,
    iconURL: vi.fn(() => 'https://cdn.example/icon.png'),
    channels: {
      cache: new Collection([
        ['300', { id: '300', name: 'music', type: ChannelType.GuildText }],
        ['301', { id: '301', name: 'news', type: ChannelType.GuildAnnouncement }],
        ['302', { id: '302', name: 'voice', type: ChannelType.GuildVoice }],
      ]),
    },
    roles: {
      cache: new Collection([
        ['100', { id: '100', name: '@everyone' }],
        ['200', { id: '200', name: 'DJ' }],
      ]),
    },
  };
}

function createManagement(options: { ready?: boolean; config?: object; state?: object } = {}) {
  const rawGuild = guild();
  const details = {
    get: vi.fn().mockResolvedValue(options.config ?? { _id: '100' }),
    updateSettings: vi.fn().mockResolvedValue(undefined),
  };
  const state = options.state;
  const guildStore = {
    getDetails: vi.fn(() => details),
    getCachedState: vi.fn().mockResolvedValue(state),
  };
  const client = {
    isReady: vi.fn(() => options.ready ?? true),
    guilds: { cache: new Collection([['100', rawGuild]]) },
  };
  return {
    client,
    details,
    guildStore,
    management: new DiscordBotManagement(client as never, guildStore as never),
  };
}

describe('DiscordBotManagement', () => {
  beforeEach(() => {
    environment.cmdToken = '!';
  });

  it('returns sanitized guild metadata, configurable channels, roles, and defaults', async () => {
    const { management } = createManagement();

    expect(management.listGuilds()).toEqual([
      { id: '100', name: 'Guild', icon: 'https://cdn.example/icon.png' },
    ]);
    expect(await management.getGuild('100')).toEqual({
      id: '100',
      name: 'Guild',
      icon: 'https://cdn.example/icon.png',
      memberCount: 42,
      settings: {
        prefix: '!',
        volume: DEFAULT_VOLUME,
        syntax: SyntaxType.KEYWORD,
        preferredChannelId: null,
        djRoleIds: [],
        djAllowLimited: false,
      },
      channels: [
        { id: '300', name: 'music' },
        { id: '301', name: 'news' },
      ],
      roles: [{ id: '200', name: 'DJ' }],
    });
  });

  it('persists valid updates and immediately updates an idle cached player', async () => {
    const player = { isStreaming: false, setVolume: vi.fn() };
    const { details, management } = createManagement({
      config: {
        _id: '100',
        prefix: '?',
        volume: 0.5,
        syntax: SyntaxType.TRADITIONAL,
        preferredChannelId: '300',
        djRoleIds: ['200'],
        djAllowLimited: true,
      },
      state: { player },
    });

    await management.updateGuild('100', {
      prefix: '?',
      volume: 0.5,
      syntax: SyntaxType.TRADITIONAL,
      preferredChannelId: '300',
      djRoleIds: ['200'],
      djAllowLimited: true,
    });

    expect(details.updateSettings).toHaveBeenCalledWith({
      prefix: '?',
      volume: 0.5,
      syntax: SyntaxType.TRADITIONAL,
      preferredChannelId: '300',
      djRoleIds: ['200'],
      djAllowLimited: true,
    });
    expect(player.setVolume).toHaveBeenCalledWith(0.5);
  });

  it('does not change a streaming player volume', async () => {
    const player = { isStreaming: true, setVolume: vi.fn() };
    const { management } = createManagement({
      config: { _id: '100', volume: 0.4 },
      state: { player },
    });

    await management.updateGuild('100', { volume: 0.4 });

    expect(player.setVolume).not.toHaveBeenCalled();
  });

  it.each([
    [{ preferredChannelId: '999' }, 'channel_not_found'],
    [{ djRoleIds: ['999'] }, 'role_not_found'],
    [{ djRoleIds: ['100'] }, 'role_not_found'],
  ])('rejects stale guild selections %#', async (settings, code) => {
    const { management } = createManagement();

    await expect(management.updateGuild('100', settings)).rejects.toMatchObject({ code });
  });

  it('reports bot readiness and membership explicitly', async () => {
    const unavailable = createManagement({ ready: false }).management;
    expect(() => unavailable.listGuilds()).toThrow(
      expect.objectContaining<Partial<DiscordManagementError>>({ code: 'bot_not_ready' }),
    );

    const { management } = createManagement();
    await expect(management.getGuild('999')).rejects.toMatchObject({ code: 'bot_not_in_guild' });
  });
});
