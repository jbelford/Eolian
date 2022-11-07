import { SOURCE_DETAILS } from '@eolian/api';
import { TrackSource } from '@eolian/api/@types';
import { EmbedMessage } from '@eolian/framework/@types';

export function createAuthEmbed(link: string, type: TrackSource): EmbedMessage {
  const details = SOURCE_DETAILS[type];
  return {
    url: link,
    title: `Authorize ${details.name}`,
    description: `Please click the link to authenticate with ${details.name} in order to complete your request`,
    color: details.color,
    thumbnail: details.icon,
    footer: {
      text: 'This link will expire in 60 seconds.',
    },
  };
}

export function createAuthCompleteEmbed(type: TrackSource): EmbedMessage {
  const details = SOURCE_DETAILS[type];
  return {
    title: `Authorize ${details.name} Complete`,
    description: `You have authorized Eolian to read your ${details.name} information!\nYou can go back to the channel where you sent a command now :)`,
    color: details.color,
    thumbnail: details.icon,
  };
}

export function createAuthExpiredEmbed(type: TrackSource): EmbedMessage {
  const details = SOURCE_DETAILS[type];
  return {
    title: `Authorize ${details.name} Expired`,
    description: 'This request expired!\nClick this link faster next time',
    color: details.color,
    thumbnail: details.icon,
  };
}

export function createAuthErrorEmbed(type: TrackSource): EmbedMessage {
  const details = SOURCE_DETAILS[type];
  return {
    title: `Authorize ${details.name} Failed`,
    description: 'This request failed! Try again',
    color: details.color,
    thumbnail: details.icon,
  };
}
