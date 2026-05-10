/**
 * ============================================================
 * MARKS MANAGEMENT SYSTEM - COMPREHENSIVE ACCESS CONTROL LAYER
 * Role-Based Data Access Enforcement (Frontend + Backend)
 * Version: 3.0 - Full Implementation with SecurityContext
 * ============================================================
 */

'use strict';

// ============================================================
// PART 1: SECURITY CONTEXT CLASS
// ============================================================

class SecurityContext {
    constructor() {
        this.user = null;
        this.profile = null;
        this.role = null;
        this.schoolCode = null;
        this.teacherClasses = [];
        this.teacherSubjects = [];
        this.isAuthenticated = false;
    }

    /**
     * Initialize security context from current user
     */
    async init(user, profile) {
        if (!user || !profile) {
            throw new Error('Missing user or profile data');
        }

        this.user = user;
        this.profile = profile;
        this.role = profile.role;
        this.schoolCode = profile.school_code;
        this.isAuthenticated = true;

        // Load teacher assignments if applicable
        if (this.role === 'teacher') {
            await this.loadTeacherAssignments();
        }

        console.log('[SECURITY] Context initialized:', {
            userId: this.user.id,
            role: this.role,
            school: this.schoolCode
        });

        return this;
    }

    /**
     * Load teacher's assigned classes and subjects
     */
    async loadTeacherAssignments() {
        try {
            const { data, error } = await _supabase
                .from('teacher_assignments')
                .select('class_id, subject_id')
                .eq('teacher_id', this.user.id);

            if (error) throw error;

            this.teacherClasses = [...new Set(data.map(a => a.class_id))];
            this.teacherSubjects = [...new Set(data.map(a => a.subject_id))];

            console.log('[SECURITY] Teacher assignments loaded:', {
                classes: this.teacherClasses.length,
                subjects: this.teacherSubjects.length
            });
        } catch (error) {
            console.error('[SECURITY] Error loading teacher assignments:', error);
            throw error;
        }
    }

    hasRole(role) { return this.role === role; }
    isSystemAdmin() { return this.role === 'system_admin'; }
    isSchoolAdmin() { return this.role === 'admin'; }
    isTeacher() { return this.role === 'teacher'; }
    getSchool() { return this.schoolCode; }

    clear() {
        this.user = null;
        this.profile = null;
        this.role = null;
        this.schoolCode = null;
        this.teacherClasses = [];
        this.teacherSubjects = [];
        this.isAuthenticated = false;
    }
}

// Global security context instance
const SEC = new SecurityContext();

// ============================================================
// PART 2: LEGACY ACCESS CONTROL (BACKWARDS COMPATIBLE)
// ============================================================

const ACCESS_CONTROL = {
    currentUser: null,
    userRole: null,
    userSchool: null,
    userClasses: [],
    userSubjects: [],
    
    /**
     * Initialize access control with user context
     * Must be called after authentication
     */
    async init(user) {
        this.currentUser = user;
        
        // Get user profile with role and school
        const { data: profile, error } = await _supabase
            .from('profiles')
            .select('role, school_code')
            .eq('id', user.id)
            .single();
        
        if (error || !profile) {
            console.error('[AC] Failed to load user profile:', error);
            throw new Error('Access control initialization failed');
        }
        
        this.userRole = profile.role;
        this.userSchool = profile.school_code;
        
        // If teacher, load assigned classes and subjects
        if (this.userRole === 'teacher') {
            await this._loadTeacherAssignments();
        }
        
        console.log('[AC] Access control initialized:', {
            role: this.userRole,
            school: this.userSchool,
            classes: this.userClasses.length,
            subjects: this.userSubjects.length
        });
    },
    
    /**
     * Load teacher's assigned classes and subjects
     */
    async _loadTeacherAssignments() {
        const { data: assignments, error } = await _supabase
            .from('teacher_assignments')
            .select('class_id, subject_id')
            .eq('teacher_id', this.currentUser.id);
        
        if (error) {
            console.warn('[AC] Failed to load teacher assignments:', error);
            return;
        }
        
        this.userClasses = [...new Set(assignments.map(a => a.class_id))];
        this.userSubjects = [...new Set(assignments.map(a => a.subject_id))];
    },
    
    /**
     * Check if user can access a school
     */
    canAccessSchool(schoolCode) {
        if (this.userRole === 'system_admin') return true;
        if (this.userRole === 'admin') return this.userSchool === schoolCode;
        return false;
    },
    
    /**
     * Check if user can access a class
     */
    canAccessClass(classId) {
        if (this.userRole === 'system_admin') return true;
        if (this.userRole === 'admin') return true; // Admins see all school classes
        if (this.userRole === 'teacher') return this.userClasses.includes(classId);
        return false;
    },
    
    /**
     * Check if user can access a subject
     */
    canAccessSubject(subjectId) {
        if (this.userRole === 'system_admin') return true;
        if (this.userRole === 'admin') return true; // Admins see all school subjects
        if (this.userRole === 'teacher') return this.userSubjects.includes(subjectId);
        return false;
    },
    
    /**
     * Check if user can access a student
     */
    canAccessStudent(student) {
        if (this.userRole === 'system_admin') return true;
        
        if (this.userRole === 'admin') {
            // Admin can access students in their school
            return student.school_code === this.userSchool;
        }
        
        if (this.userRole === 'teacher') {
            // Teacher can access students in their assigned classes
            return this.userClasses.includes(student.class_id);
        }
        
        return false;
    },
    
    /**
     * Check if user can access marks
     */
    canAccessMarks(mark) {
        if (this.userRole === 'system_admin') return true;
        
        if (this.userRole === 'admin') {
            // Admin can access marks in their school
            return mark.school_code === this.userSchool;
        }
        
        if (this.userRole === 'teacher') {
            // Teacher can access marks for their classes and subjects
            return this.userClasses.includes(mark.class_id) &&
                   this.userSubjects.includes(mark.subject_id);
        }
        
        return false;
    },
    
    /**
     * Check if user can perform an action
     */
    canPerformAction(action, resource) {
        const permissions = {
            system_admin: {
                view_all: true,
                manage_all: true,
                create_school: true,
                create_admin: true,
                create_teacher: true,
                create_student: true,
                edit_student: true,
                delete_student: true,
                view_marks: true,
                create_marks: false, // Only teachers create marks
                edit_marks: true,
                delete_marks: true,
                approve_marks: true,
                view_reports: true,
                generate_reports: true
            },
            admin: {
                view_all: false,
                manage_all: false,
                create_school: false,
                create_admin: false,
                create_teacher: true,
                create_student: true,
                edit_student: true,
                delete_student: true,
                view_marks: true,
                create_marks: false,
                edit_marks: true,
                delete_marks: true,
                approve_marks: true,
                view_reports: true,
                generate_reports: true
            },
            teacher: {
                view_all: false,
                manage_all: false,
                create_school: false,
                create_admin: false,
                create_teacher: false,
                create_student: true, // Teachers can add students to their class
                edit_student: true,   // Can edit students in their class
                delete_student: false, // Cannot delete students
                view_marks: true,
                create_marks: true,
                edit_marks: true,
                delete_marks: false,
                approve_marks: false,
                view_reports: true,
                generate_reports: false
            }
        };
        
        return permissions[this.userRole]?.[action] || false;
    },
    
    /**
     * Validate request before executing
     * Throws exception if access denied
     */
    validateAccess(action, resource) {
        if (!this.canPerformAction(action, resource)) {
            const error = new Error(`Access denied: Cannot ${action} on ${resource}`);
            error.code = 'ACCESS_DENIED';
            throw error;
        }
    }
};

// ============================================================
// QUERY BUILDER WITH ACCESS CONTROL
// ============================================================

const SecureQueryBuilder = {
    /**
     * Build a students query with proper filtering
     */
    studentsQuery(filters = {}) {
        let query = _supabase
            .from('students')
            .select('*');
        
        // Apply role-based filtering
        if (ACCESS_CONTROL.userRole === 'system_admin') {
            // System admin: No filtering needed
        } else if (ACCESS_CONTROL.userRole === 'admin') {
            // Admin: Only their school
            query = query.eq('school_code', ACCESS_CONTROL.userSchool);
        } else if (ACCESS_CONTROL.userRole === 'teacher') {
            // Teacher: Only their assigned classes
            if (ACCESS_CONTROL.userClasses.length === 0) {
                // Teacher has no assignments, return empty
                return null;
            }
            query = query.in('class_id', ACCESS_CONTROL.userClasses);
        }
        
        // Apply additional filters
        if (filters.classId) {
            if (!ACCESS_CONTROL.canAccessClass(filters.classId)) {
                throw new Error('Access denied: Cannot access this class');
            }
            query = query.eq('class_id', filters.classId);
        }
        
        if (filters.schoolCode && ACCESS_CONTROL.userRole === 'system_admin') {
            query = query.eq('school_code', filters.schoolCode);
        }
        
        if (filters.search) {
            query = query.or(`full_name.ilike.%${filters.search}%,sdms_code.ilike.%${filters.search}%`);
        }
        
        return query.order('full_name');
    },
    
    /**
     * Build a marks query with proper filtering
     */
    marksQuery(filters = {}) {
        let query = _supabase
            .from('marks')
            .select('*');
        
        // Apply role-based filtering
        if (ACCESS_CONTROL.userRole === 'system_admin') {
            // System admin: No filtering needed
        } else if (ACCESS_CONTROL.userRole === 'admin') {
            // Admin: Only their school
            query = query.eq('school_code', ACCESS_CONTROL.userSchool);
        } else if (ACCESS_CONTROL.userRole === 'teacher') {
            // Teacher: Only their classes and subjects
            if (ACCESS_CONTROL.userClasses.length === 0 || ACCESS_CONTROL.userSubjects.length === 0) {
                return null;
            }
            query = query.in('class_id', ACCESS_CONTROL.userClasses);
            query = query.in('subject_id', ACCESS_CONTROL.userSubjects);
        }
        
        // Apply additional filters
        if (filters.classId) {
            if (!ACCESS_CONTROL.canAccessClass(filters.classId)) {
                throw new Error('Access denied: Cannot access this class');
            }
            query = query.eq('class_id', filters.classId);
        }
        
        if (filters.subjectId) {
            if (!ACCESS_CONTROL.canAccessSubject(filters.subjectId)) {
                throw new Error('Access denied: Cannot access this subject');
            }
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
        
        return query.order('created_at', { ascending: false });
    },
    
    /**
     * Build a classes query with proper filtering
     */
    classesQuery(filters = {}) {
        let query = _supabase
            .from('classes')
            .select('*');
        
        // Apply role-based filtering
        if (ACCESS_CONTROL.userRole === 'system_admin') {
            // System admin: No filtering needed
        } else if (ACCESS_CONTROL.userRole === 'admin') {
            // Admin: Only their school
            query = query.eq('school_code', ACCESS_CONTROL.userSchool);
        } else if (ACCESS_CONTROL.userRole === 'teacher') {
            // Teacher: Only their assigned classes
            if (ACCESS_CONTROL.userClasses.length === 0) {
                return null;
            }
            query = query.in('id', ACCESS_CONTROL.userClasses);
        }
        
        return query.order('name');
    },
    
    /**
     * Build a teachers query with proper filtering
     */
    teachersQuery(filters = {}) {
        let query = _supabase
            .from('profiles')
            .select('*')
            .eq('role', 'teacher');
        
        // Apply role-based filtering
        if (ACCESS_CONTROL.userRole === 'admin') {
            // Admin: Only their school
            query = query.eq('school_code', ACCESS_CONTROL.userSchool);
        } else if (ACCESS_CONTROL.userRole === 'teacher') {
            // Teachers can only see themselves
            query = query.eq('id', ACCESS_CONTROL.currentUser.id);
        }
        
        return query.order('full_name');
    },
    
    /**
     * Build a subjects query with proper filtering
     */
    subjectsQuery(filters = {}) {
        let query = _supabase
            .from('subjects')
            .select('*');
        
        // Apply role-based filtering
        if (ACCESS_CONTROL.userRole === 'system_admin') {
            // System admin: No filtering needed
        } else if (ACCESS_CONTROL.userRole === 'admin') {
            // Admin: Only their school
            query = query.eq('school_code', ACCESS_CONTROL.userSchool);
        } else if (ACCESS_CONTROL.userRole === 'teacher') {
            // Teacher: Only their assigned subjects
            if (ACCESS_CONTROL.userSubjects.length === 0) {
                return null;
            }
            query = query.in('id', ACCESS_CONTROL.userSubjects);
        }
        
        return query.order('name');
    },
    
    /**
     * Build a schools query with proper filtering
     */
    schoolsQuery(filters = {}) {
        let query = _supabase
            .from('schools')
            .select('*');
        
        // Apply role-based filtering
        if (ACCESS_CONTROL.userRole === 'system_admin') {
            // System admin: No filtering needed
        } else if (ACCESS_CONTROL.userRole === 'admin') {
            // Admin: Only their school
            query = query.eq('school_code', ACCESS_CONTROL.userSchool);
        }
        
        return query.order('name');
    }
};

// ============================================================
// REAL-TIME DATA FILTERS
// ============================================================

const RealTimeFilter = {
    /**
     * Filter real-time updates to only show authorized data
     */
    filterStudentUpdate(update) {
        if (!ACCESS_CONTROL.canAccessStudent(update)) {
            return null; // Don't show this update
        }
        return update;
    },
    
    filterMarksUpdate(update) {
        if (!ACCESS_CONTROL.canAccessMarks(update)) {
            return null; // Don't show this update
        }
        return update;
    },
    
    filterClassUpdate(update) {
        if (!ACCESS_CONTROL.canAccessClass(update.id)) {
            return null; // Don't show this update
        }
        return update;
    },
    
    /**
     * Listen to students updates with filtering
     */
    listenToStudentUpdates(callback) {
        const subscription = _supabase
            .channel('students-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'students' },
                (payload) => {
                    const filtered = RealTimeFilter.filterStudentUpdate(payload.new || payload.old);
                    if (filtered) {
                        callback(payload);
                    }
                })
            .subscribe();
        
        return subscription;
    },
    
    /**
     * Listen to marks updates with filtering
     */
    listenToMarksUpdates(callback) {
        const subscription = _supabase
            .channel('marks-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'marks' },
                (payload) => {
                    const filtered = RealTimeFilter.filterMarksUpdate(payload.new || payload.old);
                    if (filtered) {
                        callback(payload);
                    }
                })
            .subscribe();
        
        return subscription;
    }
};

// ============================================================
// DATA ISOLATION UTILITIES
// ============================================================

const DataIsolation = {
    /**
     * Filter array of students to only authorized ones
     */
    filterStudents(students) {
        return students.filter(s => ACCESS_CONTROL.canAccessStudent(s));
    },
    
    /**
     * Filter array of marks to only authorized ones
     */
    filterMarks(marks) {
        return marks.filter(m => ACCESS_CONTROL.canAccessMarks(m));
    },
    
    /**
     * Filter array of classes to only authorized ones
     */
    filterClasses(classes) {
        return classes.filter(c => {
            if (ACCESS_CONTROL.userRole === 'system_admin') return true;
            if (ACCESS_CONTROL.userRole === 'admin') {
                return c.school_code === ACCESS_CONTROL.userSchool;
            }
            if (ACCESS_CONTROL.userRole === 'teacher') {
                return ACCESS_CONTROL.userClasses.includes(c.id);
            }
            return false;
        });
    },
    
    /**
     * Filter array of subjects to only authorized ones
     */
    filterSubjects(subjects) {
        return subjects.filter(s => {
            if (ACCESS_CONTROL.userRole === 'system_admin') return true;
            if (ACCESS_CONTROL.userRole === 'admin') {
                return s.school_code === ACCESS_CONTROL.userSchool;
            }
            if (ACCESS_CONTROL.userRole === 'teacher') {
                return ACCESS_CONTROL.userSubjects.includes(s.id);
            }
            return false;
        });
    }
};

// ============================================================
// AUDIT & LOGGING
// ============================================================

const AccessAudit = {
    /**
     * Log an access attempt
     */
    async logAccess(action, resource, allowed) {
        try {
            const { error } = await _supabase
                .from('audit_logs')
                .insert({
                    user_id: ACCESS_CONTROL.currentUser.id,
                    action: action,
                    table_name: resource,
                    new_data: {
                        allowed: allowed,
                        userRole: ACCESS_CONTROL.userRole,
                        userSchool: ACCESS_CONTROL.userSchool
                    }
                });
            
            if (error) console.warn('[Audit] Log error:', error);
        } catch (e) {
            console.warn('[Audit] Failed to log access:', e);
        }
    },
    
    /**
     * Log denied access
     */
    async logDenied(action, resource, reason) {
        console.warn(`[Security] Access denied: ${action} on ${resource} - ${reason}`);
        await this.logAccess(`DENIED_${action}`, resource, false);
    }
};

// ============================================================
// PART 3: VALIDATION & SANITIZATION
// ============================================================

class ValidationEngine {
    /**
     * Sanitize string input to prevent XSS
     */
    static sanitizeString(str, maxLength = 255) {
        if (typeof str !== 'string') return '';
        
        let sanitized = str.replace(/<[^>]*>/g, '');
        sanitized = sanitized.replace(/['"`]/g, (char) => '\\' + char);
        
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength);
        }
        
        return sanitized.trim();
    }

    /**
     * Validate email format
     */
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate role
     */
    static validateRole(role) {
        return ['admin', 'teacher', 'system_admin'].includes(role);
    }

    /**
     * Validate school code (SDMS: 6 digits)
     */
    static validateSchoolCode(code) {
        return /^\d{6}$/.test(code);
    }

    /**
     * Validate student data
     */
    static validateStudentData(data) {
        const errors = [];

        if (!data.full_name || data.full_name.trim().length === 0) {
            errors.push('Full name is required');
        }

        if (data.sdms_code && !/^\d{10}$/.test(data.sdms_code)) {
            errors.push('SDMS code must be 10 digits');
        }

        if (data.gender && !['M', 'F'].includes(data.gender)) {
            errors.push('Gender must be M or F');
        }

        if (!data.class_id) {
            errors.push('Class is required');
        }

        return { isValid: errors.length === 0, errors };
    }

    /**
     * Validate mark data
     */
    static validateMarkData(data) {
        const errors = [];

        if (data.score === null || data.score === undefined) {
            errors.push('Score is required');
        }

        if (typeof data.score !== 'number' || data.score < 0) {
            errors.push('Score must be a non-negative number');
        }

        if (data.score > data.max_score) {
            errors.push('Score cannot exceed max score');
        }

        if (!data.student_id || !data.subject_id || !data.class_id) {
            errors.push('Student, subject, and class are required');
        }

        if (!data.assessment_id || !data.term || !data.academic_year) {
            errors.push('Assessment, term, and academic year are required');
        }

        return { isValid: errors.length === 0, errors };
    }
}

// ============================================================
// PART 4: OPERATION PERMISSION CHECKS
// ============================================================

class OperationPermissions {
    /**
     * Check if user can CREATE a student
     */
    static canCreateStudent(targetSchool, targetClass) {
        if (!ACCESS_CONTROL.currentUser) return false;

        if (ACCESS_CONTROL.userRole === 'system_admin') {
            return true;
        }

        if (ACCESS_CONTROL.userRole === 'admin') {
            return targetSchool === ACCESS_CONTROL.userSchool;
        }

        if (ACCESS_CONTROL.userRole === 'teacher') {
            return ACCESS_CONTROL.userClasses.includes(targetClass);
        }

        return false;
    }

    /**
     * Check if user can EDIT a student
     */
    static canEditStudent(student) {
        if (!ACCESS_CONTROL.currentUser) return false;

        if (ACCESS_CONTROL.userRole === 'system_admin') {
            return true;
        }

        if (ACCESS_CONTROL.userRole === 'admin') {
            return student.school_code === ACCESS_CONTROL.userSchool;
        }

        return false;
    }

    /**
     * Check if user can DELETE a student
     */
    static canDeleteStudent(student) {
        if (!ACCESS_CONTROL.currentUser) return false;

        if (ACCESS_CONTROL.userRole === 'system_admin') {
            return true;
        }

        if (ACCESS_CONTROL.userRole === 'admin') {
            return student.school_code === ACCESS_CONTROL.userSchool;
        }

        return false;
    }

    /**
     * Check if user can SUBMIT marks
     */
    static canSubmitMarks(mark) {
        if (!ACCESS_CONTROL.currentUser) return false;

        if (ACCESS_CONTROL.userRole === 'teacher') {
            return ACCESS_CONTROL.userClasses.includes(mark.class_id)
                && ACCESS_CONTROL.userSubjects.includes(mark.subject_id);
        }

        return false;
    }

    /**
     * Check if user can APPROVE marks
     */
    static canApproveMarks(mark) {
        if (!ACCESS_CONTROL.currentUser) return false;

        if (ACCESS_CONTROL.userRole === 'system_admin') {
            return true;
        }

        if (ACCESS_CONTROL.userRole === 'admin') {
            return mark.school_code === ACCESS_CONTROL.userSchool;
        }

        return false;
    }

    /**
     * Check if user can GENERATE reports
     */
    static canGenerateReports(reportSchool) {
        if (!ACCESS_CONTROL.currentUser) return false;

        if (ACCESS_CONTROL.userRole === 'system_admin') {
            return true;
        }

        if (ACCESS_CONTROL.userRole === 'admin') {
            return reportSchool === ACCESS_CONTROL.userSchool;
        }

        if (ACCESS_CONTROL.userRole === 'teacher') {
            return true;
        }

        return false;
    }
}

// ============================================================
// PART 5: CUSTOM ERROR CLASSES
// ============================================================

class SecurityError extends Error {
    constructor(message, code = 'SECURITY_ERROR') {
        super(message);
        this.code = code;
        this.name = 'SecurityError';
    }
}

class AuthenticationError extends SecurityError {
    constructor(message = 'User not authenticated') {
        super(message, 'AUTH_ERROR');
    }
}

class AuthorizationError extends SecurityError {
    constructor(message = 'User not authorized to access this resource') {
        super(message, 'AUTHZ_ERROR');
    }
}

class ValidationError extends SecurityError {
    constructor(message, errors = []) {
        super(message, 'VALIDATION_ERROR');
        this.errors = errors;
    }
}

// ============================================================
// EXPORT FOR GLOBAL USE
// ============================================================

window.ACCESS_CONTROL = ACCESS_CONTROL;
window.SecureQueryBuilder = SecureQueryBuilder;
window.RealTimeFilter = RealTimeFilter;
window.DataIsolation = DataIsolation;
window.AccessAudit = AccessAudit;
window.SEC = SEC;
window.ValidationEngine = ValidationEngine;
window.OperationPermissions = OperationPermissions;
window.SecurityError = SecurityError;
window.AuthenticationError = AuthenticationError;
window.AuthorizationError = AuthorizationError;
window.ValidationError = ValidationError;
