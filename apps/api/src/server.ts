import { ApiContainer } from './container.js';
import { ApiServer } from './httpServer.js';

const server = new ApiContainer().get(ApiServer);
try {
  await server.start();
} catch (error) {
  await server.stop();
  throw error;
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void server.stop().then(() => process.exit(0));
  });
}
