import { CommandContext, CommandOptions } from 'commands/@types';
import { SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { SourceResolver } from './@types';
import { SoundCloudResolver } from './soundcloud';
import { SpotifyResolver } from './spotify';
import { YouTubeResolver } from './youtube';

const UNKNOWN_RESOLVER: SourceResolver = {
  fetch: async () => {
    throw new EolianUserError('could not fetch unknown resource.');
  },
  resolve: async () => {
    throw new EolianUserError('Could not find unknown resource.');
  }
}

function getBySource(source: SOURCE, context: CommandContext, params: CommandOptions) {
  switch (source) {
    case SOURCE.SOUNDCLOUD: return new SoundCloudResolver(context, params);
    case SOURCE.YOUTUBE: return new YouTubeResolver(context, params);
    case SOURCE.SPOTIFY: return new SpotifyResolver(context, params);
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
  } else if (params.FAVORITES) {
    return getFavoritesResolver(context, params);
  } else if (params.ARTIST) {
    return getArtistResolver(context, params);
  }
  return getSongResolver(params, context);
}

function getSongResolver(params: CommandOptions, context: CommandContext) {
  if (params.SOUNDCLOUD) {
    return new SoundCloudResolver(context, params);
  } else if (params.SPOTIFY) {
    context.channel.send(`Actually, I will search YouTube instead. If that doesn't work out try SoundCloud.`);
  }
  return new YouTubeResolver(context, params);
}

function getTracksResolver(context: CommandContext, params: CommandOptions) {
  if (params.SPOTIFY || params.YOUTUBE) {
    context.channel.send('(Psst.. The TRACKS keyword is only for SoundCloud.)');
  }
  return new SoundCloudResolver(context, params);
}

function getFavoritesResolver(context: CommandContext, params: CommandOptions) {
  if (params.SPOTIFY || params.YOUTUBE) {
    context.channel.send('(Psst.. The FAVORITES keyword is only for SoundCloud.)');
  }
  return new SoundCloudResolver(context, params);
}

function getArtistResolver(context: CommandContext, params: CommandOptions) {
  if (params.YOUTUBE) {
    context.channel.send(`Hmm. Actually, I'm going to use Spotify instead. If that doesn't work out try with SoundCloud.`)
  } else if (params.SOUNDCLOUD) {
    return new SoundCloudResolver(context, params);
  }
  return new SpotifyResolver(context, params);
}

function getAlbumResolver(context: CommandContext, params: CommandOptions) {
  if (params.SOUNDCLOUD || params.YOUTUBE) {
    context.channel.send('I only support Spotify regarding albums.');
  }
  return new SpotifyResolver(context, params);
}

function getPlaylistResolver(context: CommandContext, params: CommandOptions) {
  if (params.SPOTIFY) {
    return new SpotifyResolver(context, params);
  } else if (params.SOUNDCLOUD) {
    return new SoundCloudResolver(context, params);
  }
  return new YouTubeResolver(context, params);
}

export function getSourceResolver(context: CommandContext, params: CommandOptions): SourceResolver {
  if (params.URL && (params.QUERY || params.MY)) {
    throw new EolianUserError('You must specify only an URL, QUERY or MY.');
  }

  return params.URL
    ? getBySource(params.URL.source, context, params)
    : getByQuery(context, params);
}