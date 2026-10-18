import { randomBytes } from 'node:crypto';
import { ApiConfig } from '../src/config.js';

// Test-only identity: generate a fresh password in each worker, never reuse deployment secrets.
export const testCredentials = {
  username: 'demo-test-user',
  password: randomBytes(24).toString('base64url'),
};
export const testEnvironment = {
  DEMO_USERNAME: testCredentials.username,
  DEMO_PASSWORD: testCredentials.password,
};

/** Tests override application settings without depending on a developer's private .env. */
export class TestApiConfig extends ApiConfig {
  constructor(values: Record<string, string | undefined> = {}) {
    super({ ...testEnvironment, ...values });
  }
}
