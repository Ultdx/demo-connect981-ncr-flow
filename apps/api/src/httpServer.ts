import { createServer, type Server } from 'node:http';
import { ApiApplication } from './app.js';
import { Database } from './db.js';
import { ApiConfig } from './config.js';

/** Owns HTTP lifecycle; dependencies can be constructed without listening. */
export class ApiServer {
  private server: Server | undefined;

  constructor(
    private readonly application: ApiApplication,
    private readonly database: Database,
    private readonly config: ApiConfig,
  ) {}

  async start(): Promise<void> {
    await this.application.initialize();
    const yoga = this.application.create({ graphiql: this.config.values.GRAPHIQL });
    const server = createServer((request, response) => {
      if (request.url === '/health') {
        response.writeHead(this.database.available ? 200 : 503, {
          'Content-Type': 'application/json',
        });
        response.end(JSON.stringify({ status: this.database.available ? 'ok' : 'unavailable' }));
        return;
      }
      void yoga(request, response);
    });
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(this.config.values.PORT, '0.0.0.0', resolve);
    });
    if (this.config.values.LOG_LEVEL !== 'silent')
      console.info(`NCR Flow API listening on http://localhost:${this.config.values.PORT}/graphql`);
  }

  async stop(): Promise<void> {
    // Drain requests before closing the connection used by their transactions.
    try {
      const server = this.server;
      if (server?.listening)
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
    } finally {
      await this.database.disconnect();
    }
  }
}
