export class EolianBotError extends Error {

  readonly response: string;

  constructor(message: string, response?: string) {
    super(message);
    if (!response) response = message;
    this.response = response;
  }

}