import { testEnvironment } from './credentials.js';

// Default composition roots in tests also receive this worker's isolated demo account.
Object.assign(process.env, testEnvironment);
