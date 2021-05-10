import { Player } from 'music/@types';
import { PlayerStore } from './@types';


export class InMemoryPlayerStore implements PlayerStore {

  private readonly players: { [key: string]: Player } = {};

  get(guildId: string): Player | undefined {
    return this.players[guildId];
  }

  store(guildId: string, player: Player): void {
    this.players[guildId] = player;
  }

}