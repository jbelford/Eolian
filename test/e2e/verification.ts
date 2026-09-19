export interface VerificationSignals {
  discordResponseObserved: boolean;
  voiceStateObserved: boolean;
  packetCount: number;
  pcmBytes: number;
  rms: number;
  localState?: {
    streaming: boolean;
    currentTrack?: unknown;
    voiceChannelId?: string;
  };
}

export interface VerificationThresholds {
  minPackets: number;
  minPcmBytes: number;
  minRms: number;
  voiceChannelId: string;
  requireLocalState: boolean;
}

export interface VerificationResult {
  passed: boolean;
  checks: {
    discordResponse: boolean;
    voiceState: boolean;
    audio: boolean;
    localState: boolean;
  };
}

export function evaluatePlayback(
  signals: VerificationSignals,
  thresholds: VerificationThresholds,
): VerificationResult {
  const packetSignal = signals.packetCount >= thresholds.minPackets;
  const energySignal =
    signals.pcmBytes >= thresholds.minPcmBytes && signals.rms >= thresholds.minRms;
  const localState =
    !thresholds.requireLocalState ||
    !!(
      signals.localState?.streaming &&
      signals.localState.currentTrack &&
      signals.localState.voiceChannelId === thresholds.voiceChannelId
    );
  const checks = {
    discordResponse: signals.discordResponseObserved,
    voiceState: signals.voiceStateObserved,
    audio: packetSignal || energySignal,
    localState,
  };
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
  };
}
