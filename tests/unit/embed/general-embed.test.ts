import { describe, expect, it } from 'vitest';
import { TrackSource } from '@eolian/api/@types';
import { SyntaxType } from '@eolian/command-options/@types';
import { Color, DEFAULT_VOLUME } from '@eolian/common/constants';
import { ResourceType } from '@eolian/data/@types';
import {
  createBasicEmbed,
  createInviteEmbed,
  createSelectionEmbed,
  createServerDetailsEmbed,
  createUserDetailsEmbed,
  syntaxTypeToName,
} from '@eolian/embed/general-embed';
import { ContextServerInfo, ContextUser } from '@eolian/framework/@types';

describe('general embed builders', () => {
  it('builds invite and basic embeds with stable presentation fields', () => {
    expect(createInviteEmbed('https://invite.test', 'Eolian', 'avatar.png')).toEqual({
      title: '**Invite: Eolian**',
      description: 'Click to invite bot to server',
      url: 'https://invite.test',
      thumbnail: 'avatar.png',
      color: Color.Invite,
    });
    expect(createBasicEmbed('Done')).toEqual({ title: 'Done', color: Color.Selection });
  });

  it('formats selection strings, metadata, links, and the cancel option', () => {
    const embed = createSelectionEmbed(
      'Choose one',
      [
        'Plain',
        { name: 'Linked', url: 'https://example.test' },
        { name: 'Song', subname: 'Artist' },
      ],
      'Ada',
      'ada.png',
    );

    expect(embed.header).toEqual({ text: '👈🏻 Select one 👉🏻' });
    expect(embed.title).toBe('*Choose one*');
    expect(embed.description).toBe(
      '1: Plain\n2: [Linked](https://example.test)\n3: Song - Artist\n0: Cancel',
    );
    expect(embed.footer).toEqual({
      icon: 'ada.png',
      text: 'Ada, enter the number of your selection in chat or click emoji',
    });
  });

  it('renders an empty selection without inventing options', () => {
    expect(createSelectionEmbed('Choose', [], 'Ada').description).toBe('\n0: Cancel');
  });

  it('renders linked profile details, identifiers, and explicit syntax', () => {
    const user = { name: 'Ada', avatar: 'ada.png' } as ContextUser;
    const embed = createUserDetailsEmbed(
      user,
      {
        external_urls: { spotify: 'https://spotify.test/ada' },
      } as never,
      { permalink_url: 'https://soundcloud.test/ada' } as never,
      {
        mix: {
          id: '1',
          type: ResourceType.Playlist,
          src: TrackSource.Spotify,
          url: 'https://mix.test',
        },
      },
      SyntaxType.TRADITIONAL,
    );

    expect(embed.header).toEqual({ icon: 'ada.png', text: '🎫 Profile Details 🎫' });
    expect(embed.title).toBe("Here's what I know about you Ada!");
    expect(embed.description).toBe(
      '**Spotify:** https://spotify.test/ada\n' +
        '**SoundCloud:** https://soundcloud.test/ada\n' +
        '**Identifiers:** [mix](https://mix.test)\n' +
        '**Syntax**: `traditional`',
    );
    expect(embed.footer?.text).toContain("'Account' category");
  });

  it('renders profile empty states and the server-default syntax label', () => {
    const embed = createUserDetailsEmbed({ name: 'Ada' } as ContextUser);

    expect(embed.description).toContain('**Spotify:** N/A');
    expect(embed.description).toContain('**SoundCloud:** N/A');
    expect(embed.description).toContain('**Identifiers:** N/A');
    expect(embed.description).toContain('**Syntax**: `Server Default`');
  });

  it('uses server defaults and formats missing channel and role states', () => {
    const guild = { name: 'Guild', avatar: 'guild.png' } as ContextServerInfo;
    const embed = createServerDetailsEmbed(guild, { _id: 'guild' });

    expect(embed.header).toEqual({ icon: 'guild.png', text: '🎫 Server Details 🎫' });
    expect(embed.description).toBe(
      `**Prefix:** \`!\`\n` +
        `**Volume:** \`${Math.floor(DEFAULT_VOLUME * 100)}%\`\n` +
        `**Syntax:** \`keyword\`\n` +
        '**Announcements Channel:** `None`\n' +
        '**DJ Roles:** `None`\n' +
        '**Allow Limited DJ:** `false`',
    );
  });

  it('formats configured server mentions, roles, volume, and syntax', () => {
    const embed = createServerDetailsEmbed({ name: 'Guild' } as ContextServerInfo, {
      _id: 'guild',
      prefix: '?',
      volume: 0.428,
      syntax: SyntaxType.TRADITIONAL,
      preferredChannelId: 'channel',
      djRoleIds: ['one', 'two'],
      djAllowLimited: true,
    });

    expect(embed.description).toContain('**Prefix:** `?`');
    expect(embed.description).toContain('**Volume:** `42%`');
    expect(embed.description).toContain('**Syntax:** `traditional`');
    expect(embed.description).toContain('**Announcements Channel:** <#channel>');
    expect(embed.description).toContain('**DJ Roles:** <@&one>, <@&two>');
    expect(embed.description).toContain('**Allow Limited DJ:** `true`');
  });

  it('maps slash syntax to its user-facing traditional syntax name', () => {
    expect(syntaxTypeToName(SyntaxType.KEYWORD)).toBe('keyword');
    expect(syntaxTypeToName(SyntaxType.TRADITIONAL)).toBe('traditional');
    expect(syntaxTypeToName(SyntaxType.SLASH)).toBe('traditional');
  });
});
