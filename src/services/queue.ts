import { EolianBotError } from "common/errors";
import { MusicQueueDAO } from 'data/@types';
import { Track } from 'music/@types';

export class MusicQueueService {

  constructor(private readonly queues: MusicQueueDAO) { }

  async getTracks(guildId: string, limit?: number): Promise<Track[]> {
    try {
      return await this.queues.get(guildId, limit);
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Something went wrong. Failed to fetch the queue.');
    }
  }

  async addTracks(guildId: string, tracks: Track[], head = false): Promise<void> {
    try {
      return await this.queues.add(guildId, tracks, head);
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Something went wrong. Failed to add tracks to the queue.');
    }
  }

  async shuffleTracks(guildId: string): Promise<boolean> {
    try {
      return await this.queues.shuffle(guildId);
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Something went wrong. Failed to shuffle the queue.');
    }
  }

  async clearTracks(guildId: string): Promise<boolean> {
    try {
      return await this.queues.clear(guildId);
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Something went wrong. Failed to clear the queue.');
    }
  }

}