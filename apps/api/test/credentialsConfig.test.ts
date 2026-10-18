import { describe, expect, it } from 'vitest';
import { ApiConfig } from '../src/config.js';
import { testEnvironment } from './credentials.js';

describe('runtime demo credentials', () => {
  it('requires explicitly configured credentials and has no built-in account', () => {
    expect(() => new ApiConfig({})).toThrow();
    const config = new ApiConfig(testEnvironment);
    expect(config.values.DEMO_USERNAME).toBe(testEnvironment.DEMO_USERNAME);
    expect(config.values.DEMO_PASSWORD).toBe(testEnvironment.DEMO_PASSWORD);
  });

  it('accepts the blank optional frontend origin from the local env template', () => {
    expect(new ApiConfig({ ...testEnvironment, FRONTEND_ORIGIN: '' }).values.FRONTEND_ORIGIN).toBe(
      '',
    );
    expect(() => new ApiConfig({ ...testEnvironment, FRONTEND_ORIGIN: 'not-a-url' })).toThrow();
  });

  it.each([
    { DEMO_USERNAME: undefined },
    { DEMO_USERNAME: '' },
    { DEMO_USERNAME: '   ' },
    { DEMO_PASSWORD: undefined },
    { DEMO_PASSWORD: '' },
    { DEMO_PASSWORD: '   ' },
  ])('rejects an incomplete or blank account (%#)', (override) => {
    expect(() => new ApiConfig({ ...testEnvironment, ...override })).toThrow();
  });
});
