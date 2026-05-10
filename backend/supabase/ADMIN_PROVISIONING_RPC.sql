-- ============================================================
-- INSTITUTIONAL PROVISIONING ENGINE
-- Marks Management System - Automated User Creation
-- ============================================================

/**
 * RPC: create_school_admin
 * Provisions a new school administrator with automated email generation.
 * Enables JIT (Just-In-Time) auth provisioning on first login.
 */
CREATE OR REPLACE FUNCTION create_school_admin(
    p_school_code TEXT,
    p_full_name TEXT,
    p_email TEXT DEFAULT NULL
)
RETURNS TABLE(id UUID, email TEXT, status TEXT) AS $$
DECLARE
    v_email TEXT;
    v_profile_id UUID;
BEGIN
    -- 1. Determine Email based on business rules
    -- Rule: If email not provided, generate sdms{school_code}@mms.rw
    v_email := COALESCE(p_email, 'sdms' || p_school_code || '@mms.rw');
    
    -- 2. Insert into profiles with temp_password_active enabled
    -- This triggers the JIT flow in the frontend DB.js
    INSERT INTO public.profiles (
        email,
        full_name,
        role,
        school_code,
        temp_password_active,
        created_at
    ) VALUES (
        v_email,
        p_full_name,
        'admin',
        p_school_code,
        TRUE,
        NOW()
    )
    RETURNING public.profiles.id INTO v_profile_id;

    RETURN QUERY SELECT v_profile_id, v_email, 'PROVISIONED'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/**
 * RPC: create_teacher
 * Provisions a new teacher with mandated SDMS-based email format.
 * Enables JIT (Just-In-Time) auth provisioning on first login.
 */
CREATE OR REPLACE FUNCTION create_teacher(
    p_school_code TEXT,
    p_full_name TEXT,
    p_sdms_code TEXT
)
RETURNS TABLE(id UUID, email TEXT, status TEXT) AS $$
DECLARE
    v_email TEXT;
    v_profile_id UUID;
BEGIN
    -- 1. Enforce business rule: Email is ALWAYS sdms{sdms_code}@mms.rw
    v_email := 'sdms' || p_sdms_code || '@mms.rw';
    
    -- 2. Insert into profiles with mandatory SDMS code
    INSERT INTO public.profiles (
        email,
        full_name,
        role,
        school_code,
        sdms_code,
        temp_password_active,
        created_at
    ) VALUES (
        v_email,
        p_full_name,
        'teacher',
        p_school_code,
        p_sdms_code,
        TRUE,
        NOW()
    )
    RETURNING public.profiles.id INTO v_profile_id;

    RETURN QUERY SELECT v_profile_id, v_email, 'PROVISIONED'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PERMISSIONS
-- ============================================================

-- Only authenticated users (System Admin or School Admin) can call these
GRANT EXECUTE ON FUNCTION create_school_admin(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_teacher(TEXT, TEXT, TEXT) TO authenticated;
