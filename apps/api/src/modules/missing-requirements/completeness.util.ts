import { DependantRelationship, RegistrationEntityKind } from '@prisma/client';

/** Field values used to evaluate deferred / LCT completeness. */
export type CompletenessPerson = {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  gender?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  dateOfBirth?: Date | string | null;
};

/** Aligned deferred + LCT rules (beneficiaries kept for care-ops only). */
export const DEFERRED_REQUIRED_FIELDS: Record<RegistrationEntityKind, string[]> = {
  [RegistrationEntityKind.CUSTOMER]: [],
  [RegistrationEntityKind.SPOUSE]: [
    'firstName',
    'lastName',
    'idNumber',
    'gender',
    'dateOfBirth',
  ],
  [RegistrationEntityKind.CHILD]: ['firstName', 'lastName', 'dateOfBirth', 'gender'],
  [RegistrationEntityKind.BENEFICIARY]: ['firstName', 'lastName', 'idType', 'idNumber'],
};

export function relationshipToEntityKind(
  relationship: DependantRelationship | string
): RegistrationEntityKind | null {
  if (relationship === DependantRelationship.SPOUSE || relationship === 'SPOUSE') {
    return RegistrationEntityKind.SPOUSE;
  }
  if (relationship === DependantRelationship.CHILD || relationship === 'CHILD') {
    return RegistrationEntityKind.CHILD;
  }
  return null;
}

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (value instanceof Date) return Number.isNaN(value.getTime());
  if (typeof value === 'string') return value.trim().length === 0;
  return false;
}

export function isFieldPresent(person: CompletenessPerson, fieldPath: string): boolean {
  switch (fieldPath) {
    case 'firstName':
      return !isBlank(person.firstName);
    case 'lastName':
      return !isBlank(person.lastName);
    case 'middleName':
      return !isBlank(person.middleName);
    case 'gender':
      return !isBlank(person.gender);
    case 'idType':
      return !isBlank(person.idType);
    case 'idNumber':
      return !isBlank(person.idNumber);
    case 'dateOfBirth':
      return !isBlank(person.dateOfBirth);
    default:
      return !isBlank((person as Record<string, unknown>)[fieldPath]);
  }
}

/** Missing required field paths for an entity kind (empty = complete). */
export function getMissingRequiredFields(
  entityKind: RegistrationEntityKind,
  person: CompletenessPerson | null | undefined
): string[] {
  const required = DEFERRED_REQUIRED_FIELDS[entityKind] ?? [];
  if (!person) return [...required];
  return required.filter((field) => !isFieldPresent(person, field));
}

export function isEntityComplete(
  entityKind: RegistrationEntityKind,
  person: CompletenessPerson | null | undefined
): boolean {
  return getMissingRequiredFields(entityKind, person).length === 0;
}

/**
 * Whether a dependant row is eligible for LCT CSV export.
 * Beneficiaries are never LCT-exportable.
 */
export function isLctDependantExportEligible(
  relationship: DependantRelationship | string,
  person: CompletenessPerson | null | undefined
): boolean {
  const kind = relationshipToEntityKind(relationship);
  if (!kind) return false;
  return isEntityComplete(kind, person);
}

/** Blank ID numbers become N/A for LCT CSV / display. */
export function formatLctIdNumber(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  return trimmed.length > 0 ? trimmed : 'N/A';
}

export function humanizeFieldPath(fieldPath: string): string {
  switch (fieldPath) {
    case 'firstName':
      return 'First name';
    case 'lastName':
      return 'Last name';
    case 'middleName':
      return 'Middle name';
    case 'dateOfBirth':
      return 'Date of birth';
    case 'idNumber':
      return 'ID number';
    case 'idType':
      return 'ID type';
    case 'gender':
      return 'Gender';
    default:
      return fieldPath;
  }
}
