import { ApiContainer } from '../src/container.js';
import { ApiApplication } from '../src/app.js';
import { Database } from '../src/db.js';

const container = new ApiContainer();

try {
  console.info(
    (await container.get(ApiApplication).initialize(undefined, true))
      ? 'Demo data created.'
      : 'Database already initialized; no data changed.',
  );
} finally {
  await container.get(Database).disconnect();
}
