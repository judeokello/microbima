import { serializeCampaignCsv } from '../campaign-csv';

describe('serializeCampaignCsv', () => {
  it('includes name, phone/email, customerId, error columns (FR-028)', () => {
    const csv = serializeCampaignCsv([
      {
        customerName: 'Jane Doe',
        phone: '254700000001',
        email: null,
        customerId: 'uuid-1',
        error: 'Missing placeholder: policy_number',
      },
      {
        customerName: 'Bob',
        phone: null,
        email: 'bob@ex.com',
        customerId: null,
        error: 'Missing email',
      },
    ]);
    expect(csv.startsWith('customerName,phone,email,customerId,error')).toBe(true);
    expect(csv).toContain('Jane Doe');
    expect(csv).toContain('254700000001');
    expect(csv).toContain('uuid-1');
    expect(csv).toContain('Missing placeholder: policy_number');
    expect(csv).toContain('bob@ex.com');
  });

  it('escapes quotes in fields', () => {
    const csv = serializeCampaignCsv([
      {
        customerName: 'Ann "A"',
        phone: null,
        email: null,
        customerId: null,
        error: 'said "oops"',
      },
    ]);
    expect(csv).toContain('"Ann ""A"""');
    expect(csv).toContain('"said ""oops"""');
  });
});
