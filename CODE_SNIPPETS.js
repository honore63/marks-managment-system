/**
 * MULTI-ADMIN SYNCHRONIZED PORTAL
 * PRACTICAL CODE EXAMPLES & SNIPPETS
 * 
 * Copy and paste these into your admin.js and teacher.js
 */

// ============================================================
// SNIPPET 1: Add to admin.html BEFORE </body> tag
// ============================================================
// Include the registration modal
// <script src="ADMIN_REGISTRATION_MODAL.html"></script>
// OR copy the modal HTML directly into your index.html

// ============================================================
// SNIPPET 2: Page Load Initialization
// Add this to js/admin.js
// ============================================================

/**
 * Initialize Admin Portal with Multi-Admin Sync
 * Call this on page load
 */
async function initAdminPortal() {
  try {
    console.log('[INIT] Starting admin portal initialization...');

    // Check if user is authenticated
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) {
      console.warn('[AUTH] No user found, redirecting to login');
      window.location.href = '/index.html';
      return;
    }

    // Get current user's school code
    const schoolCode = await getCurrentSchoolCode();
    console.log(`[ADMIN] Connected to school: ${schoolCode}`);

    // Load school settings from database
    const settings = await fetchSchoolSettings(schoolCode);
    if (settings && settings.info) {
      SCHOOL_INFO = { ...SCHOOL_INFO, ...settings.info };
      console.log('[SCHOOL] Loaded info:', SCHOOL_INFO);
    }

    // Update UI header with school info
    document.getElementById('school-name-hd').textContent = SCHOOL_INFO.school || 'MMS Portal';
    document.getElementById('school-code-hd').textContent = `School ID • ${SCHOOL_INFO.code}`;

    // Mark this admin as active
    await updateLastSync();

    // Show active admins count
    const activeAdmins = await getAdminsInSchool(schoolCode);
    console.log(`[TEAM] ${activeAdmins.length} admin(s) active`);
    updateAdminActivityPanel(activeAdmins);

    // Enable real-time sync for this school
    const channel = subscribeToSchoolChanges(schoolCode);
    console.log('[SYNC] Subscribed to school changes');

    // Setup listeners for UI updates
    setupUIListeners(schoolCode);

    // Start regular sync tracking (every 30 seconds)
    setInterval(() => updateLastSync(), 30 * 1000);

    console.log('[INIT] Admin portal ready!');

  } catch (error) {
    console.error('[INIT] Error:', error);
    alert('Failed to initialize portal. Please refresh and try again.');
  }
}

// Call on page load
document.addEventListener('DOMContentLoaded', initAdminPortal);

// ============================================================
// SNIPPET 3: Real-Time UI Update Listeners
// Add this to js/admin.js
// ============================================================

/**
 * Setup listeners for real-time updates
 * Updates UI when other admins make changes
 */
function setupUIListeners(schoolCode) {
  
  // Listen for new students
  if (SYNC && typeof SYNC.on === 'function') {
    SYNC.on('students', (payload) => {
      console.log('[UPDATE] Students changed:', payload.eventType);
      if (payload.eventType === 'INSERT') {
        toast('📚 New student added', 'info');
        // Reload students list
        loadStudentsTable();
      } else if (payload.eventType === 'DELETE') {
        toast('🗑️ Student removed', 'info');
        loadStudentsTable();
      } else if (payload.eventType === 'UPDATE') {
        loadStudentsTable();
      }
    });

    // Listen for mark submissions/approvals
    SYNC.on('marks', (payload) => {
      console.log('[UPDATE] Marks changed:', payload.eventType);
      if (payload.new?.is_approved) {
        toast('✅ Marks approved', 'success');
      }
      if (payload.new?.is_submitted) {
        toast('📤 Marks submitted for review', 'info');
      }
      // Refresh approval queue
      loadMarksApprovalQueue();
    });

    // Listen for teacher changes
    SYNC.on('teachers', (payload) => {
      console.log('[UPDATE] Teachers changed:', payload.eventType);
      if (payload.eventType === 'INSERT') {
        toast('👨‍🏫 New teacher registered', 'success');
      }
      loadTeachersTable();
    });

    // Listen for school settings changes
    SYNC.on('school_settings', (payload) => {
      console.log('[UPDATE] School settings updated');
      // Reload settings
      fetchSchoolSettings(schoolCode).then(settings => {
        if (settings && settings.info) {
          SCHOOL_INFO = { ...SCHOOL_INFO, ...settings.info };
        }
      });
    });
  }
}

// ============================================================
// SNIPPET 4: Update Admin Activity Panel
// Shows which admins are currently using the system
// ============================================================

/**
 * Display active admins in a panel
 * Add this near your dashboard
 */
async function updateAdminActivityPanel(activeAdmins) {
  try {
    const panelEl = document.getElementById('admin-activity-panel');
    if (!panelEl) return;

    const { data: { user } } = await _supabase.auth.getUser();
    const currentUserId = user?.id;

    let html = `
      <div style="padding: 1rem; background: #f0f9ff; border-radius: 8px; margin-bottom: 1rem;">
        <h4 style="margin-top: 0;">👥 Active Admins (${activeAdmins.length})</h4>
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
    `;

    for (const admin of activeAdmins) {
      const isCurrentUser = admin.id === currentUserId;
      const lastSync = new Date(admin.last_sync_at);
      const minutesAgo = Math.round((Date.now() - lastSync) / 60000);

      html += `
        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem;">
          <span style="width: 8px; height: 8px; background: #10b981; border-radius: 50%;"></span>
          <strong>${admin.full_name}${isCurrentUser ? ' (You)' : ''}</strong>
          <span style="color: #64748b; font-size: 0.8rem;">${minutesAgo}m ago</span>
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;

    panelEl.innerHTML = html;
  } catch (error) {
    console.error('[UI] Error updating activity panel:', error);
  }
}

// ============================================================
// SNIPPET 5: Add/Update Student with School Code
// Replace your existing addStudent function
// ============================================================

/**
 * Add student with automatic school code
 */
async function addStudent(studentObj) {
  try {
    const schoolCode = await getCurrentSchoolCode();
    
    const payload = {
      ...studentObj,
      school_code: schoolCode // CRITICAL: Add school code
    };

    const { data, error } = await _supabase
      .from('students')
      .insert([payload])
      .select();

    if (error) throw error;

    toast(`✅ Student "${studentObj.name}" added`, 'success');
    return { success: true, data };
  } catch (error) {
    console.error('[DB] Error adding student:', error);
    toast(`❌ Failed to add student: ${error.message}`, 'error');
    return { success: false, error };
  }
}

// ============================================================
// SNIPPET 6: Load Students with School Filter
// Replace your existing getStudents function
// ============================================================

/**
 * Get all students for current school
 */
async function loadStudents() {
  try {
    const schoolCode = await getCurrentSchoolCode();

    // Check cache first
    const cacheKey = `students_${schoolCode}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const { data, error } = await _supabase
      .from('students')
      .select('*, classes(name)')
      .eq('school_code', schoolCode)  // CRITICAL: Filter by school
      .order('full_name');

    if (error) throw error;

    // Cache the result
    localStorage.setItem(cacheKey, JSON.stringify(data));
    return data || [];
  } catch (error) {
    console.error('[DB] Error loading students:', error);
    return [];
  }
}

// ============================================================
// SNIPPET 7: Load Teachers with School Filter
// ============================================================

/**
 * Get all teachers for current school
 */
async function loadTeachers() {
  try {
    const schoolCode = await getCurrentSchoolCode();

    const { data, error } = await _supabase
      .from('profiles')
      .select('*')
      .eq('role', 'teacher')
      .eq('school_code', schoolCode)  // CRITICAL: Filter by school
      .order('full_name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[DB] Error loading teachers:', error);
    return [];
  }
}

// ============================================================
// SNIPPET 8: Approve Marks for Teachers (Admin Only)
// ============================================================

/**
 * Admin approves marks submitted by teacher
 * Instantly visible to teacher via real-time
 */
async function approveMarks(markIds) {
  try {
    const { data: { user } } = await _supabase.auth.getUser();
    const schoolCode = await getCurrentSchoolCode();

    const { data, error } = await _supabase
      .from('marks')
      .update({
        is_approved: true,
        is_submitted: true,
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        school_code: schoolCode
      })
      .in('id', markIds)
      .select();

    if (error) throw error;

    // Broadcast notification to school
    await broadcastToSchool(
      schoolCode,
      `Admin approved ${markIds.length} marks`,
      'marks_approved'
    );

    toast(`✅ Approved ${markIds.length} marks`, 'success');
    return { success: true, data };
  } catch (error) {
    console.error('[DB] Error approving marks:', error);
    toast(`❌ Failed to approve marks: ${error.message}`, 'error');
    return { success: false, error };
  }
}

// ============================================================
// SNIPPET 9: Reject Marks with Comment
// ============================================================

/**
 * Admin rejects marks for revision
 * Teacher can see comment instantly
 */
async function rejectMarks(markIds, comment) {
  try {
    const schoolCode = await getCurrentSchoolCode();

    const { data, error } = await _supabase
      .from('marks')
      .update({
        is_submitted: false,    // Unlock for teacher to edit
        is_approved: false,
        rejection_comment: comment,
        rejected_at: new Date().toISOString(),
        school_code: schoolCode
      })
      .in('id', markIds)
      .select();

    if (error) throw error;

    // Notify teachers
    await broadcastToSchool(
      schoolCode,
      `Marks rejected: ${comment}`,
      'marks_rejected'
    );

    toast(`📝 Marks rejected with comment`, 'success');
    return { success: true, data };
  } catch (error) {
    console.error('[DB] Error rejecting marks:', error);
    return { success: false, error };
  }
}

// ============================================================
// SNIPPET 10: Check Data Consistency (Admin Audit)
// ============================================================

/**
 * Admin can run consistency check
 * Useful for finding orphaned records or errors
 */
async function runDataConsistencyCheck() {
  try {
    const schoolCode = await getCurrentSchoolCode();
    
    const report = await verifySchoolDataConsistency(schoolCode);
    
    console.log('[AUDIT] Consistency report:', report);
    
    alert(`
      Data Consistency Report for ${schoolCode}:
      
      Orphan Students: ${report.checks.orphanStudents}
      Invalid Recent Marks: ${report.checks.recentInvalidMarks}
      
      ✅ Check passed if both are 0
    `);
  } catch (error) {
    console.error('[AUDIT] Error:', error);
  }
}

// ============================================================
// SNIPPET 11: Broadcast Message to All Admins
// Show important notifications
// ============================================================

/**
 * Send notification to all admins in school
 * Useful for: System maintenance, deadlines, policy changes
 */
async function announceToAdmins(message) {
  try {
    const schoolCode = await getCurrentSchoolCode();
    
    await broadcastToSchool(
      schoolCode,
      message,
      'announcement'
    );

    toast('📢 Announcement sent to all admins', 'success');
  } catch (error) {
    console.error('[BROADCAST] Error:', error);
  }
}

// ============================================================
// SNIPPET 12: Teacher Portal Initialization
// Add to js/teacher.js
// ============================================================

/**
 * Initialize Teacher Portal for Multi-Admin System
 */
async function initTeacherPortal() {
  try {
    // Get teacher's school
    const schoolCode = await getCurrentSchoolCode();
    
    // Load school settings
    const settings = await fetchSchoolSettings(schoolCode);
    if (settings && settings.info) {
      document.getElementById('dash-school-name').textContent = settings.info.school;
    }

    // Listen for mark approvals/rejections
    SYNC.on('marks', (payload) => {
      console.log('[TEACHER] Marks status changed');
      
      if (payload.new?.is_approved) {
        toast('✅ Your marks were approved!', 'success');
      }
      if (payload.new?.rejection_comment) {
        toast(`📝 Marks were rejected: ${payload.new.rejection_comment}`, 'warning');
      }
      
      // Reload marks to show updated status
      loadMyMarksTable();
    });

    // Enable real-time for this school
    subscribeToSchoolChanges(schoolCode);
    
    console.log('[TEACHER] Portal ready');
  } catch (error) {
    console.error('[TEACHER] Error:', error);
  }
}

// ============================================================
// SNIPPET 13: Logout Cleanup
// ============================================================

/**
 * Proper logout that cleans up subscriptions
 */
async function logoutAdmin() {
  try {
    const schoolCode = await getCurrentSchoolCode();
    
    // Unsubscribe from real-time
    unsubscribeFromSchoolChanges(schoolCode);
    
    // Clear cache
    DB_CACHE.clear();
    sessionStorage.clear();
    
    // Sign out
    await _supabase.auth.signOut();
    
    // Redirect to login
    window.location.href = '/index.html';
  } catch (error) {
    console.error('[LOGOUT] Error:', error);
    window.location.href = '/index.html';
  }
}

// ============================================================
// USAGE SUMMARY
// ============================================================

/*

QUICK REFERENCE: Key Functions to Use

1. ON PAGE LOAD:
   - initAdminPortal()
   - subscribeToSchoolChanges(schoolCode)
   - setupUIListeners(schoolCode)

2. WHEN ADDING DATA:
   - addStudent(obj) → automatically adds school_code
   - DB.addTeacher(obj) → automatically adds school_code
   - DB.addSubject(obj) → automatically adds school_code

3. WHEN LOADING DATA:
   - loadStudents() → filters by school_code
   - loadTeachers() → filters by school_code
   - loadMarks() → filtered in real-time

4. FOR ADMIN ACTIONS:
   - approveMarks(markIds) → broadcast to school
   - rejectMarks(markIds, comment) → notify with comment
   - broadcastToSchool(code, message) → notify all admins

5. ON LOGOUT:
   - logoutAdmin() → cleanup subscriptions

*/
