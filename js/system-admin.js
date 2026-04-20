/**
 * SYSTEM ADMINISTRATOR LOGIC v2.0
 * Global management of multi-institutional school nodes.
 */

'use strict';

const el = id => document.getElementById(id);

async function initSystemAdmin() {
    try {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) {
            window.location.href = '/Login.html';
            return;
        }

        // Verify System Admin role
        const { data: profile } = await _supabase.from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

        if (!profile || profile.role !== 'system_admin') {
            console.warn('[SECURITY] Unauthorized access to System Admin portal.');
            window.location.href = '/Login.html';
            return;
        }

        await updateStats();
        await renderSchools();
        await renderGlobalUsers();
        await calculatePerformanceAnalytics();
        await renderInboundMessages();
        
        // Dynamic Header Scroll Controller
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.addEventListener('scroll', () => {
                const header = document.querySelector('.sub-header');
                if (header) {
                    if (mainContent.scrollTop > 50) {
                        header.classList.add('scrolled');
                    } else {
                        header.classList.remove('scrolled');
                    }
                }
            });
        }

        // Listen for new messages
        _supabase.channel('support-inbox')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, () => renderInboundMessages())
            .subscribe();

        // 60-second Automated Intelligence Refresh
        setInterval(() => {
            updateStats();
        }, 60000);

        // REAL-TIME GLOBAL COMMAND SYNC
        _supabase.channel('mms-global-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'schools' }, () => {
                console.log('[SYNC] Global Institutions Registry Updated');
                renderSchools();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                console.log('[SYNC] Global Profile Membership Updated');
                updateStats();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'marks' }, () => {
                console.log('[SYNC] Global Academic Records Updated');
                updateStats();
            })
            .subscribe();

        if (window.lucide) lucide.createIcons();
    } catch (e) {
        console.error('[SYSADMIN] Init failed:', e);
    }
}

async function updateStats() {
    try {
        const [schools, profiles, marks] = await Promise.all([
            _supabase.from('schools').select('sdms_code', { count: 'exact', head: true }),
            _supabase.from('profiles').select('id', { count: 'exact', head: true }).neq('role', 'system_admin'),
            _supabase.from('marks').select('id', { count: 'exact', head: true })
        ]);

        if (el('stat-total-schools')) el('stat-total-schools').textContent = schools.count || 0;
        if (el('stat-total-admins')) el('stat-total-admins').textContent = profiles.count || 0;
        if (el('stat-total-records')) el('stat-total-records').textContent = marks.count || 0;
    } catch (e) {
        console.error('[STATS] Failed:', e);
    }
}

async function renderSchools() {
    try {
        const { data, error } = await _supabase
            .from('schools')
            .select(`
                sdms_code,
                name,
                profiles(id, email, full_name, role)
            `);

        if (error) throw error;

        const tbody = el('schools-tbody');
        if (!tbody) return;

        tbody.innerHTML = data.map(s => {
            const admins = s.profiles.filter(p => p.role === 'admin');
            const status = admins.length > 0 ? 
                '<span class="badge-status badge-active"><span class="dot"></span>Active Node</span>' : 
                '<span class="badge-status badge-inactive"><span class="dot"></span>Unprovisioned</span>';
            
            return `
                <tr>
                    <td style="font-weight: 700; color: #111827;">${s.name}</td>
                    <td><code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: 700;">${s.sdms_code}</code></td>
                    <td>
                        <div style="font-size: 0.85rem; font-weight: 600;">${admins.length > 0 ? admins[0].full_name : 'N/A'}</div>
                        <div style="font-size: 0.7rem; color: #6b7280;">${admins.length > 0 ? admins[0].email : 'Pending setup'}</div>
                    </td>
                    <td>${status}</td>
                    <td style="text-align: right;">
                        <button class="btn btn-dark btn-sm" onclick="viewNodeData('${s.sdms_code}')">View Data</button>
                    </td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No school nodes found.</td></tr>';

    } catch (e) {
        console.error('[RENDER] Schools failed:', e);
    }
}

async function renderGlobalUsers() {
    try {
        const { data, error } = await _supabase
            .from('profiles')
            .select('*')
            .neq('role', 'system_admin')
            .order('role', { ascending: true });

        if (error) throw error;

        const tbody = el('users-tbody');
        if (!tbody) return;

        tbody.innerHTML = data.map(p => {
            const roleBadge = p.role === 'admin' ? 'badge-pending' : 'badge-inactive';
            return `
                <tr>
                    <td style="font-weight: 700;">${p.full_name}</td>
                    <td style="font-size: 0.85rem; color:#64748b;">${p.email}</td>
                    <td><span class="badge-status ${roleBadge}"><span class="dot"></span>${p.role.toUpperCase()}</span></td>
                    <td><code style="background:#f1f5f9; padding:3px 8px; border-radius:8px; font-weight:900; color:#4338ca; font-size:0.85rem;">${p.school_code || '---'}</code></td>
                    <td><span class="badge-status badge-active"><span class="dot"></span>Active</span></td>
                    <td style="text-align: right; white-space: nowrap; display:flex; gap:0.4rem; justify-content:flex-end;">
                        <button class="btn btn-ghost btn-sm" onclick="troubleshootUser('${p.school_code}', '${p.full_name}')" title="Support Override">Support</button>
                        <button class="btn btn-dark btn-sm" onclick="editUser('${p.id}')">Edit</button>
                        <button class="btn btn-sm" style="border:2px solid #f43f5e; color:#f43f5e; background:transparent;" onclick="deleteUser('${p.id}')">Delete</button>
                    </td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No users registered yet.</td></tr>';

        if (el('support-active-users')) el('support-active-users').textContent = data.length;

    } catch (e) {
        console.error('[RENDER] Users failed:', e);
    }
}

async function handleRegisterSchool(event) {
    event.preventDefault();
    
    const schoolName = el('node-school-name').value.trim();
    const sdmsCode = el('node-sdms-code').value.trim();
    const adminName = el('node-admin-name').value.trim();

    if (!sdmsCode || sdmsCode.length !== 6) {
        toast('SDMS Code must be 6 digits', 'error');
        return;
    }

    try {
        toast('Initializing institutional node...', 'info');

        // 1. Create School Node
        const { error: schoolError } = await _supabase.from('schools').upsert({
            sdms_code: sdmsCode,
            name: schoolName,
            created_at: new Date().toISOString()
        }, { onConflict: 'sdms_code' });

        if (schoolError) throw schoolError;

        // 2. Provision Admin Profile with SDMS-based Credentials
        // Email format: sdms[CODE]@mms.rw | Password: [CODE]
        const sdmsEmail = `sdms${sdmsCode}@mms.rw`;
        
        const { error: profileError } = await _supabase.from('profiles').upsert({
            email: sdmsEmail,
            full_name: adminName,
            role: 'admin',
            school_code: sdmsCode,
            school_name: schoolName,
            temp_password_active: true,
            created_at: new Date().toISOString()
        }, { onConflict: 'email' });

        if (profileError) throw profileError;

        toast(`✅ Institutional Node ${sdmsCode} provisioned!`, 'success');
        closeModal('register-school-modal');
        await renderSchools();
        await renderGlobalUsers();
        await updateStats();

    } catch (e) {
        console.error('[PROVISION] Failed:', e);
        toast('Provisioning failed: ' + e.message, 'error');
    }
}

async function handleLogout() {
    if (confirm('Terminate System Administration Session?')) {
        try {
            if (typeof DB !== 'undefined' && DB.clearCache) DB.clearCache();
            sessionStorage.clear();
            await _supabase.auth.signOut();
            window.location.replace('./Login.html');
        } catch (err) {
            window.location.href = './Login.html';
        }
    }
}

function toast(msg, type = 'info') {
    const c = el('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

function toggleSidebar() {
    const sb = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sb) {
        sb.classList.toggle('open');
        if (overlay) overlay.style.display = sb.classList.contains('open') ? 'block' : 'none';
    }
}

function switchView(viewId, el) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const target = document.getElementById('view-' + viewId);
    if (target) target.classList.add('active');
    if (el) el.classList.add('active');

    const meta = {
        'dashboard': ['Global School Registry', 'Master Registry'],
        'schools': ['Institutional Nodes', 'Infrastructure'],
        'users': ['Global User Registry', 'Human Capital'],
        'support': ['Strategic Communication Hub', 'Command Center'],
        'audit': ['Forensic Activity Logs', 'Platform Audit'],
        'security': ['Global Security Governance', 'Policies'],
        'analytics': ['System Performance Intelligence', 'Analytics'],
        'search-results': ['Global Intelligence', 'Scan Results']
    };

    if (meta[viewId]) {
        const titleEl = document.getElementById('page-title');
        const breadViewEl = document.getElementById('breadcrumb-view');
        if (titleEl) titleEl.textContent = meta[viewId][0];
        if (breadViewEl) breadViewEl.textContent = meta[viewId][1];
    }
    
    // Auto-close sidebar on mobile
    if (window.innerWidth <= 1024) {
        const sb = document.querySelector('.sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sb) sb.classList.remove('open');
        if (overlay) overlay.style.display = 'none';
    }
    
    if (viewId === 'users') renderGlobalUsers();
    if (viewId === 'audit') renderAuditLogs();
    if (viewId === 'analytics') calculatePerformanceAnalytics();
    
    if (window.lucide) lucide.createIcons();
}

// --- GLOBAL INTELLIGENCE & SUPPORT ---

async function handleGlobalSearch(query) {
    if (!query || query.length < 2) {
        if (el('view-search-results').classList.contains('active')) switchView('dashboard');
        return;
    }

    switchView('search-results');
    const tbody = el('search-results-tbody');
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem;">Scanning Platform Nodes for "${query}"...</td></tr>`;

    try {
        const [users, schools] = await Promise.all([
            _supabase.from('profiles').select('*').or(`full_name.ilike.%${query}%,email.ilike.%${query}%,school_code.ilike.%${query}%`),
            _supabase.from('schools').select('*').or(`name.ilike.%${query}%,sdms_code.ilike.%${query}%`)
        ]);

        let html = '';

        if (users.data) {
            users.data.forEach(u => {
                html += `
                    <tr>
                        <td><span class="badge badge-primary">ACCOUNT</span></td>
                        <td style="font-weight: 800;">${u.full_name}</td>
                        <td><code>${u.school_code || 'N/A'}</code></td>
                        <td style="font-size: 0.8rem;">${u.email} (${u.role})</td>
                        <td style="text-align: right;">
                            <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.65rem;" onclick="troubleshootUser('${u.school_code}')">TROUBLESHOOT</button>
                        </td>
                    </tr>
                `;
            });
        }

        if (schools.data) {
            schools.data.forEach(s => {
                html += `
                    <tr>
                        <td><span class="badge badge-success">INSTITUTION</span></td>
                        <td style="font-weight: 800;">${s.name}</td>
                        <td><code>${s.sdms_code}</code></td>
                        <td style="font-size: 0.8rem;">SDMS Infrastructure Node</td>
                        <td style="text-align: right;">
                            <button class="btn btn-primary" style="padding: 4px 8px; font-size: 0.65rem;" onclick="viewNodeData('${s.sdms_code}')">MANAGE NODE</button>
                        </td>
                    </tr>
                `;
            });
        }

        tbody.innerHTML = html || `<tr><td colspan="5" style="text-align:center; padding:2rem;">No matches found for "${query}".</td></tr>`;
        if (window.lucide) lucide.createIcons();

    } catch (e) {
        console.error('[SEARCH] Failed:', e);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">Search Error: ${e.message}</td></tr>`;
    }
}

function troubleshootUser(sdmsCode, name) {
    if (!sdmsCode) return toast('User has no assigned SDMS Code', 'error');
    toast(`Temporal Override: Initializing Support Context for ${name || sdmsCode}`, 'info');
    viewNodeData(sdmsCode);
}

function viewNodeData(sdmsCode) {
    switchView('schools');
    el('view-schools').innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3>Temporal Override: Institutional Environment [${sdmsCode}]</h3>
                <button class="btn btn-secondary" onclick="switchView('dashboard')">Exit Override</button>
            </div>
            <div style="padding: 3rem; text-align: center;">
                <i data-lucide="monitor" style="width: 48px; height: 48px; margin-bottom: 1.5rem;"></i>
                <h2 style="font-weight: 1000;">Institutional Context Enabled</h2>
                <p style="color: #64748b; font-weight: 800; margin-bottom: 2rem;">You are now viewing live data for node ${sdmsCode}. Administrators and Teachers at this school remain isolated.</p>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; max-width: 600px; margin: 0 auto;">
                    <div class="stat-card" style="padding: 1.5rem; flex-direction: column;">
                        <span style="font-size: 1.5rem; font-weight: 1000;" id="override-students">...</span>
                        <span style="font-size: 0.6rem; font-weight: 900; text-transform: uppercase;">Students</span>
                    </div>
                    <div class="stat-card" style="padding: 1.5rem; flex-direction: column;">
                        <span style="font-size: 1.5rem; font-weight: 1000;" id="override-marks">...</span>
                        <span style="font-size: 0.6rem; font-weight: 900; text-transform: uppercase;">Marks Records</span>
                    </div>
                    <div class="stat-card" style="padding: 1.5rem; flex-direction: column;">
                        <span style="font-size: 1.5rem; font-weight: 1000;" id="override-staff">...</span>
                        <span style="font-size: 0.6rem; font-weight: 900; text-transform: uppercase;">Staff Members</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    loadOverrideData(sdmsCode);
    if (window.lucide) lucide.createIcons();
}

async function loadOverrideData(code) {
    try {
        const [students, marks, staff] = await Promise.all([
            _supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_code', code).eq('role', 'student'),
            _supabase.from('marks').select('id', { count: 'exact', head: true }).eq('school_code', code),
            _supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_code', code).neq('role', 'student')
        ]);
        
        if (el('override-students')) el('override-students').textContent = students.count || 0;
        if (el('override-marks')) el('override-marks').textContent = marks.count || 0;
        if (el('override-staff')) el('override-staff').textContent = staff.count || 0;
    } catch (e) {
        console.error('[OVERRIDE] Data fetch failed:', e);
    }
}

async function editUser(userId) {
    try {
        const { data: u, error } = await _supabase.from('profiles').select('*').eq('id', userId).single();
        if (error) throw error;

        el('edit-user-id').value = u.id;
        el('edit-user-name').value = u.full_name;
        el('edit-user-email').value = u.email;
        el('edit-user-sdms').value = u.school_code || '';
        el('edit-user-role').value = u.role;

        openModal('edit-user-modal');
    } catch (e) {
        toast('Fetch failed: ' + e.message, 'error');
    }
}

async function handleEditUser(e) {
    e.preventDefault();
    const id = el('edit-user-id').value;
    const updates = {
        full_name: el('edit-user-name').value,
        email: el('edit-user-email').value,
        school_code: el('edit-user-sdms').value,
        role: el('edit-user-role').value,
        updated_at: new Date().toISOString()
    };

    try {
        const { error } = await _supabase.from('profiles').update(updates).eq('id', id);
        if (error) throw error;

        toast('Institutional account updated successfully.', 'success');
        closeModal('edit-user-modal');
        await renderGlobalUsers();
    } catch (e) {
        toast('Update failed: ' + e.message, 'error');
    }
}

async function deleteUser(userId) {
    if (!confirm('CRITICAL: Terminate this user account and revoke all platform access?')) return;
    try {
        const { error } = await _supabase.from('profiles').delete().eq('id', userId);
        if (error) throw error;
        toast('Account terminated successfully.', 'success');
        await renderGlobalUsers();
    } catch (e) {
        toast('Termination failed: ' + e.message, 'error');
    }
}

async function renderAuditLogs() {
    const tbody = el('audit-logs-tbody');
    if (!tbody) return;
    tbody.innerHTML = `
        <tr>
            <td>${new Date().toLocaleString()}</td>
            <td style="font-weight: 800;">System Root</td>
            <td><span class="badge badge-primary">PLATFORM_INIT</span></td>
            <td>GLOBAL</td>
            <td style="font-size: 0.75rem;">System Controller initialized support modules.</td>
        </tr>
    `;
}

// --- PERFORMANCE ANALYTICS & INTELLIGENCE ---
let performanceChart = null;

async function calculatePerformanceAnalytics() {
    try {
        const { data: marks, error } = await _supabase.from('marks').select('mark, out_of, school_code, student_id');
        if (error) throw error;

        if (!marks || marks.length === 0) return;

        const schoolStats = {};
        const uniqueStudents = new Set();
        let totalVal = 0;
        let totalPossible = 0;

        marks.forEach(m => {
            if (!m.mark || !m.out_of) return;
            const perc = (m.mark / m.out_of) * 100;
            if (!schoolStats[m.school_code]) schoolStats[m.school_code] = { sum: 0, count: 0 };
            schoolStats[m.school_code].sum += perc;
            schoolStats[m.school_code].count++;
            
            totalVal += perc;
            totalPossible += 100;
            if (m.student_id) uniqueStudents.add(m.student_id);
        });

        const globalAvg = totalPossible > 0 ? (totalVal / (marks.length)) : 0;
        if (el('system-avg-marks')) el('system-avg-marks').textContent = globalAvg.toFixed(1) + '%';
        if (el('total-platform-students')) el('total-platform-students').textContent = uniqueStudents.size;

        // Rank Schools
        const ranking = Object.keys(schoolStats).map(code => ({
            code,
            avg: schoolStats[code].sum / schoolStats[code].count
        })).sort((a,b) => b.avg - a.avg);

        if (ranking.length > 0) {
            const topNode = ranking[ ranking[0].avg > ranking[ranking.length-1].avg ? 0 : ranking.length-1 ].code;
            const { data: s } = await _supabase.from('schools').select('name').eq('sdms_code', ranking[0].code).single();
            if (el('top-school-name')) el('top-school-name').textContent = s ? s.name : ranking[0].code;
            
            const tbody = el('school-ranking-tbody');
            if (tbody) {
                tbody.innerHTML = ranking.map(r => `
                    <tr>
                        <td style="font-weight: 800;">Node ${r.code}</td>
                        <td style="font-weight: 1000; color: #10b981;">${r.avg.toFixed(1)}%</td>
                        <td><i data-lucide="trending-up" style="color: #10b981; width: 14px;"></i></td>
                    </tr>
                `).join('');
            }

            // Initialize Chart
            renderPerformanceChart(ranking);
        }

    } catch (e) {
        console.error('[ANALYTICS] Sync failed:', e);
    }
}

function renderPerformanceChart(ranking) {
    const ctx = el('global-performance-chart');
    if (!ctx) return;

    if (performanceChart) performanceChart.destroy();

    performanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ranking.map(r => `Node ${r.code}`),
            datasets: [{
                label: 'Institutional Average (%)',
                data: ranking.map(r => r.avg.toFixed(1)),
                backgroundColor: '#000',
                borderRadius: 8,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, max: 100, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });
}

// --- COMMUNICATION HUB LOGIC ---

async function handleGlobalBroadcast(e) {
    e.preventDefault();
    const scope = el('broadcast-scope').value;
    const sdms = el('broadcast-sdms').value;
    const msg = el('broadcast-msg').value;
    const urgency = document.querySelector('input[name="urgency"]:checked').value;

    try {
        toast('Dispatching strategic intelligence...', 'info');
        const payload = {
            message: msg,
            urgency: urgency,
            school_code: scope === 'school' ? sdms : null,
            created_at: new Date().toISOString()
        };

        const { error } = await _supabase.from('notifications').insert(payload);
        if (error) throw error;

        toast('Global Intelligence dispatched successfully!', 'success');
        el('broadcast-form').reset();
    } catch (e) {
        toast('Dispatch failed: ' + e.message, 'error');
    }
}

async function renderInboundMessages() {
    const tbody = el('inbound-messages-tbody');
    if (!tbody) return;

    try {
        const { data, error } = await _supabase.from('support_messages')
            .select(`*, sender:profiles(full_name)`)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (el('unread-count')) el('unread-count').textContent = data.filter(m => !m.is_resolved).length + ' NEW';

        tbody.innerHTML = data.map(m => `
            <tr style="${m.is_resolved ? 'opacity: 0.5' : ''}">
                <td><code>${m.sdms_code}</code></td>
                <td style="font-weight: 800;">${m.sender?.full_name || 'Admin'}</td>
                <td style="font-size: 0.8rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${m.content}</td>
                <td style="font-size: 0.7rem;">${new Date(m.created_at).toLocaleString()}</td>
                <td style="text-align: right;">
                    <button class="btn btn-primary" style="padding: 4px 8px; font-size: 0.65rem;" onclick="replyToAdmin('${m.sender_id}', '${m.content}')">REPLY</button>
                    <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.65rem;" onclick="resolveMessage('${m.id}')">RESOLVE</button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="5" style="text-align:center; padding:3rem;">No inbound support requests.</td></tr>';
        
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        console.error('[MESSAGING] Fetch failed:', e);
    }
}

async function resolveMessage(id) {
    try {
        const { error } = await _supabase.from('support_messages').update({ is_resolved: true }).eq('id', id);
        if (error) throw error;
        toast('Support ticket resolved.', 'success');
        await renderInboundMessages();
    } catch (e) {
        toast('Action failed.', 'error');
    }
}

async function replyToAdmin(adminId, originalMsg) {
    const reply = prompt('Strategic Response for Admin:', '');
    if (!reply) return;

    try {
        const { error } = await _supabase.from('notifications').insert({
            admin_id: adminId,
            message: `[SYSADMIN RESPONSE] RE: "${originalMsg.substring(0, 20)}..." -> ${reply}`,
            urgency: 'info'
        });
        if (error) throw error;
        toast('Response dispatched.', 'success');
    } catch (e) {
        toast('Reply failed.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initSystemAdmin();
    renderAuditLogs();
    
    const editForm = el('edit-user-form');
    if (editForm) editForm.addEventListener('submit', handleEditUser);

    if (el('broadcast-scope')) {
        el('broadcast-scope').addEventListener('change', (e) => {
            el('scope-school-field').style.display = e.target.value === 'school' ? 'block' : 'none';
        });
    }
});
