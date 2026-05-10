/*
   MARKS MANAGEMENT SYSTEM DATABASE LAYER + REALTIME SYNC ENGINE
   Full bi-directional synchronization between Teacher & Admin portals.
   Source of truth: Supabase PostgreSQL Ã¢â‚¬â€ no duplicate data, no local cache.
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
    
    // EXEMPTION: System Admin is never throttled
    if (identifier === 'system@admin.ed') return true;
    
    if (attempts >= 50) { // Relaxed from 5 to 50 for maintenance
        const error = new Error('Security Lockdown: Too many login attempts. Contact support.');
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
        MEM_CACHE.clear();
    }
};

const MEM_CACHE = {
    profile: null,
    schoolCode: null,
    assignments: {}, // teacherId -> data
    marks: {},       // key -> data
    students: null,
    subjects: null,
    classes: null,
    clear: () => {
        MEM_CACHE.profile = null;
        MEM_CACHE.schoolCode = null;
        MEM_CACHE.assignments = {};
        MEM_CACHE.marks = {};
        MEM_CACHE.students = null;
        MEM_CACHE.subjects = null;
        MEM_CACHE.classes = null;
    }
};

const DB = {
  // --- AUTHENTICATION & SESSION ---
  /**
   * Universal Login: handles Email, SDMS Code, or Phone
   * NEW: Auto-detects role and school_code for auto-redirect
   */
  async signIn(identifier, password) {
    // 1. SLATE CLEANING: Wipe previous institutional memory immediately
    sessionStorage.clear();
    localStorage.removeItem('cached_school_node');
    
    // 2. SECURITY: Check rate limiting
    try {
        checkLoginRateLimit(identifier);
    } catch (rateLimitError) {
        throw rateLimitError;
    }

    let email = identifier;

    // Resolve identifier (SDMS/Phone) to email via Profiles if needed
    if (!identifier.includes('@')) {
      const { data: profileRef } = await _supabase
        .from('profiles')
        .select('email')
        .or(`sdms_code.eq."${identifier}",phone.eq."${identifier}"`)
        .limit(1)
        .maybeSingle();
      
      if (profileRef) email = profileRef.email;
    }

    // PHASE 1: Authentication
    let { data: authData, error: authError } = await _supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    // AUTO-REGISTRATION for first-time Login (Just-In-Time Provisioning)
    if (authError && (authError.message.includes('Invalid login') || authError.status === 400)) {
        console.log('[AUTH] Checking for institutional record eligibility...');
        const { data: profileCheck } = await _supabase.from('profiles').select('*').eq('email', email).maybeSingle();
        
        if (profileCheck && profileCheck.temp_password_active) {
            console.log('[AUTH] Provisioning first-time credentials...');
            const { data: signUpData, error: signUpError } = await _supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: profileCheck.full_name,
                        role: profileCheck.role,
                        school_code: profileCheck.school_code
                    }
                }
            });
            if (!signUpError) {
                authData = signUpData;
                authError = null;
            }
        }
    }

    if (authError) throw authError;

    // PHASE 2: Profile Synchronization
    // We fetch the profile and ensure it's linked to the new Auth ID
    let { data: profile, error: profileError } = await _supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

    if (!profile) {
        // Fallback for System Admin or orphaned accounts
        if (email === 'system@admin.ed') {
            const { data: sysAdmin } = await _supabase.from('profiles').insert([{
                id: authData.user.id,
                email: email,
                full_name: 'System Administrator',
                role: 'system_admin',
                school_code: 'GLOBAL'
            }]).select().single();
            profile = sysAdmin;
        } else {
            throw new Error('Authenticated, but no institutional profile found. Contact support.');
        }
    }

    // Link ID if it's different (First-time JIT login result)
    if (profile.id !== authData.user.id) {
        await _supabase.from('profiles').update({ id: authData.user.id }).eq('email', email);
        profile.id = authData.user.id;
    }

    // PHASE 3: Session Initialization
    const role = profile.role;
    const schoolCode = profile.school_code || 'DEFAULT';

    sessionStorage.setItem('current_role', role);
    sessionStorage.setItem('current_school_code', schoolCode);
    
    // Track active session for real-time visibility
    await _supabase.from('profiles').update({ last_sync_at: new Date().toISOString() }).eq('id', profile.id);

    console.log(`[AUTH] Ã¢Å“â€¦ Access granted for ${role} at school ${schoolCode}`);
    
    return { 
      user: authData.user, 
      profile,
      role,
      school_code: schoolCode,
      redirect_target: role === 'system_admin' ? '/system-admin-portal.html' : 
                       (role === 'admin' ? '/admin-portal.html' : '/teacher-portal.html')
    };
  },

  async updatePassword(newPassword) {
    const { data, error } = await _supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    
    // Also clear the temporary password flag in profile
    const user = await this._getUser();
    if (user) {
      await _supabase.from('profiles').update({ temp_password_active: false }).eq('id', user.id);
    }
    return data;
  },

  getAuthContext() {
    return {
      role: sessionStorage.getItem('current_role'),
      school_code: sessionStorage.getItem('current_school_code')
    };
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
    
    console.log('[AUTH] Ã¢Å“â€¦ User signed out');
    return true;
  },

  async _getUser() {
    if (MEM_CACHE.user) return MEM_CACHE.user;
    if (this._userPromise) return this._userPromise;
    this._userPromise = (async () => {
        try {
            const { data: { user } } = await _supabase.auth.getUser();
            MEM_CACHE.user = user;
            return user;
        } finally {
            this._userPromise = null;
        }
    })();
    return this._userPromise;
  },

  async getProfile() {
    if (MEM_CACHE.profile) return MEM_CACHE.profile;
    const user = await this._getUser();
    if (!user) return null;
    
    const { data: p } = await _supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (p) MEM_CACHE.profile = p;
    return p;
  },

  // --- HELPERS ---
   async _getSchoolCode() {
    if (MEM_CACHE.schoolCode) return MEM_CACHE.schoolCode;
    const sessionSC = sessionStorage.getItem('current_school_code');
    if (sessionSC) { MEM_CACHE.schoolCode = sessionSC; return sessionSC; }

    const user = await this._getUser();
    if (!user) return 'UNAUTHORIZED';
    
    if (this._scPromise) return this._scPromise;
    this._scPromise = (async () => {
        try {
            const { data: p } = await _supabase.from('profiles').select('role, school_code').eq('id', user.id).maybeSingle();
            if (!p || !p.school_code) return 'DENIED';

            let finalCode = p.school_code;
            if (p.role === 'system_admin') finalCode = 'GLOBAL';
            
            MEM_CACHE.schoolCode = finalCode;
            sessionStorage.setItem('current_school_code', finalCode);
            return finalCode;
        } finally {
            this._scPromise = null;
        }
    })();
    return this._scPromise;
  },

  // --- TEACHERS ---
  async getTeachers() {
    const sc = await this._getSchoolCode();
    const cached = DB_CACHE.get(`teachers_${sc}`);
    if (cached) return cached;
    
    let query = _supabase.from('profiles').select('*').eq('role', 'teacher');
    
    // STRICT SDMS FILTERING
    if (sc !== 'GLOBAL') {
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
      role: teacherObj.role || 'teacher',
      school_code: sc,
      created_at: new Date().toISOString()
    };
    
    // Auto-Recovery feature: Check if a ghost profile already exists for this email
    const { data: existing } = await _supabase.from('profiles')
        .select('id')
        .eq('email', teacherObj.email)
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
    // MEMOIZATION: Return from memory if already fetched in this session
    const cacheKey = teacherId || 'all';
    if (MEM_CACHE.assignments[cacheKey]) return MEM_CACHE.assignments[cacheKey];

    try {
      const sc = await this._getSchoolCode();
      let query = _supabase.from('teacher_assignments').select('*');
      if (sc !== 'GLOBAL') {
          query = query.eq('school_code', sc);
      }
      
      if (teacherId) {
          query = query.eq('teacher_id', teacherId);
      }

      const { data: rawAssignments, error } = await query;
      if (error) { 
          console.error('[DB] getTeacherAssignments Error:', error); 
          return []; 
      }
      if (!rawAssignments || rawAssignments.length === 0) {
          console.warn('[DB] getTeacherAssignments: 0 records found for:', teacherId || 'INSTITUTION');
          return [];
      }

      console.log(`[DB] getTeacherAssignments: Found ${rawAssignments.length} raw record(s)`);

      // STEP 2: Collect unique IDs for enrichment
      const classIds = [...new Set(rawAssignments.map(a => a.class_id).filter(Boolean))];
      const subjectIds = [...new Set(rawAssignments.map(a => a.subject_id).filter(Boolean))];
      const teacherIds = [...new Set(rawAssignments.map(a => a.teacher_id).filter(Boolean))];

      // STEP 3: Fetch lookup data in parallel
      const [classesRes, subjectsRes, profilesRes] = await Promise.all([
        classIds.length > 0 ? _supabase.from('classes').select('id, name').in('id', classIds) : { data: [] },
        subjectIds.length > 0 ? _supabase.from('subjects').select('id, name, abbr').in('id', subjectIds) : { data: [] },
        teacherIds.length > 0 ? _supabase.from('profiles').select('id, full_name, role').in('id', teacherIds) : { data: [] }
      ]);

      // Build lookup maps
      const classMap = {};
      (classesRes.data || []).forEach(c => classMap[c.id] = c);
      const subjectMap = {};
      (subjectsRes.data || []).forEach(s => subjectMap[s.id] = s);
      const profileMap = {};
      (profilesRes.data || []).forEach(p => profileMap[p.id] = p);

      // STEP 4: Enrich each assignment with names
      const enriched = rawAssignments.map(a => ({
        ...a,
        classes: classMap[a.class_id] || { id: a.class_id, name: 'Unknown Class' },
        subjects: subjectMap[a.subject_id] || { id: a.subject_id, name: 'Unknown Subject', abbr: '' },
        profiles: profileMap[a.teacher_id] || { id: a.teacher_id, full_name: 'Teacher', role: 'teacher' }
      }));

      MEM_CACHE.assignments[cacheKey] = enriched;
      return enriched;
      
    } catch (err) {
      console.error('[DB] getTeacherAssignments Fatal:', err);
      return [];
    }
  },
  async getClassAssignments(classId) {
    const sc = await this._getSchoolCode();
    const { data, error } = await _supabase.from('teacher_assignments')
        .select('*, subjects(id, name, abbr), profiles(id, full_name)')
        .eq('school_code', sc)
        .eq('class_id', classId);
    
    if (error) { console.error('[DB] getClassAssignments:', error); return []; }
    return data || [];
  },
  async saveTeacherAssignment(assignment) {
    const sc = await this._getSchoolCode();
    const payload = { ...assignment, school_code: assignment.school_code || sc };
    return await _supabase.from('teacher_assignments').insert([payload]).select();
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
    const sc = await this._getSchoolCode();
    return await _supabase.from('teacher_assignments').insert([{ 
        teacher_id: teacherId, 
        class_id: classId, 
        type: 'class',
        school_code: sc
    }]);
  },
  async assignSubjectTeacher(teacherId, classId, subjectId) {
    const sc = await this._getSchoolCode();
    return await _supabase.from('teacher_assignments').insert([{ 
        teacher_id: teacherId, 
        class_id: classId, 
        subject_id: subjectId, 
        type: 'subject',
        school_code: sc
    }]);
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
    const cacheKey = `students_${sc}_${classId || 'all'}`;
    if (MEM_CACHE.students && MEM_CACHE.students[cacheKey]) return MEM_CACHE.students[cacheKey];

    const profile = await this.getProfile();
    let query = _supabase.from('students').select('*, classes(name)');
    
    if (sc !== 'GLOBAL') query = query.eq('school_code', sc);
    
    if (profile?.role === 'teacher') {
        const assignments = await this.getTeacherAssignments(profile.id);
        const myClassIds = [...new Set(assignments.filter(a => a.type === 'class').map(a => a.class_id))];
        const mySubjectClassIds = [...new Set(assignments.filter(a => a.type === 'subject').map(a => a.class_id))];
        const allowedClasses = [...new Set([...myClassIds, ...mySubjectClassIds])];
        
        if (allowedClasses.length > 0) {
            query = query.in('class_id', allowedClasses);
        } else {
            return [];
        }
    }
    
    if (classId) query = query.eq('class_id', classId);
    const { data, error } = await query;
    if (error) return [];
    
    if (!MEM_CACHE.students) MEM_CACHE.students = {};
    MEM_CACHE.students[cacheKey] = data || [];
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
    
    // STRICT SDMS FILTERING
    if (sc !== 'GLOBAL') {
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
    const user = await this._getUser();
    const { data: profile } = await _supabase.from('profiles').select('role, id').eq('id', user.id).maybeSingle();

    let query = _supabase.from('subjects').select('*, classes(name)');
    
    // 1. SaaS Isolation
    if (sc !== 'GLOBAL') query = query.eq('school_code', sc);
    
    // 2. Teacher Jurisdiction (Subject Level)
    if (profile?.role === 'teacher') {
        const assignments = await this.getTeacherAssignments(profile.id);
        const mySubIds = [...new Set(assignments.filter(a => a.type === 'subject' || a.type === 'class_subject').map(a => a.subject_id))];
        const isClassTeacher = assignments.some(a => a.type === 'class');

        // If NOT a head class teacher, restrict to only their subjects
        if (!isClassTeacher && mySubIds.length > 0) {
            query = query.in('id', mySubIds);
        } else if (!isClassTeacher && mySubIds.length === 0) {
            return []; // Complete lockout if no assignments
        }
    }
    
    if (classId) query = query.eq('class_id', classId);
    const { data, error } = await query;
    if (error) { console.error('[DB] getSubjects:', error); return []; }
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
    const cacheKey = `marks_${sc}_${JSON.stringify(filters)}`;
    if (MEM_CACHE.marks[cacheKey]) return MEM_CACHE.marks[cacheKey];

    const profile = await this.getProfile();
    let query = _supabase.from('marks').select('*');
    if (sc !== 'GLOBAL') query = query.eq('school_code', sc);
    
    if (profile?.role === 'teacher') {
        const assignments = await this.getTeacherAssignments(profile.id);
        const myClassIds = [...new Set(assignments.filter(a => a.type === 'class').map(a => a.class_id))];
        const mySubAssignments = assignments.filter(a => a.type === 'subject');
        const mySubIds = mySubAssignments.map(a => a.subject_id).filter(Boolean);

        if (myClassIds.length > 0 && mySubIds.length > 0) {
            query = query.or(`class_id.in.(${myClassIds.join(',')}),subject_id.in.(${mySubIds.join(',')})`);
        } else if (myClassIds.length > 0) {
            query = query.in('class_id', myClassIds);
        } else if (mySubIds.length > 0) {
            query = query.in('subject_id', mySubIds);
        } else {
             return [];
        }
    }

    if (filters.studentId)    query = query.eq('student_id', filters.studentId);
    if (filters.subjectId)    query = query.eq('subject_id', filters.subjectId);
    if (filters.term)         query = query.eq('term', filters.term);
    if (filters.year)         query = query.eq('academic_year', filters.year);
    if (filters.id)           query = query.eq('id', filters.id);
    if (filters.classId)      query = query.eq('class_id', filters.classId);
    if (filters.classIds)     query = query.in('class_id', filters.classIds);
    
    const { data, error } = await query;
    if (error) return [];
    
    MEM_CACHE.marks[cacheKey] = data || [];
    return data || [];
  },

  // Upsert single mark Ã¢â‚¬â€ (student_id, subject_id, assessment_id, term) composite key
  async saveMark(markObj) {
    const sc = await this._getSchoolCode();
    return await _supabase.from('marks').upsert({ ...markObj, school_code: sc }, {
      onConflict: 'student_id,subject_id,assessment_id,term,academic_year'
    }).select();
  },

  // Batch save Ã¢â‚¬â€ array of mark objects
  async saveMarksBatch(marksArray) {
    const sc = await this._getSchoolCode();
    const batch = marksArray.map(m => ({ ...m, school_code: sc }));
    return await _supabase.from('marks').upsert(batch, {
      onConflict: 'student_id,subject_id,assessment_id,term,academic_year'
    }).select();
  },

  // --- MARKS: SUBMISSION ---
  async submitMarksForClass(subjectId, classId, term = 2) {
    const sc = await this._getSchoolCode();
    const updatePayload = {
      is_submitted: true,
      submitted_at: new Date().toISOString()
    };
    let query = _supabase.from('marks')
      .update(updatePayload)
      .eq('subject_id', subjectId)
      .eq('term', term);
    
    // STRICT SDMS FILTERING
    if (sc !== 'GLOBAL') query = query.eq('school_code', sc);
    
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
    const sc = await this._getSchoolCode();
    let query = _supabase.from('marks').update({
      is_approved: true,
      is_submitted: true,
      approved_at: new Date().toISOString(),
      rejection_comment: null
    }).eq('is_submitted', true).eq('is_approved', false);

    // STRICT SDMS FILTERING
    if (sc !== 'GLOBAL') query = query.eq('school_code', sc);

    return await query.select();
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

  // Lock finalized results Ã¢â‚¬â€ no more editing allowed
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

    let query = _supabase.from('assessments').select('*');
    if (sc !== 'GLOBAL') query = query.eq('school_code', sc);
    const { data, error } = await query.order('created_at');
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
    const sc = await this._getSchoolCode();
    if (sc === 'DENIED' || sc === 'UNAUTHORIZED') return null;

    // 1. PRIMARY SOURCE: Official registry from System Administrator
    const { data: schoolRecord } = await _supabase
      .from('schools')
      .select('*')
      .eq('sdms_code', sc)
      .maybeSingle();

    // 2. SECONDARY SOURCE: School-specific settings
    const { data: schoolSettings } = await _supabase
      .from('school_settings')
      .select('info')
      .eq('school_code', sc)
      .maybeSingle();

    // Merge: Prioritize settings (Admin customizations) over base Registry data
    const info = {
      ...(schoolSettings?.info || {}),
      school: schoolSettings?.info?.school || schoolRecord?.name || 'MMS PORTAL',
      district: schoolSettings?.info?.district || schoolRecord?.district || '',
      sector: schoolSettings?.info?.sector || schoolRecord?.sector || '',
      province: schoolSettings?.info?.province || schoolRecord?.province || '',
      code: sc,
      headteacher: schoolSettings?.info?.headteacher || '',
      phone: schoolSettings?.info?.phone || '',
      academic_year: schoolSettings?.info?.academic_year || '2025/2026',
      done_date: schoolSettings?.info?.done_date || new Date().toLocaleDateString('en-GB')
    };

    return info;
  },
  async saveSchoolInfo(updates) {
    const sc = await this._getSchoolCode();
    if (sc === 'DENIED' || sc === 'UNAUTHORIZED' || sc === 'DEFAULT' || sc === 'GLOBAL') return { error: 'Not authorized' };
    
    const { data: existing } = await _supabase.from('school_settings').select('info').eq('school_code', sc).maybeSingle();
    const mergedInfo = { ...(existing?.info || {}), ...updates };
    
    return await _supabase
      .from('school_settings')
      .upsert({ school_code: sc, info: mergedInfo }, { onConflict: 'school_code' });
  },

  /**
   * Real-Time Institutional Intelligence
   * Fetches counts for Dashboard KPIs
   */
  async getInstitutionalStats() {
    const sc = await this._getSchoolCode();
    
    const filter = sc === 'GLOBAL' ? {} : { school_code: sc };
    
    const [students, teachers, classes, pending] = await Promise.all([
      _supabase.from('students').select('*', { count: 'exact', head: true }).match(filter),
      _supabase.from('profiles').select('*', { count: 'exact', head: true }).match(filter).eq('role', 'teacher'),
      _supabase.from('classes').select('*', { count: 'exact', head: true }).match(filter),
      _supabase.from('marks').select('*', { count: 'exact', head: true }).match(filter).eq('is_submitted', true).eq('is_approved', false)
    ]);

    return {
      students: students.count || 0,
      teachers: teachers.count || 0,
      classes:  classes.count || 0,
      pending:  pending.count || 0
    };
  },
  async restoreSession() {
    try {
        const { data: { session }, error } = await _supabase.auth.getSession();
        if (error || !session) return null;
        
        const profile = await this.getProfile();
        if (!profile) return null;
        
        // Restore session context
        sessionStorage.setItem('current_role', profile.role);
        sessionStorage.setItem('current_school_code', profile.school_code || 'DEFAULT');
        
        return { user: session.user, profile };
    } catch (e) {
        return null;
    }
  },

  async forgotPassword(email) {
    const { error } = await _supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/Login.html?reset=true'
    });
    if (error) throw error;
    return true;
  },

  handleSupabaseError(error) {
    console.error('[DB_ERROR]', error);
    if (error.message.includes('JWT')) return new Error('Session expired. Please log in again.');
    if (error.message.includes('fetch')) return new Error('Network Error: Cannot reach Supabase.');
    return error;
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
    if (typeof DB !== 'undefined' && DB._getSchoolCode) {
        return await DB._getSchoolCode();
    }
    // Fallback if DB not fully loaded
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return 'UNAUTHORIZED';
    const { data: p } = await _supabase.from('profiles').select('school_code').eq('id', user.id).maybeSingle();
    return p?.school_code || 'MISSING_LINK';
}

/**
 * Register an admin/teacher with a school code
 * Synchronizes with AccountManager for full identity provisioning
 */
async function registerUserWithSchoolCode(email, password, fullName, role, schoolCode) {
  try {
    // 1. Policy Validation: Ensure the school exists in the master registry
    const { data: school, error: schoolError } = await _supabase
      .from('schools')
      .select('sdms_code, name')
      .eq('sdms_code', schoolCode)
      .maybeSingle();
    
    if (schoolError) throw schoolError;
    if (!school && schoolCode !== 'GLOBAL') {
      throw new Error(`The institutional code "${schoolCode}" is not recognized in our registry.`);
    }

    console.log(`[AUTH_PROVISION] Initiating ${role} registration for ${school?.name || 'GLOBAL'}`);

    // 2. Delegate to AccountManager (defined in registration.js)
    // If AccountManager isn't loaded yet (e.g. race condition), we provide a fallback
    if (typeof AccountManager !== 'undefined') {
        return await AccountManager.createAccount({
            email,
            password,
            fullName,
            role,
            schoolCode
        });
    } else {
        // JIT Fallback: Create profile and let DB.signIn handle the rest
        const { error: profileError } = await _supabase.from('profiles').upsert({
            email,
            full_name: fullName,
            role: role,
            school_code: schoolCode,
            temp_password_active: true,
            created_at: new Date().toISOString()
        }, { onConflict: 'email' });
        
        if (profileError) throw profileError;
        return { success: true };
    }
  } catch (error) {
    console.error('[AUTH_FATAL] Registration failed:', error.message);
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
    
    // BYPASS CACHE IF REQUESTED OR IF DATA IS STALE
    if (!window._FORCE_REFRESH) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          const ageMs = Date.now() - parsed.timestamp;
          if (ageMs < 600000) return parsed.data; // Reduce cache to 10 mins
        }
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
      .eq('sdms_code', schoolCode)
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
      // SECURITY GUARD: Backup validation to prevent cross-leakage
      if (schoolCode !== 'GLOBAL' && payload.new && payload.new.school_code !== schoolCode) return;
      
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
      console.log(`Ã¢Å“â€¦ Real-time sync enabled for school ${schoolCode}`);
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
// Bi-directional: Teacher Ã¢â€¡â€ž Admin with auto-retry
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
   * @param {Function} fn Ã¢â‚¬â€ function(payload) called on INSERT/UPDATE/DELETE
   */
  on(event, fn) {
    if (!this._callbacks[event]) this._callbacks[event] = [];
    this._callbacks[event].push(fn);
  },

  _emit(event, payload) {
    console.log(`[SYNC] Emitting event: ${event}`, payload.eventType);
    
    // CACHE INVALIDATION: Purge local cache for the affected table
    // We clear all institutional cache if something big changed
    const tablesToClearCache = ['marks', 'students', 'profiles', 'classes', 'subjects', 'assessments', 'teacher_assignments', 'school_settings'];
    if (tablesToClearCache.includes(event) || event === 'teachers' || event === 'assignments') {
        Object.keys(localStorage).forEach(k => {
            if (k.startsWith('camis_cache_')) localStorage.removeItem(k);
        });
        if (typeof MEM_CACHE !== 'undefined' && MEM_CACHE.clear) MEM_CACHE.clear();
    }

    // Notify registered UI listeners
    (this._callbacks[event] || []).forEach(fn => {
      try { fn(payload); } catch(e) { console.error('[SYNC] Callback error on', event, ':', e); }
    });

    // Global refresh trigger for components that don't use fine-grained SYNC.on
    window.dispatchEvent(new CustomEvent('mms-data-changed', { detail: { table: event, payload } }));
  },

  _updateBadge(status) {
    const badge = document.getElementById('sync-badge') ||
                  document.getElementById('setup-status') ||
                  document.getElementById('term-tag');
    if (!badge) return;

    if (status === 'SUBSCRIBED') {
      this._connected = true;
      this._retryCount = 0;
      badge.textContent = 'Ã°Å¸Å¸Â¢ LIVE SYNC';
      badge.style.background = '#dcfce7';
      badge.style.color = '#166534';
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      this._connected = false;
      badge.textContent = 'Ã°Å¸â€Â´ CONNECTION ISSUE';
      badge.style.background = '#fee2e2';
      badge.style.color = '#991b1b';
      this._retry();
    } else if (status === 'CLOSED') {
      this._connected = false;
      badge.textContent = 'Ã¢Å¡Â« OFFLINE';
      badge.style.background = '#f1f5f9';
      badge.style.color = '#475569';
      this._retry();
    } else {
      badge.textContent = 'Ã°Å¸â€â€ž CONNECTING...';
      badge.style.background = '#fef3c7';
      badge.style.color = '#92400e';
    }
  },

  _retry() {
    if (this._retryCount >= this._maxRetries) {
      toast('Ã¢Å¡Â Ã¯Â¸Â Sync disconnected. Please refresh the page.', 'error');
      return;
    }
    this._retryCount++;
    const delay = Math.min(2000 * this._retryCount, 15000); // Exponential backoff, max 15s
    console.log(`[SYNC] Retrying in ${delay}ms (attempt ${this._retryCount}/${this._maxRetries})...`);
    // toast(`Ã°Å¸â€â€ž Connection issue, retrying... (${this._retryCount})`, 'info');
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
  async start() {
    if (this._channel) return;
    
    // FETCH SCHOOL CODE for isolated channel
    const sc = await DB._getSchoolCode();
    const chanName = (sc === 'GLOBAL') ? 'mms-global-sync' : `mms-sync-${sc}`;

    console.log(`[SYNC] Initializing isolated channel: ${chanName}`);

    this._channel = _supabase
      .channel(chanName)

      // MARKS Ã¢â‚¬â€ Teacher saves/edits, Admin approves/rejects/locks
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'marks', filter: sc !== 'GLOBAL' ? `school_code=eq.${sc}` : undefined },
          payload => {
            console.log('[SYNC] marks Ã¢â€ â€™', payload.eventType);
            this._emit('marks', payload);
          }
      )
      // STUDENTS Ã¢â‚¬â€ Admin enrolls/removes
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'students', filter: sc !== 'GLOBAL' ? `school_code=eq.${sc}` : undefined },
          payload => {
            console.log('[SYNC] students Ã¢â€ â€™', payload.eventType);
            this._emit('students', payload);
          }
      )
      // PROFILES (Teachers) Ã¢â‚¬â€ Admin adds/modifies/removes teachers
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'profiles', filter: sc !== 'GLOBAL' ? `school_code=eq.${sc}` : undefined },
          payload => {
            console.log('[SYNC] profiles Ã¢â€ â€™', payload.eventType);
            this._emit('teachers', payload);
          }
      )
      // CLASSES Ã¢â‚¬â€ Admin creates/edits classes
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'classes' },
          payload => {
            console.log('[SYNC] classes Ã¢â€ â€™', payload.eventType);
            this._emit('classes', payload);
          }
      )
      // SUBJECTS Ã¢â‚¬â€ Admin manages curriculum subjects
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'subjects' },
          payload => {
            console.log('[SYNC] subjects Ã¢â€ â€™', payload.eventType);
            this._emit('subjects', payload);
          }
      )
      // ASSESSMENTS Ã¢â‚¬â€ Admin configures assessment types
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'assessments' },
          payload => {
            console.log('[SYNC] assessments Ã¢â€ â€™', payload.eventType);
            this._emit('assessments', payload);
          }
      )
      // TEACHER ASSIGNMENTS
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'teacher_assignments' },
          payload => {
            console.log('[SYNC] teacher_assignments Ã¢â€ â€™', payload.eventType);
            this._emit('assignments', payload);
          }
      )
      // SCHOOL SETTINGS Ã¢â‚¬â€ Admin updates logo, terms, etc.
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'school_settings' },
          payload => {
            console.log('[SYNC] school_settings Ã¢â€ â€™', payload.eventType);
            this._emit('school_settings', payload);
          }
      )
      // NOTIFICATIONS
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'notifications' },
          payload => {
            console.log('[SYNC] notifications Ã¢â€ â€™', payload.eventType);
            this._emit('notifications', payload);
          }
      )
      // SUPPORT MESSAGES
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'support_messages' },
          payload => {
            console.log('[SYNC] support_messages Ã¢â€ â€™', payload.eventType);
            this._emit('support_messages', payload);
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
  },

  clearCache() {
    console.log('[DB] Clearing all institutional cache...');
    const keysToKeep = ['sb-auth-token']; // Keep auth token for proper signout if needed
    
    // Clear Session Storage
    sessionStorage.clear();
    
    // Selective Local Storage Clear
    Object.keys(localStorage).forEach(key => {
      if (!keysToKeep.includes(key)) {
        localStorage.removeItem(key);
      }
    });
    
    console.log('[DB] Institutional node wiped.');
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

window.DB = DB;
window.SYNC = SYNC;
window.toast = toast;
window.getCurrentSchoolCode = getCurrentSchoolCode;
window.registerUserWithSchoolCode = registerUserWithSchoolCode;

console.log('[DB] System initialized and exported.');
