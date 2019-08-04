import { SOURCE } from 'common/constants';
import { EolianBotError } from 'common/errors';
import { SoundCloudResolver } from './soundcloud';
import { SpotifyResolver } from './spotify';
import { YouTubeResolver } from './youtube';

const UNKNOWN_RESOLVER: SourceResolver = {
  resolve: async () => {
    throw new EolianBotError('Could not find unknown resource.');
  }
}

function getBySource(source: SOURCE, context: CommandActionContext, params: CommandActionParams) {
  switch (source) {
    case SOURCE.SOUNDCLOUD: return new SoundCloudResolver(context, params);
    case SOURCE.YOUTUBE: return new YouTubeResolver(context, params);
    case SOURCE.SPOTIFY: return new SpotifyResolver(context, params);
    default: return UNKNOWN_RESOLVER;
  }
}

function getByQuery(context: CommandActionContext, params: CommandActionParams) {
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

function getSongResolver(params: CommandActionParams, context: CommandActionContext) {
  if (params.SOUNDCLOUD) {
    return new SoundCloudResolver(context, params);
  } else if (params.SPOTIFY) {
    context.channel.send(`Actually, I will search YouTube instead. If that doesn't work out try SoundCloud.`);
  }
  return new YouTubeResolver(context, params);
}

function getTracksResolver(context: CommandActionContext, params: CommandActionParams) {
  if (params.SPOTIFY || params.YOUTUBE) {
    context.channel.send('(Psst.. The TRACKS keyword is only for SoundCloud.)');
  }
  return new SoundCloudResolver(context, params);
}

function getFavoritesResolver(context: CommandActionContext, params: CommandActionParams) {
  if (params.SPOTIFY || params.YOUTUBE) {
    context.channel.send('(Psst.. The FAVORITES keyword is only for SoundCloud.)');
  }
  return new SoundCloudResolver(context, params);
}

function getArtistResolver(context: CommandActionContext, params: CommandActionParams) {
  if (params.YOUTUBE) {
    context.channel.send(`Hmm. Actually, I'm going to use Spotify instead. If that doesn't work out try with SoundCloud.`)
  } else if (params.SOUNDCLOUD) {
    return new SoundCloudResolver(context, params);
  }
  return new SpotifyResolver(context, params);
}

function getAlbumResolver(context: CommandActionContext, params: CommandActionParams) {
  if (params.SOUNDCLOUD || params.YOUTUBE) {
    context.channel.send('I only support Spotify regarding albums.');
  }
  return new SpotifyResolver(context, params);
}

function getPlaylistResolver(context: CommandActionContext, params: CommandActionParams) {
  if (params.SPOTIFY) {
    return new SpotifyResolver(context, params);
  } else if (params.SOUNDCLOUD) {
    return new SoundCloudResolver(context, params);
  }
  return new YouTubeResolver(context, params);
}

export function getSourceResolver(context: CommandActionContext, params: CommandActionParams): SourceResolver {
  if (params.URL && (params.QUERY || params.MY)) {
    throw new EolianBotError('You must specify only an URL, QUERY or MY.');
  }

  return params.URL
    ? getBySource(params.URL.source, context, params)
    : getByQuery(context, params);
}