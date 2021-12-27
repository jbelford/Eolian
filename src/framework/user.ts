import { PERMISSION } from 'common/constants';
import { environment } from 'common/env';
import { Identifier, UserDTO, UsersDb } from 'data/@types';
import { GuildMember, Permissions, User } from 'discord.js';
import { ContextUser, ContextVoiceChannel, ServerDetails } from './@types';
import { DiscordVoiceChannel } from './voice';

export class DiscordUser implements ContextUser {

  private dto?: UserDTO;
  private _permission: PERMISSION;

  constructor(private readonly user: User,
      private readonly users: UsersDb,
      permission: PERMISSION,
      private readonly guildUser?: GuildMember) {
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

  get permission(): PERMISSION {
    return this._permission;
  }

  async updatePermissions(details?: ServerDetails): Promise<void> {
    if (this.permission === PERMISSION.USER) {
      if (details) {
        const config = await details.get();
        if (config.djRoleIds && config.djRoleIds.length > 0) {
          if (config.djRoleIds.some(role => this.hasRole(role))) {
            this._permission = PERMISSION.DJ;
          } else if (config.djAllowLimited) {
            this._permission = PERMISSION.DJ_LIMITED;
          }
        } else {
          this._permission = PERMISSION.DJ;
        }
      } else {
        this._permission = PERMISSION.DJ;
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
    return this.dto || (this.dto = (await this.users.get(this.id) ?? { _id: this.id }));
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

}

export function getPermissionLevel(user: User, memberPermissions?: Readonly<Permissions> | null): PERMISSION {
  if (environment.owners.includes(user.id)) {
    return PERMISSION.OWNER;
  } else if (memberPermissions?.has(Permissions.FLAGS.ADMINISTRATOR)) {
    return PERMISSION.ADMIN;
  }
  return PERMISSION.USER;
}