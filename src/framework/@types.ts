import { Track } from 'api/@types';
import { SyntaxType } from 'commands/@types';
import { Closable } from 'common/@types';
import { PERMISSION } from 'common/constants';
import { Identifier, ServerDTO, ServerQueue, UserDTO } from 'data/@types';
import { SelectionOption } from 'embed/@types';
import { Player } from 'music/@types';

export interface EolianBot extends Closable {
  start(): Promise<void>;
}

export interface ContextTextChannel {
  readonly lastMessageId?: string;
  readonly sendable: boolean;
  send(message: string): Promise<ContextMessage | undefined>;
  sendSelection(question: string, options: SelectionOption[], user: ContextUser): Promise<number>
  sendEmbed(embed: EmbedMessage): Promise<ContextMessage | undefined>;
}

export interface ContextClient {
  readonly name: string;
  readonly pic?: string;
  getVoice(): ContextVoiceConnection | undefined;
  generateInvite(): Promise<string>;
  getServers(): ServerInfo[];
  leave(id: string): Promise<boolean>;
}

export interface ServerInfo {
  readonly name: string;
  readonly id: string;
  readonly members: number;
  readonly owner: string;
  readonly avatar?: string;
  readonly botCount?: number;
  readonly botRatio?: number;
}

export interface ContextMessage {
  readonly text: string;
  readonly id: string;
  edit(message: string): Promise<void>;
  editEmbed(embed: EmbedMessage): Promise<void>;
  reply(message: string): Promise<void>;
  react(emoji: string): Promise<void>;
  getReactions(): ContextMessageReaction[];
  releaseButtons(): void;
  delete(): Promise<void>;
}

export type ContextMessageReaction = {
  emoji: string;
  count: number;
}

export interface ContextVoiceChannel {
  readonly id: string;
  readonly joinable: boolean;
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
  reactions?: string[];
  buttons?: EmbedMessageButton[];
  buttonUserId?: string;
}

export const enum ButtonStyle {
  PRIMARY = 0,
  SECONDARY,
  SUCCESS,
  DANGER,
  LINK
}

export interface EmbedMessageButton {
  emoji: string;
  style?: ButtonStyle;
  disabled?: boolean;
  /**
   * Return true if message is to be destroyed after.
   */
  onClick: MessageButtonOnClickHandler;
}

export type MessageButtonOnClickHandler = (message: ContextMessage, user: ContextUser, emoji: string) => Promise<boolean>;

export interface Display extends Closable {
  setChannel(channel: ContextTextChannel): void;
  removeIdle(): Promise<void>;
}

export interface PlayerDisplay extends Display {
  refresh(): Promise<void>;
}

export interface QueueDisplay extends Display {
  setChannel(channel: ContextTextChannel): void;
  send(tracks: Track[], loop: Track[], start?: number, total?: number): Promise<void>;
  delete(): Promise<void>;
}

export interface ServerStateStore {
  get(id: string): Promise<ServerState | undefined>;
  set(id: string, context: ServerState): Promise<void>;
}

export interface ServerState {
  details: ServerDetails;
  player: Player;
  queue: ServerQueue;
  display: {
    queue: QueueDisplay;
    player: PlayerDisplay;
  },
  disposable: Closable[];
}

export interface ServerDetails extends ServerInfo {
  get(): Promise<ServerDTO>;
  setPrefix(prefix: string): Promise<void>;
  setVolume(volume: number): Promise<void>;
  setSyntax(type: SyntaxType): Promise<void>;
}