export abstract class CommandAction<T> {

  constructor(protected keywordArguments: T) {
  }

  public abstract execute({ user: ChatUser }): Promise<string>;
}

