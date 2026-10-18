import { describe, expect, it } from 'vitest';
import {
  containLotSchema,
  createNcrSchema,
  InputValidation,
  transitionSchema,
} from '../src/validation/inputs.js';
import { ErpAdapter } from '../src/erp/ErpAdapter.js';

describe('command validation', () => {
  const envelope = { ncrId: '000000070000000000000001', expectedSeq: 1 };
  it.each([
    { defectCode: '' },
    { defectCode: '   ' },
    { detectionSource: '' },
    { quantityAffected: 0 },
    { quantityAffected: -1 },
    { quantityAffected: 1.5 },
    { evidence: [] },
  ])('rejects invalid detection fields before creating a record: %j', (override) => {
    expect(
      createNcrSchema.safeParse({
        workOrderId: envelope.ncrId,
        operationStep: 20,
        lotId: envelope.ncrId,
        severity: 'MAJOR',
        defectCode: 'SEAL',
        detectionSource: 'Inspection',
        quantityAffected: 1,
        evidence: ['https://example.com/proof'],
        ...override,
      }).success,
    ).toBe(false);
  });
  it('rejects payload fields that belong to another action', () => {
    expect(
      transitionSchema.safeParse({
        ...envelope,
        action: 'APPROVE',
        payload: { disposition: 'SCRAP' },
      }).success,
    ).toBe(false);
  });
  it('returns structured BAD_USER_INPUT paths', () => {
    expect(() =>
      InputValidation.parse(containLotSchema, { lotNumber: 'LOT-EL-2291', reason: ' ' }),
    ).toThrow(
      expect.objectContaining({
        extensions: {
          code: 'BAD_USER_INPUT',
          issues: [expect.objectContaining({ path: 'reason' })],
        },
      }),
    );
  });
  it('requires a valid material reference and HTTP evidence URLs', () => {
    const input = {
      workOrderId: envelope.ncrId,
      operationStep: 20,
      severity: 'MAJOR',
      defectCode: 'SEAL',
      detectionSource: 'Inspection',
      quantityAffected: 1,
    };
    expect(createNcrSchema.safeParse(input).success).toBe(false);
    expect(
      createNcrSchema.safeParse({
        ...input,
        lotId: envelope.ncrId,
        evidence: ['javascript:alert(1)'],
      }).success,
    ).toBe(false);
    expect(
      createNcrSchema.safeParse({
        ...input,
        lotId: envelope.ncrId,
        evidence: ['https://example.com/evidence'],
      }).success,
    ).toBe(true);
  });
  it('exposes the ERP catalog through defensive copies', () => {
    const adapter = new ErpAdapter();
    adapter.getCatalog().parts.splice(0);
    expect(adapter.findPart('SEAL-A320', 'C')).toBeDefined();
    expect(adapter.findPart('SEAL-A320', 'Z')).toBeUndefined();
    expect(adapter.purchaseOrderFor('SEAL-A320')?.number).toBe('PO-2026-410');
  });
  it.each([
    'not-a-url',
    'example.com/proof',
    'https://',
    'https:/example.com',
    'ftp://example.com/proof',
    'javascript:alert(1)',
  ])('reports one actionable issue for invalid evidence %s', (url) => {
    const result = transitionSchema.safeParse({
      ...envelope,
      action: 'SUBMIT',
      payload: { evidence: [url] },
    });
    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected invalid evidence to be rejected.');
    expect(result.error.issues).toEqual([
      expect.objectContaining({
        path: ['payload', 'evidence', 0],
        message: 'Enter a valid URL starting with http:// or https://.',
      }),
    ]);
  });
});
