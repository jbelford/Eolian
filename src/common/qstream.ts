import { StreamData } from 'music/@types';
import { Readable } from 'stream';

export class QueueStream extends Readable {

  private current?: StreamData;
  // @ts-ignore
  private fetchLimit: number;
  private isDestroyed = false;

  /**
   * @param peekNext a function which returns the next stream of data to be processed
   * @param popNext a function which is called after the data has begun processing
   * @param kBps expected bitrate of consumer
   * @param prefetch buffer time to fetch next stream in seconds
   */
  constructor(
    private readonly peekNext: () => Promise<StreamData | undefined>,
    private readonly popNext: () => Promise<void>,
    kBps = 16,
    private readonly prefetch = 5) {
    super();
    this.setBitrate(kBps);
    this.startReadLoop();
  }

  setBitrate(kBps: number) {
    this.fetchLimit = 1000 * kBps * this.prefetch;
  }

  _read() {
    if (this.current) {
      this.current.readable.resume();
    }
  }

  _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    this.isDestroyed = true;
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
      this.current = await this.peekNext();
      await this.popNext();
      if (this.current) {
        for (;;) {
          this.current = await this.process(this.current);
          if (!this.current) {
            await this.popNext();
            break;
          } else if (this.isDestroyed) {
            this.current.readable.destroy();
            break;
          }
          await this.popNext();
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
          nextData = this.peekNext();
        }
      });

      data.readable.on('error', this.emitError);

      data.readable.on('end', () => {
        if (!nextData) {
          nextData = this.peekNext();
        }
        nextData.then(resolve, reject);
      });

      data.readable.resume();
    });

  }

  private emitError = (err?: unknown) => this.emit('error', err);
  private emitEnd = () => this.emit('end');

}
