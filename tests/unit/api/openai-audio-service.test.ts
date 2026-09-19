import { describe, expect, it, vi } from 'vitest';
import { OpenAiAudioService } from '@eolian/api/speech/openai-audio-service';

function service(config = {}) {
  const speechCreate = vi.fn();
  const completionCreate = vi.fn();
  const client = {
    audio: { speech: { create: speechCreate } },
    chat: { completions: { create: completionCreate } },
  };
  return {
    service: new (OpenAiAudioService as any)(client, config) as OpenAiAudioService,
    speechCreate,
    completionCreate,
  };
}

describe('OpenAiAudioService', () => {
  it('validates TTS length before calling the SDK', async () => {
    const { service: audio, speechCreate } = service();
    await expect(audio.textToSpeech('x'.repeat(4097))).rejects.toThrow('4096');
    expect(speechCreate).not.toHaveBeenCalled();
  });

  it('passes configured TTS options and returns the SDK stream', async () => {
    const { service: audio, speechCreate } = service({ ttsModel: 'custom-tts' });
    const body = { stream: true };
    speechCreate.mockResolvedValue({ body });
    await expect(audio.textToSpeech('hello')).resolves.toBe(body);
    expect(speechCreate).toHaveBeenCalledWith({
      model: 'custom-tts',
      voice: 'fable',
      input: 'hello',
      response_format: 'opus',
    });
  });

  it('rejects empty TTS and generated-audio responses', async () => {
    const { service: audio, speechCreate, completionCreate } = service();
    speechCreate.mockResolvedValue({});
    await expect(audio.textToSpeech('hello')).rejects.toThrow('Failed to receive audio');

    completionCreate.mockResolvedValue({ choices: [] });
    await expect(audio.createSound('rain')).rejects.toThrow('Failed to receive audio');
  });

  it('selects low-cost models, maps voices, and decodes base64 audio', async () => {
    const { service: audio, completionCreate } = service({
      audioModel: 'large-model',
      audioModelMini: 'small-model',
    });
    completionCreate.mockResolvedValue({
      choices: [{ message: { audio: { data: Buffer.from('audio').toString('base64') } } }],
    });

    const stream = await audio.createSound('rain', { preferLowCost: true, voice: 2 });
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));

    expect(Buffer.concat(chunks).toString()).toBe('audio');
    expect(completionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'small-model',
        modalities: ['text', 'audio'],
        audio: { format: 'opus', voice: 'coral' },
      }),
    );
  });
});
