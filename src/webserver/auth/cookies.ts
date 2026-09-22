import { environment } from '@eolian/common/env';
import { FastifyReply, FastifyRequest } from 'fastify';

interface CookieOptions {
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: 'Lax';
  secure?: boolean;
}

function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  }
  if (options.path) {
    parts.push(`Path=${options.path}`);
  }
  if (options.httpOnly) {
    parts.push('HttpOnly');
  }
  if (options.secure) {
    parts.push('Secure');
  }
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }
  return parts.join('; ');
}

export function getCookie(request: FastifyRequest, name: string): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) {
    return undefined;
  }
  for (const part of cookieHeader.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) {
      try {
        return decodeURIComponent(value.join('='));
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export function setPrivateCookie(
  reply: FastifyReply,
  name: string,
  value: string,
  maxAgeSeconds: number,
  path = '/',
): void {
  appendCookie(
    reply,
    serializeCookie(name, value, {
      httpOnly: true,
      maxAge: maxAgeSeconds,
      path,
      sameSite: 'Lax',
      secure: environment.prod,
    }),
  );
}

export function clearCookie(reply: FastifyReply, name: string, path = '/'): void {
  appendCookie(
    reply,
    serializeCookie(name, '', {
      httpOnly: true,
      maxAge: 0,
      path,
      sameSite: 'Lax',
      secure: environment.prod,
    }),
  );
}

function appendCookie(reply: FastifyReply, value: string): void {
  const existing = reply.getHeader('set-cookie');
  if (!existing) {
    reply.header('set-cookie', value);
  } else if (Array.isArray(existing)) {
    reply.header('set-cookie', [...existing, value]);
  } else {
    reply.header('set-cookie', [existing.toString(), value]);
  }
}
