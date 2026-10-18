import { Presentation } from '../Presentation';
import { useMemo, useState, type ReactElement } from 'react';
import {
  Disposition,
  Stage,
  Severity,
  NcrDetailDocument,
  TransitionNcrDocument,
  type TransitionPayloadInput,
} from '../gql/graphql';
import { apiClient, ApiClient } from '../api';
import { useGql } from '../useGql';
import { useSession } from '../session';
import { Badge, QueryState } from '../components';
import { evidenceInputSchema } from '../evidence';
import { workflowPhases, workflowStages } from '../workflowPresentation';

export function NcrDetail({ id }: { id: string }): ReactElement {
  const variables = useMemo(() => ({ id }), [id]);
  const query = useGql(NcrDetailDocument, variables);
  const { role, setRole } = useSession();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [instructions, setInstructions] = useState('');
  const [evidenceText, setEvidenceText] = useState('');
  const [evidenceTouched, setEvidenceTouched] = useState(false);
  const [disposition, setDisposition] = useState(Disposition.UseAsIs);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const ncr = query.data?.ncr;
  const stageInfo = ncr ? workflowStages[ncr.stage] : undefined;
  const responsibleRole = stageInfo?.owner;
  const currentPhaseIndex = Object.keys(workflowPhases).findIndex(
    (phase) => phase === stageInfo?.phase,
  );
  // Blank input retains saved links; an explicit replacement must itself be valid.
  const evidenceValidation = evidenceInputSchema.safeParse(
    evidenceText.trim() ? evidenceText : (ncr?.evidence ?? []).join('\n'),
  );
  // API previews describe saved values. Evaluate editable fields against the
  // current draft for immediate feedback; the API revalidates every command.
  const actions = (ncr?.availableActions ?? []).map((action) => {
    const blockedBy: string[] = [];
    switch (action.action) {
      case 'SUBMIT':
        if (!evidenceValidation.success)
          blockedBy.push(evidenceValidation.error.issues[0]?.message ?? 'Add evidence.');
        break;
      case 'CONTAIN': {
        if (!note.trim()) blockedBy.push('Describe the containment action.');
        const materialOnHold = ncr?.lot
          ? ncr.lot.hold?.active
          : Boolean(ncr?.serials.length && ncr.serials.every((serial) => serial.hold?.active));
        if (ncr?.severity === Severity.Critical && !materialOnHold)
          blockedBy.push('Critical non-conformances require the affected material to be on hold.');
        break;
      }
      case 'PROPOSE_DISPOSITION':
        if (!Object.values(Disposition).includes(disposition))
          blockedBy.push('Select a disposition.');
        if ([Disposition.Rework, Disposition.Repair].includes(disposition) && !instructions.trim())
          blockedBy.push('Rework and repair require engineering instructions.');
        break;
      case 'REJECT':
        if (!reason.trim()) blockedBy.push('Provide a rejection reason.');
        break;
      case 'CLOSE':
        if (!note.trim()) blockedBy.push('Provide a Quality verification note.');
        break;
      default:
        return action;
    }
    return { ...action, blockedBy, allowed: blockedBy.length === 0 };
  });
  async function transition(action: string): Promise<void> {
    if (!ncr || pending || !actions.find((item) => item.action === action)?.allowed) return;
    const payload: TransitionPayloadInput = {};
    if (action === 'SUBMIT') {
      if (!evidenceValidation.success) return;
      if (evidenceText.trim()) payload.evidence = evidenceValidation.data;
    }
    setPending(true);
    setError('');
    // Build only the current command's fields; the API validates the same shape.
    if (reason.trim()) payload.reason = reason.trim();
    if (action === 'CONTAIN' && note.trim()) payload.containmentAction = note.trim();
    if (action === 'PROPOSE_DISPOSITION') {
      payload.disposition = disposition;
      if (instructions.trim()) payload.engineeringInstructions = instructions.trim();
    }
    if (action === 'CLOSE' && note.trim()) payload.verificationNote = note.trim();
    try {
      await apiClient.request(
        TransitionNcrDocument,
        { input: { ncrId: id, expectedSeq: ncr.lastEventSeq, action, payload } },
        role,
      );
      setNote('');
      setReason('');
      setInstructions('');
      setEvidenceText('');
      query.reload();
    } catch (cause) {
      setError(ApiClient.errorMessage(cause));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <a className="back-link" href="#/">
        ← Operations
      </a>
      <QueryState {...query}>
        {ncr && stageInfo ? (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">NON-CONFORMANCE</p>
                <h1>{ncr.number}</h1>
                <p className="subtle">
                  {Presentation.label(ncr.defectCode)} · {ncr.site.name}
                </p>
              </div>
              <div className="inline">
                <Badge value={ncr.stage} />
                <Badge value={ncr.severity} />
              </div>
            </div>
            <ol className="workflow-progress" aria-label="NCR progress" tabIndex={0}>
              {Object.entries(workflowPhases).map(([phase, presentation], index) => {
                const current = phase === stageInfo.phase;
                const complete = ncr.stage === Stage.Closed || index < currentPhaseIndex;
                return (
                  <li
                    key={phase}
                    className={current ? 'current' : complete ? 'complete' : ''}
                    aria-current={current ? 'step' : undefined}
                  >
                    <span className="phase-number" aria-hidden="true">
                      {complete ? '✓' : index + 1}
                    </span>
                    <span>{presentation.label}</span>
                  </li>
                );
              })}
            </ol>
            <div className="detail-grid">
              <div>
                <section className="panel">
                  <details className="record-details">
                    <summary>
                      Report details{' '}
                      <span className="subtle">
                        {ncr.partNumber} / {ncr.revision}
                      </span>
                    </summary>
                    <dl className="facts">
                      <div>
                        <dt>Part / revision</dt>
                        <dd>
                          {ncr.partNumber} / {ncr.revision}
                        </dd>
                      </div>
                      <div>
                        <dt>Work order</dt>
                        <dd>{ncr.workOrder.number}</dd>
                      </div>
                      <div>
                        <dt>ERP purchase order</dt>
                        <dd>{ncr.workOrder.orderRef}</dd>
                      </div>
                      <div>
                        <dt>Operation / source</dt>
                        <dd>
                          {ncr.operationStep} / {ncr.detectionSource}
                        </dd>
                      </div>
                      <div>
                        <dt>Quantity affected</dt>
                        <dd>{ncr.quantityAffected}</dd>
                      </div>
                      <div>
                        <dt>Current task since</dt>
                        <dd>{Presentation.date(ncr.stageEnteredAt)}</dd>
                      </div>
                    </dl>
                    <h3>Serials</h3>
                    <p>
                      {ncr.serials
                        .map(
                          (serial) =>
                            `${serial.serialNumber}${serial.hold?.active ? ' (hold)' : ''}`,
                        )
                        .join(', ') || 'No individual serials linked.'}
                    </p>
                    <h3>Evidence</h3>
                    {ncr.evidence.length ? (
                      <ul>
                        {ncr.evidence.map((url) => (
                          <li key={url}>
                            <a href={url} target="_blank" rel="noreferrer">
                              {url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="subtle">No evidence attached.</p>
                    )}
                    {ncr.containmentAction && (
                      <p>
                        <strong>Containment:</strong> {ncr.containmentAction}
                      </p>
                    )}
                    {ncr.disposition && (
                      <p>
                        <strong>Disposition:</strong> {Presentation.label(ncr.disposition)}
                      </p>
                    )}
                    {ncr.engineeringInstructions && (
                      <p>
                        <strong>Instructions:</strong> {ncr.engineeringInstructions}
                      </p>
                    )}
                    {ncr.mrbApproval && (
                      <p>
                        <strong>MRB approved:</strong> {Presentation.date(ncr.mrbApproval.at)}
                      </p>
                    )}
                    {ncr.verificationNote && (
                      <p>
                        <strong>Verification:</strong> {ncr.verificationNote}
                      </p>
                    )}
                  </details>
                  {ncr.lot && (
                    <a
                      className="thread-link"
                      href={`#/lot/${encodeURIComponent(ncr.lot.lotNumber)}`}
                    >
                      <div>
                        <span className="eyebrow">MATERIAL THREAD</span>
                        <strong>{ncr.lot.lotNumber}</strong>
                      </div>
                      <span>{ncr.lot.hold?.active ? 'On hold' : 'Trace material'} →</span>
                    </a>
                  )}
                </section>
                <section className="panel" aria-label="Current workflow task">
                  <h2>{stageInfo.label}</h2>
                  <p className="subtle">{stageInfo.guidance}</p>
                  {ncr.disposition && (
                    <div className="treatment-summary">
                      <p>
                        <strong>Treatment:</strong> {Presentation.label(ncr.disposition)}
                      </p>
                      {ncr.engineeringInstructions && (
                        <p>
                          <strong>Instructions:</strong> {ncr.engineeringInstructions}
                        </p>
                      )}
                      {ncr.mrbApproval && (
                        <p className="subtle">
                          MRB approved · {Presentation.date(ncr.mrbApproval.at)}
                        </p>
                      )}
                    </div>
                  )}
                  {responsibleRole && responsibleRole !== role ? (
                    <div className="role-handoff">
                      <p>
                        Next responsible role:{' '}
                        <strong>{Presentation.label(responsibleRole)}</strong>
                      </p>
                      <button type="button" onClick={() => setRole(responsibleRole)}>
                        Switch to {Presentation.label(responsibleRole)}
                      </button>
                    </div>
                  ) : responsibleRole ? (
                    <p className="subtle">Acting as {Presentation.label(role)}</p>
                  ) : null}
                  {ncr.availableActions.length > 0 ? (
                    <>
                      {ncr.availableActions.some((action) => action.action === 'SUBMIT') && (
                        <>
                          <label>
                            Evidence URLs for submission (one per line)
                            <textarea
                              value={evidenceText}
                              onChange={(event) => {
                                setEvidenceText(event.target.value);
                                setEvidenceTouched(true);
                              }}
                              onBlur={() => setEvidenceTouched(true)}
                              placeholder={
                                ncr.evidence.length
                                  ? 'Leave blank to keep saved evidence links'
                                  : 'https://example.com/inspection-evidence'
                              }
                              required={!ncr.evidence.length}
                              aria-invalid={evidenceTouched && !evidenceValidation.success}
                              aria-describedby="submit-evidence-help"
                            />
                          </label>
                          <p
                            id="submit-evidence-help"
                            className={
                              !evidenceTouched || evidenceValidation.success
                                ? 'field-hint subtle'
                                : 'field-hint error'
                            }
                          >
                            {evidenceValidation.success
                              ? 'Up to 20 HTTP or HTTPS links. Leave blank to keep saved evidence.'
                              : evidenceTouched
                                ? evidenceValidation.error.issues[0]?.message
                                : 'At least one evidence URL is required.'}
                          </p>
                        </>
                      )}
                      {ncr.availableActions.some(
                        (action) => action.action === 'CONTAIN' || action.action === 'CLOSE',
                      ) && (
                        <label>
                          {ncr.availableActions.some((action) => action.action === 'CLOSE')
                            ? 'Verification note'
                            : 'Containment action'}
                          <textarea
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder="Describe the action taken or independent verification…"
                            required
                            maxLength={2000}
                          />
                        </label>
                      )}
                      {ncr.availableActions.some(
                        (action) => action.action === 'PROPOSE_DISPOSITION',
                      ) && (
                        <>
                          <label>
                            Treatment
                            <select
                              value={disposition}
                              onChange={(event) =>
                                setDisposition(event.target.value as Disposition)
                              }
                            >
                              {Object.values(Disposition).map((value) => (
                                <option key={value} value={value}>
                                  {Presentation.label(value)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Engineering instructions
                            <textarea
                              value={instructions}
                              onChange={(event) => setInstructions(event.target.value)}
                              placeholder="Required for rework or repair"
                              maxLength={2000}
                              required={[Disposition.Rework, Disposition.Repair].includes(
                                disposition,
                              )}
                            />
                          </label>
                        </>
                      )}
                      <details
                        className="optional-context"
                        open={ncr.availableActions.some((action) => action.action === 'REJECT')}
                      >
                        <summary>Reason / audit note</summary>
                        <label>
                          Reason
                          <textarea
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="Required for rejection; optional audit context for other actions"
                            maxLength={2000}
                          />
                        </label>
                      </details>
                      {actions.map((action) => {
                        // Evidence has live field feedback; keep other server gate reasons visible.
                        const blockedBy = action.blockedBy.filter(
                          (message) =>
                            action.action !== 'SUBMIT' ||
                            message !== 'Add at least one evidence URL.',
                        );
                        return (
                          <div className="action-row" key={action.action}>
                            <button
                              className={action.action === 'REJECT' ? 'secondary' : undefined}
                              disabled={pending || !action.allowed}
                              onClick={() => void transition(action.action)}
                            >
                              {pending ? 'Saving…' : Presentation.label(action.action)}
                            </button>
                            {!action.allowed && blockedBy.length > 0 && (
                              <ul className="gate-reasons">
                                {blockedBy.map((message) => (
                                  <li key={message}>{message}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                      <p className="subtle">
                        Complete the required fields to continue. Each action is recorded in the
                        audit trail.
                      </p>
                    </>
                  ) : responsibleRole === role ? (
                    <p className="empty">No action is available for this role.</p>
                  ) : null}
                  {error && (
                    <p className="error" role="alert">
                      {error}
                    </p>
                  )}
                </section>
              </div>
              <aside className="panel audit-panel">
                <div className="panel-heading">
                  <h2>Audit trail</h2>
                  <span className="subtle">{Presentation.count(ncr.events.length, 'event')}</span>
                </div>
                <ol className="timeline">
                  {ncr.events.map((event) => (
                    <li key={event.id}>
                      <span className="event-seq" aria-label={`Event ${event.seq}`}>
                        {event.seq}
                      </span>
                      <div>
                        <strong>{Presentation.label(event.action ?? event.type)}</strong>
                        <p>
                          {event.actorUsername === 'demo-seed'
                            ? 'Demo seed'
                            : (event.actorUsername ?? 'User not recorded')}{' '}
                          · {Presentation.label(event.actorRole)}
                        </p>
                        {event.workflowVersion != null && <p>Workflow v{event.workflowVersion}</p>}
                        {event.toStage && <Badge value={event.toStage} />}
                        <time dateTime={event.at}>{Presentation.date(event.at)}</time>
                        {event.reason && <p className="event-reason">{event.reason}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </aside>
            </div>
          </>
        ) : (
          <p className="notice">NCR not found.</p>
        )}
      </QueryState>
    </>
  );
}
