import assert from 'node:assert/strict';
import test from 'node:test';
import { loadHarnessConfig } from './harness-config';

const base = {
  E2E_DISCORD_TOKEN: 'token',
  E2E_GUILD_ID: 'guild',
  E2E_TEXT_CHANNEL_ID: 'text',
  E2E_VOICE_CHANNEL_ID: 'voice',
  E2E_EOLIAN_BOT_ID: 'eolian',
  E2E_CONTROL_URL: 'http://127.0.0.1:8080',
  E2E_CONTROL_TOKEN: 'control',
  E2E_REQUEST: 'https://www.youtube.com/watch?v=test',
};

test('defaults to local automated YouTube URL mode', () => {
  const config = loadHarnessConfig(base);
  assert.equal(config.target, 'local');
  assert.equal(config.triggerMode, 'control');
  assert.equal(config.source, 'youtube');
  assert.equal(config.requestType, 'url');
});

test('requires two explicit production confirmations', () => {
  assert.throws(
    () => loadHarnessConfig({ ...base, E2E_TARGET: 'production' }),
    /Production requires/,
  );
  assert.doesNotThrow(() =>
    loadHarnessConfig({
      ...base,
      E2E_TARGET: 'production',
      E2E_ALLOW_PRODUCTION: 'true',
      E2E_PRODUCTION_CONFIRM: 'EOLIAN_PRODUCTION_E2E',
    }),
  );
});

test('human mode does not require a control endpoint', () => {
  const { E2E_CONTROL_URL, E2E_CONTROL_TOKEN, ...human } = base;
  assert.equal(loadHarnessConfig({ ...human, E2E_TRIGGER_MODE: 'human' }).triggerMode, 'human');
});
