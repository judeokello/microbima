import { getPolicyStatusDisplay } from '@/lib/policy-display';

describe('getPolicyStatusDisplay', () => {
  it('reuses customer-status colors for shared statuses', () => {
    expect(getPolicyStatusDisplay('ACTIVE')).toEqual({
      label: 'Active',
      className: 'bg-green-50 text-green-700 border-green-200',
    });
    expect(getPolicyStatusDisplay('DEACTIVATED')).toEqual({
      label: 'Deactivated',
      className: 'bg-gray-100 text-gray-700 border-gray-300',
    });
    expect(getPolicyStatusDisplay('TERMINATED')).toEqual({
      label: 'Terminated',
      className: 'bg-red-50 text-red-700 border-red-200',
    });
  });

  it('uses distinct colors for policy-only statuses', () => {
    expect(getPolicyStatusDisplay('INACTIVE')).toEqual({
      label: 'Inactive',
      className: 'bg-purple-50 text-purple-700 border-purple-200',
    });
    expect(getPolicyStatusDisplay('EXPIRED')).toEqual({
      label: 'Expired',
      className: 'bg-orange-50 text-orange-700 border-orange-200',
    });
  });
});
