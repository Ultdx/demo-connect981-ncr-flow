import { Role, Stage } from './gql/graphql';

// Five business phases summarize the existing versioned lifecycle. Engineering
// and MRB remain separate commands/roles within Decision; API permissions still apply.
export const workflowPhases = {
  report: { label: 'Report', description: 'Record the non-conformance' },
  containment: { label: 'Containment', description: 'Secure affected material' },
  decision: { label: 'Decision', description: 'Propose and approve treatment' },
  execution: { label: 'Execution', description: 'Apply the approved treatment' },
  verification: { label: 'Verification', description: 'Check and close the report' },
} as const;

interface StagePresentation {
  phase: keyof typeof workflowPhases | null;
  label: string;
  owner: Role | null;
  guidance: string;
}

// This is presentation for demo v1, never an authorization source. The API returns
// the actual available actions; the role button only changes the visible demo role.
export const workflowStages: Readonly<Record<Stage, StagePresentation>> = {
  [Stage.Initiation]: {
    phase: 'report',
    label: 'Submit report',
    owner: Role.Inspector,
    guidance: 'Add evidence, then submit the report for containment.',
  },
  [Stage.Containment]: {
    phase: 'containment',
    label: 'Secure affected material',
    owner: Role.Production,
    guidance:
      'Record how affected material was isolated. Critical NCRs require a digital hold in the material thread.',
  },
  [Stage.MrbReview]: {
    phase: 'decision',
    label: 'Engineering review',
    owner: Role.Engineering,
    guidance: 'Propose a treatment. Rework and repair require engineering instructions.',
  },
  [Stage.Disposition]: {
    phase: 'decision',
    label: 'MRB approval',
    owner: Role.Mrb,
    guidance: 'Approve the proposed treatment, or request changes with a reason.',
  },
  [Stage.Execution]: {
    phase: 'execution',
    label: 'Apply approved treatment',
    owner: Role.Production,
    guidance: 'Complete the approved treatment before handing the report to Quality.',
  },
  [Stage.Closure]: {
    phase: 'verification',
    label: 'Quality verification',
    owner: Role.Quality,
    guidance: 'Record the verification result, then close the report.',
  },
  [Stage.Closed]: {
    phase: null,
    label: 'Report closed',
    owner: null,
    guidance: 'The report is closed. Its decisions and verification remain in the audit trail.',
  },
};

// Reuse the same business vocabulary in badges, lists, controls, and audit events.
export const workflowLabels: ReadonlyMap<string, string> = new Map([
  ...Object.entries(workflowStages).map(
    ([stage, presentation]) =>
      [stage, presentation.phase ? workflowPhases[presentation.phase].label : 'Closed'] as const,
  ),
  ['PROPOSE_DISPOSITION', 'Propose treatment'],
  ['APPROVE', 'Approve treatment'],
  ['REJECT', 'Request changes'],
  ['COMPLETE_EXECUTION', 'Complete treatment'],
  ['CLOSE', 'Verify and close'],
  ['NCR_CREATED', 'Report created'],
  ['MRB', 'MRB'],
  ['RTV', 'Return to supplier'],
]);
