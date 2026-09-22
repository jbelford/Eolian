import { apiRequest, apiVoidRequest, hasExactKeys, isRecord } from './client';

export { ApiError } from './client';

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

const SESSION_ENDPOINT = '/api/auth/session';
const LOGOUT_ENDPOINT = '/api/auth/logout';

const isNullableString = (value: unknown): value is string | null =>
  typeof value === 'string' || value === null;

const isUser = (value: unknown): value is AuthUser =>
  isRecord(value) &&
  hasExactKeys(value, ['id', 'username', 'globalName', 'avatar']) &&
  typeof value.id === 'string' &&
  typeof value.username === 'string' &&
  isNullableString(value.globalName) &&
  isNullableString(value.avatar);

const isGuild = (value: unknown): value is AuthGuild =>
  isRecord(value) &&
  hasExactKeys(value, ['id', 'name', 'icon', 'owner', 'permissions']) &&
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
    return hasExactKeys(value, ['authenticated']);
  }

  return (
    hasExactKeys(value, ['authenticated', 'user', 'guilds', 'csrfToken', 'expiresAt']) &&
    isUser(value.user) &&
    Array.isArray(value.guilds) &&
    value.guilds.every(isGuild) &&
    typeof value.csrfToken === 'string' &&
    typeof value.expiresAt === 'string' &&
    Number.isFinite(Date.parse(value.expiresAt))
  );
};

export const getAuthSession = (signal?: AbortSignal): Promise<AuthSessionResponse> =>
  apiRequest(SESSION_ENDPOINT, {
    signal,
    validate: isSessionResponse,
    invalidResponseMessage: 'The Eolian API returned an invalid session response.',
  });

export const logoutSession = (csrfToken: string, signal?: AbortSignal): Promise<void> =>
  apiVoidRequest(LOGOUT_ENDPOINT, {
    method: 'POST',
    csrfToken,
    signal,
  });

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
