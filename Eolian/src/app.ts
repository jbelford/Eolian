import * as nodeCleanup from 'node-cleanup';
import { KeywordParsingStrategy } from "./commands/parsing";
import { logger } from "./common/logger";
import { DiscordEolianBot } from "./discord/bot";

const bot: EolianBot = new DiscordEolianBot();
bot.onMessage(new KeywordParsingStrategy());
bot.start()
  .catch(err => logger.error(`Failed to start bot! ${err}`));

// Handler for cleaning up resources on shutdown
nodeCleanup((exitCode, signal) => {
  logger.info('Executing cleanup');
  bot.stop()
    .catch(err => logger.warn('Failed to clean up bot!', err))
    .then(() => {
      if (signal) {
        process.kill(process.pid, signal);
      }
    });
  nodeCleanup.uninstall();
  return false;
});
