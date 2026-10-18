import { WorkflowGates } from './gates.js';
import type {
  Action,
  AvailableAction,
  NcrEvent,
  NcrState,
  Role,
  TransitionDefinition,
  TransitionPayload,
  WorkflowDefinition,
} from './types.js';

export class WorkflowError extends Error {
  constructor(
    public code:
      | 'FORBIDDEN_ROLE'
      | 'GATE_FAILED'
      | 'CONFLICT'
      | 'INVALID_TRANSITION'
      | 'WORKFLOW_MISMATCH',
    message: string,
    public blockedBy: string[] = [],
  ) {
    super(message);
    this.name = 'WorkflowError';
  }
}

export class WorkflowEngine {
  constructor(private readonly gates: WorkflowGates) {}
  private assertVersion(ncr: NcrState, workflow: WorkflowDefinition): void {
    if (ncr.workflowKey !== workflow.key || ncr.workflowVersion !== workflow.version) {
      throw new WorkflowError('WORKFLOW_MISMATCH', 'Load the workflow version pinned to this NCR.');
    }
  }

  private candidate(ncr: NcrState, action: Action, payload: TransitionPayload): NcrState {
    // Only the fields owned by this command can change. A payload cannot inject a
    // stage, approval, role, or sequence number into the current projection.
    const result = structuredClone(ncr);
    if (action === 'SUBMIT' && payload.evidence) result.evidence = [...payload.evidence];
    if (action === 'CONTAIN' && payload.containmentAction !== undefined)
      result.containmentAction = payload.containmentAction;
    if (action === 'PROPOSE_DISPOSITION') {
      result.disposition = payload.disposition;
      result.engineeringInstructions = payload.engineeringInstructions;
      delete result.mrbApproval;
    }
    if (action === 'CLOSE' && payload.verificationNote !== undefined)
      result.verificationNote = payload.verificationNote;
    return result;
  }

  private blockingReasons(
    ncr: NcrState,
    transition: TransitionDefinition,
    payload: TransitionPayload,
    materialOnHold: boolean,
  ): string[] {
    const next = this.candidate(ncr, transition.action, payload);
    return transition.gates.flatMap((name) => {
      // Unknown registry keys fail closed if a bad workflow document is published.
      const gate = this.gates.checks[name];
      const reason = gate ? gate({ ncr: next, payload, materialOnHold }) : `Unknown gate: ${name}`;
      return reason ? [reason] : [];
    });
  }

  availableActions(
    ncr: NcrState,
    workflow: WorkflowDefinition,
    role: Role,
    materialOnHold: boolean,
  ): AvailableAction[] {
    this.assertVersion(ncr, workflow);
    return workflow.transitions
      .filter((item) => item.from === ncr.stage && item.roles.includes(role))
      .map((item) => {
        const blockedBy = this.blockingReasons(ncr, item, {}, materialOnHold);
        return { action: item.action, allowed: blockedBy.length === 0, blockedBy };
      });
  }

  transitionNcr(
    ncr: NcrState,
    workflow: WorkflowDefinition,
    command: {
      action: Action;
      role: Role;
      expectedSeq: number;
      payload: TransitionPayload;
      at: string;
      materialOnHold: boolean;
    },
  ): { ncr: NcrState; event: NcrEvent } {
    this.assertVersion(ncr, workflow);
    if (command.expectedSeq !== ncr.lastEventSeq)
      throw new WorkflowError('CONFLICT', 'This NCR changed. Reload before retrying.');
    const transition = workflow.transitions.find(
      (item) => item.action === command.action && item.from === ncr.stage,
    );
    if (!transition || ncr.state === 'CLOSED')
      throw new WorkflowError(
        'INVALID_TRANSITION',
        'This action is unavailable at the current stage.',
      );
    if (!transition.roles.includes(command.role))
      throw new WorkflowError('FORBIDDEN_ROLE', 'Your selected role cannot perform this action.');
    const blockedBy = this.blockingReasons(
      ncr,
      transition,
      command.payload,
      command.materialOnHold,
    );
    if (blockedBy.length)
      throw new WorkflowError('GATE_FAILED', 'Workflow gates blocked this transition.', blockedBy);

    const next = this.candidate(ncr, command.action, command.payload);
    if (command.action === 'APPROVE') next.mrbApproval = { role: command.role, at: command.at };
    if (command.action === 'REJECT') {
      delete next.mrbApproval;
      delete next.disposition;
      delete next.engineeringInstructions;
    }
    next.stage = transition.to;
    next.state = transition.to === 'CLOSED' ? 'CLOSED' : 'OPEN';
    next.stageEnteredAt = command.at;
    next.lastEventSeq += 1;
    const event: NcrEvent = {
      seq: next.lastEventSeq,
      entityType: 'NCR',
      entityId: ncr.id,
      siteId: ncr.siteId,
      type: 'NCR_TRANSITIONED',
      actorRole: command.role,
      reason: command.payload.reason,
      workflowVersion: ncr.workflowVersion,
      at: command.at,
      payload: {
        action: command.action,
        from: ncr.stage,
        to: next.stage,
        snapshot: structuredClone(next),
      },
    };
    return { ncr: next, event };
  }

  creationEvent(ncr: NcrState, at: string): NcrEvent {
    return {
      seq: 1,
      entityType: 'NCR',
      entityId: ncr.id,
      siteId: ncr.siteId,
      type: 'NCR_CREATED',
      actorRole: 'INSPECTOR',
      workflowVersion: ncr.workflowVersion,
      at,
      payload: { to: 'INITIATION', snapshot: structuredClone(ncr) },
    };
  }
}
