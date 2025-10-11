# Beneficiary Form & Partner ID Architecture Fixes

**Date**: October 10, 2025  
**Status**: ✅ COMPLETED

## 🎯 Issues Fixed

### 1. **Database Schema Issue**
- **Problem**: `Beneficiary` table was missing `email` and `phoneNumber` fields
- **Error**: `Unknown argument 'email'. Available options are marked with ?.`
- **Solution**: Added optional `email` and `phoneNumber` fields to Beneficiary model in Prisma schema
- **Files Changed**:
  - `apps/api/prisma/schema.prisma`
  
### 2. **Partner ID Architecture**
- **Problem**: Partner ID was being passed from frontend but should be derived from Brand Ambassador record
- **Implementation**: Option A - Derive partner ID from BA record (single source of truth)
- **Benefits**:
  - ✅ Single source of truth (BA table)
  - ✅ No mismatch possible
  - ✅ Frontend doesn't need to know partner ID
  - ✅ Simpler API contract
  - ✅ Cached in session to avoid repeated DB queries

### 3. **Beneficiary Form Field Mappings**
- **Problem**: Frontend was sending uppercase enum values, but backend expected lowercase
- **Errors**:
  - Gender: `MALE` → should be `male`
  - ID Type: `PASSPORT` → should be `passport`
  - Relationship: `SPOUSE` → should be `spouse`
- **Solution**: Created mapping functions in beneficiary page

### 4. **Missing Gender Field**
- **Problem**: Beneficiary form didn't collect gender information
- **Solution**: Added gender dropdown to the form UI

### 5. **TypeScript Build Error**
- **Problem**: `dto.partnerId` was now optional, but service was trying to parse it unconditionally
- **Error**: `Argument of type 'string | undefined' is not assignable to parameter of type 'string'`
- **Solution**: Use the `partnerId` variable derived from BA record instead of `dto.partnerId`

---

## 📁 Files Created

### 1. **`/apps/agent-registration/src/hooks/useBrandAmbassador.ts`**
- Custom React hook to fetch and cache Brand Ambassador information
- Implements 1-hour cache in localStorage
- Automatically fetches BA info when user logs in
- Returns: `baInfo`, `loading`, `error`, `refetch()`, `clearCache()`

### 2. **`/apps/api/src/dto/partner-management/create-brand-ambassador-request.dto.ts`**
- DTO for creating a new Brand Ambassador
- Fields: `userId`, `displayName`, `phoneNumber`, `perRegistrationRateCents`, `isActive`

### 3. **`/apps/api/src/dto/partner-management/create-brand-ambassador-response.dto.ts`**
- Response DTO after creating a Brand Ambassador
- Includes all BA fields plus timestamps

---

## 📝 Files Modified

### Backend Changes

#### 1. **`apps/api/prisma/schema.prisma`**
```prisma
model Beneficiary {
  // ... existing fields
  email       String?  @db.VarChar(100) // ✅ ADDED
  phoneNumber String?  @db.VarChar(20)  // ✅ ADDED
  // ... other fields
  relationshipDescription String? // ✅ ADDED
}
```

#### 2. **`apps/api/src/dto/agent-registration/create-agent-registration.dto.ts`**
- Made `partnerId` optional (will be derived from BA if not provided)

#### 3. **`apps/api/src/services/agent-registration.service.ts`**
- Derive `partnerId` from BA record
- Validate if `partnerId` is provided in DTO (must match BA's partner)
- Use derived `partnerId` when creating missing requirements

#### 4. **`apps/api/src/services/partner-management.service.ts`**
- Added `getBrandAmbassadorByUserId()` method
- Fetches BA info with partner details

#### 5. **`apps/api/src/controllers/internal/partner-management.controller.ts`**
- Added `GET /internal/brand-ambassadors/by-user/:userId` endpoint
- Returns BA information for a specific user

#### 6. **`apps/api/src/dto/partner-management/index.ts`**
- Exported new Brand Ambassador DTOs

### Frontend Changes

#### 1. **`apps/agent-registration/src/lib/api.ts`**
- Made `partnerId` optional in `AgentRegistrationRequest` interface
- No longer sends `partnerId` from frontend

#### 2. **`apps/agent-registration/src/app/(main)/register/customer/page.tsx`**
- Imported and used `useBrandAmbassador` hook
- Removed `partnerId` from `createAgentRegistration` calls
- Get partner ID from `baInfo` for logging purposes only

#### 3. **`apps/agent-registration/src/app/(main)/register/beneficiary/page.tsx`**
**Major Changes:**
- Added `useBrandAmbassador` hook
- Added `gender` field to form data
- Added gender dropdown to UI
- Created mapping functions:
  - `mapIdTypeToBackend()`: Maps frontend ID types to backend lowercase enums
  - `mapGenderToBackend()`: Maps frontend gender values to backend lowercase enums
  - `mapRelationshipToBackend()`: Maps frontend relationships to backend lowercase enums
- Updated session debugging to show BA info
- Removed unnecessary `partnerId` check from validation

---

## 🔧 Mapping Functions

### ID Type Mapping
```typescript
const mapIdTypeToBackend = (frontendIdType: string): string => {
  const mapping: Record<string, string> = {
    'NATIONAL_ID': 'national',
    'PASSPORT': 'passport',
    'ALIEN': 'alien',
    'BIRTH_CERTIFICATE': 'birth_certificate',
    'MILITARY': 'military',
  };
  return mapping[frontendIdType] || 'national';
};
```

### Gender Mapping
```typescript
const mapGenderToBackend = (frontendGender: string): string => {
  const mapping: Record<string, string> = {
    'MALE': 'male',
    'FEMALE': 'female',
    'OTHER': 'other',
    'PREFER_NOT_TO_SAY': 'prefer_not_to_say',
  };
  return mapping[frontendGender] || 'male';
};
```

### Relationship Mapping
```typescript
const mapRelationshipToBackend = (frontendRelationship: string): string => {
  const mapping: Record<string, string> = {
    'SPOUSE': 'spouse',
    'CHILD': 'child',
    'PARENT': 'parent',
    'SIBLING': 'sibling',
    'OTHER': 'other',
  };
  return mapping[frontendRelationship] || 'spouse';
};
```

---

## 🗄️ Database Changes

### Migration Applied
```bash
npx prisma db push
```

**Changes**:
- Added `email` (optional, VARCHAR 100) to `beneficiaries` table
- Added `phoneNumber` (optional, VARCHAR 20) to `beneficiaries` table
- Added `relationshipDescription` (optional) to `beneficiaries` table

---

## 🔐 Partner ID Architecture Flow

### Before (❌ Incorrect)
```
Frontend → userMetadata.partnerId → API
                ↓
    Passed as dto.partnerId
                ↓
    Validated against BA.partnerId
```

### After (✅ Correct)
```
Frontend → user.id (baId) → API
                ↓
    Lookup BA by userId
                ↓
    Derive partnerId from BA.partnerId
                ↓
    Use derived partnerId for all operations
                ↓
    Cache in frontend (localStorage, 1 hour)
```

---

## 🧪 Testing Instructions

### 1. **Test Brand Ambassador Info Fetching**
1. Log in as a Brand Ambassador
2. Navigate to any registration page
3. Open browser console
4. Check for: `✅ Brand Ambassador found: <baId>`
5. Verify `localStorage` has `baInfo` key with cached data

### 2. **Test Beneficiary Form**
1. Complete customer registration
2. Navigate to beneficiary page
3. Fill out all fields:
   - First Name, Last Name
   - ID Type: **Passport**
   - ID Number
   - **Gender: Male/Female/Other**
   - Relationship: **Spouse**
   - Date of Birth
4. Click "Next: Payment & Review"
5. Check console for:
   ```
   🔍 Raw form data: { idType: "PASSPORT", gender: "MALE", relationship: "SPOUSE" }
   🔍 Mapped beneficiary data: { idType: "passport", gender: "male", relationship: "spouse" }
   ✅ Beneficiary added successfully
   ```

### 3. **Test Partner ID Derivation**
1. Create a new agent registration
2. In backend logs, verify:
   - `✅ Brand Ambassador found: <baId>`
   - Partner ID is derived from BA record, not from request DTO

---

## 📊 API Endpoints Added

### `GET /internal/brand-ambassadors/by-user/:userId`
**Description**: Get Brand Ambassador information by User ID

**Request**:
```http
GET /api/internal/brand-ambassadors/by-user/6bc629d5-851e-421a-84e9-112a9c7a0463
Authorization: Bearer <supabase-jwt-token>
```

**Response**:
```json
{
  "id": "uuid",
  "userId": "6bc629d5-851e-421a-84e9-112a9c7a0463",
  "partnerId": 1,
  "displayName": "JO RegAdmin",
  "phoneNumber": "+254700000000",
  "perRegistrationRateCents": 500,
  "isActive": true,
  "partner": {
    "id": 1,
    "partnerName": "MaishaPoa",
    "isActive": true
  }
}
```

---

## ✅ Verification Checklist

- [x] Database schema updated with new Beneficiary fields
- [x] `useBrandAmbassador` hook created and integrated
- [x] BA info endpoint added to API
- [x] Gender field added to beneficiary form
- [x] ID type mapping implemented
- [x] Gender mapping implemented
- [x] Relationship mapping implemented
- [x] Partner ID architecture changed to Option A
- [x] Frontend no longer sends `partnerId`
- [x] Backend derives `partnerId` from BA record
- [x] TypeScript build error fixed
- [x] Both API and Agent Registration apps running successfully

---

## 🚀 Running the Applications

```bash
# Start both applications
pnpm dev:all

# Check status
pnpm status

# Expected output:
# ✅ API Server (Port 3001): RUNNING - Healthy
# ✅ Agent Registration (Port 3000): RUNNING
```

---

## 📚 Related Documentation

- **Error Handling**: `docs/development/error-handling-guide.md`
- **Beneficiary Form Fixes**: `BENEFICIARY-FORM-FIXES.md`
- **Agent Registration Debugging**: `DEBUGGING-AGENT-REGISTRATION.md`

---

## 🎉 Summary

All beneficiary form issues and partner ID architecture concerns have been successfully resolved:

1. ✅ Database schema updated
2. ✅ Partner ID now derived from BA record (single source of truth)
3. ✅ BA info cached in session for performance
4. ✅ All field mappings (gender, ID type, relationship) fixed
5. ✅ Gender field added to form
6. ✅ TypeScript build errors fixed
7. ✅ Both applications running successfully

**Next Steps**: Test the complete registration flow end-to-end with all fields populated.

