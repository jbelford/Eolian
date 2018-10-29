import { Observable, PartialObserver, Subscription } from "rxjs";

export class DefaultPlayer implements Player {

  private readonly streamObservable = new Observable<Track>();

  public messageId: string;

  constructor(readonly guildId: string) { }

  play(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  skip(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  stop(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  pause(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  resume(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  close(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  subscribe(subscriptionHandler: PartialObserver<Track>): Subscription {
    return this.streamObservable.subscribe(subscriptionHandler);
  }

}