import { SoundCloud } from "api/soundcloud";
import { Spotify, SpotifyResourceType } from "api/spotify";
import { YouTube } from "api/youtube";
import { AccountCategory } from "commands/command";
import { KEYWORDS } from "commands/keywords";
import { EolianBotError } from "common/errors";
import { logger } from "common/logger";


const info: CommandInfo = {
  name: 'identify',
  category: AccountCategory,
  details: 'Set a keyword identifier for a playlist from Spotify, SoundCloud, or YouTube',
  permission: PERMISSION.USER,
  keywords: [
    KEYWORDS.IDENTIFIER, KEYWORDS.URL, KEYWORDS.QUERY, KEYWORDS.MY, KEYWORDS.SOUNDCLOUD, KEYWORDS.SPOTIFY, KEYWORDS.YOUTUBE,
    KEYWORDS.PLAYLIST, KEYWORDS.ALBUM
  ],
  usage: ['spotify playlist (retrowave) as [retro]'],
}

type ResolvedResource = {
  authors: string[];
  name: string;
  identifier: Identifier;
};

class IdentifyAction implements CommandAction {
  info = info;

  constructor(private readonly services: CommandActionServices) {}

  public async execute(context: CommandActionContext, params: CommandActionParams): Promise<any> {
    if (!params.IDENTIFIER) {
      return await context.message.reply(`You forgot to specify the key for your identifer.`);
    } else if (params.URL && params.QUERY) {
      return await context.message.reply(`You specified both a url and a query! Please try again with only one of those.`);
    }

    try {
      let resource: ResolvedResource;
      if (params.URL) {
        resource = await this.resolveUrl(params.URL.value, params.URL.source);
      } else if (params.QUERY) {
        resource = await this.resolveQuery(context, params);
      }
      if (resource) {
        await this.services.users.addResourceIdentifier(context.user.id, params.IDENTIFIER, resource.identifier);
        const authors = resource.authors.join(',');
        return await context.message
          .reply(`Awesome! The resource \`${resource.name}\` by \`${authors}\` can now be identified with \`${params.IDENTIFIER}\`.`);
      }
    } catch (e) {
      logger.debug(e.stack || e);
      return await context.message.reply(e.response || 'Sorry. Something broke real bad.');
    }

    await context.message.reply(`You must provide me something to identify! Please try again with a URL or query.`);
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
    const playlist = await SoundCloud.resolvePlaylist(url);
    const identifer: Identifier = {
      id: playlist.id.toString(),
      src: SOURCE.SOUNDCLOUD,
      type: IDENTIFIER_TYPE.PLAYLIST,
      url: playlist.permalink_url
    };
    return {
      name: playlist.title,
      authors: [playlist.user.username],
      identifier: identifer
    };
  }

  private async resolveSpotifyUrl(url: string): Promise<ResolvedResource> {
    const resourceDetails = Spotify.getResourceType(url);
    if (resourceDetails) {
      if (resourceDetails.type === SpotifyResourceType.PLAYLIST) {
        const playlist = await Spotify.getPlaylist(resourceDetails.id);
        const identifer: Identifier = {
          id: playlist.id,
          src: SOURCE.SPOTIFY,
          type: IDENTIFIER_TYPE.PLAYLIST,
          url: playlist.external_urls.spotify
        };
        return {
          name: playlist.name,
          authors: [playlist.owner.display_name],
          identifier: identifer
        };
      } else if (resourceDetails.type === SpotifyResourceType.ALBUM) {
        const album = await Spotify.getAlbum(resourceDetails.id);
        const identifer: Identifier = {
          id: album.id,
          src: SOURCE.SPOTIFY,
          type: IDENTIFIER_TYPE.ALBUM,
          url: album.external_urls.spotify
        };
        return {
          name: album.name,
          authors: album.artists.map(x => x.name),
          identifier: identifer
        };
      }
    }
    throw new EolianBotError('The Spotify URL provided must be a playlist or an album!');
  }

  private async resolveYouTubeUrl(url: string): Promise<ResolvedResource> {
    const resourceDetails = YouTube.getResourceType(url);
    if (resourceDetails.type === YouTubeResourceType.PLAYLIST) {
      const playlist = await YouTube.getPlaylist(resourceDetails.id);
      const identifer: Identifier = {
        id: playlist.id,
        src: SOURCE.YOUTUBE,
        type: IDENTIFIER_TYPE.PLAYLIST,
        url: playlist.url
      };
      return {
        name: playlist.name,
        authors: [playlist.channelName],
        identifier: identifer
      };
    }
    throw new EolianBotError('The YouTube URL provided is not a playlist!');
  }

  private resolveQuery(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    if (params.ALBUM) {
      return this.resolveSpotifyAlbumQuery(context, params);
    } else if (params.SPOTIFY) {
      return this.resolveSpotifyPlaylistQuery(context, params);
    } else if (params.SOUNDCLOUD) {
      return this.resolveSoundCloudPlaylistQuery(context, params);
    }
    return this.resolveYouTubePlaylistQuery(context, params);
  }

  private async resolveSpotifyPlaylistQuery(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
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

    const identifer: Identifier = {
      id: playlist.id,
      src: SOURCE.SPOTIFY,
      type: IDENTIFIER_TYPE.PLAYLIST,
      url: playlist.external_urls.spotify
    };

    return {
      name: playlist.name,
      authors: [playlist.owner.display_name],
      identifier: identifer
    };
  }

  private async resolveSpotifyAlbumQuery(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    const albums = await Spotify.searchAlbums(params.QUERY);
    const idx = await context.channel.sendSelection(`Select the album you want (resolved via Spotify)`,
      albums.map(album => `${album.name} - ${album.artists.map(artist => artist.name).join(',')}`), context.user.id);
    if (idx === null) throw new EolianBotError('Nothing selected. Cancelled request.');

    const album = albums[idx];
    const identifer: Identifier = {
      id: album.id,
      src: SOURCE.SPOTIFY,
      type: IDENTIFIER_TYPE.ALBUM,
      url: album.external_urls.spotify
    };

    return {
      name: album.name,
      authors: album.artists.map(x => x.name),
      identifier: identifer
    };
  }

  private async resolveSoundCloudPlaylistQuery(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
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

    const identifer: Identifier = {
      id: playlist.id.toString(),
      src: SOURCE.SOUNDCLOUD,
      type: IDENTIFIER_TYPE.PLAYLIST,
      url: playlist.permalink_url
    };

    return {
      name: playlist.title,
      authors: [playlist.user.username],
      identifier: identifer
    };
  }

  private async resolveYouTubePlaylistQuery(context: CommandActionContext, params: CommandActionParams): Promise<ResolvedResource> {
    const playlists = await YouTube.searchPlaylists(params.QUERY);
    const idx = await context.channel.sendSelection('Choose a YouTube playlist',
      playlists.map(playlist => playlist.name), context.user.id);
    if (idx === null) throw new EolianBotError('Nothing selected. Cancelled request.');

    const playlist = playlists[idx];
    const identifer: Identifier = {
      id: playlist.id,
      src: SOURCE.YOUTUBE,
      type: IDENTIFIER_TYPE.PLAYLIST,
      url: playlist.url
    };

    return {
      name: playlist.name,
      authors: [playlist.channelName],
      identifier: identifer
    };
  }

}

export const IdentifyCommand: Command = {
  info,
  action: IdentifyAction
}