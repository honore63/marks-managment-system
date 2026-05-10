/**
 * MARKS MANAGEMENT SYSTEM — REAL-TIME COMMUNICATION ENGINE v3.0
 * Event-driven, bi-directional sync across System Admin ⇄ Admin ⇄ Teacher portals.
 * Single source of truth: Supabase PostgreSQL with Realtime subscriptions.
 *
 * FEATURES:
 * - Instant cross-portal synchronization (no refresh needed)
 * - Status-aware marks lifecycle (Draft → Submitted → Approved/Rejected)
 * - Connection resilience with auto-retry & exponential backoff
 * - Toast notifications for all sync events
 * - Cache invalidation on every remote change
 */

'use strict';

const RealtimeEngine = (() => {

    // ─── STATE ───────────────────────────────────────────────
    let _channel = null;
    let _schoolCode = null;
    let _portalType = null;   // 'admin' | 'teacher' | 'system_admin'
    let _userId = null;
    let _connected = false;
    let _retryCount = 0;
    const _MAX_RETRIES = 15;
    let _retryTimer = null;
    const _listeners = {};
    let _statusEl = null;

    // ─── EVENTS ──────────────────────────────────────────────
    const EVENTS = {
        MARKS_CREATED:       'marks_created',
        MARKS_UPDATED:       'marks_updated',
        MARKS_SUBMITTED:     'marks_submitted',
        MARKS_APPROVED:      'marks_approved',
        MARKS_REJECTED:      'marks_rejected',
        STUDENT_ADDED:       'student_added',
        STUDENT_UPDATED:     'student_updated',
        STUDENT_REMOVED:     'student_removed',
        TEACHER_ADDED:       'teacher_added',
        TEACHER_UPDATED:     'teacher_updated',
        TEACHER_REMOVED:     'teacher_removed',
        ASSIGNMENT_UPDATED:  'assignment_updated',
        CLASS_CHANGED:       'class_changed',
        SUBJECT_CHANGED:     'subject_changed',
        ASSESSMENT_CHANGED:  'assessment_changed',
        SETTINGS_CHANGED:    'settings_changed',
        NOTIFICATION_NEW:    'notification_new',
        SUPPORT_MESSAGE:     'support_message',
        CONNECTION_STATUS:   'connection_status'
    };

    // ─── HELPERS ─────────────────────────────────────────────

    function _invalidateCache() {
        // Wipe localStorage cache
        Object.keys(localStorage).forEach(k => {
            if (k.startsWith('camis_cache_') || k.startsWith('school_settings_')) {
                localStorage.removeItem(k);
            }
        });
        // Wipe in-memory cache
        if (typeof MEM_CACHE !== 'undefined' && MEM_CACHE.clear) MEM_CACHE.clear();
    }

    function _emit(eventName, data) {
        const cbs = _listeners[eventName] || [];
        cbs.forEach(fn => {
            try { fn(data); } catch (e) { console.error(`[RT] Listener error on ${eventName}:`, e); }
        });
        // Global DOM event for loose-coupled components
        window.dispatchEvent(new CustomEvent('mms-realtime', { detail: { event: eventName, data } }));
        // Legacy bridge
        window.dispatchEvent(new CustomEvent('mms-data-changed', { detail: { table: eventName, payload: data } }));
    }

    function _notify(msg, type) {
        if (typeof toast === 'function') toast(msg, type || 'info');
    }

    // ─── MARKS EVENT CLASSIFIER ──────────────────────────────
    function _classifyMarksEvent(payload) {
        const n = payload.new || {};
        const o = payload.old || {};
        const evType = payload.eventType;

        if (evType === 'INSERT') return EVENTS.MARKS_CREATED;
        if (evType === 'DELETE') return EVENTS.MARKS_UPDATED;

        // UPDATE — determine specific transition
        if (n.is_approved && !o.is_approved)               return EVENTS.MARKS_APPROVED;
        if (n.rejection_comment && !n.is_submitted && o.is_submitted) return EVENTS.MARKS_REJECTED;
        if (n.is_submitted && !o.is_submitted)             return EVENTS.MARKS_SUBMITTED;
        return EVENTS.MARKS_UPDATED;
    }

    // ─── PORTAL-SPECIFIC HANDLERS ────────────────────────────

    function _handleMarks(payload) {
        _invalidateCache();
        const event = _classifyMarksEvent(payload);
        _emit(event, payload);

        // Contextual notifications per portal
        if (_portalType === 'admin' || _portalType === 'system_admin') {
            if (event === EVENTS.MARKS_SUBMITTED) _notify('📤 New marks submitted for review', 'info');
            if (event === EVENTS.MARKS_CREATED)   _notify('📝 Teacher recorded new marks', 'info');
        }
        if (_portalType === 'teacher') {
            if (event === EVENTS.MARKS_APPROVED) _notify('✅ Your marks have been approved!', 'success');
            if (event === EVENTS.MARKS_REJECTED) {
                const comment = payload.new?.rejection_comment || '';
                _notify(`❌ Marks rejected: ${comment.substring(0, 60)}`, 'error');
            }
        }
    }

    function _handleStudents(payload) {
        _invalidateCache();
        const evType = payload.eventType;
        const event = evType === 'INSERT' ? EVENTS.STUDENT_ADDED
                    : evType === 'DELETE' ? EVENTS.STUDENT_REMOVED
                    : EVENTS.STUDENT_UPDATED;
        _emit(event, payload);

        if (_portalType === 'teacher') {
            if (event === EVENTS.STUDENT_ADDED)   _notify('📚 New student added to your class', 'info');
            if (event === EVENTS.STUDENT_REMOVED) _notify('🗑️ A student was removed from registry', 'warning');
        }
    }

    function _handleProfiles(payload) {
        _invalidateCache();
        const evType = payload.eventType;
        const event = evType === 'INSERT' ? EVENTS.TEACHER_ADDED
                    : evType === 'DELETE' ? EVENTS.TEACHER_REMOVED
                    : EVENTS.TEACHER_UPDATED;
        _emit(event, payload);

        if (_portalType === 'admin') {
            if (event === EVENTS.TEACHER_ADDED) _notify('👨‍🏫 New teacher registered', 'success');
        }
    }

    function _handleAssignments(payload) {
        _invalidateCache();
        _emit(EVENTS.ASSIGNMENT_UPDATED, payload);

        if (_portalType === 'teacher') _notify('📋 Your class/subject assignments were updated', 'info');
        if (_portalType === 'admin')   _notify('📋 Teacher assignments updated', 'info');
    }

    function _handleClasses(payload) {
        _invalidateCache();
        _emit(EVENTS.CLASS_CHANGED, payload);
    }

    function _handleSubjects(payload) {
        _invalidateCache();
        _emit(EVENTS.SUBJECT_CHANGED, payload);
    }

    function _handleAssessments(payload) {
        _invalidateCache();
        _emit(EVENTS.ASSESSMENT_CHANGED, payload);

        if (_portalType === 'teacher') _notify('📐 Assessment structure updated by admin', 'info');
    }

    function _handleSettings(payload) {
        _invalidateCache();
        localStorage.removeItem(`school_settings_${_schoolCode}`);
        _emit(EVENTS.SETTINGS_CHANGED, payload);
        _notify('⚙️ Institutional settings updated', 'info');
    }

    function _handleNotifications(payload) {
        _emit(EVENTS.NOTIFICATION_NEW, payload);
        if (payload.eventType === 'INSERT') {
            const msg = payload.new?.message || 'New notification';
            _notify(`🔔 ${msg.substring(0, 80)}`, payload.new?.urgency || 'info');
        }
    }

    function _handleSupport(payload) {
        _emit(EVENTS.SUPPORT_MESSAGE, payload);
        if (_portalType === 'system_admin' && payload.eventType === 'INSERT') {
            _notify('📩 New support request received', 'info');
        }
    }

    // ─── CONNECTION STATUS UI ────────────────────────────────

    function _updateStatus(status) {
        _statusEl = _statusEl || document.getElementById('sync-status-badge')
                              || document.getElementById('sync-badge')
                              || document.getElementById('setup-status');

        _emit(EVENTS.CONNECTION_STATUS, { status, connected: _connected });

        if (!_statusEl) return;

        const states = {
            SUBSCRIBED:    { text: '🟢 LIVE',         bg: '#dcfce7', color: '#166534' },
            CHANNEL_ERROR: { text: '🔴 ERROR',        bg: '#fee2e2', color: '#991b1b' },
            TIMED_OUT:     { text: '🟠 TIMEOUT',      bg: '#fff7ed', color: '#9a3412' },
            CLOSED:        { text: '⚫ OFFLINE',       bg: '#f1f5f9', color: '#475569' },
            CONNECTING:    { text: '🔄 SYNCING…',     bg: '#fef3c7', color: '#92400e' },
            RETRYING:      { text: '🔄 RECONNECTING…', bg: '#fef3c7', color: '#92400e' }
        };

        const s = states[status] || states.CONNECTING;
        _statusEl.textContent = s.text;
        _statusEl.style.background = s.bg;
        _statusEl.style.color = s.color;
        _statusEl.style.padding = '4px 12px';
        _statusEl.style.borderRadius = '99px';
        _statusEl.style.fontSize = '0.65rem';
        _statusEl.style.fontWeight = '900';
        _statusEl.style.display = 'inline-block';
    }

    // ─── RETRY LOGIC ─────────────────────────────────────────

    function _retry() {
        if (_retryCount >= _MAX_RETRIES) {
            _notify('⚠️ Sync disconnected after max retries. Please refresh.', 'error');
            _updateStatus('CLOSED');
            return;
        }
        _retryCount++;
        const delay = Math.min(2000 * Math.pow(1.5, _retryCount), 30000);
        console.warn(`[RT] Retry ${_retryCount}/${_MAX_RETRIES} in ${Math.round(delay / 1000)}s`);
        _updateStatus('RETRYING');

        clearTimeout(_retryTimer);
        _retryTimer = setTimeout(() => {
            _disconnect();
            _connect();
        }, delay);
    }

    // ─── CORE CONNECT ────────────────────────────────────────

    function _connect() {
        if (_channel) return;
        if (!_schoolCode) { console.warn('[RT] No school code — cannot connect'); return; }

        const chanName = _schoolCode === 'GLOBAL'
            ? 'rt-global-v3'
            : `rt-${_schoolCode}-v3`;

        console.log(`[RT] Connecting channel: ${chanName} (portal: ${_portalType})`);
        _updateStatus('CONNECTING');

        const filterOpt = _schoolCode !== 'GLOBAL'
            ? `school_code=eq.${_schoolCode}`
            : undefined;

        _channel = _supabase.channel(chanName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'marks',               filter: filterOpt }, _handleMarks)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'students',             filter: filterOpt }, _handleStudents)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles',             filter: filterOpt }, _handleProfiles)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'teacher_assignments',  filter: filterOpt }, _handleAssignments)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'classes',              filter: filterOpt }, _handleClasses)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'subjects',             filter: filterOpt }, _handleSubjects)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'assessments'                              }, _handleAssessments)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'school_settings',      filter: filterOpt }, _handleSettings)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications'                             }, _handleNotifications)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages'                          }, _handleSupport)
            .subscribe(status => {
                console.log(`[RT] Channel status: ${status}`);
                if (status === 'SUBSCRIBED') {
                    _connected = true;
                    _retryCount = 0;
                    _updateStatus('SUBSCRIBED');
                    console.log(`[RT] ✅ Live sync active for ${_portalType} @ ${_schoolCode}`);
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    _connected = false;
                    _updateStatus(status);
                    _retry();
                } else if (status === 'CLOSED') {
                    _connected = false;
                    _updateStatus('CLOSED');
                    _retry();
                }
            });
    }

    function _disconnect() {
        clearTimeout(_retryTimer);
        if (_channel) {
            try { _supabase.removeChannel(_channel); } catch (e) {}
            _channel = null;
            _connected = false;
        }
    }

    // ─── AUTO-REFRESH ORCHESTRATOR ───────────────────────────
    // Each portal registers its own refresh map

    function _createPortalRefresher(refreshMap) {
        // refreshMap: { event_name: async () => void }
        const handler = async (eventName, data) => {
            const fn = refreshMap[eventName];
            if (fn) {
                try { await fn(data); } catch (e) { console.error(`[RT] Refresh error for ${eventName}:`, e); }
            }
            // Also check wildcard
            const wildcard = refreshMap['*'];
            if (wildcard) {
                try { await wildcard(data); } catch (e) {}
            }
        };

        // Register for all events in the map
        Object.keys(refreshMap).forEach(eventName => {
            if (eventName !== '*') {
                on(eventName, (data) => handler(eventName, data));
            }
        });

        // Register wildcard for any event
        if (refreshMap['*']) {
            Object.values(EVENTS).forEach(ev => {
                on(ev, (data) => {
                    try { refreshMap['*'](data); } catch (e) {}
                });
            });
        }
    }

    // ─── PUBLIC API ──────────────────────────────────────────

    function on(eventName, callback) {
        if (!_listeners[eventName]) _listeners[eventName] = [];
        _listeners[eventName].push(callback);
    }

    function off(eventName, callback) {
        if (!_listeners[eventName]) return;
        _listeners[eventName] = _listeners[eventName].filter(fn => fn !== callback);
    }

    async function init(portalType) {
        _portalType = portalType;

        // Resolve school code
        if (typeof DB !== 'undefined' && DB._getSchoolCode) {
            _schoolCode = await DB._getSchoolCode();
        } else {
            _schoolCode = sessionStorage.getItem('current_school_code') || 'GLOBAL';
        }

        // Resolve user
        try {
            const { data: { user } } = await _supabase.auth.getUser();
            _userId = user?.id;
        } catch (e) {}

        console.log(`[RT] Initialized: portal=${_portalType}, school=${_schoolCode}, user=${_userId?.substring(0, 8)}`);

        _connect();

        // Also start the legacy SYNC engine for backward compatibility
        if (typeof SYNC !== 'undefined' && SYNC.start && SYNC !== RealtimeEngine) {
            try { await SYNC.start(); } catch (e) {}
        }
    }

    function destroy() {
        _disconnect();
        Object.keys(_listeners).forEach(k => delete _listeners[k]);
    }

    function isConnected() { return _connected; }

    return {
        EVENTS,
        init,
        destroy,
        on,
        off,
        isConnected,
        registerRefreshMap: _createPortalRefresher,
        // Expose for external use
        get portalType() { return _portalType; },
        get schoolCode() { return _schoolCode; }
    };
})();

// Make globally available
window.RealtimeEngine = RealtimeEngine;
