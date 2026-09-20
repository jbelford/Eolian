import { describe, expect, it, vi } from 'vitest';

const { ClientCredentialsProvider, AuthorizationCodeProvider, OAuthHttpClient, AuthService } =
  vi.hoisted(() => ({
    ClientCredentialsProvider: vi.fn(function (...args: unknown[]) {
      return { kind: 'client-credentials', args };
    }),
    AuthorizationCodeProvider: vi.fn(function (...args: unknown[]) {
      return { kind: 'authorization-code', args };
    }),
    OAuthHttpClient: vi.fn(function (...args: unknown[]) {
      return { kind: 'oauth-client', args };
    }),
    AuthService: vi.fn(function (...args: unknown[]) {
      return { kind: 'auth-service', args };
    }),
  }));

vi.mock('@eolian/common/env', () => ({
  environment: {
    baseUri: 'https://eolian.test',
    tokens: { spotify: { clientId: 'spotify-id', clientSecret: 'spotify-secret' } },
  },
}));
vi.mock('@eolian/http', () => ({
  ClientCredentialsProvider,
  AuthorizationCodeProvider,
  OAuthHttpClient,
  AuthService,
}));

import {
  CLIENT_SPOTIFY_REQUEST,
  createSpotifyAuthorizationCodeProvider,
  createSpotifyAuthService,
  createSpotifyRequest,
} from '@eolian/api/spotify/spotify-request';

describe('Spotify request factories', () => {
  it('constructs client-credential and custom-token HTTP clients', () => {
    expect(CLIENT_SPOTIFY_REQUEST).toEqual({
      kind: 'oauth-client',
      args: [
        'https://api.spotify.com/v1',
        {
          kind: 'client-credentials',
          args: [
            'Spotify',
            'https://accounts.spotify.com/api/token',
            { auth: { basic: { id: 'spotify-id', password: 'spotify-secret' } } },
          ],
        },
      ],
    });

    const tokenProvider = { name: 'user-token', getToken: vi.fn() };
    expect(createSpotifyRequest(tokenProvider)).toEqual({
      kind: 'oauth-client',
      args: ['https://api.spotify.com/v1', tokenProvider],
    });
  });

  it('constructs authorization-code providers with refresh tokens', () => {
    const provider = { authorize: vi.fn() };
    createSpotifyAuthorizationCodeProvider(provider as never, 'refresh-token');

    expect(AuthorizationCodeProvider).toHaveBeenCalledWith(
      'Spotify',
      'https://accounts.spotify.com/api/token',
      { auth: { basic: { id: 'spotify-id', password: 'spotify-secret' } } },
      provider,
      'refresh-token',
    );
  });

  it('constructs the scoped Spotify authorization service', () => {
    const cache = { get: vi.fn(), set: vi.fn(), del: vi.fn() };
    createSpotifyAuthService(cache as never);

    expect(AuthService).toHaveBeenCalledWith(
      'Spotify',
      'https://accounts.spotify.com/authorize',
      'https://accounts.spotify.com/api/token',
      {
        client_id: 'spotify-id',
        redirect_uri: 'https://eolian.test/callback/spotify',
        scope:
          'user-library-read,user-top-read,user-read-recently-played,playlist-read-collaborative,playlist-read-private',
      },
      { auth: { basic: { id: 'spotify-id', password: 'spotify-secret' } } },
      cache,
    );
  });
});
