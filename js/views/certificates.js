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
    const isSuper = App.currentUser.role === "super_admin";

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
                  <tr>
                    <td>
                      <span style="font-family:var(--font-mono); font-weight:700; color:${isDraft ? 'var(--neutral-500)' : 'var(--primary)'};">
                        ${cert.certificate_no || 'DRAFT (Unassigned)'}
                      </span>
                    </td>
                    <td>
                      <div style="font-weight:700; cursor:pointer;" onclick="window.AtharApp.navigateTo('volunteer-profile', {id:'${cert.volunteer_id}'})">
                        ${vol ? (App.currentLang === 'ar' ? (vol.full_name_ar || vol.full_name) : vol.full_name) : 'Volunteer'}
                      </div>
                    </td>
                    <td><span class="num-ltr" style="font-weight:800;">${cert.total_hours} h</span></td>
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
    const isSuper = App.currentUser.role === "super_admin";
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
        (existingCert && existingCert.qr_code) || `https://athar.org/verify/${certNumber}`,
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
                <p style="font-size:13px; color:#666; margin-top:12px;">
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
  // Public Verification (unchanged — API endpoint not yet on backend)
  // =========================================================================
  function renderPublicVerify(container, certNoParam) {
    const state = window.AtharStore.getState();
    let queryNo = certNoParam || App.verifyLookupNo || "";
    const cert = queryNo
      ? state.certificates.find(c => c.certificate_no && c.certificate_no.toLowerCase() === queryNo.trim().toLowerCase())
      : null;
    const vol = cert ? state.volunteers.find(v => v.id === cert.volunteer_id) : null;
    const comm = vol ? state.committees.find(c => c.id === vol.committee_id) : null;

    container.innerHTML = `
      <div style="max-width: 680px; margin: 20px auto;">
        <div class="view-header" style="justify-content:center; text-align:center;">
          <div>
            <h1 class="view-title" style="justify-content:center;">${ic("shield", 24)} ${t("verify_page_title")}</h1>
            <p class="view-subtitle">${t("verify_subtitle")}</p>
          </div>
        </div>

        <div class="card" style="margin-bottom:24px;">
          <div style="display:flex; gap:10px;">
            <input type="text" id="verify-search-input" class="form-control" style="font-family:var(--font-mono); font-size:15px;" placeholder="e.g. ATHAR-2026-0001" value="${queryNo}">
            <button class="btn btn-primary" id="btn-do-verify">Verify Now</button>
          </div>
        </div>

        ${!queryNo ? `
          <div class="card" style="text-align:center; padding:36px;">
            <p style="color:var(--neutral-500);">Enter a certificate reference number or scan the QR code to verify credential authenticity.</p>
          </div>
        ` : cert ? `
          <div class="card" style="border: 2px solid ${cert.status === 'issued' ? 'var(--success)' : 'var(--danger)'};">
            <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px; padding-bottom:16px; border-bottom:1px solid var(--neutral-300);">
              <div style="color:${cert.status === 'issued' ? 'var(--success)' : 'var(--danger)'};">
                ${ic(cert.status === 'issued' ? 'check_circle' : 'x_circle', 44, { strokeWidth: 1.5 })}
              </div>
              <div>
                <h3 style="font-size:18px; font-weight:800; color:${cert.status === 'issued' ? 'var(--success)' : 'var(--danger)'};">
                  ${cert.status === 'issued' ? t("verify_status_valid") : t("verify_status_revoked")}
                </h3>
                <div style="font-family:var(--font-mono); font-weight:700; color:var(--neutral-600);">${cert.certificate_no}</div>
              </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
              <div>
                <span style="font-size:12px; color:var(--neutral-500);">${t("volunteer_name")}</span>
                <div style="font-weight:700; font-size:16px;">${vol ? vol.full_name : 'Unknown'}</div>
              </div>
              <div>
                <span style="font-size:12px; color:var(--neutral-500);">${t("committee")}</span>
                <div style="font-weight:700; font-size:16px;">${comm ? comm.name_en : 'General'}</div>
              </div>
              <div>
                <span style="font-size:12px; color:var(--neutral-500);">${t("kpi_total_hours")}</span>
                <div style="font-weight:700; font-size:16px; color:var(--primary);">${cert.total_hours} approved hours</div>
              </div>
              <div>
                <span style="font-size:12px; color:var(--neutral-500);">${t("issue_date")}</span>
                <div style="font-weight:700; font-size:16px;">${cert.issue_date}</div>
              </div>
            </div>
            ${cert.status === 'revoked' ? `
              <div style="padding:14px; background:var(--danger-light); border:1px solid var(--danger-border); border-radius:var(--radius-md);">
                <div style="font-weight:700; color:var(--danger);">Revocation Record:</div>
                <div style="font-size:13px; color:var(--neutral-800);">${cert.revoked_reason || 'Certificate revoked by administrative order'}</div>
              </div>
            ` : `
              <div style="padding:14px; background:var(--success-light); border:1px solid var(--success-border); border-radius:var(--radius-md); font-size:13px; color:var(--success);">
                This volunteer credential is authenticated and backed by verified institutional logs in the Athar system.
              </div>
            `}
          </div>
        ` : `
          <div class="card" style="border: 2px solid var(--danger); text-align:center; padding:32px;">
            <div style="color:var(--danger); margin-bottom:8px;">${ic("alert", 42, { strokeWidth: 1.5 })}</div>
            <h3 style="color:var(--danger); font-size:16px; margin-bottom:6px;">${t("verify_not_found")}</h3>
            <p style="color:var(--neutral-600); font-size:13px;">No record matching "${queryNo}" was found in the central ledger.</p>
          </div>
        `}
      </div>
    `;

    const doVerify = document.getElementById("btn-do-verify");
    if (doVerify) {
      doVerify.onclick = () => {
        App.verifyLookupNo = document.getElementById("verify-search-input").value;
        renderPublicVerify(container, App.verifyLookupNo);
      };
    }
  }

  window.AtharViews.certificates = (c, p) => renderCertificatesList(c);
  window.AtharViews.generateCertificate = (c, p) => renderGenerateCertificate(c, p.id, p.sub);
  window.AtharViews.publicVerify = (c, p) => renderPublicVerify(c, p.id);
})();