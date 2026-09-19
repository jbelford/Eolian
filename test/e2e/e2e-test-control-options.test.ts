import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createE2ETestCommandOptions,
  isE2ETestPlayRequest,
} from '../../src/framework/e2e-test-control-options';

test('builds a source-specific URL play request', () => {
  const options = createE2ETestCommandOptions({
    source: 'youtube',
    requestType: 'url',
    request: ' https://youtu.be/example ',
  });
  assert.deepEqual(options.URL, {
    source: 2,
    value: 'https://youtu.be/example',
  });
  assert.equal(options.FAST, true);
});

test('builds an extensible source-specific search request', () => {
  const options = createE2ETestCommandOptions({
    source: 'soundcloud',
    requestType: 'search',
    request: ' test track ',
  });
  assert.equal(options.SEARCH, 'test track');
  assert.equal(options.SOUNDCLOUD, true);
});

test('rejects empty and unsupported requests', () => {
  assert.equal(isE2ETestPlayRequest({ source: 'youtube', requestType: 'url', request: '' }), false);
  assert.equal(
    isE2ETestPlayRequest({ source: 'unknown', requestType: 'url', request: 'value' }),
    false,
  );
});
