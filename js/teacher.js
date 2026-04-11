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

const el = id => document.getElementById(id);

let CURRENT_YEAR = '2025-2026'; 

function toggleSidebar() {
    const sb = document.querySelector('.sidebar');
    if (sb) sb.classList.toggle('mobile-open');
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
        if (e.target.classList.contains('nav-item') || e.target.closest('.nav-item')) {
            const sb = document.querySelector('.sidebar');
            if (sb) sb.classList.remove('mobile-open');
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
let SCHOOL_INFO = { 
    school: 'RUKARA MODEL SCHOOL', 
    district: 'KAYONZA', 
    sector: 'GAHINI',
    code: '541023', 
    phone: '+250791684429',
    headteacher: 'DR.BARBANAS MUYENGWA',
    academic_year: '2025/2026',
    done_date: new Date().toLocaleDateString('en-GB')
};

function generateInstitutionalHeader(docTitle, docSubtitle = "") {
    const rwandaLogo = "js/Report image/download__92_-removebg-preview.png";
    const schoolLogo = SCHOOL_INFO.logo || "js/Report image/c41de77e-b6ee-46ea-b62f-5b6172b80738-removebg-preview.png"; 
    
    return `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; border-bottom:2px solid #000; padding-bottom:5px;">
            <img src="${rwandaLogo}" style="width:85px; height:auto; object-fit:contain;">
            <div style="text-align:center; padding: 0 5px;">
                <div style="font-size:0.8rem; font-weight:900; letter-spacing:0.5px; line-height:1.2;">REPUBLIC OF RWANDA</div>
                <div style="font-size:0.75rem; font-weight:900; margin-bottom:2px; line-height:1.2;">MINISTRY OF EDUCATION</div>
                <div style="font-size:0.7rem; font-weight:900; color:#000; line-height:1.3;">
                    <span style="font-size:0.95rem; letter-spacing:0.5px;">${(SCHOOL_INFO.school || 'MARKS MANAGEMENT SYSTEM').toUpperCase()}</span><br>
                    District: ${(SCHOOL_INFO.district || 'KAYONZA').toUpperCase()} | Sector: ${(SCHOOL_INFO.sector || 'N/A').toUpperCase()}<br>
                    School Code: ${SCHOOL_INFO.code || '00000'} | Phone: ${SCHOOL_INFO.phone || '+250 000 000'}
                </div>
            </div>
            <img src="${schoolLogo}" style="width:85px; height:85px; object-fit:contain;">
        </div>
        <div style="text-align:center; font-weight:900; font-size:1.3rem; letter-spacing:4px; text-transform:uppercase; margin-bottom:10px; background:#f1f5f9; border:2px solid #000; padding:6px;">${docTitle}</div>
        ${docSubtitle ? `<div style="text-align:center; font-size:0.8rem; font-weight:800; margin-bottom:8px;">${docSubtitle}</div>` : ''}
    `;
}

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
let MY_PROFILE = null;

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

function toggleSidebar() {
    const sidebar = document.getElementById('institutional-sidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar_collapsed', sidebar.classList.contains('collapsed'));
    }
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
        'class-monitor':    ['Class Performance Monitor',      'Audit → Jurisdiction Tracking'],
        'verification':     ['Curriculum Verification',        'Academic → Subjects'],
        'approval-status':  ['Submission Registry',            'Governance → Status'],
        'reports':          ['General Reports Gateway',        'Reports → Terminal'],
        'profile':          ['Faculty Profile',                'Account → Settings'],
    };

    if (META[viewId]) {
        const titleEl = document.getElementById('page-title');
        const breadEl = document.getElementById('page-breadcrumb');
        if (titleEl) titleEl.textContent = META[viewId][0];
        if (breadEl) {
            const parts = META[viewId][1].split(' → ');
            breadEl.innerHTML = `<span>${parts[0]}</span><span>${parts[1]}</span>`;
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
    const subjects = assignments.filter(a => a.type === 'subject');
    
    container.innerHTML = `
        <div class="table-card" style="padding:2.5rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
                <h2 style="font-size:1.25rem; font-weight:900; color:#1e293b;">📚 Verified Academic Courses</h2>
                <div class="badge badge-green">SYNCED WITH ADMIN</div>
            </div>
            <div class="resp-grid resp-grid-3">
                ${subjects.length ? subjects.map(s => `
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:20px; padding:2rem;">
                        <div style="font-size:0.65rem; font-weight:900; color:#3b82f6; text-transform:uppercase; margin-bottom:0.5rem;">Allocated Subject</div>
                        <div style="font-size:1.15rem; font-weight:900; color:#1e293b; margin-bottom:1.5rem;">${s.subjects?.name}</div>
                        <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                           <div>
                              <div style="font-size:0.6rem; font-weight:900; color:#94a3b8; text-transform:uppercase;">Class Level</div>
                              <div style="font-weight:800; color:#475569;">${s.classes?.name}</div>
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

    try {
        const [assignments, allAssignments, allStudents, allMarks, assessList] = await Promise.all([
            DB.getTeacherAssignments(MY_PROFILE.id),
            DB.getTeacherAssignments(),
            DB.getStudents(),
            DB.getMarks(),
            DB.getAssessments()
        ]);
        
        const myClassIds = [...new Set(assignments.map(a => a.class_id).filter(Boolean))];
        const activeAssessments = assessList.length ? assessList : [
            {id: 'cat', name: 'CAT', max_score: 50},
            {id: 'et', name: 'End Of Term', max_score: 100}
        ];
        
        // Process unique jurisdictions
        const uniqueAssignments = [];
        const seenAssignments = new Set();

        assignments.forEach(a => {
            if (a.type === 'subject') {
                const key = `sub_${a.class_id}_${a.subject_id}`;
                if (!seenAssignments.has(key)) {
                    seenAssignments.add(key);
                    uniqueAssignments.push(a);
                }
            }
        });

        assignments.forEach(a => {
            if (a.type === 'class' && a.class_id) {
                const classSubs = allAssignments.filter(x => x.class_id === a.class_id && x.type === 'subject');
                classSubs.forEach(subAss => {
                    const subKey = `sub_${subAss.class_id}_${subAss.subject_id}`;
                    if (!seenAssignments.has(subKey)) {
                        seenAssignments.add(subKey);
                        uniqueAssignments.push({ ...subAss, type: 'class_subject' });
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

        uniqueAssignments.forEach(s => {
            const classMarks = allMarks.filter(m => m.class_id === s.class_id && m.subject_id === s.subject_id);
            const classAverage = classMarks.length > 0 
                ? (classMarks.reduce((sum, m) => sum + (Number(m.score) || 0), 0) / 
                   classMarks.reduce((sum, m) => sum + (Number(m.max_score) || 1), 0) * 100).toFixed(1)
                : '0.0';

            // Calculate context status (Submitted/Pending per assessment)
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

            const roleLabel = s.type === 'subject' ? 'Instruction' : 'Class Lead';
            const roleColor = s.type === 'subject' ? '#3b82f6' : '#8b5cf6';
            const actionBtn = `
                <button class="btn" style="padding: 4px 10px; font-size: 0.65rem; background: var(--primary); color: white; border: none;" 
                        onclick="goToEntrySubjectClass('${s.subject_id}','${s.subjects?.name || 'Subject'}','${s.class_id}','${s.classes?.name || 'Class'}')">
                    ENTRY
                </button>`;

            // Table for Dashboard
            dashboardTbody += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px 1rem;">
                        <div style="font-weight: 800; color: #1e293b;">${s.classes?.name || 'Unknown'}</div>
                        <div style="font-size: 0.65rem; color: ${roleColor}; font-weight: 900;">${roleLabel.toUpperCase()}</div>
                    </td>
                    <td style="padding: 12px 1rem;">
                        <div style="font-weight: 700; color: #475569; font-size: 0.85rem;">${s.subjects?.name || 'Subject'}</div>
                    </td>
                    <td style="padding: 12px 1rem; text-align: center;">
                        <div style="font-weight: 900; color: #0f172a;">${classAverage}%</div>
                    </td>
                    <td style="padding: 12px 1rem; text-align: right;">${actionBtn}</td>
                </tr>
            `;

            // Table for Recording Page (view-marks-entry)
            recordingTbody += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px 1.5rem; color: #64748b; font-weight: 600;">${rowIdx++}</td>
                    <td style="padding: 12px 1rem;">
                        <div style="font-weight: 700; color: #1e293b;">${s.subjects?.name || 'Subject'}</div>
                        <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 800;">PERFORMANCE: ${classAverage}%</div>
                    </td>
                    <td style="padding: 12px 1rem; font-weight: 600; color: #475569;">${s.classes?.name || 'Class'}</td>
                    <td style="padding: 12px 1.5rem; text-align: right; display: flex; gap: 0.5rem; justify-content: flex-end;">
                        ${actionBtn}
                        <button class="btn" style="padding: 4px 10px; font-size: 0.65rem; background: white; border: 1px solid var(--border);" 
                                onclick="generateExcelTemplateForSubject('${s.subject_id}','${s.subjects?.name || 'Subject'}','${s.class_id}','${s.classes?.name || 'Class'}')">
                            TEMP
                        </button>
                    </td>
                </tr>
            `;
            jurisdictionCount++;
        });

        // DOM Updates - Dashboard
        const syncTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (el('dash-last-synced')) el('dash-last-synced').textContent = `Last Synced: ${syncTime}`;
        if (el('dash-jurisdictions-tbody')) el('dash-jurisdictions-tbody').innerHTML = dashboardTbody || '<tr><td colspan="4">No assignments.</td></tr>';
        if (el('dash-avg-score')) el('dash-avg-score').textContent = (totalMaxSum > 0 ? (totalScoreSum / totalMaxSum * 100).toFixed(1) : '0.0') + '%';
        if (el('dash-student-count')) el('dash-student-count').textContent = allStudents.filter(s => myClassIds.includes(s.class_id)).length;
        if (el('dash-subject-count')) el('dash-subject-count').textContent = jurisdictionCount;
        if (el('dash-marks-count')) el('dash-marks-count').textContent = allMarks.filter(m => myClassIds.includes(m.class_id)).length;

        // DOM Updates - Recording Page
        if (el('dash-courses-tbody')) el('dash-courses-tbody').innerHTML = recordingTbody || '<tr><td colspan="4">No assignments.</td></tr>';
        
        const remainingCount = totalContexts - submittedCount - pendingCount;
        const progressPct = totalContexts === 0 ? 0 : Math.round((submittedCount / totalContexts) * 100);

        if (el('dash-completion-pct')) el('dash-completion-pct').textContent = progressPct + '%';
        if (el('dash-completion-label')) el('dash-completion-label').textContent = `${progressPct}% Submitted`;
        if (el('dash-completion-bar')) el('dash-completion-bar').style.width = progressPct + '%';
        if (el('dash-stat-submitted')) el('dash-stat-submitted').textContent = `${submittedCount}/${totalContexts}`;
        if (el('dash-stat-pending')) el('dash-stat-pending').textContent = pendingCount === 0 ? '--' : pendingCount;
        if (el('dash-stat-remaining')) el('dash-stat-remaining').textContent = remainingCount === 0 ? '--' : remainingCount;
        if (el('dash-stat-classes')) el('dash-stat-classes').textContent = myClassIds.length;
        if (el('dash-stat-courses')) el('dash-stat-courses').textContent = jurisdictionCount;

        // Profile & Identity
        if (el('dash-teacher-name')) el('dash-teacher-name').textContent = `Hello, ${MY_PROFILE.full_name?.split(' ')[0] || 'Teacher'}`;
        if (el('dash-profile-name')) el('dash-profile-name').textContent = MY_PROFILE.full_name || 'Teacher';
        if (el('dash-profile-code')) el('dash-profile-code').textContent = `SDMS: ${MY_PROFILE.sdms_code || 'N/A'}`;

        if (el('teacher-dash-notification')) {
            el('teacher-dash-notification').textContent = jurisdictionCount > 0 
                ? `You have ${jurisdictionCount} active class jurisdictions. Keep up the great work!`
                : "All your marks have been recorded and synced.";
        }

        const isClassTeacher = assignments.some(a => a.type === 'class');
        if (el('nav-students')) el('nav-students').style.display = isClassTeacher ? 'block' : 'none';
        if (el('drop-students')) el('drop-students').style.display = isClassTeacher ? 'flex' : 'none';
        
        if (el('nav-class-monitor')) el('nav-class-monitor').style.display = isClassTeacher ? 'block' : 'none';
        if (el('drop-class-monitor')) el('drop-class-monitor').style.display = isClassTeacher ? 'flex' : 'none';
        
        if (el('dash-action-monitor')) el('dash-action-monitor').style.display = isClassTeacher ? 'block' : 'none';

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

function goToEntry(classId, className) { CURRENT_SESSION.classId = classId; CURRENT_SESSION.className = className; switchView('marks-entry', document.getElementById('nav-marks-entry')); }

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
                              onblur="markUnsaved(this)">
                       <span style="color: #cbd5e1; font-weight: 800; font-size: 1.1rem; line-height: 1;">/</span>
                       <span data-max-target="${ass.id}" style="color: #cbd5e1; font-weight: 800; font-size: 0.95rem;">${ass.max_score || 90}</span>
                       <div style="margin-left: 0.5rem;">${statusIcon}</div>
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
    if (inp.value !== '') inp.classList.add('unsaved');
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
        DB.getTeacherAssignments() // Fetch all assignments to find everything taught in this class
    ]);
    
    // Subjects linked to this class either in 'subjects' table or via teacher assignments
    const classAssignedSubIds = allAssignments
        .filter(a => a.class_id === classId && a.subject_id)
        .map(a => a.subject_id);

    const rawSubs = allSubjects.filter(s => 
        s.class_id === classId || 
        classAssignedSubIds.includes(s.id) ||
        (!s.class_id && !s.student_id) // Global institutional subjects (core curriculum)
    );
    
    // Deduplicate subjects by NAME or ABBR to prevent visual repeats 
    // (In case the DB has redundant records for the same subject)
    const uniqueSubsMap = new Map();
    rawSubs.forEach(s => {
        const key = (s.abbr || s.name).toUpperCase().trim();
        if (!uniqueSubsMap.has(key)) {
            uniqueSubsMap.set(key, s);
        }
    });
    const subs = Array.from(uniqueSubsMap.values()).slice(0, 15); // Increased to 15 for comprehensive institutional reporting

    el('report-subject-checklist').innerHTML = subs.length > 0 
        ? subs.map(s => `
            <label class="check-item active" style="padding:6px 12px; border:1.5px solid #3b82f6; background:#eff6ff; color:#1e40af; border-radius:8px; margin:4px; display:inline-block; font-size:0.8rem; font-weight:800; cursor:pointer; transition: all 0.2s;">
                <input type="checkbox" checked value="${s.id}" onchange="this.parentElement.classList.toggle('active', this.checked); generateReportCard()" style="margin-right:8px;">
                ${(s.abbr || s.name).toUpperCase()}
            </label>`).join('')
        : '<div style="color:#ef4444; font-size:0.8rem; font-weight:800; padding:10px;">No curriculum subjects mapped to this class level.</div>';
    
    const dbAssessments = await DB.getAssessments();
    const activeAssessments = dbAssessments.length ? dbAssessments : [
        { id: 'cat', abbr: 'CAT', name: 'Continuous Assessment' },
        { id: 'exam', abbr: 'EXAM', name: 'End of Term Exam' },
        { id: 'eu', abbr: 'EU', name: 'End of Unit' },
        { id: 'et', abbr: 'ET', name: 'End of Term' }
    ];

    const assessList = el('report-assess-checklist');
    assessList.innerHTML = activeAssessments.map(a => `
        <label class="check-item active" style="padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px; margin:4px; display:inline-block; font-size:0.75rem;">
            <input type="checkbox" checked class="report-assess-cb" value="${a.id}" onchange="generateReportCard()">
            ${(a.abbr || a.name.substring(0,3)).toUpperCase()}
        </label>`).join('');
}

async function generateProclamationList() {
    const cid = el('report-class-select').value;
    const term = el('report-term-select').value;
    const dateInput = el('report-date-picker').value;
    const finalDate = dateInput ? new Date(dateInput).toLocaleDateString() : new Date().toLocaleDateString();
    
    if (!cid) return toast('Please select an institutional class group.', 'warning');

    const selSubIds = Array.from(el('report-subject-checklist').querySelectorAll('input:checked')).map(i => i.value);
    const selAssLabs = Array.from(el('report-assess-checklist').querySelectorAll('input:checked')).map(i => i.parentElement.textContent.trim());
    const selAssessIds = Array.from(el('report-assess-checklist').querySelectorAll('input:checked')).map(i => i.value);
    
    if (selSubIds.length === 0) return toast('Select subjects for proclamation.', 'warning');
    if (selAssessIds.length === 0) return toast('Select assessments for proclamation.', 'warning');

    toast('Consolidating Multi-Faculty Marks...', 'info');

    const [allMarks, students, allSubjects] = await Promise.all([
        DB.getMarks({ classId: cid, term, year: el('report-year')?.value }),
        DB.getStudents(cid),
        DB.getSubjects(cid)
    ]);

    const subjects = allSubjects.filter(s => selSubIds.includes(s.id));
    
    // Header labels for assessments
    const assessmentContext = selAssLabs.join(' + ');

    const subjectMeta = subjects.map(s => {
        let max = 0;
        const subMaxMap = SUBJECT_MAX[s.name] || DEFAULT_SUBJ_MAX;
        selAssessIds.forEach(aid => {
            const allowedMax = subMaxMap[aid.toLowerCase()] || 40;
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
            selAssessIds.forEach(assessId => {
                const allowedMax = subMaxMap[assessId.toLowerCase()] || 40;
                const mark = allMarks.find(m => m.student_id === student.id && m.subject_id === s.id && m.assessment_id === assessId);
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
                const color = isFail ? '#c2410c' : '#000';
                const style = isFail ? 'text-decoration: underline;' : '';
                return `<td style="padding: 5px; border: 1px solid #000; color: ${color}; ${style} font-weight: 900; text-align: center;">${score || 0}</td>`;
            }).join('')}
            <td style="padding: 5px; border: 1px solid #000; font-weight: 950; text-align: center;">${item.totalScore.toFixed(0)}</td>
            <td style="padding: 5px; border: 1px solid #000; font-weight: 950; color: ${item.percentage < 50 ? '#ef4444' : '#000'}; text-align: center;">${item.percentage.toFixed(1)}</td>
            <td style="padding: 5px; border: 1px solid #000; font-weight: 950; text-align: center;">${item.position}</td>
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
                        <div style="font-size:0.45rem; font-weight:700; color:#1e40af; text-align:center; margin-top:2px;">Republic of Rwanda<br>Ministry of Education</div>
                    </td>
                    <td style="text-align:center; vertical-align:middle;">
                        <div style="font-size:0.65rem; font-weight:900; color:#1e40af; letter-spacing:2px; text-transform:uppercase;">REPUBLIC OF RWANDA</div>
                        <div style="font-size:0.6rem; font-weight:700; margin-bottom:3px;">MINISTRY OF EDUCATION</div>
                        <div style="font-size:1.3rem; font-weight:900; text-transform:uppercase; margin-bottom:5px;">${(SCHOOL_INFO.school||'EDUMARKS ACADEMY').toUpperCase()}</div>
                        <div style="display:inline-block; background:#1d4ed8; color:#fff; font-size:0.7rem; font-weight:900; padding:5px 18px; letter-spacing:1px; text-transform:uppercase;">
                            CLASS: ${classLabel} &bull; TERM ${term} PROCLAMATION
                        </div>
                        <div style="font-size:0.55rem; margin-top:4px; color:#475569;">Assessed: ${assessedLine}</div>
                    </td>
                    <td style="width:90px; vertical-align:middle; text-align:right;">
                        ${SCHOOL_INFO.logo ? `<img src="${SCHOOL_INFO.logo}" style="width:75px; height:75px; object-fit:contain; border-radius:4px;">` : `<div style="width:75px; height:75px; border:1.5px solid #94a3b8; border-radius:4px; display:flex; align-items:center; justify-content:center; font-size:0.45rem; font-weight:700; text-align:center;">SCHOOL<br>LOGO</div>`}
                    </td>
                </tr>
            </table>

            <!-- META ROW -->
            <div style="display:flex; justify-content:space-between; border-top:2px solid #000; border-bottom:1px solid #cbd5e1; padding:5px 2px; margin-bottom:8px; font-size:0.58rem; font-weight:800;">
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
            <table style="width:100%; border-collapse:collapse; border:2px solid #000; font-size:0.55rem;">
                <thead style="background:#f1f5f9;">
                    <tr>
                        <th style="border:1px solid #000; width:25px; height:65px; padding:0; vertical-align:bottom;">
                            <div style="transform:rotate(-90deg); white-space:nowrap; margin-bottom:18px; font-weight:900; font-size:0.55rem;">NO</div>
                        </th>
                        <th style="border:1px solid #000; width:75px; vertical-align:middle; padding:4px; font-weight:900;">ID NUMBER</th>
                        <th style="border:1px solid #000; min-width:120px; text-align:left; padding:4px; font-weight:900;">NAMES</th>
                        ${subjectHeaders}
                        <th style="border:1px solid #000; width:38px; height:65px; padding:0; vertical-align:bottom; background:#f1f5f9;">
                            <div style="transform:rotate(-90deg); white-space:nowrap; margin-bottom:18px; font-weight:900; font-size:0.55rem;">TOTAL</div>
                        </th>
                        <th style="border:1px solid #000; width:32px; height:65px; padding:0; vertical-align:bottom; background:#f1f5f9;">
                            <div style="transform:rotate(-90deg); white-space:nowrap; margin-bottom:18px; font-weight:900; font-size:0.55rem;">PERCENT %</div>
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
            <div style="display:flex; justify-content:space-around; margin-top:25px; font-size:0.6rem; gap:10px;">
                <div style="text-align:center; flex:1; border-top:1px solid #000; padding-top:5px;">
                    PREPARED BY CLASS TEACHER<br>
                    <strong style="font-size:0.7rem;">${(MY_PROFILE?.full_name||'...').toUpperCase()}</strong>
                </div>
                <div style="text-align:center; flex:1; border-top:1px solid #000; padding-top:5px; position:relative;">
                    APPROVED BY DOS<br>
                    ${SCHOOL_INFO.dos_sig ? `<img src="${SCHOOL_INFO.dos_sig}" style="height:35px; position:absolute; top:-10px; left:50%; transform:translateX(-50%); mix-blend-mode:multiply;">` : ''}
                    <strong style="font-size:0.7rem; position:relative; z-index:2;">${(SCHOOL_INFO.dos||'...').toUpperCase()}</strong>
                </div>
                <div style="text-align:center; flex:1; border-top:1px solid #000; padding-top:5px; position:relative;">
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
            <title>${classLabel}</title>
            <style>
                    @page { margin: 0; size: ${isProclamation ? 'A4 landscape' : 'A4 portrait'}; }
                    @media print { 
                        body { margin:0; padding:0; background:white !important; display: block !important; width: 210mm; } 
                        .no-print { display: none !important; }
                        .report-page { 
                            border: none !important; 
                            margin: 0 !important; 
                            padding: 12mm 15mm !important; 
                            box-shadow: none !important; 
                            width: 210mm !important; 
                            height: 297mm !important; 
                            page-break-after: always !important; 
                            page-break-inside: avoid !important;
                            display: flex !important;
                            flex-direction: column !important;
                            justify-content: space-between !important;
                        }
                        .report-page:last-child { page-break-after: avoid !important; }
                        #proclamation-document { 
                            border: none !important; 
                            margin: 0 !important; 
                            padding: 10mm 15mm !important; 
                            width: 297mm !important; 
                            height: 210mm !important; 
                            page-break-after: always !important;
                            overflow: hidden !important;
                            display: flex !important;
                            flex-direction: column !important;
                            justify-content: space-between !important;
                        }
                    }
                body { background: #334155; margin: 0; padding: 40px; display: flex; flex-direction: column; align-items: center; font-family: 'Inter', sans-serif; gap: 40px; }
                .report-page { background: white; width: 210mm; height: 297mm; padding: 15mm; border-radius: 4px; box-shadow: 0 40px 80px rgba(0,0,0,0.4); box-sizing: border-box; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; }
                #proclamation-document { background: white; width: 297mm; height: 210mm; padding: 10mm 15mm; border-radius: 4px; box-shadow: 0 40px 80px rgba(0,0,0,0.4); box-sizing: border-box; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; }
                .header-bar { position: fixed; top: 0; left: 0; right: 0; background: #0B0E14; color: white; padding: 12px 30px; display: flex; justify-content: space-between; align-items: center; z-index: 9999; border-bottom: 2px solid #1e293b; }
                .print-btn { background: #2563eb; color: white; border: none; padding: 10px 24px; font-weight: 800; cursor: pointer; border-radius: 8px; font-family: inherit; font-size: 0.9rem; }
            </style>
        </head>
        <body>
            <div class="header-bar no-print">
                <h2 style="margin: 0; font-size: 1.1rem; letter-spacing: 0.5px;">INSTITUTIONAL BATCH EXPORT</h2>
                <button class="print-btn" onclick="window.print()">🖨️ PRINT ALL DIRECTLY TO PDF</button>
            </div>
            ${area.innerHTML}
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
    const selSubIds = Array.from(el('report-subject-checklist').querySelectorAll('input:checked')).map(i => i.value);
    const selAssessIds = Array.from(el('report-assess-checklist').querySelectorAll('input:checked')).map(i => i.value);
    const assessmentContext = selAsses.join(', ');
    
    if (selSubIds.length === 0) return;

    const allStudentsInClass = await DB.getStudents(cid);
    const targetStudents = sid === 'all' ? allStudentsInClass : [ allStudentsInClass.find(st => st.id === sid) ];
    const allMarks = await DB.getMarks({ term });
    const allSubjects = await DB.getSubjects();
    const subjects = allSubjects.filter(s => selSubIds.includes(s.id));

    // BUILD DYNAMIC PILLARS FROM USER SELECTION
    const activePillars = Array.from(el('report-assess-checklist').querySelectorAll('input:checked')).map(i => ({
        id: i.value.toLowerCase(),
        abbr: i.parentElement.innerText.trim().toUpperCase()
    }));
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
                    <div style="border:2px solid #000; padding:10px; font-size:0.58rem; display:flex; flex-direction:column; justify-content:center; text-align:center; position:relative; min-width:180px;">
                        <div style="font-size:0.4rem; font-weight:900; color:#64748b; text-transform:uppercase; margin-bottom:2px;">Done at ${(SCHOOL_INFO.district || '...').toUpperCase()}, on ${finalDate}</div>
                        <div style="font-weight:900; font-size:0.6rem; margin-bottom:10px;">HEADTEACHER / PRINCIPAL</div>
                        <div style="height:65px; display:flex; align-items:center; justify-content:center; position:relative; margin: 4px 0;">
                            ${SCHOOL_INFO.headteacher_sig ? `<img src="${SCHOOL_INFO.headteacher_sig}" style="max-height:60px; max-width:180px; object-fit:contain; mix-blend-mode:multiply; position:absolute; z-index:2;">` : ''}
                            ${SCHOOL_INFO.stamp ? `<img src="${SCHOOL_INFO.stamp}" style="width:90px; height:90px; opacity:0.85; mix-blend-mode:multiply; position:absolute; z-index:1; transform: translate(15px, -10px) rotate(-5deg);">` : ''}
                        </div>
                        <div style="font-weight:900; font-size:0.75rem; position:relative; z-index:3; border-top: 1.5px solid #000; padding-top:4px; margin-top:5px;">${(SCHOOL_INFO.headteacher || '...').toUpperCase()}</div>
                    </div>
                </div>

                <div style="padding:8px; border-top:1.5px dashed #000; display:flex; justify-content:flex-end; font-size:0.55rem; color:#64748b; font-weight:800;">
                    <span>STUDENT REGISTRY ID: ${student.sid || 'N/A'}</span>
                </div>
            </div>
        `;
    }

    const printArea = el('report-card-print-area');
    printArea.style.background = '#ffffff';
    printArea.style.border = 'none';
    printArea.style.padding = '0';
    printArea.style.margin = '0';
    printArea.innerHTML = areaHtml.trim();

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
    }
}

function handleLogout() { if (confirm('Disconnect from CAMIS Node?')) { SYNC.stop(); window.location.href='./Login.html'; } }

document.addEventListener('DOMContentLoaded', async () => {
    await syncConfigs(); 
    await renderProfile();
    
    // Restore Sidebar State
    const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    if (isCollapsed) document.querySelector('.sidebar')?.classList.add('collapsed');

    // Restore View
    const lastView = sessionStorage.getItem('teacher_last_view') || 'dashboard';
    await switchView(lastView);

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
    
    console.log('[CAMIS] Faculty Node fully synchronized.');
});

/**
 * CLASS TEACHER: Student Management Logic
 */
async function renderStudentRegistry() {
    const classId = document.getElementById('s-class-id')?.value;
    if (!classId) {
        toast('⚠️ You must have an assigned class to manage students.', 'error');
        switchView('dashboard');
        return;
    }

    const rawStudents = await DB.getStudents(classId);
    // Sort A-Z by Full Name (Last + First)
    const students = rawStudents.sort((a, b) => {
        const nameA = `${a.last_name || ''} ${a.first_name || ''}`.trim().toUpperCase();
        const nameB = `${b.last_name || ''} ${b.first_name || ''}`.trim().toUpperCase();
        return nameA.localeCompare(nameB);
    });
    
    const tbody = document.getElementById('students-registry-tbody');
    if (!tbody) return;

    if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding:4rem; text-align:center; color:#94a3b8;">No students enrolled in your class yet.</td></tr>`;
    } else {
        tbody.innerHTML = students.map((s, index) => {
            const isPending = s.status === 'pending_deletion';
            return `
                <tr style="border-bottom: 1px solid #f1f5f9; ${isPending ? 'opacity:0.6; background:#fff1f2;' : ''}">
                    <td style="padding: 12px 1.5rem; font-weight: 700; color:#64748b;">${index + 1}</td>
                    <td style="padding: 12px 1rem; font-weight: 700;">
                        <span style="color:#1e293b; cursor:pointer;" onclick="openEditStudentModal('${s.id}')" title="Edit Student Profile">${s.last_name} ${s.first_name}</span>
                    </td>
                    <td style="padding: 12px 1rem; color:#64748b; font-weight:700;">${s.gender || '—'}</td>
                    <td style="padding: 12px 1rem; color:#64748b;">${s.sid || 'UNSET'}</td>
                    <td style="padding: 12px 1rem; font-weight: 600; color:#2563eb;">${s.classes?.name || 'Class'}</td>
                    <td style="padding: 12px 1.5rem; text-align: right; display:flex; gap:0.5rem; justify-content:flex-end;">
                        ${isPending ? 
                            `<span class="badge badge-orange" style="font-size:0.6rem;">PENDING DELETION</span>` : 
                            `<button class="btn" style="background:#f1f5f9; color:#1e293b; font-size:0.7rem;" onclick="openEditStudentModal('${s.id}')">EDIT</button>
                             <button class="btn" style="background:transparent; color:#ef4444; font-weight:800; border:none; font-size:0.7rem;" onclick="requestDeleteStudent('${s.id}')">DELETE</button>`
                        }
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
        toast('✅ Excel template is ready for download.', 'success');
    } catch (err) {
        console.error('[EXCEL] Template generation failed:', err);
        toast('❌ Failed to generate template.', 'error');
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
function generateInstitutionalHeader(reportTitle, subtitle = '') {
    const info = SCHOOL_INFO;
    const assessLabel = getSelectedReportAssessLabels() || 'ALL ASSESSMENTS';
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
                        ${info.province ? info.province + ' PROVINCE | ' : ''} District: ${info.district || '...'} | Sector: ${info.sector || '...'} | Level: ${info.level || 'Primary'}
                    </div>
                    <div style="display:inline-block; background:yellow; border:2.5px solid #000; color:#000; font-size:1.05rem; font-weight:1000; padding:8px 25px; text-transform:uppercase; letter-spacing:0.5px;">
                        ${reportTitle}
                    </div>
                    <div style="font-size:0.75rem; font-weight:700; color:#1e293b; margin-top:8px;">
                        Email: ${info.email || '...'} | Phone: ${info.phone || '...'}
                    </div>
                    <div style="font-size:0.85rem; font-weight:900; color:#3b82f6; margin-top:8px; text-transform:uppercase;">
                        [ BASED ON: ${assessLabel} ]
                    </div>
                    ${subtitle ? `<div style="font-size:0.8rem; font-weight:900; margin-top:5px; color:#475569; font-style: italic;">${subtitle}</div>` : ''}
                </td>
                <td style="width:110px; vertical-align:middle; text-align:right;">
                    ${info.logo ? 
                        `<img src="${info.logo}" style="width:90px; height:90px; object-fit:contain; border-radius:8px;">` : 
                        `<div style="width:90px; height:90px; border:2px dashed #000; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:0.6rem; font-weight:900; text-align:center; color:#000;">OFFICIAL<br>SCHOOL STAMP</div>`
                    }
                </td>
            </tr>
        </table>
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
            year, term, className: cls.name, 
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
            <title>GRADE DISTRIBUTION SUMMARY</title>
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
        await syncConfigs();
        const [allMarks, students, classes, subjects] = await Promise.all([
            DB.getMarks({ term, year }), 
            DB.getStudents(), 
            DB.getClasses(), 
            DB.getSubjects()
        ]);

        const assignments = await DB.getTeacherAssignments(MY_PROFILE?.id);
        
        let targetAssignments = [];
        if (subjectId === 'all') {
            targetAssignments = assignments.filter(a => a.type === 'subject' || a.type === 'class_subject');
        } else {
            targetAssignments = assignments.filter(a => a.subject_id === subjectId);
        }

        const selAssessIds = getSelectedReportAssessIds();
        const reportData = [];
        let grandTotals = { exp_b: 0, exp_g: 0, exp_t: 0, sat_b: 0, sat_g: 0, sat_t: 0, pass_b: 0, pass_g: 0, pass_t: 0, fail_b: 0, fail_g: 0, fail_t: 0 };

        for (const ass of targetAssignments) {
            const sid = ass.subject_id;
            const cid = ass.class_id;
            const sub = subjects.find(s => s.id === sid);
            const cls = classes.find(c => c.id === cid);
            
            const classStudents = students.filter(s => s.class_id === cid);
            let classMarks = allMarks.filter(m => m.class_id === cid && m.subject_id === sid && String(m.term) === String(term) && m.is_approved);
            
            if (selAssessIds.length > 0) {
                classMarks = classMarks.filter(m => selAssessIds.includes(m.assessment_id));
            }
            
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

            // Aggregate Grand Totals
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
            <td style="border: 1px solid #000; font-weight: bold; background: #fee2e2;">${r.fail_p}%</td>
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
            name: cls.name,
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
            <td style="border: 1px solid #000; font-weight: bold; background: #fee2e2;">${r.fail_p}%</td>
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
};
