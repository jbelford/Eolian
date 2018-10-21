import { SoundCloud } from "api/soundcloud";
import { Spotify, SpotifyResourceType } from "api/spotify";
import { YouTube, YouTubeResourceType } from "api/youtube";
import { AccountCategory, CommandAction } from "commands/command";
import { KEYWORDS } from "commands/keywords";
import { IDENTIFIER_TYPE, PERMISSION, SOURCE } from "common/constants";
import { EolianBotError } from "common/errors";
import { logger } from "common/logger";

class IdentifyAction extends CommandAction {

  public async execute(context: CommandActionContext, params: CommandActionParams): Promise<any> {
    if (!params.IDENTIFIER) {
      return await context.message.reply(`You forgot to specify the key for your identifer.`);
    }
    try {
      let identifier: Identifier;
      if (params.URL) {
        identifier = await this.resolveUrl(params.URL.value, params.URL.source);
      } else if (params.QUERY) {
        identifier = await this.resolveQuery(context, params);
      }
      if (identifier) {
        await this.services.users.addResourceIdentifier(context.user.id, params.IDENTIFIER, identifier);
        const authors = identifier.authors.join(',');
        return await context.message
          .reply(`Awesome! The resource \`${identifier.name}\` by \`${authors}\` can now be identified with \`${params.IDENTIFIER}\`.`);
      }
    } catch (e) {
      logger.debug(e.message);
      return await context.message.reply(e.response || 'Sorry. Something broke real bad.');
    }
    await context.message.reply(`You must provide me something to identify! Please try again with a URL or query.`);
  }

  private resolveUrl(url: string, source: SOURCE): Promise<Identifier> {
    switch (source) {
      case SOURCE.SOUNDCLOUD: return this.resolveSoundCloudUrl(url);
      case SOURCE.SPOTIFY: return this.resolveSpotifyUrl(url);
      case SOURCE.YOUTUBE: return this.resolveYouTubeUrl(url);
      default: throw new EolianBotError('The URL provided is an unknown resource!');
    }
  }

  private async resolveSoundCloudUrl(url: string): Promise<Identifier> {
    const playlist = await SoundCloud.resolvePlaylist(url);
    return {
      id: playlist.id.toString(),
      name: playlist.title,
      src: SOURCE.SOUNDCLOUD,
      type: IDENTIFIER_TYPE.PLAYLIST,
      authors: [playlist.user.username]
    };
  }

  private async resolveSpotifyUrl(url: string): Promise<Identifier> {
    const resourceDetails = Spotify.getResourceType(url);
    if (resourceDetails) {
      if (resourceDetails.type === SpotifyResourceType.PLAYLIST) {
        const playlist = await Spotify.getPlaylist(resourceDetails.id);
        return {
          id: playlist.id,
          name: playlist.name,
          authors: [playlist.owner.display_name],
          src: SOURCE.SPOTIFY,
          type: IDENTIFIER_TYPE.PLAYLIST
        };
      } else if (resourceDetails.type === SpotifyResourceType.ALBUM) {
        const album = await Spotify.getAlbum(resourceDetails.id);
        return {
          id: album.id,
          name: album.name,
          authors: album.artists.map(artist => artist.name),
          src: SOURCE.SPOTIFY,
          type: IDENTIFIER_TYPE.ALBUM
        }
      }
    }
    throw new EolianBotError('The Spotify URL provided must be a playlist or an album!');
  }

  private async resolveYouTubeUrl(url: string): Promise<Identifier> {
    const resourceDetails = YouTube.getResourceType(url);
    if (resourceDetails.type === YouTubeResourceType.PLAYLIST) {
      const playlist = await YouTube.getPlaylist(resourceDetails.id);
      return {
        id: playlist.id,
        name: playlist.name,
        authors: [playlist.channelName],
        src: SOURCE.YOUTUBE,
        type: IDENTIFIER_TYPE.PLAYLIST
      }
    }
    throw new EolianBotError('The YouTube URL provided is not a playlist!');
  }

  private resolveQuery(context: CommandActionContext, params: CommandActionParams): Promise<Identifier> {
    if (params.ALBUM) {
      return this.resolveSpotifyAlbumQuery(context, params);
    } else if (params.SPOTIFY) {
      return this.resolveSpotifyPlaylistQuery(context, params);
    } else if (params.SOUNDCLOUD) {
      return this.resolveSoundCloudPlaylistQuery(context, params);
    }
    return this.resolveYouTubePlaylistQuery(context, params);
  }

  private async resolveSpotifyPlaylistQuery(context: CommandActionContext, params: CommandActionParams): Promise<Identifier> {
    let playlists: SpotifyPlaylist[];
    if (params.MY) {
      const user = await this.services.users.getUser(context.user.id);
      if (!user.spotify) {
        throw new EolianBotError(`User has not set Spotify account`,
          `I can't search your Spotify playlists because you haven't set your Spotify account yet!`);
      }
      playlists = await Spotify.searchPlaylists(params.QUERY, user.spotify);
    } else {
      playlists = await Spotify.searchPlaylists(params.QUERY);
    }
    if (playlists.length === 0) throw new EolianBotError(`No Spotify playlists were found.`);

    let playlist = playlists[0];
    if (playlists.length > 1) {
      const idx = await context.channel.sendSelection('Choose a Spotify playlist',
        playlists.map(playlist => playlist.name), context.user.id);
      if (idx === null) throw new EolianBotError('Nothing selected. Cancelled request.');
      playlist = playlists[idx];
    }

    return {
      id: playlist.id,
      name: playlist.name,
      authors: [playlist.owner.display_name],
      src: SOURCE.SPOTIFY,
      type: IDENTIFIER_TYPE.PLAYLIST,
    };
  }

  private async resolveSpotifyAlbumQuery(context: CommandActionContext, params: CommandActionParams): Promise<Identifier> {
    const albums = await Spotify.searchAlbums(params.QUERY);
    const idx = await context.channel.sendSelection(`Select the album you want (resolved via Spotify)`,
      albums.map(album => `${album.name} - ${album.artists.map(artist => artist.name).join(',')}`), context.user.id);
    if (idx === null) throw new EolianBotError('Nothing selected. Cancelled request.');

    const album = albums[idx];
    return {
      id: album.id,
      name: album.name,
      authors: album.artists.map(artist => artist.name),
      src: SOURCE.SPOTIFY,
      type: IDENTIFIER_TYPE.ALBUM
    };
  }

  private async resolveSoundCloudPlaylistQuery(context: CommandActionContext, params: CommandActionParams): Promise<Identifier> {
    let playlists: SoundCloudPlaylist[];
    if (params.MY) {
      const user = await this.services.users.getUser(context.user.id);
      if (!user.soundcloud) {
        throw new EolianBotError('User has not set SoundCloud account.',
          `I can't search your SoundCloud playlists because you haven't set your SoundCloud account yet!`);
      }
      playlists = await SoundCloud.searchPlaylists(params.QUERY, user.soundcloud);
    } else {
      playlists = await SoundCloud.searchPlaylists(params.QUERY);
    }
    if (playlists.length === 0) throw new EolianBotError(`No SoundCloud playlists were found.`);

    let playlist = playlists[0];
    if (playlists.length > 1) {
      const idx = await context.channel.sendSelection('Choose a SoundCloud playlist',
        playlists.map(playlist => playlist.title), context.user.id);
      if (idx === null) throw new EolianBotError('Nothing selected. Cancelled request.');
      playlist = playlists[idx];
    }

    return {
      id: playlist.id.toString(),
      authors: [playlist.user.username],
      name: playlist.title,
      src: SOURCE.SOUNDCLOUD,
      type: IDENTIFIER_TYPE.PLAYLIST
    };
  }

  private async resolveYouTubePlaylistQuery(context: CommandActionContext, params: CommandActionParams): Promise<Identifier> {
    const playlists = await YouTube.searchPlaylists(params.QUERY);
    const idx = await context.channel.sendSelection('Choose a YouTube playlist',
      playlists.map(playlist => playlist.name), context.user.id);
    if (idx === null) throw new EolianBotError('Nothing selected. Cancelled request.');

    const playlist = playlists[idx];
    return {
      id: playlist.id,
      authors: [playlist.channelName],
      name: playlist.name,
      src: SOURCE.SOUNDCLOUD,
      type: IDENTIFIER_TYPE.PLAYLIST
    }
  }

}

export const IdentifyCommand: Command = {
  name: 'identify',
  category: AccountCategory,
  details: 'Set a keyword identifier for a playlist from Spotify, SoundCloud, or YouTube',
  permission: PERMISSION.USER,
  keywords: [
    KEYWORDS.IDENTIFIER, KEYWORDS.URL, KEYWORDS.QUERY, KEYWORDS.MY, KEYWORDS.SOUNDCLOUD, KEYWORDS.SPOTIFY, KEYWORDS.YOUTUBE,
    KEYWORDS.PLAYLIST, KEYWORDS.ALBUM
  ],
  usage: ['spotify playlist (retrowave) as [retro]'],
  action: IdentifyAction
};