import { PERMISSION } from 'common/constants';
import { Identifier, UserDTO } from 'data/@types';
import { GuildMember, User } from 'discord.js';
import { EolianUserService } from 'services';
import { ContextUser, ContextVoiceChannel } from './@types';
import { DiscordVoiceChannel } from './voice';

export class DiscordUser implements ContextUser {

  private dto?: UserDTO;

  constructor(private readonly user: User,
      private readonly users: EolianUserService,
      readonly permission: PERMISSION,
      private readonly guildUser?: GuildMember | null) {}

  get id() {
    return this.user.id;
  }

  get name() {
    return this.user.username;
  }

  get avatar() {
    return this.user.avatarURL({ dynamic: true }) || undefined;
  }

  getVoice(): ContextVoiceChannel | undefined {
    if (this.guildUser) {
      const voiceChannel = this.guildUser.voice.channel;
      if (voiceChannel) {
        return new DiscordVoiceChannel(voiceChannel);
      }
    }
    return undefined;
  }

  async get(): Promise<UserDTO> {
    return this.dto || (this.dto = await this.users.getUser(this.id));
  }


  clearData(): Promise<boolean> {
    if (this.dto) {
      this.dto = undefined;
    }
    return this.users.removeUser(this.id);
  }

  setIdentifier(id: string, identifier: Identifier): Promise<void> {
    if (this.dto) {
      if (!this.dto.identifiers) {
        this.dto.identifiers = {};
      }
      this.dto.identifiers[id] = identifier;
    }
    return this.users.addResourceIdentifier(this.id, id, identifier);
  }

  removeIdentifier(id: string): Promise<boolean> {
    if (this.dto && this.dto.identifiers && id in this.dto.identifiers) {
      delete this.dto.identifiers[id];
    }
    return this.users.removeResourceIdentifier(this.id, id);
  }

  setSpotify(id: string | null): Promise<void> {
    if (this.dto) {
      this.dto.spotify = id || undefined;
    }
    return id != null ? this.users.linkSpotifyAccount(this.id, id)
        : this.users.unlinkSpotifyAccount(this.id);
  }

  setSoundCloud(id: number | null): Promise<void> {
    if (this.dto) {
      this.dto.soundcloud = id || undefined;
    }
    return id != null ? this.users.linkSoundCloudAccount(this.id, id)
        : this.users.unlinkSoundCloudAccount(this.id);
  }

}