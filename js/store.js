/**
 * Athar Store — API-backed cache
 * Reads from the backend. Writes go through AtharAPI directly from views.
 */

window.AtharStore = (function () {
  "use strict";

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

  // ---------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------
  function iso(d) {
    if (!d) return null;
    if (typeof d === "string") return d.slice(0, 10);
    try { return new Date(d).toISOString().slice(0, 10); } catch { return null; }
  }

  function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // ---------------------------------------------------------
  // Adapters (API camelCase → frontend snake_case)
  // ---------------------------------------------------------
  function adaptVolunteer(v) {
    return {
      id: v.id,
      full_name: v.fullName,
      full_name_ar: v.fullNameAr,
      national_id: v.nationalId,
      phone: v.phone,
      whatsapp: v.whatsapp,
      email: v.email,
      dob: iso(v.dob),
      gender: v.gender,
      nationality: v.nationality,          // ← new
      study_level: v.studyLevel,           // ← new
      skills: v.skills || [],
      status: v.status,
      committee_id: v.committeeId,
      join_date: iso(v.joinDate),
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
      manager_name: c.manager?.fullName || null,
      status: c.status,
      member_count: c.memberCount ?? 0,
      created_at: c.createdAt,
    };
  }

  function adaptMeeting(m) {
    return {
      id: m.id,
      kind: m.kind || "meeting",           // ← NEW — defaults to "meeting" if API omits
      title_en: m.titleEn,
      title_ar: m.titleAr,
      description: m.description,
      meeting_date: iso(m.meetingDate),
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
      date: iso(h.date),
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
      usage_count: c.usageCount ?? 0,
    };
  }

  function adaptEvaluation(e) {
    return {
      id: e.id,
      volunteer_id: e.volunteerId,
      evaluator_id: e.evaluatorId,
      period_label: e.periodLabel,
      period_start: iso(e.periodStart),
      period_end: iso(e.periodEnd),
      overall_score: Number(e.overallScore),
      notes: e.notes,
      evaluated_at: e.evaluatedAt,
      updated_at: e.updatedAt,
      volunteer: e.volunteer || null,
      evaluator: e.evaluator || null,
      scores: (e.scores || []).map((s) => ({
        id: s.id,
        evaluation_id: s.evaluationId,
        criteria_id: s.criteriaId,
        score: s.score,
        comment: s.comment,
        criteria: s.criteria || null,
      })),
    };
  }

  function adaptCertificate(c) {
    return {
      id: c.id,
      certificate_no: c.certificateNo,
      volunteer_id: c.volunteerId,
      total_hours: Number(c.totalHours),
      period_start: iso(c.periodStart),
      period_end: iso(c.periodEnd),
      issue_date: iso(c.issueDate),
      language: c.language,
      qr_code: c.qrCode,
      file_url: c.fileUrl,
      status: c.status,
      approved_by: c.approvedBy,
      approved_at: c.approvedAt,
      revoked_reason: c.revokedReason,
      created_at: c.createdAt,
      volunteer: c.volunteer || null,
    };
  }

  function adaptUser(u) {
    return {
      id: u.id,
      full_name: u.fullName || u.full_name,
      email: u.email,
      role: u.role,
      is_active: u.isActive !== false,
      preferred_language: u.preferredLanguage || u.preferred_language || "ar",
      last_login_at: u.lastLoginAt || u.last_login_at,
      created_at: u.createdAt,
      preset: u.preset,
    };
  }

  function adaptAuditLog(l) {
    let createdAt = l.createdAt;
    if (typeof createdAt === "string") {
      createdAt = createdAt.replace("T", " ").slice(0, 19);
    } else if (createdAt) {
      try {
        createdAt = new Date(createdAt).toISOString().replace("T", " ").slice(0, 19);
      } catch {
        createdAt = "";
      }
    } else {
      createdAt = "";
    }

    return {
      id: l.id,
      user_id: l.userId,
      user_name: l.userName || (l.user && l.user.fullName) || "System",
      action: l.action,
      entity: l.entity,
      entity_id: l.entityId,
      details: l.details,
      old_value: l.oldValue,
      new_value: l.newValue,
      ip_address: l.ipAddress,
      user_agent: l.userAgent,
      created_at: createdAt,
    };
  }

  // ---------------------------------------------------------
  // Load all data from API
  // ---------------------------------------------------------
  async function loadAll() {
    if (!window.AtharAPI || !window.AtharAPI.hasSession()) {
      console.warn("[Store] No API session");
      return state;
    }

    console.log("[Store] Loading from API…");
    const api = window.AtharAPI;

    const results = await Promise.allSettled([
      api.volunteers.list({ limit: 100, includeArchived: true }),
      api.committees.list({ limit: 100 }),
      api.meetings.list({ limit: 100 }),
      api.hours.list({ limit: 100 }),
      api.criteria.list(),
      api.evaluations.list({ limit: 100 }),
      api.certificates.list({ limit: 100 }),
      api.settings.list(),
      api.audit.list({ limit: 100 }),
    ]);

    const [volsR, commR, mtgR, hrsR, critR, evalR, certR, setR, auditR] = results;

    if (volsR.status === "fulfilled" && volsR.value?.items) {
      state.volunteers = volsR.value.items.map(adaptVolunteer);
    }
    if (commR.status === "fulfilled" && commR.value?.items) {
      state.committees = commR.value.items.map(adaptCommittee);
    }
    if (mtgR.status === "fulfilled" && mtgR.value?.items) {
      state.meetings = mtgR.value.items.map(adaptMeeting);
    }
    if (hrsR.status === "fulfilled" && hrsR.value?.items) {
      state.volunteer_hours = hrsR.value.items.map(adaptHours);
    }
    if (critR.status === "fulfilled" && Array.isArray(critR.value)) {
      state.criteria = critR.value.map(adaptCriterion);
    }
    if (evalR.status === "fulfilled" && evalR.value?.items) {
      state.evaluations = evalR.value.items.map(adaptEvaluation);
    }
    if (certR.status === "fulfilled" && certR.value?.items) {
      state.certificates = certR.value.items.map(adaptCertificate);
    }
    if (setR.status === "fulfilled" && Array.isArray(setR.value)) {
      const obj = {};
      for (const s of setR.value) obj[s.key] = s.value;
      state.settings = { ...state.settings, ...obj };
    }
    if (auditR.status === "fulfilled" && auditR.value?.items) {
      state.audit_logs = auditR.value.items.map(adaptAuditLog);
    } else if (auditR.status === "rejected") {
      // Trusted admin without audit_logs.view — silently ignore (403 expected)
      const code = auditR.reason?.status;
      if (code !== 403) {
        console.warn("[Store] Failed to load audit logs:", auditR.reason?.message);
      }
    }

    // Currently logged-in user as the only "user" for trusted admins
    const me = window.AtharAuth?.getCurrentUser?.();
    if (me) state.users = [adaptUser(me)];

    console.log(`[Store] Loaded ${state.volunteers.length}v ${state.committees.length}c ${state.meetings.length}m ${state.volunteer_hours.length}h ${state.certificates.length}cert ${state.audit_logs.length}audit`);
    return state;
  }

  // ---------------------------------------------------------
  // Refresh helpers (called after mutations)
  // ---------------------------------------------------------
  async function refreshVolunteers() {
    if (!window.AtharAPI?.hasSession()) return;
    const r = await window.AtharAPI.volunteers.list({ limit: 100, includeArchived: true });
    state.volunteers = (r.items || []).map(adaptVolunteer);
  }
  async function refreshCommittees() {
    if (!window.AtharAPI?.hasSession()) return;
    const r = await window.AtharAPI.committees.list({ limit: 100 });
    state.committees = (r.items || []).map(adaptCommittee);
  }
  async function refreshMeetings() {
    if (!window.AtharAPI?.hasSession()) return;
    const r = await window.AtharAPI.meetings.list({ limit: 100 });
    state.meetings = (r.items || []).map(adaptMeeting);
  }
  async function refreshHours() {
    if (!window.AtharAPI?.hasSession()) return;
    const r = await window.AtharAPI.hours.list({ limit: 100 });
    state.volunteer_hours = (r.items || []).map(adaptHours);
  }
  async function refreshCriteria() {
    if (!window.AtharAPI?.hasSession()) return;
    const items = await window.AtharAPI.criteria.list();
    state.criteria = (items || []).map(adaptCriterion);
  }
  async function refreshEvaluations() {
    if (!window.AtharAPI?.hasSession()) return;
    const r = await window.AtharAPI.evaluations.list({ limit: 100 });
    state.evaluations = (r.items || []).map(adaptEvaluation);
  }
  async function refreshCertificates() {
    if (!window.AtharAPI?.hasSession()) return;
    const r = await window.AtharAPI.certificates.list({ limit: 100 });
    state.certificates = (r.items || []).map(adaptCertificate);
  }
  async function refreshSettings() {
    if (!window.AtharAPI?.hasSession()) return state.settings;
    try {
      const items = await window.AtharAPI.settings.list();
      if (Array.isArray(items)) {
        const obj = {};
        for (const s of items) obj[s.key] = s.value;
        state.settings = { ...state.settings, ...obj };
      }
    } catch (e) {
      console.warn("[Store] Failed to refresh settings:", e);
    }
    return state.settings;
  }
  async function refreshAuditLogs(params = {}) {
    if (!window.AtharAPI?.hasSession()) return state.audit_logs;
    try {
      const r = await window.AtharAPI.audit.list({ limit: 100, ...params });
      state.audit_logs = (r.items || []).map(adaptAuditLog);
    } catch (e) {
      if (e.status !== 403) {
        console.warn("[Store] refreshAuditLogs failed:", e.message);
      }
    }
    return state.audit_logs;
  }

  // ---------------------------------------------------------
  // Volunteer stats (computed from cache)
  // ---------------------------------------------------------
  function getVolunteerStats(volunteerId) {
    const approvedHours = state.volunteer_hours
      .filter((h) => h.volunteer_id === volunteerId && h.status === "approved")
      .reduce((s, h) => s + Number(h.hours), 0);

    const volAtt = state.attendance.filter((a) => a.volunteer_id === volunteerId);
    const present = volAtt.filter((a) => a.status === "present" || a.status === "late").length;
    const rate = volAtt.length > 0 ? Math.round((present / volAtt.length) * 100) : 100;

    const evs = state.evaluations.filter((e) => e.volunteer_id === volunteerId);
    const avg = evs.length > 0
      ? (evs.reduce((s, e) => s + Number(e.overall_score), 0) / evs.length).toFixed(1)
      : "5.0";

    const certs = state.certificates.filter(
      (c) => c.volunteer_id === volunteerId && c.status === "issued"
    ).length;

    return {
      totalHours: approvedHours,
      attendanceRate: rate,
      avgEvaluation: avg,
      certsCount: certs,
      streak: 6,
    };
  }

  // ---------------------------------------------------------
  // Legacy no-ops
  // ---------------------------------------------------------
  function save() { }          // server owns persistence
  function logAudit() { }      // server writes its own audit
  function resetToSeed() { return state; }
  function applyDecryption() { return Promise.resolve(false); }

  return {
    getState: () => state,
    loadAll,
    refreshVolunteers,
    refreshCommittees,
    refreshMeetings,
    refreshHours,
    refreshCriteria,
    refreshEvaluations,
    refreshCertificates,
    refreshSettings,
    refreshAuditLogs,
    getVolunteerStats,
    generateUUID,
    save,
    logAudit,
    resetToSeed,
    applyDecryption,
  };
})();