
/**
 * In development environment we need to override the module aliases at runtime.
 */
const env = process.env.NODE_ENV || 'local';
if (env === 'local') {
  require('./module_setup');
}

import { createCommandParsingStrategy } from 'commands';
import { CommandParsingStrategy } from 'commands/@types';
import { Closable } from 'common/@types';
import { logger } from 'common/logger';
import { createDatabase } from 'data';
import { AppDatabase } from 'data/@types';
import { DiscordEolianBot, WebServer } from 'eolian';
import { EolianBot } from 'eolian/@types';
import nodeCleanup from 'node-cleanup';

const resources: Closable[] = [];

(async () => {
  try {
    const db: AppDatabase = await createDatabase();
    const parser: CommandParsingStrategy = createCommandParsingStrategy();
    const bot: EolianBot = new DiscordEolianBot({ db, parser });

    await bot.start();

    const server = new WebServer();
    server.start();

    resources.push(db, bot, server);
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
