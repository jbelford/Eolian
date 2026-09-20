import assert from 'node:assert/strict';
import test from 'node:test';
import { createCleanupCommand, createPlayCommand } from './chat-command';

test('creates a mention-based URL play command', () => {
  assert.equal(
    createPlayCommand({
      eolianBotId: '123',
      source: 'youtube',
      requestType: 'url',
      request: ' https://youtu.be/example ',
    }),
    '<@123> play https://youtu.be/example',
  );
});

test('creates a source-specific fast search command', () => {
  assert.equal(
    createPlayCommand({
      eolianBotId: '123',
      source: 'soundcloud',
      requestType: 'search',
      request: ' test track ',
    }),
    '<@123> play (test track) soundcloud fast',
  );
});

test('creates a run-bound cleanup command', () => {
  assert.equal(
    createCleanupCommand('123', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'),
    '<@123> e2e-cleanup aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  );
});
