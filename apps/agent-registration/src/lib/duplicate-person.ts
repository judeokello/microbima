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

export function isSchemeTypeaheadQueryReady(query: string): boolean {
  return query.trim().length >= 2;
}

export function schemeNamePrefixMatches(schemeName: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return false;
  return schemeName.trim().toLowerCase().startsWith(q);
}
