import { Track } from 'api/@types';
import { GITHUB_PAGE_ISSUES } from 'common/constants';
import { ServerQueue } from 'data/@types';
import { createBasicEmbed, createPlayingEmbed, createQueueEmbed } from 'embed';
import { Player } from 'music/@types';
import { ContextMessage, ContextTextChannel, MessageButtonOnClickHandler, PlayerDisplay, QueueDisplay } from './@types';

const QUEUE_LENGTH = 15;

export class DiscordQueueDisplay implements QueueDisplay {

  private message: ContextMessage | null = null;
  private channel: ContextTextChannel | null = null;
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

  setChannel(channel: ContextTextChannel): void {
    this.channel = channel;
  }

  async send(tracks: Track[], start = 0, total = tracks.length): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel is not set!');
    }

    this.start = start;

    const messageDelete = this.message ? this.message.delete() :Promise.resolve();

    const embed = createQueueEmbed(tracks.slice(0, QUEUE_LENGTH), this.start, total);
    embed.buttons = [
      { emoji: '🔀', onClick: this.shuffleHandler },
      { emoji: '⬅', onClick: this.prevPageHandler },
      { emoji: '➡', onClick: this.nextPageHandler }
    ];
    this.message = await this.channel.sendEmbed(embed) ?? null;

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
          const tracks = await this.queue.get();
          if (this.start >= tracks.length) {
            this.start = 0;
          } else if (this.start < 0) {
            this.start = Math.max(0, tracks.length - QUEUE_LENGTH);
          }
          if (tracks.length) {
            const newEmbed = createQueueEmbed(tracks.slice(this.start, this.start + QUEUE_LENGTH), this.start, tracks.length);
            await this.message.editEmbed(newEmbed);
          } else {
            await this.delete();
          }
        }
      } finally {
        this.updating = false;
      }
    }
  }

  private shuffleHandler: MessageButtonOnClickHandler = async () => {
    await this.queue.shuffle();
    return false;
  }

  private prevPageHandler: MessageButtonOnClickHandler = async () => {
    this.start -= QUEUE_LENGTH;
    await this.updateHandler();
    return false;
  }


  private nextPageHandler: MessageButtonOnClickHandler = async () => {
    this.start += QUEUE_LENGTH;
    await this.updateHandler();
    return false;
  }

}

export class DiscordPlayerDisplay implements PlayerDisplay {

  private track: Track | null = null;
  private message: ContextMessage | null = null;

  private channel: ContextTextChannel | null = null;
  private queueAhead = false;
  private inputLock = false;
  private nightcore = false;

  constructor(private readonly player: Player,
      private readonly queueDisplay: QueueDisplay) {
    this.player.on('next', this.onNextHandler);
    this.player.on('volume', this.onVolumeHandler);
    this.player.on('idle', this.onIdleHandler);
    this.player.on('done', this.onEndHandler);
    this.player.on('error', this.onErrorHandler);
  }

  async close(): Promise<void> {
    this.player.removeListener('next', this.onNextHandler);
    this.player.removeListener('volume', this.onVolumeHandler);
    this.player.removeListener('idle', this.onIdleHandler);
    this.player.removeListener('done', this.onEndHandler);
    this.player.removeListener('error', this.onErrorHandler);
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

  setChannel(channel: ContextTextChannel): void {
    this.channel = channel;
  }

  async refresh(): Promise<void> {
    if (this.track) {
      await this.onNextHandler(this.track);
    }
  }

  private onNextHandler = async (track: Track) => {
    if (this.channel) {
      this.track = track;
      this.nightcore = this.player.nightcore;
      const embed = createPlayingEmbed(this.track, this.player.volume, this.nightcore);
      if (!this.message || this.channel.lastMessageId !== this.message.id) {
        embed.buttons = [
          { emoji: '⏏', onClick: this.queueHandler },
          { emoji: '⏯', onClick: this.onPauseResumeHandler },
          { emoji: '⏪', onClick: this.backHandler },
          { emoji: '⏩', onClick: this.skipHandler },
          { emoji: '⏹', onClick: this.stopHandler },
        ];
        await this.safeDelete();
        this.message = await this.channel.sendEmbed(embed) ?? null;
        if (this.message) {
          this.queueAhead = false;
        }
      } else {
        await this.message.editEmbed(embed);
      }
    }
  };

  private onIdleHandler = () => this.removeIdle();

  private onVolumeHandler = async () => {
    if (this.message && this.track) {
      const embed = createPlayingEmbed(this.track, this.player.volume, this.nightcore);
      await this.message.editEmbed(embed);
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
    await this.safeDelete();
    this.track = null;
  };

  private onErrorHandler = async () => {
    if (this.track) {
      this.track = null;
      await this.safeDelete();
      await this.channel?.send(`Hmm.. there was an issue with streaming that. Check here if it is a known issue or to report it: ${GITHUB_PAGE_ISSUES}`);
    }
  };

  // Tries to ensure that button presses during an operation will be ignored
  private lock(cb: MessageButtonOnClickHandler): MessageButtonOnClickHandler {
    return async (msg, usr, emoji) => {
      if (!this.inputLock) {
        this.inputLock = true;
        try {
          return await cb(msg, usr, emoji);
        } finally {
          this.inputLock = false;
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
        await this.onEndHandler();
      }
    }
    return false;
  });

  private skipHandler: MessageButtonOnClickHandler = this.lock(async () => {
    await this.player.skip();
    if (this.message && this.channel && this.channel.lastMessageId !== this.message.id) {
      await this.onEndHandler();
    }
    return false;
  });

  private stopHandler: MessageButtonOnClickHandler = this.lock(async () => {
    await this.player.stop();
    await this.onEndHandler();
    return false;
  });

  private queueHandler: MessageButtonOnClickHandler = this.lock(async () => {
    if (this.queueAhead) {
      await this.queueDisplay.delete();
      this.queueAhead = false;
    } else if (this.channel) {
      this.queueDisplay.setChannel(this.channel);
      const tracks = await this.player.queue.get();
      if (tracks.length) {
        this.queueDisplay.send(tracks);
        this.queueAhead = true;
      }
    }
    return false;
  });

}