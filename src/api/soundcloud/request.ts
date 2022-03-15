import { ClientCredentialsProvider, OAuthRequestImpl } from 'api/auth';
import { environment } from 'common/env';
import { RequestOptions } from 'common/request';

const SOUNDCLOUD_API = 'https://api.soundcloud.com';
const SOUNDCLOUD_TOKEN = `${SOUNDCLOUD_API}/oauth2/token`;

const SOUNDCLOUD_AUTH_OPTIONS: RequestOptions = {
  form: {
    client_id: environment.tokens.soundcloud.clientId,
    client_secret: environment.tokens.soundcloud.clientSecret,
  },
};

const clientCredentials = new ClientCredentialsProvider(
  'SoundCloud',
  SOUNDCLOUD_TOKEN,
  SOUNDCLOUD_AUTH_OPTIONS
);

export const CLIENT_SOUNDCLOUD_REQUEST = new OAuthRequestImpl(SOUNDCLOUD_API, clientCredentials);
