# MPESA Payments Upload Architecture Decision

## Current Implementation: NestJS Direct Upload

Currently, MPESA payment statement uploads are handled directly in NestJS, unlike logo uploads which use Next.js API routes.

### Why the Difference?

**Logo Uploads (Next.js API Route):**
- Simple file storage operation
- No complex processing required
- Minimal business logic
- ✅ Next.js API route is sufficient

**MPESA Payments (NestJS):**
- Complex Excel parsing logic
- Database operations (creating upload record + transaction items)
- Business logic (reason type mapping, validation)
- Error handling and transaction management
- ✅ NestJS provides better structure for complex operations

### Alternative Approach: Next.js API Route + NestJS Service

For consistency with logo uploads, we could:

1. **Next.js API Route** (`/api/upload/mpesa-statement`):
   - Handle file upload
   - Store file in Supabase Storage / local filesystem
   - Return file path

2. **NestJS API** (`POST /internal/mpesa-payments/parse`):
   - Accept file path
   - Download file from storage (if needed)
   - Parse Excel file
   - Save to database

**Pros:**
- ✅ Consistent with logo upload pattern
- ✅ Separation of concerns (upload vs processing)

**Cons:**
- ❌ Requires downloading file again from storage (inefficient)
- ❌ Two API calls instead of one
- ❌ More complex error handling (what if upload succeeds but parsing fails?)

### Recommendation

**Keep current NestJS approach** because:
1. More efficient (parse from buffer, no re-download)
2. Atomic operation (upload + parse + save in one transaction)
3. Better error handling (if parsing fails, we can avoid storing invalid files)
4. Better suited for complex business logic

However, if consistency is more important, we can refactor to match the logo upload pattern.

