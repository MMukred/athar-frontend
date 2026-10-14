/**
 * Athar — Evaluation Criteria Modal
 * Super Admin only: create/edit/toggle/delete criteria.
 * Attaches to window.AtharApp.
 */

(function () {
    "use strict";

    const { App, t, ic, showToast, showConfirmModal } = window.AtharCore;

    function openCriterionModal(criterionId) {
        criterionId = criterionId || null;

        if (App.currentUser.role !== "super_admin") {
            showToast(t("permission_denied"), "error");
            return;
        }

        const state = window.AtharStore.getState();
        const existing = criterionId ? state.criteria.find((c) => c.id === criterionId) : null;
        const isEdit = !!existing;

        const modal = document.getElementById("modal-container");
        modal.innerHTML = `
      <div class="overlay-backdrop" id="crit-backdrop">
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 class="modal-title">${ic("sliders", 18)} ${isEdit ? t("edit") : t("add_criterion")}</h3>
            <button class="btn-icon" id="crit-close">&times;</button>
          </div>
          <form id="crit-form">
            <div class="modal-body" style="display:flex; flex-direction:column; gap:16px;">
              <div class="form-field">
                <label class="field-label">${t("criterion_name_en")} <span class="required-asterisk">*</span></label>
                <input type="text" id="crit-name-en" class="form-control" required
                       value="${existing ? (existing.name_en || '') : ''}">
              </div>
              <div class="form-field">
                <label class="field-label">${t("criterion_name_ar")} <span class="required-asterisk">*</span></label>
                <input type="text" id="crit-name-ar" class="form-control" required
                       value="${existing ? (existing.name_ar || '') : ''}">
              </div>
              <div class="form-grid">
                <div class="form-field">
                  <label class="field-label">${t("weight")} <span class="required-asterisk">*</span></label>
                  <input type="number" step="0.1" min="0.1" max="10" id="crit-weight"
                         class="form-control" required value="${existing ? existing.weight : 1.0}">
                  <span class="field-hint">1.0 = normal, 1.5 = more important, 0.5 = less</span>
                </div>
                <div class="form-field">
                  <label class="field-label">${t("display_order")}</label>
                  <input type="number" min="0" id="crit-order" class="form-control"
                         value="${existing ? existing.display_order : (state.criteria.length + 1)}">
                </div>
              </div>
              <div class="form-field">
                <label class="field-label" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                  <input type="checkbox" id="crit-active" ${!existing || existing.is_active ? "checked" : ""}>
                  Active (appears in new evaluations)
                </label>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="crit-cancel">${t("cancel")}</button>
              <button type="submit" class="btn btn-primary">${t("save")}</button>
            </div>
          </form>
        </div>
      </div>
    `;

        const close = () => { modal.innerHTML = ""; };
        document.getElementById("crit-close").onclick = close;
        document.getElementById("crit-cancel").onclick = close;
        document.getElementById("crit-backdrop").onclick = (e) => {
            if (e.target.id === "crit-backdrop") close();
        };

        document.getElementById("crit-form").onsubmit = async (e) => {
            e.preventDefault();
            const payload = {
                nameEn: document.getElementById("crit-name-en").value.trim(),
                nameAr: document.getElementById("crit-name-ar").value.trim(),
                weight: Number(document.getElementById("crit-weight").value),
                displayOrder: Number(document.getElementById("crit-order").value),
                isActive: document.getElementById("crit-active").checked,
            };

            if (!payload.nameEn || !payload.nameAr) {
                showToast(t("error_required_fields"), "error");
                return;
            }

            const submitBtn = e.target.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;

            try {
                if (isEdit) {
                    await window.AtharAPI.criteria.update(existing.id, payload);
                    showToast(t("updated_successfully"), "success");
                } else {
                    await window.AtharAPI.criteria.create(payload);
                    showToast(t("saved_successfully"), "success");
                }
                await window.AtharStore.refreshCriteria();
                close();
                window.AtharCore.renderCurrentView();
            } catch (err) {
                showToast(err.message || "Save failed", "error");
                if (submitBtn) submitBtn.disabled = false;
            }
        };

        setTimeout(() => document.getElementById("crit-name-en").focus(), 100);
    }

    async function toggleCriterionActive(criterionId) {
        if (App.currentUser.role !== "super_admin") {
            showToast(t("permission_denied"), "error");
            return;
        }

        const state = window.AtharStore.getState();
        const c = state.criteria.find((x) => x.id === criterionId);
        if (!c) return;

        try {
            await window.AtharAPI.criteria.update(criterionId, { isActive: !c.is_active });
            await window.AtharStore.refreshCriteria();
            showToast(c.is_active ? "Criterion deactivated" : "Criterion activated", "success");
            window.AtharCore.renderCurrentView();
        } catch (err) {
            showToast(err.message || "Update failed", "error");
        }
    }

    function deleteCriterion(criterionId) {
        if (App.currentUser.role !== "super_admin") {
            showToast(t("permission_denied"), "error");
            return;
        }

        const state = window.AtharStore.getState();
        const c = state.criteria.find((x) => x.id === criterionId);
        if (!c) return;

        showConfirmModal({
            title: t("confirm_destructive"),
            message: `Delete criterion "${c.name_en}"? Only possible if not used in any evaluation.`,
            confirmText: t("delete"),
            onConfirm: async () => {
                try {
                    await window.AtharAPI.criteria.delete(criterionId);
                    await window.AtharStore.refreshCriteria();
                    showToast("Criterion deleted", "warning");
                    window.AtharCore.renderCurrentView();
                } catch (err) {
                    if (err.code === "CRITERION_IN_USE") {
                        showToast("Cannot delete — used in evaluations. Deactivate instead.", "error");
                    } else {
                        showToast(err.message || "Delete failed", "error");
                    }
                }
            },
        });
    }

    // Attach to global app API
    window.AtharApp = window.AtharApp || {};
    window.AtharApp.openAddCriterionModal = () => openCriterionModal(null);
    window.AtharApp.openEditCriterionModal = (id) => openCriterionModal(id);
    window.AtharApp.toggleCriterionActive = toggleCriterionActive;
    window.AtharApp.deleteCriterion = deleteCriterion;
})();