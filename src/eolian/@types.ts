import { Closable } from 'common/@types';
import { PERMISSION } from 'common/constants';
import { Identifier, UserDTO } from 'data/@types';

export interface EolianBot extends Closable {
  start(): Promise<void>;
}

export interface ContextTextChannel {
  send(message: string): Promise<ContextMessage>;
  sendSelection(question: string, options: string[], userId: string): Promise<number | undefined>
  sendEmbed(embed: EmbedMessage): Promise<ContextMessage>;
}

export interface ContextClient {
  readonly name: string;
  readonly pic: string;
  generateInvite(): Promise<string>;
}

export interface ContextMessage {
  readonly text: string;
  reply(message: string): Promise<void>;
  getButtons(): Array<{ emoji: string, count: number }>;
  delete(): Promise<void>;
}


export interface ContextUser {
  readonly id: string;
  readonly name: string;
  readonly avatar: string;
  readonly permission: PERMISSION;
  get(): Promise<UserDTO>;
  clearData(): Promise<boolean>;
  setIdentifier(id: string, identifier: Identifier): Promise<void>;
  setSpotify(id: string | null): Promise<void>;
  setSoundCloud(id: number | null): Promise<void>;
}

export interface ContextQueue {

}

export interface EmbedMessage {
  header?: {
    icon?: string;
    text: string;
  };
  title?: string;
  description?: string;
  color?: number;
  thumbnail?: string;
  url?: string;
  image?: string;
  footer?: {
    icon?: string;
    text: string;
  };
  buttons?: MessageButton[];
}

export interface MessageButton {
  emoji: string;
  /**
   * Return true if message is to be destroyed after.
   */
  onClick?: (message: ContextMessage, user: ContextUser) => Promise<boolean>;
}