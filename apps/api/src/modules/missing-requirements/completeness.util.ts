import { DependantRelationship, RegistrationEntityKind } from '@prisma/client';

/** Field values used to evaluate deferred / LCT completeness. */
export type CompletenessPerson = {
  id?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  gender?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  dateOfBirth?: Date | string | null;
  phoneNumber?: string | null;
  relationship?: string | null;
};

/** Sentinel fieldPath when a customer has no next-of-kin row. */
export const MISSING_NOK_FIELD_PATH = 'record';

/** Care-ops deferred-mandatory fields. Principal customer is capture-time required only. */
export const DEFERRED_REQUIRED_FIELDS: Record<RegistrationEntityKind, string[]> = {
  [RegistrationEntityKind.CUSTOMER]: [],
  [RegistrationEntityKind.SPOUSE]: [
    'firstName',
    'lastName',
    'idType',
    'idNumber',
    'gender',
    'dateOfBirth',
  ],
  [RegistrationEntityKind.CHILD]: ['firstName', 'lastName', 'dateOfBirth', 'gender'],
  [RegistrationEntityKind.BENEFICIARY]: [
    'firstName',
    'lastName',
    'idType',
    'idNumber',
    'phoneNumber',
    'gender',
    'relationship',
  ],
  [RegistrationEntityKind.PARENT]: [
    'firstName',
    'lastName',
    'relationship',
    'idType',
    'idNumber',
    'gender',
    'dateOfBirth',
  ],
};

/**
 * LCT CSV gate for spouse/child only. Spouse idType is care-ops MR, not an LCT blocker.
 * NOK / parents are not LCT-exported from this list.
 */
export const LCT_REQUIRED_FIELDS: Partial<Record<RegistrationEntityKind, string[]>> = {
  [RegistrationEntityKind.SPOUSE]: [
    'firstName',
    'lastName',
    'idNumber',
    'gender',
    'dateOfBirth',
  ],
  [RegistrationEntityKind.CHILD]: ['firstName', 'lastName', 'dateOfBirth', 'gender'],
};

export type DesiredMissingRequirement = {
  entityKind: RegistrationEntityKind;
  entityId: string | null;
  fieldPath: string;
};

export function desiredMissingKey(d: DesiredMissingRequirement): string {
  return `${d.entityKind}:${d.entityId ?? ''}:${d.fieldPath}`;
}

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
    case 'phoneNumber':
      return !isBlank(person.phoneNumber);
    case 'relationship':
      return !isBlank(person.relationship);
    case MISSING_NOK_FIELD_PATH:
      return false;
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

function missingAgainstList(
  person: CompletenessPerson | null | undefined,
  required: string[]
): string[] {
  if (!person) return [...required];
  return required.filter((field) => !isFieldPresent(person, field));
}

/**
 * Whether a dependant row is eligible for LCT CSV export.
 * Beneficiaries and parents are never LCT-exportable from this helper.
 */
export function isLctDependantExportEligible(
  relationship: DependantRelationship | string,
  person: CompletenessPerson | null | undefined
): boolean {
  const kind = relationshipToEntityKind(relationship);
  if (!kind) return false;
  const required = LCT_REQUIRED_FIELDS[kind];
  if (!required) return false;
  return missingAgainstList(person, required).length === 0;
}

export function collectDesiredMissingRequirements(input: {
  spouses: Array<CompletenessPerson & { id: string }>;
  children: Array<CompletenessPerson & { id: string }>;
  beneficiaries: Array<CompletenessPerson & { id: string }>;
  parents: Array<CompletenessPerson & { id: string }>;
}): DesiredMissingRequirement[] {
  const out: DesiredMissingRequirement[] = [];

  for (const spouse of input.spouses) {
    for (const fieldPath of getMissingRequiredFields(RegistrationEntityKind.SPOUSE, spouse)) {
      out.push({
        entityKind: RegistrationEntityKind.SPOUSE,
        entityId: spouse.id,
        fieldPath,
      });
    }
  }
  for (const child of input.children) {
    for (const fieldPath of getMissingRequiredFields(RegistrationEntityKind.CHILD, child)) {
      out.push({
        entityKind: RegistrationEntityKind.CHILD,
        entityId: child.id,
        fieldPath,
      });
    }
  }
  for (const parent of input.parents) {
    for (const fieldPath of getMissingRequiredFields(RegistrationEntityKind.PARENT, parent)) {
      out.push({
        entityKind: RegistrationEntityKind.PARENT,
        entityId: parent.id,
        fieldPath,
      });
    }
  }
  if (input.beneficiaries.length === 0) {
    out.push({
      entityKind: RegistrationEntityKind.BENEFICIARY,
      entityId: null,
      fieldPath: MISSING_NOK_FIELD_PATH,
    });
  } else {
    for (const ben of input.beneficiaries) {
      for (const fieldPath of getMissingRequiredFields(RegistrationEntityKind.BENEFICIARY, ben)) {
        out.push({
          entityKind: RegistrationEntityKind.BENEFICIARY,
          entityId: ben.id,
          fieldPath,
        });
      }
    }
  }
  return out;
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
    case 'phoneNumber':
      return 'Phone number';
    case 'relationship':
      return 'Relationship';
    case MISSING_NOK_FIELD_PATH:
      return 'Next of kin not added';
    default:
      return fieldPath;
  }
}
