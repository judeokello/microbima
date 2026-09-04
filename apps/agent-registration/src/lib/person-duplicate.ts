/** FE mirror of API person-duplicate.util for add-product pick-or-confirm. */

export type PersonDuplicateCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  idNumber?: string | null;
  phoneNumber?: string | null;
};

export type PersonDuplicateInput = {
  firstName: string;
  lastName: string;
  idNumber?: string | null;
  phoneNumber?: string | null;
};

export type PersonDuplicateMatch =
  | { kind: 'none' }
  | { kind: 'auto'; person: PersonDuplicateCandidate }
  | { kind: 'confirm'; candidates: PersonDuplicateCandidate[] };

function normName(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function normId(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s/g, '');
}

function normPhone(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s/g, '');
}

function namesMatch(a: PersonDuplicateInput, b: PersonDuplicateCandidate): boolean {
  return normName(a.firstName) === normName(b.firstName) && normName(a.lastName) === normName(b.lastName);
}

/**
 * Match a net-new person against existing people.
 * Same first+last (case-insensitive) and (same ID if both have one, or same phone if both have one).
 * Names match but IDs differ → different people.
 * Names match and both ID and phone empty → force pick-or-confirm.
 */
export function matchExistingPerson(
  input: PersonDuplicateInput,
  existing: PersonDuplicateCandidate[]
): PersonDuplicateMatch {
  const sameName = existing.filter((p) => namesMatch(input, p));
  if (sameName.length === 0) return { kind: 'none' };

  const inputId = normId(input.idNumber);
  const inputPhone = normPhone(input.phoneNumber);

  if (inputId) {
    const idMatches = sameName.filter((p) => {
      const existingId = normId(p.idNumber);
      return existingId.length > 0 && existingId === inputId;
    });
    if (idMatches.length === 1) return { kind: 'auto', person: idMatches[0] };
    if (idMatches.length > 1) return { kind: 'confirm', candidates: idMatches };
    const conflictingId = sameName.some((p) => normId(p.idNumber).length > 0);
    if (conflictingId) return { kind: 'none' };
  }

  if (inputPhone) {
    const phoneMatches = sameName.filter((p) => {
      const existingPhone = normPhone(p.phoneNumber);
      return existingPhone.length > 0 && existingPhone === inputPhone;
    });
    if (phoneMatches.length === 1) return { kind: 'auto', person: phoneMatches[0] };
    if (phoneMatches.length > 1) return { kind: 'confirm', candidates: phoneMatches };
  }

  const bothEmpty = sameName.filter((p) => !normId(p.idNumber) && !normPhone(p.phoneNumber));
  if (!inputId && !inputPhone && bothEmpty.length > 0) {
    return { kind: 'confirm', candidates: bothEmpty };
  }

  return { kind: 'none' };
}
