import { Presentation } from '../Presentation';
import { useMemo, useState, type FormEvent, type ReactElement } from 'react';
import { CreateNcrDocument, CreationOptionsDocument, Role, Severity } from '../gql/graphql';
import { apiClient, ApiClient } from '../api';
import { useSession } from '../session';
import { useGql } from '../useGql';
import { QueryState } from '../components';
import { evidenceInputSchema } from '../evidence';

export function CreateNcr(): ReactElement {
  const variables = useMemo(() => ({}), []);
  const query = useGql(CreationOptionsDocument, variables);
  const { role, setRole } = useSession();
  const [workOrderId, setWorkOrderId] = useState('');
  const [lotId, setLotId] = useState('');
  const [operationStep, setOperationStep] = useState(20);
  const [severity, setSeverity] = useState(Severity.Major);
  const [defectCode, setDefectCode] = useState('SEALING_DEFECT');
  const [source, setSource] = useState('Final inspection');
  const [quantity, setQuantity] = useState('1');
  const [evidence, setEvidence] = useState('');
  const [evidenceTouched, setEvidenceTouched] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const workOrder = query.data?.workOrders.find((order) => order.id === workOrderId);
  const lot = workOrder?.lots.find((item) => item.id === lotId);
  const operationValid = workOrder?.operations.some((item) => item.step === operationStep) ?? false;
  const evidenceValidation = evidenceInputSchema.safeParse(evidence);
  const maximumQuantity = Math.floor(
    workOrder?.consumedLots
      .filter((item) => item.lotId === lotId)
      .reduce((total, item) => total + item.qty, 0) ?? 0,
  );
  const defectIssue = !defectCode.trim()
    ? 'Enter a defect code.'
    : defectCode.trim().length > 2000
      ? 'Use at most 2000 characters.'
      : '';
  const sourceIssue = !source.trim()
    ? 'Enter a detection source.'
    : source.trim().length > 2000
      ? 'Use at most 2000 characters.'
      : '';
  const quantityIssue =
    !quantity.trim() || !Number.isInteger(Number(quantity)) || Number(quantity) < 1
      ? 'Enter a whole number of at least 1.'
      : lot && Number(quantity) > maximumQuantity
        ? `Quantity affected cannot exceed ${maximumQuantity} for the selected material.`
        : '';
  const valid = Boolean(
    workOrder &&
      lot &&
      operationValid &&
      !defectIssue &&
      !sourceIssue &&
      !quantityIssue &&
      evidenceValidation.success,
  );
  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setEvidenceTouched(true);
    if (pending || !valid || !lot || !evidenceValidation.success) return;
    setPending(true);
    setError('');
    try {
      const result = await apiClient.request(
        CreateNcrDocument,
        {
          input: {
            workOrderId,
            operationStep,
            lotId: lot.id,
            severity,
            defectCode: defectCode.trim(),
            detectionSource: source.trim(),
            quantityAffected: Number(quantity),
            evidence: evidenceValidation.data,
          },
        },
        role,
      );
      window.location.assign(`#/ncr/${result.createNcr.id}`);
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
      <div className="page-heading">
        <div>
          <p className="eyebrow">INSPECTION / DETECTION</p>
          <h1>Create non-conformance</h1>
          <p className="subtle">Part, revision and site are inherited from the work order.</p>
        </div>
      </div>
      {role !== Role.Inspector ? (
        <div className="notice">
          <p>Select Inspector to create an NCR.</p>
          <button type="button" onClick={() => setRole(Role.Inspector)}>
            Switch to Inspector
          </button>
        </div>
      ) : (
        <QueryState {...query}>
          <form className="panel create-form" noValidate onSubmit={(event) => void submit(event)}>
            <div className="two-columns">
              <label>
                Work order
                <select
                  required
                  value={workOrderId}
                  disabled={pending}
                  onChange={(event) => {
                    const order = query.data?.workOrders.find(
                      (item) => item.id === event.target.value,
                    );
                    setWorkOrderId(event.target.value);
                    setOperationStep(order?.operations[0]?.step ?? 20);
                    // Reset dependent fields together so a lot cannot leak from the previous order.
                    setLotId(order?.lots[0]?.id ?? '');
                    setError('');
                  }}
                >
                  <option value="">Select work order</option>
                  {query.data?.workOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.number} · {order.partNumber} / {order.revision}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Operation
                <select
                  value={operationStep}
                  required
                  disabled={!workOrder || pending}
                  onChange={(event) => setOperationStep(Number(event.target.value))}
                >
                  {workOrder?.operations.map((operation) => (
                    <option key={operation.step} value={operation.step}>
                      {operation.step} · {operation.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Material lot
                <select
                  value={lotId}
                  onChange={(event) => {
                    setLotId(event.target.value);
                    setError('');
                  }}
                  required
                  disabled={!workOrder || !workOrder.lots.length || pending}
                  aria-describedby={
                    workOrder && !workOrder.lots.length ? 'material-lot-help' : undefined
                  }
                >
                  <option value="">
                    {workOrder ? 'Select material lot' : 'Select work order first'}
                  </option>
                  {workOrder?.lots.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.lotNumber}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Severity
                <select
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value as Severity)}
                >
                  {Object.values(Severity).map((value) => (
                    <option key={value} value={value}>
                      {Presentation.label(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Defect code
                <input
                  value={defectCode}
                  aria-label="Defect code"
                  onChange={(event) => setDefectCode(event.target.value)}
                  required
                  maxLength={2000}
                  aria-invalid={Boolean(defectIssue)}
                  aria-describedby={defectIssue ? 'defect-code-error' : undefined}
                />
                {defectIssue && (
                  <span id="defect-code-error" className="field-hint error">
                    {defectIssue}
                  </span>
                )}
              </label>
              <label>
                Detection source
                <input
                  value={source}
                  aria-label="Detection source"
                  onChange={(event) => setSource(event.target.value)}
                  required
                  maxLength={2000}
                  aria-invalid={Boolean(sourceIssue)}
                  aria-describedby={sourceIssue ? 'detection-source-error' : undefined}
                />
                {sourceIssue && (
                  <span id="detection-source-error" className="field-hint error">
                    {sourceIssue}
                  </span>
                )}
              </label>
              <label>
                Quantity affected
                <input
                  type="number"
                  aria-label="Quantity affected"
                  min="1"
                  max={lot ? maximumQuantity : undefined}
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  required
                  aria-invalid={Boolean(quantityIssue)}
                  aria-describedby="quantity-help"
                />
                <span
                  id="quantity-help"
                  className={`field-hint ${quantityIssue ? 'error' : 'subtle'}`}
                >
                  {quantityIssue ||
                    (lot
                      ? `Up to ${maximumQuantity} units recorded for this lot and work order.`
                      : 'Select a work order and material lot.')}
                </span>
              </label>
            </div>
            {workOrder && !workOrder.lots.length && (
              <p className="notice" id="material-lot-help" role="status">
                No material lot is recorded for this work order. Select another work order.
              </p>
            )}
            <label>
              Evidence URLs (one per line)
              <textarea
                required
                value={evidence}
                onChange={(event) => {
                  setEvidence(event.target.value);
                  setEvidenceTouched(true);
                }}
                onBlur={() => setEvidenceTouched(true)}
                placeholder="https://example.com/inspection-evidence"
                aria-invalid={evidenceTouched && !evidenceValidation.success}
                aria-describedby={!evidenceValidation.success ? 'create-evidence-help' : undefined}
              />
            </label>
            {!evidenceValidation.success && (
              <p
                id="create-evidence-help"
                className={`field-hint ${evidenceTouched ? 'error' : 'subtle'}`}
              >
                {evidenceTouched
                  ? evidenceValidation.error.issues[0]?.message
                  : 'At least one evidence URL is required.'}
              </p>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button disabled={pending || !valid} type="submit">
              {pending ? 'Creating…' : 'Create NCR'}
            </button>
          </form>
        </QueryState>
      )}
    </>
  );
}
