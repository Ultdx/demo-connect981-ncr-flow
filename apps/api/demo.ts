import { existsSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { join } from 'node:path';
import { createInterface, type Interface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import { ApiContainer } from './src/container.js';
import { ApiApplication } from './src/app.js';
import { Database } from './src/db.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const cachedBinary = join(
  root,
  '.cache',
  'mongodb',
  process.platform === 'win32' ? 'mongod.exe' : 'mongod',
);
class DemoRunner {
  constructor(
    private readonly application: ApiApplication,
    private readonly database: Database,
  ) {}
  private replicaSet: MongoMemoryReplSet | undefined;
  private api: Server | undefined;
  private web: ViteDevServer | undefined;
  private terminal: Interface | undefined;
  private stopping = false;

  // Signals, the stop command, and startup failures share ownership of these resources.
  private async shutdown(exitCode: number): Promise<void> {
    if (this.stopping) return;
    this.stopping = true;
    this.terminal?.close();
    const activeApi = this.api;
    const serverResults = await Promise.allSettled([
      this.web?.close(),
      new Promise<void>((resolve) => {
        if (activeApi?.listening) activeApi.close(() => resolve());
        else resolve();
      }),
    ]);
    try {
      await this.database.disconnect();
    } finally {
      await this.replicaSet?.stop();
      process.exitCode = serverResults.some((result) => result.status === 'rejected')
        ? 1
        : exitCode;
    }
    console.info('Demo stopped. Temporary database discarded.');
  }

  async start(): Promise<void> {
    try {
      const [major, minor] = process.versions.node.split('.').map(Number);
      if (major !== 22 || minor === undefined || minor < 15) {
        throw new Error('Use Node 22.15 or later within Node 22. On this machine: nvm use 22.19.0');
      }

      // This launches a real isolated replica set; transactions behave like the Docker setup.
      // Prefer an explicit or previously verified binary before downloading anything.
      const systemBinary =
        process.env.MONGOMS_SYSTEM_BINARY ?? (existsSync(cachedBinary) ? cachedBinary : undefined);
      console.info('Starting temporary MongoDB 7 replica set…');
      this.replicaSet = await MongoMemoryReplSet.create({
        binary: { version: '7.0.24', systemBinary },
        replSet: { count: 1, storageEngine: 'wiredTiger' },
      });
      await this.application.initialize(this.replicaSet.getUri('ncrflow'), true);

      this.api = createServer(this.application.create({ graphiql: true }));
      const activeApi = this.api;
      await new Promise<void>((resolve, reject) => {
        activeApi.once('error', reject);
        activeApi.listen(4000, '127.0.0.1', resolve);
      });
      this.web = await createViteServer({
        root: join(root, 'apps', 'web'),
        configFile: join(root, 'apps', 'web', 'vite.config.ts'),
        server: { host: '127.0.0.1', port: 5173, strictPort: true },
      });
      await this.web.listen();

      this.terminal = createInterface({ input: process.stdin, output: process.stdout });
      this.terminal.on('line', (line: string) => {
        if (line.trim() === 'stop') void this.shutdown(0);
      });
      this.terminal.on('SIGINT', () => void this.shutdown(0));
      process.once('SIGINT', () => void this.shutdown(0));
      process.once('SIGTERM', () => void this.shutdown(0));
      console.info('\nNCR Flow: http://127.0.0.1:5173');
      console.info('GraphiQL: http://127.0.0.1:4000/graphql');
      console.info('Press Ctrl+C or type stop to finish. All demo changes are temporary.');
    } catch (cause) {
      console.error(cause instanceof Error ? cause.message : 'Unable to start the local demo.');
      await this.shutdown(1);
    }
  }
}
const container = new ApiContainer();
await new DemoRunner(container.get(ApiApplication), container.get(Database)).start();
