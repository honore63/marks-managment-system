-- ============================================================
-- DATABASE TRIGGERS FOR AUTO-PROFILE CREATION
-- Run in Supabase SQL Editor to enable auto-linking
-- ============================================================

-- ============================================================
-- TRIGGER 1: Auto-Create Profile When Auth User Added
-- ============================================================
-- When a user is created in auth.users, automatically create
-- a profile record in public.profiles

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create profile if email is confirmed
  -- This prevents ghost profiles for unconfirmed users
  IF NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.profiles (
      id,
      email,
      full_name,
      role,
      school_code,
      created_at
    ) VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
      'teacher',  -- Default role is teacher (change to 'admin' if needed)
      '541021',   -- Default school code (admins should update this)
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

---

-- ============================================================
-- TRIGGER 2: Sync Email Updates from Auth to Profile
-- ============================================================
-- If email changes in auth.users, update it in profiles too

CREATE OR REPLACE FUNCTION public.sync_email_from_auth()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email <> OLD.email THEN
    UPDATE public.profiles
    SET email = NEW.email
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_email_updated ON auth.users;
CREATE TRIGGER on_auth_email_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW 
  WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION public.sync_email_from_auth();

---

-- ============================================================
-- TRIGGER 3: Validate School Code Format (6 digits)
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_school_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.school_code IS NOT NULL AND NEW.school_code !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'school_code must be exactly 6 digits';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_school_code_format ON public.profiles;
CREATE TRIGGER check_school_code_format
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_school_code();

---

-- ============================================================
-- TRIGGER 4: Validate SDMS Code Format (10 digits, unique for teachers)
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_sdms_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Check format if sdms_code is provided
  IF NEW.sdms_code IS NOT NULL THEN
    -- Must be exactly 10 digits
    IF NEW.sdms_code !~ '^\d{10}$' THEN
      RAISE EXCEPTION 'sdms_code must be exactly 10 digits';
    END IF;
    
    -- Check uniqueness (no two users with same sdms_code)
    IF EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE sdms_code = NEW.sdms_code 
      AND id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'sdms_code must be unique';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_sdms_code_format ON public.profiles;
CREATE TRIGGER check_sdms_code_format
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_sdms_code();

---

-- ============================================================
-- TRIGGER 5: Update Last Sync Timestamp
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_last_sync()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_sync_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_last_sync_on_insert ON public.profiles;
CREATE TRIGGER update_last_sync_on_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_last_sync();

---

-- ============================================================
-- TRIGGER 6: Prevent Duplicate Emails in Profiles
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_duplicate_emails()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE LOWER(email) = LOWER(NEW.email)
    AND id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'email already exists';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_duplicate_email ON public.profiles;
CREATE TRIGGER check_duplicate_email
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_emails();

---

-- ============================================================
-- VIEW: Get Users by School Code (for admins to see all users)
-- ============================================================

CREATE OR REPLACE VIEW school_users AS
SELECT 
  id,
  email,
  full_name,
  role,
  school_code,
  sdms_code,
  created_at,
  last_sync_at
FROM public.profiles
WHERE school_code IS NOT NULL
ORDER BY school_code, created_at DESC;

---

-- ============================================================
-- VIEW: Get All Admins for a School (for real-time messaging)
-- ============================================================

CREATE OR REPLACE VIEW school_admins AS
SELECT 
  id,
  email,
  full_name,
  school_code,
  created_at,
  last_sync_at
FROM public.profiles
WHERE role = 'admin'
AND school_code IS NOT NULL
ORDER BY school_code, created_at DESC;

---

-- ============================================================
-- VIEW: Get All Teachers for a School
-- ============================================================

CREATE OR REPLACE VIEW school_teachers AS
SELECT 
  id,
  email,
  full_name,
  school_code,
  sdms_code,
  created_at,
  last_sync_at
FROM public.profiles
WHERE role = 'teacher'
AND school_code IS NOT NULL
ORDER BY school_code, created_at DESC;

---

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check all triggers are active:
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
ORDER BY trigger_name;

-- Check all views created:
SELECT 
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'VIEW'
ORDER BY table_name;

---

-- ============================================================
-- NOTES
-- ============================================================

-- ✅ Triggers run automatically - no manual execution needed
-- ✅ Triggers enforce data quality rules
-- ✅ Views help developers quickly query user lists
-- ✅ All triggers have error handling to prevent bad data
-- ✅ Multiple triggers can run on same operation

