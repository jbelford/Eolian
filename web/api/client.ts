export type ApiErrorKind =
  | 'aborted'
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'server'
  | 'http'
  | 'unexpected-content-type'
  | 'invalid-json'
  | 'invalid-response';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: ApiErrorKind,
    readonly status?: number,
    readonly code?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ApiError';
  }
}

export type Validator<T> = (value: unknown) => value is T;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const hasExactKeys = (value: Record<string, unknown>, keys: string[]) => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const sameOriginUrl = (path: string) => {
  const url = new URL(path, window.location.origin);

  if (url.origin !== window.location.origin) {
    throw new ApiError('API requests must use the current origin.', 'invalid-response');
  }

  return url.pathname + url.search;
};

const fetchSameOrigin = async (path: string, init: RequestInit) => {
  try {
    return await fetch(sameOriginUrl(path), {
      ...init,
      credentials: 'same-origin',
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('The request was cancelled.', 'aborted', undefined, undefined, {
        cause: error,
      });
    }
    throw new ApiError('Unable to reach the Eolian API.', 'network', undefined, undefined, {
      cause: error,
    });
  }
};

const readJson = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get('content-type');

  if (!contentType?.toLowerCase().includes('application/json')) {
    throw new ApiError(
      'The Eolian API returned an unexpected content type.',
      'unexpected-content-type',
      response.status,
    );
  }

  try {
    return await response.json();
  } catch (error) {
    throw new ApiError(
      'The Eolian API returned invalid JSON.',
      'invalid-json',
      response.status,
      undefined,
      { cause: error },
    );
  }
};

const statusMessage = (status: number) => {
  switch (status) {
    case 401:
      return 'Your session has expired.';
    case 403:
      return 'You do not have permission to complete this request.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'The request conflicts with the current server state.';
    case 500:
      return 'The server could not complete the request.';
    case 502:
    case 503:
      return 'The Eolian service is temporarily unavailable.';
    default:
      return `The Eolian API request failed with status ${status}.`;
  }
};

const errorKind = (status: number): ApiErrorKind => {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  if (status === 500 || status === 502 || status === 503) return 'server';
  return 'http';
};

const errorFromResponse = async (response: Response) => {
  const payload = await readJson(response);
  const body = isRecord(payload) && isRecord(payload.error) ? payload.error : undefined;
  const message =
    body && typeof body.message === 'string' ? body.message : statusMessage(response.status);
  const code = body && typeof body.code === 'string' ? body.code : undefined;

  return new ApiError(message, errorKind(response.status), response.status, code);
};

interface ApiRequestOptions<T> {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  signal?: AbortSignal;
  csrfToken?: string;
  body?: unknown;
  expectedStatus?: number;
  validate: Validator<T>;
  invalidResponseMessage: string;
}

export const apiRequest = async <T>(
  path: string,
  {
    method = 'GET',
    signal,
    csrfToken,
    body,
    expectedStatus = 200,
    validate,
    invalidResponseMessage,
  }: ApiRequestOptions<T>,
): Promise<T> => {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (csrfToken) headers['x-csrf-token'] = csrfToken;
  if (body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetchSameOrigin(path, {
    method,
    headers,
    signal,
    ...(body === undefined ? undefined : { body: JSON.stringify(body) }),
  });

  if (response.status !== expectedStatus) {
    throw await errorFromResponse(response);
  }

  const payload = await readJson(response);
  if (!validate(payload)) {
    throw new ApiError(invalidResponseMessage, 'invalid-response', response.status);
  }

  return payload;
};

interface ApiVoidRequestOptions {
  method: 'POST' | 'DELETE';
  signal?: AbortSignal;
  csrfToken: string;
  expectedStatus?: number;
}

export const apiVoidRequest = async (
  path: string,
  { method, signal, csrfToken, expectedStatus = 204 }: ApiVoidRequestOptions,
): Promise<void> => {
  const response = await fetchSameOrigin(path, {
    method,
    headers: {
      accept: 'application/json',
      'x-csrf-token': csrfToken,
    },
    signal,
  });

  if (response.status !== expectedStatus) {
    throw await errorFromResponse(response);
  }
};
