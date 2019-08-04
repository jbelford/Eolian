import { SoundCloud, SoundCloudResourceType } from 'api/soundcloud';
import { Spotify, SpotifyResourceType } from 'api/spotify';
import { YouTube, YouTubeResourceType } from 'api/youtube';
import { IDENTIFIER_TYPE, SOURCE } from 'common/constants';
import { EolianBotError } from 'common/errors';

export type ResolvedResource = {
  authors: string[];
  name: string;
  identifier: Identifier;
};

export async function resolve(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource | undefined> {
  let resource: ResolvedResource;

  if (params.URL) {
    resource = await resolveUrl(params.URL.value, params.URL.source);
  } else {
    resource = await resolveTarget(context, params);
  }

  return resource;
}

function resolveUrl(url: string, source: SOURCE): Promise<ResolvedResource> {
  switch (source) {
    case SOURCE.SOUNDCLOUD: return resolveSoundCloudUrl(url);
    case SOURCE.SPOTIFY: return resolveSpotifyUrl(url);
    case SOURCE.YOUTUBE: return resolveYouTubeUrl(url);
    default: throw new EolianBotError('The URL provided is an unknown resource!');
  }
}

async function resolveSoundCloudUrl(url: string): Promise<ResolvedResource> {
  const resource = await SoundCloud.resolve(url);
  switch (resource.kind) {
    case SoundCloudResourceType.PLAYLIST:
      return createSoundCloudPlaylist(resource as SoundCloudPlaylist);
    case SoundCloudResourceType.TRACK:
      return createSoundCloudSong(resource as SoundCloudTrack);
    case SoundCloudResourceType.USER:
      return createSoundCloudUser(resource as SoundCloudUser);
    default:
      throw new EolianBotError('The SoundCloud URL is not valid!');
  }
}

async function resolveSpotifyUrl(url: string): Promise<ResolvedResource> {
  const resourceDetails = Spotify.getResourceType(url);
  switch (resourceDetails && resourceDetails.type) {
    case SpotifyResourceType.PLAYLIST:
      const playlist = await Spotify.getPlaylist(resourceDetails.id);
      return createSpotifyPlaylist(playlist);
    case SpotifyResourceType.ALBUM:
      const album = await Spotify.getAlbum(resourceDetails.id);
      return createSpotifyAlbum(album);
    case SpotifyResourceType.ARTIST:
      const artist = await Spotify.getArtist(resourceDetails.id);
      return createSpotifyArtist(artist);
    default:
      throw new EolianBotError('The Spotify URL is not valid!');
  }
}

async function resolveYouTubeUrl(url: string): Promise<ResolvedResource> {
  const resourceDetails = YouTube.getResourceType(url);
  switch (resourceDetails && resourceDetails.type) {
    case YouTubeResourceType.PLAYLIST:
      const playlist = await YouTube.getPlaylist(resourceDetails.id);
      return createYouTubePlaylist(playlist);
    case YouTubeResourceType.VIDEO:
      const video = await YouTube.getVideo(resourceDetails.id);
      return createYouTubeVideo(video);
    default:
      throw new EolianBotError('The YouTube URL provided is not valid!');
  }
}


function resolveTarget(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
  if (params.ALBUM) {
    return resolveAlbum(context, params);
  } else if (params.PLAYLIST) {
    return resolvePlaylist(context, params);
  } else if (params.TRACKS) {
    return resolveTracks(context, params);
  } else if (params.FAVORITES) {
    return resolveFavorites(context, params);
  } else if (params.ARTIST) {
    return resolveArtist(context, params);
  }
  return resolveSong(context, params);
}

function resolveAlbum(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
  if (params.SOUNDCLOUD || params.YOUTUBE) {
    context.channel.send('I only support Spotify regarding albums.');
  }
  return resolveSpotifyAlbum(context, params);
}

function resolveSpotifyAlbum(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
  if (params.QUERY) {
    return resolveSpotifyAlbumQuery(context, params);
  }
  throw new EolianBotError('Missing query for album.');
}

async function resolveSpotifyAlbumQuery(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
  const albums = await Spotify.searchAlbums(params.QUERY);

  const options = albums.map(album => `${album.name} - ${album.artists.map(artist => artist.name).join(',')}`);
  const idx = await context.channel.sendSelection(`Select the album you want (resolved via Spotify)`, options, context.user.id);
  if (idx === null) {
    throw new EolianBotError('Nothing selected. Cancelled request.');
  }

  const album = albums[idx];
  return createSpotifyAlbum(album);
}

async function resolvePlaylist(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
  if (params.SOUNDCLOUD) {
    return resolveSoundCloudPlaylist(context, params);
  } else if (params.SPOTIFY) {
    return resolveSpotifyPlaylist(context, params);
  }
  return resolveYouTubePlaylist(context, params);
}

async function resolveSpotifyPlaylist(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
  const playlists = await searchSpotifyPlaylists(params, context);
  if (playlists.length === 0) {
    throw new EolianBotError(`No Spotify playlists were found.`);
  }

  let playlist = playlists[0];
  if (playlists.length > 1) {
    const idx = await context.channel.sendSelection('Choose a Spotify playlist',
      playlists.map(playlist => playlist.name), context.user.id);
    if (idx === null) {
      throw new EolianBotError('Nothing selected. Cancelled request.');
    }
    playlist = playlists[idx];
  }

  return createSpotifyPlaylist(playlist);
}

async function searchSpotifyPlaylists(params: CommandActionParams, context: CommandActionContext) {
  let playlists: SpotifyPlaylist[];

  if (params.MY) {
    const user = await context.user.get();
    if (!user.spotify) {
      throw new EolianBotError(`User has not set Spotify account`,
        `I can't search your Spotify playlists because you haven't set your Spotify account yet!`);
    }
    playlists = await Spotify.searchPlaylists(params.QUERY, user.spotify);
  } else if (params.QUERY) {
    playlists = await Spotify.searchPlaylists(params.QUERY);
  } else {
    throw new EolianBotError('You must specify a query or use the MY keyword.')
  }

  return playlists;
}

async function resolveSoundCloudPlaylist(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
  const playlists = await searchSoundCloudPlaylists(params, context);
  if (playlists.length === 0) {
    throw new EolianBotError(`No SoundCloud playlists were found.`);
  }

  let playlist = playlists[0];
  if (playlists.length > 1) {
    const idx = await context.channel.sendSelection('Choose a SoundCloud playlist',
      playlists.map(playlist => playlist.title), context.user.id);
    if (idx === null) {
      throw new EolianBotError('Nothing selected. Cancelled request.');
    }
    playlist = playlists[idx];
  }

  return createSoundCloudPlaylist(playlist);
}

async function searchSoundCloudPlaylists(params: CommandActionParams, context: CommandActionContext) {
  let playlists: SoundCloudPlaylist[];

  if (params.MY) {
    const user = await context.user.get();
    if (!user.soundcloud) {
      throw new EolianBotError('User has not set SoundCloud account.',
        `I can't search your SoundCloud playlists because you haven't set your SoundCloud account yet!`);
    }
    playlists = await SoundCloud.searchPlaylists(params.QUERY, user.soundcloud);
  } else if (params.QUERY) {
    playlists = await SoundCloud.searchPlaylists(params.QUERY);
  } else {
    throw new EolianBotError('You must specify a query or use the MY keyword.');
  }

  return playlists;
}

function resolveYouTubePlaylist(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
  if (params.QUERY) {
    return resolveYouTubePlaylistQuery(context, params);
  }
  throw new EolianBotError('Missing query for YouTube playlist.');
}

async function resolveYouTubePlaylistQuery(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
  const playlists = await YouTube.searchPlaylists(params.QUERY);
  const idx = await context.channel.sendSelection('Choose a YouTube playlist',
    playlists.map(playlist => playlist.name), context.user.id);
  if (idx === null) throw new EolianBotError('Nothing selected. Cancelled request.');

  const playlist = playlists[idx];
  return createYouTubePlaylist(playlist);
}

function resolveArtist(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
  if (params.YOUTUBE) {
    context.channel.send(`Hmm. Actually, I'm going to use Spotify instead. If that doesn't work out try with SoundCloud.`)
  } else if (params.SOUNDCLOUD) {
    return resolveSoundCloudArtist(context, params);
  }
  return resolveSpotifyArtist(context, params);
}

function resolveSoundCloudArtist(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
  if (params.QUERY) {
    return resolveSoundCloudArtistQuery(context, params);
  } else if (params.MY) {
    return resolveSoundCloudUser(context);
  }
  throw new EolianBotError('Missing query for SoundCloud artist.');
}

async function resolveSoundCloudArtistQuery(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
  const users = await SoundCloud.searchUser(params.QUERY);
  const idx = await context.channel.sendSelection('Choose a SoundCloud user',
    users.map(user => user.username), context.user.id);
  if (idx === null) {
    throw new EolianBotError('Nothing selected. Cancelled request.');
  }

  return createSoundCloudUser(users[idx]);
}

async function resolveSoundCloudUser(context: CommandActionContext) {
  const user = await context.user.get();
  if (!user.soundcloud) {
    throw new EolianBotError('You have not set your SoundCloud account yet!');
  }
  const scUser = await SoundCloud.getUser(user.soundcloud);
  return createSoundCloudUser(scUser);
}

function resolveSpotifyArtist(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
  if (params.QUERY) {
    return resolveSpotifyArtistQuery(context, params);
  }
  throw new EolianBotError('Missing query for Spotify artist.');
}

async function resolveSpotifyArtistQuery(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
  const artists = await Spotify.searchArtists(params.QUERY);
  const idx = await context.channel.sendSelection('Choose a Spotify artist',
    artists.map(artist => artist.name), context.user.id);
  if (idx === null) {
    throw new EolianBotError('Nothing selected. Cancelled request.');
  }

  return createSpotifyArtist(artists[idx]);
}

function resolveTracks(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
  if (params.SPOTIFY || params.YOUTUBE) {
    context.channel.send('(Psst.. The TRACKS keyword is only for SoundCloud.)');
  }
  return resolveSoundCloudTracks(context, params);
}

async function resolveSoundCloudTracks(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
  const resource = await resolveSoundCloudArtist(context, params);
  resource.identifier.type = IDENTIFIER_TYPE.TRACKS;
  resource.identifier.url = `${resource.identifier.url}/tracks`;
  return resource;
}

function resolveFavorites(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
  if (params.SPOTIFY || params.YOUTUBE) {
    context.channel.send('(Psst.. The FAVORITES keyword is only for SoundCloud.)');
  }
  return resolveSoundCloudFavorites(context, params);
}

async function resolveSoundCloudFavorites(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
  const resource = await resolveSoundCloudArtist(context, params);
  resource.identifier.type = IDENTIFIER_TYPE.FAVORITES;
  resource.identifier.url = `${resource.identifier.url}/likes`;
  return resource;
}

function resolveSong(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
  if (params.SOUNDCLOUD) {
    return resolveSoundCloudSong(context, params);
  } else if (params.SPOTIFY) {
    context.channel.send(`Actually, I will search YouTube instead. If that doesn't work out try SoundCloud.`);
  }
  return resolveYouTubeSong(context, params);
}

function resolveSoundCloudSong(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
  if (params.QUERY) {
    return resolveSoundCloudSongQuery(context, params);
  }
  throw new EolianBotError('Missing query for SoundCloud song.');
}

async function resolveSoundCloudSongQuery(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
  const songs = await SoundCloud.searchSongs(params.QUERY);
  const idx = await context.channel.sendSelection('Choose a SoundCloud track',
    songs.map(song => `${song.title} --- ${song.user.username}`), context.user.id);
  if (idx === null) {
    throw new EolianBotError('Nothing selected. Cancelled request.');
  }

  return createSoundCloudSong(songs[idx]);
}

function resolveYouTubeSong(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
  if (params.QUERY) {
    return resolveYouTubeSongQuery(context, params);
  }
  throw new EolianBotError('Missing query for YouTube song.');
}

async function resolveYouTubeSongQuery(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
  const videos = await YouTube.searchVideos(params.QUERY);
  const idx = await context.channel.sendSelection('Choose a YouTube video',
    videos.map(video => video.name), context.user.id);
  if (idx === null) {
    throw new EolianBotError('Nothing selected. Cancelled request.');
  }

  return createYouTubeVideo(videos[idx]);
}

function createSoundCloudPlaylist(playlist: SoundCloudPlaylist): ResolvedResource {
  return {
    name: playlist.title,
    authors: [playlist.user.username],
    identifier: {
      id: playlist.id.toString(),
      src: SOURCE.SOUNDCLOUD,
      type: IDENTIFIER_TYPE.PLAYLIST,
      url: playlist.permalink_url
    }
  };
}

function createSoundCloudSong(track: SoundCloudTrack): ResolvedResource {
  return {
    name: track.title,
    authors: [track.user.username],
    identifier: {
      id: track.id.toString(),
      src: SOURCE.SOUNDCLOUD,
      type: IDENTIFIER_TYPE.SONG,
      url: track.permalink_url
    }
  }
}

function createSoundCloudUser(user: SoundCloudUser): ResolvedResource {
  return {
    name: user.username,
    authors: [user.username],
    identifier: {
      id: user.id.toString(),
      src: SOURCE.SOUNDCLOUD,
      type: IDENTIFIER_TYPE.ARTIST,
      url: user.permalink_url
    }
  }
}

function createSpotifyPlaylist(playlist: SpotifyPlaylist): ResolvedResource {
  return {
    name: playlist.name,
    authors: [playlist.owner.display_name],
    identifier: {
      id: playlist.id,
      src: SOURCE.SPOTIFY,
      type: IDENTIFIER_TYPE.PLAYLIST,
      url: playlist.external_urls.spotify
    }
  };
}

function createSpotifyAlbum(album: SpotifyAlbum): ResolvedResource {
  return {
    name: album.name,
    authors: album.artists.map(x => x.name),
    identifier: {
      id: album.id,
      src: SOURCE.SPOTIFY,
      type: IDENTIFIER_TYPE.ALBUM,
      url: album.external_urls.spotify
    }
  };
}

function createSpotifyArtist(artist: SpotifyArtist): ResolvedResource {
  return {
    name: artist.name,
    authors: [artist.name],
    identifier: {
      id: artist.id,
      src: SOURCE.SPOTIFY,
      type: IDENTIFIER_TYPE.ARTIST,
      url: artist.external_urls.spotify
    }
  };
}

function createYouTubePlaylist(playlist: YoutubePlaylist): ResolvedResource {
  return {
    name: playlist.name,
    authors: [playlist.channelName],
    identifier: {
      id: playlist.id,
      src: SOURCE.YOUTUBE,
      type: IDENTIFIER_TYPE.PLAYLIST,
      url: playlist.url
    }
  };
}

function createYouTubeVideo(video: YoutubeVideo): ResolvedResource {
  return {
    name: video.name,
    authors: [video.channelName],
    identifier: {
      id: video.id,
      src: SOURCE.YOUTUBE,
      type: IDENTIFIER_TYPE.SONG,
      url: video.url
    }
  }
}