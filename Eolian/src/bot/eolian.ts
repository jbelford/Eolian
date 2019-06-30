import { COMMANDS } from "commands";
import { MusicQueueService } from "data/queue";
import { EolianUserService } from "data/user";
import { DefaultPlayerManager } from "players/default/manager";

export abstract class EolianBot {

  protected commands: ICommandAction[];

  protected constructor(db: Database, protected readonly commandParser: CommandParsingStrategy, botService: BotService) {
    const services: CommandActionServices = {
      bot: botService,
      queues: new MusicQueueService(db.queuesDao),
      users: new EolianUserService(db.usersDao),
      playerManager: new DefaultPlayerManager()
    };
    this.commands = COMMANDS.map(action => new action(services));
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
  abstract stop(): Promise<void>;

  /**
   * Provider must implement this method to begin communication with service
   */
  protected abstract async _start(): Promise<void>;

  /**
   * Implement this method to register handler for incoming messages
   */
  protected abstract onMessage(): void;

}