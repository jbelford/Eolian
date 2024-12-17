import { httpRequest } from '@eolian/http';
import { StreamSource, Track, TrackSource } from '../@types';
import { IPoetryApi, Poem, PoetryTrack, SearchOptions } from './@types';
import { logger } from '@eolian/common/logger';
import { Readable } from 'stream';
import { speechService } from '../speech';

const POETRY_API = 'https://poetrydb.org';

class PoetryClient implements IPoetryApi {
  async getPoem(id: string): Promise<Poem | undefined> {
    const result = await this.get<Poem[]>('title,author,poemcount', [id, '1']);
    return result.length ? result[0] : undefined;
  }

  searchPoems(title?: string, author?: string, options: SearchOptions = {}): Promise<Poem[]> {
    if (!title?.length && !author?.length && !options.random) {
      throw new Error('Must provide title or author to search for poems');
    }

    const limit = options.limit || 5;
    const searchTerms = [limit.toString()];

    let fields = options.random ? 'random' : 'poemcount';
    if (title?.length) {
      fields += ',title';
      searchTerms.push(title);
    }
    if (author?.length) {
      fields += ',author';
      searchTerms.push(author);
    }

    return this.get<Poem[]>(fields, searchTerms);
  }

  getStream(track: Track): Promise<StreamSource | undefined> {
    if (track.src !== TrackSource.Poetry) {
      throw new Error(
        `Tried to get poetry readable from non-youtube resource: ${JSON.stringify(track)}`,
      );
    }

    return Promise.resolve(new PoetryStreamSource(track as PoetryTrack));
  }

  getPoemUrl(poem: Poem): string {
    const encodedTitle = encodeURIComponent(poem.title);
    const encodedAuthor = encodeURIComponent(poem.author);
    return `${POETRY_API}/title,author,poemcount/${encodedTitle};${encodedAuthor};1`;
  }

  private async get<T>(inputField: string, searchTerm: string[]): Promise<T> {
    const uri = `${POETRY_API}/${inputField}/${searchTerm.join(';')}`;

    logger.info(`PoetryDB HTTP: %s`, uri);

    return await httpRequest<T>(uri, {
      json: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

class PoetryStreamSource implements StreamSource {
  constructor(private readonly track: PoetryTrack) {}

  async get(): Promise<Readable> {
    logger.info('Getting poetry stream %s - %s', this.track.id);

    const text = `Hey folks, Eolian here using my new AI generated voice to bring you a narration of "${this.track.title}" by ${this.track.poster}. Let's begin...\n\n${this.track.lines.join('\n')}...`;
    return speechService.textToSpeech(text);
  }
}

export function mapPoemToTrack(poem: Poem): PoetryTrack {
  return {
    title: poem.title,
    poster: poem.author,
    src: TrackSource.Poetry,
    url: poetry.getPoemUrl(poem),
    lines: poem.lines,
    ai: true,
  };
}

export const poetry = new PoetryClient();
