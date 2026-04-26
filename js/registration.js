/**
 * STUDENT & TEACHER REGISTRATION SYSTEM
 * Handles:
 * - Individual student registration
 * - Individual teacher registration
 * - Bulk student import (CSV)
 * - Validation
 * - Error handling
 */

// ============================================================
// STUDENT REGISTRATION SYSTEM
// ============================================================

/**
 * Register a single student
 * @param {string} firstName - Student first name
 * @param {string} lastName - Student last name
 * @param {string} sdms - Student SDMS code (Mandatory)
 * @param {string} classId - Class ID (Mandatory)
 * @param {string} gender - Gender (M/F) (Mandatory)
 * @returns {Object} { success, student, error }
 */
async function registerStudentIndividual(firstName, lastName, sdms, classId, gender) {
  try {
    // 1. Mandatory Policy Validation
    if (!firstName || !firstName.trim()) throw new Error('Student First Name is required');
    if (!lastName || !lastName.trim()) throw new Error('Student Last Name is required');
    if (!sdms || !sdms.trim()) throw new Error('Student SDMS Code is required');
    if (!classId) throw new Error('Academic Class Assignment is required');
    if (!gender) throw new Error('Gender selection is required');

    const schoolCode = await getCurrentSchoolCode();
    
    // 2. Synthetic Credentials for Immediate Student Access
    // Login Identifier: std[SDMS]@mms.student | Password: Student@[SDMS]
    const studentUserEmail = `std${sdms.trim()}@mms.student.rw`;
    const studentPassword = `Student@${sdms.trim()}`;

    console.log('[STUDENT] Provisioning Auth & Registry record...');

    // 3. Auth Provisioning
    const { data: authData, error: authError } = await _supabase.auth.signUp({
        email: studentUserEmail,
        password: studentPassword,
        options: { data: { full_name: `${firstName.trim()} ${lastName.trim()}`, role: 'student' } }
    });

    if (authError) {
        if (authError.message.includes('already registered')) {
            throw new Error(`Student with SDMS ${sdms} is already registered in the authentication system.`);
        }
        throw new Error(`Auth Layer Error: ${authError.message}`);
    }

    const studentObj = {
      id: authData.user.id,
      first_name: firstName.trim().toUpperCase(),
      last_name: lastName.trim().toUpperCase(),
      full_name: `${firstName.trim()} ${lastName.trim()}`.toUpperCase(),
      sid: sdms.trim().toUpperCase(),
      gender: gender.toUpperCase(),
      class_id: classId,
      school_code: schoolCode,
      is_active: true,
      enrollment_date: new Date().toISOString()
    };

    // 4. Academic Record Creation
    const { data, error } = await _supabase.from('students').insert([studentObj]).select();
    
    if (error) {
      // Cleanup auth if profile fails (Best effort in frontend)
      console.error('[STUDENT] Record creation failed:', error);
      throw error;
    }

    // 5. Create Profile Record (for role-based login access)
    await _supabase.from('profiles').insert([{
        id: authData.user.id,
        email: studentUserEmail,
        full_name: studentObj.full_name,
        role: 'student',
        school_code: schoolCode,
        sdms_code: sdms.trim(),
        created_at: new Date().toISOString()
    }]);

    console.log('[STUDENT] Registered & Activated:', data);
    return { 
        success: true, 
        student: data?.[0] || data, 
        credentials: { email: studentUserEmail, password: studentPassword } 
    };

  } catch (error) {
    console.error('[STUDENT] Registration Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Validate student data before bulk import
 * @param {Array} students - Array of student objects
 * @returns {Object} { valid, errors, validatedStudents, summary }
 */
function validateStudentBatch(students) {
  const errors = [];
  const validatedStudents = [];
  const invalidRecords = [];
  const report = [];

  if (!Array.isArray(students) || students.length === 0) {
    return { valid: false, errors: ['No students provided'], validatedStudents: [] };
  }

  students.forEach((student, index) => {
    const rowErrors = [];
    const studentName = (student.first_name || '') + ' ' + (student.last_name || '');

    // Required fields check (Mandatory per policy)
    if (!student.first_name || !student.first_name.trim()) rowErrors.push('Missing First Name');
    if (!student.last_name || !student.last_name.trim()) rowErrors.push('Missing Last Name');
    if (!student.sid || !student.sid.trim()) rowErrors.push('Missing SDMS Code');
    if (!student.class_id) rowErrors.push('Missing Class Assignment');
    if (!student.gender) rowErrors.push('Missing Gender');

    // Valid gender
    if (student.gender && !['M', 'F', 'O'].includes(student.gender.toUpperCase())) {
      rowErrors.push(`Invalid Gender: ${student.gender}`);
    }

    if (rowErrors.length === 0) {
      const validated = {
        first_name: student.first_name.trim().toUpperCase(),
        last_name: student.last_name.trim().toUpperCase(),
        full_name: `${student.first_name.trim()} ${student.last_name.trim()}`.toUpperCase(),
        sid: student.sid.trim().toUpperCase(),
        gender: student.gender.toUpperCase(),
        class_id: student.class_id,
        is_active: true,
        enrollment_date: new Date().toISOString()
      };
      validatedStudents.push(validated);
      report.push({ index: index + 1, name: validated.full_name, status: 'valid', errors: [] });
    } else {
      errors.push(`Row ${index + 1} (${studentName.trim() || 'No Name'}): ${rowErrors.join(', ')}`);
      invalidRecords.push({ ...student, row: index + 1, errors: rowErrors });
      report.push({ index: index + 1, name: studentName.trim() || 'Unknown', status: 'invalid', errors: rowErrors });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    validatedStudents,
    invalidRecords,
    report,
    totalProcessed: students.length,
    totalValid: validatedStudents.length,
    totalErrors: invalidRecords.length
  };
}

/**
 * Parse CSV/Bulk data into student objects
 * Intelligent parsing: handles commas, tabs, semicolons. Skips headers.
 * Expected format: firstName, lastName, SDMS, Gender 
 * @param {string} csvData - Data from textarea or file
 * @param {string} classId - Target class ID
 * @returns {Array} Array of student objects
 */
function parseStudentCSV(csvData, classId) {
  const lines = csvData.split(/\r?\n/).filter(l => l.trim().length > 0);
  const students = [];

  // Common headers to ignore
  const headers = ['first name', 'last name', 'sdms', 'gender', 'code', 'sid', 'fullname'];

  lines.forEach((line, index) => {
    // Detect separator (comma, tab, or semicolon)
    let separator = ',';
    if (line.includes('\t')) separator = '\t';
    else if (line.includes(';')) separator = ';';

    const parts = line.split(separator).map(p => p.trim());

    // Skip empty or comment lines
    if (parts.length === 0 || parts[0].startsWith('#')) return;

    // Check if it's a header line
    const isHeader = parts.some(p => headers.includes(p.toLowerCase()));
    if (isHeader) return;

    let firstName, lastName, sdms, gender;

    // Intelligent mapping based on part count
    if (parts.length === 2) {
      [firstName, lastName] = parts;
    } else if (parts.length === 3) {
      [firstName, lastName, sdms] = parts;
      // If 3rd field looks like gender, swap
      if (['M', 'F', 'O'].includes(sdms.toUpperCase())) {
        gender = sdms;
        sdms = null;
      }
    } else if (parts.length >= 4) {
      [firstName, lastName, sdms, gender] = parts;
    }

    if (firstName || lastName) {
      students.push({
        first_name: firstName || '',
        last_name: lastName || '',
        sid: sdms || '',
        gender: gender || '',
        class_id: classId
      });
    }
  });

  return students;
}

/**
 * Bulk import students from CSV or parsed data
 * @param {Array} students - Array of student objects
 * @param {string} classId - Target class ID
 * @returns {Promise} { success, imported, failed, errors }
 */
async function bulkImportStudents(students, classId) {
  try {
    if (!students || students.length === 0) {
      throw new Error('No students to import');
    }

    // Validate batch
    const validation = validateStudentBatch(students.map(s => ({ ...s, class_id: classId })));

    if (!validation.valid) {
      console.warn('[IMPORT] Validation errors:', validation.errors);
      return {
        success: false,
        imported: 0,
        failed: validation.totalProcessed,
        errors: validation.errors,
        totalProcessed: validation.totalProcessed
      };
    }

    console.log(`[IMPORT] Importing ${validation.validatedStudents.length} validated students...`);

    // Bulk insert
    const { data, error } = await DB.addStudentsBatch(validation.validatedStudents);

    if (error) {
      console.error('[IMPORT] Database error:', error);
      return {
        success: false,
        imported: 0,
        failed: validation.validatedStudents.length,
        errors: [error.message],
        totalProcessed: validation.validatedStudents.length
      };
    }

    const importedCount = Array.isArray(data) ? data.length : (data ? 1 : 0);

    console.log(`[IMPORT] ✅ Successfully imported ${importedCount} students`);

    return {
      success: true,
      imported: importedCount,
      failed: validation.validatedStudents.length - importedCount,
      errors: [],
      totalProcessed: validation.validatedStudents.length,
      students: data
    };

  } catch (error) {
    console.error('[IMPORT] Error:', error);
    return {
      success: false,
      imported: 0,
      failed: students.length,
      errors: [error.message],
      totalProcessed: students.length
    };
  }
}

// ============================================================
// TEACHER REGISTRATION SYSTEM
// ============================================================

/**
 * Register a teacher in the system
 * @param {string} firstName - Teacher first name
 * @param {string} lastName - Teacher last name
 * @param {string} email - Teacher email
 * @param {string} sdmsCode - Teacher SDMS code (10 digits)
 * @returns {Object} { success, teacher, profile, error }
 */
async function registerTeacherIndividual(firstName, lastName, email, sdmsCode) {
  try {
    // 1. Mandatory Policy Validation
    if (!firstName || !firstName.trim()) throw new Error('Faculty First Name is required');
    if (!lastName || !lastName.trim()) throw new Error('Faculty Last Name is required');
    const emailCheck = ValidationSystem.validateEmail(email);
    if (!emailCheck.valid) throw new Error(emailCheck.error);
    
    if (!sdmsCode || sdmsCode.length !== 10) throw new Error('Teacher SDMS code must be exactly 10 digits as per MINEDUC standard.');

    const schoolCode = await getCurrentSchoolCode();

    // 2. Provision Auth User (Immediate Activation)
    // Institutional Password Standard: Teacher@[SDMS]
    const password = `Teacher@${sdmsCode}`; 
    
    console.log('[TEACHER] Provisioning Auth Identity...');
    
    const { data: authData, error: authError } = await _supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: `${firstName.trim()} ${lastName.trim()}`, role: 'teacher' } }
    });

    if (authError) {
        if (authError.message.includes('already registered')) {
            throw new Error(`The email "${email}" is already registered in the MMS system.`);
        }
        throw new Error(`Authentication Layer failure: ${authError.message}`);
    }

    // 3. Create Profile Record
    console.log('[TEACHER] Linking Auth to Institutional Registry...');
    
    const { data: profile, error: profileError } = await _supabase
      .from('profiles')
      .insert([{
        id: authData.user.id,
        email,
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        role: 'teacher',
        school_code: schoolCode,
        sdms_code: sdmsCode,
        temp_password_active: true,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (profileError) throw profileError;

    console.log('[TEACHER] ✅ Registration Complete. Account Active.');

    return {
      success: true,
      teacher: authData.user,
      profile,
      credentials: { email, password },
      error: null
    };

  } catch (error) {
    console.error('[TEACHER] Registration failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all teachers in current school
 * @returns {Promise<Array>} Array of teacher profiles
 */
async function getSchoolTeachers() {
  try {
    const schoolCode = await getCurrentSchoolCode();
    const { data, error } = await _supabase
      .from('profiles')
      .select('id, email, full_name, sdms_code, role, created_at')
      .eq('school_code', schoolCode)
      .eq('role', 'teacher')
      .order('full_name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[TEACHERS] Error fetching teachers:', error);
    return [];
  }
}

/**
 * Get all students in a class
 * @param {string} classId - Class ID
 * @returns {Promise<Array>} Array of students
 */
async function getClassStudents(classId) {
  try {
    const students = await DB.getStudents(classId);
    return students || [];
  } catch (error) {
    console.error('[STUDENTS] Error fetching class students:', error);
    return [];
  }
}

// ============================================================
// EXPORT FUNCTIONS
// ============================================================

window.StudentRegistration = {
  registerIndividual: registerStudentIndividual,
  parseCSV: parseStudentCSV,
  validateBatch: validateStudentBatch,
  bulkImport: bulkImportStudents,
  getClassStudents
};

window.TeacherRegistration = {
  registerIndividual: registerTeacherIndividual,
  getSchoolTeachers
};

console.log('[REGISTRATION] System loaded. Use StudentRegistration and TeacherRegistration objects.');
