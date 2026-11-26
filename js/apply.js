/**
 * Athar public volunteer application form handler
 */
(function () {
  "use strict";

  const BASE_URL = (function () {
    if (window._ATHAR_API_URL__) return String(window._ATHAR_API_URL__).replace(/\/$/, "");
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return "http://localhost:3000/api";
    return "https://athar-api-l8fn.onrender.com/api";
  })();

  const lang = (document.documentElement.lang === "en") ? "en" : "ar";

  function clearError() {
    const el = document.getElementById("form-error");
    if (el) { el.textContent = ""; el.style.display = "none"; }
  }
  function showError(msg) {
    const el = document.getElementById("form-error");
    if (el) { el.textContent = msg; el.style.display = "block"; }
  }

  function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }
  function checked(name) { const el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ""; }
  function checkedBoxes(sel) { return Array.from(document.querySelectorAll(sel + " input[type='checkbox']:checked")).map(cb => cb.value); }

  const form = document.getElementById("apply-form");
  if (!form) return;

  // Toggle "Other:" free-text inputs
  function toggleOther(radioName, inputId, showWhen) {
    document.querySelectorAll('input[name="' + radioName + '"]').forEach(r => {
      r.addEventListener('change', () => {
        const sel = document.querySelector('input[name="' + radioName + '"]:checked');
        const inp = document.getElementById(inputId);
        if (inp) inp.style.display = (sel && sel.value === showWhen) ? '' : 'none';
      });
    });
  }
  toggleOther('commitPrep', 'f-commitPrepOther', 'other');
  toggleOther('transport', 'f-transportOther', 'other');

  const volBeforeRadios = document.querySelectorAll('input[name="volBefore"]');
  volBeforeRadios.forEach(r => r.addEventListener('change', () => {
    const sel = document.querySelector('input[name="volBefore"]:checked');
    const w = document.getElementById('volOrgsWrap');
    if (w) w.style.display = (sel && sel.value === 'yes') ? '' : 'none';
  }));

  const eduSel = document.getElementById('f-eduLevel');
  if (eduSel) eduSel.addEventListener('change', () => {
    const o = document.getElementById('f-eduLevelOther');
    if (o) o.style.display = (eduSel.value === 'other') ? '' : 'none';
  });

  const paSel = document.getElementById('f-preferredArea');
  if (paSel) paSel.addEventListener('change', () => {
    const o = document.getElementById('f-preferredAreaOther');
    if (o) o.style.display = (paSel.value === 'other') ? '' : 'none';
  });

  const skillsOtherCb = document.querySelector('.checkbox-group input[type="checkbox"][value="other"]');
  if (skillsOtherCb) skillsOtherCb.addEventListener('change', () => {
    const o = document.getElementById('f-skillsOther');
    if (o) o.style.display = skillsOtherCb.checked ? '' : 'none';
  });

  document.querySelectorAll('input[name="restrictions"]').forEach(r => {
    r.addEventListener('change', () => {
      const sel = document.querySelector('input[name="restrictions"]:checked');
      const t = document.getElementById('f-restrictionsDetail');
      if (t) t.style.display = (sel && sel.value === 'yes') ? '' : 'none';
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    const fullName = val("f-fullName");
    const age = val("f-age");
    const gender = checked("gender");
    const phone = val("f-phone");
    const email = val("f-email");
    const nationality = val("f-nationality");
    const residence = val("f-residence");
    const eduLevel = val("f-eduLevel");
    const eduLevelOther = val("f-eduLevelOther");
    const fieldOfStudy = val("f-fieldOfStudy");
    const institution = val("f-institution");
    const volunteeredBefore = checked("volBefore");
    const volOrgs = val("f-volOrgs");
    const skillsChecked = checkedBoxes(".checkbox-group");
    const skillsOther = val("f-skillsOther");
    const preferredArea = val("f-preferredArea");
    const preferredAreaOther = val("f-preferredAreaOther");
    const commitPreparation = checked("commitPrep");
    const commitPrepOther = val("f-commitPrepOther");
    const restrictions = checked("restrictions");
    const restrictionsDetail = val("f-restrictionsDetail");
    const transportation = checked("transport");
    const transportOther = val("f-transportOther");
    const suggestions = val("f-suggestions");
    const pledge = checked("pledge");

    if (fullName.length < 2) { showError("Please enter your full name."); return; }
    if (!age || isNaN(Number(age))) { showError("Please enter your age."); return; }
    if (!gender) { showError("Please select your gender."); return; }
    if (!phone) { showError("Please enter your phone number."); return; }
    if (!email) { showError("Please enter your email."); return; }
    if (!nationality) { showError("Please enter your nationality."); return; }
    if (!residence) { showError("Please enter your place of residence."); return; }
    if (!eduLevel) { showError("Please select your educational level."); return; }
    if (!fieldOfStudy) { showError("Please enter your field of study."); return; }
    if (!institution) { showError("Please enter your educational institution."); return; }
    if (!volunteeredBefore) { showError("Please answer the volunteering question."); return; }
    if (skillsChecked.length === 0) { showError("Please select at least one skill."); return; }
    if (!preferredArea) { showError("Please select a preferred area."); return; }
    if (!commitPreparation) { showError("Please answer the commitment question."); return; }
    if (!restrictions) { showError("Please answer the restrictions question."); return; }
    if (!transportation) { showError("Please answer the transportation question."); return; }
    if (!suggestions) { showError("Please enter your suggestions or comments."); return; }
    if (!pledge) { showError("Please accept the pledge."); return; }

    const consentEl = document.getElementById("f-consent");
    const consentChecked = !!(consentEl && consentEl.checked);
    if (!consentChecked) { showError("You must accept the privacy consent."); return; }

    const skills = skillsChecked.filter(v => v !== "other");
    if (skillsChecked.includes("other") && skillsOther) skills.push(skillsOther);

    const payload = {
      fullName,
      age: Number(age),
      gender,
      phone,
      email,
      nationality,
      placeOfResidence: residence,
      educationalLevel: eduLevel,
      educationalLevelOther: eduLevel === "other" ? (eduLevelOther || null) : null,
      fieldOfStudy,
      educationalInstitution: institution,
      volunteeredBefore,
      volunteeredOrgs: volunteeredBefore === "yes" ? (volOrgs || null) : null,
      skills,
      skillsOther: skillsChecked.includes("other") ? (skillsOther || null) : null,
      preferredArea,
      preferredAreaOther: preferredArea === "other" ? (preferredAreaOther || null) : null,
      commitPreparation,
      commitPreparationOther: commitPreparation === "other" ? (commitPrepOther || null) : null,
      restrictions,
      restrictionsDetail: restrictions === "yes" ? (restrictionsDetail || null) : null,
      transportation,
      transportationOther: transportation === "other" ? (transportOther || null) : null,
      suggestions,
      pledge,
      website: document.getElementById("f-website").value || null,
      consent: consentChecked,
    };

    const submitBtn = document.getElementById("submit-btn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>Sending...';

    try {
      const res = await fetch(BASE_URL + "/public/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 201) {
        document.getElementById("apply-form").innerHTML = '<div style="text-align:center; padding:24px;"><h3>Thank you! Your application has been submitted.</h3></div>';
      } else {
        const body = await res.json().catch(() => null);
        const msg = (body && body.error && body.error.message) || "Submission failed. Please try again.";
        showError(msg);
      }
    } catch (e) {
      showError("Cannot reach the server. Check your connection.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = "Submit";
    }
  });
})();
