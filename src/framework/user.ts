import { AuthorizationCodeProvider, AuthProviders, SOURCE_DETAILS, SpotifyRequest } from 'api';
import {
  AuthorizationProvider,
  AuthService,
  TokenResponseWithRefresh,
  TrackSource,
} from 'api/@types';
import { UserPermission } from 'common/constants';
import { environment } from 'common/env';
import { Identifier, UserDTO, UsersDb } from 'data/@types';
import { GuildMember, Permissions, User } from 'discord.js';
import { ContextInteractionOptions, ContextMessage, ContextUser, ContextVoiceChannel, EmbedMessage, ServerDetails } from './@types';
import { DiscordSender } from './channel';
import { DiscordVoiceChannel } from './voice';

class DiscordSpotifyAuthorizationProvider implements AuthorizationProvider {

  constructor(private readonly user: ContextUser, private readonly spotifyAuth: AuthService) {}

  async authorize(): Promise<TokenResponseWithRefresh> {
    const result = this.spotifyAuth.authorize();
    const embedMessage: EmbedMessage = createSpotifyAuthEmbed(result.link);
    const message = await this.user.sendEmbed(embedMessage);
    const response = await result.response;

    await Promise.all([
      this.user.setSpotifyToken(response.refresh_token),
      message?.editEmbed(SPOTIFY_AUTH_COMPLETE_EMBED)
    ]);

    return response;
  }

}

export class DiscordUser implements ContextUser {

  private dto?: UserDTO;
  private _permission: UserPermission;
  private spotifyRequest?: SpotifyRequest;
  private _sender?: DiscordSender;

  constructor(
    private readonly user: User,
    private readonly users: UsersDb,
    permission: UserPermission,
    private readonly auth: AuthProviders,
    private readonly guildUser?: GuildMember
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
    return this.user.avatarURL({ dynamic: true }) || undefined;
  }

  get permission(): UserPermission {
    return this._permission;
  }

  private get sender(): DiscordSender {
    if (!this._sender) {
      this._sender = new DiscordSender(this.user);
    }
    return this._sender;
  }

  async updatePermissions(details?: ServerDetails): Promise<void> {
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

  sendEmbed(embed: EmbedMessage, options?: ContextInteractionOptions): Promise<ContextMessage | undefined> {
    return this.sender.sendEmbed(embed, options);
  }

  getVoice(): ContextVoiceChannel | undefined {
    if (this.guildUser) {
      const voiceChannel = this.guildUser.voice.channel;
      if (voiceChannel?.type === 'GUILD_VOICE') {
        return new DiscordVoiceChannel(voiceChannel);
      }
    }
    return undefined;
  }

  async get(): Promise<UserDTO> {
    return this.dto || (this.dto = (await this.users.get(this.id)) ?? { _id: this.id });
  }

  async getSpotifyRequest(): Promise<SpotifyRequest> {
    if (!this.spotifyRequest) {
      const user = await this.get();
      const provider = new DiscordSpotifyAuthorizationProvider(this, this.auth.spotify);
      const tokenProvider = new AuthorizationCodeProvider(provider, user.tokens?.spotify);
      this.spotifyRequest = new SpotifyRequest(tokenProvider);
    }
    return this.spotifyRequest;
  }

  clearData(): Promise<boolean> {
    if (this.dto) {
      this.dto = undefined;
    }
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

  async setSpotifyToken(token: string): Promise<void> {
    if (this.dto) {
      if (this.dto.tokens) {
        this.dto.tokens.spotify = token;
      } else {
        this.dto.tokens = { spotify: token };
      }
    }
    await this.users.setSpotifyRefreshToken(this.id, token);
  }

}

function createSpotifyAuthEmbed(link: string): EmbedMessage {
  return {
    url: link,
    title: 'Authorize Spotify',
    description:
      'Please click the link to authenticate with Spotify in order to complete your request',
    color: SOURCE_DETAILS[TrackSource.Spotify].color,
    thumbnail: SOURCE_DETAILS[TrackSource.Spotify].icon,
    footer: {
      text: 'This link will expire in 60 seconds.',
    },
  };
}

const SPOTIFY_AUTH_COMPLETE_EMBED: EmbedMessage = {
  title: 'Authorize Spotify Complete',
  description:
    'You have authorized Eolian to read your Spotify information!\nYou can go back to the channel where you sent a command now :)',
  color: SOURCE_DETAILS[TrackSource.Spotify].color,
  thumbnail: SOURCE_DETAILS[TrackSource.Spotify].icon
};

export function getPermissionLevel(
  user: User,
  memberPermissions?: Readonly<Permissions> | null
): UserPermission {
  if (environment.owners.includes(user.id)) {
    return UserPermission.Owner;
  } else if (memberPermissions?.has(Permissions.FLAGS.ADMINISTRATOR)) {
    return UserPermission.Admin;
  }
  return UserPermission.User;
}
