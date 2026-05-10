/**
 * ============================================================
 * MMS CORE INITIALIZATION MODULE
 * Unified portal initialization with RBAC security
 * Version: 3.0
 * ============================================================
 */

'use strict';

// ============================================================
// GLOBAL MMS STATE MANAGER
// ============================================================

const MMS = {
    user: null,
    profile: null,
    securityContext: null,
    dataProvider: null,
    apiClient: null,
    realtimeSync: null,
    uiController: null,
    
    /**
     * Initialize MMS for current portal
     * Call this in each portal's onload
     */
    async init() {
        try {
            console.log('[MMS] Initializing Marks Management System...');
            
            // Step 1: Check authentication
            const { data: { user } } = await _supabase.auth.getUser();
            if (!user) {
                console.warn('[MMS] User not authenticated, redirecting to login');
                window.location.href = 'Login.html';
                return;
            }
            
            this.user = user;
            console.log('[MMS] User authenticated:', user.email);
            
            // Step 2: Load user profile
            const { data: profile, error } = await _supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            
            if (error || !profile) {
                throw new Error('Profile not found. Please contact administrator.');
            }
            
            this.profile = profile;
            console.log('[MMS] Profile loaded:', { role: profile.role, school: profile.school_code });
            
            // Step 3: Initialize security context
            if (typeof SEC !== 'undefined') {
                await SEC.init(user, profile);
                this.securityContext = SEC;
            }
            
            // Step 4: Initialize data provider
            if (typeof DashboardDataProvider !== 'undefined') {
                this.dataProvider = new DashboardDataProvider(
                    user,
                    profile.role,
                    profile.school_code,
                    SEC?.teacherClasses || [],
                    SEC?.teacherSubjects || []
                );
            }
            
            // Step 5: Initialize API client
            if (typeof SecureAPIClient !== 'undefined' && this.dataProvider) {
                this.apiClient = new SecureAPIClient(this.dataProvider);
            }
            
            // Step 6: Initialize real-time sync
            if (typeof SecureRealtimeSync !== 'undefined' && this.dataProvider) {
                this.realtimeSync = new SecureRealtimeSync(this.dataProvider);
            }
            
            // Step 7: Initialize UI controller
            if (typeof UIVisibilityController !== 'undefined') {
                this.uiController = new UIVisibilityController(profile.role);
            }
            
            // Step 8: Update UI with user info
            this.updateHeaderWithUserInfo();
            
            // Step 9: Emit custom event for portal-specific initialization
            document.dispatchEvent(new CustomEvent('mms:ready', {
                detail: { mms: this }
            }));
            
            console.log('[MMS] Initialization complete!');
            return this;
            
        } catch (error) {
            console.error('[MMS] Initialization error:', error);
            const msg = error.message || 'System initialization failed. Refreshing...';
            alert(msg);
            setTimeout(() => window.location.reload(), 2000);
        }
    },
    
    /**
     * Update header with current user info
     */
    updateHeaderWithUserInfo() {
        try {
            const profile = this.profile;
            
            // Update header elements if they exist
            const userNameEl = document.getElementById('header-user-name');
            const schoolNameEl = document.getElementById('header-school-name');
            const userAvatarEl = document.getElementById('header-user-avatar');
            const roleEl = document.getElementById('header-user-role');
            
            if (userNameEl) userNameEl.textContent = profile.full_name || 'User';
            if (schoolNameEl) schoolNameEl.textContent = profile.school_code || 'MMS';
            if (userAvatarEl) userAvatarEl.textContent = (profile.full_name || 'U').charAt(0).toUpperCase();
            if (roleEl) {
                const roleText = profile.role === 'system_admin' ? 'System Admin' : 
                                 profile.role === 'admin' ? 'School Admin' : 'Teacher';
                roleEl.textContent = roleText;
            }
            
            console.log('[MMS] Header updated with user info');
        } catch (error) {
            console.warn('[MMS] Could not update header:', error.message);
        }
    },
    
    /**
     * Get current user's role
     */
    getRole() {
        return this.profile?.role || null;
    },
    
    /**
     * Check if user has admin or higher role
     */
    isAdmin() {
        return this.getRole() === 'admin' || this.getRole() === 'system_admin';
    },
    
    /**
     * Check if user is system admin
     */
    isSystemAdmin() {
        return this.getRole() === 'system_admin';
    },
    
    /**
     * Get current school code
     */
    getSchool() {
        return this.profile?.school_code || null;
    },
    
    /**
     * Logout current user
     */
    async logout() {
        try {
            if (this.realtimeSync) {
                this.realtimeSync.unsubscribeAll();
            }
            
            if (this.securityContext) {
                this.securityContext.clear();
            }
            
            await _supabase.auth.signOut();
            window.location.href = 'Login.html';
        } catch (error) {
            console.error('[MMS] Logout error:', error);
            window.location.href = 'Login.html';
        }
    }
};

// ============================================================
// AUTOMATIC INITIALIZATION ON PAGE LOAD
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on login page
    if (window.location.pathname.includes('Login.html') || 
        window.location.pathname.includes('index.html') ||
        window.location.pathname.includes('verify.html')) {
        console.log('[MMS] On auth page, skipping auto-init');
        return;
    }
    
    // Initialize MMS on portal pages
    console.log('[MMS] Portal page detected, initializing...');
    MMS.init();
});

// ============================================================
// GLOBAL EVENT LISTENERS
// ============================================================

document.addEventListener('mms:ready', (e) => {
    console.log('[MMS] Portal ready event fired');
    // Portal-specific code can hook into this event
});

// ============================================================
// EXPORT FOR GLOBAL USE
// ============================================================

window.MMS = MMS;

console.log('[MMS Core] Module loaded successfully');
