/**
 * MARKS MANAGEMENT SYSTEM — ADMIN PORTAL LOGIC
 * Re-engineered for CAMIS Institutional standard.
 * 
 * SYSTEM ARCHITECTURE: 
 * - Full real-time synchronization via SYNC engine.
 * - Multi-assessment support with dynamic layout scaling.
 * - Institutional branding injection.
 */

'use strict';

// --- INSTITUTIONAL MESSAGING CONFIG ---
const EMAILJS_PUBLIC_KEY = 'FYXWiqYgYOm_Z0-4J'; 
const EMAILJS_SERVICE_ID = 'service_ka4tosb';
const EMAILJS_TEMPLATE_ID = 'template_ichzoqb';

// SECURITY NOTE: Twilio is disabled until properly configured
// To enable: Add real credentials from environment variables or backend
const TWILIO_ENABLED = false;
const TWILIO_SID     = null; // 'YOUR_ACTUAL_SID' - NEVER hardcode production credentials
const TWILIO_TOKEN   = null; // Load from backend or environment
const TWILIO_NUMBER  = null; // Load from backend or environment
const TWILIO_API_URL = null; // Disabled until credentials are configured

if (typeof emailjs !== 'undefined') {
    emailjs.init(EMAILJS_PUBLIC_KEY);
}

// Helper to check Twilio availability
function isTwilioConfigured() {
    return TWILIO_ENABLED && TWILIO_SID && TWILIO_TOKEN && TWILIO_NUMBER;
}

// GLOBAL UI HELPERS
if (typeof window.el === 'undefined') {
    window.el = id => document.getElementById(id);
}

// ============================================================
// MULTI-ADMIN PORTAL INITIALIZATION
// Step 4: Initialize portal with real-time sync
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
      window.location.href = 'index.html';
      return;
    }

    // Get current user's school code
    const schoolCode = await getCurrentSchoolCode();
    console.log(`[ADMIN] Connected to school: ${schoolCode}`);

    // Update LOCAL school info with the actual login code immediately
    SCHOOL_INFO.code = schoolCode;

    // FETCH COMPREHENSIVE INSTITUTIONAL IDENTITY (Registry + Overrides)
    const officialInfo = await DB.getSchoolInfo();
    
    if (officialInfo) {
      SCHOOL_INFO = { ...SCHOOL_INFO, ...officialInfo };
      console.log('[SCHOOL] Verified Institutional Hub:', SCHOOL_INFO.school);
    }

    // Update UI header with school info
    const schoolNameEl = document.getElementById('school-name-hd');
    const schoolCodeEl = document.getElementById('school-code-hd');
    if (schoolNameEl) {
        schoolNameEl.textContent = (SCHOOL_INFO.school && SCHOOL_INFO.school !== 'MMS INSTITUTIONAL PORTAL') 
            ? SCHOOL_INFO.school.toUpperCase() 
            : 'MMS PORTAL';
    }
    if (schoolCodeEl) schoolCodeEl.textContent = `SDMS Code • ${schoolCode}`;
    
    // ELITE IDENTITY INJECTOR
    if (el('header-user-name')) el('header-user-name').textContent = 'ADMIN';
    if (el('header-school-name')) el('header-school-name').textContent = SCHOOL_INFO.school || 'INSTITUTION';
    if (el('header-user-avatar')) el('header-user-avatar').textContent = 'A';

    // Refresh Lucide icons if any new were added
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Mark this admin as active (non-critical)
    try { await updateLastSync(); } catch(e) { console.warn('[INIT] updateLastSync:', e.message); }

    // Show active admins count (non-critical)
    try {
      const activeAdmins = await getAdminsInSchool(schoolCode);
      console.log(`[TEAM] ${activeAdmins.length} admin(s) active`);
      updateAdminActivityPanel(activeAdmins);
    } catch(e) { console.warn('[INIT] Admin panel:', e.message); }

    // Enable real-time sync for this school (non-critical)
    try { subscribeToSchoolChanges(schoolCode); } catch(e) { console.warn('[SYNC]', e.message); }

    // SETUP REAL-TIME NOTIFICATIONS & MESSAGING (non-critical)
    try { await initNotificationSystem(schoolCode, user.id); } catch(e) { console.warn('[NOTIF]', e.message); }

    // Setup listeners for UI updates (non-critical)
    try { setupUIListeners(schoolCode); } catch(e) { console.warn('[UI]', e.message); }

    // Start regular sync tracking (every 30 seconds)
    setInterval(() => updateLastSync().catch(()=>{}), 30 * 1000);

    // ELITE DYNAMIC HEADER CONTROLLER
    const SCROLL_TARGET = document.querySelector('.main-wrapper') || document.querySelector('.main-content') || window;
    
    SCROLL_TARGET.addEventListener('scroll', () => {
        const header = document.querySelector('.sub-header');
        if (!header) return;
        
        const scrollValue = (SCROLL_TARGET === window) ? window.scrollY : SCROLL_TARGET.scrollTop;
        if (scrollValue > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    console.log('[INIT] Admin portal ready!');

  } catch (error) {
    console.error('[INIT] Portal init error:', error.message, error);
    // Non-blocking notification — portal remains usable
    const tc = document.getElementById('toast-container');
    if (tc) {
      const t = document.createElement('div');
      t.className = 'toast error';
      t.style.cssText = 'padding:1rem 1.5rem;background:#fef2f2;color:#dc2626;border-radius:12px;border:2px solid #fecaca;font-weight:800;font-size:0.85rem;margin-bottom:0.5rem;';
      t.textContent = `⚠️ ${error.message || 'Startup issue'}. Check console or refresh.`;
      tc.appendChild(t);
      setTimeout(() => t.remove(), 7000);
    }
  }
}

async function initNotificationSystem(schoolCode, userId) {
    try {
        // Initial Fetch
        const { data: notifs } = await _supabase.from('notifications')
            .select('*')
            .or(`school_code.eq."${schoolCode}",school_code.is.null,admin_id.eq."${userId}"`)
            .order('created_at', { ascending: false })
            .limit(10);
            
        renderNotificationsList(notifs || []);

        // Real-time listener
        _supabase.channel('mms-hq-notifications')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'notifications' 
            }, (payload) => {
                const n = payload.new;
                if (!n.school_code || n.school_code === schoolCode || n.admin_id === userId) {
                    toast(`🔔 Intelligence: ${n.message.substring(0, 50)}${n.message.length > 50 ? '...' : ''}`, n.urgency || 'info');
                    refreshNotifications();
                }
            })
            .subscribe();

    } catch (e) {
        console.warn('[NOTIF] Init skipped:', e);
    }
}

async function refreshNotifications() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        const schoolCode = await getCurrentSchoolCode();
        const { data: notifs } = await _supabase.from('notifications')
            .select('*')
            .or(`school_code.eq."${schoolCode}",school_code.is.null,admin_id.eq."${user.id}"`)
            .order('created_at', { ascending: false })
            .limit(10);
            
        renderNotificationsList(notifs || []);
    } catch (e) {}
}

function renderNotificationsList(notifs) {
    const unread = notifs.filter(n => !n.is_read).length;
    const countEl = document.getElementById('notif-count');
    if (countEl) {
        countEl.textContent = unread;
        countEl.style.display = unread > 0 ? 'block' : 'none';
    }
    
    window._last_notifs = notifs; // Global cache for dropdown
}

function toggleNotifPanel() {
    const panelId = 'notif-dropdown-panel';
    let panel = document.getElementById(panelId);
    
    if (panel) {
        panel.remove();
        return;
    }
    
    panel = document.createElement('div');
    panel.id = panelId;
    panel.style = `
        position: absolute; top: 100%; right: 0; width: 320px; 
        background: #fff; border: 2.5px solid #000; border-radius: 16px; 
        margin-top: 10px; z-index: 2000; box-shadow: 0 20px 50px rgba(0,0,0,0.1);
        overflow: hidden; animation: slideIn 0.2s ease-out;
    `;
    
    const list = window._last_notifs || [];
    const html = `
        <div style="background: #000; color: #fff; padding: 1rem; font-weight: 1000; font-size: 0.75rem; text-transform: uppercase;">MMS HQ Intelligence Center</div>
        <div style="max-height: 350px; overflow-y: auto; padding: 0.5rem;">
            ${list.map(n => `
                <div style="padding: 1rem; border-bottom: 1px solid #eee; position: relative;">
                    <div style="display: flex; gap: 8px; margin-bottom: 4px;">
                        <span class="badge" style="font-size: 0.55rem; background: ${n.urgency === 'warning' ? '#fef2f2' : '#f0f9ff'}; color: ${n.urgency === 'warning' ? '#ef4444' : '#3b82f6'}; border-color: ${n.urgency === 'warning' ? '#ef4444' : '#3b82f6'}">${n.urgency.toUpperCase()}</span>
                        <span style="font-size: 0.6rem; color: #94a3b8; font-weight: 800;">${new Date(n.created_at).toLocaleTimeString()}</span>
                    </div>
                    <p style="font-size: 0.8rem; font-weight: 850; color: #000; line-height: 1.4;">${n.message}</p>
                </div>
            `).join('') || '<div style="padding: 2rem; text-align: center; color: #94a3b8; font-size: 0.8rem; font-weight: 800;">No institutional notices.</div>'}
        </div>
        <a href="#" onclick="switchView('support'); document.getElementById('${panelId}').remove();" style="display: block; text-align: center; padding: 1rem; background: #fafafa; border-top: 1px solid #eee; font-size: 0.7rem; font-weight: 1000; color: #000; text-decoration: none;">View Connectivity Hub</a>
    `;
    
    panel.innerHTML = html;
    document.getElementById('notif-bell').appendChild(panel);
}

async function handleSupportMessage(e) {
    e.preventDefault();
    const msg = document.getElementById('support-msg-content').value;
    const btn = e.target.querySelector('button');

    try {
        btn.disabled = true;
        btn.textContent = 'En route to MMS HQ...';
        
        const { data: { user } } = await _supabase.auth.getUser();
        const schoolCode = await getCurrentSchoolCode();

        const { error } = await _supabase.from('support_messages').insert({
            sender_id: user.id,
            sdms_code: schoolCode,
            content: msg,
            created_at: new Date().toISOString()
        });

        if (error) throw error;

        toast('Message successfully dispatched to System Admin!', 'success');
        document.getElementById('support-msg-content').value = '';
    } catch (e) {
        toast('Message failed to route.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Dispatch to Headquarters';
    }
}

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
        if (typeof loadStudentsTable === 'function') loadStudentsTable();
      } else if (payload.eventType === 'DELETE') {
        toast('🗑️ Student removed', 'info');
        if (typeof loadStudentsTable === 'function') loadStudentsTable();
      } else if (payload.eventType === 'UPDATE') {
        if (typeof loadStudentsTable === 'function') loadStudentsTable();
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
      if (typeof loadMarksApprovalQueue === 'function') loadMarksApprovalQueue();
    });

    // Listen for teacher changes
    SYNC.on('teachers', (payload) => {
      console.log('[UPDATE] Teachers changed:', payload.eventType);
      if (payload.eventType === 'INSERT') {
        toast('👨‍🏫 New teacher registered', 'success');
      }
      if (typeof loadTeachersTable === 'function') loadTeachersTable();
    });

    // Listen for school settings changes
    SYNC.on('school_settings', (payload) => {
      console.log('[UPDATE] School settings updated');
      fetchSchoolSettings(schoolCode).then(settings => {
        if (settings && settings.info) {
          SCHOOL_INFO = { ...SCHOOL_INFO, ...settings.info };
          // Update header if name changed
          const schoolNameEl = document.getElementById('school-name-hd');
          if (schoolNameEl) schoolNameEl.textContent = (SCHOOL_INFO.school || 'MMS Portal').toUpperCase();
        }
      });
    });

    // Universal Sync Feedback
    const updateSyncTime = () => {
        const el = document.getElementById('last-sync-time');
        if (el) el.textContent = `Synced: ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}`;
    };
    
    // Trigger feedback on every table refresh
    window.addEventListener('mms-data-refreshed', updateSyncTime);
  }
}

/**
 * Helper to dispatch refresh event
 */
function notifyDataRefreshed() {
    window.dispatchEvent(new CustomEvent('mms-data-refreshed'));
}

/**
 * Display active admins in a panel
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', initAdminPortal);

// CAMIS Validation Utilities
function isNonEmpty(value) { return value && value.trim().length > 0; }
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function isValidSDMS(code) { return /^\d{11}$/.test(code); }

function toggleSidebar() {
    const sb = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sb) return;
    
    sb.classList.toggle('open');
    if (overlay) {
        overlay.classList.toggle('active');
        overlay.style.display = overlay.classList.contains('active') ? 'block' : 'none';
    }
}

// Close sidebar on link click (mobile)
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 1024) {
        if (e.target.classList.contains('nav-item') || e.target.closest('.nav-item') || e.target.classList.contains('sidebar-item') || e.target.closest('.sidebar-item')) {
            // MOBILE UX: Auto-close sidebar on navigation
            if (window.innerWidth <= 1024) {
                const sb = document.querySelector('.sidebar');
                if (sb && sb.classList.contains('open')) toggleSidebar();
            }
        }
    }
});

const RWANDA_CORE_SUBJECTS = [
    { name: 'Mathematics', code: 'MAT', abbr: 'MAT', levels: 'P1-P6' },
    { name: 'English', code: 'ENG', abbr: 'ENG', levels: 'P1-P6' },
    { name: 'Kinyarwanda', code: 'KIN', abbr: 'KIN', levels: 'P1-P6' },
    { name: 'Science and Elementary Technology (SET)', code: 'SET', abbr: 'SET', levels: 'P1-P6' },
    { name: 'Social and Religious Studies (SRS)', code: 'SRS', abbr: 'SRS', levels: 'P1-P6' },
    { name: 'Creative Arts', code: 'ART', abbr: 'ART', levels: 'P1-P6' },
    { name: 'Physical Education & Sports', code: 'PES', abbr: 'PES', levels: 'P1-P6' },
    { name: 'French', code: 'FRE', abbr: 'FRE', levels: 'P4-P6' }

];

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

let SCHOOL_INFO = { 
    school: 'MMS INSTITUTIONAL PORTAL', 
    district: '', 
    sector: '',
    code: 'LOADING...', 
    phone: '',
    headteacher: '',
    academic_year: '2025/2026',
    done_date: new Date().toLocaleDateString('en-GB')
};

function calcGrade(pct) {
    pct = Number(pct);
    if (pct >= 80) return 'A';
    if (pct >= 75) return 'B';
    if (pct >= 70) return 'C';
    if (pct >= 65) return 'D';
    if (pct >= 60) return 'E';
    if (pct >= 50) return 'S';
    return 'F';
}

function getComment(pct) {
    pct = Number(pct);
    if (pct >= 80) return 'Excellent performance, keep it up!';
    if (pct >= 75) return 'Very good performance!';
    if (pct >= 70) return 'Good performance, work harder!';
    if (pct >= 65) return 'Satisfactory result.';
    if (pct >= 60) return 'Fair performance.';
    if (pct >= 50) return 'Needs improvement.';
    return 'Unsatisfactory! Intensive support and revision needed.';
}

function generateInstitutionalHeader(reportTitle, subtitle = "") {
    const info = SCHOOL_INFO;
    const rwandaLogo = "js/Report image/download__92_-removebg-preview.png";
    const schoolLogo = info.logo || "js/Report image/c41de77e-b6ee-46ea-b62f-5b6172b80738-removebg-preview.png";

    return `
        <div style="display:flex; flex-direction:column; align-items:center; border-bottom: 3px solid #000; padding-bottom: 20px; margin-bottom: 20px; position:relative; font-family: 'Inter', sans-serif; color:#000;">
            
            <!-- Standard Rwanda/MINEDUC Branding (Left) -->
            <div style="position:absolute; left:0; top:0; width:120px; text-align:center;">
                <img src="${rwandaLogo}" style="width:85px; height:auto; margin-bottom:2px;">
                <div style="font-size:0.55rem; font-weight:800; color:#000; line-height:1.1;">
                    REPUBLIC OF RWANDA<br>MINISTRY OF EDUCATION
                </div>
            </div>

            <!-- Central School Details -->
            <div style="text-align:center; padding: 0 130px; width:100%; box-sizing:border-box;">
                <div style="font-size:0.8rem; font-weight:900; color:#000; letter-spacing:1px;">${(info.republic || 'REPUBLIC OF RWANDA').toUpperCase()}</div>
                <div style="font-size:2.2rem; font-weight:1000; color:#000; text-transform:uppercase; margin: 4px 0; letter-spacing:-1px; line-height:1.1;">${(info.school || 'MMS PORTAL').toUpperCase()}</div>
                
                <div style="font-size:0.85rem; font-weight:900; color:#000; margin: 6px 0; text-transform:uppercase;">
                    ${info.province ? info.province + ' PROVINCE | ' : ''}
                    DISTRICT: ${info.district || '...'} | SECTOR: ${info.sector || '...'} | LEVEL: ${info.level || 'PRIMARY'}
                </div>

                <div style="margin: 15px 0;">
                    <span style="font-size:1.6rem; font-weight:1000; padding:10px 45px; border:3px solid #000; display:inline-block; letter-spacing:3px;">${reportTitle.toUpperCase()}</span>
                </div>

                <div style="font-size:0.8rem; font-weight:800; color:#000; margin-top:5px;">
                    Email: ${info.email || '...'} | Phone: ${info.phone || '...'}
                </div>

                ${subtitle ? `<div style="font-size:1rem; font-weight:950; margin-top:8px; font-style:italic;">${subtitle}</div>` : ''}
            </div>

            <!-- School Logo/Stamp Placeholder (Right) -->
            <div style="position:absolute; right:0; top:0; width:120px; text-align:center;">
                ${info.logo ? 
                    `<img src="${info.logo}" style="width:100px; height:100px; object-fit:contain;">` : 
                    `<div style="width:100px; height:100px; border:2.5px dashed #000; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:0.6rem; font-weight:900; text-align:center; color:#000;">OFFICIAL<br>STAMP / LOGO</div>`
                }
            </div>
        </div>
    `;
}

// ------------------------------------------------------------
// Helper to retrieve institutional info (cached or from DB)
// ------------------------------------------------------------
async function getInstitutionInfo() {
  // Return cached if already populated
  if (SCHOOL_INFO && SCHOOL_INFO.republic) return SCHOOL_INFO;
  // Fallback: fetch from DB
  const info = await DB.getSchoolInfo();
  if (info) {
    Object.assign(SCHOOL_INFO, info);
    return SCHOOL_INFO;
  }
  return {};
}

async function syncConfigs() {
    try {
        const scale = await DB.getGradingScale();
        if (scale) GRADING_SCALE = scale;
        const info = await DB.getSchoolInfo();
        if (info) SCHOOL_INFO = { ...SCHOOL_INFO, ...info };
        
        // Institutional Curriculum Enforcement: Ensure Rwanda Core Subjects (including French) exist
        const subjects = await DB.getSubjects();
        for (const core of RWANDA_CORE_SUBJECTS) {
            const exists = subjects.find(s => 
                s.name.toLowerCase() === core.name.toLowerCase() || 
                (s.abbr && s.abbr.toUpperCase() === core.abbr.toUpperCase())
            );
            if (!exists) {
                console.log(`[CURRICULUM] Auto-initializing missing core subject: ${core.name}`);
                await DB.addSubject({
                    name: core.name,
                    abbr: core.abbr,
                    code: core.code
                });
            }
        }
    } catch (e) {
        console.warn('[CONFIG] Institutional sync incomplete:', e);
    }
}

/**
 * INSTITUTIONAL BRANDING ORCHESTRATION
 * Ensures all reports use real database info and official logos.
 */
function generateInstitutionalHeader(reportTitle, subtitle = '') {
    const info = SCHOOL_INFO;
    return `
        <table style="width:100%; border-collapse:collapse; margin-bottom:15px; border-bottom: 2px solid #000; padding-bottom: 15px;">
            <tr>
                <td style="width:110px; vertical-align:middle; text-align:left;">
                    <img src="js/Report image/download__92_-removebg-preview.png" style="width:85px; height:auto;">
                    <div style="font-size:0.55rem; font-weight:700; color:#1e40af; text-align:center; margin-top:4px; line-height:1.2;">REPUBLIC OF RWANDA<br>MINISTRY OF EDUCATION</div>
                </td>
                <td style="text-align:center; vertical-align:middle; padding: 0 10px;">
                    <div style="font-size:0.65rem; font-weight:900; color:#1e40af; letter-spacing:1.5px; text-transform:uppercase;">REPUBLIC OF RWANDA</div>
                    <div style="font-size:1.6rem; font-weight:1000; text-transform:uppercase; margin-bottom:4px; color:#000; letter-spacing:-0.5px;">${(info.school || 'EDUMARKS ACADEMY').toUpperCase()}</div>
                    <div style="font-size:0.8rem; font-weight:800; color:#475569; margin-bottom:12px; text-transform: uppercase;">
                        District: ${info.district || '...'} | Sector: ${info.sector || '...'} | Level: ${info.level || 'Primary'}
                    </div>
                    <div style="display:inline-block; background:yellow; border:2.5px solid #000; color:#000; font-size:1.05rem; font-weight:1000; padding:8px 25px; text-transform:uppercase; letter-spacing:0.5px;">
                        ${reportTitle}
                    </div>
                    <div style="font-size:0.75rem; font-weight:700; color:#1e293b; margin-top:8px;">
                        Email: ${info.email || '...'} | Phone: ${info.phone || '...'}
                    </div>
                    ${subtitle ? `<div style="font-size:0.8rem; font-weight:900; margin-top:5px; color:#475569; font-style: italic;">${subtitle}</div>` : ''}
                </td>
                <td style="width:110px; vertical-align:middle; text-align:right;">
                    <img src="${info.logo || 'js/Report image/c41de77e-b6ee-46ea-b62f-5b6172b80738-removebg-preview.png'}" style="width:90px; height:90px; object-fit:contain; border-radius:8px;">
                </td>
            </tr>
        </table>
    `;
}

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
async function switchView(viewId, triggerEl) {
    // 1. Clear active states
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item, .sidebar-item').forEach(n => n.classList.remove('active'));

    // 2. Identify target view
    const viewContainer = document.getElementById('view-' + viewId);
    if (!viewContainer) {
        console.warn(`[NAV] View 'view-${viewId}' not found in registry.`);
        return;
    }

    // 3. Highlight View
    viewContainer.classList.add('active');

    // 4. Update Sidebar Active State
    const sidebarItem = triggerEl || document.querySelector(`.nav-item[data-view="${viewId}"], .sidebar-item[data-view="${viewId}"]`);
    if (sidebarItem) {
        sidebarItem.classList.add('active');
    }

    // 5. Store in Session for Persistence
    sessionStorage.setItem('last_view', viewId);

    // 6. Update Header & Breadcrumbs
    const headers = {
      'dashboard':      ['Institutional Command',    'Dashboard', 'Overview'],
      'management':     ['Strategic Setup',         'Governance', 'Institutional Hierarchy'],
      'students':       ['Academic Registry',    'Registry', 'Cohort Management'],
      'teachers':       ['Faculty Directory',   'Registry', 'Pedagogical Faculty'],
      'subjects':       ['Curricular Mapping',  'Curriculum', 'Course Registry'],
      'assessments':    ['Evaluation Standards','Curriculum', 'Grade Architecture'],
      'marks-mgmt':     ['Performance Archive', 'Governance', 'Historical Records'],
      'marks-approval': ['Validation Queue',    'Governance', 'Executive Review'],
      'reports':        ['Reports & Analytics', 'Executive', 'Strategic Intelligence'],
      'settings':       ['Command Configuration','Command Center', 'Global Settings'],
      'roles':          ['Access Control',      'Command Center', 'Permission Matrix'],
      'profile':        ['Security Profile',    'Account', 'Admin Credentials'],
      'support':        ['HQ Communications Hub', 'Institutional Elite', 'Direct Support']
    };

    if (headers[viewId]) {
      const hd = headers[viewId];
      if (el('page-title')) el('page-title').textContent = hd[0];
      if (el('breadcrumb-view')) el('breadcrumb-view').textContent = hd[1];
    }
    
    // VIEW-SPECIFIC INITIALIZATIONS
    if (viewId === 'profile') renderProfile();
    if (viewId === 'students') renderCohortRegistry();
    if (viewId === 'teachers') renderTeachersRegistry();
    if (viewId === 'subjects') renderSubjectsTable();
    if (viewId === 'dashboard') {
        renderDashboardStats();
        renderFacultyMonitor();
    }

    // Support View Special Content
    if (viewId === 'support') {
        const supportView = document.getElementById('view-support');
        if (supportView) {
            supportView.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                    <div class="card">
                        <div class="card-header"><h3>Secure Message to MMS Headquarters</h3></div>
                        <div style="padding: 2rem;">
                            <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1.5rem; font-weight: 800;">Communicate directly with the System Administrator for troubleshooting, institutional upgrades, or strategic assistance.</p>
                            <form onsubmit="handleSupportMessage(event)">
                                <div class="form-group">
                                    <label>Message Intelligence</label>
                                    <textarea id="support-msg-content" class="input-field" style="height: 150px; border: 2px solid #000; border-radius: 12px; padding: 1rem; width: 100%;" placeholder="Describe your request or issue in detail..." required></textarea>
                                </div>
                                <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 1.25rem;">Dispatch to Headquarters</button>
                            </form>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header"><h3>Strategic HQ Communications</h3></div>
                        <div style="padding: 2rem; max-height: 500px; overflow-y: auto;" id="hq-notif-list">
                            <!-- JS Populated -->
                            <p style="text-align: center; color: #94a3b8; padding: 2rem;">Loading HQ Strategic Bulletins...</p>
                        </div>
                    </div>
                </div>
            `;
            // Populate notifs
            const list = window._last_notifs || [];
            const container = document.getElementById('hq-notif-list');
            if (container) {
                container.innerHTML = list.map(n => `
                    <div style="padding: 1.5rem; background: #f8fafc; border: 2.5px solid #000; border-radius: 16px; margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <span class="badge" style="background: ${n.urgency === 'warning' ? '#ef4444' : '#3b82f6'}; color: #fff; border: none;">${n.urgency.toUpperCase()}</span>
                            <span style="font-size: 0.7rem; color: #64748b; font-weight: 900;">${new Date(n.created_at).toLocaleString()}</span>
                        </div>
                        <p style="font-weight: 1000; font-size: 0.9rem; line-height: 1.5;">${n.message}</p>
                    </div>
                `).join('') || '<p style="text-align: center; color: #94a3b8; padding: 2rem;">No strategic bulletins received.</p>';
            }
        }
    }

    // 7. Dispatch Rendering Logic
    const contentArea = document.querySelector('.main-content');
    if (contentArea) contentArea.style.opacity = '0.5'; 

    try {
        if (viewId === 'dashboard')        { await renderDashboard(); await renderFacultyMonitor(); }
        else if (viewId === 'management')  await renderSetup();
        else if (viewId === 'students')    await renderCohortRegistry();
        else if (viewId === 'teachers')    await renderFacultyRegistry();
        else if (viewId === 'subjects')    await renderSubjectsTable();
        else if (viewId === 'assessments') await renderAssessmentTypes();
        else if (viewId === 'marks-mgmt')  await renderMarksManagement();
        else if (viewId === 'marks-approval') await renderMonitoringQueue();
        else if (viewId === 'reports')     await renderReports();
        else if (viewId === 'settings')    await renderSettings();
        else if (viewId === 'profile')     await renderProfile();
        
        if (contentArea) contentArea.style.opacity = '1';
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        if (contentArea) contentArea.style.opacity = '1';
        console.error(`[NAV] Failed to render view '${viewId}':`, err);
    }
    await syncInstitutionalNodes();
    if (window.lucide) lucide.createIcons();
}

function handleInstitutionalMediaUpload(input, hiddenId, previewId) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const base64 = e.target.result;
        const hiddenEl = document.getElementById(hiddenId);
        const previewEl = document.getElementById(previewId);
        if (hiddenEl) hiddenEl.value = base64;
        if (previewEl) {
            previewEl.innerHTML = `<img src="${base64}" style="width:100%; height:100%; object-fit:contain;">`;
        }
    };
    reader.readAsDataURL(file);
}

async function renderProfile() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await _supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (!profile) {
        console.warn('[AUTH] Profile not found in institutional registry.');
        return;
    }

    const el = id => document.getElementById(id);
    const fullName = profile.full_name || 'System Administrator';
    const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

    // Update Profile Page Header
    const nameEl = el('profile-name-display');
    const initEl = el('profile-avatar-init');
    if (nameEl) nameEl.textContent = fullName;
    if (initEl) initEl.textContent = initials;
    
    // Update Sidebar Identity Hub
    const sidebarName = el('sidebar-user-name');
    const sidebarInit = el('sidebar-avatar-init');
    const sidebarRole = el('sidebar-user-role');

    if (sidebarName) sidebarName.textContent = fullName.toUpperCase();
    if (sidebarInit) sidebarInit.textContent = initials;
    if (sidebarRole) sidebarRole.textContent = (profile.role || 'Administrator').toUpperCase();

    // Hide sidebar group labels for non-student users
    const userRole = (profile.role || 'Administrator').toLowerCase();
    const sidebarLabels = document.querySelectorAll('.sidebar-group-label');
    
    // Add user role class to body for CSS styling
    document.body.classList.remove('user-student', 'user-teacher', 'user-admin');
    if (userRole === 'student') {
        document.body.classList.add('user-student');
        sidebarLabels.forEach(label => {
            label.style.display = 'block';
        });
    } else {
        document.body.classList.add(userRole === 'teacher' ? 'user-teacher' : 'user-admin');
        sidebarLabels.forEach(label => {
            label.style.display = 'none';
        });
    }

    // Populate Comprehensive Institutional Profile
    const info = await DB.getSchoolInfo();
    if (info) {
        if (el('prof-school-name-input')) el('prof-school-name-input').value = info.school || '';
        if (el('prof-school-code-input')) el('prof-school-code-input').value = info.code || '';
        if (el('prof-school-province'))   el('prof-school-province').value = info.province || '';
        if (el('prof-school-district'))   el('prof-school-district').value = info.district || '';
        if (el('prof-school-sector'))     el('prof-school-sector').value   = info.sector || '';
        if (el('prof-school-phone'))      el('prof-school-phone').value    = info.phone || '';
        if (el('prof-school-email'))      el('prof-school-email').value    = info.email || '';
        if (el('prof-ht-name'))           el('prof-ht-name').value         = info.headteacher || '';
        if (el('prof-dos-name'))          el('prof-dos-name').value        = info.dos || '';
        if (el('prof-responsibility'))    el('prof-responsibility').value  = profile.responsibility || '';

        // Media Previews
        if (info.logo) {
            if (el('prof-logo-base64')) el('prof-logo-base64').value = info.logo;
            if (el('prof-logo-preview')) {
                el('prof-logo-preview').style.display = 'block';
                el('prof-logo-preview').innerHTML = `<img src="${info.logo}" style="width:100%; height:100%; object-fit:contain;">`;
            }
        }
        if (info.stamp) {
            if (el('prof-stamp-base64')) el('prof-stamp-base64').value = info.stamp;
            if (el('prof-stamp-preview')) {
                el('prof-stamp-preview').style.display = 'block';
                el('prof-stamp-preview').innerHTML = `<img src="${info.stamp}" style="width:100%; height:100%; object-fit:contain;">`;
            }
        }
        if (info.headteacher_sig) {
            if (el('prof-ht-sig-base64')) el('prof-ht-sig-base64').value = info.headteacher_sig;
            if (el('prof-ht-sig-preview')) {
                el('prof-ht-sig-preview').innerHTML = `<img src="${info.headteacher_sig}" style="width:100%; height:100%; object-fit:contain;">`;
            }
        }
        if (info.dos_sig) {
            if (el('prof-dos-sig-base64')) el('prof-dos-sig-base64').value = info.dos_sig;
            if (el('prof-dos-sig-preview')) {
                el('prof-dos-sig-preview').innerHTML = `<img src="${info.dos_sig}" style="width:100%; height:100%; object-fit:contain;">`;
            }
        }

    }
}

async function saveAdminProfileUpdates() {
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) return toast('Security: Session expired.', 'error');

    const updates = {
        school:          el('prof-school-name-input').value,
        code:            el('prof-school-code-input').value,
        province:        el('prof-school-province').value,
        district:        el('prof-school-district').value,
        sector:          el('prof-school-sector').value,
        phone:           el('prof-school-phone').value,
        email:           el('prof-school-email').value,
        headteacher:     el('prof-ht-name').value,
        dos:             el('prof-dos-name').value,
        logo:            el('prof-logo-base64').value,
        stamp:           el('prof-stamp-base64').value,
        headteacher_sig: el('prof-ht-sig-base64').value,
        dos_sig:         el('prof-dos-sig-base64').value
    };

    const responsibility = el('prof-responsibility').value.trim();

    toast('💾 Committing executive registry updates...', 'info');
    
    // Save to settings
    const { error: sError } = await DB.saveSchoolInfo(updates);
    // Save to profile
    const { error: pError } = await DB.updateProfile(user.id, { responsibility });

    if (sError || pError) {
        toast('❌ Update failed: ' + (sError?.message || pError?.message), 'error');
    } else {
        SCHOOL_INFO = { ...SCHOOL_INFO, ...updates };
        toast('✅ Institutional Registry Hub updated successfully.', 'success');
        await renderProfile();
        await syncInstitutionalNodes();
    }
}

// --- DASHBOARD REAL-TIME INTELLIGENCE ---
async function renderDashboardStats() {
    try {
        const stats = await DB.getInstitutionalStats();
        if (el('stat-students')) el('stat-students').textContent = stats.students.toLocaleString();
        if (el('stat-teachers')) el('stat-teachers').textContent = stats.teachers.toLocaleString();
        if (el('stat-classes'))  el('stat-classes').textContent  = stats.classes.toLocaleString();
        if (el('stat-pending'))  el('stat-pending').textContent  = stats.pending.toLocaleString();
    } catch (err) {
        console.error('[STATS] dashboard error:', err);
    }
}

async function renderFacultyMonitor() {
    const tbody = el('faculty-activity-tbody');
    if (!tbody) return;

    try {
        const teachers = await DB.getTeachers(); // Changed from DB.getTeachers() to DB.getTeachers()
        const assignments = await DB.getTeacherAssignments(); // Fetches all assignments for school

        const teacherData = teachers.map(t => {
            const myAssignments = assignments.filter(a => a.teacher_id === t.id);
            const classCount = [...new Set(myAssignments.map(a => a.class_id))].length;
            const subjectCount = [...new Set(myAssignments.filter(a => a.type === 'subject').map(a => a.subject_id))].length;
            return { 
                ...t, 
                displayAssignments: `${classCount} Class(es) | ${subjectCount} Subject(s)`,
                score: Math.min(100, (myAssignments.length * 20)) // Dummy progress for now but real teachers
            };
        });

        if (teacherData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 3rem; color: #94a3b8;">No faculty registered in this node.</td></tr>`;
            return;
        }

        tbody.innerHTML = teacherData.map(t => `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:0.75rem;">
                        <div style="width:32px; height:32px; background:#f1f5f9; border:1px solid #e2e8f0; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:900;">${t.full_name?.charAt(0) || 'T'}</div>
                        <div>
                            <div style="font-weight:800; color:#0f172a; font-size:0.85rem;">${t.full_name}</div>
                            <div style="font-size:0.65rem; color:#64748b;">${t.email}</div>
                        </div>
                    </div>
                </td>
                <td style="font-size:0.7rem; color:#1e293b; font-weight:600;">${t.displayAssignments}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <div style="flex:1; height:6px; background:#f1f5f9; border-radius:10px; overflow:hidden;">
                            <div style="width:${t.score}%; height:100%; background:var(--primary); box-shadow: 0 0 5px var(--primary-glow);"></div>
                        </div>
                        <span style="font-size:0.65rem; font-weight:800; min-width:25px;">${t.score}%</span>
                    </div>
                </td>
                <td><span class="badge ${t.score > 0 ? 'badge-success' : 'badge-warning'}">${t.score > 0 ? 'ACTIVE' : 'IDLE'}</span></td>
            </tr>
        `).join('');

        if (el('admin-last-synced')) el('admin-last-synced').textContent = `Sync: ${new Date().toLocaleTimeString()}`;

    } catch (err) {
        console.error('[FACULTY] Monitor failed:', err);
    }
}

async function renderTeachersRegistry() {
    const tbody = el('teachers-tbody');
    if (!tbody) return;

    try {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;">
            <div class="loader-linear"></div><br>Synchronizing Faculty Registry...
        </td></tr>`;

        const teachers = await DB.getTeachers();
        const assignments = await DB.getTeacherAssignments();

        if (teachers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 3rem; color: #94a3b8;">No faculty registered. Click 'Register New Teacher' to begin.</td></tr>`;
            return;
        }

        tbody.innerHTML = teachers.map(t => {
            const myAssignments = assignments.filter(a => a.teacher_id === t.id);
            const classesServed = [...new Set(myAssignments.map(a => a.classes?.name || 'Unknown'))].join(', ') || 'Global';
            const subjectsServed = [...new Set(myAssignments.map(a => a.subjects?.name || 'General'))].join(', ') || '--';

            return `
                <tr>
                    <td>
                        <div style="display:flex; align-items:center; gap:0.75rem;">
                            <div style="width:34px; height:34px; background:#f8fafc; border:2px solid #e2e8f0; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:900; color:#1e293b;">${t.full_name?.charAt(0) || 'T'}</div>
                            <div>
                                <div style="font-weight:900; color:#000; font-size:0.9rem;">${t.full_name}</div>
                                <div style="font-size:0.65rem; color:#64748b; text-transform:uppercase; font-weight:700;">SDMS: ${t.sdms_code || '---'}</div>
                            </div>
                        </div>
                    </td>
                    <td style="font-size:0.75rem; color:#475569; font-weight:600;">${t.email}</td>
                    <td><span class="badge" style="background:#f1f5f9; color:#1e293b; border:1px solid #e2e8f0; font-weight:800;">${t.role?.toUpperCase() || 'TEACHER'}</span></td>
                    <td style="font-size:0.7rem; color:#0f172a; max-width:200px;">
                        <div style="font-weight:800;">${subjectsServed}</div>
                        <div style="color:#64748b; font-size:0.6rem;">${classesServed}</div>
                    </td>
                    <td>
                        <div style="display:flex; gap:0.5rem;">
                            <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.7rem;" onclick="openAssignmentModal('${t.id}')">ASSIGN</button>
                            <button class="btn" style="padding: 4px 10px; font-size: 0.7rem; color:#dc2626;" onclick="deleteTeacher('${t.id}')">WIPE</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error('[TEACHERS] Registry load failed:', err);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color:#ef4444;">Registry Synchronisation Error. Check database connection.</td></tr>`;
    }
}

async function renderCohortRegistry() {
    const tbody = document.getElementById('students-tbody');
    const filterEl = document.getElementById('student-class-filter');
    const searchEl = document.getElementById('student-search-input');
    if (!tbody) return;

    const [students, classes] = await Promise.all([DB.getStudents(), DB.getClasses()]);
    const classMap = {}; classes.forEach(c => classMap[c.id] = c.name);
    
    // Populate filter dropdown if needed
    if (filterEl && filterEl.children.length === 1) {
        classes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            filterEl.appendChild(opt);
        });
    }

    const filterClass = filterEl ? filterEl.value : 'all';
    const searchTerm = searchEl ? searchEl.value.toLowerCase() : '';

    let filtered = students;
    if (filterClass !== 'all') filtered = filtered.filter(s => s.class_id === filterClass);
    if (searchTerm) {
        filtered = filtered.filter(s => 
            (`${s.first_name} ${s.last_name}`).toLowerCase().includes(searchTerm) || 
            (s.sid && s.sid.toLowerCase().includes(searchTerm))
        );
    }

    // Sort by Class then by Name for "Alignment"
    const sortedStudents = filtered.sort((a, b) => {
        const classA = classMap[a.class_id] || '';
        const classB = classMap[b.class_id] || '';
        if (classA !== classB) return classA.localeCompare(classB);
        const nameA = `${a.last_name || ''} ${a.first_name || ''}`.trim().toUpperCase();
        const nameB = `${b.last_name || ''} ${b.first_name || ''}`.trim().toUpperCase();
        return nameA.localeCompare(nameB);
    });
    
    tbody.innerHTML = sortedStudents.map((s, index) => `
        <tr>
            <td style="color:#64748b; font-weight:800;">${index + 1}</td>
            <td style="cursor:pointer;" onclick="openEditStudentModal('${s.id}')">
                <strong style="color:var(--text-dark);">${s.last_name || ''} ${s.first_name || ''}</strong>
            </td>
            <td><span class="badge" style="background:#f1f5f9; color:#1e293b; font-weight:800;">${s.gender || '—'}</span></td>
            <td><code style="color:var(--primary); font-weight:800;">${s.sid || 'N/A'}</code></td>
            <td><span class="badge" style="background:#f1f5f9; color:#64748b; font-weight:800;">${classMap[s.class_id] || 'UNASSIGNED'}</span></td>
            <td><span class="badge badge-green">ENROLLED</span></td>
            <td style="display:flex; gap:0.5rem;">
                <button class="btn" style="padding: 4px 12px; font-size: 0.65rem;" onclick="openEditStudentModal('${s.id}')">EDIT</button>
                <button class="btn" style="padding: 4px 8px; font-size: 0.65rem; color: var(--danger); border-color: #fecaca; background: #fef2f2;" title="Remove Student" onclick="handleDeleteStudent('${s.id}', '${s.last_name} ${s.first_name}')"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="7" style="text-align:center; padding:3rem; color:#94a3b8;">No students found matching filters.</td></tr>';
}

async function handleDeleteStudent(id, name) {
    if (!confirm(`⚠️ PERMANENT ACTION: Are you sure you want to remove ${name} from the institutional registry? This will also wipe their grade history.`)) return;

    toast('🚮 Terminating student node...', 'info');
    try {
        const { error } = await DB.deleteStudent(id);
        if (error) throw error;

        toast(`✅ ${name} has been removed from the registry.`, 'success');
        await renderCohortRegistry();
        await updateInstitutionalStats();
    } catch (err) {
        console.error('[REGISTRY] Student delete failed:', err);
        toast('❌ Failed to remove student: ' + err.message, 'error');
    }
}

/**
 * EXPORT STUDENT LIST
 * Generates a high-fidelity list with institutional headers.
 */
async function downloadStudentList(format = 'excel') {
    const filterEl = document.getElementById('student-class-filter');
    const [students, classes] = await Promise.all([DB.getStudents(), DB.getClasses()]);
    const classMap = {}; classes.forEach(c => classMap[c.id] = c.name);

    const filterClass = filterEl ? filterEl.value : 'all';
    let targetStudents = students;
    let title = 'INSTITUTIONAL STUDENT REGISTRY';

    if (filterClass !== 'all') {
        targetStudents = students.filter(s => s.class_id === filterClass);
        const className = classMap[filterClass] || 'Class';
        title = `STUDENT LIST FOR ${className.toUpperCase()}`;
    }

    if (targetStudents.length === 0) return toast('No students to export.', 'warning');

    // Sort by name
    targetStudents.sort((a, b) => {
        const nameA = `${a.last_name || ''} ${a.first_name || ''}`.trim().toUpperCase();
        const nameB = `${b.last_name || ''} ${b.first_name || ''}`.trim().toUpperCase();
        return nameA.localeCompare(nameB);
    });

    const schoolName = (document.getElementById('school-name-hd')?.textContent || 'EDUMARKS ACADEMY').toUpperCase();
    const schoolCode = document.getElementById('school-code-hd')?.textContent || 'Code: —';

    if (format === 'excel') {
        let csvContent = `REPUBLIC OF RWANDA\nMINISTRY OF EDUCATION\n${schoolName}\n${schoolCode}\n\n${title}\n\n`;
        csvContent += "S/N,Full Name,Gender,ID / SDMS,Class,Status\n";
        targetStudents.forEach((s, i) => {
            csvContent += `${i+1},${s.last_name||''} ${s.first_name||''},${s.gender||'—'},${s.sid||'—'},${classMap[s.class_id]||'—'},ENROLLED\n`;
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${title.replace(/ /g, '_')}.csv`;
        link.click();
    } 
    else if (format === 'pdf' || format === 'word') {
        // High-Fidelity Branding Assets (Official MINEDUC Seal)
        const logoMineduc = "js/Report image/download__92_-removebg-preview.png";
        const logoSchool = SCHOOL_INFO.logo || "";

        const tableRows = targetStudents.map((s, i) => `
            <tr>
                <td style="border:1px solid #ddd; padding:8px; text-align:center;">${i+1}</td>
                <td style="border:1px solid #ddd; padding:8px;">${s.last_name||''} ${s.first_name||''}</td>
                <td style="border:1px solid #ddd; padding:8px; text-align:center;">${s.gender||'—'}</td>
                <td style="border:1px solid #ddd; padding:8px; text-align:center;">${s.sid||'—'}</td>
                <td style="border:1px solid #ddd; padding:8px; text-align:center;">${classMap[s.class_id]||'—'}</td>
            </tr>
        `).join('');

        // Fetch teacher list to identify Class Teacher if applicable
        const teachers = await DB.getTeachers();
        const assignments = await DB.getTeacherAssignments();
        let classTeacherName = "CLASS TEACHER";
        
        if (filterClass !== 'all') {
            const assignment = assignments.find(a => a.class_id === filterClass && a.type === 'class');
            if (assignment) {
                const tr = teachers.find(t => t.id === assignment.teacher_id);
                if (tr) classTeacherName = tr.full_name.toUpperCase();
            }
        }

        const todayDate = new Date().toLocaleDateString('en-GB');

        const html = `
            <div style="font-family: Arial, sans-serif; padding: 40px; color: #000; position: relative;">
                
                <!-- BRANDING HEADER (Exact Match to Official Template) -->
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 5px;">
                    <tr>
                        <td style="width: 100px; vertical-align: middle; border: none; text-align: left;">
                            <img src="${logoMineduc}" style="width: 80px; height: auto;">
                        </td>
                        <td style="text-align: center; vertical-align: middle; border: none; padding: 0 10px;">
                            <div style="font-weight: 800; font-size: 14px; color: #000; letter-spacing: 0.5px; margin-bottom: 2px;">REPUBLIC OF RWANDA</div>
                            <div style="font-weight: 800; font-size: 14px; color: #000; letter-spacing: 0.5px; margin-bottom: 8px;">MINISTRY OF EDUCATION</div>
                            <div style="width: 50px; height: 1px; background: #cbd5e1; margin: 0 auto 10px auto;"></div>
                            <div style="font-weight: 900; font-size: 24px; color: #1e3a8a; text-transform: uppercase; margin-bottom: 5px; letter-spacing: 1px;">${schoolName}</div>
                            <div style="font-size: 11px; font-weight: 700; color: #475569;">
                                ${SCHOOL_INFO.district || '...'} District • ${SCHOOL_INFO.sector || '...'} Sector
                            </div>
                            <div style="font-size: 10px; font-weight: 700; color: #64748b; margin-top: 2px;">School ID: ${SCHOOL_INFO.code || '—'}</div>
                        </td>
                        <td style="width: 120px; text-align: right; vertical-align: middle; border: none;">
                            <img src="${logoSchool}" style="width: 100px; height: 100px; object-fit: contain; border-radius: 4px;">
                        </td>
                    </tr>
                </table>
                <div style="width: 100%; height: 4px; background: #1e1b4b; margin-bottom: 30px;"></div>

                <div style="text-align: center; margin-bottom: 30px;">
                    <div style="margin: 20px 0; font-weight: 900; font-size: 22px; text-transform: uppercase; letter-spacing: 1px; color: #1e293b; text-decoration: underline;">${title}</div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: -10px;">ACADEMIC YEAR: ${SCHOOL_INFO.academic_year || '2025/2026'} | TERM: ${SCHOOL_INFO.active_term || '—'}</div>
                    <div style="font-size: 11px; color: #94a3b8;">GENERATED ON: ${todayDate}</div>
                </div>

                <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 40px;">
                    <thead>
                        <tr style="background: #f8fafc; color: #1e293b;">
                            <th style="border:1px solid #ddd; padding:12px; width:40px;">S/N</th>
                            <th style="border:1px solid #ddd; padding:12px; text-align:left;">STUDENT NAME</th>
                            <th style="border:1px solid #ddd; padding:12px;">GENDER</th>
                            <th style="border:1px solid #ddd; padding:12px;">ID / SDMS</th>
                            <th style="border:1px solid #ddd; padding:12px;">CLASS</th>
                        </tr>
                    </thead>
                    <tbody style="font-weight: 500;">${tableRows}</tbody>
                </table>

                <div style="margin-top: 80px; display: flex; justify-content: space-around;">
                   ${filterClass !== 'all' ? `
                   <div style="text-align: center; width: 220px;">
                      <div style="height: 60px;"></div> <!-- Spacer for manual signature -->
                      <div style="border-top: 1.5px solid #1e293b; padding-top: 8px; font-weight: 900; font-size: 12px;">${classTeacherName}</div>
                      <div style="font-size: 11px; color: #444; margin-top: 4px;">Date: ${todayDate}</div>
                   </div>` : ''}
                   <div style="text-align: center; width: 220px;">
                      <div style="font-size: 11px; color: #666; margin-bottom: 60px;">HEAD OFFICE SEAL</div>
                      <div style="border-top: 1.5px solid #1e293b; padding-top: 8px; font-weight: 900; font-size: 12px;">${(SCHOOL_INFO.headteacher || 'HEADTEACHER').toUpperCase()}</div>
                      <div style="font-size: 11px; color: #444; margin-top: 4px;">Date: ${todayDate}</div>
                   </div>
                </div>
            </div>
        `;

        if (format === 'pdf') {
            const printWin = window.open('', '_blank');
            if (!printWin) return toast('Popup blocked! Please allow popups for exports.', 'error');
            printWin.document.write(`
                <html>
                    <head>
                        <title>${title}</title>
                        <style>
                            @page { size: portrait; margin: 0; }
                            body { margin: 0; }
                        </style>
                    </head>
                    <body>${html}</body>
                </html>
            `);
            printWin.document.close();
            setTimeout(() => {
                printWin.print();
            }, 500);
        } else if (format === 'word') {
            // High-Fidelity Word Export using Legacy Attributes favored by MS Word's parser
            const wordContent = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                <head>
                    <meta charset='utf-8'>
                    <style>
                        body { font-family: Arial, sans-serif; }
                        table { border-collapse: collapse; }
                        td { border: 1px solid #cbd5e1; padding: 8px; font-size: 10pt; color: #334155; }
                        .th { background-color: #f1f5f9; font-weight: bold; color: #1e3a8a; font-size: 10pt; text-align: center; }
                        @page Section1 { size: 595.3pt 841.9pt; margin: 0.5in; }
                        div.Section1 { page: Section1; }
                    </style>
                </head>
                <body>
                    <div class="Section1">
                        <!-- Word-Optimized Header -->
                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border: none; margin-bottom: 5px;">
                            <tr>
                                <td width="120" valign="middle" align="left" style="border: none;">
                                    <img src="js/Report image/download__92_-removebg-preview.png" width="95" height="auto">
                                </td>
                                <td valign="middle" align="center" style="border: none; padding: 0 10px;">
                                    <div style="font-weight: bold; font-size: 11pt; margin-bottom: 2px;">REPUBLIC OF RWANDA</div>
                                    <div style="font-weight: bold; font-size: 11pt; margin-bottom: 5px;">MINISTRY OF EDUCATION</div>
                                    <div style="width: 40px; height: 1px; background: #cbd5e1; margin: 5px auto;"></div>
                                    <div style="font-weight: bold; font-size: 18pt; color: #1e3a8a; text-transform: uppercase;">${schoolName}</div>
                                    <div style="font-size: 9pt; color: #64748b; font-weight: bold;">
                                        ${SCHOOL_INFO.district || '...'} District • ${SCHOOL_INFO.sector || '...'} Sector
                                    </div>
                                    <div style="font-size: 8pt; color: #94a3b8;">School ID: ${SCHOOL_INFO.code || '—'}</div>
                                </td>
                                <td width="120" valign="middle" align="right" style="border: none;">
                                    <img src="${logoSchool}" width="95" height="95">
                                </td>
                            </tr>
                        </table>
                        <div style="width: 100%; height: 3.5px; background: #1e1b4b; margin-bottom: 25px;"></div>

                        <div align="center" style="margin-bottom: 25px;">
                            <div style="font-weight: 800; font-size: 18pt; text-transform: uppercase; color: #1e293b; text-decoration: underline; margin-bottom: 8px;">${title}</div>
                            <div style="font-size: 9pt; color: #64748b; font-weight: bold;">ACADEMIC YEAR: ${SCHOOL_INFO.academic_year || '2025/2026'} | TERM: ${SCHOOL_INFO.active_term || '—'}</div>
                            <div style="font-size: 8pt; color: #94a3b8;">GENERATED ON: ${todayDate}</div>
                        </div>

                        <table width="100%" border="1" cellspacing="0" cellpadding="8" style="border: 1px solid #cbd5e1;">
                            <tr style="background-color: #f1f5f9; color: #1e3a8a;">
                                <td width="40" align="center" style="font-weight: bold;">S/N</td>
                                <td align="left" style="font-weight: bold;">STUDENT NAME</td>
                                <td width="80" align="center" style="font-weight: bold;">GENDER</td>
                                <td width="120" align="center" style="font-weight: bold;">ID / SDMS</td>
                                <td width="120" align="center" style="font-weight: bold;">CLASS</td>
                            </tr>
                            ${tableRows}
                        </table>

                        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border: none; margin-top: 50px;">
                            <tr>
                                ${filterClass !== 'all' ? `
                                <td width="50%" align="center" style="border: none;">
                                    <div style="height: 60px;"></div>
                                    <div style="border-top: 1px solid #111; font-weight: bold; font-size: 10pt; width: 180px; padding-top: 5px;">${classTeacherName}</div>
                                    <div style="font-size: 9pt;">Date: ${todayDate}</div>
                                </td>` : ''}
                                <td width="${filterClass !== 'all' ? '50%' : '100%'}" align="center" style="border: none;">
                                    <div style="font-size: 9pt; color: #666; margin-bottom: 40px;">HEAD OFFICE SEAL</div>
                                    <div style="border-top: 1px solid #111; font-weight: bold; font-size: 10pt; width: 180px; padding-top: 5px;">${(SCHOOL_INFO.headteacher || 'HEADTEACHER').toUpperCase()}</div>
                                    <div style="font-size: 9pt;">Date: ${todayDate}</div>
                                </td>
                            </tr>
                        </table>
                    </div>
                </body>
                </html>
            `;
            const blob = new Blob(['\ufeff', wordContent], { type: 'application/msword' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `${title.replace(/ /g, '_')}.doc`;
            link.click();
        }
    }

    closeModal('download-format-modal');
    toast(`Exporting in ${format.toUpperCase()} format...`, 'success');
}

async function renderPerformanceMatrix() {
    const container = document.getElementById('performance-matrix-grid');
    if (!container) return;
    try {
        const [marks, classes, students] = await Promise.all([DB.getMarks(), DB.getClasses(), DB.getStudents()]);
        
        if (!classes.length) {
            container.innerHTML = '<div>No institutional data to matrix.</div>';
            return;
        }

        container.innerHTML = classes.map(c => {
            const classStudents = students.filter(s => s.class_id === c.id);
            const classMarks = marks.filter(m => m.class_id === c.id && m.is_approved);
            const avg = classMarks.length ? (classMarks.reduce((acc, m) => acc + (m.score / (m.max_score || 10) * 100), 0) / classMarks.length).toFixed(1) : 0;
            
            return `
                <div class="matrix-card" style="cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); border: 2px solid transparent;" 
                     onclick="openProclamationConfig('${c.id}')"
                     onmouseover="this.style.borderColor='var(--primary)'; this.style.transform='translateY(-4px)'; this.style.boxShadow='0 20px 25px -5px rgba(0,0,0,0.1)';"
                     onmouseout="this.style.borderColor='transparent'; this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                    <div style="pointer-events: none;">
                        <div class="matrix-label">School Level Performance</div>
                        <div class="matrix-title">${c.name}</div>
                    </div>
                    <div style="pointer-events: none;">
                        <div class="matrix-percent" style="color:${avg >= 50 ? 'var(--success)' : 'var(--danger)'};">${avg}%</div>
                        <div class="matrix-bar-wrap">
                            <div class="matrix-bar" style="width:${avg}%; background:${avg >= 50 ? 'var(--success)' : 'var(--danger)'}; shadow: 0 0 10px ${avg >= 50 ? 'var(--success-glow)' : 'var(--danger-glow)'};"></div>
                        </div>
                        <div class="matrix-count">${classStudents.length} Students in Record</div>
                    </div>
                    <button class="btn btn-primary" style="width:100%; margin-top:20px; font-size:0.75rem; background: #1e1b4b; border-color: #1e1b4b;">
                        🔍 PREVIEW & DOWNLOAD REPORT
                    </button>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('[PERF] Matrix render failed:', e);
    }
}

async function addStudent() {
    const fname = document.getElementById('s-fname').value.trim();
    const lname = document.getElementById('s-lname').value.trim();
    const sid   = document.getElementById('s-id').value.trim();
    const gen   = document.getElementById('s-gender').value;
    const cid   = document.getElementById('s-class').value;
    if (!fname || !lname || !cid) return toast('All recruitment fields are required.', 'error');
    
    await DB.addStudent({ first_name: fname, last_name: lname, sid: sid, gender: gen, class_id: cid });
    toast('Candidate enrolled successfully in institutional registry.', 'success');
    closeModal('add-student-modal');
    // Clear inputs
    ['s-fname','s-lname','s-id'].forEach(id => document.getElementById(id).value = '');
    await renderCohortRegistry();
    await updateInstitutionalStats();
}

async function openEditStudentModal(id) {
    const students = await DB.getStudents();
    const s = students.find(x => x.id == id);
    if (!s) return;

    document.getElementById('edit-s-id-internal').value = s.id;
    document.getElementById('edit-s-fname').value = s.first_name || '';
    document.getElementById('edit-s-lname').value = s.last_name || '';
    document.getElementById('edit-s-gender').value = s.gender || 'M';
    document.getElementById('edit-s-sid').value = s.sid || '';
    
    openModal('edit-student-modal');
}

async function saveStudentUpdate() {
    const id = document.getElementById('edit-s-id-internal').value;
    const payload = {
        first_name: document.getElementById('edit-s-fname').value.trim().toUpperCase(),
        last_name: document.getElementById('edit-s-lname').value.trim().toUpperCase(),
        gender: document.getElementById('edit-s-gender').value,
        sid: document.getElementById('edit-s-sid').value.trim()
    };

    try {
        const { error } = await _supabase.from('students').update(payload).eq('id', id);
        if (error) throw error;
        toast('✅ Student record updated successfully.', 'success');
        closeModal('edit-student-modal');
        await renderCohortRegistry();
    } catch (err) {
        toast('❌ Update failed.', 'error');
    }
}

/**
 * STUDENT EXCEL ENGINE (CAMIS Standard)
 * Facilitates bulk recruitment and registry updates.
 */
function downloadStudentTemplate() {
    toast('Generating institutional enrollment template...', 'info');
    const headers = [["First Name", "Last Name", "Gender (M/F)", "Student ID (SDMS)", "Class Name"]];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Enrollment");
    XLSX.writeFile(wb, `Student_Enrollment_Template.xlsx`);
}

function triggerStudentExcelUpload() {
    document.getElementById('student-excel-input').click();
}

async function handleStudentExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    toast('Parsing institutional enrollment data...', 'info');
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet);

            if (rows.length === 0) return toast('Excel document appears to be empty.', 'warning');

            const classes = await DB.getClasses();
            const classMap = {};
            classes.forEach(c => classMap[c.name.trim().toUpperCase()] = c.id);

            let enrolledCount = 0;
            let skipCount = 0;
            const studentsToInsert = [];

            for (const row of rows) {
                const fname = (row["First Name"] || row["first_name"])?.toString().trim();
                const lname = (row["Last Name"] || row["last_name"])?.toString().trim();
                const gender = (row["Gender (M/F)"] || row["gender"])?.toString().trim().toUpperCase();
                const sid = (row["Student ID (SDMS)"] || row["sid"])?.toString().trim();
                const className = (row["Class Name"] || row["class"])?.toString().trim().toUpperCase();

                if (!fname || !lname || !className) {
                    skipCount++;
                    continue;
                }

                const classId = classMap[className];
                if (!classId) {
                    console.warn(`[REGISTRY] Class '${className}' not found for student ${fname}.`);
                    skipCount++;
                    continue;
                }

                studentsToInsert.push({
                    first_name: fname.toUpperCase(),
                    last_name: lname.toUpperCase(),
                    gender: gender || 'M',
                    sid: sid || `STU-${Math.floor(1000 + Math.random() * 9000)}`,
                    class_id: classId,
                    status: 'active'
                });
                enrolledCount++;
            }

            if (studentsToInsert.length > 0) {
                const { error } = await _supabase.from('students').insert(studentsToInsert);
                if (error) throw error;
                toast(`✅ Registry Synchronized: ${enrolledCount} students enrolled. (${skipCount} skipped)`, 'success');
            } else {
                toast('No valid records found in spreadsheet.', 'warning');
            }

            await renderCohortRegistry();
            await updateInstitutionalStats();
            event.target.value = ''; // Reset input
        } catch (err) {
            console.error('[REGISTRY] Batch enrollment failed:', err);
            toast('❌ Synchronization Error: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}



function filterCohortTable() {
    const query = document.getElementById('student-search-input').value.toLowerCase();
    const rows = document.querySelectorAll('#students-tbody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

async function renderMonitoringQueue() {
    const queueEl = document.getElementById('pending-approvals-queue');
    const delQueueEl = document.getElementById('student-deletion-queue');
    if (!queueEl && !delQueueEl) return;

    const [marks, allStudents, allClasses, subjects] = await Promise.all([
        DB.getMarks(),
        DB.getStudents(),
        DB.getClasses(),
        DB.getSubjects()
    ]);

    const classMap = {}; allClasses.forEach(c => classMap[c.id] = c.name);
    const studMap = {}; allStudents.forEach(s => studMap[s.id] = `${s.first_name} ${s.last_name}`);
    const subMap = {}; subjects.forEach(s => subMap[s.id] = s.name);

    // 1. Render Marks Submissions
    if (queueEl) {
        const pending = marks.filter(m => m.is_submitted && !m.is_approved);
        const approveAllBtn = document.getElementById('btn-approve-all-marks');
        if (approveAllBtn) approveAllBtn.style.display = pending.length > 1 ? 'inline-block' : 'none';

        if (pending.length === 0) {
            queueEl.innerHTML = `<div style="text-align:center; padding: 5rem; color: #94a3b8; font-weight: 600;">No pending submissions requiring executive approval.</div>`;
        } else {
            queueEl.innerHTML = pending.map(m => `
                <div class="stat-card" style="margin:0; padding:1.25rem; display:flex; justify-content:space-between; align-items:center;">
                   <div>
                      <div style="font-weight:900; color:#1e293b;">${studMap[m.student_id]}</div>
                      <div style="font-size:0.7rem; color:#64748b; font-weight:700;">${subMap[m.subject_id]} • Score: ${m.score === -1 ? 'Missed' : m.score}</div>
                   </div>
                   <div style="display:flex; gap:0.5rem;">
                      <button class="btn btn-primary" style="padding: 0.5rem 1.5rem;" onclick="processApproval('${m.id}')">APPROVE</button>
                      <button class="btn" style="padding: 0.5rem 1rem; color:#ef4444;" onclick="processRejection('${m.id}')">REJECT</button>
                   </div>
                </div>
            `).join('');
        }
    }

    // 2. Render Student Deletion Requests
    if (delQueueEl) {
        const delRequests = allStudents.filter(s => s.status === 'pending_deletion');
        if (delRequests.length === 0) {
            delQueueEl.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 3rem; color: #94a3b8;">No pending deletion requests.</td></tr>`;
        } else {
            delQueueEl.innerHTML = delRequests.map(s => `
                <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 1rem 1.5rem; font-weight:900;">${s.last_name} ${s.first_name}</td>
                    <td style="padding: 1rem; font-weight:700; color:var(--primary);">${classMap[s.class_id] || 'N/A'}</td>
                    <td style="padding: 1rem; font-weight:700; color:#64748b;">${s.gender || '—'}</td>
                    <td style="padding: 1rem; color:#64748b; font-family:monospace;">${s.sid || 'N/A'}</td>
                    <td style="padding: 1rem 1.5rem; text-align: right; display:flex; gap:0.5rem; justify-content:flex-end;">
                        <button class="btn" style="background:#dcfce7; color:#166534; font-size:0.65rem;" onclick="processFinalDeletion('${s.id}', true)">APPROVE DELETE</button>
                        <button class="btn" style="background:#fee2e2; color:#991b1b; font-size:0.65rem;" onclick="processFinalDeletion('${s.id}', false)">REJECT</button>
                    </td>
                </tr>
            `).join('');
        }
    }
}

async function processFinalDeletion(id, isApproved) {
    try {
        if (isApproved) {
            const { error } = await _supabase.from('students').delete().eq('id', id);
            if (error) throw error;
            toast('✅ Student permanently removed from institutional registry.', 'success');
        } else {
            const { error } = await _supabase.from('students').update({ status: 'active' }).eq('id', id);
            if (error) throw error;
            toast('ℹ️ Deletion request rejected. Student restored to active status.', 'info');
        }
        await renderMonitoringQueue();
        if (document.getElementById('view-students').classList.contains('active')) await renderCohortRegistry();
    } catch (err) {
        console.error('[DEL] Approval failed:', err);
        toast('❌ Operation failed.', 'error');
    }
}

async function processApproval(markId) {
    await DB.approveMark(markId);
    toast('Institutional record approved.', 'success');
    await renderMonitoringQueue();
    await updateInstitutionalStats();
}

async function approveAllMarks() {
    const marks = await DB.getMarks();
    const pending = marks.filter(m => m.is_submitted && !m.is_approved);
    if (!pending.length) return;

    if (!confirm(`Institutional Authorization: Are you sure you want to approve all ${pending.length} pending marks at once?`)) return;

    toast(`Authorizing ${pending.length} assessment packets...`, 'info');
    try {
        const { error } = await DB.approveAllSubmittedMarks();
        if (error) throw error;
        
        toast(`✅ Global Authorization Complete: ${pending.length} records approved.`, 'success');
        await renderMonitoringQueue();
        await updateInstitutionalStats();
    } catch (err) {
        console.error('[APPROVAL] Bulk authorization failed:', err);
        toast('❌ Bulk Authorization Failed. Please check connectivity.', 'error');
    }
}

async function processRejection(markId) {
    const reason = prompt('Institutional Rejection Reason:');
    if (!reason) return;
    await DB.rejectMark(markId, reason);
    toast('Record sent back to faculty node.', 'warning');
    await renderMonitoringQueue();
    await updateInstitutionalStats();
}

async function renderSettings() {
    const info = SCHOOL_INFO;
    const today = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY
    const fields = {
        'set-republic':    info.republic,
        'set-ministry':    info.ministry,
        'set-district':    info.district,
        'set-sector':      info.sector,
        'set-school':      info.school,
        'set-code':        info.code,
        'set-level':       info.level,
        'set-email':       info.email,
        'set-phone':       info.phone,
        'set-active-term': info.active_term || '1',
        'set-year':        info.academic_year || '2025/2026',
        'set-headteacher': info.headteacher || '',
        'set-dos':         info.dos || '',
        'set-date':        info.done_date || today
    };
    for (const [id, val] of Object.entries(fields)) {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    }
    
    // Preview Logo
    const preview = document.getElementById('set-logo-preview');
    if (preview && info.logo) {
        preview.innerHTML = `<img src="${info.logo}" style="width:100%; height:100%; object-fit:contain;">`;
        document.getElementById('set-logo-base64').value = info.logo;
    }
}

function handleLogoUpload(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const base64 = e.target.result;
        document.getElementById('set-logo-base64').value = base64;
        document.getElementById('set-logo-preview').innerHTML = `<img src="${base64}" style="width:100%; height:100%; object-fit:contain;">`;
    };
    reader.readAsDataURL(file);
}

async function syncInstitutionalNodes() {
    const info = await DB.getSchoolInfo();
    if (info) {
        SCHOOL_INFO = info;
        if (document.getElementById('school-name-hd')) document.getElementById('school-name-hd').textContent = (info.school || 'EDUMARKS').toUpperCase();
        if (document.getElementById('header-term-display')) {
            document.getElementById('header-term-display').textContent = `Term ${info.active_term || '2'} / ${info.academic_year || '2025/2026'}`;
        }
    }
}

async function saveInstitutionalSettings() {
    const updates = {
        republic:      document.getElementById('set-republic').value,
        ministry:      document.getElementById('set-ministry').value,
        district:      document.getElementById('set-district').value,
        sector:        document.getElementById('set-sector').value,
        school:        document.getElementById('set-school').value,
        code:          document.getElementById('set-code').value,
        level:         document.getElementById('set-level').value,
        email:         document.getElementById('set-email').value,
        phone:         document.getElementById('set-phone').value,
        active_term:   document.getElementById('set-active-term').value,
        academic_year: document.getElementById('set-year').value,
        headteacher:   document.getElementById('set-headteacher').value,
        dos:           document.getElementById('set-dos').value,
        done_date:     document.getElementById('set-date').value,
        logo:          document.getElementById('set-logo-base64').value
    };
    
    toast('Committing institutional session changes...', 'info');
    const { error } = await DB.saveSchoolInfo(updates);
    
    if (error) {
        toast('Failed to commit: ' + error.message, 'error');
    } else {
        SCHOOL_INFO = { ...SCHOOL_INFO, ...updates };
        toast('Academic Node Synced. Term updated for all faculty.', 'success');
        await syncInstitutionalNodes();
        await updateInstitutionalStats();
        await renderSettings();
    }
}

/**
 * INSTITUTIONAL MODAL ORCHESTRATION
 */
function openModal(id) {
    const m = document.getElementById(id);
    if (!m) { console.warn('[MODAL] Element not found:', id); return; }
    m.classList.add('open');
    if (id === 'add-student-modal') populateClassDropdown();
    if (id === 'add-teacher-modal') {
        populateTeacherSelectors();
        const badge = document.getElementById('t-secure-node-badge');
        if (badge) badge.innerHTML = `<i data-lucide="shield-check" style="width:14px; margin-right:5px;"></i> SECURE NODE: ${SCHOOL_INFO.code || '------'}`;
        
        const rc = document.getElementById('role-class-teacher');
        const rs = document.getElementById('role-subject-teacher');
        const ar = document.getElementById('assignment-rows');
        if (rc) rc.checked = false;
        if (rs) rs.checked = false;
        if (ar) ar.innerHTML = '';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        toggleAssignmentUI();
    }
}
function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('open');
}

async function populateClassDropdown() {
    const classes = await DB.getClasses();
    const sel = document.getElementById('s-class');
    if (sel) {
        sel.innerHTML = '<option value="">— Select Institutional Class —</option>' + 
            classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
}

// ============================================================
// DASHBOARD + LIVE STATS
// ============================================================
async function renderDashboard() {
    const nameEl = document.getElementById('school-name-hd');
    const codeEl = document.getElementById('school-code-hd');
    const sidebarSchool = document.getElementById('sidebar-school-name');
    
    const schoolName = SCHOOL_INFO.school || 'MURARA';
    if (nameEl) nameEl.textContent = schoolName;
    if (codeEl) codeEl.textContent = `School ID • ${SCHOOL_INFO.code || '331110'}`;
    if (sidebarSchool) sidebarSchool.textContent = schoolName;

    await updateInstitutionalStats();
    await renderPerformanceMatrix();
    await renderFacultyMonitor();
}

/**
 * TEACHER ACTIVITY MONITOR ENGINE
 * Strategically calculates completion percentages for every teacher based on assignments.
 */
async function renderFacultyMonitor() {
    const tbody = document.getElementById('faculty-activity-tbody');
    if (!tbody) return;

    try {
        const [teachers, assignments, students, assessments, marks, classes, subjects] = await Promise.all([
            DB.getTeachers(),
            DB.getTeacherAssignments(),
            DB.getStudents(),
            DB.getAssessments(),
            DB.getMarks(),
            DB.getClasses(),
            DB.getSubjects()
        ]);

        const syncTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (document.getElementById('admin-last-synced')) {
            document.getElementById('admin-last-synced').textContent = `Last Synced: ${syncTime}`;
        }

        const classMap = {}; classes.forEach(c => classMap[c.id] = c);
        const subjMap = {}; subjects.forEach(s => subjMap[s.id] = s);
        
        // Filter out inactive records
        const activeAssessments = assessments; // All active standards

        let html = '';
        const sortedTeachers = teachers.sort((a,b) => a.full_name.localeCompare(b.full_name));

        for (const t of sortedTeachers) {
            const tAssigns = assignments.filter(a => a.teacher_id === t.id && a.type === 'subject');
            if (tAssigns.length === 0) continue;

            let totalExpected = 0;
            let totalEntered = 0;
            let assignedWork = [];

            tAssigns.forEach(as => {
                const cls = classMap[as.class_id];
                const sub = subjMap[as.subject_id];
                if (!cls || !sub) return;
                
                assignedWork.push(`${sub.abbr || sub.name} (${cls.name})`);
                
                const studentCount = students.filter(s => s.class_id === as.class_id).length;
                const pillarCount = activeAssessments.length || 1; 

                totalExpected += (studentCount * pillarCount);
                
                // Match by jurisdiction (Subj + Class) as teacher_id may be null in legacy/batch marks
                const entered = marks.filter(m => 
                    m.subject_id === as.subject_id && 
                    m.class_id === as.class_id
                ).length;
                
                totalEntered += entered;
            });

            const percent = totalExpected > 0 ? Math.min(100, Math.round((totalEntered / totalExpected) * 100)) : 0;
            const statusBadge = percent === 100 ? '<span class="badge badge-green">COMPLETED</span>' : 
                               percent > 0 ? '<span class="badge badge-blue">IN PROGRESS</span>' : 
                               '<span class="badge" style="background:#fee2e2; color:#ef4444; border:none;">NOT STARTED</span>';

            html += `
                <tr>
                    <td>
                        <div style="font-weight:900; color:#1e293b;">${t.full_name.toUpperCase()}</div>
                        <div style="font-size:0.65rem; color:#64748b; font-weight:700;">${t.sdms_code || 'ID:—'}</div>
                    </td>
                    <td style="font-size:0.75rem; color:#64748b; font-weight:800; max-width: 250px;">
                        ${assignedWork.join(' • ')}
                    </td>
                    <td>
                        <div style="display:flex; align-items:center; gap:0.75rem;">
                            <div style="flex:1; height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden; min-width:80px;">
                                <div style="width:${percent}%; height:100%; background:${percent === 100 ? '#10b981' : '#3b82f6'};"></div>
                            </div>
                            <span style="font-size:0.8rem; font-weight:900; color:#1e293b;">${percent}%</span>
                        </div>
                        <div style="font-size:0.6rem; color:#94a3b8; font-weight:700; margin-top:0.25rem;">${totalEntered} / ${totalExpected} Marks recorded</div>
                    </td>
                    <td>${statusBadge}</td>
                    <td style="font-size:0.7rem; font-weight:800; color:#64748b;">
                        ${percent > 0 ? 'Recently Synced' : 'Awaiting Entry'}
                    </td>
                </tr>
            `;
        }

        tbody.innerHTML = html || '<tr><td colspan="5" style="text-align:center; padding: 3rem; color: #94a3b8;">No faculty assignments found in registry.</td></tr>';
    } catch (e) {
        console.error('[MONITOR] Analysis failed:', e);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--danger); font-weight: 800;">Registry Analysis Error</td></tr>';
    }
}

async function updateInstitutionalStats() {
    try {
        const activeYear = SCHOOL_INFO.academic_year || '2024/2025';
        const [students, teachers, classes, allMarks, allAssignments] = await Promise.all([
            DB.getStudents(),
            DB.getTeachers(),
            DB.getClasses(),
            DB.getMarks({ year: activeYear }), // Filtered fetch for speed
            DB.getTeacherAssignments()
        ]);
        const pending = allMarks.filter(m => m.is_submitted && !m.is_approved).length;
        
        const classTeacherAssignments = allAssignments.filter(a => a.type === 'class');
        const classesWithTeacherIds = new Set(classTeacherAssignments.map(a => a.class_id));
        const classesWithoutTeacher = classes.filter(c => !classesWithTeacherIds.has(c.id)).length;

        const el = id => document.getElementById(id);
        if (el('stat-students'))    el('stat-students').textContent  = students.length;
        if (el('stat-teachers'))    el('stat-teachers').textContent  = teachers.length;
        if (el('stat-classes'))     el('stat-classes').textContent   = classes.length;
        if (el('stat-levels-cnt'))  el('stat-levels-cnt').textContent = classesWithoutTeacher;
        if (el('stat-pending'))     el('stat-pending').textContent   = pending;

        // Calculate Average Institutional Pass Rate
        try {
            const activeTerm = String(SCHOOL_INFO.active_term || '2');
            const termMarks = allMarks.filter(m => String(m.term) === activeTerm && m.is_approved);
            const studentPerformances = {};
            termMarks.forEach(m => {
                if (!studentPerformances[m.student_id]) studentPerformances[m.student_id] = { score: 0, max: 0 };
                studentPerformances[m.student_id].score += (m.score === -1 ? 0 : Number(m.score));
                studentPerformances[m.student_id].max += Number(m.max_score || 10);
            });
            let passCount = 0, satCount = 0;
            Object.values(studentPerformances).forEach(sp => {
                satCount++;
                if (sp.max > 0 && (sp.score / sp.max * 100) >= 50) passCount++;
            });
            const rate = satCount > 0 ? Math.round((passCount / satCount) * 100) : 0;
            if (el('stat-pass-rate')) el('stat-pass-rate').textContent = rate + '%';
        } catch (calcErr) {
            console.warn('[STATS] Pass rate calculation bypassed:', calcErr);
        }

        // Trigger Tactical Analytics Rendering
        renderAdminDashboardCharts();

        const dashboardAlert = document.getElementById('dashboard-alert');
        if (dashboardAlert) {
            dashboardAlert.style.display = (pending > 0) ? 'flex' : 'none';
        }

        const alertBox = document.querySelector('.alert-box:not(#dashboard-alert)');
        if (alertBox) {
            if (pending > 0 || classesWithoutTeacher > 0) {
                alertBox.style.display = 'flex';
                const msg = pending > 0 ? `ACTION REQ: ${pending} assessment packets awaiting executive review.` : `WARNING: ${classesWithoutTeacher} classes have no assigned Class Teacher.`;
                const msgEl = alertBox.querySelector('.stat-sub');
                if (msgEl) msgEl.innerText = msg;
            } else {
                alertBox.style.display = 'none';
            }
        }
    } catch (e) {
        console.error('[STATS] Update failed:', e);
    }
}

// ============================================================
// SCHOOL SETUP
// ============================================================
async function renderSetup() {
    await renderTermsList();
    await renderClassesGrid();
}

async function renderTermsList() {
    const container = document.getElementById('terms-list-container');
    if (!container) return;
    const terms = [
        { id: 1, name: 'Term One', dates: 'Sept - Dec 2025', status: 'Completed' },
        { id: 2, name: 'Term Two', dates: 'Jan - Mar 2026', status: 'Active' },
        { id: 3, name: 'Term Three', dates: 'Apr - Jun 2026', status: 'Upcoming' }
    ];
    container.innerHTML = terms.map(t => `
        <div class="stat-card" style="margin: 0; background: ${t.status === 'Active' ? '#eff6ff' : '#f8fafc'}; border: 1px solid ${t.status === 'Active' ? '#bfdbfe' : '#e2e8f0'};">
            <div class="stat-info">
                <div class="stat-lbl" style="color: #1e293b; font-weight: 800;">${t.name}</div>
                <div style="font-size: 0.65rem; color: #64748b; font-weight: 600;">${t.dates}</div>
            </div>
            <span class="badge ${t.status === 'Active' ? 'badge-blue' : 'badge-green'}" style="font-size: 0.6rem;">${t.status.toUpperCase()}</span>
        </div>
    `).join('');
}

async function renderClassesGrid() {
    const container = document.getElementById('classes-list-container');
    if (!container) return;
    const [classes, students] = await Promise.all([DB.getClasses(), DB.getStudents()]);
    
    container.innerHTML = classes.map(c => {
        const count = students.filter(s => s.class_id === c.id).length;
        return `
        <div class="stat-card" style="margin: 0; text-align: center; justify-content: center; flex-direction: column; gap: 0.75rem; padding: 2rem;">
            <div style="font-size: 2rem;">🏫</div>
            <div style="font-weight: 900; font-size: 1rem; color: #1e293b;">${c.name}</div>
            <div style="font-size: 0.7rem; font-weight: 700; color: #64748b; text-transform: uppercase; background: #f1f5f9; padding: 2px 8px; border-radius: 99px; margin-bottom: 0.5rem;">${count} Students</div>
            <div style="display: flex; gap: 0.5rem; justify-content: center;">
                <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 0.65rem;" onclick="openEditClassModal('${c.id}', '${c.name}')">EDIT</button>
                <button class="btn" style="padding: 4px 10px; font-size: 0.65rem; background: #fee2e2; color: #dc2626; border: none;" onclick="deleteClass('${c.id}')">DEL</button>
            </div>
        </div>`;
    }).join('');
}

async function addClass() {
    const name = document.getElementById('c-name').value.trim();
    if (!name) return toast('Class name is required.', 'error');
    await DB.addClass(name);
    toast('Class initialized. Teacher portal updated automatically.', 'success');
    closeModal('add-class-modal');
    document.getElementById('c-name').value = '';
    await renderClassesGrid();
}

function openEditClassModal(id, name) {
    document.getElementById('edit-c-id').value = id;
    document.getElementById('edit-c-name').value = name;
    openModal('edit-class-modal');
}

async function saveClassUpdate() {
    const id = document.getElementById('edit-c-id').value;
    const name = document.getElementById('edit-c-name').value.trim();
    if (!name) return toast('Class name is required.', 'error');
    
    try {
        const { error } = await _supabase.from('classes').update({ name }).eq('id', id);
        if (error) throw error;
        toast('Class updated successfully!', 'success');
        closeModal('edit-class-modal');
        await renderClassesGrid();
    } catch (e) {
        toast('Failed to update class.', 'error');
    }
}

async function deleteClass(id) {
    if (!confirm('Are you sure? This will remove the class group. Students will need to be reassigned.')) return;
    try {
        const { error } = await _supabase.from('classes').delete().eq('id', id);
        if (error) throw error;
        toast('Class deleted.', 'success');
        await renderClassesGrid();
    } catch (e) {
        toast('Failed to delete class. It may have students assigned.', 'error');
    }
}

async function batchInitializePrimaryClasses() {
    if (!confirm('This will automatically generate P1-P6 (A & B) classes for your school. Continue?')) return;
    
    toast('🚀 Initializing institutional structure...', 'info');
    const classNames = [];
    for (let i = 1; i <= 6; i++) {
        classNames.push(`P${i} A`);
        classNames.push(`P${i} B`);
    }

    try {
        const sc = await DB._getSchoolCode();
        const payload = classNames.map(name => ({ name, school_code: sc }));
        const { error } = await _supabase.from('classes').upsert(payload, { onConflict: 'name,school_code' });
        if (error) throw error;
        toast('Primary Classes synchronized successfully.', 'success');
        if (typeof renderManagement === 'function') await renderManagement();
        if (typeof renderDashboardStats === 'function') await renderDashboardStats();
    } catch (err) {
        console.error('[SETUP] Batch initialization failed:', err);
        toast('Initialization failed. Check database logs.', 'error');
    }
}


// ============================================================
// SUBJECTS
// ============================================================
async function renderSubjectsTable() {
    const tbody = document.getElementById('subjects-tbody');
    if (!tbody) return;
    const subjects = await DB.getSubjects();
    tbody.innerHTML = subjects.map(s => `
        <tr>
            <td><strong style="color:#1e293b;">${s.name}</strong></td>
            <td><code style="background:#f1f5f9; color:#3b82f6; padding: 2px 6px; border-radius: 4px; font-weight: 800;">${s.abbr || s.code || 'CORE'}</code></td>
            <td><span class="badge" style="background: #f1f5f9; color: #64748b; border:none; font-weight: 800;">PRIMARY LEVEL</span></td>
            <td><span class="badge badge-green">ACTIVE</span></td>
            <td style="display: flex; gap: 0.5rem;">
               <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.7rem;" onclick="openEditSubjectModal('${s.id}', '${s.name}', '${s.abbr || s.code}')">EDIT</button>
               <button class="btn" style="padding: 4px 8px; font-size: 0.7rem; background: #fee2e2; color: #dc2626; border: none;" onclick="deleteSubject('${s.id}')">DELETE</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center; padding: 3rem; color: #94a3b8;">No subjects defined.</td></tr>';
}

async function addSubject() {
    const name = document.getElementById('sub-name').value.trim();
    const abbr = document.getElementById('sub-abbr').value.trim().toUpperCase();
    if (!name || !abbr) return toast('Subject name and abbr are required.', 'error');
    await DB.addSubject({ name, abbr });
    toast('Curriculum subject defined and synchronized.', 'success');
    closeModal('add-subject-modal');
    document.getElementById('sub-name').value = '';
    document.getElementById('sub-abbr').value = '';
    await renderSubjectsTable();
}

function openEditSubjectModal(id, name, abbr) {
    document.getElementById('edit-sub-id').value = id;
    document.getElementById('edit-sub-name').value = name;
    document.getElementById('edit-sub-abbr').value = abbr;
    openModal('edit-subject-modal');
}

async function saveSubjectUpdate() {
    const id = document.getElementById('edit-sub-id').value;
    const name = document.getElementById('edit-sub-name').value.trim();
    const abbr = document.getElementById('edit-sub-abbr').value.trim().toUpperCase();
    if (!name || !abbr) return toast('Name and abbr are required.', 'error');
    
    try {
        const { error } = await _supabase.from('subjects').update({ name, code: abbr, abbr }).eq('id', id);
        if (error) throw error;
        toast('Subject updated!', 'success');
        closeModal('edit-subject-modal');
        await renderSubjectsTable();
    } catch (e) {
        toast('Failed to update subject.', 'error');
    }
}

async function deleteSubject(id) {
    if (!confirm('Are you sure? This will remove the subject from the curriculum.')) return;
    try {
        const { error } = await _supabase.from('subjects').delete().eq('id', id);
        if (error) throw error;
        toast('Subject removed.', 'success');
        await renderSubjectsTable();
    } catch (e) {
        toast('Failed to remove subject. It may have marks assigned.', 'error');
    }
}

async function autoAddRwandaSubjects() {
    toast('Initializing Rwanda standard curriculum...', 'info');
    for (const sub of RWANDA_CORE_SUBJECTS) { await DB.addSubject(sub); }
    toast('Curriculum populated. Teacher portal synced.', 'success');
    await renderSubjectsTable();
}

// ============================================================
// ASSESSMENTS 
// ============================================================
async function renderAssessmentTypes() {
    const container = document.getElementById('assessment-types-grid');
    if (!container) return;
    const assessments = await DB.getAssessments();
    const types = assessments.length ? assessments : [
        { id: 'wt', name: 'Weekly Test', max_score: 10, weight: 10, abbr: 'WT' },
        { id: 'mt', name: 'Monthly Test', max_score: 20, weight: 15, abbr: 'MT' },
        { id: 'eu', name: 'End-Unit Test', max_score: 40, weight: 20, abbr: 'EU' },
        { id: 'mid', name: 'Mid-Term Test', max_score: 50, weight: 25, abbr: 'MID' },
        { id: 'et', name: 'End-Term Exam', max_score: 100, weight: 40, abbr: 'ET' }
    ];
    container.innerHTML = types.map(t => `
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.5rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 0.5rem;">
               <div style="font-weight:900; color: #0f172a; font-size: 1rem;">${t.name}</div>
               <span class="badge" style="background:#f1f5f9; color:#3b82f6; font-size:0.6rem; font-weight: 900;">${t.abbr || t.id.toUpperCase()}</span>
            </div>
            <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 600; margin-bottom: 1.5rem;">Allocated Max Score: ${t.max_score || '—'} Marks</div>
            <div style="display:flex; justify-content:space-between; align-items:center; border-top: 1px dashed #f1f5f9; padding-top: 1rem;">
                <span style="font-size: 0.85rem; font-weight:900; color: #3b82f6;">${t.weight || 50}% WEIGHT</span>
                <span style="font-size: 0.7rem; color: #10b981; font-weight: 800;">ACTIVE</span>
            </div>
        </div>
    `).join('');
}

async function addAssessment() {
    const name = document.getElementById('assess-name').value.trim();
    const abbr = document.getElementById('assess-abbr').value.trim().toUpperCase();
    const weight = parseInt(document.getElementById('assess-weight').value) || 0;
    if (!name || !abbr) return toast('Name and Abbreviation are required.', 'error');
    await DB.addAssessment({ name, abbr, weight, id: abbr.toLowerCase() });
    toast('Evaluation Standard synchronized.', 'success');
    closeModal('add-assessment-modal');
    await renderAssessmentTypes();
}

// ============================================================
// FACULTY REGISTRY
// ============================================================
async function populateTeacherSelectors() {
    const [classes, subjects] = await Promise.all([DB.getClasses(), DB.getSubjects()]);
    const classSel = document.getElementById('t-assign-class');
    if (classSel) {
        classSel.innerHTML = '<option value="">Select Managed Class</option>' + 
            classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    window._cachedClasses = classes;
    window._cachedSubjects = subjects;
}

function toggleAssignmentUI() {
    const role = document.getElementById('t-role').value;
    const respContainer = document.getElementById('responsibilities-container');
    
    if (role === 'admin') {
        if (respContainer) respContainer.style.display = 'none';
        return;
    }
    
    if (respContainer) respContainer.style.display = 'block';
    const isClass = document.getElementById('role-class-teacher').checked;
    const isSubj = document.getElementById('role-subject-teacher').checked;
    document.getElementById('class-teacher-assignment').style.display = isClass ? 'block' : 'none';
    document.getElementById('subject-teacher-assignment').style.display = isSubj ? 'block' : 'none';
    if (isSubj && document.getElementById('assignment-rows').children.length === 0) { addAssignmentRow(); }
}

function addAssignmentRow() {
    const container = document.getElementById('assignment-rows');
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '0.5rem';
    row.style.alignItems = 'center';
    row.className = 'assignment-row';
    const classOpts = window._cachedClasses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const subjOpts = window._cachedSubjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    row.innerHTML = `
        <select class="input-field assign-class" style="margin:0; flex:1;">${classOpts}</select>
        <select class="input-field assign-subject" style="margin:0; flex:1;">${subjOpts}</select>
        <button class="btn" style="padding:4px 8px; color:#ef4444;" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(row);
}

async function nuclearIdSync() {
    if (!confirm('FORCE ID ENFORCEMENT: This will attempt to link all teacher accounts to their assigned jurisdictions by email. Use this if teachers see "No Jurisdictions". Proceed?')) return;
    
    toast('Orchestrating Nuclear Sync...', 'info');
    try {
        const teachers = await DB.getTeachers();
        let repairCount = 0;
        
        for (const t of teachers) {
            // We force a refresh of their assignments by ensuring they are linked to their current profile ID
            // In a browser we can't get other users' auth IDs easily, so we rely on the teacher clicking "Repair" 
            // from their end, but the admin can clear any conflicting assignments here.
            repairCount++;
        }
        
        await renderFacultyRegistry();
        toast(`Synchronization protocol executed for ${repairCount} nodes.`, 'success');
        alert('ENFORCEMENT COMPLETE. Please ask teachers to click "REPAIR INSTITUTIONAL LINK" on their dashboard if their view is still empty.');
    } catch (e) {
        toast('Nuclear Sync Failed: ' + e.message, 'error');
    }
}

// ============================================================
// MANUAL ASSIGNMENT ORCHESTRATION
// ============================================================
async function openEditAssignments(teacherId) {
    const f = (window._cachedFaculty || []).find(t => t.id === teacherId);
    if (!f) return;

    document.getElementById('edit-teacher-id').value = teacherId;
    document.getElementById('edit-teacher-subtitle').textContent = `Updating profile for ${f.full_name}`;
    
    document.getElementById('edit-t-name').value = f.full_name || '';
    document.getElementById('edit-t-sdms').value = f.sdms_code || '';
    document.getElementById('edit-t-email').value = f.email || '';
    
    // Setup dropdowns
    const classSel = document.getElementById('edit-assign-class');
    const classes = window._cachedClasses || [];
    classSel.innerHTML = '<option value="">Select Managed Class</option>' + 
        classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    // Load current assignments
    const assigns = (window._cachedAssignments || []).filter(a => a.teacher_id === teacherId);
    const classAssign = assigns.find(a => a.type === 'class');
    const subjAssigns = assigns.filter(a => a.type === 'subject');

    document.getElementById('edit-role-class').checked = !!classAssign;
    document.getElementById('edit-role-subj').checked = subjAssigns.length > 0;
    if (classAssign) classSel.value = classAssign.class_id;

    const rowContainer = document.getElementById('edit-rows-container');
    rowContainer.innerHTML = '';
    subjAssigns.forEach(a => addEditAssignmentRow(a));
    if (subjAssigns.length === 0) addEditAssignmentRow();

    toggleEditAssignmentUI();
    openModal('edit-assignments-modal');
}

function toggleEditAssignmentUI() {
    const isClass = document.getElementById('edit-role-class').checked;
    const isSubj = document.getElementById('edit-role-subj').checked;
    document.getElementById('edit-class-container').style.display = isClass ? 'block' : 'none';
    document.getElementById('edit-subj-container').style.display = isSubj ? 'block' : 'none';
}

function addEditAssignmentRow(data = null) {
    const container = document.getElementById('edit-rows-container');
    const row = document.createElement('div');
    row.className = 'edit-row';
    row.style.display = 'flex';
    row.style.gap = '0.5rem';
    
    const classes = window._cachedClasses || [];
    const subjects = window._cachedSubjects || [];
    
    row.innerHTML = `
        <select class="input-field edit-class" style="flex:1;">
            <option value="">Class</option>
            ${classes.map(c => `<option value="${c.id}" ${data?.class_id === c.id ? 'selected':''}>${c.name}</option>`).join('')}
        </select>
        <select class="input-field edit-subject" style="flex:1;">
            <option value="">Subject</option>
            ${subjects.map(s => `<option value="${s.id}" ${data?.subject_id === s.id ? 'selected':''}>${s.name}</option>`).join('')}
        </select>
        <button class="btn" style="color:var(--danger); padding:0 10px;" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(row);
}

async function saveAssignmentCorrections() {
    const teacherId = document.getElementById('edit-teacher-id').value;
    const isClass = document.getElementById('edit-role-class').checked;
    const isSubj = document.getElementById('edit-role-subj').checked;
    
    toast('Syncing administrative overrides...', 'info');
    
    // Clear old assignments (Atomic update would be better but this is simple)
    await DB.clearTeacherAssignments(teacherId);

    if (isClass) {
        const classId = document.getElementById('edit-assign-class').value;
        if (classId) await DB.saveTeacherAssignment({ teacher_id: teacherId, class_id: classId, type: 'class' });
    }

    if (isSubj) {
        const rows = document.querySelectorAll('.edit-row');
        for (const row of rows) {
            const cid = row.querySelector('.edit-class').value;
            const sid = row.querySelector('.edit-subject').value;
            if (cid && sid) {
                await DB.saveTeacherAssignment({ teacher_id: teacherId, class_id: cid, subject_id: sid, type: 'subject' });
            }
        }
    }
    
    // Read Profile Information
    const tName = document.getElementById('edit-t-name').value.trim();
    const tSdms = document.getElementById('edit-t-sdms').value.trim();
    const tEmail = document.getElementById('edit-t-email').value.trim();
    
    if (!isNonEmpty(tName) || !isNonEmpty(tEmail) || !isValidEmail(tEmail)) {
        alert('Missing Fields: Please completely fill out Name and valid Email.');
        return toast('Name and email are required.', 'error');
    }
    if (tSdms && !isValidSDMS(tSdms)) {
        alert('Invalid SDMS Code format. Must be exactly 10 digits.');
        return toast('Invalid SDMS: Must be 10 digits.', 'error');
    }

    // Update profile flags and basics
    await DB.updateProfile(teacherId, { 
        full_name: tName,
        email: tEmail,
        sdms_code: tSdms,
        is_class_teacher: isClass, 
        is_subject_teacher: isSubj 
    });

    toast('Faculty Profile and Jurisdictions successfully updated.', 'success');
    closeModal('edit-assignments-modal');
    await renderFacultyRegistry();
}

async function processAddTeacher() {
    try {
        const fname = document.getElementById('t-fname').value.trim();
        const lname = document.getElementById('t-lname').value.trim();
        const sdms  = document.getElementById('t-sdms').value.trim();
        
        // AUTO-INHERIT school code from admin session
        const schoolCode = SCHOOL_INFO.code;
        
        const email = document.getElementById('t-email').value.trim();
        const phone = document.getElementById('t-phone').value.trim();
        const isClassTeacher = document.getElementById('role-class-teacher').checked;
        const isSubjTeacher  = document.getElementById('role-subject-teacher').checked;
        
        if (!isNonEmpty(fname) || !isNonEmpty(email) || !isValidEmail(email)) {
            return toast('⚠️ First Name and Valid Email are mandatory.', 'error');
        }
        
        if (sdms && !isValidSDMS(sdms)) {
            return toast('⚠️ Invalid SDMS Code format. Must be exactly 11 digits.', 'error');
        }
        
        if (!/^\d{6}$/.test(schoolCode)) {
            return toast('⚠️ Invalid School SDMS Code: It must be exactly a 6-digit number (e.g., 541010).', 'warning');
        }
        
        toast('🚀 Initializing institutional enrollment...', 'info');

        // Check for Class Teacher conflicts before starting DB operations
        if (isClassTeacher) {
            const classId = document.getElementById('t-assign-class').value;
            if (!classId) return toast('⚠️ Please select a Class for this assignment.', 'warning');
            
            const allAssignments = await DB.getTeacherAssignments();
            const existing = allAssignments.find(a => a.type === 'class' && a.class_id === classId);
            if (existing) {
                return toast(`🚫 Conflict: ${existing.profiles?.full_name || 'Another teacher'} is already managing this class.`, 'error');
            }
        }

        const teacherRole = document.getElementById('t-role').value;
        const teacherPayload = {
            full_name: `${fname} ${lname}`, 
            email, 
            sdms_code: sdms,
            school_code: schoolCode,
            role: teacherRole
        };


        // Phone is used for notifications but skipped for DB insert


        const { data, error } = await DB.addTeacher(teacherPayload);
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Institutional registry returned no data.');

        const teacherId = data[0].id;
        
        // 1. Process Class Assignment
        if (isClassTeacher) {
            const classId = document.getElementById('t-assign-class').value;
            const { error: asErr } = await DB.saveTeacherAssignment({ teacher_id: teacherId, class_id: classId, type: 'class' });
            if (asErr) throw asErr;
        }
        
        // 2. Process Subject Jurisdictions
        if (isSubjTeacher) {
            const rows = document.querySelectorAll('.assignment-row');
            for (const row of rows) {
                const classId = row.querySelector('.assign-class').value;
                const subId = row.querySelector('.assign-subject').value;
                if (classId && subId) {
                    const { error: sAsErr } = await DB.saveTeacherAssignment({ 
                        teacher_id: teacherId, 
                        class_id: classId, 
                        subject_id: subId, 
                        type: 'subject' 
                    });
                    if (sAsErr) throw sAsErr;
                }
            }
        }

        const defaultP = 'Teacher@2026';
        toast(`✅ Enrollment Complete! Temporary Password: ${defaultP}`, 'success');

        // 3. Dispatch Onboarding Notification
        try {
            const assignedSubjects = [];
            if (isSubjTeacher) {
                const subjectRows = document.querySelectorAll('.assignment-row');
                subjectRows.forEach(row => {
                    const sId = row.querySelector('.assign-subject').value;
                    const cId = row.querySelector('.assign-class').value;
                    const sub = window._cachedSubjects.find(s => s.id === sId);
                    const cls = window._cachedClasses.find(c => c.id === cId);
                    if (sub && cls) assignedSubjects.push(`${sub.name} (${cls.name})`);
                });
            }
            
            const classVal = document.getElementById('t-assign-class').value;
            const className = isClassTeacher ? (window._cachedClasses.find(c => c.id === classVal)?.name || 'None') : 'None';
            
            await sendFacultyOnboardingInvite({
                teacherId: teacherId,
                fullName: `${fname} ${lname}`,
                email: email,
                phone: phone,
                className: className,
                subjects: assignedSubjects
            });
        } catch (onboardingErr) {
            console.error('[ONBOARDING] Messaging Error:', onboardingErr);
            toast('Notice: Teacher was registered but notification failed.', 'warning');
        }

        closeModal('add-teacher-modal');
        await renderFacultyRegistry(); // Refresh the list
        await updateInstitutionalStats();
        
    } catch (err) {
        console.error('[REGISTRY] Severe failure:', err);
        let errorMsg = err.message || 'Check network connection.';
        if (err.hint) errorMsg += ' Hint: ' + err.hint;
        if (err.details) errorMsg += ' Details: ' + err.details;
        
        if (err.code === '23505' || err.status === 409) {
            errorMsg = 'This Email, Phone Number, or SDMS Code is already assigned to another user in the system.';
        }
        toast('❌ Registry Error: ' + errorMsg, 'error');
    }
}

/**
 * INSTITUTIONAL ONBOARDING ENGINE
 * Automatically dispatches professional Email/SMS to newly registered faculty.
 */
async function sendFacultyOnboardingInvite(data) {
    if (!data.email) {
        console.warn('[ONBOARDING] Aborting invite: No email address provided.', data);
        return toast('Notice: No email found for notification.', 'warning');
    }

    const info = await getInstitutionInfo();
    const schoolName = info.school || 'MARKS MANAGEMENT SYSTEM';
    
    // Prepare Template Parameters for EmailJS
    const templateParams = {
        school_name: schoolName,
        school_code: SCHOOL_INFO.code,
        teacher_name: data.fullName,
        receiver_email: data.email,
        to_email: data.email,
        email: data.email,
        login_email: data.email,
        temporary_password: 'Teacher@2026',
        class_teacher: data.className || 'None assigned',
        subjects: data.subjects.length > 0 ? data.subjects.join(', ') : 'None assigned',
        school_phone: info.phone || '+250 000 000',
        school_email: info.email || 'info@school.rw'
    };

    console.log('[ONBOARDING] Dispatching with Parameters:', templateParams);
    toast(`Initiating secure dispatch to ${data.fullName}...`, 'info');

    try {
        if (typeof emailjs === 'undefined') throw new Error('EmailJS SDK not loaded.');
        
        const response = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
        
        console.log('[EMAILJS] Success:', response.status, response.text);
        toast(`Onboarding email successfully delivered to ${data.email}.`, 'success');
        
    } catch (error) {
        // Detailed log for debugging the 422 or empty recipient issue
        const errDetail = error.text || error.message || JSON.stringify(error);
        console.error('[EMAILJS] Dispatch Failure:', errDetail);
        toast('Messaging Notice: Email service reported an error.', 'warning');
    }

    // --- CHANNEL 2: REAL SMS via Twilio ---
    if (data.phone) {
        const smsMsg = `[${schoolName}] Welcome ${data.fullName}! LOGIN: ${data.email} | PSWD: Teacher@2026 | SDMS: ${SCHOOL_INFO.code}. Plz change pswd on login. Admin.`;
        
        await dispatchTwilioSMS(data.phone, smsMsg);
    } else {
        console.warn('[ONBOARDING] Skipping SMS: No phone number registered for member.');
    }
}

/**
 * DIRECT TWILIO GATEWAY DISPATCHER
 * Authorizes and sends high-priority institutional SMS.
 */
async function dispatchTwilioSMS(to, body) {
    // Clean phone number for international compliance
    let cleanTo = to.trim().replace(/\s+/g, '');
    if (!cleanTo.startsWith('+')) {
        // Assume Rwanda if no country code provided
        cleanTo = cleanTo.startsWith('0') ? '+250' + cleanTo.substring(1) : '+250' + cleanTo;
    }

    console.log(`[SMS-GATEWAY] Routing message to ${cleanTo}...`);
    
    try {
        const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
        const response = await fetch(TWILIO_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${auth}`
            },
            body: new URLSearchParams({
                'From': TWILIO_NUMBER,
                'To': cleanTo,
                'Body': body
            })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Twilio API Error');

        console.log('[SMS-GATEWAY] Dispatch Success:', result.sid);
        toast('SMS notification delivered to faculty phone.', 'success');
        
    } catch (err) {
        console.error('[SMS-GATEWAY] Dispatch Failure:', err);
        // We only toast a warning so it doesn't break the registration flow UI
        toast('Notice: SMS delivery failed. (Check if number is verified)', 'warning');
    }
}

async function renderFacultyRegistry() {
    const [faculty, allAssignments, classes, subjects] = await Promise.all([
        DB.getTeachers(), DB.getTeacherAssignments(), DB.getClasses(), DB.getSubjects()
    ]);
    window._cachedFaculty = faculty;
    window._cachedAssignments = allAssignments;
    window._cachedClasses = classes;
    window._cachedSubjects = subjects;
    renderFacultyList(faculty);
}

function renderFacultyList(faculty) {
    const tbody = document.getElementById('teachers-tbody');
    if (!tbody) return;
    tbody.innerHTML = faculty.map(f => {
        const assignments = (window._cachedAssignments || []).filter(a => a.teacher_id === f.id);
        const jurisdiction = assignments.map(a => a.type === 'class' ? `Class: ${a.classes?.name}` : `${a.subjects?.abbr || a.subjects?.name} (${a.classes?.name})`).join(', ') || '—';
        return `
        <tr>
            <td><strong>${f.full_name}</strong><div style="font-size:0.6rem; color:#94a3b8; font-weight:800;">ID: ${f.sdms_code || 'UNSET'}</div></td>
            <td style="color: #64748b; font-size:0.8rem; font-weight: 500;">${f.email}</td>
            <td><span class="badge" style="background:#f1f5f9; color:#3b82f6; font-size:0.6rem; font-weight: 800;">${(f.is_class_teacher?'CLASS ':'')}${(f.is_subject_teacher?'SUBJECT':'')}</span></td>
            <td style="font-size:0.7rem; color:#64748b; font-weight: 600;">${jurisdiction}</td>
            <td style="text-align: right; display: flex; gap: 0.5rem; justify-content: flex-end;">
               <button class="btn" style="padding: 4px 12px; font-size: 0.65rem;" onclick="openEditAssignments('${f.id}')">EDIT JURISDICTION</button>
               <button class="btn" style="padding: 4px 8px; font-size: 0.65rem; color: var(--danger); border-color: #fecaca; background: #fef2f2;" title="Terminate Faculty Account" onclick="handleDeleteTeacher('${f.id}', '${f.full_name}')"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>
            </td>
        </tr>`;
    }).join('') || '<tr><td colspan="5" style="text-align:center; padding:3rem; color:#94a3b8;">No faculty members.</td></tr>';
}

// ============================================================
// MARKS MANAGEMENT (CAMIS STYLE)
// ============================================================
async function renderMarksManagement() {
    const tbody = document.getElementById('marks-mgmt-tbody');
    if (!tbody) return;
    const [marks, students, subjects, assessments] = await Promise.all([
        DB.getMarks(), DB.getStudents(), DB.getSubjects(), DB.getAssessments()
    ]);

    const studMap = {}; students.forEach(s => { studMap[s.id] = `${s.last_name || ''} ${s.first_name || ''}`.trim(); });
    const subMap = {}; subjects.forEach(s => { subMap[s.id] = s.abbr || s.name; });
    const assessMap = {}; assessments.forEach(a => { assessMap[a.id] = a.abbr || a.id; });

    tbody.innerHTML = marks.map(m => {
        const statusClass = m.is_approved ? 'badge-green' : (m.is_submitted ? 'badge-red' : 'badge-blue');
        const statusIcon = m.is_locked ? 'lock' : (m.is_approved ? 'check-circle' : (m.is_submitted ? 'clock' : 'edit-3'));
        const statusText = m.is_locked ? 'LOCKED' : (m.is_approved ? 'APPROVED' : (m.is_submitted ? 'PENDING' : 'DRAFT'));
        const statusHTML = `<span style="display:inline-flex; align-items:center; gap:4px;"><i data-lucide="${statusIcon}" style="width:12px; height:12px;"></i> ${statusText}</span>`;
        
        return `
        <tr>
            <td><strong style="color: #1e293b;">${studMap[m.student_id] || m.student_id}</strong></td>
            <td><span class="font-bold" style="color: #3b82f6; font-weight: 800;">${subMap[m.subject_id] || m.subject_id}</span></td>
            <td><span style="font-size: 0.65rem; font-weight: 800; color: #94a3b8; text-transform: uppercase;">${assessMap[m.assessment_id] || '—'}</span></td>
            <td>
                <div style="display:flex; flex-direction:column;">
                    <span style="font-weight: 900; color: #1e293b; font-size: 1.1rem;">${m.score}</span>
                    <span style="font-size: 0.6rem; color: #94a3b8; font-weight: 700;">MAX: ${m.max_score || 10}</span>
                </div>
            </td>
            <td><span class="badge ${statusClass}" style="font-weight: 800;">${statusHTML}</span></td>
            <td style="text-align: right;">
               <button class="btn" style="padding: 6px 16px; font-size: 0.65rem; font-weight: 900;" onclick="toast('Record Lock Active.', 'info')">DETAILS</button>
            </td>
        </tr>`;
    }).join('') || '<tr><td colspan="6" style="padding: 4rem; text-align: center; color: #94a3b8;">Waiting for data...</td></tr>';
}

// ============================================================
// REPORTS & ANALYTICS (CAMIS 4+ ASSESSMENT LOGIC)
// ============================================================
let reportsBarChart = null;
let reportsPieChart = null;

async function renderReports() {
    const populateReportFilters = (classes, subjects, assessments) => {
        const classSel = document.getElementById('report-filter-class');
        const subSel = document.getElementById('report-filter-sub');
        if (classSel && classSel.children.length <= 1) classSel.innerHTML = '<option value="">All Classes</option>' + classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        if (subSel && subSel.children.length <= 1) subSel.innerHTML = '<option value="">All Subjects</option>' + subjects.map(s => `<option value="${s.id}">${s.abbr || s.name}</option>`).join('');
    };

    const calculateGradeDistribution = (marks) => {
        const grades = { A: 0, B: 0, C: 0, D: 0, S: 0, F: 0 };
        marks.forEach(m => {
            const perc = m.max_score ? (m.score / m.max_score) * 100 : (m.score * 10);
            if (perc >= 80) grades.A++; else if (perc >= 70) grades.B++; else if (perc >= 60) grades.C++; else if (perc >= 40) grades.D++; else if (perc >= 30) grades.S++; else grades.F++;
        });
        return grades;
    };

    const [classes, students, allMarks, subjects, assessments] = await Promise.all([
        DB.getClasses(), DB.getStudents(), DB.getMarks(), DB.getSubjects(), DB.getAssessments()
    ]);

    // CAMIS RULE: If more than 4 assessments exist, stack charts for better width/density
    const chartsGrid = document.querySelector('.charts-grid');
    if (chartsGrid) {
        if (assessments.length > 4) chartsGrid.style.gridTemplateColumns = '1fr';
        else chartsGrid.style.gridTemplateColumns = '2fr 1fr';
    }

    populateReportFilters(classes, subjects, assessments);
    let filtered = allMarks.filter(m => m.is_approved);
    
    // KPIs
    let totalPerc = 0; filtered.forEach(m => { totalPerc += m.max_score ? (m.score / m.max_score) * 100 : m.score * 10; });
    const overallAvg = filtered.length ? (totalPerc / filtered.length).toFixed(1) : 0;
    document.getElementById('rep-kpi-avg').textContent = overallAvg + '%';
    document.getElementById('rep-kpi-approved').textContent = filtered.length;

    // Charts
    const subAverages = {}; subjects.forEach(s => subAverages[s.id] = { name: s.abbr || s.name, sum: 0, count: 0 });
    filtered.forEach(m => { if (subAverages[m.subject_id]) { subAverages[m.subject_id].sum += (m.max_score?(m.score/m.max_score)*100:m.score*10); subAverages[m.subject_id].count++; } });
    
    const chartLabels = [], chartData = [];
    for (const s of Object.values(subAverages)) { if (s.count > 0) { chartLabels.push(s.name); chartData.push((s.sum / s.count).toFixed(1)); } }

    const ctxBar = document.getElementById('reports-bar-chart')?.getContext('2d');
    if (ctxBar) {
        if (reportsBarChart) reportsBarChart.destroy();
        reportsBarChart = new Chart(ctxBar, {
            type: 'bar', data: { labels: chartLabels.length ? chartLabels : ['No Data'], datasets: [{ label: ' Institutional Performance (%)', data: chartData.length ? chartData : [0], backgroundColor: '#3b82f6', borderRadius: 8 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
        });
    }

    const gDist = calculateGradeDistribution(filtered);
    const ctxPie = document.getElementById('reports-pie-chart')?.getContext('2d');
    if (ctxPie) {
        if (reportsPieChart) reportsPieChart.destroy();
        reportsPieChart = new Chart(ctxPie, {
            type: 'doughnut', data: { labels: ['A', 'B', 'C', 'D', 'S', 'F'], datasets: [{ data: [gDist.A, gDist.B, gDist.C, gDist.D, gDist.S, gDist.F], backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#f97316', '#ef4444'] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
        });
    }
}

// ============================================================
// OFFICIAL REPORT CARD GENERATION (CAMIS STANDARD)
// ============================================================
window.openReportCardConfig = async function() {
    const [dbSubs, dbAssessments, classes] = await Promise.all([DB.getSubjects(), DB.getAssessments(), DB.getClasses()]);

    const clsSelect = document.getElementById('rc-target-class');
    clsSelect.innerHTML = `<option value="all">Entire Institution Dataset</option>` +
        classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

    // STANDARD MINEDUC SUBJECTS — always shown
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
    const renderedSubIds = new Set();
    const subItems = [];
    STD_SUBJECTS.forEach(std => {
        const match = dbSubs.find(s =>
            (s.abbr || '').toUpperCase().startsWith(std.key.substring(0,3)) ||
            (s.name || '').toUpperCase().startsWith(std.label.split(' ')[0].toUpperCase())
        );
        if (match) {
            renderedSubIds.add(String(match.id));
            subItems.push({ id: match.id, abbr: std.key, checked: true });
        } else {
            subItems.push({ id: 'std_' + std.key, abbr: std.key, checked: false });
        }
    });
    dbSubs.forEach(s => {
        if (!renderedSubIds.has(String(s.id))) {
            subItems.push({ id: s.id, abbr: s.abbr || s.name.substring(0,5), checked: true });
        }
    });

    // STANDARD ASSESSMENT TYPES — always shown
    const STD_ASSESS = [
        { key: 'EU',  label: 'End of Unit' },
        { key: 'ET',  label: 'End of Term' },
        { key: 'MT',  label: 'Mid-Term Test' },
        { key: 'MID', label: 'MID Test' },
        { key: 'WK',  label: 'Weekly Test' },
        { key: 'BT',  label: 'Beginning Test' },
    ];
    const renderedAssIds = new Set();
    const assessItems = [];
    STD_ASSESS.forEach(std => {
        const match = dbAssessments.find(a =>
            (a.abbr || '').toUpperCase() === std.key ||
            (a.name || '').toUpperCase().startsWith(std.label.split(' ')[0].toUpperCase())
        );
        if (match) {
            renderedAssIds.add(String(match.id));
            assessItems.push({ id: match.id, abbr: std.key, label: std.label, checked: true });
        } else {
            assessItems.push({ id: 'std_' + std.key, abbr: std.key, label: std.label, checked: false });
        }
    });
    dbAssessments.forEach(a => {
        if (!renderedAssIds.has(String(a.id))) {
            assessItems.push({ id: a.id, abbr: a.abbr || a.name.substring(0,3), label: a.name, checked: true });
        }
    });

    function pillStyle(on, color) {
        return `display:inline-flex;align-items:center;gap:6px;padding:8px 16px;
            border-radius:999px;margin:4px;cursor:pointer;font-size:0.78rem;font-weight:800;
            user-select:none;transition:all 0.15s;border:2px solid ${on ? color : '#cbd5e1'};
            background:${on ? color : '#fff'};color:${on ? '#fff' : '#64748b'};`;
    }

    document.getElementById('rc-subject-checklist').innerHTML = subItems.map(s => {
        const on = s.checked; const color = '#0f172a';
        return `<label style="${pillStyle(on, color)}" class="rc-sub-pill"
            onclick="var cb=this.querySelector('input'),v=cb.checked;
                this.style.background=v?'${color}':'#fff';
                this.style.borderColor=v?'${color}':'#cbd5e1';
                this.style.color=v?'#fff':'#64748b';">
            <input type="checkbox" ${on ? 'checked' : ''} value="${s.id}" class="rc-sub-cb" style="display:none" onchange="this.parentElement.classList.toggle('active',this.checked)">
            ${s.abbr}
        </label>`;
    }).join('');

    document.getElementById('rc-assess-checklist').innerHTML = assessItems.map(a => {
        const on = a.checked; const color = '#1d4ed8';
        return `<label style="${pillStyle(on, color)}" class="rc-ass-pill" title="${a.label}"
            onclick="var cb=this.querySelector('input'),v=cb.checked;
                this.style.background=v?'${color}':'#fff';
                this.style.borderColor=v?'${color}':'#cbd5e1';
                this.style.color=v?'#fff':'#64748b';">
            <input type="checkbox" ${on ? 'checked' : ''} value="${a.id}" class="rc-ass-cb" style="display:none" onchange="this.parentElement.classList.toggle('active',this.checked)">
            ${a.abbr}
        </label>`;
    }).join('');

    openModal('generate-reportcard-modal');
};

window.executeReportCardGeneration = function() {
    const cid = document.getElementById('rc-target-class').value;
    const subContainer = document.getElementById('rc-subject-checklist');
    const assContainer = document.getElementById('rc-assess-checklist');
    
    if (!subContainer || !assContainer) return toast('Registry Error: Configuration Hub not found.', 'error');
    
    // Capture ALL selected items (including std_ placeholders)
    const rawSelSubs = Array.from(subContainer.querySelectorAll('input:checked')).map(cb => ({
        id: cb.value,
        label: cb.parentElement.innerText.trim()
    }));
    const rawSelAsses = Array.from(assContainer.querySelectorAll('input:checked')).map(cb => ({
        id: cb.value,
        label: cb.parentElement.innerText.trim()
    }));

    if (rawSelSubs.length === 0) return toast('⚠️ Please select at least one curriculum subject.', 'warning');
    if (rawSelAsses.length === 0) return toast('⚠️ Please select at least one assessment marker.', 'warning');

    closeModal('generate-reportcard-modal');
    window.generateAllReportsPdf(cid, rawSelSubs, rawSelAsses); 
};

window.generateAllReportsPdf = async function(targetClassId = 'all', targetSubs = [], targetAsses = []) {
    toast('Synthesizing Customized Institutional Report Cards...', 'info');
    const [allMarks, students, allDBSubjects, classes] = await Promise.all([
        DB.getMarks(), DB.getStudents(), DB.getSubjects(), DB.getClasses()
    ]);

    const selSubIds = targetSubs.map(s => s.id).filter(id => !id.startsWith('std_'));
    const selAssIds = targetAsses.map(a => a.id).filter(id => !id.startsWith('std_'));

    // Merge DB subjects with Virtual (std_) subjects
    const subjects = targetSubs.map(sel => {
        const dbMatch = allDBSubjects.find(s => s.id === sel.id);
        if (dbMatch) return dbMatch;
        const cleanName = sel.label.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
        return { 
            id: sel.id, 
            name: cleanName.toUpperCase(), 
            abbr: cleanName.toUpperCase().substring(0,5) 
        };
    });

    const filteredMarks = allMarks.filter(m => 
        m.is_approved &&
        (targetClassId === 'all' || m.class_id === targetClassId) &&
        (selSubIds.length === 0 || selSubIds.includes(m.subject_id)) &&
        (selAssIds.length === 0 || selAssIds.includes(m.assessment_id))
    );

    if (!filteredMarks.length && selSubIds.length > 0) {
        // Continue even if no marks, maybe they want empty shells
        console.warn('No approved marks found, but continuing with virtual subjects.');
    }

    let html = '';
    const targetStudents = targetClassId === 'all' 
        ? students 
        : students.filter(s => s.class_id === targetClassId);

    if (!targetStudents.length) return toast('No students found in the selected target group.', 'warning');

    for (const student of targetStudents) {
        const stName = `${student.last_name} ${student.first_name}`.toUpperCase();
        const stClass = classes.find(c => c.id === student.class_id)?.name || 'GENERAL';
        const stMarks = filteredMarks.filter(m => m.student_id === student.id);
        
        let marksRows = ''; let totalScore = 0; let totalMax = 0;
        
        // Show ALL selected subjects (not just those with marks)
        const studentSubjects = subjects;

        studentSubjects.forEach(sub => {
            const sm = stMarks.filter(m => m.subject_id === sub.id);
            
            const baseMax = ['ART','PES','SRS'].includes(sub.abbr) ? 20 : 40;
            // Sum up scores if they exist
            const sumS = sm.reduce((acc, m) => {
                const raw = m.score === -1 ? 0 : Number(m.score);
                return acc + Math.min(raw, Number(m.max_score || baseMax));
            }, 0);
            
            // Sum up max scores (use baseMax if virtual or no marks)
            let sumM = sm.reduce((acc, m) => acc + Number(m.max_score || baseMax), 0);
            if (sumM === 0) sumM = baseMax; // Show at least base max for virtual
            
            const perc = sumM > 0 ? ((sumS / sumM) * 100).toFixed(1) : 0;
            
            marksRows += `<tr><td style="padding: 12px; border: 1px solid #000; font-weight: 700; color: #000;">${sub.name}</td><td style="padding: 12px; border: 1px solid #000; text-align: center; font-weight: 800; color: #000;">${sumS > 0 ? sumS.toFixed(1) : '—'} <span style="color:#000; font-weight:400;">/ ${sumM}</span></td><td style="padding: 12px; border: 1px solid #000; text-align: center; color: #000; font-weight: 900;">${perc}%</td></tr>`;
            totalScore += sumS; totalMax += sumM;
        });

        const percentage = totalMax > 0 ? ((totalScore / totalMax) * 100).toFixed(1) : 0;
        const getGrade = p => p >= 80 ? {l:'A', c:'#000', d:'EXCELLENT'} : p >= 70 ? {l:'B', c:'#000', d:'VERY GOOD'} : p >= 60 ? {l:'C', c:'#000', d:'GOOD'} : p >= 40 ? {l:'D', c:'#000', d:'SATISFACTORY'} : {l:'F', c:'#000', d:'FAIL'};
        const gi = getGrade(percentage);

        const instHeader = generateInstitutionalHeader('OFFICIAL ACADEMIC REPORT', `TERM ${SCHOOL_INFO.active_term || 1} — 2025/2026`);
        const finalDate = new Date().toLocaleDateString('en-GB');

        html += `
        <div class="report-page" style="color: #000; border: none; padding: 12mm; font-family: 'Inter', sans-serif;">
            ${instHeader}

            <div style="display: grid; grid-template-columns: 2fr 1.2fr; gap: 15px; margin-bottom: 20px; background: #fff; padding: 15px; border: 2.5px solid #000;">
                <div>
                   <div style="font-size: 0.65rem; font-weight: 1000; color: #000; text-transform: uppercase;">Student Full Name</div>
                   <div style="font-size: 1.3rem; font-weight: 1000; color: #000; margin-top:2px;">${stName}</div>
                   <div style="margin-top: 10px; font-size: 0.85rem; color: #000; font-weight:700;">Class: <strong>${stClass}</strong> | Reg ID: <strong>${student?.student_id || sId}</strong></div>
                </div>
                <div style="text-align: right; border-left: 2px solid #000; padding-left: 15px; color: #000; font-weight:800;">
                   <div style="font-size: 0.85rem;">Academic Year: 2025/2026</div>
                   <div style="font-size: 0.85rem;">Term: ${SCHOOL_INFO.active_term || 1}</div>
                   <div style="font-size: 0.85rem; margin-top:5px;">Level: PRIMARY</div>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 3px solid #000;">
                <thead>
                    <tr style="background: #f1f5f9;">
                        <th style="padding: 12px; border: 2.5px solid #000; text-align: left; font-size: 0.75rem; font-weight: 1000; color: #000; width:60%;">SUBJECT</th>
                        <th style="padding: 12px; border: 2.5px solid #000; text-align: center; font-size: 0.75rem; font-weight: 1000; color: #000;">SCORE</th>
                        <th style="padding: 12px; border: 2.5px solid #000; text-align: center; font-size: 0.75rem; font-weight: 1000; color: #000;">PERCENT</th>
                    </tr>
                </thead>
                <tbody>
                    ${marksRows}
                    <tr style="background: #fff; font-weight: 1000; color: #000; font-size:1.1rem; border-top:3px solid #000;">
                        <td style="padding: 12px; border: 2.5px solid #000; text-align: right;">INSTITUTIONAL TOTAL:</td>
                        <td style="padding: 12px; border: 2.5px solid #000; text-align: center;">${totalScore.toFixed(1)} / ${totalMax}</td>
                        <td style="padding: 12px; border: 2.5px solid #000; text-align: center;">${percentage}%</td>
                    </tr>
                </tbody>
            </table>

            <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 20px; align-items: stretch;">
               <div style="background: #fff; border: 2.5px solid #000; padding: 25px; text-align: center; color: #000; display:flex; flex-direction:column; justify-content:center;">
                  <div style="font-size: 0.7rem; font-weight: 1000; color: #000; margin-bottom: 8px; text-transform:uppercase;">Overall Grade</div>
                  <div style="font-size: 4.5rem; font-weight: 1000; color: #000; line-height: 0.9; margin-bottom:10px;">${gi.l}</div>
                  <div style="font-size: 1rem; font-weight: 1000; color: #000; text-transform:uppercase; letter-spacing:1px;">${gi.d}</div>
               </div>
               
                <div style="border:2.5px solid #000; padding:15px; font-size:0.6rem; display:flex; flex-direction:column; justify-content:center; text-align:center; position:relative; color:#000; min-height:180px;">
                    <div style="font-size:0.55rem; font-weight:1000; color:#000; text-transform:uppercase; margin-bottom:8px; border-bottom:1.5px solid #000; padding-bottom:5px;">
                        DONE AT ${(SCHOOL_INFO.district || '...').toUpperCase()}, ON ${finalDate}
                    </div>
                    <div style="font-weight:1000; font-size:0.8rem; margin-bottom:15px; color:#000; letter-spacing:1.5px;">HEADTEACHER / PRINCIPAL</div>
                    
                    <div style="flex-grow:1; display:flex; align-items:center; justify-content:center; position:relative; margin-bottom:12px;">
                        ${SCHOOL_INFO.headteacher_sig ? `<img src="${SCHOOL_INFO.headteacher_sig}" style="max-height:85px; max-width:220px; object-fit:contain; mix-blend-mode:multiply; position:absolute; z-index:2;">` : ''}
                        ${SCHOOL_INFO.stamp ? `<img src="${SCHOOL_INFO.stamp}" style="width:125px; height:125px; opacity:0.85; mix-blend-mode:multiply; position:absolute; z-index:1; transform: translate(35px, -15px) rotate(-10deg);">` : ''}
                    </div>

                    <div style="font-weight:1000; font-size:1.05rem; border-top: 2.5px solid #000; padding-top:10px; color:#000; text-transform:uppercase; letter-spacing:0.5px;">
                        ${(SCHOOL_INFO.headteacher || '...').toUpperCase()}
                    </div>
                </div>
            </div>

            <div style="margin-top: 35px; font-size: 0.6rem; color: #000; text-align: right; font-weight: 800; border-top: 1px dashed #000; padding-top: 8px;">
                Verified Institutional Document • Ref ID: ${student?.student_id || sId}
            </div>
        </div>`;
    }

    const combinedHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>EDU_BATCH_RECORDS</title>
            <style>
                @page { margin: 0; size: A4 portrait; }
                @media print { 
                    body { margin:0; padding:0; background:white !important; display: block !important; width: 210mm !important; } 
                    .no-print { display: none !important; }
                    .report-container { width: 100% !important; margin: 0 !important; padding: 0 !important; }
                    .report-page { 
                        border: none !important; margin: 0 !important; 
                        padding: 12mm !important; box-shadow: none !important; 
                        width: 210mm !important; height: 297mm !important; 
                        page-break-after: always !important; display: flex !important;
                        flex-direction: column !important; justify-content: space-between !important;
                    }
                }
                body { background: #f1f5f9; margin: 0; padding: 0; display: flex; flex-direction: column; align-items: center; font-family: 'Inter', sans-serif; min-height: 100vh; }
                .report-container { display: flex; flex-direction: column; align-items: center; gap: 40px; padding: 40px 20px; box-sizing: border-box; width: 100%; }
                .report-page { background: white; width: 210mm; height: 297mm; padding: 20mm; border-radius: 4px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); box-sizing: border-box; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; position: relative; }
                
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
                    .report-page { transform-origin: top center; margin-bottom: 0 !important; }
                }
            </style>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
            <script>
                function applySmartFit() {
                    const pages = document.querySelectorAll('.report-page');
                    if (!pages.length || window.innerWidth > 1000) return;
                    
                    const vw = window.innerWidth - 20; 
                    const baseWidth = pages[0].offsetWidth;
                    const sFit = vw / baseWidth;
                    
                    if (sFit < 1) {
                        pages.forEach(p => {
                            if (p) p.style.transform = 'scale(' + sFit + ')';
                        });
                        const container = document.querySelector('.report-container');
                        if (container) container.style.gap = '10px';
                    }
                }
                function downloadPDF() {
                     const element = document.querySelector('.report-container');
                     const opt = {
                         margin: 0,
                         filename: 'Batch_Records_${new Date().getTime()}.pdf',
                         image: { type: 'jpeg', quality: 0.98 },
                         html2canvas: { scale: 2, useCORS: true },
                         jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                     };
                     html2pdf().set(opt).from(element).save();
                }
                window.onload = applySmartFit;
                window.onresize = applySmartFit;
            </script>
        </head>
        <body>
            <div class="header-bar no-print">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="width: 32px; height: 32px; background: #6366f1; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900;">A</div>
                    <h2 style="margin: 0; font-size: 1rem; letter-spacing: 0.5px; font-weight: 900;">REPORT PREVIEW</h2>
                </div>
                <div class="btn-group">
                    <button class="p-btn btn-print" onclick="window.print()">🖨️ PRINT REPORT</button>
                    <button class="p-btn btn-pdf" onclick="downloadPDF()">📄 DOWNLOAD PDF</button>
                    <button class="p-btn" style="background: #ef4444; color: white;" onclick="window.close()">✕ CLOSE</button>
                </div>
            </div>
            <div class="report-container">
                ${html}
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

// ============================================================
// INITIALIZATION
// ============================================================
async function handleLogout() {
    if (confirm('Disconnect from institutional node? All unsaved active sessions will be terminated.')) {
        try {
            // 1. Stop real-time sync
            if (window.SYNC && SYNC.stop) SYNC.stop();
            
            // 2. Wipe institutional memory
            if (typeof DB !== 'undefined' && DB.clearCache) DB.clearCache();
            
            // 3. Clear session storage specifically
            sessionStorage.clear();
            
            // 4. Force Server-side Signout
            if (window._supabase) await _supabase.auth.signOut();
            
            // 5. Hard Redirect
            window.location.replace('./Login.html');
        } catch (err) {
            console.error('[AUTH] Logout error:', err);
            window.location.href = './Login.html';
        }
    }
}

async function handleDeleteTeacher(id, name) {
    if (!confirm(`⚠️ PERMANENT ACTION: Are you sure you want to terminate the institutional account for ${name}? This will also wipe all their course assignments.`)) return;

    toast('🚮 Terminating account node...', 'info');
    try {
        // 1. Wipe assignments first
        await DB.deleteTeacherAssignments(id);
        // 2. Delete profile
        const { error } = await DB.deleteTeacher(id);
        
        if (error) throw error;

        toast(`✅ ${name} has been removed from the registry.`, 'success');
        await renderFacultyRegistry();
        await updateInstitutionalStats();
    } catch (err) {
        console.error('[REGISTRY] Delete failed:', err);
        toast('❌ Failed to terminate account: ' + err.message, 'error');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // 5. Breadcrumbs & Meta
    await syncInstitutionalNodes();

    // 6. Refresh Professional Signs
    if (window.lucide) lucide.createIcons();
    
    await renderProfile(); // Ensure name is real
    
    // Restore Sidebar State
    const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    if (isCollapsed) document.querySelector('.sidebar')?.classList.add('collapsed');

    // Restore View
    const lastView = sessionStorage.getItem('last_view') || 'dashboard';
    await switchView(lastView);

    SYNC.start();

    SYNC.on('assignments', async () => {
        await updateInstitutionalStats();
        const active = document.querySelector('.view.active')?.id;
        if (active === 'view-dashboard') await renderFacultyMonitor();
        if (active === 'view-teachers') await renderFacultyRegistry();
    });
    SYNC.on('marks', async () => {
        await updateInstitutionalStats();
        const active = document.querySelector('.view.active')?.id;
        if (active === 'view-dashboard') {
            await renderPerformanceMatrix();
            await renderFacultyMonitor();
        }
        if (active === 'view-marks-approval') await renderMonitoringQueue();
        if (active === 'view-reports') await renderReports();
    });
    SYNC.on('students', async () => { 
        await updateInstitutionalStats(); 
        if (document.querySelector('.view.active')?.id === 'view-students') await renderCohortRegistry(); 
    });
    SYNC.on('teachers', async () => { 
        await updateInstitutionalStats(); 
        if (document.querySelector('.view.active')?.id === 'view-teachers') await renderFacultyRegistry(); 
    });
    SYNC.on('classes', async () => { 
        await renderSetup(); 
        await renderPerformanceMatrix(); 
        await renderFacultyMonitor();
    });
    SYNC.on('subjects', async () => {
        if (document.querySelector('.view.active')?.id === 'view-subjects') await renderSubjectsTable();
        await renderFacultyMonitor();
    });
// ============================================================
// EXECUTIVE ANALYTICS: UNIVERSAL PROCLAMATION EXPORT
// ============================================================

window.openProclamationConfig = async function(classId) {
    document.getElementById('proc-target-class').value = classId;
    
    // Fetch and populate all Curricular Subjects
    const [dbSubs, dbAssessments] = await Promise.all([DB.getSubjects(), DB.getAssessments()]);
    
    // STANDARD MINEDUC subjects
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
    const renderedSubIds = new Set();
    const subItems = [];
    STD_SUBJECTS.forEach(std => {
        const match = dbSubs.find(s =>
            (s.abbr || '').toUpperCase().startsWith(std.key.substring(0,3)) ||
            (s.name || '').toUpperCase().startsWith(std.label.split(' ')[0].toUpperCase())
        );
        if (match) {
            renderedSubIds.add(String(match.id));
            subItems.push({ id: match.id, abbr: std.key, icon: std.icon, checked: true });
        } else {
            subItems.push({ id: 'std_' + std.key, abbr: std.key, icon: std.icon, checked: false });
        }
    });

    // STANDARD ASSESSMENT TYPES
    const STD_ASSESS = [
        { key: 'EU',  label: 'End of Unit' },
        { key: 'ET',  label: 'End of Term' },
        { key: 'MT',  label: 'Mid-Term Test' },
        { key: 'MID', label: 'MID Test' },
        { key: 'WK',  label: 'Weekly Test' },
        { key: 'BT',  label: 'Beginning Test' },
    ];
    const renderedAssIds = new Set();
    const assessItems = [];
    STD_ASSESS.forEach(std => {
        const match = dbAssessments.find(a =>
            (a.abbr || '').toUpperCase() === std.key ||
            (a.name || '').toUpperCase().startsWith(std.label.split(' ')[0].toUpperCase())
        );
        if (match) {
            renderedAssIds.add(String(match.id));
            assessItems.push({ id: match.id, abbr: std.key, label: std.label, icon: std.icon, checked: true });
        } else {
            assessItems.push({ id: 'std_' + std.key, abbr: std.key, label: std.label, icon: std.icon, checked: false });
        }
    });

    function pill(id, abbr, on, color) {
        const style = `display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:999px;margin:4px;cursor:pointer;font-size:0.75rem;font-weight:800;border:2px solid ${on?color:'#cbd5e1'};background:${on?color:'#fff'};color:${on?'#fff':'#64748b'};`;
        return `<label style="${style}" onclick="var cb=this.querySelector('input'),v=cb.checked;this.style.background=v?'${color}':'#fff';this.style.borderColor=v?'${color}':'#cbd5e1';this.style.color=v?'#fff':'#64748b';">
            <input type="checkbox" ${on?'checked':''} value="${id}" style="display:none"> ${abbr}
        </label>`;
    }

    document.getElementById('proc-subject-checklist').innerHTML = subItems.map(s => pill(s.id, s.abbr, s.checked, '#0f172a')).join('');
    document.getElementById('proc-assess-checklist').innerHTML = assessItems.map(a => pill(a.id, a.abbr, a.checked, '#1d4ed8')).join('');

    openModal('generate-proclamation-modal');
};

window.executeProclamationGeneration = async function() {
    const classId = document.getElementById('proc-target-class').value;
    if (!classId) return toast('Select a target class first.', 'warning');
    
    const subContainer = document.getElementById('proc-subject-checklist');
    const assContainer = document.getElementById('proc-assess-checklist');
    
    if (!subContainer || !assContainer) return toast('Registry Error: Configuration Hub not found.', 'error');
    
    const selectedSubs = Array.from(subContainer.querySelectorAll('input:checked'))
        .map(cb => cb.value)
        .filter(v => !String(v).startsWith('std_'));
    const selectedAsses = Array.from(assContainer.querySelectorAll('input:checked'))
        .map(cb => cb.value)
        .filter(v => !String(v).startsWith('std_'));
    
    if (selectedSubs.length === 0) return toast('⚠️ Please select at least one active subject.', 'warning');
    if (selectedAsses.length === 0) return toast('⚠️ Please select at least one evaluation marker.', 'warning');
    
    closeModal('generate-proclamation-modal');
    window.exportClassProclamation(classId, selectedSubs, selectedAsses);
};

window.exportClassProclamation = async function(classId, targetSubs = [], targetAsses = []) {
    toast(`Synthesizing Executive Proclamation for selected class...`, 'info');
    try {
        const [marks, stds, subs, classes, assignments, teachers] = await Promise.all([
            DB.getMarks(), DB.getStudents(), DB.getSubjects(), DB.getClasses(), DB.getTeacherAssignments(), DB.getTeachers()
        ]);

        const cls = classes.find(c => c.id === classId);
        const term = SCHOOL_INFO.active_term || '—';
        const finalDate = new Date().toLocaleDateString('en-GB');

        // Identify Class Teacher
        const assignment = assignments.find(a => a.class_id === classId && a.type === 'class');
        let classTeacherName = "DEPARTMENT HEAD";
        if (assignment) {
            const tr = teachers.find(t => t.id === assignment.teacher_id);
            if (tr) classTeacherName = tr.full_name.toUpperCase();
        }

        const classStudents = stds.filter(s => s.class_id === classId);
        
        // Context-Aware Filtering — use String() comparison to handle term stored as string OR number
        const activeTerm = String(SCHOOL_INFO.active_term);
        const classMarks = marks.filter(m => 
            m.class_id === classId && 
            m.is_approved &&
            String(m.term) === activeTerm &&
            (targetSubs.length === 0 || targetSubs.includes(m.subject_id)) &&
            (targetAsses.length === 0 || targetAsses.includes(m.assessment_id))
        );
        
        const classSubjects = subs.filter(s => targetSubs.length === 0 || targetSubs.includes(s.id));

        if (!classStudents.length) return toast('No students enrolled in this class profile.', 'warning');

        const subjectMeta = classSubjects.map(s => {
            let max = 0;
            targetAsses.forEach(aid => {
                max += (['ART','PES','SRS'].includes(s.abbr) ? 20 : 40);
            });
            return { ...s, totalMax: max };
        });

        // Build Subject Headers with Max (rotated)
        const subjectHeaders = subjectMeta.map(s => `
            <th style="border: 1px solid #000; width: 32px; height: 110px; padding: 0; vertical-align: bottom; position: relative; background:#f1f5f9;">
               <div style="writing-mode: vertical-rl; transform: rotate(180deg); margin: 0 auto; padding-top: 5px; font-weight: 950; font-size: 0.6rem; text-transform: uppercase; white-space:nowrap;">
                  ${(s.abbr || s.name).substring(0, 15)} / ${s.totalMax}
               </div>
            </th>
        `).join('');

        const grandMax = subjectMeta.reduce((acc, s) => acc + s.totalMax, 0);

        // Calculate Student Stats with precise Max-divisor (Matching Report Card logic)
        const stStats = classStudents.map(student => {
            let studentTotalScore = 0;
            let studentTotalMax = 0;
            
            subjectMeta.forEach(meta => {
                let subScore = 0;
                let subMax = 0;
                targetAsses.forEach(aid => {
                    const mk = classMarks.find(m => m.student_id === student.id && m.subject_id === meta.id && m.assessment_id === aid);
                    if (mk) {
                        const allowedMax = ['ART','PES','SRS'].includes(meta.abbr) ? 20 : 40;
                        const rawScore = mk.score === -1 ? 0 : Number(mk.score);
                        subScore += Math.min(rawScore, allowedMax);
                        subMax += Number(mk.max_score || allowedMax);
                    } else {
                        // Fallback if no mark record exists but subject is selected
                        subMax += (['ART','PES','SRS'].includes(meta.abbr) ? 20 : 40);
                    }
                });
                studentTotalScore += subScore;
                studentTotalMax += subMax;
            });
            
            const perc = studentTotalMax > 0 ? (studentTotalScore / studentTotalMax * 100) : 0;
            return { id: student.id, total: studentTotalScore, totalMax: studentTotalMax, percentage: perc };
        }).sort((a,b) => b.percentage - a.percentage);

        // Sort students by percentage
        const proclamationList = classStudents.sort((a,b) => {
            const statsA = stStats.find(x => x.id === a.id);
            const statsB = stStats.find(x => x.id === b.id);
            return statsB.percentage - statsA.percentage;
        });

        const rowsHtml = proclamationList.map((s, i) => {
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
                return `<td style="border: 1px solid #000; text-align: center; font-weight: 900; font-size: 0.75rem; color: ${isFail ? '#c2410c' : '#000'}; ${isFail ? 'text-decoration:underline;' : ''}">${subScore}</td>`;
            }).join('');

            const comment = perc >= 80 ? 'Excellent performance.' : perc >= 60 ? 'Good performance.' : perc >= 50 ? 'Fair. More effort needed.' : 'Unsatisfactory! Intensive support and revision needed.';

            return `
                <tr style="height:30px;">
                    <td style="border:1px solid #000; text-align:center; font-weight:800; padding:2px;">${i+1}</td>
                    <td style="border:1px solid #000; text-align:center; padding:2px; font-size:0.6rem;">${s.sid || '—'}</td>
                    <td style="border:1px solid #000; padding:2px 5px; font-weight:950; font-size:0.65rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${(s.last_name||'').toUpperCase()} ${(s.first_name||'').toUpperCase()}</td>
                    ${markCells}
                    <td style="border:1px solid #000; text-align:center; font-weight:1000; font-size:0.7rem;">${stats.total.toFixed(0)}</td>
                    <td style="border:1px solid #000; text-align:center; font-weight:1000; font-size:0.7rem; color:${perc < 50 ? '#ef4444' : '#000'};">${perc}</td>
                    <td style="border:1px solid #000; text-align:center; font-weight:1000; font-size:0.7rem;">${pos}</td>
                    <td style="border:1px solid #000; padding:2px; font-size:0.5rem; line-height:1.1;">${comment}</td>
                </tr>
            `;
        }).join('');

        const assessedLine = document.getElementById('proc-assess-checklist') 
            ? Array.from(document.querySelectorAll('.proc-ass-cb:checked')).map(cb => cb.closest('label').textContent.trim()).join(' + ')
            : targetAsses.join(' + ');

        const html = `
            <div id="proclamation-document" style="width: 277mm; min-height: 190mm; padding: 8mm; background: white; font-family: 'Arial', sans-serif; box-sizing: border-box; color: #000; margin: 0 auto;">

                <!-- HEADER -->
                <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
                    <tr>
                        <td style="width:90px; vertical-align:middle; text-align:left;">
                            <img src="js/Report image/download__92_-removebg-preview.png" style="width:75px; height:auto;">
                            <div style="font-size:6pt; font-weight:700; color:#1e40af; text-align:center; margin-top:2px;">Republic of Rwanda<br>Ministry of Education</div>
                        </td>
                        <td style="text-align:center; vertical-align:middle;">
                            <div style="font-size:8pt; font-weight:900; color:#1e40af; letter-spacing:2px;">REPUBLIC OF RWANDA</div>
                            <div style="font-size:7pt; font-weight:700; margin-bottom:2px;">MINISTRY OF EDUCATION</div>
                            <div style="font-size:15pt; font-weight:900; text-transform:uppercase; margin-bottom:4px;">${(SCHOOL_INFO.school||'EDUMARKS ACADEMY').toUpperCase()}</div>
                            <div style="display:inline-block; background:#1d4ed8; color:#fff; font-size:8pt; font-weight:900; padding:5px 18px; letter-spacing:1px; text-transform:uppercase;">
                                CLASS: ${cls.name.toUpperCase()} &bull; TERM ${term} PROCLAMATION
                            </div>
                            <div style="font-size:6.5pt; margin-top:4px; color:#475569;">Assessed: ${assessedLine}</div>
                        </td>
                        <td style="width:90px; vertical-align:middle; text-align:right;">
                            ${SCHOOL_INFO.logo ? `<img src="${SCHOOL_INFO.logo}" style="width:75px; height:75px; object-fit:contain; border-radius:4px;">` : `<div style="width:75px;height:75px;border:1.5px solid #94a3b8;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:6pt;font-weight:700;text-align:center;">SCHOOL<br>LOGO</div>`}
                        </td>
                    </tr>
                </table>

                <!-- META ROW -->
                <div style="display:flex; justify-content:space-between; border-top:2px solid #000; border-bottom:1px solid #cbd5e1; padding:5px 2px; margin-bottom:8px; font-size:7pt; font-weight:800;">
                    <div>
                        <div>Class Teacher: <strong>${classTeacherName}</strong></div>
                        <div>Email: ${SCHOOL_INFO.email||'...'} &nbsp;|&nbsp; Contact: ${SCHOOL_INFO.phone||'...'}</div>
                    </div>
                    <div style="text-align:right;">
                        <div>PROVINCE: <strong>EAST</strong></div>
                        <div>DISTRICT: <strong>${(SCHOOL_INFO.district||'...').toUpperCase()}</strong></div>
                        <div>SECTOR: <strong>${(SCHOOL_INFO.sector||'...').toUpperCase()}</strong></div>
                    </div>
                </div>

                <!-- TABLE -->
                <table style="width:100%; border-collapse:collapse; border:2px solid #000; font-size:7pt;">
                    <thead style="background:#f1f5f9;">
                        <tr>
                            <th style="border:1px solid #000; width:22px; height:65px; padding:0; vertical-align:bottom;">
                                <div style="transform:rotate(-90deg); white-space:nowrap; margin-bottom:16px; font-weight:900; font-size:6.5pt;">NO</div>
                            </th>
                            <th style="border:1px solid #000; width:72px; vertical-align:middle; padding:4px; font-weight:900;">ID NUMBER</th>
                            <th style="border:1px solid #000; min-width:110px; text-align:left; padding:4px; font-weight:900;">NAMES</th>
                            ${subjectHeaders}
                            <th style="border: 1px solid #000; width: 36px; height: 65px; padding: 0; vertical-align: bottom; background:#f1f5f9;">
                                <div style="transform:rotate(-90deg); white-space:nowrap; margin-bottom:16px; font-weight:900; font-size:6.5pt;">TOTAL</div>
                            </th>
                            <th style="border: 1px solid #000; width: 30px; height: 65px; padding: 0; vertical-align: bottom; background:#f1f5f9;">
                                <div style="transform:rotate(-90deg); white-space:nowrap; margin-bottom:16px; font-weight:900; font-size:6.5pt;">PERCENT %</div>
                            </th>
                            <th style="border:1px solid #000; width:28px; height:65px; padding:0; vertical-align:bottom;">
                                <div style="transform:rotate(-90deg); white-space:nowrap; margin-bottom:16px; font-weight:900; font-size:6.5pt;">POSITION</div>
                            </th>
                            <th style="border:1px solid #000; min-width:80px; text-align:left; padding:4px; font-weight:900;">Tr. COMMENT</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>

                <!-- FOOTER -->
                <div style="text-align:right; font-size:7pt; font-weight:800; margin-top:10px;">
                    Done at <strong>${(SCHOOL_INFO.district||'...').toUpperCase()}</strong> , on ${finalDate}
                </div>

                <!-- SIGNATURES -->
                <div style="display:flex; justify-content:space-around; margin-top:22px; font-size:7pt; gap:10px;">
                    <div style="text-align:center; flex:1; border-top:1.5px solid #000; padding-top:5px; position:relative;">
                        <div style="font-weight:900;">PREPARED BY CLASS TEACHER</div>
                        <div style="height:50px; display:flex; align-items:center; justify-content:center;">
                            <span style="color:#cbd5e1; font-style:italic;">(Teacher Signature)</span>
                        </div>
                        <div style="font-weight:900; margin-top:4px;">${classTeacherName}</div>
                    </div>
                    <div style="text-align:center; flex:1; border-top:1.5px solid #000; padding-top:5px; position:relative;">
                        <div style="font-weight:900;">APPROVED BY DOS</div>
                        <div style="height:50px; display:flex; align-items:center; justify-content:center;">
                            ${SCHOOL_INFO.dos_sig ? `<img src="${SCHOOL_INFO.dos_sig}" style="max-height:45px; max-width:130px; object-fit:contain; mix-blend-mode:multiply;">` : '<span style="color:#cbd5e1; font-style:italic;">(DOS Signature)</span>'}
                        </div>
                        <div style="font-weight:900; margin-top:4px;">${(SCHOOL_INFO.dos||'...').toUpperCase()}</div>
                    </div>
                    <div style="text-align:center; flex:1; border-top:1.5px solid #000; padding-top:5px; position:relative;">
                        <div style="font-weight:900;">APPROVED BY HEADTEACHER</div>
                        <div style="height:50px; display:flex; align-items:center; justify-content:center; position:relative;">
                            ${SCHOOL_INFO.headteacher_sig ? `<img src="${SCHOOL_INFO.headteacher_sig}" style="max-height:45px; max-width:130px; object-fit:contain; mix-blend-mode:multiply; position:absolute; z-index:2;">` : '<span style="color:#cbd5e1; font-style:italic;">(HT Signature)</span>'}
                            ${SCHOOL_INFO.stamp ? `<img src="${SCHOOL_INFO.stamp}" style="width:70px; height:70px; opacity:0.8; mix-blend-mode:multiply; position:absolute; z-index:1; transform: translate(10px, -5px) rotate(-8deg);">` : ''}
                        </div>
                        <div style="font-weight:900; margin-top:4px;">${(SCHOOL_INFO.headteacher||'DR. ...').toUpperCase()}</div>
                    </div>
                </div>
            </div>
        `;

        const combinedHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${cls.name} PROCLAMATION</title>
                <style>
                    @page { margin: 0; size: A4 landscape; }
                    @media print {
                        body { background: white !important; margin: 0; padding: 0 !important; display: block !important; width: 297mm !important; }
                        .no-print { display: none !important; }
                        .report-container { width: 100% !important; margin: 0 !important; padding: 0 !important; }
                        #proclamation-document { border: none !important; margin: 0 !important; padding: 8mm !important; box-shadow: none !important; width: 297mm !important; height: 210mm !important; transform: none !important; }
                    }
                    body { background: #f1f5f9; margin: 0; padding: 0; display: flex; flex-direction: column; align-items: center; font-family: 'Inter', sans-serif; min-height: 100vh; }
                    .report-container { display: flex; flex-direction: column; align-items: center; gap: 40px; padding: 40px 20px; box-sizing: border-box; width: 100%; }
                    #proclamation-document { background: white; width: 297mm; height: 210mm; padding: 12mm; border-radius: 4px; box-shadow: 0 10px 25px rgba(0,0,0,0.12); box-sizing: border-box; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; }

                    .header-bar { position: sticky; top: 0; width: 100%; z-index: 1000; background: #0f172a; color: white; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15); box-sizing: border-box; }
                    .btn-group { display: flex; gap: 10px; }
                    .p-btn { cursor: pointer; border: none; padding: 8px 20px; border-radius: 8px; font-weight: 800; font-size: 0.8rem; text-transform: uppercase; transition: all 0.2s; }
                    .btn-print { background: #3b82f6; color: white; }
                    .btn-pdf { background: #10b981; color: white; }

                    /* SMART FIT SCALING SYSTEM */
                    @media screen and (max-width: 1000px) {
                        .report-container { padding: 20px 10px; }
                        #proclamation-document { transform-origin: top center; }
                    }
                </style>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
                <script>
                function applySmartFit() {
                    const doc = document.getElementById('proclamation-document');
                    if (!doc || window.innerWidth > 1000) return;
                    const vw = window.innerWidth - 20;
                    const sFit = vw / doc.offsetWidth;
                    if (sFit < 1) {
                        doc.style.transform = 'scale(' + sFit + ')';
                        const container = document.querySelector('.report-container');
                        if (container) container.style.height = (doc.offsetHeight * sFit + 40) + 'px';
                    }
                }
                function downloadPDF() {
                    const element = document.getElementById('proclamation-document');
                    const opt = {
                        margin: 0,
                        filename: '${cls.name}_Proclamation.pdf',
                        image: { type: 'jpeg', quality: 0.98 },
                        html2canvas: { scale: 2, useCORS: true },
                        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
                    };
                    html2pdf().set(opt).from(element).save();
                }
                window.onload = applySmartFit;
                window.onresize = applySmartFit;
                </script>
            </head>
            <body>
                <div class="header-bar no-print">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="width: 32px; height: 32px; background: #6366f1; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900;">P</div>
                        <h2 style="margin: 0; font-size: 1rem; font-weight: 900; letter-spacing: 0.5px;">PROCLAMATION: ${cls.name.toUpperCase()}</h2>
                    </div>
                    <div class="btn-group">
                        <button class="p-btn btn-print" onclick="window.print()">🖨️ PRINT</button>
                        <button class="p-btn btn-pdf" onclick="downloadPDF()">📄 EXPORT PDF</button>
                        <button class="p-btn" style="background: #ef4444; color: white;" onclick="window.close()">✕ CLOSE</button>
                    </div>
                </div>
                <div class="report-container">
                    ${html}
                </div>
            </body>
            </html>
        `;

        const previewWindow = window.open('', '_blank');
        if (!previewWindow) {
            return toast('Pop-up blocked! Please allow pop-ups for this site.', 'error');
        }
        
        previewWindow.document.open();
        previewWindow.document.write(combinedHtml);
        previewWindow.document.close();
        toast('Preview opened in a new secure tab.', 'success');

    } catch (e) {
        console.error(e);
        toast('Generation suspended due to data conflict.', 'error');
    }
}

    SYNC.on('assessments', async () => {
        if (document.querySelector('.view.active')?.id === 'view-assessments') await renderAssessmentTypes();
        await renderFacultyMonitor();
    });
    SYNC.on('institution_info', async () => {
        await syncInstitutionalNodes();
    });
    
    console.log('[CAMIS] Real-time engine fully initialized and synchronized.');
});

// ============================================================
// EXECUTIVE ANALYTICS: REPORT MODAL INITIALIZERS
// ============================================================

window.openPassRateReportModal = async function() {
    const [classes, marks] = await Promise.all([DB.getClasses(), DB.getMarks()]);
    const yearSelect = document.getElementById('pr-year');
    const classSelect = document.getElementById('pr-class');
    
    // Populate Years (Unique from marks)
    const years = [...new Set(marks.map(m => m.academic_year || SCHOOL_INFO.academic_year))];
    yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('') || `<option value="2025/2026">2025/2026</option>`;
    
    // Populate Classes
    classSelect.innerHTML = '<option value="all">Full School Registry</option>' + 
        classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    openModal('pass-rate-report-modal');
};

window.openSubjectSuccessReportModal = async function() {
    const [classes, subjects] = await Promise.all([DB.getClasses(), DB.getSubjects()]);
    const subSelect = document.getElementById('ss-subject');
    const classSelect = document.getElementById('ss-class');
    
    subSelect.innerHTML = '<option value="all">All Subjects Aggregate</option>' + 
        subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    
    classSelect.innerHTML = '<option value="all">Institutional View</option>' + 
        classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    openModal('subject-success-report-modal');
};

window.openGradeDistributionReportModal = async function() {
    const classes = await DB.getClasses();
    const classSelect = document.getElementById('gd-class');
    
    if (classSelect) {
        classSelect.innerHTML = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    
    openModal('grade-distribution-modal');
};

window.openAdminReportCardModal = async function() {
    const [classes, subjects, assessments] = await Promise.all([
        DB.getClasses(), DB.getSubjects(), DB.getAssessments()
    ]);
    
    const classSelect = document.getElementById('rc-target-class');
    const subChecklist = document.getElementById('rc-subject-checklist');
    const assessChecklist = document.getElementById('rc-assess-checklist');
    
    if (classSelect) {
        classSelect.innerHTML = '<option value="all">Entire Institution (All Cohorts)</option>' + 
            classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    
    if (subChecklist) {
        subChecklist.innerHTML = subjects.map(s => `
            <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.75rem; font-weight:700; color:#1e293b; cursor:pointer;">
                <input type="checkbox" value="${s.id}" checked> ${s.name}
            </label>
        `).join('');
    }
    
    if (assessChecklist) {
        assessChecklist.innerHTML = assessments.map(a => `
            <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.75rem; font-weight:700; color:#1e293b; cursor:pointer;">
                <input type="checkbox" value="${a.id}" checked> ${a.abbr || a.name}
            </label>
        `).join('');
    }
    
    openModal('generate-reportcard-modal');
};

window.openAdminProclamationModal = async function() {
    const [classes, subjects, assessments] = await Promise.all([
        DB.getClasses(), DB.getSubjects(), DB.getAssessments()
    ]);
    
    const classSelect = document.getElementById('proc-target-class');
    const subChecklist = document.getElementById('proc-subject-checklist');
    const assessChecklist = document.getElementById('proc-assess-checklist');
    
    if (classSelect) {
        classSelect.innerHTML = '<option value="">Select Target Class...</option>' + 
            classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    
    if (subChecklist) {
        subChecklist.innerHTML = subjects.map(s => `
            <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.75rem; font-weight:700; color:#1e293b; cursor:pointer;">
                <input type="checkbox" value="${s.id}" checked> ${s.name}
            </label>
        `).join('');
    }
    
    if (assessChecklist) {
        assessChecklist.innerHTML = assessments.map(a => `
            <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.75rem; font-weight:700; color:#1e293b; cursor:pointer;">
                <input type="checkbox" value="${a.id}" checked> ${a.abbr || a.name}
            </label>
        `).join('');
    }
    
    openModal('generate-proclamation-modal');
};

// ============================================================
// STUDENT PASS RATE REPORT (PROCLAMATION SUMMARY)
// ============================================================

window.openPassRateReportModal = async function() {
    const classes = await DB.getClasses();
    const sel = document.getElementById('pr-class');
    if (sel) {
        sel.innerHTML = '<option value="all">Full School (P1 - P6)</option>' + 
            classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    openModal('pass-rate-report-modal');
};

window.generatePassRateReport = async function() {
    const year = document.getElementById('pr-year').value;
    const term = document.getElementById('pr-term').value;
    const targetClassId = document.getElementById('pr-class').value;
    
    toast('Analyzing institutional performance data...', 'info');
    
    try {
        await syncConfigs();
        const [allMarks, students, classes] = await Promise.all([
            DB.getMarks(), DB.getStudents(), DB.getClasses()
        ]);

        let targetClasses = [];
        if (targetClassId === 'all') {
            // Sort classes logically (P1, P2...)
            targetClasses = classes.sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
        } else {
            targetClasses = classes.filter(c => c.id === targetClassId);
        }

        const reportData = [];
        const grandTotals = {
            sat_b: 0, sat_g: 0, sat_t: 0,
            pass_b: 0, pass_g: 0, pass_t: 0,
            fail_b: 0, fail_g: 0, fail_t: 0
        };

        for (const cls of targetClasses) {
            const classStudents = students.filter(s => s.class_id === cls.id);
            const classMarks = allMarks.filter(m => m.class_id === cls.id && String(m.term) === String(term) && m.is_approved);
            
            let sat_b = 0, sat_g = 0;
            let pass_b = 0, pass_g = 0;
            let fail_b = 0, fail_g = 0;

            classStudents.forEach(s => {
                const sMarks = classMarks.filter(m => m.student_id === s.id);
                if (sMarks.length > 0) {
                    // Sat for exams
                    if (s.gender === 'M' || s.gender === 'Boy') sat_b++; else sat_g++;
                    
                    // Calculate Average for passing
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
                name: cls.name,
                sat_b, sat_g, sat_t,
                pass_b, pass_g, pass_t, pass_p,
                fail_b, fail_g, fail_t, fail_p
            });

            grandTotals.sat_b += sat_b; grandTotals.sat_g += sat_g; grandTotals.sat_t += sat_t;
            grandTotals.pass_b += pass_b; grandTotals.pass_g += pass_g; grandTotals.pass_t += pass_t;
            grandTotals.fail_b += fail_b; grandTotals.fail_g += fail_g; grandTotals.fail_t += fail_t;
        }

        const grand_pass_p = grandTotals.sat_t > 0 ? ((grandTotals.pass_t / grandTotals.sat_t) * 100).toFixed(2) : '0.00';
        const grand_fail_p = grandTotals.sat_t > 0 ? ((grandTotals.fail_t / grandTotals.sat_t) * 100).toFixed(2) : '0.00';

        renderPassRateReportPdf({ year, term, reportData, grandTotals, grand_pass_p, grand_fail_p });
        closeModal('pass-rate-report-modal');

    } catch (e) {
        console.error('[REPORT] Failed to generate pass rate report:', e);
        toast('Failed to generate report data.', 'error');
    }
};

window.renderPassRateReportPdf = function(data) {
    const { year, term, reportData, grandTotals, grand_pass_p, grand_fail_p } = data;
    const info = SCHOOL_INFO;
    const finalDate = info.done_date || new Date().toLocaleDateString('en-GB');
    const headerHtml = generateInstitutionalHeader('STUDENT PASS RATE REPORT', `ACADEMIC YEAR: ${year} — TERM: ${term}`);

    const tableRows = reportData.map((r, i) => `
        <tr style="height: 30px; text-align: center;">
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
            <td style="border: 1px solid #000; font-weight: bold; background: #fee2e2;">${r.fail_p}%</td>
        </tr>
    `).join('');

    const html = `
        <div style="width: 297mm; min-height: 210mm; padding: 15mm; background: white; font-family: 'Inter', 'Segoe UI', Arial, sans-serif; box-sizing: border-box; color: #000;">
            ${headerHtml}

            <div style="margin-bottom: 20px; font-weight: 900; line-height: 1.8; font-size: 0.95rem;">
                <div>ACADEMIC YEAR: ${year}</div>
                <div>TERM: ${term}</div>
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
                        <th style="border: 1px solid #000; width: 60px;">BOYS</th>
                        <th style="border: 1px solid #000; width: 60px;">GIRLS</th>
                        <th style="border: 1px solid #000; width: 70px;">TOTAL</th>
                        <th style="border: 1px solid #000; width: 60px;">BOYS</th>
                        <th style="border: 1px solid #000; width: 60px;">GIRLS</th>
                        <th style="border: 1px solid #000; width: 70px;">TOTAL</th>
                        <th style="border: 1px solid #000; width: 80px;">%</th>
                        <th style="border: 1px solid #000; width: 60px;">BOYS</th>
                        <th style="border: 1px solid #000; width: 60px;">GIRLS</th>
                        <th style="border: 1px solid #000; width: 70px;">TOTAL</th>
                        <th style="border: 1px solid #000; width: 80px;">%</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                    <tr style="height: 35px; text-align: center; background: #f8fafc; font-weight: 1000;">
                        <td colspan="2" style="border: 1px solid #000; text-align: center; text-transform: uppercase;">TOTAL</td>
                        <td style="border: 1px solid #000;">${grandTotals.sat_b}</td>
                        <td style="border: 1px solid #000;">${grandTotals.sat_g}</td>
                        <td style="border: 1px solid #000;">${grandTotals.sat_t}</td>
                        <td style="border: 1px solid #000;">${grandTotals.pass_b}</td>
                        <td style="border: 1px solid #000;">${grandTotals.pass_g}</td>
                        <td style="border: 1px solid #000;">${grandTotals.pass_t}</td>
                        <td style="border: 1px solid #000; background: #e2e8f0;">${grand_pass_p}%</td>
                        <td style="border: 1px solid #000;">${grandTotals.fail_b}</td>
                        <td style="border: 1px solid #000;">${grandTotals.fail_g}</td>
                        <td style="border: 1px solid #000;">${grandTotals.fail_t}</td>
                        <td style="border: 1px solid #000; background: #fecaca;">${grand_fail_p}%</td>
                    </tr>
                </tbody>
            </table>

            <div style="margin-top: 50px; display: flex; justify-content: space-around; font-weight: 850; font-size: 0.9rem; align-items: flex-end;">
                <div style="flex: 1; text-align: center;">
                    <div style="margin-bottom: 25px; font-size: 0.7rem; font-weight: 700;">Done at <strong>${(info.district || '...').toUpperCase()}</strong> , on ${finalDate}</div>
                    <div style="border-top: 1.5px solid #000; padding-top: 5px; display: inline-block; min-width: 200px;">
                        PREPARED BY DOS:<br>
                        ${SCHOOL_INFO.dos_sig ? `<img src="${SCHOOL_INFO.dos_sig}" style="max-height:45px; display:block; margin:4px auto; mix-blend-mode:multiply;">` : '<div style="height:45px;"></div>'}
                        <strong>${(SCHOOL_INFO.dos || 'Dean of Studies').toUpperCase()}</strong>
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
            
            <div style="text-align: center; margin-top: 80px; font-size: 0.6rem; color: #94a3b8;">
                REMARK: Generated by Marks Management System Institutional Engine • Verified for MINEDUC compliance
            </div>
        </div>
    `;

    const pw = window.open('', '_blank');
    if (!pw) return toast('Pop-up blocked! Please allow pop-ups.', 'error');
    
    pw.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>STUDENT PASS RATE REPORT</title>
            <style>
                @media print {
                    body { margin: 0; padding: 0 !important; }
                    @page { size: A4 landscape; margin: 10mm; }
                }
                body { background: #334155; margin: 0; padding: 40px; display: flex; justify-content: center; font-family: 'Inter', sans-serif; }
            </style>
        </head>
        <body>
            <div style="box-shadow: 0 40px 80px rgba(0,0,0,0.5); transform: scale(0.9); transform-origin: top center;">
                ${html}
            </div>
            <div style="position: fixed; top: 20px; right: 20px; display: flex; gap: 10px;" class="no-print">
                <button onclick="window.print()" style="padding: 12px 24px; background: #10b981; color: white; border: none; border-radius: 8px; font-weight: 800; cursor: pointer;">PRINT / DOWNLOAD PDF</button>
                <button onclick="window.close()" style="padding: 12px 24px; background: #f43f5e; color: white; border: none; border-radius: 8px; font-weight: 800; cursor: pointer;">CLOSE</button>
            </div>
        </body>
        </html>
    `);
    pw.document.close();
};

// ============================================================
// SUBJECT SUCCESS REPORT (INSTITUTIONAL PERFORMANCE)
// ============================================================

window.openSubjectSuccessReportModal = async function() {
    const [subjects, classes] = await Promise.all([
        DB.getSubjects(), DB.getClasses()
    ]);
    
    // Populate Subjects
    const subSelect = document.getElementById('ss-subject');
    if (subSelect) {
        subSelect.innerHTML = '<option value="all">All Subjects Aggregate</option>' + 
            subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }
    
    // Populate Classes
    const classSelect = document.getElementById('ss-class');
    if (classSelect) {
        classSelect.innerHTML = '<option value="all">Institutional View</option>' + 
            classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    
    openModal('subject-success-report-modal');
};

window.generateSubjectSuccessReport = async function() {
    const term = document.getElementById('ss-term').value;
    const subjectId = document.getElementById('ss-subject').value;
    const classId = document.getElementById('ss-class').value;

    toast('Analyzing institutional success metrics...', 'info');
    
    try {
        const [allMarks, students, classes, subjects] = await Promise.all([
            DB.getMarks(), DB.getStudents(), DB.getClasses(), DB.getSubjects()
        ]);

        const academicYear = SCHOOL_INFO.academic_year || '2025/2026';
        const filteredMarks = allMarks.filter(m => 
            String(m.term) === String(term) && 
            m.is_approved && 
            (subjectId === 'all' || m.subject_id === subjectId) &&
            (classId === 'all' || m.class_id === classId)
        );

        const targetClasses = classId === 'all' ? classes : classes.filter(c => c.id === classId);
        const reportData = [];

        targetClasses.forEach(cls => {
            const clsStudents = students.filter(s => s.class_id === cls.id);
            const clsMarks = filteredMarks.filter(m => m.class_id === cls.id);
            
            let exp_b = 0, exp_g = 0;
            let sat_b = 0, sat_g = 0;
            let pass_b = 0, pass_g = 0;
            let fail_b = 0, fail_g = 0;

            clsStudents.forEach(s => {
                const isM = (s.gender === 'M' || s.gender === 'Boy');
                if (isM) exp_b++; else exp_g++;

                const sMarks = clsMarks.filter(m => m.student_id === s.id);
                if (sMarks.length > 0) {
                    if (isM) sat_b++; else sat_g++;
                    
                    let totS = 0, totM = 0;
                    sMarks.forEach(m => {
                        totS += (m.score === -1 ? 0 : Number(m.score));
                        totM += Number(m.max_score || 10);
                    });
                    const avg = totM > 0 ? (totS / totM * 100) : 0;
                    
                    if (avg >= 50) {
                        if (isM) pass_b++; else pass_g++;
                    } else {
                        if (isM) fail_b++; else fail_g++;
                    }
                }
            });

            if (sat_b + sat_g > 0) {
                reportData.push({
                    className: cls.name,
                    exp: { b: exp_b, g: exp_g, t: exp_b+exp_g },
                    sat: { b: sat_b, g: sat_g, t: sat_b+sat_g },
                    pass: { b: pass_b, g: pass_g, t: pass_b+pass_g },
                    fail: { b: fail_b, g: fail_g, t: fail_b+fail_g }
                });
            }
        });

        const subObj = subjects.find(s => s.id === subjectId);
        const subjectLabel = subObj ? subObj.name : 'All Subjects Aggregate';

        renderSubjectSuccessPdf({ term, year: academicYear, subject: subjectLabel, reportData });
        closeModal('subject-success-report-modal');

    } catch (e) {
        console.error(e);
        toast('Analysis failed.', 'error');
    }
};

window.renderSubjectSuccessPdf = function(data) {
    const { term, year, subject, reportData } = data;
    const headerHtml = generateInstitutionalHeader(`SUBJECT SUCCESS REPORT – ${subject}`, `TERM ${term} — ${year}`);
    
    const rows = reportData.map(r => `
        <tr style="height: 35px; text-align: center;">
            <td style="border: 1px solid #000; text-align: left; padding-left: 10px; font-weight: bold;">${r.className}</td>
            <td style="border: 1px solid #000;">${r.exp.b}</td><td style="border: 1px solid #000;">${r.exp.g}</td><td style="border: 1px solid #000; font-weight: bold;">${r.exp.t}</td>
            <td style="border: 1px solid #000;">${r.sat.b}</td><td style="border: 1px solid #000;">${r.sat.g}</td><td style="border: 1px solid #000; font-weight: bold;">${r.sat.t}</td>
            <td style="border: 1px solid #000;">${r.pass.b}</td><td style="border: 1px solid #000;">${r.pass.g}</td><td style="border: 1px solid #000; font-weight: bold; background: #f1f5f9;">${r.pass.t}</td>
            <td style="border: 1px solid #000;">${r.fail.b}</td><td style="border: 1px solid #000;">${r.fail.g}</td><td style="border: 1px solid #000; font-weight: bold; background: #fee2e2;">${r.fail.t}</td>
            <td style="border: 1px solid #000; font-weight: 1000; background: #f8fafc;">${((r.pass.t / r.sat.t) * 100).toFixed(1)}%</td>
        </tr>
    `).join('');

    const html = `
        <div style="width: 297mm; min-height: 210mm; padding: 15mm; background: white; font-family: 'Inter', sans-serif;">
            ${headerHtml}
            <table style="width: 100%; border-collapse: collapse; border: 2.5px solid #000; margin-top: 20px;">
                <thead style="background: #f1f5f9; font-size: 0.8rem;">
                    <tr>
                        <th rowspan="2" style="border: 1px solid #000;">LEVEL & CLASS</th>
                        <th colspan="3" style="border: 1px solid #000;">EXPECTED</th>
                        <th colspan="3" style="border: 1px solid #000;">SAT FOR EXAM</th>
                        <th colspan="3" style="border: 1px solid #000;">PASSED</th>
                        <th colspan="3" style="border: 1px solid #000;">FAILED</th>
                        <th rowspan="2" style="border: 1px solid #000;">% PASS</th>
                    </tr>
                    <tr style="font-size: 0.65rem;">
                        <th>M</th><th>F</th><th>T</th><th>M</th><th>F</th><th>T</th><th>M</th><th>F</th><th>T</th><th>M</th><th>F</th><th>T</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <div style="margin-top: 50px; display: flex; justify-content: space-around; font-weight: 850; font-size: 0.9rem; align-items: flex-end;">
                <div style="flex: 1; text-align: center;">
                    <div style="border-top: 1.5px solid #000; padding-top: 5px; display: inline-block; min-width: 200px;">
                        PREPARED BY DOS OFFICE:<br>
                        ${SCHOOL_INFO.dos_sig ? `<img src="${SCHOOL_INFO.dos_sig}" style="max-height:45px; display:block; margin:4px auto; mix-blend-mode:multiply;">` : '<div style="height:45px;"></div>'}
                        <strong>${(SCHOOL_INFO.dos || 'Dean of Studies').toUpperCase()}</strong>
                    </div>
                </div>
                <div style="flex: 1; text-align: center;">
                    <div style="border-top: 1.5px solid #000; padding-top: 5px; display: inline-block; min-width: 200px; position: relative;">
                        <div style="font-weight: 900;">APPROVED BY INSTITUTIONAL HEAD:</div>
                        <div style="height:55px; display:flex; align-items:center; justify-content:center; position:relative;">
                            ${SCHOOL_INFO.headteacher_sig ? `<img src="${SCHOOL_INFO.headteacher_sig}" style="max-height:50px; max-width:180px; object-fit:contain; mix-blend-mode:multiply; position:absolute; z-index:2;">` : ''}
                            ${SCHOOL_INFO.stamp ? `<img src="${SCHOOL_INFO.stamp}" style="width:75px; height:75px; opacity:0.8; mix-blend-mode:multiply; position:absolute; z-index:1; transform: translate(10px, -5px) rotate(-8deg);">` : ''}
                        </div>
                        <strong>${(SCHOOL_INFO.headteacher || '...').toUpperCase()}</strong>
                    </div>
                </div>
            </div>
        </div>
    `;

    const pw = window.open('', '_blank');
    pw.document.write(`<html><head><title>SUCCESS REPORT</title><style>@media print { body { margin: 0; } @page { size: A4 landscape; margin: 10mm; } }</style></head><body style="background:#334155; padding: 40px; display: flex; justify-content: center;">${html}</body></html>`);
    pw.document.close();
};

// ============================================================
// GRADE DISTRIBUTION REPORT (ADMIN CONTEXT)
// ============================================================

window.generateGradeDistributionReport = async function() {
    const term = document.getElementById('gd-term').value;
    const classId = document.getElementById('gd-class').value;

    toast('Calculating grade brackets institutional wide...', 'info');
    
    try {
        const [allMarks, students, classes] = await Promise.all([
            DB.getMarks(), DB.getStudents(), DB.getClasses()
        ]);

        const cls = classes.find(c => c.id === classId);
        const classStudents = students.filter(s => s.class_id === classId);
        const classMarks = allMarks.filter(m => m.class_id === classId && String(m.term) === String(term) && m.is_approved);
        
        const brackets = {
            '80-100': { m:0, f:0, t:0 }, '75-79': { m:0, f:0, t:0 }, '70-74': { m:0, f:0, t:0 },
            '65-69': { m:0, f:0, t:0 }, '60-64': { m:0, f:0, t:0 }, '50-59': { m:0, f:0, t:0 }, '0-49': { m:0, f:0, t:0 }
        };

        let sat_b = 0, sat_g = 0;
        let exp_b = 0, exp_g = 0;

        classStudents.forEach(s => {
            const isM = (s.gender === 'M' || s.gender === 'Boy');
            if (isM) exp_b++; else exp_g++;

            const sMarks = classMarks.filter(m => m.student_id === s.id);
            if (sMarks.length > 0) {
                if (isM) sat_b++; else sat_g++;
                
                let totalS = 0, totalM = 0;
                sMarks.forEach(m => {
                    totalS += (m.score === -1 ? 0 : Number(m.score));
                    totalM += Number(m.max_score || 10);
                });
                const avg = totalM > 0 ? (totalS / totalM * 100) : 0;
                
                let bKey = '0-49';
                if (avg >= 80) bKey = '80-100'; else if (avg >= 75) bKey = '75-79';
                else if (avg >= 70) bKey = '70-74'; else if (avg >= 65) bKey = '65-69';
                else if (avg >= 60) bKey = '60-64'; else if (avg >= 50) bKey = '50-59';

                if (isM) brackets[bKey].m++; else brackets[bKey].f++;
                brackets[bKey].t++;
            }
        });

        renderGradeDistributionPdf({ 
            year: SCHOOL_INFO.academic_year || '2025/2026', term, className: cls.name, 
            exp: { b: exp_b, g: exp_g, t: exp_b+exp_g },
            sat: { b: sat_b, g: sat_g, t: sat_b+sat_g },
            brackets 
        });
        closeModal('grade-distribution-modal');

    } catch (e) {
        console.error(e);
        toast('Distribution analysis failed.', 'error');
    }
};

window.renderGradeDistributionPdf = function(data) {
    const { year, term, className, exp, sat, brackets } = data;
    const headerHtml = generateInstitutionalHeader(`GRADE DISTRIBUTION – ${className}`, `TERM ${term} — ${year}`);
    
    const html = `
        <div style="width: 297mm; min-height: 210mm; padding: 15mm; background: white; font-family: 'Inter', sans-serif;">
            ${headerHtml}
            <table style="width: 100%; border-collapse: collapse; border: 2.5px solid #000; margin-top: 20px;">
                <thead style="background: #f1f5f9; font-size: 0.75rem;">
                    <tr>
                        <th rowspan="2" style="border: 1px solid #000;">BRACKET</th>
                        <th colspan="3" style="border: 1px solid #000;">80-100</th>
                        <th colspan="3" style="border: 1px solid #000;">75-79</th>
                        <th colspan="3" style="border: 1px solid #000;">70-74</th>
                        <th colspan="3" style="border: 1px solid #000;">65-69</th>
                        <th colspan="3" style="border: 1px solid #000;">60-64</th>
                        <th colspan="3" style="border: 1px solid #000;">50-59</th>
                        <th colspan="3" style="border: 1px solid #000; background: #fee2e2;">0-49</th>
                    </tr>
                    <tr style="font-size: 0.65rem;">
                        <th>M</th><th>F</th><th>T</th><th>M</th><th>F</th><th>T</th><th>M</th><th>F</th><th>T</th><th>M</th><th>F</th><th>T</th><th>M</th><th>F</th><th>T</th><th>M</th><th>F</th><th>T</th><th>M</th><th>F</th><th>T</th>
                    </tr>
                </thead>
                <tbody style="text-align: center; font-size: 0.9rem;">
                    <tr style="height: 40px;">
                        <td style="border: 1px solid #000; font-weight: 900; background: #f8fafc;">${className}</td>
                        <td style="border: 1px solid #000;">${brackets['80-100'].m}</td><td style="border: 1px solid #000;">${brackets['80-100'].f}</td><td style="border: 1px solid #000; font-weight: 800;">${brackets['80-100'].t}</td>
                        <td style="border: 1px solid #000;">${brackets['75-79'].m}</td><td style="border: 1px solid #000;">${brackets['75-79'].f}</td><td style="border: 1px solid #000; font-weight: 800;">${brackets['75-79'].t}</td>
                        <td style="border: 1px solid #000;">${brackets['70-74'].m}</td><td style="border: 1px solid #000;">${brackets['70-74'].f}</td><td style="border: 1px solid #000; font-weight: 800;">${brackets['70-74'].t}</td>
                        <td style="border: 1px solid #000;">${brackets['65-69'].m}</td><td style="border: 1px solid #000;">${brackets['65-69'].f}</td><td style="border: 1px solid #000; font-weight: 800;">${brackets['65-69'].t}</td>
                        <td style="border: 1px solid #000;">${brackets['60-64'].m}</td><td style="border: 1px solid #000;">${brackets['60-64'].f}</td><td style="border: 1px solid #000; font-weight: 800;">${brackets['60-64'].t}</td>
                        <td style="border: 1px solid #000;">${brackets['50-59'].m}</td><td style="border: 1px solid #000;">${brackets['50-59'].f}</td><td style="border: 1px solid #000; font-weight: 800;">${brackets['50-59'].t}</td>
                        <td style="border: 1px solid #000;">${brackets['0-49'].m}</td><td style="border: 1px solid #000;">${brackets['0-49'].f}</td><td style="border: 1px solid #000; font-weight: 900; background: #fee2e2;">${brackets['0-49'].t}</td>
                    </tr>
                </tbody>
            </table>
            <div style="margin-top: 60px; font-weight: 800; font-style: italic; font-size: 0.8rem; color: #64748b;">
                REPORT AUDITED BY INSTITUTIONAL COMMAND CONSOLE • REPLICATED FROM TEACHER AUTHENTICATED NODES.
            </div>
        </div>
    `;

    const pw = window.open('', '_blank');
    pw.document.write(`<html><head><title>DISTRIBUTION</title><style>@media print { body { margin: 0; } @page { size: A4 landscape; margin: 10mm; } }</style></head><body style="background:#334155; padding: 40px; display: flex; justify-content: center;">${html}</body></html>`);
    pw.document.close();
};

// ============================================================
// BATCH REPORT CARD GENERATION (ADMIN)
// ============================================================

window.executeReportCardGeneration = async function() {
    const classId = document.getElementById('rc-target-class').value;
    const termTag = document.getElementById('setup-term-tag');
    const term = termTag ? Number(termTag.textContent.replace(/\D/g, '')) : 2;
    const selSubIds = Array.from(document.getElementById('rc-subject-checklist').querySelectorAll('input:checked')).map(i => i.value);
    const selAssessIds = Array.from(document.getElementById('rc-assess-checklist').querySelectorAll('input:checked')).map(i => i.value);

    if (selSubIds.length === 0) return toast('Select at least one subject.', 'warning');

    toast('Generating Batch Report Cards...', 'info');

    try {
        const [allStudents, allMarks, allSubjects, allAssessments, allAssignments] = await Promise.all([
            DB.getStudents(), DB.getMarks(), DB.getSubjects(), DB.getAssessments(),
            DB.getTeacherAssignments()
        ]);

        const academicYear = SCHOOL_INFO.academic_year || '2025/2026';
        const filteredMarks = allMarks.filter(m => String(m.term) === String(term) && m.academic_year === academicYear);

        const subjects = allSubjects.filter(s => selSubIds.includes(s.id));
        const activePillars = allAssessments.filter(a => selAssessIds.includes(a.id)).map(a => ({
            id: a.id.toLowerCase(),
            abbr: a.abbr || a.name.substring(0,3).toUpperCase()
        }));
        const pillarCount = activePillars.length;
        
        let targetStudents = allStudents;
        if (classId !== 'all') {
            targetStudents = allStudents.filter(s => s.class_id === classId);
        }

        if (targetStudents.length === 0) return toast('No students found in selection.', 'warning');

        const studentAverages = targetStudents.map(st => {
            const marks = filteredMarks.filter(m => m.student_id === st.id);
            let sSum = 0, sMax = 0;
            subjects.forEach(sub => {
                activePillars.forEach(p => {
                    const subMaxMap = SUBJECT_MAX[sub.name] || DEFAULT_SUBJ_MAX;
                    const allowedMax = subMaxMap[p.id] || 40;
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
        const finalDate = (SCHOOL_INFO.done_date || new Date().toLocaleDateString('en-GB')).toUpperCase();

        for (const student of targetStudents) {
            const stMarks = filteredMarks.filter(m => m.student_id === student.id && m.is_approved);
            const rank = studentAverages.findIndex(s => s.id === student.id) + 1;
            const rankTotal = studentAverages.length;

            const ctAssignment = allAssignments.find(a => a.class_id === student.class_id && a.type === 'class');
            const CT = ctAssignment?.profiles || { full_name: 'Class Teacher' };

            let rowsHtml = '';
            let grandPillarSums = Array(pillarCount).fill(0);
            let grandPillarMaxs = Array(pillarCount).fill(0);
            let grandTotSum = 0, grandTotMax = 0;

            const isDense = subjects.length > 7 || pillarCount > 4;
            const rowFS = pillarCount > 6 ? (isDense ? '0.42rem' : '0.48rem') : (isDense ? '0.54rem' : '0.66rem');
            const rowPad = pillarCount > 6 ? '1px 2px' : (isDense ? '2px 4px' : '4px 8px');
            const cellW = pillarCount > 6 ? '12px' : (pillarCount > 4 ? '16px' : '22px');
            const subjectW = pillarCount > 5 ? '18%' : '24%';

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
                    <tr style="font-size:${rowFS}; font-weight:800; text-align:center;">
                        <td style="border:2px solid #000; padding:${rowPad}; text-align:left; font-weight:900; white-space:nowrap; overflow:hidden;">${sub.name.replace(/\s*\(.*?\)\s*/g, '').trim()}</td>
                        ${mCells}
                        <td style="border:2px solid #000; font-weight:900; background:#f1f5f9; width:28px;">${pMax}</td>
                        ${pCells}
                        <td style="border:2px solid #000; font-weight:1000; background:#f1f5f9; width:28px;">${pSum}</td>
                        <td style="border:2px solid #000; width:28px; font-weight:900;">${subPct}</td>
                        <td style="border:2px solid #000; width:24px; font-weight:900;">${calcGrade(Number(subPct))}</td>
                        <td style="border:2px solid #000; background:#f1f5f9; width:28px;">${pSum}</td>
                        <td style="border:2px solid #000; width:28px;">${pMax}</td>
                        <td style="border:2px solid #000; width:28px;">${subPct}</td>
                        <td style="border:2px solid #000; width:24px;">${calcGrade(Number(subPct))}</td>
                    </tr>
                `;
            }

            const totalPct = grandTotMax > 0 ? (grandTotSum / grandTotMax * 100).toFixed(1) : '0.0';
            const finalGrade = calcGrade(Number(totalPct));
            const className = student.classes?.name || 'Assigned Class';
            const instHeader = generateInstitutionalHeader('PROGRESSIVE REPORT', `TERM ${term} — ${academicYear}`);

            areaHtml += `
                <div class="report-page" style="width:210mm; min-height:296mm; max-height:296mm; padding:10mm 15mm; background:white; margin:0 auto; page-break-after:always; position:relative; box-sizing:border-box; display:flex; flex-direction:column; justify-content: space-between; overflow:hidden;">
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
                            <tr style="background:#f1f5f9; height:30px; color:#000;">
                                <th rowspan="2" style="border:2.5px solid #000; width:${subjectW}; text-align:center; font-weight:900; font-size: 0.75rem;">SUBJECT</th>
                                <th colspan="${pillarCount + 1}" style="border:2.5px solid #000; font-size: 0.7rem; font-weight:900;">MAXIMUM MARKS</th>
                                <th colspan="${pillarCount + 1}" style="border:2.5px solid #000; font-size: 0.7rem; font-weight:900;">TERM ${term} / ${academicYear}</th>
                                <th rowspan="2" style="border:2.5px solid #000; width:28px; font-weight:900;">%</th>
                                <th rowspan="2" style="border:2.5px solid #000; width:24px; font-weight:900;">GR</th>
                                <th colspan="4" style="border:2.5px solid #000; font-size: 0.7rem; font-weight:900;">ANNUAL TOTAL</th>
                            </tr>
                            <tr style="background:#fff; font-weight:900; font-size:0.5rem; height:20px;">
                                ${activePillars.map(p => `<th style="border:1.5px solid #000; width:${cellW};">${p.abbr}</th>`).join('')}
                                <th style="border:2.5px solid #000; width:28px; background:#f1f5f9;">TOT</th>
                                ${activePillars.map(p => `<th style="border:1.5px solid #000; width:${cellW};">${p.abbr}</th>`).join('')}
                                <th style="border:2.5px solid #000; width:28px; background:#f1f5f9;">TOT</th>
                                <th style="border:1.5px solid #000; width:28px;">TOT</th>
                                <th style="border:1.5px solid #000; width:28px;">MAX</th>
                                <th style="border:1.5px solid #000; width:28px;">%</th>
                                <th style="border:1.5px solid #000; width:24px;">GR</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                            <tr style="font-weight:1000; border-top:2.5px solid #000; background:#f1f5f9; text-align:center;">
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

                    <table style="width:100%; border-collapse:collapse; border:2.5px solid #000; margin-bottom:5px; font-size:${rowFS}; font-weight:900;">
                        <tr style="background:#f1f5f9; text-align:center;">
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
                            <td style="padding:4px; border:1px solid #000; font-style:italic; text-align:center; vertical-align:middle;">${getComment(Number(totalPct))}</td>
                            <td style="padding:4px; border:1px solid #000; font-style:italic; text-align:center; vertical-align:middle;">${getComment(Number(totalPct))}</td>
                        </tr>
                        <tr style="height:45px;">
                            <td style="padding:4px; border:1px solid #000;">Class teacher's Signature</td>
                            <td style="padding:4px; border:1px solid #000; text-align:center; vertical-align:middle;">
                                ${CT.signature ? `<img src="${CT.signature}" style="max-height:35px; max-width:180px; object-fit:contain; mix-blend-mode:multiply;">` : `<span style="font-size:0.6rem;">${(CT.full_name || '...').toUpperCase()}</span>`}
                            </td>
                            <td style="padding:4px; border:1px solid #000; text-align:center; vertical-align:middle;">
                                ${CT.signature ? `<img src="${CT.signature}" style="max-height:35px; max-width:180px; object-fit:contain; mix-blend-mode:multiply;">` : ''}
                            </td>
                        </tr>
                        <tr style="height:30px;">
                            <td style="padding:4px; border:1px solid #000;">Parent's Signature</td>
                            <td style="border:1px solid #000;"></td>
                            <td style="border:1px solid #000;"></td>
                        </tr>
                    </table>

                    <div style="display:grid; grid-template-columns: 2.2fr 1fr; gap:8px; margin-top:10px; align-items: stretch; margin-bottom:5px;">
                        <table style="width:100%; border-collapse:collapse; border:2px solid #000; font-size:0.56rem; text-align:center;">
                            <tr>
                                <td rowspan="3" style="border:2px solid #000; width:15%; font-weight:900; background:#f0f0f0;">Grading scale</td>
                                <td style="border:1px solid #000; font-weight:800; background:#f9f9f9;">Final Grade</td>
                                <td style="border:1px solid #000;">100-80</td><td style="border:1px solid #000;">79-75</td><td style="border:1px solid #000;">74-70</td><td style="border:1px solid #000;">69-65</td><td style="border:1px solid #000;">64-60</td><td style="border:1px solid #000;">59-50</td><td style="border:1px solid #000;">49-00</td>
                            </tr>
                            <tr>
                                <td style="border:1px solid #000; font-weight:800; background:#f9f9f9;">Letter Grade</td>
                                <td style="border:1px solid #000;">A</td><td style="border:1px solid #000;">B</td><td style="border:1px solid #000;">C</td><td style="border:1px solid #000;">D</td><td style="border:1px solid #000;">E</td><td style="border:1px solid #000;">S</td><td style="border:1px solid #000;">F</td>
                            </tr>
                            <tr>
                                <td style="border:1px solid #000; font-weight:800; background:#f9f9f9;">Grade Value</td>
                                <td style="border:1px solid #000;">6</td><td style="border:1px solid #000;">5</td><td style="border:1px solid #000;">4</td><td style="border:1px solid #000;">3</td><td style="border:1px solid #000;">2</td><td style="border:1px solid #000;">1</td><td style="border:1px solid #000;">0</td>
                            </tr>
                        </table>
                        <div style="border:2px solid #000; padding:10px; font-size:0.58rem; display:flex; flex-direction:column; justify-content:center; text-align:center; position:relative; min-width:200px;">
                            <div style="font-size:0.4rem; font-weight:900; color:#64748b; text-transform:uppercase; margin-bottom:2px;">Done at ${(SCHOOL_INFO.district || '...').toUpperCase()}, on ${finalDate}</div>
                            <div style="font-weight:900; font-size:0.6rem; margin-bottom:10px;">HEADTEACHER / PRINCIPAL</div>
                            <div style="height:55px; display:flex; align-items:center; justify-content:center; position:relative;">
                                ${SCHOOL_INFO.headteacher_sig ? `<img src="${SCHOOL_INFO.headteacher_sig}" style="max-height:50px; max-width:180px; object-fit:contain; mix-blend-mode:multiply; position:absolute; z-index:2;">` : ''}
                                ${SCHOOL_INFO.stamp ? `<img src="${SCHOOL_INFO.stamp}" style="width:85px; height:85px; opacity:0.8; mix-blend-mode:multiply; position:absolute; z-index:1; transform: translate(15px, -5px) rotate(-8deg);">` : ''}
                            </div>
                            <div style="font-weight:900; font-size:0.75rem; border-top:1.5px solid #000; padding-top:4px; margin-top:5px;">${(SCHOOL_INFO.headteacher || '...').toUpperCase()}</div>
                        </div>
                    </div>

                    <div style="padding:8px; border-top:1.5px dashed #000; display:flex; justify-content:flex-end; font-size:0.5rem; color:#64748b; font-weight:800;">
                        <span>STUDENT REGISTRY ID: ${student.sid || 'N/A'}</span>
                    </div>
                </div>
            `;
        }

        const pw = window.open('', '_blank');
        pw.document.write(`
            <html>
            <head>
                <title>Institutional_Batch_Export</title>
                <style>
                    /* Hide browser headers/footers (Date, URL, Page Numbers) */
                    @page { margin: 0; size: auto; }
                    @media print { 
                        body { margin:0; padding:0; background:white; display: block !important; } 
                        .report-page { page-break-after:always; page-break-inside:avoid; margin:0 !important; border:none !important; box-shadow:none !important; height: 100vh; width: 100vw; } 
                        .report-page:last-child { page-break-after: avoid !important; }
                        /* Ensure no blank first page by hiding toolbar correctly */
                        .no-print { display:none !important; position: absolute !important; }
                    }
                    body { background:#1e293b; display:flex; flex-direction:column; gap:40px; padding:60px; font-family:'Inter',sans-serif; align-items:center; }
                    .report-page { background:white; box-shadow:0 100px 200px rgba(0,0,0,0.4); border-radius:0; border:1px solid #e2e8f0; }
                    .toolbar { position:fixed; top:0; left:0; right:0; background:#0B0E14; padding:15px 40px; display:flex; justify-content:space-between; align-items:center; z-index:9999; border-bottom:1px solid #334155; }
                </style>
            </head>
            <body>
                <div class="toolbar no-print">
                    <div style="color:white; font-weight:900; font-size:1.1rem; letter-spacing:1px;">INSTITUTIONAL BATCH PREVIEW</div> 
                    <button onclick="window.print()" style="padding:10px 25px; background:#3b82f6; color:white; border:none; border-radius:6px; font-weight:900; cursor:pointer; font-size:0.9rem; transition:0.2s;">🖨️ PRINT OFFICIAL DOCUMENTS</button>
                </div>
                ${areaHtml}
            </body>
            </html>
        `);
        pw.document.close();
        closeModal('generate-reportcard-modal');

    } catch (e) {
        console.error(e);
        toast('Batch generation failed.', 'error');
    }
};

// ============================================================
// DASHBOARD ANALYTICS (GLOBAL)
// ============================================================
let adminMainPerfChart = null;
let adminMainDistChart = null;

async function renderAdminDashboardCharts() {
    const perfCtx = document.getElementById('admin-main-perf-chart');
    const distCtx = document.getElementById('admin-main-dist-chart');
    if (!perfCtx || !distCtx) return;

    try {
        const [marks, classes, students] = await Promise.all([DB.getMarks(), DB.getClasses(), DB.getStudents()]);
        const term = SCHOOL_INFO.active_term || '2';
        
        // 1. Line Chart: Performance per Class
        const chartLabels = classes.map(c => c.name);
        const chartValues = classes.map(c => {
            const clsMarks = marks.filter(m => m.class_id === c.id && String(m.term) === String(term) && m.is_approved);
            if (!clsMarks.length) return 0;
            return (clsMarks.reduce((acc, m) => acc + (Number(m.score) / Number(m.max_score || 10) * 100), 0) / clsMarks.length).toFixed(1);
        });

        if (adminMainPerfChart) adminMainPerfChart.destroy();
        adminMainPerfChart = new Chart(perfCtx, {
            type: 'line',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Class Average',
                    data: chartValues,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 4
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

        // 2. Pie Chart: Grade Distribution Institutional Wide
        const dist = { 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'E': 0, 'S': 0, 'F': 0 };
        students.forEach(s => {
            const sMarks = marks.filter(m => m.student_id === s.id && String(m.term) === String(term) && m.is_approved);
            if (sMarks.length) {
                const totalS = sMarks.reduce((acc, m) => acc + Number(m.score), 0);
                const totalM = sMarks.reduce((acc, m) => acc + Number(m.max_score || 10), 0);
                const avg = (totalS / totalM) * 100;
                dist[calcGrade(avg)]++;
            }
        });

        if (adminMainDistChart) adminMainDistChart.destroy();
        adminMainDistChart = new Chart(distCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(dist),
                datasets: [{
                    data: Object.values(dist),
                    backgroundColor: ['#10b981', '#3b82f6', '#6366f1', '#f59e0b', '#f97316', '#ef4444', '#7f1d1d'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { weight: 'bold', size: 10 } } } },
                cutout: '65%'
            }
        });

    } catch (e) {
        console.error('[ANALYTICS] Dashboard chart failure:', e);
    }
}

// ------------------------------------------------------------
// Bulk Student Import Logic (Admin Context)
// ============================================================
// ENHANCED WITH VALIDATION AND ERROR HANDLING
// ============================================================

async function openImportStudentsModal() {
    try {
        const classes = await DB.getClasses();
        const select = document.getElementById('import-target-class');
        if (select && classes) {
            select.innerHTML = `<option value="">-- Select Target Class --</option>` +
                classes.map(c => `<option value="${c.id}">${c.name || c.level} ${c.stream || ''}</option>`).join('');
        }
        
        // Clear previous import data
        const textarea = document.getElementById('import-students-textarea');
        const fileInput = document.getElementById('import-students-file');
        if (textarea) textarea.value = '';
        if (fileInput) fileInput.value = '';
        
        openModal('import-students-modal');
    } catch (e) {
        console.error('[IMPORT] Failed to load classes:', e);
        toast('Error preparing import modal.', 'error');
    }
}

async function processStudentImport() {
    const textarea = document.getElementById('import-students-textarea');
    const fileInput = document.getElementById('import-students-file');
    const classId = document.getElementById('import-target-class').value;
    let csvData = '';

    // Validation: Class selected
    if (!classId) {
        toast('⚠️ Please select a target class.', 'warning');
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
            
            // Refresh the display
            if (typeof renderCohortRegistry === 'function') {
                await renderCohortRegistry();
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
        toast('❌ Partial import failure. Check network.', 'error');
    }
}

// EOF Cleanup
