import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePlayback } from './verification';

const thresholds = {
  minPackets: 5,
  minPcmBytes: 3840,
  minRms: 50,
  voiceChannelId: 'voice',
  requireLocalState: true,
};

test('requires Discord, voice, audio, and local state signals', () => {
  const result = evaluatePlayback(
    {
      discordResponseObserved: true,
      voiceStateObserved: true,
      packetCount: 5,
      pcmBytes: 0,
      rms: 0,
      localState: {
        streaming: true,
        currentTrack: { title: 'track' },
        voiceChannelId: 'voice',
      },
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
      localState: {
        streaming: true,
        currentTrack: { title: 'track' },
        voiceChannelId: 'voice',
      },
    },
    thresholds,
  );
  assert.equal(result.passed, true);
});

test('fails without a current local track in control mode', () => {
  const result = evaluatePlayback(
    {
      discordResponseObserved: true,
      voiceStateObserved: true,
      packetCount: 5,
      pcmBytes: 3840,
      rms: 100,
      localState: { streaming: true, voiceChannelId: 'voice' },
    },
    thresholds,
  );
  assert.equal(result.passed, false);
  assert.equal(result.checks.localState, false);
});
