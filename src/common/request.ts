import { IncomingHttpHeaders } from 'http';
import { request } from 'undici';

export const enum RequestErrorCodes {
  ABORTED = 'UND_ERR_ABORTED',
}

export type RequestStreamError = Error & { code?: string };

export type RequestParams = Record<string, string | number | boolean>;

export type RequestOptions = {
  method?: 'GET' | 'POST';
  params?: RequestParams;
  form?: RequestParams;
  headers?: Record<string, string>;
  auth?: {
    bearer?: string;
    basic?: {
      id: string;
      password: string;
    };
  };
  json?: boolean;
};

export function querystringify(params: RequestParams): string {
  const urlSearch = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => urlSearch.set(key, value.toString()));
  return urlSearch.toString();
}

export class HttpRequestError extends Error {

  constructor(readonly statusCode: number,
    readonly body: any) {
    super(`HttpRequestError ${statusCode}: ${JSON.stringify(body)}`);
  }

}

export async function httpRequest<T>(url: string, options?: RequestOptions): Promise<T> {
  if (options?.params) {
    url = `${url}?${querystringify(options.params)}`;
  }

  const headers: IncomingHttpHeaders = options?.headers ?? {};
  if (options?.auth) {
    if (options.auth.basic) {
      const key = Buffer.from(`${options.auth.basic.id}:${options.auth.basic.password}`).toString(
        'base64'
      );
      headers.authorization = `Basic ${key}`;
    } else if (options.auth.bearer) {
      headers.authorization = `Bearer ${options.auth.bearer}`;
    }
  }

  let body: string | undefined;
  const method = options?.method ?? 'GET';
  if (options?.form && method === 'POST') {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    body = querystringify(options.form);
  }

  const res = await request(url, {
    method,
    headers,
    body,
    maxRedirections: 5,
  });

  if (res.statusCode >= 400) {
    if (res.headers['content-type'] === 'application/json') {
      const json = await res.body.json();
      throw new HttpRequestError(res.statusCode, json);
    } else {
      const error = await res.body.text();
      throw new HttpRequestError(res.statusCode, error);
    }
  }

  return options?.json ? await res.body.json() : res.body;
}
