import { SoundCloudUser } from '@eolian/api/soundcloud/@types';
import { SpotifyUser } from '@eolian/api/spotify/@types';
import { SyntaxType } from '@eolian/command-options/@types';
import { Color, DEFAULT_VOLUME } from '@eolian/common/constants';
import { environment } from '@eolian/common/env';
import { Identifier, ServerDTO } from '@eolian/data/@types';
import { EmbedMessage, ContextUser, ContextServerInfo } from '@eolian/framework/@types';
import { SelectionOption } from './@types';

export function createInviteEmbed(link: string, username: string, pic?: string): EmbedMessage {
  return {
    title: `**Invite: ${username}**`,
    description: 'Click to invite bot to server',
    url: link,
    thumbnail: pic,
    color: Color.Invite,
  };
}

const mapOption = (option: SelectionOption, i: number): string => {
  let text = `${i + 1}: `;
  if (typeof option === 'string') {
    text += option;
  } else {
    let name = option.name;
    if (option.subname) {
      name += ` - ${option.subname}`;
    }
    if (option.url) {
      name = `[${name}](${option.url})`;
    }
    text += name;
  }
  return text;
};

export function createSelectionEmbed(
  question: string,
  options: SelectionOption[],
  username: string,
  pic?: string,
): EmbedMessage {
  return {
    header: {
      text: '👈🏻 Select one 👉🏻',
    },
    title: `*${question}*`,
    color: Color.Selection,
    description: options.map(mapOption).join('\n') + '\n0: Cancel',
    footer: {
      icon: pic,
      text: `${username}, enter the number of your selection in chat or click emoji`,
    },
  };
}

export function createUserDetailsEmbed(
  contextUser: ContextUser,
  spotify?: SpotifyUser,
  soundcloud?: SoundCloudUser,
  identifiers?: Record<string, Identifier>,
  syntax?: SyntaxType,
): EmbedMessage {
  let description =
    `**Spotify:** ${spotify ? spotify.external_urls.spotify : 'N/A'}\n` +
    `**SoundCloud:** ${soundcloud ? soundcloud.permalink_url : 'N/A'}\n` +
    `**Identifiers:** `;
  if (identifiers && Object.keys(identifiers).length > 0) {
    description += Object.keys(identifiers)
      .map(key => `[${key}](${identifiers[key].url})`)
      .join(', ');
  } else {
    description += 'N/A';
  }

  const syntaxName = syntax === undefined ? 'Server Default' : syntaxTypeToName(syntax);
  description += `\n**Syntax**: \`${syntaxName}\``;

  return {
    header: {
      icon: contextUser.avatar,
      text: `🎫 Profile Details 🎫`,
    },
    title: `Here's what I know about you ${contextUser.name}!`,
    color: Color.Profile,
    description,
    footer: {
      text: `See 'help' for the 'Account' category to configure your profile.`,
    },
  };
}

export function createServerDetailsEmbed(guild: ContextServerInfo, dto: ServerDTO): EmbedMessage {
  const volume = dto.volume ?? DEFAULT_VOLUME;
  const roles =
    dto.djRoleIds && dto.djRoleIds.length > 0
      ? dto.djRoleIds.map(role => `<@&${role}>`).join(', ')
      : '`None`';
  const description = `**Prefix:** \`${dto.prefix ?? environment.cmdToken}\`
**Volume:** \`${Math.floor(volume * 100)}%\`
**Syntax:** \`${syntaxTypeToName(dto.syntax ?? SyntaxType.KEYWORD)}\`
**DJ Roles:** ${roles}
**Allow Limited DJ:** \`${!!dto.djAllowLimited}\``;
  return {
    header: {
      icon: guild.avatar,
      text: `🎫 Server Details 🎫`,
    },
    title: `Here's settings for ${guild.name}`,
    color: Color.Profile,
    description,
    footer: {
      text: `See 'help' for the 'Settings' category to configure these settings`,
    },
  };
}

export function syntaxTypeToName(type: SyntaxType) {
  if (type === SyntaxType.KEYWORD) {
    return 'keyword';
  }
  return 'traditional';
}

export function createBasicEmbed(message: string): EmbedMessage {
  return {
    title: message,
    color: Color.Selection,
  };
}
