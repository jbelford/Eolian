import { executePlay } from '@eolian/commands/music/play-command';
import { UserPermission } from '@eolian/common/constants';
import { logger } from '@eolian/common/logger';
import { AppDatabase } from '@eolian/data/@types';
import { ChannelType, Client, Guild, GuildMember, TextChannel, VoiceChannel } from 'discord.js';
import crypto from 'node:crypto';
import {
  ContextCommandInteraction,
  ContextMessage,
  ContextTextChannel,
  ContextUser,
  IAuthServiceProvider,
} from './@types';
import { ButtonRegistry } from './button-registry';
import { DiscordTextChannel } from './discord-channel';
import { DiscordGuildClient } from './discord-client';
import { DiscordUser } from './discord-user';
import { createE2ETestCommandOptions, E2ETestPlayRequest } from './e2e-test-control-options';
import { DiscordGuildStore } from './state/discord-guild-store';

class E2EControlInteraction implements ContextCommandInteraction {
  private replied = false;

  constructor(
    readonly user: ContextUser,
    readonly channel: ContextTextChannel,
  ) {}

  get sendable(): boolean {
    return this.channel.sendable;
  }

  get hasReplied(): boolean {
    return this.replied;
  }

  get reactable(): boolean {
    return false;
  }

  async send(message: string): Promise<ContextMessage | undefined> {
    const sent = await this.channel.send(message, { ephemeral: false });
    this.replied ||= !!sent;
    return sent;
  }

  sendSelection = this.channel.sendSelection.bind(this.channel);
  sendEmbed = this.channel.sendEmbed.bind(this.channel);

  async defer(): Promise<void> {}

  async react(): Promise<void> {}

  async getCommand(): Promise<never> {
    throw new Error('E2E control supplies a command directly');
  }

  toString(): string {
    return 'authenticated E2E control request';
  }
}

export interface E2ETestControlConfig {
  guildId: string;
  textChannelId: string;
  voiceChannelId: string;
  actorId: string;
  production: boolean;
}

export interface E2ETestState {
  runId?: string;
  streaming: boolean;
  paused: boolean;
  queueSize: number;
  voiceChannelId?: string;
  eolianVoiceChannelId?: string;
  actorVoiceChannelId?: string;
  currentTrack?: {
    title: string;
    url: string;
    source: number;
  };
}

export class E2ETestControl {
  private starting = false;
  private activeRunId?: string;
  private activeTrackUrl?: string;
  private activeQueueSize?: number;
  private readonly registry = new ButtonRegistry();

  constructor(
    private readonly client: Client,
    private readonly guildStore: DiscordGuildStore,
    private readonly db: AppDatabase,
    private readonly auth: IAuthServiceProvider,
    private readonly config: E2ETestControlConfig,
  ) {}

  async play(request: E2ETestPlayRequest): Promise<E2ETestState> {
    if (this.starting || this.activeRunId) {
      throw new Error('An E2E run is already active');
    }

    this.starting = true;
    try {
      const { guild, actor, textChannel, voiceChannel } = await this.getDiscordContext();
      if (!actor.user.bot || actor.id === this.client.user?.id) {
        throw new Error('E2E_CONTROL_ACTOR_ID must identify the separate test bot');
      }
      if (actor.voice.channelId !== voiceChannel.id) {
        throw new Error('The E2E test bot must join the configured voice channel first');
      }

      const state = await this.guildStore.getState(guild);
      const before = await this.getState();
      if (this.config.production && (before.streaming || before.queueSize > 0)) {
        throw new Error('Production E2E control refuses to disturb an active player or queue');
      }

      const runId = crypto.randomUUID();
      this.activeRunId = runId;
      this.starting = false;
      const user = new DiscordUser(
        actor.user,
        this.db.users,
        UserPermission.Owner,
        this.auth,
        actor,
      );
      const channel = new DiscordTextChannel(textChannel, this.registry);
      const interaction = new E2EControlInteraction(user, channel);
      const client = new DiscordGuildClient(
        this.client,
        guild.id,
        this.guildStore,
        this.db.servers,
      );

      await executePlay(
        { client, interaction, server: state },
        createE2ETestCommandOptions(request),
      );
      const result = await this.getState();
      this.activeTrackUrl = result.currentTrack?.url;
      this.activeQueueSize = result.queueSize;
      return result;
    } catch (error) {
      if (this.activeRunId) {
        await this.cleanup(this.activeRunId, true);
      }
      throw error;
    } finally {
      this.starting = false;
    }
  }

  async getState(): Promise<E2ETestState> {
    const { guild, actor } = await this.getDiscordContext();
    const state = await this.guildStore.getState(guild);
    const currentTrack = state.player.currentTrack;
    return {
      runId: this.activeRunId,
      streaming: state.player.isStreaming,
      paused: state.player.paused,
      queueSize: await state.queue.size(),
      voiceChannelId: state.player.getChannel()?.id,
      eolianVoiceChannelId: guild.members.me?.voice.channelId ?? undefined,
      actorVoiceChannelId: actor.voice.channelId ?? undefined,
      currentTrack: currentTrack && {
        title: currentTrack.title,
        url: currentTrack.url,
        source: currentTrack.src,
      },
    };
  }

  async cleanup(runId: string, failedStart = false): Promise<E2ETestState> {
    if (!this.activeRunId || runId !== this.activeRunId) {
      throw new Error('Cleanup requires the active E2E run ID');
    }
    const guild = await this.client.guilds.fetch(this.config.guildId);
    const state = await this.guildStore.getState(guild);
    const before = await this.getState();
    if (
      this.config.production &&
      !failedStart &&
      (before.streaming || before.queueSize > 0) &&
      (before.currentTrack?.url !== this.activeTrackUrl ||
        before.queueSize !== this.activeQueueSize)
    ) {
      throw new Error('Production E2E cleanup detected concurrent playback or queue changes');
    }
    state.player.stop();
    await state.queue.clear();
    this.activeRunId = undefined;
    this.activeTrackUrl = undefined;
    this.activeQueueSize = undefined;
    logger.info('Cleaned up E2E test run %s', runId);
    return await this.getState();
  }

  private async getDiscordContext(): Promise<{
    guild: Guild;
    actor: GuildMember;
    textChannel: TextChannel | VoiceChannel;
    voiceChannel: VoiceChannel;
  }> {
    const guild = await this.client.guilds.fetch(this.config.guildId);
    const actor = await guild.members.fetch(this.config.actorId);
    const textChannel = await guild.channels.fetch(this.config.textChannelId);
    const voiceChannel = await guild.channels.fetch(this.config.voiceChannelId);
    if (
      textChannel?.type !== ChannelType.GuildText &&
      textChannel?.type !== ChannelType.GuildVoice
    ) {
      throw new Error('E2E_CONTROL_TEXT_CHANNEL_ID must be a guild text or voice channel');
    }
    if (voiceChannel?.type !== ChannelType.GuildVoice) {
      throw new Error('E2E_CONTROL_VOICE_CHANNEL_ID must be a guild voice channel');
    }
    return { guild, actor, textChannel, voiceChannel };
  }
}
