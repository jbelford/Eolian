import { expect, it } from 'vitest';
import { createCleanupCommands, createPlayCommand } from '../../../test/e2e/chat-command';

it('creates a mention-based URL play command', () => {
  expect(
    createPlayCommand({
      eolianBotId: '123',
      source: 'youtube',
      requestType: 'url',
      request: ' https://youtu.be/example ',
    }),
  ).toBe('<@123> play https://youtu.be/example');
});

it('creates a source-specific fast search command', () => {
  expect(
    createPlayCommand({
      eolianBotId: '123',
      source: 'soundcloud',
      requestType: 'search',
      request: ' test track ',
    }),
  ).toBe('<@123> play (test track) soundcloud fast');
});

it('creates normal stop and queue-clear cleanup commands', () => {
  expect(createCleanupCommands('123')).toEqual(['<@123> stop', '<@123> list clear']);
});
