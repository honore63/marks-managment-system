# 🔐 RBAC Security - Quick Reference

## One-Liner Setup

### 1. Add to HTML (all portals)
```html
<script src="js/security-access-control.js"></script>
```

### 2. After Login
```javascript
await ACCESS_CONTROL.init(user);
```

### 3. Use in Queries
```javascript
const query = SecureQueryBuilder.studentsQuery({ classId });
const { data: students } = await query;
```

---

## Access Checks

### Can User Do This?
```javascript
if (!ACCESS_CONTROL.canAccessStudent(student)) {
    throw new Error('Access denied');
}

if (!ACCESS_CONTROL.canPerformAction('edit_marks', 'marks')) {
    throw new Error('Permission denied');
}
```

### Which Data Can User See?
```javascript
// System Admin: All schools
// Admin: Their school only
// Teacher: Their classes/subjects only

if (ACCESS_CONTROL.userRole === 'system_admin') {
    // Show all schools
}
```

---

## Query Patterns

### Pattern 1: Get All Students (Filtered)
```javascript
const query = SecureQueryBuilder.studentsQuery();
const { data: students, error } = await query;
```

### Pattern 2: Get Students in Class (Filtered)
```javascript
const query = SecureQueryBuilder.studentsQuery({ classId: 'xyz' });
const { data: students, error } = await query;
```

### Pattern 3: Get Marks for Teacher (Filtered)
```javascript
const query = SecureQueryBuilder.marksQuery();
const { data: marks, error } = await query;
// Automatically limited to teacher's classes/subjects
```

### Pattern 4: Real-Time Student Updates
```javascript
RealTimeFilter.listenToStudentUpdates((payload) => {
    // Only fires for authorized students
    console.log('Update:', payload);
});
```

---

## User Context

```javascript
ACCESS_CONTROL.userRole        // 'system_admin', 'admin', 'teacher'
ACCESS_CONTROL.userSchool      // 'SDMS_CODE', e.g., '541021'
ACCESS_CONTROL.userClasses     // [] of assigned class IDs (teachers only)
ACCESS_CONTROL.userSubjects    // [] of assigned subject IDs (teachers only)
ACCESS_CONTROL.currentUser     // { id: UUID, email, ... }
```

---

## Permissions Matrix

### System Admin
| Action | Status |
|--------|--------|
| View all schools | ✅ |
| View all admins | ✅ |
| View all teachers | ✅ |
| View all students | ✅ |
| Create/edit anything | ✅ |
| Delete anything | ✅ |
| Approve marks | ✅ |

### Admin
| Action | Status |
|--------|--------|
| View own school only | ✅ |
| View other schools | ❌ |
| Create/edit teachers | ✅ |
| Create/edit students | ✅ |
| Edit marks | ✅ |
| Delete students | ✅ |
| Approve marks | ✅ |

### Teacher
| Action | Status |
|--------|--------|
| View assigned classes | ✅ |
| View other classes | ❌ |
| Create students in class | ✅ |
| Edit students in class | ✅ |
| Delete students | ❌ |
| Create marks | ✅ |
| Edit marks | ✅ |
| Delete marks | ❌ |
| Approve marks | ❌ |

---

## Error Handling

```javascript
try {
    ACCESS_CONTROL.validateAccess('edit_student', 'students');
    // Action is allowed
} catch (e) {
    if (e.code === 'ACCESS_DENIED') {
        toast('You don\'t have permission', 'error');
    }
}
```

---

## Logging

```javascript
// Log successful action
await AccessAudit.logAccess('viewed_student', 'students', true);

// Log denied access
await AccessAudit.logDenied('edit_marks', 'marks', 'Not assigned to subject');
```

---

## Common Mistakes

### ❌ Mistake 1
```javascript
// WRONG - No filtering
await _supabase.from('students').select('*');
```
✅ Use: `SecureQueryBuilder.studentsQuery()`

### ❌ Mistake 2
```javascript
// WRONG - Setup incomplete
loadStudents(); // ACCESS_CONTROL not initialized
```
✅ Do: `await ACCESS_CONTROL.init(user)` first

### ❌ Mistake 3
```javascript
// WRONG - Frontend only validation
if (role === 'admin') showButton();
```
✅ Also: RLS policies enforce on backend

### ❌ Mistake 4
```javascript
// WRONG - Not filtering updates
_supabase.on('postgres_changes', callback).subscribe();
```
✅ Use: `RealTimeFilter.listenToStudentUpdates(callback)`

---

## Data Isolation by Role

### System Admin
```
📊 Can see:
  ├─ All schools
  ├─ All admins
  ├─ All teachers
  ├─ All students
  ├─ All marks
  ├─ All reports
```

### School Admin
```
📊 Can see:
  ├─ Their school only
  ├─ Teachers in their school
  ├─ Students in their school
  ├─ Classes in their school
  ├─ Marks in their school
  ├─ Reports for their school
```

### Teacher
```
📊 Can see:
  ├─ Own profile
  ├─ Assigned classes
  ├─ ├─ Students in classes
  ├─ ├─ Marks for students
  ├─ Assigned subjects
  ├─ Reports for own data
```

---

## RLS Policies Deployed

✅ `profiles` - Role-based access
✅ `students` - School/class isolation
✅ `marks` - Subject/class filtering
✅ `classes` - School isolation
✅ `subjects` - School isolation
✅ `teacher_assignments` - School isolation
✅ `schools` - Admin-to-own-school
✅ `notifications` - School/personal

---

## Testing Checklist

- [ ] System Admin can access all data
- [ ] Admin A cannot see Admin B's school
- [ ] Teacher cannot access other teachers' classes
- [ ] Teacher cannot create marks outside assigned subjects
- [ ] Real-time updates respect permissions
- [ ] Audit logs show all access attempts
- [ ] RLS policies working (try SQL bypass - should fail)
- [ ] Performance acceptable with filters

---

## Audit Trail

Check `/memories/session/` for:
- User access events
- Denied attempts
- Permission changes
- Data modifications

Query:
```sql
SELECT * FROM audit_logs 
WHERE created_at > now() - interval '24 hours'
ORDER BY created_at DESC;
```

---

## Support

**For each role, use a separate approach:**

**System Admin DB calls:**
```javascript
// Can access full system
const query = _supabase.from('students').select('*');
// RLS will not restrict - full data returned
```

**Admin DB calls:**
```javascript
// Auto-filtered to their school
const query = SecureQueryBuilder.studentsQuery();
// RLS adds: WHERE school_code = 'their_school'
```

**Teacher DB calls:**
```javascript
// Auto-filtered to their classes/subjects
const query = SecureQueryBuilder.marksQuery();
// RLS adds: WHERE class_id IN (teacher_classes) 
//           AND subject_id IN (teacher_subjects)
```

---

**Quick Setup Time:** ~5 minutes per portal  
**Security Layers:** 3 (RLS + Frontend + Audit)  
**Status:** ✅ Production Ready
