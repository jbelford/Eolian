import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromSubscription, synthesizer, instances, loggerError } = vi.hoisted(() => {
  const instances: Array<{
    config: unknown;
    close: ReturnType<typeof vi.fn>;
    speakTextAsync: ReturnType<typeof vi.fn>;
  }> = [];
  const synthesizer = vi.fn(function (this: (typeof instances)[number], config: unknown) {
    this.config = config;
    this.close = vi.fn();
    this.speakTextAsync = vi.fn();
    instances.push(this);
  });
  return {
    fromSubscription: vi.fn(),
    synthesizer,
    instances,
    loggerError: vi.fn(),
  };
});

vi.mock('microsoft-cognitiveservices-speech-sdk', () => ({
  SpeechConfig: { fromSubscription },
  SpeechSynthesizer: synthesizer,
}));
vi.mock('@eolian/common/logger', () => ({
  logger: { error: loggerError },
}));

import { AzureSpeechService } from '@eolian/api/speech/azure-speech-service';

async function read(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

describe('AzureSpeechService', () => {
  beforeEach(() => {
    fromSubscription.mockReset();
    synthesizer.mockClear();
    instances.length = 0;
    fromSubscription.mockReturnValue({});
  });

  it('configures the voice, returns synthesized audio, and closes the SDK resource', async () => {
    const service = new AzureSpeechService('subscription', 'westus');
    expect(fromSubscription).toHaveBeenCalledWith('subscription', 'westus');
    expect(fromSubscription.mock.results[0].value).toMatchObject({
      speechSynthesisVoiceName: 'en-GB-OllieMultilingualNeural',
    });

    const result = service.textToSpeech('hello');
    const instance = instances[0];
    expect(instance.config).toBe(fromSubscription.mock.results[0].value);
    expect(instance.speakTextAsync).toHaveBeenCalledWith(
      'hello',
      expect.any(Function),
      expect.any(Function),
    );

    instance.speakTextAsync.mock.calls[0][1]({ audioData: Uint8Array.from([1, 2, 3]) });
    const stream = await result;
    await expect(read(stream)).resolves.toEqual(Buffer.from([1, 2, 3]));
    expect(instance.close).toHaveBeenCalled();
  });

  it('logs and rejects synthesis failures after closing the synthesizer', async () => {
    const service = new AzureSpeechService('subscription', 'westus');
    const result = service.textToSpeech('hello');
    const error = new Error('synthesis failed');

    instances[0].speakTextAsync.mock.calls[0][2](error);

    await expect(result).rejects.toBe(error);
    expect(loggerError).toHaveBeenCalledWith('Error synthesizing speech: %s', error);
    expect(instances[0].close).toHaveBeenCalled();
  });

  it('uses the fixed fallback phrase for generated sounds', async () => {
    const service = new AzureSpeechService('subscription', 'westus');
    const result = service.createSound('ignored');

    expect(instances[0].speakTextAsync.mock.calls[0][0]).toBe(
      "I'm sorry, I cannot generate audio from text yet.",
    );
    instances[0].speakTextAsync.mock.calls[0][1]({ audioData: new Uint8Array() });
    await result;
  });
});
