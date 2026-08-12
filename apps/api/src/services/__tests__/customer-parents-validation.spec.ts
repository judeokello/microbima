/// <reference types="jest" />
import { ParentRelationship } from '@prisma/client';
import { ValidationException } from '../../exceptions/validation.exception';

/**
 * Mirrors CustomerService.validateParentsPayload rules for unit coverage
 * without constructing the full Nest service graph.
 */
function validateParentsPayload(
  parents: Array<{ relationship: ParentRelationship; firstName?: string; lastName?: string; dateOfBirth?: string; gender?: string; idType?: string; idNumber?: string }>
): void {
  const validationErrors: Record<string, string> = {};
  if (parents.length > 4) {
    validationErrors['parents'] = 'A maximum of 4 parents is allowed';
  }
  const counts = new Map<ParentRelationship, number>();
  for (const parent of parents) {
    const next = (counts.get(parent.relationship) ?? 0) + 1;
    counts.set(parent.relationship, next);
    if (next > 2) {
      validationErrors['parents.relationship'] =
        `Relationship ${parent.relationship} cannot be used more than twice`;
    }
    if (!parent.firstName?.trim()) {
      validationErrors['parents.firstName'] = 'Parent first name is required';
    }
    if (!parent.lastName?.trim()) {
      validationErrors['parents.lastName'] = 'Parent last name is required';
    }
    if (!parent.dateOfBirth) {
      validationErrors['parents.dateOfBirth'] = 'Parent date of birth is required';
    }
    if (!parent.gender) {
      validationErrors['parents.gender'] = 'Parent gender is required';
    }
    if (!parent.idType || !parent.idNumber?.trim()) {
      validationErrors['parents.idNumber'] = 'Parent ID type and number are required';
    }
  }
  if (Object.keys(validationErrors).length > 0) {
    throw ValidationException.withMultipleErrors(validationErrors);
  }
}

describe('parents payload validation', () => {
  const base = {
    firstName: 'Jane',
    lastName: 'Doe',
    dateOfBirth: '1960-01-01',
    gender: 'female',
    idType: 'national',
    idNumber: '12345678',
  };

  it('allows up to 4 parents with distinct relationships', () => {
    expect(() =>
      validateParentsPayload([
        { ...base, relationship: ParentRelationship.MOTHER },
        { ...base, relationship: ParentRelationship.FATHER },
        { ...base, relationship: ParentRelationship.MOTHER_IN_LAW },
        { ...base, relationship: ParentRelationship.FATHER_IN_LAW },
      ])
    ).not.toThrow();
  });

  it('rejects more than 4 parents', () => {
    expect(() =>
      validateParentsPayload([
        { ...base, relationship: ParentRelationship.MOTHER },
        { ...base, relationship: ParentRelationship.FATHER },
        { ...base, relationship: ParentRelationship.MOTHER_IN_LAW },
        { ...base, relationship: ParentRelationship.FATHER_IN_LAW },
        { ...base, relationship: ParentRelationship.MOTHER },
      ])
    ).toThrow(ValidationException);
  });

  it('rejects more than 2 of the same relationship', () => {
    expect(() =>
      validateParentsPayload([
        { ...base, relationship: ParentRelationship.MOTHER },
        { ...base, relationship: ParentRelationship.MOTHER },
        { ...base, relationship: ParentRelationship.MOTHER },
      ])
    ).toThrow(ValidationException);
  });
});
