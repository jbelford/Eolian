import {
  joinVoiceChannel,
  DiscordGatewayAdapterCreator,
  entersState,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { VoiceChannel } from 'discord.js';
import { environment } from '@eolian/common/env';
import { ContextVoiceChannel } from '../@types';

export class DiscordVoiceChannel implements ContextVoiceChannel {
  constructor(private readonly channel: VoiceChannel) {}

  get id(): string {
    return this.channel.id;
  }

  get joinable(): boolean {
    return this.channel.joinable;
  }

  async join(): Promise<void> {
    const connection = joinVoiceChannel({
      channelId: this.channel.id,
      guildId: this.channel.guild.id,
      adapterCreator: this.channel.guild
        .voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
    });
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
  }

  hasPeopleListening(): boolean {
    return !!this.channel.members.find(
      member => !member.voice.deaf && (!member.user.bot || member.id === environment.e2eBotId),
    );
  }
}
