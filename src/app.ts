import { createCommandParsingStrategy } from 'commands';
import { CommandParsingStrategy } from 'commands/@types';
import { Closable } from 'common/@types';
import { logger } from 'common/logger';
import { createDatabase } from 'data';
import { AppDatabase } from 'data/@types';
import { DiscordEolianBot, WebServer } from 'framework';
import { EolianBot } from 'framework/@types';
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
  } catch (e: any) {
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
