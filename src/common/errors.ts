import { ContextMessage } from '@eolian/framework/@types';

export class EolianUserError extends Error {
  constructor(
    message: string,
    readonly context?: ContextMessage,
  ) {
    super(message);
  }
}
