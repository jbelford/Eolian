import { logger } from '@eolian/common/logger';
import { EmbedMessageButton } from './@types';

export class ButtonRegistry {
  private readonly registry = new Map<string, Map<string, EmbedMessageButton>>();

  register(messageId: string, buttons: Map<string, EmbedMessageButton>): void {
    if (!this.registry.has(messageId)) {
      logger.info('Registered buttons for message %s', messageId);
    }
    this.registry.set(messageId, buttons);
  }

  getButton(messageId: string, buttonId: string): EmbedMessageButton | undefined {
    return this.registry.get(messageId)?.get(buttonId);
  }

  unregister(messageId: string): void {
    logger.info('Unregistering buttons for message %s', messageId);
    this.registry.delete(messageId);
  }
}
