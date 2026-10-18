import { describe, expect, it } from 'vitest';
import { WorkflowEngine, WorkflowError } from '../src/workflow/engine.js';
import { workflowV1 } from '../src/workflow/definition.js';
import { WorkflowGates } from '../src/workflow/gates.js';
import { AuditReplay } from '../src/workflow/replay.js';
import type { GateContext, NcrState, TransitionPayload } from '../src/workflow/types.js';

const gates = new WorkflowGates();
const engine = new WorkflowEngine(gates);
const audit = new AuditReplay();

function state(overrides: Partial<NcrState> = {}): NcrState {
  return {
    id: '000000070000000000000001',
    number: 'NCR-TEST-001',
    siteId: '000000010000000000000001',
    workflowKey: 'ncr',
    workflowVersion: 1,
    stage: 'INITIATION',
    state: 'OPEN',
    severity: 'MAJOR',
    partNumber: 'SEAL-A320',
    revision: 'C',
    workOrderId: '000000050000000000000001',
    operationStep: 20,
    defectCode: 'SEALING_DEFECT',
    detectionSource: 'Final inspection',
    quantityAffected: 4,
    lotId: '000000040000000000000001',
    serialIds: [],
    evidence: ['https://example.com/evidence'],
    stageEnteredAt: '2026-10-01T08:00:00.000Z',
    lastEventSeq: 1,
    ...overrides,
  };
}
const command = {
  action: 'SUBMIT' as const,
  role: 'INSPECTOR' as const,
  expectedSeq: 1,
  payload: {},
  at: '2026-10-02T08:00:00.000Z',
  materialOnHold: false,
};
const context = (
  ncr: NcrState,
  payload: TransitionPayload = {},
  materialOnHold = false,
): GateContext => ({ ncr, payload, materialOnHold });

describe('versioned workflow engine', () => {
  it('emits a new projection and event without mutating its inputs', () => {
    const initial = state();
    const before = structuredClone(initial);
    const result = engine.transitionNcr(initial, workflowV1, command);
    expect(initial).toEqual(before);
    expect(result.ncr).toMatchObject({
      stage: 'CONTAINMENT',
      lastEventSeq: 2,
      stageEnteredAt: command.at,
    });
    expect(result.event).toMatchObject({
      seq: 2,
      actorRole: 'INSPECTOR',
      workflowVersion: 1,
      payload: { from: 'INITIATION', to: 'CONTAINMENT', action: 'SUBMIT' },
    });
    result.event.payload.snapshot.evidence.push('https://example.com/another');
    expect(result.ncr.evidence).toHaveLength(1);
  });
  it('rejects forbidden roles', () => {
    expect(() =>
      engine.transitionNcr(state(), workflowV1, { ...command, role: 'QUALITY' }),
    ).toThrow(expect.objectContaining({ code: 'FORBIDDEN_ROLE' }));
  });
  it('rejects stale expected sequence numbers', () => {
    expect(() => engine.transitionNcr(state(), workflowV1, { ...command, expectedSeq: 2 })).toThrow(
      expect.objectContaining({ code: 'CONFLICT' }),
    );
  });
  it('returns gate reasons for an invalid command', () => {
    expect(() => engine.transitionNcr(state({ evidence: [] }), workflowV1, command)).toThrow(
      expect.objectContaining({
        code: 'GATE_FAILED',
        blockedBy: ['Add at least one evidence URL.'],
      }),
    );
  });
  it('filters action previews by role', () => {
    expect(engine.availableActions(state(), workflowV1, 'MRB', false)).toEqual([]);
    expect(
      engine.availableActions(state({ evidence: [] }), workflowV1, 'INSPECTOR', false),
    ).toEqual([
      { action: 'SUBMIT', allowed: false, blockedBy: ['Add at least one evidence URL.'] },
    ]);
  });
  it('rejects unknown gates rather than silently allowing a transition', () => {
    const invalid = structuredClone(workflowV1);
    invalid.transitions[0]!.gates = ['notRegistered' as never];
    expect(() => engine.transitionNcr(state(), invalid, command)).toThrow(WorkflowError);
  });
  it('clears an obsolete approval when MRB rejects and sends the NCR back for review', () => {
    const current = state({
      stage: 'DISPOSITION',
      disposition: 'USE_AS_IS',
      mrbApproval: { role: 'MRB', at: command.at },
    });
    const result = engine.transitionNcr(current, workflowV1, {
      ...command,
      action: 'REJECT',
      role: 'MRB',
      payload: { reason: 'Concession is not justified.' },
    });
    expect(result.ncr.stage).toBe('MRB_REVIEW');
    expect(result.ncr.mrbApproval).toBeUndefined();
    expect(result.ncr.disposition).toBeUndefined();
    expect(result.event.reason).toBe('Concession is not justified.');
  });
  it('records MRB approval when approval is granted', () => {
    const result = engine.transitionNcr(
      state({ stage: 'DISPOSITION', disposition: 'USE_AS_IS' }),
      workflowV1,
      { ...command, action: 'APPROVE', role: 'MRB' },
    );
    expect(result.ncr.mrbApproval).toEqual({ role: 'MRB', at: command.at });
    expect(result.ncr.stage).toBe('EXECUTION');
  });
  it('closes only with Quality verification and makes CLOSED terminal', () => {
    const result = engine.transitionNcr(state({ stage: 'CLOSURE' }), workflowV1, {
      ...command,
      action: 'CLOSE',
      role: 'QUALITY',
      payload: { verificationNote: 'Verified against inspection results.' },
    });
    expect(result.ncr.state).toBe('CLOSED');
    expect(engine.availableActions(result.ncr, workflowV1, 'QUALITY', false)).toEqual([]);
    expect(() =>
      engine.transitionNcr(result.ncr, workflowV1, { ...command, expectedSeq: 2 }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_TRANSITION' }));
  });
  it('ignores fields a command does not own', () => {
    const result = engine.transitionNcr(state(), workflowV1, {
      ...command,
      payload: { disposition: 'SCRAP', verificationNote: 'Injected note.' },
    });
    expect(result.ncr.disposition).toBeUndefined();
    expect(result.ncr.verificationNote).toBeUndefined();
  });
  it('keeps v1 instances pinned after a v2 is published', () => {
    const v2 = { ...structuredClone(workflowV1), version: 2, transitions: [] };
    const versions = [workflowV1, v2];
    const initial = state();
    const pinned = versions.find((workflow) => workflow.version === initial.workflowVersion)!;
    expect(engine.transitionNcr(initial, pinned, command).ncr.workflowVersion).toBe(1);
    expect(() => engine.transitionNcr(initial, v2, command)).toThrow(
      expect.objectContaining({ code: 'WORKFLOW_MISMATCH' }),
    );
  });
});

describe('pure gates', () => {
  it('requires evidence and complete detection fields', () => {
    expect(gates.checks.hasEvidence(context(state({ evidence: [] })))).toBeDefined();
    expect(gates.checks.hasEvidence(context(state({ partNumber: '' })))).toBeDefined();
    expect(gates.checks.hasEvidence(context(state()))).toBeUndefined();
  });
  it('requires a containment description', () => {
    expect(gates.checks.hasContainmentAction(context(state()))).toBeDefined();
    expect(
      gates.checks.hasContainmentAction(context(state({ containmentAction: 'Segregated.' }))),
    ).toBeUndefined();
  });
  it('requires a hold for critical material', () => {
    const critical = state({ severity: 'CRITICAL', containmentAction: 'Segregated.' });
    expect(gates.checks.hasContainmentAction(context(critical))).toContain('hold');
    expect(gates.checks.hasContainmentAction(context(critical, {}, true))).toBeUndefined();
  });
  it('requires a disposition', () => {
    expect(gates.checks.hasDisposition(context(state()))).toBeDefined();
    expect(gates.checks.hasDisposition(context(state({ disposition: 'SCRAP' })))).toBeUndefined();
  });
  it.each(['REWORK', 'REPAIR'] as const)(
    'requires engineering instructions for %s',
    (disposition) => {
      expect(
        gates.checks.reworkRepairHasInstructions(context(state({ disposition }))),
      ).toBeDefined();
      expect(
        gates.checks.reworkRepairHasInstructions(
          context(state({ disposition, engineeringInstructions: 'Follow WI-102.' })),
        ),
      ).toBeUndefined();
    },
  );
  it.each(['USE_AS_IS', 'REPAIR'] as const)(
    'blocks %s execution without MRB approval',
    (disposition) => {
      const current = state({ stage: 'EXECUTION', disposition });
      expect(() =>
        engine.transitionNcr(current, workflowV1, {
          ...command,
          action: 'COMPLETE_EXECUTION',
          role: 'PRODUCTION',
        }),
      ).toThrow(expect.objectContaining({ code: 'GATE_FAILED' }));
      current.mrbApproval = { role: 'MRB', at: command.at };
      expect(
        engine.transitionNcr(current, workflowV1, {
          ...command,
          action: 'COMPLETE_EXECUTION',
          role: 'PRODUCTION',
        }).ncr.stage,
      ).toBe('CLOSURE');
    },
  );
  it('allows scrap without a concession approval', () => {
    expect(
      gates.checks.mrbApprovedIfConcession(context(state({ disposition: 'SCRAP' }))),
    ).toBeUndefined();
  });
  it('requires a rejection reason', () => {
    expect(gates.checks.hasReason(context(state()))).toBeDefined();
    expect(
      gates.checks.hasReason(context(state(), { reason: 'Missing measurements.' })),
    ).toBeUndefined();
  });
  it('requires a Quality verification note', () => {
    expect(gates.checks.hasVerificationNote(context(state()))).toBeDefined();
    expect(
      gates.checks.hasVerificationNote(context(state({ verificationNote: 'Verified.' }))),
    ).toBeUndefined();
  });
});

describe('audit replay', () => {
  it('reconstructs the exact final projection from a complete lifecycle', () => {
    let current = state();
    const events = [engine.creationEvent(current, current.stageEnteredAt)];
    const steps = [
      ['SUBMIT', 'INSPECTOR', {}],
      ['CONTAIN', 'PRODUCTION', { containmentAction: 'Segregated.' }],
      ['PROPOSE_DISPOSITION', 'ENGINEERING', { disposition: 'USE_AS_IS' }],
      ['APPROVE', 'MRB', {}],
      ['COMPLETE_EXECUTION', 'PRODUCTION', {}],
      ['CLOSE', 'QUALITY', { verificationNote: 'Verified.' }],
    ] as const;
    for (const [action, role, payload] of steps) {
      const result = engine.transitionNcr(current, workflowV1, {
        ...command,
        action,
        role,
        payload,
        expectedSeq: current.lastEventSeq,
      });
      current = result.ncr;
      events.push(result.event);
    }
    expect(audit.replay(events, workflowV1)).toEqual(current);
    expect(current.stage).toBe('CLOSED');
  });
  it('rejects gaps, duplicate events, and empty streams', () => {
    const initial = state();
    const created = engine.creationEvent(initial, command.at);
    const transitioned = engine.transitionNcr(initial, workflowV1, command).event;
    expect(() => audit.replay([], workflowV1)).toThrow('empty');
    expect(() => audit.replay([transitioned], workflowV1)).toThrow('gap');
    expect(() => audit.replay([created, created], workflowV1)).toThrow('duplicate');
  });
  it('rejects cross-entity streams and inconsistent snapshots', () => {
    const initial = state();
    const created = engine.creationEvent(initial, command.at);
    const transitioned = engine.transitionNcr(initial, workflowV1, command).event;
    transitioned.entityId = 'another-entity';
    expect(() => audit.replay([created, transitioned], workflowV1)).toThrow('mixes');
    created.payload.snapshot.lastEventSeq = 4;
    expect(() => audit.replay([created], workflowV1)).toThrow('snapshot');
  });
});
