/**
 * View: Evaluations (list + new form + criteria settings)
 */
(function () {
  "use strict";

  const { App, t, formatDate, ic, showToast, hasPermission, navigateTo } = window.AtharCore;

  // =========================================================
  // Evaluations List — with completion column + bulk rating
  // =========================================================
  function renderEvaluationsList(container) {
    const state = window.AtharStore.getState();
    const canCreate = hasPermission("evaluations", "create");
    const activeCriteria = state.criteria.filter(c => c.is_active);

    function completionFor(ev) {
      const scores = state.evaluation_scores.filter(s => s.evaluation_id === ev.id);
      const scoredIds = new Set(scores.map(s => s.criteria_id));
      const total = activeCriteria.length || 1;
      const done = activeCriteria.filter(c => scoredIds.has(c.id)).length;
      return { done, total, complete: done === total && total > 0 };
    }

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('dashboard')">${t("app_name")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${t("nav_evaluations")}</span>
          </div>
          <h1 class="view-title">${t("evaluations_title")}</h1>
          <p class="view-subtitle">Star-based evaluations across dynamic weighted criteria</p>
        </div>
        <div class="view-header-actions">
          ${canCreate && state.volunteers.filter(v => v.status !== 'archived').length > 0 ? `
            <button class="btn btn-secondary" id="btn-bulk-rating">
              ${ic("star", 14)} ${App.currentLang === 'ar' ? 'تقييم جماعي' : 'Bulk Rating'}
            </button>
          ` : ''}
          ${canCreate ? `<button class="btn btn-primary" id="btn-add-eval">${ic("plus", 14)} ${t("add_evaluation")}</button>` : ''}
        </div>
      </div>

      ${state.evaluations.length === 0 ? `
        <div class="card" style="text-align:center; padding:48px;">
          <div style="color:var(--neutral-400); margin-bottom:12px;">${ic("star", 42, { strokeWidth: 1.5 })}</div>
          <div style="font-weight:700; font-size:16px; margin-bottom:4px;">No evaluations yet</div>
          <p style="color:var(--neutral-500); font-size:13px;">Create your first evaluation to start tracking volunteer performance.</p>
        </div>
      ` : `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Volunteer</th>
                <th>Period</th>
                <th>Overall Score</th>
                <th>Completion</th>
                <th>Evaluator</th>
                <th>Date</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${state.evaluations.map(ev => {
      const vol = state.volunteers.find(v => v.id === ev.volunteer_id);
      const user = state.users.find(u => u.id === ev.evaluator_id);
      const c = completionFor(ev);
      return `
                  <tr>
                    <td style="font-weight:700; cursor:pointer;" onclick="window.AtharApp.navigateTo('volunteer-profile', {id:'${ev.volunteer_id}', sub:'evaluations'})">
                      ${vol ? (App.currentLang === 'ar' ? (vol.full_name_ar || vol.full_name) : vol.full_name) : 'Volunteer'}
                    </td>
                    <td><span class="badge badge-primary">${ev.period_label}</span></td>
                    <td><span style="font-weight:800; color:#F59E0B; font-size:14px;">${ev.overall_score} / 5.0</span></td>
                    <td>
                      ${c.complete
          ? `<span class="badge badge-success num-ltr">✓ ${c.done}/${c.total}</span>`
          : `<span class="badge badge-warning num-ltr">⚠ ${c.done}/${c.total}</span>`}
                    </td>
                    <td>${user ? user.full_name : 'Super Admin'}</td>
                    <td class="num-ltr">${formatDate(ev.evaluated_at)}</td>
                    <td>
                      <div class="row-actions-cell">
                        <button class="btn btn-secondary btn-sm" onclick="window.AtharApp.navigateTo('volunteer-profile', {id:'${ev.volunteer_id}', sub:'evaluations'})">${t("view")}</button>
                        ${canCreate ? `<button class="btn btn-danger-outline btn-sm" onclick="window.AtharApp.deleteEvaluation('${ev.id}')">${t("delete")}</button>` : ''}
                      </div>
                    </td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;

    const addBtn = document.getElementById("btn-add-eval");
    if (addBtn) addBtn.onclick = () => navigateTo("new-evaluation");

    const bulkBtn = document.getElementById("btn-bulk-rating");
    if (bulkBtn) {
      bulkBtn.onclick = () => {
        const ids = state.volunteers.filter(v => v.status !== "archived").map(v => v.id);
        if (!ids.length) { showToast("No active volunteers", "error"); return; }
        window.AtharModals.openBulkRatingModal(ids);
      };
    }
  }

  // =========================================================
  // New Evaluation Form — free-text period (no hardcoded quarters)
  // =========================================================
  function renderNewEvaluationForm(container, preSelectedVolId) {
    const state = window.AtharStore.getState();
    const criteria = state.criteria.filter(c => c.is_active);
    const activeVols = state.volunteers.filter(v => v.status !== "archived");

    if (criteria.length === 0) {
      container.innerHTML = `
        <div class="view-header"><div class="view-header-left"><h1 class="view-title">${t("add_evaluation")}</h1></div></div>
        <div class="card" style="text-align:center; padding:48px;">
          <div style="color:var(--warning); margin-bottom:12px;">${ic("alert", 42, { strokeWidth: 1.5 })}</div>
          <div style="font-weight:700; font-size:16px; margin-bottom:4px;">No evaluation criteria defined</div>
          <p style="color:var(--neutral-500); font-size:13px; margin-bottom:16px;">You need to add at least one criterion before creating evaluations.</p>
          ${App.currentUser.role === "super_admin"
          ? `<button class="btn btn-primary" id="btn-goto-criteria">${ic("plus", 14)} ${t("add_criterion")}</button>`
          : `<p style="color:var(--neutral-500); font-size:12px;">Contact the Super Admin to add criteria.</p>`}
        </div>`;
      const b = document.getElementById("btn-goto-criteria");
      if (b) b.onclick = () => navigateTo("evaluation-criteria");
      return;
    }

    if (activeVols.length === 0) {
      container.innerHTML = `
        <div class="view-header"><div class="view-header-left"><h1 class="view-title">${t("add_evaluation")}</h1></div></div>
        <div class="card" style="text-align:center; padding:48px;">
          <div style="color:var(--neutral-400); margin-bottom:12px;">${ic("users", 42, { strokeWidth: 1.5 })}</div>
          <div style="font-weight:700; font-size:16px; margin-bottom:4px;">No active volunteers</div>
          <button class="btn btn-primary" id="btn-goto-vols">Go to Volunteers</button>
        </div>`;
      const b = document.getElementById("btn-goto-vols");
      if (b) b.onclick = () => navigateTo("volunteers");
      return;
    }

    const now = new Date();
    const defaultPeriod = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('evaluations')">${t("nav_evaluations")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>New Evaluation</span>
          </div>
          <h1 class="view-title">${t("add_evaluation")}</h1>
          <p class="view-subtitle">${t("star_rating_prompt")}</p>
        </div>
      </div>

      <div class="card" style="max-width: 820px; margin: 0 auto;">
        <form id="new-eval-form">
          <div class="form-grid" style="margin-bottom:20px;">
            <div class="form-field">
              <label class="field-label">${t("volunteer_name")} <span class="required-asterisk">*</span></label>
              <select class="form-control" id="eval-vol-select" required>
                <option value="">—</option>
                ${activeVols.map(v => `<option value="${v.id}" ${preSelectedVolId === v.id ? 'selected' : ''}>${App.currentLang === 'ar' ? (v.full_name_ar || v.full_name) : v.full_name}</option>`).join('')}
              </select>
            </div>
            <div class="form-field">
              <label class="field-label">${t("period")} <span class="required-asterisk">*</span></label>
              <input type="text" id="eval-period-input" class="form-control" required value="${defaultPeriod}" placeholder="e.g. 2026-Q4 or October 2026 or Ramadan 2026">
              <span class="field-hint">${App.currentLang === 'ar' ? 'أي نص — ربع، شهر، أو فترة مخصصة' : 'Free text — quarter, month, or custom period'}</span>
            </div>
          </div>

          <div class="form-grid" style="margin-bottom:20px;">
            <div class="form-field">
              <label class="field-label">${App.currentLang === 'ar' ? 'بداية الفترة (اختياري)' : 'Period Start (optional)'}</label>
              <input type="date" id="eval-period-start" class="form-control">
            </div>
            <div class="form-field">
              <label class="field-label">${App.currentLang === 'ar' ? 'نهاية الفترة (اختياري)' : 'Period End (optional)'}</label>
              <input type="date" id="eval-period-end" class="form-control">
            </div>
          </div>

          <h3 style="font-size:15px; margin-bottom:14px; border-bottom:1px solid var(--neutral-300); padding-bottom:8px;">${t("criteria")} (1 to 5 Stars)</h3>

          <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:24px;">
            ${criteria.map(c => `
              <div class="eval-criterion-row" data-crit-id="${c.id}" data-weight="${c.weight}" style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--neutral-50); border:1px solid var(--neutral-300); border-radius:var(--radius-md);">
                <div>
                  <div style="font-weight:700; color:var(--neutral-900);">${App.currentLang === 'ar' ? c.name_ar : c.name_en}</div>
                  <div style="font-size:11px; color:var(--neutral-500);">Weight: ${c.weight}x</div>
                </div>
                <div style="display:flex; align-items:center; gap:16px;">
                  <div class="star-rating" data-crit-id="${c.id}">
                    <span class="star" data-score="1">★</span>
                    <span class="star" data-score="2">★</span>
                    <span class="star" data-score="3">★</span>
                    <span class="star" data-score="4">★</span>
                    <span class="star" data-score="5">★</span>
                  </div>
                  <input type="text" class="form-control crit-comment" placeholder="${t("comment")}..." style="width:180px; font-size:12px;">
                </div>
              </div>
            `).join('')}
          </div>

          <div style="display:flex; align-items:center; justify-content:space-between; padding:16px 20px; background:var(--primary-light); border:1px solid var(--primary-border); border-radius:var(--radius-lg); margin-bottom:20px;">
            <div>
              <div style="font-weight:800; font-size:16px; color:var(--primary);">${t("overall_score")} (Auto-calculated)</div>
              <div style="font-size:12px; color:var(--neutral-600);">Weighted average — pick all stars to see the score</div>
            </div>
            <div id="live-overall-score" style="font-size:28px; font-weight:800; color:var(--primary);" class="num-ltr">— / 5.0</div>
          </div>

          <div class="form-field" style="margin-bottom:24px;">
            <label class="field-label">${t("notes")}</label>
            <textarea id="eval-general-notes" class="form-control" rows="3" placeholder="Executive assessment and feedback remarks..."></textarea>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:12px;">
            <button type="button" class="btn btn-secondary" id="btn-cancel-eval">${t("cancel")}</button>
            <button type="submit" class="btn btn-primary" id="btn-submit-eval">${t("save")}</button>
          </div>
        </form>
      </div>
    `;

    const criterionScores = {};

    function recalculateOverall() {
      const scored = criteria.filter(c => criterionScores[c.id] !== undefined);
      if (scored.length === 0) {
        document.getElementById("live-overall-score").textContent = "— / 5.0";
        return null;
      }
      let sum = 0, totalW = 0;
      scored.forEach(c => {
        sum += criterionScores[c.id] * c.weight;
        totalW += c.weight;
      });
      const avg = totalW > 0 ? (sum / totalW).toFixed(2) : null;
      document.getElementById("live-overall-score").textContent = avg ? `${avg} / 5.0` : "— / 5.0";
      return avg ? Number(avg) : null;
    }

    container.querySelectorAll(".star-rating").forEach(ratingEl => {
      const critId = ratingEl.getAttribute("data-crit-id");
      const stars = ratingEl.querySelectorAll(".star");
      stars.forEach(star => {
        star.onclick = () => {
          const score = Number(star.getAttribute("data-score"));
          criterionScores[critId] = score;
          stars.forEach(s => {
            const sc = Number(s.getAttribute("data-score"));
            if (sc <= score) s.classList.add("filled");
            else s.classList.remove("filled");
          });
          recalculateOverall();
        };
      });
    });

    const cancelBtn = document.getElementById("btn-cancel-eval");
    if (cancelBtn) cancelBtn.onclick = () => navigateTo("evaluations");

    document.getElementById("new-eval-form").onsubmit = async (e) => {
      e.preventDefault();

      const volId = document.getElementById("eval-vol-select").value;
      const period = document.getElementById("eval-period-input").value.trim();
      const periodStart = document.getElementById("eval-period-start").value;
      const periodEnd = document.getElementById("eval-period-end").value;
      const notes = document.getElementById("eval-general-notes").value;

      if (!volId) { showToast("Please select a volunteer", "error"); return; }
      if (!period) { showToast("Please enter a period label", "error"); return; }

      const missing = criteria.filter(c => criterionScores[c.id] === undefined);
      if (missing.length > 0) {
        showToast(`Please rate: ${missing.map(c => App.currentLang === 'ar' ? c.name_ar : c.name_en).join(', ')}`, "error");
        return;
      }

      const scores = criteria.map(c => {
        const row = container.querySelector(`.eval-criterion-row[data-crit-id="${c.id}"]`);
        const comment = row ? row.querySelector(".crit-comment").value.trim() : "";
        return {
          criteriaId: c.id,
          score: criterionScores[c.id],
          comment: comment || undefined,
        };
      });

      const submitBtn = document.getElementById("btn-submit-eval");
      submitBtn.disabled = true;
      const originalText = submitBtn.textContent;
      submitBtn.textContent = "Saving…";

      try {
        await window.AtharAPI.evaluations.create({
          volunteerId: volId,
          periodLabel: period,
          periodStart: periodStart || undefined,
          periodEnd: periodEnd || undefined,
          notes: notes || undefined,
          scores,
        });
        await window.AtharStore.refreshEvaluations();
        showToast(t("saved_successfully"), "success");
        navigateTo("volunteer-profile", { id: volId, sub: "evaluations" });
      } catch (err) {
        if (err.code === "EVALUATION_EXISTS") {
          showToast(`An evaluation already exists for this volunteer in ${period}`, "error");
        } else if (err.code === "MISSING_CRITERIA_SCORES") {
          showToast("Please rate every criterion before saving", "error");
        } else if (err.isValidation && err.details) {
          const firstField = Object.keys(err.details)[0];
          showToast(`${firstField}: ${err.details[firstField]?.[0]}`, "error");
        } else {
          showToast(err.message || "Save failed", "error");
        }
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    };
  }

  // =========================================================
  // Criteria Settings (unchanged)
  // =========================================================
  function renderEvaluationCriteriaSettings(container) {
    if (!hasPermission("evaluation_criteria", "view")) {
      navigateTo("dashboard");
      return;
    }

    const state = window.AtharStore.getState();
    const isSuper = App.currentUser.role === "super_admin";

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('evaluations')">${t("nav_evaluations")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>Settings</span>
          </div>
          <h1 class="view-title">${t("criteria_settings_title")}</h1>
          <p class="view-subtitle">Define scoring criteria and their weights</p>
        </div>
        <div class="view-header-actions">
          ${isSuper ? `<button class="btn btn-primary" id="btn-add-crit">${ic("plus", 14)} ${t("add_criterion")}</button>` : ''}
        </div>
      </div>

      ${state.criteria.length === 0 ? `
        <div class="card" style="text-align:center; padding:48px;">
          <div style="color:var(--neutral-400); margin-bottom:12px;">${ic("sliders", 42, { strokeWidth: 1.5 })}</div>
          <div style="font-weight:700; font-size:16px; margin-bottom:4px;">No criteria yet</div>
          <p style="color:var(--neutral-500); font-size:13px; margin-bottom:16px;">Add criteria to enable volunteer evaluations.</p>
          ${isSuper ? `<button class="btn btn-primary" id="btn-add-crit-empty">${ic("plus", 14)} ${t("add_criterion")}</button>` : ''}
        </div>
      ` : `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Criterion Name (EN)</th>
                <th>Criterion Name (AR)</th>
                <th>Weight</th>
                <th>Active</th>
                ${isSuper ? '<th style="text-align:right;">Actions</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${state.criteria.map((c, idx) => `
                <tr>
                  <td><span class="badge badge-neutral num-ltr">#${c.display_order || idx + 1}</span></td>
                  <td style="font-weight:700;">${c.name_en}</td>
                  <td style="font-weight:700;">${c.name_ar}</td>
                  <td><span class="num-ltr badge badge-primary">${c.weight}x</span></td>
                  <td><span class="badge ${c.is_active ? 'badge-success' : 'badge-danger'}">${c.is_active ? 'Active' : 'Inactive'}</span></td>
                  ${isSuper ? `
                    <td>
                      <div class="row-actions-cell">
                        <button class="btn btn-secondary btn-sm" data-crit-action="edit" data-crit-id="${c.id}">${t("edit")}</button>
                        <button class="btn btn-secondary btn-sm" data-crit-action="toggle" data-crit-id="${c.id}">
                          ${c.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button class="btn btn-danger-outline btn-sm" data-crit-action="delete" data-crit-id="${c.id}">${t("delete")}</button>
                      </div>
                    </td>
                  ` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;

    const openAdd = () => {
      if (window.AtharCriteriaModal && typeof window.AtharCriteriaModal.openAdd === "function") {
        window.AtharCriteriaModal.openAdd();
      } else {
        console.error("[evaluations] AtharCriteriaModal.openAdd is not available");
        showToast("Criteria editor is not available.", "error");
      }
    };

    const addBtn = document.getElementById("btn-add-crit");
    if (addBtn) addBtn.onclick = openAdd;
    const addBtnEmpty = document.getElementById("btn-add-crit-empty");
    if (addBtnEmpty) addBtnEmpty.onclick = openAdd;

    container.querySelectorAll("[data-crit-action]").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-crit-id");
        const action = btn.getAttribute("data-crit-action");
        const M = window.AtharCriteriaModal;
        if (!M) { showToast("Criteria editor is not available.", "error"); return; }
        if (action === "edit" && typeof M.openEdit === "function") M.openEdit(id);
        else if (action === "toggle" && typeof M.toggleActive === "function") M.toggleActive(id);
        else if (action === "delete" && typeof M.delete === "function") M.delete(id);
      };
    });
  }

  window.AtharViews.evaluations = (c, p) => renderEvaluationsList(c);
  window.AtharViews.newEvaluation = (c, p) => renderNewEvaluationForm(c, p.id);
  window.AtharViews.evaluationCriteria = (c, p) => renderEvaluationCriteriaSettings(c);
})();