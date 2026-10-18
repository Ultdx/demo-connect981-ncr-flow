// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  OperationsDocument,
  Role,
  Severity,
  Stage,
  type OperationsQuery,
} from '../src/gql/graphql';
import { useGql } from '../src/useGql';
import { useSession } from '../src/session';
import { Operations } from '../src/pages/Operations';

vi.mock('../src/useGql', () => ({ useGql: vi.fn() }));
vi.mock('../src/session', () => ({ useSession: vi.fn() }));

const lyonId = '000000010000000000000001';
const baseRecord: OperationsQuery['operationsOverview']['ncrs'][number] = {
  id: '000000070000000000000002',
  number: 'NCR-2',
  stage: Stage.MrbReview,
  severity: Severity.Minor,
  defectCode: 'SEALING_DEFECT',
  quantityAffected: 2,
  stageEnteredAt: '2026-10-17T12:00:00.000Z',
  site: { code: 'LYO' },
  workOrder: { number: 'WO-10' },
  lot: { lotNumber: 'LOT-2' },
};
const data: OperationsQuery = {
  sites: [
    { id: lyonId, code: 'LYO', name: 'Lyon', country: 'FR' },
    { id: '000000010000000000000002', code: 'MTL', name: 'Montréal', country: 'CA' },
  ],
  operationsOverview: {
    openNcrCount: 3,
    staleDays: 5,
    stageCounts: [
      { stage: Stage.Containment, count: 1 },
      { stage: Stage.MrbReview, count: 1 },
      { stage: Stage.Disposition, count: 1 },
    ],
    ncrs: [
      baseRecord,
      {
        ...baseRecord,
        id: '000000070000000000000010',
        number: 'NCR-10',
        stage: Stage.Disposition,
        severity: Severity.Critical,
        quantityAffected: 10,
        site: { code: 'MTL' },
        workOrder: { number: 'WO-2' },
        lot: { lotNumber: 'LOT-10' },
      },
      {
        ...baseRecord,
        id: '000000070000000000000001',
        number: 'NCR-1',
        stage: Stage.Containment,
        severity: Severity.Major,
        quantityAffected: 5,
        workOrder: { number: 'WO-3' },
        lot: null,
      },
      {
        ...baseRecord,
        id: '000000070000000000000003',
        number: 'NCR-3',
        stage: Stage.Closed,
        quantityAffected: 1,
        site: { code: 'MTL' },
        workOrder: { number: 'WO-1' },
        lot: { lotNumber: 'LOT-3' },
      },
    ],
    heldLots: [],
    staleNcrs: [],
  },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSession).mockReturnValue({ role: Role.Inspector, setRole: vi.fn() });
  vi.mocked(useGql).mockReturnValue({ data, loading: false, error: '', reload: vi.fn() });
});
afterEach(cleanup);

describe('register phase filter', () => {
  it('includes both Decision tasks, filters Closed, and restores all phases', () => {
    render(<Operations />);
    const register = within(screen.getByRole('region', { name: 'Non-conformance register' }));
    const phase = screen.getByRole('combobox', { name: 'Phase' });
    fireEvent.change(phase, { target: { value: 'decision' } });
    expect(
      register.getAllByRole('link', { name: /^NCR-/ }).map((link) => link.textContent),
    ).toEqual(['NCR-2', 'NCR-10']);
    expect(screen.getByRole('status').textContent).toBe('2 of 4 records');
    // This register-only filter must not change dashboard totals or the API query.
    expect(
      within(screen.getByLabelText('Open NCRs by phase'))
        .getAllByRole('definition')
        .map((count) => count.textContent),
    ).toEqual(['0', '1', '2', '0', '0']);
    expect(vi.mocked(useGql)).toHaveBeenLastCalledWith(OperationsDocument, {
      siteId: undefined,
      severity: undefined,
    });
    fireEvent.change(phase, { target: { value: 'closed' } });
    expect(
      register.getAllByRole('link', { name: /^NCR-/ }).map((link) => link.textContent),
    ).toEqual(['NCR-3']);
    expect(screen.getByRole('status').textContent).toBe('1 of 4 records');
    fireEvent.change(phase, { target: { value: '' } });
    expect(
      register.getAllByRole('link', { name: /^NCR-/ }).map((link) => link.textContent),
    ).toEqual(['NCR-1', 'NCR-2', 'NCR-3', 'NCR-10']);
    expect(screen.getByRole('status').textContent).toBe('4 records');
  });

  it('reports an empty phase without leaving stale rows visible', () => {
    render(<Operations />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Phase' }), {
      target: { value: 'report' },
    });
    const register = within(screen.getByRole('region', { name: 'Non-conformance register' }));
    expect(register.queryAllByRole('link', { name: /^NCR-/ })).toHaveLength(0);
    expect(register.getByText('No NCRs match these filters.')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('0 of 4 records');
  });

  it('keeps phase and descending sort when site/severity data refreshes', () => {
    const reload = vi.fn();
    vi.mocked(useGql).mockReturnValue({ data, loading: false, error: '', reload });
    const view = render(<Operations />);
    const register = within(screen.getByRole('region', { name: 'Non-conformance register' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Phase' }), {
      target: { value: 'decision' },
    });
    fireEvent.click(register.getByRole('button', { name: 'Qty' }));
    fireEvent.click(register.getByRole('button', { name: 'Qty' }));
    expect(
      register.getAllByRole('link', { name: /^NCR-/ }).map((link) => link.textContent),
    ).toEqual(['NCR-10', 'NCR-2']);
    fireEvent.change(screen.getByRole('combobox', { name: 'Site' }), { target: { value: lyonId } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Severity' }), {
      target: { value: Severity.Minor },
    });
    expect(vi.mocked(useGql)).toHaveBeenLastCalledWith(OperationsDocument, {
      siteId: lyonId,
      severity: Severity.Minor,
    });
    const filtered: OperationsQuery = {
      ...data,
      operationsOverview: { ...data.operationsOverview, ncrs: [baseRecord], openNcrCount: 1 },
    };
    vi.mocked(useGql).mockReturnValue({ data: filtered, loading: false, error: '', reload });
    view.rerender(<Operations />);
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Phase' }).value).toBe(
      'decision',
    );
    expect(
      register.getAllByRole('link', { name: /^NCR-/ }).map((link) => link.textContent),
    ).toEqual(['NCR-2']);
    expect(
      register.getByRole('button', { name: 'Qty' }).closest('th')?.getAttribute('aria-sort'),
    ).toBe('descending');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(reload).toHaveBeenCalledOnce();
    expect(screen.getByRole('status').textContent).toBe('1 of 1 record');
  });
});

describe('register column sorting', () => {
  it.each([
    {
      column: 'NCR / defect',
      ascending: ['NCR-1', 'NCR-2', 'NCR-3', 'NCR-10'],
      descending: ['NCR-10', 'NCR-3', 'NCR-2', 'NCR-1'],
    },
    {
      column: 'Site',
      ascending: ['NCR-1', 'NCR-2', 'NCR-3', 'NCR-10'],
      descending: ['NCR-3', 'NCR-10', 'NCR-1', 'NCR-2'],
    },
    {
      column: 'Phase',
      ascending: ['NCR-1', 'NCR-2', 'NCR-10', 'NCR-3'],
      descending: ['NCR-3', 'NCR-2', 'NCR-10', 'NCR-1'],
    },
    {
      column: 'Severity',
      ascending: ['NCR-2', 'NCR-3', 'NCR-1', 'NCR-10'],
      descending: ['NCR-10', 'NCR-1', 'NCR-2', 'NCR-3'],
    },
    {
      column: 'Work order',
      ascending: ['NCR-3', 'NCR-10', 'NCR-1', 'NCR-2'],
      descending: ['NCR-2', 'NCR-1', 'NCR-10', 'NCR-3'],
    },
    {
      column: 'Material lot',
      ascending: ['NCR-2', 'NCR-3', 'NCR-10', 'NCR-1'],
      descending: ['NCR-10', 'NCR-3', 'NCR-2', 'NCR-1'],
    },
    {
      column: 'Qty',
      ascending: ['NCR-3', 'NCR-2', 'NCR-1', 'NCR-10'],
      descending: ['NCR-10', 'NCR-1', 'NCR-2', 'NCR-3'],
    },
  ])(
    'sorts $column in both directions with visible accessible state',
    ({ column, ascending, descending }) => {
      render(<Operations />);
      const register = within(screen.getByRole('region', { name: 'Non-conformance register' }));
      const button = register.getByRole('button', { name: column });
      if (column !== 'NCR / defect') fireEvent.click(button);
      expect(button.closest('th')?.getAttribute('aria-sort')).toBe('ascending');
      expect(
        register.getAllByRole('link', { name: /^NCR-/ }).map((link) => link.textContent),
      ).toEqual(ascending);
      fireEvent.click(button);
      expect(button.closest('th')?.getAttribute('aria-sort')).toBe('descending');
      expect(
        register.getAllByRole('link', { name: /^NCR-/ }).map((link) => link.textContent),
      ).toEqual(descending);
      expect(
        register.getAllByRole('columnheader').filter((header) => header.hasAttribute('aria-sort')),
      ).toHaveLength(1);
      expect(data.operationsOverview.ncrs.map((ncr) => ncr.number)).toEqual([
        'NCR-2',
        'NCR-10',
        'NCR-1',
        'NCR-3',
      ]);
    },
  );

  it('keeps the selected sort when changing phases and toggles back to ascending', () => {
    render(<Operations />);
    const register = within(screen.getByRole('region', { name: 'Non-conformance register' }));
    const quantity = register.getByRole('button', { name: 'Qty' });
    fireEvent.click(quantity);
    fireEvent.click(quantity);
    const phase = screen.getByRole('combobox', { name: 'Phase' });
    fireEvent.change(phase, { target: { value: 'decision' } });
    expect(
      register.getAllByRole('link', { name: /^NCR-/ }).map((link) => link.textContent),
    ).toEqual(['NCR-10', 'NCR-2']);
    fireEvent.click(quantity);
    expect(
      register.getAllByRole('link', { name: /^NCR-/ }).map((link) => link.textContent),
    ).toEqual(['NCR-2', 'NCR-10']);
    fireEvent.change(phase, { target: { value: '' } });
    expect(
      register.getAllByRole('link', { name: /^NCR-/ }).map((link) => link.textContent),
    ).toEqual(['NCR-3', 'NCR-2', 'NCR-1', 'NCR-10']);
  });
});
