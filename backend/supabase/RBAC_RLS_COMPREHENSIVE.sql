-- ============================================================
-- COMPREHENSIVE ROLE-BASED DATA ACCESS CONTROL (RLS)
-- Marks Management System - Complete Implementation
-- Version: 3.0
-- ============================================================
-- CRITICAL: Run this AFTER FINAL_INSTITUTIONAL_SCHEMA.sql
-- Provides strict isolation: System Admin > School Admin > Teacher

-- ============================================================
-- PART 1: CONTEXT & HELPER FUNCTIONS
-- ============================================================

-- Get current user's context (cached)
CREATE OR REPLACE FUNCTION get_user_context()
RETURNS TABLE(user_id UUID, email TEXT, role TEXT, school_code TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        auth.uid(),
        p.email,
        p.role,
        p.school_code
    FROM profiles p
    WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Get teacher's assigned classes
CREATE OR REPLACE FUNCTION get_teacher_classes()
RETURNS SETOF UUID AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ta.class_id
    FROM teacher_assignments ta
    WHERE ta.teacher_id = auth.uid()
    AND ta.type IN ('class', 'subject');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Get teacher's assigned subjects
CREATE OR REPLACE FUNCTION get_teacher_subjects()
RETURNS SETOF UUID AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ta.subject_id
    FROM teacher_assignments ta
    WHERE ta.teacher_id = auth.uid();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if user is system admin
CREATE OR REPLACE FUNCTION is_system_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if user is school admin
CREATE OR REPLACE FUNCTION is_school_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if user is teacher
CREATE OR REPLACE FUNCTION is_teacher()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Get current user's school code
CREATE OR REPLACE FUNCTION get_user_school()
RETURNS TEXT AS $$
BEGIN
    RETURN (SELECT school_code FROM profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- PART 2: AUTHENTICATION & CORE PROFILES
-- ============================================================

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop old profiles policies
DROP POLICY IF EXISTS profiles_select_policy ON profiles;
DROP POLICY IF EXISTS profiles_insert_policy ON profiles;
DROP POLICY IF EXISTS profiles_update_policy ON profiles;
DROP POLICY IF EXISTS profiles_delete_policy ON profiles;

-- SELECT: System Admin sees all, Admin sees their school staff, Teacher sees themselves only
CREATE POLICY profiles_select_policy ON profiles
FOR SELECT USING (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN 
            school_code = get_user_school()
        WHEN is_teacher() THEN
            id = auth.uid()
        ELSE false
    END
);

-- INSERT: Only system admin can create profiles
CREATE POLICY profiles_insert_policy ON profiles
FOR INSERT WITH CHECK (
    is_system_admin()
);

-- UPDATE: System admin updates anyone, admin updates their school staff, teacher updates themselves
CREATE POLICY profiles_update_policy ON profiles
FOR UPDATE USING (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        WHEN is_teacher() THEN
            id = auth.uid()
        ELSE false
    END
) WITH CHECK (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        WHEN is_teacher() THEN
            id = auth.uid()
        ELSE false
    END
);

-- DELETE: Only system admin can delete profiles
CREATE POLICY profiles_delete_policy ON profiles
FOR DELETE USING (
    is_system_admin()
);

-- ============================================================
-- PART 3: SCHOOLS TABLE
-- ============================================================

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schools_select_policy ON schools;
DROP POLICY IF EXISTS schools_insert_policy ON schools;
DROP POLICY IF EXISTS schools_update_policy ON schools;
DROP POLICY IF EXISTS schools_delete_policy ON schools;

-- SELECT: System admin sees all, others see only their school
CREATE POLICY schools_select_policy ON schools
FOR SELECT USING (
    CASE 
        WHEN is_system_admin() THEN true
        ELSE school_code = get_user_school()
    END
);

-- INSERT: Only system admin
CREATE POLICY schools_insert_policy ON schools
FOR INSERT WITH CHECK (
    is_system_admin()
);

-- UPDATE: Only system admin
CREATE POLICY schools_update_policy ON schools
FOR UPDATE USING (is_system_admin()) WITH CHECK (is_system_admin());

-- DELETE: Only system admin
CREATE POLICY schools_delete_policy ON schools
FOR DELETE USING (
    is_system_admin()
);

-- ============================================================
-- PART 4: CLASSES TABLE
-- ============================================================

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS classes_select_policy ON classes;
DROP POLICY IF EXISTS classes_insert_policy ON classes;
DROP POLICY IF EXISTS classes_update_policy ON classes;
DROP POLICY IF EXISTS classes_delete_policy ON classes;

-- SELECT: System admin sees all, admin sees their school classes, teacher sees assigned classes
CREATE POLICY classes_select_policy ON classes
FOR SELECT USING (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        WHEN is_teacher() THEN
            id IN (SELECT get_teacher_classes())
        ELSE false
    END
);

-- INSERT: Only system admin and school admin (within their school)
CREATE POLICY classes_insert_policy ON classes
FOR INSERT WITH CHECK (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        ELSE false
    END
);

-- UPDATE: System admin updates any, admin updates their school classes
CREATE POLICY classes_update_policy ON classes
FOR UPDATE USING (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        ELSE false
    END
) WITH CHECK (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        ELSE false
    END
);

-- DELETE: System admin and school admin
CREATE POLICY classes_delete_policy ON classes
FOR DELETE USING (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        ELSE false
    END
);

-- ============================================================
-- PART 5: SUBJECTS TABLE
-- ============================================================

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subjects_select_policy ON subjects;
DROP POLICY IF EXISTS subjects_insert_policy ON subjects;
DROP POLICY IF EXISTS subjects_update_policy ON subjects;
DROP POLICY IF EXISTS subjects_delete_policy ON subjects;

-- SELECT: System admin sees all, admin sees their school subjects, teacher sees assigned subjects
CREATE POLICY subjects_select_policy ON subjects
FOR SELECT USING (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        WHEN is_teacher() THEN
            id IN (SELECT get_teacher_subjects())
        ELSE false
    END
);

-- INSERT: Only system admin and school admin
CREATE POLICY subjects_insert_policy ON subjects
FOR INSERT WITH CHECK (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        ELSE false
    END
);

-- UPDATE: System admin and school admin
CREATE POLICY subjects_update_policy ON subjects
FOR UPDATE USING (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        ELSE false
    END
) WITH CHECK (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        ELSE false
    END
);

-- DELETE: System admin and school admin
CREATE POLICY subjects_delete_policy ON subjects
FOR DELETE USING (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        ELSE false
    END
);

-- ============================================================
-- PART 6: STUDENTS TABLE
-- ============================================================

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS students_select_policy ON students;
DROP POLICY IF EXISTS students_insert_policy ON students;
DROP POLICY IF EXISTS students_update_policy ON students;
DROP POLICY IF EXISTS students_delete_policy ON students;

-- SELECT: System admin sees all, admin sees their school students, teacher sees class students only
CREATE POLICY students_select_policy ON students
FOR SELECT USING (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        WHEN is_teacher() THEN
            class_id IN (SELECT get_teacher_classes())
        ELSE false
    END
);

-- INSERT: System admin any school, admin their school, teacher their classes
CREATE POLICY students_insert_policy ON students
FOR INSERT WITH CHECK (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        WHEN is_teacher() THEN
            class_id IN (SELECT get_teacher_classes())
        ELSE false
    END
);

-- UPDATE: System admin any, admin their school, teacher their classes
CREATE POLICY students_update_policy ON students
FOR UPDATE USING (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        WHEN is_teacher() THEN
            class_id IN (SELECT get_teacher_classes())
        ELSE false
    END
) WITH CHECK (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        WHEN is_teacher() THEN
            class_id IN (SELECT get_teacher_classes())
        ELSE false
    END
);

-- DELETE: System admin and school admin only (teachers cannot delete)
CREATE POLICY students_delete_policy ON students
FOR DELETE USING (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        ELSE false
    END
);

-- ============================================================
-- PART 7: TEACHER ASSIGNMENTS TABLE
-- ============================================================

ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teacher_assignments_select_policy ON teacher_assignments;
DROP POLICY IF EXISTS teacher_assignments_insert_policy ON teacher_assignments;
DROP POLICY IF EXISTS teacher_assignments_update_policy ON teacher_assignments;
DROP POLICY IF EXISTS teacher_assignments_delete_policy ON teacher_assignments;

-- SELECT: System admin sees all, admin sees their school assignments, teacher sees their own
CREATE POLICY teacher_assignments_select_policy ON teacher_assignments
FOR SELECT USING (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        WHEN is_teacher() THEN
            teacher_id = auth.uid()
        ELSE false
    END
);

-- INSERT: System admin and school admin only
CREATE POLICY teacher_assignments_insert_policy ON teacher_assignments
FOR INSERT WITH CHECK (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        ELSE false
    END
);

-- UPDATE: System admin and school admin
CREATE POLICY teacher_assignments_update_policy ON teacher_assignments
FOR UPDATE USING (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        ELSE false
    END
) WITH CHECK (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        ELSE false
    END
);

-- DELETE: System admin and school admin
CREATE POLICY teacher_assignments_delete_policy ON teacher_assignments
FOR DELETE USING (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        ELSE false
    END
);

-- ============================================================
-- PART 8: MARKS TABLE (CRITICAL)
-- ============================================================

ALTER TABLE marks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marks_select_policy ON marks;
DROP POLICY IF EXISTS marks_insert_policy ON marks;
DROP POLICY IF EXISTS marks_update_policy ON marks;
DROP POLICY IF EXISTS marks_delete_policy ON marks;

-- SELECT: System admin sees all, admin sees their school marks, teacher sees marks for their subjects/classes
CREATE POLICY marks_select_policy ON marks
FOR SELECT USING (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        WHEN is_teacher() THEN
            class_id IN (SELECT get_teacher_classes())
            AND subject_id IN (SELECT get_teacher_subjects())
        ELSE false
    END
);

-- INSERT: Only teachers for their assigned subjects/classes
CREATE POLICY marks_insert_policy ON marks
FOR INSERT WITH CHECK (
    is_teacher()
    AND class_id IN (SELECT get_teacher_classes())
    AND subject_id IN (SELECT get_teacher_subjects())
);

-- UPDATE: System admin any, admin their school, teacher their entries
CREATE POLICY marks_update_policy ON marks
FOR UPDATE USING (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        WHEN is_teacher() THEN
            class_id IN (SELECT get_teacher_classes())
            AND subject_id IN (SELECT get_teacher_subjects())
        ELSE false
    END
) WITH CHECK (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        WHEN is_teacher() THEN
            class_id IN (SELECT get_teacher_classes())
            AND subject_id IN (SELECT get_teacher_subjects())
        ELSE false
    END
);

-- DELETE: System admin and school admin only
CREATE POLICY marks_delete_policy ON marks
FOR DELETE USING (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        ELSE false
    END
);

-- ============================================================
-- PART 9: NOTIFICATIONS & SUPPORT
-- ============================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_policy ON notifications;
DROP POLICY IF EXISTS notifications_insert_policy ON notifications;

-- SELECT: System admin all, others see their school or personal
CREATE POLICY notifications_select_policy ON notifications
FOR SELECT USING (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN admin_id = auth.uid() THEN true
        WHEN school_code = get_user_school() THEN true
        WHEN school_code IS NULL THEN true -- Global
        ELSE false
    END
);

-- INSERT: Only system admin and admins can create notifications
CREATE POLICY notifications_insert_policy ON notifications
FOR INSERT WITH CHECK (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN 
            school_code = get_user_school()
        ELSE false
    END
);

-- Support messages
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_messages_select_policy ON support_messages;
DROP POLICY IF EXISTS support_messages_insert_policy ON support_messages;

CREATE POLICY support_messages_select_policy ON support_messages
FOR SELECT USING (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN sender_id = auth.uid() THEN true
        ELSE false
    END
);

CREATE POLICY support_messages_insert_policy ON support_messages
FOR INSERT WITH CHECK (true); -- Anyone can submit support

-- ============================================================
-- PART 10: SCHOOL SETTINGS
-- ============================================================

ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_settings_select_policy ON school_settings;
DROP POLICY IF EXISTS school_settings_insert_policy ON school_settings;
DROP POLICY IF EXISTS school_settings_update_policy ON school_settings;

CREATE POLICY school_settings_select_policy ON school_settings
FOR SELECT USING (
    CASE 
        WHEN is_system_admin() THEN true
        ELSE school_code = get_user_school()
    END
);

CREATE POLICY school_settings_insert_policy ON school_settings
FOR INSERT WITH CHECK (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        ELSE false
    END
);

CREATE POLICY school_settings_update_policy ON school_settings
FOR UPDATE USING (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        ELSE false
    END
) WITH CHECK (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() THEN
            school_code = get_user_school()
        ELSE false
    END
);

-- ============================================================
-- PART 11: ASSESSMENTS TABLE
-- ============================================================

ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assessments_select_policy ON assessments;
DROP POLICY IF EXISTS assessments_insert_policy ON assessments;

-- SELECT: System admin sees all, others see their school assessments
CREATE POLICY assessments_select_policy ON assessments
FOR SELECT USING (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN school_code = 'GLOBAL' THEN true -- Global assessments available to all
        WHEN school_code = get_user_school() THEN true
        ELSE false
    END
);

-- INSERT: Only system admin and school admin
CREATE POLICY assessments_insert_policy ON assessments
FOR INSERT WITH CHECK (
    CASE 
        WHEN is_system_admin() THEN true
        WHEN is_school_admin() AND school_code = get_user_school() THEN true
        ELSE false
    END
);

-- ============================================================
-- PART 12: PERFORMANCE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_marks_school_term_year 
    ON marks(school_code, academic_year, term) WHERE is_submitted = true;

CREATE INDEX IF NOT EXISTS idx_marks_teacher_query 
    ON marks(class_id, subject_id) WHERE is_submitted = false;

CREATE INDEX IF NOT EXISTS idx_students_school_class 
    ON students(school_code, class_id);

CREATE INDEX IF NOT EXISTS idx_profiles_school_role 
    ON profiles(school_code, role) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher_school 
    ON teacher_assignments(teacher_id, school_code);

-- ============================================================
-- PART 13: REAL-TIME REPLICA IDENTITY
-- ============================================================

ALTER TABLE profiles REPLICA IDENTITY FULL;
ALTER TABLE students REPLICA IDENTITY FULL;
ALTER TABLE marks REPLICA IDENTITY FULL;
ALTER TABLE classes REPLICA IDENTITY FULL;
ALTER TABLE subjects REPLICA IDENTITY FULL;
ALTER TABLE teacher_assignments REPLICA IDENTITY FULL;
ALTER TABLE schools REPLICA IDENTITY FULL;
ALTER TABLE school_settings REPLICA IDENTITY FULL;

-- ============================================================
-- DEPLOYMENT CHECKLIST
-- ============================================================
-- ✅ Run this after FINAL_INSTITUTIONAL_SCHEMA.sql
-- ✅ Verify all RLS policies are enabled with: SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- ✅ Test with: SELECT * FROM information_schema.table_privileges WHERE table_name = 'profiles';
-- ✅ Verify functions with: SELECT * FROM information_schema.routines WHERE routine_schema = 'public';
-- ✅ In production: Enable Row Level Security enforcement in dashboard settings
