import { CSRF_HEADER } from './constants';

export const errorSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
} as const;

export const loginSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      returnTo: { type: 'string', maxLength: 2048 },
    },
  },
  response: { 400: errorSchema },
} as const;

export const callbackSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      state: { type: 'string', minLength: 1, maxLength: 512 },
      code: { type: 'string', minLength: 1, maxLength: 2048 },
      error: { type: 'string', minLength: 1, maxLength: 256 },
    },
  },
  response: {
    400: errorSchema,
    502: errorSchema,
  },
} as const;

const userSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'username', 'globalName', 'avatar'],
  properties: {
    id: { type: 'string' },
    username: { type: 'string' },
    globalName: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    avatar: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
} as const;

const guildSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'icon', 'owner', 'permissions'],
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    icon: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    owner: { type: 'boolean' },
    permissions: { type: 'string' },
  },
} as const;

export const sessionSchema = {
  response: {
    200: {
      oneOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: ['authenticated'],
          properties: { authenticated: { const: false } },
        },
        {
          type: 'object',
          additionalProperties: false,
          required: ['authenticated', 'user', 'guilds', 'csrfToken', 'expiresAt'],
          properties: {
            authenticated: { const: true },
            user: userSchema,
            guilds: { type: 'array', items: guildSchema },
            csrfToken: { type: 'string' },
            expiresAt: { type: 'string' },
          },
        },
      ],
    },
  },
} as const;

export const logoutSchema = {
  headers: {
    type: 'object',
    required: [CSRF_HEADER],
    properties: {
      origin: { type: 'string' },
      [CSRF_HEADER]: { type: 'string' },
    },
  },
  response: {
    204: { type: 'null' },
    401: errorSchema,
    403: errorSchema,
    502: errorSchema,
  },
} as const;
