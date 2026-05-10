-- ============================================================
-- MARKS MANAGEMENT SYSTEM — FINAL INSTITUTIONAL SCHEMA
-- Implementation: Multi-Tenant Academic Reporting Hub
-- Version: 2026.4.24
-- ============================================================

-- ============================================================
-- PART 1: CORE INSTITUTIONAL REGISTRY
-- ============================================================

-- Central Schools Registry
CREATE TABLE IF NOT EXISTS schools (
    school_code TEXT PRIMARY KEY, -- 6-digit SDMS school code (e.g., 541021)
    name TEXT NOT NULL,
    district TEXT,
    sector TEXT,
    level TEXT DEFAULT 'PRIMARY',
    email TEXT,
    phone TEXT,
    headteacher TEXT,
    academic_year TEXT DEFAULT '2025/2026',
    active_term INTEGER DEFAULT 2,
    logo_path TEXT, -- URL to school logo
    stamp_path TEXT, -- URL to institutional stamp
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Institutional Settings (Config & Branding)
CREATE TABLE IF NOT EXISTS school_settings (
    school_code TEXT PRIMARY KEY REFERENCES schools(school_code) ON DELETE CASCADE,
    info JSONB, -- Stores full school info: name, district, sector, etc.
    grading_scale JSONB, -- School's custom grading scale
    branding JSONB DEFAULT '{
        "primary_color": "#4f46e5",
        "header_style": "classic",
        "show_motto": true
    }',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Global System Settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PART 2: IDENTITY & ACCESS MANAGEMENT
-- ============================================================

-- Profiles (Teachers, Admins, System Admins)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'system_admin')),
    school_code TEXT DEFAULT 'DEFAULT',
    sdms_code TEXT UNIQUE, -- Teacher SDMS ID (10 digits)
    phone TEXT,
    temp_password_active BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ DEFAULT now(),
    headteacher_sig TEXT, 
    dos_sig TEXT,         
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_school_code ON profiles(school_code);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ============================================================
-- PART 3: ACADEMIC STRUCTURE
-- ============================================================

-- Classes
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    school_code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_class_per_school UNIQUE (name, school_code)
);

CREATE INDEX IF NOT EXISTS idx_classes_school_code ON classes(school_code);

-- Subjects
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    abbr TEXT, -- Abbreviation (e.g., MATH, ENG)
    school_code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_subject_per_school UNIQUE (abbr, school_code)
);

CREATE INDEX IF NOT EXISTS idx_subjects_school_code ON subjects(school_code);

-- Students
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    school_code TEXT NOT NULL,
    sdms_code TEXT UNIQUE, -- Student SDMS ID (10 digits)
    gender TEXT CHECK (gender IN ('M', 'F')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_school_code ON students(school_code);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);

-- Assessment Types (Configurable per school or global)
CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY, -- e.g., 'cat1', 'cat2', 'exam'
    name TEXT NOT NULL,
    max_score NUMERIC NOT NULL DEFAULT 50,
    school_code TEXT DEFAULT 'GLOBAL',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Teacher Assignments
CREATE TABLE IF NOT EXISTS teacher_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('class', 'subject')), -- 'class' = Class Teacher, 'subject' = Subject Teacher
    school_code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_lookup ON teacher_assignments(teacher_id, school_code);

-- ============================================================
-- PART 4: PERFORMANCE & REPORTING ENGINE
-- ============================================================

-- Marks
CREATE TABLE IF NOT EXISTS marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    assessment_id TEXT NOT NULL, 
    score NUMERIC NOT NULL,
    max_score NUMERIC NOT NULL DEFAULT 100,
    term INTEGER NOT NULL,
    academic_year TEXT NOT NULL,
    school_code TEXT NOT NULL,
    is_submitted BOOLEAN DEFAULT false,
    submitted_at TIMESTAMPTZ,
    is_approved BOOLEAN DEFAULT false,
    approved_at TIMESTAMPTZ,
    rejection_comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    CONSTRAINT unique_mark_entry UNIQUE (student_id, subject_id, assessment_id, term, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_marks_filtering ON marks(school_code, academic_year, term, class_id);

-- ============================================================
-- PART 5: COMMUNICATION & NOTIFICATIONS
-- ============================================================

-- Global and Institutional Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- Optional: Specific recipient
    school_code TEXT, -- Optional: Specific school
    message TEXT NOT NULL,
    urgency TEXT DEFAULT 'info' CHECK (urgency IN ('info', 'warning', 'error', 'success')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Support Ticket System
CREATE TABLE IF NOT EXISTS support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    school_code TEXT NOT NULL,
    content TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PART 6: SECURITY & AUTOMATION (TRIGGERS)
-- ============================================================

-- 1. Auto-Profile Creation on Auth Sign-Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, school_code)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Member'),
        COALESCE(NEW.raw_user_meta_data->>'role', 'teacher'),
        COALESCE(NEW.raw_user_meta_data->>'school_code', 'DEFAULT')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Synchronized Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;

-- 3. RLS POLICIES (Institutional Isolation)
CREATE POLICY school_isolation_profiles ON profiles FOR ALL USING (school_code = (SELECT school_code FROM profiles WHERE id = auth.uid()) OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin');
CREATE POLICY school_isolation_students ON students FOR ALL USING (school_code = (SELECT school_code FROM profiles WHERE id = auth.uid()) OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin');
CREATE POLICY school_isolation_marks ON marks FOR ALL USING (school_code = (SELECT school_code FROM profiles WHERE id = auth.uid()) OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin');
CREATE POLICY school_isolation_classes ON classes FOR ALL USING (school_code = (SELECT school_code FROM profiles WHERE id = auth.uid()) OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin');
CREATE POLICY school_isolation_subjects ON subjects FOR ALL USING (school_code = (SELECT school_code FROM profiles WHERE id = auth.uid()) OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin');
CREATE POLICY school_isolation_assignments ON teacher_assignments FOR ALL USING (school_code = (SELECT school_code FROM profiles WHERE id = auth.uid()) OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin');
CREATE POLICY school_isolation_settings ON school_settings FOR ALL USING (school_code = (SELECT school_code FROM profiles WHERE id = auth.uid()) OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin');

-- System Admin Global Policies
CREATE POLICY sysadmin_all_schools ON schools FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin');
CREATE POLICY sysadmin_all_messages ON support_messages FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'system_admin');

-- ============================================================
-- PART 7: REAL-TIME REPLICATION
-- ============================================================

ALTER TABLE profiles REPLICA IDENTITY FULL;
ALTER TABLE marks REPLICA IDENTITY FULL;
ALTER TABLE students REPLICA IDENTITY FULL;
ALTER TABLE teacher_assignments REPLICA IDENTITY FULL;
ALTER TABLE classes REPLICA IDENTITY FULL;
ALTER TABLE subjects REPLICA IDENTITY FULL;
ALTER TABLE school_settings REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER TABLE support_messages REPLICA IDENTITY FULL;
