import { AppDatabase } from '@eolian/data/@types';
import { IAuthServiceProvider } from '@eolian/framework/@types';
import fastify, { FastifyInstance } from 'fastify';
import { registerDiscordAuthRoutes } from './auth/routes';
import { createAuthSecurity } from './auth/security';
import { registerWebServerRoutes } from './routes';

export function createWebServerInstance(
  authProviders: IAuthServiceProvider,
  database: AppDatabase,
): FastifyInstance {
  const server = fastify();
  const security = createAuthSecurity(database.sessions);
  server.decorateRequest('authSession');
  server.register(registerWebServerRoutes, { authProviders });
  server.register(registerDiscordAuthRoutes, {
    prefix: '/api/auth',
    sessions: database.sessions,
    security,
  });
  return server;
}
