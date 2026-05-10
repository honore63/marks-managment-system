# 📋 QUICK REFERENCE: User Creation Cheat Sheet

## 🚀 3-Step Process (5 Minutes)

### **STEP 1:** Supabase Dashboard
```
1. Authentication → Users → Add User
2. Email: user@school.rw
3. Password: SecurePassword123
4. ✅ CHECK "Auto confirm email"
5. COPY the User ID (UUID)
```

### **STEP 2:** SQL Query (Choose One)

#### **Admin:**
```sql
INSERT INTO public.profiles (id, email, full_name, role, school_code, created_at)
VALUES ('PASTE_ID', 'user@school.rw', 'Full Name', 'admin', '541021', NOW());
```

#### **Teacher:**
```sql
INSERT INTO public.profiles (id, email, full_name, role, school_code, sdms_code, created_at)
VALUES ('PASTE_ID', 'teacher@school.rw', 'Full Name', 'teacher', '541021', '3410432378', NOW());
```

### **STEP 3:** Test
- Open `index.html`
- Login with email/password
- ✅ Auto-redirect to correct portal

---

## ✅ Validation Rules

| Field | Format | Example | Error If |
|-------|--------|---------|----------|
| **email** | Valid format | admin@school.rw | ❌ missing @ |
| **password** | Any | SecurePass123 | ❌ (can't change after) |
| **full_name** | 2+ chars | John Doe | ❌ empty |
| **role** | admin OR teacher | admin | ❌ other value |
| **school_code** | 6 digits | 541021 | ❌ 5 or 7 digits |
| **sdms_code** | 10 digits (unique) | 3410432378 | ❌ duplicate |

---

## 🔧 Common Tasks

### **Create Multiple Users:**
```sql
INSERT INTO public.profiles (id, email, full_name, role, school_code, created_at)
VALUES 
  ('id-1', 'user1@school.rw', 'User 1', 'admin', '541021', NOW()),
  ('id-2', 'user2@school.rw', 'User 2', 'admin', '541021', NOW()),
  ('id-3', 'user3@school.rw', 'User 3', 'teacher', '541021', NOW());
```

### **Find User:**
```sql
SELECT * FROM profiles WHERE email = 'user@school.rw';
```

### **Update User:**
```sql
UPDATE profiles SET full_name = 'New Name' WHERE email = 'user@school.rw';
```

### **Check School Users:**
```sql
SELECT email, full_name, role FROM profiles WHERE school_code = '541021';
```

### **Find Duplicate SDMS Codes:**
```sql
SELECT sdms_code, COUNT(*) FROM profiles WHERE sdms_code IS NOT NULL 
GROUP BY sdms_code HAVING COUNT(*) > 1;
```

---

## ⚠️ DO's & DON'Ts

### ✅ DO:
- Auto-confirm emails in Supabase
- Use exact same email in auth & profile
- Use 6-digit school codes
- Use 10-digit unique SDMS codes
- Test login after creating user

### ❌ DON'T:
- Use mismatched emails (ABC vs abc)
- Skip "Auto confirm email"
- Use 5 or 7 digit school codes
- Duplicate SDMS codes
- Forget to copy User ID from Supabase

---

## 🧪 Test Commands (Browser Console)

```javascript
// Validate school code
ValidationSystem.validateSchoolCode('541021');

// Get all users for school
await ValidationSystem.getUsersBySchool('541021');

// Get all admins
await ValidationSystem.getAdminsBySchool('541021');

// Check duplicates
await ValidationSystem.findDuplicateSdmsCodes();
```

---

## 🎓 File Reference

| File | Purpose | When Use |
|------|---------|----------|
| `DEVELOPER_GUIDE.md` | Complete documentation | Learning full system |
| `DEVELOPER_USER_CREATION.sql` | Copy-paste templates | Creating users |
| `DATABASE_TRIGGERS.sql` | Validation rules | Setup once in SQL |
| `js/validation.js` | Client validation | Browser testing |
| `IMPLEMENTATION_COMPLETE.md` | Overview & summary | Quick reference |

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Email not confirmed" | Auto-confirm in Supabase |
| "Institutional record not found" | Create profile INSERT |
| Email mismatch error | Use EXACT same email |
| Login fails 400 error | Check profile exists |
| Wrong portal redirect | Check role field |
| Duplicate SDMS code | Find & fix with UPDATE |

---

## 💡 Pro Tips

1. **Test with 1 admin first** - Creates confidence
2. **Use same school code for testing** - See real-time sync
3. **Watch browser console** - Logs show everything
4. **Keep this cheat sheet handy** - Speeds up workflow
5. **Batch create in SQL** - Faster for 10+ users

---

**Version:** 2.0  
**Quick Setup:** ~5 minutes per user  
**Status:** Ready for Production ✅
