import { environment } from '@eolian/common/env';
import { FastifyReply, preHandlerHookHandler } from 'fastify';
import { AuthGuards, AuthSessionService } from './@types';
import { CSRF_HEADER, SESSION_COOKIE } from './constants';
import { getCookie } from './cookies';
import { constantTimeEqual } from './crypto';

export function sendAuthError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
): FastifyReply {
  return reply.status(statusCode).send({ error: { code, message } });
}

export function createAuthGuards(sessionService: AuthSessionService): AuthGuards {
  const authenticate =
    (forLogout: boolean): preHandlerHookHandler =>
    async (request, reply) => {
      const rawId = getCookie(request, SESSION_COOKIE);
      if (!rawId) {
        sendAuthError(reply, 401, 'unauthenticated', 'Authentication is required.');
        return;
      }
      try {
        const session = forLogout
          ? await sessionService.resolveForLogout(rawId)
          : await sessionService.resolve(rawId);
        if (!session) {
          sendAuthError(reply, 401, 'unauthenticated', 'Authentication is required.');
          return;
        }
        request.authSession = session;
      } catch {
        sendAuthError(reply, 502, 'session_refresh_failed', 'Unable to refresh the session.');
      }
    };

  return {
    authenticate: authenticate(false),
    authenticateForLogout: authenticate(true),
    origin: async (request, reply) => {
      const origin = request.headers.origin;
      if (origin !== new URL(environment.baseUri).origin) {
        return sendAuthError(reply, 403, 'invalid_origin', 'The request origin is not allowed.');
      }
    },
    csrf: async (request, reply) => {
      const provided = request.headers[CSRF_HEADER];
      const expected = request.authSession?.record.csrfToken;
      if (typeof provided !== 'string' || !expected || !constantTimeEqual(provided, expected)) {
        return sendAuthError(reply, 403, 'invalid_csrf', 'The CSRF token is invalid.');
      }
    },
  };
}
