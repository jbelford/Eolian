import { COMMANDS } from "commands";
import { MusicQueueService } from "data/queue";
import { EolianUserService } from "data/user";
import { DefaultPlayerManager } from "players/default/manager";

export type EolianBotArgs = {
  db: Database,
  store: MemoryStore,
  parser: CommandParsingStrategy,
  service: BotService
};

export abstract class EolianBot implements Closable {

  protected commands: CommandAction[];
  protected parser: CommandParsingStrategy;

  protected constructor(args: EolianBotArgs) {
    this.parser = args.parser;
    const services: CommandActionServices = {
      bot: args.service,
      queues: new MusicQueueService(args.store.queueDao),
      users: new EolianUserService(args.db.usersDao),
      playerManager: new DefaultPlayerManager()
    };
    this.commands = COMMANDS.map(cmd => new cmd.action(services));
  }

  /**
   * Begin communication with the web service
   */
  protected async start(): Promise<void> {
    this.onMessage();
    await this._start();
  }

  /**
   * Close the connection with the web service
   */
  abstract close(): Promise<void>;

  /**
   * Provider must implement this method to begin communication with service
   */
  protected abstract async _start(): Promise<void>;

  /**
   * Implement this method to register handler for incoming messages
   */
  protected abstract onMessage(): void;

}