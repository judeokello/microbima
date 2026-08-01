import { LctPendingAction, PolicyStatus } from '@prisma/client';
import {
  buildLctExportSubject,
  formatLctDob,
  formatLctGender,
  mapPolicyStatusToLctAction,
  normalizeEmailList,
  shouldEnqueueStatusChange,
} from '../lct.types';
import { buildLctCsv, intentToCsvRow } from '../lct-csv.builder';
import type { LctMemberSyncIntent } from '../lct.types';

describe('LCT action mapping', () => {
  it('maps policy statuses to CSV actions', () => {
    expect(mapPolicyStatusToLctAction(PolicyStatus.ACTIVE)).toBe(LctPendingAction.ACTIVATE);
    expect(mapPolicyStatusToLctAction(PolicyStatus.SUSPENDED)).toBe(LctPendingAction.SUSPENDED);
    expect(mapPolicyStatusToLctAction(PolicyStatus.INACTIVE)).toBe(LctPendingAction.DEACTIVATE);
    expect(mapPolicyStatusToLctAction(PolicyStatus.DEACTIVATED)).toBe(LctPendingAction.DEACTIVATE);
    expect(mapPolicyStatusToLctAction(PolicyStatus.TERMINATED)).toBe(LctPendingAction.DEACTIVATE);
    expect(mapPolicyStatusToLctAction(PolicyStatus.EXPIRED)).toBe(LctPendingAction.DEACTIVATE);
    expect(mapPolicyStatusToLctAction(PolicyStatus.PENDING_ACTIVATION)).toBeNull();
  });

  it('queues ACTIVE and SUSPENDED transitions', () => {
    expect(shouldEnqueueStatusChange('PENDING_ACTIVATION', 'ACTIVE')).toBe(true);
    expect(shouldEnqueueStatusChange('SUSPENDED', 'ACTIVE')).toBe(true);
    expect(shouldEnqueueStatusChange('ACTIVE', 'SUSPENDED')).toBe(true);
    expect(shouldEnqueueStatusChange('ACTIVE', 'TERMINATED')).toBe(true);
  });

  it('does not queue non-active → non-active (e.g. SUSPENDED → TERMINATED)', () => {
    expect(shouldEnqueueStatusChange('SUSPENDED', 'TERMINATED')).toBe(false);
    expect(shouldEnqueueStatusChange('INACTIVE', 'TERMINATED')).toBe(false);
    expect(shouldEnqueueStatusChange('PENDING_ACTIVATION', 'PENDING_ACTIVATION')).toBe(false);
    expect(shouldEnqueueStatusChange('ACTIVE', 'ACTIVE')).toBe(false);
  });
});

describe('LCT CSV builder', () => {
  const sampleIntent = (overrides: Partial<LctMemberSyncIntent> = {}): LctMemberSyncIntent => ({
    memberNumber: 'MP00100',
    action: LctPendingAction.ACTIVATE,
    policyId: 'p1',
    customerId: 'c1',
    dependantId: null,
    subjectType: 'PRINCIPAL',
    reasons: ['NEW'],
    employeeName: 'Jane Doe',
    staffNumber: 'S-1',
    memberName: 'Jane Doe',
    gender: 'Female',
    dateOfBirth: '15-01-1990',
    relationship: 'PRINCIPAL',
    email: 'jane@example.com',
    phoneNumber: '+254700000000',
    idNumber: '12345678',
    principalMemberNumber: '',
    schemeName: 'Maisha Poa General',
    policyStartDate: '01-01-2026',
    policyEndDate: '31-12-2026',
    ...overrides,
  });

  it('emits locked headers and ACTIVATE|DEACTIVATE|SUSPENDED actions', () => {
    const { csv, rowCount, rows } = buildLctCsv([
      sampleIntent(),
      sampleIntent({
        memberNumber: 'MP00101',
        action: LctPendingAction.SUSPENDED,
        subjectType: 'DEPENDANT',
        relationship: 'SPOUSE',
        principalMemberNumber: 'MP00100',
        memberName: 'John Doe',
      }),
      sampleIntent({
        memberNumber: 'MP00102',
        action: LctPendingAction.DEACTIVATE,
        subjectType: 'DEPENDANT',
        relationship: 'CHILD',
        principalMemberNumber: 'MP00100',
      }),
    ]);

    expect(rowCount).toBe(3);
    expect(csv.split('\n')[0]).toContain('REQUIRED ACTION');
    expect(csv.split('\n')[0]).toContain('SCHEME NAME');
    expect(csv.split('\n')[0]).toContain('START DATE');
    expect(csv.split('\n')[0]).toContain('END DATE');
    expect(csv).toContain('ACTIVATE');
    expect(csv).toContain('SUSPENDED');
    expect(csv).toContain('DEACTIVATE');
    expect(rows[0]['PRINCIPAL MEMBER NUMBER']).toBe('');
    expect(rows[1]['PRINCIPAL MEMBER NUMBER']).toBe('MP00100');
    expect(intentToCsvRow(sampleIntent())['STAFF NUMBER']).toBe('S-1');
    expect(rows[0]['SCHEME NAME']).toBe('Maisha Poa General');
    expect(rows[0]['START DATE']).toBe('01-01-2026');
    expect(rows[0]['END DATE']).toBe('31-12-2026');
  });

  it('formats gender and DOB helpers', () => {
    expect(formatLctGender('MALE')).toBe('Male');
    expect(formatLctGender('FEMALE')).toBe('Female');
    expect(formatLctGender('OTHER')).toBe('');
    expect(formatLctDob(new Date(Date.UTC(1990, 0, 15)))).toBe('15-01-1990');
  });

  it('normalizes email lists', () => {
    expect(normalizeEmailList(['  A@B.com ', 'a@b.com', '', 'c@d.com'])).toEqual([
      'a@b.com',
      'c@d.com',
    ]);
  });

  it('builds locked subject prefix', () => {
    expect(buildLctExportSubject(new Date('2026-07-28T12:00:00Z'))).toMatch(
      /^Maisha Poa Customer Export - /
    );
  });
});
