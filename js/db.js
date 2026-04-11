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
// DATABASE OPERATIONS (Single source of truth with Performance Caching)
// ============================================================
const DB_CACHE = {
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
   * Universal Login: handles Email, Phone, or SDMS Code
   */
  async signIn(identifier, password) {
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
      const { data: p } = await _supabase.from('profiles').select('*').eq('email', email).single();
      
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

    // PHASE 3: Auto-Linking (Fix existing ID mismatches)
    // Since we are moving the PK 'id' to match the Auth ID, we must also update all related assignments
    const { data: linked } = await _supabase.from('profiles').select('*').eq('email', email).maybeSingle();
    
    if (linked) {
      const oldId = linked.id;
      const newId = authData.user.id;

      // Only attempt to migrate if they differ
      if (oldId !== newId) {
        // update assignments first to stay linked (if CASCADE not on)
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
    
    return { user: authData.user, profile };
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

  // --- TEACHERS ---
  async getTeachers() {
    const cached = DB_CACHE.get('teachers');
    if (cached) return cached;
    
    const { data, error } = await _supabase.from('profiles').select('*').eq('role', 'teacher');
    if (error) { console.error('[DB] getTeachers:', error); return []; }
    DB_CACHE.set('teachers', data || []);
    return data || [];
  },
  async addTeacher(teacherObj) {
    // teacherObj expected to have: full_name, email, role, sdms_code, phone, is_class_teacher, is_subject_teacher
    const payload = {
      ...teacherObj,
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
        return await _supabase.from('profiles').update(payload).eq('id', existing.id).select();
    }
    
    // Normal Insertion
    return await _supabase.from('profiles').insert([payload]).select();
  },
  async updateTeacher(id, updates) {
    return await _supabase.from('profiles').update(updates).eq('id', id).select();
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
    return await _supabase.from('profiles').delete().eq('id', id);
  },
  async resetTeacherSecurity(id) {
    return await _supabase.from('profiles').update({ temp_password_active: true }).eq('id', id).select();
  },

  // --- STUDENTS ---
  async getStudents(classId = null) {
    if (!classId) {
        const cached = DB_CACHE.get('students_all');
        if (cached) return cached;
    }
    
    let query = _supabase.from('students').select('*, classes(name)');
    if (classId) query = query.eq('class_id', classId);
    const { data, error } = await query;
    if (error) { console.error('[DB] getStudents:', error); return []; }
    
    if (!classId) DB_CACHE.set('students_all', data || []);
    return data || [];
  },
  async addStudent(studentObj) {
    return await _supabase.from('students').insert([studentObj]).select();
  },
  async deleteStudent(id) {
    return await _supabase.from('students').delete().eq('id', id);
  },

  // --- CLASSES ---
  async getClasses() {
    const cached = DB_CACHE.get('classes');
    if (cached) return cached;

    const { data, error } = await _supabase.from('classes').select('*').order('name');
    if (error) { console.error('[DB] getClasses:', error); return []; }
    DB_CACHE.set('classes', data || []);
    return data || [];
  },
  async addClass(name) {
    return await _supabase.from('classes').insert([{ name }]).select();
  },

  // --- SUBJECTS ---
  async getSubjects(classId = null) {
    if (!classId) {
        const cached = DB_CACHE.get('subjects_all');
        if (cached) return cached;
    }

    let query = _supabase.from('subjects').select('*, classes(name)');
    if (classId) query = query.eq('class_id', classId);
    const { data, error } = await query;
    if (error) { console.error('[DB] getSubjects:', error); return []; }
    
    if (!classId) DB_CACHE.set('subjects_all', data || []);
    return data || [];
  },
  async addSubject(subjectObj) {
    return await _supabase.from('subjects').insert([subjectObj]).select();
  },

  // --- MARKS ---
  async getMarks(filters = {}) {
    let query = _supabase.from('marks').select('*');
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
    return await _supabase.from('marks').upsert(markObj, {
      onConflict: 'student_id,subject_id,assessment_id,term,academic_year'
    }).select();
  },

  // Batch save — array of mark objects
  async saveMarksBatch(marksArray) {
    return await _supabase.from('marks').upsert(marksArray, {
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
    const cached = DB_CACHE.get('assessments');
    if (cached) return cached;

    const { data, error } = await _supabase.from('assessments').select('*').order('created_at');
    if (error) { console.error('[DB] getAssessments:', error); return []; }
    DB_CACHE.set('assessments', data || []);
    return data || [];
  },
  async addAssessment(assessObj) {
    return await _supabase.from('assessments').insert([assessObj]).select();
  },
  async updateAssessment(id, updates) {
    return await _supabase.from('assessments').update(updates).eq('id', id).select();
  },
  async deleteAssessment(id) {
    return await _supabase.from('assessments').delete().eq('id', id);
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
  }
};

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
    // CACHE INVALIDATION: Purge local cache for the affected table
    if (event === 'teachers') DB_CACHE.set('teachers', null);
    if (event === 'students') DB_CACHE.set('students_all', null);
    if (event === 'classes')   DB_CACHE.set('classes', null);
    if (event === 'subjects')  DB_CACHE.set('subjects_all', null);
    if (event === 'assessments') DB_CACHE.set('assessments', null);

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
