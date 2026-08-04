import { LctPendingAction, PolicyStatus } from '@prisma/client';
import {
  buildLctExportSubject,
  formatLctDob,
  formatLctGender,
  formatLctPhone,
  mapPolicyStatusToLctAction,
  normalizeEmailList,
  shouldEnqueueStatusChange,
  sortLctExportIntents,
  toTitleCase,
} from '../lct.types';
import { buildLctCsv, intentToCsvRow } from '../lct-csv.builder';
import type { LctMemberSyncIntent } from '../lct.types';
import { formatLctIdNumber, isLctDependantExportEligible } from '../../missing-requirements/completeness.util';

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
    phoneNumber: '254700000000',
    idNumber: '12345678',
    principalMemberNumber: 'MP00100',
    schemeName: 'Maisha Poa General',
    policyStartDate: '01-01-2026',
    policyEndDate: '31-12-2026',
    productName: 'Maisha Poa',
    planName: 'Gold',
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

    const header = csv.split('\n')[0];
    expect(rowCount).toBe(3);
    expect(header).toContain('REQUIRED ACTION');
    expect(header).toContain('SCHEME NAME');
    expect(header).toContain('START DATE');
    expect(header).toContain('END DATE');
    expect(header.endsWith('PRODUCT,PLAN')).toBe(true);
    expect(csv).toContain('ACTIVATE');
    expect(csv).toContain('SUSPENDED');
    expect(csv).toContain('DEACTIVATE');
    expect(rows[0]['PRINCIPAL MEMBER NUMBER']).toBe('MP00100');
    expect(rows[1]['PRINCIPAL MEMBER NUMBER']).toBe('MP00100');
    expect(intentToCsvRow(sampleIntent())['STAFF NUMBER']).toBe('S-1');
    expect(rows[0]['SCHEME NAME']).toBe('Maisha Poa General');
    expect(rows[0]['START DATE']).toBe('01-01-2026');
    expect(rows[0]['END DATE']).toBe('31-12-2026');
    expect(rows[0].PRODUCT).toBe('Maisha Poa');
    expect(rows[0].PLAN).toBe('Gold');
  });

  it('title-cases PLAN and normalizes phone without +', () => {
    expect(toTitleCase('gold')).toBe('Gold');
    expect(toTitleCase('SILVER PLAN')).toBe('Silver Plan');
    expect(formatLctPhone('0722000000')).toBe('254722000000');
    expect(formatLctPhone('+254722000000')).toBe('254722000000');
    expect(formatLctPhone('')).toBe('');
    expect(formatLctPhone('not-a-phone')).toBe('');
  });

  it('formats blank IDs as N/A and gates incomplete dependants', () => {
    expect(formatLctIdNumber('')).toBe('N/A');
    expect(formatLctIdNumber('12345678')).toBe('12345678');
    expect(
      isLctDependantExportEligible('SPOUSE', {
        firstName: 'A',
        lastName: 'B',
        idNumber: '1',
        gender: 'FEMALE',
        dateOfBirth: new Date(),
      })
    ).toBe(true);
    expect(
      isLctDependantExportEligible('CHILD', {
        firstName: 'A',
        lastName: 'B',
        dateOfBirth: new Date(),
      })
    ).toBe(false);
  });

  it('sorts export intents Principal → Spouse → Children by family', () => {
    const mixed = [
      { intent: sampleIntent({ policyId: 'p2', memberNumber: 'B-00', relationship: 'PRINCIPAL' }) },
      {
        intent: sampleIntent({
          policyId: 'p1',
          memberNumber: 'A-02',
          subjectType: 'DEPENDANT',
          relationship: 'CHILD',
          principalMemberNumber: 'A-00',
        }),
      },
      {
        intent: sampleIntent({
          policyId: 'p1',
          memberNumber: 'A-01',
          subjectType: 'DEPENDANT',
          relationship: 'SPOUSE',
          principalMemberNumber: 'A-00',
        }),
      },
      { intent: sampleIntent({ policyId: 'p1', memberNumber: 'A-00', relationship: 'PRINCIPAL' }) },
      {
        intent: sampleIntent({
          policyId: 'p1',
          memberNumber: 'A-03',
          subjectType: 'DEPENDANT',
          relationship: 'CHILD',
          principalMemberNumber: 'A-00',
        }),
      },
    ];

    const sorted = sortLctExportIntents(mixed).map((x) => x.intent.memberNumber);
    expect(sorted).toEqual(['A-00', 'A-01', 'A-02', 'A-03', 'B-00']);
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
