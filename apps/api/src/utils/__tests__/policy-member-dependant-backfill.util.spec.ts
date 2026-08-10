import { DependantRelationship } from '@prisma/client';
import {
  memberNumberFromPrincipal,
  orderDependantsForMemberNumberBackfill,
  planMissingPolicyMemberDependants,
} from '../policy-member-dependant-backfill.util';

describe('policy-member-dependant-backfill.util', () => {
  describe('memberNumberFromPrincipal', () => {
    it('derives dependant numbers from principal (Sharon MFG290)', () => {
      expect(memberNumberFromPrincipal('MFG290-00', 1)).toBe('MFG290-01');
      expect(memberNumberFromPrincipal('MFG269-00', 5)).toBe('MFG269-05');
    });

    it('continues after existing PMD count (Joseph MFG192-01 present)', () => {
      expect(memberNumberFromPrincipal('MFG192-00', 2)).toBe('MFG192-02');
      expect(memberNumberFromPrincipal('MFG192-00', 4)).toBe('MFG192-04');
    });

    it('rejects invalid principal format or sequence', () => {
      expect(() => memberNumberFromPrincipal('MFG290', 1)).toThrow(/Unexpected principal/);
      expect(() => memberNumberFromPrincipal('MFG290-00', 0)).toThrow(/positive integer/);
    });
  });

  describe('orderDependantsForMemberNumberBackfill', () => {
    it('orders spouse before children, then by createdAt', () => {
      const t0 = new Date('2026-07-21T12:35:00Z');
      const t1 = new Date('2026-07-21T12:36:00Z');
      const t2 = new Date('2026-07-21T12:37:00Z');
      const ordered = orderDependantsForMemberNumberBackfill([
        { id: 'c2', relationship: DependantRelationship.CHILD, createdAt: t2 },
        { id: 'c1', relationship: DependantRelationship.CHILD, createdAt: t1 },
        { id: 's', relationship: DependantRelationship.SPOUSE, createdAt: t0 },
      ]);
      expect(ordered.map((d) => d.id)).toEqual(['s', 'c1', 'c2']);
    });
  });

  describe('planMissingPolicyMemberDependants', () => {
    it('plans Sharon-style single missing child as -01', () => {
      const rows = planMissingPolicyMemberDependants({
        policyId: 'pol-sharon',
        policyNumber: 'MP/MFG/290',
        principalMemberNumber: 'MFG290-00',
        existingDependantIds: [],
        missingDependants: [
          {
            id: 'kailani',
            relationship: DependantRelationship.CHILD,
            createdAt: new Date('2026-07-31T07:35:03Z'),
            firstName: 'Kailani',
            lastName: 'Chepkoech',
          },
        ],
      });
      expect(rows).toEqual([
        expect.objectContaining({
          dependantId: 'kailani',
          memberNumber: 'MFG290-01',
          sequence: 1,
        }),
      ]);
    });

    it('plans Polycarp-style spouse then children from -01', () => {
      const rows = planMissingPolicyMemberDependants({
        policyId: 'pol-poly',
        policyNumber: 'MP/MFG/269',
        principalMemberNumber: 'MFG269-00',
        existingDependantIds: [],
        missingDependants: [
          {
            id: 'child-b',
            relationship: DependantRelationship.CHILD,
            createdAt: new Date('2026-07-21T12:37:00Z'),
            firstName: 'Prudence',
            lastName: 'Ichitah',
          },
          {
            id: 'spouse',
            relationship: DependantRelationship.SPOUSE,
            createdAt: new Date('2026-07-21T12:35:00Z'),
            firstName: 'Emily',
            lastName: 'Matioli',
          },
          {
            id: 'child-a',
            relationship: DependantRelationship.CHILD,
            createdAt: new Date('2026-07-21T12:36:00Z'),
            firstName: 'Sharleen',
            lastName: 'Anzenze',
          },
        ],
      });
      expect(rows.map((r) => r.memberNumber)).toEqual([
        'MFG269-01',
        'MFG269-02',
        'MFG269-03',
      ]);
      expect(rows.map((r) => r.dependantId)).toEqual(['spouse', 'child-a', 'child-b']);
    });

    it('plans Joseph-style continuation after existing -01', () => {
      const rows = planMissingPolicyMemberDependants({
        policyId: 'pol-joseph',
        policyNumber: 'MP/MFG/192',
        principalMemberNumber: 'MFG192-00',
        existingDependantIds: ['already-01'],
        missingDependants: [
          {
            id: 'simon',
            relationship: DependantRelationship.CHILD,
            createdAt: new Date('2026-07-03T09:55:00Z'),
            firstName: 'Simon',
            lastName: 'Ndungu',
          },
          {
            id: 'brian',
            relationship: DependantRelationship.CHILD,
            createdAt: new Date('2026-07-03T09:56:00Z'),
            firstName: 'Brian',
            lastName: 'Njoka',
          },
        ],
      });
      expect(rows.map((r) => r.memberNumber)).toEqual(['MFG192-02', 'MFG192-03']);
    });

    it('returns empty when nothing missing', () => {
      expect(
        planMissingPolicyMemberDependants({
          policyId: 'p',
          policyNumber: null,
          principalMemberNumber: 'MFG1-00',
          existingDependantIds: ['x'],
          missingDependants: [],
        })
      ).toEqual([]);
    });
  });
});
