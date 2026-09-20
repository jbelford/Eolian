export interface VerificationSignals {
  discordResponseObserved: boolean;
  voiceStateObserved: boolean;
  packetCount: number;
  pcmBytes: number;
  rms: number;
}

export interface VerificationThresholds {
  minPackets: number;
  minPcmBytes: number;
  minRms: number;
}

export interface VerificationResult {
  passed: boolean;
  checks: {
    discordResponse: boolean;
    voiceState: boolean;
    audio: boolean;
  };
}

export function evaluatePlayback(
  signals: VerificationSignals,
  thresholds: VerificationThresholds,
): VerificationResult {
  const packetSignal = signals.packetCount >= thresholds.minPackets;
  const energySignal =
    signals.pcmBytes >= thresholds.minPcmBytes && signals.rms >= thresholds.minRms;
  const checks = {
    discordResponse: signals.discordResponseObserved,
    voiceState: signals.voiceStateObserved,
    audio: packetSignal || energySignal,
  };
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
  };
}
