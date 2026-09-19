import { TrackSource } from '../api/@types';
import { CommandOptions } from '../command-options/@types';

export const E2E_TEST_SOURCES = ['youtube', 'spotify', 'soundcloud'] as const;
export type E2ETestSource = (typeof E2E_TEST_SOURCES)[number];
export type E2ETestRequestType = 'url' | 'search';

export interface E2ETestPlayRequest {
  source: E2ETestSource;
  requestType: E2ETestRequestType;
  request: string;
}

const TRACK_SOURCES: Record<E2ETestSource, TrackSource> = {
  youtube: TrackSource.YouTube,
  spotify: TrackSource.Spotify,
  soundcloud: TrackSource.SoundCloud,
};

export function isE2ETestPlayRequest(value: unknown): value is E2ETestPlayRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const request = value as Partial<E2ETestPlayRequest>;
  return (
    E2E_TEST_SOURCES.some(source => source === request.source) &&
    (request.requestType === 'url' || request.requestType === 'search') &&
    typeof request.request === 'string' &&
    request.request.trim().length > 0 &&
    request.request.length <= 2000
  );
}

export function createE2ETestCommandOptions(request: E2ETestPlayRequest): CommandOptions {
  const options: CommandOptions = { FAST: true };
  if (request.requestType === 'url') {
    options.URL = {
      source: TRACK_SOURCES[request.source],
      value: request.request.trim(),
    };
  } else {
    options.SEARCH = request.request.trim();
    options[request.source.toUpperCase() as 'YOUTUBE' | 'SPOTIFY' | 'SOUNDCLOUD'] = true;
  }
  return options;
}
