import { youtube } from '@eolian/api';
import { CommandOptions, CommandContext } from '@eolian/commands/@types';
import { EolianUserError } from '@eolian/common/errors';
import { ContextMessage } from '@eolian/framework/@types';
import { SourceResolver, ResolvedResource } from '../@types';
import { createYouTubePlaylist } from './playlist';
import { createYouTubeVideo } from './video';

const MY_MIX_PLAYLIST_ID = 'RDMM';
const LIKED_MUSIC_ID = 'LM';

export class YouTubeUrlResolver implements SourceResolver {

  constructor(
    private readonly url: string,
    private readonly params: CommandOptions,
    private readonly context: CommandContext
  ) {}

  async resolve(): Promise<ResolvedResource> {
    const resourceDetails = youtube.getResourceType(this.url);
    if (resourceDetails) {
      let message: ContextMessage | undefined;
      if (resourceDetails.video && resourceDetails.playlist) {
        const result = await this.context.interaction.sendSelection(
          'Do you want this video or the playlist?',
          ['Video', 'Playlist'],
          this.context.interaction.user
        );
        if (result.selected === 0) {
          resourceDetails.playlist = undefined;
        } else {
          resourceDetails.video = undefined;
        }
        message = result.message;
      }

      if (resourceDetails.video) {
        const video = await youtube.getVideo(resourceDetails.video);
        if (!video) {
          throw new EolianUserError('I could not find details about this video!');
        }
        return createYouTubeVideo(video, message);
      } else if (resourceDetails.playlist) {
        if (resourceDetails.playlist.startsWith(MY_MIX_PLAYLIST_ID)) {
          throw new EolianUserError(`Sorry, but I can't add 'My Mix' playlists 😕`, message);
        } else if (resourceDetails.playlist === LIKED_MUSIC_ID) {
          throw new EolianUserError(`Sorry, but I can't add 'Your Likes' playlists 😕`, message);
        }

        const playlist = await youtube.getPlaylist(resourceDetails.playlist);
        if (!playlist) {
          throw new EolianUserError('I could not find details about this playlist!');
        }
        return createYouTubePlaylist(
          playlist,
          this.params,
          this.context.interaction.channel,
          message
        );
      }
    }
    throw new EolianUserError('The YouTube URL provided is not valid!');
  }

}
