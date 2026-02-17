# Supabase Storage Bucket Configuration

## Bucket: `messaging-attachments`

### Status: ✅ Created

### Configuration Settings

#### 1. Access Level
**Setting**: **Private**

**Why**: 
- Email attachments contain sensitive customer data (policy docs, member cards)
- Should only be accessible via authenticated API endpoints
- Service role key bypasses RLS for internal operations

---

#### 2. File Size Limits

**Recommended**: **5 MB per file**

**Rationale**:
- PDF attachments (policy summaries, member cards) typically < 500 KB
- FAQ documents rarely exceed 1 MB
- 5 MB provides comfortable headroom
- Prevents abuse/accidental large uploads

**Supabase Dashboard Config**:
- Storage > `messaging-attachments` > Settings > Max file size: `5242880` bytes (5 MB)

---

#### 3. Allowed MIME Types

### Recommended: **PDF Only** (Most Restrictive)

**If you want maximum security and simplicity**:
```
application/pdf
```

**Why**:
- ✅ All current use cases are PDFs (policy docs, member cards, FAQs)
- ✅ Simplest to validate and sanitize
- ✅ Reduces attack surface (no executable files, no images with EXIF exploits)
- ✅ Consistent viewer experience across email clients

**Supabase Dashboard Config**:
- Storage > `messaging-attachments` > Settings > Allowed MIME types:
  ```
  application/pdf
  ```

---

### Alternative: **PDF + Common Document Formats** (Moderate)

**If you anticipate needing other document types**:
```
application/pdf
application/msword
application/vnd.openxmlformats-officedocument.wordprocessingml.document
application/vnd.ms-excel
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
text/plain
text/csv
```

**Why**:
- Supports Word docs (`.doc`, `.docx`)
- Supports Excel (`.xls`, `.xlsx`)
- Supports plain text and CSV
- Still excludes executables, scripts, images

**Trade-offs**:
- ⚠️ More complex validation needed
- ⚠️ Email clients may render differently
- ⚠️ Larger attack surface

---

### Alternative: **PDF + Images** (If Branding Needed)

**If attachments will include logos/brand images**:
```
application/pdf
image/jpeg
image/png
image/gif
```

**Why**:
- Allows branded email attachments with images
- Common for marketing materials

**Trade-offs**:
- ⚠️ EXIF metadata can leak sensitive info (strip on upload)
- ⚠️ Larger files (especially high-res images)
- ⚠️ Need image optimization/compression

---

## My Recommendation for Your Project

### **Start with PDF-only** ✅

**Reasons**:
1. **Current spec mentions only PDFs**:
   - Policy summaries → PDF
   - Member cards → PDF
   - FAQ documents → PDF
2. **Simplest to implement and secure**
3. **Easy to expand later** if needed
4. **Consistent with insurance industry** (documents are PDFs)

### Supabase Configuration

**In Supabase Dashboard**:
```
Storage > messaging-attachments > Settings

Public bucket: OFF (private)
File size limit: 5242880 bytes (5 MB)
Allowed MIME types: application/pdf
```

**In Code** (`MessagingAttachmentService`):
```typescript
// Validation before upload
if (mimeType !== 'application/pdf') {
  throw new Error('Only PDF attachments are supported');
}

if (sizeBytes > 5 * 1024 * 1024) {
  throw new Error('File exceeds 5 MB limit');
}
```

---

## Future Expansion (If Needed)

### When to Add Other MIME Types

**Add Images** if:
- Marketing team needs to send branded visuals
- Member cards need embedded photos
- QR codes need to be sent as separate images

**Add Documents** if:
- Customers need editable policy documents
- Support team needs to send Excel payment schedules
- Compliance requires Word doc templates

### How to Expand

**Step 1**: Update Supabase bucket allowed MIME types

**Step 2**: Update validation in code:
```typescript
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  // Add as needed
];

if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
  throw new Error(`Unsupported file type: ${mimeType}`);
}
```

**Step 3**: Update spec.md to document new attachment types

---

## Security Best Practices

### 1. Content-Type Validation
```typescript
// Don't trust client-provided MIME type
// Verify actual file signature (magic bytes)
import fileType from 'file-type';

const detectedType = await fileType.fromBuffer(fileBuffer);
if (detectedType?.mime !== 'application/pdf') {
  throw new Error('File is not a valid PDF');
}
```

### 2. Filename Sanitization
```typescript
// Already specified in your spec
// Lowercase, strip accents, strip punctuation, handle collisions
const safeName = sanitizeFilename(originalName);
```

### 3. Virus Scanning (Future)
For production with customer uploads:
- Integrate ClamAV or cloud antivirus API
- Scan files before storing
- Quarantine suspicious uploads

---

## Summary: Your Bucket Configuration

### Recommended Settings (Copy to Supabase Dashboard)

```yaml
Bucket Name: messaging-attachments
Public: false (private)
File Size Limit: 5 MB (5242880 bytes)
Allowed MIME Types: application/pdf

# Optional: Add these later if needed
# - image/jpeg
# - image/png
```

### Environment Variable

Already in your `env.example`:
```bash
SUPABASE_MESSAGING_ATTACHMENTS_BUCKET=messaging-attachments
```

### RLS Policies (Optional)

Since you're using **service role key**, RLS is bypassed. But if you want defense-in-depth:

**Policy 1**: Allow service role to upload/download
```sql
CREATE POLICY "Service role full access"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'messaging-attachments')
WITH CHECK (bucket_id = 'messaging-attachments');
```

**Policy 2**: Prevent public access
```sql
-- Default deny (implicit when no other policies match)
```

---

## Quick Start Checklist

- [x] Bucket created: `messaging-attachments`
- [ ] Set to **Private**
- [ ] Set file size limit: **5 MB**
- [ ] Set allowed MIME types: **`application/pdf`**
- [ ] Add env var: `SUPABASE_MESSAGING_ATTACHMENTS_BUCKET=messaging-attachments`
- [ ] Test upload/download in dev

**After completing checklist**, you're ready for T032 (attachment service implementation)!
