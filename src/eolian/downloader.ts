import { ProgressUpdater } from 'common/@types';
import { ContextMessage, ContextTextChannel } from './@types';


export class DownloaderDisplay implements ProgressUpdater {

  private lastSent = 0;
  private message: ContextMessage | null = null;
  private updatePromise: Promise<void> | null = null;

  constructor(private readonly channel: ContextTextChannel,
    private readonly name: string,
    private total: number = 1000,
    private readonly refreshInterval = 1500) {
  }

  init(total?: number): void {
    this.updatePromise = Promise.resolve();
    if (total) {
      this.total = total;
    }
  }

  update(value: number): void {
    if (this.updatePromise) {
      this.updatePromise = this.updatePromise.then(async () => {
        if (Date.now() - this.lastSent >= this.refreshInterval) {
          this.lastSent = Date.now();
          const text = `${this.name}: ${Math.round(100 * value / this.total)}%`;
          if (this.message) {
            await this.message.edit(text);
          } else {
            this.message = await this.channel.send(text);
          }
        }
      });
    }
  }

  async done(): Promise<void> {
    await this.updatePromise;
    await this.message?.edit(`${this.name}: 100%`);
    this.updatePromise = null;
    this.message = null;
  }
}
