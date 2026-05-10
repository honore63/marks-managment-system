-- ============================================================
-- ADMIN LOGIN FIX - RUN IN SUPABASE SQL EDITOR
-- ============================================================

-- QUERY 1: Check if profiles exist for your auth users
-- Run this first to see what's missing
SELECT 
  id, 
  email, 
  full_name, 
  school_code, 
  role,
  created_at
FROM public.profiles 
WHERE email IN ('develperhonore@gmail.com', 'homoreclighomo@gmail.com', 'tuyishimehonore3@gmail.com')
ORDER BY created_at DESC;


-- ============================================================
-- QUERY 2: If profiles are missing, INSERT THEM
-- Run this to create missing profile records
-- ============================================================

INSERT INTO public.profiles (id, email, full_name, role, school_code, created_at)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email),
  'admin',
  '541021',
  NOW()
FROM auth.users au
WHERE au.email IN ('develperhonore@gmail.com', 'homoreclighomo@gmail.com', 'tuyishimehonore3@gmail.com')
AND NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- QUERY 3: Verify all 3 profiles now exist with correct data
-- Run after the INSERT to confirm everything worked
-- ============================================================

SELECT 
  id, 
  email, 
  full_name, 
  school_code, 
  role,
  created_at
FROM public.profiles 
WHERE email IN ('develperhonore@gmail.com', 'homoreclighomo@gmail.com', 'tuyishimehonore3@gmail.com')
ORDER BY email;


-- ============================================================
-- QUERY 4: Check auth users are confirmed
-- Should show "Confirmed at" with a timestamp
-- ============================================================

SELECT 
  id,
  email,
  created_at,
  confirmed_at,
  last_sign_in_at
FROM auth.users
WHERE email IN ('develperhonore@gmail.com', 'homoreclighomo@gmail.com', 'tuyishimehonore3@gmail.com')
ORDER BY email;
