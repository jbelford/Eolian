import {
  DiscordSessionGuild,
  DiscordSessionUser,
  SessionDTO,
  SessionsDb,
} from '@eolian/data/@types';
import { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';

export interface DiscordTokenResponse {
  accessToken: string;
  refreshToken: string;
  scope: string;
  expiresIn: number;
}

export interface AuthSecurity {
  sessionService: AuthSessionService;
  guards: AuthGuards;
}

export interface DiscordOAuthClient {
  authorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<DiscordTokenResponse>;
  refreshToken(refreshToken: string): Promise<DiscordTokenResponse>;
  getCurrentUser(accessToken: string): Promise<DiscordSessionUser>;
  getCurrentUserGuilds(accessToken: string): Promise<DiscordSessionGuild[]>;
}

export interface AuthSession {
  id: string;
  record: SessionDTO;
  renewed: boolean;
}

export interface AuthSessionService {
  create(
    token: DiscordTokenResponse,
    user: DiscordSessionUser,
    guilds: DiscordSessionGuild[],
  ): Promise<AuthSession>;
  delete(rawId: string): Promise<boolean>;
  resolve(rawId: string): Promise<AuthSession | null>;
  resolveForLogout(rawId: string): Promise<AuthSession | null>;
}

export interface AuthPluginOptions {
  sessions: SessionsDb;
  oauthClient?: DiscordOAuthClient;
  now?: () => Date;
  security?: AuthSecurity;
}

export interface AuthenticatedRequest extends FastifyRequest {
  authSession: AuthSession;
}

export interface AuthGuards {
  authenticate: preHandlerHookHandler;
  authenticateForLogout: preHandlerHookHandler;
  csrf: preHandlerHookHandler;
  origin: preHandlerHookHandler;
}

export type AuthErrorSender = (
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
) => FastifyReply;

declare module 'fastify' {
  interface FastifyRequest {
    authSession?: AuthSession;
  }
}
