/**
 * Mock for 'uuid' so Jest can run without loading the ESM-only uuid v13 package.
 */
export const v4 = (): string => '00000000-0000-0000-0000-000000000000';
export default { v4 };
