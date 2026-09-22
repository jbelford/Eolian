import { apiRequest, apiVoidRequest, hasExactKeys, isRecord } from './client';

export type SyntaxPreference = 'keyword' | 'traditional';
export type ProviderName = 'spotify' | 'soundcloud';

export interface ProviderStatus {
  linked: boolean;
  linkAvailable: boolean;
}

export interface AccountSettings {
  syntax: SyntaxPreference | null;
  providers: Record<ProviderName, ProviderStatus>;
}

export interface GuildSummary {
  id: string;
  name: string;
  icon: string | null;
}

export interface GuildOption {
  id: string;
  name: string;
}

export interface GuildSettings {
  prefix: string;
  volume: number;
  syntax: SyntaxPreference;
  preferredChannelId: string | null;
  djRoleIds: string[];
  djAllowLimited: boolean;
}

export interface GuildDetail extends GuildSummary {
  memberCount: number;
  settings: GuildSettings;
  channels: GuildOption[];
  roles: GuildOption[];
}

export type GuildSettingsUpdate = Partial<GuildSettings>;

const isNullableString = (value: unknown): value is string | null =>
  typeof value === 'string' || value === null;
const isSyntax = (value: unknown): value is SyntaxPreference =>
  value === 'keyword' || value === 'traditional';
const isDiscordId = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{1,20}$/.test(value);

const isProviderStatus = (value: unknown): value is ProviderStatus =>
  isRecord(value) &&
  hasExactKeys(value, ['linked', 'linkAvailable']) &&
  typeof value.linked === 'boolean' &&
  typeof value.linkAvailable === 'boolean';

const isAccountSettings = (value: unknown): value is AccountSettings =>
  isRecord(value) &&
  hasExactKeys(value, ['syntax', 'providers']) &&
  (value.syntax === null || isSyntax(value.syntax)) &&
  isRecord(value.providers) &&
  hasExactKeys(value.providers, ['spotify', 'soundcloud']) &&
  isProviderStatus(value.providers.spotify) &&
  isProviderStatus(value.providers.soundcloud);

const isGuildSummary = (value: unknown): value is GuildSummary =>
  isRecord(value) &&
  hasExactKeys(value, ['id', 'name', 'icon']) &&
  isDiscordId(value.id) &&
  typeof value.name === 'string' &&
  isNullableString(value.icon);

const isGuildOption = (value: unknown): value is GuildOption =>
  isRecord(value) &&
  hasExactKeys(value, ['id', 'name']) &&
  isDiscordId(value.id) &&
  typeof value.name === 'string';

const isGuildSettings = (value: unknown): value is GuildSettings =>
  isRecord(value) &&
  hasExactKeys(value, [
    'prefix',
    'volume',
    'syntax',
    'preferredChannelId',
    'djRoleIds',
    'djAllowLimited',
  ]) &&
  typeof value.prefix === 'string' &&
  value.prefix.length === 1 &&
  typeof value.volume === 'number' &&
  Number.isFinite(value.volume) &&
  value.volume >= 0 &&
  value.volume <= 1 &&
  isSyntax(value.syntax) &&
  (value.preferredChannelId === null || isDiscordId(value.preferredChannelId)) &&
  Array.isArray(value.djRoleIds) &&
  value.djRoleIds.length <= 10 &&
  new Set(value.djRoleIds).size === value.djRoleIds.length &&
  value.djRoleIds.every(isDiscordId) &&
  typeof value.djAllowLimited === 'boolean';

const isGuildDetail = (value: unknown): value is GuildDetail =>
  isRecord(value) &&
  hasExactKeys(value, ['id', 'name', 'icon', 'memberCount', 'settings', 'channels', 'roles']) &&
  isDiscordId(value.id) &&
  typeof value.name === 'string' &&
  isNullableString(value.icon) &&
  Number.isInteger(value.memberCount) &&
  Number(value.memberCount) >= 0 &&
  isGuildSettings(value.settings) &&
  Array.isArray(value.channels) &&
  value.channels.every(isGuildOption) &&
  Array.isArray(value.roles) &&
  value.roles.every(isGuildOption);

const isGuildList = (value: unknown): value is { guilds: GuildSummary[] } =>
  isRecord(value) &&
  hasExactKeys(value, ['guilds']) &&
  Array.isArray(value.guilds) &&
  value.guilds.every(isGuildSummary);

const isAuthorization = (value: unknown): value is { authorizationUrl: string } =>
  isRecord(value) &&
  hasExactKeys(value, ['authorizationUrl']) &&
  typeof value.authorizationUrl === 'string' &&
  /^https?:\/\//.test(value.authorizationUrl);

export const getAccountSettings = (signal?: AbortSignal) =>
  apiRequest('/api/account', {
    signal,
    validate: isAccountSettings,
    invalidResponseMessage: 'The Eolian API returned invalid account settings.',
  });

export const updateAccountSyntax = (
  syntax: SyntaxPreference | null,
  csrfToken: string,
  signal?: AbortSignal,
) =>
  apiRequest('/api/account/syntax', {
    method: 'PATCH',
    body: { syntax },
    csrfToken,
    signal,
    validate: isAccountSettings,
    invalidResponseMessage: 'The Eolian API returned invalid account settings.',
  });

export const startProviderLink = (
  provider: ProviderName,
  csrfToken: string,
  signal?: AbortSignal,
) =>
  apiRequest(`/api/account/providers/${provider}/link`, {
    method: 'POST',
    csrfToken,
    signal,
    expectedStatus: 201,
    validate: isAuthorization,
    invalidResponseMessage: 'The Eolian API returned an invalid provider authorization.',
  });

export const unlinkProvider = (provider: ProviderName, csrfToken: string, signal?: AbortSignal) =>
  apiVoidRequest(`/api/account/providers/${provider}`, {
    method: 'DELETE',
    csrfToken,
    signal,
  });

export const getGuilds = (signal?: AbortSignal) =>
  apiRequest('/api/guilds', {
    signal,
    validate: isGuildList,
    invalidResponseMessage: 'The Eolian API returned an invalid server list.',
  });

export const getGuild = (guildId: string, signal?: AbortSignal) =>
  apiRequest(`/api/guilds/${encodeURIComponent(guildId)}`, {
    signal,
    validate: isGuildDetail,
    invalidResponseMessage: 'The Eolian API returned invalid server settings.',
  });

export const updateGuild = (
  guildId: string,
  settings: GuildSettingsUpdate,
  csrfToken: string,
  signal?: AbortSignal,
) =>
  apiRequest(`/api/guilds/${encodeURIComponent(guildId)}`, {
    method: 'PATCH',
    body: settings,
    csrfToken,
    signal,
    validate: isGuildDetail,
    invalidResponseMessage: 'The Eolian API returned invalid server settings.',
  });
