import { TestApiConfig } from './credentials.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';
import { Database } from '../src/db.js';

const databases: Database[] = [];

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.disconnect()));
  vi.restoreAllMocks();
});

describe('database resource ownership', () => {
  it('connects to the configured external database without starting temporary MongoDB', async () => {
    const uri = 'configured-test-uri';
    const database = new Database(new TestApiConfig({ MONGO_URI: uri }));
    databases.push(database);
    const connect = vi.spyOn(database.client, 'connect').mockResolvedValue(database.client);
    const start = vi.spyOn(MongoMemoryReplSet.prototype, 'start');
    await database.connect();
    expect(connect).toHaveBeenCalledWith(uri, { serverSelectionTimeoutMS: 10_000 });
    expect(start).not.toHaveBeenCalled();
  });

  it('honors an explicit caller-owned URI even when temporary mode is configured', async () => {
    const uri = 'caller-owned-test-uri';
    const database = new Database(new TestApiConfig({ MONGO_IN_MEMORY: 'true' }));
    databases.push(database);
    const connect = vi.spyOn(database.client, 'connect').mockResolvedValue(database.client);
    const start = vi.spyOn(MongoMemoryReplSet.prototype, 'start');
    await database.connect(uri);
    expect(connect).toHaveBeenCalledWith(uri, { serverSelectionTimeoutMS: 10_000 });
    expect(start).not.toHaveBeenCalled();
  });

  it('fails clearly without a URI instead of silently connecting to a default database', async () => {
    const database = new Database(new TestApiConfig());
    databases.push(database);
    const connect = vi.spyOn(database.client, 'connect');
    await expect(database.connect()).rejects.toThrow('Set MONGO_URI or enable MONGO_IN_MEMORY');
    expect(connect).not.toHaveBeenCalled();
  });

  it('cleans up partially started MongoDB when startup fails and tolerates repeated shutdown', async () => {
    const database = new Database(
      new TestApiConfig({ MONGO_IN_MEMORY: 'true', LOG_LEVEL: 'silent' }),
    );
    databases.push(database);
    const failure = new Error('MongoDB binary is unavailable.');
    vi.spyOn(MongoMemoryReplSet.prototype, 'start').mockRejectedValue(failure);
    const stop = vi.spyOn(MongoMemoryReplSet.prototype, 'stop').mockResolvedValue(true);
    await expect(database.connect()).rejects.toBe(failure);
    await database.disconnect();
    expect(stop).toHaveBeenCalledOnce();
    expect(database.available).toBe(false);
  });

  it('stops temporary MongoDB if the Mongoose connection fails after startup', async () => {
    const database = new Database(
      new TestApiConfig({ MONGO_IN_MEMORY: 'true', LOG_LEVEL: 'silent' }),
    );
    databases.push(database);
    vi.spyOn(MongoMemoryReplSet.prototype, 'start').mockResolvedValue();
    vi.spyOn(MongoMemoryReplSet.prototype, 'getUri').mockReturnValue('temporary-test-uri');
    const stop = vi.spyOn(MongoMemoryReplSet.prototype, 'stop').mockResolvedValue(true);
    const failure = new Error('Connection failed.');
    vi.spyOn(database.client, 'connect').mockRejectedValue(failure);
    await expect(database.connect()).rejects.toBe(failure);
    expect(stop).toHaveBeenCalledOnce();
    expect(database.available).toBe(false);
  });
});
