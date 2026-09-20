import { expect, it } from 'vitest';
import { evaluatePlayback } from '../../../test/e2e/verification';

const thresholds = {
  minPackets: 5,
  minPcmBytes: 3840,
  minRms: 50,
};

it('requires Discord response, voice state, and audio signals', () => {
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
  expect(result.passed).toBe(true);
});

it('accepts decoded audio energy when packet threshold is not reached', () => {
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
  expect(result.passed).toBe(true);
});

it('fails without a Discord response', () => {
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
  expect(result.passed).toBe(false);
  expect(result.checks.discordResponse).toBe(false);
});
