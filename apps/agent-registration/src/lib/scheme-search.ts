/** Scheme typeahead searches only after 2+ non-space characters (prefix match). */
export function schemeSearchQueryReady(query: string): boolean {
  return query.trim().length >= 2;
}
