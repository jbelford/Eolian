import { logger } from '@eolian/common/logger';
import { TokenProvider, HttpRequestOptions, IAuthorizationProvider, TokenResponse } from './@types';
import { httpRequest, HttpRequestError } from './request';

export class AuthorizationCodeProvider implements TokenProvider {
  private readonly options: HttpRequestOptions;

  constructor(
    readonly name: string,
    private readonly tokenEndpoint: string,
    authenticationOptions: HttpRequestOptions,
    readonly authorization: IAuthorizationProvider,
    private refreshToken?: string,
  ) {
    this.options = { ...authenticationOptions, method: 'POST', json: true };
    this.options.form = { ...this.options.form, grant_type: 'refresh_token' };
  }

  async getToken(): Promise<TokenResponse> {
    if (this.refreshToken) {
      try {
        return await this.refresh(this.refreshToken);
      } catch (e: any) {
        if (!(e instanceof HttpRequestError) || e.body.error !== 'invalid_grant') {
          throw e;
        }
      }
    }
    const resp = await this.authorization.authorize();
    this.refreshToken = resp.refresh_token;
    return resp;
  }

  private async refresh(token: string): Promise<TokenResponse> {
    logger.info(`%s HTTP: %s`, this.name, this.tokenEndpoint);
    this.options.form!.refresh_token = token;
    const result: TokenResponse = await httpRequest(this.tokenEndpoint, this.options);
    if (result.refresh_token) {
      this.refreshToken = result.refresh_token;
    }
    return result;
  }
}
