import { logger } from '@eolian/common/logger';
import { promiseTimeout } from '@eolian/common/util';
import { EolianCache } from '@eolian/data/@types';
import { randomUUID } from 'crypto';
import {
  TokenResponseWithRefresh,
  IAuthService,
  HttpRequestOptions,
  AuthResult,
  AuthCallbackData,
  AuthCacheItem,
  AuthorizeParams,
} from './@types';
import { httpRequest, querystringify } from './request';

export class AuthService implements IAuthService {
  private options: HttpRequestOptions;

  constructor(
    private readonly name: string,
    private readonly authorizeUrl: string,
    private readonly tokenUrl: string,
    private readonly authorizeParams: AuthorizeParams,
    authenticationOptions: HttpRequestOptions,
    private readonly cache: EolianCache<AuthCacheItem>,
  ) {
    this.options = { ...authenticationOptions, method: 'POST', json: true };
    this.options.form = {
      ...this.options.form,
      grant_type: 'authorization_code',
      redirect_uri: this.authorizeParams.redirect_uri,
    };
  }

  authorize(): AuthResult {
    const state = randomUUID();
    const params = { ...this.authorizeParams, response_type: 'code', state };
    const link = `${this.authorizeUrl}?${querystringify(params)}`;
    const promise = new Promise<TokenResponseWithRefresh>((resolve, reject) => {
      this.cache.set(state, { resolve, reject });
    });
    return { link, response: promiseTimeout(promise, 60000) };
  }

  async callback(data: AuthCallbackData): Promise<boolean> {
    let success = false;
    const item = await this.cache.get(data.state);
    if (item) {
      if (data.err) {
        item.reject(data.err);
      } else if (data.code) {
        const resp = await this.getToken(data.code);
        item.resolve(resp);
        success = true;
      } else {
        item.reject('Missing authorization code!');
      }
      await this.cache.del(data.state);
    }
    return success;
  }

  private async getToken(code: string): Promise<TokenResponseWithRefresh> {
    logger.info(`%s HTTP: %s`, this.name, this.tokenUrl);
    this.options.form!.code = code;
    return await httpRequest(this.tokenUrl, this.options);
  }
}
