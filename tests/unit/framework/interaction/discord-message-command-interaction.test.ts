import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyntaxType } from '@eolian/command-options/@types';
import { UserPermission } from '@eolian/common/constants';

const mocks = vi.hoisted(() => ({
  safeGet: vi.fn(),
  builders: [] as {
    permission: UserPermission;
    syntax: SyntaxType;
    withPatterns: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  }[],
}));

vi.mock('@eolian/commands', () => ({
  MESSAGE_COMMANDS: { safeGet: mocks.safeGet },
}));

vi.mock('@eolian/command-options', () => ({
  CommandOptionBuilder: class {
    withPatterns = vi.fn();
    get = vi.fn(() => ({ SEARCH: 'parsed' }));

    constructor(
      readonly permission: UserPermission,
      readonly syntax: SyntaxType,
    ) {
      mocks.builders.push(this);
    }
  },
}));

vi.mock('@eolian/framework/interaction/discord-interaction', () => ({
  DiscordInteraction: class {
    readonly user = { permission: UserPermission.DJ };

    constructor(protected readonly interaction: unknown) {}
  },
}));

import { DiscordMessageCommandInteraction } from '@eolian/framework/interaction/discord-message-command-interaction';

function createInteraction() {
  let targetReads = 0;
  const targetMessage = { content: 'a song title' };
  const interaction = {
    commandName: 'play message',
    get targetMessage() {
      targetReads += 1;
      return targetMessage;
    },
  };
  return { interaction, targetMessage, getTargetReads: () => targetReads };
}

describe('DiscordMessageCommandInteraction', () => {
  beforeEach(() => {
    mocks.builders.length = 0;
    mocks.safeGet.mockReset();
  });

  it('looks up the command, parses target message patterns, and caches the message', async () => {
    const pattern = { name: 'SEARCH' };
    const command = { patterns: [pattern] };
    mocks.safeGet.mockReturnValue(command);
    const { interaction, getTargetReads } = createInteraction();
    const wrapper = new DiscordMessageCommandInteraction(
      interaction as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(wrapper.getCommand()).resolves.toEqual({
      command,
      options: { SEARCH: 'parsed' },
    });
    expect(mocks.safeGet).toHaveBeenCalledWith('play message', UserPermission.DJ);
    expect(mocks.builders[0]).toMatchObject({
      permission: UserPermission.DJ,
      syntax: SyntaxType.SLASH,
    });
    expect(mocks.builders[0].withPatterns).toHaveBeenCalledWith(command.patterns, 'a song title');
    expect(wrapper.toString()).toBe('(play message) a song title');
    expect(getTargetReads()).toBe(1);
  });

  it('returns empty options without parsing when the command has no patterns', async () => {
    const command = {};
    mocks.safeGet.mockReturnValue(command);
    const { interaction } = createInteraction();
    const wrapper = new DiscordMessageCommandInteraction(
      interaction as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await wrapper.getCommand();
    expect(mocks.builders[0].withPatterns).not.toHaveBeenCalled();
    await expect(wrapper.react()).resolves.toBeUndefined();
    expect(wrapper.isSlash).toBe(true);
    expect(wrapper.reactable).toBe(false);
  });
});
