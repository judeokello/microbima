# Quick Fix for Duplicate ID Numbers

## 🚀 Fastest Solution (Recommended)

### Step 1: Preview What Will Change
```bash
cd apps/api
psql $DATABASE_URL -f scripts/fix-duplicates-by-modifying-id.sql
```

You'll see a table showing:
- Current ID numbers
- Proposed new ID numbers (with suffix)
- Which records will be kept unchanged
- Which records will be modified

### Step 2: Apply the Fix

1. **Open the file:**
   ```bash
   code scripts/fix-duplicates-by-modifying-id.sql
   # OR
   nano scripts/fix-duplicates-by-modifying-id.sql
   ```

2. **Uncomment Step 2:**
   - Find the section `-- Step 2: Apply the changes`
   - Remove `/*` at the start and `*/` at the end
   - Save the file

3. **Run the script:**
   ```bash
   psql $DATABASE_URL -f scripts/fix-duplicates-by-modifying-id.sql
   ```

4. **Verify:**
   - Uncomment Step 3 in the file
   - Run again to verify no duplicates remain
   - Should return "0 rows"

### Step 3: Apply Database Schema
```bash
npm exec prisma db push
```

## 📋 What This Does

**Example:**
- **Original duplicate:** ID = `12345678` (2 records)
- **After fix:**
  - First record (oldest): `12345678` (unchanged)
  - Second record: `1234567801` (suffix added)

**Strategy:**
- ✅ Keeps oldest record with original ID
- ✅ Adds sequential suffix to newer duplicates (01, 02, 03...)
- ✅ No data deleted
- ✅ All relationships preserved
- ✅ Fully reversible if needed

## 🎲 Alternative: Random Suffix

If you prefer random numbers instead of sequential:

```bash
# Use this file instead
psql $DATABASE_URL -f scripts/fix-duplicates-random-suffix.sql
```

Example output:
- First record: `12345678` (unchanged)
- Second record: `1234567843` (random suffix)

## ✅ Success Checklist

- [ ] Previewed changes (Step 1)
- [ ] Applied fix (Step 2)
- [ ] Verified no duplicates (Step 3)
- [ ] Schema update successful (`prisma db push`)
- [ ] Can proceed with testing setup

## 🆘 Need Help?

See the full `README.md` in this directory for all options and detailed explanations.

