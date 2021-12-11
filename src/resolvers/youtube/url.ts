import { youtube } from 'api';
import { CommandContext } from 'commands/@types';
import { EolianUserError } from 'common/errors';
import { ContextMessage } from 'framework/@types';
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
      let message: ContextMessage | undefined;
      if (resourceDetails.video && resourceDetails.playlist) {
        const result = await this.context.interaction.sendSelection('Do you want this video or the playlist?', ['Video', 'Playlist'], this.context.interaction.user);
        if (result.selected === 0) {
          resourceDetails.playlist = undefined;
        } else {
          resourceDetails.video = undefined;
        }
        message = result.message;
      }

      if (resourceDetails.video) {
        const video = await youtube.getVideo(resourceDetails.video);
        return createYouTubeVideo(video, message);
      } else if (resourceDetails.playlist) {
        const playlist = await youtube.getPlaylist(resourceDetails.playlist);
        return createYouTubePlaylist(playlist, message);
      }
    }
    throw new EolianUserError('The YouTube URL provided is not valid!');
  }
}
