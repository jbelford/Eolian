export const SESSION_COOKIE = 'eolian_session';
export const OAUTH_STATE_COOKIE = 'eolian_oauth_state';
export const CSRF_HEADER = 'x-csrf-token';

export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_RENEW_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const OAUTH_STATE_DURATION_MS = 10 * 60 * 1000;
export const TOKEN_REFRESH_LEEWAY_MS = 60 * 1000;
export const GUILD_CLAIMS_MAX_AGE_MS = 5 * 60 * 1000;
