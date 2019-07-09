import { SoundCloud, SoundCloudResourceType } from 'api/soundcloud';
import { Spotify, SpotifyResourceType } from 'api/spotify';
import { YouTube, YouTubeResourceType } from 'api/youtube';
import { IDENTIFIER_TYPE, SOURCE } from 'common/constants';
import { EolianBotError } from 'common/errors';
import { EolianUserService } from 'data/user';

export type ResolvedResource = {
  authors: string[];
  name: string;
  identifier: Identifier;
};

export class IdentifiersService {

  constructor(private readonly users: EolianUserService) {}

  async resolve(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource | undefined> {
    let resource: ResolvedResource;

    if (params.URL) {
      resource = await this.resolveUrl(params.URL.value, params.URL.source);
    } else {
      resource = await this.resolveTarget(context, params);
    }

    return resource;
  }

  private resolveUrl(url: string, source: SOURCE): Promise<ResolvedResource> {
    switch (source) {
      case SOURCE.SOUNDCLOUD: return this.resolveSoundCloudUrl(url);
      case SOURCE.SPOTIFY: return this.resolveSpotifyUrl(url);
      case SOURCE.YOUTUBE: return this.resolveYouTubeUrl(url);
      default: throw new EolianBotError('The URL provided is an unknown resource!');
    }
  }

  private async resolveSoundCloudUrl(url: string): Promise<ResolvedResource> {
    const resource = await SoundCloud.resolve(url);
    switch (resource.kind) {
      case SoundCloudResourceType.PLAYLIST:
        return this.createSoundCloudPlaylist(resource as SoundCloudPlaylist);
      case SoundCloudResourceType.TRACK:
        return this.createSoundCloudSong(resource as SoundCloudTrack);
      case SoundCloudResourceType.USER:
        return this.createSoundCloudUser(resource as SoundCloudUser);
      default:
        throw new EolianBotError('The SoundCloud URL is not valid!');
    }
  }

  private async resolveSpotifyUrl(url: string): Promise<ResolvedResource> {
    const resourceDetails = Spotify.getResourceType(url);
    switch (resourceDetails && resourceDetails.type) {
      case SpotifyResourceType.PLAYLIST:
        const playlist = await Spotify.getPlaylist(resourceDetails.id);
        return this.createSpotifyPlaylist(playlist);
      case SpotifyResourceType.ALBUM:
        const album = await Spotify.getAlbum(resourceDetails.id);
        return this.createSpotifyAlbum(album);
      case SpotifyResourceType.ARTIST:
        const artist = await Spotify.getArtist(resourceDetails.id);
        return this.createSpotifyArtist(artist);
      default:
        throw new EolianBotError('The Spotify URL is not valid!');
    }
  }

  private async resolveYouTubeUrl(url: string): Promise<ResolvedResource> {
    const resourceDetails = YouTube.getResourceType(url);
    switch (resourceDetails && resourceDetails.type) {
      case YouTubeResourceType.PLAYLIST:
        const playlist = await YouTube.getPlaylist(resourceDetails.id);
        return this.createYouTubePlaylist(playlist);
      case YouTubeResourceType.VIDEO:
        const video = await YouTube.getVideo(resourceDetails.id);
        return this.createYouTubeVideo(video);
      default:
        throw new EolianBotError('The YouTube URL provided is not valid!');
    }
  }


  private resolveTarget(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    if (params.ALBUM) {
      return this.resolveAlbum(context, params);
    } else if (params.PLAYLIST) {
      return this.resolvePlaylist(context, params);
    } else if (params.TRACKS) {
      return this.resolveTracks(context, params);
    } else if (params.FAVORITES) {
      return this.resolveFavorites(context, params);
    } else if (params.ARTIST) {
      return this.resolveArtist(context, params);
    }
    return this.resolveSong(context, params);
  }

  private resolveAlbum(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    if (params.SOUNDCLOUD || params.YOUTUBE) {
      context.channel.send('I only support Spotify regarding albums.');
    }
    return this.resolveSpotifyAlbum(context, params);
  }

  private resolveSpotifyAlbum(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    if (params.QUERY) {
      return this.resolveSpotifyAlbumQuery(context, params);
    }
    throw new EolianBotError('Missing query for album.');
  }

  private async resolveSpotifyAlbumQuery(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    const albums = await Spotify.searchAlbums(params.QUERY);

    const options = albums.map(album => `${album.name} - ${album.artists.map(artist => artist.name).join(',')}`);
    const idx = await context.channel.sendSelection(`Select the album you want (resolved via Spotify)`, options, context.user.id);
    if (idx === null) {
      throw new EolianBotError('Nothing selected. Cancelled request.');
    }

    const album = albums[idx];
    return this.createSpotifyAlbum(album);
  }

  private async resolvePlaylist(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    if (params.SOUNDCLOUD) {
      return this.resolveSoundCloudPlaylist(context, params);
    } else if (params.SPOTIFY) {
      return this.resolveSpotifyPlaylist(context, params);
    }
    return this.resolveYouTubePlaylist(context, params);
  }

  private async resolveSpotifyPlaylist(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    const playlists = await this.searchSpotifyPlaylists(params, context);
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

    return this.createSpotifyPlaylist(playlist);
  }

  private async searchSpotifyPlaylists(params: CommandActionParams, context: CommandActionContext) {
    let playlists: SpotifyPlaylist[];

    if (params.MY) {
      const user = await this.users.getUser(context.user.id);
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

  private async resolveSoundCloudPlaylist(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    const playlists = await this.searchSoundCloudPlaylists(params, context);
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

    return this.createSoundCloudPlaylist(playlist);
  }

  private async searchSoundCloudPlaylists(params: CommandActionParams, context: CommandActionContext) {
    let playlists: SoundCloudPlaylist[];

    if (params.MY) {
      const user = await this.users.getUser(context.user.id);
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

  private resolveYouTubePlaylist(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    if (params.QUERY) {
      return this.resolveYouTubePlaylistQuery(context, params);
    }
    throw new EolianBotError('Missing query for YouTube playlist.');
  }

  private async resolveYouTubePlaylistQuery(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    const playlists = await YouTube.searchPlaylists(params.QUERY);
    const idx = await context.channel.sendSelection('Choose a YouTube playlist',
      playlists.map(playlist => playlist.name), context.user.id);
    if (idx === null) throw new EolianBotError('Nothing selected. Cancelled request.');

    const playlist = playlists[idx];
    return this.createYouTubePlaylist(playlist);
  }

  private resolveArtist(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    if (params.YOUTUBE) {
      context.channel.send(`Hmm. Actually, I'm going to use Spotify instead. If that doesn't work out try with SoundCloud.`)
    } else if (params.SOUNDCLOUD) {
      return this.resolveSoundCloudArtist(context, params);
    }
    return this.resolveSpotifyArtist(context, params);
  }

  private resolveSoundCloudArtist(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    if (params.QUERY) {
      return this.resolveSoundCloudArtistQuery(context, params);
    } else if (params.MY) {
      return this.resolveSoundCloudUser(context);
    }
    throw new EolianBotError('Missing query for SoundCloud artist.');
  }

  private async resolveSoundCloudArtistQuery(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    const users = await SoundCloud.searchUser(params.QUERY);
    const idx = await context.channel.sendSelection('Choose a SoundCloud user',
      users.map(user => user.username), context.user.id);
    if (idx === null) {
      throw new EolianBotError('Nothing selected. Cancelled request.');
    }

    return this.createSoundCloudUser(users[idx]);
  }

  private async resolveSoundCloudUser(context: CommandActionContext) {
    const user = await this.users.getUser(context.user.id);
    if (!user.soundcloud) {
      throw new EolianBotError('You have not set your SoundCloud account yet!');
    }
    const scUser = await SoundCloud.getUser(user.soundcloud);
    return this.createSoundCloudUser(scUser);
  }

  private resolveSpotifyArtist(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    if (params.QUERY) {
      return this.resolveSpotifyArtistQuery(context, params);
    }
    throw new EolianBotError('Missing query for Spotify artist.');
  }

  private async resolveSpotifyArtistQuery(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    const artists = await Spotify.searchArtists(params.QUERY);
    const idx = await context.channel.sendSelection('Choose a Spotify artist',
      artists.map(artist => artist.name), context.user.id);
    if (idx === null) {
      throw new EolianBotError('Nothing selected. Cancelled request.');
    }

    return this.createSpotifyArtist(artists[idx]);
  }

  private resolveTracks(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    if (params.SPOTIFY || params.YOUTUBE) {
      context.channel.send('(Psst.. The TRACKS keyword is only for SoundCloud.)');
    }
    return this.resolveSoundCloudTracks(context, params);
  }

  private async resolveSoundCloudTracks(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    const resource = await this.resolveSoundCloudArtist(context, params);
    resource.identifier.type = IDENTIFIER_TYPE.TRACKS;
    resource.identifier.url = `${resource.identifier.url}/tracks`;
    return resource;
  }

  private resolveFavorites(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    if (params.SPOTIFY || params.YOUTUBE) {
      context.channel.send('(Psst.. The FAVORITES keyword is only for SoundCloud.)');
    }
    return this.resolveSoundCloudFavorites(context, params);
  }

  private async resolveSoundCloudFavorites(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    const resource = await this.resolveSoundCloudArtist(context, params);
    resource.identifier.type = IDENTIFIER_TYPE.FAVORITES;
    resource.identifier.url = `${resource.identifier.url}/likes`;
    return resource;
  }

  private resolveSong(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    if (params.SOUNDCLOUD) {
      return this.resolveSoundCloudSong(context, params);
    } else if (params.SPOTIFY) {
      context.channel.send(`Actually, I will search YouTube instead. If that doesn't work out try SoundCloud.`);
    }
    return this.resolveYouTubeSong(context, params);
  }

  private resolveSoundCloudSong(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    if (params.QUERY) {
      return this.resolveSoundCloudSongQuery(context, params);
    }
    throw new EolianBotError('Missing query for SoundCloud song.');
  }

  private async resolveSoundCloudSongQuery(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    const songs = await SoundCloud.searchSongs(params.QUERY);
    const idx = await context.channel.sendSelection('Choose a SoundCloud track',
      songs.map(song => `${song.title} --- ${song.user.username}`), context.user.id);
    if (idx === null) {
      throw new EolianBotError('Nothing selected. Cancelled request.');
    }

    return this.createSoundCloudSong(songs[idx]);
  }

  private resolveYouTubeSong(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    if (params.QUERY) {
      return this.resolveYouTubeSongQuery(context, params);
    }
    throw new EolianBotError('Missing query for YouTube song.');
  }

  private async resolveYouTubeSongQuery(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    const videos = await YouTube.searchVideos(params.QUERY);
    const idx = await context.channel.sendSelection('Choose a YouTube video',
      videos.map(video => video.name), context.user.id);
    if (idx === null) {
      throw new EolianBotError('Nothing selected. Cancelled request.');
    }

    return this.createYouTubeVideo(videos[idx]);
  }

  private createSoundCloudPlaylist(playlist: SoundCloudPlaylist): ResolvedResource {
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

  private createSoundCloudSong(track: SoundCloudTrack): ResolvedResource {
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

  private createSoundCloudUser(user: SoundCloudUser): ResolvedResource {
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

  private createSpotifyPlaylist(playlist: SpotifyPlaylist): ResolvedResource {
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

  private createSpotifyAlbum(album: SpotifyAlbum): ResolvedResource {
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

  private createSpotifyArtist(artist: SpotifyArtist): ResolvedResource {
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

  private createYouTubePlaylist(playlist: YoutubePlaylist): ResolvedResource {
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

  private createYouTubeVideo(video: YoutubeVideo): ResolvedResource {
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

}