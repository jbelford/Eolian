import { AuthorizationCodeProvider, AuthProviders } from 'api';
import { AuthorizationProvider, TokenProvider } from 'api/@types';
import { Color, UserPermission } from 'common/constants';
import { environment } from 'common/env';
import { Identifier, UserDTO, UsersDb } from 'data/@types';
import { GuildMember, Permissions, User } from 'discord.js';
import { ContextUser, ContextVoiceChannel, EmbedMessage, ServerDetails } from './@types';
import { mapDiscordEmbed } from './message';
import { DiscordVoiceChannel } from './voice';

export class DiscordUser implements ContextUser {

  private dto?: UserDTO;
  private _permission: UserPermission;
  private spotifyAuthProvider?: TokenProvider;

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

  async send(message: string): Promise<void> {
    await this.user.send(message);
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

  async getSpotifyAuth(): Promise<TokenProvider> {
    if (!this.spotifyAuthProvider) {
      const provider: AuthorizationProvider = {
        authorize: async () => {
          const result = this.auth.spotify.authorize();
          const embedMessage: EmbedMessage = {
            url: result.link,
            title: 'Authorize Spotify',
            description:
              'Please click the link to authenticate with Spotify in order to complete your request',
            color: Color.Spotify,
            footer: {
              text: 'This link will expire in 60 seconds.',
            },
          };
          await this.user.send({ embeds: [mapDiscordEmbed(embedMessage)] });
          const response = await result.response;

          await this.setSpotifyToken(response.refresh_token);

          return response;
        },
      };

      const user = await this.get();

      this.spotifyAuthProvider = new AuthorizationCodeProvider(provider, user.tokens?.spotify);
    }
    return this.spotifyAuthProvider;
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

  private async setSpotifyToken(token: string): Promise<void> {
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
