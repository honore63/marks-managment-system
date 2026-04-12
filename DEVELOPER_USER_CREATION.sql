-- ============================================================
-- DEVELOPER USER CREATION SCRIPT
-- For Supabase Admins - Create Users Directly
-- ============================================================
-- 
-- This script allows developers to quickly create Admin and Teacher
-- accounts in Supabase without using the in-app registration modal.
-- 
-- All users are automatically linked to the correct school portal
-- via school_code and will auto-redirect on login.

-- ============================================================
-- METHOD 1: CREATE ADMIN USER (Easy Copy-Paste)
-- ============================================================

-- STEP 1: Create in Supabase Auth (Authentication → Users → Add User)
-- Manual: 
--   Email: admin@school.rw
--   Password: SecurePassword123
--   Auto confirm email: YES
--   Auto send invite: NO

-- STEP 2: Run this SQL after auth user is created:
-- Change values below to match your new admin:

INSERT INTO public.profiles (
  id,
  email,
  full_name,
  role,
  school_code,
  school_name,
  sdms_code,
  created_at
) VALUES (
  'PASTE_AUTH_USER_ID_HERE',          -- Get from Supabase Auth → Users → Copy ID
  'admin@school.rw',                  -- Must match auth email exactly
  'John Doe',                         -- Full name of admin
  'admin',                            -- Role: admin or teacher
  '541021',                           -- School code (6 digits)
  'GSNYAGAHANDAGAZA',                 -- School name (optional but recommended)
  NULL,                               -- sdms_code (NULL for admins, required for teachers)
  NOW()
);

---

-- ============================================================
-- METHOD 2: CREATE TEACHER USER (Easy Copy-Paste)
-- ============================================================

-- STEP 1: Create in Supabase Auth (same as above)
-- Email: teacher@school.rw
-- Password: SecurePassword123
-- Auto confirm email: YES

-- STEP 2: Run this SQL:

INSERT INTO public.profiles (
  id,
  email,
  full_name,
  role,
  school_code,
  school_name,
  sdms_code,
  created_at
) VALUES (
  'PASTE_AUTH_USER_ID_HERE',          -- Get from Supabase Auth → Users → Copy ID
  'teacher@school.rw',                -- Must match auth email exactly
  'Jane Teacher',                     -- Full name of teacher
  'teacher',                          -- Role: must be 'teacher'
  '541021',                           -- School code (6 digits)
  'GSNYAGAHANDAGAZA',                 -- School name
  '3410432378',                       -- SDMS Code (10 digits, UNIQUE)
  NOW()
);

---

-- ============================================================
-- METHOD 3: BATCH CREATE MULTIPLE USERS
-- ============================================================

-- Create multiple admins for same school in one query:

INSERT INTO public.profiles (id, email, full_name, role, school_code, school_name, created_at)
VALUES 
  ('USER_ID_1', 'admin1@school.rw', 'Admin One', 'admin', '541021', 'GSNYAGAHANDAGAZA', NOW()),
  ('USER_ID_2', 'admin2@school.rw', 'Admin Two', 'admin', '541021', 'GSNYAGAHANDAGAZA', NOW()),
  ('USER_ID_3', 'teacher1@school.rw', 'Teacher One', 'teacher', '541021', 'GSNYAGAHANDAGAZA', NOW());

---

-- ============================================================
-- VALIDATION: Check Created Users
-- ============================================================

-- After creating users, verify they exist:

SELECT 
  id,
  email,
  full_name,
  role,
  school_code,
  sdms_code,
  created_at
FROM public.profiles
WHERE school_code = '541021'
ORDER BY created_at DESC;

---

-- ============================================================
-- VALIDATION: Check for Duplicate SDMS Codes
-- ============================================================

-- Verify no duplicate SDMS codes exist:

SELECT sdms_code, COUNT(*) as count
FROM public.profiles
WHERE sdms_code IS NOT NULL
GROUP BY sdms_code
HAVING COUNT(*) > 1;

-- If this returns rows = DUPLICATE FOUND, fix it!

---

-- ============================================================
-- FIX: Update Existing User Details
-- ============================================================

-- Change full_name for existing admin:
UPDATE public.profiles
SET full_name = 'New Name Here'
WHERE email = 'admin@school.rw';

-- Change school_code for existing user:
UPDATE public.profiles
SET school_code = '541021'
WHERE email = 'user@school.rw';

-- Add SDMS code to teacher:
UPDATE public.profiles
SET sdms_code = '3410432378'
WHERE email = 'teacher@school.rw';

---

-- ============================================================
-- DEVELOPER WORKFLOW
-- ============================================================

-- 1. Open Supabase Dashboard → Authentication → Users
-- 2. Click "Add User" button
-- 3. Enter email and password
-- 4. CHECK "Auto confirm email"
-- 5. Click "Create user"
-- 6. COPY the user ID (UUID)
-- 7. Come back here and run INSERT query with that ID
-- 8. Done! User can now login immediately

---

-- ============================================================
-- IMPORTANT NOTES
-- ============================================================

-- ✅ ALWAYS auto-confirm emails in Supabase Auth
--    Otherwise users will get "Email not confirmed" error

-- ✅ school_code MUST be 6 digits
--    Default: 541021 (GSNYAGAHANDAGAZA)

-- ✅ sdms_code for teachers MUST be:
--    - 10 digits
--    - UNIQUE (no duplicates)
--    - Can be NULL for admins

-- ✅ Email MUST match between auth.users and profiles
--    Case-insensitive but should be consistent

-- ✅ Multiple admins with SAME school_code
--    Will automatically share the same portal
--    Data syncs in real-time

-- ✅ After adding user, they can login immediately
--    Auto-redirect based on role:
--    - Admin → admin-portal.html
--    - Teacher → teacher-portal.html

---

-- ============================================================
-- TROUBLESHOOTING
-- ============================================================

-- Q: User says "Institutional record not found"
-- A: Profile doesn't exist. Run INSERT query from METHOD 1 or 2

-- Q: User says "Email not confirmed"
-- A: Email not auto-confirmed in Supabase Auth
--    Fix: Supabase Dashboard → Authentication → Users
--         Find user → Check "Email confirmed" → Save

-- Q: Login fails with 400 error
-- A: Profile exists but might have wrong data
--    Check: Verify email matches exactly (case-sensitive in some cases)
--    Run: SELECT * FROM profiles WHERE email = 'user@email.com';

-- Q: Multiple teachers same SDMS code error
-- A: Run validation query to find duplicates
--    Update one of them with unique SDMS code

-- Q: User assigned to wrong school
-- A: Update school_code: 
--    UPDATE profiles SET school_code = '541021' WHERE email = 'user@email.com';

