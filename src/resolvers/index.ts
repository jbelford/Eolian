import { TrackSource } from 'api/@types';
import { CommandContext, CommandOptions } from 'commands/@types';
import { EolianUserError } from 'common/errors';
import { Identifier, ResourceType } from 'data/@types';
import { ResourceTypeDetails, SourceFetcher, SourceResolver } from './@types';
import {
  getSoundCloudSourceFetcher,
  SoundCloudArtistResolver,
  SoundCloudFavoritesResolver,
  SoundCloudPlaylistResolver,
  SoundCloudSongResolver,
  SoundCloudTracksResolver,
  SoundCloudUrlResolver,
} from './soundcloud';
import {
  getSpotifySourceFetcher,
  SpotifyAlbumResolver,
  SpotifyArtistResolver,
  SpotifyPlaylistResolver,
  SpotifyUrlResolver,
} from './spotify';
import {
  getYouTubeSourceFetcher,
  YouTubePlaylistResolver,
  YouTubeUrlResolver,
  YouTubeVideoResolver,
} from './youtube';

const UNKNOWN_RESOLVER: SourceResolver = {
  resolve: async () => {
    throw new EolianUserError('Could not find unknown resource.');
  },
};

const UNKNOWN_FETCHER: SourceFetcher = {
  fetch: async () => {
    throw new EolianUserError('Could not fetch unknown resource.');
  },
};

function getBySource(context: CommandContext, params: CommandOptions) {
  switch (params.URL?.source) {
    case TrackSource.SoundCloud:
      return new SoundCloudUrlResolver(params.URL.value);
    case TrackSource.YouTube:
      return new YouTubeUrlResolver(params.URL.value, params, context);
    case TrackSource.Spotify:
      return new SpotifyUrlResolver(params.URL.value, params, context.interaction.channel);
    default:
      return UNKNOWN_RESOLVER;
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
    context.interaction.send(
      `Actually, I will search YouTube instead. If that doesn't work out try SoundCloud.`
    );
  }
  return new YouTubeVideoResolver(context, params);
}

function getTracksResolver(context: CommandContext, params: CommandOptions) {
  if (params.SPOTIFY || params.YOUTUBE) {
    context.interaction.send('(Psst.. The TRACKS keyword is only for SoundCloud.)');
  }
  return new SoundCloudTracksResolver(context, params);
}

function getFavoritesResolver(context: CommandContext, params: CommandOptions) {
  if (params.SPOTIFY || params.YOUTUBE) {
    context.interaction.send('(Psst.. The LIKES keyword is only for SoundCloud.)');
  }
  return new SoundCloudFavoritesResolver(context, params);
}

function getArtistResolver(context: CommandContext, params: CommandOptions) {
  if (params.YOUTUBE) {
    context.interaction.send(
      `Hmm. Actually, I'm going to use Spotify instead. If that doesn't work out try with SoundCloud.`
    );
  } else if (params.SOUNDCLOUD) {
    return new SoundCloudArtistResolver(context, params);
  }
  return new SpotifyArtistResolver(context, params);
}

function getAlbumResolver(context: CommandContext, params: CommandOptions) {
  if (params.SOUNDCLOUD || params.YOUTUBE) {
    context.interaction.send('I only support Spotify regarding albums.');
  }
  return new SpotifyAlbumResolver(context, params);
}

function getPlaylistResolver(context: CommandContext, params: CommandOptions) {
  if (params.MY) {
    if (params.SOUNDCLOUD) {
      return new SoundCloudPlaylistResolver(context, params);
    }
    return new SpotifyPlaylistResolver(context, params);
  } else if (params.SPOTIFY) {
    return new SpotifyPlaylistResolver(context, params);
  } else if (params.SOUNDCLOUD) {
    return new SoundCloudPlaylistResolver(context, params);
  }
  return new YouTubePlaylistResolver(context, params);
}

export function getSourceResolver(context: CommandContext, params: CommandOptions): SourceResolver {
  if (params.URL && (params.SEARCH || params.MY)) {
    throw new EolianUserError('You must specify only an URL, SEARCH or MY.');
  }

  return params.URL ? getBySource(context, params) : getByQuery(context, params);
}

export async function getSourceFetcher(
  identifier: Identifier,
  context: CommandContext,
  params: CommandOptions,
): Promise<SourceFetcher> {
  switch (identifier.src) {
    case TrackSource.SoundCloud:
      return getSoundCloudSourceFetcher(identifier, context, params);
    case TrackSource.YouTube:
      return getYouTubeSourceFetcher(identifier, context, params);
    case TrackSource.Spotify:
      return getSpotifySourceFetcher(identifier, context, params);
    default:
      return UNKNOWN_FETCHER;
  }
}

export const RESOURCE_TYPE_DETAILS: Record<ResourceType, ResourceTypeDetails> = {
  [ResourceType.Album]: {
    name: 'Album',
  },
  [ResourceType.Artist]: {
    name: 'Artist',
  },
  [ResourceType.Likes]: {
    name: 'Likes',
  },
  [ResourceType.Playlist]: {
    name: 'Playlist',
  },
  [ResourceType.Song]: {
    name: 'Song',
  },
  [ResourceType.Tracks]: {
    name: 'Tracks',
  },
};
