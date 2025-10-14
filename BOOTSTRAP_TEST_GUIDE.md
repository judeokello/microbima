# Bootstrap Testing Guide

## ✅ Database Reset Complete

Your local database has been reset and is now **completely clean**:
- ✅ 0 users in `auth.users`
- ✅ 0 partners
- ✅ 0 bundled products
- ✅ 0 brand ambassadors

You're ready to test the bootstrap flow from scratch!

---

## 🧪 Testing Steps

### 1. **Ensure Services are Running**

```bash
# Make sure both API and Agent Registration are running
cd /home/judeokello/Projects/microbima
pnpm dev:all

# Verify services:
# - API should be on: http://localhost:3001
# - Agent Registration should be on: http://localhost:3000
```

### 2. **Open Bootstrap Page**

```
http://localhost:3000/bootstrap
```

### 3. **Fill the Bootstrap Form**

**Example Data:**
- **Email:** `admin@maishapoa.co.ke`
- **Display Name:** `System Administrator`
- **Password:** `SecurePassword123!`
- **Confirm Password:** `SecurePassword123!`

### 4. **Submit the Form**

Click **"Create Admin User"**

### 5. **Expected Flow**

You should see the following happen in sequence:

1. ⏳ **Loading spinner** appears
2. 🔐 **User created** in `auth.users`
3. 🏢 **Maisha Poa partner seeded** (partnerId = 1)
4. 📦 **MfanisiGo product seeded**
5. 👤 **Brand Ambassador created**
6. ✅ **Success message** displayed
7. ↪️ **Redirect to login** after 2 seconds

---

## 🔍 Verification Steps

### **Check API Logs**

You should see these logs in your API terminal:

```
[bootstrap-seed-{timestamp}] Seeding bootstrap data for user: {userId}
✅ Maisha Poa partner seeded: 1
✅ MfanisiGo product seeded
[bootstrap-seed-{timestamp}] Bootstrap data seeded successfully
```

### **Check Database**

Open a new terminal and run:

```bash
cd /home/judeokello/Projects/microbima/apps/api

# Check users (should be 1)
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "SELECT id, email FROM auth.users;"

# Check partners (should be 1 - Maisha Poa)
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "SELECT id, \"partnerName\", \"createdBy\" FROM partners;"

# Check bundled products (should be 1 - MfanisiGo)
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "SELECT name, description, created_by FROM bundled_products;"

# Check brand ambassadors (should be 1)
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "SELECT \"userId\", \"displayName\", \"partnerId\" FROM brand_ambassadors;"
```

### **Expected Results:**

**auth.users:**
```
id                                   | email
-------------------------------------|----------------------
{generated-uuid}                     | admin@maishapoa.co.ke
```

**partners:**
```
id | partnerName  | createdBy
---|--------------|------------
1  | Maisha Poa   | {user-id}
```

**bundled_products:**
```
name       | description                | created_by
-----------|----------------------------|------------
MfanisiGo  | Owned by the OOD drivers   | {user-id}
```

**brand_ambassadors:**
```
userId       | displayName           | partnerId
-------------|-----------------------|----------
{user-id}    | System Administrator  | 1
```

---

## ✅ Success Criteria

- [ ] User created in `auth.users`
- [ ] Maisha Poa partner created (partnerId = 1)
- [ ] MfanisiGo product created
- [ ] Brand Ambassador created
- [ ] `createdBy` field populated correctly (same userId for all)
- [ ] No errors in API logs
- [ ] Redirected to login page
- [ ] Can log in with created credentials

---

## 🎯 Test the Login

After bootstrap completes and redirects:

1. **Login Page:** `http://localhost:3000/auth/login`
2. **Credentials:**
   - Email: `admin@maishapoa.co.ke`
   - Password: `SecurePassword123!`
3. **Expected:** Should redirect to `/admin` dashboard

---

## 🔧 Troubleshooting

### **Error: "Failed to seed initial data"**

**Check:**
- Is the API running on port 3001?
- Check API logs for errors
- Verify `NEXT_PUBLIC_INTERNAL_API_BASE_URL` in agent-registration `.env.local`

**Fix:**
```bash
# Check if API is running
curl http://localhost:3001/health

# Check environment variable
cat apps/agent-registration/.env.local | grep INTERNAL_API_BASE_URL
```

### **Error: "Failed to create Brand Ambassador"**

**Check:**
- Was the partner (Maisha Poa) created successfully?
- Check if partnerId = 1 exists in database

**Verify:**
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "SELECT * FROM partners WHERE id = 1;"
```

### **Database Already Has Data**

If you want to reset and test again:

```bash
cd /home/judeokello/Projects/microbima/apps/api

# Delete existing data
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
DELETE FROM brand_ambassadors;
DELETE FROM bundled_products;
DELETE FROM partners;
DELETE FROM auth.users;
"
```

---

## 📝 What to Look For

### **Console Logs (Browser)**

Open browser DevTools (F12) → Console tab:

**Expected:**
```
✅ Initial data seeded: {success: true, message: "Bootstrap data seeded successfully", ...}
✅ Brand Ambassador created: {id: "...", userId: "...", ...}
```

**Not Expected:**
```
❌ Failed to seed initial data: ...
❌ Error creating Brand Ambassador record: ...
```

### **Network Tab (Browser)**

Open browser DevTools (F12) → Network tab:

**Expected Requests:**
1. `POST /auth/v1/signup` → Status 200
2. `POST /api/internal/bootstrap/seed-initial-data` → Status 201
3. `POST /api/internal/partner-management/partners/1/brand-ambassadors` → Status 201

---

## 🎉 Success!

If all checks pass, your bootstrap process is working correctly! 

The complete flow is:
1. ✅ User creation
2. ✅ Partner seeding (with correct createdBy)
3. ✅ Product seeding (with correct created_by)
4. ✅ Brand Ambassador creation

This is **exactly** what will happen in staging and production when you run the bootstrap process!

---

## 🚀 Next Steps

1. ✅ Test locally (you're here!)
2. Deploy to staging
3. Test bootstrap on staging
4. Verify seeded data on staging
5. Deploy to production
6. Run bootstrap on production once

