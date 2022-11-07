import { createSoundCloudClient, soundcloud } from '@eolian/api';
import { TrackSource } from '@eolian/api/@types';
import { CommandContext, CommandOptions } from '@eolian/commands/@types';
import { feature } from '@eolian/data';
import { Identifier, ResourceType, FeatureFlag } from '@eolian/data/@types';
import { SourceFetcher } from '../@types';
import { SoundCloudArtistFetcher } from './artist';
import { SoundCloudFavoritesFetcher } from './likes';
import { SoundCloudPlaylistFetcher } from './playlist';
import { SoundCloudSongFetcher } from './song';

export { SoundCloudArtistResolver, SoundCloudTracksResolver } from './artist';
export { SoundCloudFavoritesResolver } from './likes';
export { SoundCloudPlaylistResolver } from './playlist';
export { SoundCloudSongResolver } from './song';
export { SoundCloudUrlResolver } from './url';

export async function getSoundCloudSourceFetcher(
  identifier: Identifier,
  context: CommandContext,
  params: CommandOptions
): Promise<SourceFetcher> {
  const id = +identifier.id;
  switch (identifier.type) {
    case ResourceType.Tracks:
    case ResourceType.Artist:
      if (identifier.auth && feature.enabled(FeatureFlag.SOUNDCLOUD_AUTH)) {
        const request = await context.interaction.user.getRequest(
          context.interaction,
          TrackSource.SoundCloud
        );
        const client = createSoundCloudClient(request);
        return new SoundCloudArtistFetcher(client);
      }
      return new SoundCloudArtistFetcher(id);
    case ResourceType.Likes:
      if (identifier.auth && feature.enabled(FeatureFlag.SOUNDCLOUD_AUTH)) {
        const request = await context.interaction.user.getRequest(
          context.interaction,
          TrackSource.SoundCloud
        );
        const client = createSoundCloudClient(request);
        return new SoundCloudFavoritesFetcher(client, params, context.interaction);
      }
      return new SoundCloudFavoritesFetcher(id, params, context.interaction);
    case ResourceType.Playlist: {
      let client = soundcloud;
      if (identifier.auth && feature.enabled(FeatureFlag.SOUNDCLOUD_AUTH)) {
        const request = await context.interaction.user.getRequest(
          context.interaction,
          TrackSource.SoundCloud
        );
        client = createSoundCloudClient(request);
      }
      return new SoundCloudPlaylistFetcher(id, client);
    }
    case ResourceType.Song:
      return new SoundCloudSongFetcher(id);
    default:
      throw new Error(`Invalid type for SoundCloud fetcher`);
  }
}
