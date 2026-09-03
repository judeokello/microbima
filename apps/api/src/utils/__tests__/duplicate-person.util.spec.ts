/// <reference types="jest" />
import { matchDuplicatePerson } from '../duplicate-person.util';

describe('matchDuplicatePerson', () => {
  const jane = {
    id: 'dep-1',
    firstName: 'Jane',
    lastName: 'Doe',
    idNumber: '12345678',
    phoneNumber: '254700000001',
  };

  it('matches same person by case-insensitive names and idNumber', () => {
    expect(
      matchDuplicatePerson(
        { firstName: 'JANE', lastName: 'doe', idNumber: '12345678' },
        [jane]
      )
    ).toEqual({ kind: 'same_person', existing: jane });
  });

  it('matches same person by names and phone when ids are missing', () => {
    expect(
      matchDuplicatePerson(
        { firstName: 'Jane', lastName: 'Doe', phoneNumber: '254700000001' },
        [{ ...jane, idNumber: null }]
      )
    ).toEqual({ kind: 'same_person', existing: { ...jane, idNumber: null } });
  });

  it('treats same names with different IDs as different people', () => {
    expect(
      matchDuplicatePerson(
        { firstName: 'Jane', lastName: 'Doe', idNumber: '99999999' },
        [jane]
      )
    ).toEqual({ kind: 'distinct' });
  });

  it('is ambiguous when names match and both ID and phone are empty', () => {
    const unnamed = { id: 'dep-2', firstName: 'Pat', lastName: 'Kim', idNumber: null, phoneNumber: null };
    expect(
      matchDuplicatePerson({ firstName: 'Pat', lastName: 'Kim' }, [unnamed])
    ).toEqual({ kind: 'ambiguous', existing: unnamed });
  });

  it('is distinct when names differ', () => {
    expect(
      matchDuplicatePerson({ firstName: 'John', lastName: 'Doe', idNumber: '12345678' }, [jane])
    ).toEqual({ kind: 'distinct' });
  });
});
