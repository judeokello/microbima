# Beneficiary Form Fixes

## Issues Identified and Fixed

### Issue #1: Missing Gender Field ✅ FIXED
**Problem:**
- Form didn't have a gender field
- API expected gender but form sent hardcoded 'other'
- Error: `beneficiaries.0.gender must be one of the following values: male, female`

**Solution:**
- Added `gender: string` to `BeneficiaryFormData` interface
- Added gender field to form UI with dropdown options:
  - Male, Female, Other, Prefer not to say
- Added default value `'MALE'` to initial form data
- Added gender to localStorage parsing

### Issue #2: ID Type Mapping ✅ FIXED
**Problem:**
- Frontend sends "PASSPORT" but backend expects "passport"
- Error: `beneficiaries.0.idType must be one of the following values: national, alien, passport, birth_certificate`

**Solution:**
- Added `mapIdTypeToBackend()` function:
  ```typescript
  'NATIONAL_ID': 'national',
  'PASSPORT': 'passport',
  'ALIEN': 'alien',
  'BIRTH_CERTIFICATE': 'birth_certificate',
  'MILITARY': 'national'
  ```

### Issue #3: Relationship Mapping ✅ FIXED
**Problem:**
- Frontend sends "SPOUSE" but backend expects "spouse"
- Error: `beneficiaries.0.relationship must be one of the following values: spouse, child, parent, sibling, friend, other`

**Solution:**
- Added `mapRelationshipToBackend()` function that converts to lowercase
- Updated API call to use mapped values

### Issue #4: Gender Mapping ✅ FIXED
**Problem:**
- Frontend sends "MALE" but backend expects "male"

**Solution:**
- Added `mapGenderToBackend()` function that converts to lowercase

## Files Modified

### `/apps/agent-registration/src/app/(main)/register/beneficiary/page.tsx`

1. **Interface Updates:**
   ```typescript
   interface BeneficiaryFormData {
     // ... existing fields
     gender: string; // Added
   }
   ```

2. **Initial Data:**
   ```typescript
   const initialFormData: BeneficiaryFormData = {
     // ... existing fields
     gender: 'MALE', // Added default
   };
   ```

3. **Mapping Functions:**
   ```typescript
   const mapIdTypeToBackend = (frontendIdType: string): string => {
     const mapping: Record<string, string> = {
       'NATIONAL_ID': 'national',
       'PASSPORT': 'passport',
       'ALIEN': 'alien',
       'BIRTH_CERTIFICATE': 'birth_certificate',
       'MILITARY': 'national',
     };
     return mapping[frontendIdType] || 'national';
   };

   const mapGenderToBackend = (frontendGender: string): string => {
     return frontendGender.toLowerCase();
   };

   const mapRelationshipToBackend = (frontendRelationship: string): string => {
     return frontendRelationship.toLowerCase();
   };
   ```

4. **API Call Updates:**
   ```typescript
   const beneficiaryData: BeneficiaryData = {
     // ... existing fields
     gender: mapGenderToBackend(formData.gender), // Fixed
     idType: mapIdTypeToBackend(formData.idType), // Fixed
     relationship: mapRelationshipToBackend(formData.relationship), // Fixed
     relationshipDescription: formData.relationship === 'OTHER' ? formData.customRelationship : undefined, // Fixed
   };
   ```

5. **UI Form Field:**
   ```typescript
   <div>
     <Label htmlFor="gender">Gender</Label>
     <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
       <SelectTrigger>
         <SelectValue placeholder="Select gender" />
       </SelectTrigger>
       <SelectContent>
         <SelectItem value="MALE">Male</SelectItem>
         <SelectItem value="FEMALE">Female</SelectItem>
         <SelectItem value="OTHER">Other</SelectItem>
         <SelectItem value="PREFER_NOT_TO_SAY">Prefer not to say</SelectItem>
       </SelectContent>
     </Select>
   </div>
   ```

6. **Enhanced Debugging:**
   ```typescript
   console.log('🔍 Raw form data:', {
     idType: formData.idType,
     gender: formData.gender,
     relationship: formData.relationship,
   });
   console.log('🔍 Mapped beneficiary data:', beneficiaryData);
   ```

## Validation Mapping Summary

| Frontend Value | Backend Value | Field |
|----------------|---------------|-------|
| PASSPORT | passport | idType |
| NATIONAL_ID | national | idType |
| ALIEN | alien | idType |
| BIRTH_CERTIFICATE | birth_certificate | idType |
| MALE | male | gender |
| FEMALE | female | gender |
| OTHER | other | gender |
| PREFER_NOT_TO_SAY | prefer_not_to_say | gender |
| SPOUSE | spouse | relationship |
| CHILD | child | relationship |
| PARENT | parent | relationship |
| SIBLING | sibling | relationship |
| FRIEND | friend | relationship |
| OTHER | other | relationship |

## Testing

1. **Fill out the beneficiary form completely:**
   - First Name: [any]
   - Last Name: [any]
   - ID Type: Passport
   - ID Number: [unique number]
   - Gender: Male/Female/etc.
   - Relationship: Spouse/Child/etc.
   - Date of Birth: [valid date]

2. **Click "Next: Payment & Review"**

3. **Check browser console for:**
   - Raw form data with frontend values
   - Mapped beneficiary data with backend values
   - API call success/failure

4. **Expected result:**
   - No validation errors
   - Successful navigation to payment page
   - Beneficiary created in database

## Similar Issues in Other Forms

The same mapping issues likely exist in:
- **Customer form** (already fixed)
- **Spouse section** in customer form
- **Children section** in customer form

These should be checked and fixed using the same pattern.
