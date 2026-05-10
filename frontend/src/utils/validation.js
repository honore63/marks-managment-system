// ============================================================
// VALIDATION SYSTEM FOR DEVELOPER-CREATED USERS
// Ensures data quality for users created directly in Supabase
// ============================================================

/**
 * Validate school_code format
 * Must be exactly 6 digits
 */
function validateSchoolCode(schoolCode) {
  if (!schoolCode) {
    return { valid: false, error: 'school_code is required' };
  }
  
  if (!/^\d{6}$/.test(schoolCode)) {
    return { 
      valid: false, 
      error: `school_code must be exactly 6 digits. Got: "${schoolCode}"` 
    };
  }
  
  return { valid: true };
}

/**
 * Validate SDMS code format
 * Must be exactly 10 digits and unique
 */
function validateSdmsCode(sdmsCode) {
  // NULL is valid (admins don't need SDMS code)
  if (!sdmsCode) {
    return { valid: true };
  }
  
  if (!/^\d{10}$/.test(sdmsCode)) {
    return { 
      valid: false, 
      error: `sdms_code must be exactly 10 digits. Got: "${sdmsCode}"` 
    };
  }
  
  return { valid: true };
}

/**
 * Validate email format
 */
function validateEmail(email) {
  if (!email) {
    return { valid: false, error: 'email is required' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { 
      valid: false, 
      error: `email format is invalid. Got: "${email}"` 
    };
  }
  
  return { valid: true };
}

/**
 * Validate role
 * Must be 'admin' or 'teacher'
 */
function validateRole(role) {
  if (!role) {
    return { valid: false, error: 'role is required' };
  }
  
  if (!['admin', 'teacher'].includes(role)) {
    return { 
      valid: false, 
      error: `role must be 'admin' or 'teacher'. Got: "${role}"` 
    };
  }
  
  return { valid: true };
}

/**
 * Validate full name
 */
function validateFullName(fullName) {
  if (!fullName) {
    return { valid: false, error: 'full_name is required' };
  }
  
  if (fullName.length < 2) {
    return { 
      valid: false, 
      error: 'full_name must be at least 2 characters' 
    };
  }
  
  return { valid: true };
}

/**
 * Comprehensive validation for new user
 * Used before inserting into profiles
 */
async function validateNewUser(userData) {
  const errors = [];
  
  console.log('[VALIDATION] Validating user:', userData);
  
  // Check required fields
  const requiredFields = ['email', 'full_name', 'role', 'school_code'];
  for (const field of requiredFields) {
    if (!userData[field]) {
      errors.push(`${field} is required`);
    }
  }
  
  // Validate email format
  const emailValidation = validateEmail(userData.email);
  if (!emailValidation.valid) errors.push(emailValidation.error);
  
  // Validate full name
  const nameValidation = validateFullName(userData.full_name);
  if (!nameValidation.valid) errors.push(nameValidation.error);
  
  // Validate role
  const roleValidation = validateRole(userData.role);
  if (!roleValidation.valid) errors.push(roleValidation.error);
  
  // Validate school code
  const schoolValidation = validateSchoolCode(userData.school_code);
  if (!schoolValidation.valid) errors.push(schoolValidation.error);
  
  // Validate SDMS code if provided
  if (userData.role === 'teacher' && userData.sdms_code) {
    const sdmsValidation = validateSdmsCode(userData.sdms_code);
    if (!sdmsValidation.valid) errors.push(sdmsValidation.error);
  }
  
  // Check for duplicate email
  if (userData.email) {
    const { data: existing } = await _supabase
      .from('profiles')
      .select('id')
      .eq('email', userData.email)
      .maybeSingle();
    
    if (existing) {
      errors.push(`email "${userData.email}" already exists`);
    }
  }
  
  // Check for duplicate SDMS code
  if (userData.sdms_code) {
    const { data: existing } = await _supabase
      .from('profiles')
      .select('id')
      .eq('sdms_code', userData.sdms_code)
      .maybeSingle();
    
    if (existing) {
      errors.push(`sdms_code "${userData.sdms_code}" already exists`);
    }
  }
  
  if (errors.length > 0) {
    console.error('[VALIDATION] Errors found:', errors);
    return { valid: false, errors };
  }
  
  console.log('[VALIDATION] User validation passed ✅');
  return { valid: true, errors: [] };
}

/**
 * Create user from developer data
 * Validates and inserts into profiles
 */
async function createUserFromSupabaseAuth(userData) {
  try {
    // Validate input
    const validation = await validateNewUser(userData);
    if (!validation.valid) {
      const errorMessage = validation.errors.join('\n');
      console.error('[CREATE_USER] Validation failed:\n' + errorMessage);
      throw new Error('Validation failed:\n' + errorMessage);
    }
    
    // Insert profile
    const { data, error } = await _supabase
      .from('profiles')
      .insert([{
        email: userData.email,
        full_name: userData.full_name,
        role: userData.role,
        school_code: userData.school_code,
        school_name: userData.school_name || null,
        sdms_code: userData.sdms_code || null,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) {
      console.error('[CREATE_USER] Insert error:', error);
      throw error;
    }
    
    console.log('[CREATE_USER] ✅ User created successfully:', data);
    return { success: true, user: data };
    
  } catch (error) {
    console.error('[CREATE_USER] Failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check for duplicate SDMS codes
 * Returns list of duplicates
 */
async function findDuplicateSdmsCodes() {
  const { data, error } = await _supabase
    .from('profiles')
    .select('sdms_code, email, full_name')
    .not('sdms_code', 'is', null);
  
  if (error) {
    console.error('[DUPLICATE_CHECK] Error:', error);
    return { duplicates: [] };
  }
  
  // Group by sdms_code and find duplicates
  const grouped = {};
  data.forEach(profile => {
    if (!grouped[profile.sdms_code]) {
      grouped[profile.sdms_code] = [];
    }
    grouped[profile.sdms_code].push({
      email: profile.email,
      full_name: profile.full_name
    });
  });
  
  const duplicates = Object.entries(grouped)
    .filter(([_, users]) => users.length > 1)
    .map(([sdmsCode, users]) => ({ sdmsCode, users }));
  
  if (duplicates.length > 0) {
    console.warn('[DUPLICATE_CHECK] Found duplicates:', duplicates);
  }
  
  return { duplicates };
}

/**
 * Get all users for a school
 */
async function getUsersBySchool(schoolCode) {
  const validation = validateSchoolCode(schoolCode);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  const { data, error } = await _supabase
    .from('profiles')
    .select('id, email, full_name, role, school_code, sdms_code, created_at')
    .eq('school_code', schoolCode)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[GET_USERS] Error:', error);
    throw error;
  }
  
  return data || [];
}

/**
 * Get all admins for a school
 */
async function getAdminsBySchool(schoolCode) {
  const validation = validateSchoolCode(schoolCode);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  const { data, error } = await _supabase
    .from('profiles')
    .select('id, email, full_name, school_code, last_sync_at')
    .eq('school_code', schoolCode)
    .eq('role', 'admin')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[GET_ADMINS] Error:', error);
    throw error;
  }
  
  return data || [];
}

/**
 * Get all teachers for a school
 */
async function getTeachersBySchool(schoolCode) {
  const validation = validateSchoolCode(schoolCode);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  const { data, error } = await _supabase
    .from('profiles')
    .select('id, email, full_name, sdms_code, school_code, created_at')
    .eq('school_code', schoolCode)
    .eq('role', 'teacher')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('[GET_TEACHERS] Error:', error);
    throw error;
  }
  
  return data || [];
}

/**
 * Update user details
 */
async function updateUserProfile(userId, updates) {
  try {
    // Validate school code if updating it
    if (updates.school_code) {
      const validation = validateSchoolCode(updates.school_code);
      if (!validation.valid) throw new Error(validation.error);
    }
    
    const { data, error } = await _supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('[UPDATE_USER] ✅ User updated:', data);
    return { success: true, user: data };
    
  } catch (error) {
    console.error('[UPDATE_USER] Failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete user (soft delete - set inactive)
 */
async function deactivateUser(userId) {
  try {
    const { data, error } = await _supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('[DEACTIVATE_USER] ✅ User deactivated:', data);
    return { success: true };
    
  } catch (error) {
    console.error('[DEACTIVATE_USER] Failed:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================
// EXPORT FOR USE IN BROWSER CONSOLE OR OTHER SCRIPTS
// ============================================================

window.ValidationSystem = {
  validateSchoolCode,
  validateSdmsCode,
  validateEmail,
  validateRole,
  validateFullName,
  validateNewUser,
  createUserFromSupabaseAuth,
  findDuplicateSdmsCodes,
  getUsersBySchool,
  getAdminsBySchool,
  getTeachersBySchool,
  updateUserProfile,
  deactivateUser
};

console.log('[VALIDATION] System loaded. Use window.ValidationSystem for functions.');
