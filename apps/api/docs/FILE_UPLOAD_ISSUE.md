# File Upload Issue on Fly.io

## Problem

The current logo upload implementation writes files to the local filesystem:
- Path: `public/logos/underwriters/{id}/logo.{ext}`
- Location: `apps/agent-registration/src/app/api/upload/logo/route.ts`

**This will NOT work on Fly.io** because:
1. **Ephemeral filesystem**: Files written to the container filesystem are lost when the container restarts
2. **Read-only filesystem**: Only `/tmp` is writable, but even that is ephemeral
3. **No persistence**: Multiple container instances don't share filesystem

## Current Implementation

```typescript
// apps/agent-registration/src/app/api/upload/logo/route.ts
const directoryPath = join(process.cwd(), 'public', 'logos', 'underwriters', entityId);
await writeFile(filePath, buffer);
```

## Solution: Use Supabase Storage

Instead of writing to the local filesystem, upload files to **Supabase Storage**:

### Benefits
- ✅ Persistent storage (files survive container restarts)
- ✅ CDN-backed (fast global access)
- ✅ Scalable (handles multiple instances)
- ✅ Built-in access control
- ✅ Already integrated with your Supabase setup

### Implementation Steps

1. **Create Supabase Storage Bucket**:
   - Bucket name: `logos`
   - Public: `true` (for logo images)
   - Allowed MIME types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`

2. **Update Upload Route** (`apps/agent-registration/src/app/api/upload/logo/route.ts`):
   ```typescript
   import { createClient } from '@supabase/supabase-js';
   
   // Replace filesystem write with Supabase Storage upload
   const supabase = createClient(supabaseUrl, supabaseServiceKey);
   
   const filePath = `underwriters/${entityId}/logo.${fileExtension}`;
   const { data, error } = await supabase.storage
     .from('logos')
     .upload(filePath, buffer, {
       contentType: file.type,
       upsert: true, // Replace if exists
     });
   
   if (error) throw error;
   
   // Get public URL
   const { data: { publicUrl } } = supabase.storage
     .from('logos')
     .getPublicUrl(filePath);
   
   return NextResponse.json({ path: publicUrl });
   ```

3. **Update Database**:
   - Store the Supabase Storage URL in `logoPath` field
   - Format: `https://{project-id}.supabase.co/storage/v1/object/public/logos/underwriters/{id}/logo.png`

### Alternative: Fly.io Volumes

If you prefer to keep files on Fly.io infrastructure:
- Create a Fly volume: `fly volumes create logos_volume --size 1 --region fra`
- Mount it in `fly.toml`:
  ```toml
  [[mounts]]
    source = "logos_volume"
    destination = "/data/logos"
  ```
- Update upload path to `/data/logos/underwriters/{id}/logo.{ext}`
- **Note**: Only works for single-instance apps (volumes can't be shared across instances)

## Recommendation

**Use Supabase Storage** - it's the most robust solution for a multi-instance deployment.

## Current Workaround

Until this is fixed, logo uploads will fail silently or with permission errors on Fly.io. The error message "A record with this information already exists" is unrelated to file uploads - it's a database validation issue that has been fixed.

