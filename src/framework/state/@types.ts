import { Closable } from '@eolian/common/@types';
import { Player } from '@eolian/music/@types';
import { ContextServer, ContextMusicQueue, PlayerDisplay, QueueDisplay } from '../@types';

export interface ServerState extends Closable {
  details: ContextServer;
  player: Player;
  queue: ContextMusicQueue;
  display: ServerStateDisplay;
  isIdle(): boolean;
  closeIdle(): Promise<void>;
  addDisposable(disposable: Closable): void;
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
