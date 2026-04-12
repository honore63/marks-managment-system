-- ============================================================
-- MULTI-ADMIN SYNCHRONIZED PORTAL SETUP
-- Implementation: All Admins with same School Code operate
-- in ONE unified portal with REAL-TIME synchronization
-- ============================================================

-- ============================================================
-- PART 1: ENSURE SCHOOL_CODE IN ALL CRITICAL TABLES
-- ============================================================

-- Profiles (Teachers & Admins)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS school_code TEXT DEFAULT 'DEFAULT';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_profiles_school_code ON profiles(school_code);

-- Students
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_code TEXT DEFAULT 'DEFAULT';
CREATE INDEX IF NOT EXISTS idx_students_school_code ON students(school_code);

-- Classes
ALTER TABLE classes ADD COLUMN IF NOT EXISTS school_code TEXT DEFAULT 'DEFAULT';
CREATE INDEX IF NOT EXISTS idx_classes_school_code ON classes(school_code);

-- Subjects (shared across school codes to reduce duplication)
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS school_code TEXT;
CREATE INDEX IF NOT EXISTS idx_subjects_school_code ON subjects(school_code);

-- Marks
ALTER TABLE marks ADD COLUMN IF NOT EXISTS school_code TEXT DEFAULT 'DEFAULT';
CREATE INDEX IF NOT EXISTS idx_marks_school_code ON marks(school_code);

-- Teacher Assignments
ALTER TABLE teacher_assignments ADD COLUMN IF NOT EXISTS school_code TEXT DEFAULT 'DEFAULT';
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_school_code ON 
    teacher_assignments(school_code);

-- Assessments
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS school_code TEXT;
CREATE INDEX IF NOT EXISTS idx_assessments_school_code ON assessments(school_code);

-- ============================================================
-- PART 2: CREATE SCHOOLS TABLE (Central Registry)
-- ============================================================

CREATE TABLE IF NOT EXISTS schools (
    code TEXT PRIMARY KEY, -- 6-digit school code like 541021
    name TEXT NOT NULL,
    district TEXT,
    sector TEXT,
    level TEXT DEFAULT 'PRIMARY',
    email TEXT,
    phone TEXT,
    headteacher TEXT,
    logo_path TEXT,
    academic_year TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add school_code reference to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS school_code_ref TEXT REFERENCES schools(code) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_profiles_school_code_ref ON profiles(school_code_ref);

-- ============================================================
-- PART 3: REAL-TIME REPLICATION SETUP
-- Enable REPLICA IDENTITY FULL for all tables
-- ============================================================

ALTER TABLE profiles              REPLICA IDENTITY FULL;
ALTER TABLE students              REPLICA IDENTITY FULL;
ALTER TABLE classes               REPLICA IDENTITY FULL;
ALTER TABLE subjects              REPLICA IDENTITY FULL;
ALTER TABLE assessments           REPLICA IDENTITY FULL;
ALTER TABLE marks                 REPLICA IDENTITY FULL;
ALTER TABLE teacher_assignments   REPLICA IDENTITY FULL;
ALTER TABLE schools               REPLICA IDENTITY FULL;
ALTER TABLE settings              REPLICA IDENTITY FULL;

-- ⚠️ CRITICAL STEP:
-- After running the above, you MUST enable Realtime in Supabase:
-- 1. Go to Supabase Dashboard → Database → Replication
-- 2. Click the "supabase_realtime" publication
-- 3. Toggle ON for these tables (if not already on):
--    ✅ profiles
--    ✅ students
--    ✅ classes
--    ✅ subjects
--    ✅ assessments
--    ✅ marks
--    ✅ teacher_assignments
--    ✅ schools
--    ✅ settings

-- ============================================================
-- PART 4: SCHOOL INFO MANAGEMENT TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS school_settings (
    school_code TEXT PRIMARY KEY REFERENCES schools(code) ON DELETE CASCADE,
    info JSONB, -- Stores full school info: name, district, sector, etc
    grading_scale JSONB, -- School's custom grading scale
    curriculum JSONB, -- Core subjects for this school
    academic_year TEXT,
    term INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_settings_code ON school_settings(school_code);

-- ============================================================
-- PART 5: ADMIN REGISTRATION RULE
-- Trigger to enforce: New admin automatically joins portal
-- if school code exists, or creates new one
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_school_code_rule()
RETURNS TRIGGER AS $$
BEGIN
    -- When a new admin/teacher is created, ensure school_code is set
    IF NEW.role = 'admin' AND NEW.school_code IS NULL THEN
        -- Find the school code from the request context (set by app)
        -- If not found, use 'DEFAULT'
        NEW.school_code := COALESCE(
            current_setting('app.school_code', true), 
            'DEFAULT'
        );
    END IF;
    
    -- Ensure school_code_ref is set if school_code is provided
    IF NEW.school_code IS NOT NULL AND NEW.school_code != 'DEFAULT' THEN
        NEW.school_code_ref := NEW.school_code;
    END IF;
    
    -- Always update last sync timestamp
    NEW.last_sync_at := now();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if present
DROP TRIGGER IF EXISTS enforce_school_code_on_insert ON profiles;

-- Create trigger on profiles insert/update
CREATE TRIGGER enforce_school_code_on_insert
BEFORE INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION enforce_school_code_rule();

-- ============================================================
-- PART 6: SAMPLE DATA - SCHOOL REGISTRATION
-- ============================================================

-- Insert the school you just created: GSNYAGAHANDAGAZA
INSERT INTO schools (code, name, district, sector, email, phone) 
VALUES ('541021', 'GSNYAGAHANDAGAZA', 'KAYONZA', 'GAHINI', 'info@gsnyagahandagaza.rw', '+250 719 000 000')
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name,
    district = EXCLUDED.district,
    sector = EXCLUDED.sector;

-- Insert school settings
INSERT INTO school_settings (school_code, info, academic_year, term) 
VALUES (
    '541021',
    jsonb_build_object(
        'school', 'GSNYAGAHANDAGAZA',
        'republic', 'REPUBLIC OF RWANDA',
        'ministry', 'MINISTRY OF EDUCATION',
        'district', 'KAYONZA',
        'sector', 'GAHINI',
        'code', '541021',
        'level', 'PRIMARY',
        'email', 'info@gsnyagahandagaza.rw',
        'phone', '+250 719 000 000',
        'headteacher', 'HEADTEACHER NAME',
        'active_year', '2025/2026'
    ),
    '2025/2026',
    2
) ON CONFLICT (school_code) DO UPDATE SET info = EXCLUDED.info;

-- ============================================================
-- PART 7: ENFORCE UNIFIED PORTAL RULE - DATA FILTERING
-- All queries MUST filter by school_code
-- ============================================================

-- Example: View for getting all students of a school
CREATE OR REPLACE VIEW school_students AS
SELECT s.*, c.name as class_name
FROM students s
LEFT JOIN classes c ON c.id = s.class_id
WHERE s.school_code = current_setting('app.school_code', true);

-- Example: View for getting all teachers of a school
CREATE OR REPLACE VIEW school_teachers AS
SELECT * FROM profiles
WHERE role = 'teacher'
  AND school_code = current_setting('app.school_code', true);

-- Example: View for getting all marks of a school
CREATE OR REPLACE VIEW school_marks AS
SELECT * FROM marks
WHERE school_code = current_setting('app.school_code', true);

-- ============================================================
-- PART 8: REAL-TIME SYNC CHANNELS (For SUBSCRIPTIONS)
-- Setup notification system for real-time updates
-- ============================================================

CREATE OR REPLACE FUNCTION notify_data_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'data_changes_' || COALESCE(NEW.school_code, OLD.school_code, 'DEFAULT'),
        json_build_object(
            'table', TG_TABLE_NAME,
            'action', TG_OP,
            'school_code', COALESCE(NEW.school_code, OLD.school_code),
            'timestamp', now()
        )::text
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Attach notification triggers to all critical tables
DROP TRIGGER IF EXISTS notify_changes_profiles ON profiles;
DROP TRIGGER IF EXISTS notify_changes_students ON students;
DROP TRIGGER IF EXISTS notify_changes_marks ON marks;

CREATE TRIGGER notify_changes_profiles
AFTER INSERT OR UPDATE OR DELETE ON profiles
FOR EACH ROW EXECUTE FUNCTION notify_data_change();

CREATE TRIGGER notify_changes_students
AFTER INSERT OR UPDATE OR DELETE ON students
FOR EACH ROW EXECUTE FUNCTION notify_data_change();

CREATE TRIGGER notify_changes_marks
AFTER INSERT OR UPDATE OR DELETE ON marks
FOR EACH ROW EXECUTE FUNCTION notify_data_change();

-- ============================================================
-- PART 9: MIGRATION - ASSOCIATE EXISTING DATA WITH SCHOOL CODE
-- ============================================================

-- Update profiles to have school_code (if NULL)
UPDATE profiles SET school_code = '541021' 
WHERE school_code IS NULL OR school_code = 'DEFAULT';

-- Update students to have school_code (if NULL)
UPDATE students SET school_code = '541021' 
WHERE school_code IS NULL OR school_code = 'DEFAULT';

-- Update classes to have school_code (if NULL)
UPDATE classes SET school_code = '541021' 
WHERE school_code IS NULL OR school_code = 'DEFAULT';

-- Update marks to have school_code (if NULL)
UPDATE marks SET school_code = '541021' 
WHERE school_code IS NULL OR school_code = 'DEFAULT';

-- Update teacher_assignments to have school_code (if NULL)
UPDATE teacher_assignments SET school_code = '541021' 
WHERE school_code IS NULL OR school_code = 'DEFAULT';

-- ============================================================
-- PART 10: VERIFY SETUP
-- ============================================================

-- Check schools table
SELECT * FROM schools;

-- Check school_settings table
SELECT * FROM school_settings;

-- See a sample of profiles with school_code
SELECT id, full_name, email, role, school_code FROM profiles LIMIT 10;

-- Count records per school_code
SELECT school_code, COUNT(*) as record_count FROM profiles GROUP BY school_code;
SELECT school_code, COUNT(*) as record_count FROM students GROUP BY school_code;

-- Verify REPLICA IDENTITY is FULL
SELECT 
    schemaname,
    tablename,
    (SELECT reloptions FROM pg_class WHERE oid = ('public.' || tablename)::regclass) as reloptions
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'students', 'classes', 'marks');

-- ============================================================
-- IMPLEMENTATION CHECKLIST
-- ============================================================
-- 
-- [ ] 1. Run Part 1: Add school_code columns & indexes
-- [ ] 2. Run Part 2: Create schools table
-- [ ] 3. Run Part 3: Enable REPLICA IDENTITY FULL
-- [ ] 4. Run Part 4: Create school_settings table
-- [ ] 5. Run Part 5: Create trigger for school_code enforcement
-- [ ] 6. Run Part 6: Insert school data
-- [ ] 7. Run Part 7: Create filtered views
-- [ ] 8. Run Part 8: Setup notification system
-- [ ] 9. Run Part 9: Migrate existing data
-- [ ] 10. Run Part 10: Verify setup
-- [ ] 11. GO TO: Supabase Dashboard → Database → Replication
-- [ ] 12. ENABLE: supabase_realtime publication for ALL tables above
-- [ ] 13. Update app code (db.js, admin.js) to use new schema
-- 
-- ============================================================
