/**
 * ============================================================
 * MMS UNIFIED NAVIGATION COMPONENT
 * Shared navigation across all portals with role-based filtering
 * Version: 1.0
 * ============================================================
 */

'use strict';

class MMSNavigation {
    constructor(role) {
        this.role = role;
        this.navItems = [];
        this.init();
    }
    
    init() {
        this.defineNavigation();
        this.renderNavigation();
    }
    
    defineNavigation() {
        const navConfig = {
            system_admin: [
                { label: 'Dashboard', icon: 'home', href: 'system-admin-portal.html', section: 'main' },
                { label: 'Schools', icon: 'building-2', href: 'system-admin-portal.html#schools', section: 'management' },
                { label: 'Admins', icon: 'users-3', href: 'system-admin-portal.html#admins', section: 'management' },
                { label: 'Reports', icon: 'bar-chart-2', href: 'system-admin-portal.html#reports', section: 'analytics' },
                { label: 'Audit Logs', icon: 'activity', href: 'system-admin-portal.html#audit', section: 'security' },
                { label: 'Logout', icon: 'log-out', href: '#logout', section: 'auth', onclick: () => MMS.logout() }
            ],
            admin: [
                { label: 'Dashboard', icon: 'home', href: 'admin-portal.html', section: 'main' },
                { label: 'Teachers', icon: 'users', href: 'admin-portal.html#teachers', section: 'management' },
                { label: 'Students', icon: 'book-open', href: 'admin-portal.html#students', section: 'data' },
                { label: 'Classes', icon: 'layers', href: 'admin-portal.html#classes', section: 'data' },
                { label: 'Marks', icon: 'check-circle', href: 'admin-portal.html#marks', section: 'data' },
                { label: 'Reports', icon: 'bar-chart-2', href: 'admin-portal.html#reports', section: 'analytics' },
                { label: 'Logout', icon: 'log-out', href: '#logout', section: 'auth', onclick: () => MMS.logout() }
            ],
            teacher: [
                { label: 'Dashboard', icon: 'home', href: 'teacher-portal.html', section: 'main' },
                { label: 'My Classes', icon: 'layers', href: 'teacher-portal.html#classes', section: 'class' },
                { label: 'Students', icon: 'book-open', href: 'teacher-portal.html#students', section: 'class' },
                { label: 'Mark Entry', icon: 'edit-3', href: 'teacher-portal.html#marks', section: 'class' },
                { label: 'Reports', icon: 'bar-chart-2', href: 'teacher-portal.html#reports', section: 'analytics' },
                { label: 'Logout', icon: 'log-out', href: '#logout', section: 'auth', onclick: () => MMS.logout() }
            ]
        };
        
        this.navItems = navConfig[this.role] || navConfig.teacher;
    }
    
    renderNavigation() {
        // Render to sidebar if it exists
        const sidebar = document.querySelector('.sidebar-nav');
        if (!sidebar) return;
        
        sidebar.innerHTML = '';
        
        let currentSection = null;
        
        this.navItems.forEach(item => {
            // Add section label if section changed
            if (item.section !== currentSection && item.section !== 'auth') {
                const sectionLabel = document.createElement('div');
                sectionLabel.className = 'nav-section-label';
                sectionLabel.textContent = this.getSectionLabel(item.section);
                sidebar.appendChild(sectionLabel);
                currentSection = item.section;
            }
            
            // Create nav item
            const navItem = document.createElement('a');
            navItem.className = 'nav-item';
            navItem.href = item.href;
            
            if (item.onclick) {
                navItem.addEventListener('click', (e) => {
                    e.preventDefault();
                    item.onclick();
                });
            }
            
            navItem.innerHTML = `
                <i data-lucide="${item.icon}" class="nav-icon"></i>
                <span class="nav-label">${item.label}</span>
            `;
            
            sidebar.appendChild(navItem);
            
            // Trigger lucide icon rendering
            if (window.lucide) {
                window.lucide.createIcons();
            }
        });
    }
    
    getSectionLabel(section) {
        const labels = {
            main: 'Main',
            management: 'Management',
            data: 'Academic Data',
            analytics: 'Analytics',
            security: 'Security',
            class: 'Class Management',
            auth: 'Account'
        };
        return labels[section] || section;
    }
    
    /**
     * Highlight current active link
     */
    updateActiveLink() {
        const currentPath = window.location.pathname;
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach(item => {
            if (item.href.includes(currentPath.split('/').pop())) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }
}

// ============================================================
// INITIALIZE ON MMS READY
// ============================================================

document.addEventListener('mms:ready', (e) => {
    const mms = e.detail.mms;
    const navComponent = new MMSNavigation(mms.getRole());
    navComponent.updateActiveLink();
    window.MMSNav = navComponent;
    console.log('[MMSNavigation] Navigation initialized');
});

// ============================================================
// EXPORT FOR GLOBAL USE
// ============================================================

window.MMSNavigation = MMSNavigation;

console.log('[MMSNavigation] Module loaded successfully');
