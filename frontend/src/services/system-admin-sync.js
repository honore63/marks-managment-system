/* ════════════════════════════════════════════════════════════
   MMS SYSTEM ADMIN — REAL-TIME DATA SYNCHRONIZATION
   ────────────────────────────────────────────────────────────
   Manages real-time data flow from all connected schools,
   teachers, and administrators with live updates and
   intelligent caching for optimal performance.
   ════════════════════════════════════════════════════════════ */

// ─── CONFIGURATION ─────────────────────────────────────────
const SYSTEM_ADMIN_CONFIG = {
  SYNC_INTERVAL: 30000, // 30 seconds
  CACHE_TTL: 300000, // 5 minutes
  MAX_RETRIES: 3,
  BATCH_SIZE: 100,
  REALTIME_ENABLED: true
};

// ─── DATA CACHE ────────────────────────────────────────────
class SystemAdminCache {
  constructor() {
    this.data = {
      schools: [],
      teachers: [],
      students: [],
      marks: [],
      reports: [],
      submissions: [],
      activities: []
    };
    this.timestamps = {};
    this.listeners = {};
  }

  set(key, value) {
    this.data[key] = value;
    this.timestamps[key] = Date.now();
  }

  get(key) {
    const timestamp = this.timestamps[key] || 0;
    const age = Date.now() - timestamp;
    if (age > SYSTEM_ADMIN_CONFIG.CACHE_TTL) {
      return null; // Cache expired
    }
    return this.data[key];
  }

  isExpired(key) {
    const timestamp = this.timestamps[key] || 0;
    return (Date.now() - timestamp) > SYSTEM_ADMIN_CONFIG.CACHE_TTL;
  }

  clear() {
    this.data = {};
    this.timestamps = {};
  }

  subscribe(key, callback) {
    if (!this.listeners[key]) this.listeners[key] = [];
    this.listeners[key].push(callback);
  }

  notify(key, value) {
    if (this.listeners[key]) {
      this.listeners[key].forEach(callback => callback(value));
    }
  }
}

const adminCache = new SystemAdminCache();

// ═══════════════════════════════════════════════════════════
// REAL-TIME DATA SYNCHRONIZATION
// ═══════════════════════════════════════════════════════════

class SystemAdminSync {
  constructor(supabaseClient) {
    this.client = supabaseClient;
    this.activeSubscriptions = {};
    this.syncStatus = 'idle';
    this.lastSyncTime = null;
    this.errorCount = 0;
  }

  // ─── INITIALIZE REAL-TIME LISTENERS ────────────────────
  async initializeRealtimeListeners() {
    console.log('🔄 Initializing real-time listeners...');
    
    if (!SYSTEM_ADMIN_CONFIG.REALTIME_ENABLED) return;

    try {
      // Listen to marks submissions
      this.subscribeToMarksSubmissions();
      
      // Listen to report generations
      this.subscribeToReportGeneration();
      
      // Listen to student activity
      this.subscribeToStudentActivity();
      
      // Listen to teacher status
      this.subscribeToTeacherStatus();
      
      // Listen to school sync status
      this.subscribeToSchoolSyncStatus();
      
      console.log('✅ Real-time listeners initialized');
      this.updateSyncStatus('connected');
    } catch (error) {
      console.error('❌ Error initializing listeners:', error);
      this.updateSyncStatus('error');
    }
  }

  // ─── MARKS SUBMISSIONS LISTENER ────────────────────────
  subscribeToMarksSubmissions() {
    const subscription = this.client
      .channel('marks_submissions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'marks' },
        (payload) => {
          console.log('📝 New marks submission:', payload);
          this.handleMarksSubmission(payload.new);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'marks' },
        (payload) => {
          console.log('✏️ Marks updated:', payload);
          this.handleMarksUpdate(payload.new);
        }
      )
      .subscribe();

    this.activeSubscriptions['marks'] = subscription;
  }

  // ─── REPORT GENERATION LISTENER ────────────────────────
  subscribeToReportGeneration() {
    const subscription = this.client
      .channel('reports')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reports' },
        (payload) => {
          console.log('📋 New report generated:', payload);
          this.handleNewReport(payload.new);
        }
      )
      .subscribe();

    this.activeSubscriptions['reports'] = subscription;
  }

  // ─── STUDENT ACTIVITY LISTENER ────────────────────────
  subscribeToStudentActivity() {
    const subscription = this.client
      .channel('student_activity')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'student_activity' },
        (payload) => {
          console.log('👥 Student activity:', payload);
          this.handleStudentActivity(payload.new);
        }
      )
      .subscribe();

    this.activeSubscriptions['student_activity'] = subscription;
  }

  // ─── TEACHER STATUS LISTENER ────────────────────────────
  subscribeToTeacherStatus() {
    const subscription = this.client
      .channel('teacher_status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users' },
        (payload) => {
          if (payload.new.role === 'teacher') {
            console.log('👨‍🏫 Teacher status updated:', payload);
            this.handleTeacherStatusUpdate(payload.new);
          }
        }
      )
      .subscribe();

    this.activeSubscriptions['teacher_status'] = subscription;
  }

  // ─── SCHOOL SYNC STATUS LISTENER ────────────────────────
  subscribeToSchoolSyncStatus() {
    const subscription = this.client
      .channel('school_sync')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'schools' },
        (payload) => {
          console.log('🏫 School sync status:', payload);
          this.handleSchoolSyncUpdate(payload.new);
        }
      )
      .subscribe();

    this.activeSubscriptions['school_sync'] = subscription;
  }

  // ─── EVENT HANDLERS ────────────────────────────────────
  handleMarksSubmission(marks) {
    // Update cache
    const cachedMarks = adminCache.get('marks') || [];
    cachedMarks.push(marks);
    adminCache.set('marks', cachedMarks);
    adminCache.notify('marks', marks);

    // Add to activity feed
    this.addActivityLog('Marks Entry', `Marks submitted for ${marks.subject}`, 'marks', marks.id);

    // Update dashboard statistics
    this.updateMarksStatistics();
  }

  handleMarksUpdate(marks) {
    console.log('Marks updated:', marks);
    adminCache.notify('marks_update', marks);
  }

  handleNewReport(report) {
    // Update cache
    const cachedReports = adminCache.get('reports') || [];
    cachedReports.push(report);
    adminCache.set('reports', cachedReports);
    adminCache.notify('reports', report);

    // Add to activity feed
    this.addActivityLog('Report Generated', `${report.type} report generated`, 'report', report.id);
  }

  handleStudentActivity(activity) {
    // Add recent activity
    adminCache.notify('student_activity', activity);
  }

  handleTeacherStatusUpdate(teacher) {
    console.log('Teacher status:', teacher);
    adminCache.notify('teacher_status', teacher);
  }

  handleSchoolSyncUpdate(school) {
    console.log('School sync update:', school);
    adminCache.set('school_sync_' + school.id, {
      lastSync: school.last_sync,
      status: school.sync_status,
      timestamp: Date.now()
    });
  }

  // ─── STATISTICS UPDATES ────────────────────────────────
  async updateMarksStatistics() {
    try {
      const { data, error } = await this.client
        .from('marks')
        .select('id', { count: 'exact' });

      if (!error) {
        console.log(`📊 Total marks submitted: ${data ? data.length : 0}`);
      }
    } catch (error) {
      console.error('Error updating marks statistics:', error);
    }
  }

  // ─── ACTIVITY LOG ──────────────────────────────────────
  addActivityLog(title, description, type, referenceId) {
    const activity = {
      title,
      description,
      type,
      referenceId,
      timestamp: new Date().toISOString(),
      priority: this.calculateActivityPriority(type)
    };

    const activities = adminCache.get('activities') || [];
    activities.unshift(activity);

    // Keep only recent 100 activities
    if (activities.length > 100) {
      activities.pop();
    }

    adminCache.set('activities', activities);
    adminCache.notify('activities', activity);
  }

  calculateActivityPriority(type) {
    const priorities = {
      'error': 'high',
      'alert': 'high',
      'report': 'medium',
      'marks': 'medium',
      'update': 'low',
      'info': 'low'
    };
    return priorities[type] || 'low';
  }

  // ─── SYNC STATUS ───────────────────────────────────────
  updateSyncStatus(status) {
    this.syncStatus = status;
    adminCache.notify('sync_status', {
      status,
      timestamp: Date.now(),
      lastSync: this.lastSyncTime
    });
    console.log(`🔄 Sync status: ${status}`);
  }

  // ─── CLEANUP ────────────────────────────────────────────
  cleanup() {
    console.log('🧹 Cleaning up subscriptions...');
    Object.values(this.activeSubscriptions).forEach(sub => {
      if (sub) sub.unsubscribe();
    });
    this.activeSubscriptions = {};
  }
}

// ═══════════════════════════════════════════════════════════
// DATA QUERIES & AGGREGATION
// ═══════════════════════════════════════════════════════════

class SystemAdminQueries {
  constructor(supabaseClient) {
    this.client = supabaseClient;
  }

  // ─── FETCH ALL SCHOOLS ────────────────────────────────
  async fetchAllSchools() {
    try {
      const cached = adminCache.get('schools');
      if (cached) return cached;

      const { data, error } = await this.client
        .from('schools')
        .select('*, users!schools_admin_id_fk(name), stats!left(students_count, teachers_count, marks_submitted)')
        .eq('is_active', true);

      if (error) throw error;

      adminCache.set('schools', data || []);
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching schools:', error);
      return [];
    }
  }

  // ─── FETCH ALL TEACHERS ───────────────────────────────
  async fetchAllTeachers() {
    try {
      const cached = adminCache.get('teachers');
      if (cached) return cached;

      const { data, error } = await this.client
        .from('users')
        .select('*, school:schools(name), teacher_stats!left(marks_submitted, reports_generated)')
        .eq('role', 'teacher')
        .eq('is_active', true);

      if (error) throw error;

      adminCache.set('teachers', data || []);
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching teachers:', error);
      return [];
    }
  }

  // ─── FETCH ALL STUDENTS ───────────────────────────────
  async fetchAllStudents() {
    try {
      const cached = adminCache.get('students');
      if (cached) return cached;

      const { data, error } = await this.client
        .from('students')
        .select('*, school:schools(name), class:classes(name), student_performance!left(avg_score, grade)')
        .eq('is_active', true);

      if (error) throw error;

      adminCache.set('students', data || []);
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching students:', error);
      return [];
    }
  }

  // ─── FETCH PENDING MARKS ──────────────────────────────
  async fetchPendingMarks() {
    try {
      const { data, error } = await this.client
        .from('marks')
        .select('*, class:classes(name), teacher:users(name), subject:subjects(name)')
        .is('submitted_at', null)
        .order('due_date', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('❌ Error fetching pending marks:', error);
      return [];
    }
  }

  // ─── FETCH REPORTS STATUS ─────────────────────────────
  async fetchReportsStatus() {
    try {
      const { data, error } = await this.client
        .from('reports')
        .select('*, school:schools(name), approved_by:users(name)')
        .order('generated_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('❌ Error fetching reports:', error);
      return [];
    }
  }

  // ─── FETCH SYSTEM STATISTICS ──────────────────────────
  async fetchSystemStatistics() {
    try {
      const schools = await this.fetchAllSchools();
      const teachers = await this.fetchAllTeachers();
      const students = await this.fetchAllStudents();

      return {
        totalSchools: schools.length,
        totalTeachers: teachers.length,
        totalStudents: students.length,
        activeSchools: schools.filter(s => s.is_active).length,
        activeTeachers: teachers.filter(t => t.is_active).length,
        activeStudents: students.filter(s => s.is_active).length
      };
    } catch (error) {
      console.error('❌ Error fetching system statistics:', error);
      return {};
    }
  }

  // ─── FETCH MARKS SUBMISSION RATE ───────────────────────
  async fetchMarksSubmissionRate() {
    try {
      const { data: submitted, error: err1 } = await this.client
        .from('marks')
        .select('id', { count: 'exact' })
        .not('submitted_at', 'is', null);

      const { data: total, error: err2 } = await this.client
        .from('marks')
        .select('id', { count: 'exact' });

      if (err1 || err2) throw err1 || err2;

      const submittedCount = submitted ? submitted.length : 0;
      const totalCount = total ? total.length : 1;
      const rate = Math.round((submittedCount / totalCount) * 100);

      return {
        submitted: submittedCount,
        total: totalCount,
        rate,
        pending: totalCount - submittedCount
      };
    } catch (error) {
      console.error('❌ Error fetching submission rate:', error);
      return { submitted: 0, total: 0, rate: 0, pending: 0 };
    }
  }

  // ─── FETCH STUDENT PERFORMANCE ────────────────────────
  async fetchStudentPerformanceAnalytics() {
    try {
      const { data, error } = await this.client
        .from('student_performance')
        .select('grade, avg_score')
        .order('avg_score', { ascending: false });

      if (error) throw error;

      const grades = data || [];
      const stats = {
        excellent: grades.filter(g => g.grade === 'A' || g.avg_score >= 90).length,
        good: grades.filter(g => g.grade === 'B' || (g.avg_score >= 75 && g.avg_score < 90)).length,
        average: grades.filter(g => g.grade === 'C' || (g.avg_score >= 60 && g.avg_score < 75)).length,
        belowAverage: grades.filter(g => g.grade === 'D' || (g.avg_score >= 45 && g.avg_score < 60)).length,
        fail: grades.filter(g => g.grade === 'F' || g.avg_score < 45).length
      };

      return stats;
    } catch (error) {
      console.error('❌ Error fetching performance analytics:', error);
      return { excellent: 0, good: 0, average: 0, belowAverage: 0, fail: 0 };
    }
  }

  // ─── DETECT MISSING MARKS ─────────────────────────────
  async detectMissingMarks() {
    try {
      const pending = await this.fetchPendingMarks();
      
      return {
        count: pending.length,
        items: pending.slice(0, 20), // Top 20
        criticalItems: pending.filter(p => {
          const dueDate = new Date(p.due_date);
          const now = new Date();
          return dueDate < now; // Overdue
        })
      };
    } catch (error) {
      console.error('❌ Error detecting missing marks:', error);
      return { count: 0, items: [], criticalItems: [] };
    }
  }

  // ─── DETECT INACTIVE TEACHERS ─────────────────────────
  async detectInactiveTeachers() {
    try {
      const teachers = await this.fetchAllTeachers();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      return teachers.filter(teacher => {
        const lastActive = new Date(teacher.last_activity || teacher.created_at);
        return lastActive < thirtyDaysAgo;
      });
    } catch (error) {
      console.error('❌ Error detecting inactive teachers:', error);
      return [];
    }
  }

  // ─── DETECT INACTIVE SCHOOLS ──────────────────────────
  async detectInactiveSchools() {
    try {
      const schools = await this.fetchAllSchools();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      return schools.filter(school => {
        const lastSync = new Date(school.last_sync || school.created_at);
        return lastSync < sevenDaysAgo;
      });
    } catch (error) {
      console.error('❌ Error detecting inactive schools:', error);
      return [];
    }
  }
}

// ═══════════════════════════════════════════════════════════
// EXPORT FOR USE
// ═══════════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SystemAdminSync,
    SystemAdminQueries,
    SystemAdminCache,
    adminCache,
    SYSTEM_ADMIN_CONFIG
  };
}
