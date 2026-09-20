import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackSource } from '@eolian/api/@types';
import { UserPermission } from '@eolian/common/constants';
import { ResourceType } from '@eolian/data/@types';
import { makeContext, makePoem, selectionMessage } from './resolver-test-utils';

const api = vi.hoisted(() => ({
  poetry: {
    searchPoems: vi.fn(),
    getPoem: vi.fn(),
    getPoemUrl: vi.fn(),
  },
  mapPoemToTrack: vi.fn(),
}));

vi.mock('@eolian/api', () => api);

import { AiResolver } from '@eolian/resolvers/ai';
import {
  createPoemResource,
  PoetryFetcher,
  PoetryResolver,
} from '@eolian/resolvers/poetry/poetry-resolver';
import { getPoetrySourceFetcher } from '@eolian/resolvers/poetry';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('AiResolver', () => {
  it('requires a search prompt and respects guild restrictions', async () => {
    await expect(new AiResolver(makeContext(), {}).resolve()).rejects.toThrow(
      'You must provide a SEARCH query!',
    );
    await expect(
      new AiResolver(makeContext({ allowedYouTube: false }), { SEARCH: 'story' }).resolve(),
    ).rejects.toThrow('AI is not allowed on this server.');
  });

  it('creates a deterministic AI track and forwards voice and cost preference', async () => {
    const resource = await new AiResolver(makeContext(), {
      SEARCH: 'bedtime story',
      VOICE: 3,
    }).resolve();

    expect(resource).toMatchObject({
      name: 'bedtime story',
      authors: ['Listener'],
      identifier: {
        id: 'bedtime story',
        src: TrackSource.AI,
        type: ResourceType.Song,
      },
    });
    await expect(resource.fetcher.fetch()).resolves.toEqual({
      tracks: [
        expect.objectContaining({
          title: 'bedtime story',
          poster: 'Listener',
          src: TrackSource.AI,
          voice: 2,
          preferLowCost: true,
          ai: true,
        }),
      ],
      rangeOptimized: true,
    });
  });

  it('does not prefer low cost for owners and preserves an unset voice', async () => {
    const resource = await new AiResolver(makeContext({ permission: UserPermission.Owner }), {
      SEARCH: 'owner prompt',
    }).resolve();
    const result = await resource.fetcher.fetch();

    expect(result.tracks[0]).toMatchObject({ preferLowCost: false, voice: undefined });
  });
});

describe('PoetryResolver', () => {
  beforeEach(() => {
    api.poetry.getPoemUrl.mockImplementation(poem => `https://poetry.test/${poem.title}`);
    api.mapPoemToTrack.mockImplementation(poem => ({ title: poem.title, mapped: true }));
  });

  it('validates search input and guild access', async () => {
    await expect(new PoetryResolver(makeContext(), {}).resolve()).rejects.toThrow(
      'RANDOM keyword or SEARCH query',
    );
    await expect(new PoetryResolver(makeContext(), { SEARCH: '|' }).resolve()).rejects.toThrow(
      'Must provide a title or author',
    );
    await expect(
      new PoetryResolver(makeContext({ allowedYouTube: false }), { RANDOM: true }).resolve(),
    ).rejects.toThrow('Poetry is not allowed on this server.');
  });

  it('forwards title, author, random and fast search options', async () => {
    const poem = makePoem();
    api.poetry.searchPoems.mockResolvedValue([poem]);

    const resource = await new PoetryResolver(makeContext(), {
      SEARCH: 'The Test Poem|Test Poet',
      RANDOM: true,
      FAST: true,
    }).resolve();

    expect(api.poetry.searchPoems).toHaveBeenCalledWith('The Test Poem', 'Test Poet', {
      limit: 1,
      random: true,
    });
    expect(resource.identifier).toEqual({
      id: 'The Test Poem;Test Poet',
      src: TrackSource.Poetry,
      type: ResourceType.Song,
      url: 'https://poetry.test/The Test Poem',
    });
  });

  it('supports a random poem without a search string', async () => {
    api.poetry.searchPoems.mockResolvedValue([makePoem()]);
    await new PoetryResolver(makeContext(), { RANDOM: true }).resolve();
    expect(api.poetry.searchPoems).toHaveBeenCalledWith(undefined, undefined, {
      limit: 5,
      random: true,
    });
  });

  it('reports empty results', async () => {
    api.poetry.searchPoems.mockResolvedValue([]);
    await expect(
      new PoetryResolver(makeContext(), { SEARCH: 'missing' }).resolve(),
    ).rejects.toThrow('No poems were found.');
  });

  it('presents results, returns the selected poem, and retains the selection message', async () => {
    const poems = [makePoem(), makePoem({ title: 'Chosen', author: 'Other', linecount: 9 })];
    api.poetry.searchPoems.mockResolvedValue(poems);
    const context = makeContext({ selected: 1 });

    const resource = await new PoetryResolver(context, { SEARCH: 'poem' }).resolve();

    expect(context.interaction.sendSelection).toHaveBeenCalledWith(
      'Choose a poem',
      [
        {
          name: 'The Test Poem (2 lines)',
          subname: 'Test Poet',
          url: 'https://poetry.test/The Test Poem',
        },
        { name: 'Chosen (9 lines)', subname: 'Other', url: 'https://poetry.test/Chosen' },
      ],
      context.interaction.user,
    );
    expect(resource.name).toBe('Chosen');
    expect(resource.selectionMessage).toBe(selectionMessage);
  });

  it('propagates selection cancellation without creating a resource', async () => {
    api.poetry.searchPoems.mockResolvedValue([makePoem(), makePoem({ title: 'Second' })]);
    const context = makeContext();
    context.interaction.sendSelection.mockRejectedValue(new Error('selection cancelled'));

    await expect(new PoetryResolver(context, { SEARCH: 'poem' }).resolve()).rejects.toThrow(
      'selection cancelled',
    );
  });

  it('fetches from an embedded poem or reloads one by identifier', async () => {
    const poem = makePoem();
    const embedded = createPoemResource(poem);
    await expect(embedded.fetcher.fetch()).resolves.toEqual({
      tracks: [{ title: poem.title, mapped: true }],
      rangeOptimized: true,
    });
    expect(api.poetry.getPoem).not.toHaveBeenCalled();

    api.poetry.getPoem.mockResolvedValue(poem);
    await expect(new PoetryFetcher('title;author').fetch()).resolves.toEqual({
      tracks: [{ title: poem.title, mapped: true }],
      rangeOptimized: true,
    });
    expect(api.poetry.getPoem).toHaveBeenCalledWith('title;author');
  });

  it('reports missing poem details and rejects invalid fetcher resource types', async () => {
    api.poetry.getPoem.mockResolvedValue(undefined);
    await expect(new PoetryFetcher('missing').fetch()).rejects.toThrow(
      'I could not find details about this poem!',
    );
    expect(() =>
      getPoetrySourceFetcher({
        id: 'bad',
        src: TrackSource.Poetry,
        type: ResourceType.Playlist,
        url: 'url',
      }),
    ).toThrow('Invalid type for Poetry fetcher');
  });
});
