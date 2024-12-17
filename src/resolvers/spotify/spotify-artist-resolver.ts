import { mapSpotifyTrack, spotify } from '@eolian/api';
import { TrackSource } from '@eolian/api/@types';
import { SpotifyArtist } from '@eolian/api/spotify/@types';
import { CommandOptions } from '@eolian/command-options/@types';
import { CommandContext } from '@eolian/commands/@types';
import { EolianUserError } from '@eolian/common/errors';
import { ResourceType } from '@eolian/data/@types';
import { ContextMessage } from '@eolian/framework/@types';
import { SourceResolver, ResolvedResource, SourceFetcher, FetchResult } from '../@types';

export class SpotifyArtistResolver implements SourceResolver {
  public source = TrackSource.Spotify;

  constructor(
    private readonly context: CommandContext,
    private readonly params: CommandOptions,
  ) {}

  async resolve(): Promise<ResolvedResource> {
    if (!this.params.SEARCH) {
      throw new EolianUserError('Missing search query for Spotify artist.');
    }

    const artists = await spotify.searchArtists(this.params.SEARCH, this.params.FAST ? 1 : 5);
    if (artists.length === 0) {
      throw new EolianUserError('No Spotify artists were found.');
    } else if (artists.length === 1) {
      return createSpotifyArtist(artists[0]);
    } else {
      const result = await this.context.interaction.sendSelection(
        'Choose a Spotify artist',
        artists.map(artist => ({ name: artist.name, url: artist.external_urls.spotify })),
        this.context.interaction.user,
      );

      return createSpotifyArtist(artists[result.selected], result.message);
    }
  }
}

export function createSpotifyArtist(
  artist: SpotifyArtist,
  message?: ContextMessage,
): ResolvedResource {
  return {
    name: artist.name,
    authors: [artist.name],
    identifier: {
      id: artist.id,
      src: TrackSource.Spotify,
      type: ResourceType.Artist,
      url: artist.external_urls.spotify,
    },
    fetcher: new SpotifyArtistFetcher(artist.id),
    selectionMessage: message,
  };
}

export class SpotifyArtistFetcher implements SourceFetcher {
  constructor(private readonly id: string) {}

  async fetch(): Promise<FetchResult> {
    const tracks = await spotify.getArtistTracks(this.id);
    return { tracks: tracks.map(track => mapSpotifyTrack(track)) };
  }
}
