/**
 * ============================================================
 * FRONTEND ACCESS CONTROL INTEGRATION LAYER
 * Dashboard & UI Filtering Based on User Role
 * Version: 3.0
 * ============================================================
 * 
 * This module provides dashboard-wide data filtering,
 * UI element visibility control, and request validation
 * for all portals (Admin, Teacher, System Admin)
 */

'use strict';

// ============================================================
// PART 1: DASHBOARD DATA PROVIDER
// ============================================================

class DashboardDataProvider {
    constructor(user, role, schoolCode, classes = [], subjects = []) {
        this.user = user;
        this.role = role;
        this.schoolCode = schoolCode;
        this.classes = classes;
        this.subjects = subjects;
    }

    /**
     * Get students visible to current user
     */
    async getStudents(filters = {}) {
        try {
            let query = _supabase.from('students').select('*');

            // Apply role-based filtering
            if (this.role === 'system_admin') {
                // System admin sees all students
            } else if (this.role === 'admin') {
                // Admin sees students in their school
                query = query.eq('school_code', this.schoolCode);
            } else if (this.role === 'teacher') {
                // Teacher sees students in their assigned classes
                if (this.classes.length === 0) {
                    return [];
                }
                query = query.in('class_id', this.classes);
            }

            // Apply additional filters
            if (filters.classId) {
                query = query.eq('class_id', filters.classId);
            }
            if (filters.schoolCode && this.role === 'system_admin') {
                query = query.eq('school_code', filters.schoolCode);
            }
            if (filters.search) {
                query = query.or(`full_name.ilike.%${filters.search}%,sdms_code.ilike.%${filters.search}%`);
            }

            const { data, error } = await query.order('full_name');
            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('[DashboardDataProvider] Failed to get students:', error);
            throw error;
        }
    }

    /**
     * Get marks visible to current user
     */
    async getMarks(filters = {}) {
        try {
            let query = _supabase.from('marks').select('*');

            if (this.role === 'system_admin') {
                // System admin sees all marks
            } else if (this.role === 'admin') {
                // Admin sees marks in their school
                query = query.eq('school_code', this.schoolCode);
            } else if (this.role === 'teacher') {
                // Teacher sees marks for their classes and subjects
                if (this.classes.length === 0 || this.subjects.length === 0) {
                    return [];
                }
                query = query.in('class_id', this.classes);
                query = query.in('subject_id', this.subjects);
            }

            // Apply additional filters
            if (filters.classId) {
                query = query.eq('class_id', filters.classId);
            }
            if (filters.subjectId) {
                query = query.eq('subject_id', filters.subjectId);
            }
            if (filters.studentId) {
                query = query.eq('student_id', filters.studentId);
            }
            if (filters.term) {
                query = query.eq('term', filters.term);
            }
            if (filters.academicYear) {
                query = query.eq('academic_year', filters.academicYear);
            }
            if (filters.isSubmitted !== undefined) {
                query = query.eq('is_submitted', filters.isSubmitted);
            }

            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('[DashboardDataProvider] Failed to get marks:', error);
            throw error;
        }
    }

    /**
     * Get classes visible to current user
     */
    async getClasses(filters = {}) {
        try {
            let query = _supabase.from('classes').select('*');

            if (this.role === 'system_admin') {
                // System admin sees all classes
            } else if (this.role === 'admin') {
                // Admin sees classes in their school
                query = query.eq('school_code', this.schoolCode);
            } else if (this.role === 'teacher') {
                // Teacher sees only assigned classes
                if (this.classes.length === 0) {
                    return [];
                }
                query = query.in('id', this.classes);
            }

            if (filters.schoolCode && this.role === 'system_admin') {
                query = query.eq('school_code', filters.schoolCode);
            }

            const { data, error } = await query.order('name');
            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('[DashboardDataProvider] Failed to get classes:', error);
            throw error;
        }
    }

    /**
     * Get subjects visible to current user
     */
    async getSubjects(filters = {}) {
        try {
            let query = _supabase.from('subjects').select('*');

            if (this.role === 'system_admin') {
                // System admin sees all subjects
            } else if (this.role === 'admin') {
                // Admin sees subjects in their school
                query = query.eq('school_code', this.schoolCode);
            } else if (this.role === 'teacher') {
                // Teacher sees only assigned subjects
                if (this.subjects.length === 0) {
                    return [];
                }
                query = query.in('id', this.subjects);
            }

            if (filters.schoolCode && this.role === 'system_admin') {
                query = query.eq('school_code', filters.schoolCode);
            }

            const { data, error } = await query.order('name');
            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('[DashboardDataProvider] Failed to get subjects:', error);
            throw error;
        }
    }

    /**
     * Get schools visible to current user
     */
    async getSchools(filters = {}) {
        try {
            let query = _supabase.from('schools').select('*');

            if (this.role === 'system_admin') {
                // System admin sees all schools
            } else if (this.role === 'admin') {
                // Admin sees only their school
                query = query.eq('sdms_code', this.schoolCode);
            } else {
                // Teachers and others don't see multiple schools
                query = query.eq('sdms_code', this.schoolCode);
            }

            const { data, error } = await query.order('name');
            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('[DashboardDataProvider] Failed to get schools:', error);
            throw error;
        }
    }

    /**
     * Get teachers visible to current user
     */
    async getTeachers(filters = {}) {
        try {
            let query = _supabase
                .from('profiles')
                .select('*')
                .eq('role', 'teacher');

            if (this.role === 'admin') {
                // Admin sees teachers in their school
                query = query.eq('school_code', this.schoolCode);
            } else if (this.role === 'teacher') {
                // Teacher sees only themselves
                query = query.eq('id', this.user.id);
            }

            const { data, error } = await query.order('full_name');
            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('[DashboardDataProvider] Failed to get teachers:', error);
            throw error;
        }
    }
}

// ============================================================
// PART 2: UI VISIBILITY CONTROLLER
// ============================================================

class UIVisibilityController {
    constructor(role) {
        this.role = role;
    }

    /**
     * Check if element should be visible for current role
     */
    shouldShowElement(elementRequiredRole) {
        const roleHierarchy = {
            'system_admin': 3,
            'admin': 2,
            'teacher': 1
        };

        const userLevel = roleHierarchy[this.role] || 0;
        const requiredLevel = roleHierarchy[elementRequiredRole] || 0;

        return userLevel >= requiredLevel;
    }

    /**
     * Show/hide element based on role
     */
    toggleElementVisibility(elementId, requiredRole) {
        const element = document.getElementById(elementId);
        if (!element) return;

        if (this.shouldShowElement(requiredRole)) {
            element.style.display = '';
            element.classList.remove('hidden');
        } else {
            element.style.display = 'none';
            element.classList.add('hidden');
        }
    }

    /**
     * Hide multiple elements
     */
    hideElements(elementIds) {
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = 'none';
                element.classList.add('hidden');
            }
        });
    }

    /**
     * Show multiple elements
     */
    showElements(elementIds) {
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = '';
                element.classList.remove('hidden');
            }
        });
    }

    /**
     * Get role-specific UI configuration
     */
    getUIConfig() {
        const configs = {
            system_admin: {
                canManageSchools: true,
                canManageAdmins: true,
                canViewAllData: true,
                canEditAllMarks: true,
                canApproveMarks: true,
                canViewReports: true,
                canGenerateReports: true,
                showSchoolFilter: true,
                showClassFilter: true
            },
            admin: {
                canManageSchools: false,
                canManageAdmins: false,
                canViewAllData: false, // Only their school
                canEditAllMarks: true,
                canApproveMarks: true,
                canViewReports: true,
                canGenerateReports: true,
                showSchoolFilter: false, // No school filter needed
                showClassFilter: true
            },
            teacher: {
                canManageSchools: false,
                canManageAdmins: false,
                canViewAllData: false, // Only their classes
                canEditAllMarks: false, // Only their marks
                canApproveMarks: false,
                canViewReports: true, // Their class reports
                canGenerateReports: false,
                showSchoolFilter: false,
                showClassFilter: true
            }
        };

        return configs[this.role] || configs.teacher;
    }
}

// ============================================================
// PART 3: REAL-TIME SYNC WITH ACCESS CONTROL
// ============================================================

class SecureRealtimeSync {
    constructor(provider) {
        this.provider = provider;
        this.subscriptions = [];
    }

    /**
     * Listen to student updates with access filtering
     */
    listenToStudents(callback) {
        const subscription = _supabase
            .channel('students-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'students' },
                (payload) => {
                    const update = payload.new || payload.old;
                    
                    // Check access before sending to callback
                    if (this._canAccessStudent(update)) {
                        callback(payload);
                    }
                })
            .subscribe();

        this.subscriptions.push(subscription);
        return subscription;
    }

    /**
     * Listen to marks updates with access filtering
     */
    listenToMarks(callback) {
        const subscription = _supabase
            .channel('marks-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'marks' },
                (payload) => {
                    const update = payload.new || payload.old;
                    
                    // Check access before sending to callback
                    if (this._canAccessMarks(update)) {
                        callback(payload);
                    }
                })
            .subscribe();

        this.subscriptions.push(subscription);
        return subscription;
    }

    /**
     * Internal: Check if user can access student
     */
    _canAccessStudent(student) {
        if (this.provider.role === 'system_admin') {
            return true;
        }

        if (this.provider.role === 'admin') {
            return student.school_code === this.provider.schoolCode;
        }

        if (this.provider.role === 'teacher') {
            return this.provider.classes.includes(student.class_id);
        }

        return false;
    }

    /**
     * Internal: Check if user can access marks
     */
    _canAccessMarks(mark) {
        if (this.provider.role === 'system_admin') {
            return true;
        }

        if (this.provider.role === 'admin') {
            return mark.school_code === this.provider.schoolCode;
        }

        if (this.provider.role === 'teacher') {
            return this.provider.classes.includes(mark.class_id)
                && this.provider.subjects.includes(mark.subject_id);
        }

        return false;
    }

    /**
     * Unsubscribe all listeners
     */
    unsubscribeAll() {
        this.subscriptions.forEach(sub => sub.unsubscribe());
        this.subscriptions = [];
    }
}

// ============================================================
// PART 4: REQUEST VALIDATION & SANITIZATION
// ============================================================

class RequestValidator {
    /**
     * Validate and sanitize student creation request
     */
    static validateCreateStudentRequest(data, provider) {
        const errors = [];

        // Check permission
        if (provider.role === 'system_admin') {
            // Can create in any school
        } else if (provider.role === 'admin') {
            if (data.school_code !== provider.schoolCode) {
                errors.push('Cannot create student outside your school');
            }
        } else if (provider.role === 'teacher') {
            if (!provider.classes.includes(data.class_id)) {
                errors.push('Cannot create student outside your assigned classes');
            }
        } else {
            errors.push('Insufficient permissions to create student');
        }

        // Validate data
        if (!data.full_name || data.full_name.trim().length === 0) {
            errors.push('Full name is required');
        }

        if (data.full_name && data.full_name.length > 255) {
            errors.push('Full name is too long');
        }

        if (data.sdms_code && !/^\d{10}$/.test(data.sdms_code)) {
            errors.push('SDMS code must be exactly 10 digits');
        }

        if (data.gender && !['M', 'F'].includes(data.gender)) {
            errors.push('Gender must be M or F');
        }

        if (!data.class_id) {
            errors.push('Class is required');
        }

        return {
            isValid: errors.length === 0,
            errors,
            sanitized: {
                full_name: ValidationEngine.sanitizeString(data.full_name),
                sdms_code: data.sdms_code || null,
                gender: data.gender || null,
                class_id: data.class_id,
                school_code: data.school_code
            }
        };
    }

    /**
     * Validate and sanitize mark submission request
     */
    static validateMarkSubmissionRequest(data, provider) {
        const errors = [];

        // Check permission
        if (provider.role === 'teacher') {
            if (!provider.classes.includes(data.class_id)) {
                errors.push('Cannot submit marks for this class');
            }
            if (!provider.subjects.includes(data.subject_id)) {
                errors.push('Cannot submit marks for this subject');
            }
        } else if (provider.role !== 'system_admin' && provider.role !== 'admin') {
            errors.push('Insufficient permissions to submit marks');
        }

        // Validate data
        if (data.score === null || data.score === undefined) {
            errors.push('Score is required');
        }

        if (typeof data.score !== 'number' || data.score < 0) {
            errors.push('Score must be a non-negative number');
        }

        if (data.score > data.max_score) {
            errors.push(`Score cannot exceed maximum of ${data.max_score}`);
        }

        if (!data.student_id || !data.subject_id || !data.class_id) {
            errors.push('Student, subject, and class are required');
        }

        if (!data.assessment_id || !data.term || !data.academic_year) {
            errors.push('Assessment, term, and academic year are required');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate mark approval request
     */
    static validateMarkApprovalRequest(data, provider) {
        const errors = [];

        // Check permission
        if (provider.role === 'admin') {
            // Admin can approve marks in their school
            // School code would be checked at DB level via RLS
        } else if (provider.role === 'system_admin') {
            // System admin can approve any
        } else {
            errors.push('Insufficient permissions to approve marks');
        }

        if (!data.id) {
            errors.push('Mark ID is required');
        }

        if (data.is_approved !== true && data.is_approved !== false) {
            errors.push('Approval status must be true or false');
        }

        if (data.is_approved === false && !data.rejection_comment) {
            errors.push('Rejection reason is required');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

// ============================================================
// PART 5: EXPORT FOR GLOBAL USE
// ============================================================

window.DashboardDataProvider = DashboardDataProvider;
window.UIVisibilityController = UIVisibilityController;
window.SecureRealtimeSync = SecureRealtimeSync;
window.RequestValidator = RequestValidator;

console.log('[Frontend Access Control] Module loaded successfully');
