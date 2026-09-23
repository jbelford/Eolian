import { IAuthServiceProvider } from '@eolian/framework/@types';
import fastify, { FastifyInstance } from 'fastify';
import { registerWebServerRoutes } from './routes';

export function createWebServerInstance(authProviders: IAuthServiceProvider): FastifyInstance {
  const server = fastify();
  server.register(registerWebServerRoutes, { authProviders });
  return server;
}
