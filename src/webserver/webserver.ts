import { Closable } from '@eolian/common/@types';
import { logger } from '@eolian/common/logger';
import { IAuthServiceProvider } from '@eolian/framework/@types';
import { FastifyInstance } from 'fastify';
import { createWebServerInstance } from './instance';

export class WebServer implements Closable {
  private started = false;

  constructor(
    private readonly port: number,
    authProviders: IAuthServiceProvider,
    private readonly server: FastifyInstance = createWebServerInstance(authProviders),
  ) {}

  async start(): Promise<void> {
    await this.server.listen({ port: this.port, host: '0.0.0.0' });
    this.started = true;
    logger.info('App listening on port %d', this.port);
  }

  async close(): Promise<void> {
    if (!this.started) {
      return;
    }
    await this.server.close();
    this.started = false;
  }
}
