import { AbsRangeArgument } from 'common/@types';
import { logger } from 'common/logger';
import { MusicQueueCache } from 'data/@types';
import { Track } from 'music/@types';

export class MusicQueueService {

  constructor(private readonly queues: MusicQueueCache) { }

  async unpop(guildId: string, count: number): Promise<boolean> {
    try {
      return await this.queues.unpop(guildId, count);
    } catch (e) {
      logger.warn(`Failed to pop previous track from queue: guildId: ${guildId}`);
      throw e;
    }
  }

  async getTracks(guildId: string, limit?: number): Promise<Track[]> {
    try {
      return await this.queues.get(guildId, limit);
    } catch (e) {
      logger.warn(`Failed to get tracks from queue: guildId: ${guildId} limit: ${limit}`);
      throw e;
    }
  }

  async removeTracks(guildId: string, range: AbsRangeArgument): Promise<number> {
    try {
      return await this.queues.remove(guildId, range);
    } catch (e) {
      logger.warn(`Failed to remove tracks from queue: guildId: ${guildId} range: ${range.start} ${range.stop}`);
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

  async pop(guildId: string): Promise<Track | undefined> {
    try {
      return await this.queues.pop(guildId);
    } catch (e) {
      logger.warn(`Failed to pop the queue: guildId: ${guildId}`);
      throw e;
    }
  }

  async peek(guildId: string): Promise<Track | undefined> {
    try {
      return await this.queues.peek(guildId);
    } catch (e) {
      logger.warn(`Failed to pop the queue: guildId: ${guildId}`);
      throw e;
    }
  }

}