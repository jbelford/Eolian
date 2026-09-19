import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyntaxType } from '@eolian/command-options/@types';
import { UserPermission } from '@eolian/common/constants';
import { HELP_COMMAND } from '@eolian/commands/general/help-command';
import { INVITE_COMMAND } from '@eolian/commands/general/invite-command';
import { SERVERS_COMMAND } from '@eolian/commands/general/servers-command';
import {
  createClient,
  createContext,
  createInteraction,
  createServerDetails,
  createServerState,
  createUser,
} from './command-test-utils';

const embeds = vi.hoisted(() => ({
  category: vi.fn(),
  commands: vi.fn(),
  command: vi.fn(),
  keyword: vi.fn(),
  pattern: vi.fn(),
  invite: vi.fn(),
}));
const commandStore = vi.hoisted(() => {
  const play = {
    name: 'play',
    permission: 2,
    details: 'Play',
    category: { name: 'Music', details: 'Music', permission: 2 },
    usage: [],
    execute: vi.fn(),
  };
  return {
    play,
    store: {
      get: vi.fn((name: string) => (name === 'play' ? play : undefined)),
      list: [play],
    },
  };
});

vi.mock('@eolian/embed', () => ({
  createCategoryListEmbed: embeds.category,
  createCommandListEmbed: embeds.commands,
  createCommandDetailsEmbed: embeds.command,
  createKeywordDetailsEmbed: embeds.keyword,
  createPatternDetailsEmbed: embeds.pattern,
  createInviteEmbed: embeds.invite,
}));
vi.mock('@eolian/commands/command-store', () => ({
  COMMANDS: commandStore.store,
}));

describe('general commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const mock of Object.values(embeds)) {
      mock.mockImplementation((...args: unknown[]) => ({ title: String(args[0] ?? 'embed') }));
    }
  });

  it('lists visible help categories using the configured prefix', async () => {
    const user = createUser({ permission: UserPermission.User });
    const interaction = createInteraction(user);
    const details = createServerDetails({
      get: vi.fn().mockResolvedValue({ _id: 'guild-id', prefix: '$' }),
    });

    await HELP_COMMAND.execute(
      createContext({ interaction, server: createServerState({ details }) }),
      {},
    );

    expect(embeds.category).toHaveBeenCalledWith(
      expect.not.arrayContaining([expect.objectContaining({ name: 'Settings' })]),
      '$',
    );
    expect(interaction.sendEmbed).toHaveBeenCalledWith(expect.any(Object));
  });

  it('shows category help by index or name and validates bad indexes', async () => {
    const interaction = createInteraction();
    const context = createContext({ interaction });

    await HELP_COMMAND.execute(context, { ARG: ['1'] });
    await HELP_COMMAND.execute(context, { ARG: ['queue'] });

    expect(embeds.commands).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: 'General' }),
      UserPermission.Owner,
    );
    expect(embeds.commands).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: 'Queue' }),
      UserPermission.Owner,
    );
    await expect(HELP_COMMAND.execute(context, { ARG: ['99'] })).rejects.toThrow(
      'No category at that index',
    );
  });

  it('uses user syntax for command help and slash syntax for slash help', async () => {
    const user = createUser({
      get: vi.fn().mockResolvedValue({ _id: 'user-id', syntax: SyntaxType.TRADITIONAL }),
    });
    const interaction = createInteraction(user);

    await HELP_COMMAND.execute(createContext({ interaction }), { ARG: ['play'] });
    expect(embeds.command).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'play' }),
      SyntaxType.TRADITIONAL,
    );

    const slashInteraction = createInteraction(user, undefined, { isSlash: true });
    await HELP_COMMAND.execute(createContext({ interaction: slashInteraction }), {
      ARG: ['play'],
    });
    expect(embeds.command).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: 'play' }),
      SyntaxType.SLASH,
    );
  });

  it('shows keyword and pattern help and rejects unknown terms', async () => {
    const context = createContext();

    await HELP_COMMAND.execute(context, { ARG: ['spotify'] });
    await HELP_COMMAND.execute(context, { ARG: ['search'] });

    expect(embeds.keyword).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'SPOTIFY' }),
      SyntaxType.KEYWORD,
    );
    expect(embeds.pattern).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'SEARCH' }),
      SyntaxType.KEYWORD,
    );
    await expect(HELP_COMMAND.execute(context, { ARG: ['unknown'] })).rejects.toThrow(
      "don't think anything is referred to as `unknown`",
    );
  });

  it('sends a public invite embed generated from client identity', async () => {
    const client = createClient({
      name: 'Test Bot',
      pic: 'bot-avatar',
      generateInvite: vi.fn().mockReturnValue('https://discord.test/invite'),
    });
    const interaction = createInteraction();

    await INVITE_COMMAND.execute(createContext({ client, interaction }), {});

    expect(embeds.invite).toHaveBeenCalledWith(
      'https://discord.test/invite',
      'Test Bot',
      'bot-avatar',
    );
    expect(interaction.sendEmbed).toHaveBeenCalledWith(expect.any(Object), { ephemeral: false });
  });

  it('sorts and paginates the server listing with aggregate counts', async () => {
    const servers = Array.from({ length: 12 }, (_, index) => ({
      id: `server-${index}`,
      name: `Server ${index}`,
      members: index,
      owner: `owner-${index}`,
      botCount: 12 - index,
    }));
    const client = createClient({
      getServers: vi.fn().mockReturnValue(servers),
      getRecentlyUsedCount: vi.fn().mockReturnValue(4),
    });
    const interaction = createInteraction();

    await SERVERS_COMMAND.execute(createContext({ client, interaction }), {
      NUMBER: [1],
      ARG: ['sort', 'botCount'],
    });

    const response = vi.mocked(interaction.send).mock.calls[0][0];
    expect(response).toContain('Total Servers: 12');
    expect(response).toContain('Total Users: 66');
    expect(response).toContain('Active Servers: 4');
    expect(response).toContain('"id":"server-10"');
    expect(response).toContain('"id":"server-11"');
  });

  it('dispatches owner subcommands and validates their names and argument counts', async () => {
    const client = createClient({ leave: vi.fn().mockResolvedValue(true) });
    const interaction = createInteraction();
    const context = createContext({ client, interaction });

    await SERVERS_COMMAND.execute(context, { ARG: ['kick', 'guild-id'] });
    expect(client.leave).toHaveBeenCalledWith('guild-id');
    expect(interaction.send).toHaveBeenCalledWith('I have left guild-id');

    await expect(SERVERS_COMMAND.execute(context, { ARG: ['missing'] })).rejects.toThrow(
      'There is no subcommand `missing`',
    );
    await expect(SERVERS_COMMAND.execute(context, { ARG: ['kick'] })).rejects.toThrow(
      'requires 1 arguments',
    );
  });
});
