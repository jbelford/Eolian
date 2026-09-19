import { UserPermission } from '@eolian/common/constants';
import { vi } from 'vitest';

export const selectionMessage = {
  id: 'selection-message',
  text: '',
  edit: vi.fn(),
  editEmbed: vi.fn(),
  react: vi.fn(),
  releaseButtons: vi.fn(),
  delete: vi.fn(),
};

export function makeContext(
  options: {
    allowedYouTube?: boolean;
    permission?: UserPermission;
    selected?: number;
    user?: Record<string, unknown>;
  } = {},
) {
  const user = {
    name: 'Listener',
    permission: options.permission ?? UserPermission.User,
    get: vi.fn().mockResolvedValue({}),
    getRequest: vi.fn().mockResolvedValue({ request: true }),
    ...options.user,
  };
  const channel = { sendable: true, send: vi.fn() };
  const interaction = {
    channel,
    user,
    send: vi.fn(),
    sendSelection: vi.fn().mockResolvedValue({
      selected: options.selected ?? 0,
      message: selectionMessage,
    }),
  };
  return {
    server: { details: { isAllowedYouTube: options.allowedYouTube ?? true } },
    interaction,
  } as any;
}

export function makeSpotifyUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'spotify-user',
    display_name: 'Spotify User',
    uri: 'spotify:user:spotify-user',
    external_urls: { spotify: 'https://open.spotify.com/user/spotify-user' },
    ...overrides,
  } as any;
}

export function makeSpotifyArtist(id = 'artist-1') {
  return {
    id,
    href: `https://api.spotify.test/artists/${id}`,
    name: `Artist ${id}`,
    external_urls: { spotify: `https://open.spotify.com/artist/${id}` },
  } as any;
}

export function makeSpotifyTrack(id = 'track-1', overrides: Record<string, unknown> = {}) {
  const artist = makeSpotifyArtist();
  return {
    id,
    name: `Track ${id}`,
    album: makeSpotifyAlbum('album-for-track', { tracks: undefined }),
    artists: [artist],
    is_local: false,
    duration_ms: 123000,
    uri: `spotify:track:${id}`,
    external_urls: { spotify: `https://open.spotify.com/track/${id}` },
    ...overrides,
  } as any;
}

export function makeSpotifyAlbum(id = 'album-1', overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Album ${id}`,
    album_type: 'album',
    artists: [makeSpotifyArtist()],
    images: [{ url: `https://images.test/${id}.jpg` }],
    external_urls: { spotify: `https://open.spotify.com/album/${id}` },
    tracks: { href: '', total: 0, items: [], limit: 50, next: '', offset: 0, previous: '' },
    ...overrides,
  } as any;
}

export function makeSpotifyPlaylist(id = 'playlist-1', overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Playlist ${id}`,
    owner: makeSpotifyUser(),
    images: [{ url: `https://images.test/${id}.jpg` }],
    external_urls: { spotify: `https://open.spotify.com/playlist/${id}` },
    tracks: { href: '', total: 0, items: [], limit: 50, next: '', offset: 0, previous: '' },
    ...overrides,
  } as any;
}

export function makeSoundCloudUser(id = 42, overrides: Record<string, unknown> = {}) {
  return {
    id,
    kind: 'user',
    username: `SoundCloud User ${id}`,
    permalink_url: `https://soundcloud.test/users/${id}`,
    avatar_url: '',
    public_favorites_count: 12,
    followers_count: 3,
    track_count: 2,
    ...overrides,
  } as any;
}

export function makeSoundCloudTrack(id = 7, overrides: Record<string, unknown> = {}) {
  return {
    id,
    kind: 'track',
    title: `SoundCloud Track ${id}`,
    permalink_url: `https://soundcloud.test/tracks/${id}`,
    access: 'playable',
    streamable: true,
    duration: 120000,
    stream_url: `https://streams.test/${id}`,
    artwork_url: `https://images.test/${id}.jpg`,
    user: makeSoundCloudUser(),
    ...overrides,
  } as any;
}

export function makeSoundCloudPlaylist(id = 9, overrides: Record<string, unknown> = {}) {
  const tracks = [makeSoundCloudTrack()];
  return {
    id,
    kind: 'playlist',
    title: `SoundCloud Playlist ${id}`,
    permalink_url: `https://soundcloud.test/playlists/${id}`,
    artwork_url: '',
    tracks,
    track_count: tracks.length,
    user: makeSoundCloudUser(),
    ...overrides,
  } as any;
}

export function makeYouTubeVideo(id = 'video-1', overrides: Record<string, unknown> = {}) {
  return {
    id,
    channelName: 'YouTube Channel',
    name: `YouTube Video ${id}`,
    url: `https://youtube.test/watch?v=${id}`,
    duration: 120,
    artwork: `https://images.test/${id}.jpg`,
    ...overrides,
  } as any;
}

export function makeYouTubePlaylist(id = 'playlist-1', overrides: Record<string, unknown> = {}) {
  return {
    id,
    channelName: 'YouTube Channel',
    name: `YouTube Playlist ${id}`,
    url: `https://youtube.test/playlist?list=${id}`,
    videos: 2,
    ...overrides,
  } as any;
}

export function makePoem(overrides: Record<string, unknown> = {}) {
  return {
    title: 'The Test Poem',
    author: 'Test Poet',
    lines: ['first', 'second'],
    linecount: 2,
    ...overrides,
  } as any;
}
