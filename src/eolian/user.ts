import { PERMISSION } from 'common/constants';
import { UserDTO } from 'data/@types';
import { User } from 'discord.js';
import { EolianUserService } from 'services';
import { ContextUser } from './@types';

export class DiscordUser implements ContextUser {

  private dto?: UserDTO;

  constructor(private readonly user: User,
      private readonly users: EolianUserService,
      readonly permission: PERMISSION
    ) {}

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

}