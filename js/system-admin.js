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
                '<span class="badge badge-success">ACTIVE NODE</span>' : 
                '<span class="badge badge-secondary">UNPROVISIONED</span>';
            
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
                        <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.75rem;" onclick="viewNodeData('${s.sdms_code}')">VIEW DATA</button>
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
            const roleBadge = p.role === 'admin' ? 'badge-primary' : 'badge-secondary';
            return `
                <tr>
                    <td style="font-weight: 600;">${p.full_name}</td>
                    <td style="font-size: 0.85rem;">${p.email}</td>
                    <td><span class="badge ${roleBadge}">${p.role.toUpperCase()}</span></td>
                    <td><span style="font-size: 0.85rem; font-weight: 700; color: #4338ca;">SDMS: ${p.school_code || '---'}</span></td>
                    <td><span class="badge badge-success">ACTIVE</span></td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No users registered yet.</td></tr>';

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
    if (sb) sb.classList.toggle('open');
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
        'users': ['Global User Registry', 'Human Capital']
    };

    if (meta[viewId]) {
        const titleEl = document.getElementById('page-title');
        const breadViewEl = document.getElementById('breadcrumb-view');
        if (titleEl) titleEl.textContent = meta[viewId][0];
        if (breadViewEl) breadViewEl.textContent = meta[viewId][1];
    }
    
    if (window.lucide) lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', initSystemAdmin);
