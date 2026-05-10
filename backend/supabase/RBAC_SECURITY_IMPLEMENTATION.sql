-- ============================================================
-- RBAC SECURITY IMPLEMENTATION - ENHANCED RLS POLICIES
-- Marks Management System - Role-Based Data Isolation
-- Version: 2.0
-- ============================================================

-- ============================================================
-- SECURITY CONTEXT FUNCTIONS
-- ============================================================

-- Create function to get current user's role, school, and assignments
CREATE OR REPLACE FUNCTION get_user_context()
RETURNS TABLE(user_id UUID, email TEXT, role TEXT, school_code TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.email,
        p.role,
        p.school_code
    FROM profiles p
    WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Get teacher's assigned classes
CREATE OR REPLACE FUNCTION get_teacher_classes(teacher_id UUID)
RETURNS TABLE(class_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ta.class_id
    FROM teacher_assignments ta
    WHERE ta.teacher_id = teacher_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Get teacher's assigned subjects
CREATE OR REPLACE FUNCTION get_teacher_subjects(teacher_id UUID)
RETURNS TABLE(subject_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ta.subject_id
    FROM teacher_assignments ta
    WHERE ta.teacher_id = teacher_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- PART 1: PROFILES TABLE RLS
-- System Admin → Full access
-- Admin → Only their school
-- Teacher → Only their own profile
-- ============================================================

-- Drop existing profiles policies
DROP POLICY IF EXISTS school_isolation_profiles ON profiles;
DROP POLICY IF EXISTS profiles_select_policy ON profiles;
DROP POLICY IF EXISTS profiles_insert_policy ON profiles;
DROP POLICY IF EXISTS profiles_update_policy ON profiles;
DROP POLICY IF EXISTS profiles_delete_policy ON profiles;

-- SELECT: View own profile, admins see their school staff, system admin sees all
CREATE POLICY profiles_select_policy ON profiles
FOR SELECT USING (
    CASE 
        -- System Admin: Full access
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin' THEN true
        -- Admin: See only their school staff
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' THEN 
            school_code = (SELECT school_code FROM profiles WHERE id = auth.uid())
        -- Teacher: See only themselves
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher' THEN
            id = auth.uid()
        ELSE false
    END
);

-- INSERT: Only system admin can create profiles
CREATE POLICY profiles_insert_policy ON profiles
FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin'
);

-- UPDATE: Admins can update their school staff, teachers update themselves
CREATE POLICY profiles_update_policy ON profiles
FOR UPDATE USING (
    CASE 
        -- System Admin: Update anyone
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin' THEN true
        -- Admin: Update only their school staff
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' THEN
            school_code = (SELECT school_code FROM profiles WHERE id = auth.uid())
        -- Teacher: Update only themselves
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher' THEN
            id = auth.uid()
        ELSE false
    END
) WITH CHECK (
    CASE 
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin' THEN true
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' THEN
            school_code = (SELECT school_code FROM profiles WHERE id = auth.uid())
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher' THEN
            id = auth.uid()
        ELSE false
    END
);

-- DELETE: Only system admin can delete profiles
CREATE POLICY profiles_delete_policy ON profiles
FOR DELETE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin'
);

-- ============================================================
-- PART 2: STUDENTS TABLE RLS
-- System Admin → Full access
-- Admin → Only students in their school
-- Teacher → Only students in their assigned classes
-- ============================================================

DROP POLICY IF EXISTS school_isolation_students ON students;
DROP POLICY IF EXISTS students_select_policy ON students;
DROP POLICY IF EXISTS students_insert_policy ON students;
DROP POLICY IF EXISTS students_update_policy ON students;
DROP POLICY IF EXISTS students_delete_policy ON students;

-- SELECT: Admins see school students, teachers see class students
CREATE POLICY students_select_policy ON students
FOR SELECT USING (
    CASE 
        -- System Admin: Full access
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin' THEN true
        -- Admin: See only their school students
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' THEN
            school_code = (SELECT school_code FROM profiles WHERE id = auth.uid())
        -- Teacher: See only students in their assigned classes
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher' THEN
            class_id IN (SELECT get_teacher_classes(auth.uid()))
        ELSE false
    END
);

-- INSERT: Admins and teachers can add students to their scope
CREATE POLICY students_insert_policy ON students
FOR INSERT WITH CHECK (
    CASE 
        -- System Admin: Can add to any school
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin' THEN true
        -- Admin: Can add to their school only
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' THEN
            school_code = (SELECT school_code FROM profiles WHERE id = auth.uid())
        -- Teacher: Can add to their classes only
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher' THEN
            class_id IN (SELECT get_teacher_classes(auth.uid()))
        ELSE false
    END
);

-- UPDATE: Admins and teachers can update students in their scope
CREATE POLICY students_update_policy ON students
FOR UPDATE USING (
    CASE 
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin' THEN true
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' THEN
            school_code = (SELECT school_code FROM profiles WHERE id = auth.uid())
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher' THEN
            class_id IN (SELECT get_teacher_classes(auth.uid()))
        ELSE false
    END
) WITH CHECK (
    CASE 
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin' THEN true
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' THEN
            school_code = (SELECT school_code FROM profiles WHERE id = auth.uid())
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher' THEN
            class_id IN (SELECT get_teacher_classes(auth.uid()))
        ELSE false
    END
);

-- DELETE: Admins and system admin can delete
CREATE POLICY students_delete_policy ON students
FOR DELETE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('system_admin', 'admin')
);

-- ============================================================
-- PART 3: MARKS TABLE RLS
-- System Admin → Full access
-- Admin → Only marks in their school
-- Teacher → Only marks for their subjects/classes
-- ============================================================

DROP POLICY IF EXISTS school_isolation_marks ON marks;
DROP POLICY IF EXISTS marks_select_policy ON marks;
DROP POLICY IF EXISTS marks_insert_policy ON marks;
DROP POLICY IF EXISTS marks_update_policy ON marks;

-- SELECT: Admins see school marks, teachers see their subject marks
CREATE POLICY marks_select_policy ON marks
FOR SELECT USING (
    CASE 
        -- System Admin: Full access
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin' THEN true
        -- Admin: See only their school marks
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' THEN
            school_code = (SELECT school_code FROM profiles WHERE id = auth.uid())
        -- Teacher: See only marks for their subjects in their classes
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher' THEN
            class_id IN (SELECT get_teacher_classes(auth.uid()))
            AND subject_id IN (SELECT get_teacher_subjects(auth.uid()))
        ELSE false
    END
);

-- INSERT: Only teachers can insert marks for their subjects
CREATE POLICY marks_insert_policy ON marks
FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher'
    AND class_id IN (SELECT get_teacher_classes(auth.uid()))
    AND subject_id IN (SELECT get_teacher_subjects(auth.uid()))
);

-- UPDATE: Admins can update all school marks, teachers can update their own entries
CREATE POLICY marks_update_policy ON marks
FOR UPDATE USING (
    CASE 
        -- System Admin: Full access
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin' THEN true
        -- Admin: Update only their school marks
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' THEN
            school_code = (SELECT school_code FROM profiles WHERE id = auth.uid())
        -- Teacher: Update only their own mark entries
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher' THEN
            class_id IN (SELECT get_teacher_classes(auth.uid()))
            AND subject_id IN (SELECT get_teacher_subjects(auth.uid()))
        ELSE false
    END
) WITH CHECK (
    CASE 
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin' THEN true
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' THEN
            school_code = (SELECT school_code FROM profiles WHERE id = auth.uid())
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher' THEN
            class_id IN (SELECT get_teacher_classes(auth.uid()))
            AND subject_id IN (SELECT get_teacher_subjects(auth.uid()))
        ELSE false
    END
);

-- ============================================================
-- PART 4: CLASSES TABLE RLS
-- ============================================================

DROP POLICY IF EXISTS school_isolation_classes ON classes;
DROP POLICY IF EXISTS classes_select_policy ON classes;
DROP POLICY IF EXISTS classes_insert_policy ON classes;
DROP POLICY IF EXISTS classes_update_policy ON classes;
DROP POLICY IF EXISTS classes_delete_policy ON classes;

-- SELECT: Admins see school classes, teachers see their assigned classes
CREATE POLICY classes_select_policy ON classes
FOR SELECT USING (
    CASE 
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin' THEN true
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' THEN
            school_code = (SELECT school_code FROM profiles WHERE id = auth.uid())
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher' THEN
            id IN (SELECT get_teacher_classes(auth.uid()))
        ELSE false
    END
);

-- INSERT: Only admins and system admin
CREATE POLICY classes_insert_policy ON classes
FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('system_admin', 'admin')
    AND school_code = CASE
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin' THEN school_code
        ELSE (SELECT school_code FROM profiles WHERE id = auth.uid())
    END
);

-- UPDATE: Admins update their school classes
CREATE POLICY classes_update_policy ON classes
FOR UPDATE USING (
    CASE 
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin' THEN true
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' THEN
            school_code = (SELECT school_code FROM profiles WHERE id = auth.uid())
        ELSE false
    END
) WITH CHECK (
    CASE 
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin' THEN true
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' THEN
            school_code = (SELECT school_code FROM profiles WHERE id = auth.uid())
        ELSE false
    END
);

-- DELETE: Only admins and system admin
CREATE POLICY classes_delete_policy ON classes
FOR DELETE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('system_admin', 'admin')
    AND school_code = (SELECT school_code FROM profiles WHERE id = auth.uid()
        UNION
        SELECT school_code FROM profiles WHERE role = 'system_admin' AND id = auth.uid())
);

-- ============================================================
-- PART 5: SUBJECTS TABLE RLS
-- ============================================================

DROP POLICY IF EXISTS school_isolation_subjects ON subjects;
DROP POLICY IF EXISTS subjects_select_policy ON subjects;
DROP POLICY IF EXISTS subjects_insert_policy ON subjects;
DROP POLICY IF EXISTS subjects_update_policy ON subjects;
DROP POLICY IF EXISTS subjects_delete_policy ON subjects;

-- SELECT: Admins see school subjects, teachers see subjects they teach
CREATE POLICY subjects_select_policy ON subjects
FOR SELECT USING (
    CASE 
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin' THEN true
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' THEN
            school_code = (SELECT school_code FROM profiles WHERE id = auth.uid())
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher' THEN
            id IN (SELECT get_teacher_subjects(auth.uid()))
        ELSE false
    END
);

-- INSERT: Only admins and system admin
CREATE POLICY subjects_insert_policy ON subjects
FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('system_admin', 'admin')
    AND school_code = CASE
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin' THEN school_code
        ELSE (SELECT school_code FROM profiles WHERE id = auth.uid())
    END
);

-- UPDATE: Admins update their school subjects
CREATE POLICY subjects_update_policy ON subjects
FOR UPDATE USING (
    CASE 
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin' THEN true
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' THEN
            school_code = (SELECT school_code FROM profiles WHERE id = auth.uid())
        ELSE false
    END
) WITH CHECK (
    CASE 
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin' THEN true
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' THEN
            school_code = (SELECT school_code FROM profiles WHERE id = auth.uid())
        ELSE false
    END
);

-- DELETE: Only admins and system admin
CREATE POLICY subjects_delete_policy ON subjects
FOR DELETE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('system_admin', 'admin')
    AND school_code = (SELECT school_code FROM profiles WHERE id = auth.uid()
        UNION
        SELECT school_code FROM profiles WHERE role = 'system_admin' AND id = auth.uid())
);

-- ============================================================
-- PART 6: TEACHER_ASSIGNMENTS TABLE RLS
-- ============================================================

DROP POLICY IF EXISTS assignments_select_policy ON teacher_assignments;
DROP POLICY IF EXISTS assignments_insert_policy ON teacher_assignments;
DROP POLICY IF EXISTS assignments_update_policy ON teacher_assignments;
DROP POLICY IF EXISTS assignments_delete_policy ON teacher_assignments;

CREATE POLICY assignments_select_policy ON teacher_assignments
FOR SELECT USING (
    CASE 
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin' THEN true
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' THEN
            school_code = (SELECT school_code FROM profiles WHERE id = auth.uid())
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'teacher' THEN
            teacher_id = auth.uid()
        ELSE false
    END
);

CREATE POLICY assignments_insert_policy ON teacher_assignments
FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('system_admin', 'admin')
    AND school_code = CASE
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin' THEN school_code
        ELSE (SELECT school_code FROM profiles WHERE id = auth.uid())
    END
);

CREATE POLICY assignments_update_policy ON teacher_assignments
FOR UPDATE USING (
    CASE 
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin' THEN true
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' THEN
            school_code = (SELECT school_code FROM profiles WHERE id = auth.uid())
        ELSE false
    END
) WITH CHECK (
    CASE 
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin' THEN true
        WHEN (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' THEN
            school_code = (SELECT school_code FROM profiles WHERE id = auth.uid())
        ELSE false
    END
);

CREATE POLICY assignments_delete_policy ON teacher_assignments
FOR DELETE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('system_admin', 'admin')
    AND school_code = (SELECT school_code FROM profiles WHERE id = auth.uid()
        UNION
        SELECT school_code FROM profiles WHERE role = 'system_admin' AND id = auth.uid())
);

-- ============================================================
-- PART 7: SCHOOLS TABLE RLS
-- ============================================================

DROP POLICY IF EXISTS sysadmin_all_schools ON schools;
DROP POLICY IF EXISTS schools_select_policy ON schools;

-- SELECT: System admin sees all, others see their own
CREATE POLICY schools_select_policy ON schools
FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin'
    OR sdms_code = (SELECT school_code FROM profiles WHERE id = auth.uid())
);

-- ============================================================
-- PART 8: NOTIFICATIONS TABLE RLS
-- ============================================================

DROP POLICY IF EXISTS notifications_select_policy ON notifications;
DROP POLICY IF EXISTS notifications_insert_policy ON notifications;

CREATE POLICY notifications_select_policy ON notifications
FOR SELECT USING (
    -- System admin sees all
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin'
    -- Others see notifications for their school or personal
    OR (school_code = (SELECT school_code FROM profiles WHERE id = auth.uid())
        OR admin_id = auth.uid())
);

CREATE POLICY notifications_insert_policy ON notifications
FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('system_admin', 'admin')
);

-- ============================================================
-- PART 9: SUPPORT_MESSAGES TABLE RLS
-- ============================================================

DROP POLICY IF EXISTS sysadmin_all_messages ON support_messages;
DROP POLICY IF EXISTS messages_select_policy ON support_messages;
DROP POLICY IF EXISTS messages_insert_policy ON support_messages;

CREATE POLICY messages_select_policy ON support_messages
FOR SELECT USING (
    -- System admin sees all
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin'
    -- Senders see their own messages
    OR sender_id = auth.uid()
);

CREATE POLICY messages_insert_policy ON support_messages
FOR INSERT WITH CHECK (
    sender_id = auth.uid()
);

-- ============================================================
-- AUDIT LOGGING FUNCTION
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id TEXT,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

CREATE OR REPLACE FUNCTION audit_log_action()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
        auth.uid(),
        TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id::TEXT, OLD.id::TEXT),
        to_jsonb(OLD),
        to_jsonb(NEW)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach audit triggers to sensitive tables
DROP TRIGGER IF EXISTS audit_marks_changes ON marks;
CREATE TRIGGER audit_marks_changes
    AFTER INSERT OR UPDATE OR DELETE ON marks
    FOR EACH ROW EXECUTE FUNCTION audit_log_action();

DROP TRIGGER IF EXISTS audit_students_changes ON students;
CREATE TRIGGER audit_students_changes
    AFTER INSERT OR UPDATE OR DELETE ON students
    FOR EACH ROW EXECUTE FUNCTION audit_log_action();

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT EXECUTE ON FUNCTION get_user_context() TO authenticated;
GRANT EXECUTE ON FUNCTION get_teacher_classes(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_teacher_subjects(UUID) TO authenticated;
GRANT SELECT ON audit_logs TO authenticated;
