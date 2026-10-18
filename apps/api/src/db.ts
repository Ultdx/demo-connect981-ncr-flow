import { Mongoose } from 'mongoose';
import type { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { ApiConfig } from './config.js';

/** Owns one application's connection; importing a model never opens MongoDB. */
export class Database {
  readonly client = new Mongoose();
  readonly connection = this.client.connection;
  private temporary: MongoMemoryReplSet | undefined;

  constructor(private readonly config: ApiConfig) {}

  async connect(uri?: string): Promise<void> {
    try {
      // An explicit URI keeps externally managed test/demo databases under their
      // caller's ownership. Only the configured hosted mode starts a child process.
      if (uri === undefined && this.config.values.MONGO_IN_MEMORY) {
        if (!this.temporary) {
          if (this.config.values.LOG_LEVEL !== 'silent')
            console.info('Starting temporary MongoDB. Demo changes are discarded on API restart.');
          // Demo only: a real MongoDB process with temporary storage. Transactions
          // require a single-member replica set, which the library configures for us.
          const { MongoMemoryReplSet } = await import('mongodb-memory-server-core');
          this.temporary = new MongoMemoryReplSet({
            binary: { version: '7.0.24' },
            replSet: { count: 1, ip: '127.0.0.1', storageEngine: 'wiredTiger' },
          });
          // Retain ownership before starting so partial startup failures can be cleaned up.
          await this.temporary.start();
        }
        uri = this.temporary.getUri('ncrflow');
      }
      const connectionUri = uri ?? this.config.values.MONGO_URI;
      if (!connectionUri) {
        throw new Error('Set MONGO_URI or enable MONGO_IN_MEMORY in the API environment.');
      }
      await this.client.connect(connectionUri, {
        serverSelectionTimeoutMS: 10_000,
      });
    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
    } finally {
      const temporary = this.temporary;
      this.temporary = undefined;
      await temporary?.stop();
    }
  }

  get available(): boolean {
    return this.connection.readyState === 1;
  }
}
