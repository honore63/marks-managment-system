/**
 * ============================================================
 * SECURE API WRAPPER WITH REQUEST VALIDATION
 * Centralized data access with role-based validation
 * Version: 1.0
 * ============================================================
 */

'use strict';

class SecureAPIClient {
    constructor(provider) {
        this.provider = provider;
        this.requestCount = 0;
        this.errorCount = 0;
    }

    /**
     * Create a new student with validation
     */
    async createStudent(data) {
        try {
            // Validate permission
            const validation = RequestValidator.validateCreateStudentRequest(data, this.provider);
            if (!validation.isValid) {
                throw new ValidationError('Invalid student data', validation.errors);
            }

            // Audit log
            auditLog('CREATE_STUDENT', 'students', null, true);

            // Insert into database
            const { data: result, error } = await _supabase
                .from('students')
                .insert([validation.sanitized])
                .select();

            if (error) throw error;

            return result[0];
        } catch (error) {
            this.errorCount++;
            auditLog('CREATE_STUDENT', 'students', null, false, { error: error.message });
            throw error;
        }
    }

    /**
     * Get students with role-based filtering
     */
    async getStudents(filters = {}) {
        try {
            let query = _supabase.from('students').select('*');

            // Apply role-based filtering
            if (this.provider.role === 'system_admin') {
                // No additional filter
            } else if (this.provider.role === 'admin') {
                query = query.eq('school_code', this.provider.schoolCode);
            } else if (this.provider.role === 'teacher') {
                if (this.provider.classes.length === 0) {
                    return [];
                }
                query = query.in('class_id', this.provider.classes);
            }

            // Apply additional filters
            if (filters.classId) {
                query = query.eq('class_id', filters.classId);
            }
            if (filters.schoolCode && this.provider.role === 'system_admin') {
                query = query.eq('school_code', filters.schoolCode);
            }
            if (filters.search) {
                query = query.or(`full_name.ilike.%${filters.search}%,sdms_code.eq.${filters.search}`);
            }

            const { data, error } = await query.order('full_name');
            if (error) throw error;

            return data || [];
        } catch (error) {
            this.errorCount++;
            console.error('[SecureAPIClient] Error fetching students:', error);
            throw error;
        }
    }

    /**
     * Update a student
     */
    async updateStudent(studentId, updates) {
        try {
            // Get current student data
            const { data: currentStudent, error: fetchError } = await _supabase
                .from('students')
                .select('*')
                .eq('id', studentId)
                .single();

            if (fetchError) throw fetchError;

            // Check permission
            if (!OperationPermissions.canEditStudent(currentStudent)) {
                throw new AuthorizationError('Cannot edit this student');
            }

            // Validate updates
            const validation = RequestValidator.validateCreateStudentRequest(
                { ...currentStudent, ...updates },
                this.provider
            );

            if (!validation.isValid) {
                throw new ValidationError('Invalid update data', validation.errors);
            }

            // Audit log
            auditLog('UPDATE_STUDENT', 'students', studentId, true);

            // Update in database
            const { data: result, error } = await _supabase
                .from('students')
                .update(validation.sanitized)
                .eq('id', studentId)
                .select();

            if (error) throw error;

            return result[0];
        } catch (error) {
            this.errorCount++;
            auditLog('UPDATE_STUDENT', 'students', studentId, false, { error: error.message });
            throw error;
        }
    }

    /**
     * Delete a student
     */
    async deleteStudent(studentId) {
        try {
            // Get current student data
            const { data: student, error: fetchError } = await _supabase
                .from('students')
                .select('*')
                .eq('id', studentId)
                .single();

            if (fetchError) throw fetchError;

            // Check permission
            if (!OperationPermissions.canDeleteStudent(student)) {
                throw new AuthorizationError('Cannot delete this student');
            }

            // Audit log
            auditLog('DELETE_STUDENT', 'students', studentId, true);

            // Delete from database
            const { error } = await _supabase
                .from('students')
                .delete()
                .eq('id', studentId);

            if (error) throw error;

            return { success: true };
        } catch (error) {
            this.errorCount++;
            auditLog('DELETE_STUDENT', 'students', studentId, false, { error: error.message });
            throw error;
        }
    }

    /**
     * Create marks entry
     */
    async createMarks(data) {
        try {
            // Validate permission
            const validation = RequestValidator.validateMarkSubmissionRequest(data, this.provider);
            if (!validation.isValid) {
                throw new ValidationError('Invalid mark data', validation.errors);
            }

            // Audit log
            auditLog('CREATE_MARK', 'marks', null, true);

            // Insert into database
            const { data: result, error } = await _supabase
                .from('marks')
                .insert([{
                    student_id: data.student_id,
                    subject_id: data.subject_id,
                    class_id: data.class_id,
                    assessment_id: data.assessment_id,
                    score: data.score,
                    max_score: data.max_score || 100,
                    term: data.term,
                    academic_year: data.academic_year,
                    school_code: this.provider.schoolCode,
                    is_submitted: false
                }])
                .select();

            if (error) throw error;

            return result[0];
        } catch (error) {
            this.errorCount++;
            auditLog('CREATE_MARK', 'marks', null, false, { error: error.message });
            throw error;
        }
    }

    /**
     * Get marks with role-based filtering
     */
    async getMarks(filters = {}) {
        try {
            let query = _supabase.from('marks').select('*');

            // Apply role-based filtering
            if (this.provider.role === 'system_admin') {
                // No additional filter
            } else if (this.provider.role === 'admin') {
                query = query.eq('school_code', this.provider.schoolCode);
            } else if (this.provider.role === 'teacher') {
                if (this.provider.classes.length === 0 || this.provider.subjects.length === 0) {
                    return [];
                }
                query = query.in('class_id', this.provider.classes);
                query = query.in('subject_id', this.provider.subjects);
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
            if (filters.isApproved !== undefined) {
                query = query.eq('is_approved', filters.isApproved);
            }

            const { data, error } = await query.order('created_at', { ascending: false });
            if (error) throw error;

            return data || [];
        } catch (error) {
            this.errorCount++;
            console.error('[SecureAPIClient] Error fetching marks:', error);
            throw error;
        }
    }

    /**
     * Submit marks for approval
     */
    async submitMarks(markId) {
        try {
            // Get current mark
            const { data: mark, error: fetchError } = await _supabase
                .from('marks')
                .select('*')
                .eq('id', markId)
                .single();

            if (fetchError) throw fetchError;

            // Check permission
            if (!OperationPermissions.canSubmitMarks(mark)) {
                throw new AuthorizationError('Cannot submit this mark');
            }

            // Audit log
            auditLog('SUBMIT_MARKS', 'marks', markId, true);

            // Update in database
            const { data: result, error } = await _supabase
                .from('marks')
                .update({ is_submitted: true, submitted_at: new Date().toISOString() })
                .eq('id', markId)
                .select();

            if (error) throw error;

            return result[0];
        } catch (error) {
            this.errorCount++;
            auditLog('SUBMIT_MARKS', 'marks', markId, false, { error: error.message });
            throw error;
        }
    }

    /**
     * Approve or reject marks
     */
    async approveMarks(markId, approved, rejectionComment = null) {
        try {
            // Get current mark
            const { data: mark, error: fetchError } = await _supabase
                .from('marks')
                .select('*')
                .eq('id', markId)
                .single();

            if (fetchError) throw fetchError;

            // Check permission
            if (!OperationPermissions.canApproveMarks(mark)) {
                throw new AuthorizationError('Cannot approve marks in this school');
            }

            const updateData = {
                is_approved: approved,
                approved_at: approved ? new Date().toISOString() : null
            };

            if (!approved && rejectionComment) {
                updateData.rejection_comment = rejectionComment;
            }

            // Audit log
            auditLog('APPROVE_MARKS', 'marks', markId, true, { approved });

            // Update in database
            const { data: result, error } = await _supabase
                .from('marks')
                .update(updateData)
                .eq('id', markId)
                .select();

            if (error) throw error;

            return result[0];
        } catch (error) {
            this.errorCount++;
            auditLog('APPROVE_MARKS', 'marks', markId, false, { error: error.message });
            throw error;
        }
    }

    /**
     * Get classes with role-based filtering
     */
    async getClasses(filters = {}) {
        try {
            let query = _supabase.from('classes').select('*');

            if (this.provider.role === 'system_admin') {
                // No filter
            } else if (this.provider.role === 'admin') {
                query = query.eq('school_code', this.provider.schoolCode);
            } else if (this.provider.role === 'teacher') {
                if (this.provider.classes.length === 0) {
                    return [];
                }
                query = query.in('id', this.provider.classes);
            }

            if (filters.schoolCode && this.provider.role === 'system_admin') {
                query = query.eq('school_code', filters.schoolCode);
            }

            const { data, error } = await query.order('name');
            if (error) throw error;

            return data || [];
        } catch (error) {
            this.errorCount++;
            console.error('[SecureAPIClient] Error fetching classes:', error);
            throw error;
        }
    }

    /**
     * Get subjects with role-based filtering
     */
    async getSubjects(filters = {}) {
        try {
            let query = _supabase.from('subjects').select('*');

            if (this.provider.role === 'system_admin') {
                // No filter
            } else if (this.provider.role === 'admin') {
                query = query.eq('school_code', this.provider.schoolCode);
            } else if (this.provider.role === 'teacher') {
                if (this.provider.subjects.length === 0) {
                    return [];
                }
                query = query.in('id', this.provider.subjects);
            }

            if (filters.schoolCode && this.provider.role === 'system_admin') {
                query = query.eq('school_code', filters.schoolCode);
            }

            const { data, error } = await query.order('name');
            if (error) throw error;

            return data || [];
        } catch (error) {
            this.errorCount++;
            console.error('[SecureAPIClient] Error fetching subjects:', error);
            throw error;
        }
    }

    /**
     * Get schools with role-based filtering
     */
    async getSchools(filters = {}) {
        try {
            let query = _supabase.from('schools').select('*');

            if (this.provider.role === 'system_admin') {
                // No filter - see all schools
            } else if (this.provider.role === 'admin' || this.provider.role === 'teacher') {
                // See only their school
                query = query.eq('school_code', this.provider.schoolCode);
            }

            const { data, error } = await query.order('name');
            if (error) throw error;

            return data || [];
        } catch (error) {
            this.errorCount++;
            console.error('[SecureAPIClient] Error fetching schools:', error);
            throw error;
        }
    }

    /**
     * Generate report with role-based data
     */
    async generateReport(reportType, filters = {}) {
        try {
            const reportData = {
                type: reportType,
                generatedAt: new Date().toISOString(),
                generatedBy: this.provider.user.id,
                role: this.provider.role,
                school: this.provider.schoolCode
            };

            if (reportType === 'class_performance') {
                reportData.data = await this._generateClassPerformanceReport(filters);
            } else if (reportType === 'student_performance') {
                reportData.data = await this._generateStudentPerformanceReport(filters);
            } else if (reportType === 'subject_analysis') {
                reportData.data = await this._generateSubjectAnalysisReport(filters);
            }

            // Audit log
            auditLog('GENERATE_REPORT', 'reports', reportType, true);

            return reportData;
        } catch (error) {
            this.errorCount++;
            auditLog('GENERATE_REPORT', 'reports', reportType, false, { error: error.message });
            throw error;
        }
    }

    async _generateClassPerformanceReport(filters) {
        const marks = await this.getMarks({
            classId: filters.classId,
            term: filters.term,
            academicYear: filters.academicYear,
            isApproved: true
        });

        return {
            classId: filters.classId,
            total: marks.length,
            approved: marks.filter(m => m.is_approved).length,
            pending: marks.filter(m => !m.is_approved).length,
            averageScore: marks.length > 0 ? marks.reduce((s, m) => s + m.score, 0) / marks.length : 0
        };
    }

    async _generateStudentPerformanceReport(filters) {
        const marks = await this.getMarks({
            studentId: filters.studentId,
            academicYear: filters.academicYear,
            isApproved: true
        });

        return {
            studentId: filters.studentId,
            totalMarks: marks.length,
            averageScore: marks.length > 0 ? marks.reduce((s, m) => s + m.score, 0) / marks.length : 0,
            subjects: [...new Set(marks.map(m => m.subject_id))].length
        };
    }

    async _generateSubjectAnalysisReport(filters) {
        const marks = await this.getMarks({
            subjectId: filters.subjectId,
            term: filters.term,
            academicYear: filters.academicYear,
            isApproved: true
        });

        return {
            subjectId: filters.subjectId,
            totalEntries: marks.length,
            averageScore: marks.length > 0 ? marks.reduce((s, m) => s + m.score, 0) / marks.length : 0,
            highestScore: Math.max(...marks.map(m => m.score)),
            lowestScore: Math.min(...marks.map(m => m.score))
        };
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            requests: this.requestCount,
            errors: this.errorCount,
            errorRate: this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0
        };
    }
}

// ============================================================
// AUDIT LOGGING HELPER
// ============================================================

function auditLog(action, resource, resourceId, success, details = {}) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        action,
        resource,
        resourceId,
        success,
        details,
        userRole: ACCESS_CONTROL?.userRole || 'unknown',
        school: ACCESS_CONTROL?.userSchool || 'unknown'
    };

    console.log('[AUDIT]', logEntry);
    
    // In production, send to backend for persistent logging
    // await _supabase.from('audit_logs').insert([logEntry]);
}

// ============================================================
// EXPORT FOR GLOBAL USE
// ============================================================

window.SecureAPIClient = SecureAPIClient;

console.log('[Secure API Client] Module loaded successfully');
