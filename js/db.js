/*
   MARKS MANAGEMENT SYSTEM DATABASE LAYER + REALTIME SYNC ENGINE
   Full bi-directional synchronization between Teacher & Admin portals.
   Source of truth: Supabase PostgreSQL — no duplicate data, no local cache.
*/

const SUPABASE_URL = 'https://bqjckxzwnwlxotlmfrjy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8S73v45QFyvoBt0LkoKiJA_o8ZFe7t9';

const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// SECURITY: INPUT SANITIZATION & VALIDATION
// ============================================================

/**
 * Sanitize string input to prevent XSS attacks
 * Escapes HTML special characters
 */
function sanitizeInput(str) {
    if (typeof str !== 'string') return str;
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Validate email format (basic check)
 */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ============================================================
// SECURITY: RATE LIMITING & SESSION MANAGEMENT
// ============================================================

const RATE_LIMIT_STORE = {};
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
let SESSION_TIMEOUT_ID = null;

/**
 * Check login attempt rate limiting
 * Max 5 attempts per identifier per day
 */
function checkLoginRateLimit(identifier) {
    const today = new Date().toISOString().split('T')[0];
    const key = `login_${identifier}_${today}`;
    const attempts = RATE_LIMIT_STORE[key] || 0;
    
    if (attempts >= 5) {
        const error = new Error('Too many login attempts. Please try again tomorrow or contact your administrator.');
        error.code = 'RATE_LIMIT_EXCEEDED';
        throw error;
    }
    
    RATE_LIMIT_STORE[key] = attempts + 1;
    return true;
}

/**
 * Initialize session timeout tracking
 * Auto-logout after 30 minutes of inactivity
 */
function initSessionTimeout() {
    function resetTimeout() {
        if (SESSION_TIMEOUT_ID) clearTimeout(SESSION_TIMEOUT_ID);
        
        SESSION_TIMEOUT_ID = setTimeout(() => {
            console.warn('[SESSION] Timeout: User inactive for 30 minutes');
            DB.signOut();
            window.location.href = '/index.html?session=expired';
        }, SESSION_TIMEOUT_MS);
    }
    
    // Reset timeout on any user activity
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
        document.addEventListener(event, resetTimeout, true);
    });
    
    // Initial timeout
    resetTimeout();
}

// ============================================================
// DATABASE OPERATIONS (Single source of truth with Performance Caching)
// ============================================================
const DB_CACHE = {
    _sc: null,
    get: (key) => {
        try {
            const data = localStorage.getItem(`camis_cache_${key}`);
            return data ? JSON.parse(data) : null;
        } catch (e) { return null; }
    },
    set: (key, val) => {
        try { localStorage.setItem(`camis_cache_${key}`, JSON.stringify(val)); } catch (e) {}
    },
    clear: () => {
        Object.keys(localStorage).forEach(k => { if (k.startsWith('camis_cache_')) localStorage.removeItem(k); });
    }
};

const DB = {
  // --- AUTHENTICATION & SESSION ---
  /**
   * Universal Login: handles Email, SDMS Code, or Phone
   * NEW: Auto-detects role and school_code for auto-redirect
   */
  async signIn(identifier, password) {
    // SECURITY: Check rate limiting (max 5 attempts per day per identifier)
    try {
        checkLoginRateLimit(identifier);
    } catch (rateLimitError) {
        console.warn('[AUTH] Rate limit exceeded:', identifier);
        throw rateLimitError;
    }
    
    let email = identifier;

    // Resolve identifier to email if it's SDMS or Phone
    if (!identifier.includes('@')) {
      const { data } = await _supabase
        .from('profiles')
        .select('email')
        .or(`sdms_code.eq."${identifier}",phone.eq."${identifier}"`)
        .limit(1);
      
      if (data && data.length > 0) email = data[0].email;
    }

    if (!email.includes('@')) {
      throw new Error('Institutional record not found. Please verify your ID or contact Admin.');
    }

    // PHASE 1: Try Standard Login
    const { data: authData, error: authError } = await _supabase.auth.signInWithPassword({
      email,
      password
    });

    let profile = null;

    // PHASE 2: Auto-Provisioning (New account creation)
    if (authError && (authError.message.includes('Invalid') || authError.status === 400)) {
      const { data: p } = await _supabase.from('profiles').select('*').eq('email', email).maybeSingle();
      
      if (p && p.temp_password_active) {
        // Detect Role-Based Default Password Requirement
        const defaultForUser = (p.role === 'admin') ? 'Admin@2024' : 'Teacher@2024';
        const isCorrectDefault = (password === defaultForUser);

        if (isCorrectDefault) {
          const { data: signUpData, error: signUpError } = await _supabase.auth.signUp({ email, password });
          if (!signUpError) return { user: signUpData.user, profile: p };
          
          if (signUpError && signUpError.status === 422) {
            throw new Error('This account is already initialized. Please use your permanent password.');
          }
           throw signUpError;
        }
      }
    }

    if (authError) {
      if (authError.message.includes('Email not confirmed')) {
        throw new Error('Account Pending: Please check your institutional email and click the confirmation link before logging in.');
      }
      throw authError;
    }

    // PHASE 3: Fetch Profile (Auto-detect school & role)
    const { data: linked } = await _supabase.from('profiles').select('*').eq('email', email).maybeSingle();
    
    if (linked) {
      const oldId = linked.id;
      const newId = authData.user.id;

      // Only attempt to migrate if they differ
      if (oldId !== newId) {
        // Update assignments first to stay linked (if CASCADE not on)
        await _supabase.from('teacher_assignments').update({ teacher_id: newId }).eq('teacher_id', oldId);
        
        const { data: updated, error: linkError } = await _supabase.from('profiles').update({ id: newId }).eq('id', oldId).select().maybeSingle();
        if (linkError) {
           console.error('[AUTH] Profile link failed, trying email fallback:', linkError);
           await _supabase.from('profiles').update({ id: newId }).eq('email', email);
        }
        profile = updated || linked;
        profile.id = newId; // Force correct ID in return object
      } else {
        profile = linked;
      }
    }

    if (!profile) {
      throw new Error('Authenticated, but no institutional profile exists. Contact Admin to register your SDMS/Email.');
    }
    
    // PHASE 4: Auto-Redirect Logic (NEW)
    // Store school code and role for auto-redirect after login
    if (profile.school_code) {
      sessionStorage.setItem('current_school_code', profile.school_code);
    }
    if (profile.role) {
      sessionStorage.setItem('current_role', profile.role);
    }
    
    // PHASE 5: Log multi-admin access
    console.log(`[AUTH] ✅ ${profile.role.toUpperCase()} logged in for school ${profile.school_code}`);
    
    // PHASE 6: Initialize session timeout (30 minutes of inactivity)
    setTimeout(() => {
      if (typeof initSessionTimeout === 'function') {
        initSessionTimeout();
      }
    }, 100);
    
    return { 
      user: authData.user, 
      profile,
      // Auto-detect redirect target
      redirect_target: profile.role === 'admin' ? '/admin-portal.html' : '/teacher-portal.html',
      school_code: profile.school_code,
      role: profile.role
    };
  },

  async updatePassword(newPassword) {
    const { data, error } = await _supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    
    // Also clear the temporary password flag in profile
    const { data: { user } } = await _supabase.auth.getUser();
    if (user) {
      await _supabase.from('profiles').update({ temp_password_active: false }).eq('id', user.id);
    }
    return data;
  },

  async signOut() {
    // Clear session timeout
    if (SESSION_TIMEOUT_ID) clearTimeout(SESSION_TIMEOUT_ID);
    
    // Clear cache
    DB_CACHE.clear();
    sessionStorage.clear();
    
    // Sign out from Supabase
    const { error } = await _supabase.auth.signOut();
    if (error) {
      console.error('[AUTH] Sign out error:', error);
      throw error;
    }
    
    console.log('[AUTH] ✅ User signed out');
    return true;
  },

  // --- HELPERS ---
  async _getSchoolCode() {
    if (DB_CACHE._sc) return DB_CACHE._sc;
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return 'DEFAULT';
    const { data: p } = await _supabase.from('profiles').select('school_code').eq('id', user.id).maybeSingle();
    DB_CACHE._sc = p?.school_code || 'DEFAULT';
    return DB_CACHE._sc;
  },

  // --- TEACHERS ---
  async getTeachers() {
    const sc = await this._getSchoolCode();
    const cached = DB_CACHE.get(`teachers_${sc}`);
    if (cached) return cached;
    
    let query = _supabase.from('profiles').select('*').eq('role', 'teacher');
    // Legacy Bridge: Include NULLs if we are in 541023 or DEFAULT
    if (sc === '541023' || sc === 'DEFAULT') {
        query = query.or(`school_code.eq.${sc},school_code.is.null`);
    } else {
        query = query.eq('school_code', sc);
    }

    const { data, error } = await query;
    if (error) { console.error('[DB] getTeachers:', error); return []; }
    DB_CACHE.set(`teachers_${sc}`, data || []);
    return data || [];
  },
  async addTeacher(teacherObj) {
    // teacherObj expected to have: full_name, email, role, sdms_code, phone, is_class_teacher, is_subject_teacher
    const sc = await this._getSchoolCode();
    const payload = {
      ...teacherObj,
      role: 'teacher',
      school_code: sc,  // CRITICAL: Add school code for multi-admin sync
      temp_password_active: true, // Force password change on first login
      created_at: new Date().toISOString()
    };
    
    // Auto-Recovery feature: Check if a ghost profile already exists for this email or SDMS code
    const { data: existing } = await _supabase.from('profiles')
        .select('id')
        .or(`email.eq.${teacherObj.email},sdms_code.eq.${teacherObj.sdms_code}`)
        .maybeSingle();
    
    if (existing) {
        console.warn(`[REGISTRY] Recovering orphaned profile for ${teacherObj.email}`);
        const res = await _supabase.from('profiles').update(payload).eq('id', existing.id).select();
        if (!res.error) {
            DB_CACHE.set(`teachers_${sc}`, null);
        }
        return res;
    }
    
    // Normal Insertion
    const { data, error } = await _supabase.from('profiles').insert([payload]).select();
    if (!error) {
        DB_CACHE.set(`teachers_${sc}`, null);
    }
    return { data, error };
  },
  async updateTeacher(id, updates) {
    const res = await _supabase.from('profiles').update(updates).eq('id', id).select();
    if (!res.error) {
        const sc = await this._getSchoolCode();
        DB_CACHE.set(`teachers_${sc}`, null);
    }
    return res;
  },
  
  // --- TEACHER ASSIGNMENTS ---
  async getTeacherAssignments(teacherId) {
    // CAMIS: Optimized select with foreign key hints
    let query = _supabase.from('teacher_assignments')
      .select(`
        *,
        profiles!teacher_id (id, full_name, role),
        classes!class_id (id, name),
        subjects!subject_id (id, name, abbr)
      `);
    
    if (arguments.length > 0) {
        if (!teacherId) {
            console.warn('[DB] getTeacherAssignments: Attempted fetch with null teacherId');
            return []; 
        }
        query = query.eq('teacher_id', teacherId);
    }

    const { data, error } = await query;
    if (error) { 
        console.error('[DB] getTeacherAssignments Fatal:', error); 
        // Fallback: Fetch without joins if joins are failing due to schema mismatches
        const { data: raw } = await _supabase.from('teacher_assignments').select('*').eq('teacher_id', teacherId);
        return raw || [];
    }
    return data || [];
  },
  async saveTeacherAssignment(assignment) {
    return await _supabase.from('teacher_assignments').insert([assignment]).select();
  },
  async deleteTeacherAssignments(teacherId) {
    return await _supabase.from('teacher_assignments').delete().eq('teacher_id', teacherId);
  },
  async clearTeacherAssignments(teacherId) {
    return await this.deleteTeacherAssignments(teacherId);
  },
  async updateProfile(id, updates) {
    return await _supabase.from('profiles').update(updates).eq('id', id);
  },
  async repairInstitutionalLink(email, newId) {
    const { data: profile } = await _supabase.from('profiles').select('*').eq('email', email).single();
    if (!profile) throw new Error('No profile found for ' + email);
    const oldId = profile.id;
    if (oldId === newId) return { success: true };
    await _supabase.from('teacher_assignments').update({ teacher_id: newId }).eq('teacher_id', oldId);
    return await _supabase.from('profiles').update({ id: newId }).eq('id', oldId).select();
  },
  async assignClassTeacher(teacherId, classId) {
    return await _supabase.from('teacher_assignments').insert([{ teacher_id: teacherId, class_id: classId, type: 'class' }]);
  },
  async assignSubjectTeacher(teacherId, classId, subjectId) {
    return await _supabase.from('teacher_assignments').insert([{ teacher_id: teacherId, class_id: classId, subject_id: subjectId, type: 'subject' }]);
  },
  async deleteTeacher(id) {
    // 1. Permanent Wipe: Clean all foreign key relationships
    await _supabase.from('teacher_assignments').delete().eq('teacher_id', id);
    
    // 2. Supabase Auth Wipe: Invoke backend RPC to delete user identity directly from Supabase Auth
    // This permanently frees the Email and ID to be used again without any 'already exists' conflicts
    var rpcResult = await _supabase.rpc('admin_delete_auth_user', { target_id: id });
    if (rpcResult.error) console.warn('[DELETE] RPC Auth delete failed (function may be missing):', rpcResult.error);

    // 3. UI/Schema Wipe: Clean up profile record
    const res = await _supabase.from('profiles').delete().eq('id', id);
    if (!res.error) {
        const sc = await this._getSchoolCode();
        DB_CACHE.set(`teachers_${sc}`, null);
    }
    return res;
  },
  async resetTeacherSecurity(id) {
    return await _supabase.from('profiles').update({ temp_password_active: true }).eq('id', id).select();
  },

  // --- STUDENTS ---
  async getStudents(classId = null) {
    const sc = await this._getSchoolCode();
    if (!classId) {
        const cached = DB_CACHE.get(`students_all_${sc}`);
        if (cached) return cached;
    }
    
    let query = _supabase.from('students').select('*, classes(name)');
    // Legacy Bridge
    if (sc === '541023' || sc === 'DEFAULT') {
        query = query.or(`school_code.eq.${sc},school_code.is.null`);
    } else {
        query = query.eq('school_code', sc);
    }
    if (classId) query = query.eq('class_id', classId);
    const { data, error } = await query;
    if (error) { console.error('[DB] getStudents:', error); return []; }
    
    if (!classId) DB_CACHE.set(`students_all_${sc}`, data || []);
    return data || [];
  },
  async addStudent(studentObj) {
    const sc = await this._getSchoolCode();
    const res = await _supabase.from('students').insert([{ ...studentObj, school_code: sc }]).select();
    if (!res.error) DB_CACHE.set(`students_all_${sc}`, null);
    return res;
  },

  /**
   * Batch add students (bulk import)
   * @param {Array} studentsArray - Array of student objects
   * @returns {Promise} Result of bulk insert
   */
  async addStudentsBatch(studentsArray) {
    const sc = await this._getSchoolCode();
    const batch = studentsArray.map(s => ({ ...s, school_code: sc, created_at: new Date().toISOString() }));
    const res = await _supabase.from('students').insert(batch).select();
    if (!res.error) DB_CACHE.set(`students_all_${sc}`, null);
    return res;
  },

  async deleteStudent(id) {
    const sc = await this._getSchoolCode();
    // 1. Permanent Wipe: Clean orphan marks and reports (only for this school)
    await _supabase.from('marks').delete().eq('student_id', id).eq('school_code', sc);

    // 2. Schema Wipe
    const res = await _supabase.from('students').delete().eq('id', id).eq('school_code', sc);
    if (!res.error) {
        DB_CACHE.set(`students_all_${sc}`, null);
    }
    return res;
  },

  // --- CLASSES ---
  async getClasses() {
    const sc = await this._getSchoolCode();
    const cached = DB_CACHE.get(`classes_${sc}`);
    if (cached) return cached;

    let query = _supabase.from('classes').select('*');
    if (sc === '541023' || sc === 'DEFAULT') {
        query = query.or(`school_code.eq.${sc},school_code.is.null`);
    } else {
        query = query.eq('school_code', sc);
    }
    const { data, error } = await query.order('name');
    if (error) { console.error('[DB] getClasses:', error); return []; }
    DB_CACHE.set(`classes_${sc}`, data || []);
    return data || [];
  },
  async addClass(name) {
    const sc = await this._getSchoolCode();
    const res = await _supabase.from('classes').insert([{ name, school_code: sc }]).select();
    if (!res.error) DB_CACHE.set(`classes_${sc}`, null);
    return res;
  },
  async addClassesBatch(names) {
    const sc = await this._getSchoolCode();
    const batch = names.map(n => ({ name: n, school_code: sc }));
    const res = await _supabase.from('classes').insert(batch).select();
    if (!res.error) DB_CACHE.set(`classes_${sc}`, null);
    return res;
  },
  async deleteClass(id) {
    const sc = await this._getSchoolCode();
    const res = await _supabase.from('classes').delete().eq('id', id).eq('school_code', sc);
    if (!res.error) {
        DB_CACHE.set(`classes_${sc}`, null);
    }
    return res;
  },

  // --- SUBJECTS ---
  async getSubjects(classId = null) {
    const sc = await this._getSchoolCode();
    if (!classId) {
        const cached = DB_CACHE.get(`subjects_all_${sc}`);
        if (cached) return cached;
    }

    let query = _supabase.from('subjects').select('*, classes(name)').eq('school_code', sc);
    if (classId) query = query.eq('class_id', classId);
    const { data, error } = await query;
    if (error) { console.error('[DB] getSubjects:', error); return []; }
    
    if (!classId) DB_CACHE.set(`subjects_all_${sc}`, data || []);
    return data || [];
  },
  async addSubject(subjectObj) {
    const sc = await this._getSchoolCode();
    const res = await _supabase.from('subjects').insert([{ ...subjectObj, school_code: sc }]).select();
    if (!res.error) DB_CACHE.set(`subjects_all_${sc}`, null);
    return res;
  },

  // --- MARKS ---
  async getMarks(filters = {}) {
    const sc = await this._getSchoolCode();
    let query = _supabase.from('marks').select('*').eq('school_code', sc);
    if (filters.studentId)    query = query.eq('student_id', filters.studentId);
    if (filters.subjectId)    query = query.eq('subject_id', filters.subjectId);
    if (filters.term)         query = query.eq('term', filters.term);
    if (filters.year)         query = query.eq('academic_year', filters.year);
    if (filters.classId)      query = query.eq('class_id', filters.classId);
    if (filters.classIds)     query = query.in('class_id', filters.classIds);
    const { data, error } = await query;
    if (error) { console.error('[DB] getMarks:', error); return []; }
    return data || [];
  },

  // Upsert single mark — (student_id, subject_id, assessment_id, term) composite key
  async saveMark(markObj) {
    const sc = await this._getSchoolCode();
    return await _supabase.from('marks').upsert({ ...markObj, school_code: sc }, {
      onConflict: 'student_id,subject_id,assessment_id,term,academic_year'
    }).select();
  },

  // Batch save — array of mark objects
  async saveMarksBatch(marksArray) {
    const sc = await this._getSchoolCode();
    const batch = marksArray.map(m => ({ ...m, school_code: sc }));
    return await _supabase.from('marks').upsert(batch, {
      onConflict: 'student_id,subject_id,assessment_id,term,academic_year'
    }).select();
  },

  // --- MARKS: SUBMISSION ---
  async submitMarksForClass(subjectId, classId, term = 2) {
    const updatePayload = {
      is_submitted: true,
      submitted_at: new Date().toISOString()
    };
    let query = _supabase.from('marks')
      .update(updatePayload)
      .eq('subject_id', subjectId)
      .eq('term', term);
    // Only filter by class_id if the column exists
    if (classId) query = query.eq('class_id', classId);
    return await query.select();
  },

  // --- MARKS: APPROVAL / REJECTION ---
  async approveMark(markId) {
    return await _supabase.from('marks').update({
      is_approved: true,
      is_submitted: true,
      approved_at: new Date().toISOString(),
      rejection_comment: null  // Clear any previous rejection
    }).eq('id', markId).select();
  },

  async approveMarksForSubject(subjectId, term = 2) {
    return await _supabase.from('marks').update({
      is_approved: true,
      is_submitted: true,
      approved_at: new Date().toISOString(),
      rejection_comment: null
    }).eq('subject_id', subjectId).eq('term', term).eq('is_submitted', true).select();
  },

  async approveAllSubmittedMarks() {
    return await _supabase.from('marks').update({
      is_approved: true,
      is_submitted: true,
      approved_at: new Date().toISOString(),
      rejection_comment: null
    }).eq('is_submitted', true).eq('is_approved', false).select();
  },

  async rejectMark(markId, comment = '') {
    return await _supabase.from('marks').update({
      is_approved: false,
      is_submitted: false,     // Unlock so teacher can edit again
      rejection_comment: comment,
      rejected_at: new Date().toISOString()
    }).eq('id', markId).select();
  },

  async rejectMarksForSubject(subjectId, comment = '', term = 2) {
    return await _supabase.from('marks').update({
      is_approved: false,
      is_submitted: false,
      rejection_comment: comment,
      rejected_at: new Date().toISOString()
    }).eq('subject_id', subjectId).eq('term', term).eq('is_submitted', true).select();
  },

  // Lock finalized results — no more editing allowed
  async lockMarks(subjectId, term = 2) {
    return await _supabase.from('marks').update({
      is_locked: true,
      locked_at: new Date().toISOString()
    }).eq('subject_id', subjectId).eq('term', term).eq('is_approved', true).select();
  },

  // --- ASSESSMENTS ---
  async getAssessments() {
    const sc = await this._getSchoolCode();
    const cached = DB_CACHE.get(`assessments_${sc}`);
    if (cached) return cached;

    const { data, error } = await _supabase.from('assessments').select('*').eq('school_code', sc).order('created_at');
    if (error) { console.error('[DB] getAssessments:', error); return []; }
    DB_CACHE.set(`assessments_${sc}`, data || []);
    return data || [];
  },
  async addAssessment(assessObj) {
    const sc = await this._getSchoolCode();
    const res = await _supabase.from('assessments').insert([{ ...assessObj, school_code: sc }]).select();
    if (!res.error) DB_CACHE.set(`assessments_${sc}`, null);
    return res;
  },
  async updateAssessment(id, updates) {
    const res = await _supabase.from('assessments').update(updates).eq('id', id).select();
    if (!res.error) {
        const sc = await this._getSchoolCode();
        DB_CACHE.set(`assessments_${sc}`, null);
    }
    return res;
  },
  async deleteAssessment(id) {
    const res = await _supabase.from('assessments').delete().eq('id', id);
    if (!res.error) {
        const sc = await this._getSchoolCode();
        DB_CACHE.set(`assessments_${sc}`, null);
    }
    return res;
  },

  // --- SYSTEM CONFIG ---
  async getGradingScale() {
    const { data, error } = await _supabase.from('settings').select('*').eq('key', 'grading_scale').maybeSingle();
    if (error) return null;
    return data.value;
  },
  async saveGradingScale(scale) {
    return await _supabase.from('settings').upsert({ key: 'grading_scale', value: scale }, { onConflict: 'key' }).select();
  },
  async getSchoolInfo() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await _supabase.from('profiles').select('school_code').eq('id', user.id).maybeSingle();
    const sc = profile?.school_code || 'DEFAULT';

    const { data, error } = await _supabase.from('settings').select('*').eq('key', `school_info_${sc}`).maybeSingle();
    if (error || !data) {
        // Fallback to legacy key for reverse compatibility if new one doesn't exist
        const { data: fallback } = await _supabase.from('settings').select('*').eq('key', 'school_info').maybeSingle();
        return fallback ? fallback.value : null;
    }
    return data.value;
  },
  async saveSchoolInfo(info) {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await _supabase.from('profiles').select('school_code').eq('id', user.id).maybeSingle();
    const sc = profile?.school_code || 'DEFAULT';

    return await _supabase.from('settings').upsert({ key: `school_info_${sc}`, value: info }, { onConflict: 'key' }).select();
  },
  clearCache() {
    DB_CACHE.clear();
  }
};

// ============================================================
// MULTI-ADMIN SYNCHRONIZED PORTAL FUNCTIONS
// School code filtering, real-time sync, broadcast
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
 */
async function registerUserWithSchoolCode(email, password, fullName, role, schoolCode) {
  try {
    const { data: schoolExists } = await _supabase
      .from('schools')
      .select('code')
      .eq('code', schoolCode)
      .maybeSingle();
    
    if (!schoolExists && schoolCode !== 'DEFAULT') {
      console.warn(`[ADMIN] School ${schoolCode} not found. Create it in database first.`);
      throw new Error(`School code ${schoolCode} does not exist. Contact admin to register.`);
    }
    
    const { data: authData, error: authError } = await _supabase.auth.signUp({
      email,
      password
    });
    
    if (authError) throw authError;
    
    const { data: profile, error: profileError } = await _supabase
      .from('profiles')
      .insert([{
        id: authData.user.id,
        email,
        full_name: fullName,
        role,
        school_code: schoolCode,
        school_code_ref: schoolCode !== 'DEFAULT' ? schoolCode : null,
        temp_password_active: false,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (profileError) throw profileError;
    
    sessionStorage.setItem('current_school_code', schoolCode);
    
    console.log(`[ADMIN] Successfully registered ${role} for school ${schoolCode}`);
    return { success: true, user: authData.user, profile };
    
  } catch (error) {
    console.error('[ADMIN] Registration failed:', error.message);
    throw error;
  }
}

/**
 * Get all admins in the same school
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
 * Get all active sessions for a school
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
 * Update user's last sync timestamp
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

/**
 * Get school settings from database
 */
async function fetchSchoolSettings(schoolCode) {
  try {
    const cacheKey = `school_settings_${schoolCode}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      const parsed = JSON.parse(cached);
      const ageMs = Date.now() - parsed.timestamp;
      if (ageMs < 3600000) return parsed.data;
    }
    
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
      localStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      return data;
    }
    
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
    
    localStorage.removeItem(`school_settings_${schoolCode}`);
    
    console.log('[DB] School settings updated');
    return data;
  } catch (error) {
    console.error('[DB] Error updating school settings:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time updates for a specific school code
 */
function subscribeToSchoolChanges(schoolCode) {
  const channel = _supabase
    .channel(`school-${schoolCode}-sync`);
  
  channel.on('postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'marks',
      filter: `school_code=eq.${schoolCode}`
    },
    (payload) => {
      console.log('[SYNC] Marks updated for school', schoolCode, payload);
      if (window.SYNC && window.SYNC._emit) {
        window.SYNC._emit('marks', payload);
      }
    }
  );
  
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
  
  channel.on('postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'school_settings',
      filter: `school_code=eq.${schoolCode}`
    },
    (payload) => {
      console.log('[SYNC] School settings changed for', schoolCode);
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
 */
function unsubscribeFromSchoolChanges(schoolCode) {
  try {
    _supabase.removeChannel(`school-${schoolCode}-sync`);
    console.log(`[SYNC] Unsubscribed from school ${schoolCode}`);
  } catch (error) {
    console.warn('[SYNC] Error unsubscribing:', error);
  }
}

/**
 * Send notification to all admins in a school
 */
async function broadcastToSchool(schoolCode, message, actionType = 'info') {
  try {
    const admins = await getAdminsInSchool(schoolCode);
    
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

/**
 * Smart upsert for marks with conflict resolution
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
    
    if (error) throw error;
    
    console.log('[DB] Mark saved with tracking');
    return data;
  } catch (error) {
    console.error('[DB] Error saving mark with tracking:', error);
    throw error;
  }
}

/**
 * Verify data consistency across all admins in school
 */
async function verifySchoolDataConsistency(schoolCode) {
  try {
    const report = {
      schoolCode,
      timestamp: new Date().toISOString(),
      checks: {}
    };
    
    const { data: studentsWithWrongCode } = await _supabase
      .from('students')
      .select('id, school_code')
      .neq('school_code', schoolCode)
      .eq('class_id->school_code', schoolCode);
    
    report.checks.orphanStudents = studentsWithWrongCode?.length || 0;
    
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
// REALTIME SYNC ENGINE
// Bi-directional: Teacher ⇄ Admin with auto-retry
// ============================================================
const SYNC = {
  _callbacks: {},
  _channel: null,
  _retryCount: 0,
  _maxRetries: 10,
  _retryTimer: null,
  _connected: false,

  /**
   * Register a callback for a table-level event.
   * @param {'marks'|'students'|'teachers'|'classes'|'subjects'|'assessments'} event
   * @param {Function} fn — function(payload) called on INSERT/UPDATE/DELETE
   */
  on(event, fn) {
    if (!this._callbacks[event]) this._callbacks[event] = [];
    this._callbacks[event].push(fn);
  },

  _emit(event, payload) {
    // CACHE INVALIDATION: Purge local cache for the affected table across all schools
    Object.keys(localStorage).forEach(k => {
        if (k.includes(`camis_cache_${event}`)) localStorage.removeItem(k);
    });

    (this._callbacks[event] || []).forEach(fn => {
      try { fn(payload); } catch(e) { console.error('[SYNC] Callback error on', event, ':', e); }
    });
  },

  _updateBadge(status) {
    const badge = document.getElementById('sync-badge') ||
                  document.getElementById('setup-status') ||
                  document.getElementById('term-tag');
    if (!badge) return;

    if (status === 'SUBSCRIBED') {
      this._connected = true;
      this._retryCount = 0;
      badge.textContent = '🟢 LIVE SYNC';
      badge.style.background = '#dcfce7';
      badge.style.color = '#166534';
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      this._connected = false;
      badge.textContent = '🔴 CONNECTION ISSUE';
      badge.style.background = '#fee2e2';
      badge.style.color = '#991b1b';
      this._retry();
    } else if (status === 'CLOSED') {
      this._connected = false;
      badge.textContent = '⚫ OFFLINE';
      badge.style.background = '#f1f5f9';
      badge.style.color = '#475569';
      this._retry();
    } else {
      badge.textContent = '🔄 CONNECTING...';
      badge.style.background = '#fef3c7';
      badge.style.color = '#92400e';
    }
  },

  _retry() {
    if (this._retryCount >= this._maxRetries) {
      toast('⚠️ Sync disconnected. Please refresh the page.', 'error');
      return;
    }
    this._retryCount++;
    const delay = Math.min(2000 * this._retryCount, 15000); // Exponential backoff, max 15s
    console.log(`[SYNC] Retrying in ${delay}ms (attempt ${this._retryCount}/${this._maxRetries})...`);
    // toast(`🔄 Connection issue, retrying... (${this._retryCount})`, 'info');
    console.warn(`[DB] Connection issue, retrying... (${this._retryCount})`);

    clearTimeout(this._retryTimer);
    this._retryTimer = setTimeout(() => {
      this.stop();
      this._channel = null;
      this.start();
    }, delay);
  },

  /**
   * Start listening on ALL tables. Call once per page load.
   */
  start() {
    if (this._channel) return;

    this._channel = _supabase
      .channel('mms-realtime-sync')

      // MARKS — Teacher saves/edits, Admin approves/rejects/locks
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'marks' },
          payload => {
            console.log('[SYNC] marks →', payload.eventType, payload);
            this._emit('marks', payload);
          }
      )
      // STUDENTS — Admin enrolls/removes
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'students' },
          payload => {
            console.log('[SYNC] students →', payload.eventType);
            this._emit('students', payload);
          }
      )
      // PROFILES (Teachers) — Admin adds/modifies/removes faculty
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'profiles' },
          payload => {
            console.log('[SYNC] profiles →', payload.eventType);
            this._emit('teachers', payload);
          }
      )
      // CLASSES — Admin creates/edits classes
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'classes' },
          payload => {
            console.log('[SYNC] classes →', payload.eventType);
            this._emit('classes', payload);
          }
      )
      // SUBJECTS — Admin manages curriculum subjects
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'subjects' },
          payload => {
            console.log('[SYNC] subjects →', payload.eventType);
            this._emit('subjects', payload);
          }
      )
      // ASSESSMENTS — Admin configures assessment types
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'assessments' },
          payload => {
            console.log('[SYNC] assessments →', payload.eventType);
            this._emit('assessments', payload);
          }
      )
      // TEACHER ASSIGNMENTS
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'teacher_assignments' },
          payload => {
            console.log('[SYNC] teacher_assignments →', payload.eventType);
            this._emit('assignments', payload);
          }
      )
      .subscribe(status => {
        console.log('[SYNC] Channel status:', status);
        this._updateBadge(status);
      });
  },

  stop() {
    clearTimeout(this._retryTimer);
    if (this._channel) {
      _supabase.removeChannel(this._channel);
      this._channel = null;
      this._connected = false;
    }
  },

  isConnected() {
    return this._connected;
  }
};

// ============================================================
// GLOBAL TOAST HELPER
// ============================================================
function toast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icons = { success: 'check-circle', error: 'x-circle', info: 'info', warning: 'alert-triangle' };
    t.innerHTML = `<i data-lucide="${icons[type] || 'info'}" style="width: 20px; height: 20px;"></i><span>${msg}</span>`;
    c.appendChild(t);
    if (window.lucide) lucide.createIcons();
    setTimeout(() => t.remove(), 4000);
}
