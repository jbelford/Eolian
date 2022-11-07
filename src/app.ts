import { createCommandParsingStrategy } from './commands';
import { CommandParsingStrategy } from './commands/@types';
import { LOGGER_HEADER } from './common/constants';
import { environment } from './common/env';
import { logger } from './common/logger';
import { cleanupOnExit } from './common/util';
import { createDatabase } from './data';
import { AppDatabase } from './data/@types';
import { createAuthProviders, DiscordEolianBot, WebServer } from './framework';
import { EolianBot } from './framework/@types';

process.stdout.write(LOGGER_HEADER);

(async () => {
  try {
    const auth = createAuthProviders();
    const db: AppDatabase = await createDatabase();
    const parser: CommandParsingStrategy = createCommandParsingStrategy();
    const bot: EolianBot = new DiscordEolianBot({ db, parser, auth });
    const server = new WebServer(environment.port, auth);

    cleanupOnExit([auth, db, bot, server]);

    await bot.start();
    server.start();
  } catch (e: any) {
    logger.error(`Something went horribly wrong: %s`, e);
  }
})();
