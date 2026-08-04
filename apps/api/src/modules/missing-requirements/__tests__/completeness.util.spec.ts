import { DependantRelationship, RegistrationEntityKind } from '@prisma/client';
import {
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

  it('maps spouse/child relationships to entity kinds', () => {
    expect(relationshipToEntityKind(DependantRelationship.SPOUSE)).toBe(
      RegistrationEntityKind.SPOUSE
    );
    expect(relationshipToEntityKind(DependantRelationship.CHILD)).toBe(
      RegistrationEntityKind.CHILD
    );
    expect(relationshipToEntityKind('OTHER')).toBeNull();
  });

  it('requires spouse first/last, id, gender, DOB', () => {
    expect(getMissingRequiredFields(RegistrationEntityKind.SPOUSE, {})).toEqual([
      'firstName',
      'lastName',
      'idNumber',
      'gender',
      'dateOfBirth',
    ]);
    expect(isEntityComplete(RegistrationEntityKind.SPOUSE, completeSpouse)).toBe(true);
    expect(
      getMissingRequiredFields(RegistrationEntityKind.SPOUSE, {
        ...completeSpouse,
        idNumber: '  ',
        dateOfBirth: null,
      })
    ).toEqual(['idNumber', 'dateOfBirth']);
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

  it('keeps beneficiary id fields for care-ops', () => {
    expect(getMissingRequiredFields(RegistrationEntityKind.BENEFICIARY, {})).toEqual([
      'firstName',
      'lastName',
      'idType',
      'idNumber',
    ]);
  });

  it('marks LCT export eligibility for spouse/child only when complete', () => {
    expect(isLctDependantExportEligible('SPOUSE', completeSpouse)).toBe(true);
    expect(
      isLctDependantExportEligible('SPOUSE', { ...completeSpouse, gender: null })
    ).toBe(false);
    expect(isLctDependantExportEligible('CHILD', completeChild)).toBe(true);
    expect(
      isLctDependantExportEligible('CHILD', { ...completeChild, firstName: '' })
    ).toBe(false);
  });

  it('formats blank IDs as N/A', () => {
    expect(formatLctIdNumber('12345678')).toBe('12345678');
    expect(formatLctIdNumber('')).toBe('N/A');
    expect(formatLctIdNumber(null)).toBe('N/A');
    expect(formatLctIdNumber('   ')).toBe('N/A');
  });
});
