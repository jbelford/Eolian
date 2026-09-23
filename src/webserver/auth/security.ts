import { AuthSecurity, DiscordOAuthClient } from './@types';
import { FastifyInstance } from 'fastify';
import { UndiciDiscordOAuthClient } from './discord-oauth-client';
import { createAuthGuards } from './guards';
import { StatelessAuthSessionService } from './session-service';

export function createAuthSecurity(
  server: FastifyInstance,
  oauthClient: DiscordOAuthClient = new UndiciDiscordOAuthClient(),
  now: () => Date = () => new Date(),
): AuthSecurity {
  const sessionService = new StatelessAuthSessionService(server, oauthClient, now);
  return {
    sessionService,
    guards: createAuthGuards(sessionService),
  };
}
