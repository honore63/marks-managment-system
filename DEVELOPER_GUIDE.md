# 👨‍💻 DEVELOPER GUIDE: Direct User Creation in Supabase

## 📋 Overview

This guide explains how to create Admin and Teacher users directly in Supabase without using the in-app registration modal. The MMS system automatically recognizes and integrates these users into the correct portal based on their school code and role.

---

## ✅ Three-Step User Creation Process

### **STEP 1: Create Auth User in Supabase Dashboard**

1. Go to **Supabase Dashboard**
2. Select your project
3. **Authentication** → **Users** → **"Add User"** button
4. Enter:
   - **Email:** (e.g., `admin@school.rw`)
   - **Password:** (e.g., `SecurePassword123`)
   - ✅ **Check "Auto confirm email"** (IMPORTANT!)
   - ❌ Uncheck "Auto send invite"
5. Click **"Create User"**
6. **COPY the User ID** (UUID shown in the list)

---

### **STEP 2: Create Profile Record in Database**

1. Go to **SQL Editor**
2. **Copy one of these queries based on user type:**

#### **For Admin:**
```sql
INSERT INTO public.profiles (id, email, full_name, role, school_code, school_name, created_at)
VALUES (
  'PASTE_USER_ID_HERE',          -- UUID copied from Step 1
  'admin@school.rw',             -- Must match auth email exactly
  'John Doe',                    -- Full name
  'admin',                       -- Role
  '541021',                      -- School code (6 digits)
  'GSNYAGAHANDAGAZA',            -- School name (optional)
  NOW()
);
```

#### **For Teacher:**
```sql
INSERT INTO public.profiles (id, email, full_name, role, school_code, school_name, sdms_code, created_at)
VALUES (
  'PASTE_USER_ID_HERE',          -- UUID from Step 1
  'teacher@school.rw',           -- Must match auth email
  'Jane Teacher',                -- Full name
  'teacher',                     -- Role
  '541021',                      -- School code (6 digits)
  'GSNYAGAHANDAGAZA',            -- School name
  '3410432378',                  -- SDMS Code (10 digits, UNIQUE)
  NOW()
);
```

3. **Paste** the appropriate query into SQL Editor
4. **Replace values** with actual user data
5. Click **"Run"**
6. ✅ Should show "Inserted 1 row"

---

### **STEP 3: Test Login**

1. Go to **index.html**
2. Enter email and password
3. ✅ User should login and **auto-redirect**:
   - **Admin** → `admin-portal.html`
   - **Teacher** → `teacher-portal.html`

---

## 🔑 Key Requirements

### **Email**
- ✅ Must match between `auth.users` and `profiles`
- ✅ Must be unique
- ✅ Can use any domain (not just @school.rw)

### **School Code**
- ✅ Must be **exactly 6 digits**
- ✅ Examples: `541021`, `541023`, `000001`
- ✅ **Multiple admins with same code = shared portal**
- ✅ Database validates (triggers enforce this)

### **SDMS Code** (Teachers only)
- ✅ Must be **exactly 10 digits**
- ✅ Must be **UNIQUE** (no duplicates)
- ✅ **NULL for admins** (admins don't need SDMS code)
- ✅ Database validates (triggers enforce this)

### **Role**
- ✅ Must be `'admin'` or `'teacher'`
- ✅ Determines auto-redirect portal

---

## 📌 Example Scenarios

### **Scenario 1: Create 2 Admins for Same School**

Both will share **the same portal** with real-time sync:

```sql
-- Admin 1
INSERT INTO public.profiles (id, email, full_name, role, school_code, created_at)
VALUES ('uuid-1', 'admin1@school.rw', 'Admin One', 'admin', '541021', NOW());

-- Admin 2 (same school)
INSERT INTO public.profiles (id, email, full_name, role, school_code, created_at)
VALUES ('uuid-2', 'admin2@school.rw', 'Admin Two', 'admin', '541021', NOW());

-- Both login → See same data → Changes sync in real-time
```

---

### **Scenario 2: Create Teachers with SDMS Codes**

Teachers must have unique SDMS codes:

```sql
INSERT INTO public.profiles (id, email, full_name, role, school_code, sdms_code, created_at)
VALUES 
  ('uuid-3', 'teacher1@school.rw', 'Teacher One', 'teacher', '541021', '3410432378', NOW()),
  ('uuid-4', 'teacher2@school.rw', 'Teacher Two', 'teacher', '541021', '3410432679', NOW());
  
-- Error if you use same SDMS code twice!
```

---

### **Scenario 3: Create Users for Multiple Schools**

```sql
-- School 541021
INSERT INTO public.profiles (id, email, full_name, role, school_code, created_at)
VALUES ('uuid-5', 'admin@school1.rw', 'Admin 1', 'admin', '541021', NOW());

-- School 541023 (Different code)
INSERT INTO public.profiles (id, email, full_name, role, school_code, created_at)
VALUES ('uuid-6', 'admin@school2.rw', 'Admin 2', 'admin', '541023', NOW());

-- Users autom access THEIR school portal, NOT cross-school
```

---

## 🧪 Testing in Browser Console

After creating a user, test in browser console:

```javascript
// Test validation system
ValidationSystem.validateSchoolCode('541021');
// Returns: { valid: true }

ValidationSystem.validateSchoolCode('12345');
// Returns: { valid: false, error: 'school_code must be exactly 6 digits...' }

// Get all users for a school
const users = await ValidationSystem.getUsersBySchool('541021');
console.log('Users:', users);

// Get all admins
const admins = await ValidationSystem.getAdminsBySchool('541021');
console.log('Admins:', admins);

// Check for duplicate SDMS codes
const duplicates = await ValidationSystem.findDuplicateSdmsCodes();
console.log('Duplicates:', duplicates);
```

---

## ⚠️ Common Mistakes

### ❌ **Mistake 1: Email doesn't auto-confirm**
```
Error: "Account Pending: Please check your email..."
```
**Fix:** Check "Auto confirm email" when creating auth user

### ❌ **Mistake 2: Email doesn't match**
```
Auth email: admin@school.rw
Profile email: admin@SCHOOL.RW  ← Case mismatch
```
**Fix:** Use **exact same email** in both auth.users and profiles

### ❌ **Mistake 3: School code wrong format**
```
INSERT... school_code: '54102'  ← 5 digits (only)
```
**Fix:** School code must be **exactly 6 digits**: `541021`

### ❌ **Mistake 4: Duplicate SDMS codes**
```
Error: "sdms_code must be unique"
```
**Fix:** Each teacher needs unique 10-digit SDMS code

### ❌ **Mistake 5: User ID is wrong**
```
INSERT INTO profiles (id, ... ) VALUES ('wrong-id', ...)
```
**Fix:** Copy UUID exactly from auth.users list

---

## 🔧 Troubleshooting

### **Q: User created but can't login (400 error)**
**A:** Profile doesn't exist or email doesn't match.
- Check profile exists: Run SQL `SELECT * FROM profiles WHERE email = 'user@email.com';`
- Verify auth email matches profile email exactly

### **Q: "Email not confirmed" error**
**A:** Auth user not auto-confirmed.
- Fix: Supabase Dashboard → Authentication → Users → Find user → Check "Email confirmed" → Save

### **Q: User redirects to wrong portal**
**A:** Role field is wrong in profile.
- Check: `SELECT role FROM profiles WHERE email = 'user@email.com';`
- Fix: `UPDATE profiles SET role = 'admin' WHERE email = 'user@email.com';`

### **Q: Multiple admins don't see shared data**
**A:** School codes don't match.
- Check: `SELECT school_code FROM profiles WHERE email IN ('admin1@email.com', 'admin2@email.com');`
- Both must have **same school_code**

### **Q: SDMS code validation failing**
**A:** Code not exactly 10 digits or already exists.
- Check format: Must be `1234567890` (exactly 10 digits)
- Check uniqueness: `SELECT COUNT(*) FROM profiles WHERE sdms_code = '3410432378';`
- If >1, find and update the duplicate

---

## 📊 Database Triggers (Auto-Validation)

These run automatically - no manual setup needed:

✅ **Trigger 1:** Auto-create profile when auth user added
✅ **Trigger 2:** Sync email updates from auth to profile  
✅ **Trigger 3:** Validate school_code is 6 digits
✅ **Trigger 4:** Validate SDMS code is 10 digits & unique
✅ **Trigger 5:** Prevent duplicate emails
✅ **Trigger 6:** Auto-update last_sync_at timestamp

---

## 🚀 Batch Operations (Multiple Users at Once)

### **Create 10 Teachers for a School:**

```sql
INSERT INTO public.profiles (id, email, full_name, role, school_code, sdms_code, created_at)
VALUES 
  ('id-1', 'teacher1@school.rw', 'Teacher 1', 'teacher', '541021', '3410000001', NOW()),
  ('id-2', 'teacher2@school.rw', 'Teacher 2', 'teacher', '541021', '3410000002', NOW()),
  ('id-3', 'teacher3@school.rw', 'Teacher 3', 'teacher', '541021', '3410000003', NOW()),
  ('id-4', 'teacher4@school.rw', 'Teacher 4', 'teacher', '541021', '3410000004', NOW()),
  ('id-5', 'teacher5@school.rw', 'Teacher 5', 'teacher', '541021', '3410000005', NOW()),
  -- ... up to 10 rows
  ('id-10', 'teacher10@school.rw', 'Teacher 10', 'teacher', '541021', '3410000010', NOW());
```

All 10 will be created in one query!

---

## 📁 Files Created/Modified

**New Files:**
- `DEVELOPER_USER_CREATION.sql` - Copy-paste SQL templates
- `DATABASE_TRIGGERS.sql` - Auto-validation rules
- `js/validation.js` - Client-side validation functions

**Modified Files:**
- `js/db.js` - Updated signIn() with auto-redirect
- `index.html` - Added validation.js script + auto-redirect logic

---

## ✅ Complete Workflow Checklist

- [ ] Open Supabase Dashboard
- [ ] Create auth user (check "Auto confirm email")
- [ ] Copy user UUID
- [ ] Open SQL Editor
- [ ] Paste INSERT query (admin or teacher)
- [ ] Replace values with actual data
- [ ] Click "Run"
- [ ] Verify "1 row inserted"
- [ ] Test login on index.html
- [ ] Verify auto-redirect to correct portal
- [ ] Check data is synced across school

---

## 💡 Tips

- **Start with 1 admin** from school 541021 to test
- **Always auto-confirm emails** - prevents login issues
- **Use unique SDMS codes** for teachers (10 digits)
- **Same school code = shared portal** (powerful feature!)
- **Test in multiple browser windows** to see real-time sync
- **Check browser console** for `[AUTH]`, `[VALIDATION]`, `[SYNC]` logs

---

## 🆘 Support

If something doesn't work:
1. Check browser console (F12) for error messages
2. Run diagnostic SQL queries (see TROUBLESHOOTING section)
3. Verify all data in profiles table: `SELECT * FROM profiles;`
4. Check auth.users: `SELECT id, email FROM auth.users;`
5. Look for validation errors in SQL Editor output

---

**Version:** 2.0 - Complete Developer-First User Creation  
**Updated:** April 12, 2026  
**Status:** ✅ Production Ready
