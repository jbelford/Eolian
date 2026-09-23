import { environment } from '@eolian/common/env';
import { OAUTH_STATE_DURATION_MS } from './constants';
import { constantTimeEqual, randomToken, signValue, verifyValue } from './crypto';

interface OAuthState {
  nonce: string;
  returnTo: string;
  createdAt: number;
}

export function safeReturnPath(value: string | undefined): string | null {
  if (!value) {
    return '/';
  }
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return null;
  }
  try {
    const parsed = new URL(value, environment.baseUri);
    if (parsed.origin !== new URL(environment.baseUri).origin) {
      return null;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function createOAuthState(
  returnTo: string,
  now: Date,
): {
  nonce: string;
  cookie: string;
} {
  const state: OAuthState = {
    nonce: randomToken(),
    returnTo,
    createdAt: now.getTime(),
  };
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
  return {
    nonce: state.nonce,
    cookie: `${payload}.${signValue(payload, environment.sessionSecret)}`,
  };
}

export function readOAuthState(
  cookie: string | undefined,
  nonce: string | undefined,
  now: Date,
): OAuthState | null {
  if (!cookie || !nonce) {
    return null;
  }
  const separator = cookie.lastIndexOf('.');
  if (separator < 1) {
    return null;
  }
  const payload = cookie.slice(0, separator);
  const signature = cookie.slice(separator + 1);
  if (!verifyValue(payload, signature, environment.sessionSecret)) {
    return null;
  }
  try {
    const state = JSON.parse(Buffer.from(payload, 'base64url').toString()) as OAuthState;
    const returnTo = safeReturnPath(state.returnTo);
    if (
      typeof state.nonce !== 'string' ||
      !constantTimeEqual(state.nonce, nonce) ||
      typeof state.createdAt !== 'number' ||
      now.getTime() - state.createdAt > OAUTH_STATE_DURATION_MS ||
      now.getTime() < state.createdAt ||
      returnTo === null
    ) {
      return null;
    }
    return { ...state, returnTo };
  } catch {
    return null;
  }
}
