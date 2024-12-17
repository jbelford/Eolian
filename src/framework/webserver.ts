import { TrackSource } from '@eolian/api/@types';
import { Closable } from '@eolian/common/@types';
import { logger } from '@eolian/common/logger';
import { feature } from '@eolian/data';
import { FeatureFlag } from '@eolian/data/@types';
import express, { RequestHandler } from 'express';
import { Server } from 'http';
import { IAuthServiceProvider } from './@types';
import path from 'path';
import { GITHUB_PAGE } from '@eolian/common/constants';

export class WebServer implements Closable {
  private readonly app = express();
  private server: Server | undefined;

  constructor(
    private readonly port: number,
    private readonly authProviders: IAuthServiceProvider,
  ) {
    if (feature.enabled(FeatureFlag.WEBSITE)) {
      this.app.use(express.static(path.join(__dirname, 'public')));

      this.app.get('/', (req, res) => {
        res.render('index.html');
      });
    } else {
      this.app.get('/', (req, res) => {
        res.redirect(GITHUB_PAGE);
      });
    }

    if (feature.enabled(FeatureFlag.SPOTIFY_AUTH)) {
      this.app.get('/callback/spotify', this.authCallback(TrackSource.Spotify));
    }

    if (feature.enabled(FeatureFlag.SOUNDCLOUD_AUTH)) {
      this.app.get('/callback/soundcloud', this.authCallback(TrackSource.SoundCloud));
    }
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

  private authCallback(api: TrackSource): RequestHandler {
    return async (req, res) => {
      if (!req.query.state) {
        res.status(400).send('Missing state query param!');
      } else {
        const success = await this.authProviders.getService(api).callback({
          state: req.query.state as string,
          code: req.query.code as string,
          err: req.query.error as string,
        });
        if (success) {
          res.send('Authenticated! You may close this window.');
        } else {
          res.status(400).send('Failed to authorize! Try again with a new link.');
        }
      }
    };
  }
}
