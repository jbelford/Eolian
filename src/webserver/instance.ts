import { AppDatabase } from '@eolian/data/@types';
import { IAuthServiceProvider } from '@eolian/framework/@types';
import fastify, { FastifyInstance } from 'fastify';
import { registerDiscordAuthRoutes } from './auth/routes';
import { createAuthSecurity } from './auth/security';
import { registerSecureSession } from './auth/secure-session';
import { registerWebServerRoutes } from './routes';

export function createWebServerInstance(
  authProviders: IAuthServiceProvider,
  database: AppDatabase,
): FastifyInstance {
  const server = fastify();
  registerSecureSession(server);
  const security = createAuthSecurity(server);
  server.decorateRequest('authSession');
  server.register(registerWebServerRoutes, { authProviders });
  server.register(registerDiscordAuthRoutes, {
    prefix: '/api/auth',
    security,
  });
  return server;
}
