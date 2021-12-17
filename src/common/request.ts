import { IncomingHttpHeaders } from 'http';
import querystring from 'querystring';
import { request } from 'undici';

export const enum RequestErrorCodes {
  ABORTED = 'UND_ERR_ABORTED'
}

export type RequestStreamError = Error & { code?: string };

export type RequestOptions = {
  method?: 'GET' | 'POST',
  params?: Record<string, string | number | boolean>,
  form?: Record<string, string | number | boolean>,
  headers?: Record<string, string>;
  auth?: {
    bearer?: string
    basic?: {
      id: string,
      password: string
    }
  };
  json?: boolean;
};

export async function httpRequest<T>(url: string, options?: RequestOptions): Promise<T> {
  if (options?.params) {
    url = `${url}?${querystring.stringify(options.params)}`;
  }

  const headers: IncomingHttpHeaders = options?.headers ?? {};
  if (options?.auth) {
    if (options.auth.basic) {
      const key = Buffer.from(`${options.auth.basic.id}:${options.auth.basic.password}`).toString('base64');
      headers.authorization = `Basic ${key}`;
    } else if (options.auth.bearer) {
      headers.authorization = `Bearer ${options.auth.bearer}`;
    }
  }

  let body: string | undefined;
  const method = options?.method ?? 'GET';
  if (options?.form && method === 'POST') {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    body = querystring.stringify(options.form);
  }

  const res = await request(url, {
    method,
    headers,
    body,
    maxRedirections: 5
  });

  if (res.statusCode >= 400) {
    const error = await res.body.text();
    throw new Error(`HttpRequestError: ${error}`);
  }

  return options?.json ? await res.body.json() : res.body;
}