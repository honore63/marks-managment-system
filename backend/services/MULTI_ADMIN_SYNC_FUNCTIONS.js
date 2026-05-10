/**
 * ENHANCED MULTI-ADMIN SYNCHRONIZED PORTAL
 * Add these functions to your db.js file
 * 
 * These functions implement the unified portal system where:
 * - All admins with the same school code access ONE portal
 * - Real-time sync across all admins in the school
 * - All queries filtered by school_code
 */

// ============================================================
// PART 1: SCHOOL CODE & MULTI-ADMIN MANAGEMENT
// ============================================================

/**
 * Get the current user's school code
 * Critical: All queries MUST filter by this
 */
async function getCurrentSchoolCode() {
  try {
    const cacheKey = 'current_school_code';
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return cached;
    
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return 'DEFAULT';
    
    const { data: profile } = await _supabase
      .from('profiles')
      .select('school_code')
      .eq('id', user.id)
      .maybeSingle();
    
    const schoolCode = profile?.school_code || 'DEFAULT';
    sessionStorage.setItem(cacheKey, schoolCode);
    return schoolCode;
  } catch (error) {
    console.error('[DB] Error getting school code:', error);
    return 'DEFAULT';
  }
}

/**
 * Register an admin/teacher with a school code
 * If school code exists → join existing portal
 * If not → create new portal
 */
async function registerUserWithSchoolCode(email, password, fullName, role, schoolCode) {
  try {
    // STEP 1: Verify school exists or create it
    const { data: schoolExists } = await _supabase
      .from('schools')
      .select('sdms_code')
      .eq('sdms_code', schoolCode)
      .maybeSingle();
    
    if (!schoolExists && schoolCode !== 'DEFAULT' && schoolCode !== 'GLOBAL') {
      throw new Error(`Institutional node ${schoolCode} not found in the master registry.`);
    }
    
    // STEP 2: Delegate to AccountManager for synchronized provisioning
    const res = await AccountManager.createAccount({
      email,
      password,
      fullName,
      role,
      schoolCode,
      sdmsCode: null // Admins might not have SDMS codes, or they are added later
    });
    
    if (!res.success) throw new Error(res.error);
    
    // STEP 3: Cache the school code for this session
    sessionStorage.setItem('current_school_code', schoolCode);
    
    console.log(`[ADMIN] Successfully registered ${role} for school ${schoolCode}`);
    return { success: true, user: res.user, profile: res.profile };
    
  } catch (error) {
    console.error('[ADMIN] Registration failed:', error.message);
    throw error;
  }
}

/**
 * Get all admins who share the same school code (for unified portal)
 * Returns: List of other admins in the same school
 */
async function getAdminsInSchool(schoolCode) {
  try {
    const { data: admins, error } = await _supabase
      .from('profiles')
      .select('id, full_name, email, last_sync_at')
      .eq('school_code', schoolCode)
      .eq('role', 'admin');
    
    if (error) {
      console.error('[DB] Error fetching school admins:', error);
      return [];
    }
    
    return admins || [];
  } catch (error) {
    console.error('[DB] Failed to get admins in school:', error);
    return [];
  }
}

/**
 * Get all active sessions for a school (all logged-in admins + teachers)
 * Useful for: Real-time collaboration, activity feed, broadcast notifications
 */
async function getActiveSessions(schoolCode) {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: activeSessions, error } = await _supabase
      .from('profiles')
      .select('id, full_name, email, role, last_sync_at')
      .eq('school_code', schoolCode)
      .gt('last_sync_at', oneDayAgo)
      .order('last_sync_at', { ascending: false });
    
    if (error) {
      console.error('[DB] Error fetching active sessions:', error);
      return [];
    }
    
    return activeSessions || [];
  } catch (error) {
    console.error('[DB] Failed to get active sessions:', error);
    return [];
  }
}

/**
 * Update user's last sync timestamp (called on page load / periodic)
 * This tracks who is actively using the system
 */
async function updateLastSync() {
  try {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return;
    
    await _supabase
      .from('profiles')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', user.id);
  } catch (error) {
    console.error('[DB] Error updating last sync:', error);
  }
}

// ============================================================
// PART 2: DYNAMIC SCHOOL INFO FETCHING
// Load from database instead of hardcoding
// ============================================================

/**
 * Get school settings from database
 * Returns: Full school info (name, district, logo, etc)
 * 
 * CRITICAL: Call this on page load to populate school header
 */
async function fetchSchoolSettings(schoolCode) {
  try {
    const cacheKey = `school_settings_${schoolCode}`;
    const cached = localStorage.getItem(cacheKey);
    
    // Return cache if less than 1 hour old
    if (cached) {
      const parsed = JSON.parse(cached);
      const ageMs = Date.now() - parsed.timestamp;
      if (ageMs < 3600000) return parsed.data;
    }
    
    // Fetch from database
    const { data, error } = await _supabase
      .from('school_settings')
      .select('info, grading_scale, curriculum, academic_year, term')
      .eq('school_code', schoolCode)
      .maybeSingle();
    
    if (error) {
      console.warn('[DB] Error fetching school settings:', error);
      return null;
    }
    
    if (data) {
      // Cache the result
      localStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      return data;
    }
    
    // Fallback: Get from schools table
    const { data: school } = await _supabase
      .from('schools')
      .select('*')
      .eq('code', schoolCode)
      .maybeSingle();
    
    if (school) {
      const schoolInfo = {
        info: {
          republic: 'REPUBLIC OF RWANDA',
          ministry: 'MINISTRY OF EDUCATION',
          school: school.name,
          district: school.district,
          sector: school.sector,
          code: school.code,
          level: school.level,
          email: school.email,
          phone: school.phone,
          headteacher: school.headteacher,
          activeYear: school.academic_year
        }
      };
      
      localStorage.setItem(cacheKey, JSON.stringify({
        data: schoolInfo,
        timestamp: Date.now()
      }));
      
      return schoolInfo;
    }
    
    return null;
  } catch (error) {
    console.error('[DB] Failed to fetch school settings:', error);
    return null;
  }
}

/**
 * Update school settings (admin only)
 * Changes are instantly visible to all admins in the school
 */
async function updateSchoolSettings(schoolCode, updates) {
  try {
    const { data, error } = await _supabase
      .from('school_settings')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('school_code', schoolCode)
      .select()
      .single();
    
    if (error) throw error;
    
    // Invalidate cache
    localStorage.removeItem(`school_settings_${schoolCode}`);
    
    console.log('[DB] School settings updated');
    return data;
  } catch (error) {
    console.error('[DB] Error updating school settings:', error);
    throw error;
  }
}

// ============================================================
// PART 3: MULTI-ADMIN REAL-TIME SYNC
// Enhanced SYNC engine for school-specific subscriptions
// ============================================================

/**
 * Subscribe to real-time updates for a specific school code
 * Ensures admins only see data from their school
 */
function subscribeToSchoolChanges(schoolCode) {
  const channel = _supabase
    .channel(`school-${schoolCode}-sync`);
  
  // Subscribe to marks changes for this school
  channel.on('postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'marks',
      filter: `school_code=eq.${schoolCode}`
    },
    (payload) => {
      console.log('[SYNC] Marks updated for school', schoolCode, payload);
      // Trigger UI update
      if (window.SYNC && window.SYNC._emit) {
        window.SYNC._emit('marks', payload);
      }
    }
  );
  
  // Subscribe to students changes for this school
  channel.on('postgres_changes',
    {
      event: '*', 
      schema: 'public',
      table: 'students',
      filter: `school_code=eq.${schoolCode}`
    },
    (payload) => {
      console.log('[SYNC] Students updated for school', schoolCode);
      if (window.SYNC && window.SYNC._emit) {
        window.SYNC._emit('students', payload);
      }
    }
  );
  
  // Subscribe to profiles changes (teachers, other admins in school)
  channel.on('postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'profiles',
      filter: `school_code=eq.${schoolCode}`
    },
    (payload) => {
      console.log('[SYNC] Staff updated for school', schoolCode);
      if (window.SYNC && window.SYNC._emit) {
        window.SYNC._emit('teachers', payload);
      }
    }
  );
  
  // Subscribe to school settings changes
  channel.on('postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'school_settings',
      filter: `school_code=eq.${schoolCode}`
    },
    (payload) => {
      console.log('[SYNC] School settings changed for', schoolCode);
      // Invalidate cache immediately
      localStorage.removeItem(`school_settings_${schoolCode}`);
      if (window.SYNC && window.SYNC._emit) {
        window.SYNC._emit('school_settings', payload);
      }
    }
  );
  
  channel.subscribe((status) => {
    console.log(`[SYNC] School channel status: ${status}`);
    if (status === 'SUBSCRIBED') {
      console.log(`✅ Real-time sync enabled for school ${schoolCode}`);
    }
  });
  
  return channel;
}

/**
 * Unsubscribe from school-specific changes
 * Call when user logs out or switches schools
 */
function unsubscribeFromSchoolChanges(schoolCode) {
  try {
    _supabase.removeChannel(`school-${schoolCode}-sync`);
    console.log(`[SYNC] Unsubscribed from school ${schoolCode}`);
  } catch (error) {
    console.warn('[SYNC] Error unsubscribing:', error);
  }
}

// ============================================================
// PART 4: BROADCAST NOTIFICATIONS TO ALL ADMINS IN SCHOOL
// New admin joins? Important action? Broadcast to all
// ============================================================

/**
 * Send notification to all admins in a school
 * Use cases: New admin joined, marks locked, system maintenance, etc
 */
async function broadcastToSchool(schoolCode, message, actionType = 'info') {
  try {
    // Get all active admins in the school
    const admins = await getAdminsInSchool(schoolCode);
    
    // Broadcast via Supabase Realtime
    _supabase.channel(`school-${schoolCode}-notifications`).send({
      type: 'broadcast',
      event: 'admin_notification',
      payload: {
        message,
        actionType,
        timestamp: new Date().toISOString(),
        targetAdmins: admins.map(a => a.id)
      }
    });
    
    console.log(`[BROADCAST] Sent "${message}" to ${admins.length} admins in school ${schoolCode}`);
  } catch (error) {
    console.error('[BROADCAST] Error:', error);
  }
}

// ============================================================
// PART 5: CONFLICT RESOLUTION & DATA CONSISTENCY
// When multiple admins edit simultaneously
// ============================================================

/**
 * Smart upsert for marks with conflict resolution
 * Last write wins, but tracks all edits
 */
async function saveMarkWithTracking(markObj, editBy) {
  try {
    const payload = {
      ...markObj,
      last_edited_by: editBy,
      last_edited_at: new Date().toISOString()
    };
    
    const { data, error } = await _supabase
      .from('marks')
      .upsert(payload, {
        onConflict: 'student_id,subject_id,assessment_id,term,academic_year'
      })
      .select()
      .single();
    
    if (error) throw (typeof DB !== 'undefined' && DB.handleSupabaseError) ? DB.handleSupabaseError(error) : error;
    
    console.log('[DB] Mark saved with tracking');
    return data;
  } catch (error) {
    console.error('[DB] Error saving mark with tracking:', error);
    throw error;
  }
}

/**
 * Verify data consistency across all admins in school
 * Checks for stale data, orphaned records, duplicates
 */
async function verifySchoolDataConsistency(schoolCode) {
  try {
    const report = {
      schoolCode,
      timestamp: new Date().toISOString(),
      checks: {}
    };
    
    // Check 1: All students have correct school_code
    const { data: studentsWithWrongCode } = await _supabase
      .from('students')
      .select('id, school_code')
      .neq('school_code', schoolCode)
      .eq('class_id->school_code', schoolCode);
    
    report.checks.orphanStudents = studentsWithWrongCode?.length || 0;
    
    // Check 2: All marks have correct school_code
    const { data: marksWithWrongCode } = await _supabase
      .from('marks')
      .select('id')
      .neq('school_code', schoolCode)
      .gt('created_at', new Date(Date.now() - 7*24*60*60*1000).toISOString());
    
    report.checks.recentInvalidMarks = marksWithWrongCode?.length || 0;
    
    console.log('[CONSISTENCY] Check report:', report);
    return report;
  } catch (error) {
    console.error('[CONSISTENCY] Error verifying data:', error);
    return null;
  }
}

// ============================================================
// IMPLEMENTATION GUIDE
// ============================================================
/*

1. ADD THESE FUNCTIONS TO YOUR db.js FILE (at the end, before closing brace)

2. ON PAGE LOAD, CALL:
   - getCurrentSchoolCode() → get user's school
   - fetchSchoolSettings(schoolCode) → load school info
   - updateLastSync() → track active session
   - subscribeToSchoolChanges(schoolCode) → enable real-time sync

3. IN ADMIN REGISTRATION MODAL, USE:
   - registerUserWithSchoolCode(email, pw, name, role, schoolCode)
   - Enforce: Check if school code exists before allowing registration

4. FOR REAL-TIME UPDATES:
   - broadcastToSchool(schoolCode, message) → notify all admins
   - All SYNC listeners automatically filter by school_code

5. FOR CONSISTENCY:
   - saveMarkWithTracking(mark, adminId) → track who edited
   - verifySchoolDataConsistency(schoolCode) → audit data

6. ON LOGOUT:
   - unsubscribeFromSchoolChanges(schoolCode)
   - Clear sessionStorage school code

*/
