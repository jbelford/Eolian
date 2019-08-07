import { StreamData } from 'music/@types';
import { Readable } from 'stream';

export class QueueStream extends Readable {

  private current?: StreamData;
  private fetchLimit: number;
  private destroyed = false;

  /**
   * @param supplier a function which returns the next stream of data to be processed
   * @param kBps expected bitrate of consumer (default: 16 kBps)
   * @param prefetch buffer time to fetch next stream (default: 15 seconds)
   */
  constructor(private readonly supplier: () => Promise<StreamData | undefined>, kBps = 16, prefetch = 15) {
    super();
    this.fetchLimit = 1000 * kBps * prefetch;
    this.startReadLoop();
  }

  _read() {
    if (this.current) {
      this.current.readable.resume();
    }
  }

  _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    this.destroyed = true;
    if (this.current) {
      this.current.readable.destroy(error || undefined);
    }
    callback();
  }

  skip() {
    if (this.current) {
      this.current.readable.destroy();
    }
  }

  private async startReadLoop() {
    try {
      this.current = await this.supplier();
      if (this.current) {
        for (;;) {
          this.current = await this.process(this.current);
          if (!this.current || this.destroyed) {
            if (this.current) this.current.readable.destroy();
            break;
          }
          this.emitNext(this.current.details);
        }
      }
    } catch (err) {
      this.emitError(err);
    } finally {
      this.emitEnd();
    }
  }

  private process(data: StreamData): Promise<StreamData | undefined> {
    return new Promise((resolve, reject) => {
      let nextData: Promise<StreamData | undefined>;
      let fetched = 0;

      data.readable.on('data', chunk => {
        fetched += chunk.length;
        if (!this.push(chunk)) {
          data.readable.pause();
        }

        if (!nextData && data.size - fetched <= this.fetchLimit) {
          nextData = this.supplier();
        }
      });

      data.readable.on('error', this.emitError);

      data.readable.on('end', () => {
        if (nextData) {
          nextData.then(resolve, reject);
        } else {
          resolve();
        }
      });
    });
  }

  private emitError = (err?: unknown) => this.emit('error', err);
  private emitNext = (details: unknown) => this.emit('next', details);
  private emitEnd = () => this.emit('end');

}
