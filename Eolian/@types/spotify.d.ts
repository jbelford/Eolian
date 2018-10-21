
type SpotifyUser = {
  id: string;
  display_name: string;
  uri: string;
}

type SpotifyUrlDetails = {
  type: import('api/spotify').SpotifyResourceType;
  id: string;
}

type SpotifyPlaylist = {
  id: string;
  name: string;
  owner: SpotifyUser;
  external_urls: SpotifyExternalUrls;
  images: SpotifyImageObject[];
  tracks?: SpotifyPagingObject<SpotifyPlaylistTrack>;
};

type SpotifyAlbum = {
  id: string;
  external_urls: SpotifyExternalUrls;
  album_type: 'album' | 'single' | 'compilation';
  artists: SpotifyArtist[];
  images: SpotifyImageObject[];
  name: string;
  tracks?: SpotifyPagingObject<SpotifyTrack>;
};

type SpotifyPagingObject<T> = {
  href: string;
  items: T[];
  limit: number;
  next: string;
  offset: number;
  previous: string;
  total: number;
};

type SpotifySearchResult = {
  playlists: SpotifyPagingObject<SpotifyPlaylist>;
  artists: SpotifyPagingObject<SpotifyArtist>;
  albums: SpotifyPagingObject<SpotifyAlbum>;
};

type SpotifyPlaylistTrack = {
  track: SpotifyTrack;
};

type SpotifyImageObject = {
  url: string;
  height: number;
  width: number;
};

type SpotifyTrack = {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  duration_ms: number;
};

type SpotifyArtist = {
  href: string;
  id: string;
  name: string;
  external_urls: SpotifyExternalUrls;
};

type SpotifyExternalUrls = {
  spotify: string;
}


