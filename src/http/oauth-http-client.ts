import { logger } from '@eolian/common/logger';
import { HttpRequestError, httpRequest } from './request';
import { TokenProvider, IOAuthHttpClient, HttpRequestParams } from './@types';
import { Readable } from 'stream';

export class OAuthHttpClient<T extends TokenProvider> implements IOAuthHttpClient<T> {
  private expiration = 0;
  private accessToken?: string;

  constructor(
    readonly baseApiUrl: string,
    readonly tokenProvider: T,
  ) {}

  get<T>(path: string, params = {}): Promise<T> {
    return this.checkGetRequest(`${this.baseApiUrl}/${path}`, params);
  }

  getUri<T>(uri: string): Promise<T> {
    return this.checkGetRequest(uri);
  }

  getStream(uri: string): Promise<Readable> {
    return this.checkGetRequest<Readable>(uri, undefined, true);
  }

  private async checkGetRequest<T>(
    url: string,
    params?: HttpRequestParams,
    stream = false,
  ): Promise<T> {
    if (Date.now() + 10000 >= this.expiration) {
      await this.updateToken();
    }
    try {
      return await this.getRequest<T>(url, params, stream);
    } catch (e) {
      if (!(e instanceof HttpRequestError) || e.body.error !== 'invalid_grant') {
        throw e;
      }
      await this.updateToken();
      return await this.getRequest<T>(url, params, stream);
    }
  }

  private async getRequest<T>(url: string, params?: HttpRequestParams, stream = false) {
    logger.info(`%s HTTP: %s - %s`, this.tokenProvider.name, url, params);
    return await httpRequest<T>(url, { params, json: !stream, auth: { bearer: this.accessToken } });
  }

  private async updateToken() {
    const data = await this.tokenProvider.getToken();
    this.accessToken = data.access_token;
    this.expiration = Date.now() + data.expires_in * 1000;
  }
}
