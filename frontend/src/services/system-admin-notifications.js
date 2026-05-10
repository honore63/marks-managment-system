/* ════════════════════════════════════════════════════════════
   MMS SYSTEM ADMIN — NOTIFICATIONS & COMMUNICATIONS
   ────────────────────────────────────────────────────────────
   Manages alerts, notifications, and secure communications
   between System Admin, School Admins, and Teachers.
   ════════════════════════════════════════════════════════════ */

// ─── NOTIFICATION SYSTEM ───────────────────────────────────

class SystemAdminNotifications {
  constructor(supabaseClient) {
    this.client = supabaseClient;
    this.notifications = [];
    this.alertThresholds = {
      marksSubmissionRate: 80, // Alert if below 80%
      teacherInactivityDays: 30,
      schoolSyncDelayMinutes: 60,
      failureRate: 20 // Alert if failure rate above 20%
    };
  }

  // ─── CREATE ALERT ──────────────────────────────────────
  async createAlert(title, message, severity = 'medium', category = 'general', recipientId = null) {
    try {
      const { data, error } = await this.client
        .from('notifications')
        .insert({
          title,
          message,
          severity, // low, medium, high, critical
          category, // marks_entry, report_generation, school_sync, user_activity, system
          recipient_id: recipientId,
          is_read: false,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      console.log(`🔔 Alert created: ${title}`);
      return data;
    } catch (error) {
      console.error('❌ Error creating alert:', error);
      return null;
    }
  }

  // ─── CREATE SYSTEM ALERT FOR ALL ADMINS ────────────────
  async broadcastAlert(title, message, severity = 'medium') {
    try {
      // Get all system admins
      const { data: admins, error: err } = await this.client
        .from('users')
        .select('id')
        .eq('role', 'system_admin');

      if (err) throw err;

      // Create alert for each admin
      if (admins) {
        const alerts = admins.map(admin => ({
          title,
          message,
          severity,
          category: 'system',
          recipient_id: admin.id,
          is_read: false,
          created_at: new Date().toISOString()
        }));

        const { error: insertError } = await this.client
          .from('notifications')
          .insert(alerts);

        if (insertError) throw insertError;
      }

      console.log(`📢 Broadcast alert sent: ${title}`);
    } catch (error) {
      console.error('❌ Error broadcasting alert:', error);
    }
  }

  // ─── MISSING MARKS ALERT ───────────────────────────────
  async alertMissingMarks(schoolId, className, subjectName, teacherName, daysOverdue) {
    const severity = daysOverdue > 7 ? 'critical' : daysOverdue > 3 ? 'high' : 'medium';
    
    await this.createAlert(
      `⚠️ Missing Marks Submission`,
      `${teacherName} has not submitted marks for ${className} - ${subjectName} (${daysOverdue} days overdue)`,
      severity,
      'marks_entry',
      schoolId
    );
  }

  // ─── INACTIVE TEACHER ALERT ────────────────────────────
  async alertInactiveTeacher(schoolId, teacherName, daysInactive) {
    await this.createAlert(
      `👨‍🏫 Inactive Teacher Alert`,
      `${teacherName} has been inactive for ${daysInactive} days`,
      'high',
      'user_activity',
      schoolId
    );
  }

  // ─── SCHOOL SYNC DELAY ALERT ──────────────────────────
  async alertSchoolSyncDelay(schoolName, minutesDelayed) {
    const severity = minutesDelayed > 120 ? 'critical' : minutesDelayed > 60 ? 'high' : 'medium';
    
    await this.createAlert(
      `🏫 School Sync Delay`,
      `${schoolName} data synchronization is delayed (${minutesDelayed} minutes)`,
      severity,
      'school_sync'
    );
  }

  // ─── HIGH FAILURE RATE ALERT ────────────────────────────
  async alertHighFailureRate(schoolName, className, failureRate) {
    await this.createAlert(
      `📉 High Failure Rate Alert`,
      `${className} in ${schoolName} has a failure rate of ${failureRate}%`,
      'high',
      'performance'
    );
  }

  // ─── GET UNREAD NOTIFICATIONS ──────────────────────────
  async getUnreadNotifications(userId, limit = 20) {
    try {
      const { data, error } = await this.client
        .from('notifications')
        .select('*')
        .eq('recipient_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('❌ Error fetching unread notifications:', error);
      return [];
    }
  }

  // ─── MARK NOTIFICATION AS READ ────────────────────────
  async markAsRead(notificationId) {
    try {
      const { error } = await this.client
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      console.log('✅ Notification marked as read');
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
    }
  }

  // ─── MARK ALL AS READ ───────────────────────────────────
  async markAllAsRead(userId) {
    try {
      const { error } = await this.client
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', userId)
        .eq('is_read', false);

      if (error) throw error;

      console.log('✅ All notifications marked as read');
    } catch (error) {
      console.error('❌ Error marking all as read:', error);
    }
  }

  // ─── DELETE NOTIFICATION ────────────────────────────────
  async deleteNotification(notificationId) {
    try {
      const { error } = await this.client
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      console.log('🗑️ Notification deleted');
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
    }
  }

  // ─── DISMISS ALL ────────────────────────────────────────
  async dismissAll(userId) {
    try {
      const { error } = await this.client
        .from('notifications')
        .delete()
        .eq('recipient_id', userId);

      if (error) throw error;

      console.log('🧹 All notifications dismissed');
    } catch (error) {
      console.error('❌ Error dismissing notifications:', error);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// COMMUNICATIONS SYSTEM
// ═══════════════════════════════════════════════════════════

class SystemAdminCommunications {
  constructor(supabaseClient) {
    this.client = supabaseClient;
    this.messageTemplates = {
      urgentMarksSubmission: {
        subject: '⚠️ URGENT: Missing Marks Submission',
        body: 'Dear {teacherName},\n\nPlease submit marks for {className} - {subjectName} immediately. This is {daysOverdue} days overdue.\n\nBest regards,\nSystem Administrator'
      },
      schoolAdminReminder: {
        subject: '📋 Weekly Report Reminder',
        body: 'Dear {adminName},\n\nPlease ensure all reports are generated and submitted for this week.\n\nPending items:\n{pendingItems}\n\nBest regards,\nSystem Administrator'
      },
      performanceAlert: {
        subject: '📊 Performance Alert for {className}',
        body: 'The failure rate in {className} ({schoolName}) has reached {failureRate}%. Please take remedial action.\n\nBest regards,\nSystem Administrator'
      }
    };
  }

  // ─── SEND MESSAGE TO TEACHER ────────────────────────────
  async sendMessageToTeacher(teacherId, title, message, priority = 'normal') {
    try {
      const { data, error } = await this.client
        .from('messages')
        .insert({
          from_id: await this.getSystemAdminId(),
          to_id: teacherId,
          title,
          message,
          priority,
          message_type: 'direct',
          status: 'sent',
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      console.log(`💬 Message sent to teacher ${teacherId}`);
      return data;
    } catch (error) {
      console.error('❌ Error sending message to teacher:', error);
      return null;
    }
  }

  // ─── SEND MESSAGE TO SCHOOL ADMIN ──────────────────────
  async sendMessageToSchoolAdmin(adminId, title, message, priority = 'normal') {
    try {
      const { data, error } = await this.client
        .from('messages')
        .insert({
          from_id: await this.getSystemAdminId(),
          to_id: adminId,
          title,
          message,
          priority,
          message_type: 'direct',
          status: 'sent',
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      console.log(`💬 Message sent to admin ${adminId}`);
      return data;
    } catch (error) {
      console.error('❌ Error sending message to admin:', error);
      return null;
    }
  }

  // ─── BROADCAST ANNOUNCEMENT ────────────────────────────
  async broadcastAnnouncement(title, message, recipientRole = 'all') {
    try {
      // Get all recipients based on role
      let query = this.client.from('users').select('id');
      
      if (recipientRole !== 'all') {
        query = query.eq('role', recipientRole);
      }

      const { data: recipients, error: err } = await query;

      if (err) throw err;

      // Create messages for all recipients
      if (recipients) {
        const messages = recipients.map(recipient => ({
          from_id: await this.getSystemAdminId(),
          to_id: recipient.id,
          title,
          message,
          priority: 'high',
          message_type: 'announcement',
          status: 'sent',
          created_at: new Date().toISOString()
        }));

        const { error: insertError } = await this.client
          .from('messages')
          .insert(messages);

        if (insertError) throw insertError;
      }

      console.log(`📢 Announcement sent to ${recipientRole}`);
    } catch (error) {
      console.error('❌ Error broadcasting announcement:', error);
    }
  }

  // ─── SEND BULK MESSAGES ────────────────────────────────
  async sendBulkMessages(recipientIds, title, message, priority = 'normal') {
    try {
      const messages = recipientIds.map(recipientId => ({
        from_id: await this.getSystemAdminId(),
        to_id: recipientId,
        title,
        message,
        priority,
        message_type: 'bulk',
        status: 'sent',
        created_at: new Date().toISOString()
      }));

      const { error } = await this.client
        .from('messages')
        .insert(messages);

      if (error) throw error;

      console.log(`📬 Bulk message sent to ${recipientIds.length} recipients`);
    } catch (error) {
      console.error('❌ Error sending bulk messages:', error);
    }
  }

  // ─── GET CONVERSATIONS ────────────────────────────────
  async getConversations(adminId) {
    try {
      const { data, error } = await this.client
        .from('messages')
        .select('*, sender:from_id(name), recipient:to_id(name)')
        .or(`from_id.eq.${adminId},to_id.eq.${adminId}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('❌ Error fetching conversations:', error);
      return [];
    }
  }

  // ─── GET MESSAGES WITH USER ────────────────────────────
  async getMessagesWith(adminId, userId) {
    try {
      const { data, error } = await this.client
        .from('messages')
        .select('*')
        .or(`and(from_id.eq.${adminId},to_id.eq.${userId}),and(from_id.eq.${userId},to_id.eq.${adminId})`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('❌ Error fetching messages:', error);
      return [];
    }
  }

  // ─── SEND TEMPLATED MESSAGE ────────────────────────────
  async sendTemplatedMessage(templateName, recipientId, variables = {}) {
    try {
      const template = this.messageTemplates[templateName];
      if (!template) {
        console.error(`Template ${templateName} not found`);
        return null;
      }

      // Replace variables
      let subject = template.subject;
      let body = template.body;
      
      Object.entries(variables).forEach(([key, value]) => {
        subject = subject.replace(`{${key}}`, value);
        body = body.replace(`{${key}}`, value);
      });

      return await this.sendMessageToTeacher(recipientId, subject, body, 'high');
    } catch (error) {
      console.error('❌ Error sending templated message:', error);
      return null;
    }
  }

  // ─── HELPER: GET SYSTEM ADMIN ID ────────────────────
  async getSystemAdminId() {
    try {
      const { data: { user }, error } = await this.client.auth.getUser();
      if (error || !user) throw error;
      return user.id;
    } catch (error) {
      console.error('❌ Error getting system admin ID:', error);
      return null;
    }
  }
}

// ═══════════════════════════════════════════════════════════
// EXPORT FOR USE
// ═══════════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SystemAdminNotifications,
    SystemAdminCommunications
  };
}
