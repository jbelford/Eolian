import { environment } from '@eolian/common/env';
import secureSession from '@fastify/secure-session';
import { FastifyInstance } from 'fastify';
import { createHmac } from 'node:crypto';
import { SESSION_COOKIE, SESSION_DURATION_SECONDS } from './constants';

export function registerSecureSession(server: FastifyInstance): void {
  server.register(secureSession, {
    key: createHmac('sha256', environment.sessionSecret).update('eolian-web-session-v1').digest(),
    cookieName: SESSION_COOKIE,
    cookie: {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: environment.prod,
      maxAge: SESSION_DURATION_SECONDS,
    },
  });
}
