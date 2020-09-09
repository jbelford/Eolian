import { COLOR } from 'common/constants';
import { EmbedMessage } from 'eolian/@types';
import { Track } from 'music/@types';

export function createQueueEmbed(tracks: Track[], total: number) : EmbedMessage {
  const embed: EmbedMessage = {
    color: COLOR.SELECTION,
    header: {
      text: 'Music Queue'
    },
    description: tracks.map(t => `[${t.title}](${t.url})`).join('\n'),
    thumbnail: tracks.find(t => t.artwork)?.artwork,
    footer: {
      text: total > 1 ? `There are ${total} songs in the queue total`
        : `There is only 1 song in the queue`
    }
  };
  return embed;
}