import { spotify } from 'api';
import { SpotifyArtist } from 'api/@types';
import { mapSpotifyTrack } from 'api/spotify';
import { CommandContext, CommandOptions } from 'commands/@types';
import { MESSAGES, SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { IdentifierType } from 'data/@types';
import { FetchResult, ResolvedResource, SourceFetcher, SourceResolver } from 'resolvers/@types';


export class SpotifyArtistResolver implements SourceResolver {

  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {
  }

  async resolve(): Promise<ResolvedResource> {
    if (!this.params.SEARCH) {
      throw new EolianUserError('Missing search query for Spotify artist.');
    }

    const artists = await spotify.searchArtists(this.params.SEARCH);
    const idx = await this.context.interaction.channel.sendSelection('Choose a Spotify artist',
      artists.map(artist => ({ name: artist.name, url: artist.external_urls.spotify })),
      this.context.interaction.user);
    if (idx < 0) {
      throw new EolianUserError(MESSAGES.NO_SELECTION);
    }

    return createSpotifyArtist(artists[idx]);
  }
}

export function createSpotifyArtist(artist: SpotifyArtist): ResolvedResource {
  return {
    name: artist.name,
    authors: [artist.name],
    identifier: {
      id: artist.id,
      src: SOURCE.SPOTIFY,
      type: IdentifierType.ARTIST,
      url: artist.external_urls.spotify
    },
    fetcher: new SpotifyArtistFetcher(artist.id)
  };
}

export class SpotifyArtistFetcher implements SourceFetcher {

  constructor(private readonly id: string) {
  }

  async fetch(): Promise<FetchResult> {
    const tracks = await spotify.getArtistTracks(this.id);
    return { tracks: tracks.map(track => mapSpotifyTrack(track)) };
  }

}
