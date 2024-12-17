import { SOURCE_DETAILS } from '@eolian/api';
import { Track } from '@eolian/api/@types';
import { Color } from '@eolian/common/constants';
import { EmbedMessage } from '@eolian/framework/@types';

function trackNameFormat(track: Track) {
  return `[${track.title.replace(/\*/g, '\\*')}](${track.url})`;
}

export function createQueueEmbed(
  tracks: Track[],
  loopTracks: Track[],
  start: number,
  total: number,
  loop: boolean,
): EmbedMessage {
  const embed: EmbedMessage = {
    color: Color.Selection,
    header: {
      text: '🎶 Music Queue 🎶',
    },
    description: '',
    thumbnail: tracks.find(t => t.artwork)?.artwork,
    footer: {
      text:
        total > 1
          ? `There are ${total} songs in the queue total`
          : `There is only 1 song in the queue`,
    },
  };

  if (tracks.length) {
    embed.title = `${start + 1}. ${tracks[0].title}`;
    embed.description +=
      `from ${tracks[0].poster}\n\n` +
      tracks
        .slice(1)
        .map((t, i) => `\0**${i + start + 2}. ${trackNameFormat(t)}**`)
        .join('\n');
    embed.url = tracks[0].url;
  } else {
    embed.title = `No songs in the queue!`;
  }

  if (loopTracks.length) {
    embed.description += '\n🔁 **Upcoming Loop Tracks** 🔁\n';
    embed.description += loopTracks.map(t => `**${trackNameFormat(t)}**`).join('\n');
  }

  if (loop) {
    embed.header!.text! += ' Looping 🔁';
  }
  return embed;
}

export function createPlayingEmbed(
  track: Track,
  volume: number,
  nightcore: boolean,
  bass: boolean,
): EmbedMessage {
  const details = SOURCE_DETAILS[track.src];
  const embed: EmbedMessage = {
    color: details.color,
    header: {
      icon: details.icon,
      text: `🎶 Now Playing 🔊 ${Math.floor(volume * 100)}%`,
    },
    title: track.title,
    description: `${track.poster}`,
    image: track.artwork,
    url: track.url,
  };
  if (track.live) {
    embed.header!.text += ` ⚡ Live Stream`;
  } else if (nightcore || bass) {
    embed.header!.text += ' ⚡ ';
    if (nightcore) {
      embed.header!.text += 'Nightcore';
      if (bass) {
        embed.header!.text += ' / ';
      }
    }
    if (bass) {
      embed.header!.text += 'Bass Boosted';
    }
  }
  if (track.ai) {
    embed.footer = {
      text: 'Audio is AI generated',
    };
  }
  return embed;
}
