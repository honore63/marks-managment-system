/**
 * MARKS MANAGEMENT SYSTEM — TEACHER PORTAL LOGIC
 * Re-engineered for school efficiency.
 * 
 * CORE FEATURES:
 * - Real-time sync with Admin Portal
 * - Multi-assessment (EU/ET) support
 * - School reports
 * - Intuitive Teacher Interface
 */

'use strict';

if (typeof window.el === 'undefined') {
    window.el = id => document.getElementById(id);
}
if (typeof SYNC === 'undefined') window.SYNC = DB; // Institutional Synchronization Bridge

let MY_PROFILE = null;
let MY_ASSIGNMENTS = [];
let SCHOOL_INFO = { 
    school: 'MMS INSTITUTIONAL PORTAL', 
    district: '', 
    sector: '',
    code: 'LOADING...', 
    phone: '',
    headteacher: '',
    academic_year: '2025/2026',
    active_term: '2',
    done_date: new Date().toLocaleDateString('en-GB')
};

let CURRENT_YEAR = '2025-2026';

// ============================================================
// MULTI-ADMIN PORTAL INITIALIZATION - TEACHER SIDE
// Step 5: Initialize teacher portal with real-time sync
// ============================================================

/**
 * Initialize Teacher Portal with Real-Time Sync
 */
async function initTeacherPortal() {
  try {
    console.log('[INIT] Starting optimized teacher portal initialization...');

    // 1. Parallel Core Authentication & Context Fetching
    const [userRes, schoolCode] = await Promise.all([
        _supabase.auth.getUser(),
        getCurrentSchoolCode()
    ]);

    const user = userRes.data?.user;
    if (!user) {
      console.warn('[AUTH] No user found, redirecting to login');
      window.location.href = 'index.html';
      return;
    }

    // 2. Parallel Profile & Institutional Data Fetching
    const [profile, officialInfo] = await Promise.all([
        DB.getProfile(),
        DB.getSchoolInfo()
    ]);

    if (!profile) {
        console.error('[PROFILE] Member registry record missing for:', user.email);
        toast('⚠️ Profile not found. Contact your school administrator.', 'error');
        return;
    }
    
    MY_PROFILE = profile;
    
    // 3. Parallel Assignment & Branding Updates
    const [assignments] = await Promise.all([
        DB.getTeacherAssignments(profile.id)
    ]);
    MY_ASSIGNMENTS = assignments;

    if (officialInfo) {
      SCHOOL_INFO = { ...SCHOOL_INFO, ...officialInfo };
    }

    // UI Identity Injection
    if (el('header-user-name')) el('header-user-name').textContent = profile.full_name || 'TEACHER';
    if (el('header-school-name')) el('header-school-name').textContent = SCHOOL_INFO.school || 'MMS NODE';
    if (el('header-user-avatar')) el('header-user-avatar').textContent = (profile.full_name || 'T').charAt(0).toUpperCase();

    console.log(`[TEACHER] Verified: ${profile.full_name} for node: ${schoolCode}`);

    // Update UI header with school info
    const schoolNameEl = document.getElementById('school-name-hd');
    const schoolCodeEl = document.getElementById('school-code-hd');
    const schoolNodeBadge = document.getElementById('school-node-badge');
    
    if (schoolNameEl) {
        schoolNameEl.textContent = (SCHOOL_INFO.school && SCHOOL_INFO.school !== 'MMS INSTITUTIONAL PORTAL') 
            ? SCHOOL_INFO.school.toUpperCase() 
            : 'MMS PORTAL';
    }
    if (schoolCodeEl) schoolCodeEl.textContent = `SDMS Code • ${schoolCode}`;
    if (schoolNodeBadge) schoolNodeBadge.textContent = (SCHOOL_INFO.school || 'MMS Institutional').toUpperCase();
    
    // Refresh Icons
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // ============================================================
    // CRITICAL: ROLE-BASED SIDEBAR ACTIVATION ENGINE
    // ============================================================
    const isClassTeacher = MY_ASSIGNMENTS.some(a => a.type === 'class');
    const isSubjectTeacher = MY_ASSIGNMENTS.some(a => a.type === 'subject');
    
    console.log(`[SIDEBAR] Roles detected → Class Teacher: ${isClassTeacher}, Subject Teacher: ${isSubjectTeacher}`);
    console.log(`[SIDEBAR] Total assignments loaded: ${MY_ASSIGNMENTS.length}`);

    // Show Class Teacher exclusive tools
    if (isClassTeacher) {
        const studentsNav = document.getElementById('side-students');
        const reportsNav = document.getElementById('side-reports');
        const proclamationNav = document.getElementById('side-proclamation');
        
        if (studentsNav) studentsNav.style.display = 'flex';
        if (reportsNav) reportsNav.style.display = 'flex';
        if (proclamationNav) proclamationNav.style.display = 'flex';
        
        console.log('[SIDEBAR] ✅ Class Teacher tools activated');
    }

    // Subject Teachers also get Reports access
    if (isSubjectTeacher && !isClassTeacher) {
        const reportsNav = document.getElementById('side-reports');
        if (reportsNav) reportsNav.style.display = 'flex';
        console.log('[SIDEBAR] ✅ Subject Teacher report access activated');
    }

    // Ensure Dashboard (My Classes) and Verification (Assigned Subjects) are always visible for any faculty
    if (el('side-dashboard')) el('side-dashboard').style.display = 'flex';
    if (el('side-verification')) el('side-verification').style.display = 'flex';

    // ============================================================
    // PROFILE IDENTITY ENGINE — Populate Header + Sidebar Footer
    // ============================================================
    const teacherName = MY_PROFILE?.full_name || 'Teacher';
    const teacherSdms = MY_PROFILE?.sdms_code || MY_PROFILE?.school_code || schoolCode || 'N/A';
    
    const dashTeacherName = document.getElementById('dash-teacher-name');
    const dashSchoolName = document.getElementById('dash-school-name');
    const dashProfileName = document.getElementById('dash-profile-name');
    const dashProfileEmail = document.getElementById('dash-profile-email');
    const dashProfileCode = document.getElementById('dash-profile-code');
    const sidebarUserName = document.getElementById('sidebar-user-name');
    const sidebarUserRole = document.getElementById('sidebar-user-role');
    const sidebarAvatarInit = document.getElementById('sidebar-avatar-init');
    
    // Header Identity
    if (dashTeacherName) dashTeacherName.textContent = `Welcome, ${teacherName}`;
    if (dashSchoolName) dashSchoolName.textContent = SCHOOL_INFO.school || 'MMS Portal';
    if (dashProfileName) dashProfileName.textContent = teacherName;
    if (dashProfileEmail) dashProfileEmail.textContent = MY_PROFILE?.email || 'N/A';
    if (dashProfileCode) dashProfileCode.textContent = `ID: ${teacherSdms}`;
    
    // Sidebar Footer Identity
    if (sidebarUserName) sidebarUserName.textContent = teacherName;
    if (sidebarUserRole) {
        if (isClassTeacher && isSubjectTeacher) sidebarUserRole.textContent = 'Class Lead & Instructor';
        else if (isClassTeacher) sidebarUserRole.textContent = 'Class Lead';
        else if (isSubjectTeacher) sidebarUserRole.textContent = 'Subject Instructor';
        else sidebarUserRole.textContent = 'Pedagogical Faculty';
    }
    if (sidebarAvatarInit) sidebarAvatarInit.textContent = teacherName.charAt(0).toUpperCase();

    console.log(`[IDENTITY] ✅ Welcome, ${teacherName} | School: ${SCHOOL_INFO.school} | SDMS: ${teacherSdms}`);

    // Render the main dashboard view with data
    await renderDashboard();
    await renderQuickJump();

    // Mark this teacher as active
    await updateLastSync();

    // Enable real-time sync for this school (non-critical)

    // Setup listeners for UI updates (non-critical)
    try { setupTeacherUIListeners(schoolCode); } catch(e) { console.warn('[UI]', e.message); }

    // Start regular sync tracking (every 30 seconds)
    setInterval(() => updateLastSync().catch(()=>{}), 30 * 1000);

    // INITIALIZE REAL-TIME INSTITUTIONAL BRIDGE
    if (typeof SYNC !== 'undefined' && SYNC.start) {
        await SYNC.start();
        console.log('[SYNC] Faculty Node Online');
    }

    console.log('[INIT] ✅ Teacher portal ready!');

  } catch (error) {
    console.error('[INIT] Teacher portal error:', error.message, error);
    const tc = document.getElementById('toast-container');
    if (tc) {
      const t = document.createElement('div');
      t.className = 'toast error';
      t.style.cssText = 'padding:1rem 1.5rem;background:#fef2f2;color:#dc2626;border-radius:12px;border:2px solid #fecaca;font-weight:800;font-size:0.85rem;';
      t.textContent = `⚠️ ${error.message || 'Startup issue'}. Please refresh if data is missing.`;
      tc.appendChild(t); setTimeout(() => t.remove(), 7000);
    }
  }
}

/**
 * Setup real-time listeners for teacher portal
 */
function setupTeacherUIListeners(schoolCode) {
  if (SYNC && typeof SYNC.on === 'function') {
    
    // Helper to refresh current active view
    const refreshCurrentView = async () => {
        const activeView = document.querySelector('.view.active')?.id;
        console.log(`[SYNC] Refreshing active view: ${activeView}`);
        
        if (activeView === 'view-dashboard') await renderDashboard();
        if (activeView === 'view-marks-entry') await renderMarksEntry();
        if (activeView === 'view-verification') await renderVerificationView();
        if (activeView === 'view-approval-status') await renderApprovalStatus();
    };

    SYNC.on('marks', (payload) => {
      console.log('[UPDATE] Marks changed:', payload.eventType);
      
      if (payload.new?.is_approved && !payload.old?.is_approved) {
        toast('✅ Your marks have been approved by admin', 'success');
      }
      
      if (payload.new?.rejection_comment && !payload.old?.rejection_comment) {
        toast('⚠️ Marks rejected. Please check comments.', 'error');
      }

      refreshCurrentView();
    });

    SYNC.on('students', (payload) => {
      console.log('[UPDATE] Students updated');
      refreshCurrentView();
    });

    SYNC.on('assignments', () => {
        toast('📋 Institutional assignments updated', 'info');
        refreshCurrentView();
    });

    SYNC.on('school_settings', (payload) => {
      console.log('[UPDATE] School settings updated');
      DB.getSchoolInfo().then(info => {
        if (info) {
          SCHOOL_INFO = info;
        }
      });
      refreshCurrentView();
    });

    // Sync indicators
    const updateSyncTime = () => {
        const el = document.getElementById('dash-last-synced');
        if (el) el.textContent = `Last Synced: ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    };
    window.addEventListener('mms-data-changed', updateSyncTime);
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initTeacherPortal);

function toggleSidebar() {
    const sb = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const mobileBtn = document.getElementById('mobile-toggle-btn');
    if (!sb) return;
    
    if (window.innerWidth > 1024) {
        // Desktop: Toggle Collapse
        sb.classList.toggle('collapsed');
        localStorage.setItem('sidebar_collapsed', sb.classList.contains('collapsed'));
    } else {
        // Mobile: Toggle Open Overlay
        const isOpen = sb.classList.toggle('open');
        if (overlay) {
            overlay.classList.toggle('active');
            overlay.style.display = overlay.classList.contains('active') ? 'block' : 'none';
        }

        // Dynamic icon toggle for mobile btn
        if (mobileBtn) {
            const icon = mobileBtn.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', isOpen ? 'x' : 'menu');
                if (window.lucide) lucide.createIcons();
            }
        }
    }
}

async function syncSchoolData() {
    toast('Syncing School Data...', 'info');
    await syncConfigs();
    await renderProfile();
    await renderDashboard();
    toast('Teaching subjects updated.', 'success');
}

window.addEventListener('DOMContentLoaded', () => {
    const dp = el('report-date-picker');
    if (dp) dp.value = new Date().toISOString().split('T')[0];
});

async function updateDiagnostics() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (el('diag-auth-id')) el('diag-auth-id').textContent = user?.id || 'N/A';
    if (el('diag-email')) el('diag-email').textContent = user?.email || 'N/A';
}

async function repairLinkManually() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return toast('Authentication failed.', 'error');
    
    toast('Repairing account link...', 'info');
    try {
        await DB.repairInstitutionalLink(user.email, user.id);
        toast('Link Repaired. RE-SYNCING...', 'success');
        await syncSchoolData();
    } catch (e) {
        toast('Repair Failed: ' + e.message, 'error');
    }
}

// Close sidebar on link click (mobile)
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 1024) {
        if (e.target.classList.contains('nav-item') || e.target.closest('.nav-item') || e.target.classList.contains('sidebar-item') || e.target.closest('.sidebar-item')) {
            const sb = document.querySelector('.sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            if (sb && sb.classList.contains('open')) toggleSidebar();
        }
    }
});

const SUBJECT_MAX = {
    'Mathematics':                              { wt: 10, mt: 20, eu: 100, mid: 50, et: 100 },
    'English':                                  { wt: 10, mt: 20, eu: 100, mid: 50, et: 100 },
    'Kinyarwanda':                              { wt: 10, mt: 20, eu: 100, mid: 50, et: 100 },
    'Science and Elementary Technology (SET)':   { wt: 10, mt: 15, eu: 60, mid: 30, et: 60 },
    'SET':                                      { wt: 10, mt: 15, eu: 60, mid: 30, et: 60 },
    'Social and Religious Studies (SRS)':        { wt: 10, mt: 15, eu: 60, mid: 30, et: 60 },
    'SRS':                                      { wt: 10, mt: 15, eu: 60, mid: 30, et: 60 },
    'Creative Arts':                            { wt: 5, mt: 10, eu: 40, mid: 20, et: 40 },
    'Physical Education & Sports':              { wt: 5, mt: 5, eu: 20, mid: 10, et: 20 },
    'French':                                   { wt: 5, mt: 10, eu: 40, mid: 20, et: 40 }
};
const DEFAULT_SUBJ_MAX = { wt: 10, mt: 20, eu: 60, mid: 30, et: 60 };

let GRADING_SCALE = [];
// SCHOOL_INFO consolidated at top for SaaS multi-tenancy


// generateInstitutionalHeader moved to INSTITUTIONAL BRANDING ORCHESTRATION section below

async function syncConfigs() {
    try {
        const scale = await DB.getGradingScale();
        if (scale) GRADING_SCALE = scale;
        const info = await DB.getSchoolInfo();
        if (info) {
            SCHOOL_INFO = { ...SCHOOL_INFO, ...info };
            if (document.getElementById('header-term-display')) {
                document.getElementById('header-term-display').textContent = `Term ${info.active_term || '2'} / ${info.academic_year || '2025/2026'}`;
            }
            if (document.getElementById('dash-school-name')) {
                document.getElementById('dash-school-name').textContent = (info.school || 'MMS MODULE').toUpperCase();
            }
        }
    } catch (e) {
        console.warn('[CONFIG] Failed to sync institutional settings.', e);
    }
}

let ASSESSMENTS = [];
let CURRENT_SESSION = { classId: null, className: null, subjectId: null, subjectName: null };
// MY_PROFILE consolidated at top


// ============================================================
// HELPERS
// ============================================================
function calcGrade(pct) {
    if (pct >= 80) return "A"; 
    if (pct >= 75) return "B"; 
    if (pct >= 70) return "C"; 
    if (pct >= 65) return "D"; 
    if (pct >= 60) return "E";
    if (pct >= 50) return "S";
    return "F";
}

function getComment(pct) {
    if (pct >= 80) return "Excellent! Keep it up and aim even higher.";
    if (pct >= 75) return "Very good! Review small mistakes to improve.";
    if (pct >= 70) return "Good! Strengthen weak areas for better results.";
    if (pct >= 65) return "Fair! Revise key topics to improve understanding.";
    if (pct >= 60) return "Needs improvement! Focus on basics and practice more.";
    if (pct >= 50) return "Poor! Seek help and work on weak areas.";
    return "Unsatisfactory! Intensive support and revision needed.";
}

function getSubjectMax(subjectName, assessId) {
    const s = SUBJECT_MAX[subjectName] || DEFAULT_SUBJ_MAX;
    const aId = assessId.toLowerCase();
    if (s[aId]) return s[aId];
    if (aId.includes('eu') || aId.includes('unit')) return s.eu || 40;
    if (aId.includes('et') || aId.includes('term') || aId.includes('exam')) return s.et || 60;
    return 40;
}

function getShortAbbr(abbr, id, name) {
    if (abbr && abbr.length <= 4) return abbr.toUpperCase();
    const str = (abbr || id || name || '').toUpperCase();
    if (str.includes('FINAL_EXAM')) return 'FE';
    if (str.includes('END_TERM')) return 'ET';
    if (str.includes('MID_TERM')) return 'MT';
    if (str.includes('EXERCISE')) return 'EXE';
    if (str.includes('UNIT')) return 'EU';
    if (str.includes('CAT')) return 'CAT';
    return str.substring(0, 3);
}


document.addEventListener('DOMContentLoaded', () => {
    // 1. Restore Sidebar State
    if (localStorage.getItem('sidebar_collapsed') === 'true') {
        const sb = document.getElementById('institutional-sidebar');
        if (sb) sb.classList.add('collapsed');
    }
    // 2. Initialize Professional Signs (Lucide)
    if (window.lucide) {
        lucide.createIcons();
    }
});

// ============================================================
// NAVIGATION (CAMIS STYLE)
// ============================================================
async function switchView(viewId, el) {
    // 1. Clear active states
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item, .sidebar-item').forEach(n => n.classList.remove('active'));

    // 2. Identify and activate target view
    const container = document.getElementById('view-' + viewId);
    if (!container) {
        console.warn(`[NAV] View 'view-${viewId}' not found.`);
        return;
    }
    container.classList.add('active');

    // 3. Highlight Sidebar
    const navItem = el || document.querySelector(`.nav-item[data-view="${viewId}"], .sidebar-item[data-view="${viewId}"]`) || document.getElementById('nav-' + viewId);
    if (navItem) navItem.classList.add('active');

    // 4. Persistence
    sessionStorage.setItem('teacher_last_view', viewId);

    // 5. Breadcrumbs & Meta
    const META = {
        'dashboard':        ['Faculty Dashboard',           'Academic → Overview'],
        'marks-entry':      ['Marks Recording — Assessment',   'Instruction → Data Entry'],
        'marks-pivot':      ['Institutional Marks Grid',       'Assessment → Multi-Entry'],
        'students':         ['Student Registry — Enrollment',  'Instruction → Management'],
        'class-monitor':    ['Class Performance Monitor',      'Audit → Jurisdiction Tracking'],
        'verification':     ['Curriculum Verification',        'Academic → Subjects'],
        'approval-status':  ['Submission Registry',            'Governance → Status'],
        'reports':          ['General Reports Gateway',        'Reports → Terminal'],
        'profile':          ['Faculty Profile',                'Account → Settings'],
    };

    if (META[viewId]) {
        const titleEl = document.getElementById('page-title');
        const breadViewEl = document.getElementById('breadcrumb-view');
        if (titleEl) titleEl.textContent = META[viewId][0];
        if (breadViewEl) {
            breadViewEl.textContent = META[viewId][0];
        }
    }

    // 6. Dispatch Render with Visual Feedback
    const contentArea = document.querySelector('.main-wrapper');
    if (contentArea) contentArea.style.opacity = '0.5';

    try {
        if (viewId === 'dashboard')            await renderDashboard();
        else if (viewId === 'marks-entry')     await renderDashboard();
        else if (viewId === 'class-monitor')   await renderClassMonitor();
        else if (viewId === 'students')        await renderStudentRegistry();
        else if (viewId === 'marks-pivot')     await loadMarksTable();
        else if (viewId === 'verification')    await renderVerificationView();
        else if (viewId === 'approval-status') await renderApprovalStatus();
        else if (viewId === 'reports')         await initReportSelectors();
        else if (viewId === 'profile')         await renderProfilePage();
        
        if (contentArea) contentArea.style.opacity = '1';
        if (window.lucide) lucide.createIcons();

        // 7. Auto-Close Sidebar on mobile
        if (window.innerWidth <= 1024) {
            const sb = document.querySelector('.sidebar');
            if (sb && sb.classList.contains('open')) {
                toggleSidebar();
            }
        }
    } catch (err) {
        if (contentArea) contentArea.style.opacity = '1';
        console.error(`[NAV] Dispatch failed for '${viewId}':`, err);
        toast(`⚠️ Terminal Sync Error: ${viewId} module unavailable.`, 'error');
    }
}

/**
 * CAMIS: Verified Courses View
 */
async function renderVerificationView() {
    const container = document.getElementById('view-verification');
    if (!container) return;
    
    const assignments = await DB.getTeacherAssignments(MY_PROFILE?.id);
    const myLeadClasses = assignments.filter(a => a.type === 'class').map(a => a.class_id);
    
    // Fetch curriculum for managed classes in parallel
    const classAssignmentsResults = await Promise.all(
        myLeadClasses.map(cid => DB.getClassAssignments(cid))
    );
    const classSubjects = classAssignmentsResults.flat().filter(a => a.type === 'subject');

    const mySubjects = assignments.filter(a => a.type === 'subject');
    
    // Merge for verification view
    const displaySubjects = [...mySubjects];
    classSubjects.forEach(s => {
        if (!displaySubjects.some(x => x.class_id === s.class_id && x.subject_id === s.subject_id)) {
            displaySubjects.push({ ...s, institutional: true });
        }
    });
    
    container.innerHTML = `
        <div class="table-card" style="padding:2.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
                <div>
                   <h2 style="font-size:1.25rem; font-weight:900; color:#1e293b;">📚 Verified Academic Courses</h2>
                   <p style="font-size:0.8rem; color:#64748b;">Review subjects and classes assigned to your pedagogical profile.</p>
                </div>
                <div class="badge badge-green">SYNCED WITH ADMIN</div>
            </div>
            <div class="resp-grid resp-grid-3">
                ${displaySubjects.length ? displaySubjects.map(s => `
                    <div style="background:#f8fafc; border:1px solid ${s.institutional ? '#e2e8f0' : '#3b82f6'}; border-radius:20px; padding:2rem; position:relative;">
                        ${s.institutional ? '<div style="position:absolute; top:1rem; right:1rem; font-size:0.55rem; background:#f1f5f9; color:#64748b; padding:2px 6px; border-radius:4px; font-weight:900;">CLASS LEAD VIEW</div>' : ''}
                        <div style="font-size:0.65rem; font-weight:900; color:#3b82f6; text-transform:uppercase; margin-bottom:0.5rem;">${s.institutional ? 'Class Curriculum' : 'Allocated Subject'}</div>
                        <div style="font-size:1.15rem; font-weight:900; color:#1e293b; margin-bottom:1.5rem;">${s.subjects?.name || 'Unknown Subject'}</div>
                        <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                           <div>
                              <div style="font-size:0.6rem; font-weight:900; color:#94a3b8; text-transform:uppercase;">Class Level</div>
                              <div style="font-weight:800; color:#475569;">${s.classes?.name || 'Unknown Class'}</div>
                           </div>
                           <div style="font-size:0.65rem; font-weight:900; color:#10b981; background:#f0fdf4; border-radius:8px; padding:4px 12px; border:1px solid #bbf7d0;">VERIFIED</div>
                        </div>
                    </div>
                `).join('') : '<div style="grid-column:span 3; text-align:center; padding:4rem; color:#94a3b8;">No curriculum assignments detected.</div>'}
            </div>
        </div>`;
}

/**
 * CAMIS: Marks Approval Status View
 */
async function renderApprovalStatus() {
    const container = document.getElementById('view-approval-status');
    if (!container) return;
    const marksData = await DB.getMarks();
    const summaries = {};
    marksData.forEach(m => {
        const key = `${m.subject_id}_${m.class_id}`;
        if (!summaries[key]) summaries[key] = { count:0, submitted:0, approved:0, rejected:0 };
        summaries[key].count++;
        if (m.is_submitted) summaries[key].submitted++;
        if (m.is_approved) summaries[key].approved++;
        if (m.rejection_comment && !m.is_submitted) summaries[key].rejected++;
    });

    container.innerHTML = `
        <div class="table-card" style="padding:2.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2.5rem;">
                <h2 style="font-size:1.25rem; font-weight:900; color:#1e293b;">📋 Marks Approval Registry</h2>
                <div style="font-size:0.75rem; font-weight:800; color:#64748b; background:#f1f5f9; padding:6px 16px; border-radius:99px;">Term 2 • 2025–2026</div>
            </div>
            <table class="data-table">
                <thead><tr><th>Subject Identity</th><th style="text-align:center;">Students</th><th style="text-align:center;">Buffer Strength</th><th style="text-align:center;">Governance Status</th></tr></thead>
                <tbody>
                    ${Object.entries(summaries).map(([k, s]) => `
                        <tr>
                            <td style="font-weight:900; color:#1e293b;">SUBJECT ARCHIVE ID: ${k.split('_')[0].substring(0,6)}...</td>
                            <td style="text-align:center; font-weight:800;">${s.count} Students</td>
                            <td style="text-align:center;">
                                <div style="display:flex; align-items:center; justify-content:center; gap:0.75rem;">
                                   <div style="width:80px; height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden;">
                                      <div style="width:${(s.submitted/s.count)*100}%; height:100%; background:#3b82f6;"></div>
                                   </div>
                                   <span style="font-size:0.7rem; font-weight:900; color:#3b82f6;">${Math.round((s.submitted/s.count)*100)}%</span>
                                </div>
                            </td>
                            <td style="text-align:center;">
                                ${s.approved === s.count ? '<span class="badge badge-green">APPROVED</span>' : 
                                  s.submitted === s.count ? '<span class="badge badge-blue">SUBMITTED</span>' :
                                  s.rejected > 0 ? '<span class="badge badge-red">RE-RECORDS REQ.</span>' :
                                  '<span class="badge" style="background:#f1f5f9; color:#64748b;">DRAFTING</span>'}
                            </td>
                        </tr>`).join('') || '<tr><td colspan="4" style="text-align:center; padding:4rem; color:#94a3b8;">No records found.</td></tr>'}
                </tbody>
            </table>
        </div>`;
}

// ============================================================
// DASHBOARD
// ============================================================
async function renderClassMonitor() {
    const el = id => document.getElementById(id);
    if (!MY_PROFILE?.id) return;

    try {
        const [assignments, allTeacherAssignments, allStudents, allMarks, assessList, subjects] = await Promise.all([
            DB.getTeacherAssignments(MY_PROFILE.id),
            DB.getTeacherAssignments(),
            DB.getStudents(),
            DB.getMarks(),
            DB.getAssessments(),
            DB.getSubjects()
        ]);

        const myManagedClasses = assignments.filter(a => a.type === 'class').map(a => ({
            id: a.class_id,
            name: a.classes?.name || 'Unknown Class'
        }));

        const activeAssessments = assessList.length ? assessList : [
            {id: 'cat', name: 'CAT', max_score: 50},
            {id: 'et', name: 'End Of Term', max_score: 100}
        ];

        let monitorHtml = '';
        let rowIdx = 1;

        if (myManagedClasses.length === 0) {
            el('class-monitor-tbody').innerHTML = '<tr><td colspan="6" style="padding: 5rem; text-align:center; color: #94a3b8;">This feature is exclusive to Class Teachers.</td></tr>';
            return;
        }

        // For each class managed by this teacher
        for (const cls of myManagedClasses) {
            // Get all subject assignments for THIS class from the institutional registry
            const classSubjects = allTeacherAssignments.filter(a => a.class_id === cls.id && a.type === 'subject');
            const classStudents = allStudents.filter(s => s.class_id === cls.id);

            classSubjects.forEach(subAss => {
                const subMarks = allMarks.filter(m => m.class_id === cls.id && m.subject_id === subAss.subject_id);
                
                // Track approval
                let approvedCount = 0;
                let assessBadges = '';

                activeAssessments.forEach(ass => {
                    const ctxMarks = subMarks.filter(m => m.assessment_id === ass.id);
                    const isSubmitted = ctxMarks.length > 0 && ctxMarks.every(m => m.is_submitted);
                    const isApproved = ctxMarks.length > 0 && ctxMarks.every(m => m.is_approved);
                    const isStarted = ctxMarks.length > 0;

                    if (isApproved) approvedCount++;

                    let badgeStyle = "background: #f1f5f9; color: #94a3b8; border: 1px solid #e2e8f0;";
                    let badgeLabel = ass.name || ass.id.toUpperCase();

                    if (isSubmitted) {
                        badgeStyle = "background: #dcfce7; color: #166534; border: 1px solid #bbf7d0;";
                    } else if (isStarted) {
                        badgeStyle = "background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa;";
                    }

                    assessBadges += `<span class="badge" style="${badgeStyle}; margin-right: 0.4rem; padding: 4px 8px; font-size: 0.65rem;">${badgeLabel}</span>`;
                });

                monitorHtml += `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 12px 1.5rem; color: #64748b; font-weight: 700;">${String(rowIdx++).padStart(2, '0')}</td>
                        <td style="padding: 12px 1rem;">
                            <div style="font-weight: 850; color: #0f172a;">${subAss.subjects?.name || 'Subject'}</div>
                        </td>
                        <td style="padding: 12px 1rem;">
                             <span style="font-size: 0.6rem; font-weight: 950; text-transform: uppercase; color: #64748b; background: #f1f5f9; padding: 3px 8px; border-radius: 6px;">${cls.name}</span>
                        </td>
                        <td style="padding: 12px 1rem;">
                            <div style="display:flex; align-items:center; gap: 0.5rem;">
                                <div style="width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></div>
                                <span style="font-size: 0.75rem; font-weight: 700; color: #10b981;">Assigned</span>
                            </div>
                        </td>
                        <td style="padding: 12px 1rem;">
                            <div style="display:flex; align-items:center;">
                                ${assessBadges}
                            </div>
                        </td>
                        <td style="padding: 12px 1.5rem; text-align: right; font-weight: 900; color: #1e293b; font-size: 1rem;">
                            ${approvedCount}/${activeAssessments.length}
                        </td>
                    </tr>
                `;
            });
        }

        if (el('class-monitor-tbody')) {
            el('class-monitor-tbody').innerHTML = monitorHtml || '<tr><td colspan="6" style="padding: 5rem; text-align:center; color: #94a3b8;">No subject assignments found for your managed class.</td></tr>';
        }

    } catch (err) {
        console.error('[MONITOR] Sync failed:', err);
        toast('Institutional monitor sync failed.', 'error');
    }
}

async function renderDashboard() {
    const el = id => document.getElementById(id);
    if (!MY_PROFILE?.id) return;

    // --- 0. IMMEDIATE IDENTITY POPULATION (Prevent "Loading" flash) ---
    if (el('dash-teacher-name')) el('dash-teacher-name').textContent = `Welcome, ${MY_PROFILE.full_name || 'Faculty Member'}`;
    if (el('dash-profile-name')) el('dash-profile-name').textContent = MY_PROFILE.full_name || 'Teacher';
    if (el('dash-profile-email')) el('dash-profile-email').textContent = MY_PROFILE.email || '';
    
    const fullId = MY_PROFILE.custom_id || (SCHOOL_INFO.code + (MY_PROFILE.sdms_code || ''));
    if (el('dash-profile-code')) el('dash-profile-code').textContent = `ID: ${fullId}`;

    try {
        const assignments = await DB.getTeacherAssignments(MY_PROFILE.id);
        const myClassIds = [...new Set(assignments.map(a => a.class_id).filter(Boolean))];
        
        // Fetch lookups and institutional class data in parallel
        const [classAssignmentsResults, allStudents, allMarks, assessList] = await Promise.all([
            Promise.all(myClassIds.map(cid => DB.getClassAssignments(cid))),
            DB.getStudents(),
            DB.getMarks({ classIds: myClassIds }), 
            DB.getAssessments()
        ]);
        
        const allClassAssignments = classAssignmentsResults.flat();
        
        const activeAssessments = assessList.length ? assessList : [
            {id: 'cat', name: 'CAT', max_score: 50},
            {id: 'et', name: 'End Of Term', max_score: 100}
        ];
        
        // Process unique jurisdictions
        const uniqueAssignments = [];
        const seenAssignments = new Set();

        // 1. Add Teacher's own subjects
        assignments.forEach(a => {
            if (a.type === 'subject' && a.subject_id) {
                const key = `sub_${a.class_id}_${a.subject_id}`;
                if (!seenAssignments.has(key)) {
                    seenAssignments.add(key);
                    uniqueAssignments.push({ ...a, role: 'INSTRUCTION' });
                }
            }
        });

        // 2. Add subjects from Managed Classes (Institutional View)
        assignments.forEach(a => {
            if (a.type === 'class' && a.class_id) {
                // Find all subjects in the system for this class from our pre-fetched list
                const classSubs = allClassAssignments.filter(x => x.class_id === a.class_id && x.type === 'subject');
                classSubs.forEach(subAss => {
                    const subKey = `sub_${subAss.class_id}_${subAss.subject_id}`;
                    if (!seenAssignments.has(subKey)) {
                        seenAssignments.add(subKey);
                        uniqueAssignments.push({ ...subAss, role: 'CLASS LEAD (AUDIT)', type: 'class_subject' });
                    } else {
                        // If already teaching it, upgrade the label to show dual responsibility
                        const existing = uniqueAssignments.find(x => `sub_${x.class_id}_${x.subject_id}` === subKey);
                        if (existing) existing.role = 'INSTRUCTION + LEAD';
                    }
                });
            }
        });

        // Metrics Tracking
        let totalScoreSum = 0;
        let totalMaxSum = 0;
        let jurisdictionCount = 0;
        let totalContexts = 0, submittedCount = 0, pendingCount = 0;

        let dashboardTbody = '';
        let recordingTbody = '';
        let rowIdx = 1;

        const getRoleColor = (role) => {
            if (role?.includes('LEAD')) return '#8b5cf6'; // Purple for lead
            if (role?.includes('INSTRUCTION')) return '#3b82f6'; // Blue for instruction
            return '#64748b';
        };

        const getActionBtn = (s) => `
            <button class="btn" style="padding: 4px 10px; font-size: 0.65rem; background: var(--primary); color: white; border: none;" 
                    onclick="goToEntrySubjectClass('${s.subject_id}','${s.subjects?.name || 'Subject'}','${s.class_id}','${s.classes?.name || 'Class'}')">
                ENTRY
            </button>`;

        uniqueAssignments.forEach(s => {
            const classMarks = allMarks.filter(m => m.class_id === s.class_id && m.subject_id === s.subject_id);
            const classAverage = classMarks.length > 0 
                ? (classMarks.reduce((sum, m) => sum + (Number(m.score) || 0), 0) / 
                   classMarks.reduce((sum, m) => sum + (Number(m.max_score) || 1), 0) * 100).toFixed(1)
                : '0.0';

            // Calculate context status
            activeAssessments.forEach(ass => {
                totalContexts++;
                const contextMarks = classMarks.filter(m => m.assessment_id === ass.id);
                const isSubmitted = contextMarks.length > 0 && contextMarks.every(m => m.is_submitted);
                const isStarted = contextMarks.length > 0;
                if (isSubmitted) submittedCount++;
                else if (isStarted) pendingCount++;
            });

            if (classMarks.length > 0) {
                totalScoreSum += classMarks.reduce((sum, m) => sum + (Number(m.score) || 0), 0);
                totalMaxSum += classMarks.reduce((sum, m) => sum + (Number(m.max_score) || 1), 0);
            }

            // Table Construction for Overview
            dashboardTbody += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px 1.5rem; color: #64748b; font-weight: 600;">${rowIdx}</td>
                    <td style="padding: 12px 1rem;">
                        <div style="font-weight: 800; color: #1e293b;">${s.subjects?.name || 'Subject'}</div>
                        <div style="font-size: 0.65rem; color: ${getRoleColor(s.role)}; font-weight: 900;">${(s.role || 'TEACHER').toUpperCase()}</div>
                    </td>
                    <td style="padding: 12px 1rem;">
                        <div style="font-weight: 700; color: #475569; font-size: 0.85rem;">${s.classes?.name || 'Unknown'}</div>
                    </td>
                    <td style="padding: 12px 1.5rem; text-align: right; display: flex; gap: 0.5rem; justify-content: flex-end;">
                        ${getActionBtn(s)}
                    </td>
                </tr>
            `;

            recordingTbody += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px 1.5rem; color: #64748b; font-weight: 600;">${rowIdx++}</td>
                    <td style="padding: 12px 1rem;">
                        <div style="font-weight: 700; color: #1e293b;">${s.subjects?.name || 'Subject'}</div>
                        <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 800;">PERFORMANCE: ${classAverage}%</div>
                    </td>
                    <td style="padding: 12px 1rem; font-weight: 600; color: #475569;">${s.classes?.name || 'Class'}</td>
                    <td style="padding: 12px 1.5rem; text-align: right; display: flex; gap: 0.5rem; justify-content: flex-end;">
                        ${getActionBtn(s)}
                    </td>
                </tr>
            `;
            jurisdictionCount++;
        });

        // DOM Updates
        const syncTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (el('dash-last-synced')) el('dash-last-synced').textContent = `Last Synced: ${syncTime}`;
        
        // Sync both the Main Dashboard and the Marks Entry table
        if (el('dash-courses-tbody')) el('dash-courses-tbody').innerHTML = dashboardTbody || '<tr><td colspan="4" style="text-align:center;padding:3rem;">No institutional assignments detected.</td></tr>';
        if (el('marks-entry-courses-tbody')) el('marks-entry-courses-tbody').innerHTML = recordingTbody || '<tr><td colspan="4" style="text-align:center;padding:3rem;">No subjects available for recording.</td></tr>';
        
        // Robust Metrics Calculation
        const allAssociatedClassIds = [...new Set(uniqueAssignments.map(s => s.class_id))];
        const studentPool = allStudents.filter(s => allAssociatedClassIds.includes(s.class_id));
        const marksPool = allMarks.filter(m => allAssociatedClassIds.includes(m.class_id));

        if (el('dash-avg-score')) el('dash-avg-score').textContent = (totalMaxSum > 0 ? (totalScoreSum / totalMaxSum * 100).toFixed(1) : '0.0') + '%';
        if (el('dash-student-count')) el('dash-student-count').textContent = studentPool.length;
        if (el('dash-subject-count')) el('dash-subject-count').textContent = jurisdictionCount;
        if (el('dash-marks-count')) el('dash-marks-count').textContent = marksPool.length;
        
        const remainingCount = totalContexts - submittedCount - pendingCount;
        const progressPct = totalContexts === 0 ? 0 : Math.round((submittedCount / totalContexts) * 100);

        if (el('dash-completion-pct')) el('dash-completion-pct').textContent = progressPct + '%';
        if (el('dash-completion-label')) el('dash-completion-label').textContent = `${progressPct}% Submitted`;
        if (el('dash-completion-bar')) el('dash-completion-bar').style.width = progressPct + '%';

        renderTeacherDashboardCharts();
        
        if (el('dash-stat-submitted')) el('dash-stat-submitted').textContent = `${submittedCount}/${totalContexts}`;
        if (el('dash-stat-pending')) el('dash-stat-pending').textContent = pendingCount === 0 ? '--' : pendingCount;
        if (el('dash-stat-remaining')) el('dash-stat-remaining').textContent = remainingCount === 0 ? '--' : remainingCount;
        if (el('dash-stat-classes')) el('dash-stat-classes').textContent = myClassIds.length;
        if (el('dash-stat-courses')) el('dash-stat-courses').textContent = jurisdictionCount;

        // Profile & Identity
        if (el('dash-teacher-name')) el('dash-teacher-name').textContent = `Welcome, ${MY_PROFILE.full_name || 'Teacher'}`;
        if (el('dash-profile-name')) el('dash-profile-name').textContent = MY_PROFILE.full_name || 'Teacher';
        if (el('dash-profile-email')) el('dash-profile-email').textContent = MY_PROFILE.email || '';
        
        const fullId = MY_PROFILE.custom_id || (SCHOOL_INFO.code + (MY_PROFILE.sdms_code || ''));
        if (el('dash-profile-code')) el('dash-profile-code').textContent = `ID: ${fullId}`;

        // --- DYNAMIC NOTIFICATION ENGINE ---
        const feedContainer = el('teacher-notification-feed');
        if (feedContainer) {
            let notifications = [];
            const rejectedMarks = allMarks.filter(m => myClassIds.includes(m.class_id) && m.rejection_comment && !m.is_submitted);
            if (rejectedMarks.length > 0) {
                notifications.push(`
                    <div style="background:#fee2e2; border-left:4px solid #ef4444; padding:0.75rem; border-radius:6px;">
                        <div style="font-weight:800; font-size:0.75rem; color:#991b1b;"><i data-lucide="alert-triangle" style="width:12px; height:12px; margin-right:4px;"></i> Action Required</div>
                        <div style="font-size:0.7rem; color:#7f1d1d; margin-top:0.25rem;">${rejectedMarks.length} record(s) were rejected. Please review.</div>
                    </div>
                `);
            }
            if (remainingCount > 0) {
                notifications.push(`
                    <div style="background:#eff6ff; border-left:4px solid #3b82f6; padding:0.75rem; border-radius:6px;">
                        <div style="font-weight:800; font-size:0.75rem; color:#1e40af;"><i data-lucide="clock" style="width:12px; height:12px; margin-right:4px;"></i> Pending Tasks</div>
                        <div style="font-size:0.7rem; color:#1e3a8a; margin-top:0.25rem;">You have ${remainingCount} assessment(s) left to record.</div>
                    </div>
                `);
            }
            if (notifications.length === 0) {
                notifications.push(`<div style="text-align:center; padding: 2rem 1rem; color: #94a3b8; font-size: 0.8rem; font-style: italic;">No pending alerts.</div>`);
            }
            feedContainer.innerHTML = notifications.join('');
            if (el('notification-count')) el('notification-count').textContent = notifications.length;
        }

        // Role-Based visibility restoration
        const isClassLead = assignments.some(a => a.type === 'class');
        const classTools = ['side-students', 'side-reports', 'side-proclamation'];
        classTools.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.style.display = isClassLead ? 'flex' : 'none';
        });
        
        // Dashboard and Verification are core
        if (el('side-dashboard')) el('side-dashboard').style.display = 'flex';
        if (el('side-verification')) el('side-verification').style.display = 'flex';

        if (isClassLead) {
            const myClass = assignments.find(a => a.type === 'class')?.classes;
            if (myClass && el('s-class-display')) el('s-class-display').value = myClass.name;
            if (myClass && el('s-class-id')) el('s-class-id').value = myClass.id;
        }

        // End of structural restoration


    } catch (e) {
        console.error('[DASHBOARD] Render failed:', e);
        toast('Failed to load dashboard data.', 'error');
    }
}

function goToEntrySubjectClass(subjectId, subjectName, classId, className, assessId = null) { 
    CURRENT_SESSION = { subjectId, subjectName, classId, className, assessId }; 
    // Go to the pivot grid explicitly
    switchView('marks-pivot'); 
    loadMarksTable();
}

function goToEntry(classId, className) { CURRENT_SESSION.classId = classId; CURRENT_SESSION.className = className; switchView('marks-entry', document.getElementById('side-marks-entry')); }

// ============================================================
// MARKS ENTRY PIVOT (Redesign)
// ============================================================
// Switch view logic automatically handles UI visibility, but let's ensure the data updates
function onEntryFilterChange() { loadMarksTable(); }

async function loadMarksTable() {
    const cid = CURRENT_SESSION.classId;
    const sid = CURRENT_SESSION.subjectId;
    const sName = CURRENT_SESSION.subjectName;
    const term = SCHOOL_INFO.active_term || 2;
    
    const tbody = el('marks-entry-tbody');
    const thead = el('marks-entry-thead-row');

    if (!cid || !sid) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:5rem;">No context provided. Navigate from Dashboard.</td></tr>'; 
        return; 
    }

    // Inform user of context
    const warnBadge = el('entry-warning-badge');
    if (warnBadge) warnBadge.innerHTML = `Subject: <b>${sName}</b> | Term: <b>${term}</b>`;

    const fromDb = await DB.getAssessments();
    const activeAssessments = fromDb.length ? fromDb : [
        { id: 'wt', name: 'Weekly Test', max_score: 10, abbr: 'WT' },
        { id: 'mt', name: 'Monthly Test', max_score: 20, abbr: 'MT' },
        { id: 'eu', name: 'End-Unit Test', max_score: 40, abbr: 'EU' },
        { id: 'mid', name: 'Mid-Term Test', max_score: 50, abbr: 'MID' },
        { id: 'et', name: 'End-Term Exam', max_score: 100, abbr: 'ET' }
    ];

    const rawStudents = await DB.getStudents(cid);
    const students = rawStudents.sort((a, b) => {
        const nameA = `${a.last_name || ''} ${a.first_name || ''}`.trim().toUpperCase();
        const nameB = `${b.last_name || ''} ${b.first_name || ''}`.trim().toUpperCase();
        return nameA.localeCompare(nameB);
    });
    const allMarksForSubject = await DB.getMarks({ subjectId: sid, term });
    const classMarks = allMarksForSubject.filter(m => m.class_id === cid);

    // Build Table Headers
    let headerHtml = `
        <th style="padding: 12px 1.5rem; font-weight: 900; color: #1e293b; width: 40px; font-size: 0.95rem;">No</th>
        <th style="padding: 12px 1rem; font-weight: 900; color: #1e293b; font-size: 0.95rem;">Student number</th>
        <th style="padding: 12px 1rem; font-weight: 900; color: #1e293b; font-size: 0.95rem;">Student names</th>
    `;
    activeAssessments.forEach(ass => {
        headerHtml += `
            <th style="padding: 12px 1rem; color: #1e293b; min-width: 150px;">
                <div style="font-weight: 900; font-size: 0.95rem;">${ass.name}</div>
                <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.25rem;">
                   <span style="font-size: 0.7rem; font-weight: 700; color: #64748b; padding: 2px 6px; border: 1px solid #e2e8f0; border-radius: 4px; display:inline-flex; align-items:center;">
                      Max: <input type="number" id="max-hdr-${ass.id}" value="${ass.max_score || 90}" style="width: 40px; border:none; background:transparent; font-size:0.7rem; font-weight:700; color:#64748b; margin-left:4px; outline:none;" onkeyup="updateColumnMax('${ass.id}', this)" onchange="updateColumnMax('${ass.id}', this)">
                   </span>
                </div>
            </th>
        `;
    });
    thead.innerHTML = headerHtml;

    // Build Rows
    tbody.innerHTML = students.map((s, i) => {
        let rowHtml = `
            <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <td style="padding: 12px 1.5rem; color: #1e293b; font-size: 0.9rem;">${i+1}</td>
                <td style="padding: 12px 1rem;">
                   <div style="display:flex; align-items:center; gap: 0.5rem;">
                      <div style="width: 32px; height: 32px; background: #eff6ff; color: #3b82f6; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                      </div>
                      <span style="color: #475569; font-size: 0.85rem; font-family: monospace;">${s.sid || 'N/A'}</span>
                   </div>
                </td>
                <td style="padding: 12px 1rem; color: #1e293b; font-weight: 600; font-size: 0.85rem; text-transform: uppercase;">
                   ${(s.last_name||'') + ' ' + (s.first_name||'')}
                </td>
        `;

        // Render input for each active assessment
        activeAssessments.forEach(ass => {
            const m = classMarks.find(mk => mk.student_id === s.id && mk.assessment_id === ass.id);
            const score = m ? (m.score === -1 ? 'Missed' : m.score) : '';
            const isLocked = m && m.is_locked;
            // Provide a green OK icon for the UI if score exists
            const statusIcon = (score !== '') ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>` : '';
            
            rowHtml += `
                <td style="padding: 12px 1rem; text-align: left;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                       <input type="text" class="mark-input" style="width: 50px; text-align: right; border: none; background: transparent; font-weight: 700; font-size: 0.95rem; color: #1e293b; outline: none; border-bottom: 1px dotted #cbd5e1;" 
                              value="${score}" 
                              data-sid="${s.id}" data-aid="${ass.id}" data-row-idx="${i}"
                              ${isLocked ? 'disabled' : ''}
                              onkeydown="handleEntryKeyDown(event, '${ass.id}', ${i})"
                              oninput="validateInput(this, document.getElementById('max-hdr-${ass.id}').value)"
                              onchange="autoSaveMark(this)"
                              onblur="markUnsaved(this)">
                       <span style="color: #cbd5e1; font-weight: 800; font-size: 1.1rem; line-height: 1;">/</span>
                       <span data-max-target="${ass.id}" style="color: #cbd5e1; font-weight: 800; font-size: 0.95rem;">${ass.max_score || 90}</span>
                       <div class="save-status-icon" style="margin-left: 0.5rem;">${statusIcon}</div>
                    </div>
                </td>
            `;
        });

        rowHtml += `</tr>`;
        return rowHtml;
    }).join('');
}

async function createInitialDraft() {
    const tid = document.getElementById('entry-term-select')?.value || '1';
    const cid = el('entry-class-select').value, sid = el('entry-subject-select').value, aid = el('entry-assessment-select').value;
    const term = parseInt(tid);
    const students = await DB.getStudents(cid);
    const maxVal = getSubjectMax(el('entry-subject-select').selectedOptions[0].dataset.name, aid);
    
    toast('Initializing Institutional Draft...', 'info');
    const batch = students.map(s => ({ 
        student_id: s.id, 
        class_id: cid, 
        subject_id: sid, 
        assessment_id: aid, 
        term, 
        academic_year: SCHOOL_INFO.academic_year || '2025/2026',
        score: 0, 
        max_score: maxVal, 
        is_submitted: false 
    }));
    await DB.saveMarksBatch(batch);
    await loadMarksTable();
}

function handleEntryKeyDown(e, aid, idx) {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
        const next = document.querySelector(`input[data-aid="${aid}"][data-row-idx="${idx + 1}"]`);
        if (next) next.focus();
        else if (e.key === 'Enter') submitMarksToAdmin();
    } else if (e.key === 'ArrowUp') {
        const prev = document.querySelector(`input[data-aid="${aid}"][data-row-idx="${idx - 1}"]`);
        if (prev) prev.focus();
    }
}

function updateColumnMax(aid, inp) {
    const newVal = inp.value;
    document.querySelectorAll(`span[data-max-target="${aid}"]`).forEach(s => s.textContent = newVal);
    document.querySelectorAll(`input[data-aid="${aid}"]`).forEach(input => {
        validateInput(input, newVal);
    });
}

function validateInput(inp, maxVal) {
    const max = parseFloat(maxVal) || 90;
    const val = inp.value.trim().toLowerCase();
    
    if (val === 'm' || val === 'missed' || val === 'a' || val === 'absent') { 
        inp.value = 'Missed';
        inp.style.color = '#ef4444'; 
        inp.style.borderBottom = '2px solid #ef4444';
        return; 
    }
    
    const num = parseFloat(val);
    if (isNaN(num) || num < 0 || num > max) {
        inp.style.borderBottom = '2px solid #ef4444';
        inp.style.color = '#ef4444';
    } else {
        inp.style.borderBottom = '1px dotted #cbd5e1';
        inp.style.color = '#1e293b';
        inp.classList.add('unsaved');
    }
}

function markUnsaved(inp) {
    // If not saved yet, keep the visual cue
    if (inp.classList.contains('unsaved')) {
        inp.style.borderBottom = '1px solid var(--warning)';
    }
}

/**
 * Institutional Auto-Save Engine
 * Saves individual marks immediately upon entry
 */
async function autoSaveMark(inp) {
    const valRaw = inp.value.trim().toLowerCase();
    if (valRaw === '') return;

    const sid = inp.dataset.sid;
    const aid = inp.dataset.aid;
    const cid = CURRENT_SESSION.classId;
    const subjectId = CURRENT_SESSION.subjectId;
    const term = SCHOOL_INFO.active_term || 2;
    const maxVal = parseFloat(document.getElementById(`max-hdr-${aid}`)?.value) || 90;

    let score = parseFloat(valRaw);
    if (valRaw === 'missed' || valRaw === 'm' || valRaw === 'a' || valRaw === 'absent') score = -1;

    if (isNaN(score) && score !== -1) return;
    if (score > maxVal) return;

    // UI Feedback: Show saving state
    const statusIcon = inp.parentElement.querySelector('.save-status-icon');
    if (statusIcon) statusIcon.innerHTML = `<svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`;

    try {
        const res = await DB.saveMark({
            student_id: sid,
            class_id: cid,
            subject_id: subjectId,
            assessment_id: aid,
            term: term,
            score: score,
            max_score: maxVal,
            academic_year: SCHOOL_INFO.academic_year || '2025/2026'
        });

        if (res.error) throw res.error;

        // UI Feedback: Success
        inp.classList.remove('unsaved');
        inp.style.borderBottom = '1px dotted #cbd5e1';
        if (statusIcon) statusIcon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    } catch (err) {
        console.error('[AUTOSAVE] Failed:', err);
        if (statusIcon) statusIcon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
        toast('Auto-save failed. Check connection.', 'error');
    }
}

async function submitMarksToAdmin() {
    const cid = CURRENT_SESSION.classId;
    const sid = CURRENT_SESSION.subjectId;
    const term = SCHOOL_INFO.active_term || 2;
    
    const inputs = document.querySelectorAll('#marks-entry-tbody input:not([disabled])');
    const batch = [];
    let hasError = false;

    // First validate and collect all marks
    Array.from(inputs).forEach(inp => {
        const valRaw = inp.value.trim().toLowerCase();
        if (valRaw === '') return; // Skip empty inputs unless evaluating submission

        const aid = inp.dataset.aid;
        // In the updated pivot UI, the max val is placed next to the input
        const maxSpan = inp.parentElement.querySelectorAll('span')[1]; 
        const maxMarks = maxSpan ? parseFloat(maxSpan.textContent) : 90;

        let score = 0;
        if (valRaw === 'missed' || valRaw === 'm') {
            score = -1;
        } else {
            score = parseFloat(valRaw);
            if (isNaN(score) || score < 0 || score > maxMarks) {
                hasError = true;
                inp.style.borderBottom = '2px solid #ef4444';
            } else {
                inp.style.borderBottom = '1px dotted #cbd5e1';
            }
        }
        
        batch.push({ 
            student_id: inp.dataset.sid, 
            subject_id: sid, 
            assessment_id: aid, 
            term, 
            academic_year: SCHOOL_INFO.academic_year || '2025/2026',
            score, 
            class_id: cid, 
            teacher_id: MY_PROFILE?.id,
            max_score: maxMarks,
            is_submitted: true  
        });
    });

    if (hasError) return toast('Found invalid scores. Check red fields.', 'error');
    if (!batch.length) return toast('No marks to save.', 'info');

    toast('Committing & Submitting Records to Database...', 'info');
    const { error } = await DB.saveMarksBatch(batch); 
    if (!error) {
        toast('✅ Records Synced & Submitted Successfully.', 'success');
        await loadMarksTable(); 
    } else {
        toast('Submission Failed: ' + error.message, 'error');
    }
}

// ============================================================
// REPORTS (MINEDUC FORMAT)
// ============================================================
/**
 * Institutional Workspace: Reports & Proclamations
 */
async function openTeacherProclamationModal() {
    await switchView('reports');
    // Ensure the selectors are initialized before helping the user
    setTimeout(() => {
        const classSel = document.getElementById('report-class-select');
        if (classSel && classSel.options.length > 1) {
            if (classSel.options.length === 2) {
                classSel.selectedIndex = 1;
                classSel.dispatchEvent(new Event('change'));
            }
            toast('⚡ Identify target class and subjects for Proclamation.', 'info');
        } else {
            toast('🔒 Access Denied: Requires Class Teacher Privileges.', 'warning');
        }
    }, 400);
}

async function initReportSelectors() {
    const assignments = await DB.getTeacherAssignments(MY_PROFILE?.id);
    const allClasses = await DB.getClasses();
    const classMap = {}; allClasses.forEach(c => classMap[c.id] = c.name);

    // Only allow reporting for classes where the user is assigned as the primary 'Class Teacher'
    const classAssignments = assignments.filter(a => a.type === 'class');
    
    const uniqueClasses = [...new Map(classAssignments.map(a => {
        const c = a.classes || { id: a.class_id, name: classMap[a.class_id] || `Class ID: ${a.class_id.substring(0,5)}` };
        return [c.id, c];
    })).values()].filter(c => c && c.id);

    const classSel = el('report-class-select');
    if (classSel) {
        classSel.innerHTML = '<option value="">— select class —</option>' + 
            uniqueClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        
        classSel.onchange = async () => {
            const studentSel = el('report-student-select');
            const students = classSel.value ? await DB.getStudents(classSel.value) : [];
            studentSel.innerHTML = '<option value="all">📋 All Students (Class Report)</option>' +
                students.map(s => `<option value="${s.id}">${s.last_name||''} ${s.first_name||''} (${s.student_id||'—'})</option>`).join('');
            await populateReportChecklists(classSel.value);
            generateReportCard();
        };
    }
}

async function populateReportChecklists(classId) {
    const [allSubjects, allAssignments] = await Promise.all([
        DB.getSubjects(),
        DB.getTeacherAssignments()
    ]);

    console.log(`[REPORTS] Populating checklists for class: ${classId}.`);

    // Build DB subjects for this class
    const dbSubsMap = new Map();
    allAssignments.filter(a => String(a.class_id) === String(classId) && a.type === 'subject').forEach(a => {
        if (a.subject_id && a.subjects) {
            const k = String(a.subject_id);
            if (!dbSubsMap.has(k)) dbSubsMap.set(k, { id: a.subject_id, name: a.subjects.name, abbr: a.subjects.abbr });
        }
    });
    allSubjects.filter(s => String(s.class_id) === String(classId)).forEach(s => {
        const k = String(s.id);
        if (!dbSubsMap.has(k)) dbSubsMap.set(k, s);
    });
    const dbSubs = Array.from(dbSubsMap.values());

    // STANDARD MINEDUC subjects — always rendered
    const STD_SUBJECTS = [
        { key: 'MATH', label: 'Mathematics' },
        { key: 'ENG',  label: 'English' },
        { key: 'KINY', label: 'Kinyarwanda' },
        { key: 'FRE',  label: 'French' },
        { key: 'SET',  label: 'SET' },
        { key: 'SRS',  label: 'SRS' },
        { key: 'CA',   label: 'Creative Arts' },
        { key: 'PE',   label: 'Sport/PES' },
    ];

    const renderedIds = new Set();
    const subItems = [];

    STD_SUBJECTS.forEach(std => {
        const match = dbSubs.find(s =>
            (s.abbr || '').toUpperCase().startsWith(std.key.substring(0,3)) ||
            (s.name || '').toUpperCase().startsWith(std.label.split(' ')[0].toUpperCase())
        );
        if (match) {
            renderedIds.add(String(match.id));
            subItems.push({ id: match.id, abbr: std.key, checked: true });
        } else {
            subItems.push({ id: 'std_' + std.key, abbr: std.key, checked: false });
        }
    });
    // Extra DB subjects not matched
    dbSubs.forEach(s => {
        if (!renderedIds.has(String(s.id))) {
            subItems.push({ id: s.id, abbr: (s.abbr || s.name.substring(0,5)), checked: true });
        }
    });

    function pillStyle(on, color) {
        return `display:inline-flex;align-items:center;gap:5px;padding:7px 15px;
            border-radius:999px;margin:4px;cursor:pointer;font-size:0.78rem;font-weight:800;
            user-select:none;transition:all 0.15s;border:2px solid ${on ? color : '#cbd5e1'};
            background:${on ? color : '#fff'};color:${on ? '#fff' : '#64748b'};`;
    }

    el('report-subject-checklist').innerHTML = subItems.map(s => {
        const on = s.checked;
        const color = '#0f172a';
        return `<label style="${pillStyle(on, color)}" class="rc-spill"
            onclick="var cb=this.querySelector('input'),v=cb.checked;
                this.style.background=v?'${color}':'#fff';
                this.style.borderColor=v?'${color}':'#cbd5e1';
                this.style.color=v?'#fff':'#64748b'; generateReportCard();">
            <input type="checkbox" ${on ? 'checked' : ''} value="${s.id}" class="rc-sub-db" style="display:none" onchange="generateReportCard()">
            ${s.abbr}
        </label>`;
    }).join('');

    // STANDARD ASSESSMENT TYPES — always rendered
    const dbAssess = await DB.getAssessments();
    const STD_ASSESS = [
        { key: 'EU',  label: 'End of Unit' },
        { key: 'ET',  label: 'End of Term' },
        { key: 'MT',  label: 'Mid-Term Test' },
        { key: 'MID', label: 'MID Test' },
        { key: 'WK',  label: 'Weekly Test' },
        { key: 'BT',  label: 'Beginning Test' },
    ];

    const renderedAssessIds = new Set();
    const assessItems = [];

    STD_ASSESS.forEach(std => {
        const match = dbAssess.find(a =>
            (a.abbr || '').toUpperCase() === std.key ||
            (a.name || '').toUpperCase().startsWith(std.label.split(' ')[0].toUpperCase())
        );
        if (match) {
            renderedAssessIds.add(String(match.id));
            assessItems.push({ id: match.id, abbr: std.key, label: std.label, checked: true });
        } else {
            assessItems.push({ id: 'std_' + std.key, abbr: std.key, label: std.label, checked: false });
        }
    });
    dbAssess.forEach(a => {
        if (!renderedAssessIds.has(String(a.id))) {
            assessItems.push({ id: a.id, abbr: a.abbr || a.name.substring(0,3), label: a.name, checked: true });
        }
    });

    el('report-assess-checklist').innerHTML = assessItems.map(a => {
        const on = a.checked;
        const color = '#1d4ed8';
        return `<label style="${pillStyle(on, color)}" class="rc-apill"
            onclick="var cb=this.querySelector('input'),v=cb.checked;
                this.style.background=v?'${color}':'#fff';
                this.style.borderColor=v?'${color}':'#cbd5e1';
                this.style.color=v?'#fff':'#64748b'; generateReportCard();"
            title="${a.label}">
            <input type="checkbox" ${on ? 'checked' : ''} value="${a.id}" class="report-assess-cb" style="display:none" onchange="generateReportCard()">
            ${a.abbr}
        </label>`;
    }).join('');
}

async function generateProclamationList() {
    const cid = el('report-class-select').value;
    const term = el('report-term-select').value;
    const dateInput = el('report-date-picker').value;
    const finalDate = dateInput ? new Date(dateInput).toLocaleDateString() : new Date().toLocaleDateString();
    
    if (!cid) return toast('Please select an institutional class group.', 'warning');

    // Capture ALL selected items (including std_ placeholders)
    const rawSelSubs = Array.from(el('report-subject-checklist').querySelectorAll('input:checked')).map(i => ({
        id: i.value,
        label: i.parentElement.innerText.trim()
    }));
    const rawSelAsses = Array.from(el('report-assess-checklist').querySelectorAll('input:checked')).map(i => ({
        id: i.value,
        label: i.parentElement.innerText.trim()
    }));

    const selSubIds = rawSelSubs.map(s => s.id).filter(id => !id.startsWith('std_'));
    const selAssessIds = rawSelAsses.map(a => a.id).filter(id => !id.startsWith('std_'));
    
    if (rawSelSubs.length === 0) return toast('Select active curriculum subjects for proclamation.', 'warning');
    if (rawSelAsses.length === 0) return toast('Select active assessment markers for proclamation.', 'warning');

    toast('Consolidating Multi-Faculty Marks...', 'info');

    const [allMarks, students, allDBSubjects] = await Promise.all([
        DB.getMarks({ classId: cid, term, year: el('report-year')?.value }),
        DB.getStudents(cid),
        DB.getSubjects(cid)
    ]);

    // Merge DB subjects with Virtual (std_) subjects
    const subjects = rawSelSubs.map(sel => {
        const dbMatch = allDBSubjects.find(s => s.id === sel.id);
        if (dbMatch) return dbMatch;
        const cleanName = sel.label.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
        return { 
            id: sel.id, 
            name: cleanName.toUpperCase(), 
            abbr: cleanName.toUpperCase().substring(0,5) 
        };
    });
    
    // Header labels for assessments (strip icons)
    const assessmentLabels = rawSelAsses.map(a => a.label.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim());
    const assessmentContext = assessmentLabels.join(' + ');

    // Virtual mapping for assessments (pillars)
    const activePillars = rawSelAsses.map(sel => {
        const dbId = sel.id.startsWith('std_') ? sel.id.replace('std_', '').toLowerCase() : sel.id;
        return {
            id: dbId,
            abbr: sel.label.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim().toUpperCase()
        };
    });

    const subjectMeta = subjects.map(s => {
        let max = 0;
        const subMaxMap = SUBJECT_MAX[s.name] || DEFAULT_SUBJ_MAX;
        activePillars.forEach(p => {
            const allowedMax = subMaxMap[p.id.toLowerCase()] || 40;
            max += allowedMax;
        });
        return { ...s, totalMax: max };
    });

    const proclamationData = students.map(student => {
        let totalScore = 0;
        let totalMax = 0;
        const subScores = {};
        
        subjectMeta.forEach(s => {
            let sScore = 0;
            const subMaxMap = SUBJECT_MAX[s.name] || DEFAULT_SUBJ_MAX;
            activePillars.forEach(p => {
                const allowedMax = subMaxMap[p.id.toLowerCase()] || 40;
                const mark = allMarks.find(m => m.student_id === student.id && m.subject_id === s.id && String(m.assessment_id).toLowerCase() === String(p.id).toLowerCase());
                if (mark) {
                    const rawScore = mark.score === -1 ? 0 : Number(mark.score);
                    const capped = Math.min(rawScore, allowedMax);
                    sScore += capped;
                }
            });
            subScores[s.id] = sScore;
            totalScore += sScore;
            totalMax += s.totalMax;
        });

        const percentage = totalMax > 0 ? (totalScore / totalMax * 100) : 0;
        return {
            id: student.id,
            sid: student.sid,
            name: `${student.last_name || ''} ${student.first_name || ''}`.toUpperCase(),
            subScores,
            totalScore,
            totalMax,
            percentage: percentage,
            grade: calcGrade(percentage),
            comment: getComment(percentage)
        };
    });

    // Rank by percentage
    proclamationData.sort((a, b) => b.percentage - a.percentage);
    proclamationData.forEach((item, idx) => item.position = idx + 1);

    const subjectHeaders = subjectMeta.map(s => `
        <th style="border: 1px solid #000; background: #f1f5f9; color: #000; width: 32px; height: 110px; padding: 0; vertical-align: bottom; position: relative;">
            <div style="writing-mode: vertical-rl; transform: rotate(180deg); margin: 0 auto; padding-top: 5px; font-weight: 950; font-size: 0.6rem; text-transform: uppercase; white-space:nowrap;">
                ${(s.abbr || s.name).substring(0, 15).toUpperCase()} / ${s.totalMax}
            </div>
        </th>
    `).join('');

    const grandMax = subjectMeta.reduce((acc, s) => acc + s.totalMax, 0);
    let rowsHtml = proclamationData.map(item => `
        <tr style="border: 1px solid #000; font-size: 0.85rem; height: 32px; color: #000;">
            <td style="padding: 5px; border: 1px solid #000; text-align: center; font-weight: 800; background: #fff;">${item.position}</td>
            <td style="padding: 5px; border: 1px solid #000; font-size: 0.7rem; width: 85px; white-space: nowrap; overflow: hidden;">${item.sid || 'N/A'}</td>
            <td style="padding: 5px 10px; border: 1px solid #000; font-weight: 900; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">${item.name}</td>
            ${subjectMeta.map(s => {
                const score = item.subScores[s.id];
                const isFail = score < (s.totalMax / 2);
                const color = '#000'; // FORCED BLACK FOR PRINTING
                const style = isFail ? 'text-decoration: underline;' : '';
                return `<td style="padding: 5px; border: 1px solid #000; color: ${color}; ${style} font-weight: 900; text-align: center;">${score || 0}</td>`;
            }).join('')}
            <td style="padding: 5px; border: 1px solid #000; font-weight: 950; text-align: center; color:#000;">${item.totalScore.toFixed(0)}</td>
            <td style="padding: 5px; border: 1px solid #000; font-weight: 950; color: #000; text-align: center;">${item.percentage.toFixed(1)}</td>
            <td style="padding: 5px; border: 1px solid #000; font-weight: 950; text-align: center; color:#000;">${item.position}</td>
            <td style="padding: 5px 10px; border: 1px solid #000; font-weight: 950; text-align: left; font-size:0.55rem; color: #000; line-height: 1.2;">${item.comment}</td>
        </tr>
    `).join('');

    const classLabel = el('report-class-select').selectedOptions[0]?.text || 'CLASS';
    const assessedLine = `Assessed: ${selAssLabs.join(' + ')}`;

    const printArea = el('report-card-print-area');
    const proclamationHtml = `
        <div id="proclamation-document">

            <!-- HEADER: Logos + School Title -->
            <table style="width:100%; border-collapse:collapse; margin-bottom:10px;">
                <tr>
                    <td style="width:90px; vertical-align:middle; text-align:left;">
                        <img src="js/Report image/download__92_-removebg-preview.png" style="width:75px; height:auto;">
                        <div style="font-size:0.45rem; font-weight:700; color:#000; text-align:center; margin-top:2px;">Republic of Rwanda<br>Ministry of Education</div>
                    </td>
                    <td style="text-align:center; vertical-align:middle;">
                        <div style="font-size:0.65rem; font-weight:900; color:#000; letter-spacing:2px; text-transform:uppercase;">REPUBLIC OF RWANDA</div>
                        <div style="font-size:0.6rem; font-weight:700; margin-bottom:3px; color:#000;">MINISTRY OF EDUCATION</div>
                        <div style="font-size:1.3rem; font-weight:900; text-transform:uppercase; margin-bottom:5px; color:#000;">${(SCHOOL_INFO.school||'MMS PORTAL').toUpperCase()}</div>
                        <div style="display:inline-block; background:#000; color:#fff; font-size:0.7rem; font-weight:900; padding:5px 18px; letter-spacing:1px; text-transform:uppercase;">
                            CLASS: ${classLabel} &bull; TERM ${term} PROCLAMATION
                        </div>
                        <div style="font-size:0.55rem; margin-top:4px; color:#000;">Assessed: ${assessedLine}</div>
                    </td>
                    <td style="width:90px; vertical-align:middle; text-align:right;">
                        ${SCHOOL_INFO.logo ? `<img src="${SCHOOL_INFO.logo}" style="width:75px; height:75px; object-fit:contain; border-radius:4px;">` : `<div style="width:75px; height:75px; border:1.5px solid #94a3b8; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:0.45rem; font-weight:700; text-align:center;">SCHOOL<br>LOGO</div>`}
                    </td>
                </tr>
            </table>

            <!-- META ROW -->
            <div style="display:flex; justify-content:space-between; border-top:2px solid #000; border-bottom:2px solid #000; padding:5px 2px; margin-bottom:8px; font-size:0.58rem; font-weight:800; color:#000;">
                <div>
                    <div>Class Teacher: <strong>${(MY_PROFILE?.full_name||'...').toUpperCase()}</strong></div>
                    <div>Email: ${MY_PROFILE?.email || '...'} &nbsp;|&nbsp; Contact: ${MY_PROFILE?.phone || SCHOOL_INFO.phone || '...'}</div>
                </div>
                <div style="text-align:right;">
                    <div>PROVINCE: <strong>${(SCHOOL_INFO.province||'EAST').toUpperCase()}</strong></div>
                    <div>DISTRICT: <strong>${(SCHOOL_INFO.district||'...').toUpperCase()}</strong></div>
                    <div>SECTOR: <strong>${(SCHOOL_INFO.sector||'...').toUpperCase()}</strong></div>
                </div>
            </div>

            <!-- MARKS TABLE -->
            <table style="width:100%; border-collapse:collapse; border:2px solid #000; font-size:0.55rem; color:#000;">
                <thead style="background:#eee;">
                    <tr>
                        <th style="border:1px solid #000; width:25px; height:65px; padding:0; vertical-align:bottom;">
                            <div style="transform:rotate(-90deg); white-space:nowrap; margin-bottom:18px; font-weight:900; font-size:0.55rem;">NO</div>
                        </th>
                        <th style="border:1px solid #000; width:75px; vertical-align:middle; padding:4px; font-weight:900;">ID NUMBER</th>
                        <th style="border:1px solid #000; min-width:120px; text-align:left; padding:4px; font-weight:900;">NAMES</th>
                        ${subjectHeaders}
                        <th style="border:1px solid #000; width:38px; height:65px; padding:0; vertical-align:bottom; background:#fff;">
                            <div style="transform:rotate(-90deg); white-space:nowrap; margin-bottom:18px; font-weight:900; font-size:0.55rem; color:#000;">TOTAL</div>
                        </th>
                        <th style="border:1px solid #000; width:32px; height:65px; padding:0; vertical-align:bottom; background:#fff;">
                            <div style="transform:rotate(-90deg); white-space:nowrap; margin-bottom:18px; font-weight:900; font-size:0.55rem; color:#000;">PERCENT %</div>
                        </th>
                        <th style="border:1px solid #000; width:30px; height:65px; padding:0; vertical-align:bottom;">
                            <div style="transform:rotate(-90deg); white-space:nowrap; margin-bottom:18px; font-weight:900; font-size:0.55rem;">POSITION</div>
                        </th>
                        <th style="border:1px solid #000; min-width:90px; text-align:left; padding:4px; font-weight:900;">Tr. COMMENT</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>

            <!-- FOOTER -->
            <div style="text-align:right; font-size:0.6rem; font-weight:800; margin-top:12px;">
                Done at <strong>${(SCHOOL_INFO.district||'...').toUpperCase()}</strong> , on ${finalDate}
            </div>

            <!-- SIGNATURES -->
            <div style="display:flex; justify-content:space-around; margin-top:25px; font-size:0.6rem; gap:10px; color:#000;">
                <div style="text-align:center; flex:1; border-top:1.5px solid #000; padding-top:5px;">
                    PREPARED BY CLASS TEACHER<br>
                    <strong style="font-size:0.7rem;">${(MY_PROFILE?.full_name||'...').toUpperCase()}</strong>
                </div>
                <div style="text-align:center; flex:1; border-top:1.5px solid #000; padding-top:5px; position:relative;">
                    APPROVED BY DOS<br>
                    ${SCHOOL_INFO.dos_sig ? `<img src="${SCHOOL_INFO.dos_sig}" style="height:35px; position:absolute; top:-10px; left:50%; transform:translateX(-50%); mix-blend-mode:multiply;">` : ''}
                    <strong style="font-size:0.7rem; position:relative; z-index:2;">${(SCHOOL_INFO.dos||'...').toUpperCase()}</strong>
                </div>
                <div style="text-align:center; flex:1; border-top:1.5px solid #000; padding-top:5px; position:relative;">
                    APPROVED BY HEADTEACHER<br>
                    ${SCHOOL_INFO.headteacher_sig ? `<img src="${SCHOOL_INFO.headteacher_sig}" style="height:40px; position:absolute; top:-15px; left:50%; transform:translateX(-50%); mix-blend-mode:multiply;">` : ''}
                    ${SCHOOL_INFO.stamp ? `<img src="${SCHOOL_INFO.stamp}" style="width:60px; height:60px; position:absolute; top:-40px; right:-10px; opacity:0.8; mix-blend-mode:multiply;">` : ''}
                    <strong style="font-size:0.7rem; position:relative; z-index:2;">${(SCHOOL_INFO.headteacher||'...').toUpperCase()}</strong>
                </div>
            </div>
        </div>
    `;

    printArea.innerHTML = proclamationHtml;
    toast('Proclamation generated! Click "Print / Export PDF" to save.', 'success');
}

async function printReportCards() {
    const area = el('report-card-print-area');
    if (!area || !area.innerHTML.trim()) return toast('Please generate a report or proclamation first.', 'warning');
    
    // Detect if we are printing a proclamation (Landscape) or Report Cards (Portrait)
    const isProclamation = !!document.getElementById('proclamation-document');
    const orientationCss = isProclamation ? 'landscape' : 'portrait';
    const classLabel = el('report-class-select').selectedOptions[0]?.text.replace(/\s+/g, '_') || 'Records';
    
    toast(`Generating Institutional PDF (${orientationCss.toUpperCase()})...`, 'info');

    const combinedHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${classLabel}</title>
            <style>
                @page { margin: 0; size: ${isProclamation ? 'A4 landscape' : 'A4 portrait'}; }
                @media print { 
                    html, body { 
                        width: ${isProclamation ? '297mm' : '210mm'} !important; 
                        margin: 0 !important; padding: 0 !important; 
                        background: #fff !important;
                    } 
                    .no-print { display: none !important; }
                    .report-container { width: 100% !important; margin: 0 !important; padding: 0 !important; display: block !important; }
                    .report-page { 
                        border: none !important; margin: 0 !important; 
                        padding: 10mm 15mm !important; box-shadow: none !important; 
                        width: ${isProclamation ? '297mm' : '210mm'} !important; 
                        height: ${isProclamation ? '210mm' : '297mm'} !important; 
                        page-break-after: always !important; 
                        break-after: page !important;
                        display: flex !important;
                        flex-direction: column !important; 
                        justify-content: space-between !important;
                        box-sizing: border-box !important;
                    }
                }
                body { background: #f1f5f9; margin: 0; padding: 0; display: flex; flex-direction: column; align-items: center; font-family: 'Inter', sans-serif; min-height: 100vh; }
                .report-container { display: flex; flex-direction: column; align-items: center; gap: 40px; padding: 40px 20px; box-sizing: border-box; width: 100%; transition: all 0.3s; }
                .report-page { 
                    background: white; 
                    width: 210mm; height: 297mm; 
                    padding: 15mm; 
                    border-radius: 4px; 
                    box-shadow: 0 10px 25px rgba(0,0,0,0.1); 
                    box-sizing: border-box; 
                    overflow: hidden; 
                    display: flex; flex-direction: column; 
                    justify-content: space-between; 
                    position: relative; 
                }
                
                .header-bar { 
                    position: sticky; top: 0; width: 100%; z-index: 1000;
                    background: #1e293b; color: white; padding: 1rem 2rem;
                    display: flex; justify-content: space-between; align-items: center;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); box-sizing: border-box;
                }
                .btn-group { display: flex; gap: 10px; }
                .p-btn { cursor: pointer; border: none; padding: 8px 20px; border-radius: 8px; font-weight: 800; font-size: 0.8rem; text-transform: uppercase; transition: all 0.2s; display: flex; align-items: center; gap: 8px; }
                .btn-print { background: #3b82f6; color: white; }
                .btn-pdf { background: #10b981; color: white; }
                
                /* SMART FIT SCALING SYSTEM */
                @media screen and (max-width: 1000px) {
                    .report-container { padding: 20px 10px; gap: 10px; }
                    .report-page { 
                        transform-origin: top center;
                        margin-bottom: 0 !important;
                    }
                }

                /* Table Responsiveness inside the report */
                .report-content table { width: 100%; border-collapse: collapse; }
                .report-content .table-wrap { width: 100%; overflow-x: auto; }
            </style>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
            <script>
                function applySmartFit() {
                    const pages = document.querySelectorAll('.report-page') || [document.getElementById('proclamation-document')];
                    if (!pages.length || window.innerWidth > 1000) return;
                    
                    const vw = window.innerWidth - 20; 
                    const baseWidth = pages[0].offsetWidth;
                    const sFit = vw / baseWidth;
                    
                    if (sFit < 1) {
                        pages.forEach(p => {
                            if (p) p.style.transform = 'scale(' + sFit + ')';
                        });
                        // Adjust container height to remove void space
                        const container = document.querySelector('.report-container');
                        if (container) {
                           const newH = pages[0].offsetHeight * sFit;
                           container.style.gap = '10px';
                        }
                    }
                }
                function downloadPDF() {
                     const element = document.querySelector('.report-container');
                     const opt = {
                         margin: 0,
                         filename: '${classLabel}_Official_Records.pdf',
                         image: { type: 'jpeg', quality: 0.98 },
                         html2canvas: { 
                             scale: 2, 
                             useCORS: true,
                             logging: false,
                             letterRendering: true
                         },
                         jsPDF: { unit: 'mm', format: 'a4', orientation: '${isProclamation ? 'landscape' : 'portrait'}' },
                         pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
                     };
                     
                     // Use a toast to show progress since large batches take time
                     const btn = document.querySelector('.btn-pdf');
                     const originalText = btn.innerHTML;
                     btn.innerHTML = '⌛ Generating...';
                     btn.disabled = true;

                     html2pdf().set(opt).from(element).save().then(() => {
                         btn.innerHTML = originalText;
                         btn.disabled = false;
                     });
                }
                window.onload = applySmartFit;
                window.onresize = applySmartFit;
            </script>
        </head>
        <body>
            <div class="header-bar no-print">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="width: 32px; height: 32px; background: #3b82f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900;">M</div>
                    <h2 style="margin: 0; font-size: 1rem; letter-spacing: 0.5px; font-weight: 900;">PREVIEW: ${classLabel.toUpperCase()}</h2>
                </div>
                <div class="btn-group">
                    <button class="p-btn btn-print" onclick="window.print()">🖨️ Print Report</button>
                    <button class="p-btn btn-pdf" onclick="downloadPDF()">📄 Download PDF</button>
                    <button class="p-btn" style="background: #f43f5e; color: white;" onclick="window.close()">✕ Close</button>
                </div>
            </div>
            <div class="report-container">
                ${area.innerHTML}
            </div>
        </body>
        </html>
    `;

    const pw = window.open('', '_blank');
    if (!pw) return toast('Pop-up blocked!', 'error');
    pw.document.open();
    pw.document.write(combinedHtml);
    pw.document.close();
    toast('Reports generated in new secure tab.', 'success');
}


async function generateReportCard(forceDownload = false) {
    const cid = el('report-class-select').value;
    if (!cid) return toast('Select a class registry first.', 'warning');
    
    const selSubs = Array.from(el('report-subject-checklist').querySelectorAll('input:checked')).map(i => i.parentElement.textContent.trim());
    const selAsses = Array.from(el('report-assess-checklist').querySelectorAll('input:checked')).map(i => i.parentElement.textContent.trim());
    
    if (forceDownload) {
        const confirmMsg = `GENERATE OFFICIAL REPORTS?\n\nSubjects: ${selSubs.join(', ')}\nMarkers: ${selAsses.join(', ')}\n\nThis will generate high-fidelity PDF documents. Proceed?`;
        if (!confirm(confirmMsg)) return;
    }

    const term = parseInt(el('report-term-select').value);
    const sid = el('report-student-select').value;
    
    // Capture ALL selected items (including std_ placeholders)
    const rawSelSubs = Array.from(el('report-subject-checklist').querySelectorAll('input:checked')).map(i => ({
        id: i.value,
        label: i.parentElement.innerText.trim()
    }));
    const rawSelAsses = Array.from(el('report-assess-checklist').querySelectorAll('input:checked')).map(i => ({
        id: i.value,
        label: i.parentElement.innerText.trim()
    }));
    
    const selSubIds = rawSelSubs.map(s => s.id).filter(id => !id.startsWith('std_'));
    
    if (rawSelSubs.length === 0) return toast('Please select at least one subject.', 'warning');

    const allStudentsInClass = (await DB.getStudents(cid)) || [];
    
    // SKELETON PREVIEW ENGINE: Even with no students, we allow a template preview
    let targetStudents = [];
    if (sid === 'all') {
        targetStudents = allStudentsInClass.length > 0 ? allStudentsInClass : [{ id: 'template', first_name: 'SAMPLE', last_name: 'STUDENT', sid: 'SDMS-XXXX' }];
    } else {
        const found = allStudentsInClass.find(st => st.id === sid);
        targetStudents = found ? [found] : (allStudentsInClass.length > 0 ? [allStudentsInClass[0]] : []);
    }
    
    // FETCH FRESH DATA (Institutional Integrity Enforcement)
    const [allMarks, allDBSubjects, schoolData] = await Promise.all([
        DB.getMarks({ classId: cid, term }),
        DB.getSubjects(),
        DB.getSchoolInfo()
    ]);
    
    if (schoolData) {
        // Deep merge to ensure all branding fields (district, sector, province) are updated
        SCHOOL_INFO = { ...SCHOOL_INFO, ...schoolData };
        console.log('[REPORTS] Institutional Identity Synchronized:', SCHOOL_INFO.school);
    } else {
        console.warn('[REPORTS] Institutional Registry unavailable. Using fallback branding.');
    }

    const subjects = rawSelSubs.map(sel => {
        const dbMatch = allDBSubjects.find(s => s.id === sel.id);
        if (dbMatch) return dbMatch;
        // Strip emojis and extra spaces for the virtual name
        const cleanName = sel.label.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
        return { 
            id: sel.id, 
            name: cleanName.toUpperCase(), 
            abbr: cleanName.toUpperCase().substring(0,5) 
        };
    });

    // BUILD DYNAMIC PILLARS FROM USER SELECTION
    const activePillars = rawSelAsses.map(sel => {
        const dbId = sel.id.startsWith('std_') ? sel.id.replace('std_', '').toLowerCase() : sel.id;
        return {
            id: dbId,
            abbr: sel.label.split(' ').pop().toUpperCase()
        };
    });
    const pillarCount = activePillars.length;

    if (pillarCount === 0) return;

    // Pre-calculate All Student Percentages for Ranking
    const studentAverages = allStudentsInClass.map(st => {
        const marks = allMarks.filter(m => m.student_id === st.id);
        let sSum = 0, sMax = 0;
        subjects.forEach(sub => {
            activePillars.forEach(p => {
                const subMaxMap = SUBJECT_MAX[sub.name] || DEFAULT_SUBJ_MAX;
                const allowedMax = subMaxMap[p.id.toLowerCase()] || 40;
                const mk = marks.find(m => m.subject_id === sub.id && m.assessment_id?.toLowerCase() === p.id);
                if (mk) {
                    sSum += Math.min(Number(mk.score), allowedMax);
                    sMax += Number(mk.max_score || allowedMax);
                } else {
                    sMax += allowedMax;
                }
            });
        });
        return { id: st.id, avg: sMax > 0 ? (sSum / sMax * 100) : 0 };
    }).sort((a, b) => b.avg - a.avg);

    let areaHtml = '';
    const academicYear = SCHOOL_INFO.academic_year || '2025/2026';
    const finalDate = (SCHOOL_INFO.done_date || new Date().toLocaleDateString('en-GB')).toUpperCase();

    for (const student of targetStudents) {
        if (!student) continue;
        const stMarks = allMarks.filter(m => m.student_id === student.id);
        const rank = studentAverages.findIndex(s => s.id === student.id) + 1;
        const rankTotal = studentAverages.length;

        let rowsHtml = '';
        let grandPillarSums = Array(pillarCount).fill(0);
        let grandPillarMaxs = Array(pillarCount).fill(0);
        let grandTotSum = 0, grandTotMax = 0;

        const isDense = subjects.length > 8 || pillarCount > 4;
        const rowFS = pillarCount > 6 ? (isDense ? '0.40rem' : '0.45rem') : (isDense ? '0.52rem' : '0.64rem');
        const rowPad = pillarCount > 6 ? '1px 2px' : (isDense ? '2px 4px' : '3px 6px');
        const cellW = pillarCount > 6 ? '10px' : (pillarCount > 4 ? '14px' : '20px');
        const subjectW = pillarCount > 5 ? '20%' : '25%';

        for (const sub of subjects) {
            let pCells = '', pSum = 0, pMax = 0;
            let mCells = '';
            const baseMax = ['ART','PES','SRS'].includes(sub.abbr) ? 20 : 40;

            activePillars.forEach((p, idx) => {
                const mk = stMarks.find(m => m.subject_id === sub.id && m.assessment_id?.toLowerCase() === p.id);
                const max = mk ? Number(mk.max_score || baseMax) : baseMax;
                const score = mk ? Math.min(Number(mk.score), max) : 0;
                
                pSum += score; pMax += max;
                grandPillarSums[idx] += score; grandPillarMaxs[idx] += max;
                
                pCells += `<td style="border:1.5px solid #000; width:${cellW};">${mk ? score : ''}</td>`;
                mCells += `<td style="border:1.5px solid #000; width:${cellW};">${max}</td>`;
            });

            grandTotSum += pSum; grandTotMax += pMax;
            const subPct = pMax > 0 ? (pSum / pMax * 100).toFixed(1) : '0.0';

            rowsHtml += `
                <tr style="font-size:${rowFS}; font-weight:800; text-align:center; color:#000;">
                    <td style="border:2px solid #000; padding:${rowPad}; text-align:left; font-weight:900; white-space:nowrap; overflow:hidden;">${sub.name.replace(/\s*\(.*?\)\s*/g, '').trim()}</td>
                    ${mCells}
                    <td style="border:2px solid #000; font-weight:900; background:#fff; width:28px;">${pMax}</td>
                    ${pCells}
                    <td style="border:2px solid #000; font-weight:1000; background:#fff; width:28px;">${pSum}</td>
                    <td style="border:2px solid #000; width:28px; font-weight:900;">${subPct}</td>
                    <td style="border:2px solid #000; width:24px; font-weight:900;">${calcGrade(Number(subPct))}</td>
                    <td style="border:2px solid #000; background:#fff; width:28px;">${pSum}</td>
                    <td style="border:2px solid #000; width:28px;">${pMax}</td>
                    <td style="border:2px solid #000; width:28px;">${subPct}</td>
                    <td style="border:2px solid #000; width:24px;">${calcGrade(Number(subPct))}</td>
                </tr>
            `;
        }

        const totalPct = grandTotMax > 0 ? (grandTotSum / grandTotMax * 100).toFixed(1) : '0.0';
        const finalGrade = calcGrade(Number(totalPct));
        const className = el('report-class-select').selectedOptions[0].text;
        const instHeader = generateInstitutionalHeader('PROGRESSIVE REPORT', `TERM ${term} — ${academicYear}`);

        areaHtml += `
            <div class="report-page">
                ${instHeader}
                
                <table style="width:100%; border-collapse:collapse; border:2px solid #000; margin-bottom:5px; font-size:${isDense ? '0.75rem' : '0.85rem'};">
                    <tr>
                        <td style="padding:5px; border:1px solid #000; width:65%;">
                            <strong>Names:</strong> ${(student.last_name + ' ' + student.first_name).toUpperCase()}<br>
                            <strong>Registration ID:</strong> ${student.sid || 'N/A'}
                        </td>
                        <td style="padding:5px; border:1px solid #000; width:35%; line-height:1.5;">
                            <strong>Academic Year:</strong> ${academicYear}<br>
                            <strong>Level:</strong> PRIMARY | <strong>Class:</strong> ${className}
                        </td>
                    </tr>
                </table>

                <table style="width:100%; border-collapse:collapse; border:2.5px solid #000; margin-bottom:5px; text-align:center; font-size:${rowFS};">
                    <thead>
                        <tr style="background:#eee; height:30px; color:#000;">
                            <th rowspan="2" style="border:2.5px solid #000; width:${subjectW}; text-align:center; font-weight:900; font-size: 0.75rem;">SUBJECT</th>
                            <th colspan="${pillarCount + 1}" style="border:2.5px solid #000; font-size: 0.7rem; font-weight:900;">MAXIMUM MARKS</th>
                            <th colspan="${pillarCount + 1}" style="border:2.5px solid #000; font-size: 0.7rem; font-weight:900;">TERM ${term} / ${academicYear}</th>
                            <th rowspan="2" style="border:2.5px solid #000; width:28px; font-weight:900;">%</th>
                            <th rowspan="2" style="border:2.5px solid #000; width:24px; font-weight:900;">GR</th>
                            <th colspan="4" style="border:2.5px solid #000; font-size: 0.7rem; font-weight:900;">ANNUAL TOTAL</th>
                        </tr>
                        <tr style="background:#fff; font-weight:900; font-size:0.5rem; height:20px;">
                            ${activePillars.map(p => `<th style="border:1.5px solid #000; width:${cellW};">${p.abbr}</th>`).join('')}
                            <th style="border:2.5px solid #000; width:28px; background:#fff;">TOT</th>
                            ${activePillars.map(p => `<th style="border:1.5px solid #000; width:${cellW};">${p.abbr}</th>`).join('')}
                            <th style="border:2.5px solid #000; width:28px; background:#fff;">TOT</th>
                            <th style="border:1.5px solid #000; width:28px;">TOT</th>
                            <th style="border:1.5px solid #000; width:28px;">MAX</th>
                            <th style="border:1.5px solid #000; width:28px;">%</th>
                            <th style="border:1.5px solid #000; width:24px;">GR</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                        <tr style="font-weight:1000; border-top:2.5px solid #000; background:#fff; text-align:center; color:#000;">
                            <td style="border:2.5px solid #000; text-align:left; padding:5px; font-size:0.75rem;">TOTAL</td>
                            ${grandPillarMaxs.map(m => `<td style="border:1.5px solid #000;">${m}</td>`).join('')}
                            <td style="border:2.5px solid #000; background:#fff;">${grandTotMax}</td>
                            ${grandPillarSums.map(s => `<td style="border:1.5px solid #000;">${s.toFixed(0)}</td>`).join('')}
                            <td style="border:2.5px solid #000; background:#fff;">${grandTotSum.toFixed(0)}</td>
                            <td style="border:2.5px solid #000;">${totalPct}</td>
                            <td style="border:2.5px solid #000;">${finalGrade}</td>
                            <td style="border:2.5px solid #000; background:#fff;">${grandTotSum.toFixed(0)}</td>
                            <td style="border:2.5px solid #000;">${grandTotMax}</td>
                            <td style="border:2.5px solid #000;">${totalPct}</td>
                            <td style="border:2.5px solid #000;">${finalGrade}</td>
                        </tr>
                    </tbody>
                </table>

                <table style="width:100%; border-collapse:collapse; border:2.5px solid #000; margin-bottom:5px; font-size:${rowFS}; font-weight:900; color:#000;">
                    <tr style="background:#eee; text-align:center;">
                        <td style="border:1px solid #000; width:30%;">ASSESSMENT SUMMARY</td>
                        <td style="border:1px solid #000;">TERM ${term}</td>
                        <td style="border:1px solid #000;">ANNUAL /360</td>
                    </tr>
                    <tr style="height:25px;">
                        <td style="padding:4px; border:1px solid #000;">Percentage</td>
                        <td style="padding:4px; border:1px solid #000; text-align:center;">${totalPct} %</td>
                        <td style="padding:4px; border:1px solid #000; text-align:center;">${totalPct} %</td>
                    </tr>
                    <tr style="height:25px;">
                        <td style="padding:4px; border:1px solid #000;">Final Grade</td>
                        <td style="padding:4px; border:1px solid #000; text-align:center;">${finalGrade}</td>
                        <td style="padding:4px; border:1px solid #000; text-align:center;">${finalGrade}</td>
                    </tr>
                    <tr style="height:25px;">
                        <td style="padding:4px; border:1px solid #000;">Position</td>
                        <td style="padding:4px; border:1px solid #000; text-align:center;">${rank} out of ${rankTotal}</td>
                        <td style="padding:4px; border:1px solid #000; text-align:center;">${rank} out of ${rankTotal}</td>
                    </tr>
                    <tr>
                        <td style="padding:4px; border:1px solid #000; vertical-align:top;">Comment</td>
                        <td style="padding:4px; border:1px solid #000; font-style:italic; text-align:center; vertical-align:middle;">${getComment(totalPct)}</td>
                        <td style="padding:4px; border:1px solid #000; font-style:italic; text-align:center; vertical-align:middle;">${getComment(totalPct)}</td>
                    </tr>
                    <tr style="height:45px;">
                        <td style="padding:4px; border:1px solid #000;">Class teacher's Signature</td>
                        <td style="padding:4px; border:1px solid #000; text-align:center; vertical-align:middle;">
                            ${MY_PROFILE?.signature ? `<img src="${MY_PROFILE.signature}" style="max-height:35px; max-width:180px; object-fit:contain; mix-blend-mode:multiply;">` : `<span style="font-size:0.6rem;">${(MY_PROFILE?.full_name || '...').toUpperCase()}</span>`}
                        </td>
                        <td style="padding:4px; border:1px solid #000; text-align:center; vertical-align:middle;">
                            ${MY_PROFILE?.signature ? `<img src="${MY_PROFILE.signature}" style="max-height:35px; max-width:180px; object-fit:contain; mix-blend-mode:multiply;">` : ''}
                        </td>
                    </tr>
                    <tr style="height:30px;">
                        <td style="padding:4px; border:1px solid #000;">Parent's Signature</td>
                        <td style="border:1px solid #000;"></td>
                        <td style="border:1px solid #000;"></td>
                    </tr>
                </table>

                <div style="display:grid; grid-template-columns: 1.8fr 1.2fr; gap:10px; margin-top:12px; align-items: stretch; margin-bottom:5px;">
                    <table style="width:100%; border-collapse:collapse; border:2px solid #000; font-size:0.52rem; text-align:center; table-layout: fixed;">
                        <tr>
                            <td rowspan="3" style="border:2px solid #000; width:60px; font-weight:900; background:#f0f0f0; padding: 2px;">Grading scale</td>
                            <td style="border:1px solid #000; font-weight:800; background:#f9f9f9; width:70px;">Final Grade</td>
                            <td style="border:1px solid #000; white-space:nowrap;">100-80</td><td style="border:1px solid #000; white-space:nowrap;">79-75</td><td style="border:1px solid #000; white-space:nowrap;">74-70</td><td style="border:1px solid #000; white-space:nowrap;">69-65</td><td style="border:1px solid #000; white-space:nowrap;">64-60</td><td style="border:1px solid #000; white-space:nowrap;">59-50</td><td style="border:1px solid #000; white-space:nowrap;">49-00</td>
                        </tr>
                        <tr>
                            <td style="border:1px solid #000; font-weight:800; background:#f9f9f9;">Letter Grade</td>
                            <td style="border:1px solid #000; font-weight:900;">A</td><td style="border:1px solid #000; font-weight:900;">B</td><td style="border:1px solid #000; font-weight:900;">C</td><td style="border:1px solid #000; font-weight:900;">D</td><td style="border:1px solid #000; font-weight:900;">E</td><td style="border:1px solid #000; font-weight:900;">S</td><td style="border:1px solid #000; font-weight:900;">F</td>
                        </tr>
                        <tr>
                            <td style="border:1px solid #000; font-weight:800; background:#f9f9f9;">Grade Value</td>
                            <td style="border:1px solid #000; font-weight:900;">6</td><td style="border:1px solid #000; font-weight:900;">5</td><td style="border:1px solid #000; font-weight:900;">4</td><td style="border:1px solid #000; font-weight:900;">3</td><td style="border:1px solid #000; font-weight:900;">2</td><td style="border:1px solid #000; font-weight:900;">1</td><td style="border:1px solid #000; font-weight:900;">0</td>
                        </tr>
                    </table>
                    <div style="border:2px solid #000; padding:12px; font-size:0.58rem; display:flex; flex-direction:column; justify-content:center; text-align:center; position:relative; color:#000; min-height:165px;">
                        <div style="font-size:0.52rem; font-weight:1000; color:#000; text-transform:uppercase; margin-bottom:5px; border-bottom:1px solid #000; padding-bottom:3px;">
                            DONE AT ${(SCHOOL_INFO.district || '...').toUpperCase()}, ON ${finalDate}
                        </div>
                        <div style="font-weight:1000; font-size:0.75rem; margin-bottom:15px; color:#000; letter-spacing:1px;">HEADTEACHER / PRINCIPAL</div>
                        
                        <div style="flex-grow:1; display:flex; align-items:center; justify-content:center; position:relative; margin-bottom:10px;">
                            ${SCHOOL_INFO.headteacher_sig ? `<img src="${SCHOOL_INFO.headteacher_sig}" style="max-height:80px; max-width:200px; object-fit:contain; mix-blend-mode:multiply; position:absolute; z-index:2; transform: translateY(-5px);">` : ''}
                            ${SCHOOL_INFO.stamp ? `<img src="${SCHOOL_INFO.stamp}" style="width:115px; height:115px; opacity:0.85; mix-blend-mode:multiply; position:absolute; z-index:1; transform: translate(30px, -15px) rotate(-8deg);">` : ''}
                        </div>

                        <div style="font-weight:1000; font-size:0.95rem; border-top: 2px solid #000; padding-top:8px; color:#000; text-transform:uppercase; letter-spacing:0.5px;">
                            ${(SCHOOL_INFO.headteacher || '...').toUpperCase()}
                        </div>
                    </div>
                </div>

                <div style="padding:10px 0; display:flex; justify-content:flex-end; font-size:0.55rem; color:#000; font-weight:800;">
                    <span>OFFICIAL STUDENT REGISTRY ID: ${student.sid || 'N/A'}</span>
                </div>
            </div>
        `;
    }

    const printArea = el('report-card-print-area');
    printArea.style.background = '#ffffff';
    printArea.style.border = 'none';
    printArea.style.padding = '0';
    printArea.style.margin = '0';
    
    if (!areaHtml || areaHtml.trim() === '') {
        printArea.innerHTML = `
            <div style="text-align:center; padding: 5rem 2rem; background: #fff; border: 2px dashed #e2e8f0; border-radius: 20px; color: #64748b;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">📂</div>
                <h3 style="font-weight: 1000; color: #1e293b; margin-bottom: 0.5rem;">No Active Records Identified</h3>
                <p style="font-size: 0.9rem; max-width: 400px; margin: 0 auto;">Ensure your school node (${SCHOOL_INFO.code || 'N/A'}) is synchronized and that marks have been recorded for the selected term.</p>
            </div>
        `;
    } else {
        printArea.innerHTML = areaHtml.trim();
        // Give the DOM a moment to render then scroll
        setTimeout(() => {
            printArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    if (forceDownload) {
        toast('Generating Institutional PDF...', 'info');
        const className = el('report-class-select').selectedOptions[0]?.text.replace(/\s+/g, '_') || 'Selected_Class';
        const opt = { 
            margin:0, 
            filename:`Report_Card_of_${className}.pdf`, 
            image:{type:'jpeg',quality:0.98}, 
            html2canvas:{scale:3, useCORS: location.protocol !== 'file:', letterRendering: true, backgroundColor: '#ffffff'}, 
            jsPDF:{unit:'mm',format:'a4',orientation:'portrait', compress: true},
            pagebreak: { mode: 'css' }
        };
        html2pdf().set(opt).from(el('report-card-print-area')).save();
    }
}

// ============================================================
// PROFILE & SETUP
// ============================================================
async function renderProfilePage() {
    const p = MY_PROFILE; if (!p) return;
    el('profile-name').textContent = p.full_name; 
    el('profile-email').textContent = p.email;
    el('profile-sdms').textContent = p.sdms_code || 'UNSET';
    if (el('profile-phone-input')) el('profile-phone-input').value = p.phone || '';
    el('profile-avatar-big').textContent = (p.full_name[0] || 'T').toUpperCase();
    
    // Fetch and Display Jurisdictions
    const [assignments, allSubjectsList] = await Promise.all([
        DB.getTeacherAssignments(p.id),
        DB.getSubjects()
    ]);
    const jurListEl = el('profile-jurisdictions-list');
    const primaryClassEl = el('profile-class');
    
    if (jurListEl) {
        if (assignments.length === 0) {
            jurListEl.innerHTML = '<div style="color:#94a3b8; font-size:0.8rem;">No academic jurisdictions assigned.</div>';
            if (primaryClassEl) primaryClassEl.textContent = '—';
        } else {
            const classRole = assignments.find(a => a.type === 'class');
            if (primaryClassEl) primaryClassEl.textContent = classRole ? classRole.classes?.name : '—';
            
            // Expand jurisdictions logic (same as dashboard)
            const expanded = [];
            const seen = new Set();
            assignments.forEach(a => {
                if (a.type === 'subject') {
                    const k = `sub_${a.class_id}_${a.subject_id}`;
                    if (!seen.has(k)) { seen.add(k); expanded.push(a); }
                }
            });
            assignments.forEach(a => {
                if (a.type === 'class') {
                    const k = `cls_${a.class_id}`;
                    if (!seen.has(k)) { 
                        seen.add(k); expanded.push(a); 
                        allSubjectsList.filter(s => s.class_id === a.class_id).forEach(s => {
                            const sk = `sub_${s.class_id}_${s.id}`;
                            if (!seen.has(sk)) {
                                seen.add(sk); expanded.push({ ...a, type: 'class_subject', subject_id: s.id, subjects: s });
                            }
                        });
                    }
                }
            });

            jurListEl.innerHTML = expanded.map(a => {
                const isClass = a.type === 'class';
                const isClassSub = a.type === 'class_subject';
                const label = isClass ? 'MANAGEMENT' : (isClassSub ? 'CLASS ACCESS' : 'INSTRUCTION');
                const color = isClass ? '#a16207' : (isClassSub ? '#854d0e' : '#2563eb');
                const bg    = isClass ? '#fef9c3' : (isClassSub ? '#fefce8' : '#eff6ff');
                const text  = isClass ? `Class Management: ${a.classes?.name}` : `${a.subjects?.name} (${a.classes?.name})`;
                
                return `
                    <div style="background:white; border:1px solid #e2e8f0; border-radius:12px; padding:1rem; display:flex; justify-content:space-between; align-items:center;">
                        <div style="font-weight:800; color:#1e293b; font-size:0.9rem;">${text}</div>
                        <span style="font-size:0.6rem; font-weight:900; background:${bg}; color:${color}; padding:4px 10px; border-radius:6px; text-transform:uppercase; border:${isClassSub ? '1px solid #fde047':'none'};">${label}</span>
                    </div>
                `;
            }).join('');
        }
    }

    if (p.signature) {
        if (el('signature-preview-img')) {
            el('signature-preview-img').src = p.signature;
            el('signature-preview-img').style.display = 'block';
        }
        if (el('signature-placeholder')) el('signature-placeholder').style.display = 'none';
    }
}

async function handleSignatureUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) return toast('Image too large. Max 2MB.', 'error');
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64 = e.target.result;
        el('signature-preview-img').src = base64;
        el('signature-preview-img').style.display = 'block';
        el('signature-placeholder').style.display = 'none';
        
        // Temporarily store in session to save on main "Save" click
        window._pendingSignature = base64;
        toast('Signature staged for saving.', 'info');
    };
    reader.readAsDataURL(file);
}

async function saveTeacherPhone() {
    const phone = el('profile-phone-input').value.trim();
    const signature = window._pendingSignature || (MY_PROFILE ? MY_PROFILE.signature : null);
    
    if (!MY_PROFILE) return;
    toast('Updating profile...', 'info');
    const { error } = await DB.updateProfile(MY_PROFILE.id, { phone, signature });
    
    if (!error) {
        MY_PROFILE.phone = phone;
        MY_PROFILE.signature = signature;
        delete window._pendingSignature;
        toast('Institutional profile & signature synchronized.', 'success');
    } else {
        if (error.message.includes('signature')) {
            toast('⚠️ Institutional Error: Signature column missing. Please run the SQL Update in Section 1.', 'error');
            console.error('SQL FIX REQUIRED: ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signature TEXT;');
        } else {
            toast('Failed to update: ' + error.message, 'error');
        }
    }
}

async function renderProfile() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return;
    const teachers = await DB.getTeachers();
    MY_PROFILE = teachers.find(t => t.email.toLowerCase() === user.email.toLowerCase());
    if (MY_PROFILE) {
        const fullName = MY_PROFILE.full_name || 'Faculty Member';
        const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        
        const sidebarName = el('sidebar-user-name');
        const sidebarInit = el('sidebar-avatar-init');
        const sidebarRole = el('sidebar-user-role');

        if (sidebarName) sidebarName.textContent = fullName;
        if (sidebarInit) sidebarInit.textContent = initials;
        if (sidebarRole) {
            const roles = [];
            if (MY_PROFILE.is_class_teacher) roles.push('CLASS');
            if (MY_PROFILE.is_subject_teacher) roles.push('SUBJECT');
            sidebarRole.textContent = roles.length > 0 ? roles.join(' & ') + ' TEACHER' : 'PEDAGOGICAL FACULTY';
        }

        // Role-Based UI Enforcement
        activateSidebarModules({ 
            isSubjectTeacher: MY_PROFILE.is_subject_teacher, 
            isClassTeacher: MY_PROFILE.is_class_teacher 
        });
    }
}

async function handleLogout() {
    if (confirm('Disconnect from MMS Node? All active institutional data will be wiped.')) {
        try {
            if (window.SYNC && SYNC.stop) SYNC.stop();
            if (typeof DB !== 'undefined' && DB.clearCache) DB.clearCache();
            sessionStorage.clear();
            if (window._supabase) await _supabase.auth.signOut();
            window.location.replace('./Login.html');
        } catch (err) {
            window.location.href = './Login.html';
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Core Initialization Flow (Multi-Strategy Identity + Assignments)
    await initTeacherPortal(); 
    
    // 2. Restore View Context from session
    const lastView = sessionStorage.getItem('teacher_last_view') || 'dashboard';
    const sideItem = document.querySelector(`.sidebar-item[data-view="${lastView}"]`);
    await switchView(lastView, sideItem);

    // 3. Start Real-time Institutional Channel
    SYNC.start();
    
    // Sync Handlers (View-Aware)
    SYNC.on('marks', async () => { 
        const active = document.querySelector('.view.active')?.id;
        if (active === 'view-marks-entry') await loadMarksTable(); 
        if (active === 'view-approval-status') await renderApprovalStatus();
        if (active === 'view-dashboard') await renderDashboard();
    });
    SYNC.on('assignments', async () => { 
        await renderProfile(); 
        const active = document.querySelector('.view.active')?.id;
        if (active === 'view-dashboard') await renderDashboard(); 
        if (active === 'view-verification') await renderVerificationView();
    });
    SYNC.on('subjects', async () => { if (document.querySelector('.view.active')?.id === 'view-dashboard') await renderDashboard(); });
    SYNC.on('classes', async () => { if (document.querySelector('.view.active')?.id === 'view-dashboard') await renderDashboard(); });
    SYNC.on('students', async () => { if (document.querySelector('.view.active')?.id === 'view-students') await renderClassStudents(); });
    SYNC.on('school_settings', async () => {
        console.log('[SYNC] Institutional settings updated. Re-aligning portal...');
        const schoolCode = await getCurrentSchoolCode();
        const settings = await fetchSchoolSettings(schoolCode);
        const officialInfo = await DB.getSchoolInfo();
        if (officialInfo) SCHOOL_INFO = { ...SCHOOL_INFO, ...officialInfo };
        if (settings && settings.info) {
            SCHOOL_INFO = { ...SCHOOL_INFO, ...settings.info };
            if (officialInfo && officialInfo.school) SCHOOL_INFO.school = officialInfo.school;
        }
        
        // Update Branding
        const nameEl = document.getElementById('school-name-hd');
        if (nameEl) nameEl.textContent = (SCHOOL_INFO.school || 'MMS PORTAL').toUpperCase();
        toast('🔄 Institutional settings synchronized.', 'info');
    });

    
    console.log('[MMS] Faculty Node fully synchronized.');
});

async function renderStudentRegistry() {
    const classId = document.getElementById('s-class-id')?.value;
    if (!classId) {
        toast('⚠️ Selective access only: You must have an assigned class for registry management.', 'info');
        switchView('dashboard');
        return;
    }

    // Role-Based Jurisdiction Lockdown
    const isClassLead = MY_ASSIGNMENTS.some(a => a.type === 'class' && a.class_id === classId);
    if (el('btn-enroll-student')) {
        el('btn-enroll-student').style.display = isClassLead ? 'flex' : 'none';
    }

    const rawStudents = await DB.getStudents(classId);
    const students = rawStudents.sort((a, b) => {
        const nameA = `${a.last_name || ''} ${a.first_name || ''}`.trim().toUpperCase();
        const nameB = `${b.last_name || ''} ${b.first_name || ''}`.trim().toUpperCase();
        return nameA.localeCompare(nameB);
    });
    
    const tbody = document.getElementById('students-registry-tbody');
    if (!tbody) return;

    if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding:4rem; text-align:center; color:#94a3b8;">No institutional records found for this class node.</td></tr>`;
    } else {
        tbody.innerHTML = students.map((s, index) => {
            const isPending = s.status === 'pending_deletion';
            const actionButtons = isClassLead ? (isPending ? 
                `<span class="badge badge-orange" style="font-size:0.6rem;">PENDING DELETION</span>` : 
                `<button class="btn" style="background:#f1f5f9; color:#1e293b; font-size:0.7rem;" onclick="openEditStudentModal('${s.id}')">EDIT</button>
                 <button class="btn" style="background:transparent; color:#ef4444; font-weight:800; border:none; font-size:0.7rem;" onclick="requestDeleteStudent('${s.id}')">DELETE</button>`) : 
                `<span class="badge" style="background:#f1f5f9; color:#94a3b8; font-size:0.6rem;">VIEW ONLY</span>`;

            return `
                <tr style="border-bottom: 1px solid #f1f5f9; ${isPending ? 'opacity:0.6; background:#fff1f2;' : ''}">
                    <td style="padding: 12px 1.5rem; font-weight: 700; color:#64748b;">${index + 1}</td>
                    <td style="padding: 12px 1rem; font-weight: 700;">
                        <span style="color:#1e293b; ${isClassLead ? 'cursor:pointer;' : ''}" ${isClassLead ? `onclick="openEditStudentModal('${s.id}')" title="Edit Student Profile"` : ''}>${s.last_name} ${s.first_name}</span>
                    </td>
                    <td style="padding: 12px 1rem; color:#64748b; font-weight:700;">${s.gender || '—'}</td>
                    <td style="padding: 12px 1rem; color:#64748b;">${s.sid || 'UNSET'}</td>
                    <td style="padding: 12px 1rem; font-weight: 600; color:#2563eb;">${s.classes?.name || 'Class'}</td>
                    <td style="padding: 12px 1.5rem; text-align: right; display:flex; gap:0.5rem; justify-content:flex-end;">
                        ${actionButtons}
                    </td>
                </tr>
            `;
        }).join('');
    }
}

async function openEditStudentModal(id) {
    const students = await DB.getStudents();
    const s = students.find(x => x.id == id);
    if (!s) return;

    el('edit-s-id-internal').value = s.id;
    el('edit-s-fname').value = s.first_name;
    el('edit-s-lname').value = s.last_name;
    el('edit-s-gender').value = s.gender || 'M';
    el('edit-s-id').value = s.sid || '';
    
    el('edit-student-modal').classList.add('open');
}

async function processUpdateStudent() {
    const id = el('edit-s-id-internal').value;
    const payload = {
        first_name: el('edit-s-fname').value.trim().toUpperCase(),
        last_name: el('edit-s-lname').value.trim().toUpperCase(),
        gender: el('edit-s-gender').value,
        sid: el('edit-s-id').value.trim()
    };

    try {
        const { error } = await _supabase.from('students').update(payload).eq('id', id);
        if (error) throw error;
        toast('✅ Student records updated.', 'success');
        closeModal('edit-student-modal');
        await renderStudentRegistry();
    } catch (err) {
        toast('❌ Update failed.', 'error');
    }
}

async function requestDeleteStudent(id) {
    const confirm = window.confirm("Are you sure you want to delete this student? This request will be sent to Admin for approval.");
    if (!confirm) return;

    try {
        const { error } = await _supabase.from('students').update({ status: 'pending_deletion' }).eq('id', id);
        if (error) throw error;
        toast('⏳ Deletion request sent to Admin.', 'info');
        await renderStudentRegistry();
    } catch (err) {
        toast('❌ Request failed.', 'error');
    }
}

function openAddStudentModal() {
    const modal = document.getElementById('add-student-modal');
    if (modal) {
        modal.classList.add('open');
        document.getElementById('s-fname').value = '';
        document.getElementById('s-lname').value = '';
        document.getElementById('s-id').value = '';
    }
}

async function processAddStudent() {
    const fn = document.getElementById('s-fname').value.trim();
    const ln = document.getElementById('s-lname').value.trim();
    const id = document.getElementById('s-id').value.trim();
    const gen = document.getElementById('s-gender').value;
    const cid = document.getElementById('s-class-id').value;

    if (!fn || !ln || !id || !gen) {
        toast('⚠️ All fields are required for enrollment.', 'warning');
        return;
    }

    try {
        const payload = {
            first_name: fn.toUpperCase(),
            last_name: ln.toUpperCase(),
            sid: id,
            gender: gen,
            class_id: cid,
            created_at: new Date().toISOString()
        };

        const { data, error } = await DB.addStudent(payload);
        if (error) throw error;

        toast('✅ Student enrolled successfully!', 'success');
        closeModal('add-student-modal');
        await renderStudentRegistry();
    } catch (err) {
        console.error('[REGISTRY] Enrollment failed:', err);
        toast('❌ Failed to enroll student. Check SDMS duplicates.', 'error');
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('open');
}

/** 
 * Ensure modals close on outside click
 */
window.addEventListener('click', function(event) {
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(m => {
        if (event.target === m) m.classList.remove('open');
    });
});

// ============================================================
// EXCEL BULK OPERATION ENGINE
// ============================================================

function downloadExcelTemplate() {
    const table = document.getElementById('marks-entry-tbody');
    if (!table || !table.rows.length) return toast('⚠️ Please select a class and subject first.', 'warning');
    
    const rows = table.rows;
    const headerRow = document.getElementById('marks-entry-thead-row');
    
    // 1. Prepare Headers
    const data = [
      ["No", "Student ID", "Full Name"]
    ];
    
    const assessments = [];
    for(let i=2; i < headerRow.cells.length; i++) {
        const headerDiv = headerRow.cells[i].querySelector('div');
        if (headerDiv) {
            const name = headerDiv.textContent.trim();
            assessments.push(name);
            data[0].push(name);
        }
    }

    // 2. Add Student Rows
    for(let i=0; i < rows.length; i++) {
        const tr = rows[i];
        const studentNo = tr.cells[0].textContent;
        const idSpan = tr.cells[1].querySelector('span');
        const studentSidDisplay = idSpan ? idSpan.textContent : 'N/A';
        const studentName = tr.cells[2].textContent.trim();
        
        const row = [studentNo, studentSidDisplay, studentName];
        // Add empty cells for each assessment column
        assessments.forEach(() => row.push(""));
        data.push(row);
    }

    // 3. Generate File
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Institutional_Marks_Entry");
    
    const sName = el('entry-subject-select').selectedOptions[0].text;
    const cName = el('entry-class-select').selectedOptions[0].text;
    
    XLSX.writeFile(wb, `Template_${sName}_${cName}.xlsx`);
    toast('✅ Institutional template generated successfully.', 'success');
}

function triggerExcelUpload() {
    document.getElementById('excel-upload-input').click();
}

async function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);
            
            if (!jsonData.length) throw new Error('Selected Excel sheet is empty.');

            toast('📂 Parsing institutional data packet...', 'info');
            
            const tbody = document.getElementById('marks-entry-tbody');
            const studentRows = Array.from(tbody.rows);
            const headerRow = document.getElementById('marks-entry-thead-row');
            
            let matchedCount = 0;
            let errorCount = 0;

            jsonData.forEach(csvRow => {
                const csvName = (csvRow["Full Name"] || "").toString().trim().toUpperCase();
                const csvId = (csvRow["Student ID"] || "").toString().trim();
                
                // Find matching UI row
                const uiRow = studentRows.find(tr => {
                    const rowName = tr.cells[2].textContent.trim().toUpperCase();
                    const rowId = tr.cells[1].querySelector('span')?.textContent.trim();
                    return rowId === csvId || rowName === csvName;
                });
                
                if (uiRow) {
                    const inputs = Array.from(uiRow.querySelectorAll('.mark-input'));
                    
                    // Match each keys in the CSV row to our headers
                    Object.keys(csvRow).forEach(columnHeader => {
                        // Skip non-assessment columns
                        if (["No", "Student ID", "Full Name"].includes(columnHeader)) return;

                        // Find which header cell matches this column name
                        const headerCells = Array.from(headerRow.cells);
                        const targetHeader = headerCells.find(hc => hc.querySelector('div')?.textContent.trim() === columnHeader);
                        
                        if (targetHeader) {
                            // Find the internal Assessment ID from the hidden max-hdr input
                            const maxInput = targetHeader.querySelector('input[id^="max-hdr-"]');
                            if (maxInput) {
                                const aid = maxInput.id.replace('max-hdr-', '');
                                const targetInput = inputs.find(inp => inp.dataset.aid === aid);
                                if (targetInput && !targetInput.disabled) {
                                    const scoreValue = csvRow[columnHeader];
                                    targetInput.value = scoreValue;
                                    
                                    // Trigger validation and marking
                                    const maxVal = parseInt(maxInput.value || 90);
                                    validateInput(targetInput, maxVal);
                                    targetInput.classList.add('unsaved');
                                    matchedCount++;
                                }
                            }
                        }
                    });
                } else {
                    errorCount++;
                }
            });

            if (matchedCount > 0) {
                toast(`✅ Success: Mapped ${matchedCount} assessment records correctly.`, 'success');
                if (errorCount > 0) toast(`Notice: ${errorCount} records in Excel did not match our registry.`, 'warning');
            } else {
                toast('⚠️ No matching records found. Ensure you used the provided template.', 'warning');
            }
            
            event.target.value = ""; // Clear for next upload
        } catch (err) {
            console.error('[EXCEL] Batch failed:', err);
            toast('❌ Synchronization Error: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

async function generateExcelTemplateForSubject(sid, sName, cid, cName) {
    toast(`📂 Generating institutional template for ${sName}...`, 'info');
    
    try {
        // 1. Get Assessments
        const assessList = await DB.getAssessments();
        const activeAssessments = assessList.length ? assessList : [
            {id: 'cat', name: 'CAT', max_score: 50},
            {id: 'et', name: 'End Of Term', max_score: 100}
        ];

        // 2. Get Students
        const students = await DB.getStudents(cid);
        const sorted = students.sort((a, b) => {
            const nameA = `${a.last_name || ''} ${a.first_name || ''}`.trim().toUpperCase();
            const nameB = `${b.last_name || ''} ${b.first_name || ''}`.trim().toUpperCase();
            return nameA.localeCompare(nameB);
        });

        // 3. Prepare Data
        const data = [
          ["No", "Student ID", "Full Name"]
        ];
        activeAssessments.forEach(ass => data[0].push(ass.name));

        sorted.forEach((s, i) => {
            const row = [i + 1, s.sid || 'N/A', `${(s.last_name || '')} ${(s.first_name || '')}`.trim().toUpperCase()];
            activeAssessments.forEach(() => row.push(""));
            data.push(row);
        });

        // 4. Generate File
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Marks_Template");
        
        XLSX.writeFile(wb, `Template_${sName.replace(/\s+/g, '_')}_${cName.replace(/\s+/g, '_')}.xlsx`);
        
        // 5. Final Step: Render Dashboard & Quick Jump Sidebar
        await renderDashboard();
        await renderQuickJump();
        
        console.log('[INIT] Faculty Workspace fully operational.');
    } catch (err) {
        console.error('[INIT] Crash detected:', err);
        toast('Institutional Sync Failed. Check Node connection.', 'error');
    }
}

async function renderQuickJump() {
    const qjContainer = document.getElementById('side-quick-jump-container');
    const qjLabel = document.getElementById('side-quick-jump-label');
    if (!qjContainer) return;

    const assignments = await DB.getTeacherAssignments(MY_PROFILE.id);
    const myClassIds = assignments.filter(a => a.type === 'class').map(a => a.class_id);
    
    // Fetch curriculum for lead classes
    const classAssignmentsResults = await Promise.all(
        myClassIds.map(cid => DB.getClassAssignments(cid))
    );
    const leadSubjects = classAssignmentsResults.flat().filter(a => a.type === 'subject');
    
    // Combine for Quick Jump
    const uniqueMap = new Map();
    assignments.filter(a => a.type === 'subject').forEach(s => uniqueMap.set(`sub_${s.class_id}_${s.subject_id}`, s));
    leadSubjects.forEach(s => {
        if (!uniqueMap.has(`sub_${s.class_id}_${s.subject_id}`)) {
            uniqueMap.set(`sub_${s.class_id}_${s.subject_id}`, s);
        }
    });

    const displayItems = Array.from(uniqueMap.values());

    if (displayItems.length > 0) {
        qjLabel.style.display = 'block';
        qjContainer.innerHTML = displayItems.map(s => `
            <div class="sidebar-item" style="font-size: 0.75rem; padding: 10px 1.5rem;" 
                 onclick="goToEntrySubjectClass('${s.subject_id}','${s.subjects?.name || 'Sub'}','${s.class_id}','${s.classes?.name || 'Class'}')">
                <i data-lucide="zap" style="width:12px; height:12px; color:#f59e0b;"></i>
                <span class="sidebar-item-text">${(s.subjects?.abbr || 'SUB').toUpperCase()} — ${s.classes?.name || 'CLASS'}</span>
            </div>
        `).join('');
        if (window.lucide) lucide.createIcons();
    } else {
        qjLabel.style.display = 'none';
        qjContainer.innerHTML = '';
    }
}

function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('open');
}
function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('open');
}

function getSelectedReportSubjectIds() {
    return Array.from(el('report-subject-checklist').querySelectorAll('input:checked')).map(i => i.value);
}
function getSelectedReportAssessIds() {
    return Array.from(el('report-assess-checklist').querySelectorAll('input:checked')).map(i => i.value);
}
function getSelectedReportAssessLabels() {
    return Array.from(el('report-assess-checklist').querySelectorAll('input:checked')).map(i => i.parentElement.textContent.trim()).join(' + ');
}

/**
 * INSTITUTIONAL BRANDING ORCHESTRATION
 * Ensures all reports use real database info and official logos.
 */
function generateInstitutionalHeader(reportTitle, subtitle = '', assessLabelOverride = '') {
    const info = SCHOOL_INFO;
    const assessLabel = assessLabelOverride || (typeof getSelectedReportAssessLabels === 'function' ? getSelectedReportAssessLabels() : 'ALL ASSESSMENTS');
    const rwandaLogo = "js/Report image/download__92_-removebg-preview.png";
    const schoolLogo = info.logo || "js/Report image/c41de77e-b6ee-46ea-b62f-5b6172b80738-removebg-preview.png";

    return `
        <div style="display:flex; flex-direction:column; align-items:center; border-bottom: 3px solid #000; padding-bottom: 20px; margin-bottom: 20px; position:relative; font-family: 'Inter', sans-serif; color:#000;">
            
            <!-- Standard Rwanda/MINEDUC Branding (Left Overlay-ish) -->
            <div style="position:absolute; left:0; top:0; width:120px; text-align:center;">
                <img src="${rwandaLogo}" style="width:85px; height:auto; margin-bottom:2px;">
                <div style="font-size:0.55rem; font-weight:800; color:#000; line-height:1.1;">
                    REPUBLIC OF RWANDA<br>MINISTRY OF EDUCATION
                </div>
            </div>

            <!-- Central School Details -->
            <div style="text-align:center; padding: 0 100px; width:100%; box-sizing:border-box;">
                <div style="font-size:0.8rem; font-weight:900; color:#000; letter-spacing:1px;">${(info.republic || 'REPUBLIC OF RWANDA').toUpperCase()}</div>
                <div style="font-size:2.2rem; font-weight:1000; color:#000; text-transform:uppercase; margin: 4px 0; letter-spacing:-1px; line-height:1;">${(info.school || 'MMS PORTAL').toUpperCase()}</div>
                
                <div style="font-size:0.85rem; font-weight:900; color:#000; margin: 6px 0; text-transform:uppercase;">
                    ${info.province ? info.province + ' PROVINCE | ' : ''}
                    DISTRICT: ${info.district || '...'} | SECTOR: ${info.sector || '...'} | LEVEL: ${info.level || 'PRIMARY'}
                </div>

                <div style="margin: 15px 0;">
                    <span style="font-size:1.6rem; font-weight:1000; padding:10px 25px; border:3px solid #000; display:inline-block; letter-spacing:3px; white-space: nowrap;">${reportTitle.toUpperCase()}</span>
                </div>

                <div style="font-size:0.8rem; font-weight:800; color:#000; margin-top:5px; white-space: nowrap;">
                    Email: ${info.email || '...'} | Phone: ${info.phone || '...'}
                </div>

                <div style="font-size:0.95rem; font-weight:900; color:#000; margin-top:10px; text-transform:uppercase; white-space: nowrap;">
                    [ REPORT FOR: ${assessLabel} ]
                </div>
                
                ${subtitle ? `<div style="font-size:1rem; font-weight:950; margin-top:8px; font-style:italic;">${subtitle}</div>` : ''}
            </div>

            <!-- School Logo (Right Overlay-ish) -->
            <div style="position:absolute; right:0; top:0; width:120px; text-align:center;">
                ${info.logo ? 
                    `<img src="${info.logo}" style="width:100px; height:100px; object-fit:contain;">` : 
                    `<div style="width:100px; height:100px; border:2.5px dashed #000; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:0.6rem; font-weight:900; text-align:center; color:#000;">OFFICIAL<br>STAMP / LOGO</div>`
                }
            </div>

        </div>
    `;
}

// ============================================================
// GRADE DISTRIBUTION REPORT (CLASS TEACHER SUMMARY)
// ============================================================

window.openGradeDistributionReportModal = async function() {
    const assignments = await DB.getTeacherAssignments(MY_PROFILE?.id);
    const classAssignment = assignments.find(a => a.type === 'class');
    
    if (!classAssignment) {
        return toast('Error: You are not assigned as a primary Class Teacher to any class.', 'error');
    }

    const cls = classAssignment.classes;
    if (el('gd-class-display')) el('gd-class-display').value = cls?.name || 'Assigned Class';
    if (el('gd-class')) el('gd-class').value = classAssignment.class_id;
    
    openModal('grade-distribution-report-modal');
};

window.generateGradeDistributionReport = async function() {
    const year = el('gd-year').value;
    const term = el('gd-term').value;
    const classId = el('gd-class').value;
    
    if (!classId) return toast('No class context identified.', 'error');

    toast('Crunching class performance brackets...', 'info');
    
    try {
        const [allMarks, students, classes] = await Promise.all([
            DB.getMarks({ classId, term, year }), 
            DB.getStudents(classId), 
            DB.getClasses()
        ]);

        const selSubIds = getSelectedReportSubjectIds();
        const selAssessIds = getSelectedReportAssessIds();

        const cls = classes.find(c => c.id === classId);
        const classStudents = students.filter(s => s.class_id === classId);
        let classMarks = allMarks.filter(m => m.class_id === classId && String(m.term) === String(term) && m.is_approved);
        
        if (selSubIds.length > 0) {
            classMarks = classMarks.filter(m => selSubIds.includes(m.subject_id));
        }
        if (selAssessIds.length > 0) {
            classMarks = classMarks.filter(m => selAssessIds.includes(m.assessment_id));
        }
        
        const brackets = {
            '80-100': { m:0, f:0, t:0 },
            '75-79':  { m:0, f:0, t:0 },
            '70-74':  { m:0, f:0, t:0 },
            '65-69':  { m:0, f:0, t:0 },
            '60-64':  { m:0, f:0, t:0 },
            '50-59':  { m:0, f:0, t:0 },
            '0-49':   { m:0, f:0, t:0 }
        };

        let sat_b = 0, sat_g = 0;
        let abs_b = 0, abs_g = 0;
        let exp_b = 0, exp_g = 0;

        classStudents.forEach(s => {
            const isM = (s.gender === 'M' || s.gender === 'Boy' || s.gender === 'male');
            if (isM) exp_b++; else exp_g++;

            const sMarks = classMarks.filter(m => m.student_id === s.id);
            if (sMarks.length > 0) {
                if (isM) sat_b++; else sat_g++;
                
                let totalScore = 0;
                let totalMax = 0;
                sMarks.forEach(m => {
                    totalScore += (m.score === -1 ? 0 : Number(m.score));
                    totalMax += Number(m.max_score || 10);
                });
                const avg = totalMax > 0 ? (totalScore / totalMax * 100) : 0;
                
                let bKey = '0-49';
                if (avg >= 80) bKey = '80-100';
                else if (avg >= 75) bKey = '75-79';
                else if (avg >= 70) bKey = '70-74';
                else if (avg >= 65) bKey = '65-69';
                else if (avg >= 60) bKey = '60-64';
                else if (avg >= 50) bKey = '50-59';

                if (isM) brackets[bKey].m++; else brackets[bKey].f++;
                brackets[bKey].t++;
            } else {
                if (isM) abs_b++; else abs_g++;
            }
        });

        renderGradeDistributionPdf({ 
            year, term, className: cls?.name || 'Class Registry', 
            exp: { b: exp_b, g: exp_g, t: exp_b+exp_g },
            sat: { b: sat_b, g: sat_g, t: sat_b+sat_g },
            abs: { b: abs_b, g: abs_g, t: abs_b+abs_g },
            brackets 
        });
        closeModal('grade-distribution-report-modal');

    } catch (e) {
        console.error('[REPORT] Failed to generate grade distribution:', e);
        toast('Failed to generate report data.', 'error');
    }
};

window.renderGradeDistributionPdf = function(data) {
    const { year, term, className, exp, sat, abs, brackets } = data;
    const info = SCHOOL_INFO;

    const headerHtml = generateInstitutionalHeader(
        `REPORT ON SUCCESS, TERM ${term} / ${year}`, 
        "(Note: Detailed grade bracket summary for class teacher)"
    );

    const html = `
        <div style="width: 297mm; height: 210mm; padding: 10mm 15mm; background: white; font-family: 'Inter', sans-serif; box-sizing: border-box; color: #000; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between;">
            ${headerHtml}

            <table style="width: 100%; border-collapse: collapse; border: 2.5px solid #000;">
                <thead style="background: #f1f5f9; font-size: 0.85rem;">
                    <tr>
                        <th rowspan="2" style="border: 1px solid #000; padding: 10px;">LEVEL & CLASS</th>
                        <th colspan="3" style="border: 1px solid #000;">EXPECTED STUDENTS</th>
                        <th colspan="3" style="border: 1px solid #000;">SAT FOR EXAMS</th>
                        <th colspan="3" style="border: 1px solid #000;">ABSENTS</th>
                        <th colspan="3" style="border: 1px solid #000; background: #f0fdf4;">80-100</th>
                        <th colspan="3" style="border: 1px solid #000; background: #f0fdf4;">75-79</th>
                        <th colspan="3" style="border: 1px solid #000; background: #f0fdf4;">70-74</th>
                        <th colspan="3" style="border: 1px solid #000; background: #f0fdf4;">65-69</th>
                        <th colspan="3" style="border: 1px solid #000; background: #f8fafc;">60-64</th>
                        <th colspan="3" style="border: 1px solid #000; background: #f8fafc;">50-59</th>
                        <th colspan="3" style="border: 1px solid #000; background: #fee2e2;">0-49</th>
                    </tr>
                    <tr style="font-size: 0.7rem;">
                        <th style="border: 1px solid #000; width: 35px;">M</th><th style="border: 1px solid #000; width: 35px;">F</th><th style="border: 1px solid #000; width: 35px;">T</th>
                        <th style="border: 1px solid #000; width: 35px;">M</th><th style="border: 1px solid #000; width: 35px;">F</th><th style="border: 1px solid #000; width: 35px;">T</th>
                        <th style="border: 1px solid #000; width: 35px;">M</th><th style="border: 1px solid #000; width: 35px;">F</th><th style="border: 1px solid #000; width: 35px;">T</th>
                        <th style="border: 1px solid #000; width: 35px;">M</th><th style="border: 1px solid #000; width: 35px;">F</th><th style="border: 1px solid #000; width: 35px;">T</th>
                        <th style="border: 1px solid #000; width: 35px;">M</th><th style="border: 1px solid #000; width: 35px;">F</th><th style="border: 1px solid #000; width: 35px;">T</th>
                        <th style="border: 1px solid #000; width: 35px;">M</th><th style="border: 1px solid #000; width: 35px;">F</th><th style="border: 1px solid #000; width: 35px;">T</th>
                        <th style="border: 1px solid #000; width: 35px;">M</th><th style="border: 1px solid #000; width: 35px;">F</th><th style="border: 1px solid #000; width: 35px;">T</th>
                        <th style="border: 1px solid #000; width: 35px;">M</th><th style="border: 1px solid #000; width: 35px;">F</th><th style="border: 1px solid #000; width: 35px;">T</th>
                        <th style="border: 1px solid #000; width: 35px;">M</th><th style="border: 1px solid #000; width: 35px;">F</th><th style="border: 1px solid #000; width: 35px;">T</th>
                        <th style="border: 1px solid #000; width: 35px;">M</th><th style="border: 1px solid #000; width: 35px;">F</th><th style="border: 1px solid #000; width: 35px;">T</th>
                    </tr>
                </thead>
                <tbody style="font-size: 0.85rem;">
                    <tr style="height: 45px; text-align: center;">
                        <td style="border: 1px solid #000; padding: 5px; font-weight: 800;">${className}</td>
                        <td style="border: 1px solid #000;">${exp.b}</td><td style="border: 1px solid #000;">${exp.g}</td><td style="border: 1px solid #000; font-weight:800;">${exp.t}</td>
                        <td style="border: 1px solid #000;">${sat.b}</td><td style="border: 1px solid #000;">${sat.g}</td><td style="border: 1px solid #000; font-weight:800;">${sat.t}</td>
                        <td style="border: 1px solid #000;">${abs.b}</td><td style="border: 1px solid #000;">${abs.g}</td><td style="border: 1px solid #000; font-weight:800;">${abs.t}</td>
                        <td style="border: 1px solid #000;">${brackets['80-100'].m}</td><td style="border: 1px solid #000;">${brackets['80-100'].f}</td><td style="border: 1px solid #000; font-weight:800;">${brackets['80-100'].t}</td>
                        <td style="border: 1px solid #000;">${brackets['75-79'].m}</td><td style="border: 1px solid #000;">${brackets['75-79'].f}</td><td style="border: 1px solid #000; font-weight:800;">${brackets['75-79'].t}</td>
                        <td style="border: 1px solid #000;">${brackets['70-74'].m}</td><td style="border: 1px solid #000;">${brackets['70-74'].f}</td><td style="border: 1px solid #000; font-weight:800;">${brackets['70-74'].t}</td>
                        <td style="border: 1px solid #000;">${brackets['65-69'].m}</td><td style="border: 1px solid #000;">${brackets['65-69'].f}</td><td style="border: 1px solid #000; font-weight:800;">${brackets['65-69'].t}</td>
                        <td style="border: 1px solid #000;">${brackets['60-64'].m}</td><td style="border: 1px solid #000;">${brackets['60-64'].f}</td><td style="border: 1px solid #000; font-weight:800;">${brackets['60-64'].t}</td>
                        <td style="border: 1px solid #000;">${brackets['50-59'].m}</td><td style="border: 1px solid #000;">${brackets['50-59'].f}</td><td style="border: 1px solid #000; font-weight:800;">${brackets['50-59'].t}</td>
                        <td style="border: 1px solid #000;">${brackets['0-49'].m}</td><td style="border: 1px solid #000;">${brackets['0-49'].f}</td><td style="border: 1px solid #000; font-weight:800; background: #fee2e2; color: #991b1b;">${brackets['0-49'].t}</td>
                    </tr>
                </tbody>
            </table>

            <div style="margin-top: 50px; display: flex; justify-content: space-between; font-weight: 800; font-size: 0.9rem; gap: 40px; align-items: flex-end;">
                <div style="flex: 1;">
                   <div style="margin-bottom: 30px; font-size:0.75rem;">Done at <strong>${(info.district||'...').toUpperCase()}</strong> , on ${new Date().toLocaleDateString('en-GB')}</div>
                   <div style="border-top: 1.5px solid #000; padding-top: 5px; min-width: 250px; text-align:center;">
                      PREPARED BY CLASS TEACHER:<br>
                      ${MY_PROFILE?.signature ? `<img src="${MY_PROFILE.signature}" style="max-height:45px; display:block; margin:4px auto; mix-blend-mode:multiply;">` : '<div style="height:45px;"></div>'}
                      <span style="font-size: 1.1rem; font-weight: 900;">${(MY_PROFILE?.full_name || '...').toUpperCase()}</span>
                   </div>
                </div>
                <div style="flex: 1; text-align: center;">
                    <div style="border-top: 1.5px solid #000; padding-top: 5px; min-width: 250px; position: relative;">
                        <div style="font-weight: 900;">APPROVED BY HEADTEACHER</div>
                        <div style="height:55px; display:flex; align-items:center; justify-content:center; position:relative;">
                            ${SCHOOL_INFO.headteacher_sig ? `<img src="${SCHOOL_INFO.headteacher_sig}" style="max-height:50px; max-width:180px; object-fit:contain; mix-blend-mode:multiply; position:absolute; z-index:2;">` : ''}
                            ${SCHOOL_INFO.stamp ? `<img src="${SCHOOL_INFO.stamp}" style="width:75px; height:75px; opacity:0.8; mix-blend-mode:multiply; position:absolute; z-index:1; transform: translate(15px, -5px) rotate(-8deg);">` : ''}
                        </div>
                        <div style="font-weight:900; font-size:1.1rem; margin-top:5px;">${(SCHOOL_INFO.headteacher || '...').toUpperCase()}</div>
                    </div>
                </div>
            </div>

            <div style="margin-top: 50px; font-size: 0.75rem; font-style: italic; color: #475569; font-weight: 700;">
                NB: CHECK IF STUDENTS WHO SAT FOR EXAMS CORRESPOND TO THE DIFFERENT LEVELS OF PERFORMANCE.
            </div>
        </div>
    `;

    const pw = window.open('', '_blank');
    if (!pw) return toast('Pop-up blocked!', 'error');
    pw.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>GRADE DISTRIBUTION SUMMARY — ${SCHOOL_INFO.academic_year || '2025/2026'}</title>
            <style>
                @media print {
                    body { margin: 0; padding: 0 !important; background: white !important; }
                    .no-print { display: none !important; }
                    @page { size: A4 landscape; margin: 0; }
                }
                body { background: #1e293b; margin: 0; padding: 40px; display: flex; flex-direction: column; align-items: center; font-family: 'Inter', sans-serif; }
            </style>
        </head>
        <body>
            <div style="background: white; border-radius: 8px; box-shadow: 0 40px 80px rgba(0,0,0,0.5);">
                ${html}
            </div>
            <div style="position: fixed; top: 0; left: 0; right: 0; background: #0B0E14; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; z-index: 999;" class="no-print">
                 <h2 style="color: white; margin: 0; font-size: 1.1rem; font-weight: 800;">GRADE DISTRIBUTION PREVIEW</h2>
                 <button onclick="window.print()" style="padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 6px; font-weight: 800; cursor: pointer;">🖨️ EXPORT TO PDF</button>
            </div>
        </body>
        </html>
    `);
    pw.document.close();
};

// ============================================================
// SUBJECT SUCCESS REPORT (SUBJECT TEACHER SUMMARY)
// ============================================================

window.openSubjectSuccessReportModal = async function() {
    const assignments = await DB.getTeacherAssignments(MY_PROFILE?.id);
    const classesWhereIAmCT = assignments.filter(a => a.type === 'class').map(a => a.class_id);
    
    // Fetch all subjects to check for class jurisdiction
    const allSubjects = await DB.getSubjects();

    const uniqueSubs = [];
    const seenSubs = new Set();

    // 1. Add subjects explicitly assigned to the teacher
    assignments.forEach(a => {
        if (a.subject_id && !seenSubs.has(a.subject_id)) {
            seenSubs.add(a.subject_id);
            uniqueSubs.push({ id: a.subject_id, name: a.subjects?.name || 'Unknown Subject' });
        }
    });

    // 2. Add subjects from classes where the teacher is Class Teacher (Jurisdiction)
    allSubjects.forEach(s => {
        if (classesWhereIAmCT.includes(s.class_id) && !seenSubs.has(s.id)) {
            seenSubs.add(s.id);
            uniqueSubs.push({ id: s.id, name: s.name });
        }
    });
    
    if (uniqueSubs.length === 0) {
        return toast('Error: No subjects found for your profile or assigned classes.', 'error');
    }

    // Sort alphabetically for professional look
    uniqueSubs.sort((a,b) => a.name.localeCompare(b.name));

    const subSelect = el('ssr-subject');
    if (subSelect) {
        let options = uniqueSubs.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        if (uniqueSubs.length > 1) {
            options = `<option value="all">-- ALL SUBJECTS COMBINED --</option>` + options;
        }
        subSelect.innerHTML = options;
    }
    
    openModal('subject-success-report-modal');
};

window.generateSubjectSuccessReport = async function() {
    const year = el('ssr-year').value;
    const term = el('ssr-term').value;
    const subjectId = el('ssr-subject').value;
    
    if (!subjectId) return toast('Please select a subject.', 'error');

    toast('Analyzing subject performance...', 'info');
    
    try {
        const [allMarks, students, classes, subjects, assignments] = await Promise.all([
            DB.getMarks({ term, year }), 
            DB.getStudents(), 
            DB.getClasses(), 
            DB.getSubjects(),
            DB.getTeacherAssignments(MY_PROFILE?.id)
        ]);

        const classesWhereIAmCT = assignments.filter(a => a.type === 'class').map(a => a.class_id);
        const myExplicitSubjectIds = assignments.filter(a => a.subject_id).map(a => a.subject_id);

        const targetAssignments = assignments.filter(a => {
            if (subjectId === 'all') {
                return a.type === 'class' || a.subject_id;
            }
            return a.subject_id === subjectId;
        });

        const reportData = [];
        let grandTotals = { exp_b: 0, exp_g: 0, exp_t: 0, sat_b: 0, sat_g: 0, sat_t: 0, pass_b: 0, pass_g: 0, pass_t: 0, fail_b: 0, fail_g: 0, fail_t: 0 };

        // Process each jurisdiction
        const jurisdictions = [];
        if (subjectId === 'all') {
            // For "All Subjects", we check every subject in classes where teacher is CT, 
            // plus subjects where teacher is explicitly assigned.
            subjects.forEach(s => {
                if (classesWhereIAmCT.includes(s.class_id) || myExplicitSubjectIds.includes(s.id)) {
                    jurisdictions.push({ subject_id: s.id, class_id: s.class_id });
                }
            });
        } else {
            // Specific subject: either explicitly assigned or in CT class
            const sub = subjects.find(s => s.id === subjectId);
            if (sub) {
                jurisdictions.push({ subject_id: sub.id, class_id: sub.class_id });
            }
        }

        for (const jur of jurisdictions) {
            const sid = jur.subject_id;
            const cid = jur.class_id;
            const sub = subjects.find(s => s.id === sid);
            const cls = classes.find(c => c.id === cid);
            
            const classStudents = students.filter(s => s.class_id === cid);
            const classMarks = allMarks.filter(m => m.class_id === cid && m.subject_id === sid && String(m.term) === String(term) && m.is_approved);
            
            let exp_b = 0, exp_g = 0, sat_b = 0, sat_g = 0, pass_b = 0, pass_g = 0, fail_b = 0, fail_g = 0;

            classStudents.forEach(s => {
                const isM = (s.gender === 'M' || s.gender === 'Boy' || s.gender === 'male');
                if (isM) exp_b++; else exp_g++;
                
                const sMarks = classMarks.filter(m => m.student_id === s.id);
                if (sMarks.length > 0) {
                    if (isM) sat_b++; else sat_g++;
                    
                    let totalScore = 0;
                    let totalMax = 0;
                    sMarks.forEach(m => {
                        totalScore += (m.score === -1 ? 0 : Number(m.score));
                        totalMax += Number(m.max_score || 10);
                    });
                    const avg = totalMax > 0 ? (totalScore / totalMax * 100) : 0;
                    
                    if (avg >= 50) {
                        if (isM) pass_b++; else pass_g++;
                    } else {
                        if (isM) fail_b++; else fail_g++;
                    }
                }
            });

            const exp_t = exp_b + exp_g;
            const sat_t = sat_b + sat_g;
            const pass_t = pass_b + pass_g;
            const fail_t = fail_b + fail_g;
            const pass_p = sat_t > 0 ? ((pass_t / sat_t) * 100).toFixed(2) : '0.00';
            const fail_p = sat_t > 0 ? ((fail_t / sat_t) * 100).toFixed(2) : '0.00';

            reportData.push({
                name: cls?.name || 'Class',
                subject: sub?.name || 'Subject',
                exp_b, exp_g, exp_t,
                sat_b, sat_g, sat_t,
                pass_b, pass_g, pass_t, pass_p,
                fail_b, fail_g, fail_t, fail_p
            });

            grandTotals.exp_b += exp_b; grandTotals.exp_g += exp_g; grandTotals.exp_t += exp_t;
            grandTotals.sat_b += sat_b; grandTotals.sat_g += sat_g; grandTotals.sat_t += sat_t;
            grandTotals.pass_b += pass_b; grandTotals.pass_g += pass_g; grandTotals.pass_t += pass_t;
            grandTotals.fail_b += fail_b; grandTotals.fail_g += fail_g; grandTotals.fail_t += fail_t;
        }

        const grand_pass_p = grandTotals.sat_t > 0 ? ((grandTotals.pass_t / grandTotals.sat_t) * 100).toFixed(2) : '0.00';
        const grand_fail_p = grandTotals.sat_t > 0 ? ((grandTotals.fail_t / grandTotals.sat_t) * 100).toFixed(2) : '0.00';
        
        renderSubjectSuccessReportPdf({ 
            year, term, 
            subject: subjectId === 'all' ? 'All Subjects Combined' : (subjects.find(s => s.id === subjectId)?.name || 'Subject'), 
            reportData, grandTotals, grand_pass_p, grand_fail_p 
        });
        closeModal('subject-success-report-modal');

    } catch (e) {
        console.error('[REPORT] Failed to generate subject success report:', e);
        toast('Failed to generate report data.', 'error');
    }
};

// ============================================================
// PROCLAMATION (CLASS TEACHER EXECUTIVE SUMMARY)
// ============================================================

window.openTeacherProclamationModal = async function() {
    const assignments = await DB.getTeacherAssignments(MY_PROFILE?.id);
    const classAssignment = assignments.find(a => a.type === 'class');
    
    if (!classAssignment) {
        return toast('⚠️ Proclamation access is restricted to Class Teachers.', 'warning');
    }

    const classId = classAssignment.class_id;
    const className = classAssignment.classes?.name || 'Class';
    
    // Set Target Class
    const targetInput = el('proc-target-class');
    const targetDisplay = el('proc-target-class-display');
    if (targetInput) targetInput.value = classId;
    if (targetDisplay) targetDisplay.value = className.toUpperCase();

    // Fetch Required Data
    const [allMarks, dbAssessments, allSubs] = await Promise.all([
        DB.getMarks(), DB.getAssessments(), DB.getSubjects()
    ]);

    // Find subjects present in this class's marks
    const classMarks = allMarks.filter(m => m.class_id === classId);
    const subjectIdsInMarks = new Set(classMarks.map(m => m.subject_id));
    
    const subItems = allSubs
        .filter(s => subjectIdsInMarks.has(s.id))
        .map(s => ({ id: s.id, abbr: s.abbr || s.name.substring(0,5), checked: true }));

    // Standard Assessment Markers
    const STD_ASSESS = [
        { key: 'EU',  label: 'End of Unit' },
        { key: 'ET',  label: 'End of Term' },
        { key: 'MT',  label: 'Mid-Term Test' },
        { key: 'MID', label: 'MID Test' },
        { key: 'WK',  label: 'Weekly Test' },
    ];
    
    const assessItems = STD_ASSESS.map(std => {
        const match = dbAssessments.find(a => 
            (a.abbr || '').toUpperCase() === std.key || 
            (a.name || '').toUpperCase().startsWith(std.label.split(' ')[0].toUpperCase())
        );
        return { 
            id: match ? match.id : 'std_' + std.key, 
            abbr: std.key, 
            label: std.label, 
            checked: (std.key === 'EU' || std.key === 'ET') 
        };
    });

    const pillStyle = (on, color) => `display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:999px;margin:4px;cursor:pointer;font-size:0.75rem;font-weight:800;user-select:none;transition:all 0.15s;border:2.5px solid ${on ? color : '#cbd5e1'};background:${on ? color : '#fff'};color:${on ? '#fff' : '#64748b'};`;

    el('proc-subject-checklist').innerHTML = subItems.map(s => `
        <label style="${pillStyle(s.checked, '#0f172a')}" class="rc-sub-pill" onclick="var cb=this.querySelector('input'),v=cb.checked;this.style.background=v?'#0f172a':'#fff';this.style.borderColor=v?'#0f172a':'#cbd5e1';this.style.color=v?'#fff':'#64748b';">
            <input type="checkbox" ${s.checked ? 'checked' : ''} value="${s.id}" class="proc-sub-cb" style="display:none">
            ${s.abbr}
        </label>`).join('');

    el('proc-assess-checklist').innerHTML = assessItems.map(a => `
        <label style="${pillStyle(a.checked, '#1d4ed8')}" class="rc-ass-pill" title="${a.label}" onclick="var cb=this.querySelector('input'),v=cb.checked;this.style.background=v?'#1d4ed8':'#fff';this.style.borderColor=v?'#1d4ed8':'#cbd5e1';this.style.color=v?'#fff':'#64748b';">
            <input type="checkbox" ${a.checked ? 'checked' : ''} value="${a.id}" class="proc-ass-cb" style="display:none">
            ${a.abbr}
        </label>`).join('');

    openModal('generate-proclamation-modal');
};

window.executeTeacherProclamation = function() {
    const classId = el('proc-target-class').value;
    const selectedSubs = Array.from(document.querySelectorAll('.proc-sub-cb:checked')).map(cb => cb.value);
    const selectedAsses = Array.from(document.querySelectorAll('.proc-ass-cb:checked'))
        .map(cb => cb.value)
        .filter(v => !String(v).startsWith('std_'));

    if (selectedSubs.length === 0) return toast('⚠️ Please select at least one curriculum subject.', 'warning');
    if (selectedAsses.length === 0) return toast('⚠️ Please select at least one assessment marker.', 'warning');

    closeModal('generate-proclamation-modal');
    window.exportClassProclamation(classId, selectedSubs, selectedAsses);
};

window.exportClassProclamation = async function(classId, targetSubs = [], targetAsses = []) {
    toast('Generating Executive Proclamation...', 'info');
    
    try {
        const [marks, stds, subs, classes, assignments, teachers] = await Promise.all([
            DB.getMarks(), DB.getStudents(), DB.getSubjects(), DB.getClasses(), DB.getTeacherAssignments(), DB.getTeachers()
        ]);

        const cls = classes.find(c => c.id === classId);
        const term = SCHOOL_INFO.active_term || '2';
        const year = SCHOOL_INFO.academic_year || '2025/2026';
        const info = SCHOOL_INFO;

        // Context-Aware Filtering
        const classStudents = stds.filter(s => s.class_id === classId);
        const classMarks = marks.filter(m => 
            m.class_id === classId && 
            m.is_approved &&
            String(m.term) === String(term) &&
            (targetSubs.length === 0 || targetSubs.includes(m.subject_id)) &&
            (targetAsses.length === 0 || targetAsses.includes(m.assessment_id))
        );
        
        const classSubjects = subs.filter(s => targetSubs.length === 0 || targetSubs.includes(s.id));
        if (!classStudents.length) return toast('No student records found for this cohort.', 'warning');

        const subjectMeta = classSubjects.map(s => {
            let max = 0;
            targetAsses.forEach(aid => {
                max += (['ART','PES','SRS'].includes(s.abbr) ? 20 : 40);
            });
            return { ...s, totalMax: max };
        }).filter(s => s.totalMax > 0);

        const stStats = classStudents.map(student => {
            let studentTotalScore = 0;
            let studentTotalMax = 0;
            subjectMeta.forEach(meta => {
                let subScore = 0;
                const allowedMax = ['ART','PES','SRS'].includes(meta.abbr) ? 20 : 40;
                targetAsses.forEach(aid => {
                    const mk = classMarks.find(m => m.student_id === student.id && m.subject_id === meta.id && m.assessment_id === aid);
                    if (mk) {
                        const rawScore = mk.score === -1 ? 0 : Number(mk.score);
                        subScore += Math.min(rawScore, allowedMax);
                    }
                });
                studentTotalScore += subScore;
                studentTotalMax += meta.totalMax;
            });
            const perc = studentTotalMax > 0 ? (studentTotalScore / studentTotalMax * 100) : 0;
            return { id: student.id, total: studentTotalScore, totalMax: studentTotalMax, percentage: perc };
        }).sort((a,b) => b.percentage - a.percentage);

        const subjectHeaders = subjectMeta.map(s => `
            <th style="border: 1px solid #000; width: 35px; height: 110px; padding: 0; vertical-align: bottom; position: relative; background:#f8fafc;">
               <div style="writing-mode: vertical-rl; transform: rotate(180deg); margin: 0 auto; padding-top: 5px; font-weight: 900; font-size: 0.65rem; text-transform: uppercase; white-space:nowrap;">
                  ${(s.abbr || s.name).substring(0, 15)} / ${s.totalMax}
               </div>
            </th>
        `).join('');

        const rowsHtml = classStudents.sort((a,b) => {
            const statsA = stStats.find(x => x.id === a.id);
            const statsB = stStats.find(x => x.id === b.id);
            return statsB.percentage - statsA.percentage;
        }).map((s, i) => {
            const stats = stStats.find(x => x.id === s.id);
            const pos = stStats.findIndex(x => x.id === s.id) + 1;
            const perc = stats.percentage.toFixed(1);
            
            const markCells = subjectMeta.map(meta => {
                let subScore = 0;
                const allowedMaxAssessment = ['ART','PES','SRS'].includes(meta.abbr) ? 20 : 40;
                targetAsses.forEach(aid => {
                    const mk = classMarks.find(m => m.student_id === s.id && m.subject_id === meta.id && m.assessment_id === aid);
                    if (mk) {
                        const rawScore = mk.score === -1 ? 0 : Number(mk.score);
                        subScore += Math.min(rawScore, allowedMaxAssessment);
                    }
                });
                const isFail = subScore < (meta.totalMax / 2);
                return `<td style="border: 1px solid #000; text-align: center; font-weight: 900; font-size: 0.8rem; color: ${isFail ? '#ef4444' : '#000'}; ${isFail ? 'text-decoration:underline;' : ''}">${subScore}</td>`;
            }).join('');

            const comment = perc >= 80 ? 'Excellent.' : perc >= 60 ? 'Good.' : perc >= 50 ? 'Fair.' : 'Poor.';

            return `
                <tr style="height:28px;">
                    <td style="border:1px solid #000; text-align:center; font-weight:800; font-size:0.75rem;">${i+1}</td>
                    <td style="border:1px solid #000; padding:2px 8px; font-weight:900; font-size:0.75rem; white-space:nowrap;">${(s.last_name||'').toUpperCase()} ${(s.first_name||'').toUpperCase()}</td>
                    ${markCells}
                    <td style="border:1px solid #000; text-align:center; font-weight:1000; font-size:0.8rem; background:#f8fafc;">${stats.total.toFixed(0)}</td>
                    <td style="border:1px solid #000; text-align:center; font-weight:1000; font-size:0.8rem; color:${perc < 50 ? '#ef4444' : '#000'};">${perc}%</td>
                    <td style="border:1px solid #000; text-align:center; font-weight:1000; font-size:0.8rem;">${pos}</td>
                    <td style="border:1px solid #000; padding:2px; font-size:0.65rem; text-align:center;">${comment}</td>
                </tr>
            `;
        }).join('');

        const assessedLine = targetAsses.map(aid => {
            const ass = dbAssessments.find(a => a.id === aid);
            return ass ? (ass.abbr || ass.name) : aid;
        }).join(' + ');

        const instHeader = generateInstitutionalHeader(`${cls.name.toUpperCase()} • PROCLAMATION`, `TERM ${term} — ${year}`, assessedLine);

        const html = `
            <div id="proclamation-document" style="width: 277mm; min-height: 190mm; padding: 8mm; background: white; font-family: 'Arial', sans-serif; box-sizing: border-box; color: #000; margin: 0 auto;">
                ${instHeader}

                <div style="display:flex; justify-content:space-between; border-top:2px solid #000; border-bottom:1px solid #cbd5e1; padding:5px 2px; margin-bottom:8px; font-size:8pt; font-weight:800;">
                    <div>Class Teacher: <strong>${(MY_PROFILE?.full_name || '...').toUpperCase()}</strong></div>
                    <div style="text-align:right;">Academic Year: <strong>${year}</strong> | Term: <strong>${term}</strong></div>
                </div>

                <table style="width:100%; border-collapse:collapse; border:2.5px solid #000; margin-bottom:20px;">
                    <thead style="background:#f1f5f9;">
                        <tr>
                            <th style="border:1px solid #000; width:30px; font-size:0.7rem;">NO</th>
                            <th style="border:1px solid #000; text-align:left; padding-left:10px; font-size:0.7rem;">STUDENT NAME (ALPHABETICAL ORDER)</th>
                            ${subjectHeaders}
                            <th style="border:1px solid #000; width:50px; font-size:0.7rem;">TOTAL</th>
                            <th style="border:1px solid #000; width:55px; font-size:0.7rem;">%</th>
                            <th style="border:1px solid #000; width:40px; font-size:0.7rem;">POS</th>
                            <th style="border:1px solid #000; width:70px; font-size:0.7rem;">COMMENT</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>

                <div style="margin-top:30px; display:flex; justify-content:space-around; font-size:0.8rem; font-weight:900;">
                    <div style="text-align:center;">
                        <div style="margin-bottom:40px;">Done at ${info.district || '...'}, on ${new Date().toLocaleDateString('en-GB')}</div>
                        <div style="border-top:1.5px solid #000; padding-top:5px; min-width:180px;">
                            CLASS TEACHER SIGNATURE<br>
                            ${MY_PROFILE?.signature ? `<img src="${MY_PROFILE.signature}" style="max-height:45px; display:block; margin:4px auto; mix-blend-mode:multiply;">` : ''}
                            <strong>${(MY_PROFILE?.full_name || '...').toUpperCase()}</strong>
                        </div>
                    </div>
                    <div style="text-align:center; position:relative;">
                        <div style="height:40px;"></div>
                        <div style="border-top:1.5px solid #000; padding-top:5px; min-width:180px; position:relative;">
                            HEAD TEACHER & STAMP<br>
                            ${SCHOOL_INFO.headteacher_sig ? `<img src="${SCHOOL_INFO.headteacher_sig}" style="max-height:50px; max-width:180px; mix-blend-mode:multiply; position:absolute; top:-40px; left:50%; transform:translateX(-50%);">` : ''}
                            ${SCHOOL_INFO.stamp ? `<img src="${SCHOOL_INFO.stamp}" style="width:75px; height:75px; mix-blend-mode:multiply; position:absolute; top:-60px; right:0; opacity:0.7; transform:rotate(-5deg);">` : ''}
                            <strong>${(info.headteacher || '...').toUpperCase()}</strong>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const pw = window.open('', '_blank', 'width=1200,height=800');
        pw.document.write(`<html><head><title>CLASS PROCLAMATION</title><style>@media print { body { margin:0; padding:0; background:white; } .no-print { display:none; } @page { size: A4 landscape; margin: 0; } } body { background:#1e293b; padding:40px; display:flex; flex-direction:column; align-items:center; }</style></head><body><div style="position:fixed; top:0; left:0; right:0; background:#0B0E14; padding:15px 30px; display:flex; justify-content:space-between; align-items:center; z-index:9999;" class="no-print"><h2 style="color:white; margin:0; font-size:1.1rem; font-weight:800;">PROCLAMATION PREVIEW</h2><button onclick="window.print()" style="padding:10px 20px; background:#10b981; color:white; border:none; border-radius:6px; font-weight:800; cursor:pointer;">🖨️ EXPORT TO PDF</button></div><div style="background:white; border-radius:8px; box-shadow:0 40px 80px rgba(0,0,0,0.5);">${html}</div></body></html>`);
        pw.document.close();

    } catch (err) {
        console.error('[PROCLAMATION] Export Error:', err);
        toast('Failed to synthesize proclamation.', 'error');
    }
};


window.renderSubjectSuccessReportPdf = function(data) {
    const { year, term, subject, reportData, grandTotals, grand_pass_p, grand_fail_p } = data;
    const info = SCHOOL_INFO;
    const finalDate = new Date().toLocaleDateString('en-GB');

    const tableRows = reportData.map((r, i) => `
        <tr style="height: 35px; text-align: center; font-size: 0.85rem;">
            <td style="border: 1px solid #000;">${i+1}</td>
            <td style="border: 1px solid #000; text-align: left; padding-left: 8px; font-weight: bold;">${r.name}</td>
            <td style="border: 1px solid #000;">${r.subject.toUpperCase()}</td>
            <td style="border: 1px solid #000;">${r.exp_b}</td>
            <td style="border: 1px solid #000;">${r.exp_g}</td>
            <td style="border: 1px solid #000; font-weight: bold; background: #f8fafc;">${r.exp_t}</td>
            <td style="border: 1px solid #000;">${r.sat_b}</td>
            <td style="border: 1px solid #000;">${r.sat_g}</td>
            <td style="border: 1px solid #000; font-weight: bold; background: #f8fafc;">${r.sat_t}</td>
            <td style="border: 1px solid #000;">${r.pass_b}</td>
            <td style="border: 1px solid #000;">${r.pass_g}</td>
            <td style="border: 1px solid #000; font-weight: bold;">${r.pass_t}</td>
            <td style="border: 1px solid #000; font-weight: bold; background: #f0fdf4;">${r.pass_p}%</td>
            <td style="border: 1px solid #000;">${r.fail_b}</td>
            <td style="border: 1px solid #000;">${r.fail_g}</td>
            <td style="border: 1px solid #000; font-weight: bold;">${r.fail_t}</td>
            <td style="border: 1px solid #000; font-weight: bold; background: #fee2e2; text-decoration: underline;">${r.fail_p}%</td>
        </tr>
    `).join('');

    const headerHtml = generateInstitutionalHeader(
        `${term == 1 ? 'FIRST' : term == 2 ? 'SECOND' : 'THIRD'} TERM REPORT ON SUCCESS IN EXAMS ${year}`,
        "(To be filled by the Subject Teacher)"
    );

    const html = `
        <div style="width: 297mm; height: 210mm; padding: 10mm 15mm; background: white; font-family: 'Inter', sans-serif; box-sizing: border-box; color: #000; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between;">
            ${headerHtml}

            <table style="width: 100%; border-collapse: collapse; border: 2.5px solid #000; margin-bottom: 30px;">
                <thead style="background: #f1f5f9; text-align: center; font-size: 0.8rem;">
                    <tr>
                        <th rowspan="2" style="border: 1px solid #000; width: 40px;">S/N</th>
                        <th rowspan="2" style="border: 1px solid #000; width: 100px;">LEVEL / CLASS</th>
                        <th rowspan="2" style="border: 1px solid #000;">SUBJECT</th>
                        <th colspan="3" style="border: 1px solid #000;">EXPECTED STUDENTS</th>
                        <th colspan="3" style="border: 1px solid #000;">SAT FOR EXAMS</th>
                        <th colspan="4" style="border: 1px solid #000; background: #f0fdf4;">SUCCESS (50-100%)</th>
                        <th colspan="4" style="border: 1px solid #000; background: #fff1f2;">FAILURE (0-49%)</th>
                    </tr>
                    <tr>
                        <th style="border: 1px solid #000; width: 40px;">B</th>
                        <th style="border: 1px solid #000; width: 40px;">G</th>
                        <th style="border: 1px solid #000; width: 50px;">T</th>
                        <th style="border: 1px solid #000; width: 40px;">B</th>
                        <th style="border: 1px solid #000; width: 40px;">G</th>
                        <th style="border: 1px solid #000; width: 50px;">T</th>
                        <th style="border: 1px solid #000; width: 40px;">B</th>
                        <th style="border: 1px solid #000; width: 40px;">G</th>
                        <th style="border: 1px solid #000; width: 50px;">T</th>
                        <th style="border: 1px solid #000; width: 60px;">%</th>
                        <th style="border: 1px solid #000; width: 40px;">B</th>
                        <th style="border: 1px solid #000; width: 40px;">G</th>
                        <th style="border: 1px solid #000; width: 50px;">T</th>
                        <th style="border: 1px solid #000; width: 60px;">%</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                    <tr style="height: 40px; text-align: center; font-weight: 900; background: #f8fafc;">
                        <td colspan="3" style="border: 1px solid #000;">GRAND TOTAL</td>
                        <td style="border: 1px solid #000;">${grandTotals.exp_b}</td>
                        <td style="border: 1px solid #000;">${grandTotals.exp_g}</td>
                        <td style="border: 1px solid #000;">${grandTotals.exp_t}</td>
                        <td style="border: 1px solid #000;">${grandTotals.sat_b}</td>
                        <td style="border: 1px solid #000;">${grandTotals.sat_g}</td>
                        <td style="border: 1px solid #000;">${grandTotals.sat_t}</td>
                        <td style="border: 1px solid #000;">${grandTotals.pass_b}</td>
                        <td style="border: 1px solid #000;">${grandTotals.pass_g}</td>
                        <td style="border: 1px solid #000;">${grandTotals.pass_t}</td>
                        <td style="border: 1px solid #000; background: #dcfce7;">${grand_pass_p}%</td>
                        <td style="border: 1px solid #000;">${grandTotals.fail_b}</td>
                        <td style="border: 1px solid #000;">${grandTotals.fail_g}</td>
                        <td style="border: 1px solid #000;">${grandTotals.fail_t}</td>
                        <td style="border: 1px solid #000; background: #fee2e2;">${grand_fail_p}%</td>
                    </tr>
                </tbody>
            </table>

            <div style="margin-top: 50px; display: flex; justify-content: space-between;">
                <div style="width: 400px; font-weight: 850;">
                    <div style="margin-bottom: 20px;">TEACHER'S NAMES: <span style="border-bottom: 1.5px solid #000; padding: 0 10px;">${(MY_PROFILE?.full_name || '...').toUpperCase()}</span></div>
                    <div style="display: flex; align-items: flex-end;">SIGNATURE: 
                        ${MY_PROFILE?.signature 
                            ? `<img src="${MY_PROFILE.signature}" style="max-height:45px; margin-left:10px; mix-blend-mode:multiply;">` 
                            : `<span style="border-bottom: 1.5px solid #000; width: 250px; display: inline-block; height: 1.2rem;"></span>`}
                    </div>
                </div>
            </div>
        </div>
    `;

    const pw = window.open('', '_blank');
    if (!pw) return toast('Pop-up blocked!', 'error');
    
    pw.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>SUBJECT SUCCESS REPORT - ${subject}</title>
            <style>
                @media print {
                    body { margin: 0; padding: 0 !important; background: white !important; }
                    .no-print { display: none !important; }
                    @page { size: A4 landscape; margin: 0; }
                }
                body { background: #334155; margin: 0; padding: 40px; display: flex; flex-direction: column; align-items: center; font-family: 'Inter', sans-serif; gap: 20px; }
            </style>
        </head>
        <body>
            <div style="background: white; border-radius: 8px; box-shadow: 0 40px 80px rgba(0,0,0,0.5);">
                ${html}
            </div>
            <div style="position: fixed; top: 0; left: 0; right: 0; background: #0B0E14; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; z-index: 999;" class="no-print">
                 <h2 style="color: white; margin: 0; font-size: 1.1rem; font-weight: 800;">SUBJECT SUCCESS PREVIEW: ${subject.toUpperCase()}</h2>
                 <div style="display:flex; gap:10px;">
                    <button onclick="window.print()" style="padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 6px; font-weight: 800; cursor: pointer;">🖨️ EXPORT TO PDF</button>
                    <button onclick="window.close()" style="padding: 10px 20px; background: #ef4444; color: white; border: none; border-radius: 6px; font-weight: 800; cursor: pointer;">CLOSE</button>
                 </div>
            </div>
        </body>
        </html>
    `);
    pw.document.close();
};

// ============================================================
// STUDENT PASS RATE REPORT (PROCLAMATION SUMMARY)
// ============================================================

window.openPassRateReportModal = async function() {
    const assignments = await DB.getTeacherAssignments(MY_PROFILE?.id);
    const classAssignment = assignments.find(a => a.type === 'class');
    
    if (!classAssignment) {
        return toast('Error: You are not assigned as a primary Class Teacher to any class.', 'error');
    }

    const cls = classAssignment.classes;
    if (el('pr-class-display')) el('pr-class-display').value = cls?.name || 'Assigned Class';
    if (el('pr-class')) el('pr-class').value = classAssignment.class_id;
    
    openModal('pass-rate-report-modal');
};

window.generatePassRateReport = async function() {
    const year = el('pr-year').value;
    const term = el('pr-term').value;
    const classId = el('pr-class').value;
    
    if (!classId) return toast('No class context identified.', 'error');

    toast('Analyzing class performance data...', 'info');
    
    try {
        const [allMarks, students, classes] = await Promise.all([
            DB.getMarks({ classId, term, year }), 
            DB.getStudents(classId), 
            DB.getClasses()
        ]);

        const selSubIds = getSelectedReportSubjectIds();
        const selAssessIds = getSelectedReportAssessIds();

        const cls = classes.find(c => c.id === classId);
        const classStudents = students.filter(s => s.class_id === classId);
        let classMarks = allMarks.filter(m => m.class_id === classId && String(m.term) === String(term) && m.is_approved);

        if (selSubIds.length > 0) {
            classMarks = classMarks.filter(m => selSubIds.includes(m.subject_id));
        }
        if (selAssessIds.length > 0) {
            classMarks = classMarks.filter(m => selAssessIds.includes(m.assessment_id));
        }
        
        // Calculate Statistics
        const reportData = [];
        let sat_b = 0, sat_g = 0;
        let pass_b = 0, pass_g = 0;
        let fail_b = 0, fail_g = 0;

        classStudents.forEach(s => {
            const sMarks = classMarks.filter(m => m.student_id === s.id);
            if (sMarks.length > 0) {
                if (s.gender === 'M' || s.gender === 'Boy') sat_b++; else sat_g++;
                
                let totalScore = 0;
                let totalMax = 0;
                sMarks.forEach(m => {
                    totalScore += (m.score === -1 ? 0 : Number(m.score));
                    totalMax += Number(m.max_score || 10);
                });
                const avg = totalMax > 0 ? (totalScore / totalMax * 100) : 0;
                
                if (avg >= 50) {
                    if (s.gender === 'M' || s.gender === 'Boy') pass_b++; else pass_g++;
                } else {
                    if (s.gender === 'M' || s.gender === 'Boy') fail_b++; else fail_g++;
                }
            }
        });

        const sat_t = sat_b + sat_g;
        const pass_t = pass_b + pass_g;
        const fail_t = fail_b + fail_g;
        const pass_p = sat_t > 0 ? ((pass_t / sat_t) * 100).toFixed(2) : '0.00';
        const fail_p = sat_t > 0 ? ((fail_t / sat_t) * 100).toFixed(2) : '0.00';

        reportData.push({
            name: cls?.name || 'Class Archive',
            sat_b, sat_g, sat_t,
            pass_b, pass_g, pass_t, pass_p,
            fail_b, fail_g, fail_t, fail_p
        });

        const grandTotals = { sat_b, sat_g, sat_t, pass_b, pass_g, pass_t, fail_b, fail_g, fail_t };
        
        renderPassRateReportPdf({ year, term, reportData, grandTotals, grand_pass_p: pass_p, grand_fail_p: fail_p });
        closeModal('pass-rate-report-modal');

    } catch (e) {
        console.error('[REPORT] Failed to generate class pass rate report:', e);
        toast('Failed to generate report data.', 'error');
    }
};

window.renderPassRateReportPdf = function(data) {
    const { year, term, reportData, grandTotals, grand_pass_p, grand_fail_p } = data;
    const info = SCHOOL_INFO;
    const finalDate = info.done_date || new Date().toLocaleDateString('en-GB');

    const tableRows = reportData.map((r, i) => `
        <tr style="height: 35px; text-align: center;">
            <td style="border: 1px solid #000; font-weight: bold;">${i+1}</td>
            <td style="border: 1px solid #000; text-align: left; padding-left: 10px; font-weight: bold;">${r.name}</td>
            <td style="border: 1px solid #000;">${r.sat_b}</td>
            <td style="border: 1px solid #000;">${r.sat_g}</td>
            <td style="border: 1px solid #000; font-weight: bold;">${r.sat_t}</td>
            <td style="border: 1px solid #000;">${r.pass_b}</td>
            <td style="border: 1px solid #000;">${r.pass_g}</td>
            <td style="border: 1px solid #000; font-weight: bold;">${r.pass_t}</td>
            <td style="border: 1px solid #000; font-weight: bold; background: #f1f5f9;">${r.pass_p}%</td>
            <td style="border: 1px solid #000;">${r.fail_b}</td>
            <td style="border: 1px solid #000;">${r.fail_g}</td>
            <td style="border: 1px solid #000; font-weight: bold;">${r.fail_t}</td>
            <td style="border: 1px solid #000; font-weight: bold; background: #fee2e2; text-decoration: underline;">${r.fail_p}%</td>
        </tr>
    `).join('');

    const headerHtml = generateInstitutionalHeader(
        `STUDENT PASS RATE REPORT – TERM ${term} – ${year}`,
        "(Institutional Performance Proclamation)"
    );

    const html = `
        <div style="width: 297mm; height: 210mm; padding: 10mm 15mm; background: white; font-family: 'Inter', sans-serif; box-sizing: border-box; color: #000; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between;">
            ${headerHtml}

            <div style="margin-bottom: 20px; font-weight: 900; line-height: 1.8; font-size: 0.95rem;">
                <div>ACADEMIC YEAR: ${year || SCHOOL_INFO.academic_year || '2025/2026'}</div>
                <div>TERM: ${term || SCHOOL_INFO.active_term || '2'}</div>
            </div>

            <table style="width: 100%; border-collapse: collapse; border: 2.5px solid #000; margin-bottom: 40px; font-size: 0.9rem;">
                <thead style="background: #f8fafc; text-align: center;">
                    <tr>
                        <th rowspan="2" style="border: 1px solid #000; width: 45px;">NO</th>
                        <th rowspan="2" style="border: 1px solid #000;">CLASS</th>
                        <th colspan="3" style="border: 1px solid #000; background: #eef2ff;">SAT FOR EXAMS</th>
                        <th colspan="4" style="border: 1px solid #000; background: #f0fdf4;">PASSED (50-100%)</th>
                        <th colspan="4" style="border: 1px solid #000; background: #fff1f2;">FAILED (0-49%)</th>
                    </tr>
                    <tr>
                        <th style="border: 1px solid #000; width: 65px;">BOYS</th>
                        <th style="border: 1px solid #000; width: 65px;">GIRLS</th>
                        <th style="border: 1px solid #000; width: 75px;">TOTAL</th>
                        <th style="border: 1px solid #000; width: 65px;">BOYS</th>
                        <th style="border: 1px solid #000; width: 65px;">GIRLS</th>
                        <th style="border: 1px solid #000; width: 75px;">TOTAL</th>
                        <th style="border: 1px solid #000; width: 85px;">%</th>
                        <th style="border: 1px solid #000; width: 65px;">BOYS</th>
                        <th style="border: 1px solid #000; width: 65px;">GIRLS</th>
                        <th style="border: 1px solid #000; width: 75px;">TOTAL</th>
                        <th style="border: 1px solid #000; width: 85px;">%</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>

            <div style="margin-top: 50px; display: flex; justify-content: space-around; font-weight: 850; font-size: 0.9rem; align-items: flex-end;">
                <div style="flex: 1; text-align: center;">
                    <div style="margin-bottom: 25px; font-size: 0.7rem; font-weight: 700;">Done at <strong>${(info.district || '...').toUpperCase()}</strong> , on ${new Date().toLocaleDateString('en-GB')}</div>
                    <div style="border-top: 1.5px solid #000; padding-top: 5px; display: inline-block; min-width: 200px;">
                        PREPARED BY:<br>
                        ${MY_PROFILE?.signature ? `<img src="${MY_PROFILE.signature}" style="max-height:45px; display:block; margin:4px auto; mix-blend-mode:multiply;">` : '<div style="height:45px;"></div>'}
                        <strong>${(MY_PROFILE?.full_name || 'Class Teacher').toUpperCase()}</strong>
                    </div>
                </div>
                <div style="flex: 1; text-align: center;">
                    <div style="border-top: 1.5px solid #000; padding-top: 5px; display: inline-block; min-width: 200px; position: relative;">
                        <div style="font-weight: 900;">APPROVED BY:</div>
                        <div style="height:55px; display:flex; align-items:center; justify-content:center; position:relative;">
                            ${SCHOOL_INFO.headteacher_sig ? `<img src="${SCHOOL_INFO.headteacher_sig}" style="max-height:50px; max-width:180px; object-fit:contain; mix-blend-mode:multiply; position:absolute; z-index:2;">` : ''}
                            ${SCHOOL_INFO.stamp ? `<img src="${SCHOOL_INFO.stamp}" style="width:75px; height:75px; opacity:0.8; mix-blend-mode:multiply; position:absolute; z-index:1; transform: translate(10px, -5px) rotate(-8deg);">` : ''}
                        </div>
                        <strong>${(info.headteacher || 'Head Teacher').toUpperCase()}</strong>
                    </div>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 100px; padding-top: 2rem; border-top: 1px solid #e2e8f0;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.75rem; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">
                    <i data-lucide="shield-check" style="width: 14px; height: 14px; color: #10b981;"></i>
                    Institutional Integrity Node • MINEDUC Phase 2.5
                </div>
                <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 700; margin-top: 4px;">
                    SECURE BLOCKCHAIN VERIFICATION ENABLED • © 2026 MMS ARCHIVE
                </div>
            </div>
        </div>
    `;

    const pw = window.open('', '_blank');
    if (!pw) return toast('Pop-up blocked!', 'error');
    
    pw.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>STUDENT PASS RATE REPORT CARD</title>
            <style>
                @media print {
                    body { margin: 0; padding: 0 !important; background: white !important; }
                    .no-print { display: none !important; }
                    @page { size: A4 landscape; margin: 0; }
                }
                body { background: #1e293b; margin: 0; padding: 40px; display: flex; flex-direction: column; align-items: center; font-family: 'Inter', sans-serif; gap: 20px; }
            </style>
        </head>
        <body>
            <div style="background: white; transform: scale(0.9); transform-origin: top center; border-radius: 8px; overflow: hidden; box-shadow: 0 50px 100px rgba(0,0,0,0.4);">
                ${html}
            </div>
            <div style="position: fixed; top: 0; left: 0; right: 0; background: #0B0E14; padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; z-index: 999;" class="no-print">
                 <h2 style="color: white; margin: 0; font-size: 1.1rem; font-weight: 800;">PASS RATE REPORT PREVIEW</h2>
                 <div style="display:flex; gap:10px;">
                    <button onclick="window.print()" style="padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 6px; font-weight: 800; cursor: pointer; font-family: inherit;">🖨️ PRINT / SAVE PDF</button>
                    <button onclick="window.close()" style="padding: 10px 20px; background: #ef4444; color: white; border: none; border-radius: 6px; font-weight: 800; cursor: pointer; font-family: inherit;">CLOSE</button>
                 </div>
            </div>
        </body>
        </html>
    `);
    pw.document.close();
};// ============================================================
// PEDAGOGICAL ANALYTICS (DASHBOARD)
// ============================================================
let teacherMainPerfChart = null;
let teacherMainDistChart = null;

async function renderTeacherDashboardCharts() {
    const perfCtx = document.getElementById('teacher-main-perf-chart');
    const distCtx = document.getElementById('teacher-main-dist-chart');
    if (!perfCtx || !distCtx) return;

    try {
        const assignments = await DB.getTeacherAssignments(MY_PROFILE.id);
        const myClassIds = [...new Set(assignments.map(a => a.class_id).filter(Boolean))];
        const marks = await DB.getMarks({ classIds: myClassIds }); // Focused fetch for speed
        const term = SCHOOL_INFO.active_term || '2';

        // 1. Line/Bar Chart: Performance per Class/Subject Jurisdiction
        const chartLabels = assignments.map(a => {
            const clsName = a.classes?.name || 'Unknown Class';
            const subName = a.subjects?.abbr || a.subjects?.name || 'General';
            return `${clsName} - ${subName}`;
        });
        const chartValues = assignments.map(a => {
            const jurisdictionMarks = marks.filter(m => 
                m.class_id === a.class_id && 
                m.subject_id === a.subject_id && 
                String(m.term) === String(term)
            );
            if (!jurisdictionMarks.length) return 0;
            const avg = (jurisdictionMarks.reduce((acc, m) => acc + (Number(m.score) / Number(m.max_score || 10) * 100), 0) / jurisdictionMarks.length);
            return parseFloat(avg.toFixed(1));
        });

        if (teacherMainPerfChart) teacherMainPerfChart.destroy();
        teacherMainPerfChart = new Chart(perfCtx, {
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Jurisdiction Success Rate %',
                    data: chartValues,
                    backgroundColor: '#4f46e5',
                    borderRadius: 10,
                    barThickness: 35
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { 
                  y: { beginAtZero: true, max: 100, ticks: { font: { weight: 'bold' } } },
                  x: { ticks: { font: { weight: 'bold' } } }
                }
            }
        });

        // 2. Pie Chart: Pass vs Fail Distribution in Teacher's nodes
        let passed = 0, failed = 0;
        const myMarks = marks.filter(m => 
            assignments.some(a => a.class_id === m.class_id && a.subject_id === m.subject_id) && 
            String(m.term) === String(term)
        );
        myMarks.forEach(m => {
            const pct = (Number(m.score) / Number(m.max_score || 10)) * 100;
            if (pct >= 50) passed++; else failed++;
        });

        if (teacherMainDistChart) teacherMainDistChart.destroy();
        teacherMainDistChart = new Chart(distCtx, {
            type: 'bar',
            data: {
                labels: ['Pass / Fail Distribution'],
                datasets: [
                    {
                        label: 'Passed',
                        data: [passed],
                        backgroundColor: '#10b981',
                        borderRadius: 10,
                        barThickness: 50
                    },
                    {
                        label: 'Failed',
                        data: [failed],
                        backgroundColor: '#ef4444',
                        borderRadius: 10,
                        barThickness: 50
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { font: { weight: 'bold' }, padding: 16 } },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                const total = passed + failed;
                                const pct = total ? ((ctx.raw / total) * 100).toFixed(1) : 0;
                                return ctx.dataset.label + ': ' + ctx.raw + ' students (' + pct + '%)';
                            }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1, font: { weight: 'bold' } } },
                    x: { ticks: { font: { weight: 'bold' } } }
                }
            }
        });

    } catch (e) {
        console.error('[ANALYTICS] Teacher chart failure:', e);
    }
}

// ============================================================
// DATA EXPORT (PDF, WORD, EXCEL)
// ============================================================

async function openExportMarksModal() {
    const cid = CURRENT_SESSION.classId;
    if (!cid) return toast("No active class context found.", "warning");

    const [allSubs, assess, assignments] = await Promise.all([
        DB.getSubjects(),
        DB.getAssessments(),
        DB.getTeacherAssignments(MY_PROFILE?.id)
    ]);

    // Check if the current user is the "Class Teacher" for this class
    const isClassTeacher = assignments.some(a => a.type === "class" && a.class_id === cid);
    el("export-class-teacher-option").style.display = isClassTeacher ? "block" : "none";

    // Filtering Criteria: 
    // If Class Teacher: See all subjects in class
    // If Subject Teacher: Only see subjects assigned to them in this class
    let exportSubs = [];
    if (isClassTeacher) {
        exportSubs = allSubs.filter(s => s.class_id === cid || !s.class_id);
    } else {
        const myAssignedSubIds = assignments
            .filter(a => a.class_id === cid && a.subject_id)
            .map(a => a.subject_id);
        exportSubs = allSubs.filter(s => myAssignedSubIds.includes(s.id));
    }

    if (!exportSubs.length) return toast("You have no academic jurisdictions to export in this class.", "warning");

    el("export-subject-list").innerHTML = exportSubs.map(s => `
        <label style="display:block; font-size:0.75rem; margin-bottom:4px; font-weight:700;">
            <input type="checkbox" checked value="${s.id}" class="exp-sub-cb"> ${(s.abbr || s.name).toUpperCase()}
        </label>`).join("");

    // Populate Assessments
    const activeAssess = assess.length ? assess : [
        { id: "cat", abbr: "CAT", name: "Continuous Assessment" },
        { id: "exam", abbr: "EXAM", name: "End of Term Exam" }
    ];
    el("export-assess-list").innerHTML = activeAssess.map(a => `
        <label style="display:block; font-size:0.75rem; margin-bottom:4px; font-weight:700;">
            <input type="checkbox" checked value="${a.id}" class="exp-assess-cb"> ${(a.abbr || a.name).toUpperCase()}
        </label>`).join("");

    openModal("export-marks-modal");
}

function getInstitutionalExportHeader(title, classLabel, roleLabel, userName) {
    const term = SCHOOL_INFO.active_term || "...";
    const academicYear = SCHOOL_INFO.academic_year || "2025/2026";
    return `
        <table style="width:100%; border-collapse:collapse; margin-bottom:15px; font-family: inherit;">
            <tr>
                <td style="width:80px; vertical-align:middle;">
                    <img src="js/Report image/download__92_-removebg-preview.png" style="width:70px; height:auto;">
                </td>
                <td style="text-align:center; vertical-align:middle;">
                    <div style="font-size:0.7rem; font-weight:900; color:#1e40af; text-transform:uppercase;">REPUBLIC OF RWANDA</div>
                    <div style="font-size:0.65rem; font-weight:700; margin-bottom:5px;">MINISTRY OF EDUCATION</div>
                    <div style="font-size:1.4rem; font-weight:900; text-transform:uppercase; color:#1e293b;">${(SCHOOL_INFO.school || "MMS PORTAL").toUpperCase()}</div>
                    <div style="font-size:0.9rem; font-weight:800; color:#3b82f6; text-transform:uppercase; letter-spacing:1px; margin-top:5px;">
                        ${title} — ${classLabel}
                    </div>
                    <div style="font-size:0.75rem; font-weight:700; color:#64748b; margin-top:3px;">TERM ${term} | ACADEMIC YEAR ${academicYear}</div>
                </td>
                <td style="width:80px; text-align:right; vertical-align:middle;">
                    ${SCHOOL_INFO.logo ? `<img src="${SCHOOL_INFO.logo}" style="width:75px; height:75px; object-fit:contain;">` : `<div style="width:70px; height:70px; border:1px dashed #94a3b8; display:flex; align-items:center; justify-content:center; font-size:0.5rem; color:#94a3b8;">LOGO</div>`}
                </td>
            </tr>
        </table>
        <div style="display:flex; justify-content:space-between; border-top:1.5px solid #000; border-bottom:1px solid #e2e8f0; padding:8px 0; margin-bottom:15px; font-size:0.68rem; font-weight:900; color:#1e293b;">
            <div style="display:flex; gap:20px;">
                <div>EXPORTER: <span style="color:#2563eb;">${userName.toUpperCase()}</span></div>
                <div>ROLE: <span style="color:#2563eb;">${roleLabel.toUpperCase()}</span></div>
            </div>
            <div style="text-align:right;">
                <div>LOC: ${(SCHOOL_INFO.district || "KAYONZA").toUpperCase()}</div>
                <div style="font-size:0.55rem; color:#64748b;">MMS-REG: ${Math.random().toString(36).substring(7).toUpperCase()} | ${new Date().toLocaleString()}</div>
            </div>
        </div>
    `;
}

async function exportMarks(type) {
    const cid = CURRENT_SESSION.classId;
    if (!cid) return toast("Critical: Class Context Lost. Please re-select class.", "error");

    closeModal("export-marks-modal");
    toast(`🔄 Re-hydrating Institutional Data...`, "info");

    try {
        // FORCE FETCH EVERYTHING FRESH
        const [students, marks, allSubjects, assignments, schoolData] = await Promise.all([
            DB.getStudents(cid),
            DB.getMarks({ class_id: cid, term: SCHOOL_INFO.active_term || 1 }),
            DB.getSubjects(),
            DB.getTeacherAssignments(MY_PROFILE?.id),
            DB.getSchoolInfo()
        ]);

        // Synchronize local SCHOOL_INFO with fresh data
        if (schoolData) Object.assign(SCHOOL_INFO, schoolData);
        
        const term = SCHOOL_INFO.active_term || 1;
        const subIds = Array.from(document.querySelectorAll(".exp-sub-cb:checked")).map(i => i.value);
        const assessIds = Array.from(document.querySelectorAll(".exp-assess-cb:checked")).map(i => i.value);
        const exportSubs = allSubjects.filter(s => subIds.includes(s.id));

        if (!students.length || !exportSubs.length) return toast("Empty Registry: No data found for selection.", "warning");

        const totalColumns = 1 + (exportSubs.length * (assessIds.length + 1));
        let baseFontSize = totalColumns > 35 ? "0.35rem" : (totalColumns > 25 ? "0.45rem" : (totalColumns > 15 ? "0.6rem" : "0.75rem"));

        const vTable = document.createElement("table");
        Object.assign(vTable.style, {
            borderCollapse: "collapse",
            width: "100%",
            fontSize: baseFontSize,
            backgroundColor: "#ffffff",
            color: "#000"
        });
        
        let headerHtml = `<tr><th style="border:1.5px solid #000; padding:5px; background:#f8fafc; font-weight:900; min-width:140px;">STUDENT NAME REFERENCE</th>`;
        exportSubs.forEach(s => {
            const subTitle = (s.abbr || s.name).toUpperCase();
            assessIds.forEach(aid => {
                headerHtml += `<th style="border:1.5px solid #000; padding:4px; text-align:center; font-weight:900;">${subTitle}<br>(${aid.toUpperCase()})</th>`;
            });
            headerHtml += `<th style="border:1.5px solid #000; padding:4px; background:#f1f5f9; font-weight:950; text-align:center;">${subTitle}<br>TOTAL</th>`;
        });
        headerHtml += "</tr>";

        let bodyHtml = "";
        students.sort((a,b) => (a.last_name||'').localeCompare(b.last_name||'')).forEach(st => {
            bodyHtml += `<tr style="page-break-inside: avoid;"><td style="border:1px solid #000; padding:3px 8px; font-weight:800; white-space:nowrap;">${(st.last_name + " " + st.first_name).toUpperCase()}</td>`;
            exportSubs.forEach(sub => {
                let subSum = 0;
                assessIds.forEach(aid => {
                    const m = marks.find(m => m.student_id === st.id && m.subject_id === sub.id && m.assessment_id?.toLowerCase() === aid.toLowerCase());
                    const score = m ? (m.score < 0 ? "M" : m.score) : "-";
                    if (m && m.score >= 0) subSum += Number(m.score);
                    bodyHtml += `<td style="border:1px solid #000; padding:3px; text-align:center; font-weight:700;">${score}</td>`;
                });
                bodyHtml += `<td style="border:1px solid #000; padding:3px; text-align:center; background:#fafafa; font-weight:900; color:#1e40af;">${subSum}</td>`;
            });
            bodyHtml += "</tr>";
        });

        const tableHtml = `
            <table style="border-collapse: collapse; width: 100%; font-size: ${baseFontSize}; background-color: #ffffff; color: #000;">
                <thead>${headerHtml}</thead>
                <tbody>${bodyHtml}</tbody>
            </table>
        `;
        
        const className = CURRENT_SESSION.classLabel || "Class_Registry";
        const fileName = `Institutional_Marks_${className.replace(/\s+/g, "_")}_Term_${term}`;
        const isClassTeacher = assignments.some(a => a.type === "class" && a.class_id === cid);
        const roleLabel = isClassTeacher ? "Class Teacher" : "Subject Teacher";
        const instHeader = getInstitutionalExportHeader("OFFICIAL MARK REGISTER", className, roleLabel, MY_PROFILE?.full_name || "MMS-USER");

        const fullHtml = `
            <div style="background: #fff; padding: 20px; font-family: sans-serif; color: #000;">
                ${instHeader}
                ${tableHtml}
            </div>
        `;

        const tempContainer = document.createElement("div");
        tempContainer.innerHTML = fullHtml;

        if (type === "pdf") {
            const opt = {
                margin: 10,
                filename: fileName + ".pdf",
                image: { type: "jpeg", quality: 0.98 },
                html2canvas: { scale: 3, useCORS: false, letterRendering: true, backgroundColor: "#ffffff" },
                jsPDF: { unit: "mm", format: "a4", orientation: "landscape" }
            };
            const pdfBlob = await html2pdf().set(opt).from(tempContainer).outputPdf("blob");
            const url = URL.createObjectURL(pdfBlob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName + ".pdf";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 200);
        }
        else if (type === "excel") {
            // Re-create isolated table for SheetJS
            const exportDataContainer = document.createElement("div");
            exportDataContainer.innerHTML = tableHtml;
            const wb = XLSX.utils.table_to_book(exportDataContainer.querySelector('table'), { sheet: "Marks_Register" });
            XLSX.writeFile(wb, fileName + ".xlsx");
        } 
        else if (type === "word") {
            const preHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Institutional Export</title><style>table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid black; padding: 4px; font-size: 10pt; font-family: Arial; }</style></head><body>`;
            const html = preHtml + fullHtml + "</body></html>";
            const blob = new Blob(["\ufeff", html], { type: "application/msword" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName + ".doc";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 200);
        }
        
        document.body.removeChild(tempContainer);
        toast("✅ Institutional data archived.", "success");
    } catch (err) {
        console.error("Export Error:", err);
        toast("Data hydration failed. Check cloud sync.", "error");
    }
}

// ============================================================
// Bulk Student Import (Paste or CSV Upload)
// ENHANCED WITH VALIDATION AND ERROR HANDLING
// ============================================================
function openImportStudentsModal() {
    openModal('import-students-modal');
}

async function processStudentImport() {
    const textarea = document.getElementById('import-students-textarea');
    const fileInput = document.getElementById('import-students-file');
    let csvData = '';

    // Get the current class ID
    const classId = document.getElementById('s-class-id')?.value;
    if (!classId) {
        toast('⚠️ No active class selected. Please select a class first.', 'error');
        return;
    }

    // Get CSV data from file or textarea
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        
        // Validate file type
        if (!file.name.endsWith('.csv') && !file.type.startsWith('text')) {
            toast('❌ Please upload a CSV file.', 'error');
            return;
        }
        
        csvData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(e);
            reader.readAsText(file);
        });
    } else if (textarea && textarea.value.trim()) {
        csvData = textarea.value;
    }

    if (!csvData || csvData.trim().length === 0) {
        toast('⚠️ No student data provided. Paste data or upload a CSV file.', 'warning');
        return;
    }

    try {
        // Parse CSV data
        const students = StudentRegistration.parseCSV(csvData, classId);
        
        if (students.length === 0) {
            toast('❌ No valid students found in the data.', 'error');
            return;
        }

        toast(`📋 Processing ${students.length} students...`, 'info');

        // Bulk import with validation
        const result = await StudentRegistration.bulkImport(students, classId);

        if (result.success) {
            toast(`✅ Successfully imported ${result.imported}/${result.totalProcessed} students!`, 'success');
            closeModal('import-students-modal');
            
            // Clear form
            if (textarea) textarea.value = '';
            if (fileInput) fileInput.value = '';
            
            // Refresh the display
            if (typeof renderStudentRegistry === 'function') {
                await renderStudentRegistry();
            }
        } else {
            // Partial or full failure
            if (result.errors.length > 0) {
                const errorMsg = result.errors.slice(0, 3).join('\n');
                console.error('[IMPORT] Errors:', result.errors);
                toast(`❌ Import failed:\n${errorMsg}${result.errors.length > 3 ? '\n...' : ''}`, 'error');
            } else {
                toast(`⚠️ No students were imported.`, 'warning');
            }
        }
    } catch (e) {
        console.error('[IMPORT] Error:', e);
        toast('❌ Failed to import students. Check the data format.', 'error');
    }
}
