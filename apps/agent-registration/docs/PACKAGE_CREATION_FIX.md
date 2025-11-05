# Package Creation Fix

## Issue
Package creation was failing with a 400/500 error when submitting the form. No record was being inserted into the packages table.

## Root Cause
The `create-package-dialog.tsx` component was sending `logoPath: logoPath` (where `logoPath` was `undefined`) in the initial package creation request. However, the `CreatePackageRequestDto` on the backend does not include a `logoPath` field. With NestJS validation pipe configured with `forbidNonWhitelisted: true`, this caused a validation error that prevented the package from being created.

## Solution
Removed `logoPath` from the initial package creation request. The logo upload flow remains the same:
1. Create package without logoPath
2. If logo is provided, upload it after package creation
3. Update package with logoPath after successful upload

## Changes Made
- **File**: `apps/agent-registration/src/app/(main)/admin/underwriters/[underwriterId]/_components/create-package-dialog.tsx`
  - Removed `logoPath: logoPath` from the initial POST request body
  - Added comment explaining that logoPath will be added after logo upload

## Related Files
- `apps/api/src/dto/packages/package.dto.ts` - CreatePackageRequestDto (does not include logoPath)
- `apps/api/src/services/product-management.service.ts` - Package creation service
- `apps/api/src/controllers/internal/product-management.controller.ts` - Package creation endpoint

## Verification
After deployment, verify:
1. Package creation works without logo
2. Package creation works with logo (logo should be uploaded after package creation)
3. No validation errors appear in console
4. Package records are successfully inserted into the database

