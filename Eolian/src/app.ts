import * as nodeCleanup from 'node-cleanup';
import { KeywordParsingStrategy } from "./commands/parsing";
import { logger } from "./common/logger";
import { MongoDatabase } from './db/mongo/db';
import { DiscordEolianBot } from "./discord/bot";

(async () => {
  try {
    const db = await MongoDatabase.getInstance();

    const bot: EolianBot = new DiscordEolianBot(db);
    bot.onMessage(new KeywordParsingStrategy());
    await bot.start();

    // Handler for cleaning up resources on shutdown
    nodeCleanup((exitCode, signal) => {
      logger.info('Executing cleanup');
      Promise.all([
        db.cleanup().catch(err => logger.warn('Failed to clean up db!')),
        bot.stop().catch(err => logger.warn('Failed to clean up bot!'))
      ]).then(() => {
        if (signal) process.kill(process.pid, signal);
      });
      nodeCleanup.uninstall();
      return false;
    });
  } catch (e) {
    logger.error(`Something went horribly wrong: ${e.stack ? e.stack : e}`);
  }
})();

