import type { WorkflowDefinition } from './types.js';

export const workflowV1: WorkflowDefinition = {
  key: 'ncr',
  version: 1,
  publishedAt: '2026-10-01T08:00:00.000Z',
  stages: [
    'INITIATION',
    'CONTAINMENT',
    'MRB_REVIEW',
    'DISPOSITION',
    'EXECUTION',
    'CLOSURE',
    'CLOSED',
  ],
  transitions: [
    {
      action: 'SUBMIT',
      from: 'INITIATION',
      to: 'CONTAINMENT',
      roles: ['INSPECTOR'],
      gates: ['hasEvidence'],
    },
    {
      action: 'CONTAIN',
      from: 'CONTAINMENT',
      to: 'MRB_REVIEW',
      roles: ['PRODUCTION'],
      gates: ['hasContainmentAction'],
    },
    {
      action: 'PROPOSE_DISPOSITION',
      from: 'MRB_REVIEW',
      to: 'DISPOSITION',
      roles: ['ENGINEERING'],
      gates: ['hasDisposition', 'reworkRepairHasInstructions'],
    },
    { action: 'APPROVE', from: 'DISPOSITION', to: 'EXECUTION', roles: ['MRB'], gates: [] },
    {
      action: 'REJECT',
      from: 'DISPOSITION',
      to: 'MRB_REVIEW',
      roles: ['MRB'],
      gates: ['hasReason'],
    },
    {
      action: 'COMPLETE_EXECUTION',
      from: 'EXECUTION',
      to: 'CLOSURE',
      roles: ['PRODUCTION'],
      gates: ['mrbApprovedIfConcession'],
    },
    {
      action: 'CLOSE',
      from: 'CLOSURE',
      to: 'CLOSED',
      roles: ['QUALITY'],
      gates: ['hasVerificationNote'],
    },
  ],
};
