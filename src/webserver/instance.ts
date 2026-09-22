import { AppDatabase } from '@eolian/data/@types';
import { IAuthServiceProvider } from '@eolian/framework/@types';
import { DiscordManagement } from '@eolian/framework/discord-management';
import fastify, { FastifyInstance } from 'fastify';
import { registerDiscordAuthRoutes } from './auth/routes';
import { createAuthSecurity } from './auth/security';
import { registerSecureSession } from './auth/secure-session';
import { registerWebServerRoutes } from './routes';
import { registerSettingsRoutes } from './settings/routes';

export function createWebServerInstance(
  authProviders: IAuthServiceProvider,
  database: AppDatabase,
  management: DiscordManagement,
): FastifyInstance {
  const server = fastify({ ajv: { customOptions: { removeAdditional: false } } });
  registerSecureSession(server);
  const security = createAuthSecurity(server);
  server.decorateRequest('authSession');
  server.register(registerWebServerRoutes, { authProviders });
  server.register(registerDiscordAuthRoutes, {
    prefix: '/api/auth',
    security,
  });
  server.register(registerSettingsRoutes, {
    authProviders,
    database,
    management,
    security,
  });
  return server;
}
