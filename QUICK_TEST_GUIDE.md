# Registration & Import - Quick Test Guide

## 🚀 Quick Start

### Admin Portal - Import Students

1. Open **Admin Portal** (admin-portal.html)
2. Navigate to **Classes** section
3. Click **"Import Students"** button
4. Select target class
5. **Paste this data:**
   ```
   Alice Johnson,SDMS001,F
   Bob Smith,SDMS002,M
   Carol Williams,SDMS003,F
   ```
6. Click **"Confirm Import"**
7. See toast: **"✅ Successfully imported 3/3 students!"**

---

## 👨‍🏫 Teacher Portal - Import Students

1. Open **Teacher Portal** (teacher-portal.html)
2. **Select a class** from the left sidebar
3. Click **"Import Students"** button in the class section
4. **Paste this data:**
   ```
   David Johnson,SDMS101,M
   Emma Davis,SDMS102,F
   Frank Miller,SDMS103,M
   ```
5. Click **"Confirm Import"**
6. Students appear in the class registry
7. Form clears automatically

---

## 💻 Browser Console Tests

### Test 1: Parse CSV

```javascript
// Paste this in browser console (F12)
const csv = `
John Doe,SDMS001,M
Jane Smith,SDMS002,F
Peter Brown,SDMS003,M
`;

const students = StudentRegistration.parseCSV(csv, 'test-class-id');
console.log('Parsed:', students);
```

**Expected Output:**
```javascript
[
  { first_name: "John", last_name: "Doe", sid: "SDMS001", gender: "M", ... },
  { first_name: "Jane", last_name: "Smith", sid: "SDMS002", gender: "F", ... },
  { first_name: "Peter", last_name: "Brown", sid: "SDMS003", gender: "M", ... }
]
```

---

### Test 2: Validate Data

```javascript
const students = [
  { first_name: "John", last_name: "Doe", gender: "M", class_id: "123" },
  { first_name: "Jane", last_name: "Smith", gender: "F", class_id: "123" }
];

const validation = StudentRegistration.validateBatch(students);
console.log('Valid?', validation.valid);
console.log('Errors:', validation.errors);
console.log('Valid records:', validation.validatedStudents.length);
```

---

### Test 3: Register Single Student

```javascript
// Get a class ID first
const classes = await DB.getClasses();
console.log('Classes:', classes);

// Then register student
const result = await StudentRegistration.registerIndividual(
  'Test',
  'Student',
  'SDMS999',
  classes[0].id,  // Use actual class ID
  'M'
);

console.log('Success?', result.success);
console.log('Student:', result.student);
```

---

### Test 4: Register Teacher

```javascript
const result = await TeacherRegistration.registerIndividual(
  'John',
  'Teacher',
  'john.teacher@school.com',
  '1234567890'
);

if (result.success) {
  console.log('✅ Teacher registered!');
  console.log('Email:', result.profile.email);
  console.log('Temp Password:', result.tempPassword);
} else {
  console.log('❌ Error:', result.error);
}
```

---

### Test 5: Get All Teachers in School

```javascript
const teachers = await TeacherRegistration.getSchoolTeachers();
console.log(`Found ${teachers.length} teachers:`);
teachers.forEach(t => {
  console.log(`  - ${t.full_name} (${t.email})`);
});
```

---

### Test 6: Bulk Import (Programmatic)

```javascript
// 1. Create sample data
const studentData = [
  { first_name: 'Tom', last_name: 'Hardy', sid: 'SDMS201', gender: 'M', class_id: 'your-class-id' },
  { first_name: 'Amy', last_name: 'Wilson', sid: 'SDMS202', gender: 'F', class_id: 'your-class-id' },
  { first_name: 'Ben', last_name: 'Lee', sid: 'SDMS203', gender: 'M', class_id: 'your-class-id' }
];

// 2. Bulk import
const result = await StudentRegistration.bulkImport(studentData, 'your-class-id');

console.log('Results:');
console.log(`✅ Imported: ${result.imported}`);
console.log(`❌ Failed: ${result.failed}`);
console.log('Errors:', result.errors);
```

---

## CSV File Format

### Create a CSV File

1. Open Notepad
2. Paste this content:
```
Alice Johnson,SDMS001,F
Bob Smith,SDMS002,M
Carol Williams,SDMS003,F
David Brown,SDMS004,M
```
3. Save as **students.csv**
4. Upload in Admin/Teacher Portal

---

## 🔍 Verification Steps

### Verify Students Imported

1. Go to **Student Registry** (Admin Portal)
2. Select the class you imported to
3. See new students in the list

### Verify Teacher Created

1. Check **Staff/Teachers** section in Admin Portal
2. New teacher should appear in the list

### Check Database Directly

```javascript
// Show all students in a class
const students = await DB.getStudents('class-id-here');
console.table(students);

// Show all teachers
const teachers = await TeacherRegistration.getSchoolTeachers();
console.table(teachers);
```

---

## ⚠️ Common Issues & Fixes

### Issue: "No valid students found"
**Solution:** Check CSV format - should be: `FirstName LastName,SDMS,Gender`

### Issue: "No active class selected"
**Solution:** In teacher portal, select a class before clicking Import

### Issue: Students don't appear
**Solution:** 
1. Refresh page (F5)
2. Check browser console for errors (F12)
3. Verify class was selected

### Issue: Gender validation error
**Solution:** Use only M, F, or O (case doesn't matter)

---

## 📊 CSV Format Variations

All of these formats work:

**Format A:** Full names + SDMS + Gender
```csv
John Doe,SDMS001,M
Jane Smith,SDMS002,F
```

**Format B:** Full names + Gender only
```csv
John Doe,M
Jane Smith,F
```

**Format C:** Split names + SDMS + Gender
```csv
John,Doe,SDMS001,M
Jane,Smith,SDMS002,F
```

---

## 🎯 Success Indicators

✅ CSV uploads without errors  
✅ Students appear in registry immediately  
✅ Toast shows success message  
✅ Console shows no red errors  
✅ Teachers can log in with provided password  
✅ Admin can see all students in class  
✅ Teacher portal shows their assigned students  

---

## 📱 Testing on Different Screen Sizes

```javascript
// Test responsive UI
// 1. Open DevTools (F12)
// 2. Click device toolbar icon (top-left)
// 3. Test on:
//    - iPhone SE (375px)
//    - iPad (768px)
//    - Desktop (1920px)
```

---

## ✅ Final Checklist

- [ ] Admin can import 1-2 students successfully
- [ ] Teacher can import students to a selected class
- [ ] CSV file upload works
- [ ] Paste data works
- [ ] Validation catches bad data
- [ ] Toast notifications appear
- [ ] Success message shows count
- [ ] Students appear in registry after import
- [ ] Teacher registration works
- [ ] All school code filtering works

---

## 🆘 Get Help

1. **Check Errors:** Open DevTools (F12) → Console tab
2. **Read Logs:** Look for messages starting with `[IMPORT]`, `[STUDENT]`, `[TEACHER]`
3. **Test Manually:** Try the console tests above
4. **Check Docs:** Read `REGISTRATION_IMPORT_GUIDE.md`

---

**Status:** Ready to Test ✅
