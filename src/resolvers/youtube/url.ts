import { youtube } from 'api';
import { CommandContext } from 'commands/@types';
import { EolianUserError } from 'common/errors';
import { ResolvedResource, SourceResolver } from 'resolvers/@types';
import { createYouTubePlaylist } from './playlist';
import { createYouTubeVideo } from './video';

export class YouTubeUrlResolver implements SourceResolver {
  constructor(private readonly url: string,
    private readonly context: CommandContext) {
  }

  async resolve(): Promise<ResolvedResource> {
    const resourceDetails = youtube.getResourceType(this.url);
    if (resourceDetails) {
      if (resourceDetails.video && resourceDetails.playlist) {
        const idx = await this.context.interaction.channel.sendSelection('Do you want this video or the playlist?', ['Video', 'Playlist'], this.context.interaction.user);
        switch (idx) {
          // @ts-ignore
          default:
            await this.context.interaction.channel.send('No selection.. defaulting to video');
          case 0:
            resourceDetails.playlist = undefined;
            break;
          case 1:
            resourceDetails.video = undefined;
            break;
        }
      }

      if (resourceDetails.video) {
        const video = await youtube.getVideo(resourceDetails.video);
        return createYouTubeVideo(video);
      } else if (resourceDetails.playlist) {
        const playlist = await youtube.getPlaylist(resourceDetails.playlist);
        return createYouTubePlaylist(playlist);
      }
    }
    throw new EolianUserError('The YouTube URL provided is not valid!');
  }
}
