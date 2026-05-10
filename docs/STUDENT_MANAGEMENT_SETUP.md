# ✅ STUDENT MANAGEMENT SYSTEM - QUICK SETUP CHECKLIST

## Pre-Implementation
- [ ] Review STUDENT_MANAGEMENT_GUIDE.md
- [ ] Ensure Supabase `students` table exists (check FINAL_INSTITUTIONAL_SCHEMA.sql)
- [ ] Verify students table has RLS policies configured
- [ ] Backup existing database

## File Installation

### 1. Add JavaScript Module
- [ ] Copy `js/student-management.js` to your project
- [ ] Verify file is in correct location

### 2. Add HTML Components  
- [ ] Create `html/` folder if not exists
- [ ] Copy `html/student-management-modals.html` to project
- [ ] Verify file path in script tags

## Integration into Teacher Portal (teacher-portal.html)

### Step 1: Add Script Reference
```html
<!-- Add before </body> tag -->
<script src="js/student-management.js"></script>
```

### Step 2: Include Modals
```html
<!-- Add before </body> tag, after other scripts -->
<div id="modals-container"></div>
<script>
  (function loadModals() {
    fetch('html/student-management-modals.html')
      .then(r => r.text())
      .then(html => {
        document.getElementById('modals-container').innerHTML = html;
        if (window.lucide) lucide.createIcons();
      })
      .catch(e => console.error('[SM] Failed to load modals:', e));
  })();
</script>
```

### Step 3: Initialize StudentManager
In `teacher.js`, in your initialization function:
```javascript
// After user role is confirmed
if (role === 'teacher') {
    // Get user's class assignment
    const { data: assignment } = await _supabase
        .from('teacher_assignments')
        .select('class_id, school_code')
        .eq('teacher_id', user.id)
        .eq('type', 'class')
        .maybeSingle();
    
    // Initialize
    await StudentManager.init(user, 'teacher', assignment.school_code, assignment.class_id);
    
    // Listen for updates
    listenForStudentUpdates(async () => {
        // Refresh student list if exists
        if (typeof refreshStudentList === 'function') {
            await refreshStudentList();
        }
    });
}
```

### Step 4: Add Student List UI
In teacher portal content area, add:
```html
<!-- Student Management Section -->
<section id="student-section" class="panel" style="background: white; border-radius: 20px; border: 1px solid #e5e7eb; padding: 2rem; margin-bottom: 2rem;">
    <div id="student-list-container"></div>
</section>
```

### Step 5: Add Render Function
```javascript
async function renderStudentList() {
    const students = await getStudentList(StudentManager.currentSchool, StudentManager.currentClass);
    const tbody = document.getElementById('students-list-tbody');
    
    if (!tbody) return;
    
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:3rem; color:#94a3b8;">No students in this class yet.</td></tr>';
        return;
    }
    
    tbody.innerHTML = students.map(s => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 1rem 2rem; font-weight: 600;">${s.full_name}</td>
            <td style="padding: 1rem;">${s.sdms_code || '-'}</td>
            <td style="padding: 1rem;">${s.gender === 'M' ? '♂️ Male' : s.gender === 'F' ? '♀️ Female' : '-'}</td>
            <td style="padding: 1rem; text-align: right;">
                <button onclick="viewStudent('${s.id}')" style="padding: 0.4rem 0.8rem; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.75rem; font-weight: 600;">View</button>
            </td>
        </tr>
    `).join('');
    
    document.getElementById('student-count').textContent = students.length;
    if (window.lucide) lucide.createIcons();
}
```

### Step 6: Call on Initialization
```javascript
// After StudentManager initialized
await renderStudentList();
```

## Integration into Admin Portal (admin-portal.html)

### Same 6 Steps as Teacher Portal, but:

### Modified Step 3: Initialize for Admin
```javascript
if (role === 'admin') {
    const { data: profile } = await _supabase
        .from('profiles')
        .select('organization_id')  // or school_code
        .eq('id', user.id)
        .maybeSingle();
    
    await StudentManager.init(user, 'admin', profile.organization_id, null);
    
    listenForStudentUpdates(async () => {
        await renderStudentList();
    });
}
```

### Modified Step 4: Add Class Selector
```html
<!-- Admin can select class to view students -->
<div style="margin-bottom: 1.5rem; display: flex; gap: 1rem;">
    <select id="admin-class-filter" onchange="onAdminClassSelected(this.value)" style="padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 8px;">
        <option value="">-- Select Class --</option>
    </select>
</div>

<section id="student-section" class="panel" style="background: white; border-radius: 20px; border: 1px solid #e5e7eb; padding: 2rem; margin-bottom: 2rem;">
    <div id="student-list-container"></div>
</section>
```

### Modified Step 5: Add Class Selector Handler
```javascript
async function onAdminClassSelected(classId) {
    if (!classId) return;
    StudentManager.currentClass = classId;
    await renderStudentList();
}

async function populateAdminClassSelect() {
    const select = document.getElementById('admin-class-filter');
    const { data: classes } = await _supabase
        .from('classes')
        .select('id, class_name')
        .eq('school_code', StudentManager.currentSchool)
        .order('class_name');
    
    select.innerHTML = '<option value="">-- Select Class --</option>';
    classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.class_name;
        select.appendChild(opt);
    });
}
```

## Integration into System Admin Portal (system-admin-portal.html)

### Same 6 Steps as Others, but:

### Modified Step 3: Initialize for System Admin
```javascript
if (role === 'system_admin') {
    // System admin doesn't have specific school/class
    await StudentManager.init(user, 'system_admin', null, null);
    
    listenForStudentUpdates(async () => {
        await renderStudentList();
    });
}
```

### Modified Step 4: Add Filters
```html
<!-- System admin can select school and class -->
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
    <select id="sysadmin-school-filter" onchange="onSysAdminSchoolSelected(this.value)" style="padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 8px;">
        <option value="">-- Select School --</option>
    </select>
    <select id="sysadmin-class-filter" onchange="onSysAdminClassSelected(this.value)" style="padding: 0.75rem; border: 1px solid #e5e7eb; border-radius: 8px;">
        <option value="">-- Select Class --</option>
    </select>
</div>

<section id="student-section">
    <div id="student-list-container"></div>
</section>
```

### Modified Step 5: Add Handlers
```javascript
async function populateSysAdminSchools() {
    const select = document.getElementById('sysadmin-school-filter');
    const { data: schools } = await _supabase
        .from('schools')
        .select('sdms_code, name')
        .order('name');
    
    select.innerHTML = '<option value="">-- Select School --</option>';
    schools.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.sdms_code;
        opt.textContent = s.name;
        select.appendChild(opt);
    });
}

async function onSysAdminSchoolSelected(schoolCode) {
    if (!schoolCode) return;
    StudentManager.currentSchool = schoolCode;
    await populateSysAdminClassSelect();
    document.getElementById('sysadmin-class-filter').value = '';
}

async function populateSysAdminClassSelect() {
    const select = document.getElementById('sysadmin-class-filter');
    const { data: classes } = await _supabase
        .from('classes')
        .select('id, class_name')
        .eq('school_code', StudentManager.currentSchool)
        .order('class_name');
    
    select.innerHTML = '<option value="">-- All Classes --</option>';
    classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.class_name;
        select.appendChild(opt);
    });
}

async function onSysAdminClassSelected(classId) {
    StudentManager.currentClass = classId;
    await renderStudentList();
}
```

## Testing Checklist

### Test 1: Manual Student Addition
- [ ] Teacher clicks "Add Student"
- [ ] Form shows only: Full Name, SDMS Code, Gender (Class hidden)
- [ ] Can add student successfully
- [ ] Student appears in list
- [ ] Other portals see update in real-time

### Test 2: Bulk Import
- [ ] Admin clicks "Import Students"
- [ ] Can upload sample CSV
- [ ] Preview shows valid/invalid records
- [ ] Import processes multiple students
- [ ] Duplicate SDMS codes rejected

### Test 3: Permission Enforcement
- [ ] Teacher cannot add student to another class
- [ ] Admin cannot add student to another school
- [ ] System admin can add to any school/class
- [ ] Error messages show for unauthorized access

### Test 4: Role-Based UI
- [ ] Teacher: Class field hidden
- [ ] Admin: School dropdown visible, Class selectable
- [ ] System Admin: Both school and class selectable
- [ ] Form validation works correctly

### Test 5: Real-Time Sync
- [ ] Add student in teacher portal
- [ ] Immediately visible in admin portal (no refresh)
- [ ] Bulk import updates all portals
- [ ] System admin portal shows all changes

## Deployment Checklist
- [ ] All scripts linked correctly
- [ ] Modals loading successfully
- [ ] StudentManager initialization working
- [ ] Real-time listeners active
- [ ] Permission checks enforced
- [ ] CSV import validates correctly
- [ ] Database RLS policies correct
- [ ] No console errors
- [ ] Mobile responsive (if needed)
- [ ] Production tested

## Troubleshooting Links
- See STUDENT_MANAGEMENT_GUIDE.md → Troubleshooting section
- Check browser console: `F12` → Console tab
- Verify StudentManager state: `console.log(StudentManager)`
- Check permissions: `console.log(StudentManager.getPermissions())`

## Rollback Plan
If issues occur:
1. Comment out `<script src="js/student-management.js">` line
2. Remove modals HTML
3. Remove StudentManager initialization code
4. Portals continue working without student management
5. No data loss

---

**Ready to implement?** Start with Step 1 of Teacher Portal integration!

Questions? Review the full STUDENT_MANAGEMENT_GUIDE.md
