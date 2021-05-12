import { ServerState, ServerStateStore } from './@types';


export class InMemoryServerStateStore implements ServerStateStore {

  private readonly state: { [key: string]: ServerState } = {};

  get(guildId: string): ServerState | undefined {
    return this.state[guildId];
  }

  set(guildId: string, player: ServerState): void {
    this.state[guildId] = player;
  }

}