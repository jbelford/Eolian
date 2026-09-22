import { TrackSource } from '@eolian/api/@types';
import { logger } from '@eolian/common/logger';
import { parseSyntaxName, syntaxName } from '@eolian/common/settings';
import { feature } from '@eolian/data';
import { DiscordSessionGuild, ServerSettingsUpdate, UserDTO } from '@eolian/data/@types';
import {
  DiscordManagementError,
  ManagedGuild,
  invalidateDiscordUserCache,
} from '@eolian/framework';
import { PermissionFlagsBits } from 'discord.js';
import { FastifyError, FastifyPluginAsync, FastifyReply } from 'fastify';
import { sendAuthError } from '../auth/guards';
import {
  AccountSettingsDTO,
  GuildSettingsDTO,
  ProviderName,
  SettingsPluginOptions,
} from './@types';
import {
  getAccountSchema,
  getGuildSchema,
  linkProviderSchema,
  listGuildsSchema,
  unlinkProviderSchema,
  updateAccountSyntaxSchema,
  updateGuildSchema,
} from './schemas';
import { FeatureFlag } from '@eolian/data/@types';

interface ProviderParams {
  provider: ProviderName;
}

interface GuildParams {
  guildId: string;
}

interface AccountSyntaxBody {
  syntax: 'keyword' | 'traditional' | null;
}

interface GuildUpdateBody {
  prefix?: string;
  volume?: number;
  syntax?: 'keyword' | 'traditional';
  preferredChannelId?: string | null;
  djRoleIds?: string[];
  djAllowLimited?: boolean;
}

export const registerSettingsRoutes: FastifyPluginAsync<SettingsPluginOptions> = async (
  server,
  { authProviders, database, management, security },
) => {
  const { guards } = security;
  const readGuards = [guards.authenticate];
  const mutationGuards = [guards.authenticate, guards.origin, guards.csrf];

  server.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error.validation) {
      sendAuthError(reply, 400, 'invalid_request', 'The request is invalid.');
      return;
    }
    logger.warn('Settings API request failed: %s', error);
    sendAuthError(reply, 500, 'internal_error', 'The request could not be completed.');
  });

  async function accountSettings(userId: string): Promise<AccountSettingsDTO> {
    const user = (await database.users.get(userId)) ?? { _id: userId };
    return {
      syntax: user.syntax === undefined ? null : syntaxName(user.syntax),
      providers: {
        spotify: providerStatus(user, 'spotify'),
        soundcloud: providerStatus(user, 'soundcloud'),
      },
    };
  }

  function providerStatus(
    user: UserDTO,
    provider: ProviderName,
  ): { linked: boolean; linkAvailable: boolean } {
    const source = providerSource(provider);
    const flag = provider === 'spotify' ? FeatureFlag.SPOTIFY_AUTH : FeatureFlag.SOUNDCLOUD_AUTH;
    return {
      linked:
        provider === 'spotify'
          ? Boolean(user.spotify || user.tokens?.spotify)
          : Boolean(user.soundcloud || user.tokens?.soundcloud),
      linkAvailable: feature.enabled(flag) && source !== undefined,
    };
  }

  server.get('/api/account', { schema: getAccountSchema, preHandler: readGuards }, async request =>
    accountSettings(request.authSession!.record.user.id),
  );

  server.patch<{ Body: AccountSyntaxBody }>(
    '/api/account/syntax',
    { schema: updateAccountSyntaxSchema, preHandler: mutationGuards },
    async (request, reply) => {
      const userId = request.authSession!.record.user.id;
      try {
        if (request.body.syntax === null) {
          await database.users.removeSyntax(userId);
        } else {
          await database.users.setSyntax(userId, parseSyntaxName(request.body.syntax));
        }
        invalidateDiscordUserCache(userId);
        return accountSettings(userId);
      } catch (error) {
        return persistenceError(reply, error);
      }
    },
  );

  server.post<{ Params: ProviderParams }>(
    '/api/account/providers/:provider/link',
    { schema: linkProviderSchema, preHandler: mutationGuards },
    async (request, reply) => {
      const { provider } = request.params;
      const flag = provider === 'spotify' ? FeatureFlag.SPOTIFY_AUTH : FeatureFlag.SOUNDCLOUD_AUTH;
      if (!feature.enabled(flag)) {
        return sendAuthError(
          reply,
          409,
          'provider_link_unavailable',
          'Provider linking is not available.',
        );
      }

      const userId = request.authSession!.record.user.id;
      try {
        const result = authProviders.getService(providerSource(provider)).authorize(async token => {
          if (provider === 'spotify') {
            await database.users.setSpotifyRefreshToken(userId, token.refresh_token);
          } else {
            await database.users.setSoundCloudRefreshToken(userId, token.refresh_token);
          }
          invalidateDiscordUserCache(userId);
        });
        void result.response.catch(error => {
          logger.warn('[%s] Web %s authorization failed: %s', userId, provider, error);
        });
        return reply.status(201).send({ authorizationUrl: result.link });
      } catch (error) {
        logger.warn('[%s] Failed to start %s authorization: %s', userId, provider, error);
        return sendAuthError(
          reply,
          500,
          'provider_link_failed',
          'Provider linking could not be started.',
        );
      }
    },
  );

  server.delete<{ Params: ProviderParams }>(
    '/api/account/providers/:provider',
    { schema: unlinkProviderSchema, preHandler: mutationGuards },
    async (request, reply) => {
      const { provider } = request.params;
      const source = providerSource(provider);
      const userId = request.authSession!.record.user.id;
      try {
        await authProviders.removeUserRequest(userId, source);
        if (provider === 'spotify') {
          await Promise.all([
            database.users.removeSpotify(userId),
            database.users.removeSpotifyRefreshToken(userId),
          ]);
        } else {
          await Promise.all([
            database.users.removeSoundCloud(userId),
            database.users.removeSoundCloudRefreshToken(userId),
          ]);
        }
        invalidateDiscordUserCache(userId);
        return reply.status(204).send();
      } catch (error) {
        return persistenceError(reply, error);
      }
    },
  );

  server.get(
    '/api/guilds',
    { schema: listGuildsSchema, preHandler: readGuards },
    async (request, reply) => {
      try {
        const claims = new Set(
          request.authSession!.record.guilds.filter(hasManagePermission).map(guild => guild.id),
        );
        return { guilds: management.listGuilds().filter(guild => claims.has(guild.id)) };
      } catch (error) {
        return managementError(reply, error, 'guild_list_failed');
      }
    },
  );

  server.get<{ Params: GuildParams }>(
    '/api/guilds/:guildId',
    { schema: getGuildSchema, preHandler: readGuards },
    async (request, reply) => {
      if (!authorizedGuild(request.authSession!.record.guilds, request.params.guildId)) {
        return sendAuthError(reply, 403, 'guild_forbidden', 'Guild management is not allowed.');
      }
      try {
        return guildDto(await management.getGuild(request.params.guildId));
      } catch (error) {
        return managementError(reply, error, 'guild_load_failed');
      }
    },
  );

  server.patch<{ Params: GuildParams; Body: GuildUpdateBody }>(
    '/api/guilds/:guildId',
    { schema: updateGuildSchema, preHandler: mutationGuards },
    async (request, reply) => {
      if (!authorizedGuild(request.authSession!.record.guilds, request.params.guildId)) {
        return sendAuthError(reply, 403, 'guild_forbidden', 'Guild management is not allowed.');
      }
      const settings: ServerSettingsUpdate = {
        ...request.body,
        syntax:
          request.body.syntax === undefined ? undefined : parseSyntaxName(request.body.syntax),
      };
      try {
        return guildDto(await management.updateGuild(request.params.guildId, settings));
      } catch (error) {
        return managementError(reply, error, 'settings_update_failed');
      }
    },
  );
};

function providerSource(provider: ProviderName): TrackSource {
  return provider === 'spotify' ? TrackSource.Spotify : TrackSource.SoundCloud;
}

function hasManagePermission(guild: DiscordSessionGuild): boolean {
  const permissions = BigInt(guild.permissions);
  return (
    guild.owner ||
    (permissions & PermissionFlagsBits.Administrator) !== 0n ||
    (permissions & PermissionFlagsBits.ManageGuild) !== 0n
  );
}

function authorizedGuild(guilds: DiscordSessionGuild[], guildId: string): boolean {
  const guild = guilds.find(candidate => candidate.id === guildId);
  return Boolean(guild && hasManagePermission(guild));
}

function guildDto(guild: ManagedGuild) {
  return {
    ...guild,
    settings: {
      ...guild.settings,
      syntax: syntaxName(guild.settings.syntax),
    } satisfies GuildSettingsDTO,
  };
}

function persistenceError(reply: FastifyReply, error: unknown): FastifyReply {
  logger.warn('Settings persistence failed: %s', error);
  return sendAuthError(reply, 500, 'persistence_failed', 'Settings could not be saved.');
}

function managementError(reply: FastifyReply, error: unknown, fallbackCode: string): FastifyReply {
  if (error instanceof DiscordManagementError) {
    switch (error.code) {
      case 'bot_not_ready':
        return sendAuthError(reply, 503, error.code, 'The bot is not ready.');
      case 'bot_not_in_guild':
        return sendAuthError(reply, 404, error.code, 'The bot is not in this guild.');
      case 'channel_not_found':
        return sendAuthError(reply, 409, error.code, 'The selected channel is unavailable.');
      case 'role_not_found':
        return sendAuthError(reply, 409, error.code, 'A selected role is unavailable.');
    }
  }
  logger.warn('Settings management failed: %s', error);
  return sendAuthError(reply, 500, fallbackCode, 'Guild settings could not be completed.');
}
