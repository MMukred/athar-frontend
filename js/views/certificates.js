/**
 * View: Certificates (list + generate + public verify)
 */
(function () {
  "use strict";

  const { App, t, formatDate, ic, showToast, hasPermission, navigateTo } = window.AtharCore;

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
              return `
                <tr>
                  <td><span style="font-family:var(--font-mono); font-weight:700; color:var(--primary);">${cert.certificate_no || 'DRAFT (Pending Approval)'}</span></td>
                  <td><div style="font-weight:700; cursor:pointer;" onclick="window.AtharApp.navigateTo('volunteer-profile', {id:'${cert.volunteer_id}'})">${vol ? (App.currentLang === 'ar' ? (vol.full_name_ar || vol.full_name) : vol.full_name) : 'Volunteer'}</div></td>
                  <td><span class="num-ltr" style="font-weight:800;">${cert.total_hours} h</span></td>
                  <td>${formatDate(cert.issue_date)}</td>
                  <td><span class="badge badge-neutral">${cert.language.toUpperCase()}</span></td>
                  <td>
                    <span class="badge ${cert.status === 'issued' ? 'badge-success' : cert.status === 'draft' ? 'badge-warning' : 'badge-danger'}">${t(cert.status)}</span>
                    ${cert.revoked_reason ? `<div style="font-size:10px; color:var(--danger); max-width:180px;">${cert.revoked_reason}</div>` : ''}
                  </td>
                  <td>
                    <div class="row-actions-cell">
                      <button class="btn btn-secondary btn-sm" onclick="window.AtharApp.navigateTo('generate-certificate', {id:'${cert.volunteer_id}', sub:'${cert.id}'})">${t("view")} / ${t("print")}</button>
                      ${cert.status === 'issued' && vol && vol.whatsapp ? `<button class="btn btn-whatsapp btn-sm" onclick="window.AtharApp.sendCertWhatsApp('${cert.id}')">${ic("whatsapp", 12)} Send</button>` : ''}
                      ${isSuper && cert.status === 'issued' ? `<button class="btn btn-danger-outline btn-sm" onclick="window.AtharModals.openRevokeCertModal('${cert.id}')">${ic("x_circle", 14)} ${t("revoke_certificate")}</button>` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    const addBtn = document.getElementById("btn-add-cert");
    if (addBtn) addBtn.onclick = () => navigateTo("generate-certificate");
  }

  function renderGenerateCertificate(container, volunteerId, certId) {
    const state = window.AtharStore.getState();
    const isSuper = App.currentUser.role === "super_admin";
    const existingCert = certId ? state.certificates.find(c => c.id === certId) : null;
    let targetVolId = volunteerId || (existingCert ? existingCert.volunteer_id : (state.volunteers[0] ? state.volunteers[0].id : null));
    let certLang = existingCert ? existingCert.language : App.currentLang;
    let startDate = existingCert ? existingCert.period_start : "2025-01-01";
    let endDate = existingCert ? existingCert.period_end : "2026-10-12";
    const vol = state.volunteers.find(v => v.id === targetVolId);
    const comm = vol ? state.committees.find(c => c.id === vol.committee_id) : null;

    function computeApprovedHours(vId, sDate, eDate) {
      return state.volunteer_hours
        .filter(h => h.volunteer_id === vId && h.status === "approved" && (!sDate || h.date >= sDate) && (!eDate || h.date <= eDate))
        .reduce((sum, h) => sum + Number(h.hours), 0);
    }

    let hoursVal = existingCert ? existingCert.total_hours : computeApprovedHours(targetVolId, startDate, endDate);
    let certNumber = existingCert ? existingCert.certificate_no : "ATHAR-2026-DRAFT";
    let qrSvg = window.generateQRCodeSVG(existingCert && existingCert.qr_code ? existingCert.qr_code : `https://athar.org/verify/${certNumber}`, 100);

    container.innerHTML = `
      <div class="view-header">
        <div class="view-header-left">
          <div class="breadcrumb-trail">
            <span class="breadcrumb-item" onclick="window.AtharApp.navigateTo('certificates')">${t("nav_certificates")}</span>
            <span class="breadcrumb-separator">/</span>
            <span>${existingCert ? existingCert.certificate_no || 'Draft Preview' : t("generate_certificate")}</span>
          </div>
          <h1 class="view-title">${t("generate_certificate")}</h1>
        </div>
        <div class="view-header-actions">
          <button class="btn btn-secondary" onclick="window.AtharApp.printCertificateDoc()">${ic("printer", 14)} ${t("print")} / ${t("export_pdf")}</button>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 360px 1fr; gap:24px; align-items:start;">
        <div class="card">
          <h3 style="font-size:15px; margin-bottom:14px; border-bottom:1px solid var(--neutral-300); padding-bottom:8px;">Configuration</h3>
          <div class="form-field" style="margin-bottom:14px;">
            <label class="field-label">${t("volunteer_name")}</label>
            <select class="form-control" id="cert-vol-select" ${existingCert && existingCert.status === 'issued' ? 'disabled' : ''}>
              ${state.volunteers.filter(v => v.status !== 'archived').map(v => `
                <option value="${v.id}" ${v.id === targetVolId ? 'selected' : ''}>${App.currentLang === 'ar' ? (v.full_name_ar || v.full_name) : v.full_name}</option>
              `).join('')}
            </select>
          </div>
          <div class="form-field" style="margin-bottom:14px;">
            <label class="field-label">Period Range</label>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              <input type="date" id="cert-start-date" class="form-control" value="${startDate}">
              <input type="date" id="cert-end-date" class="form-control" value="${endDate}">
            </div>
          </div>
          <div class="form-field" style="margin-bottom:14px;">
            <label class="field-label">Certificate Language</label>
            <div style="display:flex; gap:16px; margin-top:4px;">
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="radio" name="cert-lang" value="ar" ${certLang === 'ar' ? 'checked' : ''}> العربية</label>
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer;"><input type="radio" name="cert-lang" value="en" ${certLang === 'en' ? 'checked' : ''}> English</label>
            </div>
          </div>
          <div style="padding:12px; background:var(--neutral-100); border-radius:var(--radius-md); margin-bottom:18px;">
            <div style="font-size:12px; color:var(--neutral-500);">${t("kpi_total_hours")} (Auto-calculated)</div>
            <div style="font-size:20px; font-weight:800; color:${hoursVal > 0 ? 'var(--success)' : 'var(--danger)'};" class="num-ltr" id="cert-live-hours-display">${hoursVal} hours</div>
            ${hoursVal === 0 ? `<div style="font-size:11px; color:var(--danger); margin-top:2px;">Warning: Volunteer has 0 approved hours in this range!</div>` : ''}
          </div>
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${!existingCert || existingCert.status === 'draft' ? `
              <button class="btn btn-secondary" id="btn-cert-save-draft">${t("save_draft")}</button>
              ${isSuper ? `<button class="btn btn-primary" id="btn-cert-approve-issue">${ic("award", 14)} ${t("approve_and_issue")}</button>` : `<div style="font-size:11px; color:var(--neutral-500); text-align:center;">Only Super Admin can approve & issue official certificate numbers.</div>`}
            ` : `<div class="badge badge-success" style="justify-content:center; padding:8px;">Official Certificate Issued (${existingCert.certificate_no})</div>`}
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
              <div class="cert-volunteer-name" id="cert-preview-name">${vol ? (certLang === 'ar' ? (vol.full_name_ar || vol.full_name) : vol.full_name) : 'Volunteer Name'}</div>
              <p>
                ${certLang === 'ar' ? `
                  قد أتم بنجاح وتفانٍ <span class="cert-highlight num-ltr" id="cert-preview-hours">${hoursVal}</span> ساعة من الخدمة التطوعية الفاعلة مع <span class="cert-highlight">${comm ? comm.name_ar : 'مؤسسة أثر'}</span> خلال الفترة من <span class="num-ltr">${formatDate(startDate)}</span> إلى <span class="num-ltr">${formatDate(endDate)}</span>.
                ` : `
                  has passionately and successfully completed <span class="cert-highlight num-ltr" id="cert-preview-hours">${hoursVal}</span> hours of distinguished volunteer service with <span class="cert-highlight">${comm ? comm.name_en : 'Athar Foundation'}</span> from <span class="num-ltr">${formatDate(startDate)}</span> to <span class="num-ltr">${formatDate(endDate)}</span>.
                `}
              </p>
              <p style="font-size:13px; color:#666; margin-top:12px;">
                ${certLang === 'ar' ? 'تقديراً لعطائه وتفانيه في خدمة المجتمع، راجين له دوام التوفيق والتميز.' : 'In sincere recognition of exemplary commitment and inspiring contribution to our society.'}
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

    // Track dirty state
    const certConfigCard = document.querySelector(".content-area .card");
    if (certConfigCard && window.AtharDirty) window.AtharDirty.track(certConfigCard);

    const volSelect = document.getElementById("cert-vol-select");
    const startInp = document.getElementById("cert-start-date");
    const endInp = document.getElementById("cert-end-date");
    const langRadios = container.querySelectorAll("input[name='cert-lang']");

    function updateLivePreview() {
      const vId = volSelect.value;
      const sD = startInp.value;
      const eD = endInp.value;
      const l = container.querySelector("input[name='cert-lang']:checked").value;
      const v = state.volunteers.find(x => x.id === vId);
      const c = v ? state.committees.find(x => x.id === v.committee_id) : null;
      const h = computeApprovedHours(vId, sD, eD);

      document.getElementById("cert-live-hours-display").textContent = `${h} hours`;
      document.getElementById("cert-preview-hours").textContent = h;
      document.getElementById("cert-preview-name").textContent = v ? (l === 'ar' ? (v.full_name_ar || v.full_name) : v.full_name) : '';

      if (l !== certLang) renderGenerateCertificate(container, vId, certId);
    }

    volSelect.onchange = updateLivePreview;
    startInp.onchange = updateLivePreview;
    endInp.onchange = updateLivePreview;
    langRadios.forEach(r => r.onchange = updateLivePreview);

    const saveDraftBtn = document.getElementById("btn-cert-save-draft");
    if (saveDraftBtn) {
      saveDraftBtn.onclick = () => {
        if (window.AtharDirty) window.AtharDirty.beginSubmit();
        const vId = volSelect.value;
        const h = computeApprovedHours(vId, startInp.value, endInp.value);
        const l = container.querySelector("input[name='cert-lang']:checked").value;

        const draftObj = {
          id: existingCert ? existingCert.id : "cert-" + window.AtharStore.generateUUID().substring(0, 8),
          certificate_no: null,
          volunteer_id: vId,
          total_hours: h,
          period_start: startInp.value,
          period_end: endInp.value,
          issue_date: new Date().toISOString().substring(0, 10),
          language: l,
          qr_code: null,
          status: "draft",
          approved_by: null,
          approved_at: null,
          created_at: new Date().toISOString()
        };

        if (existingCert) Object.assign(existingCert, draftObj);
        else state.certificates.push(draftObj);

        window.AtharStore.save();
        if (window.AtharDirty) window.AtharDirty.clear();
        showToast("Certificate draft saved successfully", "success");
        navigateTo("certificates");
      };
    }

    const approveIssueBtn = document.getElementById("btn-cert-approve-issue");
    if (approveIssueBtn) {
      approveIssueBtn.onclick = () => {
        if (window.AtharDirty) window.AtharDirty.beginSubmit();
        const vId = volSelect.value;
        const h = computeApprovedHours(vId, startInp.value, endInp.value);
        if (h === 0) { showToast(t("error_no_hours"), "error"); return; }

        const seq = state.settings.cert_sequence || 6;
        state.settings.cert_sequence = seq + 1;
        const nextCertNo = `${state.settings.cert_prefix || 'ATHAR-2026-'}${String(seq).padStart(4, '0')}`;
        const l = container.querySelector("input[name='cert-lang']:checked").value;
        const verifyUrl = `https://athar.org/verify/${nextCertNo}`;

        const issuedObj = {
          id: existingCert ? existingCert.id : "cert-" + window.AtharStore.generateUUID().substring(0, 8),
          certificate_no: nextCertNo,
          volunteer_id: vId,
          total_hours: h,
          period_start: startInp.value,
          period_end: endInp.value,
          issue_date: new Date().toISOString().substring(0, 10),
          language: l,
          qr_code: verifyUrl,
          status: "issued",
          approved_by: App.currentUser.id,
          approved_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        };

        if (existingCert) Object.assign(existingCert, issuedObj);
        else state.certificates.push(issuedObj);

        window.AtharStore.save();
        window.AtharStore.logAudit(App.currentUser, "issue", "certificate", issuedObj.id, `Approved & issued certificate ${nextCertNo} for volunteer (${h} hours)`, null, issuedObj);
        if (window.AtharDirty) window.AtharDirty.clear();
        showToast(t("cert_issued_successfully"), "success");
        navigateTo("certificates");
      };
    }
  }

  function renderPublicVerify(container, certNoParam) {
    const state = window.AtharStore.getState();
    let queryNo = certNoParam || App.verifyLookupNo || "";
    const cert = queryNo ? state.certificates.find(c => c.certificate_no && c.certificate_no.toLowerCase() === queryNo.trim().toLowerCase()) : null;
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
              <div style="color:${cert.status === 'issued' ? 'var(--success)' : 'var(--danger)'};">${ic(cert.status === 'issued' ? 'check_circle' : 'x_circle', 44, { strokeWidth: 1.5 })}</div>
              <div>
                <h3 style="font-size:18px; font-weight:800; color:${cert.status === 'issued' ? 'var(--success)' : 'var(--danger)'};">${cert.status === 'issued' ? t("verify_status_valid") : t("verify_status_revoked")}</h3>
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

    document.getElementById("btn-do-verify").onclick = () => {
      App.verifyLookupNo = document.getElementById("verify-search-input").value;
      renderPublicVerify(container, App.verifyLookupNo);
    };
  }

  window.AtharViews.certificates = (c, p) => renderCertificatesList(c);
  window.AtharViews.generateCertificate = (c, p) => renderGenerateCertificate(c, p.id, p.sub);
  window.AtharViews.publicVerify = (c, p) => renderPublicVerify(c, p.id);
})();
