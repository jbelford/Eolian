import { PlayerDisplay, QueueDisplay, ServerQueue } from 'data/@types';
import { createPlayingEmbed, createQueueEmbed } from 'embed';
import { Player, Track } from 'music/@types';
import { ContextMessage, ContextTextChannel, MessageButtonOnClickHandler } from './@types';

const QUEUE_LENGTH = 15;

export class DiscordQueueDisplay implements QueueDisplay {

  private message?: ContextMessage;
  private channel?: ContextTextChannel;
  private start = 0;
  private updating = false;

  constructor(private readonly queue: ServerQueue) {
    this.queue.on('update', () => this.updateHandler());
  }

  setChannel(channel: ContextTextChannel) {
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
      await this.message.delete();
      this.message = undefined;
    }
  }

  private async updateHandler(): Promise<void> {
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

  private messageCache?: ContextMessage;
  private channel?: ContextTextChannel;
  private queueAhead = false;

  constructor(private readonly player: Player,
      private readonly queueDisplay: QueueDisplay) {
    this.player.on('next', this.onNextHandler);
    this.player.on('done', this.onEndHandler);
  }

  setChannel(channel: ContextTextChannel) {
    this.channel = channel;
  }

  private onNextHandler = async (track: Track) => {
    await this.onEndHandler();

    if (this.channel) {
      const embed = createPlayingEmbed(track);
      embed.buttons = [
        { emoji: '⏏', onClick: this.queueHandler },
        { emoji: '⏯', onClick: this.onPauseResumeHandler },
        { emoji: '⏩', onClick: this.skipHandler },
        { emoji: '⏹', onClick: this.stopHandler },
      ];
      this.messageCache = await this.channel.sendEmbed(embed);
      this.queueAhead = false;
    }
  };

  private onEndHandler = async () => {
    if (this.messageCache) {
      await this.messageCache.delete();
      this.messageCache = undefined;
    }
  };

  private onPauseResumeHandler: MessageButtonOnClickHandler = async (msg, user, emoji) => {
    if (this.player.paused) {
      await this.player.resume();
    } else {
      await this.player.pause();
    }
    return false;
  };

  private skipHandler: MessageButtonOnClickHandler = async (msg, user, emoji) => {
    await this.player.skip();
    await this.onEndHandler();
    return false;
  };

  private stopHandler: MessageButtonOnClickHandler = async (msg, user, emoji) => {
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
      this.queueDisplay.send(tracks);
      this.queueAhead = true;
    }
    return false;
  }

}