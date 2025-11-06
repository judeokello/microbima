# Supabase Storage Bucket Configuration for MPESA Statements

## Bucket Setup

When creating the `mpesa_statements` bucket in Supabase, configure it with the following settings:

### Via Supabase Dashboard:
1. Go to Storage → Create Bucket
2. Bucket name: `mpesa_statements`
3. Public: `false` (private bucket - requires authentication)
4. File size limit: `50MB` (or appropriate limit for Excel files)
5. Allowed MIME types:
   - `application/vnd.ms-excel` (for .xls files)
   - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (for .xlsx files)

### Via Supabase CLI (for local development):

Add to `supabase/config.toml`:

```toml
[storage.buckets.mpesa_statements]
public = false
file_size_limit = "50MiB"
allowed_mime_types = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]
```

### Via SQL (alternative):

```sql
-- Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mpesa_statements',
  'mpesa_statements',
  false,
  52428800, -- 50MB in bytes
  ARRAY[
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
);

-- Set up RLS policies (only authenticated users can upload/read)
CREATE POLICY "Users can upload MPESA statements"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'mpesa_statements');

CREATE POLICY "Users can read MPESA statements"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'mpesa_statements');
```

## Notes

- The bucket should be **private** (not public) since these are financial statements
- Only authenticated users should have access
- File type restrictions are enforced both at the bucket level (Supabase) and in application code (NestJS)
- The application code validates file types before parsing, providing an additional layer of security

