require('./module-setup');

import { DiscordEolianBot } from "bot/discord/bot";
import { EolianBot } from "bot/eolian";
import { KeywordParsingStrategy } from "commands/parsing";
import { logger } from "common/logger";
import { MongoDatabase } from 'data/mongo/db';
import * as nodeCleanup from 'node-cleanup';

(async () => {
  try {
    const db: Database = await MongoDatabase.connect();
    const bot: EolianBot = await DiscordEolianBot.connect(db, KeywordParsingStrategy);

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
    logger.error(`Something went horribly wrong: ${e.stack || e}`);
  }
})();

