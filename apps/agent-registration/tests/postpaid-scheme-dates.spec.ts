import {
  computeNominalHorizonFromToday,
  derivePostpaidSchemeDateLabels,
  policyEndDateFromStart,
  resolvePostpaidMemberPolicyDates,
} from '../src/lib/insurance-installment';

describe('postpaid scheme date labels (agent-registration)', () => {
  it('policyEndDateFromStart is start + 1y − 1d UTC', () => {
    expect(policyEndDateFromStart(new Date(Date.UTC(2026, 6, 7))).toISOString()).toBe(
      '2027-07-06T00:00:00.000Z'
    );
  });

  it('computeNominalHorizonFromToday uses (count−1)×cadence', () => {
    expect(
      computeNominalHorizonFromToday(39, 7, new Date(Date.UTC(2026, 6, 7))).toISOString()
    ).toBe('2027-03-30T00:00:00.000Z');
  });

  it('derivePostpaidSchemeDateLabels returns both dates', () => {
    const labels = derivePostpaidSchemeDateLabels({
      startDateYmd: '2026-07-07',
      installmentCount: 39,
      paymentCadence: 7,
    });
    expect(labels?.endDate.toISOString()).toBe('2027-07-06T00:00:00.000Z');
    expect(labels?.nominalPaymentPeriodEndDate.toISOString()).toBe(
      '2027-03-30T00:00:00.000Z'
    );
  });

  it('derivePostpaidSchemeDateLabels returns null without installment config (hide nominal)', () => {
    expect(
      derivePostpaidSchemeDateLabels({
        startDateYmd: '2026-07-07',
        installmentCount: 0,
        paymentCadence: 7,
      })
    ).toBeNull();
  });
});

describe('resolvePostpaidMemberPolicyDates (agent-registration)', () => {
  const schemeStart = new Date(Date.UTC(2026, 6, 7));
  const schemeEnd = new Date(Date.UTC(2027, 6, 6));
  const schemeNominal = new Date(Date.UTC(2027, 2, 30));

  it('returns null when scheme has no start (legacy)', () => {
    expect(
      resolvePostpaidMemberPolicyDates({
        schemeStartDate: null,
        schemeEndDate: schemeEnd,
        schemeNominalPaymentPeriodEndDate: schemeNominal,
        memberJoinedAt: new Date(Date.UTC(2026, 6, 10)),
      })
    ).toBeNull();
  });

  it('uses scheme start when joined on or before scheme start', () => {
    const r = resolvePostpaidMemberPolicyDates({
      schemeStartDate: schemeStart,
      schemeEndDate: schemeEnd,
      schemeNominalPaymentPeriodEndDate: schemeNominal,
      memberJoinedAt: new Date(Date.UTC(2026, 6, 2)),
    });
    expect(r?.startDate.toISOString()).toBe('2026-07-07T00:00:00.000Z');
    expect(r?.endDate.toISOString()).toBe('2027-07-06T00:00:00.000Z');
    expect(r?.nominalPaymentPeriodEndDate?.toISOString()).toBe(
      '2027-03-30T00:00:00.000Z'
    );
  });

  it('uses join day when joined after scheme start; inherits scheme end/nominal', () => {
    const r = resolvePostpaidMemberPolicyDates({
      schemeStartDate: schemeStart,
      schemeEndDate: schemeEnd,
      schemeNominalPaymentPeriodEndDate: schemeNominal,
      memberJoinedAt: new Date(Date.UTC(2026, 6, 29, 15, 0, 0)),
    });
    expect(r?.startDate.toISOString()).toBe('2026-07-29T00:00:00.000Z');
    expect(r?.endDate.toISOString()).toBe('2027-07-06T00:00:00.000Z');
    expect(r?.nominalPaymentPeriodEndDate?.toISOString()).toBe(
      '2027-03-30T00:00:00.000Z'
    );
  });
});
