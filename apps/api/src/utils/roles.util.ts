/**
 * Internal app roles stored on Supabase user_metadata.roles.
 */
export const AppRoles = {
  BRAND_AMBASSADOR: 'brand_ambassador',
  REGISTRATION_ADMIN: 'registration_admin',
  CUSTOMER_CARE: 'customer_care',
  CUSTOMER: 'customer',
} as const;

export type AppRole = (typeof AppRoles)[keyof typeof AppRoles];

/** Admin or customer care: any customer (search, detail, statements, recovery). */
export function hasGlobalCustomerAccess(roles: string[] | null | undefined): boolean {
  const r = roles ?? [];
  return r.includes(AppRoles.REGISTRATION_ADMIN) || r.includes(AppRoles.CUSTOMER_CARE);
}
