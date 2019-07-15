
/**
 * In development environment we need to override the module aliases at runtime.
 */
const env = process.env.NODE_ENV || 'local';
if (env === 'local') {
  require('./module-setup');
}

import { KeywordParsingStrategy } from "commands/parsing";
import { logger } from "common/logger";
import { FirestoreDatabase } from 'data/firestore/db';
import { LocalMemoryStore } from 'data/memory/store';
import { DiscordEolianBot } from "discord/bot";
import * as nodeCleanup from 'node-cleanup';

const resources: Closable[] = [];

(async () => {
  try {
    const db: Database = new FirestoreDatabase();
    const store: MemoryStore = new LocalMemoryStore();
    const parser: CommandParsingStrategy = new KeywordParsingStrategy();
    const bot: EolianBot = new DiscordEolianBot({ db, store, parser });

    await bot.start();

    resources.push(db, store, bot);
  } catch (e) {
    logger.error(`Something went horribly wrong: ${e.stack || e}`);
  }
})();

// Handler for cleaning up resources on shutdown
nodeCleanup((exitCode, signal) => {
  logger.info('Executing cleanup');

  const promises = resources.map(x => x.close().catch(err => logger.warn(`Failed to clean resource: ${err}`)));

  Promise.all(promises).finally(() => {
    if (signal) process.kill(process.pid, signal);
  });

  nodeCleanup.uninstall();
  return false;
});
