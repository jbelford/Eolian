import assert from 'node:assert/strict';
import test from 'node:test';
import { getE2ECleanupRunId, matchesE2ETestActor } from '../../src/framework/e2e-test-message';

const config = {
  actorId: 'actor',
  guildId: 'guild',
  textChannelId: 'channel',
};
const message = {
  author: { bot: true, id: 'actor' },
  guildId: 'guild',
  channelId: 'channel',
  content: '<@123> play https://youtu.be/example',
};

test('matches only the configured bot, guild, and channel', () => {
  assert.equal(matchesE2ETestActor(message, config), true);
  assert.equal(
    matchesE2ETestActor({ ...message, author: { bot: false, id: 'actor' } }, config),
    false,
  );
  assert.equal(matchesE2ETestActor({ ...message, channelId: 'other' }, config), false);
});

test('accepts only a run-bound cleanup message from the configured actor', () => {
  const runId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  assert.equal(
    getE2ECleanupRunId({ ...message, content: `<@123> e2e-cleanup ${runId}` }, config, '123'),
    runId,
  );
  assert.equal(
    getE2ECleanupRunId({ ...message, content: `<@999> e2e-cleanup ${runId}` }, config, '123'),
    undefined,
  );
});
