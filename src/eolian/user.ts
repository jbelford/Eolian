import { PERMISSION } from 'common/constants';
import { Identifier, UserDTO } from 'data/@types';
import { User } from 'discord.js';
import { EolianUserService } from 'services';
import { ContextUser } from './@types';

export class DiscordUser implements ContextUser {

  private dto?: UserDTO;

  constructor(private readonly user: User,
      private readonly users: EolianUserService,
      readonly permission: PERMISSION) {}

  get id() {
    return this.user.id;
  }

  get name() {
    return this.user.username;
  }

  get avatar() {
    return this.user.avatarURL;
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
    return this.users.addResourceIdentifier(this.user.id, id, identifier);
  }

  setSpotify(id: string | null): Promise<void> {
    if (this.dto) {
      this.dto.spotify = id || undefined;
    }
    return id != null ? this.users.linkSpotifyAccount(this.user.id, id)
        : this.users.unlinkSpotifyAccount(this.user.id);
  }

  setSoundCloud(id: number | null): Promise<void> {
    if (this.dto) {
      this.dto.soundcloud = id || undefined;
    }
    return id != null ? this.users.linkSoundCloudAccount(this.user.id, id)
        : this.users.unlinkSoundCloudAccount(this.user.id);
  }

}