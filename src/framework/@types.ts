import { TrackSource, Track } from '@eolian/api/@types';
import { ParsedCommand, SyntaxType } from '@eolian/commands/@types';
import { Closable } from '@eolian/common/@types';
import { UserPermission } from '@eolian/common/constants';
import { ServerDTO, UserDTO, Identifier, ServerQueue } from '@eolian/data/@types';
import { SelectionOption } from '@eolian/embed/@types';
import { AuthorizationCodeProvider } from '@eolian/http';
import { IAuthService, IOAuthRequest } from '@eolian/http/@types';
import { Player } from '@eolian/music/@types';

export interface EolianBot extends Closable {
  start(): Promise<void>;
}

export type SelectionResult = {
  message: ContextMessage;
  selected: number;
};

export interface ContextSendable {
  readonly sendable: boolean;
  send(message: string, options?: ContextInteractionOptions): Promise<ContextMessage | undefined>;
  sendSelection(
    question: string,
    options: SelectionOption[],
    user: ContextUser
  ): Promise<SelectionResult>;
  sendEmbed(
    embed: EmbedMessage,
    options?: ContextInteractionOptions
  ): Promise<ContextMessage | undefined>;
}

export interface ContextTextChannel extends ContextSendable {
  readonly isDm: boolean;
  readonly visible: boolean;
  readonly reactable: boolean;
  readonly lastMessageId?: string;
}

export interface ContextClient {
  readonly name: string;
  readonly pic?: string;
  getVoice(): ContextVoiceConnection | undefined;
  generateInvite(): string;
  getServers(): ServerInfo[];
  getIdleServers(minDate: Date): Promise<ServerDTO[]>;
  getUnusedServers(): Promise<ServerInfo[]>;
  updateCommands(): Promise<boolean>;
  getRecentlyUsedCount(): number;
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
  react(emoji: string): Promise<void>;
  releaseButtons(): void;
  delete(): Promise<void>;
}

export type ContextInteractionOptions = {
  ephemeral?: boolean;
  force?: boolean;
};

export interface ContextInteraction extends ContextSendable {
  readonly user: ContextUser;
  readonly channel: ContextTextChannel;
  readonly hasReplied: boolean;
  defer(ephemeral?: boolean): Promise<void>;
}

export interface ContextCommandInteraction extends ContextInteraction {
  readonly reactable: boolean;
  readonly isSlash?: boolean;
  react(emoji: string): Promise<void>;
  getCommand(config?: ServerDetails): Promise<ParsedCommand>;
  toString(): string;
}

export interface ContextButtonInteraction extends ContextInteraction {
  readonly message: ContextMessage;
  deferUpdate(): Promise<void>;
}

export interface ContextVoiceChannel {
  readonly id: string;
  readonly joinable: boolean;
  join(): Promise<void>;
  hasPeopleListening(): boolean;
}

export interface ContextVoiceConnection extends Closable {
  readonly channelId: string;
  getChannel(): ContextVoiceChannel;
  awaitReconnect(): Promise<boolean>;
}

export interface ContextUser extends Pick<ContextSendable, 'send' | 'sendEmbed'> {
  readonly id: string;
  readonly name: string;
  readonly avatar?: string;
  readonly permission: UserPermission;
  updatePermissions(details?: ServerDetails): Promise<void>;
  getVoice(): ContextVoiceChannel | undefined;
  get(): Promise<UserDTO>;
  getRequest(sendable: ContextSendable, api: TrackSource): Promise<IOAuthRequest>;
  setToken(token: string | null, api: TrackSource): Promise<void>;
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
  buttons?: EmbedMessageButton[];
}

export const enum ButtonStyle {
  PRIMARY = 0,
  SECONDARY,
  SUCCESS,
  DANGER,
  LINK,
}

export interface EmbedMessageButton {
  emoji: string;
  style?: ButtonStyle;
  disabled?: boolean;
  permission?: UserPermission;
  userId?: string;
  /**
   * Return true if message is to be destroyed after.
   */
  onClick: MessageButtonOnClickHandler;
}

export type MessageButtonOnClickHandler = (
  interaction: ContextButtonInteraction,
  emoji: string
) => Promise<boolean>;

export interface Display extends Closable {
  setChannel(channel: ContextTextChannel, sendable?: ContextSendable): void;
  removeIdle(): Promise<void>;
}

export interface PlayerDisplay extends Display {
  refresh(): Promise<void>;
}

export interface QueueDisplay extends Display {
  send(tracks: Track[], loop: Track[], start?: number, total?: number): Promise<void>;
  delete(): Promise<void>;
}

export interface ServerStateStore extends Closable {
  active: number;
  get(id: string): Promise<ServerState | undefined>;
  set(id: string, context: ServerState): Promise<void>;
}

export interface ServerStateDisplay {
  queue: QueueDisplay;
  player: PlayerDisplay;
}

export interface ServerState extends Closable {
  details: ServerDetails;
  player: Player;
  queue: ServerQueue;
  display: ServerStateDisplay;
  isIdle(): boolean;
  closeIdle(): Promise<void>;
  addDisposable(disposable: Closable): void;
}

export interface ServerDetails extends ServerInfo {
  get(): Promise<ServerDTO>;
  setPrefix(prefix: string): Promise<void>;
  setVolume(volume: number): Promise<void>;
  setSyntax(type: SyntaxType): Promise<void>;
  addDjRole(id: string): Promise<boolean>;
  removeDjRole(id: string): Promise<boolean>;
  setDjLimited(allow: boolean): Promise<void>;
  updateUsage(): Promise<void>;
}

export type UserRequest = IOAuthRequest<AuthorizationCodeProvider>;

export interface IAuthServiceProvider extends Closable {
  getService(api: TrackSource): IAuthService;
  getUserRequest(userId: string, api: TrackSource): Promise<UserRequest | undefined>;
  setUserRequest(userId: string, request: UserRequest, api: TrackSource): Promise<void>;
  removeUserRequest(userId: string, api?: TrackSource): Promise<void>;
}
