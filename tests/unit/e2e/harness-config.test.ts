import { expect, it } from 'vitest';
import { loadHarnessConfig } from '../../e2e/harness-config';

const base = {
  E2E_DISCORD_TOKEN: 'token',
  E2E_GUILD_ID: 'guild',
  E2E_TEXT_CHANNEL_ID: 'text',
  E2E_VOICE_CHANNEL_ID: 'voice',
  E2E_EOLIAN_BOT_ID: 'eolian',
  E2E_REQUEST: 'https://www.youtube.com/watch?v=test',
};

it('defaults to local chat-triggered YouTube URL mode', () => {
  const config = loadHarnessConfig(base);
  expect(config.target).toBe('local');
  expect(config.triggerMode).toBe('chat');
  expect(config.source).toBe('youtube');
  expect(config.requestType).toBe('url');
});

it('requires two explicit production confirmations', () => {
  expect(() => loadHarnessConfig({ ...base, E2E_TARGET: 'production' })).toThrow(
    /Production requires/,
  );
  expect(() =>
    loadHarnessConfig({
      ...base,
      E2E_TARGET: 'production',
      E2E_ALLOW_PRODUCTION: 'true',
      E2E_PRODUCTION_CONFIRM: 'EOLIAN_PRODUCTION_E2E',
    }),
  ).not.toThrow();
});

it('supports human-triggered mode without extra configuration', () => {
  expect(loadHarnessConfig({ ...base, E2E_TRIGGER_MODE: 'human' }).triggerMode).toBe('human');
});
