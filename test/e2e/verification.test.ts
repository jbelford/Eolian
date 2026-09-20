import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePlayback } from './verification';

const thresholds = {
  minPackets: 5,
  minPcmBytes: 3840,
  minRms: 50,
};

test('requires Discord response, voice state, and audio signals', () => {
  const result = evaluatePlayback(
    {
      discordResponseObserved: true,
      voiceStateObserved: true,
      packetCount: 5,
      pcmBytes: 0,
      rms: 0,
    },
    thresholds,
  );
  assert.equal(result.passed, true);
});

test('accepts decoded audio energy when packet threshold is not reached', () => {
  const result = evaluatePlayback(
    {
      discordResponseObserved: true,
      voiceStateObserved: true,
      packetCount: 1,
      pcmBytes: 3840,
      rms: 100,
    },
    thresholds,
  );
  assert.equal(result.passed, true);
});

test('fails without a Discord response', () => {
  const result = evaluatePlayback(
    {
      discordResponseObserved: false,
      voiceStateObserved: true,
      packetCount: 5,
      pcmBytes: 3840,
      rms: 100,
    },
    thresholds,
  );
  assert.equal(result.passed, false);
  assert.equal(result.checks.discordResponse, false);
});
