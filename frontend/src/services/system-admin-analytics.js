/* ════════════════════════════════════════════════════════════
   MMS SYSTEM ADMIN — ANALYTICS & REPORTING
   ────────────────────────────────────────────────────────────
   Generates comprehensive system-wide analytics, reports,
   and insights for system administrators.
   ════════════════════════════════════════════════════════════ */

class SystemAdminAnalytics {
  constructor(supabaseClient) {
    this.client = supabaseClient;
  }

  // ─── STUDENT PERFORMANCE ANALYTICS ────────────────────
  async getStudentPerformanceAnalytics(schoolId = null, termId = null) {
    try {
      let query = this.client
        .from('student_performance')
        .select('grade, avg_score, subject, student_id');

      if (schoolId) {
        query = query.eq('school_id', schoolId);
      }
      if (termId) {
        query = query.eq('term_id', termId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const records = data || [];
      
      return {
        byGrade: this.analyzeByGrade(records),
        byScore: this.analyzeByScore(records),
        bySubject: this.analyzeBySubject(records),
        statistics: this.calculatePerformanceStats(records)
      };
    } catch (error) {
      console.error('❌ Error analyzing student performance:', error);
      return null;
    }
  }

  analyzeByGrade(records) {
    const grades = {};
    records.forEach(record => {
      const grade = record.grade || this.calculateGrade(record.avg_score);
      grades[grade] = (grades[grade] || 0) + 1;
    });
    return grades;
  }

  analyzeByScore(records) {
    return {
      excellent: records.filter(r => r.avg_score >= 90).length,
      good: records.filter(r => r.avg_score >= 75 && r.avg_score < 90).length,
      average: records.filter(r => r.avg_score >= 60 && r.avg_score < 75).length,
      belowAverage: records.filter(r => r.avg_score >= 45 && r.avg_score < 60).length,
      fail: records.filter(r => r.avg_score < 45).length
    };
  }

  analyzeBySubject(records) {
    const subjects = {};
    records.forEach(record => {
      if (record.subject) {
        if (!subjects[record.subject]) {
          subjects[record.subject] = { scores: [], count: 0, average: 0 };
        }
        subjects[record.subject].scores.push(record.avg_score);
        subjects[record.subject].count++;
      }
    });

    // Calculate averages
    Object.keys(subjects).forEach(subject => {
      const scores = subjects[subject].scores;
      subjects[subject].average = scores.reduce((a, b) => a + b, 0) / scores.length;
    });

    return subjects;
  }

  calculatePerformanceStats(records) {
    if (records.length === 0) return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0 };

    const scores = records.map(r => r.avg_score).sort((a, b) => a - b);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const median = scores[Math.floor(scores.length / 2)];
    const stdDev = Math.sqrt(scores.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / scores.length);

    return {
      mean: Math.round(mean * 10) / 10,
      median,
      stdDev: Math.round(stdDev * 10) / 10,
      min: Math.min(...scores),
      max: Math.max(...scores),
      total: records.length
    };
  }

  calculateGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  // ─── SCHOOL PERFORMANCE ANALYTICS ─────────────────────
  async getSchoolPerformanceAnalytics(schoolId) {
    try {
      const { data: school, error: err1 } = await this.client
        .from('schools')
        .select('*')
        .eq('id', schoolId)
        .single();

      if (err1) throw err1;

      const { data: teachers, error: err2 } = await this.client
        .from('users')
        .select('id')
        .eq('school_id', schoolId)
        .eq('role', 'teacher');

      if (err2) throw err2;

      const { data: marks, error: err3 } = await this.client
        .from('marks')
        .select('id')
        .eq('school_id', schoolId);

      if (err3) throw err3;

      const { data: marksSubmitted, error: err4 } = await this.client
        .from('marks')
        .select('id')
        .eq('school_id', schoolId)
        .not('submitted_at', 'is', null);

      if (err4) throw err4;

      const { data: reports, error: err5 } = await this.client
        .from('reports')
        .select('id')
        .eq('school_id', schoolId);

      if (err5) throw err5;

      return {
        school: school,
        marksSubmissionRate: marks.length > 0 ? (marksSubmitted.length / marks.length) * 100 : 0,
        totalTeachers: teachers.length,
        totalMarksEntries: marks.length,
        marksSubmitted: marksSubmitted.length,
        reportGenerated: reports.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error analyzing school performance:', error);
      return null;
    }
  }

  // ─── TEACHER ACTIVITY ANALYTICS ───────────────────────
  async getTeacherActivityAnalytics(teacherId) {
    try {
      const { data, error } = await this.client
        .from('users')
        .select('*, teacher_stats!left(*), last_activity')
        .eq('id', teacherId)
        .eq('role', 'teacher')
        .single();

      if (error) throw error;

      // Calculate activity metrics
      const now = new Date();
      const lastActive = new Date(data.last_activity || data.created_at);
      const daysSinceActive = Math.floor((now - lastActive) / (1000 * 60 * 60 * 24));

      return {
        teacherId: teacherId,
        name: data.name,
        school_id: data.school_id,
        marksSubmitted: data.teacher_stats?.[0]?.marks_submitted || 0,
        reportsGenerated: data.teacher_stats?.[0]?.reports_generated || 0,
        lastActive: data.last_activity,
        daysSinceActive: daysSinceActive,
        isActive: daysSinceActive <= 7,
        activityStatus: daysSinceActive <= 1 ? 'very_active' : daysSinceActive <= 7 ? 'active' : daysSinceActive <= 30 ? 'inactive' : 'very_inactive'
      };
    } catch (error) {
      console.error('❌ Error analyzing teacher activity:', error);
      return null;
    }
  }

  // ─── SYSTEM-WIDE ANALYTICS ────────────────────────────
  async getSystemWideAnalytics() {
    try {
      const { data: schools } = await this.client.from('schools').select('id');
      const { data: teachers } = await this.client.from('users').select('id').eq('role', 'teacher');
      const { data: students } = await this.client.from('students').select('id');
      const { data: marks } = await this.client.from('marks').select('id');
      const { data: marksSubmitted } = await this.client.from('marks').select('id').not('submitted_at', 'is', null);
      const { data: reports } = await this.client.from('reports').select('id');

      return {
        schools: {
          total: schools?.length || 0,
          active: schools?.filter(s => s.is_active)?.length || 0
        },
        teachers: {
          total: teachers?.length || 0,
          active: teachers?.filter(t => t.is_active)?.length || 0
        },
        students: {
          total: students?.length || 0,
          active: students?.filter(s => s.is_active)?.length || 0
        },
        marks: {
          total: marks?.length || 0,
          submitted: marksSubmitted?.length || 0,
          submissionRate: marks?.length > 0 ? (marksSubmitted?.length / marks.length) * 100 : 0,
          pending: (marks?.length || 0) - (marksSubmitted?.length || 0)
        },
        reports: {
          total: reports?.length || 0,
          generatedToday: reports?.filter(r => {
            const date = new Date(r.generated_at);
            const today = new Date();
            return date.toDateString() === today.toDateString();
          })?.length || 0
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error fetching system-wide analytics:', error);
      return null;
    }
  }

  // ─── TERM/ACADEMIC YEAR ANALYTICS ───────────────────
  async getTermAnalytics(termId) {
    try {
      const { data: performance, error } = await this.client
        .from('student_performance')
        .select('grade, avg_score')
        .eq('term_id', termId);

      if (error) throw error;

      const records = performance || [];
      const avgScore = records.reduce((sum, r) => sum + r.avg_score, 0) / records.length;
      const passRate = (records.filter(r => r.grade !== 'F').length / records.length) * 100;

      return {
        termId,
        totalStudents: records.length,
        averageScore: Math.round(avgScore * 10) / 10,
        passRate: Math.round(passRate * 10) / 10,
        failRate: Math.round((100 - passRate) * 10) / 10,
        gradeDistribution: this.analyzeByGrade(records),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error analyzing term:', error);
      return null;
    }
  }

  // ─── AT-RISK STUDENTS ─────────────────────────────────
  async getAtRiskStudents(schoolId = null, threshold = 60) {
    try {
      let query = this.client
        .from('student_performance')
        .select('*, student:student_id(name, roll_number), class:class_id(name)');

      if (schoolId) {
        query = query.eq('school_id', schoolId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || [])
        .filter(record => record.avg_score < threshold)
        .sort((a, b) => a.avg_score - b.avg_score);
    } catch (error) {
      console.error('❌ Error fetching at-risk students:', error);
      return [];
    }
  }

  // ─── TREND ANALYSIS ────────────────────────────────────
  async getTrendAnalysis(metric = 'marks_submission', daysBack = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      if (metric === 'marks_submission') {
        const { data, error } = await this.client
          .from('marks')
          .select('submitted_at')
          .gte('submitted_at', startDate.toISOString())
          .not('submitted_at', 'is', null);

        if (error) throw error;

        // Group by date
        const trendData = {};
        (data || []).forEach(record => {
          const date = new Date(record.submitted_at).toDateString();
          trendData[date] = (trendData[date] || 0) + 1;
        });

        return trendData;
      }
    } catch (error) {
      console.error('❌ Error analyzing trends:', error);
      return {};
    }
  }

  // ─── EXPORT ANALYTICS ──────────────────────────────────
  async exportAnalyticsToExcel(analyticsData, filename = 'analytics') {
    try {
      // This would use a library like xlsx to export
      console.log('📊 Exporting analytics to Excel:', filename);
      // Implementation depends on frontend framework
      return true;
    } catch (error) {
      console.error('❌ Error exporting analytics:', error);
      return false;
    }
  }

  // ─── EXPORT ANALYTICS TO PDF ───────────────────────────
  async exportAnalyticsToPDF(analyticsData, filename = 'analytics') {
    try {
      console.log('📄 Exporting analytics to PDF:', filename);
      // Implementation depends on frontend framework
      return true;
    } catch (error) {
      console.error('❌ Error exporting to PDF:', error);
      return false;
    }
  }
}

// ═══════════════════════════════════════════════════════════
// REPORTING ENGINE
// ═══════════════════════════════════════════════════════════

class SystemAdminReporting {
  constructor(supabaseClient) {
    this.client = supabaseClient;
  }

  // ─── GENERATE SCHOOL REPORT ────────────────────────────
  async generateSchoolReport(schoolId, termId) {
    try {
      const analytics = new SystemAdminAnalytics(this.client);
      
      const schoolPerf = await analytics.getSchoolPerformanceAnalytics(schoolId);
      const studentPerf = await analytics.getStudentPerformanceAnalytics(schoolId, termId);

      const report = {
        reportId: this.generateId(),
        schoolId,
        termId,
        generatedAt: new Date().toISOString(),
        schoolPerformance: schoolPerf,
        studentPerformance: studentPerf,
        summary: {
          marksCompletionRate: `${Math.round(schoolPerf.marksSubmissionRate)}%`,
          totalStudentsEvaluated: studentPerf.statistics.total,
          averageScore: studentPerf.statistics.mean,
          passRate: `${Math.round((studentPerf.byScore.excellent + studentPerf.byScore.good + studentPerf.byScore.average) / studentPerf.statistics.total * 100)}%`
        }
      };

      // Save report
      await this.client.from('reports').insert({
        school_id: schoolId,
        term_id: termId,
        report_type: 'school_performance',
        data: report,
        generated_at: new Date().toISOString()
      });

      return report;
    } catch (error) {
      console.error('❌ Error generating school report:', error);
      return null;
    }
  }

  // ─── GENERATE SYSTEM REPORT ────────────────────────────
  async generateSystemReport() {
    try {
      const analytics = new SystemAdminAnalytics(this.client);
      const systemAnalytics = await analytics.getSystemWideAnalytics();

      const report = {
        reportId: this.generateId(),
        reportType: 'system_wide',
        generatedAt: new Date().toISOString(),
        systemAnalytics,
        summary: {
          totalSchools: systemAnalytics.schools.total,
          activeSchools: systemAnalytics.schools.active,
          totalTeachers: systemAnalytics.teachers.total,
          totalStudents: systemAnalytics.students.total,
          marksCompletionRate: `${Math.round(systemAnalytics.marks.submissionRate)}%`,
          reportCompletionRate: `${Math.round((systemAnalytics.reports.total / (systemAnalytics.schools.total * 12)) * 100)}%`
        }
      };

      // Save report
      await this.client.from('reports').insert({
        report_type: 'system_wide',
        data: report,
        generated_at: new Date().toISOString()
      });

      return report;
    } catch (error) {
      console.error('❌ Error generating system report:', error);
      return null;
    }
  }

  // ─── GET SAVED REPORTS ────────────────────────────────
  async getSavedReports(limit = 50) {
    try {
      const { data, error } = await this.client
        .from('reports')
        .select('*')
        .order('generated_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('❌ Error fetching saved reports:', error);
      return [];
    }
  }

  // ─── HELPER: GENERATE ID ───────────────────────────────
  generateId() {
    return `REPORT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ═══════════════════════════════════════════════════════════
// EXPORT FOR USE
// ═══════════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SystemAdminAnalytics,
    SystemAdminReporting
  };
}
