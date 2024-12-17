import { createAuthCodeRequest } from '@eolian/api';
import { TrackSource } from '@eolian/api/@types';
import { SyntaxType } from '@eolian/command-options/@types';
import { UserPermission } from '@eolian/common/constants';
import { environment } from '@eolian/common/env';
import { InMemoryLRUCache } from '@eolian/data';
import { UserDTO, UsersDb, Identifier, MemoryCache } from '@eolian/data/@types';
import { IOAuthHttpClient } from '@eolian/http/@types';
import {
  User,
  GuildMember,
  ChannelType,
  PermissionsBitField,
  PermissionFlagsBits,
} from 'discord.js';
import {
  ContextUser,
  ContextServer,
  ContextInteractionOptions,
  ContextMessage,
  EmbedMessage,
  ContextVoiceChannel,
  ContextSendable,
  IAuthServiceProvider,
} from './@types';
import { DiscordAuthorizationProvider } from './discord-authorization-provider';
import { DiscordSender } from './discord-sender';
import { DiscordVoiceChannel } from './voice';

const USER_CACHE: MemoryCache<UserDTO> = new InMemoryLRUCache(1000);

export class DiscordUser implements ContextUser {
  private _dto?: UserDTO | null = null;
  private _permission: UserPermission;
  private _sender?: DiscordSender;

  constructor(
    private readonly user: User,
    private readonly users: UsersDb,
    permission: UserPermission,
    private readonly auth: IAuthServiceProvider,
    private readonly guildUser?: GuildMember,
  ) {
    this._permission = permission;
  }

  get id(): string {
    return this.user.id;
  }

  get name(): string {
    return this.user.username;
  }

  get avatar(): string | undefined {
    return this.user.avatarURL() || undefined;
  }

  get permission(): UserPermission {
    return this._permission;
  }

  private get dto(): UserDTO | undefined {
    if (this._dto === null) {
      this._dto = USER_CACHE.get(this.id);
    }
    return this._dto;
  }

  private set dto(newDto: UserDTO | undefined) {
    this._dto = newDto;
    USER_CACHE.set(this.id, this._dto);
  }

  private get sender(): DiscordSender {
    if (!this._sender) {
      this._sender = new DiscordSender(this.user);
    }
    return this._sender;
  }

  async updatePermissions(details?: ContextServer): Promise<void> {
    if (this.permission === UserPermission.User) {
      if (details) {
        const config = await details.get();
        if (config.djRoleIds && config.djRoleIds.length > 0) {
          if (config.djRoleIds.some(role => this.hasRole(role))) {
            this._permission = UserPermission.DJ;
          } else if (config.djAllowLimited) {
            this._permission = UserPermission.DJLimited;
          }
        } else {
          this._permission = UserPermission.DJ;
        }
      } else {
        this._permission = UserPermission.DJ;
      }
    }
  }

  hasRole(id: string): boolean {
    return !!this.guildUser?.roles.cache.has(id);
  }

  send(message: string, options?: ContextInteractionOptions): Promise<ContextMessage | undefined> {
    return this.sender.send(message, options);
  }

  sendEmbed(
    embed: EmbedMessage,
    options?: ContextInteractionOptions,
  ): Promise<ContextMessage | undefined> {
    return this.sender.sendEmbed(embed, options);
  }

  getVoice(): ContextVoiceChannel | undefined {
    if (this.guildUser) {
      const voiceChannel = this.guildUser.voice.channel;
      if (voiceChannel?.type === ChannelType.GuildVoice) {
        return new DiscordVoiceChannel(voiceChannel);
      }
    }
    return undefined;
  }

  async get(): Promise<UserDTO> {
    if (this.dto) {
      return this.dto;
    }
    this.dto = (await this.users.get(this.id)) ?? { _id: this.id };
    return this.dto;
  }

  async getRequest(sendable: ContextSendable, api: TrackSource): Promise<IOAuthHttpClient> {
    let request = await this.auth.getUserRequest(this.id, api);
    if (!request) {
      const token = await this.getToken(api);
      const authService = this.auth.getService(api);
      const provider = new DiscordAuthorizationProvider(this, authService, api, sendable);
      request = createAuthCodeRequest(provider, api, token);
      await this.auth.setUserRequest(this.id, request, api);
    } else {
      (request.tokenProvider.authorization as DiscordAuthorizationProvider).sendable = sendable;
    }
    return request;
  }

  private async getToken(api: TrackSource): Promise<string | undefined> {
    const user = await this.get();
    switch (api) {
      case TrackSource.Spotify:
        return user.tokens?.spotify;
      case TrackSource.SoundCloud:
        return user.tokens?.soundcloud;
      default:
        throw new Error(`User does not have token for ${api}`);
    }
  }

  setToken(token: string | null, api: TrackSource): Promise<void> {
    switch (api) {
      case TrackSource.Spotify:
        return this.setSpotifyToken(token);
      case TrackSource.SoundCloud:
        return this.setSoundCloudToken(token);
      default:
        throw new Error(`Token is not supported for ${api}`);
    }
  }

  async clearData(): Promise<boolean> {
    if (this.dto) {
      this.dto = undefined;
    }
    await this.auth.removeUserRequest(this.id);
    return this.users.delete(this.id);
  }

  setIdentifier(id: string, identifier: Identifier): Promise<void> {
    if (this.dto) {
      if (!this.dto.identifiers) {
        this.dto.identifiers = {};
      }
      this.dto.identifiers[id] = identifier;
    }
    return this.users.setIdentifier(this.id, id, identifier);
  }

  removeIdentifier(id: string): Promise<boolean> {
    if (this.dto && this.dto.identifiers && id in this.dto.identifiers) {
      delete this.dto.identifiers[id];
    }
    return this.users.removeIdentifier(this.id, id);
  }

  async setSpotify(id: string | null): Promise<void> {
    if (this.dto) {
      this.dto.spotify = id || undefined;
    }
    if (id) {
      await this.users.setSpotify(this.id, id);
    } else {
      await this.users.removeSpotify(this.id);
    }
  }

  async setSoundCloud(id: number | null): Promise<void> {
    if (this.dto) {
      this.dto.soundcloud = id || undefined;
    }
    if (id) {
      await this.users.setSoundCloud(this.id, id);
    } else {
      await this.users.removeSoundCloud(this.id);
    }
  }

  async setSyntax(type: SyntaxType | null): Promise<void> {
    if (this.dto) {
      this.dto.syntax = type ?? undefined;
    }
    if (type !== null) {
      await this.users.setSyntax(this.id, type);
    } else {
      await this.users.removeSyntax(this.id);
    }
  }

  private async setSpotifyToken(token: string | null): Promise<void> {
    if (this.dto) {
      if (this.dto.tokens) {
        this.dto.tokens.spotify = token ?? undefined;
      } else {
        this.dto.tokens = { spotify: token ?? undefined };
      }
    }
    if (token) {
      await this.users.setSpotifyRefreshToken(this.id, token);
    } else {
      await this.auth.removeUserRequest(this.id, TrackSource.Spotify);
      await this.users.removeSpotifyRefreshToken(this.id);
    }
  }

  private async setSoundCloudToken(token: string | null): Promise<void> {
    if (this.dto) {
      if (this.dto.tokens) {
        this.dto.tokens.soundcloud = token ?? undefined;
      } else {
        this.dto.tokens = { soundcloud: token ?? undefined };
      }
    }
    if (token) {
      await this.users.setSoundCloudRefreshToken(this.id, token);
    } else {
      await this.auth.removeUserRequest(this.id, TrackSource.SoundCloud);
      await this.users.removeSoundCloudRefreshToken(this.id);
    }
  }
}

export function getPermissionLevel(
  user: User,
  memberPermissions?: Readonly<PermissionsBitField> | null,
): UserPermission {
  if (environment.owners.includes(user.id)) {
    return UserPermission.Owner;
  } else if (memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return UserPermission.Admin;
  }
  return UserPermission.User;
}
