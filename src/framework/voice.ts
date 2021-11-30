import { AudioPlayer, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';
import { logger } from 'common/logger';
import { Client, VoiceChannel } from 'discord.js';
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
    joinVoiceChannel({
      channelId: this.channel.id,
      guildId: this.channel.guild.id,
      adapterCreator: this.channel.guild.voiceAdapterCreator
    });
  }

  hasPeopleListening(): boolean {
    return !!this.channel.members.find(member => !member.user.bot && !member.voice.deaf);
  }

}

export class DiscordVoiceConnection implements ContextVoiceConnection {

  constructor(
    private readonly client: Client,
    private readonly connection: VoiceConnection) {
  }

  get channelId(): string {
    return this.connection.joinConfig.channelId!;
  }

  getChannel(): ContextVoiceChannel {
    const channel = this.client.channels.cache.get(this.channelId);
    if (channel?.type !== 'GUILD_VOICE') {
      logger.warn('Guild channel received is not voice. Type: %s Id: %s', channel?.type, this.channelId);
    }
    return new DiscordVoiceChannel(channel as VoiceChannel);
  }

  onDisconnect(cb: () => void): void {
    this.connection.on(VoiceConnectionStatus.Disconnected, cb);
  }

  subscribe(player: AudioPlayer): boolean {
    return !!this.connection.subscribe(player);
  }

  async disconnect(): Promise<void> {
    this.connection.destroy();
  }

}


