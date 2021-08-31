import { Closable } from 'common/@types';
import { createServer, Server } from 'http';

export class WebServer implements Closable {

  private readonly server: Server;

  constructor() {
    this.server = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.write('Eolian Bot');
      res.end();
    });
  }

  start(): void {
    this.server.listen(8080);
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close(err => err ? reject(err) : resolve());
    });
  }
}
