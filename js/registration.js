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
 * @param {string} sdms - Student SDMS code (optional)
 * @param {string} classId - Class ID
 * @param {string} gender - Gender (M/F)
 * @returns {Object} { success, student, error }
 */
async function registerStudentIndividual(firstName, lastName, sdms, classId, gender = 'M') {
  try {
    // Validation
    if (!firstName || !firstName.trim()) throw new Error('First name is required');
    if (!lastName || !lastName.trim()) throw new Error('Last name is required');
    if (!classId) throw new Error('Class is required');

    const studentObj = {
      first_name: firstName.trim().toUpperCase(),
      last_name: lastName.trim().toUpperCase(),
      full_name: `${firstName.trim()} ${lastName.trim()}`.toUpperCase(),
      sid: sdms ? sdms.trim() : null,
      gender: gender.toUpperCase(),
      class_id: classId,
      is_active: true,
      enrollment_date: new Date().toISOString()
    };

    console.log('[STUDENT] Registering:', studentObj);

    const { data, error } = await DB.addStudent(studentObj);
    if (error) {
      console.error('[STUDENT] Registration failed:', error);
      return { success: false, error: error.message };
    }

    console.log('[STUDENT] Registered successfully:', data);
    return { success: true, student: data?.[0] || data, error: null };

  } catch (error) {
    console.error('[STUDENT] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Validate student data before bulk import
 * @param {Array} students - Array of student objects
 * @returns {Object} { valid, errors, validatedStudents }
 */
function validateStudentBatch(students) {
  const errors = [];
  const validatedStudents = [];

  if (!Array.isArray(students) || students.length === 0) {
    return { valid: false, errors: ['No students provided'], validatedStudents: [] };
  }

  students.forEach((student, index) => {
    const rowErrors = [];

    // Required fields
    if (!student.first_name || !student.first_name.trim()) {
      rowErrors.push(`Row ${index + 1}: First name is required`);
    }
    if (!student.last_name || !student.last_name.trim()) {
      rowErrors.push(`Row ${index + 1}: Last name is required`);
    }
    if (!student.class_id) {
      rowErrors.push(`Row ${index + 1}: Class ID is required`);
    }

    // Valid gender
    if (student.gender && !['M', 'F', 'O'].includes(student.gender.toUpperCase())) {
      rowErrors.push(`Row ${index + 1}: Gender must be M, F, or O`);
    }

    if (rowErrors.length === 0) {
      validatedStudents.push({
        first_name: student.first_name.trim().toUpperCase(),
        last_name: student.last_name.trim().toUpperCase(),
        full_name: `${student.first_name.trim()} ${student.last_name.trim()}`.toUpperCase(),
        sid: student.sid ? student.sid.trim() : null,
        gender: (student.gender || 'M').toUpperCase(),
        class_id: student.class_id,
        is_active: true,
        enrollment_date: new Date().toISOString()
      });
    } else {
      errors.push(...rowErrors);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    validatedStudents,
    totalProcessed: students.length,
    totalValid: validatedStudents.length,
    totalErrors: errors.length
  };
}

/**
 * Parse CSV data into student objects
 * Expected format: firstName,lastName,SDMS,Gender (or firstName,lastName,Gender)
 * @param {string} csvData - CSV text data
 * @param {string} classId - Target class ID
 * @returns {Array} Array of student objects
 */
function parseStudentCSV(csvData, classId) {
  const lines = csvData.split(/\r?\n/).filter(l => l.trim().length > 0);
  const students = [];

  lines.forEach((line, index) => {
    const parts = line.split(',').map(p => p.trim());

    // Skip empty or comment lines
    if (parts.length === 0 || parts[0].startsWith('#')) return;

    // Handle different CSV formats
    let firstName, lastName, sdms, gender;

    if (parts.length === 2) {
      // Format: FirstName, LastName
      [firstName, lastName] = parts;
      gender = 'M';
    } else if (parts.length === 3) {
      // Format: FirstName, LastName, Gender OR FirstName, LastName, SDMS
      [firstName, lastName, sdms] = parts;
      // Try to detect if third field is gender
      if (['M', 'F', 'O'].includes(sdms.toUpperCase())) {
        gender = sdms;
        sdms = null;
      } else {
        gender = 'M';
      }
    } else if (parts.length >= 4) {
      // Format: FirstName, LastName, SDMS, Gender
      [firstName, lastName, sdms, gender] = parts;
    }

    if (firstName && lastName) {
      students.push({
        first_name: firstName,
        last_name: lastName,
        sid: sdms,
        gender: gender || 'M',
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
    // Validation
    if (!firstName || !firstName.trim()) throw new Error('First name is required');
    if (!lastName || !lastName.trim()) throw new Error('Last name is required');
    if (!email || !email.includes('@')) throw new Error('Valid email is required');
    if (!sdmsCode || sdmsCode.length !== 10) throw new Error('SDMS code must be 10 digits');

    const schoolCode = await getCurrentSchoolCode();

    // Create auth user
    // Institutional Password Standard (Final Edit)
    const password = `Teacher@2026`; 
    const { data: authData, error: authError } = await _supabase.auth.signUp({
      email,
      password
    });

    if (authError) throw new Error(`Auth error: ${authError.message}`);

    // Create profile
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

    console.log('[TEACHER] Registered successfully:', profile);

    return {
      success: true,
      teacher: authData.user,
      profile,
      tempPassword: password,
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
