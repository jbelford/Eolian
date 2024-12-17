import { VoiceConnection, entersState, VoiceConnectionStatus, AudioPlayer } from '@discordjs/voice';
import { logger } from '@eolian/common/logger';
import { VoiceChannel, ChannelType, Client } from 'discord.js';
import { ContextVoiceChannel, ContextVoiceConnection } from '../@types';
import { DiscordVoiceChannel } from './discord-voice-channel';

export class DiscordVoiceConnection implements ContextVoiceConnection {
  constructor(
    private readonly client: Client,
    readonly discordConnection: VoiceConnection,
  ) {}

  get channelId(): string {
    return this.discordConnection.joinConfig.channelId!;
  }

  getChannel(): ContextVoiceChannel {
    const channel = this.client.channels.cache.get(this.channelId);
    if (channel?.type !== ChannelType.GuildVoice) {
      logger.warn(
        'Guild channel received is not voice. Type: %s Id: %s',
        channel?.type,
        this.channelId,
      );
    }
    return new DiscordVoiceChannel(channel as VoiceChannel);
  }

  async awaitReconnect(): Promise<boolean> {
    try {
      // Seems to be reconnecting to a new channel - ignore disconnect if no error thrown
      await Promise.race([
        entersState(this.discordConnection, VoiceConnectionStatus.Signalling, 5000),
        entersState(this.discordConnection, VoiceConnectionStatus.Connecting, 5000),
      ]);
      logger.debug('Reconnecting to new channel');
      return true;
    } catch (error) {
      logger.debug('Voice was disconnected');
      return false;
    }
  }

  subscribe(player: AudioPlayer): boolean {
    return !!this.discordConnection.subscribe(player);
  }

  async close(): Promise<void> {
    this.discordConnection.destroy();
  }
}
