// These domain types deliberately have no dependency on GraphQL or MongoDB.
// The same engine can validate a command in a resolver, a seed, or a unit test.
export const stages = [
  'INITIATION',
  'CONTAINMENT',
  'MRB_REVIEW',
  'DISPOSITION',
  'EXECUTION',
  'CLOSURE',
  'CLOSED',
] as const;
export const roles = ['INSPECTOR', 'PRODUCTION', 'ENGINEERING', 'MRB', 'QUALITY'] as const;
export const severities = ['MINOR', 'MAJOR', 'CRITICAL'] as const;
export const dispositions = ['SCRAP', 'REWORK', 'REPAIR', 'USE_AS_IS', 'RTV'] as const;
export const actions = [
  'SUBMIT',
  'CONTAIN',
  'PROPOSE_DISPOSITION',
  'APPROVE',
  'REJECT',
  'COMPLETE_EXECUTION',
  'CLOSE',
] as const;
export type Stage = (typeof stages)[number];
export type Role = (typeof roles)[number];
export type Severity = (typeof severities)[number];
export type Disposition = (typeof dispositions)[number];
export type Action = (typeof actions)[number];

export interface AvailableAction {
  action: Action;
  allowed: boolean;
  blockedBy: string[];
}

export interface NcrState {
  id: string;
  number: string;
  siteId: string;
  workflowKey: string;
  workflowVersion: number;
  stage: Stage;
  state: 'OPEN' | 'CLOSED';
  severity: Severity;
  partNumber: string;
  revision: string;
  workOrderId: string;
  operationStep: number;
  defectCode: string;
  detectionSource: string;
  quantityAffected: number;
  lotId?: string;
  serialIds: string[];
  evidence: string[];
  containmentAction?: string;
  disposition?: Disposition;
  engineeringInstructions?: string;
  mrbApproval?: { role: Role; at: string };
  verificationNote?: string;
  stageEnteredAt: string;
  lastEventSeq: number;
}

export interface TransitionPayload {
  reason?: string;
  evidence?: string[];
  containmentAction?: string;
  disposition?: Disposition;
  engineeringInstructions?: string;
  verificationNote?: string;
}
export interface GateContext {
  ncr: NcrState;
  payload: TransitionPayload;
  materialOnHold: boolean;
}
export type GateName =
  | 'hasEvidence'
  | 'hasContainmentAction'
  | 'hasDisposition'
  | 'reworkRepairHasInstructions'
  | 'mrbApprovedIfConcession'
  | 'hasReason'
  | 'hasVerificationNote';
export interface TransitionDefinition {
  action: Action;
  from: Stage;
  to: Stage;
  roles: Role[];
  gates: GateName[];
}
export interface WorkflowDefinition {
  key: string;
  version: number;
  stages: Stage[];
  transitions: TransitionDefinition[];
  publishedAt: string;
}
export interface NcrEvent {
  seq: number;
  entityType: 'NCR';
  entityId: string;
  siteId: string;
  type: 'NCR_CREATED' | 'NCR_TRANSITIONED';
  actorRole: Role;
  reason?: string;
  workflowVersion: number;
  at: string;
  payload: {
    action?: Action;
    from?: Stage;
    to: Stage;
    // Persist the command result so replay never depends on mutable external holds.
    snapshot: NcrState;
  };
}
