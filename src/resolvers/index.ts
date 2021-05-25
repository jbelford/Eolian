import { CommandContext, CommandOptions, UrlArgument } from 'commands/@types';
import { SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { Identifier } from 'data/@types';
import { ContextTextChannel } from 'eolian/@types';
import { SourceFetcher, SourceResolver } from './@types';
import { SoundCloudArtistResolver, SoundCloudFavoritesResolver, SoundCloudFetcher, SoundCloudPlaylistResolver, SoundCloudSongResolver, SoundCloudTracksResolver, SoundCloudUrlResolver } from './soundcloud';
import { SpotifyAlbumResolver, SpotifyArtistResolver, SpotifyFetcher, SpotifyPlaylistResolver, SpotifyUrlResolver } from './spotify';
import { YouTubeFetcher, YouTubePlaylistResolver, YouTubeUrlResolver, YouTubeVideoResolver } from './youtube';

const UNKNOWN_RESOLVER: SourceResolver = {
  resolve: async () => {
    throw new EolianUserError('Could not find unknown resource.');
  }
}

const UNKNOWN_FETCHER: SourceFetcher = {
  fetch: async () => {
    throw new EolianUserError('Could not fetch unknown resource.');
  }
}

function getBySource(context: CommandContext, url: UrlArgument) {
  switch (url.source) {
    case SOURCE.SOUNDCLOUD: return new SoundCloudUrlResolver(url.value);
    case SOURCE.YOUTUBE: return new YouTubeUrlResolver(url.value, context);
    case SOURCE.SPOTIFY: return new SpotifyUrlResolver(url.value);
    default: return UNKNOWN_RESOLVER;
  }
}

function getByQuery(context: CommandContext, params: CommandOptions) {
  if (params.ALBUM) {
    return getAlbumResolver(context, params);
  } else if (params.PLAYLIST) {
    return getPlaylistResolver(context, params);
  } else if (params.TRACKS) {
    return getTracksResolver(context, params);
  } else if (params.LIKES) {
    return getFavoritesResolver(context, params);
  } else if (params.ARTIST) {
    return getArtistResolver(context, params);
  }
  return getSongResolver(params, context);
}

function getSongResolver(params: CommandOptions, context: CommandContext) {
  if (params.SOUNDCLOUD) {
    return new SoundCloudSongResolver(context, params);
  } else if (params.SPOTIFY) {
    context.channel.send(`Actually, I will search YouTube instead. If that doesn't work out try SoundCloud.`);
  }
  return new YouTubeVideoResolver(context, params);
}

function getTracksResolver(context: CommandContext, params: CommandOptions) {
  if (params.SPOTIFY || params.YOUTUBE) {
    context.channel.send('(Psst.. The TRACKS keyword is only for SoundCloud.)');
  }
  return new SoundCloudTracksResolver(context, params);
}

function getFavoritesResolver(context: CommandContext, params: CommandOptions) {
  if (params.SPOTIFY || params.YOUTUBE) {
    context.channel.send('(Psst.. The FAVORITES keyword is only for SoundCloud.)');
  }
  return new SoundCloudFavoritesResolver(context, params);
}

function getArtistResolver(context: CommandContext, params: CommandOptions) {
  if (params.YOUTUBE) {
    context.channel.send(`Hmm. Actually, I'm going to use Spotify instead. If that doesn't work out try with SoundCloud.`)
  } else if (params.SOUNDCLOUD) {
    return new SoundCloudArtistResolver(context, params);
  }
  return new SpotifyArtistResolver(context, params);
}

function getAlbumResolver(context: CommandContext, params: CommandOptions) {
  if (params.SOUNDCLOUD || params.YOUTUBE) {
    context.channel.send('I only support Spotify regarding albums.');
  }
  return new SpotifyAlbumResolver(context, params);
}

function getPlaylistResolver(context: CommandContext, params: CommandOptions) {
  if (params.SPOTIFY) {
    return new SpotifyPlaylistResolver(context, params);
  } else if (params.SOUNDCLOUD) {
    return new SoundCloudPlaylistResolver(context, params);
  }
  return new YouTubePlaylistResolver(context, params);
}

export function getSourceResolver(context: CommandContext, params: CommandOptions): SourceResolver {
  if (params.URL && (params.QUERY || params.MY)) {
    throw new EolianUserError('You must specify only an URL, QUERY or MY.');
  }

  return params.URL
    ? getBySource(context, params.URL)
    : getByQuery(context, params);
}

export function getSourceFetcher(identifier: Identifier, params: CommandOptions, channel?: ContextTextChannel): SourceFetcher {
  switch (identifier.src) {
    case SOURCE.SOUNDCLOUD: return new SoundCloudFetcher(identifier, params, channel);
    case SOURCE.YOUTUBE: return new YouTubeFetcher(identifier);
    case SOURCE.SPOTIFY: return new SpotifyFetcher(identifier);
    default: return UNKNOWN_FETCHER;
  }
}