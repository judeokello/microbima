import { DependantRelationship, ParentRelationship } from '@prisma/client';
import {
  isFirstProductEnrolment,
  planCanonicalHouseholdMemberNumbers,
} from '../first-product-enrolment.util';

describe('isFirstProductEnrolment', () => {
  const createdAt = new Date('2026-09-01T10:00:00.000Z');

  it('treats the only policy as first product', () => {
    expect(
      isFirstProductEnrolment({
        packageId: 6,
        createdAt,
        otherPolicies: [],
      })
    ).toBe(true);
  });

  it('treats a later policy on the same package as first product (replacement)', () => {
    expect(
      isFirstProductEnrolment({
        packageId: 1,
        createdAt,
        otherPolicies: [
          {
            packageId: 1,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      })
    ).toBe(true);
  });

  it('treats a later other-package policy as additional product', () => {
    expect(
      isFirstProductEnrolment({
        packageId: 6,
        createdAt,
        otherPolicies: [
          {
            packageId: 1,
            createdAt: new Date('2026-08-01T00:00:00.000Z'),
          },
        ],
      })
    ).toBe(false);
  });

  it('ignores other-package policies created after this one', () => {
    expect(
      isFirstProductEnrolment({
        packageId: 1,
        createdAt,
        otherPolicies: [
          {
            packageId: 6,
            createdAt: new Date('2026-09-08T00:00:00.000Z'),
          },
        ],
      })
    ).toBe(true);
  });
});

describe('planCanonicalHouseholdMemberNumbers', () => {
  it('numbers spouses then children then parents, reissuing a parent that already holds 01', () => {
    const plan = planCanonicalHouseholdMemberNumbers({
      principalMemberNumber: 'MFGBL002-00',
      liveDependants: [
        {
          id: 'child-1',
          relationship: DependantRelationship.CHILD,
          createdAt: new Date('2026-09-08T10:02:00.000Z'),
          currentMemberNumber: null,
        },
        {
          id: 'spouse-1',
          relationship: DependantRelationship.SPOUSE,
          createdAt: new Date('2026-09-08T10:01:00.000Z'),
          currentMemberNumber: null,
        },
        {
          id: 'child-2',
          relationship: DependantRelationship.CHILD,
          createdAt: new Date('2026-09-08T10:03:00.000Z'),
          currentMemberNumber: null,
        },
      ],
      liveParents: [
        {
          id: 'mother-1',
          relationship: ParentRelationship.MOTHER,
          createdAt: new Date('2026-09-08T10:00:00.000Z'),
          currentMemberNumber: 'MFGBL002-01',
        },
      ],
      includeParents: true,
    });

    expect(plan.dependants.map((row) => [row.id, row.memberNumber])).toEqual([
      ['spouse-1', 'MFGBL002-01'],
      ['child-1', 'MFGBL002-02'],
      ['child-2', 'MFGBL002-03'],
    ]);
    expect(plan.parents).toEqual([
      expect.objectContaining({
        id: 'mother-1',
        memberNumber: 'MFGBL002-04',
        currentMemberNumber: 'MFGBL002-01',
      }),
    ]);
    expect(plan.needsRepair).toBe(true);
  });

  it('skips parents when the package does not support them', () => {
    const plan = planCanonicalHouseholdMemberNumbers({
      principalMemberNumber: 'MFG300-00',
      liveDependants: [
        {
          id: 'child-1',
          relationship: DependantRelationship.CHILD,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          currentMemberNumber: null,
        },
      ],
      liveParents: [
        {
          id: 'mother-1',
          relationship: ParentRelationship.MOTHER,
          currentMemberNumber: null,
        },
      ],
      includeParents: false,
    });

    expect(plan.parents).toEqual([]);
    expect(plan.dependants[0].memberNumber).toBe('MFG300-01');
  });

  it('is idempotent when numbers already match canonical order', () => {
    const plan = planCanonicalHouseholdMemberNumbers({
      principalMemberNumber: 'MFG291-00',
      liveDependants: [
        {
          id: 'spouse-1',
          relationship: DependantRelationship.SPOUSE,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          currentMemberNumber: 'MFG291-01',
        },
      ],
      liveParents: [],
      includeParents: true,
    });

    expect(plan.needsRepair).toBe(false);
  });
});
