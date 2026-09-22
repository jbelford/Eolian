import { SessionsDb } from '@eolian/data/@types';
import { AuthSecurity, DiscordOAuthClient } from './@types';
import { UndiciDiscordOAuthClient } from './discord-oauth-client';
import { createAuthGuards } from './guards';
import { PersistentAuthSessionService } from './session-service';

export function createAuthSecurity(
  sessions: SessionsDb,
  oauthClient: DiscordOAuthClient = new UndiciDiscordOAuthClient(),
  now: () => Date = () => new Date(),
): AuthSecurity {
  const sessionService = new PersistentAuthSessionService(sessions, oauthClient, now);
  return {
    sessionService,
    guards: createAuthGuards(sessionService),
  };
}
