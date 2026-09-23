import { errorSchema } from '../auth/schemas';

const syntaxSchema = { type: 'string', enum: ['keyword', 'traditional'] } as const;
const discordIdSchema = { type: 'string', pattern: '^\\d{1,20}$' } as const;

const providerStatusSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['linked', 'linkAvailable'],
  properties: {
    linked: { type: 'boolean' },
    linkAvailable: { type: 'boolean' },
  },
} as const;

export const accountSettingsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['syntax', 'providers'],
  properties: {
    syntax: { anyOf: [syntaxSchema, { type: 'null' }] },
    providers: {
      type: 'object',
      additionalProperties: false,
      required: ['spotify', 'soundcloud'],
      properties: {
        spotify: providerStatusSchema,
        soundcloud: providerStatusSchema,
      },
    },
  },
} as const;

export const getAccountSchema = {
  response: {
    200: accountSettingsSchema,
    401: errorSchema,
    502: errorSchema,
  },
} as const;

export const updateAccountSyntaxSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['syntax'],
    properties: {
      syntax: { anyOf: [syntaxSchema, { type: 'null' }] },
    },
  },
  response: {
    200: accountSettingsSchema,
    400: errorSchema,
    401: errorSchema,
    403: errorSchema,
    500: errorSchema,
    502: errorSchema,
  },
} as const;

const providerParams = {
  type: 'object',
  additionalProperties: false,
  required: ['provider'],
  properties: {
    provider: { type: 'string', enum: ['spotify', 'soundcloud'] },
  },
} as const;

export const linkProviderSchema = {
  params: providerParams,
  response: {
    201: {
      type: 'object',
      additionalProperties: false,
      required: ['authorizationUrl'],
      properties: { authorizationUrl: { type: 'string' } },
    },
    400: errorSchema,
    401: errorSchema,
    403: errorSchema,
    409: errorSchema,
    500: errorSchema,
    502: errorSchema,
  },
} as const;

export const unlinkProviderSchema = {
  params: providerParams,
  response: {
    204: { type: 'null' },
    400: errorSchema,
    401: errorSchema,
    403: errorSchema,
    500: errorSchema,
    502: errorSchema,
  },
} as const;

const guildSummarySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'icon'],
  properties: {
    id: discordIdSchema,
    name: { type: 'string' },
    icon: { anyOf: [{ type: 'string' }, { type: 'null' }] },
  },
} as const;

const guildOptionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name'],
  properties: {
    id: discordIdSchema,
    name: { type: 'string' },
  },
} as const;

const guildSettingsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['prefix', 'volume', 'syntax', 'preferredChannelId', 'djRoleIds', 'djAllowLimited'],
  properties: {
    prefix: { type: 'string', minLength: 1, maxLength: 1 },
    volume: { type: 'number', minimum: 0, maximum: 1 },
    syntax: syntaxSchema,
    preferredChannelId: { anyOf: [discordIdSchema, { type: 'null' }] },
    djRoleIds: {
      type: 'array',
      maxItems: 10,
      uniqueItems: true,
      items: discordIdSchema,
    },
    djAllowLimited: { type: 'boolean' },
  },
} as const;

const guildDetailSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'icon', 'memberCount', 'settings', 'channels', 'roles'],
  properties: {
    ...guildSummarySchema.properties,
    memberCount: { type: 'integer', minimum: 0 },
    settings: guildSettingsSchema,
    channels: { type: 'array', items: guildOptionSchema },
    roles: { type: 'array', items: guildOptionSchema },
  },
} as const;

const guildParams = {
  type: 'object',
  additionalProperties: false,
  required: ['guildId'],
  properties: { guildId: discordIdSchema },
} as const;

const guildErrors = {
  400: errorSchema,
  401: errorSchema,
  403: errorSchema,
  404: errorSchema,
  409: errorSchema,
  500: errorSchema,
  502: errorSchema,
  503: errorSchema,
} as const;

export const listGuildsSchema = {
  response: {
    200: {
      type: 'object',
      additionalProperties: false,
      required: ['guilds'],
      properties: { guilds: { type: 'array', items: guildSummarySchema } },
    },
    ...guildErrors,
  },
} as const;

export const getGuildSchema = {
  params: guildParams,
  response: { 200: guildDetailSchema, ...guildErrors },
} as const;

export const updateGuildSchema = {
  params: guildParams,
  body: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: guildSettingsSchema.properties,
  },
  response: { 200: guildDetailSchema, ...guildErrors },
} as const;
