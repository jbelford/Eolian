export type E2ETarget = 'local' | 'production';
export type E2ETriggerMode = 'control' | 'human';
export type E2ESource = 'youtube' | 'spotify' | 'soundcloud';
export type E2ERequestType = 'url' | 'search';

export interface HarnessConfig {
  target: E2ETarget;
  triggerMode: E2ETriggerMode;
  discordToken: string;
  guildId: string;
  textChannelId: string;
  voiceChannelId: string;
  eolianBotId: string;
  controlUrl?: string;
  controlToken?: string;
  source: E2ESource;
  requestType: E2ERequestType;
  request: string;
  timeoutMs: number;
  minPackets: number;
  minPcmBytes: number;
  minRms: number;
}

export function loadHarnessConfig(env: NodeJS.ProcessEnv): HarnessConfig {
  const target = enumValue(env.E2E_TARGET ?? 'local', ['local', 'production'] as const);
  const triggerMode = enumValue(env.E2E_TRIGGER_MODE ?? 'control', ['control', 'human'] as const);
  if (
    target === 'production' &&
    (env.E2E_ALLOW_PRODUCTION !== 'true' || env.E2E_PRODUCTION_CONFIRM !== 'EOLIAN_PRODUCTION_E2E')
  ) {
    throw new Error(
      'Production requires E2E_ALLOW_PRODUCTION=true and E2E_PRODUCTION_CONFIRM=EOLIAN_PRODUCTION_E2E',
    );
  }

  const controlUrl = optional(env.E2E_CONTROL_URL);
  const controlToken = optional(env.E2E_CONTROL_TOKEN);
  if (triggerMode === 'control' && (!controlUrl || !controlToken)) {
    throw new Error('Control mode requires E2E_CONTROL_URL and E2E_CONTROL_TOKEN');
  }

  return {
    target,
    triggerMode,
    discordToken: required(env, 'E2E_DISCORD_TOKEN'),
    guildId: required(env, 'E2E_GUILD_ID'),
    textChannelId: required(env, 'E2E_TEXT_CHANNEL_ID'),
    voiceChannelId: required(env, 'E2E_VOICE_CHANNEL_ID'),
    eolianBotId: required(env, 'E2E_EOLIAN_BOT_ID'),
    controlUrl,
    controlToken,
    source: enumValue(env.E2E_SOURCE ?? 'youtube', ['youtube', 'spotify', 'soundcloud'] as const),
    requestType: enumValue(env.E2E_REQUEST_TYPE ?? 'url', ['url', 'search'] as const),
    request: required(env, 'E2E_REQUEST'),
    timeoutMs: positiveInt(env.E2E_TIMEOUT_MS, 45000),
    minPackets: positiveInt(env.E2E_MIN_PACKETS, 5),
    minPcmBytes: positiveInt(env.E2E_MIN_PCM_BYTES, 3840),
    minRms: positiveInt(env.E2E_MIN_RMS, 50),
  };
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = optional(env[name]);
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function enumValue<T extends string>(value: string, values: readonly T[]): T {
  const result = values.find(candidate => candidate === value);
  if (!result) {
    throw new Error(`Expected one of ${values.join(', ')}, received ${value}`);
  }
  return result;
}

function positiveInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received ${value}`);
  }
  return parsed;
}
