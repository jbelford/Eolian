export interface AuthUser {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
}

export interface AuthGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export interface UnauthenticatedSession {
  authenticated: false;
}

export interface AuthenticatedSession {
  authenticated: true;
  user: AuthUser;
  guilds: AuthGuild[];
  csrfToken: string;
  expiresAt: string;
}

export type AuthSessionResponse = UnauthenticatedSession | AuthenticatedSession;

export type ApiErrorKind =
  | 'aborted'
  | 'network'
  | 'unauthorized'
  | 'forbidden'
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

const SESSION_ENDPOINT = '/api/auth/session';
const LOGOUT_ENDPOINT = '/api/auth/logout';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNullableString = (value: unknown): value is string | null =>
  typeof value === 'string' || value === null;

const isUser = (value: unknown): value is AuthUser =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.username === 'string' &&
  isNullableString(value.globalName) &&
  isNullableString(value.avatar);

const isGuild = (value: unknown): value is AuthGuild =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  isNullableString(value.icon) &&
  typeof value.owner === 'boolean' &&
  typeof value.permissions === 'string';

const isSessionResponse = (value: unknown): value is AuthSessionResponse => {
  if (!isRecord(value) || typeof value.authenticated !== 'boolean') {
    return false;
  }

  if (!value.authenticated) {
    return true;
  }

  return (
    isUser(value.user) &&
    Array.isArray(value.guilds) &&
    value.guilds.every(isGuild) &&
    typeof value.csrfToken === 'string' &&
    typeof value.expiresAt === 'string' &&
    Number.isFinite(Date.parse(value.expiresAt))
  );
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
      {
        cause: error,
      },
    );
  }
};

const errorFromResponse = async (response: Response) => {
  const payload = await readJson(response);
  const body = isRecord(payload) && isRecord(payload.error) ? payload.error : undefined;
  const message =
    body && typeof body.message === 'string'
      ? body.message
      : `The Eolian API request failed with status ${response.status}.`;
  const code = body && typeof body.code === 'string' ? body.code : undefined;
  const kind =
    response.status === 401 ? 'unauthorized' : response.status === 403 ? 'forbidden' : 'http';

  return new ApiError(message, kind, response.status, code);
};

export const getAuthSession = async (signal?: AbortSignal): Promise<AuthSessionResponse> => {
  const response = await fetchSameOrigin(SESSION_ENDPOINT, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw await errorFromResponse(response);
  }

  const payload = await readJson(response);
  if (!isSessionResponse(payload)) {
    throw new ApiError(
      'The Eolian API returned an invalid session response.',
      'invalid-response',
      response.status,
    );
  }

  return payload;
};

export const logoutSession = async (csrfToken: string, signal?: AbortSignal): Promise<void> => {
  const response = await fetchSameOrigin(LOGOUT_ENDPOINT, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'x-csrf-token': csrfToken,
    },
    signal,
  });

  if (response.status === 204) {
    return;
  }

  throw await errorFromResponse(response);
};

export const safeReturnPath = (candidate: string | null | undefined, fallback = '/app') => {
  if (
    !candidate ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallback;
  }

  return candidate;
};

export const discordLoginUrl = (returnTo: string) =>
  `/api/auth/discord?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`;

export const discordAvatarUrl = (user: AuthUser) =>
  user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=128`
    : undefined;

export const discordGuildIconUrl = (guild: AuthGuild) =>
  guild.icon
    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=96`
    : undefined;
