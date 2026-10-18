import { Presentation } from '../Presentation';
import { useMemo, useState, type ReactElement } from 'react';
import { OperationsDocument, Severity } from '../gql/graphql';
import { useGql } from '../useGql';
import { Badge, QueryState } from '../components';
import { workflowPhases, workflowStages } from '../workflowPresentation';

const registerColumns = [
  { key: 'number', label: 'NCR / defect', sortLabel: 'NCR number' },
  { key: 'site', label: 'Site', sortLabel: 'Site' },
  { key: 'phase', label: 'Phase', sortLabel: 'Phase' },
  { key: 'severity', label: 'Severity', sortLabel: 'Severity' },
  { key: 'workOrder', label: 'Work order', sortLabel: 'Work order' },
  { key: 'lot', label: 'Material lot', sortLabel: 'Material lot' },
  { key: 'quantity', label: 'Qty', sortLabel: 'Quantity' },
] as const;
type PhaseFilter = keyof typeof workflowPhases | 'closed' | '';
interface RegisterSort {
  key: (typeof registerColumns)[number]['key'];
  direction: 'asc' | 'desc';
}

const textOrder = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const phaseOrder = [...Object.keys(workflowPhases), 'closed'];
const severityOrder: Record<Severity, number> = {
  [Severity.Minor]: 0,
  [Severity.Major]: 1,
  [Severity.Critical]: 2,
};

export function Operations(): ReactElement {
  const [siteId, setSiteId] = useState('');
  const [severity, setSeverity] = useState<Severity | ''>('');
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('');
  const [sort, setSort] = useState<RegisterSort>({ key: 'number', direction: 'asc' });
  const variables = useMemo(
    () => ({ siteId: siteId || undefined, severity: severity || undefined }),
    [siteId, severity],
  );
  const query = useGql(OperationsDocument, variables);
  const overview = query.data?.operationsOverview;
  // Site/severity already constrain the API result. Phase filtering is local to
  // this register; filter() also gives sort() a copy so cached query data stays intact.
  const registerRows = (overview?.ncrs ?? [])
    .filter((ncr) => !phaseFilter || (workflowStages[ncr.stage].phase ?? 'closed') === phaseFilter)
    .sort((left, right) => {
      let comparison = 0;
      switch (sort.key) {
        case 'number':
          comparison = textOrder.compare(left.number, right.number);
          break;
        case 'site':
          comparison = textOrder.compare(left.site.code, right.site.code);
          break;
        case 'phase':
          comparison =
            phaseOrder.indexOf(workflowStages[left.stage].phase ?? 'closed') -
            phaseOrder.indexOf(workflowStages[right.stage].phase ?? 'closed');
          break;
        case 'severity':
          comparison = severityOrder[left.severity] - severityOrder[right.severity];
          break;
        case 'workOrder':
          comparison = textOrder.compare(left.workOrder.number, right.workOrder.number);
          break;
        case 'lot':
          // Missing lots stay last in either direction; they are not empty identifiers.
          if (!left.lot || !right.lot)
            return left.lot ? -1 : right.lot ? 1 : textOrder.compare(left.number, right.number);
          comparison = textOrder.compare(left.lot.lotNumber, right.lot.lotNumber);
          break;
        case 'quantity':
          comparison = left.quantityAffected - right.quantityAffected;
          break;
      }
      // Deterministic ties keep equal phases/severities easy to scan after a refresh.
      return (
        comparison * (sort.direction === 'asc' ? 1 : -1) ||
        textOrder.compare(left.number, right.number)
      );
    });
  return (
    <>
      <div className="page-heading operations-heading">
        <div>
          <p className="eyebrow">QUALITY OPERATIONS</p>
          <h1>
            Operations <span className="brand-gradient">overview</span>
          </h1>
          <p className="subtle">One operational picture. Two manufacturing sites.</p>
        </div>
        <a className="button" href="#/new">
          + Create NCR
        </a>
      </div>
      <div className="filters">
        <label>
          Site
          <select value={siteId} onChange={(event) => setSiteId(event.target.value)}>
            <option value="">All sites</option>
            {query.data?.sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.code} · {site.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Severity
          <select
            value={severity}
            onChange={(event) => setSeverity(event.target.value as Severity | '')}
          >
            <option value="">All severities</option>
            {Object.values(Severity).map((value) => (
              <option key={value} value={value}>
                {Presentation.label(value)}
              </option>
            ))}
          </select>
        </label>
        <button className="secondary" onClick={query.reload}>
          Refresh
        </button>
        <span className="subtle push-right">{overview?.openNcrCount ?? '—'} open NCRs</span>
      </div>
      <QueryState {...query}>
        {overview && (
          <>
            <dl className="stage-grid" aria-label="Open NCRs by phase">
              {Object.entries(workflowPhases).map(([phase, presentation]) => (
                <div className="stage-card" key={phase}>
                  <dt className="eyebrow" title={presentation.description}>
                    {presentation.label}
                  </dt>
                  <dd>
                    {overview.stageCounts
                      .filter(({ stage }) => workflowStages[stage].phase === phase)
                      .reduce((total, { count }) => total + count, 0)}
                  </dd>
                  <span className="stage-line" aria-hidden="true" />
                </div>
              ))}
            </dl>
            <div className="panel">
              <div className="panel-heading">
                <h2>Non-conformance register</h2>
                <div className="register-controls">
                  <label className="register-phase">
                    Phase
                    <select
                      value={phaseFilter}
                      onChange={(event) => setPhaseFilter(event.target.value as PhaseFilter)}
                    >
                      <option value="">All phases</option>
                      {Object.entries(workflowPhases).map(([phase, presentation]) => (
                        <option key={phase} value={phase}>
                          {presentation.label}
                        </option>
                      ))}
                      <option value="closed">Closed</option>
                    </select>
                  </label>
                  <span className="subtle" role="status" aria-live="polite">
                    {phaseFilter
                      ? `${registerRows.length} of ${overview.ncrs.length}`
                      : registerRows.length}{' '}
                    {(phaseFilter ? overview.ncrs.length : registerRows.length) === 1
                      ? 'record'
                      : 'records'}
                  </span>
                </div>
              </div>
              <div
                className="table-scroll"
                role="region"
                aria-label="Non-conformance register"
                tabIndex={0}
              >
                <table className="register-table">
                  <thead>
                    <tr>
                      {registerColumns.map((column) => {
                        const active = sort.key === column.key;
                        const nextDirection =
                          active && sort.direction === 'asc' ? 'descending' : 'ascending';
                        return (
                          <th
                            key={column.key}
                            scope="col"
                            aria-sort={
                              active
                                ? sort.direction === 'asc'
                                  ? 'ascending'
                                  : 'descending'
                                : undefined
                            }
                          >
                            <button
                              type="button"
                              className="sort-header"
                              title={`Sort by ${column.sortLabel} ${nextDirection}`}
                              onClick={() =>
                                setSort((current) => ({
                                  key: column.key,
                                  direction:
                                    current.key === column.key && current.direction === 'asc'
                                      ? 'desc'
                                      : 'asc',
                                }))
                              }
                            >
                              {column.label}
                              <span className="sort-arrow" aria-hidden="true">
                                {active ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}
                              </span>
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {registerRows.map((ncr) => (
                      <tr key={ncr.id}>
                        <td>
                          <a className="record-link" href={`#/ncr/${ncr.id}`}>
                            {ncr.number}
                          </a>
                          <small>{Presentation.label(ncr.defectCode)}</small>
                        </td>
                        <td>{ncr.site.code}</td>
                        <td>
                          <Badge value={ncr.stage} />
                        </td>
                        <td>
                          <Badge value={ncr.severity} />
                        </td>
                        <td className="mono">{ncr.workOrder.number}</td>
                        <td>
                          {ncr.lot ? (
                            <a
                              className="mono"
                              href={`#/lot/${encodeURIComponent(ncr.lot.lotNumber)}`}
                            >
                              {ncr.lot.lotNumber}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{ncr.quantityAffected}</td>
                      </tr>
                    ))}
                    {!registerRows.length && (
                      <tr>
                        <td colSpan={7}>No NCRs match these filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="two-columns">
              <section className="panel">
                <div className="panel-heading">
                  <h2>Material holds</h2>
                  <span className="badge badge-critical">
                    {Presentation.count(overview.heldLots.length, 'lot')}
                  </span>
                </div>
                <p className="subtle">
                  Filtered by site. Material holds apply across severity levels.
                </p>
                {overview.heldLots.length ? (
                  overview.heldLots.map((lot) => (
                    <div className="list-row" key={lot.id}>
                      <a
                        className="record-link"
                        href={`#/lot/${encodeURIComponent(lot.lotNumber)}`}
                      >
                        {lot.lotNumber}
                      </a>
                      <small>{lot.hold?.reason}</small>
                    </div>
                  ))
                ) : (
                  <p className="empty">No lots currently on hold.</p>
                )}
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Needs attention</h2>
                  <span className="subtle">Task unchanged &gt; {overview.staleDays} days</span>
                </div>
                {overview.staleNcrs.map((ncr) => (
                  <div className="list-row" key={ncr.id}>
                    <a className="record-link" href={`#/ncr/${ncr.id}`}>
                      {ncr.number}
                    </a>
                    <span>{Presentation.label(ncr.stage)}</span>
                    <small>Since {Presentation.date(ncr.stageEnteredAt)}</small>
                  </div>
                ))}
                {!overview.staleNcrs.length && <p className="empty">No stalled NCRs.</p>}
              </section>
            </div>
          </>
        )}
      </QueryState>
    </>
  );
}
