import { COLOR, mapSourceToColor } from 'common/constants';
import { EmbedMessage } from 'eolian/@types';
import { Track } from 'music/@types';

export function createQueueEmbed(tracks: Track[], start: number, total: number) : EmbedMessage {
  const embed: EmbedMessage = {
    color: COLOR.SELECTION,
    header: {
      text: '🎶 Music Queue 🎶'
    },
    title: `${start + 1}. ${tracks[0].title}`,
    description: `from ${tracks[0].poster}\n\n` + tracks.slice(1).map((t, i) => `**${i + start + 2}. [${t.title}](${t.url})**`).join('\n'),
    url: tracks[0].url,
    thumbnail: tracks.find(t => t.artwork)?.artwork,
    footer: {
      text: total > 1 ? `There are ${total} songs in the queue total`
        : `There is only 1 song in the queue`
    }
  };
  return embed;
}

export function createPlayingEmbed(track: Track) : EmbedMessage {
  const embed: EmbedMessage = {
    color: mapSourceToColor(track.src),
    header: {
      text: '🔊 Now Playing 🔊'
    },
    title: track.title,
    description: `${track.poster}`,
    image: track.artwork,
    url: track.url
  };
  return embed;
}

