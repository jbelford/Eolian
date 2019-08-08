import { logger } from 'common/logger';
import { MusicQueueDAO } from 'data/@types';
import { Track } from 'music/@types';

export class MusicQueueService {

  constructor(private readonly queues: MusicQueueDAO) { }

  async getTracks(guildId: string, limit?: number): Promise<Track[]> {
    try {
      return await this.queues.get(guildId, limit);
    } catch (e) {
      logger.warn(`Failed to get tracks from queue: guildId: ${guildId} limit: ${limit}`);
      throw e;
    }
  }

  async addTracks(guildId: string, tracks: Track[], head = false): Promise<void> {
    try {
      return await this.queues.add(guildId, tracks, head);
    } catch (e) {
      logger.warn(`Failed to add tracks to queue: guildId: ${guildId} tracks: ${tracks} head: ${head}`);
      throw e;
    }
  }

  async shuffleTracks(guildId: string): Promise<boolean> {
    try {
      return await this.queues.shuffle(guildId);
    } catch (e) {
      logger.warn(`Failed to shuffle the queue: guildId: ${guildId}`);
      throw e;
    }
  }

  async clearTracks(guildId: string): Promise<boolean> {
    try {
      return await this.queues.clear(guildId);
    } catch (e) {
      logger.warn(`Failed to clear the queue: guildId: ${guildId}`);
      throw e;
    }
  }

}