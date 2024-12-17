import { TrackSource } from '@eolian/api/@types';
import { FetchResult, ResolvedResource, SourceFetcher, SourceResolver } from '../@types';
import { CommandOptions } from '@eolian/command-options/@types';
import { EolianUserError } from '@eolian/common/errors';
import { mapPoemToTrack, poetry } from '@eolian/api';
import { Poem } from '@eolian/api/poetry/@types';
import { ResourceType } from '@eolian/data/@types';
import { CommandContext } from '@eolian/commands/@types';
import { ContextMessage } from '@eolian/framework/@types';

export class PoetryResolver implements SourceResolver {
  public source = TrackSource.Poetry;

  constructor(
    private readonly context: CommandContext,
    private readonly params: CommandOptions,
  ) {}

  async resolve(): Promise<ResolvedResource> {
    if (!this.params.SEARCH && !this.params.RANDOM) {
      throw new EolianUserError('You must provide RANDOM keyword or SEARCH query!');
    }

    if (this.context.server && !this.context.server?.details.isAllowedYouTube) {
      throw new EolianUserError('Poetry is not allowed on this server.');
    }

    const [title, author] = this.params.SEARCH?.split('|') || [];

    if (!title?.length && !author?.length && !this.params.RANDOM) {
      throw new EolianUserError(
        'Must provide a title or author to search for a poem or use the random keyword.',
      );
    }

    const resourceDetails = await poetry.searchPoems(title, author, {
      limit: this.params.FAST ? 1 : 5,
      random: this.params.RANDOM,
    });
    if (resourceDetails.length === 0) {
      throw new EolianUserError('No poems were found.');
    }

    if (resourceDetails.length > 1) {
      const result = await this.context.interaction.sendSelection(
        'Choose a poem',
        resourceDetails.map(poem => ({
          name: `${poem.title} (${poem.linecount} lines)`,
          subname: poem.author,
          url: poetry.getPoemUrl(poem),
        })),
        this.context.interaction.user,
      );

      return createPoemResource(resourceDetails[result.selected], result.message);
    }

    return createPoemResource(resourceDetails[0]);
  }
}

export function createPoemResource(poem: Poem, message?: ContextMessage): ResolvedResource {
  const id = `${poem.title};${poem.author}`;
  return {
    name: poem.title,
    authors: [poem.author],
    identifier: {
      id,
      src: TrackSource.Poetry,
      type: ResourceType.Song,
      url: poetry.getPoemUrl(poem),
    },
    fetcher: new PoetryFetcher(id, poem),
    selectionMessage: message,
  };
}

export class PoetryFetcher implements SourceFetcher {
  constructor(
    private readonly id: string,
    private readonly poem?: Poem,
  ) {}

  async fetch(): Promise<FetchResult> {
    const poem = this.poem ?? (await poetry.getPoem(this.id));
    if (!poem) {
      throw new EolianUserError('I could not find details about this poem!');
    }
    const track = mapPoemToTrack(poem);
    return { tracks: [track], rangeOptimized: true };
  }
}
