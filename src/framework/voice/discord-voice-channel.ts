import { joinVoiceChannel, DiscordGatewayAdapterCreator } from '@discordjs/voice';
import { VoiceChannel } from 'discord.js';
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
    joinVoiceChannel({
      channelId: this.channel.id,
      guildId: this.channel.guild.id,
      adapterCreator: this.channel.guild
        .voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
    });
  }

  hasPeopleListening(): boolean {
    return !!this.channel.members.find(member => !member.user.bot && !member.voice.deaf);
  }
}
