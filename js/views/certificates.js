/**
 * View: Certificates (list + generate + public verify)
 */
(function () {
  "use strict";

  const { App, t, formatDate, ic, showToast, hasPermission, navigateTo } = window.AtharCore;

  // =========================================================================
  // Certificates List
  // =========================================================================
  function renderCertificatesList(container) {
    const state = window.AtharStore.getState();
    const canCreate = hasPermission("certificates", "create");
    const isSuper = (App.currentUser && App.currentUser.role === "super_admin");

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('dashboard')">${t("app_name")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${t("nav_certificates")}</span>
          </div>
          <h1 class="view-title">${t("certificates_title")}</h1>
          <p class="view-subtitle">Official verifiable credentials with QR codes and tamper verification</p>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-secondary btn-sm" onclick="window.AtharApp.navigateTo('public-verify')">${ic("qr_code", 14)} Public Verification</button>
          ${canCreate ? `<button class="btn btn-primary" id="btn-add-cert">${ic("award", 14)} ${t("generate_certificate")}</button>` : ''}
        </div>
      </div>

      ${state.certificates.length === 0 ? `
        <div class="card" style="text-align:center; padding:48px;">
          <div style="color:var(--neutral-400); margin-bottom:12px;">${ic("award", 42, { strokeWidth: 1.5 })}</div>
          <div style="font-weight:700; font-size:16px; margin-bottom:4px;">No certificates yet</div>
          <p style="color:var(--neutral-500); font-size:13px;">Generate your first certificate for a volunteer with approved hours.</p>
          <p class="empty-state-hint">Tip: a volunteer needs ≥ the configured approved hours (Settings) and no active certificate.</p>
        </div>
      ` : `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Certificate No.</th>
                <th>Volunteer</th>
                <th>Approved Hours</th>
                <th>Issue Date</th>
                <th>Language</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${state.certificates.map(cert => {
      const vol = state.volunteers.find(v => v.id === cert.volunteer_id);
      const isDraft = cert.status === 'draft';
      const isIssued = cert.status === 'issued';
      const isRevoked = cert.status === 'revoked';
      return `
                  <tr class="cert-status-${cert.status}">
                    <td>
                      <span class="cert-no" style="color:${isDraft ? 'var(--neutral-500)' : 'var(--primary)'};">
                        ${cert.certificate_no || 'DRAFT (Unassigned)'}
                      </span>
                    </td>
                    <td>
                      <div style="font-weight:700; cursor:pointer;" onclick="window.AtharApp.navigateTo('volunteer-profile', {id:'${cert.volunteer_id}'})">
                        ${vol ? (App.currentLang === 'ar' ? (vol.full_name_ar || vol.full_name) : vol.full_name) : 'Volunteer'}
                      </div>
                    </td>
                    <td><span class="cert-hours-chip">${cert.total_hours} h</span></td>
                    <td>${formatDate(cert.issue_date)}</td>
                    <td><span class="badge badge-neutral">${(cert.language || 'ar').toUpperCase()}</span></td>
                    <td>
                      <span class="badge ${isIssued ? 'badge-success' : isDraft ? 'badge-warning' : 'badge-danger'}">${t(cert.status)}</span>
                      ${cert.revoked_reason ? `<div style="font-size:10px; color:var(--danger); max-width:180px; margin-top:2px;">${cert.revoked_reason}</div>` : ''}
                    </td>
                    <td>
                      <div class="row-actions-cell">
                        <button class="btn btn-secondary btn-sm" data-cert-action="open" data-cert-id="${cert.id}">
                          ${t("view")}
                        </button>
                        ${isIssued ? `
                          <button class="btn btn-secondary btn-sm" data-cert-action="pdf" data-cert-id="${cert.id}" title="Download PDF">
                            ${ic("download", 12)} PDF
                          </button>
                        ` : ''}
                        ${isIssued && vol && vol.whatsapp ? `
                          <button class="btn btn-whatsapp btn-sm" onclick="window.AtharApp.sendCertWhatsApp('${cert.id}')">
                            ${ic("whatsapp", 12)} Send
                          </button>
                        ` : ''}
                        ${isSuper && isIssued ? `
                          <button class="btn btn-danger-outline btn-sm" onclick="window.AtharModals.openRevokeCertModal('${cert.id}')">
                            ${ic("x_circle", 14)} ${t("revoke_certificate")}
                          </button>
                        ` : ''}
                        ${isDraft && isSuper ? `
                          <button class="btn btn-primary btn-sm" data-cert-action="approve" data-cert-id="${cert.id}">
                            ${ic("award", 12)} ${t("approve_and_issue")}
                          </button>
                        ` : ''}
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

    const addBtn = document.getElementById("btn-add-cert");
    if (addBtn) addBtn.onclick = () => navigateTo("generate-certificate");

    // Wire row actions
    container.querySelectorAll("[data-cert-action]").forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute("data-cert-id");
        const action = btn.getAttribute("data-cert-action");

        if (action === "open") {
          const cert = state.certificates.find(c => c.id === id);
          if (cert) navigateTo("generate-certificate", { id: cert.volunteer_id, sub: cert.id });
          return;
        }

        if (action === "pdf") {
          btn.disabled = true;
          const orig = btn.innerHTML;
          btn.innerHTML = "…";
          try {
            await window.AtharAPI.certificates.openPdfInNewTab(id);
          } catch (err) {
            showToast(err.message || "Failed to open PDF", "error");
          } finally {
            btn.disabled = false;
            btn.innerHTML = orig;
          }
          return;
        }

        if (action === "approve") {
          btn.disabled = true;
          const orig = btn.innerHTML;
          btn.innerHTML = "Issuing…";
          try {
            const issued = await window.AtharAPI.certificates.approve(id);
            await window.AtharStore.refreshCertificates();
            showToast(`${t("cert_issued_successfully")} (${issued.certificate_no})`, "success");
            renderCertificatesList(container);
          } catch (err) {
            if (err.code === "ALREADY_ISSUED") {
              showToast("This certificate is already issued", "warning");
            } else if (err.code === "REVOKED") {
              showToast("Cannot re-issue a revoked certificate", "error");
            } else {
              showToast(err.message || "Approval failed", "error");
            }
            btn.disabled = false;
            btn.innerHTML = orig;
          }
          return;
        }
      };
    });
  }

  // =========================================================================
  // Generate Certificate (create draft / approve & issue / download PDF)
  // =========================================================================
  function renderGenerateCertificate(container, volunteerId, certId) {
    const state = window.AtharStore.getState();
    const isSuper = (App.currentUser && App.currentUser.role === "super_admin");
    const canCreate = hasPermission("certificates", "create");

    const existingCert = certId ? state.certificates.find(c => c.id === certId) : null;
    const isDraft = existingCert && existingCert.status === "draft";
    const isIssued = existingCert && existingCert.status === "issued";
    const isRevoked = existingCert && existingCert.status === "revoked";

    // Current form state (initialized from existing cert, or defaults)
    let targetVolId = volunteerId
      || (existingCert ? existingCert.volunteer_id : null)
      || (state.volunteers[0] && state.volunteers[0].id)
      || null;
    let certLang = existingCert ? existingCert.language : (App.currentLang === "ar" ? "ar" : "en");
    let startDate = existingCert ? existingCert.period_start : "2025-01-01";
    let endDate = existingCert ? existingCert.period_end : new Date().toISOString().slice(0, 10);

    // ---- Compute preview hours from cache (instant feedback; server computes actual value) ----
    function computeApprovedHours(vId, sDate, eDate) {
      return state.volunteer_hours
        .filter(h => h.volunteer_id === vId && h.status === "approved"
          && (!sDate || h.date >= sDate) && (!eDate || h.date <= eDate))
        .reduce((sum, h) => sum + Number(h.hours), 0);
    }

    function render() {
      const vol = state.volunteers.find(v => v.id === targetVolId);
      const comm = vol ? state.committees.find(c => c.id === vol.committee_id) : null;
      const hoursVal = existingCert
        ? existingCert.total_hours
        : computeApprovedHours(targetVolId, startDate, endDate);
      const certNumber = existingCert ? (existingCert.certificate_no || "DRAFT (Unassigned)") : "DRAFT (Unassigned)";
      const qrSvg = window.generateQRCodeSVG(
        (existingCert && existingCert.qr_code) ||
          `${window.location.origin}${window.location.pathname}#public-verify/${certNumber}`,
        100,
      );

      container.innerHTML = `
        <div class="view-header">
          <div class="view-header-left">
            <div class="breadcrumb-trail">
              <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('certificates')">${t("nav_certificates")}</span>
              <span class="breadcrumb-separator">/</span>
              <span>${existingCert ? (existingCert.certificate_no || "Draft Preview") : t("generate_certificate")}</span>
            </div>
            <h1 class="view-title">${t("generate_certificate")}</h1>
            ${existingCert ? `
              <p class="view-subtitle">
                Status: <span class="badge ${isIssued ? 'badge-success' : isDraft ? 'badge-warning' : 'badge-danger'}">${t(existingCert.status)}</span>
                ${isIssued ? `&bull; Number: <code>${existingCert.certificate_no}</code>` : ''}
              </p>
            ` : ''}
          </div>
          <div class="view-header-actions">
            ${isIssued ? `
              <button class="btn btn-secondary" id="btn-open-pdf">${ic("printer", 14)} ${t("print")} / ${t("export_pdf")}</button>
              <button class="btn btn-primary" id="btn-download-pdf">${ic("download", 14)} Download</button>
            ` : `
              <button class="btn btn-secondary" id="btn-preview-print">${ic("printer", 14)} Print Preview</button>
            `}
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 360px 1fr; gap:24px; align-items:start;">
          <div class="card">
            <h3 style="font-size:15px; margin-bottom:14px; border-bottom:1px solid var(--neutral-300); padding-bottom:8px;">Configuration</h3>

            <div class="form-field" style="margin-bottom:14px;">
              <label class="field-label">${t("volunteer_name")}</label>
              <select class="form-control" id="cert-vol-select" ${existingCert ? 'disabled' : ''}>
                ${state.volunteers.filter(v => v.status !== 'archived').map(v => `
                  <option value="${v.id}" ${v.id === targetVolId ? 'selected' : ''}>
                    ${App.currentLang === 'ar' ? (v.full_name_ar || v.full_name) : v.full_name}
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-field" style="margin-bottom:14px;">
              <label class="field-label">Period Range</label>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <input type="date" id="cert-start-date" class="form-control" value="${startDate}" ${existingCert ? 'disabled' : ''}>
                <input type="date" id="cert-end-date" class="form-control" value="${endDate}" ${existingCert ? 'disabled' : ''}>
              </div>
            </div>

            <div class="form-field" style="margin-bottom:14px;">
              <label class="field-label">Certificate Language</label>
              <div style="display:flex; gap:16px; margin-top:4px;">
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer; ${existingCert ? 'opacity:0.6;' : ''}">
                  <input type="radio" name="cert-lang" value="ar" ${certLang === 'ar' ? 'checked' : ''} ${existingCert ? 'disabled' : ''}> العربية
                </label>
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer; ${existingCert ? 'opacity:0.6;' : ''}">
                  <input type="radio" name="cert-lang" value="en" ${certLang === 'en' ? 'checked' : ''} ${existingCert ? 'disabled' : ''}> English
                </label>
              </div>
            </div>

            <div style="padding:12px; background:var(--neutral-100); border-radius:var(--radius-md); margin-bottom:18px;">
              <div style="font-size:12px; color:var(--neutral-500);">
                ${t("kpi_total_hours")} ${existingCert ? '(server-computed)' : '(preview — server recomputes on save)'}
              </div>
              <div style="font-size:20px; font-weight:800; color:${hoursVal > 0 ? 'var(--success)' : 'var(--danger)'};"
                   class="num-ltr" id="cert-live-hours-display">${hoursVal} hours</div>
              ${hoursVal === 0 ? `
                <div style="font-size:11px; color:var(--danger); margin-top:2px;">
                  Warning: Volunteer has 0 approved hours in this range.
                </div>
              ` : ''}
            </div>

            <div style="display:flex; flex-direction:column; gap:10px;">
              ${!existingCert ? `
                ${canCreate ? `<button class="btn btn-secondary" id="btn-save-draft">${t("save_draft")}</button>` : ''}
                ${isSuper ? `<button class="btn btn-primary" id="btn-approve-issue">${ic("award", 14)} ${t("approve_and_issue")}</button>` : `
                  <div style="font-size:11px; color:var(--neutral-500); text-align:center;">
                    Only Super Admin can approve & issue official certificate numbers.
                  </div>
                `}
              ` : isDraft ? `
                ${isSuper ? `<button class="btn btn-primary" id="btn-approve-issue">${ic("award", 14)} ${t("approve_and_issue")}</button>` : `
                  <div style="font-size:11px; color:var(--neutral-500); text-align:center;">
                    This draft is awaiting Super Admin approval.
                  </div>
                `}
                ${isSuper || canCreate ? `<button class="btn btn-danger-outline btn-sm" id="btn-delete-draft">Delete Draft</button>` : ''}
              ` : isIssued ? `
                <div class="badge badge-success" style="justify-content:center; padding:8px;">
                  Issued: ${existingCert.certificate_no}
                </div>
              ` : `
                <div class="badge badge-danger" style="justify-content:center; padding:8px;">
                  Revoked
                </div>
              `}
            </div>
          </div>

          <div id="printable-certificate-document">
            <div class="cert-preview-card" dir="${certLang === 'ar' ? 'rtl' : 'ltr'}">
              <div class="cert-corner-ornament cert-corner-tl"></div>
              <div class="cert-corner-ornament cert-corner-tr"></div>
              <div class="cert-corner-ornament cert-corner-bl"></div>
              <div class="cert-corner-ornament cert-corner-br"></div>
              <div class="cert-header">
                <img src="assets/logo.svg" alt="Athar" class="cert-logo">
                <div class="cert-org-name">${certLang === 'ar' ? state.settings.org_name_ar : state.settings.org_name_en}</div>
                <h2 class="cert-title">${certLang === 'ar' ? 'شهادة شكر وتقدير للعمل التطوعي' : 'Certificate of Volunteer Service'}</h2>
              </div>
              <div class="cert-body">
                <p>${certLang === 'ar' ? 'تشهد مؤسسة أثر للعمل المجتمعي بأن المتطوع المتميز:' : 'This is to officially certify that:'}</p>
                <div class="cert-volunteer-name" id="cert-preview-name">
                  ${vol ? (certLang === 'ar' ? (vol.full_name_ar || vol.full_name) : vol.full_name) : 'Volunteer Name'}
                </div>
                <p>
                  ${certLang === 'ar' ? `
                    قد أتم بنجاح وتفانٍ <span class="cert-highlight num-ltr" id="cert-preview-hours">${hoursVal}</span> ساعة من الخدمة التطوعية الفاعلة مع
                    <span class="cert-highlight">${comm ? comm.name_ar : 'مؤسسة أثر'}</span>
                    خلال الفترة من <span class="num-ltr">${formatDate(startDate)}</span> إلى <span class="num-ltr">${formatDate(endDate)}</span>.
                  ` : `
                    has passionately and successfully completed <span class="cert-highlight num-ltr" id="cert-preview-hours">${hoursVal}</span> hours of distinguished volunteer service with
                    <span class="cert-highlight">${comm ? comm.name_en : 'Athar Foundation'}</span>
                    from <span class="num-ltr">${formatDate(startDate)}</span> to <span class="num-ltr">${formatDate(endDate)}</span>.
                  `}
                </p>
                <p style="font-size:13px; color:var(--neutral-500); margin-top:12px;">
                  ${certLang === 'ar'
          ? 'تقديراً لعطائه وتفانيه في خدمة المجتمع، راجين له دوام التوفيق والتميز.'
          : 'In sincere recognition of exemplary commitment and inspiring contribution to our society.'}
                </p>
              </div>
              <div class="cert-footer">
                <div class="cert-sig-box">
                  <div class="cert-signature-line"></div>
                  <div class="cert-sig-name">${certLang === 'ar' ? state.settings.signatory_name_ar : state.settings.signatory_name_en}</div>
                  <div class="cert-sig-title">${certLang === 'ar' ? state.settings.signatory_title_ar : state.settings.signatory_title_en}</div>
                </div>
                <div class="cert-seal-box">
                  <div class="cert-seal-badge">ATHAR<br>OFFICIAL<br>SEAL</div>
                </div>
                <div class="cert-qr-box">
                  <div id="cert-qr-container">${qrSvg}</div>
                  <div class="cert-no-label" id="cert-preview-no">${certNumber}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      wireEvents();
    }

    function wireEvents() {
      const volSelect = document.getElementById("cert-vol-select");
      const startInp = document.getElementById("cert-start-date");
      const endInp = document.getElementById("cert-end-date");

      if (volSelect && !volSelect.disabled) {
        volSelect.onchange = () => { targetVolId = volSelect.value; render(); };
      }
      if (startInp && !startInp.disabled) {
        startInp.onchange = () => { startDate = startInp.value; render(); };
      }
      if (endInp && !endInp.disabled) {
        endInp.onchange = () => { endDate = endInp.value; render(); };
      }

      container.querySelectorAll("input[name='cert-lang']").forEach(r => {
        if (r.disabled) return;
        r.onchange = () => { certLang = r.value; render(); };
      });

      // ---- Save Draft → API ----
      const saveDraftBtn = document.getElementById("btn-save-draft");
      if (saveDraftBtn) {
        saveDraftBtn.onclick = async () => {
          if (!targetVolId) { showToast("Please select a volunteer", "error"); return; }
          if (startDate > endDate) { showToast("Period start must be before end", "error"); return; }

          saveDraftBtn.disabled = true;
          const orig = saveDraftBtn.textContent;
          saveDraftBtn.textContent = "Saving…";

          try {
            const created = await window.AtharAPI.certificates.create({
              volunteerId: targetVolId,
              periodStart: startDate,
              periodEnd: endDate,
              language: certLang,
            });
            await window.AtharStore.refreshCertificates();
            showToast(`Draft saved (${created.total_hours} hours)`, "success");
            navigateTo("certificates");
          } catch (err) {
            if (err.code === "NO_APPROVED_HOURS") {
              showToast(t("error_no_hours"), "error");
            } else if (err.code === "VOLUNTEER_ARCHIVED") {
              showToast("This volunteer is archived.", "error");
            } else {
              showToast(err.message || "Failed to save draft", "error");
            }
            saveDraftBtn.disabled = false;
            saveDraftBtn.textContent = orig;
          }
        };
      }

      // ---- Approve & Issue → API ----
      const approveBtn = document.getElementById("btn-approve-issue");
      if (approveBtn) {
        approveBtn.onclick = async () => {
          approveBtn.disabled = true;
          const orig = approveBtn.innerHTML;
          approveBtn.innerHTML = "Issuing…";

          try {
            let certIdToApprove = existingCert ? existingCert.id : null;

            // If no draft exists yet, create one first
            if (!certIdToApprove) {
              if (!targetVolId) { showToast("Please select a volunteer", "error"); throw new Error("no-volunteer"); }
              const created = await window.AtharAPI.certificates.create({
                volunteerId: targetVolId,
                periodStart: startDate,
                periodEnd: endDate,
                language: certLang,
              });
              certIdToApprove = created.id;
            }

            // Approve → server allocates number + generates PDF
            const issued = await window.AtharAPI.certificates.approve(certIdToApprove);
            await window.AtharStore.refreshCertificates();

            showToast(`${t("cert_issued_successfully")} (${issued.certificate_no})`, "success");
            navigateTo("certificates");
          } catch (err) {
            if (err.message === "no-volunteer") {
              approveBtn.disabled = false;
              approveBtn.innerHTML = orig;
              return;
            }
            if (err.code === "NO_APPROVED_HOURS") {
              showToast(t("error_no_hours"), "error");
            } else if (err.code === "ALREADY_ISSUED") {
              showToast("This certificate is already issued", "warning");
            } else if (err.code === "REVOKED") {
              showToast("Cannot re-issue a revoked certificate", "error");
            } else if (err.status === 403) {
              showToast("Only Super Admin can issue certificates.", "error");
            } else {
              showToast(err.message || "Failed to issue certificate", "error");
            }
            approveBtn.disabled = false;
            approveBtn.innerHTML = orig;
          }
        };
      }

      // ---- Delete Draft ----
      const deleteBtn = document.getElementById("btn-delete-draft");
      if (deleteBtn) {
        deleteBtn.onclick = () => {
          window.AtharCore.showConfirmModal({
            title: t("confirm_destructive"),
            message: "Delete this draft certificate? This cannot be undone.",
            confirmText: t("delete"),
            onConfirm: async () => {
              try {
                await window.AtharAPI.certificates.delete(existingCert.id);
                await window.AtharStore.refreshCertificates();
                showToast("Draft deleted", "warning");
                navigateTo("certificates");
              } catch (err) {
                if (err.code === "NOT_DRAFT") {
                  showToast("Only drafts can be deleted.", "error");
                } else {
                  showToast(err.message || "Delete failed", "error");
                }
              }
            },
          });
        };
      }

      // ---- PDF actions (issued certs only) ----
      const openPdfBtn = document.getElementById("btn-open-pdf");
      if (openPdfBtn) {
        openPdfBtn.onclick = async () => {
          openPdfBtn.disabled = true;
          const orig = openPdfBtn.innerHTML;
          openPdfBtn.innerHTML = "Opening…";
          try {
            await window.AtharAPI.certificates.openPdfInNewTab(existingCert.id);
          } catch (err) {
            showToast(err.message || "Failed to open PDF", "error");
          } finally {
            openPdfBtn.disabled = false;
            openPdfBtn.innerHTML = orig;
          }
        };
      }

      const downloadPdfBtn = document.getElementById("btn-download-pdf");
      if (downloadPdfBtn) {
        downloadPdfBtn.onclick = async () => {
          downloadPdfBtn.disabled = true;
          const orig = downloadPdfBtn.innerHTML;
          downloadPdfBtn.innerHTML = "Downloading…";
          try {
            const blob = await window.AtharAPI.certificates.downloadPdfBlob(existingCert.id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${existingCert.certificate_no || "certificate"}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          } catch (err) {
            showToast(err.message || "Download failed", "error");
          } finally {
            downloadPdfBtn.disabled = false;
            downloadPdfBtn.innerHTML = orig;
          }
        };
      }

      // ---- Print preview (drafts / no cert yet) ----
      const previewPrintBtn = document.getElementById("btn-preview-print");
      if (previewPrintBtn) {
        previewPrintBtn.onclick = () => {
          window.ExportUtil.printElement("printable-certificate-document", "Certificate Preview");
        };
      }
    }

    render();
  }

  // =========================================================================
  // Public Verification — reads from the public API so it also works for
  // anonymous visitors (certificate QR scans / shared links).
  // =========================================================================
  function verifyEsc(v) {
    return window.AtharCore.escapeHtml(String(v == null ? "" : v));
  }

  function verifyCertName(cert) {
    const ar = App.currentLang === "ar";
    const vol = cert.volunteer || {};
    const name = ar ? (vol.fullNameAr || vol.fullName) : (vol.fullName || vol.fullNameAr);
    return name || t("verify_unknown");
  }

  function verifyCommitteeName(cert) {
    const ar = App.currentLang === "ar";
    const c = cert.committee;
    if (!c) return t("verify_unknown");
    return (ar ? (c.nameAr || c.nameEn) : (c.nameEn || c.nameAr)) || t("verify_unknown");
  }

  function verifyResultHtml(result) {
    const phase = (result && result.phase) || "idle";

    if (phase === "loading") {
      return `
        <div class="card" style="text-align:center; padding:36px;">
          <div class="skeleton-row" style="width:56%; margin:0 auto 10px;"></div>
          <div class="skeleton-row" style="width:36%; margin:0 auto 14px;"></div>
          <p style="color:var(--neutral-500); font-size:13px;">${t("verify_loading")}</p>
        </div>`;
    }

    if (phase === "idle") {
      return `
        <div class="card" style="text-align:center; padding:36px;">
          <div style="color:var(--neutral-400); margin-bottom:10px;">${ic("shield", 40, { strokeWidth: 1.5 })}</div>
          <p style="color:var(--neutral-500);">${t("verify_intro")}</p>
        </div>`;
    }

    if (phase === "not_found") {
      return `
        <div class="card" style="border:2px solid var(--danger); text-align:center; padding:32px;">
          <div style="color:var(--danger); margin-bottom:8px;">${ic("alert", 42, { strokeWidth: 1.5 })}</div>
          <h3 style="color:var(--danger); font-size:16px; margin-bottom:6px;">${t("verify_not_found")}</h3>
          <p style="color:var(--neutral-600); font-size:13px;">${t("verify_not_found_desc").replace("{no}", verifyEsc(result.no))}</p>
        </div>`;
    }

    if (phase === "error") {
      return `
        <div class="card" style="border:2px solid var(--warning); text-align:center; padding:32px;">
          <div style="color:var(--warning); margin-bottom:8px;">${ic("alert", 42, { strokeWidth: 1.5 })}</div>
          <h3 style="color:var(--warning); font-size:16px; margin-bottom:6px;">${t("verify_error_title")}</h3>
          <p style="color:var(--neutral-600); font-size:13px;">${t("verify_error_desc")}</p>
        </div>`;
    }

    const cert = result.cert;
    const valid = cert.status === "issued";
    const color = valid ? "var(--success)" : "var(--danger)";
    return `
      <div class="card" style="border:2px solid ${color};">
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid var(--neutral-300);">
          <div style="color:${color};">
            ${ic(valid ? "check_circle" : "x_circle", 44, { strokeWidth: 1.5 })}
          </div>
          <div>
            <h3 style="font-size:18px; font-weight:800; color:${color};">
              ${valid ? t("verify_status_valid") : t("verify_status_revoked")}
            </h3>
            <div style="font-family:var(--font-mono); font-weight:700; color:var(--neutral-600);" dir="ltr">${verifyEsc(cert.certificateNo)}</div>
          </div>
        </div>
        <div class="verify-grid">
          <div>
            <span style="font-size:12px; color:var(--neutral-500);">${t("volunteer_name")}</span>
            <div style="font-weight:700; font-size:16px;">${verifyEsc(verifyCertName(cert))}</div>
          </div>
          <div>
            <span style="font-size:12px; color:var(--neutral-500);">${t("committee")}</span>
            <div style="font-weight:700; font-size:16px;">${verifyEsc(verifyCommitteeName(cert))}</div>
          </div>
          <div>
            <span style="font-size:12px; color:var(--neutral-500);">${t("kpi_total_hours")}</span>
            <div style="font-weight:700; font-size:16px; color:var(--primary);">${verifyEsc(cert.totalHours)} ${t("verify_hours_suffix")}</div>
          </div>
          <div>
            <span style="font-size:12px; color:var(--neutral-500);">${t("issue_date")}</span>
            <div style="font-weight:700; font-size:16px;">${verifyEsc(cert.issueDate)}</div>
          </div>
        </div>
        ${valid ? `
          <div class="alert-soft alert-success-soft" style="padding:14px; border-radius:var(--radius-md); font-size:13px;">
            ${t("verify_authenticated")}
          </div>
        ` : `
          <div class="alert-soft alert-warning-soft" style="padding:14px; border-radius:var(--radius-md);">
            <div style="font-weight:700; margin-bottom:4px;">${t("verify_revocation_record")}</div>
            <div style="font-size:13px;">${verifyEsc(cert.revokedReason || t("verify_revoked_default"))}</div>
          </div>
        `}
      </div>`;
  }

  async function lookupCertificate(certNo) {
    try {
      const cert = await window.AtharAPI.certificates.verify(certNo);
      return { phase: "found", cert: cert };
    } catch (err) {
      if (err && err.status === 404) return { phase: "not_found", no: certNo };
      return { phase: "error", no: certNo };
    }
  }

  function verifySearchFormHtml(queryNo) {
    return `
      <form id="verify-search-form" class="verify-search-form" autocomplete="off">
        <input type="text" id="verify-search-input" class="form-control verify-search-input"
          placeholder="${t("verify_search_placeholder")}" value="${verifyEsc(queryNo)}" dir="ltr" spellcheck="false">
        <button class="btn btn-primary" type="submit">${t("verify_now")}</button>
      </form>`;
  }

  function bindVerifyForm(root, run) {
    const form = root.querySelector("#verify-search-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const input = root.querySelector("#verify-search-input");
      const no = input ? (input.value || "").trim() : "";
      if (no) run(no);
    });
  }

  function loadVerifyResult(no, resultEl) {
    if (resultEl) resultEl.innerHTML = verifyResultHtml({ phase: "loading" });
    lookupCertificate(no).then(function (res) {
      if (resultEl && resultEl.isConnected) resultEl.innerHTML = verifyResultHtml(res);
    });
  }

  function renderPublicVerify(container, certNoParam) {
    const queryNo = String(certNoParam || App.verifyLookupNo || "").trim();

    container.innerHTML = `
      <div class="public-verify-wrap" style="max-width: 680px; margin: 20px auto;">
        <div class="view-header" style="justify-content:center; text-align:center;">
          <div>
            <h1 class="view-title" style="justify-content:center;">${ic("shield", 24)} ${t("verify_page_title")}</h1>
            <p class="view-subtitle">${t("verify_subtitle")}</p>
          </div>
        </div>

        <div class="card" style="margin-bottom:24px;">
          ${verifySearchFormHtml(queryNo)}
        </div>

        <div id="verify-result">${verifyResultHtml(queryNo ? { phase: "loading" } : { phase: "idle" })}</div>
      </div>
    `;

    bindVerifyForm(container, function (no) {
      App.verifyLookupNo = no;
      try { window.history.replaceState(null, "", `#public-verify/${encodeURIComponent(no)}`); } catch (e) { }
      loadVerifyResult(no, document.getElementById("verify-result"));
    });

    if (queryNo) loadVerifyResult(queryNo, document.getElementById("verify-result"));
  }

  // Standalone shell for anonymous visitors arriving from a QR scan or link.
  function showPublicVerifyStandalone(certNo) {
    let screen = document.getElementById("public-verify-screen");
    if (!screen) {
      screen = document.createElement("div");
      screen.id = "public-verify-screen";
      screen.className = "public-verify-screen";
      document.body.appendChild(screen);
    }

    const queryNo = String(certNo || "").trim();

    screen.innerHTML = `
      <header class="pv-topbar">
        <div class="pv-brand">
          <img src="assets/logo.svg" alt="Athar" class="pv-logo">
          <span>${t("app_name")}</span>
        </div>
        <button type="button" id="pv-theme-btn" class="lang-toggle-btn theme-toggle-btn"
          title="${t("verify_theme_toggle")}" aria-label="Toggle theme">
          <svg class="theme-icon theme-icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
          </svg>
          <svg class="theme-icon theme-icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="4"></circle>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l1.41 1.41"></path>
          </svg>
        </button>
      </header>
      <main class="pv-main">
        <div class="pv-card">
          <div class="pv-head">
            <div class="pv-head-icon">${ic("shield", 28)}</div>
            <h1>${t("verify_page_title")}</h1>
            <p>${t("verify_subtitle")}</p>
          </div>
          ${verifySearchFormHtml(queryNo)}
          <div id="verify-result" style="margin-top:18px;">${verifyResultHtml(queryNo ? { phase: "loading" } : { phase: "idle" })}</div>
        </div>
        <div class="pv-links">
          <a href="#" id="pv-login-link">${t("verify_login_link")}</a>
          <span class="pv-dot">&bull;</span>
          <a href="apply.html">${t("verify_apply_link")}</a>
        </div>
      </main>
    `;

    const themeBtn = document.getElementById("pv-theme-btn");
    if (themeBtn) themeBtn.onclick = function () { window.AtharCore.toggleTheme(); };

    const loginLink = document.getElementById("pv-login-link");
    if (loginLink) loginLink.onclick = function (e) {
      e.preventDefault();
      try { window.history.replaceState(null, "", window.location.pathname + window.location.search); } catch (err) { }
      const s = document.getElementById("public-verify-screen");
      if (s) s.remove();
      if (window.AtharAuth) window.AtharAuth.showLoginScreen();
    };

    bindVerifyForm(screen, function (no) {
      try { window.history.replaceState(null, "", `#public-verify/${encodeURIComponent(no)}`); } catch (e) { }
      loadVerifyResult(no, document.getElementById("verify-result"));
    });

    if (queryNo) loadVerifyResult(queryNo, document.getElementById("verify-result"));
  }

  window.AtharViews.certificates = (c, p) => renderCertificatesList(c);
  window.AtharViews.generateCertificate = (c, p) => renderGenerateCertificate(c, p.id, p.sub);
  window.AtharViews.publicVerify = (c, p) => renderPublicVerify(c, p.id);
  window.AtharViews.showPublicVerifyStandalone = (certNo) => showPublicVerifyStandalone(certNo);
})();