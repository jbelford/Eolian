import { SelectionOption } from '@eolian/embed/@types';
import { TextChannel, DMChannel, ChannelType, PermissionFlagsBits } from 'discord.js';
import {
  ContextMessage,
  EmbedMessage,
  ContextUser,
  SelectionResult,
  ContextTextChannel,
} from './@types';
import { ButtonRegistry } from './button-registry';
import { DiscordChannelSender } from './discord-channel-sender';

export class DiscordTextChannel implements ContextTextChannel {

  private readonly sender: DiscordChannelSender;

  constructor(
    private readonly channel: TextChannel | DMChannel,
    private readonly registry: ButtonRegistry
  ) {
    this.sender = new DiscordChannelSender(channel, this.registry, this.channel);
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

  get sendable(): boolean {
    return this.sender.sendable;
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

  send(message: string): Promise<ContextMessage | undefined> {
    return this.sender.send(message);
  }

  // Simutaneously need to accept a text input OR emoji reaction so this is a mess
  sendSelection(
    question: string,
    options: SelectionOption[],
    user: ContextUser
  ): Promise<SelectionResult> {
    return this.sender.sendSelection(question, options, user);
  }

  sendEmbed(embed: EmbedMessage): Promise<ContextMessage | undefined> {
    return this.sender.sendEmbed(embed);
  }

}
