import { environment } from '@eolian/common/env';
import { logger } from '@eolian/common/logger';
import { SpeechConfig, SpeechSynthesizer } from 'microsoft-cognitiveservices-speech-sdk';
import { PassThrough, Readable } from 'stream';

class SpeechService {
  private readonly speechConfig: SpeechConfig;

  constructor(subscriptionKey: string, serviceRegion: string) {
    this.speechConfig = SpeechConfig.fromSubscription(subscriptionKey, serviceRegion);
    this.speechConfig.speechSynthesisVoiceName = 'en-GB-OllieMultilingualNeural';
  }

  textToSpeech(text: string): Promise<Readable> {
    return new Promise((resolve, reject) => {
      const bufferStream = new PassThrough();
      const synthesizer = new SpeechSynthesizer(this.speechConfig);

      bufferStream.on('close', () => {
        synthesizer.close();
      });

      synthesizer.speakTextAsync(
        text,
        result => {
          const { audioData } = result;

          bufferStream.end(Buffer.from(audioData));
          synthesizer.close();
          resolve(bufferStream);
        },
        error => {
          logger.error('Error synthesizing speech: %s', error);
          synthesizer.close();
          bufferStream.end();
          reject(error);
        }
      );
    })
  }
}

export const speechService = new SpeechService(
  environment.tokens.speech.key,
  environment.tokens.speech.region
);
