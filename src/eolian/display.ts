import { PlayerDisplay, QueueDisplay, ServerQueue } from 'data/@types';
import { createBasicEmbed, createPlayingEmbed, createQueueEmbed } from 'embed';
import { Player, Track } from 'music/@types';
import { ContextMessage, ContextTextChannel, MessageButtonOnClickHandler } from './@types';

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
    this.message = await this.channel.sendEmbed(embed);

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

  private messageCache: ContextMessage | null = null;
  private channel: ContextTextChannel | null = null;
  private queueAhead = false;
  private inputLock = false;

  constructor(private readonly player: Player,
      private readonly queueDisplay: QueueDisplay) {
    this.player.on('next', this.onNextHandler);
    this.player.on('idle', this.onIdleHandler);
    this.player.on('done', this.onEndHandler);
  }

  async close(): Promise<void> {
    this.player.removeListener('next', this.onNextHandler);
    this.player.removeListener('idle', this.onIdleHandler);
    this.player.removeListener('done', this.onEndHandler);
    this.channel = null;
    await this.removeIdle();
  }

  async removeIdle(): Promise<void> {
    if (this.messageCache) {
      const temp = this.messageCache;
      this.messageCache = null;

      temp.releaseButtons();
      await temp.editEmbed(createBasicEmbed('**Player has been removed due to idle**'));
    }
  }

  setChannel(channel: ContextTextChannel): void {
    this.channel = channel;
  }

  private onNextHandler = async (track: Track) => {
    if (this.channel) {
      const embed = createPlayingEmbed(track);
      if (!this.messageCache || this.channel.lastMessageId !== this.messageCache.id) {
        embed.buttons = [
          { emoji: '⏏', onClick: this.lock(this.queueHandler) },
          { emoji: '⏯', onClick: this.lock(this.onPauseResumeHandler) },
          { emoji: '⏪', onClick: this.lock(this.backHandler) },
          { emoji: '⏩', onClick: this.lock(this.skipHandler) },
          { emoji: '⏹', onClick: this.lock(this.stopHandler) },
        ];
        await this.onEndHandler();
        this.messageCache = await this.channel.sendEmbed(embed);
        this.queueAhead = false;
      } else {
        await this.messageCache.editEmbed(embed);
      }
    }
  };

  private onIdleHandler = () => this.removeIdle();

  private onEndHandler = async () => {
    if (this.messageCache) {
      const deletePromise = this.messageCache.delete();
      this.messageCache = null;
      await deletePromise;
    }
  };

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

  private onPauseResumeHandler: MessageButtonOnClickHandler = async () => {
    if (this.player.paused) {
      await this.player.resume();
    } else {
      await this.player.pause();
    }
    return false;
  };

  private backHandler: MessageButtonOnClickHandler = async () => {
    if (await this.player.queue.unpop(2)) {
      await this.player.skip();
      if (this.messageCache && this.channel && this.channel.lastMessageId !== this.messageCache.id) {
        await this.onEndHandler();
      }
    }
    return false;
  };

  private skipHandler: MessageButtonOnClickHandler = async () => {
    await this.player.skip();
    if (this.messageCache && this.channel && this.channel.lastMessageId !== this.messageCache.id) {
      await this.onEndHandler();
    }
    return false;
  };

  private stopHandler: MessageButtonOnClickHandler = async () => {
    await this.player.stop();
    await this.onEndHandler();
    return false;
  };

  private queueHandler: MessageButtonOnClickHandler = async () => {
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
  }

}