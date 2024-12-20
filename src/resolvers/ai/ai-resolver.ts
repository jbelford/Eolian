import { TrackSource } from '@eolian/api/@types';
import { ResolvedResource, SourceResolver } from '../@types';
import { CommandOptions } from '@eolian/command-options/@types';
import { CommandContext } from '@eolian/commands/@types';
import { EolianUserError } from '@eolian/common/errors';
import { ResourceType } from '@eolian/data/@types';
import { GITHUB_PAGE_WIKI_AI, UserPermission } from '@eolian/common/constants';
import { AIAudioTrack } from '@eolian/api/speech/@types';

export class AiResolver implements SourceResolver {
  public source = TrackSource.AI;

  constructor(
    private readonly context: CommandContext,
    private readonly params: CommandOptions,
  ) {}

  async resolve(): Promise<ResolvedResource> {
    if (!this.params.SEARCH) {
      throw new EolianUserError('You must provide a SEARCH query!');
    }

    if (this.context.server && !this.context.server?.details.isAllowedYouTube) {
      throw new EolianUserError('AI is not allowed on this server.');
    }

    const name = this.params.SEARCH;
    const poster = this.context.interaction.user.name;
    const url = GITHUB_PAGE_WIKI_AI;

    const track: AIAudioTrack = {
      src: TrackSource.AI,
      title: name,
      poster,
      url,
      preferLowCost: this.context.interaction.user.permission < UserPermission.Owner,
      ai: true,
    };

    return {
      name,
      authors: [poster],
      identifier: {
        id: this.params.SEARCH,
        src: TrackSource.AI,
        type: ResourceType.Song,
        url,
      },
      fetcher: {
        fetch: () =>
          Promise.resolve({
            tracks: [track],
            rangeOptimized: true,
          }),
      },
    };
  }
}
