import { COLOR } from 'common/constants';
import * as help from './help';
import * as poll from './poll';

export { help, poll };

export function invite(link: string, username: string, pic: string): EmbedMessage {
  return {
    title: `**Invite: ${username}**`,
    description: 'Click to invite bot to server',
    url: link,
    thumbnail: pic,
    color: COLOR.INVITE
  }
}

export function selection(question: string, options: string[]): EmbedMessage {
  return {
    header: {
      text: '👈🏻 Select one 👉🏻'
    },
    title: `*${question}*`,
    color: COLOR.SELECTION,
    description: options.map((option, i) => `${i + 1}: ${option}`).join('\n') + '\n0: Cancel',
    footer: {
      text: `Enter the number of your selection in chat`
    }
  };
}

export function userDetails(contextUser: ContextUser, spotify?: SpotifyUser, soundcloud?: SoundCloudUser,
  identifiers?: { [key: string]: Identifier }): EmbedMessage {

  let description = `**Spotify:** ${spotify ? spotify.external_urls.spotify : 'N/A'}\n`
    + `**SoundCloud:** ${soundcloud ? soundcloud.permalink_url : 'N/A'}\n`
    + `**Identifiers:** `;
  if (identifiers && Object.keys(identifiers).length > 0) {
    description += Object.keys(identifiers).map((key, i) => `[${key}](${identifiers[key].url})`).join(', ');
  } else {
    description += 'N/A';
  }

  return {
    header: {
      icon: contextUser.avatar,
      text: `🎫 Profile Details 🎫 `
    },
    title: `Here's what I know about you ${contextUser.name}!`,
    color: COLOR.PROFILE,
    description,
    footer: {
      text: `See 'help' for the 'Account' category to configure your profile.`
    }
  }
}