import { Closable } from 'common/@types';
import express from 'express';
import { logger } from 'common/logger';
import { Server } from 'http';

export class WebServer implements Closable {

  private readonly app = express();
  private server: Server | undefined;

  constructor(private readonly port: number) {
    this.app.get('/', (req, res) => {
      res.send('Eolian Bot');
    });
  }

  start(): void {
    this.server = this.app.listen(this.port, () => {
      logger.info('App listening on port %d', this.port);
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server?.listening) {
        this.server.close(err => (err ? reject(err) : resolve()));
      } else {
        resolve();
      }
    });
  }

}
