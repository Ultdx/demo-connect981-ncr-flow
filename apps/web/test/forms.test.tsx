// @vitest-environment jsdom
import { testCredentials } from '../../api/test/credentials';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  CreateNcrDocument,
  Disposition,
  Role,
  Severity,
  Stage,
  TransitionNcrDocument,
  type CreateNcrMutation,
  type CreationOptionsQuery,
  type LotThreadQuery,
  type NcrDetailQuery,
  type OperationsQuery,
  type TransitionNcrMutation,
} from '../src/gql/graphql';
import { apiClient } from '../src/api';
import { useGql } from '../src/useGql';
import { useSession } from '../src/session';
import { CreateNcr } from '../src/pages/CreateNcr';
import { NcrDetail } from '../src/pages/NcrDetail';
import { Operations } from '../src/pages/Operations';
import { LotThread } from '../src/pages/LotThread';

vi.mock('../src/useGql', () => ({ useGql: vi.fn() }));
vi.mock('../src/session', () => ({ useSession: vi.fn() }));
vi.mock('../src/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/api')>()),
  apiClient: { request: vi.fn() },
}));

const id = '000000070000000000000001';
const otherWorkOrderId = '000000050000000000000009';
const otherLotId = '000000040000000000000003';
const noLotWorkOrderId = '000000050000000000000016';
const lotResponse: LotThreadQuery = {
  lotThread: {
    id,
    lotNumber: 'LOT-EL-2291',
    partNumber: 'SEAL-A320',
    receivedAt: '2026-10-17T12:00:00.000Z',
    supplier: { name: 'Demo supplier', status: 'APPROVED' },
    certificate: null,
    hold: null,
    workOrders: [],
    serials: [],
    ncrs: [],
  },
};
const createResponse: CreateNcrMutation = { createNcr: { id, number: 'NCR-2026-0001' } };
const submitResponse: TransitionNcrMutation = {
  transitionNcr: { id, lastEventSeq: 2, stage: Stage.Containment },
};
const creationOptions: CreationOptionsQuery = {
  workOrders: [
    {
      id,
      number: 'WO-LYO-1041',
      partNumber: 'SEAL-A320',
      revision: 'C',
      consumedLots: [{ lotId: id, qty: 12 }],
      lots: [{ id, lotNumber: 'LOT-EL-2291' }],
      operations: [{ step: 20, name: 'Inspection' }],
    },
    {
      id: otherWorkOrderId,
      number: 'WO-LYO-1049',
      partNumber: 'SEAL-A320',
      revision: 'C',
      consumedLots: [{ lotId: otherLotId, qty: 6 }],
      lots: [{ id: otherLotId, lotNumber: 'LOT-EL-2302' }],
      operations: [{ step: 10, name: 'Moulding' }],
    },
    {
      id: noLotWorkOrderId,
      number: 'WO-LYO-1056',
      partNumber: 'SEAL-A320',
      revision: 'C',
      consumedLots: [],
      lots: [],
      operations: [{ step: 20, name: 'Inspection' }],
    },
  ],
  erpCatalog: { parts: [] },
};
const detection: NonNullable<NcrDetailQuery['ncr']> = {
  id,
  number: 'NCR-2026-0001',
  stage: Stage.Initiation,
  state: 'OPEN',
  severity: Severity.Major,
  workflowVersion: 1,
  partNumber: 'SEAL-A320',
  revision: 'C',
  operationStep: 20,
  defectCode: 'SEALING_DEFECT',
  detectionSource: 'Final inspection',
  quantityAffected: 1,
  evidence: [],
  containmentAction: null,
  disposition: null,
  engineeringInstructions: null,
  verificationNote: null,
  lastEventSeq: 1,
  stageEnteredAt: '2026-10-17T12:00:00.000Z',
  mrbApproval: null,
  site: { code: 'LYO', name: 'Lyon' },
  workOrder: { number: 'WO-LYO-1041', orderRef: 'PO-2026-410' },
  lot: null,
  serials: [],
  availableActions: [
    { action: 'SUBMIT', allowed: false, blockedBy: ['Add at least one evidence URL.'] },
  ],
  events: [],
};
const overview: OperationsQuery = {
  sites: [],
  operationsOverview: {
    openNcrCount: 0,
    staleDays: 7,
    stageCounts: [],
    ncrs: [],
    heldLots: [],
    staleNcrs: [],
  },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSession).mockReturnValue({ role: Role.Inspector, setRole: vi.fn() });
  vi.mocked(useGql).mockReturnValue({
    data: creationOptions,
    loading: false,
    error: '',
    reload: vi.fn(),
  });
  window.location.hash = '';
});
afterEach(cleanup);

describe('creation evidence validation', () => {
  it.each([
    { field: 'Defect code', value: '', message: 'Enter a defect code.' },
    { field: 'Defect code', value: '   ', message: 'Enter a defect code.' },
    { field: 'Detection source', value: '', message: 'Enter a detection source.' },
    { field: 'Quantity affected', value: '', message: 'Enter a whole number of at least 1.' },
    { field: 'Quantity affected', value: '0', message: 'Enter a whole number of at least 1.' },
    { field: 'Quantity affected', value: '-1', message: 'Enter a whole number of at least 1.' },
    { field: 'Quantity affected', value: '1.5', message: 'Enter a whole number of at least 1.' },
    {
      field: 'Quantity affected',
      value: '99999',
      message: 'Quantity affected cannot exceed 12 for the selected material.',
    },
  ])(
    'explains invalid $field ($value) and prevents even a forced form submission',
    ({ field, value, message }) => {
      const view = render(<CreateNcr />);
      fireEvent.change(screen.getByLabelText('Work order'), { target: { value: id } });
      fireEvent.change(screen.getByLabelText('Evidence URLs (one per line)'), {
        target: { value: 'https://example.com/proof' },
      });
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Create NCR' }).disabled).toBe(
        false,
      );
      const input = screen.getByLabelText(field);
      fireEvent.change(input, { target: { value } });
      expect(screen.getByText(message)).toBeTruthy();
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Create NCR' }).disabled).toBe(
        true,
      );
      const form = view.container.querySelector('form');
      if (!form) throw new Error('Expected the creation form.');
      fireEvent.submit(form);
      expect(apiClient.request).not.toHaveBeenCalled();
    },
  );

  it('revalidates quantity against the newly selected work order', () => {
    render(<CreateNcr />);
    fireEvent.change(screen.getByLabelText('Work order'), { target: { value: id } });
    fireEvent.change(screen.getByLabelText('Quantity affected'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Evidence URLs (one per line)'), {
      target: { value: 'https://example.com/proof' },
    });
    const create = screen.getByRole<HTMLButtonElement>('button', { name: 'Create NCR' });
    expect(create.disabled).toBe(false);
    fireEvent.change(screen.getByLabelText('Work order'), { target: { value: otherWorkOrderId } });
    expect(create.disabled).toBe(true);
    expect(
      screen.getByText('Quantity affected cannot exceed 6 for the selected material.'),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Quantity affected'), { target: { value: '6' } });
    expect(create.disabled).toBe(false);
  });

  it('blocks empty and invalid evidence before making any requests', () => {
    const view = render(<CreateNcr />);
    const evidence = screen.getByLabelText('Evidence URLs (one per line)');
    const create = screen.getByRole<HTMLButtonElement>('button', { name: 'Create NCR' });
    expect(create.disabled).toBe(true);
    expect(screen.getByText('At least one evidence URL is required.').className).not.toContain(
      'error',
    );
    expect(evidence.getAttribute('aria-invalid')).toBe('false');
    fireEvent.change(evidence, { target: { value: 'not-a-url' } });
    expect(create.disabled).toBe(true);
    expect(evidence.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Enter a valid URL starting with http:// or https://.')).toBeTruthy();
    const form = view.container.querySelector('form');
    if (!form) throw new Error('Creation form should be rendered.');
    // The submit handler also guards invalid evidence when native validation is bypassed.
    fireEvent.submit(form);
    expect(apiClient.request).not.toHaveBeenCalled();
    fireEvent.change(evidence, { target: { value: '   \n ' } });
    expect(create.disabled).toBe(true);
  });

  it('creates with normalized valid links and navigates to the result', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce(createResponse);
    render(<CreateNcr />);
    fireEvent.change(screen.getByLabelText('Work order'), { target: { value: id } });
    fireEvent.change(screen.getByLabelText('Evidence URLs (one per line)'), {
      target: { value: '  https://example.com/proof \n\n http://example.com/report  ' },
    });
    const create = screen.getByRole<HTMLButtonElement>('button', { name: 'Create NCR' });
    expect(create.disabled).toBe(false);
    fireEvent.click(create);
    await waitFor(() => expect(window.location.hash).toBe(`#/ncr/${id}`));
    expect(apiClient.request).toHaveBeenCalledExactlyOnceWith(
      CreateNcrDocument,
      {
        input: {
          workOrderId: id,
          operationStep: 20,
          lotId: id,
          severity: Severity.Major,
          defectCode: 'SEALING_DEFECT',
          detectionSource: 'Final inspection',
          quantityAffected: 1,
          evidence: ['https://example.com/proof', 'http://example.com/report'],
        },
      },
      Role.Inspector,
    );
  });

  it('resets the lot and operation to the selected work order before creation', async () => {
    vi.mocked(apiClient.request).mockResolvedValueOnce(createResponse);
    render(<CreateNcr />);
    const order = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Work order' });
    const lot = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Material lot' });
    fireEvent.change(order, { target: { value: id } });
    expect(lot.value).toBe(id);
    fireEvent.change(order, { target: { value: otherWorkOrderId } });
    expect(lot.value).toBe(otherLotId);
    expect(within(lot).queryByRole('option', { name: 'LOT-EL-2291' })).toBeNull();
    expect(within(lot).getByRole('option', { name: 'LOT-EL-2302' })).toBeTruthy();
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Operation' }).value).toBe('10');
    fireEvent.change(screen.getByLabelText('Evidence URLs (one per line)'), {
      target: { value: 'https://example.com/proof' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create NCR' }));
    await waitFor(() =>
      expect(apiClient.request).toHaveBeenCalledExactlyOnceWith(
        CreateNcrDocument,
        {
          input: {
            workOrderId: otherWorkOrderId,
            operationStep: 10,
            lotId: otherLotId,
            severity: Severity.Major,
            defectCode: 'SEALING_DEFECT',
            detectionSource: 'Final inspection',
            quantityAffected: 1,
            evidence: ['https://example.com/proof'],
          },
        },
        Role.Inspector,
      ),
    );
  });

  it('blocks creation without an order or a linked lot even when evidence is valid', () => {
    const view = render(<CreateNcr />);
    fireEvent.change(screen.getByLabelText('Evidence URLs (one per line)'), {
      target: { value: 'https://example.com/proof' },
    });
    const create = screen.getByRole<HTMLButtonElement>('button', { name: 'Create NCR' });
    const lot = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Material lot' });
    const form = view.container.querySelector('form');
    if (!form) throw new Error('Creation form should be rendered.');
    expect(lot.disabled).toBe(true);
    expect(create.disabled).toBe(true);
    fireEvent.submit(form);
    fireEvent.change(screen.getByLabelText('Work order'), { target: { value: noLotWorkOrderId } });
    expect(lot.disabled).toBe(true);
    expect(create.disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toContain(
      'No material lot is recorded for this work order.',
    );
    fireEvent.submit(form);
    expect(apiClient.request).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Work order'), { target: { value: otherWorkOrderId } });
    // A stale/tampered selection is rejected locally as well as by the API.
    fireEvent.change(lot, { target: { value: id } });
    expect(create.disabled).toBe(true);
    fireEvent.submit(form);
    expect(apiClient.request).not.toHaveBeenCalled();
  });
});

describe('submission evidence validation', () => {
  beforeEach(() => {
    const data: NcrDetailQuery = { ncr: detection };
    vi.mocked(useGql).mockReturnValue({ data, loading: false, error: '', reload: vi.fn() });
  });

  it('blocks missing and malformed evidence, then submits a valid replacement', async () => {
    vi.mocked(apiClient.request).mockResolvedValue(submitResponse);
    render(<NcrDetail id={id} />);
    const submit = screen.getByRole<HTMLButtonElement>('button', { name: 'Submit' });
    const evidence = screen.getByLabelText('Evidence URLs for submission (one per line)');
    expect(submit.disabled).toBe(true);
    expect(screen.getByText('At least one evidence URL is required.').className).not.toContain(
      'error',
    );
    expect(evidence.getAttribute('aria-invalid')).toBe('false');
    fireEvent.click(submit);
    fireEvent.change(evidence, { target: { value: 'example.com/proof' } });
    expect(submit.disabled).toBe(true);
    fireEvent.click(submit);
    expect(apiClient.request).not.toHaveBeenCalled();
    fireEvent.change(evidence, { target: { value: ' https://example.com/proof \n' } });
    expect(submit.disabled).toBe(false);
    expect(screen.queryByText('Add at least one evidence URL.')).toBeNull();
    fireEvent.click(submit);
    await waitFor(() =>
      expect(apiClient.request).toHaveBeenCalledExactlyOnceWith(
        TransitionNcrDocument,
        {
          input: {
            ncrId: id,
            expectedSeq: 1,
            action: 'SUBMIT',
            payload: { evidence: ['https://example.com/proof'] },
          },
        },
        Role.Inspector,
      ),
    );
  });

  it('retains saved evidence but blocks an invalid replacement', async () => {
    const data: NcrDetailQuery = {
      ncr: {
        ...detection,
        evidence: ['https://example.com/saved-proof'],
        availableActions: [{ action: 'SUBMIT', allowed: true, blockedBy: [] }],
      },
    };
    vi.mocked(useGql).mockReturnValue({ data, loading: false, error: '', reload: vi.fn() });
    vi.mocked(apiClient.request).mockResolvedValue(submitResponse);
    render(<NcrDetail id={id} />);
    const submit = screen.getByRole<HTMLButtonElement>('button', { name: 'Submit' });
    const evidence = screen.getByLabelText('Evidence URLs for submission (one per line)');
    expect(submit.disabled).toBe(false);
    fireEvent.change(evidence, { target: { value: 'ftp://example.com/proof' } });
    expect(submit.disabled).toBe(true);
    fireEvent.click(submit);
    expect(apiClient.request).not.toHaveBeenCalled();
    fireEvent.change(evidence, { target: { value: ' \n ' } });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() =>
      expect(apiClient.request).toHaveBeenCalledExactlyOnceWith(
        TransitionNcrDocument,
        { input: { ncrId: id, expectedSeq: 1, action: 'SUBMIT', payload: {} } },
        Role.Inspector,
      ),
    );
  });
});

describe('creation entry point', () => {
  it.each(Object.values(Role))(
    'keeps Create NCR visible on returning to Operations as %s',
    (role) => {
      vi.mocked(useSession).mockReturnValue({ role, setRole: vi.fn() });
      vi.mocked(useGql).mockReturnValue({
        data: overview,
        loading: false,
        error: '',
        reload: vi.fn(),
      });
      const firstVisit = render(<Operations />);
      expect(screen.getByRole('link', { name: '+ Create NCR' }).getAttribute('href')).toBe('#/new');
      firstVisit.unmount();
      render(<Operations />);
      expect(screen.getByRole('link', { name: '+ Create NCR' }).getAttribute('href')).toBe('#/new');
    },
  );

  it('offers an explicit Inspector switch before showing the creation form', () => {
    const setRole = vi.fn<(role: Role) => void>();
    vi.mocked(useSession).mockReturnValue({ role: Role.Production, setRole });
    const view = render(<CreateNcr />);
    expect(screen.queryByRole('button', { name: 'Create NCR' })).toBeNull();
    expect(setRole).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Inspector' }));
    expect(setRole).toHaveBeenCalledExactlyOnceWith(Role.Inspector);
    vi.mocked(useSession).mockReturnValue({ role: Role.Inspector, setRole });
    view.rerender(<CreateNcr />);
    expect(screen.getByRole('button', { name: 'Create NCR' })).toBeTruthy();
  });
});

describe('short demo workflow', () => {
  it('updates Engineering requirements from the draft before sending a command', async () => {
    vi.mocked(useGql).mockReturnValue({
      data: {
        ncr: {
          ...detection,
          stage: Stage.MrbReview,
          availableActions: [
            { action: 'PROPOSE_DISPOSITION', allowed: false, blockedBy: ['Select a disposition.'] },
          ],
        },
      },
      loading: false,
      error: '',
      reload: vi.fn(),
    });
    vi.mocked(useSession).mockReturnValue({ role: Role.Engineering, setRole: vi.fn() });
    vi.mocked(apiClient.request).mockResolvedValue(submitResponse);
    render(<NcrDetail id={id} />);
    const propose = screen.getByRole<HTMLButtonElement>('button', { name: 'Propose treatment' });
    expect(screen.queryByText('Select a disposition.')).toBeNull();
    expect(propose.disabled).toBe(false);
    fireEvent.change(screen.getByRole('combobox', { name: 'Treatment' }), {
      target: { value: Disposition.Rework },
    });
    expect(screen.getByText('Rework and repair require engineering instructions.')).toBeTruthy();
    expect(propose.disabled).toBe(true);
    fireEvent.click(propose);
    expect(apiClient.request).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Engineering instructions' }), {
      target: { value: 'Replace the affected seals.' },
    });
    expect(propose.disabled).toBe(false);
    expect(screen.queryByText('Rework and repair require engineering instructions.')).toBeNull();
    fireEvent.click(propose);
    await waitFor(() =>
      expect(apiClient.request).toHaveBeenCalledWith(
        TransitionNcrDocument,
        {
          input: {
            ncrId: id,
            expectedSeq: 1,
            action: 'PROPOSE_DISPOSITION',
            payload: {
              disposition: Disposition.Rework,
              engineeringInstructions: 'Replace the affected seals.',
            },
          },
        },
        Role.Engineering,
      ),
    );
  });

  it('shows the signed-in actor, event count, and explicitly labeled workflow version', () => {
    vi.mocked(useGql).mockReturnValue({
      data: {
        ncr: {
          ...detection,
          events: [
            {
              id: 'event-1',
              seq: 1,
              type: 'NCR_CREATED',
              actorRole: Role.Inspector,
              actorUsername: testCredentials.username,
              at: '2026-10-18T10:00:00.000Z',
              workflowVersion: 1,
            },
          ],
        },
      },
      loading: false,
      error: '',
      reload: vi.fn(),
    });
    render(<NcrDetail id={id} />);
    expect(screen.getByText(`${testCredentials.username} · Inspector`)).toBeTruthy();
    expect(screen.getByText('1 event')).toBeTruthy();
    expect(screen.getByText('Workflow v1')).toBeTruthy();
    expect(screen.getByLabelText('Event 1')).toBeTruthy();
  });

  it.each([false, true])(
    'offers containment only while affected entities need it (fully held: %s)',
    (held) => {
      const lot = lotResponse.lotThread;
      if (!lot) throw new Error('Expected a lot fixture.');
      vi.mocked(useSession).mockReturnValue({ role: Role.Production, setRole: vi.fn() });
      vi.mocked(useGql).mockReturnValue({
        data: {
          lotThread: {
            ...lot,
            hold: {
              active: true,
              reason: 'Quarantine.',
              placedAt: '2026-10-18T10:00:00.000Z',
              placedByRole: Role.Quality,
            },
            // A direct lot serial can need a hold even when no work order is listed.
            serials: [{ id: 'serial-1', hold: { active: held } }],
          },
        },
        loading: false,
        error: '',
        reload: vi.fn(),
      });
      render(<LotThread lotNumber="LOT-EL-2291" />);
      expect(Boolean(screen.queryByRole('button', { name: 'Contain all affected' }))).toBe(!held);
      expect(apiClient.request).not.toHaveBeenCalled();
    },
  );

  it('labels an unheld lot without implying an authorized release', () => {
    vi.mocked(useGql).mockReturnValue({
      data: lotResponse,
      loading: false,
      error: '',
      reload: vi.fn(),
    });
    render(<LotThread lotNumber="LOT-EL-2291" />);
    expect(screen.getByText('Not on hold')).toBeTruthy();
    expect(screen.queryByText('Released')).toBeNull();
  });

  it('offers Production access to the material thread without placing holds automatically', () => {
    const setRole = vi.fn<(role: Role) => void>();
    vi.mocked(useGql).mockReturnValue({
      data: lotResponse,
      loading: false,
      error: '',
      reload: vi.fn(),
    });
    vi.mocked(useSession).mockReturnValue({ role: Role.Inspector, setRole });
    const view = render(<LotThread lotNumber="LOT-EL-2291" />);
    expect(screen.queryByRole('button', { name: 'Contain all affected' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Production' }));
    expect(setRole).toHaveBeenCalledExactlyOnceWith(Role.Production);
    expect(apiClient.request).not.toHaveBeenCalled();
    vi.mocked(useSession).mockReturnValue({ role: Role.Production, setRole });
    view.rerender(<LotThread lotNumber="LOT-EL-2291" />);
    fireEvent.click(screen.getByRole('button', { name: 'Contain all affected' }));
    expect(screen.getByRole('heading', { name: 'Confirm cross-site containment' })).toBeTruthy();
    expect(apiClient.request).not.toHaveBeenCalled();
  });

  it('shows five phase totals and groups both decision stages exactly once', () => {
    const data: OperationsQuery = {
      ...overview,
      operationsOverview: {
        ...overview.operationsOverview,
        openNcrCount: 18,
        stageCounts: [
          { stage: Stage.Initiation, count: 1 },
          { stage: Stage.Containment, count: 2 },
          { stage: Stage.MrbReview, count: 3 },
          { stage: Stage.Disposition, count: 4 },
          { stage: Stage.Execution, count: 5 },
          { stage: Stage.Closure, count: 3 },
          { stage: Stage.Closed, count: 10 },
        ],
      },
    };
    vi.mocked(useGql).mockReturnValue({ data, loading: false, error: '', reload: vi.fn() });
    render(<Operations />);
    const summary = within(screen.getByLabelText('Open NCRs by phase'));
    expect(summary.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Report',
      'Containment',
      'Decision',
      'Execution',
      'Verification',
    ]);
    expect(summary.getAllByRole('definition').map((count) => count.textContent)).toEqual([
      '1',
      '2',
      '7',
      '5',
      '3',
    ]);
  });

  it.each([
    {
      stage: Stage.MrbReview,
      owner: Role.Engineering,
      roleName: 'Engineering',
      task: 'Engineering review',
    },
    { stage: Stage.Disposition, owner: Role.Mrb, roleName: 'MRB', task: 'MRB approval' },
  ])(
    'keeps $task distinct inside Decision and switches role only on a click',
    ({ stage, owner, roleName, task }) => {
      const setRole = vi.fn<(role: Role) => void>();
      const data: NcrDetailQuery = { ncr: { ...detection, stage, availableActions: [] } };
      vi.mocked(useGql).mockReturnValue({ data, loading: false, error: '', reload: vi.fn() });
      vi.mocked(useSession).mockReturnValue({ role: Role.Production, setRole });
      render(<NcrDetail id={id} />);
      expect(screen.getByRole('heading', { name: task })).toBeTruthy();
      const phases = within(screen.getByRole('list', { name: 'NCR progress' })).getAllByRole(
        'listitem',
      );
      expect(phases).toHaveLength(5);
      const current = phases.filter((phase) => phase.getAttribute('aria-current') === 'step');
      expect(current).toHaveLength(1);
      expect(current[0]?.textContent).toContain('Decision');
      expect(setRole).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: `Switch to ${roleName}` }));
      expect(setRole).toHaveBeenCalledExactlyOnceWith(owner);
      expect(apiClient.request).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: 'Approve treatment' })).toBeNull();
    },
  );

  it('shows the proposed repair and its instructions before MRB approval', async () => {
    const data: NcrDetailQuery = {
      ncr: {
        ...detection,
        stage: Stage.Disposition,
        lastEventSeq: 4,
        disposition: Disposition.Repair,
        engineeringInstructions: 'Replace affected seals using the approved repair instruction.',
        availableActions: [
          { action: 'APPROVE', allowed: true, blockedBy: [] },
          { action: 'REJECT', allowed: false, blockedBy: ['Provide a rejection reason.'] },
        ],
      },
    };
    const approved: TransitionNcrMutation = {
      transitionNcr: { id, stage: Stage.Execution, lastEventSeq: 5 },
    };
    vi.mocked(useGql).mockReturnValue({ data, loading: false, error: '', reload: vi.fn() });
    vi.mocked(useSession).mockReturnValue({ role: Role.Mrb, setRole: vi.fn() });
    vi.mocked(apiClient.request).mockResolvedValue(approved);
    render(<NcrDetail id={id} />);
    const task = screen.getByRole('region', { name: 'Current workflow task' });
    expect(task.textContent).toContain('Treatment: Repair');
    expect(task.textContent).toContain(
      'Replace affected seals using the approved repair instruction.',
    );
    expect(within(task).getByRole('textbox', { name: 'Reason' })).toBeTruthy();
    fireEvent.click(within(task).getByRole('button', { name: 'Approve treatment' }));
    await waitFor(() =>
      expect(apiClient.request).toHaveBeenCalledExactlyOnceWith(
        TransitionNcrDocument,
        { input: { ncrId: id, expectedSeq: 4, action: 'APPROVE', payload: {} } },
        Role.Mrb,
      ),
    );
  });

  it('keeps Closed terminal and marks all five phases complete', () => {
    const data: NcrDetailQuery = {
      ncr: { ...detection, stage: Stage.Closed, state: 'CLOSED', availableActions: [] },
    };
    vi.mocked(useGql).mockReturnValue({ data, loading: false, error: '', reload: vi.fn() });
    render(<NcrDetail id={id} />);
    expect(screen.getByRole('heading', { name: 'Report closed' })).toBeTruthy();
    const phases = within(screen.getByRole('list', { name: 'NCR progress' })).getAllByRole(
      'listitem',
    );
    expect(phases).toHaveLength(5);
    expect(
      phases.every(
        (phase) => phase.className === 'complete' && !phase.hasAttribute('aria-current'),
      ),
    ).toBe(true);
    expect(screen.queryByRole('button', { name: /Switch to/ })).toBeNull();
    expect(apiClient.request).not.toHaveBeenCalled();
  });
});
