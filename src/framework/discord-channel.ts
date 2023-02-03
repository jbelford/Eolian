import { TextChannel, DMChannel, ChannelType, PermissionFlagsBits } from 'discord.js';
import { ContextTextChannel } from './@types';
import { ButtonRegistry } from './button-registry';
import { DiscordChannelSender } from './discord-channel-sender';

export class DiscordTextChannel extends DiscordChannelSender implements ContextTextChannel {

  constructor(private readonly channel: TextChannel | DMChannel, registry: ButtonRegistry) {
    super(channel, registry, channel);
  }

  get lastMessageId(): string | undefined {
    return this.channel.lastMessageId || undefined;
  }

  get isDm(): boolean {
    return this.channel.type === ChannelType.DM;
  }

  get visible(): boolean {
    if (!this.isDm) {
      const permissions = (this.channel as TextChannel).permissionsFor(
        (this.channel as TextChannel).guild.members.me!
      );
      return permissions.has(PermissionFlagsBits.ViewChannel);
    }
    return true;
  }

  get reactable(): boolean {
    if (!this.isDm) {
      const permissions = (this.channel as TextChannel).permissionsFor(
        (this.channel as TextChannel).guild.members.me!
      );
      return permissions.has(PermissionFlagsBits.AddReactions);
    }
    return true;
  }

}