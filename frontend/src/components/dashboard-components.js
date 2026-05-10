/**
 * ============================================================
 * ROLE-BASED DASHBOARD COMPONENTS
 * Pre-built HTML/CSS/JS components for filtering dashboards
 * Version: 1.0
 * ============================================================
 */

'use strict';

// ============================================================
// SYSTEM ADMIN DASHBOARD FILTERS
// ============================================================

const SystemAdminDashboard = {
    /**
     * Render school selector for system admin
     */
    renderSchoolSelector(containerId, schools, onSelect) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const select = document.createElement('select');
        select.className = 'form-control';
        select.innerHTML = '<option value="">-- All Schools --</option>';

        schools.forEach(school => {
            const option = document.createElement('option');
            option.value = school.school_code;
            option.textContent = `${school.name} (${school.school_code})`;
            select.appendChild(option);
        });

        select.addEventListener('change', (e) => {
            onSelect(e.target.value);
        });

        container.appendChild(select);
    },

    /**
     * Render admin list for system admin
     */
    async renderAdminManagement(containerId, provider) {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            const { data: admins, error } = await _supabase
                .from('profiles')
                .select('*')
                .eq('role', 'admin')
                .order('school_code, full_name');

            if (error) throw error;

            let html = `
                <div class="admin-management">
                    <h3>School Administrators</h3>
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>School</th>
                                <th>Email</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            admins.forEach(admin => {
                html += `
                    <tr>
                        <td>${admin.full_name}</td>
                        <td>${admin.school_code}</td>
                        <td>${admin.email}</td>
                        <td>
                            <span class="badge ${admin.is_active ? 'bg-success' : 'bg-danger'}">
                                ${admin.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-sm btn-primary" onclick="editAdmin('${admin.id}')">Edit</button>
                            <button class="btn btn-sm btn-danger" onclick="deactivateAdmin('${admin.id}')">Deactivate</button>
                        </td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;

            container.innerHTML = html;
        } catch (error) {
            console.error('[SystemAdminDashboard] Error rendering admin management:', error);
            container.innerHTML = '<div class="alert alert-danger">Error loading administrators</div>';
        }
    },

    /**
     * Render global statistics
     */
    async renderGlobalStats(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            const schoolsCount = await this._getSchoolsCount();
            const adminsCount = await this._getAdminsCount();
            const teachersCount = await this._getTeachersCount();
            const studentsCount = await this._getStudentsCount();
            const marksCount = await this._getMarksCount();

            const html = `
                <div class="stats-grid">
                    <div class="stat-card">
                        <h4>Schools</h4>
                        <p class="stat-value">${schoolsCount}</p>
                    </div>
                    <div class="stat-card">
                        <h4>Admins</h4>
                        <p class="stat-value">${adminsCount}</p>
                    </div>
                    <div class="stat-card">
                        <h4>Teachers</h4>
                        <p class="stat-value">${teachersCount}</p>
                    </div>
                    <div class="stat-card">
                        <h4>Students</h4>
                        <p class="stat-value">${studentsCount}</p>
                    </div>
                    <div class="stat-card">
                        <h4>Mark Entries</h4>
                        <p class="stat-value">${marksCount}</p>
                    </div>
                </div>
            `;

            container.innerHTML = html;
        } catch (error) {
            console.error('[SystemAdminDashboard] Error rendering stats:', error);
        }
    },

    async _getSchoolsCount() {
        const { count } = await _supabase.from('schools').select('*', { count: 'exact', head: true });
        return count || 0;
    },

    async _getAdminsCount() {
        const { count } = await _supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'admin');
        return count || 0;
    },

    async _getTeachersCount() {
        const { count } = await _supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('role', 'teacher');
        return count || 0;
    },

    async _getStudentsCount() {
        const { count } = await _supabase
            .from('students')
            .select('*', { count: 'exact', head: true });
        return count || 0;
    },

    async _getMarksCount() {
        const { count } = await _supabase
            .from('marks')
            .select('*', { count: 'exact', head: true });
        return count || 0;
    }
};

// ============================================================
// SCHOOL ADMIN DASHBOARD FILTERS
// ============================================================

const SchoolAdminDashboard = {
    /**
     * Render school stats for admin
     */
    async renderSchoolStats(containerId, schoolCode) {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            const teachersCount = await this._getTeachersCount(schoolCode);
            const studentsCount = await this._getStudentsCount(schoolCode);
            const classesCount = await this._getClassesCount(schoolCode);
            const subjectsCount = await this._getSubjectsCount(schoolCode);
            const pendingMarks = await this._getPendingMarksCount(schoolCode);

            const html = `
                <div class="stats-grid">
                    <div class="stat-card">
                        <h4>Classes</h4>
                        <p class="stat-value">${classesCount}</p>
                    </div>
                    <div class="stat-card">
                        <h4>Teachers</h4>
                        <p class="stat-value">${teachersCount}</p>
                    </div>
                    <div class="stat-card">
                        <h4>Students</h4>
                        <p class="stat-value">${studentsCount}</p>
                    </div>
                    <div class="stat-card">
                        <h4>Subjects</h4>
                        <p class="stat-value">${subjectsCount}</p>
                    </div>
                    <div class="stat-card bg-warning">
                        <h4>Pending Marks</h4>
                        <p class="stat-value">${pendingMarks}</p>
                    </div>
                </div>
            `;

            container.innerHTML = html;
        } catch (error) {
            console.error('[SchoolAdminDashboard] Error rendering stats:', error);
        }
    },

    /**
     * Render class filter dropdown
     */
    renderClassFilter(containerId, schoolCode, classes, onSelect) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const select = document.createElement('select');
        select.className = 'form-control';
        select.innerHTML = '<option value="">-- All Classes --</option>';

        classes.forEach(cls => {
            const option = document.createElement('option');
            option.value = cls.id;
            option.textContent = cls.name;
            select.appendChild(option);
        });

        select.addEventListener('change', (e) => {
            onSelect(e.target.value);
        });

        container.appendChild(select);
    },

    /**
     * Render pending marks for approval
     */
    async renderPendingMarks(containerId, schoolCode) {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            const { data: marks, error } = await _supabase
                .from('marks')
                .select(`
                    *,
                    students(full_name),
                    subjects(name),
                    classes(name)
                `)
                .eq('school_code', schoolCode)
                .eq('is_submitted', true)
                .eq('is_approved', false)
                .order('created_at', { ascending: true });

            if (error) throw error;

            if (marks.length === 0) {
                container.innerHTML = '<div class="alert alert-info">No pending marks for approval</div>';
                return;
            }

            let html = `
                <div class="pending-marks">
                    <h3>Marks Pending Approval (${marks.length})</h3>
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Student</th>
                                <th>Class</th>
                                <th>Subject</th>
                                <th>Score</th>
                                <th>Submitted</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            marks.forEach(mark => {
                const submittedDate = new Date(mark.created_at).toLocaleDateString();
                html += `
                    <tr>
                        <td>${mark.students?.full_name || 'Unknown'}</td>
                        <td>${mark.classes?.name || 'Unknown'}</td>
                        <td>${mark.subjects?.name || 'Unknown'}</td>
                        <td>${mark.score}/${mark.max_score}</td>
                        <td>${submittedDate}</td>
                        <td>
                            <button class="btn btn-sm btn-success" onclick="approveMark('${mark.id}')">Approve</button>
                            <button class="btn btn-sm btn-danger" onclick="rejectMark('${mark.id}')">Reject</button>
                        </td>
                    </tr>
                `;
            });

            html += '</tbody></table></div>';
            container.innerHTML = html;
        } catch (error) {
            console.error('[SchoolAdminDashboard] Error rendering pending marks:', error);
            container.innerHTML = '<div class="alert alert-danger">Error loading pending marks</div>';
        }
    },

    async _getTeachersCount(schoolCode) {
        const { count } = await _supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('school_code', schoolCode)
            .eq('role', 'teacher');
        return count || 0;
    },

    async _getStudentsCount(schoolCode) {
        const { count } = await _supabase
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('school_code', schoolCode);
        return count || 0;
    },

    async _getClassesCount(schoolCode) {
        const { count } = await _supabase
            .from('classes')
            .select('*', { count: 'exact', head: true })
            .eq('school_code', schoolCode);
        return count || 0;
    },

    async _getSubjectsCount(schoolCode) {
        const { count } = await _supabase
            .from('subjects')
            .select('*', { count: 'exact', head: true })
            .eq('school_code', schoolCode);
        return count || 0;
    },

    async _getPendingMarksCount(schoolCode) {
        const { count } = await _supabase
            .from('marks')
            .select('*', { count: 'exact', head: true })
            .eq('school_code', schoolCode)
            .eq('is_submitted', true)
            .eq('is_approved', false);
        return count || 0;
    }
};

// ============================================================
// TEACHER DASHBOARD FILTERS
// ============================================================

const TeacherDashboard = {
    /**
     * Render teacher's class selector
     */
    renderClassSelector(containerId, classes, onSelect) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const select = document.createElement('select');
        select.className = 'form-control';
        select.innerHTML = '';

        classes.forEach(cls => {
            const option = document.createElement('option');
            option.value = cls.id;
            option.textContent = cls.name;
            select.appendChild(option);
        });

        select.addEventListener('change', (e) => {
            onSelect(e.target.value);
        });

        container.appendChild(select);

        // Auto-select first class if only one
        if (classes.length === 1) {
            select.value = classes[0].id;
            onSelect(classes[0].id);
        }
    },

    /**
     * Render teacher's subject selector
     */
    renderSubjectSelector(containerId, subjects, onSelect) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const select = document.createElement('select');
        select.className = 'form-control';
        select.innerHTML = '';

        subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject.id;
            option.textContent = subject.name;
            select.appendChild(option);
        });

        select.addEventListener('change', (e) => {
            onSelect(e.target.value);
        });

        container.appendChild(select);

        // Auto-select first subject if only one
        if (subjects.length === 1) {
            select.value = subjects[0].id;
            onSelect(subjects[0].id);
        }
    },

    /**
     * Render teacher's mark submission stats
     */
    async renderMarkStats(containerId, teacherClasses, teacherSubjects) {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            const submittedCount = await this._getSubmittedMarksCount(teacherClasses, teacherSubjects);
            const pendingCount = await this._getPendingMarksCount(teacherClasses, teacherSubjects);
            const approvedCount = await this._getApprovedMarksCount(teacherClasses, teacherSubjects);

            const html = `
                <div class="stats-grid">
                    <div class="stat-card">
                        <h4>Submitted</h4>
                        <p class="stat-value">${submittedCount}</p>
                    </div>
                    <div class="stat-card bg-warning">
                        <h4>Pending Marks</h4>
                        <p class="stat-value">${pendingCount}</p>
                    </div>
                    <div class="stat-card bg-success">
                        <h4>Approved</h4>
                        <p class="stat-value">${approvedCount}</p>
                    </div>
                </div>
            `;

            container.innerHTML = html;
        } catch (error) {
            console.error('[TeacherDashboard] Error rendering stats:', error);
        }
    },

    /**
     * Render teacher's mark entry form with role-based restrictions
     */
    renderMarkEntryForm(containerId, classId, subjectId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const html = `
            <form id="mark-entry-form" class="form-inline">
                <div class="form-group">
                    <label>Student</label>
                    <select id="student-select" class="form-control" required></select>
                </div>
                <div class="form-group">
                    <label>Score</label>
                    <input type="number" id="score-input" class="form-control" min="0" max="100" required>
                </div>
                <button type="submit" class="btn btn-primary">Submit Mark</button>
            </form>
        `;

        container.innerHTML = html;

        // Load students for selected class
        if (classId) {
            this._loadClassStudents(classId, '#student-select');
        }

        // Handle form submission
        document.getElementById('mark-entry-form').addEventListener('submit', (e) => {
            e.preventDefault();
            // Emit custom event for parent component to handle
            const event = new CustomEvent('markSubmitted', {
                detail: {
                    studentId: document.getElementById('student-select').value,
                    score: parseFloat(document.getElementById('score-input').value),
                    classId,
                    subjectId
                }
            });
            container.dispatchEvent(event);
        });
    },

    async _loadClassStudents(classId, selectSelector) {
        try {
            const { data: students, error } = await _supabase
                .from('students')
                .select('id, full_name')
                .eq('class_id', classId)
                .order('full_name');

            if (error) throw error;

            const select = document.querySelector(selectSelector);
            if (!select) return;

            select.innerHTML = '<option value="">-- Select Student --</option>';
            students.forEach(student => {
                const option = document.createElement('option');
                option.value = student.id;
                option.textContent = student.full_name;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('[TeacherDashboard] Error loading students:', error);
        }
    },

    async _getSubmittedMarksCount(classIds, subjectIds) {
        const { count } = await _supabase
            .from('marks')
            .select('*', { count: 'exact', head: true })
            .in('class_id', classIds)
            .in('subject_id', subjectIds)
            .eq('is_submitted', true);
        return count || 0;
    },

    async _getPendingMarksCount(classIds, subjectIds) {
        const { count } = await _supabase
            .from('marks')
            .select('*', { count: 'exact', head: true })
            .in('class_id', classIds)
            .in('subject_id', subjectIds)
            .eq('is_submitted', false);
        return count || 0;
    },

    async _getApprovedMarksCount(classIds, subjectIds) {
        const { count } = await _supabase
            .from('marks')
            .select('*', { count: 'exact', head: true })
            .in('class_id', classIds)
            .in('subject_id', subjectIds)
            .eq('is_submitted', true)
            .eq('is_approved', true);
        return count || 0;
    }
};

// ============================================================
// EXPORT FOR GLOBAL USE
// ============================================================

window.SystemAdminDashboard = SystemAdminDashboard;
window.SchoolAdminDashboard = SchoolAdminDashboard;
window.TeacherDashboard = TeacherDashboard;

console.log('[Dashboard Components] Module loaded successfully');
