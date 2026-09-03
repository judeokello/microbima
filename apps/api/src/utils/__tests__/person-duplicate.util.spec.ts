import { matchExistingPerson } from '../person-duplicate.util';

const jane = {
  id: 'b1',
  firstName: 'Jane',
  lastName: 'Doe',
  idNumber: '12345678',
  phoneNumber: '254712345678',
};

describe('matchExistingPerson', () => {
  it('auto-picks when names and ID match', () => {
    const result = matchExistingPerson(
      { firstName: 'jane', lastName: 'DOE', idNumber: '12345678' },
      [jane]
    );
    expect(result).toEqual({ kind: 'auto', person: jane });
  });

  it('treats same names with different IDs as different people', () => {
    const result = matchExistingPerson(
      { firstName: 'Jane', lastName: 'Doe', idNumber: '99999999' },
      [jane]
    );
    expect(result).toEqual({ kind: 'none' });
  });

  it('auto-picks when names and phone match and IDs are empty', () => {
    const existing = { id: 'b2', firstName: 'Sam', lastName: 'Lee', phoneNumber: '254700000000' };
    const result = matchExistingPerson(
      { firstName: 'Sam', lastName: 'Lee', phoneNumber: '254700000000' },
      [existing]
    );
    expect(result).toEqual({ kind: 'auto', person: existing });
  });

  it('forces confirm when names match and both ID and phone are empty', () => {
    const existing = { id: 'b3', firstName: 'Pat', lastName: 'Okello' };
    const result = matchExistingPerson({ firstName: 'Pat', lastName: 'Okello' }, [existing]);
    expect(result).toEqual({ kind: 'confirm', candidates: [existing] });
  });
});
