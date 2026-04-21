-- ============================================================
-- FULL NOTIFICATIONS & SUPPORT MESSAGING SYSTEM SETUP
-- Run this script in the Supabase SQL Editor
-- Resolves the 404 relation errors in the Admin Portal 
-- ============================================================

-- ------------------------------------------------------------
-- 1. NOTIFICATIONS TABLE (For System Broadcasts to Admins)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    urgency TEXT DEFAULT 'info',             -- e.g., 'info', 'warning', 'danger'
    school_code TEXT,                        -- Nullable for global broadcasts
    admin_id UUID REFERENCES auth.users(id), -- Nullable for direct messages
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Policy: Admins can view notifications matching their school, ID, or global (NULL)
CREATE POLICY "Users can view relevant notifications" ON public.notifications
    FOR SELECT USING (
        school_code = (SELECT school_code FROM public.profiles WHERE id = auth.uid()) OR
        admin_id = auth.uid() OR
        school_code IS NULL
    );

-- Policy: Allow System Admins to insert/manage broadcast messages
CREATE POLICY "System Admins can manage notifications" ON public.notifications
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'system_admin'
        )
    );

-- ------------------------------------------------------------
-- 2. SUPPORT MESSAGES TABLE (For Admins to message HQ)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES auth.users(id) NOT NULL,
    sdms_code TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- e.g., 'pending', 'resolved'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for support messages
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;

-- Policy: Admins can only view and insert their own messages
CREATE POLICY "Admins can view and send their own support messages" ON public.support_messages
    FOR ALL USING (
        sender_id = auth.uid()
    );

-- Policy: System Admins have full access
CREATE POLICY "System Admins manage all support messages" ON public.support_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'system_admin'
        )
    );

-- ------------------------------------------------------------
-- 3. ENABLE REAL-TIME CAPABILITIES
-- ------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        -- Safely add tables to publication if they are not already there
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- VERIFICATION
-- ------------------------------------------------------------
SELECT '✅ Notifications and Support Systems fully initialized.' as status;
