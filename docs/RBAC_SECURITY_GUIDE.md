# 🔐 RBAC Security Implementation Guide - MMS v2.5

## Overview

This guide implements **strict role-based data access control (RBAC)** in the Marks Management System using a two-layered security approach:

1. **Backend (Supabase RLS)** - Database-level row-level security
2. **Frontend (JavaScript)** - Application-level access control validation

---

## 🎯 Core Security Principles

### 1. Data Isolation
- **System Admin** → Full access to all data
- **School Admin** → Access only to their school's data
- **Teacher** → Access only to their assigned classes and subjects

### 2. No Data Leakage
- All queries must include proper WHERE clauses
- Real-time updates must respect access rules
- UI must filter out unauthorized data

### 3. Defense in Depth
- Backend RLS prevents SQL bypass
- Frontend validation prevents unauthorized UI access
- Audit logging tracks all access attempts

---

## 📋 Implementation Checklist

### Step 1: Deploy RLS Policies to Supabase

**File:** `RBAC_SECURITY_IMPLEMENTATION.sql`

```sql
-- In Supabase SQL Editor:
1. Open SQL Editor
2. Copy entire RBAC_SECURITY_IMPLEMENTATION.sql
3. Run the script
4. Verify no errors
5. Check audit_logs table was created
```

**What gets deployed:**
- ✅ Enhanced RLS policies for all tables
- ✅ Helper functions (get_user_context, get_teacher_classes, etc.)
- ✅ Audit logging system
- ✅ Row-level security checks on all tables

---

### Step 2: Add Frontend Security Library

**File:** `js/security-access-control.js`

Add to all HTML files (admin-portal.html, teacher-portal.html, system-admin-portal.html):

```html
<!-- SECURITY LAYER -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/db.js"></script>
<script src="js/security-access-control.js"></script>
```

**Must load BEFORE your portal scripts**

---

### Step 3: Initialize Access Control After Login

**In your login handler (db.js or admin.js):**

```javascript
// After successful authentication
async function handleLoginSuccess(user) {
    // Initialize access control
    await ACCESS_CONTROL.init(user);
    
    // Now user context is loaded and ready
    console.log('User role:', ACCESS_CONTROL.userRole);
    console.log('User school:', ACCESS_CONTROL.userSchool);
    
    // Redirect to appropriate portal
    redirectToDashboard();
}
```

---

## 🔑 Security Components

### Component 1: ACCESS_CONTROL

**Purpose:** Tracks current user's identity, role, school, and permissions

**Key Methods:**
```javascript
// Initialize (call after login)
await ACCESS_CONTROL.init(user);

// Check if user can access something
ACCESS_CONTROL.canAccessSchool(schoolCode)   // true/false
ACCESS_CONTROL.canAccessClass(classId)       // true/false
ACCESS_CONTROL.canAccessStudent(student)     // true/false
ACCESS_CONTROL.canAccessMarks(mark)          // true/false

// Check if user can perform action
ACCESS_CONTROL.canPerformAction('create_student', 'students')
ACCESS_CONTROL.canPerformAction('edit_marks', 'marks')
ACCESS_CONTROL.canPerformAction('delete_student', 'students')

// Validate access (throws exception if denied)
try {
    ACCESS_CONTROL.validateAccess('edit_student', 'students');
    // Proceed if no exception
} catch (e) {
    console.error('Access denied:', e.message);
}
```

**Example:**
```javascript
// Teacher tries to access another teacher's marks
if (!ACCESS_CONTROL.canAccessMarks(mark)) {
    toast('You cannot access these marks', 'error');
    return;
}
```

---

### Component 2: SecureQueryBuilder

**Purpose:** Builds database queries with automatic access control filtering

**Usage:**
```javascript
// Get students (automatically filtered for user's scope)
const query = SecureQueryBuilder.studentsQuery({ classId: 'xyz' });
const { data: students } = await query;

// Get marks (automatically filtered)
const query = SecureQueryBuilder.marksQuery({ term: 2, schoolCode: 'GLOBAL' });
const { data: marks } = await query;

// Get classes (automatically filtered)
const query = SecureQueryBuilder.classesQuery();
const { data: classes } = await query;

// Get teachers (automatically filtered)
const query = SecureQueryBuilder.teachersQuery();
const { data: teachers } = await query;

// Get subjects (automatically filtered)
const query = SecureQueryBuilder.subjectsQuery();
const { data: subjects } = await query;

// Get schools (automatically filtered)
const query = SecureQueryBuilder.schoolsQuery();
const { data: schools } = await query;
```

**How It Works:**
- System Admin: No filtering
- Admin: Only their school data
- Teacher: Only their classes/subjects
- All additional filters still apply

---

### Component 3: RealTimeFilter

**Purpose:** Ensures real-time updates respect access rules

**Usage:**
```javascript
// Listen to student updates (only shows authorized updates)
RealTimeFilter.listenToStudentUpdates((payload) => {
    console.log('New/updated student:', payload);
    // This callback ONLY fires for students user can access
});

// Listen to marks updates (only shows authorized updates)
RealTimeFilter.listenToMarksUpdates((payload) => {
    console.log('New/updated mark:', payload);
    // This callback ONLY fires for marks user can access
});
```

---

### Component 4: DataIsolation

**Purpose:** Filters arrays of data to remove unauthorized records

**Usage:**
```javascript
// Filter out students user cannot access
const visibleStudents = DataIsolation.filterStudents(allStudents);

// Filter out marks user cannot access
const visibleMarks = DataIsolation.filterMarks(allMarks);

// Filter out classes user cannot access
const visibleClasses = DataIsolation.filterClasses(allClasses);

// Filter out subjects user cannot access
const visibleSubjects = DataIsolation.filterSubjects(allSubjects);
```

---

### Component 5: AccessAudit

**Purpose:** Logs all access attempts for security auditing

**Usage:**
```javascript
// Log successful access
await AccessAudit.logAccess('viewed_student', 'students', true);

// Log denied access
await AccessAudit.logDenied('edit_marks', 'marks', 'Not assigned to subject');
```

---

## 📊 Data Access Rules

### System Administrator
```
✅ Can access:
  - All schools
  - All admins
  - All teachers
  - All students
  - All marks
  - All classes
  - All subjects
  - System settings

❌ Cannot access:
  - (Nothing - full system access)

Database filter: NONE
```

### School Administrator
```
✅ Can access:
  - Their school only
  - Teachers in their school
  - Students in their school
  - Classes in their school
  - Subjects in their school
  - Marks in their school

❌ Cannot access:
  - Other schools' data
  - Other admins' schools
  - System settings

Database filter:
WHERE school_code = current_admin.school_code
```

### Teacher
```
✅ Can access:
  - Own profile
  - Own assigned classes
  - Students in assigned classes
  - Own assigned subjects
  - Marks for own subjects/classes

❌ Cannot access:
  - Other teachers' data
  - Other classes
  - Full school data
  - Admin data
  - System settings

Database filter:
WHERE class_id IN (teacher.assigned_classes)
  AND subject_id IN (teacher.assigned_subjects)
```

---

## 🔒 Enforced at Multiple Layers

### Layer 1: Initial Data Query
```javascript
// ❌ BAD: No filtering
const { data } = await _supabase
    .from('students')
    .select('*');

// ✅ GOOD: Use SecureQueryBuilder
const query = SecureQueryBuilder.studentsQuery();
const { data } = await query;
```

### Layer 2: Row-Level Security
```sql
-- RLS Policy on students table:
CREATE POLICY students_select ON students
FOR SELECT USING (
  CASE 
    WHEN current_role = 'system_admin' THEN true
    WHEN current_role = 'admin' THEN school_code = current_school
    WHEN current_role = 'teacher' THEN class_id IN (teacher_classes)
    ELSE false
  END
);
```

### Layer 3: Frontend Validation
```javascript
// Before showing data
if (!ACCESS_CONTROL.canAccessStudent(student)) {
    // Hide or reject
    return null;
}
```

---

## 🚀 Integration Examples

### Example 1: Show Students in Admin Portal

**OLD (No Access Control):**
```javascript
async function loadStudents() {
    const { data: students } = await _supabase
        .from('students')
        .select('*')
        .eq('school_code', currentSchool);
    
    displayStudents(students);
}
```

**NEW (With Access Control):**
```javascript
async function loadStudents() {
    // Automatic school filtering based on role
    const query = SecureQueryBuilder.studentsQuery();
    const { data: students, error } = await query;
    
    if (error) {
        toast('Failed to load students', 'error');
        return;
    }
    
    // Double-check access before displaying
    const visibleStudents = DataIsolation.filterStudents(students);
    displayStudents(visibleStudents);
}
```

---

### Example 2: Teacher Adding Marks

**OLD (No Validation):**
```javascript
async function saveMark(mark) {
    const { error } = await _supabase
        .from('marks')
        .insert(mark);
    
    if (!error) toast('Mark saved', 'success');
}
```

**NEW (With Validation):**
```javascript
async function saveMark(mark) {
    // Validate access
    try {
        ACCESS_CONTROL.validateAccess('create_marks', 'marks');
        
        // Verify teacher can access class and subject
        if (!ACCESS_CONTROL.canAccessClass(mark.class_id)) {
            throw new Error('Cannot access this class');
        }
        if (!ACCESS_CONTROL.canAccessSubject(mark.subject_id)) {
            throw new Error('Cannot access this subject');
        }
        
        // Proceed with marked insert (RLS will double-check)
        const { error } = await _supabase
            .from('marks')
            .insert(mark);
        
        if (error) throw error;
        
        await AccessAudit.logAccess('created_mark', 'marks', true);
        toast('Mark saved', 'success');
    } catch (e) {
        await AccessAudit.logDenied('create_marks', 'marks', e.message);
        toast(`Error: ${e.message}`, 'error');
    }
}
```

---

### Example 3: Real-Time Student List Updates

**NEW (With Real-Time Filtering):**
```javascript
async function initializeStudentsList() {
    // Load initial data
    const query = SecureQueryBuilder.studentsQuery();
    const { data: students } = await query;
    renderStudentsList(students);
    
    // Listen to updates (only for authorized students)
    RealTimeFilter.listenToStudentUpdates((payload) => {
        console.log('Student updated:', payload);
        
        // Re-fetch to ensure latest data and access control
        query = SecureQueryBuilder.studentsQuery();
        const { data: updatedStudents } = await query;
        renderStudentsList(updatedStudents);
    });
}
```

---

## ⚠️ Common Mistakes to Avoid

### ❌ Mistake 1: Direct Database Access Without Filtering
```javascript
// WRONG - Bypasses access control
const { data } = await _supabase
    .from('students')
    .select('*');
```

**Fix:**
```javascript
// CORRECT - Uses access control
const query = SecureQueryBuilder.studentsQuery();
const { data } = await query;
```

---

### ❌ Mistake 2: Trusting Frontend Only
```javascript
// WRONG - Frontend can be bypassed
if (currentRole === 'teacher') {
    displayEditButton();
}
```

**Fix:**
```javascript
// CORRECT - Backend also validates with RLS
try {
    ACCESS_CONTROL.validateAccess('edit_student', 'students');
    displayEditButton();
} catch (e) {
    // RLS will also prevent backend modification
}
```

---

### ❌ Mistake 3: Not Filtering Real-Time Updates
```javascript
// WRONG - Shows updates to everyone
_supabase
    .channel('students')
    .on('postgres_changes', { event: '*', table: 'students' },
        (payload) => updateUI(payload) // Could show unauthorized data
    )
    .subscribe();
```

**Fix:**
```javascript
// CORRECT - Filters updates
RealTimeFilter.listenToStudentUpdates((payload) => {
    // Only fires for authorized students
    updateUI(payload);
});
```

---

### ❌ Mistake 4: Forgetting to Initialize ACCESS_CONTROL
```javascript
// WRONG - ACCESS_CONTROL not initialized
async function showDashboard() {
    // ACCESS_CONTROL.userRole is still null!
}
```

**Fix:**
```javascript
// CORRECT - Initialize after login
async function handleLoginSuccess(user) {
    await ACCESS_CONTROL.init(user);
    showDashboard();
}
```

---

## 📈 Deployment Steps

### 1. Backup Current Database
```sql
-- Export current schema and data as backup
```

### 2. Deploy RLS Policies
```sql
-- Run RBAC_SECURITY_IMPLEMENTATION.sql in Supabase SQL Editor
```

### 3. Update HTML Files
```html
<!-- Add security library to all portals -->
<script src="js/security-access-control.js"></script>
```

### 4. Update Login Handler
```javascript
// In db.js or admin.js signIn function:
await ACCESS_CONTROL.init(user);
```

### 5. Update Database Queries
```javascript
// Replace direct _supabase queries with SecureQueryBuilder
// Throughout admin.js, teacher.js, system-admin.js
```

### 6. Test Access Control
- [ ] System Admin can see all data
- [ ] Admin A cannot see Admin B's school
- [ ] Teacher cannot see other teachers' classes
- [ ] Real-time updates only show authorized data
- [ ] Audit logs record all access

### 7. Monitor
- Check audit_logs table for denied access attempts
- Monitor for RLS policy errors
- Review logs regularly

---

## 🔍 Testing & Verification

### Test 1: Admin School Isolation
```
1. Login as Admin School A
2. Try to access School B data (via URL or API)
3. Expected: Access denied or returns no data
4. Check audit_logs for denial
```

### Test 2: Teacher Class Isolation
```
1. Login as Teacher with Class A only
2. Try to access Class B students
3. Expected: No students shown from Class B
4. Try to add marks to Class B (should fail)
```

### Test 3: Real-Time Updates
```
1. Two browser windows: Admin and Teacher
2. In Admin: Add new student
3. In Teacher: Should NOT see new student if not in their class
4. In Admin who can see: SHOULD see update
```

### Test 4: Audit Logging
```
1. Perform denied access attempts
2. Check audit_logs table
3. Verify all denied accesses are logged
4. Check timestamps and action details
```

---

## 🛡️ Security Best Practices

1. **Always initialize ACCESS_CONTROL after login**
   ```javascript
   await ACCESS_CONTROL.init(user);
   ```

2. **Use SecureQueryBuilder for all data queries**
   ```javascript
   const query = SecureQueryBuilder.studentsQuery();
   ```

3. **Validate access before sensitive operations**
   ```javascript
   ACCESS_CONTROL.validateAccess(action, resource);
   ```

4. **Filter real-time updates**
   ```javascript
   RealTimeFilter.listenToStudentUpdates(callback);
   ```

5. **Log all access attempts**
   ```javascript
   await AccessAudit.logAccess(action, resource, allowed);
   ```

6. **Never trust frontend validation alone**
   - Rely on RLS policies for ultimate enforcement

7. **Review audit logs regularly**
   - Look for suspicious access patterns
   - Monitor for repeated denied attempts

---

## 📝 Query Reference

### Querying Students (with access control)
```javascript
// All students user can access
let query = SecureQueryBuilder.studentsQuery();

// Students in specific class
query = SecureQueryBuilder.studentsQuery({ classId: 'xyz' });

// Students matching search
query = SecureQueryBuilder.studentsQuery({ search: 'john' });
```

### Querying Marks (with access control)
```javascript
// All marks user can see
let query = SecureQueryBuilder.marksQuery();

// Marks for specific class
query = SecureQueryBuilder.marksQuery({ classId: 'xyz' });

// Marks for specific term
query = SecureQueryBuilder.marksQuery({ term: 2 });

// Marks for specific subject
query = SecureQueryBuilder.marksQuery({ subjectId: 'abc' });
```

### Querying Classes (with access control)
```javascript
let query = SecureQueryBuilder.classesQuery();
```

### Querying Teachers (with access control)
```javascript
let query = SecureQueryBuilder.teachersQuery();
```

### Querying Subjects (with access control)
```javascript
let query = SecureQueryBuilder.subjectsQuery();
```

---

## ✅ Verification Checklist

- [ ] RBAC_SECURITY_IMPLEMENTATION.sql deployed to Supabase
- [ ] js/security-access-control.js added to all portals
- [ ] ACCESS_CONTROL initialized after each login
- [ ] All data queries use SecureQueryBuilder
- [ ] Real-time listeners use RealTimeFilter
- [ ] Audit logging enabled
- [ ] RLS policies verified in Supabase
- [ ] Access control tested for each role
- [ ] No data leakage observed
- [ ] Cross-school access denied
- [ ] Cross-class access denied (for teachers)

---

## 📞 Support & Troubleshooting

### Issue: RLS Policy Error
**Solution:** Check that helper functions are created:
```sql
SELECT * FROM information_schema.routines 
WHERE routine_name LIKE 'get_%';
```

### Issue: Access Control Returns Null
**Solution:** Initialize ACCESS_CONTROL after login:
```javascript
await ACCESS_CONTROL.init(user);
```

### Issue: Real-Time Updates Not Working
**Solution:** Verify RealTimeFilter is subscribed:
```javascript
RealTimeFilter.listenToStudentUpdates(callback);
```

---

**Version:** v2.5  
**Status:** ✅ Production Ready  
**Last Updated:** April 28, 2026
