import { VoiceChannel, VoiceConnection } from 'discord.js';
import { Player } from 'music/@types';
import { ContextVoiceChannel, ContextVoiceConnection } from './@types';


export class DiscordVoiceChannel implements ContextVoiceChannel {

  constructor(private readonly channel: VoiceChannel) {
  }

  get id(): string {
    return this.channel.id;
  }

  get joinable(): boolean {
    return this.channel.joinable;
  }

  async join(): Promise<void> {
    await this.channel.join();
  }

  hasPeopleListening(): boolean {
    return !!this.channel.members.find(member => !member.user.bot && !member.voice.deaf);
  }

}

export class DiscordVoiceConnection implements ContextVoiceConnection {

  constructor(private readonly connection: VoiceConnection, readonly player: Player) {
  }

  get channelId(): string {
    return this.connection.channel.id;
  }

  async disconnect(): Promise<void> {
    this.connection.disconnect();
  }

}
