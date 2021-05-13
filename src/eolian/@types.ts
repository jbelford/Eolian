import { Closable } from 'common/@types';
import { PERMISSION } from 'common/constants';
import { Identifier, UserDTO } from 'data/@types';
import { Player } from 'music/@types';

export interface EolianBot extends Closable {
  start(): Promise<void>;
}

export interface ContextTextChannel {
  send(message: string): Promise<ContextMessage>;
  sendSelection(question: string, options: string[], user: ContextUser): Promise<number>
  sendEmbed(embed: EmbedMessage): Promise<ContextMessage>;
}

export interface ContextClient {
  readonly name: string;
  readonly pic?: string;
  getVoice(): ContextVoiceConnection | undefined;
  generateInvite(): Promise<string>;
}

export interface ContextMessage {
  readonly text: string;
  edit(message: string): Promise<void>;
  reply(message: string): Promise<void>;
  react(emoji: string): Promise<void>;
  getButtons(): Array<{ emoji: string, count: number }>;
  releaseButtons(): void;
  delete(): Promise<void>;
}

export interface ContextVoiceChannel {
  readonly id: string;
  join(): Promise<void>;
}

export interface ContextVoiceConnection {
  readonly channelId: string;
  readonly player: Player;
  disconnect(): Promise<void>;
}

export interface ContextUser {
  readonly id: string;
  readonly name: string;
  readonly avatar?: string;
  readonly permission: PERMISSION;
  getVoice(): ContextVoiceChannel | undefined;
  get(): Promise<UserDTO>;
  clearData(): Promise<boolean>;
  setIdentifier(id: string, identifier: Identifier): Promise<void>;
  removeIdentifier(id: string): Promise<boolean>;
  setSpotify(id: string | null): Promise<void>;
  setSoundCloud(id: number | null): Promise<void>;
}

export interface EmbedMessage {
  header?: {
    icon?: string;
    text: string;
  };
  title?: string;
  description?: string;
  fields?: {
    name: string;
    value: string;
  }[];
  color?: number;
  thumbnail?: string;
  url?: string;
  image?: string;
  footer?: {
    icon?: string;
    text: string;
  };
  buttons?: MessageButton[];
  buttonUserId?: string;
}

export interface MessageButton {
  emoji: string;
  /**
   * Return true if message is to be destroyed after.
   */
  onClick?: MessageButtonOnClickHandler;
}

export type MessageButtonOnClickHandler = (message: ContextMessage, user: ContextUser, emoji: string) => Promise<boolean>;