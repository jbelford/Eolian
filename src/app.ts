import { createCommandParsingStrategy } from 'commands';
import { CommandParsingStrategy } from 'commands/@types';
import { logger } from 'common/logger';
import { cleanupOnExit } from 'common/util';
import { createDatabase } from 'data';
import { AppDatabase } from 'data/@types';
import { DiscordEolianBot, WebServer } from 'framework';
import { EolianBot } from 'framework/@types';

(async () => {
  try {
    const db: AppDatabase = await createDatabase();
    const parser: CommandParsingStrategy = createCommandParsingStrategy();
    const bot: EolianBot = new DiscordEolianBot({ db, parser });
    const server = new WebServer();

    cleanupOnExit([db, bot, server]);

    await bot.start();
    server.start();
  } catch (e: any) {
    logger.error(`Something went horribly wrong: ${e.stack || e}`);
  }
})();
