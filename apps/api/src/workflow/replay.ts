import type { NcrEvent, NcrState, WorkflowDefinition } from './types.js';

// Replay validates stream continuity and the historical route, without rerunning
// gates against today's material holds or changing the original event objects.
export class AuditReplay {
  replay(events: readonly NcrEvent[], workflow: WorkflowDefinition): NcrState {
    let state: NcrState | undefined;
    for (const event of events) {
      if (event.seq !== (state?.lastEventSeq ?? 0) + 1)
        throw new Error('Audit stream has a gap or duplicate sequence.');
      if (
        event.workflowVersion !== workflow.version ||
        event.payload.snapshot.workflowKey !== workflow.key
      )
        throw new Error('Audit workflow version mismatch.');
      if (!state) {
        if (event.type !== 'NCR_CREATED' || event.payload.to !== 'INITIATION')
          throw new Error('Audit stream must begin with NCR_CREATED.');
      } else {
        if (
          event.entityId !== state.id ||
          event.siteId !== state.siteId ||
          event.type !== 'NCR_TRANSITIONED'
        )
          throw new Error('Audit stream mixes entities.');
        const route = workflow.transitions.find(
          (item) =>
            item.action === event.payload.action &&
            item.from === state?.stage &&
            item.to === event.payload.to,
        );
        if (!route || !route.roles.includes(event.actorRole) || event.payload.from !== state.stage)
          throw new Error('Invalid historical transition.');
      }
      const snapshot = event.payload.snapshot;
      if (
        snapshot.id !== event.entityId ||
        snapshot.siteId !== event.siteId ||
        snapshot.lastEventSeq !== event.seq ||
        snapshot.stage !== event.payload.to ||
        snapshot.workflowVersion !== workflow.version
      ) {
        throw new Error('Audit snapshot does not match its envelope.');
      }
      state = structuredClone(snapshot);
    }
    if (!state) throw new Error('Cannot replay an empty audit stream.');
    return state;
  }
}
