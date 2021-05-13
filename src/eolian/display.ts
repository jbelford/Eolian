import { QueueDisplay } from 'data/@types';
import { createQueueEmbed } from 'embed';
import { Track } from 'music/@types';
import { ContextMessage, ContextTextChannel } from './@types';
import { GuildQueue } from './queue';

export class DiscordQueueDisplay implements QueueDisplay {

  private message?: ContextMessage;
  private channel?: ContextTextChannel;
  private updating = false;

  constructor(private readonly queue: GuildQueue) {
    this.queue.on('update', () => this.updateHandler());
  }

  setChannel(channel: ContextTextChannel) {
    this.channel = channel;
  }

  async send(tracks: Track[], start = 0, total = tracks.length): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel is not set!');
    }

    const messageDelete = this.message ? this.message.delete() :Promise.resolve();

    const embed = createQueueEmbed(tracks.slice(0, 15), start, total);
    embed.buttons = [
      { emoji: '🔀', onClick: () => this.shuffleHandler() }
    ];
    this.message = await this.channel.sendEmbed(embed);

    await messageDelete;
  }

  private async updateHandler(): Promise<void> {
    if (!this.updating) {
      this.updating = true;
      try {
        const messageDelete = this.message ? this.message.delete() :Promise.resolve();
        this.message = undefined;
        if (this.channel) {
          const tracks = await this.queue.get();
          await this.send(tracks);
        }
        await messageDelete;
      } finally {
        this.updating = false;
      }
    }
  }

  private async shuffleHandler(): Promise<boolean> {
    await this.queue.shuffle();
    return false;
  }

}