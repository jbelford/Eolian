import { ProgressUpdater } from '@eolian/common/@types';
import { ContextMessage, ContextSendable } from './@types';

type IMessageProgressUpdaterOptions = {
  refreshInterval?: number;
  finishedMessage?: string;
  ephemeral?: boolean;
};

export class MessageProgressUpdater implements ProgressUpdater<string> {
  private lastSent = 0;
  private value?: string;
  private message?: ContextMessage;
  private updatePromise?: Promise<void>;
  private refreshInterval: number;

  constructor(
    private readonly sendable: ContextSendable,
    private readonly options: IMessageProgressUpdaterOptions = {},
  ) {
    this.refreshInterval = this.options.refreshInterval || 500;
    if (this.options.ephemeral && !this.options.finishedMessage) {
      throw new Error('Ephemeral progress updater must have a finished message!');
    }
  }

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
    if (this.options.finishedMessage) {
      await this.editMessage(this.options.finishedMessage);
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
      await this.editMessage(text);
    }
  };

  private editMessage = async (text: string) => {
    if (this.message && !this.options.ephemeral) {
      await this.message.edit(text);
    } else {
      this.message = await this.sendable.send(text, {
        ephemeral: this.options.ephemeral,
        editReply: true,
      });
    }
  };
}
