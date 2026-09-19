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
import { E2ETestControl } from './e2e-test-control';
import { isE2ETestPlayRequest } from './e2e-test-control-options';
import { environment } from '@eolian/common/env';
import crypto from 'crypto';

export class WebServer implements Closable {
  private readonly app = express();
  private server: Server | undefined;

  constructor(
    private readonly port: number,
    private readonly authProviders: IAuthServiceProvider,
    e2eControl?: E2ETestControl,
  ) {
    this.app.get('/healthz', (req, res) => {
      res.status(200).send('OK');
    });

    if (environment.e2eControl && e2eControl) {
      const e2eConfig = environment.e2eControl;
      const authorize: RequestHandler = (req, res, next) => {
        if (!e2eConfig.allowRemote && !isLoopback(req.ip)) {
          res.status(403).json({ error: 'Remote E2E control access is disabled' });
          return;
        }
        const authorization = req.header('authorization');
        const expected = `Bearer ${e2eConfig.token}`;
        if (!safeEqual(authorization, expected)) {
          res.status(401).json({ error: 'Invalid E2E control authorization' });
          return;
        }
        next();
      };
      const handle = (operation: (req: express.Request) => Promise<unknown>): RequestHandler => {
        return async (req, res) => {
          try {
            res.status(200).json(await operation(req));
          } catch (error) {
            logger.warn('E2E control request failed: %s', error);
            res.status(409).json({
              error: error instanceof Error ? error.message : 'E2E control request failed',
            });
          }
        };
      };

      this.app.use('/test-control', authorize, express.json({ limit: '4kb' }));
      this.app.post(
        '/test-control/play',
        handle(async req => {
          if (!isE2ETestPlayRequest(req.body)) {
            throw new Error('Invalid E2E play request');
          }
          return await e2eControl.play(req.body);
        }),
      );
      this.app.get(
        '/test-control/state',
        handle(async () => await e2eControl.getState()),
      );
      this.app.post(
        '/test-control/cleanup',
        handle(async req => {
          if (!req.body || typeof req.body.runId !== 'string') {
            throw new Error('Cleanup requires a runId');
          }
          return await e2eControl.cleanup(req.body.runId);
        }),
      );
    }

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

    function isLoopback(ip: string | undefined): boolean {
      return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    }

    function safeEqual(actual: string | undefined, expected: string): boolean {
      if (!actual) {
        return false;
      }
      const actualBuffer = Buffer.from(actual);
      const expectedBuffer = Buffer.from(expected);
      return (
        actualBuffer.length === expectedBuffer.length &&
        crypto.timingSafeEqual(actualBuffer, expectedBuffer)
      );
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
