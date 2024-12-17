import { Track } from '@eolian/api/@types';
import { UserPermission } from '@eolian/common/constants';
import { createBasicEmbed, createQueueEmbed } from '@eolian/embed';
import {
  QueueDisplay,
  ContextMessage,
  ContextTextChannel,
  ContextSendable,
  MessageButtonOnClickHandler,
  ContextMusicQueue,
} from './@types';

export const QUEUE_PAGE_LENGTH = 15;

export class DiscordQueueDisplay implements QueueDisplay {
  private message: ContextMessage | null = null;
  private channel: ContextTextChannel | null = null;
  private sendable?: ContextSendable;
  private start = 0;
  private updating = false;

  constructor(private readonly queue: ContextMusicQueue) {
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
