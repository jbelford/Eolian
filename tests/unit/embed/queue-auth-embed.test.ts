import { describe, expect, it } from 'vitest';
import { SOURCE_DETAILS } from '@eolian/api';
import { Track, TrackSource } from '@eolian/api/@types';
import { Color } from '@eolian/common/constants';
import {
  createAuthCompleteEmbed,
  createAuthEmbed,
  createAuthErrorEmbed,
  createAuthExpiredEmbed,
} from '@eolian/embed/auth-embed';
import { createPlayingEmbed, createQueueEmbed } from '@eolian/embed/queue-embed';

const track = (title: string, overrides: Partial<Track> = {}): Track => ({
  title,
  poster: `${title} artist`,
  url: `https://tracks.test/${title}`,
  src: TrackSource.YouTube,
  ...overrides,
});

describe('queue embed builders', () => {
  it('constructs a paginated queue with stable numbering and escaped markdown', () => {
    const tracks = [
      track('First'),
      track('Second *Mix*'),
      track('Third', { artwork: 'third.png' }),
    ];
    const embed = createQueueEmbed(tracks, [], 10, 25, false);

    expect(embed.header).toEqual({ text: '🎶 Music Queue 🎶' });
    expect(embed.title).toBe('11. First');
    expect(embed.url).toBe('https://tracks.test/First');
    expect(embed.thumbnail).toBe('third.png');
    expect(embed.description).toBe(
      'from First artist\n\n' +
        '\0**12. [Second \\*Mix\\*](https://tracks.test/Second *Mix*)**\n' +
        '\0**13. [Third](https://tracks.test/Third)**',
    );
    expect(embed.footer?.text).toBe('There are 25 songs in the queue total');
  });

  it('renders empty and singular queue states accurately', () => {
    expect(createQueueEmbed([], [], 0, 0, false)).toMatchObject({
      title: 'No songs in the queue!',
      description: '',
      footer: { text: 'There are 0 songs in the queue total' },
    });
    expect(createQueueEmbed([track('Only')], [], 0, 1, false).footer?.text).toBe(
      'There is only 1 song in the queue',
    );
  });

  it('appends loop tracks and loop mode to the queue structure', () => {
    const embed = createQueueEmbed(
      [track('Current')],
      [track('Loop One'), track('Loop Two')],
      0,
      1,
      true,
    );

    expect(embed.header?.text).toBe('🎶 Music Queue 🎶 Looping 🔁');
    expect(embed.description).toContain('🔁 **Upcoming Loop Tracks** 🔁');
    expect(embed.description).toContain('**[Loop One](https://tracks.test/Loop One)**');
    expect(embed.description).toContain('**[Loop Two](https://tracks.test/Loop Two)**');
  });

  it('builds playing embeds with source, volume, and effect details', () => {
    const embed = createPlayingEmbed(
      track('Playing', { artwork: 'cover.png', src: TrackSource.SoundCloud }),
      0.429,
      true,
      true,
    );

    expect(embed).toMatchObject({
      color: SOURCE_DETAILS[TrackSource.SoundCloud].color,
      header: {
        icon: SOURCE_DETAILS[TrackSource.SoundCloud].icon,
        text: '🎶 Now Playing 🔊 42% ⚡ Nightcore / Bass Boosted',
      },
      title: 'Playing',
      description: 'Playing artist',
      image: 'cover.png',
      url: 'https://tracks.test/Playing',
    });
  });

  it('prioritizes live status and exposes AI-generated audio', () => {
    const embed = createPlayingEmbed(track('Live', { live: true, ai: true }), 1, true, true);

    expect(embed.header?.text).toBe('🎶 Now Playing 🔊 100% ⚡ Live Stream');
    expect(embed.footer).toEqual({ text: 'Audio is AI generated' });
  });
});

describe('authorization embed builders', () => {
  it('constructs an expiring authorization link from source metadata', () => {
    const details = SOURCE_DETAILS[TrackSource.Spotify];

    expect(createAuthEmbed('https://auth.test', TrackSource.Spotify)).toEqual({
      url: 'https://auth.test',
      title: 'Authorize Spotify',
      description:
        'Please click the link to authenticate with Spotify in order to complete your request',
      color: details.color,
      thumbnail: details.icon,
      footer: { text: 'This link will expire in 60 seconds.' },
    });
  });

  it.each([
    [
      createAuthCompleteEmbed,
      'Authorize SoundCloud Complete',
      'You have authorized Eolian to read your SoundCloud information!\n' +
        'You can go back to the channel where you sent a command now :)',
    ],
    [
      createAuthExpiredEmbed,
      'Authorize SoundCloud Expired',
      'This request expired!\nClick this link faster next time',
    ],
    [createAuthErrorEmbed, 'Authorize SoundCloud Failed', 'This request failed! Try again'],
  ])('builds the %s user-visible variant', (factory, title, description) => {
    expect(factory(TrackSource.SoundCloud)).toEqual({
      title,
      description,
      color: Color.SoundCloud,
      thumbnail: SOURCE_DETAILS[TrackSource.SoundCloud].icon,
    });
  });
});
