/**
 * Athar Store — API-backed cache with synchronous getState().
 *
 * The store is now a two-layer system:
 *   - Server (Postgres): source of truth
 *   - In-memory cache (this file): synchronous access for the UI
 *
 * Views keep calling `AtharStore.getState().volunteers` — no changes needed.
 * The cache is populated by `loadAll()` on boot and refreshed by
 * `refreshXxx()` after mutations.
 *
 * Legacy no-ops:
 *   - save()        → no-op (server owns persistence)
 *   - logAudit()    → no-op (server writes its own audit)
 *   - resetToSeed() → disabled (destructive in API mode)
 */

window.AtharStore = (function () {
  "use strict";

  // ============================================================
  // In-memory state (frontend shape — snake_case keys)
  // ============================================================
  const state = {
    users: [],
    permissions: [],
    committees: [],
    volunteers: [],
    committee_transfers: [],
    meetings: [],
    attendance: [],
    criteria: [],
    evaluations: [],
    evaluation_scores: [],
    volunteer_hours: [],
    certificates: [],
    whatsapp_templates: [],
    audit_logs: [],
    settings: {
      org_name_en: "Athar Foundation for Community Empowerment",
      org_name_ar: "مؤسسة أثر للتمكين والعمل المجتمعي",
      org_logo_url: "assets/logo.svg",
      cert_prefix: "ATHAR-2026-",
      cert_sequence: 0,
      default_language: "ar",
      session_timeout_minutes: 15,
      signatory_name_ar: "د. محمد عبدالله آل سعود",
      signatory_name_en: "Dr. Mohammed A. Al-Saud",
      signatory_title_ar: "الرئيس التنفيذي للمؤسسة",
      signatory_title_en: "Chief Executive Officer",
    },
  };

  // ============================================================
  // Helpers
  // ============================================================
  function isoDate(d) {
    if (!d) return null;
    if (typeof d === "string") return d.slice(0, 10);
    try { return new Date(d).toISOString().slice(0, 10); } catch { return null; }
  }

  function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // ============================================================
  // Adapters: API → frontend shape
  // ============================================================
  function adaptVolunteer(v) {
    return {
      id: v.id,
      full_name: v.fullName,
      full_name_ar: v.fullNameAr,
      national_id: v.nationalId,
      phone: v.phone,
      whatsapp: v.whatsapp,
      email: v.email,
      dob: isoDate(v.dob),
      gender: v.gender,
      skills: v.skills || [],
      status: v.status,
      committee_id: v.committeeId,
      join_date: isoDate(v.joinDate),
      notes: v.notes,
      created_at: v.createdAt,
      archived_at: v.archivedAt,
      committee: v.committee || null,
    };
  }

  function adaptCommittee(c) {
    return {
      id: c.id,
      name_en: c.nameEn,
      name_ar: c.nameAr,
      description_en: c.descriptionEn,
      description_ar: c.descriptionAr,
      manager_id: c.managerId,
      manager_name: c.manager ? c.manager.fullName : null,
      status: c.status,
      member_count: c.memberCount || 0,
      created_at: c.createdAt,
    };
  }

  function adaptMeeting(m) {
    return {
      id: m.id,
      title_en: m.titleEn,
      title_ar: m.titleAr,
      description: m.description,
      meeting_date: isoDate(m.meetingDate),
      start_time: m.startTime,
      end_time: m.endTime,
      location: m.location,
      committee_id: m.committeeId,
      created_by: m.createdBy,
      status: m.status,
      created_at: m.createdAt,
      committee: m.committee || null,
      attendance_summary: m.attendanceSummary || null,
    };
  }

  function adaptHours(h) {
    return {
      id: h.id,
      volunteer_id: h.volunteerId,
      activity: h.activity,
      description: h.description,
      hours: Number(h.hours),
      date: isoDate(h.date),
      committee_id: h.committeeId,
      status: h.status,
      approved_by: h.approvedBy,
      approved_at: h.approvedAt,
      rejection_reason: h.rejectionReason,
      created_by: h.createdBy,
      created_at: h.createdAt,
      volunteer: h.volunteer || null,
      committee: h.committee || null,
    };
  }

  function adaptCriterion(c) {
    return {
      id: c.id,
      name_en: c.nameEn,
      name_ar: c.nameAr,
      description_en: c.descriptionEn,
      description_ar: c.descriptionAr,
      weight: Number(c.weight),
      display_order: c.displayOrder,
      is_active: c.isActive,
      created_at: c.createdAt,
      usage_count: c.usageCount || 0,
    };
  }

  function adaptEvaluationScore(s) {
    return {
      id: s.id,
      evaluation_id: s.evaluationId,
      criteria_id: s.criteriaId,
      score: s.score,
      comment: s.comment,
      criteria: s.criteria || null,
    };
  }

  function adaptEvaluation(e) {
    return {
      id: e.id,
      volunteer_id: e.volunteerId,
      evaluator_id: e.evaluatorId,
      period_label: e.periodLabel,
      period_start: isoDate(e.periodStart),
      period_end: isoDate(e.periodEnd),
      overall_score: Number(e.overallScore),
      notes: e.notes,
      evaluated_at: e.evaluatedAt,
      updated_at: e.updatedAt,
      volunteer: e.volunteer || null,
      evaluator: e.evaluator || null,
      scores: (e.scores || []).map(adaptEvaluationScore),
    };
  }

  function adaptCertificate(c) {
    return {
      id: c.id,
      certificate_no: c.certificateNo,
      volunteer_id: c.volunteerId,
      total_hours: Number(c.totalHours),
      period_start: isoDate(c.periodStart),
      period_end: isoDate(c.periodEnd),
      issue_date: isoDate(c.issueDate),
      language: c.language,
      qr_code: c.qrCode,
      file_url: c.fileUrl,
      status: c.status,
      approved_by: c.approvedBy,
      approved_at: c.approvedAt,
      revoked_reason: c.revokedReason,
      created_at: c.createdAt,
      volunteer: c.volunteer || null,
      approver: c.approver || null,
    };
  }

  function adaptUser(u) {
    return {
      id: u.id,
      full_name: u.fullName,
      email: u.email,
      role: u.role,
      is_active: u.isActive,
      preferred_language: u.preferredLanguage,
      last_login_at: u.lastLoginAt,
      created_at: u.createdAt,
      permissions: (u.permissions || []).map(function(p) {
        return {
          module: p.module,
          can_view: p.canView,
          can_create: p.canCreate,
          can_edit: p.canEdit,
          can_delete: p.canDelete,
          can_approve: p.canApprove,
        };
      }),
    };
  }

  function adaptAuditLog(l) {
    return {
      id: l.id,
      user_id: l.userId,
      user_name: l.user ? l.user.fullName : "System",
      action: l.action,
      entity: l.entity,
      entity_id: l.entityId,
      details: l.details,
      old_value: l.oldValue,
      new_value: l.newValue,
      ip_address: l.ipAddress,
      user_agent: l.userAgent,
      created_at: l.createdAt,
    };
  }

  // ============================================================
  // Loading — all in parallel
  // ============================================================
  async function loadAll() {
    const api = window.AtharAPI;
    if (!api || !api.hasSession()) {
      console.warn("[AtharStore] No API session — using local seed for demo.");
      const seed = getInitialSeed();
      Object.keys(seed).forEach(function(k) { state[k] = seed[k]; });
      return state;
    }

    console.log("[AtharStore] Loading from API\u2026");

    const results = await Promise.allSettled([
      api.volunteers.list({ limit: 100, includeArchived: true }),
      api.committees.list({ limit: 100 }),
      api.meetings.list({ limit: 100 }),
      api.hours.list({ limit: 100 }),
      api.criteria.list(),
      api.evaluations.list({ limit: 100 }),
      api.certificates.list({ limit: 100 }),
      api.settings.list(),
      api.users.list({ limit: 100 }),
    ]);

    const names = ["volunteers", "committees", "meetings", "hours", "criteria", "evaluations", "certificates", "settings", "users"];
    results.forEach(function(r, i) {
      if (r.status === "rejected") {
        console.warn("[AtharStore] Failed to load " + names[i] + ":", r.reason && r.reason.message || r.reason);
      }
    });

    const volunteersRes = results[0];
    const committeesRes = results[1];
    const meetingsRes   = results[2];
    const hoursRes      = results[3];
    const criteriaRes   = results[4];
    const evaluationsRes= results[5];
    const certificatesRes=results[6];
    const settingsRes   = results[7];
    const usersRes      = results[8];

    if (volunteersRes.status === "fulfilled" && volunteersRes.value && volunteersRes.value.items) {
      state.volunteers = volunteersRes.value.items.map(adaptVolunteer);
    }
    if (committeesRes.status === "fulfilled" && committeesRes.value && committeesRes.value.items) {
      state.committees = committeesRes.value.items.map(adaptCommittee);
    }
    if (meetingsRes.status === "fulfilled" && meetingsRes.value && meetingsRes.value.items) {
      state.meetings = meetingsRes.value.items.map(adaptMeeting);
    }
    if (hoursRes.status === "fulfilled" && hoursRes.value && hoursRes.value.items) {
      state.volunteer_hours = hoursRes.value.items.map(adaptHours);
    }
    if (criteriaRes.status === "fulfilled" && Array.isArray(criteriaRes.value)) {
      state.criteria = criteriaRes.value.map(adaptCriterion);
    }
    if (evaluationsRes.status === "fulfilled" && evaluationsRes.value && evaluationsRes.value.items) {
      state.evaluations = evaluationsRes.value.items.map(adaptEvaluation);
    }
    if (certificatesRes.status === "fulfilled" && certificatesRes.value && certificatesRes.value.items) {
      state.certificates = certificatesRes.value.items.map(adaptCertificate);
    }
    if (settingsRes.status === "fulfilled" && Array.isArray(settingsRes.value)) {
      const obj = {};
      settingsRes.value.forEach(function(s) { obj[s.key] = s.value; });
      Object.assign(state.settings, obj);
    }
    if (usersRes.status === "fulfilled" && usersRes.value && usersRes.value.items) {
      state.users = usersRes.value.items.map(adaptUser);
    } else {
      // Trusted admin — show only themselves
      const me = window.AtharAuth && window.AtharAuth.getCurrentUser && window.AtharAuth.getCurrentUser();
      if (me) {
        state.users = [adaptUser({
          id: me.id,
          fullName: me.full_name,
          email: me.email,
          role: me.role,
          isActive: true,
          preferredLanguage: me.preferred_language,
          permissions: [],
        })];
      }
    }

    if (!state.whatsapp_templates.length) {
      state.whatsapp_templates = getDefaultWhatsAppTemplates();
    }

    console.log(
      "[AtharStore] Loaded: " + state.volunteers.length + " volunteers, " +
      state.committees.length + " committees, " + state.meetings.length + " meetings, " +
      state.volunteer_hours.length + " hours, " + state.certificates.length + " certificates"
    );

    return state;
  }

  // ============================================================
  // Individual refreshers (call after mutations)
  // ============================================================
  async function refreshVolunteers(params) {
    const api = window.AtharAPI;
    if (!api || !api.hasSession()) return state.volunteers;
    const res = await api.volunteers.list(Object.assign({ limit: 100, includeArchived: true }, params || {}));
    state.volunteers = (res.items || []).map(adaptVolunteer);
    return state.volunteers;
  }

  async function refreshCommittees() {
    const api = window.AtharAPI;
    if (!api || !api.hasSession()) return state.committees;
    const res = await api.committees.list({ limit: 100 });
    state.committees = (res.items || []).map(adaptCommittee);
    return state.committees;
  }

  async function refreshMeetings(params) {
    const api = window.AtharAPI;
    if (!api || !api.hasSession()) return state.meetings;
    const res = await api.meetings.list(Object.assign({ limit: 100 }, params || {}));
    state.meetings = (res.items || []).map(adaptMeeting);
    return state.meetings;
  }

  async function refreshHours(params) {
    const api = window.AtharAPI;
    if (!api || !api.hasSession()) return state.volunteer_hours;
    const res = await api.hours.list(Object.assign({ limit: 100 }, params || {}));
    state.volunteer_hours = (res.items || []).map(adaptHours);
    return state.volunteer_hours;
  }

  async function refreshCriteria(params) {
    const api = window.AtharAPI;
    if (!api || !api.hasSession()) return state.criteria;
    const items = await api.criteria.list(params || {});
    state.criteria = (items || []).map(adaptCriterion);
    return state.criteria;
  }

  async function refreshEvaluations(params) {
    const api = window.AtharAPI;
    if (!api || !api.hasSession()) return state.evaluations;
    const res = await api.evaluations.list(Object.assign({ limit: 100 }, params || {}));
    state.evaluations = (res.items || []).map(adaptEvaluation);
    return state.evaluations;
  }

  async function refreshCertificates(params) {
    const api = window.AtharAPI;
    if (!api || !api.hasSession()) return state.certificates;
    const res = await api.certificates.list(Object.assign({ limit: 100 }, params || {}));
    state.certificates = (res.items || []).map(adaptCertificate);
    return state.certificates;
  }

  async function refreshSettings() {
    const api = window.AtharAPI;
    if (!api || !api.hasSession()) return state.settings;
    const items = await api.settings.list();
    if (Array.isArray(items)) {
      const obj = {};
      items.forEach(function(s) { obj[s.key] = s.value; });
      Object.assign(state.settings, obj);
    }
    return state.settings;
  }

  async function refreshUsers() {
    const api = window.AtharAPI;
    if (!api || !api.hasSession()) return state.users;
    try {
      const res = await api.users.list({ limit: 100 });
      state.users = (res.items || []).map(adaptUser);
    } catch (e) {
      if (e.status !== 403) throw e;
    }
    return state.users;
  }

  async function refreshAuditLogs(params) {
    const api = window.AtharAPI;
    if (!api || !api.hasSession()) return state.audit_logs;
    try {
      const res = await api.audit.list(Object.assign({ limit: 200 }, params || {}));
      state.audit_logs = (res.items || []).map(adaptAuditLog);
    } catch (e) {
      if (e.status !== 403) throw e;
    }
    return state.audit_logs;
  }

  // ============================================================
  // Volunteer stats (synchronous, computed from cache)
  // ============================================================
  function getVolunteerStats(volunteerId) {
    const vol = state.volunteers.find(function(v) { return v.id === volunteerId; });
    if (!vol) return null;

    const approvedHours = state.volunteer_hours
      .filter(function(h) { return h.volunteer_id === volunteerId && h.status === "approved"; })
      .reduce(function(sum, h) { return sum + Number(h.hours); }, 0);

    const volAttendance = state.attendance.filter(function(a) { return a.volunteer_id === volunteerId; });
    const totalMeetings = volAttendance.length;
    const presentCount = volAttendance.filter(function(a) {
      return a.status === "present" || a.status === "late";
    }).length;
    const attendanceRate = totalMeetings > 0
      ? Math.round((presentCount / totalMeetings) * 100)
      : 100;

    const volEvals = state.evaluations.filter(function(e) { return e.volunteer_id === volunteerId; });
    const avgEval = volEvals.length > 0
      ? (volEvals.reduce(function(sum, e) { return sum + Number(e.overall_score); }, 0) / volEvals.length).toFixed(1)
      : "5.0";

    const certsCount = state.certificates.filter(function(c) {
      return c.volunteer_id === volunteerId && c.status === "issued";
    }).length;

    return {
      totalHours: approvedHours,
      attendanceRate: attendanceRate,
      avgEvaluation: avgEval,
      certsCount: certsCount,
      streak: 6,
    };
  }

  // ============================================================
  // Legacy no-ops
  // ============================================================
  function save() {
    // No-op: server owns persistence. Kept for backward compat.
  }

  function logAudit() {
    // No-op: server writes its own audit log.
  }

  function resetToSeed() {
    console.warn("[AtharStore] resetToSeed() is disabled in API mode.");
    return state;
  }

  function applyDecryption() {
    // No-op: server-side plaintext, no client-side encryption needed.
    return Promise.resolve(false);
  }

  // ============================================================
  // Demo fallback (used when no API session)
  // ============================================================
  function getInitialSeed() {
    return {
      users: [],
      permissions: [],
      committees: [
        {
          id: "comm-01",
          name_en: "Media & Public Relations Committee",
          name_ar: "لجنة الإعلام والعلاقات العامة",
          description_en: "Covers media production, digital storytelling, and outreach.",
          description_ar: "المسؤولة عن التغطية الإعلامية وصناعة المحتوى.",
          manager_id: null,
          manager_name: null,
          status: "active",
          member_count: 0,
          created_at: "2026-01-10",
        },
      ],
      volunteers: [],
      committee_transfers: [],
      meetings: [],
      attendance: [],
      criteria: [
        { id: "crit-01", name_en: "Attendance & Punctuality", name_ar: "الحضور والانضباط", weight: 1.5, display_order: 1, is_active: true },
        { id: "crit-02", name_en: "Teamwork & Collaboration", name_ar: "العمل الجماعي", weight: 1.0, display_order: 2, is_active: true },
        { id: "crit-03", name_en: "Initiative & Problem Solving", name_ar: "المبادرة", weight: 1.0, display_order: 3, is_active: true },
        { id: "crit-04", name_en: "Quality of Work", name_ar: "جودة العمل", weight: 1.0, display_order: 4, is_active: true },
        { id: "crit-05", name_en: "Commitment to Mission", name_ar: "الالتزام بالرسالة", weight: 1.5, display_order: 5, is_active: true },
      ],
      evaluations: [],
      evaluation_scores: [],
      volunteer_hours: [],
      certificates: [],
      whatsapp_templates: getDefaultWhatsAppTemplates(),
      audit_logs: [],
      settings: Object.assign({}, state.settings),
    };
  }

  function getDefaultWhatsAppTemplates() {
    return [
      {
        id: "wa-tmpl-01",
        name: "Meeting Invitation (AR)",
        language: "ar",
        body: "مرحباً {name}، يسعدنا دعوتك لحضور اجتماع {committee} المقرر في تاريخ {date}. نتطلع لمشاركتك!",
        is_active: true,
      },
      {
        id: "wa-tmpl-02",
        name: "Meeting Invitation (EN)",
        language: "en",
        body: "Hello {name}, you are warmly invited to attend the {committee} meeting on {date}. Looking forward to seeing you!",
        is_active: true,
      },
      {
        id: "wa-tmpl-03",
        name: "Certificate Ready (AR)",
        language: "ar",
        body: "أهلاً {name}، صدرت شهادتك التقديرية رقم {certificate_no} بعد إنجازك {hours} ساعة تطوعية. تحقق عبر: {verify_url}",
        is_active: true,
      },
      {
        id: "wa-tmpl-04",
        name: "Certificate Ready (EN)",
        language: "en",
        body: "Dear {name}, your Certificate of Volunteer Service ({certificate_no}) is ready, recognizing {hours} hours. Verify: {verify_url}",
        is_active: true,
      },
    ];
  }

  // ============================================================
  // Public API
  // ============================================================
  return {
    getState: function() { return state; },

    loadAll: loadAll,
    refreshVolunteers: refreshVolunteers,
    refreshCommittees: refreshCommittees,
    refreshMeetings: refreshMeetings,
    refreshHours: refreshHours,
    refreshCriteria: refreshCriteria,
    refreshEvaluations: refreshEvaluations,
    refreshCertificates: refreshCertificates,
    refreshSettings: refreshSettings,
    refreshUsers: refreshUsers,
    refreshAuditLogs: refreshAuditLogs,

    save: save,
    logAudit: logAudit,
    resetToSeed: resetToSeed,
    generateUUID: generateUUID,
    getVolunteerStats: getVolunteerStats,
    applyDecryption: applyDecryption,
  };
})();
