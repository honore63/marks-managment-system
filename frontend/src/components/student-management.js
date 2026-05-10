/**
 * STUDENT MANAGEMENT SYSTEM
 * Role-based student management with manual entry and bulk import
 * System Admin → Any school/class
 * School Admin → Any class in their school
 * Class Teacher → Their class only
 * 
 * Supports: CSV, Excel, PDF, and Word document imports
 */

'use strict';

// ============================================================
// STUDENT MANAGEMENT STATE & CONFIG
// ============================================================

const StudentManager = {
    currentUser: null,
    currentSchool: null,
    currentClass: null,
    currentRole: null,
    cache: {},
    
    /**
     * Initialize StudentManager with current user context
     */
    async init(user, role, schoolCode, classId) {
        this.currentUser = user;
        this.currentRole = role;
        this.currentSchool = schoolCode;
        this.currentClass = classId;
        console.log('[SM] Initialized:', { role, schoolCode, classId });
    },

    /**
     * Get role-based permissions
     */
    getPermissions() {
        const perms = {
            system_admin: {
                canAddStudent: true,
                canImportStudents: true,
                canEditStudent: true,
                canDeleteStudent: true,
                canSelectSchool: true,
                canSelectClass: true,
                bulkLimit: 10000
            },
            admin: {
                canAddStudent: true,
                canImportStudents: true,
                canEditStudent: true,
                canDeleteStudent: true,
                canSelectSchool: false, // Locked to their school
                canSelectClass: true,   // Can select any class in their school
                bulkLimit: 5000
            },
            teacher: {
                canAddStudent: true,
                canImportStudents: true,
                canEditStudent: false,  // Can only add, not edit
                canDeleteStudent: false,
                canSelectSchool: false,
                canSelectClass: false,  // Locked to their class
                bulkLimit: 500
            }
        };
        
        return perms[this.currentRole] || {};
    },

    /**
     * Validate student data
     */
    validateStudent(data) {
        const errors = [];
        
        // Full name is REQUIRED
        if (!data.full_name || data.full_name.trim().length === 0) {
            errors.push('Full Name is required');
        }
        
        // Validate gender if provided
        if (data.gender && !['M', 'F', 'Male', 'Female', 'MALE', 'FEMALE'].includes(data.gender)) {
            errors.push('Gender must be Male or Female');
        }
        
        // SDMS code optional but should be numeric if provided
        if (data.sdms_code && !/^\d+$/.test(data.sdms_code.toString())) {
            errors.push('SDMS Code must be numeric');
        }
        
        return { valid: errors.length === 0, errors };
    },

    /**
     * Normalize student data
     */
    normalizeStudent(data) {
        return {
            full_name: sanitizeInput((data.full_name || '').trim()),
            sdms_code: data.sdms_code ? data.sdms_code.toString().trim() : null,
            gender: data.gender ? this._normalizeGender(data.gender) : null,
            school_code: this.currentSchool,
            class_id: this.currentClass
        };
    },

    /**
     * Normalize gender field (M/F)
     */
    _normalizeGender(gender) {
        const g = gender.toUpperCase().substring(0, 1);
        return ['M', 'F'].includes(g) ? g : null;
    }
};

// ============================================================
// MANUAL STUDENT ADDITION
// ============================================================

/**
 * Open student addition modal/form
 */
function openAddStudentForm() {
    const perms = StudentManager.getPermissions();
    if (!perms.canAddStudent) {
        toast('You do not have permission to add students', 'error');
        return;
    }

    const modal = document.getElementById('add-student-modal');
    if (!modal) {
        console.error('[SM] Add student modal not found');
        return;
    }
    
    // Reset form
    document.getElementById('student-form')?.reset();
    
    // Set up role-specific UI
    setupStudentFormUI(perms);
    
    modal.style.display = 'flex';
}

/**
 * Close student addition modal
 */
function closeAddStudentForm() {
    const modal = document.getElementById('add-student-modal');
    if (modal) modal.style.display = 'none';
}

/**
 * Setup form UI based on role permissions
 */
function setupStudentFormUI(perms) {
    const schoolSelect = document.getElementById('student-school-select');
    const classSelect = document.getElementById('student-class-select');
    
    if (schoolSelect) {
        if (perms.canSelectSchool) {
            schoolSelect.parentElement.style.display = 'block';
            populateSchoolSelect();
        } else {
            schoolSelect.parentElement.style.display = 'none';
        }
    }
    
    if (classSelect) {
        if (perms.canSelectClass && !perms.canSelectSchool) {
            // Admin: can select class in their school
            classSelect.parentElement.style.display = 'block';
            populateClassSelect(StudentManager.currentSchool);
        } else if (!perms.canSelectClass) {
            // Teacher: class is locked and hidden
            classSelect.parentElement.style.display = 'none';
        }
    }
}

/**
 * Populate school dropdown for System Admin
 */
async function populateSchoolSelect() {
    const select = document.getElementById('student-school-select');
    if (!select) return;
    
    try {
        const { data: schools, error } = await _supabase
            .from('schools')
            .select('sdms_code, name')
            .order('name');
        
        if (error) throw error;
        
        select.innerHTML = '<option value="">-- Select School --</option>';
        schools.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.sdms_code;
            opt.textContent = s.name;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error('[SM] Failed to load schools:', e);
    }
}

/**
 * Populate class dropdown
 */
async function populateClassSelect(schoolCode) {
    const select = document.getElementById('student-class-select');
    if (!select) return;
    
    try {
        const { data: classes, error } = await _supabase
            .from('classes')
            .select('id, class_name')
            .eq('school_code', schoolCode)
            .order('class_name');
        
        if (error) throw error;
        
        select.innerHTML = '<option value="">-- Select Class --</option>';
        classes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.class_name;
            select.appendChild(opt);
        });
    } catch (e) {
        console.error('[SM] Failed to load classes:', e);
    }
}

/**
 * Handle school selection (Admin/System Admin)
 */
async function onSchoolSelected(schoolCode) {
    if (schoolCode) {
        StudentManager.currentSchool = schoolCode;
        await populateClassSelect(schoolCode);
    }
}

/**
 * Submit single student form
 */
async function submitAddStudent(event) {
    event.preventDefault();
    
    const perms = StudentManager.getPermissions();
    if (!perms.canAddStudent) {
        toast('Permission denied', 'error');
        return;
    }
    
    try {
        // Get form data
        const fullName = document.getElementById('student-full-name')?.value;
        const sdmsCode = document.getElementById('student-sdms-code')?.value;
        const gender = document.getElementById('student-gender')?.value;
        const classId = document.getElementById('student-class-select')?.value || StudentManager.currentClass;
        
        // Validate
        const validation = StudentManager.validateStudent({
            full_name: fullName,
            sdms_code: sdmsCode,
            gender: gender
        });
        
        if (!validation.valid) {
            toast(validation.errors.join('; '), 'error');
            return;
        }
        
        // Normalize
        const studentData = StudentManager.normalizeStudent({
            full_name: fullName,
            sdms_code: sdmsCode,
            gender: gender
        });
        studentData.class_id = classId;
        
        // Check for duplicate SDMS code if provided
        if (studentData.sdms_code) {
            const { data: existing } = await _supabase
                .from('students')
                .select('id')
                .eq('sdms_code', studentData.sdms_code)
                .eq('school_code', studentData.school_code)
                .maybeSingle();
            
            if (existing) {
                toast(`Student with SDMS code ${studentData.sdms_code} already exists`, 'error');
                return;
            }
        }
        
        // Insert student
        const { data, error } = await _supabase
            .from('students')
            .insert([studentData])
            .select();
        
        if (error) throw error;
        
        toast(`Student "${fullName}" added successfully`, 'success');
        
        // Reset and close
        document.getElementById('student-form')?.reset();
        closeAddStudentForm();
        
        // Trigger real-time refresh
        await triggerStudentListRefresh(studentData.school_code, studentData.class_id);
        
    } catch (e) {
        console.error('[SM] Add student failed:', e);
        toast('Failed to add student: ' + e.message, 'error');
    }
}

// ============================================================
// BULK IMPORT (CSV/EXCEL)
// ============================================================

/**
 * Open bulk import modal
 */
function openBulkImportForm() {
    const perms = StudentManager.getPermissions();
    if (!perms.canImportStudents) {
        toast('You do not have permission to import students', 'error');
        return;
    }
    
    const modal = document.getElementById('bulk-import-modal');
    if (modal) modal.style.display = 'flex';
}

/**
 * Close bulk import modal
 */
function closeBulkImportForm() {
    const modal = document.getElementById('bulk-import-modal');
    if (modal) modal.style.display = 'none';
}

/**
 * Handle CSV/Excel/PDF/Word file upload
 */
async function handleImportFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const perms = StudentManager.getPermissions();
    
    try {
        let data;
        const fileName = file.name.toLowerCase();
        
        // Detect file type and parse accordingly
        if (fileName.endsWith('.pdf')) {
            data = await parsePDFFile(file);
        } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
            data = await parseWordFile(file);
        } else if (fileName.endsWith('.csv') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            data = await parseCSVFile(file);
        } else {
            throw new Error('Unsupported file format. Use CSV, Excel, PDF, or Word documents.');
        }
        
        if (!data || data.length === 0) {
            toast('No valid data found in file', 'error');
            return;
        }
        
        if (data.length > perms.bulkLimit) {
            toast(`Import limit exceeded. Max: ${perms.bulkLimit}, Provided: ${data.length}`, 'error');
            return;
        }
        
        // Show preview
        showImportPreview(data);
        
    } catch (e) {
        console.error('[SM] File parse failed:', e);
        toast('Failed to parse file: ' + e.message, 'error');
    }
}

/**
 * Parse CSV file
 */
async function parseCSVFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const rows = text.split('\n').filter(r => r.trim());
                
                if (rows.length < 2) {
                    reject(new Error('CSV must have header row and at least one data row'));
                    return;
                }
                
                // Parse header
                const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
                const nameIdx = headers.findIndex(h => h.includes('name'));
                const numberIdx = headers.findIndex(h => h.includes('number'));
                const genderIdx = headers.findIndex(h => h.includes('gender'));
                
                if (nameIdx === -1) {
                    reject(new Error('CSV must have student_name column'));
                    return;
                }
                
                // Parse data rows
                const students = [];
                for (let i = 1; i < rows.length; i++) {
                    if (!rows[i].trim()) continue;
                    
                    const cols = rows[i].split(',').map(c => c.trim());
                    students.push({
                        full_name: cols[nameIdx] || '',
                        sdms_code: numberIdx >= 0 ? cols[numberIdx] : '',
                        gender: genderIdx >= 0 ? cols[genderIdx] : ''
                    });
                }
                
                resolve(students);
            } catch (err) {
                reject(err);
            }
        };
        
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

/**
 * Parse PDF file and extract student data from tables
 * Looks for tables with name, number, and gender columns
 */
async function parsePDFFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target.result;
                
                // Check if PDF.js is loaded; if not, use fallback
                if (typeof pdfjsLib === 'undefined') {
                    // Fallback: try to extract text and parse as raw text
                    const text = await extractPDFTextFallback(arrayBuffer);
                    const students = parseStudentTextTable(text);
                    resolve(students);
                    return;
                }
                
                // Use PDF.js library to parse PDF
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const students = [];
                
                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const textContent = await page.getTextContent();
                    const text = textContent.items
                        .filter(item => item.str && item.str.trim())
                        .map(item => item.str.trim())
                        .join(' ');
                    
                    // Extract potential student records from text
                    const lines = text.split(/[\n\r]+/);
                    for (let line of lines) {
                        const parts = line.split(/[\t,]+/).map(p => p.trim()).filter(p => p);
                        
                        if (parts.length >= 1) {
                            const fullName = parts[0];
                            const sdmsCode = parts.length > 1 ? parts[1] : '';
                            const gender = parts.length > 2 ? parts[2] : '';
                            
                            if (fullName.length > 2 && (fullName.match(/[a-zA-Z]/g) || []).length > 0) {
                                students.push({
                                    full_name: fullName,
                                    sdms_code: sdmsCode,
                                    gender: gender
                                });
                            }
                        }
                    }
                }
                
                const uniqueStudents = Array.from(new Map(
                    students.map(s => [s.full_name.toLowerCase(), s])
                ).values());
                
                resolve(uniqueStudents);
            } catch (err) {
                reject(new Error('Failed to parse PDF: ' + err.message));
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read PDF file'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Fallback PDF text extraction for when PDF.js is not available
 */
async function extractPDFTextFallback(arrayBuffer) {
    try {
        const text = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
        return text;
    } catch (e) {
        throw new Error('Could not extract text from PDF');
    }
}

/**
 * Parse Word document (.docx or .doc) and extract student data
 */
async function parseWordFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target.result;
                const fileName = file.name.toLowerCase();
                
                if (fileName.endsWith('.docx')) {
                    if (typeof mammoth === 'undefined') {
                        throw new Error('Word document parser not loaded. Please ensure mammoth.js is included.');
                    }
                    
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    const students = parseStudentTextTable(result.value);
                    resolve(students);
                } else if (fileName.endsWith('.doc')) {
                    const text = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
                    const students = parseStudentTextTable(text);
                    resolve(students);
                }
            } catch (err) {
                reject(new Error('Failed to parse Word document: ' + err.message));
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read Word file'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Helper: Parse student data from plain text table format
 */
function parseStudentTextTable(text) {
    const students = [];
    const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(l => l);
    
    for (let line of lines) {
        if (line.toLowerCase().includes('name') || 
            line.toLowerCase().includes('student') ||
            line.length < 3) {
            continue;
        }
        
        const parts = line.split(/[\t|,;]+/).map(p => p.trim()).filter(p => p);
        
        if (parts.length >= 1) {
            const fullName = parts[0];
            const sdmsCode = parts.length > 1 ? parts[1] : '';
            const gender = parts.length > 2 ? parts[2] : '';
            
            if (fullName.length > 2 && fullName.match(/[a-zA-Z]/)) {
                students.push({
                    full_name: fullName,
                    sdms_code: sdmsCode,
                    gender: gender
                });
            }
        }
    }
    
    return students;
}

/**
 * Show import preview before confirming
 */
function showImportPreview(students) {
    const previewContainer = document.getElementById('import-preview');
    if (!previewContainer) return;
    
    // Validate all students first
    const results = students.map(s => {
        const validation = StudentManager.validateStudent(s);
        return { student: s, ...validation };
    });
    
    const valid = results.filter(r => r.valid);
    const invalid = results.filter(r => !r.valid);
    
    let html = `
        <div style="margin-bottom: 1.5rem;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div style="padding: 1rem; background: #d1fae5; border-radius: 8px;">
                    <div style="font-weight: 800; color: #065f46; font-size: 1.5rem;">${valid.length}</div>
                    <div style="font-size: 0.75rem; color: #047857;">VALID RECORDS</div>
                </div>
                <div style="padding: 1rem; background: ${invalid.length > 0 ? '#fee2e2' : '#f0fdf4'}; border-radius: 8px;">
                    <div style="font-weight: 800; color: ${invalid.length > 0 ? '#7f1d1d' : '#065f46'}; font-size: 1.5rem;">${invalid.length}</div>
                    <div style="font-size: 0.75rem; color: ${invalid.length > 0 ? '#dc2626' : '#047857'};">INVALID RECORDS</div>
                </div>
            </div>
    `;
    
    if (valid.length > 0) {
        html += '<div style="margin: 1rem 0;"><strong>First 5 Valid Preview:</strong></div>';
        html += '<table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">';
        html += '<tr style="background: #f3f4f6;"><th style="padding: 0.5rem; border: 1px solid #e5e7eb;">Name</th><th style="padding: 0.5rem; border: 1px solid #e5e7eb;">SDMS Code</th><th style="padding: 0.5rem; border: 1px solid #e5e7eb;">Gender</th></tr>';
        
        valid.slice(0, 5).forEach(r => {
            html += `<tr style="border: 1px solid #e5e7eb;">
                <td style="padding: 0.5rem;">${r.student.full_name}</td>
                <td style="padding: 0.5rem;">${r.student.sdms_code || '-'}</td>
                <td style="padding: 0.5rem;">${r.student.gender || '-'}</td>
            </tr>`;
        });
        
        html += '</table>';
    }
    
    if (invalid.length > 0) {
        html += '<div style="margin: 1.5rem 0 0.5rem; color: #dc2626;"><strong>⚠️ Invalid Records (sample):</strong></div>';
        invalid.slice(0, 3).forEach(r => {
            html += `<div style="padding: 0.5rem; background: #fef2f2; border-left: 3px solid #dc2626; margin-bottom: 0.5rem;">
                <strong>${r.student.full_name || '(no name)'}</strong>: ${r.errors.join(', ')}
            </div>`;
        });
    }
    
    html += '</div>';
    previewContainer.innerHTML = html;
    
    // Store for submission
    previewContainer.dataset.validStudents = JSON.stringify(valid.map(r => r.student));
}

/**
 * Confirm and process bulk import
 */
async function confirmBulkImport() {
    const previewContainer = document.getElementById('import-preview');
    const studentsJson = previewContainer?.dataset.validStudents;
    
    if (!studentsJson) {
        toast('No valid students to import', 'error');
        return;
    }
    
    const students = JSON.parse(studentsJson);
    const perms = StudentManager.getPermissions();
    
    try {
        // Show progress
        const progressBar = document.getElementById('import-progress');
        if (progressBar) progressBar.style.display = 'block';
        
        const results = {
            success: 0,
            failed: 0,
            duplicates: 0,
            errors: []
        };
        
        // Get existing SDMS codes to prevent duplicates
        const { data: existing } = await _supabase
            .from('students')
            .select('sdms_code')
            .eq('school_code', StudentManager.currentSchool);
        
        const existingSdms = new Set(existing?.map(e => e.sdms_code) || []);
        
        // Insert students in batches
        const batchSize = 100;
        for (let i = 0; i < students.length; i += batchSize) {
            const batch = students.slice(i, i + batchSize);
            
            // Filter duplicates
            const toInsert = batch.filter(s => {
                if (s.sdms_code && existingSdms.has(s.sdms_code)) {
                    results.duplicates++;
                    return false;
                }
                return true;
            }).map(s => StudentManager.normalizeStudent(s));
            
            if (toInsert.length > 0) {
                const { error } = await _supabase
                    .from('students')
                    .insert(toInsert);
                
                if (error) {
                    results.failed += toInsert.length;
                    results.errors.push(error.message);
                } else {
                    results.success += toInsert.length;
                }
            }
            
            // Update progress
            if (progressBar) {
                const progress = Math.min(100, Math.round((i + batchSize) / students.length * 100));
                progressBar.style.width = progress + '%';
            }
        }
        
        // Show results
        const msg = `Import complete: ${results.success} added, ${results.duplicates} duplicates skipped, ${results.failed} failed`;
        
        if (results.failed > 0) {
            console.error('[SM] Import errors:', results.errors);
            toast(msg, 'warning');
        } else {
            toast(msg, 'success');
        }
        
        // Cleanup
        setTimeout(() => {
            document.getElementById('import-file')?.value = '';
            document.getElementById('import-preview').innerHTML = '';
            if (progressBar) progressBar.style.display = 'none';
            
            closeBulkImportForm();
            await triggerStudentListRefresh(StudentManager.currentSchool, StudentManager.currentClass);
        }, 1500);
        
    } catch (e) {
        console.error('[SM] Bulk import failed:', e);
        toast('Import failed: ' + e.message, 'error');
    }
}

// ============================================================
// REAL-TIME SYNC
// ============================================================

/**
 * Trigger student list refresh across portals
 */
async function triggerStudentListRefresh(schoolCode, classId) {
    try {
        // Emit update event for real-time listeners
        const event = new CustomEvent('students-updated', {
            detail: { schoolCode, classId }
        });
        document.dispatchEvent(event);
        
        // Optionally notify via Supabase broadcast
        if (typeof _supabase !== 'undefined') {
            await _supabase.channel('student-updates').send('broadcast', {
                event: 'students_updated',
                payload: { schoolCode, classId, timestamp: new Date().toISOString() }
            });
        }
    } catch (e) {
        console.warn('[SM] Failed to trigger refresh:', e);
    }
}

/**
 * Listen for student updates
 */
function listenForStudentUpdates(callback) {
    if (typeof _supabase === 'undefined') return;
    
    _supabase.channel('student-updates')
        .on('broadcast', { event: 'students_updated' }, (payload) => {
            console.log('[SM] Student update received:', payload);
            if (callback) callback(payload.payload);
        })
        .subscribe();
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get student list for current context
 */
async function getStudentList(schoolCode, classId) {
    try {
        let query = _supabase.from('students').select('*').eq('school_code', schoolCode);
        
        if (classId) {
            query = query.eq('class_id', classId);
        }
        
        const { data, error } = await query.order('full_name');
        
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('[SM] Failed to fetch students:', e);
        return [];
    }
}

/**
 * Delete student (Admin/System Admin only)
 */
async function deleteStudent(studentId) {
    const perms = StudentManager.getPermissions();
    if (!perms.canDeleteStudent) {
        toast('Permission denied', 'error');
        return false;
    }
    
    if (!confirm('Are you sure you want to delete this student?')) return false;
    
    try {
        const { error } = await _supabase
            .from('students')
            .delete()
            .eq('id', studentId);
        
        if (error) throw error;
        
        toast('Student deleted successfully', 'success');
        await triggerStudentListRefresh(StudentManager.currentSchool);
        return true;
    } catch (e) {
        console.error('[SM] Delete failed:', e);
        toast('Failed to delete student: ' + e.message, 'error');
        return false;
    }
}

// Export for global access
window.StudentManager = StudentManager;
window.openAddStudentForm = openAddStudentForm;
window.closeAddStudentForm = closeAddStudentForm;
window.submitAddStudent = submitAddStudent;
window.openBulkImportForm = openBulkImportForm;
window.closeBulkImportForm = closeBulkImportForm;
window.handleImportFileUpload = handleImportFileUpload;
window.confirmBulkImport = confirmBulkImport;
window.deleteStudent = deleteStudent;
window.getStudentList = getStudentList;
window.listenForStudentUpdates = listenForStudentUpdates;
