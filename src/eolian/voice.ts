import { VoiceChannel, VoiceConnection } from 'discord.js';
import { Player } from 'music/@types';
import { ContextVoiceChannel, ContextVoiceConnection } from './@types';


export class DiscordVoiceChannel implements ContextVoiceChannel {

  constructor(private readonly channel: VoiceChannel) {
  }

  get id(): string {
    return this.channel.id;
  }

  async join(): Promise<void> {
    await this.channel.join();
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
