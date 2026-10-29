/**
 * View: Volunteers (list + profile + tabs)
 */
(function () {
  "use strict";

  const {
    App, t, formatDate, age, genderStyle, splitNotes,
    ic, showToast, showConfirmModal, hasPermission, navigateTo, escapeHtml
  } = window.AtharCore;

  // =========================================================================
  // Small helpers
  // =========================================================================
  function escAttr(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/"/g, "&quot;")
      .replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function avatarHtml(vol, size) {
    const s = genderStyle(vol.gender);
    const initials = (vol.full_name || "?").charAt(0).toUpperCase();
    const px = size || 32;
    const fs = Math.max(10, Math.round(px * 0.42));
    return `
      <div class="user-avatar" style="
        width:${px}px; height:${px}px; font-size:${fs}px;
        background:${s.bg};
        color:${s.text};
        border:2px solid ${s.border};
        box-shadow:0 0 0 3px ${s.ring};
      ">${initials}</div>
    `;
  }

  function genderChip(gender) {
    if (!gender) return "";
    const s = genderStyle(gender);
    const dotColor = s.border;
    return `<span style="display:inline-flex; align-items:center; padding:0; background:transparent; border:none;">
      <span style="width:8px; height:8px; border-radius:50%; background:transparent; border:1.5px solid ${dotColor}; display:inline-block;"></span>
    </span>`;
  }

  function volDisplayName(v) {
    if (!v) return "";
    return App.currentLang === "ar"
      ? (v.full_name_ar || v.full_name || "")
      : (v.full_name || v.full_name_ar || "");
  }

  function legacyCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = String(text);
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function copyText(text) {
    const done = () => showToast(t("copied") || "Copied", "success");
    const fail = () => showToast(App.currentLang === "ar" ? "تعذر النسخ" : "Copy failed", "error");
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(String(text))
          .then(done)
          .catch(() => (legacyCopy(text) ? done() : fail()));
      } else {
        legacyCopy(text) ? done() : fail();
      }
    } catch (e) { fail(); }
  }

  // Binds every [data-copy] button inside root to copy its value.
  function bindCopyButtons(root) {
    root.querySelectorAll("[data-copy]").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        copyText(btn.getAttribute("data-copy"));
      };
    });
  }

  function contactCellHtml(v) {
    const primary = v.whatsapp || v.phone || "";
    if (!primary) return '<span style="color:var(--neutral-400);">—</span>';
    const digits = String(v.whatsapp || v.phone).replace(/[^0-9]/g, "");
    return `<div class="contact-cell">
      ${v.whatsapp ? `<a href="https://wa.me/${digits}" target="_blank" class="wa-quick" title="WhatsApp" onclick="event.stopPropagation();">${ic("whatsapp", 13)}</a>` : ''}
      <span class="num-ltr contact-num">${primary}</span>
      <button type="button" class="copy-quick" data-copy="${escAttr(primary)}" title="${t("copy") || "Copy"}">${ic("copy", 11)}</button>
    </div>`;
  }

  // ---- Round 7: duplicate detection (client-side scan over the store) ----
  function normPhoneKey(raw) {
    const d = String(raw || "").replace(/\D/g, "").replace(/^0+/, "");
    return d.length >= 9 ? d.slice(-9) : d;
  }
  function normEmailKey(raw) { return String(raw || "").trim().toLowerCase(); }

  // Groups of 2+ volunteers sharing national ID / phone / email.
  function buildDuplicateGroups(vols) {
    const maps = { id: {}, phone: {}, email: {} };
    const add = (field, key, v) => { if (!key) return; (maps[field][key] = maps[field][key] || []).push(v); };
    (vols || []).forEach(v => {
      if (v.national_id) add("id", String(v.national_id).trim(), v);
      add("phone", normPhoneKey(v.whatsapp) || normPhoneKey(v.phone), v);
      add("email", normEmailKey(v.email), v);
    });
    const groups = [];
    ["id", "phone", "email"].forEach(field => {
      Object.keys(maps[field]).forEach(k => {
        if (maps[field][k].length > 1) groups.push({ field, key: k, members: maps[field][k] });
      });
    });
    return groups;
  }
  function dupMarkMap(groups) {
    const map = new Map();
    groups.forEach(g => g.members.forEach(m => {
      const arr = map.get(m.id) || [];
      arr.push(g);
      map.set(m.id, arr);
    }));
    return map;
  }

  // =========================================================================
  // Volunteer Details Modal
  // =========================================================================
  async function openVolunteerDetailsModal(volunteerId) {
    const state = window.AtharStore.getState();
    const v = state.volunteers.find(x => x.id === volunteerId);
    if (!v) return;

    // Pull fresh attendance so the stats below are accurate
    // (the store cache does not hold per-volunteer attendance records).
    let attendanceRecords = [];
    try {
      const detail = await window.AtharAPI.volunteers.get(v.id);
      attendanceRecords = (detail.attendance || []).map(a => ({
        volunteer_id: a.volunteerId || a.volunteer_id,
        status: a.status,
      }));
    } catch (err) {
      console.warn("[volunteer-details] Failed to load attendance", err);
    }

    const comm = state.committees.find(c => c.id === v.committee_id);
    const stats = window.AtharStore.getVolunteerStats(v.id, attendanceRecords);
    const a = age(v.dob);
    const gs = genderStyle(v.gender);

    const modal = document.getElementById("modal-container");
    modal.innerHTML = `
      <div class="overlay-backdrop" id="vol-details-backdrop">
        <div class="modal-dialog" style="max-width:600px;">
          <div class="modal-header" style="border-bottom:3px solid ${gs.border};">
            <h3 class="modal-title">${ic("user", 18)} ${t("volunteer_profile") || "Volunteer Details"}</h3>
            <button class="btn-icon" id="vol-details-close">&times;</button>
          </div>
          <div class="modal-body">
            <div style="display:flex; align-items:center; gap:16px; padding:16px; background:${gs.bg}; border:1px solid ${gs.border}; border-radius:var(--radius-md); margin-bottom:18px;">
              ${avatarHtml(v, 64)}
              <div style="flex:1;">
                <div style="font-size:20px; font-weight:800; color:var(--neutral-900);">
                  ${App.currentLang === 'ar' ? (v.full_name_ar || v.full_name) : v.full_name}
                </div>
                <div style="display:flex; align-items:center; gap:8px; margin-top:6px; flex-wrap:wrap;">
                  ${genderChip(v.gender)}
                  ${a !== null ? `<span style="font-size:12px; font-weight:700; color:var(--neutral-700);">${a} ${App.currentLang === 'ar' ? 'سنة' : 'years old'}</span>` : ''}
                  <span class="badge ${v.status === 'active' ? 'badge-success' : 'badge-neutral'}">${t(v.status)}</span>
                </div>
              </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:18px;">
              <div>
                <div style="font-size:11px; color:var(--neutral-500); font-weight:700; text-transform:uppercase;">${t("phone") || "Phone"}</div>
                <div class="num-ltr" style="font-weight:600; font-size:14px;">${escapeHtml(v.phone || "—")}</div>
              </div>
              <div>
                <div style="font-size:11px; color:var(--neutral-500); font-weight:700; text-transform:uppercase;">${t("whatsapp") || "WhatsApp"}</div>
                <div class="num-ltr" style="font-weight:600; font-size:14px;">${escapeHtml(v.whatsapp || "—")}</div>
              </div>
              <div>
                <div style="font-size:11px; color:var(--neutral-500); font-weight:700; text-transform:uppercase;">${t("email") || "Email"}</div>
                <div style="font-weight:600; font-size:13px; word-break:break-all;">${escapeHtml(v.email || "—")}</div>
              </div>
              <div>
                <div style="font-size:11px; color:var(--neutral-500); font-weight:700; text-transform:uppercase;">${App.currentLang === 'ar' ? 'الجنسية' : 'Nationality'}</div>
                <div style="font-weight:600; font-size:14px;">${escapeHtml(v.nationality || "—")}</div>
              </div>
              <div>
                <div style="font-size:11px; color:var(--neutral-500); font-weight:700; text-transform:uppercase;">${App.currentLang === 'ar' ? 'المستوى الدراسي' : 'Study Level'}</div>
                <div style="font-weight:600; font-size:14px;">${v.study_level || "—"}</div>
              </div>
              <div>
                <div style="font-size:11px; color:var(--neutral-500); font-weight:700; text-transform:uppercase;">${t("dob") || "Date of Birth"}</div>
                <div class="num-ltr" style="font-weight:600; font-size:14px;">${v.dob || "—"}</div>
              </div>
              <div>
                <div style="font-size:11px; color:var(--neutral-500); font-weight:700; text-transform:uppercase;">${t("committee") || "Committee"}</div>
                <div style="font-weight:600; font-size:14px;">${comm ? (App.currentLang === 'ar' ? comm.name_ar : comm.name_en) : "—"}</div>
              </div>
              <div>
                <div style="font-size:11px; color:var(--neutral-500); font-weight:700; text-transform:uppercase;">${t("join_date") || "Join Date"}</div>
                <div class="num-ltr" style="font-weight:600; font-size:14px;">${formatDate(v.join_date)}</div>
              </div>
            </div>

            <div class="profile-stats-grid" style="margin-bottom:18px;">
              <div class="stat-box"><span class="stat-box-label">${t("kpi_total_hours")}</span><span class="stat-box-value num-ltr">${stats.totalHours} h</span>${stats.pendingHours > 0 ? `<span style="font-size:11px; color:var(--neutral-500);">+${stats.pendingHours} ${t("pending")}</span>` : ''}</div>
              <div class="stat-box"><span class="stat-box-label">${t("attendance_rate")}</span><span class="stat-box-value num-ltr">${stats.attendanceRate != null ? stats.attendanceRate + '%' : '—'}</span>${stats.attTotal > 0 ? `<span style="font-size:11px; color:var(--neutral-500);">${stats.attAttended} / ${stats.attTotal}</span>` : ''}</div>
              <div class="stat-box"><span class="stat-box-label">${t("avg_evaluation")}</span><span class="stat-box-value num-ltr">${stats.avgEvaluation != null ? stats.avgEvaluation + ' / 5' : '—'}</span></div>
              <div class="stat-box"><span class="stat-box-label">${t("kpi_certificates")}</span><span class="stat-box-value num-ltr">${stats.certsCount}</span></div>
            </div>

            ${splitNotes(v.notes).length > 0 ? `
              <div style="margin-bottom:16px;">
                <div style="font-size:12px; font-weight:700; color:var(--neutral-600); margin-bottom:6px;">${t("notes") || "Notes"}</div>
                <div style="display:flex; flex-direction:column; gap:6px;">
                  ${splitNotes(v.notes).map(n => `
                    <div style="padding:8px 12px; background:var(--neutral-50); border-inline-start:3px solid var(--primary); border-radius:6px; font-size:13px; color:var(--neutral-700);">
                      ${n}
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            ${(v.skills && v.skills.length) ? `
              <div style="display:flex; flex-wrap:wrap; gap:6px;">
                ${v.skills.map(s => `<span class="tag-chip">#${escapeHtml(s)}</span>`).join('')}
              </div>
            ` : ''}
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="vol-details-cancel">${t("close") || "Close"}</button>
            <button class="btn btn-primary" id="vol-details-open">${t("view") || "View"} →</button>
          </div>
        </div>
      </div>
    `;

    const close = () => { modal.innerHTML = ""; };
    document.getElementById("vol-details-close").onclick = close;
    document.getElementById("vol-details-cancel").onclick = close;
    document.getElementById("vol-details-backdrop").onclick = (e) => {
      if (e.target.id === "vol-details-backdrop") close();
    };
    document.getElementById("vol-details-open").onclick = () => {
      close();
      navigateTo("volunteer-profile", { id: v.id });
    };
  }

  // =========================================================================
  // Round 7: Duplicate finder modal
  // =========================================================================
  function openDuplicatesFinder() {
    const modal = document.getElementById("modal-container");
    if (!modal) return;
    const canDelete = hasPermission("volunteers", "delete");
    const FIELD_META = {
      id: { label: () => t("national_id"), icon: "user" },
      phone: { label: () => t("dup_field_phone"), icon: "whatsapp" },
      email: { label: () => t("email"), icon: "message_circle" },
    };
    const statusBadgeCls = (s) => s === "active" ? "badge-success" : s === "pending" ? "badge-purple" : s === "suspended" ? "badge-warning" : s === "archived" ? "badge-danger" : "badge-neutral";

    const render = () => {
      const state = window.AtharStore.getState();
      const groups = buildDuplicateGroups(state.volunteers);
      const flaggedIds = new Set();
      groups.forEach(g => g.members.forEach(m => { if (m.status !== "archived") flaggedIds.add(m.id); }));
      const activeVols = state.volunteers.filter(v => v.status !== "archived");
      const missingIds = activeVols.filter(v => !v.national_id).length;

      const groupHtml = groups.map(g => {
        const meta = FIELD_META[g.field];
        const first = g.members[0];
        const rawVal = g.field === "id" ? String(first.national_id || g.key)
          : g.field === "phone" ? (first.whatsapp || first.phone || g.key)
            : (first.email || g.key);
        const membersHtml = g.members.map(m => {
          const comm = state.committees.find(c => c.id === m.committee_id);
          const commLabel = comm ? (App.currentLang === "ar" ? comm.name_ar : comm.name_en) : "";
          const subParts = [commLabel, m.join_date ? `${t("join_date")}: ${formatDate(m.join_date)}` : ""].filter(Boolean);
          return `
            <div class="dup-member">
              ${avatarHtml(m, 30)}
              <div class="dup-member-info">
                <div class="dup-member-name">${escAttr(volDisplayName(m))}
                  <span class="badge ${statusBadgeCls(m.status)}">${t(m.status)}</span>
                </div>
                ${subParts.length ? `<div class="dup-member-sub">${escAttr(subParts.join(" • "))}</div>` : ""}
              </div>
              <div class="dup-member-actions">
                <button type="button" class="btn btn-secondary btn-sm" data-dup-view="${m.id}">${t("view")}</button>
                ${canDelete && m.status !== "archived" ? `<button type="button" class="btn btn-danger-outline btn-sm" data-dup-arch="${m.id}" data-dup-arch-name="${escAttr(volDisplayName(m))}">${t("archive")}</button>` : ''}
              </div>
            </div>`;
        }).join("");

        return `
          <div class="dup-group">
            <div class="dup-group-head">
              <span class="dup-group-field">${ic(meta.icon, 13)} ${meta.label()}</span>
              <span class="dup-group-val num-ltr">${escAttr(rawVal)}</span>
              <span class="dup-group-count">${g.members.length}</span>
            </div>
            <div class="dup-group-members">${membersHtml}</div>
          </div>`;
      }).join("");

      modal.innerHTML = `
        <div class="overlay-backdrop" id="dup-backdrop">
          <div class="modal-dialog" style="max-width:700px;">
            <div class="modal-header">
              <h3 class="modal-title">${ic("search", 18)} ${t("dup_check_title")}</h3>
              <button class="btn-icon" id="dup-close">&times;</button>
            </div>
            <div class="modal-body dup-modal-body">
              ${groups.length
          ? `<div class="dup-summary">${ic("alert", 14)} ${groups.length} ${t("dup_groups_count")} • ${flaggedIds.size} ${App.currentLang === "ar" ? "متطوعاً" : "volunteers"}</div>`
          : `<div class="dup-empty">${ic("check_circle", 30)}<div>${t("dup_none")}</div></div>`}
              ${groupHtml}
              <div class="dup-health">${activeVols.length} ${App.currentLang === "ar" ? "متطوعاً نشطاً" : "active volunteers"} • ${t("dup_missing_id")}: ${missingIds}</div>
            </div>
          </div>
        </div>
      `;

      const close = () => { modal.innerHTML = ""; };
      document.getElementById("dup-close").onclick = close;
      document.getElementById("dup-backdrop").onclick = (e) => { if (e.target.id === "dup-backdrop") close(); };
      modal.querySelectorAll("[data-dup-view]").forEach(b => {
        b.onclick = () => { const id = b.getAttribute("data-dup-view"); close(); navigateTo("volunteer-profile", { id }); };
      });
      modal.querySelectorAll("[data-dup-arch]").forEach(b => {
        b.onclick = () => {
          const id = b.getAttribute("data-dup-arch");
          const nm = b.getAttribute("data-dup-arch-name");
          // Inline confirm inside the finder, so Cancel returns to the duplicate list.
          modal.innerHTML = `
            <div class="overlay-backdrop" id="dup-confirm-backdrop">
              <div class="modal-dialog" style="max-width:440px;">
                <div class="modal-header">
                  <h3 class="modal-title" style="color:var(--danger);">${ic("alert", 18)} ${t("confirm_destructive")}</h3>
                  <button class="btn-icon" id="dup-confirm-close">&times;</button>
                </div>
                <div class="modal-body">
                  <p style="font-size:14px; color:var(--neutral-700); line-height:1.6;">
                    ${App.currentLang === "ar" ? `أرشفة ${escAttr(nm)}؟ يبقى السجل محفوظاً للتاريخ والشهادات.` : `Archive ${escAttr(nm)}? Record hidden but preserved for history and certificates.`}
                  </p>
                </div>
                <div class="modal-footer">
                  <button class="btn btn-secondary" id="dup-confirm-cancel">${t("cancel")}</button>
                  <button class="btn btn-danger" id="dup-confirm-yes">${t("archive")}</button>
                </div>
              </div>
            </div>
          `;
          const backToFinder = () => { render(); };
          document.getElementById("dup-confirm-close").onclick = backToFinder;
          document.getElementById("dup-confirm-cancel").onclick = backToFinder;
          document.getElementById("dup-confirm-backdrop").onclick = (e) => { if (e.target.id === "dup-confirm-backdrop") backToFinder(); };
          document.getElementById("dup-confirm-yes").onclick = async () => {
            try {
              await window.AtharAPI.volunteers.archive(id);
              await window.AtharStore.refreshVolunteers();
              showToast(t("deleted_successfully"), "warning");
              render();
              if (App.currentView === "volunteers") window.AtharCore.renderCurrentView();
            } catch (err) { showToast(err.message || "Archive failed", "error"); }
          };
        };
      });
    };
    render();
  }

  // Expose for inline onclick
  window.AtharVolunteers = window.AtharVolunteers || {};
  window.AtharVolunteers.openDetails = openVolunteerDetailsModal;
  window.AtharVolunteers.openDuplicatesFinder = openDuplicatesFinder;
  window.AtharVolunteers.buildDuplicateGroups = buildDuplicateGroups;

  // =========================================================================
  // Volunteers List
  // =========================================================================
  function renderVolunteersList(container) {
    const state = window.AtharStore.getState();
    const canCreate = hasPermission("volunteers", "create");
    const canEdit = hasPermission("volunteers", "edit");
    const canDelete = hasPermission("volunteers", "delete");

    let filterComm = App.volFilterComm || "all";
    if (App.currentUser && App.currentUser.role === "committee_leader" && App.currentUser.committee_id) {
      filterComm = App.currentUser.committee_id;
      App.volFilterComm = filterComm;
    }
    let filterStatus = App.volFilterStatus || "active";
    let filterSkill = App.volFilterSkill || "all";
    let filterGender = App.volFilterGender || "all";
    let filterAgeMin = App.volFilterAgeMin ?? "";
    let filterAgeMax = App.volFilterAgeMax ?? "";
    let search = App.searchQuery || "";
    const perPage = App.pagination.volunteersPerPage || 20;
    const sortField = App.volSortField || null;
    const sortDir = App.volSortDir || "asc";
    const filterNewMonth = !!App.volFilterNew;
    const filterFollowup = !!App.volFilterFollowup;
    const filterReady = !!App.volFilterReady;
    const filterDup = !!App.volFilterDup;

    // ---- Last activity / follow-up / certificate readiness ----
    const FOLLOWUP_DAYS = 30;
    const DAY_MS = 86400000;
    const activityMap = state.volunteer_activity || {};
    const certTarget = Number(state.settings.certificate_ready_hours) || 50;

    const lastActivityDate = (v) => {
      const a = activityMap[v.id];
      if (!a) return null;
      const ds = [a.lastHours, a.lastAttendance].filter(Boolean);
      if (!ds.length) return null;
      return ds.slice().sort().pop();   // "YYYY-MM-DD" max = most recent
    };
    const lastActivityTs = (v) => {
      const d = lastActivityDate(v);
      if (!d) return null;
      const ts = new Date(d).getTime();
      return isNaN(ts) ? null : ts;
    };
    // Days since max(last activity, join date) — new joiners get a grace period.
    const idleDaysOf = (v) => {
      const last = Math.max(
        lastActivityTs(v) || 0,
        v.join_date ? new Date(v.join_date).getTime() : 0
      );
      if (!last) return null;
      return Math.floor((Date.now() - last) / DAY_MS);
    };
    const isIdle = (v) => {
      if (!state.activityLoaded) return false;
      const d = idleDaysOf(v);
      return d !== null && d >= FOLLOWUP_DAYS;
    };
    const relDays = (days) => {
      if (days === null || days === undefined || isNaN(days)) return "";
      try {
        return new Intl.RelativeTimeFormat(App.currentLang === "ar" ? "ar" : "en", { numeric: "auto" }).format(-days, "day");
      } catch { return ""; }
    };
    const hasActiveCert = (v) => state.certificates.some(c =>
      c.volunteer_id === v.id && (c.status === "issued" || c.status === "approved"));
    const approvedHoursOf = (v) => {
      const s = window.AtharStore.getVolunteerStats(v.id);
      return s ? (s.totalHours || 0) : 0;
    };
    const isCertReady = (v) => approvedHoursOf(v) >= certTarget && !hasActiveCert(v);
    const followupCount = state.volunteers.filter(v => v.status === "active" && isIdle(v)).length;
    const readyCount = state.volunteers.filter(v => v.status !== "archived" && isCertReady(v)).length;

    // Lazy-load activity once if the store hasn't got it (e.g. older sessions).
    if (!state.activityLoaded && !App.__activityTried) {
      App.__activityTried = true;
      window.AtharStore.refreshActivity().then(() => {
        if (App.currentView === "volunteers") renderVolunteersList(container);
      }).catch(() => { });
    }

    const allSkills = Array.from(new Set(state.volunteers.flatMap(v => v.skills || []))).filter(Boolean);

    // Round 7: duplicate flags (marker + chip + filter)
    const dupGroups = buildDuplicateGroups(state.volunteers);
    const dupMark = dupMarkMap(dupGroups);
    const dupFlaggedCount = state.volunteers.filter(v => v.status !== "archived" && dupMark.has(v.id)).length;

    const monthStart = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })();
    const joinedThisMonth = (v) => {
      if (!v.join_date) return false;
      const d = new Date(v.join_date);
      return !isNaN(d.getTime()) && d >= monthStart;
    };

    function getFilteredVolunteers() {
      return state.volunteers.filter(v => {
        if (filterStatus === "archived") {
          if (v.status !== "archived") return false;
        } else {
          if (v.status === "archived") return false;
          if (filterStatus !== "all" && v.status !== filterStatus) return false;
        }
        if (filterComm !== "all" && v.committee_id !== filterComm) return false;
        if (filterSkill !== "all" && (!v.skills || !v.skills.includes(filterSkill))) return false;
        if (filterGender !== "all" && v.gender !== filterGender) return false;

        if (filterAgeMin !== "" || filterAgeMax !== "") {
          const a = age(v.dob);
          if (a === null) return false;
          if (filterAgeMin !== "" && a < Number(filterAgeMin)) return false;
          if (filterAgeMax !== "" && a > Number(filterAgeMax)) return false;
        }

        if (search) {
          const q = search.toLowerCase();
          const matchName = (v.full_name && v.full_name.toLowerCase().includes(q)) ||
            (v.full_name_ar && v.full_name_ar.includes(q));
          const matchId = v.national_id && v.national_id.includes(q);
          const matchPhone = v.phone && v.phone.includes(q);
          const matchNat = v.nationality && v.nationality.toLowerCase().includes(q);
          if (!matchName && !matchId && !matchPhone && !matchNat) return false;
        }
        if (filterNewMonth && !joinedThisMonth(v)) return false;
        if (filterFollowup && !isIdle(v)) return false;
        if (filterReady && !isCertReady(v)) return false;
        if (filterDup && !dupMark.has(v.id)) return false;
        return true;
      });
    }

    function sortVolunteers(list) {
      if (!sortField) return list;
      const collator = new Intl.Collator(App.currentLang === "ar" ? "ar" : "en", { numeric: true, sensitivity: "base" });
      const hoursCache = {};
      const getHours = (v) => {
        if (!(v.id in hoursCache)) {
          const s = window.AtharStore.getVolunteerStats(v.id);
          hoursCache[v.id] = s ? (s.totalHours || 0) : 0;
        }
        return hoursCache[v.id];
      };
      const valueOf = {
        name: (v) => volDisplayName(v),
        age: (v) => age(v.dob),
        committee: (v) => {
          const c = state.committees.find(x => x.id === v.committee_id);
          return c ? (App.currentLang === "ar" ? c.name_ar : c.name_en) : "";
        },
        status: (v) => v.status || "",
        hours: (v) => getHours(v),
        join_date: (v) => v.join_date || null,
        activity: (v) => lastActivityTs(v)
      }[sortField];
      if (!valueOf) return list;
      const dir = sortDir === "desc" ? -1 : 1;
      return list.slice().sort((a, b) => {
        const va = valueOf(a);
        const vb = valueOf(b);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;   // empty values always go last
        if (vb == null) return -1;
        let cmp;
        if (typeof va === "number" || typeof vb === "number") cmp = Number(va) - Number(vb);
        else cmp = collator.compare(String(va), String(vb));
        return cmp * dir;
      });
    }

    const filtered = sortVolunteers(getFilteredVolunteers());
    const totalCount = filtered.length;
    const page = App.pagination.volunteersPage;
    const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
    const pagedVols = filtered.slice((page - 1) * perPage, page * perPage);

    const pendingCount = state.volunteers.filter(v => v.status === "pending").length;
    const newMonthCount = state.volunteers.filter(v => v.status !== "archived" && joinedThisMonth(v)).length;
    const chip = (key, label, count, active) =>
      `<button type="button" class="quick-chip ${active ? 'active' : ''}" data-chip="${key}">${label}${count != null ? ` <span class="qc-count">${count}</span>` : ''}</button>`;
    const sortBtnTitle = (f) => sortField === f
      ? (sortDir === "asc" ? t("sort_desc") : t("sort_asc"))
      : t("sort_asc");
    const sortTh = (f, label, extraStyle) =>
      `<th class="th-sortable ${sortField === f ? 'sorted' : ''}" data-sort="${f}" title="${sortBtnTitle(f)}" ${extraStyle ? `style="${extraStyle}"` : ''}>${label} <span class="sort-ind ${sortField === f ? 'on' : ''}">${sortField === f ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}</span></th>`;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('dashboard')">${t("app_name")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${t("nav_volunteers")}</span>
          </div>
          <h1 class="view-title">${t("volunteers_title")}</h1>
          <p class="view-subtitle">
            <span style="color:var(--primary); font-weight:700;">${totalCount}</span>
            ${t("rows")} &bull; ${page * perPage - perPage + 1}–${Math.min(page * perPage, totalCount)}
          </p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-secondary btn-sm" id="btn-export-vols-csv">
            ${ic("download", 14)} ${t("export_csv")}
          </button>
          <button class="btn btn-secondary btn-sm" id="btn-print-dir">
            ${ic("printer", 14)} ${App.currentLang === 'ar' ? 'طباعة الدليل' : 'Print directory'}
          </button>
          ${canCreate ? `
            <button class="btn btn-secondary btn-sm" id="btn-import-vols-csv">
              ${ic("upload", 14)} ${t("import_csv")}
            </button>
          ` : ''}
          ${canCreate ? `
            <button class="btn btn-primary" id="btn-add-volunteer">
              ${ic("plus", 16)} ${t("add_volunteer")}
            </button>
          ` : ''}
        </div>
      </div>

      <div class="filter-bar">
        <div class="filter-group">
          <input type="text" id="vol-search-box" class="form-control" style="width:200px;" placeholder="${t("search_volunteers_ph")}" value="${search}">
          <select id="vol-filter-comm" class="form-control" ${App.currentUser && App.currentUser.role === 'committee_leader' ? 'disabled' : ''}>
            <option value="all">${t("all_committees")}</option>
            ${state.committees.map(c => `<option value="${c.id}" ${filterComm === c.id ? 'selected' : ''}>${App.currentLang === 'ar' ? c.name_ar : c.name_en}</option>`).join('')}
          </select>
          <select id="vol-filter-status" class="form-control">
            <option value="all">${t("all_statuses")}</option>
            <option value="pending" ${filterStatus === 'pending' ? 'selected' : ''}>${t("pending")}</option>
            <option value="active" ${filterStatus === 'active' ? 'selected' : ''}>${t("active")}</option>
            <option value="suspended" ${filterStatus === 'suspended' ? 'selected' : ''}>${t("suspended")}</option>
            <option value="withdrawn" ${filterStatus === 'withdrawn' ? 'selected' : ''}>${t("withdrawn")}</option>
            <option value="completed" ${filterStatus === 'completed' ? 'selected' : ''}>${t("completed")}</option>
            <option value="archived" ${filterStatus === 'archived' ? 'selected' : ''}>${t("archived")}</option>
          </select>
          <select id="vol-filter-gender" class="form-control" style="width:130px;">
            <option value="all">${App.currentLang === 'ar' ? 'الجنس: الكل' : 'Gender: All'}</option>
            <option value="male" ${filterGender === 'male' ? 'selected' : ''}>${App.currentLang === 'ar' ? 'ذكر' : 'Male'}</option>
            <option value="female" ${filterGender === 'female' ? 'selected' : ''}>${App.currentLang === 'ar' ? 'أنثى' : 'Female'}</option>
          </select>
          <div style="display:flex; align-items:center; gap:4px;">
            <span style="font-size:12px; color:var(--neutral-600);">${App.currentLang === 'ar' ? 'العمر:' : 'Age:'}</span>
            <input type="number" id="vol-filter-age-min" class="form-control num-ltr" style="width:70px;" placeholder="min" value="${filterAgeMin}" min="0" max="130">
            <span style="color:var(--neutral-400);">–</span>
            <input type="number" id="vol-filter-age-max" class="form-control num-ltr" style="width:70px;" placeholder="max" value="${filterAgeMax}" min="0" max="130">
          </div>
          <select id="vol-filter-skill" class="form-control" style="width:150px;">
            <option value="all">${t("all_skills")}</option>
            ${allSkills.map(s => `<option value="${s}" ${filterSkill === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <select id="vol-per-page" class="form-control" style="width:110px;">
            <option value="10" ${perPage === 10 ? 'selected' : ''}>10 / page</option>
            <option value="20" ${perPage === 20 ? 'selected' : ''}>20 / page</option>
            <option value="50" ${perPage === 50 ? 'selected' : ''}>50 / page</option>
            <option value="100" ${perPage === 100 ? 'selected' : ''}>100 / page</option>
            <option value="5000" ${perPage >= 5000 ? 'selected' : ''}>${App.currentLang === 'ar' ? 'الكل' : 'All'}</option>
          </select>
          <button class="btn btn-secondary btn-sm" id="btn-reset-vol-filters">${t("reset")}</button>
        </div>
      </div>

      <div class="quick-chips">
        ${chip("all", t("all"), null, filterStatus === "all" && !filterNewMonth && !filterFollowup && !filterReady && !filterDup)}
        ${chip("pending", t("pending"), pendingCount, filterStatus === "pending" && !filterNewMonth && !filterFollowup && !filterReady && !filterDup)}
        ${chip("active", t("active"), null, filterStatus === "active" && !filterNewMonth && !filterFollowup && !filterReady && !filterDup)}
        ${chip("new", t("new_this_month"), newMonthCount, filterNewMonth && !filterFollowup && !filterReady && !filterDup)}
        ${chip("followup", t("needs_followup"), followupCount, filterFollowup)}
        ${chip("ready", t("ready_for_certificate"), readyCount, filterReady)}
        ${chip("dup", t("dup_chip"), dupFlaggedCount, filterDup)}
        ${chip("archived", t("archived"), null, filterStatus === "archived" && !filterNewMonth && !filterFollowup && !filterReady && !filterDup)}
      </div>

      <div id="bulk-selection-container" style="display:${App.selectedVolunteerIds.size > 0 ? 'block' : 'none'};">
        <div class="bulk-action-bar">
          <span class="bulk-count">${t("selected")}: ${App.selectedVolunteerIds.size}</span>
          <div class="bulk-buttons">
            ${hasPermission("volunteer_hours", "create") ? `
              <button class="btn btn-primary btn-sm" id="btn-bulk-log-hours">
                ${ic("clock", 14)} ${App.currentLang === 'ar' ? 'تسجيل ساعات' : 'Log Hours'}
              </button>
            ` : ''}
            ${hasPermission("evaluations", "create") ? `
              <button class="btn btn-primary btn-sm" id="btn-bulk-rate">
                ${ic("star", 14)} ${App.currentLang === 'ar' ? 'تقييم جماعي' : 'Rate'}
              </button>
            ` : ''}
            ${canEdit ? `<button class="btn btn-secondary btn-sm" id="btn-bulk-transfer">${ic("arrow_right", 14)} ${t("bulk_transfer")}</button>` : ''}
            ${canEdit ? `
              <select id="bulk-status-select" class="form-control" style="width:120px; height:30px; padding:2px 6px; font-size:12px;">
                <option value="">${App.currentLang === 'ar' ? 'تغيير الحالة…' : 'Set status…'}</option>
                <option value="active">${t("active")}</option>
                <option value="pending">${t("pending")}</option>
                <option value="suspended">${t("suspended")}</option>
                <option value="completed">${t("completed")}</option>
              </select>
              <button class="btn btn-secondary btn-sm" id="btn-bulk-status">${ic("check", 14)} ${App.currentLang === 'ar' ? 'تطبيق' : 'Apply'}</button>
            ` : ''}
            <button class="btn btn-whatsapp btn-sm" id="btn-bulk-whatsapp">${ic("whatsapp", 14)} ${t("reminder_title")}</button>
            <button class="btn btn-secondary btn-sm" id="btn-bulk-export">${t("export_csv")}</button>
            ${canDelete ? `<button class="btn btn-danger-outline btn-sm" id="btn-bulk-archive">${t("archive")}</button>` : ''}
          </div>
        </div>
      </div>

      <div class="vol-table-actions">
        <button type="button" class="btn-text-sm" id="btn-select-all-filtered">${ic("check", 13)} ${t("select_all")} (${totalCount})</button>
        <button type="button" class="btn-text-sm" id="btn-find-dupes">${ic("search", 13)} ${t("dup_check_title")}${dupFlaggedCount ? ` <span class="qc-count">${dupFlaggedCount}</span>` : ''}</button>
        ${App.selectedVolunteerIds.size > 0 ? `<button type="button" class="btn-text-sm" id="btn-clear-selection">${ic("x", 13)} ${t("clear_selection")}</button>` : ''}
        ${App.selectedVolunteerIds.size > 0 ? `<span class="vta-count">${App.selectedVolunteerIds.size} / ${totalCount} ${t("rows")}</span>` : ''}
      </div>

      <div class="table-container">
        <div class="table-responsive">
          <table class="data-table vol-table">
            <thead>
              <tr>
                <th class="col-cb"><input type="checkbox" id="th-check-all" ${App.selectedVolunteerIds.size === pagedVols.length && pagedVols.length > 0 ? 'checked' : ''}></th>
                ${sortTh("name", t("volunteer_name"))}
                ${sortTh("age", t("age"))}
                ${sortTh("committee", t("committee"))}
                ${sortTh("status", t("status"))}
                ${sortTh("hours", t("hours"))}
                <th>${t("contact")}</th>
                ${sortTh("join_date", t("join_date"))}
                ${sortTh("activity", t("last_activity"))}
                <th style="text-align:right;">${t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              ${pagedVols.length === 0 ? `
                <tr><td colspan="10"><div class="empty-state">
                  <div class="empty-state-icon" style="color:var(--neutral-400);">${ic("users", 48, { strokeWidth: 1.5 })}</div>
                  ${state.volunteers.length === 0 ? `
                    <div class="empty-state-title">${t("no_volunteers_found")}</div>
                    <div class="empty-state-desc">${t("create_first_volunteer")}</div>
                    ${canCreate ? `<button class="btn btn-primary" id="btn-empty-add-vol" style="margin-top:14px;">${ic("plus", 16)} ${t("add_volunteer")}</button>` : ''}
                  ` : `
                    <div class="empty-state-title">${t("no_filter_results")}</div>
                    <div class="empty-state-desc">${search ? `&ldquo;${escAttr(search)}&rdquo;` : ''}</div>
                    <div class="empty-state-hint">${t("empty_try_again")}</div>
                    <button class="btn btn-secondary" id="btn-empty-clear-filters" style="margin-top:14px;">${ic("x", 15)} ${t("clear_filters")}</button>
                  `}
                </div></td></tr>
              ` : pagedVols.map(v => {
      const comm = state.committees.find(c => c.id === v.committee_id);
      const stats = window.AtharStore.getVolunteerStats(v.id);
      const isSelected = App.selectedVolunteerIds.has(v.id);
      const a = age(v.dob);
      const gs = genderStyle(v.gender);

      // Certificate readiness + last activity (round 6)
      const hrsVal = stats ? stats.totalHours : 0;
      const hrsPct = Math.min(100, Math.round((hrsVal / certTarget) * 100));
      const certReady = hrsVal >= certTarget && !hasActiveCert(v);
      const lastTs = lastActivityTs(v);
      const idle = idleDaysOf(v);
      const stale = state.activityLoaded && idle !== null && idle >= FOLLOWUP_DAYS;
      const dgr = dupMark.get(v.id);
      const commLabel = comm ? (App.currentLang === 'ar' ? comm.name_ar : comm.name_en) : '—';
      const commCell = canEdit
        ? `<button type="button" class="cell-edit-btn" data-quick-comm="${v.id}" title="${t("change_committee")}">${commLabel}</button>`
        : `<span style="font-weight:500;">${commLabel}</span>`;
      const statusBadge = `<span class="badge ${v.status === 'active' ? 'badge-success' : v.status === 'pending' ? 'badge-purple' : v.status === 'suspended' ? 'badge-warning' : v.status === 'archived' ? 'badge-danger' : 'badge-neutral'}">${t(v.status)}</span>`;
      const statusCell = canEdit
        ? `<button type="button" class="cell-edit-btn badge-edit-btn" data-quick-status="${v.id}" title="${t("change_status")}">${statusBadge}</button>`
        : statusBadge;
      const activityCellInner = lastTs
        ? `<div class="num-ltr" style="font-size:12px; color:var(--neutral-600);">${formatDate(lastActivityDate(v))}</div>
                       <div class="activity-ago ${stale ? 'idle' : ''}">${relDays(idle)}</div>`
        : `<span style="color:var(--neutral-400);" title="${stale ? escAttr(t("no_activity_30d")) : ''}">${stale ? '<span class="idle-dot"></span>' : ''}—</span>`;

      return `
                  <tr class="${isSelected ? 'row-selected' : ''}" style="border-inline-start:3px solid ${v.gender ? gs.border : 'transparent'};">
                    <td class="col-cb">
                      <input type="checkbox" class="vol-row-cb" data-id="${v.id}" ${isSelected ? 'checked' : ''}>
                    </td>
                    <td class="vol-card-title">
                      <div style="display:flex; align-items:center; gap:10px; cursor:pointer;"
                           onclick="window.AtharVolunteers.openDetails('${v.id}')">
                        ${avatarHtml(v, 40)}
                        <div>
                          <div class="vol-name-cell">
                            ${escapeHtml(volDisplayName(v))}
                          </div>
                          <div style="display:flex; gap:6px; align-items:center; margin-top:2px; flex-wrap:wrap;">
                            ${genderChip(v.gender)}
                            ${v.nationality ? `<span style="font-size:10px; color:var(--neutral-500);">${escapeHtml(v.nationality)}</span>` : ''}
                            ${(v.skills || []).slice(0, 2).map(s => `<span class="mini-chip">#${escapeHtml(s)}</span>`).join('')}
                            ${(v.skills || []).length > 2 ? `<span class="mini-chip" title="${escAttr((v.skills || []).join(', '))}">+${(v.skills || []).length - 2}</span>` : ''}
                            ${dgr && dgr.length ? `<button type="button" class="dup-mark" title="${escAttr(t("dup_mark_title"))}" onclick="event.stopPropagation(); window.AtharVolunteers.openDuplicatesFinder()">${ic("alert", 11)}</button>` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td data-label="${t("age")}">
                      ${a !== null
          ? `<span class="num-ltr" style="font-weight:700; font-size:14px;">${a}</span> <span style="font-size:11px; color:var(--neutral-500);">${App.currentLang === 'ar' ? 'سنة' : 'y'}</span>`
          : '<span style="color:var(--neutral-400);">—</span>'}
                    </td>
                    <td data-label="${t("committee")}">${commCell}</td>
                    <td data-label="${t("status")}">${statusCell}</td>
                    <td data-label="${t("hours")}">
                      <div class="hours-cell">
                        <span class="num-ltr" style="font-weight:700;">${hrsVal} h</span>
                        ${certReady ? `<span class="cert-ready-ic" title="${t("ready_for_certificate")}">${ic("award", 13)}</span>` : ''}
                      </div>
                      <div class="hours-progress" title="${hrsVal} / ${certTarget} h — ${t("cert_ready_hours")}"><span style="width:${hrsPct}%"></span></div>
                    </td>
                    <td data-label="${t("contact")}">
                      ${contactCellHtml(v)}
                    </td>
                    <td data-label="${t("join_date")}"><span class="num-ltr" style="font-size:12px; color:var(--neutral-600);">${formatDate(v.join_date)}</span></td>
                    <td data-label="${t("last_activity")}"><div class="activity-cell">${activityCellInner}</div></td>
                    <td class="vol-card-actions">
                      <div class="row-actions-cell">
                        <button class="btn btn-secondary btn-sm" onclick="window.AtharApp.navigateTo('volunteer-profile', {id:'${v.id}'})" title="${t("view")}">${t("view")}</button>
                        <div class="action-menu-wrap">
                          <button type="button" class="btn btn-secondary btn-sm action-menu-trigger" data-action-menu="${v.id}" title="${App.currentLang === 'ar' ? 'المزيد' : 'More'}">${ic("more_vertical", 14)}</button>
                          <div class="action-menu-dropdown" data-action-dropdown="${v.id}" hidden>
                            ${v.status === 'pending' && canEdit ? `<button type="button" class="action-menu-item" onclick="window.AtharApp.approveVolunteer('${v.id}')">${ic("check", 14)} ${t("approve_volunteer")}</button>` : ''}
                            ${canEdit ? `<button type="button" class="action-menu-item" onclick="window.AtharModals.openAddVolunteerSlideover('${v.id}')">${ic("pencil", 14)} ${t("edit")}</button>` : ''}
                            <button type="button" class="action-menu-item" onclick="window.AtharVolunteers.openDetails('${v.id}')">${ic("eye", 14)} ${App.currentLang === 'ar' ? 'تفاصيل' : 'Details'}</button>
                            ${v.status === 'archived'
                              ? `<button type="button" class="action-menu-item" onclick="window.AtharApp.restoreVolunteer('${v.id}')">${ic("refresh", 14)} ${t("restore")}</button>`
                              : (canDelete ? `<button type="button" class="action-menu-item action-menu-danger" onclick="window.AtharApp.archiveVolunteer('${v.id}')">${ic("archive", 14)} ${t("archive")}</button>` : '')}
                            ${App.currentUser && App.currentUser.role === 'super_admin' ? `<button type="button" class="action-menu-item action-menu-danger" onclick="window.AtharApp.permanentDeleteVolunteer('${v.id}')">${ic("trash", 14)} ${App.currentLang === 'ar' ? 'حذف نهائي' : 'Delete'}</button>` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
        </div>

        <div class="pagination-bar">
          <div>${t("showing")} ${Math.min((page - 1) * perPage + 1, totalCount)}–${Math.min(page * perPage, totalCount)} ${t("of")} ${totalCount} ${t("rows")}</div>
          <div class="pagination-controls">
            <button class="page-btn" id="vol-prev-btn" ${page <= 1 ? 'disabled' : ''}>${t("prev")}</button>
            ${(function () {
        if (totalPages <= 7) {
          return Array.from({ length: totalPages }, (_, i) => i + 1)
            .map(p => `<button class="page-btn ${p === page ? 'active' : ''} vol-page-num" data-page="${p}">${p}</button>`)
            .join('');
        }
        const windowSize = 7;
        const half = Math.floor(windowSize / 2);
        let start = Math.max(1, page - half);
        let end = start + windowSize - 1;
        if (end > totalPages) {
          end = totalPages;
          start = end - windowSize + 1;
        }
        const pages = [];
        for (let p = start; p <= end; p++) pages.push(p);
        return pages
          .map(p => `<button class="page-btn ${p === page ? 'active' : ''} vol-page-num" data-page="${p}">${p}</button>`)
          .join('');
      })()}
            <button class="page-btn" id="vol-next-btn" ${page >= totalPages ? 'disabled' : ''}>${t("next")}</button>
          </div>
        </div>
      </div>
    `;

    // Filters
    const bind = (id, evt, handler) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(evt, handler);
    };

    bind("vol-search-box", "input", (e) => { App.searchQuery = e.target.value; App.pagination.volunteersPage = 1; renderVolunteersList(container); });

    // ---- Kebab action menu toggle ----
    container.querySelectorAll("[data-action-menu]").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-action-menu");
        const dd = container.querySelector(`[data-action-dropdown="${id}"]`);
        container.querySelectorAll(".action-menu-dropdown").forEach(d => { if (d !== dd) d.hidden = true; });
        if (dd) dd.hidden = !dd.hidden;
      };
    });
    bind("vol-filter-comm", "change", (e) => { App.volFilterComm = e.target.value; App.pagination.volunteersPage = 1; renderVolunteersList(container); });
    bind("vol-filter-status", "change", (e) => { App.volFilterStatus = e.target.value; App.pagination.volunteersPage = 1; renderVolunteersList(container); });
    bind("vol-filter-gender", "change", (e) => { App.volFilterGender = e.target.value; App.pagination.volunteersPage = 1; renderVolunteersList(container); });
    bind("vol-filter-age-min", "change", (e) => { App.volFilterAgeMin = e.target.value; App.pagination.volunteersPage = 1; renderVolunteersList(container); });
    bind("vol-filter-age-max", "change", (e) => { App.volFilterAgeMax = e.target.value; App.pagination.volunteersPage = 1; renderVolunteersList(container); });
    bind("vol-filter-skill", "change", (e) => { App.volFilterSkill = e.target.value; App.pagination.volunteersPage = 1; renderVolunteersList(container); });
    bind("vol-per-page", "change", (e) => {
      App.pagination.volunteersPerPage = Number(e.target.value);
      App.pagination.volunteersPage = 1;
      renderVolunteersList(container);
    });

    const resetVolFilters = () => {
      App.volFilterComm = "all";
      App.volFilterStatus = "active";
      App.volFilterSkill = "all";
      App.volFilterGender = "all";
      App.volFilterAgeMin = "";
      App.volFilterAgeMax = "";
      App.volFilterNew = false;
      App.volFilterFollowup = false;
      App.volFilterReady = false;
      App.volFilterDup = false;
      App.searchQuery = "";
      App.pagination.volunteersPage = 1;
      App.pagination.volunteersPerPage = 20;
      renderVolunteersList(container);
    };

    bind("btn-reset-vol-filters", "click", resetVolFilters);
    bind("btn-find-dupes", "click", () => openDuplicatesFinder());

    // ---- Quick filter chips ----
    container.querySelectorAll(".quick-chip").forEach(el => {
      el.onclick = () => {
        const key = el.getAttribute("data-chip");
        App.volFilterNew = key === "new";
        App.volFilterFollowup = key === "followup";
        App.volFilterReady = key === "ready";
        App.volFilterDup = key === "dup";
        if (key === "followup") App.volFilterStatus = "active";
        else if (key === "ready" || key === "dup") App.volFilterStatus = "all";
        else App.volFilterStatus = key === "new" ? "all" : key;
        App.pagination.volunteersPage = 1;
        renderVolunteersList(container);
      };
    });

    // ---- Inline quick edit: status / committee popovers ----
    let activePop = null;
    const docClosePop = (e) => {
      if (activePop && !activePop.contains(e.target) &&
        !(e.target.closest && e.target.closest("[data-quick-status],[data-quick-comm]"))) {
        closePopover();
      }
    };
    const closePopover = () => {
      if (activePop) { activePop.remove(); activePop = null; }
      document.removeEventListener("mousedown", docClosePop, true);
    };
    const openPopover = (anchor, html, onPick) => {
      closePopover();
      const pop = document.createElement("div");
      pop.className = "inline-popover";
      pop.innerHTML = html;
      document.body.appendChild(pop);
      activePop = pop;
      const r = anchor.getBoundingClientRect();
      const w = pop.offsetWidth, h = pop.offsetHeight;
      let left = App.currentLang === "ar" ? (r.right - w) : r.left;
      left = Math.max(8, Math.min(window.innerWidth - w - 8, left));
      let top = r.bottom + 6;
      if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
      pop.style.left = left + "px";
      pop.style.top = top + "px";
      pop.querySelectorAll("[data-pop-val]").forEach(item => {
        item.onclick = (e) => {
          e.stopPropagation();
          const val = item.getAttribute("data-pop-val");
          closePopover();
          onPick(val);
        };
      });
      setTimeout(() => document.addEventListener("mousedown", docClosePop, true), 0);
    };

    const quickStatuses = ["active", "suspended", "withdrawn", "completed", "pending"];
    container.querySelectorAll("[data-quick-status]").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-quick-status");
        const v = state.volunteers.find(x => x.id === id);
        if (!v) return;
        const html = `<div class="ip-title">${t("change_status")}</div>` + quickStatuses.map(s => `
          <button type="button" class="ip-item ${s === v.status ? 'active' : ''}" data-pop-val="${s}">
            <span class="ip-dot ip-${s}"></span>
            <span class="ip-label">${t(s)}</span>
            ${s === v.status ? `<span class="ip-check">${ic("check", 12)}</span>` : ''}
          </button>`).join('');
        openPopover(btn, html, async (val) => {
          if (val === v.status) return;
          try {
            await window.AtharAPI.volunteers.update(id, { status: val });
            await window.AtharStore.refreshVolunteers();
            showToast(t("status_updated"), "success");
            renderVolunteersList(container);
          } catch (err) { showToast(err.message || "Update failed", "error"); }
        });
      };
    });

    container.querySelectorAll("[data-quick-comm]").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-quick-comm");
        const v = state.volunteers.find(x => x.id === id);
        if (!v) return;
        const noneItem = `
          <button type="button" class="ip-item ${!v.committee_id ? 'active' : ''}" data-pop-val="none">
            <span class="ip-dot ip-none"></span>
            <span class="ip-label">${t("no_committee")}</span>
            ${!v.committee_id ? `<span class="ip-check">${ic("check", 12)}</span>` : ''}
          </button>`;
        const commItems = state.committees.map(c => {
          const name = App.currentLang === 'ar' ? c.name_ar : c.name_en;
          return `
          <button type="button" class="ip-item ${v.committee_id === c.id ? 'active' : ''}" data-pop-val="${c.id}">
            <span class="ip-dot ip-comm"></span>
            <span class="ip-label">${escAttr(name)}</span>
            ${v.committee_id === c.id ? `<span class="ip-check">${ic("check", 12)}</span>` : ''}
          </button>`;
        }).join('');
        openPopover(btn, `<div class="ip-title">${t("change_committee")}</div>${noneItem}<div class="ip-scroll">${commItems}</div>`, async (val) => {
          const newComm = val === "none" ? null : val;
          if ((newComm || null) === (v.committee_id || null)) return;
          try {
            await window.AtharAPI.volunteers.update(id, { committeeId: newComm });
            await window.AtharStore.refreshVolunteers();
            showToast(t("committee_updated"), "success");
            renderVolunteersList(container);
          } catch (err) { showToast(err.message || "Update failed", "error"); }
        });
      };
    });

    // ---- Sortable column headers ----
    container.querySelectorAll(".th-sortable").forEach(th => {
      th.onclick = () => {
        const f = th.getAttribute("data-sort");
        if (App.volSortField === f) {
          App.volSortDir = App.volSortDir === "asc" ? "desc" : "asc";
        } else {
          App.volSortField = f;
          App.volSortDir = (f === "join_date" || f === "hours" || f === "activity") ? "desc" : "asc";
        }
        App.pagination.volunteersPage = 1;
        renderVolunteersList(container);
      };
    });

    // ---- Select all filtered / clear selection ----
    const selAllBtn = document.getElementById("btn-select-all-filtered");
    if (selAllBtn) {
      selAllBtn.onclick = () => {
        filtered.forEach(v => App.selectedVolunteerIds.add(v.id));
        renderVolunteersList(container);
      };
    }
    const clearSelBtn = document.getElementById("btn-clear-selection");
    if (clearSelBtn) {
      clearSelBtn.onclick = () => {
        App.selectedVolunteerIds.clear();
        renderVolunteersList(container);
      };
    }

    // ---- Empty state buttons ----
    const emptyAddBtn = document.getElementById("btn-empty-add-vol");
    if (emptyAddBtn) emptyAddBtn.onclick = () => window.AtharModals.openAddVolunteerSlideover();
    const emptyClearBtn = document.getElementById("btn-empty-clear-filters");
    if (emptyClearBtn) emptyClearBtn.onclick = resetVolFilters;

    // ---- Copy buttons (phone numbers) ----
    bindCopyButtons(container);

    const prevBtn = document.getElementById("vol-prev-btn");
    const nextBtn = document.getElementById("vol-next-btn");
    if (prevBtn) prevBtn.onclick = () => { App.pagination.volunteersPage--; renderVolunteersList(container); };
    if (nextBtn) nextBtn.onclick = () => { App.pagination.volunteersPage++; renderVolunteersList(container); };

    container.querySelectorAll(".vol-page-num").forEach(btn => {
      btn.onclick = () => {
        App.pagination.volunteersPage = Number(btn.getAttribute("data-page"));
        renderVolunteersList(container);
      };
    });

    const checkAll = document.getElementById("th-check-all");
    if (checkAll) {
      const pageSelected = pagedVols.filter(v => App.selectedVolunteerIds.has(v.id)).length;
      if (pagedVols.length > 0) {
        checkAll.checked = pageSelected === pagedVols.length;
        checkAll.indeterminate = pageSelected > 0 && pageSelected < pagedVols.length;
      }
      checkAll.onchange = (e) => {
        if (e.target.checked) pagedVols.forEach(v => App.selectedVolunteerIds.add(v.id));
        else pagedVols.forEach(v => App.selectedVolunteerIds.delete(v.id));
        renderVolunteersList(container);
      };
    }

    container.querySelectorAll(".vol-row-cb").forEach(cb => {
      cb.onchange = (e) => {
        const id = cb.getAttribute("data-id");
        if (e.target.checked) App.selectedVolunteerIds.add(id);
        else App.selectedVolunteerIds.delete(id);
        renderVolunteersList(container);
      };
    });

    // ---- Bulk: Log Hours ----
    const bulkLogHours = document.getElementById("btn-bulk-log-hours");
    if (bulkLogHours) {
      bulkLogHours.onclick = () => {
        const ids = Array.from(App.selectedVolunteerIds);
        if (!ids.length) { showToast("No volunteers selected", "error"); return; }
        if (!window.AtharModals || typeof window.AtharModals.openBulkLogHoursSlideover !== "function") {
          showToast("Bulk log hours is not available — modals.js not updated", "error");
          return;
        }
        window.AtharModals.openBulkLogHoursSlideover(ids);
      };
    }

    // ---- Bulk: Rate ----
    const bulkRate = document.getElementById("btn-bulk-rate");
    if (bulkRate) {
      bulkRate.onclick = () => {
        const ids = Array.from(App.selectedVolunteerIds);
        if (!ids.length) { showToast("No volunteers selected", "error"); return; }
        if (!window.AtharModals || typeof window.AtharModals.openBulkRatingModal !== "function") {
          showToast("Bulk rating is not available — modals.js not updated", "error");
          return;
        }
        window.AtharModals.openBulkRatingModal(ids);
      };
    }

    // ---- Bulk: Transfer ----
    const bulkTransferBtn = document.getElementById("btn-bulk-transfer");
    if (bulkTransferBtn) {
      bulkTransferBtn.onclick = () => {
        const ids = Array.from(App.selectedVolunteerIds);
        if (!ids.length) { showToast("No volunteers selected", "error"); return; }
        window.AtharModals.openBulkTransferModal(ids);
      };
    }

    // ---- Bulk: WhatsApp reminder ----
    const bulkWhatsappBtn = document.getElementById("btn-bulk-whatsapp");
    if (bulkWhatsappBtn) {
      bulkWhatsappBtn.onclick = () => {
        const ids = Array.from(App.selectedVolunteerIds);
        if (!ids.length) { showToast("No volunteers selected", "error"); return; }
        window.AtharModals.openWhatsAppReminderModal(ids);
      };
    }

    const bulkArchive = document.getElementById("btn-bulk-archive");
    if (bulkArchive) {
      bulkArchive.onclick = () => {
        const count = App.selectedVolunteerIds.size;
        showConfirmModal({
          title: t("confirm_destructive"),
          message: `Archive ${count} volunteer${count > 1 ? 's' : ''}? Records preserved.`,
          onConfirm: async () => {
            const ids = Array.from(App.selectedVolunteerIds);
            const results = await Promise.allSettled(ids.map((id) => window.AtharAPI.volunteers.archive(id)));
            const ok = results.filter((r) => r.status === "fulfilled").length;
            const fail = results.length - ok;
            const archivedIds = ids.filter((id, i) => results[i].status === "fulfilled");
            App.selectedVolunteerIds.clear();
            await window.AtharStore.refreshVolunteers();
            if (fail === 0) showToast(`Archived ${ok} volunteer${ok > 1 ? 's' : ''}`, "success");
            else if (ok === 0) showToast("Failed to archive volunteers", "error");
            else showToast(`Archived ${ok}, failed ${fail}`, "warning");
            if (archivedIds.length) {
              window.AtharCore.showUndoToast(
                App.currentLang === "ar" ? `تمت أرشفة ${archivedIds.length} متطوع` : `Archived ${archivedIds.length} volunteer${archivedIds.length > 1 ? 's' : ''}`,
                async () => {
                  for (const id of archivedIds) {
                    try { await window.AtharAPI.volunteers.restore(id); } catch (e) { console.warn(e); }
                  }
                  await window.AtharStore.refreshVolunteers();
                  renderVolunteersList(container);
                }
              );
            }
            renderVolunteersList(container);
          },
        });
      };

     // ---- Bulk: change status ----
     const bulkStatusBtn = document.getElementById("btn-bulk-status");
     if (bulkStatusBtn) {
       bulkStatusBtn.onclick = async () => {
         const sel = document.getElementById("bulk-status-select");
         const newStatus = sel ? sel.value : "";
         if (!newStatus) { showToast(App.currentLang === 'ar' ? 'اختر حالة' : 'Pick a status', "warning"); return; }
         const ids = Array.from(App.selectedVolunteerIds);
         if (!ids.length) return;
         bulkStatusBtn.disabled = true;
         const results = await Promise.allSettled(ids.map(id => window.AtharAPI.volunteers.update(id, { status: newStatus })));
         const ok = results.filter(r => r.status === "fulfilled").length;
         const fail = results.length - ok;
         App.selectedVolunteerIds.clear();
         await window.AtharStore.refreshVolunteers();
         if (fail === 0) showToast(`${App.currentLang === 'ar' ? 'تم التحديث' : 'Updated'} (${ok})`, "success");
         else showToast(`${ok} ✓ • ${fail} ✗`, "warning");
         renderVolunteersList(container);
       };
     }
    }

    const bulkExport = document.getElementById("btn-bulk-export");
    if (bulkExport) {
      bulkExport.onclick = () => {
        const selectedList = state.volunteers.filter(v => App.selectedVolunteerIds.has(v.id));
        const headers = ["ID", "Name", "National ID", "Phone", "Email", "Age", "Gender", "Nationality", "Status"];
        const rows = selectedList.map(v => [v.id, v.full_name, v.national_id || "", v.phone || "", v.email || "", age(v.dob) ?? "", v.gender || "", v.nationality || "", v.status]);
        window.ExportUtil.downloadCSV("Selected_Volunteers.csv", headers, rows);
      };
    }

    const exportCsv = document.getElementById("btn-export-vols-csv");
    if (exportCsv) {
      exportCsv.onclick = () => {
        const headers = ["ID", "Name (EN)", "Name (AR)", "National ID", "Phone", "WhatsApp", "Email", "Age", "DOB", "Gender", "Nationality", "Study Level", "Committee", "Status", "Join Date"];
        const rows = filtered.map(v => {
          const c = state.committees.find(x => x.id === v.committee_id);
          return [
            v.id,
            v.full_name,
            v.full_name_ar || "",
            v.national_id || "",
            v.phone || "",
            v.whatsapp || "",
            v.email || "",
            age(v.dob) ?? "",
            v.dob || "",
            v.gender || "",
            v.nationality || "",
            v.study_level || "",
            c ? c.name_en : "",
            v.status,
            v.join_date || "",
          ];
        });
        window.ExportUtil.downloadCSV("Athar_Volunteers_Filtered.csv", headers, rows);
      };
    }

    const printDir = document.getElementById("btn-print-dir");
    if (printDir) {
      printDir.onclick = () => {
        const w = window.open("", "_blank");
        if (!w) return;
        const rows = filtered.map(v => {
          const c = state.committees.find(x => x.id === v.committee_id);
          const comm = c ? (App.currentLang === 'ar' ? c.name_ar : c.name_en) : '—';
          return `<tr><td>${escapeHtml(volDisplayName(v))}</td><td>${v.phone || '—'}</td><td>${v.whatsapp || '—'}</td><td>${v.email || '—'}</td><td>${comm}</td><td>${t(v.status)}</td></tr>`;
        }).join("");
        w.document.write(`<!DOCTYPE html><html dir="${App.currentLang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>Volunteer Directory</title><style>body{font-family:Cairo,Inter,sans-serif;padding:24px;}table{width:100%;border-collapse:collapse;font-size:12px;}th,td{border:1px solid #ccc;padding:6px 8px;text-align:start;}th{background:#f1f3f5;}h1{font-size:18px;margin-bottom:12px;}</style></head><body><h1>${App.currentLang === 'ar' ? 'دليل المتطوعين' : 'Volunteer Directory'}</h1><p>${filtered.length} ${App.currentLang === 'ar' ? 'متطوع' : 'volunteers'} • ${new Date().toLocaleDateString()}</p><table><thead><tr><th>${App.currentLang === 'ar' ? 'الاسم' : 'Name'}</th><th>${App.currentLang === 'ar' ? 'الهاتف' : 'Phone'}</th><th>WhatsApp</th><th>Email</th><th>${App.currentLang === 'ar' ? 'اللجنة' : 'Committee'}</th><th>${t("status")}</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print();</script></body></html>`);
        w.document.close();
      };
    }

    const importCsv = document.getElementById("btn-import-vols-csv");
    if (importCsv) importCsv.onclick = () => window.AtharModals.openImportVolunteersModal();

    const addBtn = document.getElementById("btn-add-volunteer");
    if (addBtn) addBtn.onclick = () => window.AtharModals.openAddVolunteerSlideover();
  }

  // =========================================================================
  // Volunteer Profile — with gender hero, age, split notes
  // =========================================================================
  async function renderVolunteerProfile(container, volunteerId) {
    const state = window.AtharStore.getState();
    const vol = state.volunteers.find(v => v.id === volunteerId);
    if (!vol) {
      container.innerHTML = `<div class="empty-state"><p>Volunteer not found.</p></div>`;
      return;
    }

    // Fetch attendance + transfers + full stats from the API.
    // Attendance is not in the store cache; the stats block is aggregated
    // server-side over ALL records so nothing is cut off by list limits.
    let attendanceRecords = [];
    let transfers = [];
    let serverStats = null;
    try {
      const detail = await window.AtharAPI.volunteers.get(vol.id);
      serverStats = detail.stats || null;
      const rawAtt = detail.attendance || [];
      attendanceRecords = rawAtt.map(a => ({
        id: a.id,
        meeting_id: a.meetingId || a.meeting_id,
        volunteer_id: a.volunteerId || a.volunteer_id,
        status: a.status,
        note: a.note,
        recorded_at: a.recordedAt || a.recorded_at,
        meeting: a.meeting || null,
      }));

      const rawTr = detail.transfers || [];
      transfers = rawTr.map(t => ({
        id: t.id,
        volunteer_id: t.volunteerId || t.volunteer_id,
        from_committee_id: t.fromCommitteeId || t.from_committee_id,
        to_committee_id: t.toCommitteeId || t.to_committee_id,
        reason: t.reason,
        transferred_at: t.transferredAt || t.transferred_at,
        from_committee: t.fromCommittee || null,
        to_committee: t.toCommittee || null,
      }));
    } catch (err) {
      console.warn("[profile] Failed to load attendance/transfers", err);
    }

    const comm = state.committees.find(c => c.id === vol.committee_id);
    // Committee leadership badge (member-based leadership)
    const leadsComm = state.committees.find(c =>
      (c.leader && c.leader.id === vol.id) ||
      (c.co_leaders || []).some(x => x.id === vol.id));
    const isLeaderRole = !!(leadsComm && leadsComm.leader && leadsComm.leader.id === vol.id);
    const leadershipBadge = leadsComm
      ? `<span class="badge ${isLeaderRole ? 'badge-warning' : 'badge-purple'}" title="${escAttr(App.currentLang === 'ar' ? leadsComm.name_ar : leadsComm.name_en)}">${isLeaderRole ? t("leader_badge") : t("coleader_badge")}</span>`
      : '';
    // Store fallback (gets the fresh attendance too, so the rate is never a fake 100%)
    const stats = window.AtharStore.getVolunteerStats(vol.id, attendanceRecords);
    // Prefer complete server-side aggregates when available
    const ps = serverStats ? {
      totalHours: serverStats.hours.approved,
      pendingHours: serverStats.hours.pending,
      rejectedHours: serverStats.hours.rejected,
      hoursEntries: serverStats.hours.entries,
      attendanceRate: serverStats.attendance.rate,
      attTotal: serverStats.attendance.total,
      attAttended: serverStats.attendance.present + serverStats.attendance.late,
      attAbsent: serverStats.attendance.absent,
      attExcused: serverStats.attendance.excused,
      avgEvaluation: serverStats.evaluations.avgScore != null ? Number(serverStats.evaluations.avgScore).toFixed(1) : null,
      evalsCount: serverStats.evaluations.count,
      certsCount: serverStats.certificates.issued,
      draftCerts: serverStats.certificates.draft,
    } : stats;
    const a = age(vol.dob);
    const gs = genderStyle(vol.gender);
    const notesArr = splitNotes(vol.notes);
    // Profile completeness (goal-gradient: never start at 0% — count the name as done)
    const profileFields = [
      !!vol.full_name, !!(vol.phone || vol.whatsapp), !!vol.email,
      !!vol.dob, !!vol.gender, !!vol.nationality, !!vol.committee_id, !!vol.national_id,
    ];
    const filledCount = profileFields.filter(Boolean).length;
    const completeness = Math.round((filledCount / profileFields.length) * 100);
    let activeTab = App.currentParams.sub || "overview";

    const canEdit = hasPermission("volunteers", "edit");
    const canTransfer = hasPermission("volunteers", "transfer");
    const canEvaluate = hasPermission("evaluations", "create");
    const canLogHours = hasPermission("volunteer_hours", "create");
    const canCert = hasPermission("certificates", "create");
    const canEditHours = hasPermission("volunteer_hours", "edit") || (App.currentUser && App.currentUser.role === "super_admin");
    const canDeleteHours = hasPermission("volunteer_hours", "delete") || (App.currentUser && App.currentUser.role === "super_admin");

    const evaluations = state.evaluations.filter(e => e.volunteer_id === vol.id);
    const hoursLog = state.volunteer_hours.filter(h => h.volunteer_id === vol.id);
    const certs = state.certificates.filter(c => c.volunteer_id === vol.id);

    // ---- Unified timeline (hours + attendance + evaluations + transfers + certificates) ----
    const dateOnly = (s) => (s == null ? s : String(s).slice(0, 10));
    const commName = (c) => c ? (App.currentLang === 'ar' ? (c.nameAr || c.name_ar) : (c.nameEn || c.name_en)) : '—';
    const timelineEvents = [];
    transfers.forEach(tr => {
      const fromComm = tr.from_committee || state.committees.find(c => c.id === tr.from_committee_id);
      const toComm = tr.to_committee || state.committees.find(c => c.id === tr.to_committee_id);
      timelineEvents.push({
        type: "transfer",
        icon: ic("arrow_right", 13),
        date: tr.transferred_at,
        title: `${commName(fromComm)} → ${commName(toComm)}`,
        meta: tr.reason || '',
      });
    });
    hoursLog.forEach(h => timelineEvents.push({
      type: "hours",
      icon: ic("clock", 13),
      date: h.date,
      title: h.activity || '—',
      meta: `${h.hours} h · ${t(h.status)}`,
    }));
    attendanceRecords.forEach(att => {
      const mtg = att.meeting || state.meetings.find(m => m.id === att.meeting_id);
      const title = mtg
        ? (App.currentLang === 'ar' ? (mtg.titleAr || mtg.title_ar || mtg.titleEn || mtg.title_en) : (mtg.titleEn || mtg.title_en))
        : t("meeting_word");
      const date = mtg ? (mtg.meetingDate || mtg.meeting_date) : att.recorded_at;
      timelineEvents.push({
        type: "attendance",
        icon: ic("check", 13),
        date,
        title: title || t("meeting_word"),
        meta: `${t(att.status)}${att.note ? ' · ' + att.note : ''}`,
      });
    });
    evaluations.forEach(ev => timelineEvents.push({
      type: "evaluation",
      icon: ic("star", 13),
      date: ev.evaluated_at,
      title: ev.period_label || t("tab_evaluations"),
      meta: `${ev.overall_score} / 5`,
    }));
    certs.forEach(c => timelineEvents.push({
      type: "certificate",
      icon: ic("award", 13),
      date: c.issue_date,
      title: c.certificate_no || t("draft"),
      meta: `${c.total_hours} h · ${t(c.status)}`,
    }));
    timelineEvents.sort((x, y) => new Date(y.date || 0) - new Date(x.date || 0));

    // Summary counters for the attendance / hours tabs
    const attCounts = { present: 0, late: 0, absent: 0, excused: 0 };
    attendanceRecords.forEach(r => { if (attCounts[r.status] != null) attCounts[r.status]++; });
    const hoursSum = { approved: 0, pending: 0, rejected: 0 };
    hoursLog.forEach(h => { if (hoursSum[h.status] != null) hoursSum[h.status] += (Number(h.hours) || 0); });

    // Evaluations tab with completion summary
    const evalsHtml = evaluations.length === 0
      ? `<div class="empty-state"><p>${t("add_evaluation")}</p></div>`
      : evaluations.map(e => {
        const scores = state.evaluation_scores.filter(s => s.evaluation_id === e.id);
        const allCrit = state.criteria.filter(c => c.is_active);
        const missing = allCrit.filter(c => !scores.find(s => s.criteria_id === c.id));
        const isComplete = missing.length === 0;
        return `
          <div class="card">
            <div class="card-header">
              <div>
                <span style="font-weight:700; font-size:16px;">${e.period_label}</span>
                <span style="margin:0 8px; color:var(--neutral-400);">&bull;</span>
                <span style="font-size:12px; color:var(--neutral-500);">${e.evaluated_at}</span>
                ${isComplete
            ? `<span class="badge badge-success" style="margin-inline-start:8px;">✓ ${t("eval_complete")}</span>`
            : `<span class="badge badge-warning" style="margin-inline-start:8px;">⚠ ${missing.length} ${t("eval_missing_items")}</span>`}
              </div>
              <div style="font-size:18px; font-weight:800; color:var(--warning);">${e.overall_score} / 5.0</div>
            </div>
            <p style="color:var(--neutral-700); font-size:13px; margin-bottom:12px;">${e.notes || ''}</p>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:10px; background:var(--neutral-50); padding:12px; border-radius:var(--radius-md);">
              ${allCrit.map(c => {
              const sc = scores.find(s => s.criteria_id === c.id);
              return `
                  <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; ${sc ? '' : 'opacity:0.5;'}">
                    <span style="font-weight:600;">${App.currentLang === 'ar' ? c.name_ar : c.name_en}</span>
                    <span style="color:${sc ? '#F59E0B' : 'var(--danger)'}; font-weight:700;">${sc ? sc.score + ' / 5' : '—'}</span>
                  </div>
                `;
            }).join('')}
            </div>
          </div>
        `;
      }).join('');

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('volunteers')">${t("back_to_volunteers")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${escapeHtml(volDisplayName(vol))}</span>
          </div>
        </div>
      </div>

      <div class="profile-hero" style="border-inline-start:6px solid ${gs.border}; background:linear-gradient(to bottom, ${gs.bg}22, var(--surface));">
        <div class="profile-hero-left">
          ${avatarHtml(vol, 84)}
          <div class="profile-hero-info">
            <div class="profile-name-row">
              <span class="profile-name">${escapeHtml(volDisplayName(vol))}</span>
              <span class="badge ${vol.status === 'active' ? 'badge-success' : vol.status === 'pending' ? 'badge-purple' : 'badge-neutral'}">${t(vol.status)}</span>
              ${leadershipBadge}
              ${genderChip(vol.gender)}
              ${ps.totalHours >= 100 ? `<span class="badge badge-warning" title="${App.currentLang === 'ar' ? '100+ ساعة تطوع' : '100+ volunteer hours'}">🏅 ${App.currentLang === 'ar' ? '100+ ساعة' : '100+ h'}</span>` : ps.totalHours >= 50 ? `<span class="badge badge-success" title="${App.currentLang === 'ar' ? '50+ ساعة تطوع' : '50+ volunteer hours'}">⭐ ${App.currentLang === 'ar' ? '50+ ساعة' : '50+ h'}</span>` : ''}
            </div>
            <div class="profile-progress-wrap" style="margin-top:8px; max-width:280px;">
              <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--neutral-500); margin-bottom:3px;">
                <span>${t("profile_completeness")}</span>
                <span class="num-ltr">${completeness}%</span>
              </div>
              <div class="profile-progress"><span style="width:${completeness}%;"></span></div>
            </div>
            <div class="profile-meta-row">
              ${a !== null ? `<div class="profile-meta-item"><strong>${a}</strong> ${App.currentLang === 'ar' ? 'سنة' : 'years old'}</div>` : ''}
              ${vol.nationality ? `<div class="profile-meta-item">${escapeHtml(vol.nationality)}</div>` : ''}
              ${vol.study_level ? `<div class="profile-meta-item">${vol.study_level}</div>` : ''}
              <div class="profile-meta-item">
                <span>${ic("building", 14)}</span>
                <span>${comm ? (App.currentLang === 'ar' ? comm.name_ar : comm.name_en) : '—'}</span>
              </div>
              <div class="profile-meta-item">
                <span>${ic("calendar", 14)}</span>
                <span>${formatDate(vol.join_date)}</span>
              </div>
              ${vol.phone ? `<div class="profile-meta-item">${ic("user", 14)} <span class="num-ltr">${escapeHtml(vol.phone)}</span><button type="button" class="copy-quick" data-copy="${escAttr(vol.phone)}" title="${t("copy")}">${ic("copy", 11)}</button></div>` : ''}
              ${vol.whatsapp ? `
                <a href="https://wa.me/${vol.whatsapp.replace(/[^0-9]/g, '')}" target="_blank" class="btn btn-whatsapp btn-sm" style="padding:3px 10px;">
                  ${ic("whatsapp", 12)} WhatsApp
                </a>
                <span class="num-ltr profile-meta-item" style="font-family:var(--font-mono); font-size:12px; color:var(--neutral-700);">${escapeHtml(vol.whatsapp)}</span>
                <button type="button" class="copy-quick" data-copy="${escAttr(vol.whatsapp)}" title="${t("copy")}">${ic("copy", 11)}</button>
              ` : ''}
              ${vol.email ? `<a class="profile-meta-item" href="mailto:${escAttr(vol.email)}" style="text-decoration:none; color:inherit;">${ic("send", 14)} ${escapeHtml(vol.email)}</a>` : ''}
            </div>
          </div>
        </div>
        <div class="profile-hero-actions">
          ${canEdit ? `<button class="btn btn-secondary btn-sm" id="btn-prof-edit">${ic("pencil", 14)} ${t("edit")}</button>` : ''}
          ${canTransfer ? `<button class="btn btn-secondary btn-sm" id="btn-prof-transfer">${ic("arrow_right", 14)} ${t("transfer_volunteer")}</button>` : ''}
          ${canEvaluate ? `<button class="btn btn-secondary btn-sm" id="btn-prof-eval">${ic("star", 14)} ${t("add_evaluation")}</button>` : ''}
          ${canLogHours ? `<button class="btn btn-secondary btn-sm" id="btn-prof-log-hours">${ic("clock", 14)} ${t("log_hours")}</button>` : ''}
          ${canCert ? `<button class="btn btn-primary btn-sm" id="btn-prof-gen-cert">${ic("award", 14)} ${t("generate_certificate")}</button>` : ''}
        </div>
      </div>

      <div class="tabs-header">
        <div class="tab-btn ${activeTab === 'overview' ? 'active' : ''}" data-tab="overview">${t("tab_overview")}</div>
        <div class="tab-btn ${activeTab === 'attendance' ? 'active' : ''}" data-tab="attendance">${t("tab_attendance")} <span class="tab-badge">${attendanceRecords.length}</span></div>
        <div class="tab-btn ${activeTab === 'evaluations' ? 'active' : ''}" data-tab="evaluations">${t("tab_evaluations")} <span class="tab-badge">${evaluations.length}</span></div>
        <div class="tab-btn ${activeTab === 'hours' ? 'active' : ''}" data-tab="hours">${t("tab_hours")} <span class="tab-badge">${hoursLog.length}</span></div>
        <div class="tab-btn ${activeTab === 'certificates' ? 'active' : ''}" data-tab="certificates">${t("tab_certificates")} <span class="tab-badge">${certs.length}</span></div>
        <div class="tab-btn ${activeTab === 'history' ? 'active' : ''}" data-tab="history">${t("tab_history")} <span class="tab-badge">${timelineEvents.length}</span></div>
      </div>

      <div id="profile-tab-content">
        ${activeTab === "overview" ? `
          <div class="profile-stats-grid">
            <div class="stat-box"><span class="stat-box-label">${t("kpi_total_hours")}</span><span class="stat-box-value num-ltr" style="color:var(--primary);">${ps.totalHours} h</span><span style="font-size:11px; color:var(--neutral-500);">${ps.hoursEntries} ${App.currentLang === 'ar' ? 'سجل ساعات' : 'hour entries'}</span></div>
            <div class="stat-box"><span class="stat-box-label">${t("pending_hours")}</span><span class="stat-box-value num-ltr" style="color:var(--warning);">${ps.pendingHours} h</span>${ps.rejectedHours > 0 ? `<span style="font-size:11px; color:var(--neutral-500);">${ps.rejectedHours} ${t("rejected")}</span>` : ''}</div>
            <div class="stat-box"><span class="stat-box-label">${t("attendance_rate")}</span><span class="stat-box-value num-ltr" style="color:var(--success);">${ps.attendanceRate != null ? ps.attendanceRate + '%' : '—'}</span>${ps.attTotal > 0 ? `<span style="font-size:11px; color:var(--neutral-500);">${ps.attAttended} / ${ps.attTotal}</span>` : ''}</div>
            <div class="stat-box"><span class="stat-box-label">${t("meetings_attended")}</span><span class="stat-box-value num-ltr">${ps.attAttended}</span>${ps.attTotal > 0 ? `<span style="font-size:11px; color:var(--neutral-500);">${ps.attAbsent} ${t("absent")}${ps.attExcused ? ` · ${ps.attExcused} ${t("excused")}` : ''}</span>` : ''}</div>
            <div class="stat-box"><span class="stat-box-label">${t("avg_evaluation")}</span><span class="stat-box-value num-ltr" style="color:var(--warning);">${ps.avgEvaluation != null ? ps.avgEvaluation + ' / 5' : '—'}</span><span style="font-size:11px; color:var(--neutral-500);">${ps.evalsCount} ${t("tab_evaluations")}</span></div>
            <div class="stat-box"><span class="stat-box-label">${t("kpi_certificates")}</span><span class="stat-box-value num-ltr">${ps.certsCount}</span>${ps.draftCerts > 0 ? `<span style="font-size:11px; color:var(--neutral-500);">${ps.draftCerts} ${t("draft")}</span>` : ''}</div>
          </div>

          <div class="card" style="margin-bottom:16px;">
            <div class="card-title" style="margin-bottom:12px;">${ic("tag", 16)} ${t("skills")}</div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              ${(vol.skills && vol.skills.length > 0) ? vol.skills.map(s => `<span class="tag-chip">#${escapeHtml(s)}</span>`).join('') : '<p style="color:var(--neutral-500);">—</p>'}
            </div>
          </div>

          <div class="card" style="margin-bottom:16px;">
            <div class="card-title" style="margin-bottom:12px;">${ic("info", 16)} ${App.currentLang === 'ar' ? 'التفاصيل الشخصية' : 'Personal Details'}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
              <div><div style="font-size:11px; color:var(--neutral-500); font-weight:700;">${App.currentLang === 'ar' ? 'الجنسية' : 'Nationality'}</div><div style="font-weight:600;">${escapeHtml(vol.nationality || '—')}</div></div>
              <div><div style="font-size:11px; color:var(--neutral-500); font-weight:700;">${App.currentLang === 'ar' ? 'المستوى الدراسي' : 'Study Level'}</div><div style="font-weight:600;">${vol.study_level || '—'}</div></div>
              <div><div style="font-size:11px; color:var(--neutral-500); font-weight:700;">${t("dob")}</div><div class="num-ltr" style="font-weight:600;">${vol.dob || '—'} ${a !== null ? `(${a} ${App.currentLang === 'ar' ? 'سنة' : 'y'})` : ''}</div></div>
              <div><div style="font-size:11px; color:var(--neutral-500); font-weight:700;">${t("gender")}</div><div style="font-weight:600;">${genderChip(vol.gender) || '—'}</div></div>
            </div>
          </div>

          <div class="card">
            <div class="card-title" style="margin-bottom:12px;">${ic("note", 16)} ${t("notes")}</div>
            ${notesArr.length === 0
          ? '<p style="color:var(--neutral-500);">—</p>'
          : `<div style="display:flex; flex-direction:column; gap:8px;">
                   ${notesArr.map((n, i) => `
                     <div style="padding:10px 14px; background:var(--neutral-50); border-inline-start:3px solid var(--primary); border-radius:8px; font-size:13px; color:var(--neutral-800); line-height:1.6;">
                       <span style="color:var(--neutral-400); font-size:11px; font-weight:700; margin-inline-end:6px;">#${i + 1}</span>
                       ${n}
                     </div>
                   `).join('')}
                 </div>`}
          </div>
        ` : activeTab === "attendance" ? `
          ${attendanceRecords.length > 0 ? `
            <div class="mini-stats-row">
              <span class="mini-stat ok">${t("present")} <b>${attCounts.present}</b></span>
              <span class="mini-stat warn">${t("late")} <b>${attCounts.late}</b></span>
              <span class="mini-stat danger">${t("absent")} <b>${attCounts.absent}</b></span>
              <span class="mini-stat info">${t("excused")} <b>${attCounts.excused}</b></span>
            </div>
          ` : ''}
          <div class="table-container"><table class="data-table">
            <thead><tr><th>${t("meeting_word")}</th><th>${t("date")}</th><th>${t("status")}</th><th>${t("remarks")}</th></tr></thead>
            <tbody>
              ${attendanceRecords.length === 0 ? `<tr><td colspan="4" style="text-align:center; padding:24px;">${App.currentLang === 'ar' ? 'لا توجد سجلات حضور' : 'No attendance records'}</td></tr>` : attendanceRecords.map(a => {
            const mtg = a.meeting || state.meetings.find(m => m.id === a.meeting_id);
            const title = mtg
              ? (App.currentLang === 'ar' ? (mtg.titleAr || mtg.title_ar || mtg.titleEn || mtg.title_en) : (mtg.titleEn || mtg.title_en))
              : '—';
            const date = mtg
              ? formatDate(dateOnly(mtg.meetingDate || mtg.meeting_date))
              : '—';
            return `<tr>
                  <td style="font-weight:600;">${title}</td>
                  <td>${date}</td>
                  <td><span class="badge ${a.status === 'present' ? 'badge-success' : a.status === 'late' ? 'badge-warning' : a.status === 'excused' ? 'badge-info' : 'badge-danger'}">${t(a.status)}</span></td>
                  <td style="color:var(--neutral-600);">${a.note || '—'}</td>
                </tr>`;
          }).join('')}
            </tbody>
          </table></div>
        ` : activeTab === "evaluations" ? `
          <div style="display:flex; flex-direction:column; gap:16px;">${evalsHtml}</div>
        ` : activeTab === "hours" ? `
          ${hoursLog.length > 0 ? `
            <div class="mini-stats-row">
              <span class="mini-stat ok">${t("approved")} <b>${hoursSum.approved} h</b></span>
              <span class="mini-stat warn">${t("pending")} <b>${hoursSum.pending} h</b></span>
              ${hoursSum.rejected > 0 ? `<span class="mini-stat danger">${t("rejected")} <b>${hoursSum.rejected} h</b></span>` : ''}
            </div>
          ` : ''}
          <div class="table-container"><table class="data-table">
            <thead><tr>
              <th>${t("date")}</th>
              <th>${t("activity")}</th>
              <th>${t("hours")}</th>
              <th>${t("status")}</th>
              <th>${t("details")}</th>
              <th style="text-align:right;">${t("actions")}</th>
            </tr></thead>
            <tbody>
              ${hoursLog.length === 0 ? `<tr><td colspan="6" style="text-align:center; padding:24px;">—</td></tr>` : hoursLog.map(h => `
                <tr>
                  <td>${formatDate(h.date)}</td>
                  <td style="font-weight:600;">${h.activity}</td>
                  <td><span class="num-ltr" style="font-weight:700;">${h.hours} h</span></td>
                  <td><span class="badge ${h.status === 'approved' ? 'badge-success' : h.status === 'pending' ? 'badge-warning' : 'badge-danger'}">${t(h.status)}</span></td>
                  <td style="color:var(--neutral-600); font-size:12px;">${h.description || ''}</td>
                  <td>
                    <div class="row-actions-cell">
                      ${canEditHours ? `<button class="btn btn-secondary btn-sm" data-volhr-edit="${h.id}" title="${App.currentLang === 'ar' ? 'تعديل' : 'Adjust'}">${ic("pencil", 12)}</button>` : ''}
                      ${canDeleteHours ? `<button class="btn btn-danger-outline btn-sm" data-volhr-del="${h.id}" title="${t("delete")}">${ic("trash", 12)}</button>` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        ` : activeTab === "certificates" ? `
          <div class="table-container"><table class="data-table">
            <thead><tr><th>${t("certificate_no")}</th><th>${t("hours")}</th><th>${t("issue_date")}</th><th>${t("status")}</th><th></th></tr></thead>
            <tbody>
              ${certs.length === 0 ? `<tr><td colspan="5" style="text-align:center; padding:24px;">—</td></tr>` : certs.map(c => `
                <tr>
                  <td style="font-family:var(--font-mono); font-weight:700;">${c.certificate_no || 'DRAFT'}</td>
                  <td><span class="num-ltr" style="font-weight:700;">${c.total_hours} h</span></td>
                  <td>${formatDate(c.issue_date)}</td>
                  <td><span class="badge ${c.status === 'issued' ? 'badge-success' : c.status === 'draft' ? 'badge-warning' : 'badge-danger'}">${t(c.status)}</span></td>
                  <td><button class="btn btn-secondary btn-sm" onclick="window.AtharApp.navigateTo('generate-certificate', {id:'${c.volunteer_id}', sub:'${c.id}'})">${t("view")}</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>
        ` : `
          <div class="card">
            <div class="card-title" style="margin-bottom:16px;">${ic("history", 16)} ${t("tab_history")}</div>
            ${timelineEvents.length === 0 ? '<p style="color:var(--neutral-500);">—</p>' : `
              <div class="timeline">
                ${timelineEvents.map(ev => `
                  <div class="tl-item tl-${ev.type}">
                    <div class="tl-dot">${ev.icon}</div>
                    <div class="tl-body">
                      <div class="tl-head">
                        <span class="tl-title">${ev.title}</span>
                        <span class="tl-date num-ltr">${formatDate(dateOnly(ev.date))}</span>
                      </div>
                      ${ev.meta ? `<div class="tl-meta">${ev.meta}</div>` : ''}
                    </div>
                  </div>`).join('')}
              </div>
            `}
          </div>
        `}
      </div>
    `;

    container.querySelectorAll(".tab-btn").forEach(btn => {
      btn.onclick = () => {
        App.currentParams.sub = btn.getAttribute("data-tab");
        renderVolunteerProfile(container, volunteerId);
      };
    });

    const bind2 = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    bind2("btn-prof-edit", () => window.AtharModals.openAddVolunteerSlideover(vol.id));
    bind2("btn-prof-transfer", () => window.AtharModals.openTransferModal(vol.id));
    bind2("btn-prof-eval", () => navigateTo("new-evaluation", { id: vol.id }));
    bind2("btn-prof-log-hours", () => window.AtharModals.openLogHoursSlideover(vol.id));
    bind2("btn-prof-gen-cert", () => navigateTo("generate-certificate", { id: vol.id }));

    // Copy buttons (phone / whatsapp in the hero)
    bindCopyButtons(container);

    // Wire hours tab: edit / delete buttons (direct call, no AtharApp dependency)
    container.querySelectorAll("[data-volhr-edit]").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-volhr-edit");
        if (window.AtharModals && typeof window.AtharModals.openEditHoursModal === "function") {
          window.AtharModals.openEditHoursModal(id);
        } else {
          showToast("Edit hours is not available — modals.js not updated", "error");
        }
      };
    });

    container.querySelectorAll("[data-volhr-del]").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-volhr-del");
        showConfirmModal({
          title: t("confirm_destructive"),
          message: App.currentLang === 'ar'
            ? 'سيتم حذف سجل الساعات نهائياً. لا يمكن التراجع.'
            : 'This hours entry will be permanently deleted. This cannot be undone.',
          confirmText: t("delete"),
          isDanger: true,
          onConfirm: async () => {
            try {
              await window.AtharAPI.hours.delete(id);
              await window.AtharStore.refreshHours();
              showToast(App.currentLang === 'ar' ? 'تم الحذف' : 'Entry deleted', "warning");
              renderVolunteerProfile(container, volunteerId);
            } catch (err) {
              showToast(err.message || "Delete failed", "error");
            }
          },
        });
      };
    });
  }

  // Register views
  window.AtharViews.volunteers = (c, p) => renderVolunteersList(c);
  window.AtharViews.volunteerProfile = (c, p) => renderVolunteerProfile(c, p.id);
})();