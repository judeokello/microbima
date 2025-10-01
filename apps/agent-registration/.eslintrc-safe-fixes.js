// Safe nullish coalescing fixes for agent-registration app
// These changes are safe and won't break existing functionality

const safeFixes = [
  {
    file: 'src/app/(main)/admin/ba-management/page.tsx',
    line: 47,
    current: 'return partner?.partnerName || `Partner ${partnerId}`',
    fixed: 'return partner?.partnerName ?? `Partner ${partnerId}`',
    reason: 'String display - empty string should be preserved'
  },
  {
    file: 'src/app/(main)/admin/ba-management/page.tsx', 
    line: 126,
    current: '{ba.displayName || \'N/A\'}',
    fixed: '{ba.displayName ?? \'N/A\'}',
    reason: 'String display - empty string should be preserved'
  },
  {
    file: 'src/app/(main)/admin/ba-management/page.tsx',
    line: 132, 
    current: '{ba.phone || \'N/A\'}',
    fixed: '{ba.phone ?? \'N/A\'}',
    reason: 'String display - empty string should be preserved'
  },
  {
    file: 'src/app/(main)/register/customer/page.tsx',
    lines: [326, 335, 344, 371, 379],
    reason: 'Form input values - empty string is valid input'
  },
  {
    file: 'src/app/(main)/auth/_components/login-form.tsx',
    line: 54,
    current: 'const roles = userMetadata.roles || []',
    fixed: 'const roles = userMetadata.roles ?? []',
    reason: 'Array default - empty array should only be used when null/undefined'
  },
  {
    file: 'src/app/add-role/page.tsx',
    line: 32,
    current: 'const currentRoles = currentMetadata.roles || [];',
    fixed: 'const currentRoles = currentMetadata.roles ?? [];',
    reason: 'Array default - empty array should only be used when null/undefined'
  }
];

// DANGEROUS - DO NOT CHANGE THESE:
const dangerousFixes = [
  {
    file: 'src/lib/supabase.ts',
    lines: [12, 13],
    reason: 'Environment variables - empty string might be intentional fallback'
  },
  {
    file: 'src/app/(main)/register/payment/page.tsx',
    lines: [179, 253, 257, 292, 308],
    reason: 'Mixed logic - some are boolean operations, some are display defaults'
  },
  {
    file: 'src/app/bootstrap/page.tsx',
    line: 37,
    reason: 'Form validation - changes validation logic'
  }
];

module.exports = { safeFixes, dangerousFixes };
