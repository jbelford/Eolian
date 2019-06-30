// import { MusicQueueService } from "data/queue";
// import { Readable, ReadableOptions } from "stream";

// // Discord channels are at most 128 kbps => 16 kBps
// // We can estimate that there are close to 15 seconds left when this many bytes left
// const FETCH_LIMIT = 1000 * 16 * 15;

// /**
//  * This class is a custom readable.
//  * It allows for endless streaming of music by continually
//  * fetching tracks while data is read. Will prefetch future tracks to reduce delay
//  * between songs.
//  */
// export class QueueReadable extends Readable {

//   private fetched = 0;
//   private fetchedNext = false;
//   private currentStream: StreamService.StreamData;
//   private nextStream: StreamService.StreamData;

//   private constructor(private readonly queue: MusicQueueService, stream: StreamService.StreamData, options?: ReadableOptions) {
//     super(options);
//     this.currentStream = stream;
//   }

//   public _read() {
//     this.currentStream.readable.resume();
//   }

//   public _destroy(err, cb) {
//     this.currentStream.readable.destroy(err);
//     cb();
//   }

//   public skip() {
//     const resetFn = () => {
//       this.currentStream.readable.destroy();
//       this.resetReadable();
//     };
//     if (!this.fetchedNext) {
//       this.fetchedNext = true;
//       return this.prepareNextTrack()
//         .catch(err => this.emit('error', err))
//         .then(resetFn);
//     }
//     return Promise.resolve(resetFn());
//   }

//   private addHandlers() {
//     this.currentStream.readable.on('data', chunk => {
//       this.fetched += chunk.length;
//       if (!this.push(chunk)) this.currentStream.readable.pause();
//       if (this.currentStream.size - this.fetched <= FETCH_LIMIT && !this.fetchedNext) {
//         this.fetchedNext = true;
//         this.prepareNextTrack()
//           .catch(err => this.emit('error', err));
//       }
//     });
//     this.currentStream.readable.on('error', (err) => this.emit('error', err));
//     this.currentStream.readable.on('end', () => this.resetReadable());
//   }

//   private resetReadable() {
//     if (!this.nextStream) return this.emit('end');
//     this.emit(READABLE_EVENTS.NEXT, this.nextStream.track);
//     this.currentStream = this.nextStream;
//     this.nextStream = null;
//     this.fetched = 0;
//     this.fetchedNext = false;
//     this.addHandlers();
//   }

//   private async prepareNextTrack() {
//     const next = await this.queue.pop();
//     if (!next) return;
//     this.nextStream = await StreamService.getTrackStream(next);
//   }

//   public static async getInstance(queue: MusicQueueService, options?: ReadableOptions) {
//     const track = await queue.pop();
//     if (!track) return;
//     const stream = await StreamService.getTrackStream(track);
//     return new QueueReadable(queue, stream, options);
//   }

// }