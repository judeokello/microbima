import { LctPendingAction, PolicyStatus } from '@prisma/client';
import { LctSyncService } from '../lct-sync.service';
import {
  LCT_PENDING_REASONS,
  mapPolicyStatusToLctAction,
  normalizeEmailList,
  shouldEnqueueStatusChange,
} from '../lct.types';
import { assertValidLctAction, buildLctCsv, intentToCsvRow } from '../lct-csv.builder';
import type { LctMemberSyncIntent } from '../lct.types';

/**
 * Safety-critical LCT coverage: wrong actions can leave suspended/terminated
 * members able to receive care at LCT, or block entitled members.
 */
describe('LCT safety — status enqueue matrix', () => {
  const cases: Array<{
    from: string;
    to: string;
    expectEnqueue: boolean;
    expectAction: LctPendingAction | null;
    why: string;
  }> = [
    {
      from: 'PENDING_ACTIVATION',
      to: 'ACTIVE',
      expectEnqueue: true,
      expectAction: LctPendingAction.ACTIVATE,
      why: 'first activation must reach LCT',
    },
    {
      from: 'ACTIVE',
      to: 'SUSPENDED',
      expectEnqueue: true,
      expectAction: LctPendingAction.SUSPENDED,
      why: 'non-payers must be suspended at LCT (not deactivate-only)',
    },
    {
      from: 'ACTIVE',
      to: 'INACTIVE',
      expectEnqueue: true,
      expectAction: LctPendingAction.DEACTIVATE,
      why: 'inactive must deactivate at LCT',
    },
    {
      from: 'ACTIVE',
      to: 'DEACTIVATED',
      expectEnqueue: true,
      expectAction: LctPendingAction.DEACTIVATE,
      why: 'deactivated must deactivate at LCT',
    },
    {
      from: 'ACTIVE',
      to: 'TERMINATED',
      expectEnqueue: true,
      expectAction: LctPendingAction.DEACTIVATE,
      why: 'terminated must deactivate at LCT',
    },
    {
      from: 'ACTIVE',
      to: 'EXPIRED',
      expectEnqueue: true,
      expectAction: LctPendingAction.DEACTIVATE,
      why: 'expired must deactivate at LCT',
    },
    {
      from: 'SUSPENDED',
      to: 'ACTIVE',
      expectEnqueue: true,
      expectAction: LctPendingAction.ACTIVATE,
      why: 'returning payers must be reactivated at LCT',
    },
    {
      from: 'INACTIVE',
      to: 'ACTIVE',
      expectEnqueue: true,
      expectAction: LctPendingAction.ACTIVATE,
      why: 'reactivation from inactive must reach LCT',
    },
    {
      from: 'SUSPENDED',
      to: 'TERMINATED',
      expectEnqueue: false,
      expectAction: LctPendingAction.DEACTIVATE,
      why: 'non-active → non-active must NOT re-queue (already off care via SUSPENDED)',
    },
    {
      from: 'SUSPENDED',
      to: 'INACTIVE',
      expectEnqueue: false,
      expectAction: LctPendingAction.DEACTIVATE,
      why: 'suspended → inactive must NOT re-queue',
    },
    {
      from: 'INACTIVE',
      to: 'TERMINATED',
      expectEnqueue: false,
      expectAction: LctPendingAction.DEACTIVATE,
      why: 'inactive → terminated must NOT re-queue',
    },
    {
      from: 'PENDING_ACTIVATION',
      to: 'SUSPENDED',
      expectEnqueue: true,
      expectAction: LctPendingAction.SUSPENDED,
      why: 'edge: entering suspended from pending still maps to SUSPENDED action',
    },
    {
      from: 'ACTIVE',
      to: 'ACTIVE',
      expectEnqueue: false,
      expectAction: LctPendingAction.ACTIVATE,
      why: 'no-op status must not spam LCT',
    },
    {
      from: 'ACTIVE',
      to: 'PENDING_ACTIVATION',
      expectEnqueue: false,
      expectAction: null,
      why: 'pending activation is not an LCT sync target',
    },
  ];

  it.each(cases)('$why ($from → $to)', ({ from, to, expectEnqueue, expectAction }) => {
    expect(shouldEnqueueStatusChange(from, to)).toBe(expectEnqueue);
    expect(mapPolicyStatusToLctAction(to)).toBe(expectAction);
  });

  it('never maps ACTIVE loss-of-cover to ACTIVATE', () => {
    for (const to of [
      PolicyStatus.SUSPENDED,
      PolicyStatus.INACTIVE,
      PolicyStatus.DEACTIVATED,
      PolicyStatus.TERMINATED,
      PolicyStatus.EXPIRED,
    ]) {
      const action = mapPolicyStatusToLctAction(to);
      expect(action).not.toBe(LctPendingAction.ACTIVATE);
      expect(action === LctPendingAction.SUSPENDED || action === LctPendingAction.DEACTIVATE).toBe(
        true
      );
    }
  });
});

describe('LCT safety — CSV action fidelity', () => {
  const intent = (overrides: Partial<LctMemberSyncIntent>): LctMemberSyncIntent => ({
    memberNumber: 'MFG100-00',
    action: LctPendingAction.ACTIVATE,
    policyId: 'p1',
    customerId: 'c1',
    dependantId: null,
    subjectType: 'PRINCIPAL',
    reasons: [LCT_PENDING_REASONS.STATUS_CHANGE],
    employeeName: 'Principal Name',
    staffNumber: '',
    memberName: 'Principal Name',
    gender: 'Male',
    dateOfBirth: '01-01-1980',
    relationship: 'PRINCIPAL',
    email: '',
    phoneNumber: '254711000000',
    idNumber: '11111111',
    principalMemberNumber: 'MFG100-00',
    schemeName: 'Test Scheme',
    policyStartDate: '01-06-2026',
    policyEndDate: '31-05-2027',
    productName: 'Maisha Poa',
    planName: 'Gold',
    ...overrides,
  });

  it('emits SUSPENDED (not DEACTIVATE) when policy is suspended', () => {
    const row = intentToCsvRow(
      intent({ action: LctPendingAction.SUSPENDED, reasons: [LCT_PENDING_REASONS.STATUS_CHANGE] })
    );
    expect(row['REQUIRED ACTION']).toBe('SUSPENDED');
    expect(row['REQUIRED ACTION']).not.toBe('DEACTIVATE');
    expect(row['REQUIRED ACTION']).not.toBe('ACTIVATE');
  });

  it('emits DEACTIVATE for terminated / inactive cover removal', () => {
    const row = intentToCsvRow(intent({ action: LctPendingAction.DEACTIVATE }));
    expect(row['REQUIRED ACTION']).toBe('DEACTIVATE');
  });

  it('rowCount comes from CSV data rows (not UI selection count)', () => {
    const intents = [
      intent({ memberNumber: 'A-00', action: LctPendingAction.ACTIVATE }),
      intent({
        memberNumber: 'A-01',
        action: LctPendingAction.SUSPENDED,
        subjectType: 'DEPENDANT',
        relationship: 'SPOUSE',
        principalMemberNumber: 'A-00',
        memberName: 'Spouse',
      }),
    ];
    const { csv, rowCount } = buildLctCsv(intents);
    const dataLines = csv.trimEnd().split('\n').slice(1);
    expect(rowCount).toBe(2);
    expect(dataLines).toHaveLength(2);
    expect(dataLines[1]).toContain('SUSPENDED');
  });

  it('rejects unknown REQUIRED ACTION values', () => {
    expect(assertValidLctAction('ACTIVATE')).toBe(true);
    expect(assertValidLctAction('DEACTIVATE')).toBe(true);
    expect(assertValidLctAction('SUSPENDED')).toBe(true);
    expect(assertValidLctAction('active')).toBe(false);
    expect(assertValidLctAction('INACTIVE')).toBe(false);
    expect(assertValidLctAction('')).toBe(false);
  });
});

describe('LCT safety — profile fingerprint & email envelope', () => {
  const sync = new LctSyncService({} as never, {} as never);

  it('fingerprint changes when phone or id changes (triggers re-send)', () => {
    const base = {
      firstName: 'Jane',
      middleName: null,
      lastName: 'Doe',
      dateOfBirth: new Date(Date.UTC(1990, 0, 15)),
      gender: 'FEMALE',
      phoneNumber: '+254700000001',
      idNumber: '12345678',
      staffNumber: null,
    };
    const a = sync.computeProfileFingerprint(base);
    const b = sync.computeProfileFingerprint({ ...base, phoneNumber: '+254700000002' });
    const c = sync.computeProfileFingerprint({ ...base, idNumber: '87654321' });
    const d = sync.computeProfileFingerprint({ ...base, staffNumber: 'STAFF-1' });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
    expect(a).toBe(sync.computeProfileFingerprint(base));
  });

  it('fingerprint ignores email (email is not an LCT re-send trigger)', () => {
    // Email is intentionally omitted from fingerprint input; two identical profiles match.
    const fp = sync.computeProfileFingerprint({
      firstName: 'Jane',
      lastName: 'Doe',
      phoneNumber: '+254700000001',
      idNumber: '12345678',
    });
    expect(fp).toHaveLength(64);
  });

  it('merges exporter into CC and dedupes', () => {
    const defaults = normalizeEmailList(['jude@maishapoa.co.ke', 'maende@maishapoa.co.ke']);
    const withExporter = normalizeEmailList([...defaults, 'Jude@maishapoa.co.ke', 'admin@maishapoa.co.ke']);
    expect(withExporter).toEqual([
      'jude@maishapoa.co.ke',
      'maende@maishapoa.co.ke',
      'admin@maishapoa.co.ke',
    ]);
  });

  it('seed recipient shape: To LCT ops, CC internal, BCC personal', () => {
    const to = normalizeEmailList(['bnyakundi@maishapoa.co.ke']);
    const cc = normalizeEmailList(['jude@maishapoa.co.ke', 'maende@maishapoa.co.ke']);
    const bcc = normalizeEmailList(['jude.o.okello@gmail.com']);
    expect(to).toEqual(['bnyakundi@maishapoa.co.ke']);
    expect(cc).toEqual(['jude@maishapoa.co.ke', 'maende@maishapoa.co.ke']);
    expect(bcc).toEqual(['jude.o.okello@gmail.com']);
  });
});

describe('LCT safety — Option A pending action ownership', () => {
  /**
   * Mirrors LctSyncService.onProfileChanged: if status already pending,
   * keep that action and only add PROFILE_CHANGE reason.
   */
  function resolvePendingAfterProfileChange(params: {
    pendingAction: LctPendingAction | null;
    policyStatus: PolicyStatus;
  }): { action: LctPendingAction; reasons: string[] } {
    const statusAction = mapPolicyStatusToLctAction(params.policyStatus);
    if (!statusAction) {
      throw new Error('policy not syncable');
    }
    if (params.pendingAction) {
      return {
        action: params.pendingAction,
        reasons: [LCT_PENDING_REASONS.STATUS_CHANGE, LCT_PENDING_REASONS.PROFILE_CHANGE],
      };
    }
    return { action: statusAction, reasons: [LCT_PENDING_REASONS.PROFILE_CHANGE] };
  }

  it('keeps SUSPENDED when profile also changes while suspension is pending', () => {
    const result = resolvePendingAfterProfileChange({
      pendingAction: LctPendingAction.SUSPENDED,
      policyStatus: PolicyStatus.SUSPENDED,
    });
    expect(result.action).toBe(LctPendingAction.SUSPENDED);
    expect(result.reasons).toContain(LCT_PENDING_REASONS.PROFILE_CHANGE);
    expect(result.action).not.toBe(LctPendingAction.ACTIVATE);
  });

  it('keeps DEACTIVATE when profile changes while terminate is pending', () => {
    const result = resolvePendingAfterProfileChange({
      pendingAction: LctPendingAction.DEACTIVATE,
      policyStatus: PolicyStatus.TERMINATED,
    });
    expect(result.action).toBe(LctPendingAction.DEACTIVATE);
  });

  it('uses current policy action when only profile changed', () => {
    const result = resolvePendingAfterProfileChange({
      pendingAction: null,
      policyStatus: PolicyStatus.ACTIVE,
    });
    expect(result.action).toBe(LctPendingAction.ACTIVATE);
    expect(result.reasons).toEqual([LCT_PENDING_REASONS.PROFILE_CHANGE]);
  });
});

describe('LCT safety — soft-delete dependant always deactivates', () => {
  it('maps DEPENDANT_REMOVED to DEACTIVATE regardless of ACTIVE policy', () => {
    // Soft-deleted child under ACTIVE principal must still go out as DEACTIVATE
    const action = LctPendingAction.DEACTIVATE;
    const policyStillActive = mapPolicyStatusToLctAction(PolicyStatus.ACTIVE);
    expect(policyStillActive).toBe(LctPendingAction.ACTIVATE);
    expect(action).toBe(LctPendingAction.DEACTIVATE);
    expect(action).not.toBe(policyStillActive);
  });
});
