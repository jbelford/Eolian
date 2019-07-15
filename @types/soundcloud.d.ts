type SoundCloudResource = {
  id: number;
  kind: import('api/soundcloud').SoundCloudResourceType;
  permalink_url: string;
}

interface SoundCloudUser extends SoundCloudResource {
  username: string;
  avatar_url: string;
}

interface SoundCloudPlaylist extends SoundCloudResource {
  artwork_url: string;
  tracks?: Track[];
  track_count: number;
  title: string;
  user: SoundCloudUser;
}

interface SoundCloudTrack extends SoundCloudResource {
  streamable: boolean;
  duration: number;
  stream_url: string;
  artwork_url: string;
  user: SoundCloudUser;
  title: string;
}