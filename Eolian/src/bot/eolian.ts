import { COMMANDS } from "commands";
import { CommandAction } from "commands/command";
import { MusicQueueService } from "data/queue";
import { EolianUserService } from "data/user";

export abstract class EolianBot {

  protected commands: CommandAction[];

  protected constructor(db: Database, private readonly commandParser: CommandParsingStrategy, botService: BotService) {
    const services = {
      bot: botService,
      queues: new MusicQueueService(db.queuesDao),
      users: new EolianUserService(db.usersDao)
    }
    this.commands = COMMANDS.map(cmd => new cmd.action(services));
  }

  /**
   * Begin communication with the web service
   */
  protected async start(): Promise<void> {
    this.onMessage(this.commandParser);
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
  protected abstract onMessage(commandParser: CommandParsingStrategy);

}