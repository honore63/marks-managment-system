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
    const email = `std${sdms.trim()}@mms.student.rw`;
    const password = `Student@${sdms.trim()}`;

    console.log('[STUDENT] Delegating to AccountManager...');

    // 3. Centralized Provisioning
    const res = await AccountManager.createAccount({
      email,
      password,
      fullName: `${firstName.trim()} ${lastName.trim()}`,
      role: 'student',
      schoolCode,
      sdmsCode: sdms.trim()
    });

    if (!res.success) throw new Error(res.error);

    // 4. Academic Record Creation (Students table)
    const studentObj = {
      id: res.user.id,
      full_name: res.profile.full_name.toUpperCase(),
      class_id: classId,
      school_code: schoolCode,
      sdms_code: sdms.trim().toUpperCase(),
      gender: gender.toUpperCase(),
      created_at: new Date().toISOString()
    };

    const { data, error } = await _supabase.from('students').insert([studentObj]).select();
    if (error) throw error;

    console.log('[STUDENT] ✅ Registered & Activated:', data);
    return { 
        success: true, 
        student: data?.[0] || data, 
        credentials: { email, password } 
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
    if (!firstName || !firstName.trim()) throw new Error('Teacher First Name is required');
    if (!lastName || !lastName.trim()) throw new Error('Teacher Last Name is required');
    const emailCheck = ValidationSystem.validateEmail(email);
    if (!emailCheck.valid) throw new Error(emailCheck.error);
    
    if (!sdmsCode || sdmsCode.length !== 10) throw new Error('Teacher SDMS code must be exactly 10 digits.');

    const schoolCode = await getCurrentSchoolCode();

    // 2. Provision Account via Central Manager
    const password = `Teacher@${sdmsCode}`; 
    
    console.log('[TEACHER] Provisioning Synchronized Identity...');
    
    const res = await AccountManager.createAccount({
      email,
      password,
      fullName: `${firstName.trim()} ${lastName.trim()}`,
      role: 'teacher',
      schoolCode,
      sdmsCode,
      phone: null
    });

    if (!res.success) throw new Error(res.error);

    console.log('[TEACHER] ✅ Registration Complete. Account Active.');

    return {
      success: true,
      teacher: res.user,
      profile: res.profile,
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

// ============================================================
// CENTRALIZED ACCOUNT MANAGEMENT SYSTEM (MMS v2.0)
// ============================================================

/**
 * Advanced Account Manager
 * Handles synchronized account creation for all roles
 * Uses a non-persisting client to avoid session disruption
 */
const AccountManager = {
  /**
   * Internal helper to create a non-disruptive Supabase client
   * This allows Admins to create users without being logged out
   */
  _getTempClient: function() {
    // We use the same URL and KEY but disable session persistence
    return supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  },

  /**
   * Create a fully functional, synchronized account
   * @param {Object} accountData { email, password, fullName, role, schoolCode, sdmsCode, phone }
   * @returns {Promise<Object>} { success, user, profile, error }
   */
  createAccount: async function(accountData) {
    const { email, password, fullName, role, schoolCode, sdmsCode, phone } = accountData;

    try {
      console.log(`[ACCOUNT_MANAGER] Initiating synchronized registration for ${role}: ${email}`);

      // 1. Validation
      if (!email || !password || !fullName || !role || !schoolCode) {
        throw new Error('Missing mandatory account fields (Email, Password, Name, Role, School Code)');
      }

      const tempClient = this._getTempClient();

      // 2. Auth Provisioning (with metadata for the trigger)
      const { data: authData, error: authError } = await tempClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role,
            school_code: schoolCode
          }
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new Error(`The identity "${email}" is already registered in the institutional system.`);
        }
        throw authError;
      }

      const user = authData.user;
      console.log(`[ACCOUNT_MANAGER] Auth identity created. ID: ${user.id}`);

      // 3. Profile Enrichment (The trigger handles basic insert, we update extras)
      // We use the PRIMARY client here because the Admin is authorized to update profiles
      const { data: profile, error: profileError } = await _supabase
        .from('profiles')
        .update({
          sdms_code: sdmsCode || null,
          phone: phone || null,
          temp_password_active: true, // Forces password change or specialized flow
          is_active: true
        })
        .eq('id', user.id)
        .select()
        .single();

      // Note: If profile update fails, the profile still exists with basic info from trigger
      if (profileError) {
        console.warn('[ACCOUNT_MANAGER] Profile enrichment warning:', profileError.message);
      }

      console.log(`[ACCOUNT_MANAGER] ✅ Account fully synchronized and activated for ${role}`);

      return {
        success: true,
        user,
        profile: profile || { id: user.id, email, full_name: fullName, role, school_code: schoolCode },
        error: null
      };

    } catch (error) {
      console.error('[ACCOUNT_MANAGER] Critical Failure:', error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Delete an account and all its associated data
   * @param {string} userId - UUID of the user
   */
  deleteAccount: async function(userId) {
    try {
      console.log(`[ACCOUNT_MANAGER] Purging account: ${userId}`);
      
      // 1. Cleanup assignments
      await _supabase.from('teacher_assignments').delete().eq('teacher_id', userId);
      
      // 2. Invoke RPC for Auth deletion (if available)
      const { error: rpcError } = await _supabase.rpc('admin_delete_auth_user', { target_id: userId });
      if (rpcError) console.warn('[ACCOUNT_MANAGER] RPC Auth purge skipped:', rpcError.message);

      // 3. Delete Profile
      const { error: profileError } = await _supabase.from('profiles').delete().eq('id', userId);
      if (profileError) throw profileError;

      console.log('[ACCOUNT_MANAGER] ✅ Account purged successfully');
      return { success: true };
    } catch (error) {
      console.error('[ACCOUNT_MANAGER] Deletion failed:', error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Update account permissions or details
   */
  updateAccount: async function(userId, updates) {
    try {
      const { data, error } = await _supabase.from('profiles').update(updates).eq('id', userId).select().single();
      if (error) throw error;
      return { success: true, profile: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

// ============================================================
// EXPORT FUNCTIONS
// ============================================================

window.AccountManager = AccountManager;

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

console.log('[REGISTRATION] System upgraded. AccountManager available.');
