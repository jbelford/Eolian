import { createSoundCloudClient, soundcloud } from '@eolian/api';
import { TrackSource } from '@eolian/api/@types';
import { CommandOptions } from '@eolian/command-options/@types';
import { CommandContext } from '@eolian/commands/@types';
import { feature } from '@eolian/data';
import { Identifier, ResourceType, FeatureFlag } from '@eolian/data/@types';
import { SourceFetcher } from '../@types';
import { SoundCloudArtistFetcher } from './soundcloud-artist-resolver';
import { SoundCloudFavoritesFetcher } from './soundcloud-likes-resolver';
import { SoundCloudPlaylistFetcher } from './soundcloud-playlist-resolver';
import { SoundCloudSongFetcher } from './soundcloud-song-resolver';

export { SoundCloudArtistResolver, SoundCloudTracksResolver } from './soundcloud-artist-resolver';
export { SoundCloudFavoritesResolver } from './soundcloud-likes-resolver';
export { SoundCloudPlaylistResolver } from './soundcloud-playlist-resolver';
export { SoundCloudSongResolver } from './soundcloud-song-resolver';
export { SoundCloudUrlResolver } from './soundcloud-url-resolver';

export async function getSoundCloudSourceFetcher(
  identifier: Identifier,
  context: CommandContext,
  params: CommandOptions,
): Promise<SourceFetcher> {
  const id = +identifier.id;
  switch (identifier.type) {
    case ResourceType.Tracks:
    case ResourceType.Artist:
      if (identifier.auth && feature.enabled(FeatureFlag.SOUNDCLOUD_AUTH)) {
        const request = await context.interaction.user.getRequest(
          context.interaction,
          TrackSource.SoundCloud,
        );
        const client = createSoundCloudClient(request);
        return new SoundCloudArtistFetcher(client);
      }
      return new SoundCloudArtistFetcher(id);
    case ResourceType.Likes:
      if (identifier.auth && feature.enabled(FeatureFlag.SOUNDCLOUD_AUTH)) {
        const request = await context.interaction.user.getRequest(
          context.interaction,
          TrackSource.SoundCloud,
        );
        const client = createSoundCloudClient(request);
        return new SoundCloudFavoritesFetcher(client, params, context.interaction.channel);
      }
      return new SoundCloudFavoritesFetcher(id, params, context.interaction.channel);
    case ResourceType.Playlist: {
      let client = soundcloud;
      if (identifier.auth && feature.enabled(FeatureFlag.SOUNDCLOUD_AUTH)) {
        const request = await context.interaction.user.getRequest(
          context.interaction,
          TrackSource.SoundCloud,
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
