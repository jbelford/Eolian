import { ChannelType, PermissionFlagsBits, GuildChannel } from 'discord.js';
import { ContextTextChannel } from './@types';
import { ButtonRegistry } from './button-registry';
import { DiscordChannelSender, SupportedTextChannel } from './discord-channel-sender';

export class DiscordTextChannel extends DiscordChannelSender implements ContextTextChannel {
  constructor(
    private readonly channel: SupportedTextChannel,
    registry: ButtonRegistry,
  ) {
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
      const permissions = (this.channel as GuildChannel).permissionsFor(
        (this.channel as GuildChannel).guild.members.me!,
      );
      return permissions.has(PermissionFlagsBits.ViewChannel);
    }
    return true;
  }

  get reactable(): boolean {
    if (!this.isDm) {
      const permissions = (this.channel as GuildChannel).permissionsFor(
        (this.channel as GuildChannel).guild.members.me!,
      );
      return permissions.has(PermissionFlagsBits.AddReactions);
    }
    return true;
  }
}
