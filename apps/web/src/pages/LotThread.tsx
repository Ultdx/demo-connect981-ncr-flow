import { Presentation } from '../Presentation';
import { useMemo, useState, type FormEvent, type ReactElement } from 'react';
import { ContainLotDocument, LotThreadDocument, Role } from '../gql/graphql';
import { apiClient, ApiClient } from '../api';
import { useGql } from '../useGql';
import { useSession } from '../session';
import { Badge, QueryState } from '../components';

export function LotThread({ lotNumber }: { lotNumber: string }): ReactElement {
  const [search, setSearch] = useState(lotNumber);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const variables = useMemo(() => ({ lotNumber }), [lotNumber]);
  const query = useGql(LotThreadDocument, variables);
  const { role, setRole } = useSession();
  const lot = query.data?.lotThread;
  const canContain = role === Role.Production || role === Role.Quality;
  // A held lot can still have newly linked production that needs containment.
  const fullyContained = Boolean(
    lot?.hold?.active &&
      lot.serials.every((serial) => serial.hold?.active) &&
      lot.workOrders.every(
        (order) => order.hold?.active && order.serials.every((serial) => serial.hold?.active),
      ),
  );
  async function contain(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (pending || !canContain || fullyContained || !reason.trim()) return;
    setPending(true);
    setError('');
    setFeedback('');
    try {
      const result = await apiClient.request(
        ContainLotDocument,
        { input: { lotNumber, reason } },
        role,
      );
      const counts = result.containLot;
      setFeedback(
        `${Presentation.count(counts.lotsPlacedOnHold, 'lot')} placed on hold. ${counts.bySite.map((site) => `${site.site.code}: ${Presentation.count(site.workOrders, 'work order')}, ${Presentation.count(site.serials, 'serial')}`).join(' · ') || 'All affected entities were already on hold.'}`,
      );
      setConfirming(false);
      setReason('');
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
      <div className="page-heading">
        <div>
          <p className="eyebrow">TRACEABILITY / CROSS-SITE MATERIAL GENEALOGY</p>
          <h1>Digital thread</h1>
          <p className="subtle">Follow one material lot from supplier to affected products.</p>
        </div>
      </div>
      <form
        className="filters"
        onSubmit={(event) => {
          event.preventDefault();
          window.location.hash = `/lot/${encodeURIComponent(search.trim())}`;
        }}
      >
        <label>
          Material lot
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            required
            maxLength={100}
          />
        </label>
        <button type="submit">Trace lot →</button>
      </form>
      <QueryState {...query}>
        {lot ? (
          <>
            <section className="thread-hero">
              <div>
                <p className="eyebrow">MATERIAL LOT</p>
                <h2>{lot.lotNumber}</h2>
                <p>
                  {lot.partNumber} · Received {Presentation.date(lot.receivedAt)}
                </p>
              </div>
              <div>
                <Badge value={lot.hold?.active ? 'ON_HOLD' : 'NOT_ON_HOLD'} />
                <p>
                  {lot.hold?.active ? `On hold: ${lot.hold.reason}` : 'Material is not on hold'}
                </p>
              </div>
            </section>
            <div className="two-columns">
              <section className="panel">
                <p className="eyebrow">01 / ORIGIN</p>
                <h2>{lot.supplier.name}</h2>
                <p>Supplier status: {Presentation.label(lot.supplier.status)}</p>
                {lot.certificate && (
                  <>
                    <h3>{lot.certificate.type}</h3>
                    <a href={lot.certificate.url} target="_blank" rel="noreferrer">
                      {lot.certificate.number} ↗
                    </a>
                    <p className="subtle">Issued {Presentation.date(lot.certificate.issuedAt)}</p>
                  </>
                )}
              </section>
              <section className="panel">
                <p className="eyebrow">02 / RELATED NON-CONFORMANCES</p>
                <h2>{Presentation.count(lot.ncrs.length, 'connected NCR')}</h2>
                {lot.ncrs.map((ncr) => (
                  <div className="list-row" key={ncr.id}>
                    <a className="record-link" href={`#/ncr/${ncr.id}`}>
                      {ncr.number}
                    </a>
                    <span>
                      {ncr.site.code} · {Presentation.label(ncr.defectCode)}
                    </span>
                    <Badge value={ncr.stage} />
                  </div>
                ))}
              </section>
            </div>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">03 / AFFECTED PRODUCTION</p>
                  <h2>
                    {Presentation.count(lot.workOrders.length, 'work order')} ·{' '}
                    {Presentation.count(
                      new Set(lot.workOrders.map((order) => order.site.code)).size,
                      'site',
                    )}
                  </h2>
                </div>
                {canContain && !fullyContained && (
                  <button onClick={() => setConfirming(true)}>Contain all affected</button>
                )}
              </div>
              {fullyContained && (
                <p className="success" role="status">
                  All affected material and production are already on hold.
                </p>
              )}
              {!canContain && !fullyContained && (
                <div className="role-handoff">
                  <p>Production or Quality can contain affected material.</p>
                  <button type="button" onClick={() => setRole(Role.Production)}>
                    Switch to Production
                  </button>
                </div>
              )}
              {confirming && canContain && !fullyContained && (
                <form className="confirmation" onSubmit={(event) => void contain(event)}>
                  <h3>Confirm cross-site containment</h3>
                  <p>
                    This places the lot, its consuming work orders and their serials on hold across
                    all sites.
                  </p>
                  <label>
                    Containment reason
                    <textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      required
                      maxLength={2000}
                    />
                  </label>
                  <div className="inline">
                    <button disabled={pending || !reason.trim()} type="submit">
                      {pending ? 'Applying holds…' : 'Confirm containment'}
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => setConfirming(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              {lot.workOrders.map((order) => (
                <article className="production-row" key={order.id}>
                  <div>
                    <span className="site-tag">{order.site.code}</span>
                    <strong>{order.number}</strong>
                    <span className={order.hold?.active ? 'hold-text' : 'subtle'}>
                      {order.hold?.active ? 'On hold' : 'Not on hold'}
                    </span>
                  </div>
                  <div className="serial-list">
                    {order.serials.map((serial) => (
                      <span
                        className={serial.hold?.active ? 'serial held' : 'serial'}
                        key={serial.id}
                      >
                        {serial.serialNumber}
                        {serial.hold?.active ? ' · HOLD' : ''}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
              {feedback && (
                <p className="success" role="status">
                  {feedback}
                </p>
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
            </section>
          </>
        ) : (
          <p className="notice">No lot found for “{lotNumber}”.</p>
        )}
      </QueryState>
    </>
  );
}
