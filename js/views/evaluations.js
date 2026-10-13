/**
 * View: Evaluations (list + new form + criteria settings)
 */
(function () {
  "use strict";

  const { App, t, formatDate, ic, showToast, hasPermission, navigateTo } = window.AtharCore;

  function renderEvaluationsList(container) {
    const state = window.AtharStore.getState();
    const canCreate = hasPermission("evaluations", "create");

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
          ${canCreate ? `<button class="btn btn-primary" id="btn-add-eval">${ic("plus", 14)} ${t("add_evaluation")}</button>` : ''}
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Volunteer</th>
              <th>Period</th>
              <th>Overall Score</th>
              <th>Evaluator</th>
              <th>Date</th>
              <th>Notes</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${state.evaluations.map(ev => {
              const vol = state.volunteers.find(v => v.id === ev.volunteer_id);
              const user = state.users.find(u => u.id === ev.evaluator_id);
              return `
                <tr>
                  <td style="font-weight:700; cursor:pointer;" onclick="window.AtharApp.navigateTo('volunteer-profile', {id:'${ev.volunteer_id}', sub:'evaluations'})">
                    ${vol ? (App.currentLang === 'ar' ? (vol.full_name_ar || vol.full_name) : vol.full_name) : 'Volunteer'}
                  </td>
                  <td><span class="badge badge-primary">${ev.period_label}</span></td>
                  <td><span style="font-weight:800; color:#F59E0B; font-size:14px;">${ev.overall_score} / 5.0</span></td>
                  <td>${user ? user.full_name : 'Super Admin'}</td>
                  <td class="num-ltr">${formatDate(ev.evaluated_at)}</td>
                  <td style="font-size:12px; color:var(--neutral-600); max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${ev.notes || '—'}</td>
                  <td>
                    <div class="row-actions-cell">
                      <button class="btn btn-secondary btn-sm" onclick="window.AtharApp.navigateTo('volunteer-profile', {id:'${ev.volunteer_id}', sub:'evaluations'})">${t("view")}</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    const addBtn = document.getElementById("btn-add-eval");
    if (addBtn) addBtn.onclick = () => navigateTo("new-evaluation");
  }

  function renderNewEvaluationForm(container, preSelectedVolId) {
    const state = window.AtharStore.getState();
    const criteria = state.criteria.filter(c => c.is_active);
    const activeVols = state.volunteers.filter(v => v.status !== "archived");

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

      <div class="card" style="max-width: 800px; margin: 0 auto;">
        <form id="new-eval-form">
          <div class="form-grid" style="margin-bottom:20px;">
            <div class="form-field">
              <label class="field-label">${t("volunteer_name")} <span class="required-asterisk">*</span></label>
              <select class="form-control" id="eval-vol-select" required>
                <option value="">${t("select_all")}...</option>
                ${activeVols.map(v => `<option value="${v.id}" ${preSelectedVolId === v.id ? 'selected' : ''}>${App.currentLang === 'ar' ? (v.full_name_ar || v.full_name) : v.full_name}</option>`).join('')}
              </select>
            </div>
            <div class="form-field">
              <label class="field-label">${t("period")} <span class="required-asterisk">*</span></label>
              <select class="form-control" id="eval-period-select" required>
                <option value="2026-Q1">2026 - Q1</option>
                <option value="2026-Q2">2026 - Q2</option>
                <option value="2026-Q3">2026 - Q3</option>
                <option value="2026-Q4" selected>2026 - Q4</option>
              </select>
            </div>
          </div>

          <h3 style="font-size:15px; margin-bottom:14px; border-bottom:1px solid var(--neutral-300); padding-bottom:8px;">${t("criteria")} Ratings (1 to 5 Stars)</h3>

          <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:24px;">
            ${criteria.map(c => `
              <div class="eval-criterion-row" data-crit-id="${c.id}" data-weight="${c.weight}" style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--neutral-50); border:1px solid var(--neutral-300); border-radius:var(--radius-md);">
                <div>
                  <div style="font-weight:700; color:var(--neutral-900);">${App.currentLang === 'ar' ? c.name_ar : c.name_en}</div>
                  <div style="font-size:11px; color:var(--neutral-500);">Weight: ${c.weight}x</div>
                </div>
                <div style="display:flex; align-items:center; gap:16px;">
                  <div class="star-rating" data-crit-id="${c.id}">
                    <span class="star filled" data-score="1">★</span>
                    <span class="star filled" data-score="2">★</span>
                    <span class="star filled" data-score="3">★</span>
                    <span class="star filled" data-score="4">★</span>
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
              <div style="font-size:12px; color:var(--neutral-600);">Weighted average based on assigned criterion priorities</div>
            </div>
            <div id="live-overall-score" style="font-size:28px; font-weight:800; color:var(--primary);" class="num-ltr">4.0 / 5.0</div>
          </div>

          <div class="form-field" style="margin-bottom:24px;">
            <label class="field-label">${t("notes")}</label>
            <textarea id="eval-general-notes" class="form-control" rows="3" placeholder="Executive assessment and feedback remarks..."></textarea>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:12px;">
            <button type="button" class="btn btn-secondary" onclick="window.AtharApp.navigateTo('evaluations')">${t("cancel")}</button>
            <button type="submit" class="btn btn-primary">${t("save")}</button>
          </div>
        </form>
      </div>
    `;

    if (window.AtharDirty) {
      const evalFormEl = document.getElementById("new-eval-form");
      if (evalFormEl) window.AtharDirty.track(evalFormEl);
    }

    const criterionScores = {};
    criteria.forEach(c => criterionScores[c.id] = 4);

    function recalculateOverall() {
      let sum = 0, totalW = 0;
      criteria.forEach(c => {
        const sc = criterionScores[c.id] || 4;
        sum += sc * c.weight;
        totalW += c.weight;
      });
      const avg = (sum / totalW).toFixed(2);
      document.getElementById("live-overall-score").textContent = `${avg} / 5.0`;
      return Number(avg);
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

    document.getElementById("new-eval-form").onsubmit = (e) => {
      e.preventDefault();
      if (window.AtharDirty) window.AtharDirty.beginSubmit();

      const volId = document.getElementById("eval-vol-select").value;
      const period = document.getElementById("eval-period-select").value;
      const notes = document.getElementById("eval-general-notes").value;

      if (!volId) { showToast(t("error_required_fields"), "error"); return; }

      const existing = state.evaluations.find(ev => ev.volunteer_id === volId && ev.period_label === period);
      if (existing) {
        showToast("An evaluation already exists for this volunteer in period " + period, "error");
        return;
      }

      const evalId = "eval-" + window.AtharStore.generateUUID().substring(0, 8);
      const overall = recalculateOverall();

      criteria.forEach(c => {
        const row = container.querySelector(`.eval-criterion-row[data-crit-id="${c.id}"]`);
        const comment = row ? row.querySelector(".crit-comment").value : "";
        state.evaluation_scores.push({
          id: window.AtharStore.generateUUID(),
          evaluation_id: evalId,
          criteria_id: c.id,
          score: criterionScores[c.id] || 4,
          comment: comment
        });
      });

      const newEval = {
        id: evalId,
        volunteer_id: volId,
        evaluator_id: App.currentUser.id,
        period_label: period,
        period_start: "2026-10-01",
        period_end: "2026-12-31",
        overall_score: overall,
        notes: notes,
        evaluated_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
        updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
      };

      state.evaluations.unshift(newEval);
      window.AtharStore.save();
      const vol = state.volunteers.find(v => v.id === volId);
      window.AtharStore.logAudit(App.currentUser, "create", "evaluation", evalId, `Created evaluation for ${vol ? vol.full_name : volId} (${period}): ${overall}/5.0`, null, newEval);

      if (window.AtharDirty) window.AtharDirty.clear();
      showToast(t("saved_successfully"), "success");
      navigateTo("volunteer-profile", { id: volId, sub: "evaluations" });
    };
  }

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
          <p class="view-subtitle">Super Admin only: customize evaluation criteria metrics & weight ratios</p>
        </div>
        <div class="view-header-actions">
          ${isSuper ? `<button class="btn btn-primary" id="btn-add-crit">${ic("plus", 14)} ${t("add_criterion")}</button>` : ''}
        </div>
      </div>

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
                      <button class="btn btn-secondary btn-sm" onclick="window.AtharApp.openEditCriterionModal && window.AtharApp.openEditCriterionModal('${c.id}')">${t("edit")}</button>
                      <button class="btn btn-danger-outline btn-sm" onclick="window.AtharApp.toggleCriterionActive && window.AtharApp.toggleCriterionActive('${c.id}')">
                        ${c.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                ` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const addBtn = document.getElementById("btn-add-crit");
    if (addBtn && window.AtharApp.openAddCriterionModal) {
      addBtn.onclick = () => window.AtharApp.openAddCriterionModal();
    }
  }

  window.AtharViews.evaluations = (c, p) => renderEvaluationsList(c);
  window.AtharViews.newEvaluation = (c, p) => renderNewEvaluationForm(c, p.id);
  window.AtharViews.evaluationCriteria = (c, p) => renderEvaluationCriteriaSettings(c);
})();
