import { describe, expect, it } from 'vitest';
import { evidenceInputSchema } from '../src/evidence';

describe('multiline evidence input', () => {
  it('trims URLs and ignores empty lines', () => {
    expect(
      evidenceInputSchema.parse(
        ' \n https://example.com/proof \r\n\nhttp://localhost:4000/proof\n',
      ),
    ).toEqual(['https://example.com/proof', 'http://localhost:4000/proof']);
  });

  it.each(['', ' \n\t '])('requires at least one evidence URL', (input) => {
    const result = evidenceInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected empty evidence to be rejected.');
    expect(result.error.issues[0]?.message).toBe('Add at least one evidence URL.');
  });

  it.each(['example.com/proof', 'ftp://example.com/proof', 'https://', 'http:example.com'])(
    'rejects invalid links even alongside a valid URL: %s',
    (input) => {
      const result = evidenceInputSchema.safeParse(`https://example.com/proof\n${input}`);
      expect(result.success).toBe(false);
      if (result.success) throw new Error('Expected invalid evidence to be rejected.');
      expect(result.error.issues).toEqual([
        expect.objectContaining({
          path: [1],
          message: 'Enter a valid URL starting with http:// or https://.',
        }),
      ]);
    },
  );

  it('enforces the same 20-link limit as the API', () => {
    expect(
      evidenceInputSchema.safeParse(Array(20).fill('https://example.com/proof').join('\n')).success,
    ).toBe(true);
    expect(
      evidenceInputSchema.safeParse(Array(21).fill('https://example.com/proof').join('\n')).success,
    ).toBe(false);
  });
});
