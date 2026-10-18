import type { GateContext, GateName } from './types.js';

type Gate = (context: GateContext) => string | undefined;

// Gates return human-readable reasons, shared by command errors and action previews.
// They never read the database or mutate the NCR; callers supply external facts.
export class WorkflowGates {
  readonly checks: Record<GateName, Gate> = {
    hasEvidence: ({ ncr }) => {
      if (!ncr.evidence.length) return 'Add at least one evidence URL.';
      if (
        !ncr.partNumber ||
        !ncr.revision ||
        !ncr.workOrderId ||
        !ncr.defectCode ||
        !ncr.detectionSource ||
        ncr.quantityAffected < 1
      ) {
        return 'Complete all required detection fields.';
      }
    },
    hasContainmentAction: ({ ncr, materialOnHold }) => {
      if (!ncr.containmentAction?.trim()) return 'Describe the containment action.';
      if (ncr.severity === 'CRITICAL' && !materialOnHold)
        return 'Critical non-conformances require the affected material to be on hold.';
    },
    hasDisposition: ({ ncr }) => (!ncr.disposition ? 'Select a disposition.' : undefined),
    reworkRepairHasInstructions: ({ ncr }) =>
      (ncr.disposition === 'REWORK' || ncr.disposition === 'REPAIR') &&
      !ncr.engineeringInstructions?.trim()
        ? 'Rework and repair require engineering instructions.'
        : undefined,
    mrbApprovedIfConcession: ({ ncr }) =>
      (ncr.disposition === 'USE_AS_IS' || ncr.disposition === 'REPAIR') && !ncr.mrbApproval
        ? 'Use-as-is and repair require MRB approval.'
        : undefined,
    hasReason: ({ payload }) =>
      !payload.reason?.trim() ? 'Provide a rejection reason.' : undefined,
    hasVerificationNote: ({ ncr }) =>
      !ncr.verificationNote?.trim() ? 'Provide a Quality verification note.' : undefined,
  };
}
