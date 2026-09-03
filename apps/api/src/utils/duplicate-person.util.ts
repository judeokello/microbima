export type PersonIdentity = {
  firstName: string;
  lastName: string;
  idNumber?: string | null;
  phoneNumber?: string | null;
};

export type IdentifiedPerson = PersonIdentity & { id: string };

export type DuplicatePersonMatch =
  | { kind: 'same_person'; existing: IdentifiedPerson }
  | { kind: 'ambiguous'; existing: IdentifiedPerson }
  | { kind: 'distinct' };

function normalizeName(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function normalizeToken(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s/g, '').toLowerCase();
}

export function namesMatch(a: PersonIdentity, b: PersonIdentity): boolean {
  return (
    normalizeName(a.firstName) === normalizeName(b.firstName) &&
    normalizeName(a.lastName) === normalizeName(b.lastName)
  );
}

/**
 * Duplicate net-new match:
 * - case-insensitive firstName+lastName AND
 *   (same idNumber if both have one OR same phone if both have one)
 * - names match but IDs differ → different people
 * - names match and both ID and phone empty → ambiguous (force pick-or-confirm)
 */
export function matchDuplicatePerson(
  candidate: PersonIdentity,
  existingPeople: IdentifiedPerson[]
): DuplicatePersonMatch {
  const candidateId = normalizeToken(candidate.idNumber);
  const candidatePhone = normalizeToken(candidate.phoneNumber);

  for (const existing of existingPeople) {
    if (!namesMatch(candidate, existing)) {
      continue;
    }

    const existingId = normalizeToken(existing.idNumber);
    const existingPhone = normalizeToken(existing.phoneNumber);

    if (candidateId && existingId) {
      if (candidateId === existingId) {
        return { kind: 'same_person', existing };
      }
      return { kind: 'distinct' };
    }

    if (candidatePhone && existingPhone && candidatePhone === existingPhone) {
      return { kind: 'same_person', existing };
    }

    if (!candidateId && !existingId && !candidatePhone && !existingPhone) {
      return { kind: 'ambiguous', existing };
    }
  }

  return { kind: 'distinct' };
}

export function findAllAmbiguousMatches(
  candidate: PersonIdentity,
  existingPeople: IdentifiedPerson[]
): IdentifiedPerson[] {
  const candidateId = normalizeToken(candidate.idNumber);
  const candidatePhone = normalizeToken(candidate.phoneNumber);
  if (candidateId || candidatePhone) {
    return [];
  }
  return existingPeople.filter((existing) => {
    if (!namesMatch(candidate, existing)) {
      return false;
    }
    return !normalizeToken(existing.idNumber) && !normalizeToken(existing.phoneNumber);
  });
}
