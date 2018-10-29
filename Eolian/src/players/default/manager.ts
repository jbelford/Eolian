import { logger } from "common/logger";
import { DefaultPlayer } from "./player";

export class DefaultPlayerManager implements PlayerManager {

  constructor(private readonly registry: Map<string, Player> = new Map<string, Player>()) { }

  getPlayer(guildId: string): Player {
    return this.registry.get(guildId) || null;
  }

  async createPlayer(guildId: string): Promise<Player> {
    if (this.registry.has(guildId)) {
      throw new Error('Attempted to create player when one already exists in the registry.');
    }

    const newPlayer = new DefaultPlayer(guildId);
    newPlayer.subscribe({
      error: err => logger.error(`Player emitted an error: ${err}`),
      complete: () => this.closePlayer(guildId)
    });

    this.registry.set(guildId, newPlayer);
    return newPlayer;
  }


  private closePlayer(guildId: string) {
    const player = this.registry.get(guildId);
    player.close();
    this.registry.delete(guildId);
  }

}