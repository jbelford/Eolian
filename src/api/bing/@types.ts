import { Track } from '../@types';

export interface IBingApi {
  searchVideos(query: string, publisher?: string, limit?: number): Promise<BingVideo[]>;
  searchYoutubeSong(
    name: string,
    artist: string,
    duration?: number,
  ): Promise<(Track & { score: number })[]>;
}

export interface BingVideoPublisher {
  name: string;
}

export interface BingVideo {
  id: string;
  name: string;
  duration: string;
  contentUrl: string;
  publisher: BingVideoPublisher[];
  creator: BingVideoPublisher;
}
