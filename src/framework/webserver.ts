import { Closable } from 'common/@types';
import express from 'express';
import { logger } from 'common/logger';
import { Server } from 'http';
import { AuthProviders } from 'api';

export class WebServer implements Closable {

  private readonly app = express();
  private server: Server | undefined;

  constructor(private readonly port: number, private readonly authProviders: AuthProviders) {
    this.app.get('/', (req, res) => {
      res.send('Eolian Bot');
    });
    this.app.get('/callback/spotify', (req, res) => {
      this.authProviders.spotify.callback({
        state: req.query.state as string,
        code: req.query.code as string,
        err: req.query.error as string,
      });
      res.send('Authenticated! You may close this window.');
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
