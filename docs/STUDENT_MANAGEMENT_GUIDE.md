# 🎓 Student Management System - Integration Guide

## Overview
The Student Management System (SMS) provides role-based student management with manual entry and bulk import features for your MMS platform.

---

## 📋 Table of Contents
1. [Integration Steps](#integration-steps)
2. [Role-Based Permissions](#role-based-permissions)
3. [API Reference](#api-reference)
4. [Database Schema](#database-schema)
5. [Usage Examples](#usage-examples)
6. [Troubleshooting](#troubleshooting)

---

## 🔗 Integration Steps

### Step 1: Include Scripts in Your HTML Files

Add these script tags to `teacher-portal.html`, `admin-portal.html`, and `system-admin-portal.html`:

```html
<!-- After existing scripts, before closing </body> tag -->
<script src="js/student-management.js"></script>
```

### Step 2: Include Modal HTML Components

In the same HTML files, add the modals before the closing `</body>` tag:

```html
<!-- Student Management Modals -->
<div id="modals-container"></div>
<script>
  // Load modals dynamically
  fetch('html/student-management-modals.html')
    .then(r => r.text())
    .then(html => {
      document.getElementById('modals-container').innerHTML = html;
      if (window.lucide) lucide.createIcons();
    });
</script>
```

Or directly copy the HTML from `html/student-management-modals.html` into each portal file.

### Step 3: Initialize StudentManager on Page Load

In your portal's initialization code (e.g., in `teacher.js`, `admin.js`, `system-admin.js`):

```javascript
// After user authentication is confirmed
async function initializePortal(user, role) {
    try {
        // ... existing initialization code ...
        
        // Get user's school and class context
        const { data: profile } = await _supabase
            .from('profiles')
            .select('school_code, assigned_class_id')
            .eq('id', user.id)
            .maybeSingle();
        
        // Initialize Student Manager
        await StudentManager.init(user, role, profile.school_code, profile.assigned_class_id);
        
        // Listen for real-time student updates
        listenForStudentUpdates(async (payload) => {
            console.log('Students updated:', payload);
            // Refresh student list
            await refreshStudentList();
        });
        
    } catch (e) {
        console.error('Portal initialization failed:', e);
    }
}
```

### Step 4: Add Student Management UI to Your Portals

Add this section to your teacher/admin portal where you want the student management interface:

```html
<!-- Student Management Section -->
<section class="panel" style="background: white; border-radius: 20px; border: 1px solid #e5e7eb; padding: 2rem; margin-bottom: 2rem;">
    <div id="student-list-container"></div>
</section>
```

---

## 👥 Role-Based Permissions

### System Administrator
```javascript
{
    canAddStudent: true,           // ✅ Add students
    canImportStudents: true,       // ✅ Bulk import
    canEditStudent: true,          // ✅ Edit students
    canDeleteStudent: true,        // ✅ Delete students
    canSelectSchool: true,         // ✅ Select any school
    canSelectClass: true,          // ✅ Select any class
    bulkLimit: 10000               // Max 10,000 per import
}
```

**UI Behavior:**
- Shows school dropdown (can select any school)
- Shows class dropdown (populated based on selected school)
- Full edit/delete capabilities

### School Administrator
```javascript
{
    canAddStudent: true,           // ✅ Add students
    canImportStudents: true,       // ✅ Bulk import
    canEditStudent: true,          // ✅ Edit students
    canDeleteStudent: true,        // ✅ Delete students
    canSelectSchool: false,        // ❌ Locked to their school
    canSelectClass: true,          // ✅ Select any class in school
    bulkLimit: 5000                // Max 5,000 per import
}
```

**UI Behavior:**
- School dropdown hidden (auto-selected)
- Shows class dropdown for their school only
- Can edit/delete students in their school

### Class Teacher
```javascript
{
    canAddStudent: true,           // ✅ Add students
    canImportStudents: true,       // ✅ Bulk import (to their class)
    canEditStudent: false,         // ❌ Cannot edit
    canDeleteStudent: false,       // ❌ Cannot delete
    canSelectSchool: false,        // ❌ Locked to their school
    canSelectClass: false,         // ❌ Locked to their class
    bulkLimit: 500                 // Max 500 per import
}
```

**UI Behavior:**
- School and class fields auto-filled and hidden
- Can only add new students to their class
- Cannot modify/delete existing students

---

## 📡 API Reference

### StudentManager.init(user, role, schoolCode, classId)
Initialize the student manager for current session.

```javascript
await StudentManager.init(authUser, 'teacher', 'SCH001', 'class-uuid');
```

### StudentManager.getPermissions()
Get role-based permissions.

```javascript
const perms = StudentManager.getPermissions();
if (perms.canAddStudent) {
    // Show add student button
}
```

### openAddStudentForm()
Open manual student addition modal.

```javascript
openAddStudentForm();
```

### openBulkImportForm()
Open bulk import modal.

```javascript
openBulkImportForm();
```

### getStudentList(schoolCode, classId)
Fetch students for given context.

```javascript
const students = await getStudentList('SCH001', 'class-uuid');
console.log(students); // Array of student objects
```

### deleteStudent(studentId)
Delete a student (permission checks applied).

```javascript
const success = await deleteStudent('student-uuid');
```

### listenForStudentUpdates(callback)
Listen for real-time student updates.

```javascript
listenForStudentUpdates((payload) => {
    console.log('Students updated in:', payload.classId);
    // Refresh UI
});
```

### triggerStudentListRefresh(schoolCode, classId)
Manually trigger refresh across all portals.

```javascript
await triggerStudentListRefresh('SCH001', 'class-uuid');
```

---

## 🗄️ Database Schema

### students Table
```sql
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,                    -- REQUIRED
    class_id UUID REFERENCES classes(id),       -- Student's class
    school_code TEXT NOT NULL,                  -- School reference
    sdms_code TEXT UNIQUE,                      -- Optional: National ID
    gender TEXT CHECK (gender IN ('M', 'F')), -- Optional: M or F
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### Field Requirements
| Field | Required | Type | Notes |
|-------|----------|------|-------|
| full_name | ✅ YES | TEXT | Student's legal name |
| class_id | ✅ YES | UUID | After adding to system |
| school_code | ✅ YES | TEXT | School identifier |
| sdms_code | ❌ Optional | TEXT | National/System ID, must be unique |
| gender | ❌ Optional | TEXT | M or F only |

---

## 💻 Usage Examples

### Example 1: Teacher Adding a Student
```javascript
// 1. Teacher clicks "Add Student" button
openAddStudentForm();

// 2. Student Manager shows form with:
// - Class field: HIDDEN (auto-filled with their class)
// - School field: HIDDEN
// - Full Name: REQUIRED input
// - SDMS Code: Optional input
// - Gender: Optional dropdown

// 3. Teacher fills in: "John Doe" | "optional SDMS" | "Male"

// 4. Form submits via submitAddStudent()
// - Validates full name (required)
// - Checks for duplicates by SDMS code
// - Inserts into database
// - Notifies other portals via real-time sync
```

### Example 2: Admin Bulk Importing Students
```javascript
// 1. Admin clicks "Import Students"
openBulkImportForm();

// 2. Admin uploads CSV with columns:
// student_name,student_number,gender
// BAREBIMANA VANESSA,540713230294,FEMALE
// JOHN DOE,540713230295,MALE

// 3. System shows preview:
// ✅ 2 valid records
// ❌ 0 invalid records

// 4. Admin clicks "Import Students"
// - Parses CSV in batches of 100
// - Checks for duplicates
// - Inserts all valid records
// - Shows success: "2 added, 0 duplicates skipped"

// 5. Changes appear instantly in:
// - Teacher Portal (their class)
// - Admin Portal (selected class)
// - System Admin Portal (all classes)
```

### Example 3: System Admin Adding to Any School
```javascript
// 1. System Admin clicks "Add Student"
openAddStudentForm();

// 2. Form shows ALL fields:
// - School dropdown: VISIBLE (can select any)
// - Class dropdown: VISIBLE (populated by school)
// - Full Name: REQUIRED
// - SDMS Code: Optional
// - Gender: Optional

// 3. System Admin:
// - Selects "High School A"
// - Selects "Form 4B"
// - Enters student data
// - Submits

// 4. Student added to School A, Form 4B
// - School A's admin can now see this student
// - Form 4B's class teacher can see this student
// - System admin can see everywhere
```

---

## 🔍 Validation Rules

### Full Name Validation
```javascript
// ✅ VALID
"John Doe"
"Dr. Mary O'Brien"
"الإسم العربي"

// ❌ INVALID
""                    // Empty
"   "                // Whitespace only
null                 // No value
```

### SDMS Code Validation
```javascript
// ✅ VALID
"540713230294"
"12345"
(Optional field)

// ❌ INVALID
"ABC123"              // Contains letters
"-1234"              // Negative
"12.34"              // Decimals (optional check)
```

### Gender Validation
```javascript
// ✅ VALID
"M"
"F"
"Male"
"Female"
(Optional field)

// ❌ INVALID
"Other"
"X"
(Optional field - can be empty)
```

---

## ✅ CSV Import Format

### Required Structure
```
student_name,student_number,gender
```

### Valid Example
```csv
student_name,student_number,gender
BAREBIMANA VANESSA,540713230294,FEMALE
JOHN DOE,540713230295,MALE
JANE SMITH,,FEMALE
PETER JOHNSON,540713230297,
```

### Invalid Examples (Will be Skipped)
```csv
# ❌ Missing header
540713230294,BAREBIMANA VANESSA,FEMALE

# ❌ Missing required column (student_name)
student_code,gender
540713230294,FEMALE

# ❌ Empty name row
,540713230295,MALE

# ❌ Special characters in name
স্টুডেন্ট ৪#@!,540713230296,MALE  # Unicode OK, but special chars will be trimmed
```

---

## 🔐 Security Features

### 1. Input Sanitization
All inputs are sanitized to prevent XSS attacks:
```javascript
sanitizeInput(userInput)  // Escapes HTML
```

### 2. Duplicate Prevention
- SDMS codes are unique per school
- Checked before insertion
- Bulk import filters duplicates

### 3. Role-Based Access Control (RBAC)
- Each role has specific permissions
- UI elements shown/hidden based on role
- Server-side validation on Supabase

### 4. Rate Limiting
- Bulk import limits per role
- Teacher: 500 per import
- Admin: 5,000 per import
- System Admin: 10,000 per import

### 5. Row-Level Security (RLS)
Database policies ensure:
- Teachers only see their class
- Admins only see their school
- System admins see everything

---

## 🚀 Real-Time Synchronization

### How It Works
1. Student added/imported → triggers event
2. Event broadcasts via Supabase channel
3. All listening portals receive notification
4. Portals auto-refresh student lists
5. No page reload required

### Listening for Updates
```javascript
listenForStudentUpdates((payload) => {
    const { schoolCode, classId } = payload;
    console.log(`Students updated in ${schoolCode}/${classId}`);
    refreshStudentList();
});
```

### Manual Trigger
```javascript
// After bulk import completes
await triggerStudentListRefresh('SCH001', 'class-uuid');
```

---

## 🐛 Troubleshooting

### Issue: "You do not have permission to add students"
**Solution:**
- Check role assignment in database
- Verify StudentManager is initialized with correct role
- Check permissions: `StudentManager.getPermissions()`

### Issue: "Student with SDMS code X already exists"
**Solution:**
- SDMS codes must be unique per school
- Verify import file doesn't contain duplicates
- Check existing students in that school

### Issue: CSV import shows "Failed to parse file"
**Solution:**
- Ensure CSV has headers: `student_name,student_number,gender`
- Check student_name column exists
- Verify file is UTF-8 encoded
- No special line breaks in data

### Issue: Changes not appearing in other portals
**Solution:**
- Check browser console for errors
- Verify `listenForStudentUpdates()` is called
- Check Supabase realtime permissions
- Manually refresh: press F5

### Issue: Modal not appearing
**Solution:**
- Verify modals HTML included in page
- Check Lucide icons loaded: `lucide.createIcons()`
- Check CSS file loaded
- Inspect browser console for errors

---

## 📚 File Structure

```
MArks web/
├── js/
│   ├── student-management.js          ← Core student management logic
│   ├── teacher.js                     ← Teacher portal logic
│   ├── admin.js                       ← Admin portal logic
│   └── system-admin.js                ← System admin portal logic
├── html/
│   └── student-management-modals.html ← UI components
├── teacher-portal.html                ← Add script + modals
├── admin-portal.html                  ← Add script + modals
└── system-admin-portal.html           ← Add script + modals
```

---

## 🎯 Next Steps

1. **Add scripts to portals** - Include `student-management.js`
2. **Include modals** - Copy modals HTML to each portal
3. **Initialize StudentManager** - Call `init()` on page load
4. **Test permissions** - Verify role-based UI behavior
5. **Test bulk import** - Upload sample CSV
6. **Monitor sync** - Check real-time updates work
7. **Deploy** - Push to production

---

## 💡 Tips & Best Practices

✅ **DO:**
- Always validate full names (required)
- Use SDMS codes when available (helps prevent duplicates)
- Test bulk import with sample CSV first
- Monitor student list sync in real-time
- Keep class assignments updated

❌ **DON'T:**
- Leave full name empty
- Use special characters in names (will be sanitized)
- Import same CSV twice (check for duplicates)
- Manually edit database (use UI only)
- Delete students without confirmation

---

## 📞 Support

For questions or issues:
1. Check this guide
2. Check browser console for errors
3. Review database policies in Supabase
4. Contact development team

---

**Version:** 1.0  
**Last Updated:** April 2026  
**Status:** Production Ready ✅
