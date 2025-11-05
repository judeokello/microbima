# Image Optimization Fix for Supabase Storage

## Issue
Underwriter logos were failing to load with a 400 error when using Next.js Image component. The error occurred because Supabase storage URLs were not whitelisted in Next.js image configuration.

## Root Cause
Next.js Image component requires remote image domains to be explicitly configured in `next.config.mjs` for security reasons. Without this configuration, Next.js blocks image optimization requests to external domains.

## Solution
Added Supabase storage domains to `next.config.mjs`:

```javascript
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: '*.supabase.co',
      pathname: '/storage/v1/object/public/**',
    },
    // Explicitly allow staging Supabase URL
    {
      protocol: 'https',
      hostname: 'yowgqzgqxvkqyyzhxvej.supabase.co',
      pathname: '/storage/v1/object/public/**',
    },
    // Explicitly allow production Supabase URL
    {
      protocol: 'https',
      hostname: 'xmkiddtkujaparakqwem.supabase.co',
      pathname: '/storage/v1/object/public/**',
    },
  ],
}
```

## Affected Pages
- `/admin/underwriters/[underwriterId]` - Underwriter details page
- `/admin/underwriters/packages/[packageId]` - Package details page

## Verification
After deployment, verify images load correctly:
1. Navigate to an underwriter details page
2. Check browser console for any 400 errors
3. Verify logo displays correctly

## Important Notes
- **This is a build-time configuration** - changes require rebuilding and redeploying
- The wildcard pattern `*.supabase.co` should cover all Supabase projects
- Explicit hostnames are included for staging and production for redundancy
- Image optimization will automatically resize and optimize images from Supabase storage

## Related Files
- `apps/agent-registration/next.config.mjs` - Next.js configuration
- `apps/agent-registration/src/app/(main)/admin/underwriters/[underwriterId]/page.tsx` - Underwriter details page
- `apps/agent-registration/src/app/(main)/admin/underwriters/packages/[packageId]/page.tsx` - Package details page

