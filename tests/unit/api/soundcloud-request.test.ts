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
    tokens: { soundcloud: { clientId: 'soundcloud-id', clientSecret: 'soundcloud-secret' } },
  },
}));
vi.mock('@eolian/http', () => ({
  ClientCredentialsProvider,
  AuthorizationCodeProvider,
  OAuthHttpClient,
  AuthService,
}));

import {
  CLIENT_SOUNDCLOUD_REQUEST,
  createSoundCloudAuthorizationCodeProvider,
  createSoundCloudAuthService,
  createSoundCloudRequest,
} from '@eolian/api/soundcloud/soundcloud-request';

const authOptions = {
  form: { client_id: 'soundcloud-id', client_secret: 'soundcloud-secret' },
};

describe('SoundCloud request factories', () => {
  it('constructs client-credential and custom-token HTTP clients', () => {
    expect(CLIENT_SOUNDCLOUD_REQUEST).toEqual({
      kind: 'oauth-client',
      args: [
        'https://api.soundcloud.com',
        {
          kind: 'client-credentials',
          args: ['SoundCloud', 'https://api.soundcloud.com/oauth2/token', authOptions],
        },
      ],
    });

    const tokenProvider = { name: 'user-token', getToken: vi.fn() };
    expect(createSoundCloudRequest(tokenProvider)).toEqual({
      kind: 'oauth-client',
      args: ['https://api.soundcloud.com', tokenProvider],
    });
  });

  it('constructs authorization-code providers with refresh tokens', () => {
    const provider = { authorize: vi.fn() };
    createSoundCloudAuthorizationCodeProvider(provider as never, 'refresh-token');

    expect(AuthorizationCodeProvider).toHaveBeenCalledWith(
      'SoundCloud',
      'https://api.soundcloud.com/oauth2/token',
      authOptions,
      provider,
      'refresh-token',
    );
  });

  it('constructs the SoundCloud authorization service', () => {
    const cache = { get: vi.fn(), set: vi.fn(), del: vi.fn() };
    createSoundCloudAuthService(cache as never);

    expect(AuthService).toHaveBeenCalledWith(
      'SoundCloud',
      'https://api.soundcloud.com/connect',
      'https://api.soundcloud.com/oauth2/token',
      {
        client_id: 'soundcloud-id',
        redirect_uri: 'https://eolian.test/callback/soundcloud',
      },
      authOptions,
      cache,
    );
  });
});
