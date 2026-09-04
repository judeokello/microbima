/// <reference types="jest" />
import { matchExistingPerson } from '../src/lib/person-duplicate';

const jane = {
  id: 'b1',
  firstName: 'Jane',
  lastName: 'Doe',
  idNumber: '12345678',
  phoneNumber: '254712345678',
};

describe('matchExistingPerson', () => {
  it('auto-picks when names and ID match', () => {
    expect(
      matchExistingPerson({ firstName: 'jane', lastName: 'DOE', idNumber: '12345678' }, [jane])
    ).toEqual({ kind: 'auto', person: jane });
  });

  it('forces confirm when names match and both ID and phone are empty', () => {
    const existing = { id: 'b3', firstName: 'Pat', lastName: 'Okello' };
    expect(matchExistingPerson({ firstName: 'Pat', lastName: 'Okello' }, [existing])).toEqual({
      kind: 'confirm',
      candidates: [existing],
    });
  });
});
