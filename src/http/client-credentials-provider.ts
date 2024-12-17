import { logger } from '@eolian/common/logger';
import { TokenProvider, HttpRequestOptions, TokenResponse } from './@types';
import { httpRequest, HttpRequestError } from './request';

export class ClientCredentialsProvider implements TokenProvider {
  private readonly options: HttpRequestOptions;
  private refreshToken?: string;

  constructor(
    readonly name: string,
    private readonly tokenEndpoint: string,
    authenticationOptions: HttpRequestOptions,
  ) {
    this.options = { ...authenticationOptions, method: 'POST', json: true };
  }

  async getToken(): Promise<TokenResponse> {
    if (this.refreshToken) {
      try {
        const form: HttpRequestOptions['form'] = {
          ...this.options.form,
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
        };
        return await this.request({ ...this.options, form });
      } catch (e: any) {
        if (!(e instanceof HttpRequestError) || e.body.error !== 'invalid_grant') {
          throw e;
        }
      }
    }

    const form: HttpRequestOptions['form'] = {
      ...this.options.form,
      grant_type: 'client_credentials',
    };
    return await this.request({ ...this.options, form });
  }

  private async request(options: HttpRequestOptions): Promise<TokenResponse> {
    logger.info(`%s HTTP: %s`, this.name, this.tokenEndpoint);
    const result: TokenResponse = await httpRequest(this.tokenEndpoint, options);
    if (result.refresh_token) {
      this.refreshToken = result.refresh_token;
    }
    return result;
  }
}
