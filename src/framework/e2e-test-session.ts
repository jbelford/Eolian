import { logger } from '@eolian/common/logger';
import { EolianUserError } from '@eolian/common/errors';
import { Client, Guild, GuildMember, Message } from 'discord.js';
import crypto from 'node:crypto';
import { getE2ECleanupRunId, matchesE2ETestActor } from './e2e-test-message';
import { DiscordGuildStore } from './state/discord-guild-store';

export interface E2ETestSessionConfig {
  guildId: string;
  textChannelId: string;
  voiceChannelId: string;
  actorId: string;
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

export class E2ETestSession {
  private starting = false;
  private activeRunId?: string;
  private activeTrackUrls = new Set<string>();

  constructor(
    private readonly client: Client,
    private readonly guildStore: DiscordGuildStore,
    private readonly config: E2ETestSessionConfig,
  ) {}

  matchesActor(message: Message): boolean {
    return matchesE2ETestActor(message, this.config);
  }

  getCleanupRunId(message: Message): string | undefined {
    if (!this.matchesActor(message) || !this.client.user) {
      return undefined;
    }
    return getE2ECleanupRunId(message, this.config, this.client.user.id);
  }

  blocksGuild(guildId: string): boolean {
    return guildId === this.config.guildId && (this.starting || !!this.activeRunId);
  }

  async begin(): Promise<string> {
    if (this.starting || this.activeRunId) {
      throw new EolianUserError('An E2E run is already active');
    }

    this.starting = true;
    try {
      const { guild, actor } = await this.getDiscordContext();
      if (!actor.user.bot || actor.id === this.client.user?.id) {
        throw new EolianUserError('E2E_TEST_ACTOR_ID must identify the separate test bot');
      }
      if (actor.voice.channelId !== this.config.voiceChannelId) {
        throw new EolianUserError('The E2E test bot must join the configured voice channel first');
      }

      const before = await this.getState();
      if (before.streaming || before.queueSize > 0) {
        throw new EolianUserError('E2E testing refuses to disturb an active player or queue');
      }

      const runId = crypto.randomUUID();
      this.activeRunId = runId;
      logger.info('Started E2E test run %s in guild %s', runId, guild.id);
      return runId;
    } finally {
      this.starting = false;
    }
  }

  async complete(runId: string): Promise<E2ETestState> {
    if (runId !== this.activeRunId) {
      throw new Error('Cannot complete an inactive E2E run');
    }
    const result = await this.getState();
    this.activeTrackUrls = await this.getPlaybackUrls();
    return result;
  }

  async abort(runId: string): Promise<void> {
    if (runId === this.activeRunId) {
      this.activeTrackUrls = await this.getPlaybackUrls();
      await this.cleanup(runId);
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

  async cleanup(runId: string): Promise<E2ETestState> {
    if (!this.activeRunId || runId !== this.activeRunId) {
      throw new Error('Cleanup requires the active E2E run ID');
    }
    const guild = await this.client.guilds.fetch(this.config.guildId);
    const state = await this.guildStore.getState(guild);
    const playbackUrls = await this.getPlaybackUrls();
    if ([...playbackUrls].some(url => !this.activeTrackUrls.has(url))) {
      throw new Error('E2E cleanup detected concurrent playback or queue changes');
    }
    state.player.stop();
    await state.queue.clear();
    this.activeRunId = undefined;
    this.activeTrackUrls.clear();
    logger.info('Cleaned up E2E test run %s', runId);
    return await this.getState();
  }

  private async getDiscordContext(): Promise<{
    guild: Guild;
    actor: GuildMember;
  }> {
    const guild = await this.client.guilds.fetch(this.config.guildId);
    const actor = await guild.members.fetch(this.config.actorId);
    return { guild, actor };
  }

  private async getPlaybackUrls(): Promise<Set<string>> {
    const guild = await this.client.guilds.fetch(this.config.guildId);
    const state = await this.guildStore.getState(guild);
    const queueSize = await state.queue.size();
    const [queued] = await state.queue.get(0, queueSize);
    return new Set(
      [state.player.currentTrack, ...queued].filter(track => !!track).map(track => track.url),
    );
  }
}
