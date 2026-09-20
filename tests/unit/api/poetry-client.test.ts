import { describe, expect, it, vi } from 'vitest';
import { TrackSource } from '@eolian/api/@types';

const { httpRequest, textToSpeech } = vi.hoisted(() => ({
  httpRequest: vi.fn(),
  textToSpeech: vi.fn(),
}));
vi.mock('@eolian/http', () => ({ httpRequest }));
vi.mock('@eolian/api/speech', () => ({ speechService: { textToSpeech } }));

import { mapPoemToTrack, poetry } from '@eolian/api/poetry/poetry-client';

describe('PoetryClient', () => {
  it('encodes poem lookup URLs and maps poems to tracks', () => {
    const poem = { title: 'A/B', author: 'Ada Lovelace', lines: ['one', 'two'], linecount: 2 };
    expect(mapPoemToTrack(poem)).toEqual({
      id: 'A/B;Ada Lovelace',
      title: 'A/B',
      poster: 'Ada Lovelace',
      src: TrackSource.Poetry,
      url: 'https://poetrydb.org/title,author,poemcount/A%2FB;Ada%20Lovelace;1',
      lines: ['one', 'two'],
      ai: true,
    });
  });

  it('builds searches, filters oversized poems, and honors limits', async () => {
    httpRequest.mockResolvedValue([
      { title: 'Too long', author: 'A', lines: ['x'.repeat(3897)] },
      { title: 'First', author: 'A', lines: ['short'] },
      { title: 'Second', author: 'A', lines: ['short'] },
    ]);
    await expect(poetry.searchPoems('title/value', 'author', { limit: 1 })).resolves.toMatchObject([
      { title: 'First' },
    ]);
    expect(httpRequest).toHaveBeenCalledWith(
      'https://poetrydb.org/poemcount,title,author/25;title/value;author',
      expect.objectContaining({ json: true }),
    );
  });

  it('requires a search term unless random selection is requested', async () => {
    await expect(poetry.searchPoems()).rejects.toThrow('Must provide title or author');
  });

  it('delegates poem narration to the speech service', async () => {
    textToSpeech.mockResolvedValue('stream');
    const source = await poetry.getStream({
      id: 'Poem;Author',
      title: 'Poem',
      poster: 'Author',
      src: TrackSource.Poetry,
      url: 'url',
      lines: ['line one', 'line two'],
      ai: true,
    } as never);
    await expect(source!.get()).resolves.toBe('stream');
    expect(textToSpeech).toHaveBeenCalledWith(expect.stringContaining('line one\nline two'));
  });
});
