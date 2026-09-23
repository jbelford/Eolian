import { logger } from '@eolian/common/logger';
import { FastifyPluginAsync } from 'fastify';
import { AuthPluginOptions } from './@types';
import { OAUTH_STATE_COOKIE, OAUTH_STATE_DURATION_MS, SESSION_COOKIE } from './constants';
import { clearCookie, getCookie, setPrivateCookie } from './cookies';
import { UndiciDiscordOAuthClient } from './discord-oauth-client';
import { sendAuthError } from './guards';
import { callbackSchema, loginSchema, logoutSchema, sessionSchema } from './schemas';
import { createAuthSecurity } from './security';
import { createOAuthState, readOAuthState, safeReturnPath } from './state';

interface LoginQuery {
  returnTo?: string;
}

interface CallbackQuery {
  state?: string;
  code?: string;
  error?: string;
}

export const registerDiscordAuthRoutes: FastifyPluginAsync<AuthPluginOptions> = async (
  server,
  options,
) => {
  const now = options.now ?? (() => new Date());
  const oauthClient = options.oauthClient ?? new UndiciDiscordOAuthClient();
  const security = options.security ?? createAuthSecurity(server, oauthClient, now);
  const { guards, sessionService } = security;

  if (!server.hasRequestDecorator('authSession')) {
    server.decorateRequest('authSession');
  }

  server.get<{ Querystring: LoginQuery }>(
    '/discord',
    { schema: loginSchema },
    async (request, reply) => {
      const returnTo = safeReturnPath(request.query.returnTo);
      if (returnTo === null) {
        return sendAuthError(reply, 400, 'invalid_return_path', 'The return path is invalid.');
      }
      const state = createOAuthState(returnTo, now());
      setPrivateCookie(
        reply,
        OAUTH_STATE_COOKIE,
        state.cookie,
        OAUTH_STATE_DURATION_MS / 1000,
        '/api/auth',
      );
      return reply.redirect(oauthClient.authorizationUrl(state.nonce));
    },
  );

  server.get<{ Querystring: CallbackQuery }>(
    '/discord/callback',
    { schema: callbackSchema },
    async (request, reply) => {
      const state = readOAuthState(
        getCookie(request, OAUTH_STATE_COOKIE),
        request.query.state,
        now(),
      );
      clearCookie(reply, OAUTH_STATE_COOKIE, '/api/auth');
      if (!state) {
        return sendAuthError(reply, 400, 'invalid_oauth_state', 'The OAuth state is invalid.');
      }
      if (request.query.error) {
        return sendAuthError(reply, 400, 'oauth_denied', 'Discord authorization was denied.');
      }
      if (!request.query.code) {
        return sendAuthError(
          reply,
          400,
          'missing_oauth_code',
          'The OAuth authorization code is missing.',
        );
      }

      try {
        const issuedAt = now();
        const token = await oauthClient.exchangeCode(request.query.code);
        const user = await oauthClient.getCurrentUser(token.accessToken);
        const session = sessionService.create(token, user, issuedAt);
        const remainingSeconds = Math.floor((session.expiresAt.getTime() - now().getTime()) / 1000);
        if (remainingSeconds <= 0) {
          throw new Error('Discord login took longer than the session lifetime');
        }
        setPrivateCookie(reply, SESSION_COOKIE, session.cookie, remainingSeconds);
        return reply.redirect(state.returnTo);
      } catch {
        logger.warn('Discord OAuth callback failed');
        return sendAuthError(reply, 502, 'discord_oauth_failed', 'Discord authentication failed.');
      }
    },
  );

  server.get('/session', { schema: sessionSchema }, async (request, reply) => {
    const rawId = getCookie(request, SESSION_COOKIE);
    if (!rawId) {
      return { authenticated: false as const };
    }
    try {
      const session = await sessionService.resolve(rawId);
      if (!session) {
        clearCookie(reply, SESSION_COOKIE);
        return { authenticated: false as const };
      }
      return {
        authenticated: true as const,
        user: session.record.user,
        guilds: session.record.guilds,
        csrfToken: session.record.csrfToken,
        expiresAt: session.record.expiresAt.toISOString(),
      };
    } catch {
      return sendAuthError(reply, 502, 'session_refresh_failed', 'Unable to refresh the session.');
    }
  });

  server.post(
    '/logout',
    {
      schema: logoutSchema,
      preHandler: [guards.authenticateForLogout, guards.origin, guards.csrf],
    },
    async (request, reply) => {
      clearCookie(reply, SESSION_COOKIE);
      return reply.status(204).send();
    },
  );
};
