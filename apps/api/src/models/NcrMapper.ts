import { Types } from 'mongoose';
import type { NcrState } from '../workflow/types.js';
import type { NcrDoc } from './Ncr.js';

export type NcrProjection = Omit<NcrState, 'id' | 'stageEnteredAt'> & {
  _id: Types.ObjectId;
  stageEnteredAt: Date;
};

// Maps persistence documents to domain snapshots without Mongoose metadata.
export class NcrMapper {
  static toState(doc: NcrDoc): NcrState {
    // Copy only domain fields. Mongoose timestamps and metadata are not part of
    // the event projection and must not leak into historical snapshots.
    return {
      id: String(doc._id),
      number: doc.number,
      siteId: String(doc.siteId),
      workflowKey: doc.workflowKey,
      workflowVersion: doc.workflowVersion,
      stage: doc.stage,
      state: doc.state,
      severity: doc.severity,
      partNumber: doc.partNumber,
      revision: doc.revision,
      workOrderId: String(doc.workOrderId),
      operationStep: doc.operationStep,
      defectCode: doc.defectCode,
      detectionSource: doc.detectionSource,
      quantityAffected: doc.quantityAffected,
      lotId: doc.lotId ? String(doc.lotId) : undefined,
      serialIds: doc.serialIds.map(String),
      evidence: [...doc.evidence],
      containmentAction: doc.containmentAction,
      disposition: doc.disposition,
      engineeringInstructions: doc.engineeringInstructions,
      mrbApproval: doc.mrbApproval
        ? { role: doc.mrbApproval.role, at: doc.mrbApproval.at }
        : undefined,
      verificationNote: doc.verificationNote,
      stageEnteredAt: doc.stageEnteredAt.toISOString(),
      lastEventSeq: doc.lastEventSeq,
    };
  }
  static toProjection(state: NcrState): NcrProjection {
    const { id, ...fields } = state;
    return {
      ...fields,
      _id: new Types.ObjectId(id),
      stageEnteredAt: new Date(state.stageEnteredAt),
    };
  }
}
