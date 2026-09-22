import { StreamSource } from '../@types';
import { ProgressUpdater } from '@eolian/common/@types';
import { environment } from '@eolian/common/env';
import { logger } from '@eolian/common/logger';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { PassThrough, Readable } from 'node:stream';

const MAX_ERROR_LENGTH = 16_384;

export type YouTubeStreamSourceDependencies = {
  spawn: typeof spawn;
};

export class YouTubeStreamSource implements StreamSource {
  private readonly dependencies: YouTubeStreamSourceDependencies;

  constructor(
    private readonly url: string,
    private readonly id: string,
    private readonly progress?: ProgressUpdater<string>,
    dependencies: Partial<YouTubeStreamSourceDependencies> = {},
  ) {
    this.dependencies = { spawn, ...dependencies };
  }

  async get(): Promise<Readable> {
    const startedAt = performance.now();
    logger.info('Getting youtube stream %s - %s', this.url, this.id);
    this.progress?.update('📺 Fetching stream from YouTube...');

    const child = this.dependencies.spawn(environment.config.ytDlpPath, this.getArguments(), {
      env: this.getEnvironment(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const output = new PassThrough();
    let errorOutput = '';
    let spawned = false;
    let receivedDiagnostic = false;

    child.stdout.pipe(output, { end: false });
    child.stdout.once('data', () => {
      logger.debug('yt-dlp produced its first media bytes after %d ms', elapsed(startedAt));
    });
    child.stdout.once('error', error => output.destroy(error));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', data => {
      if (!receivedDiagnostic) {
        receivedDiagnostic = true;
        logger.debug('yt-dlp produced its first diagnostic after %d ms', elapsed(startedAt));
      }
      if (errorOutput.length < MAX_ERROR_LENGTH) {
        errorOutput += String(data).slice(0, MAX_ERROR_LENGTH - errorOutput.length);
      }
    });
    child.once('close', code => {
      logger.debug('yt-dlp exited after %d ms with code %s', elapsed(startedAt), code);
      if (code === 0) {
        output.end();
      } else if (code && !output.destroyed) {
        const details = errorOutput.trim();
        output.destroy(
          new Error(`yt-dlp exited with code ${code}${details ? `: ${details}` : ''}`),
        );
      }
    });
    output.once('close', () => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGTERM');
      }
    });

    await new Promise<void>((resolve, reject) => {
      child.once('spawn', () => {
        spawned = true;
        resolve();
      });
      child.once('error', error => {
        if (spawned) {
          output.destroy(error);
        } else {
          reject(error);
        }
      });
    });

    return output;
  }

  private getArguments(): string[] {
    const args = [
      '--no-config',
      '--no-playlist',
      '--no-progress',
      '--js-runtimes',
      `node:${process.execPath}`,
      '--format',
      'bestaudio/best',
      '--output',
      '-',
    ];

    if (environment.config.ytDlpCookiesPath) {
      args.push('--cookies', environment.config.ytDlpCookiesPath);
    }
    args.push(this.url);
    return args;
  }

  private getEnvironment(): NodeJS.ProcessEnv {
    const proxy = createProxyUrl();
    if (!proxy) {
      return process.env;
    }
    return {
      ...process.env,
      HTTP_PROXY: proxy,
      HTTPS_PROXY: proxy,
    };
  }
}

function elapsed(startedAt: number): number {
  return Math.round(performance.now() - startedAt);
}

function createProxyUrl(): string | undefined {
  if (!environment.proxy) {
    return undefined;
  }
  const sessionId = `sessid-${randomUUID()}`;
  const { user, password, name } = environment.proxy;
  return `http://${user}-cc-us-${sessionId}:${password}@${name}`;
}
