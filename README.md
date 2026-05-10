# Marks Management System (MMS)

![MMS Banner](https://img.shields.io/badge/MMS-Enterprise--Grade-blue?style=for-the-badge&logo=google-cloud)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Production--Ready-orange?style=for-the-badge)

A modern, high-performance school marks management platform designed for seamless institutional oversight. MMS empowers educational institutions with real-time data synchronization, automated report generation, and robust role-based access control, ensuring a frictionless experience for administrators and educators alike.

---

## 🧾 3. PROJECT OVERVIEW

The **Marks Management System (MMS)** is an enterprise-level educational ERP solution designed to bridge the gap between complex data management and user-centric simplicity. 

**Main Goals:**
*   **Centralize** student and faculty data management.
*   **Automate** the recording and calculation of assessment marks.
*   **Synchronize** institutional data instantly across multiple administrative nodes.
*   **Eliminate** manual errors in report card generation.

**Target Users:**
*   **System Administrators**: Global oversight and multi-tenant management.
*   **School Administrators**: Institutional-level control, faculty assignments, and registry management.
*   **Teachers**: Class-level marks recording and student performance tracking.

---

## ✨ 4. FEATURES SECTION

*   🔐 **Enterprise Authentication**: Secure SSO-ready login with multi-role support.
*   👥 **Student & Faculty Registry**: Comprehensive management of student profiles and teacher assignments.
*   ✍️ **Dynamic Marks Recording**: Real-time assessment entry with automated validation.
*   📄 **One-Click Report Cards**: Professional, high-fidelity PDF report generation.
*   🔄 **Real-Time Sync**: Powered by Supabase Realtime for instant updates across all portals.
*   📥 **Intelligent Import Engine**: Bulk import students from Excel, CSV, PDF, and Word.
*   📊 **Analytics Dashboard**: Visual data insights for institutional performance.
*   📱 **Responsive Architecture**: Fully optimized for Desktop, Tablet, and Mobile devices.

---

## 👥 5. USER ROLES

| Role | Responsibility | Access Level |
| :--- | :--- | :--- |
| **System Admin** | Global configuration, tenant management, and system auditing. | Superuser |
| **School Admin** | Faculty hiring, student enrollment, and institutional settings. | Institutional Admin |
| **Teacher** | Managing classes, recording marks, and generating reports. | Practitioner |

---

## 🧱 6. PROJECT STRUCTURE

The project follows a **Separation of Concerns (SoC)** architecture, isolating frontend delivery from backend services.

```text
/MMS-PROJECT
├── /frontend
│   ├── /public           # HTML Portals & Entry Points
│   └── /src
│       ├── /assets       # Global media and brand assets
│       ├── /components   # UI Logic & Modular Scripts
│       ├── /services     # API & Data Layer (Supabase)
│       ├── /styles       # CSS Design System
│       └── /utils        # Global Helpers
├── /backend
│   └── /supabase         # SQL Schemas, RLS & Triggers
├── /docs                 # Technical Guides & API Refs
└── README.md             # Project Documentation
```

---

## 🎨 7. FRONTEND TECHNOLOGIES

*   **Core**: HTML5, Vanilla JavaScript (ES6+).
*   **Styling**: Custom CSS Design System with CSS Variables.
*   **Icons**: Lucide Icons for high-fidelity UI elements.
*   **Charts**: Chart.js for data visualization.
*   **Libraries**: PDF.js (PDF Parsing), Mammoth.js (Word Parsing), XLSX (Excel Parsing).

---

## ⚙️ 8. BACKEND & DATABASE

MMS utilizes **Supabase** for a scalable, secure, and real-time backend.

*   **Database**: PostgreSQL with complex relational schema.
*   **Realtime**: WebSocket-based broadcast for instant UI updates.
*   **Storage**: Secure storage for institutional reports and student photos.
*   **RLS (Row Level Security)**: Advanced policies ensuring data isolation between schools.

---

## 🔐 9. AUTHENTICATION SYSTEM

MMS implements a secure **Identity Management** flow:
1.  **Role-Based Logic**: Users are automatically routed to their specific portal (Admin/Teacher) based on their account metadata.
2.  **Session Persistence**: JWT-based session management ensures secure, persistent access.
3.  **Self-Healing Profiles**: Automatic creation of database profiles upon first login for SDMS-provisioned accounts.

---

## 📥 10. IMPORT SYSTEM

The **Intelligent Import Engine** allows rapid institutional onboarding:
*   **Supported Formats**: `.xlsx`, `.xls`, `.csv`, `.pdf`, `.docx`, `.doc`.
*   **Validation**: Automatic detection of missing fields, duplicate SIDs, and format errors.
*   **Fuzzy Matching**: Smart header detection (e.g., matching "Full Name" to "student_name").

---

## 📊 11. MARKS MANAGEMENT

*   **Assessment Types**: Configurable weights for CAT (Continuous Assessment) and EXAM.
*   **Dynamic Calculations**: Real-time total calculation and grade assignment.
*   **Approval Workflow**: Institutional checks before report finalization.
*   **PDF Generation**: Professional templates with institutional branding.

---

## 📱 12. RESPONSIVE DESIGN

The UI is built with a **Mobile-First** philosophy:
*   **Desktop**: Multi-sidebar dashboards for power users.
*   **Tablet**: Collapsible navigation for focused work.
*   **Mobile**: Simplified list views and touch-optimized marks entry forms.

---

## 🚀 13. INSTALLATION GUIDE

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/honore63/marks-managment-system.git
    cd marks-managment-system
    ```

2.  **Environment Setup**:
    *   Create a Supabase project at [supabase.com](https://supabase.com).
    *   Run the SQL scripts located in `backend/supabase/` in the SQL Editor.

3.  **Configure API Keys**:
    *   Open `frontend/src/services/db.js`.
    *   Replace placeholders with your `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

---

## ⚙️ 14. ENVIRONMENT VARIABLES

The following variables are required in `db.js`:

```javascript
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
```

---

## ▶️ 15. RUNNING THE PROJECT

*   **Local Development**: Use any static file server (e.g., Live Server in VS Code).
*   **Live Server**: Right-click `frontend/public/index.html` and select "Open with Live Server".
*   **Production**: Deploy the `frontend` folder to Vercel, Netlify, or any static hosting provider.

---

## 🔄 16. REAL-TIME SYNCHRONIZATION

MMS uses a **Broadcast/Subscribe** pattern:
*   When a teacher records a mark, the `RealtimeEngine` broadcasts a global event.
*   Administrators see the update in their dashboard instantly without a page refresh.
*   Institutional status indicators show the live connection state.

---

## 🛡️ 17. SECURITY FEATURES

*   **Database Isolation**: RLS policies ensure School A cannot see School B's data.
*   **Input Sanitization**: Client-side and database-level protection against injection.
*   **Encapsulation**: Core API keys and logic are isolated within service modules.

---

## 📂 18. FILE ORGANIZATION

We follow the **Modular Architecture** pattern:
*   **Zero Global Scope Pollution**: Components use the `window.DB` and `window.RealtimeEngine` namespaces.
*   **Clean Assets**: No clutter in the root directory; everything is in its designated folder.

---

## 📸 19. SCREENSHOTS

*Coming Soon...*
> [Placeholder for Dashboard, Marks Entry, and Report Card previews]

---

## 🤝 20. CONTRIBUTION GUIDE

1.  Fork the repository.
2.  Create a feature branch: `git checkout -b feature/NewFeature`.
3.  Follow the **BEM** naming convention for CSS.
4.  Ensure all JS functions are documented with JSDoc.
5.  Submit a Pull Request for review.

---

## 🧪 21. TESTING SECTION

*   **Responsive**: Verified using Chrome DevTools across all breakpoints.
*   **Auth**: Tested for role isolation and session expiry.
*   **Import**: Batch tested with 500+ student records across various formats.

---

## 🛠️ 22. FUTURE IMPROVEMENTS

*   [ ] **Parent Portal**: Direct access for parents to view performance.
*   [ ] **SMS Integration**: Automated SMS alerts for attendance and marks.
*   [ ] **AI Analytics**: Predictive student performance modeling.

---

## 📄 23. LICENSE

This project is licensed under the **MIT License**.

---

## 👨💻 24. AUTHOR

**TUYISHIME HONORE**
*   **Role**: Lead Architect & Full Stack Developer
*   **Contact**: [GitHub Profile](https://github.com/honore63)
*   **Organization**: EduMarks Solutions

---
*Developed with ❤️ for a better educational experience.*

## 🔐 CENTRALIZED ACCOUNT MANAGEMENT SYSTEM

### 1️⃣ Core Account Management Principle

Any account created inside the system automatically becomes a real, valid, working account connected to authentication, permissions, dashboards, and real‑time synchronization.

The system must:
- Register accounts correctly
- Synchronize credentials automatically
- Enable immediate login
- Apply correct permissions instantly
- Connect all related system data automatically

### 2️⃣ System Administrator Account Control

The System Administrator can:
- ✅ Create School Admin accounts
- ✅ Create Teacher accounts
- ✅ Assign schools
- ✅ Assign permissions
- ✅ Manage account status

### 3️⃣ School Admin Account Control

School Admins can:
- ✅ Create Teacher accounts
- ✅ Assign classes
- ✅ Assign subjects
- ✅ Manage school‑level users

### 4️⃣ Account Creation Requirements

| Field | Requirement |
| :--- | :--- |
| **Full Name** | Required |
| **Email** | Required |
| **Phone Number** | Optional |
| **Password** | Required |
| **Role** | Required |
| **School SDMS Code** | Required for Admins/Teachers |

### 5️⃣ Automatic Authentication Synchronization

When an account is created, the system automatically:
- Create authentication credentials in Supabase Auth
- Link the account to the correct role
- Connect school/class assignments
- Activate login access instantly

### 6️⃣ Real‑Time Account Activation

Immediately after registration, the new user can:
- Log in instantly
- Access the correct dashboard
- Use assigned permissions
- Receive synchronized data automatically

### 7️⃣ Role‑Based Account Connection
- **System Administrator** – Access to the entire system
- **School Admin** – Access limited to their school (based on `school_sdms_code`)
- **Teacher** – Access only assigned classes and subjects

### 8️⃣ Real‑Time Communication Between Accounts
- When a System Administrator creates a School Admin, the admin receives working credentials and dashboard access instantly.
- When a School Admin creates a Teacher, the teacher can log in, see assigned classes and subjects immediately.

### 9️⃣ Credential Validation
- Validate email uniqueness
- Prevent duplicate accounts
- Ensure secure password handling
- Prevent invalid account creation

### 🔟 Login Reliability
- Existing credentials continue to work without breaking.
- No need to recreate accounts after updates.

### 1️⃣1️⃣ Account Synchronization Rule
Any update to an account (role changes, school changes, subject/class assignments, permission updates) synchronizes instantly across the affected dashboards.

### 1️⃣2️⃣ Security Requirements
- Supabase Authentication
- Supabase Row Level Security (RLS)
- Secure session management
- Protected routes and role verification

### 1️⃣3️⃣ Real‑Time Dashboard Updates
When account permissions change, menus and access adjust instantly without requiring a re‑login where possible.

### 1️⃣4️⃣ Prevent Common Account Problems
- No invalid credentials after registration
- Accounts exist in both Auth and profile tables
- No broken role connections
- Full dashboard access
- No authentication desynchronization

### 1️⃣5️⃣ Database Synchronization
Ensure the following tables stay in sync at all times:
- `auth.users`
- `profiles`
- `roles`
- Assignment tables (`school_admins`, `teacher_assignments`, etc.)

### 1️⃣6️⃣ Account Testing Requirements
After account creation, automatically verify:
- Login functionality
- Role‑based access
- Dashboard loading
- Real‑time synchronization

### 1️⃣7️⃣ Implementation Overview
The system uses a centralized **AccountManager** module (frontend) that delegates provisioning to Supabase via a non‑persisting client, ensuring the admin’s session remains intact while new accounts are created. Backend triggers keep the `profiles` table in sync with `auth.users`. Real‑time listeners update dashboards across all portals.

---

*Developed with ❤️ for a better educational experience.*

## 🔐 ACCURATE DASHBOARD DISPLAY AFTER LOGIN

### 1️⃣ Core Principle

Every logged‑in account must see **only** its real, assigned information directly connected to its database records and permissions. The system must:
- Load authentic user data from Supabase
- Show role‑specific information
- Synchronize assignments automatically
- Prevent unrelated or duplicate data exposure

### 2️⃣ System Administrator Dashboard

When a **System Administrator** logs in, the dashboard displays:
- Full name and email of the admin
- System‑wide statistics (total schools, total admins, total teachers)
- Lists of **all** schools, admins, and teachers
- Global reports and analytics

All data is fetched in real time from the database and refreshed instantly on any change.

### 3️⃣ School Administrator Dashboard

When a **School Admin** logs in, the dashboard shows **only** information for their school (identified by `school_sdms_code`):
- School name and details
- List of teachers belonging to that school
- Students enrolled in the school
- Classes and subject assignments for the school
- School‑specific reports and analytics

No data from other schools is ever exposed.

### 4️⃣ Teacher Dashboard

When a **Teacher** logs in, the dashboard presents:
- Teacher’s full name and email
- Assigned classes and subjects
- Students in each assigned class
- Marks and assessments relevant to those subjects/classes

The teacher never sees other teachers’ classes, other schools, or unassigned subjects.

### 5️⃣ Real‑Time Synchronization

Any update performed by a System Admin or School Admin (e.g., new class assignment, new subject, permission change, student import, marks approval) triggers an immediate refresh on the affected dashboards via Supabase Realtime listeners.

### 6️⃣ Preventing False or Empty Information

The UI is guarded against:
- Placeholder or dummy data
- Displaying another user’s information
- Out‑dated or duplicated records
- Empty dashboards caused by missing queries

All queries are scoped with proper RLS filters:
```sql
-- School Admin query example
SELECT * FROM classes WHERE school_sdms_code = auth.uid()::text;
```
```sql
-- Teacher query example
SELECT * FROM classes WHERE teacher_id = auth.uid();
```

### 7️⃣ Security & Access Control

- Supabase Authentication ensures the user is identified.
- Row‑Level Security (RLS) enforces data isolation per role and school.
- Protected routes verify role before rendering any component.

### 8️⃣ Validation After Login

Immediately after a successful sign‑in, the app:
1. Retrieves the user’s profile and role.
2. Verifies school, class, and subject assignments.
3. Confirms permissions.
4. Only then renders the appropriate dashboard.

---

*Developed with ❤️ for a better educational experience.*
