import { logger } from '@eolian/common/logger';
import { FastifyPluginAsync } from 'fastify';
import { AuthPluginOptions } from './@types';
import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_DURATION_MS,
  SESSION_COOKIE,
  SESSION_DURATION_MS,
} from './constants';
import { clearCookie, getCookie, setPrivateCookie } from './cookies';
import { UndiciDiscordOAuthClient } from './discord-oauth-client';
import { sendAuthError } from './guards';
import { callbackSchema, loginSchema, logoutSchema, sessionSchema } from './schemas';
import { createAuthSecurity } from './security';
import { SessionReauthenticationRequiredError } from './session-service';
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
  const security = options.security ?? createAuthSecurity(options.sessions, oauthClient, now);
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
        const token = await oauthClient.exchangeCode(request.query.code);
        const [user, guilds] = await Promise.all([
          oauthClient.getCurrentUser(token.accessToken),
          oauthClient.getCurrentUserGuilds(token.accessToken),
        ]);
        const priorSession = getCookie(request, SESSION_COOKIE);
        if (priorSession) {
          await sessionService.delete(priorSession);
        }
        const session = await sessionService.create(token, user, guilds);
        setPrivateCookie(reply, SESSION_COOKIE, session.id, SESSION_DURATION_MS / 1000);
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
      if (session.renewed) {
        setPrivateCookie(reply, SESSION_COOKIE, session.id, SESSION_DURATION_MS / 1000);
      }
      return {
        authenticated: true as const,
        user: session.record.user,
        guilds: session.record.guilds,
        csrfToken: session.record.csrfToken,
        expiresAt: session.record.expiresAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof SessionReauthenticationRequiredError) {
        return sendAuthError(reply, 401, 'reauthentication_required', error.message);
      }
      return sendAuthError(reply, 502, 'session_refresh_failed', 'Unable to refresh the session.');
    }
  });

  server.post(
    '/logout',
    {
      schema: logoutSchema,
      preHandler: [guards.authenticate, guards.origin, guards.csrf],
    },
    async (request, reply) => {
      await sessionService.delete(request.authSession!.id);
      clearCookie(reply, SESSION_COOKIE);
      return reply.status(204).send();
    },
  );
};
