# MULTI-ADMIN SYNCHRONIZED PORTAL IMPLEMENTATION GUIDE

## 📚 Overview

This guide walks you through implementing a unified multi-admin portal system where:
- ✅ All admins with the same 6-digit school code access ONE portal
- ✅ Data changes sync in real-time across all logged-in admins
- ✅ All queries automatically filter by school_code
- ✅ Real-time notifications notify all admins of changes

---

## 🚀 IMPLEMENTATION STEPS

### STEP 1: Database Setup (CRITICAL)

**File:** `MULTI_ADMIN_SYNC_SETUP.sql`

1. Copy the entire SQL content
2. Go to **Supabase Dashboard** → **SQL Editor** → **New Query**
3. Paste the SQL and run it in sections (don't run all at once)
4. Follow the checkpoints in the SQL file

**Key SQL Components:**
- ✅ Add `school_code` columns to all tables (profiles, students, classes, marks, assessments, etc)
- ✅ Create `schools` table (central registry of schools with 6-digit codes)
- ✅ Create `school_settings` table (per-school configuration)
- ✅ Enable `REPLICA IDENTITY FULL` on all tables (for real-time)
- ✅ Create PL/pgSQL triggers to enforce school_code rules

**After SQL runs, CRITICAL STEP:**
1. Go to **Supabase Dashboard** → **Database** → **Replication**
2. Click **"supabase_realtime"** publication
3. Toggle **ON** for these tables:
   - ✅ profiles
   - ✅ students
   - ✅ classes
   - ✅ marks
   - ✅ teacher_assignments
   - ✅ schools
   - ✅ school_settings
   - ✅ assessments

---

### STEP 2: Add Enhanced Functions to db.js

**File:** `MULTI_ADMIN_SYNC_FUNCTIONS.js`

1. Copy all functions from `MULTI_ADMIN_SYNC_FUNCTIONS.js`
2. Paste into your `js/db.js` file at the end (before closing brace)
3. These functions implement:
   - `getCurrentSchoolCode()` - Get current user's school
   - `registerUserWithSchoolCode()` - Register with school enforcement
   - `fetchSchoolSettings()` - Load school info from database
   - `subscribeToSchoolChanges()` - Real-time sync per school
   - `broadcastToSchool()` - Notify all admins in school
   - `verifySchoolDataConsistency()` - Data integrity checks

---

### STEP 3: Add Admin Registration Modal to index.html

**File:** `ADMIN_REGISTRATION_MODAL.html`

1. Copy the entire HTML from this file
2. Paste into your `index.html` (or wherever your login page is)
3. Place the modal divs before closing `</body>` tag
4. Include the JavaScript handlers (in a `<script>` tag)
5. Include the CSS styles in your stylesheet

**Features:**
- ✅ School code verification (validates 6-digit code exists in DB)
- ✅ New admin registration with school code enforcement
- ✅ Existing admin login
- ✅ Clear instructions about unified portal rules
- ✅ Real-time school name lookup

---

### STEP 4: Update Admin Portal Initialization

**File:** `js/admin.js`

Add this code to your admin portal's initialization (in a `pageSetup()` or `init()` function):

```javascript
// On admin portal page load
async function initializeAdminPortal() {
  try {
    // 1. Get current user
    const { data: { user } } = await _supabase.auth.getUser();
    if (!user) {
      window.location.href = '/index.html';
      return;
    }

    // 2. Get user's school code
    const schoolCode = await getCurrentSchoolCode();
    console.log(`[ADMIN] Logged in to school: ${schoolCode}`);

    // 3. Fetch school settings from database
    const schoolSettings = await fetchSchoolSettings(schoolCode);
    if (schoolSettings && schoolSettings.info) {
      // Update SCHOOL_INFO with database values
      SCHOOL_INFO = {
        ...SCHOOL_INFO,
        ...schoolSettings.info
      };
      console.log('[ADMIN] Loaded school info:', SCHOOL_INFO);
    }

    // 4. Update UI with school name and code
    updateSchoolHeader(SCHOOL_INFO);

    // 5. Track this admin as active
    await updateLastSync();

    // 6. Show other active admins in this school
    const activeAdmins = await getAdminsInSchool(schoolCode);
    console.log(`[ADMIN] ${activeAdmins.length} other admins active in this school`);
    updateAdminsList(activeAdmins);

    // 7. Enable real-time sync for this school
    subscribeToSchoolChanges(schoolCode);

    // 8. Listen for real-time updates
    setupRealtimeListeners(schoolCode);

  } catch (error) {
    console.error('[ADMIN] Initialization error:', error);
    toast('Failed to initialize portal. Please refresh.', 'error');
  }
}

// Call this on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAdminPortal);
} else {
  initializeAdminPortal();
}
```

---

### STEP 5: Update School Header Display

Replace the hardcoded `SCHOOL_INFO` in admin.js:

**OLD CODE:**
```javascript
let SCHOOL_INFO = { 
    school: 'RUKARA MODEL SCHOOL', 
    code: '541023',
    // ... other hardcoded values
};
```

**NEW CODE:**
```javascript
let SCHOOL_INFO = { 
    republic: 'REPUBLIC OF RWANDA',
    ministry: 'MINISTRY OF EDUCATION',
    school: 'Loading...', // Will be updated from DB
    code: 'DEFAULT',      // Will be updated from DB
    district: '...',
    sector: '...'
};

// This will be called on page load and updated from database
async function updateSchoolHeader(schoolInfo) {
  const schoolNameEl = document.getElementById('school-name-hd');
  const schoolCodeEl = document.getElementById('school-code-hd');
  
  if (schoolNameEl) schoolNameEl.textContent = schoolInfo.school || 'MMS Portal';
  if (schoolCodeEl) schoolCodeEl.textContent = `School ID • ${schoolInfo.code || 'DEFAULT'}`;
  
  console.log('[UI] Updated header with:', schoolInfo);
}
```

---

### STEP 6: Setup Real-Time Update Listeners

Add to your admin.js:

```javascript
// Listen for real-time changes and update UI
function setupRealtimeListeners(schoolCode) {
  // Listen for new students
  SYNC.on('students', (payload) => {
    console.log('[UPDATE] Student data changed:', payload.eventType);
    // Refresh students list
    loadStudents();
    // Notify admin
    toast('📚 Student records updated by another admin', 'info');
  });

  // Listen for new marks
  SYNC.on('marks', (payload) => {
    console.log('[UPDATE] Marks changed:', payload.eventType);
    // Refresh marks view
    loadMarks();
    if (payload.new?.is_approved) {
      toast('✅ Marks approved by another admin', 'success');
    }
  });

  // Listen for teacher changes
  SYNC.on('teachers', (payload) => {
    console.log('[UPDATE] Staff changed:', payload.eventType);
    loadTeachers();
  });

  // Listen for school settings changes
  SYNC.on('school_settings', (payload) => {
    console.log('[UPDATE] School settings changed');
    // Reload everything
    toast('🔄 School settings updated, refreshing...', 'info');
  });
}
```

---

### STEP 7: Update Teacher Portal Similarly

The same pattern applies to `teacher-portal.html` and `js/teacher.js`:

```javascript
// On teacher portal load
async function initializeTeacherPortal() {
  const schoolCode = await getCurrentSchoolCode();
  const schoolSettings = await fetchSchoolSettings(schoolCode);
  
  // Update UI with school info
  if (schoolSettings && schoolSettings.info) {
    document.getElementById('dash-school-name').textContent = schoolSettings.info.school;
  }

  // Subscribe to marks changes
  SYNC.on('marks', (payload) => {
    if (payload.eventType === 'UPDATE') {
      console.log('Your marks were updated by admin');
      loadMyMarks();
    }
  });

  // Enable real-time
  subscribeToSchoolChanges(schoolCode);
}
```

---

## 🔒 CRITICAL RULES TO ENFORCE

### Rule 1: All Queries Must Filter by School Code

**❌ WRONG:**
```javascript
const { data } = await _supabase.from('students').select('*');
```

**✅ CORRECT:**
```javascript
const schoolCode = await getCurrentSchoolCode();
const { data } = await _supabase
  .from('students')
  .select('*')
  .eq('school_code', schoolCode);
```

### Rule 2: All Inserts Must Include school_code

**❌ WRONG:**
```javascript
await _supabase.from('students').insert([{
  name: 'John Doe',
  class_id: '123'
}]);
```

**✅ CORRECT:**
```javascript
const schoolCode = await getCurrentSchoolCode();
await _supabase.from('students').insert([{
  name: 'John Doe',
  class_id: '123',
  school_code: schoolCode  // REQUIRED
}]);
```

### Rule 3: One School Code = One Portal

- If Admin A logs in with school code **541021**
- And Admin B logs in with school code **541021**
- They MUST see the same data
- Any action by A appears instantly to B

---

## 📊 TESTING THE SYNCHRONIZED PORTAL

### Test Scenario 1: Multiple Admins, Real-Time Updates

1. **Admin A** logs in with school code `541021`
2. **Admin B** logs in with code **same** `541021` (in a different browser/incognito)
3. **Admin A** adds a new student "Test Student"
4. **Result:** Admin B should see "Test Student" appear instantly (within 1-2 seconds)

### Test Scenario 2: School Code Enforcement

1. Try registering Admin with code `999999` (doesn't exist)
2. **Result:** Should show error: "School code not found"
3. Register with existing code `541021`
4. **Result:** Should show "✅ Found: GSNYAGAHANDAGAZA" and register successfully

### Test Scenario 3: Data Isolation

1. Create Admin for school `541021`
2. Create Admin for school `999999` (if it exists)
3. Admin for 541021 logs in
4. **Result:** Should ONLY see students/marks/teachers for school 541021
5. Should NOT see data from school 999999

---

## 🛠️ CONFIGURATION FILES CREATED

| File | Purpose |
|------|---------|
| `MULTI_ADMIN_SYNC_SETUP.sql` | Database schema & real-time setup |
| `MULTI_ADMIN_SYNC_FUNCTIONS.js` | Enhanced DB functions for multi-admin |
| `ADMIN_REGISTRATION_MODAL.html` | Admin registration/login UI |
| `IMPLEMENTATION_GUIDE.md` | This guide |

---

## ⚡ QUICK CHECKLIST

### Database Setup
- [ ] Run all SQL from `MULTI_ADMIN_SYNC_SETUP.sql`
- [ ] Enable Supabase Realtime for all required tables
- [ ] Insert your school code into `schools` table
- [ ] Verify data migration (school_code populated)

### Code Integration
- [ ] Copy functions from `MULTI_ADMIN_SYNC_FUNCTIONS.js` to `js/db.js`
- [ ] Add registration modal to `index.html`
- [ ] Update `admin.js` with `initializeAdminPortal()`
- [ ] Update `teacher.js` with `initializeTeacherPortal()`
- [ ] Replace hardcoded `SCHOOL_INFO` with dynamic loading
- [ ] Add real-time listeners with `setupRealtimeListeners()`

### Testing
- [ ] Test registration with valid school code
- [ ] Test login with multiple admins
- [ ] Test real-time sync (add student in one tab, see in another)
- [ ] Test school code isolation (different schools don't see each other's data)

### Monitoring
- [ ] Check browser console for `[SYNC]` logs
- [ ] Monitor Supabase Realtime in dashboard
- [ ] Test with slow network (ensure sync still works)
- [ ] Test with multiple simultaneous edits

---

## 🆘 TROUBLESHOOTING

### Problem: Real-time sync not working
**Solution:**
1. Check Supabase Realtime publication is enabled for tables
2. Check browser console for `[SYNC]` connection logs
3. Verify `school_code` column exists in all tables
4. Check RLS policies aren't blocking updates

### Problem: Admins seeing different data
**Solution:**
1. Verify all queries filter by `school_code`
2. Check that `school_code` is populated for all records
3. Run consistency check: `verifySchoolDataConsistency('541021')`
4. Clear cache: `DB_CACHE.clear()`

### Problem: Registration failing with "School not found"
**Solution:**
1. Verify school code exists in `schools` table
2. Check spelling and length (must be 6 digits)
3. Run: `SELECT * FROM schools WHERE code = '541021';`
4. Insert school if missing:
   ```sql
   INSERT INTO schools (code, name, district, sector)
   VALUES ('541021', 'GSNYAGAHANDAGAZA', 'KAYONZA', 'GAHINI');
   ```

### Problem: Admin updates not showing in real-time
**Solution:**
1. Verify other admin is viewing same `school_code`
2. Check network tab - should see WebSocket connection to Supabase
3. Wait 1-2 seconds (real-time has slight latency)
4. Trigger browser focus change to reload
5. Check `subscribeToSchoolChanges()` was called on page load

---

## 📞 SUPPORT INFORMATION

For issues with:
- **Database:** Check Supabase documentation
- **Real-time:** Verify Realtime publication settings
- **Authentication:** Check Supabase Auth settings
- **Frontend:** Check browser console for error messages

---

## 📝 NOTES

- School code is immutable (admin cannot change their school)
- All changes are logged with timestamps and user info
- System automatically falls back to DEFAULT if school_code is missing
- Real-time sync has ~1-2 second latency (normal for WebSocket)
- Cache invalidation happens automatically on any data change

---

**Version:** 1.0  
**Last Updated:** April 2026  
**Implementation Status:** Ready for Production
