import { spawnSync } from 'node:child_process';
import { constants, accessSync } from 'node:fs';
import { Readable } from 'node:stream';
import ffmpegPath from 'ffmpeg-static';
import { describe, expect, it, vi } from 'vitest';
import { StreamSource, Track, TrackSource } from '@eolian/api/@types';
import { SongStream, StreamOptions } from '@eolian/framework/voice/song-stream';

vi.mock('@eolian/api', () => ({ getTrackStream: vi.fn() }));
vi.mock('@eolian/common/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn() },
}));
vi.mock('@eolian/http', () => ({
  RequestErrorCodes: { ABORTED: 'UND_ERR_ABORTED' },
}));

const INPUT_SAMPLE_RATE = 48_000;
const INPUT_DURATION_MS = 200;
const OUTPUT_SAMPLE_RATE = 48_000;
const OUTPUT_FRAME_BYTES = 4;
const TEST_TIMEOUT_MS = 10_000;

type FfmpegProbe = {
  available: boolean;
  reason?: string;
};

function probeFfmpeg(): FfmpegProbe {
  if (!ffmpegPath) {
    return {
      available: false,
      reason: `ffmpeg-static does not provide a binary for ${process.platform}/${process.arch}`,
    };
  }

  try {
    accessSync(ffmpegPath, constants.X_OK);
  } catch (error) {
    return { available: false, reason: `ffmpeg-static binary is not executable: ${String(error)}` };
  }

  const result = spawnSync(ffmpegPath, ['-hide_banner', '-filters'], {
    timeout: 5_000,
    windowsHide: true,
  });
  if (result.error) {
    return { available: false, reason: `ffmpeg-static could not run: ${result.error.message}` };
  }
  if (result.status !== 0) {
    return {
      available: false,
      reason: `ffmpeg-static filter probe exited with status ${String(result.status)}`,
    };
  }

  const output = Buffer.concat([result.stdout, result.stderr]).toString();
  const missingFilters = ['asetrate', 'atempo'].filter(filter => !output.includes(filter));
  if (missingFilters.length) {
    return {
      available: false,
      reason: `ffmpeg-static lacks required filters: ${missingFilters.join(', ')}`,
    };
  }

  return { available: true };
}

function createMonoSineWav(): Buffer {
  const sampleCount = Math.round((INPUT_SAMPLE_RATE * INPUT_DURATION_MS) / 1_000);
  const dataLength = sampleCount * 2;
  const wav = Buffer.alloc(44 + dataLength);

  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataLength, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(INPUT_SAMPLE_RATE, 24);
  wav.writeUInt32LE(INPUT_SAMPLE_RATE * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataLength, 40);

  for (let sample = 0; sample < sampleCount; sample++) {
    const value = Math.round(Math.sin((2 * Math.PI * 440 * sample) / INPUT_SAMPLE_RATE) * 8_000);
    wav.writeInt16LE(value, 44 + sample * 2);
  }

  return wav;
}

function track(): Track {
  return {
    id: 'local-integration-track',
    title: 'Generated sine',
    poster: 'Vitest',
    url: 'local://generated-sine.wav',
    src: TrackSource.YouTube,
  };
}

async function renderPcm(options?: StreamOptions): Promise<Buffer> {
  const input = Readable.from([createMonoSineWav()]);
  const source: StreamSource = { get: async () => input };
  const song = new SongStream(1, 0, {
    getTrackStream: async () => source,
  });
  const chunks: Buffer[] = [];
  const output = song.stream;
  const onData = (chunk: Buffer) => chunks.push(Buffer.from(chunk));
  output.on('data', onData);

  let onEnd = () => {};
  let onError = (_error: Error) => {};
  const completed = new Promise<void>((resolve, reject) => {
    onEnd = resolve;
    onError = reject;
    song.once('end', onEnd);
    song.once('error', onError);
  });

  try {
    await expect(song.setStreamTrack(track(), options)).resolves.toBe(true);
    await completed;
    return Buffer.concat(chunks);
  } finally {
    song.removeListener('end', onEnd);
    song.removeListener('error', onError);
    output.removeListener('data', onData);
    await song.close();
    song.end();
    output.destroy();
  }
}

function expectStereoSigned16Pcm(pcm: Buffer, expectedDurationMs: number) {
  expect(pcm.length).toBeGreaterThan(0);
  expect(pcm.length % OUTPUT_FRAME_BYTES).toBe(0);

  const frameCount = pcm.length / OUTPUT_FRAME_BYTES;
  const expectedFrames = (OUTPUT_SAMPLE_RATE * expectedDurationMs) / 1_000;
  expect(frameCount).toBeGreaterThan(expectedFrames * 0.85);
  expect(frameCount).toBeLessThan(expectedFrames * 1.15);

  let minimum = 0;
  let maximum = 0;
  for (let offset = 0; offset < pcm.length; offset += OUTPUT_FRAME_BYTES) {
    const left = pcm.readInt16LE(offset);
    const right = pcm.readInt16LE(offset + 2);
    expect(right).toBe(left);
    minimum = Math.min(minimum, left);
    maximum = Math.max(maximum, left);
  }
  expect(minimum).toBeLessThan(-1_000);
  expect(maximum).toBeGreaterThan(1_000);
}

const ffmpegProbe = probeFfmpeg();
const skipReason = ffmpegProbe.reason ? `: ${ffmpegProbe.reason}` : '';

describe.skipIf(!ffmpegProbe.available)(`real FFmpeg audio pipeline${skipReason}`, () => {
  it(
    'decodes generated mono WAV into signed 16-bit stereo 48 kHz PCM',
    async () => {
      const pcm = await renderPcm();

      expectStereoSigned16Pcm(pcm, INPUT_DURATION_MS);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'applies the real nightcore filter chain',
    async () => {
      const normal = await renderPcm();
      const nightcore = await renderPcm({ nightcore: true });

      expectStereoSigned16Pcm(nightcore, INPUT_DURATION_MS / (1.25 * 1.06));
      expect(nightcore.length).toBeLessThan(normal.length * 0.9);
    },
    TEST_TIMEOUT_MS,
  );
});
