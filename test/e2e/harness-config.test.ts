import assert from 'node:assert/strict';
import test from 'node:test';
import { loadHarnessConfig } from './harness-config';

const base = {
  E2E_DISCORD_TOKEN: 'token',
  E2E_GUILD_ID: 'guild',
  E2E_TEXT_CHANNEL_ID: 'text',
  E2E_VOICE_CHANNEL_ID: 'voice',
  E2E_EOLIAN_BOT_ID: 'eolian',
  E2E_REQUEST: 'https://www.youtube.com/watch?v=test',
};

test('defaults to local chat-triggered YouTube URL mode', () => {
  const config = loadHarnessConfig(base);
  assert.equal(config.target, 'local');
  assert.equal(config.triggerMode, 'chat');
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

test('supports human-triggered mode without extra configuration', () => {
  assert.equal(loadHarnessConfig({ ...base, E2E_TRIGGER_MODE: 'human' }).triggerMode, 'human');
});
