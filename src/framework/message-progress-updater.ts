import { ProgressUpdater } from '@eolian/common/@types';
import { ContextMessage, ContextSendable } from './@types';

export class MessageProgressUpdater implements ProgressUpdater<string> {
  private lastSent = 0;
  private value?: string;
  private message?: ContextMessage;
  private updatePromise?: Promise<void>;

  constructor(
    private readonly sendable: ContextSendable,
    private readonly refreshInterval = 1000,
    private readonly finishedMessage?: string,
  ) {}

  init(value?: string): void {
    this.updatePromise = Promise.resolve();
    if (value) {
      this.update(value);
    }
  }

  update(value: string): void {
    if (this.updatePromise) {
      this.value = value;
      this.updatePromise = this.updatePromise.then(this._update);
    }
  }

  async done(): Promise<void> {
    await this.updatePromise;
    if (this.finishedMessage) {
      await this.message?.edit(this.finishedMessage);
    } else {
      await this.message?.delete();
    }
    this.updatePromise = undefined;
    this.message = undefined;
  }

  private _update = async () => {
    if (Date.now() - this.lastSent >= this.refreshInterval) {
      this.lastSent = Date.now();
      const text = this.value!;
      if (this.message) {
        await this.message.edit(text);
      } else {
        this.message = await this.sendable.send(text, { ephemeral: false });
      }
    }
  };
}
