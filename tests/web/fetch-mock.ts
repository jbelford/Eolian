import { vi } from 'vitest';

interface JsonResponseOptions {
  status?: number;
  contentType?: string;
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
