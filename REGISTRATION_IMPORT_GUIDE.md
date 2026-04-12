# Student & Teacher Registration + Bulk Import System

## Overview

This system provides:
- ✅ Individual student registration
- ✅ Bulk student import from CSV
- ✅ Teacher registration
- ✅ Comprehensive validation
- ✅ Error handling with detailed feedback

---

## 1. STUDENT REGISTRATION

### Individual Student Registration

Register a single student programmatically:

```javascript
// Method 1: Using the registration system
const result = await StudentRegistration.registerIndividual(
  'John',           // firstName
  'Doe',            // lastName
  'SDMS123456',     // sdms (optional)
  'class-id-123',   // classId (required)
  'M'               // gender (M/F/O, default: M)
);

if (result.success) {
  console.log('Student registered:', result.student);
} else {
  console.error('Error:', result.error);
}
```

### Via HTML Form

```html
<!-- Manual student registration form -->
<form id="student-form">
  <input type="text" id="first-name" placeholder="First Name" required>
  <input type="text" id="last-name" placeholder="Last Name" required>
  <input type="text" id="sdms" placeholder="SDMS Code (optional)">
  <select id="class-id" required>
    <option value="">Select Class</option>
  </select>
  <select id="gender">
    <option value="M">Male</option>
    <option value="F">Female</option>
    <option value="O">Other</option>
  </select>
  <button type="submit">Register Student</button>
</form>

<script>
document.getElementById('student-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const result = await StudentRegistration.registerIndividual(
    document.getElementById('first-name').value,
    document.getElementById('last-name').value,
    document.getElementById('sdms').value,
    document.getElementById('class-id').value,
    document.getElementById('gender').value
  );
  
  if (result.success) {
    toast('✅ Student registered successfully!', 'success');
  } else {
    toast(`❌ ${result.error}`, 'error');
  }
});
</script>
```

---

## 2. BULK STUDENT IMPORT

### CSV Format

**Option 1: Basic Format (Name, SDMS, Gender)**
```csv
John Doe,SDMS001,M
Jane Smith,SDMS002,F
Peter Johnson,SDMS003,M
```

**Option 2: Two-Part Name + Gender Only**
```csv
John Doe,M
Jane Smith,F
Peter Johnson,M
```

**Option 3: All Fields (First, Last, SDMS, Gender)**
```csv
John,Doe,SDMS001,M
Jane,Smith,SDMS002,F
Peter,Johnson,SDMS003,M
```

### Using Admin Portal

1. Go to **Admin Portal → Classes → Import Students Button**
2. Select target class from dropdown
3. **Choose one option:**
   - **Paste data** in the textarea (CSV format above)
   - **Upload CSV file** (.csv extension)
4. Click **"Confirm Import"**
5. Monitor import progress with toast notifications

### Using Teacher Portal

1. Go to **Teacher Portal → Select a Class**
2. Click **"Import Students"** button
3. **Choose one option:**
   - **Paste data** in the textarea
   - **Upload CSV file**
4. Click **"Confirm Import"**
5. Students are added to the selected class

### Programmatic Import

```javascript
// Parse CSV data
const csvData = `
John Doe,SDMS001,M
Jane Smith,SDMS002,F
Peter Johnson,SDMS003,M
`;

const classId = 'class-123';
const students = StudentRegistration.parseCSV(csvData, classId);

// Import with validation
const result = await StudentRegistration.bulkImport(students, classId);

if (result.success) {
  console.log(`✅ Imported ${result.imported}/${result.totalProcessed} students`);
  console.log('Students:', result.students);
} else {
  console.error('Import failed:', result.errors);
}
```

### Validation Rules

| Field | Rule | Example |
|-------|------|---------|
| **First Name** | Required, non-empty | "John" |
| **Last Name** | Required, non-empty | "Doe" |
| **SDMS Code** | Optional, string | "SDMS001" |
| **Gender** | M/F/O (case-insensitive) | "M", "F", "O" |
| **Class ID** | Required | UUID or numeric ID |

### Error Handling

The system validates all data and provides detailed error messages:

```javascript
const result = await StudentRegistration.bulkImport(students, classId);

// Structure of result object when there are errors:
{
  success: false,
  imported: 0,
  failed: 5,
  errors: [
    "Row 1: First name is required",
    "Row 3: Gender must be M, F, or O",
    "Row 5: Last name is required"
  ],
  totalProcessed: 5
}
```

---

## 3. TEACHER REGISTRATION

### Register a Teacher

```javascript
const result = await TeacherRegistration.registerIndividual(
  'John',              // firstName
  'Doe',               // lastName
  'john@school.com',   // email (required for login)
  '1234567890'         // sdmsCode (10 digits, required)
);

if (result.success) {
  console.log('Teacher registered:', result.profile);
  console.log('Temporary password:', result.tempPassword);
  // Share the temporary password with the teacher
} else {
  console.error('Error:', result.error);
}
```

### Teacher Auto-Generated Password

- Format: `Teacher@{LAST_4_DIGITS_OF_SDMS}`
- Example: If SDMS is `1234567890`, password is `Teacher@7890`
- Teachers must change this on first login

### Get School Teachers

```javascript
const teachers = await TeacherRegistration.getSchoolTeachers();
teachers.forEach(teacher => {
  console.log(`${teacher.full_name} (${teacher.email})`);
});
```

---

## 4. STUDENT QUERIES

### Get Students in a Class

```javascript
const students = await StudentRegistration.getClassStudents(classId);

students.forEach(student => {
  console.log(`${student.first_name} ${student.last_name} - Class: ${student.class_id}`);
});
```

### Using the Database Layer

```javascript
// Get all students in a class
const classStudents = await DB.getStudents('class-123');

// Get all students (all classes)
const allStudents = await DB.getStudents();

// Add a single student
const result = await DB.addStudent({
  first_name: 'John',
  last_name: 'Doe',
  sid: 'SDMS001',
  gender: 'M',
  class_id: 'class-123'
});

// Bulk add students
const result = await DB.addStudentsBatch([
  { first_name: 'John', last_name: 'Doe', class_id: 'class-123' },
  { first_name: 'Jane', last_name: 'Smith', class_id: 'class-123' }
]);

// Delete a student
const result = await DB.deleteStudent(studentId);
```

---

## 5. API REFERENCE

### StudentRegistration Object

```javascript
// Register individual student
StudentRegistration.registerIndividual(firstName, lastName, sdms, classId, gender)

// Parse CSV data
StudentRegistration.parseCSV(csvData, classId)

// Validate batch of students
StudentRegistration.validateBatch(students)

// Bulk import students
StudentRegistration.bulkImport(students, classId)

// Get students in a class
StudentRegistration.getClassStudents(classId)
```

### TeacherRegistration Object

```javascript
// Register individual teacher
TeacherRegistration.registerIndividual(firstName, lastName, email, sdmsCode)

// Get all teachers in school
TeacherRegistration.getSchoolTeachers()
```

### Database Layer (DB Object)

**Students:**
```javascript
DB.getStudents(classId?)           // Get students (optionally filtered by class)
DB.addStudent(studentObj)           // Add single student
DB.addStudentsBatch(studentsArray)  // Add multiple students (bulk)
DB.deleteStudent(id)                // Delete student
```

**Classes:**
```javascript
DB.getClasses()                    // Get all classes
DB.addClass(name)                  // Add single class
DB.addClassesBatch(names)          // Add multiple classes
DB.deleteClass(id)                 // Delete class
```

---

## 6. TROUBLESHOOTING

### Import showing no results
- ✅ Ensure CSV data is formatted correctly (name, sdms, gender)
- ✅ Check that data is separated by commas
- ✅ Verify class is selected before importing

### "No active class selected" error
- ✅ In teacher portal, select a class first
- ✅ In admin portal, choose target class from dropdown

### "Invalid gender" error
- ✅ Use only M, F, or O
- ✅ Case-insensitive (M, m, Male, etc. all work)

### Students not appearing after import
- ✅ Refresh the page (F5)
- ✅ Clear browser cache (Ctrl+Shift+Delete)
- ✅ Check browser console for errors (F12)

### School code filtering issues
- ✅ System automatically applies school_code filter
- ✅ Only admins/teachers in same school see their data
- ✅ Check sessionStorage: `sessionStorage.getItem('current_school_code')`

---

## 7. DATA FLOW

```
CSV Input (File/Paste)
    ↓
parseStudentCSV()
    ↓
validateStudentBatch()
    ↓
bulkImport()
    ↓
DB.addStudentsBatch()
    ↓
Supabase Insert
    ↓
Cache Invalidation (DB_CACHE.clear)
    ↓
UI Update & Toast Notification
```

---

## 8. VALIDATION PIPELINE

1. **CSV Parsing** - Extract fields from comma-separated data
2. **Field Validation** - Check required fields are present
3. **Type Validation** - Gender must be M/F/O
4. **Data Normalization** - Uppercase names, trim whitespace
5. **Database Insert** - Batch insert validated records
6. **Error Reporting** - Return detailed error list

---

## 9. EXAMPLES

### Complete Admin Import Workflow

```javascript
// 1. Get classes
const classes = await DB.getClasses();
console.log('Available classes:', classes);

// 2. Prepare student data
const csvData = `
Alice Johnson,SDMS001,F
Bob Smith,SDMS002,M
Carol Williams,SDMS003,F
`;

// 3. Parse and validate
const students = StudentRegistration.parseCSV(csvData, classes[0].id);
const validation = StudentRegistration.validateBatch(students);

if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
  return;
}

// 4. Bulk import
const result = await StudentRegistration.bulkImport(students, classes[0].id);

if (result.success) {
  console.log(`✅ Imported ${result.imported} students`);
} else {
  console.error(`❌ Failed to import. Errors:`, result.errors);
}
```

### Complete Teacher Registration Workflow

```javascript
// 1. Register teacher
const teacherResult = await TeacherRegistration.registerIndividual(
  'Jane',
  'Doe',
  'jane@school.com',
  '1234567890'
);

if (teacherResult.success) {
  // 2. Share credentials
  console.log('Teacher Email:', teacherResult.profile.email);
  console.log('Temporary Password:', teacherResult.tempPassword);
  
  // 3. Get all teachers in school
  const teachers = await TeacherRegistration.getSchoolTeachers();
  console.log('Total teachers:', teachers.length);
}
```

---

## 10. BEST PRACTICES

✅ **DO:**
- Validate data before bulk import
- Provide clear error feedback to users
- Clear form after successful import
- Test with small batches first
- Use consistent naming conventions

❌ **DON'T:**
- Skip validation for bulk imports
- Mix different CSV formats in same file
- Import duplicate students multiple times
- Ignore error messages
- Leave temporary passwords unshared with teachers

---

## 11. FILE LOCATIONS

- **Registration Logic:** `js/registration.js`
- **Database Layer:** `js/db.js`
- **Admin UI:** `admin-portal.html` + `js/admin.js`
- **Teacher UI:** `teacher-portal.html` + `js/teacher.js`

---

## 12. SUPPORT & DEBUGGING

### Enable Debug Logging

```javascript
// Check console for [REGISTRATION], [IMPORT], [STUDENT], [TEACHER] messages
console.log = (msg) => {
  if (msg.includes('[')) {
    console.error(msg);  // Force visibility
  }
};
```

### Test the System

```javascript
// Quick test in browser console
const students = StudentRegistration.parseCSV(
  'John Doe,SDMS001,M\nJane Smith,SDMS002,F',
  'test-class-id'
);
console.log('Parsed students:', students);
```

---

**Version:** 1.0  
**Last Updated:** April 2026  
**Status:** ✅ Production Ready
