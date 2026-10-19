import { DependantRelationship, RegistrationEntityKind } from '@prisma/client';
import {
  MISSING_NOK_FIELD_PATH,
  collectDesiredMissingRequirements,
  formatLctIdNumber,
  getMissingRequiredFields,
  isEntityComplete,
  isLctDependantExportEligible,
  relationshipToEntityKind,
} from '../completeness.util';

describe('completeness.util', () => {
  const completeSpouse = {
    firstName: 'Jane',
    lastName: 'Doe',
    idType: 'NATIONAL_ID',
    idNumber: '12345678',
    gender: 'FEMALE',
    dateOfBirth: new Date(Date.UTC(1990, 0, 15)),
  };

  const completeChild = {
    firstName: 'Sam',
    lastName: 'Doe',
    gender: 'MALE',
    dateOfBirth: new Date(Date.UTC(2015, 5, 1)),
  };

  const completeNok = {
    firstName: 'Ann',
    lastName: 'Doe',
    idType: 'NATIONAL_ID',
    idNumber: '87654321',
    phoneNumber: '0712345678',
    gender: 'FEMALE',
    relationship: 'sister',
  };

  const completeParent = {
    firstName: 'Mary',
    lastName: 'Doe',
    relationship: 'MOTHER',
    idType: 'NATIONAL_ID',
    idNumber: '11223344',
    gender: 'FEMALE',
    dateOfBirth: new Date(Date.UTC(1960, 4, 12)),
  };

  it('maps spouse/child relationships to entity kinds', () => {
    expect(relationshipToEntityKind(DependantRelationship.SPOUSE)).toBe(
      RegistrationEntityKind.SPOUSE
    );
    expect(relationshipToEntityKind(DependantRelationship.CHILD)).toBe(
      RegistrationEntityKind.CHILD
    );
    expect(relationshipToEntityKind('OTHER')).toBeNull();
  });

  it('requires spouse name, id type, id number, gender, DOB', () => {
    expect(getMissingRequiredFields(RegistrationEntityKind.SPOUSE, {})).toEqual([
      'firstName',
      'lastName',
      'idType',
      'idNumber',
      'gender',
      'dateOfBirth',
    ]);
    expect(isEntityComplete(RegistrationEntityKind.SPOUSE, completeSpouse)).toBe(true);
    expect(
      getMissingRequiredFields(RegistrationEntityKind.SPOUSE, {
        ...completeSpouse,
        idType: '  ',
        idNumber: '  ',
        dateOfBirth: null,
      })
    ).toEqual(['idType', 'idNumber', 'dateOfBirth']);
  });

  it('requires child first/last, DOB, gender (not ID)', () => {
    expect(getMissingRequiredFields(RegistrationEntityKind.CHILD, {})).toEqual([
      'firstName',
      'lastName',
      'dateOfBirth',
      'gender',
    ]);
    expect(isEntityComplete(RegistrationEntityKind.CHILD, completeChild)).toBe(true);
    expect(
      isEntityComplete(RegistrationEntityKind.CHILD, {
        ...completeChild,
        idNumber: null,
      })
    ).toBe(true);
  });

  it('requires NOK name, id, phone, gender, relationship', () => {
    expect(getMissingRequiredFields(RegistrationEntityKind.BENEFICIARY, {})).toEqual([
      'firstName',
      'lastName',
      'idType',
      'idNumber',
      'phoneNumber',
      'gender',
      'relationship',
    ]);
    expect(isEntityComplete(RegistrationEntityKind.BENEFICIARY, completeNok)).toBe(true);
  });

  it('requires parent name, relationship, id, gender, DOB', () => {
    expect(getMissingRequiredFields(RegistrationEntityKind.PARENT, {})).toEqual([
      'firstName',
      'lastName',
      'relationship',
      'idType',
      'idNumber',
      'gender',
      'dateOfBirth',
    ]);
    expect(isEntityComplete(RegistrationEntityKind.PARENT, completeParent)).toBe(true);
  });

  it('does not treat principal customer fields as deferred MRs', () => {
    expect(getMissingRequiredFields(RegistrationEntityKind.CUSTOMER, {})).toEqual([]);
  });

  it('leaves LCT spouse eligible when only idType is missing', () => {
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
      isLctDependantExportEligible('SPOUSE', {
        firstName: 'A',
        lastName: 'B',
        idNumber: '',
        gender: 'FEMALE',
        dateOfBirth: new Date(),
      })
    ).toBe(false);
    expect(isLctDependantExportEligible('CHILD', completeChild)).toBe(true);
    expect(
      isLctDependantExportEligible('CHILD', { ...completeChild, firstName: '' })
    ).toBe(false);
  });

  it('emits a missing-NOK placeholder when no beneficiary rows exist', () => {
    expect(
      collectDesiredMissingRequirements({
        spouses: [],
        children: [],
        beneficiaries: [],
        parents: [],
      })
    ).toEqual([
      {
        entityKind: RegistrationEntityKind.BENEFICIARY,
        entityId: null,
        fieldPath: MISSING_NOK_FIELD_PATH,
      },
    ]);
  });

  it('replaces the missing-NOK placeholder with field MRs once a NOK exists', () => {
    const desired = collectDesiredMissingRequirements({
      spouses: [],
      children: [],
      beneficiaries: [{ id: 'nok-1', firstName: 'Ann', lastName: 'Doe' }],
      parents: [],
    });
    expect(desired.some((d) => d.fieldPath === MISSING_NOK_FIELD_PATH)).toBe(false);
    expect(desired).toEqual(
      expect.arrayContaining([
        {
          entityKind: RegistrationEntityKind.BENEFICIARY,
          entityId: 'nok-1',
          fieldPath: 'idType',
        },
        {
          entityKind: RegistrationEntityKind.BENEFICIARY,
          entityId: 'nok-1',
          fieldPath: 'idNumber',
        },
        {
          entityKind: RegistrationEntityKind.BENEFICIARY,
          entityId: 'nok-1',
          fieldPath: 'phoneNumber',
        },
      ])
    );
  });

  it('collects parent and spouse gaps together', () => {
    const desired = collectDesiredMissingRequirements({
      spouses: [{ id: 'sp-1', firstName: 'Jane', lastName: 'Doe', idNumber: '1' }],
      children: [],
      beneficiaries: [{ id: 'nok-1', ...completeNok }],
      parents: [{ id: 'par-1', firstName: 'Mary', lastName: 'Doe' }],
    });
    expect(desired).toEqual(
      expect.arrayContaining([
        {
          entityKind: RegistrationEntityKind.SPOUSE,
          entityId: 'sp-1',
          fieldPath: 'idType',
        },
        {
          entityKind: RegistrationEntityKind.PARENT,
          entityId: 'par-1',
          fieldPath: 'idNumber',
        },
      ])
    );
  });

  it('formats blank IDs as N/A', () => {
    expect(formatLctIdNumber('12345678')).toBe('12345678');
    expect(formatLctIdNumber('')).toBe('N/A');
    expect(formatLctIdNumber(null)).toBe('N/A');
    expect(formatLctIdNumber('   ')).toBe('N/A');
  });
});
