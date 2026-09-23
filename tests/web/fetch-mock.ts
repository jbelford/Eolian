import { vi } from 'vitest';

interface JsonResponseOptions {
  status?: number;
  contentType?: string;
}

interface FetchRoute {
  method: string;
  path: string;
  respond: (init?: RequestInit) => Response | Promise<Response>;
}

export const jsonResponse = (body: unknown, options: JsonResponseOptions = {}) =>
  new Response(JSON.stringify(body), {
    status: options.status ?? 200,
    headers: { 'content-type': options.contentType ?? 'application/json; charset=utf-8' },
  });

export const emptyResponse = (status = 204) => new Response(null, { status });

export const installFetchMock = () => {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

export const queueResponse = (
  fetchMock: ReturnType<typeof installFetchMock>,
  response: Response,
) => {
  fetchMock.mockResolvedValueOnce(response);
};

export const queueJson = (
  fetchMock: ReturnType<typeof installFetchMock>,
  body: unknown,
  options?: JsonResponseOptions,
) => queueResponse(fetchMock, jsonResponse(body, options));

export const queueNetworkError = (
  fetchMock: ReturnType<typeof installFetchMock>,
  message = 'network unavailable',
) => fetchMock.mockRejectedValueOnce(new TypeError(message));

export const jsonRoute = (
  method: string,
  path: string,
  body: unknown,
  options?: JsonResponseOptions,
): FetchRoute => ({
  method,
  path,
  respond: () => jsonResponse(body, options),
});

export const emptyRoute = (method: string, path: string, status = 204): FetchRoute => ({
  method,
  path,
  respond: () => emptyResponse(status),
});

export const networkErrorRoute = (
  method: string,
  path: string,
  message = 'network unavailable',
): FetchRoute => ({
  method,
  path,
  respond: () => Promise.reject(new TypeError(message)),
});

export const installFetchRouter = (routes: FetchRoute[]) => {
  const remaining = [...routes];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const index = remaining.findIndex(route => route.method === method && route.path === path);
    if (index === -1) {
      throw new Error(`Unexpected fetch request: ${method} ${path}`);
    }
    const [route] = remaining.splice(index, 1);
    return route.respond(init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

export const requestJsonBody = (fetchMock: ReturnType<typeof installFetchMock>, call: number) => {
  const init = fetchMock.mock.calls[call - 1]?.[1];
  if (typeof init?.body !== 'string') {
    throw new Error(`Fetch call ${call} did not include a JSON body.`);
  }
  return JSON.parse(init.body) as unknown;
};
