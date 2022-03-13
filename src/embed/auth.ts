import { SOURCE_DETAILS } from 'api';
import { TrackSource } from 'api/@types';
import { EmbedMessage } from 'framework/@types';

export function createSpotifyAuthEmbed(link: string): EmbedMessage {
  return {
    url: link,
    title: 'Authorize Spotify',
    description:
      'Please click the link to authenticate with Spotify in order to complete your request',
    color: SOURCE_DETAILS[TrackSource.Spotify].color,
    thumbnail: SOURCE_DETAILS[TrackSource.Spotify].icon,
    footer: {
      text: 'This link will expire in 60 seconds.',
    },
  };
}

export const SPOTIFY_AUTH_COMPLETE_EMBED: EmbedMessage = {
  title: 'Authorize Spotify Complete',
  description:
    'You have authorized Eolian to read your Spotify information!\nYou can go back to the channel where you sent a command now :)',
  color: SOURCE_DETAILS[TrackSource.Spotify].color,
  thumbnail: SOURCE_DETAILS[TrackSource.Spotify].icon,
};

export const SPOTIFY_AUTH_EXPIRED_EMBED: EmbedMessage = {
  title: 'Authorize Spotify Expired',
  description: 'This request expired!\nClick this link faster next time',
  color: SOURCE_DETAILS[TrackSource.Spotify].color,
  thumbnail: SOURCE_DETAILS[TrackSource.Spotify].icon,
};

export const SPOTIFY_AUTH_ERROR_EMBED: EmbedMessage = {
  title: 'Authorize Spotify Failed',
  description: 'This request failed! Try again',
  color: SOURCE_DETAILS[TrackSource.Spotify].color,
  thumbnail: SOURCE_DETAILS[TrackSource.Spotify].icon,
};
