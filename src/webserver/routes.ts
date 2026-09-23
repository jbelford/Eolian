import { TrackSource } from '@eolian/api/@types';
import { GITHUB_PAGE } from '@eolian/common/constants';
import { feature } from '@eolian/data';
import { FeatureFlag } from '@eolian/data/@types';
import { IAuthServiceProvider } from '@eolian/framework/@types';
import { FastifyPluginAsync } from 'fastify';

interface WebServerRoutesOptions {
  authProviders: IAuthServiceProvider;
}

interface AuthCallbackQuery {
  state?: string;
  code?: string;
  error?: string;
}

export const registerWebServerRoutes: FastifyPluginAsync<WebServerRoutesOptions> = async (
  server,
  { authProviders },
) => {
  server.get('/healthz', async (_request, reply) => {
    return reply.type('text/plain').send('OK');
  });

  server.get('/', async (_request, reply) => {
    return reply.redirect(GITHUB_PAGE);
  });

  function registerAuthCallback(path: string, source: TrackSource): void {
    server.get<{ Querystring: AuthCallbackQuery }>(path, async (request, reply) => {
      const { state, code, error } = request.query;
      if (!state) {
        return reply.status(400).type('text/plain').send('Missing state query param!');
      }

      const success = await authProviders.getService(source).callback({
        state,
        code,
        err: error,
      });
      if (!success) {
        return reply
          .status(400)
          .type('text/plain')
          .send('Failed to authorize! Try again with a new link.');
      }
      return reply.type('text/plain').send('Authenticated! You may close this window.');
    });
  }

  if (feature.enabled(FeatureFlag.SPOTIFY_AUTH)) {
    registerAuthCallback('/callback/spotify', TrackSource.Spotify);
  }

  if (feature.enabled(FeatureFlag.SOUNDCLOUD_AUTH)) {
    registerAuthCallback('/callback/soundcloud', TrackSource.SoundCloud);
  }
};
