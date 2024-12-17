import { ProgressUpdater } from '@eolian/common/@types';
import { ContextMessage, ContextSendable } from './@types';

const PROGRESS_BAR_SIZE = 15;

function renderProgressBar(name: string, value: number) {
  const loaded = Math.round((PROGRESS_BAR_SIZE * value) / 100);
  let bar = '';

  for (let i = 0; i < loaded; ++i) {
    bar += '▰';
  }

  for (let i = loaded; i < PROGRESS_BAR_SIZE; ++i) {
    bar += '▱';
  }

  return `${name}: ${value}%\n${bar}`;
}

export class DownloaderDisplay implements ProgressUpdater {
  private lastSent = 0;
  private value = 0;
  private message?: ContextMessage;
  private updatePromise?: Promise<void>;

  constructor(
    private readonly sendable: ContextSendable,
    private readonly name: string,
    private total: number = 1000,
    private readonly refreshInterval = 1000,
  ) {}

  init(total?: number): void {
    this.updatePromise = Promise.resolve();
    if (total) {
      this.total = total;
    }
  }

  update(value: number): void {
    if (this.updatePromise) {
      this.value = Math.round((100 * value) / this.total);
      this.updatePromise = this.updatePromise.then(this._update);
    }
  }

  async done(): Promise<void> {
    await this.updatePromise;
    await this.message?.edit(`${this.name}: 100%`);
    this.updatePromise = undefined;
    this.message = undefined;
  }

  private _update = async () => {
    if (Date.now() - this.lastSent >= this.refreshInterval) {
      this.lastSent = Date.now();
      const text = renderProgressBar(this.name, this.value);
      if (this.message) {
        await this.message.edit(text);
      } else {
        this.message = await this.sendable.send(text, { ephemeral: false });
      }
    }
  };
}
