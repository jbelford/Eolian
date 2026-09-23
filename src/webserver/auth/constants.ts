export const SESSION_COOKIE = 'eolian_session';
export const OAUTH_STATE_COOKIE = 'eolian_oauth_state';
export const CSRF_HEADER = 'x-csrf-token';

// @fastify/secure-session's default embedded expiry in version 8.4.0.
export const SESSION_DURATION_SECONDS = 86401;
export const OAUTH_STATE_DURATION_MS = 10 * 60 * 1000;
