interface ContextUser {

  readonly id: string;
  readonly name: string;
  readonly avatar: string;
  readonly permission: PERMISSION;

}

interface ContextMessage {

  reply(message: string): Promise<void>;

  getButtons(): { emoji: string, count: number }[];

  delete(): Promise<void>;

}

interface ContextTextChannel {

  send(message: string): Promise<ContextMessage>;

  sendSelection(question: string, options: string[], userId: string): Promise<number>

  sendEmbed(embed: EmbedMessage): Promise<ContextMessage>;

}

interface BotService {

  readonly name: string;
  readonly pic: string;

  generateInvite(): Promise<string>;

}