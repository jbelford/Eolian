import { User } from "discord.js";

export class DiscordUser implements ContextUser {

  constructor(private readonly user: User, readonly permission: PERMISSION) { }

  get id() {
    return this.user.id;
  }

  get name() {
    return this.user.username;
  }

  get avatar() {
    return this.user.avatarURL;
  }

}