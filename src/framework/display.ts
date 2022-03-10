import { Track } from 'api/@types';
import { GITHUB_PAGE_ISSUES, UserPermission } from 'common/constants';
import { ServerQueue } from 'data/@types';
import { createBasicEmbed, createPlayingEmbed, createQueueEmbed } from 'embed';
import { Player } from 'music/@types';
import {
  ContextMessage,
  ContextSendable,
  ContextTextChannel,
  MessageButtonOnClickHandler,
  PlayerDisplay,
  QueueDisplay,
} from './@types';

const QUEUE_PAGE_LENGTH = 15;

export class DiscordQueueDisplay implements QueueDisplay {

  private message: ContextMessage | null = null;
  private channel: ContextTextChannel | null = null;
  private sendable?: ContextSendable;
  private start = 0;
  private updating = false;

  constructor(private readonly queue: ServerQueue) {
    this.queue.on('update', this.updateHandler);
  }

  async close(): Promise<void> {
    this.queue.removeListener('update', this.updateHandler);
    this.channel = null;
    await this.removeIdle();
  }

  async removeIdle(): Promise<void> {
    if (this.message) {
      const temp = this.message;
      this.message = null;

      temp.releaseButtons();
      await temp.editEmbed(createBasicEmbed('**Queue has been removed due to idle**'));
    }
  }

  setChannel(channel: ContextTextChannel, sendable?: ContextSendable): void {
    this.channel = channel;
    this.sendable = sendable;
  }

  async send(tracks: Track[], loop: Track[], start = 0, total = tracks.length): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel is not set!');
    }

    this.start = start;

    const messageDelete = this.message ? this.message.delete() : Promise.resolve();

    const pagingButtonsDisabled = total <= QUEUE_PAGE_LENGTH;
    tracks = tracks.slice(0, QUEUE_PAGE_LENGTH);
    loop = loop.slice(0, QUEUE_PAGE_LENGTH - tracks.length);
    const embed = createQueueEmbed(tracks, loop, this.start, total, this.queue.loop);
    embed.buttons = [
      {
        emoji: '🔀',
        onClick: this.shuffleHandler,
        disabled: total <= 1,
        permission: UserPermission.DJ,
      },
      {
        emoji: '⬅',
        onClick: this.prevPageHandler,
        disabled: pagingButtonsDisabled,
        permission: UserPermission.DJLimited,
      },
      {
        emoji: '➡',
        onClick: this.nextPageHandler,
        disabled: pagingButtonsDisabled,
        permission: UserPermission.DJLimited,
      },
    ];
    if (this.sendable) {
      this.message = (await this.sendable.sendEmbed(embed)) ?? null;
      this.sendable = undefined;
    } else {
      this.message = (await this.channel.sendEmbed(embed)) ?? null;
    }

    await messageDelete;
  }

  async delete(): Promise<void> {
    if (this.message) {
      const deletePromise = this.message.delete();
      this.message = null;
      await deletePromise;
    }
  }

  private updateHandler = async () => {
    if (!this.updating) {
      this.updating = true;
      try {
        if (this.message) {
          const size = await this.queue.size();
          if (this.start >= size) {
            this.start = 0;
          } else if (this.start < 0) {
            this.start = Math.max(0, size - QUEUE_PAGE_LENGTH);
          }
          if (size || this.queue.loop) {
            const [tracks, loop] = await this.queue.get(this.start, QUEUE_PAGE_LENGTH);
            const pagingButtonsDisabled = size <= QUEUE_PAGE_LENGTH;
            const newEmbed = createQueueEmbed(tracks, loop, this.start, size, this.queue.loop);
            newEmbed.buttons = [
              { emoji: '🔀', onClick: this.shuffleHandler, disabled: size <= 1 },
              { emoji: '⬅', onClick: this.prevPageHandler, disabled: pagingButtonsDisabled },
              { emoji: '➡', onClick: this.nextPageHandler, disabled: pagingButtonsDisabled },
            ];
            await this.message.editEmbed(newEmbed);
          } else {
            await this.delete();
          }
        }
      } finally {
        this.updating = false;
      }
    }
  };

  private shuffleHandler: MessageButtonOnClickHandler = async interaction => {
    await this.queue.shuffle();
    await interaction.deferUpdate();
    return false;
  };

  private prevPageHandler: MessageButtonOnClickHandler = async interaction => {
    this.start -= QUEUE_PAGE_LENGTH;
    await this.updateHandler();
    await interaction.deferUpdate();
    return false;
  };

  private nextPageHandler: MessageButtonOnClickHandler = async interaction => {
    this.start += QUEUE_PAGE_LENGTH;
    await this.updateHandler();
    await interaction.deferUpdate();
    return false;
  };

}

export class DiscordPlayerDisplay implements PlayerDisplay {

  private track: Track | null = null;
  private message: ContextMessage | null = null;

  private channel: ContextTextChannel | null = null;
  private sendable?: ContextSendable;
  private queueAhead = false;
  private inputLock = false;
  private nightcore = false;

  constructor(private readonly player: Player, private readonly queueDisplay: QueueDisplay) {
    this.player.on('next', this.onNextHandler);
    this.player.on('update', this.onUpdateHandler);
    this.player.on('idle', this.onIdleHandler);
    this.player.on('done', this.onEndHandler);
    this.player.on('error', this.onErrorHandler);
    this.player.on('retry', this.onRetryHandler);
    this.player.on('trackFailure', this.onTrackFailureHandler);
    this.player.queue.on('add', this.onQueueUpdateHandler);
    this.player.queue.on('remove', this.onQueueUpdateHandler);
  }

  async close(): Promise<void> {
    this.player.removeListener('next', this.onNextHandler);
    this.player.removeListener('update', this.onUpdateHandler);
    this.player.removeListener('idle', this.onIdleHandler);
    this.player.removeListener('done', this.onEndHandler);
    this.player.removeListener('error', this.onErrorHandler);
    this.player.removeListener('retry', this.onRetryHandler);
    this.player.removeListener('trackFailure', this.onTrackFailureHandler);
    this.player.queue.removeListener('add', this.onQueueUpdateHandler);
    this.player.queue.removeListener('remove', this.onQueueUpdateHandler);
    this.channel = null;
    await this.removeIdle();
  }

  async removeIdle(): Promise<void> {
    if (this.message) {
      const temp = this.message;
      this.message = null;

      temp.releaseButtons();
      await temp.editEmbed(createBasicEmbed('**Player has been removed due to idle**'));
    }
  }

  setChannel(channel: ContextTextChannel, sendable?: ContextSendable): void {
    this.channel = channel;
    this.sendable = sendable;
  }

  async refresh(): Promise<void> {
    await this.updateMessage();
  }

  private onQueueUpdateHandler = async () => {
    await this.updateMessage(true);
  };

  private onNextHandler = async (track: Track) => {
    this.nightcore = this.player.nightcore;
    this.track = track;
    await this.updateMessage();
  };

  private async updateMessage(editOnly = false): Promise<void> {
    if (this.channel && this.track && (!editOnly || this.message)) {
      const [next, prev] = await Promise.all([
        this.player.queue.size(),
        this.player.queue.peekReverse(1),
      ]);
      const embed = createPlayingEmbed(this.track, this.player.volume, this.nightcore);
      embed.buttons = [
        {
          emoji: '⏏',
          onClick: this.queueHandler,
          disabled: !next && (!this.player.queue.loop || !prev),
          permission: UserPermission.DJLimited,
        },
        { emoji: '⏪', onClick: this.backHandler, disabled: !prev, permission: UserPermission.DJ },
        {
          emoji: this.player.paused ? '▶️' : '⏸️',
          onClick: this.onPauseResumeHandler,
          permission: UserPermission.DJ,
        },
        { emoji: '⏩', onClick: this.skipHandler, permission: UserPermission.DJ },
        { emoji: '⏹', onClick: this.stopHandler, permission: UserPermission.DJ },
      ];
      if (!editOnly && (!this.message || this.channel.lastMessageId !== this.message.id)) {
        await this.safeDelete();
        if (this.sendable) {
          this.message = (await this.sendable.sendEmbed(embed)) ?? null;
          this.sendable = undefined;
        } else {
          this.message = (await this.channel.sendEmbed(embed)) ?? null;
        }
        if (this.message) {
          this.queueAhead = false;
        }
      } else if (this.message) {
        await this.message.editEmbed(embed);
      }
    }
  }

  private onIdleHandler = () => this.removeIdle();

  private onUpdateHandler = async () => {
    if (this.message && this.track) {
      await this.updateMessage(true);
    }
  };

  private async safeDelete(): Promise<void> {
    if (this.message) {
      const deletePromise = this.message.delete();
      this.message = null;
      await deletePromise;
    }
  }

  private onEndHandler = async () => {
    this.track = null;
    const msg = 'Goodbye 👋';
    if (this.message) {
      const temp = this.message;
      this.message = null;
      temp.releaseButtons();
      await temp.edit(msg);
    } else {
      this.channel?.send(msg);
    }
  };

  private onErrorHandler = async () => {
    if (this.track) {
      this.track = null;
      await this.safeDelete();
      await this.channel?.send(
        `Hmm.. there was an issue with streaming that. Check here if it is a known issue or to report it: ${GITHUB_PAGE_ISSUES}`
      );
    }
  };

  private onRetryHandler = async () => {
    if (this.track) {
      await this.channel?.send('Error occured while streaming. Retrying...');
    }
  };

  private onTrackFailureHandler = async (track: Track) => {
    await this.channel?.send(
      `❌ I could not find stream for **${track.title}** by **${track.poster}**. Skipping.`
    );
  };

  // Tries to ensure that button presses during an operation will be ignored
  private lock(cb: MessageButtonOnClickHandler): MessageButtonOnClickHandler {
    return async (interaction, emoji) => {
      if (!this.inputLock) {
        const userVoice = interaction.user.getVoice();
        if (userVoice && userVoice.id === this.player.getChannel()?.id) {
          this.inputLock = true;
          try {
            const result = await cb(interaction, emoji);
            await interaction.deferUpdate();
            return result;
          } finally {
            this.inputLock = false;
          }
        } else {
          await interaction.send(
            'You are not currently listening! Join my voice channel and try again.',
            { ephemeral: true }
          );
        }
      }
      return false;
    };
  }

  private onPauseResumeHandler: MessageButtonOnClickHandler = this.lock(async () => {
    if (this.player.paused) {
      await this.player.resume();
    } else {
      await this.player.pause();
    }
    return false;
  });

  private backHandler: MessageButtonOnClickHandler = this.lock(async () => {
    if (await this.player.queue.unpop(2)) {
      await this.player.skip();
      if (this.message && this.channel && this.channel.lastMessageId !== this.message.id) {
        await this.safeDelete();
      }
    }
    return false;
  });

  private skipHandler: MessageButtonOnClickHandler = this.lock(async () => {
    await this.player.skip();
    if (this.message && this.channel && this.channel.lastMessageId !== this.message.id) {
      await this.safeDelete();
    }
    return false;
  });

  private stopHandler: MessageButtonOnClickHandler = this.lock(async () => {
    this.player.stop();
    await this.safeDelete();
    return false;
  });

  private queueHandler: MessageButtonOnClickHandler = this.lock(async () => {
    if (this.queueAhead) {
      await this.queueDisplay.delete();
      this.queueAhead = false;
    } else if (this.channel) {
      this.queueDisplay.setChannel(this.channel);
      const size = await this.player.queue.size();
      if (size > 0 || this.player.queue.loop) {
        const [tracks, loop] = await this.player.queue.get(0, QUEUE_PAGE_LENGTH);
        this.queueDisplay.send(tracks, loop, 0, size);
        this.queueAhead = true;
      }
    }
    return false;
  });

}
