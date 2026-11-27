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

    if (fullName.length < 2) { showError("يرجى كتابة الاسم الرباعي. / Please enter your full name."); return; }
    if (!age || isNaN(Number(age))) { showError("يرجى كتابة العمر. / Please enter your age."); return; }
    if (!gender) { showError("يرجى اختيار الجنس. / Please select your gender."); return; }
    if (!phone) { showError("يرجى كتابة رقم الهاتف. / Please enter your phone number."); return; }
    if (!email) { showError("يرجى كتابة البريد الإلكتروني. / Please enter your email."); return; }
    if (!nationality) { showError("يرجى كتابة الجنسية. / Please enter your nationality."); return; }
    if (!residence) { showError("يرجى كتابة مكان الإقامة. / Please enter your place of residence."); return; }
    if (!eduLevel) { showError("يرجى اختيار المستوى التعليمي. / Please select your educational level."); return; }
    if (!fieldOfStudy) { showError("يرجى كتابة التخصص الدراسي. / Please enter your field of study."); return; }
    if (!institution) { showError("يرجى كتابة اسم الجهة التعليمية. / Please enter your educational institution."); return; }
    if (!volunteeredBefore) { showError("يرجى الإجابة عن سؤال التطوع السابق. / Please answer the volunteering question."); return; }
    if (skillsChecked.length === 0) { showError("يرجى اختيار مهارة واحدة على الأقل. / Please select at least one skill."); return; }
    if (!preferredArea) { showError("يرجى اختيار مجال التطوع المفضل. / Please select a preferred area."); return; }
    if (!commitPreparation) { showError("يرجى الإجابة عن سؤال الالتزام بفترة الإعداد. / Please answer the commitment question."); return; }
    if (!restrictions) { showError("يرجى الإجابة عن سؤال القيود والالتزامات. / Please answer the restrictions question."); return; }
    if (!transportation) { showError("يرجى الإجابة عن سؤال المواصلات. / Please answer the transportation question."); return; }
    if (!suggestions) { showError("يرجى كتابة اقتراحاتك أو ملاحظاتك. / Please enter your suggestions or comments."); return; }
    if (!pledge) { showError("يرجى الموافقة على الإقرار. / Please accept the pledge."); return; }

    const consentEl = document.getElementById("f-consent");
    const consentChecked = !!(consentEl && consentEl.checked);
    if (!consentChecked) { showError("يجب الموافقة على التعهد بصحة المعلومات. / You must accept the privacy consent."); return; }

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
    submitBtn.textContent = "جارٍ الإرسال… / Sending…";

    try {
      const res = await fetch(BASE_URL + "/public/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 201) {
        document.getElementById("apply-form").innerHTML = '<div class="apply-success"><span class="apply-success-icon" aria-hidden="true"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><h2>شكراً لك، وصل طلبك</h2><p>سيتواصل معك فريق أكاديمية أثر بعد مراجعة الطلب.</p><p class="apply-en">Thank you! Your application has been submitted.</p><a class="apply-back" href="index.html">العودة إلى الصفحة الرئيسية</a></div>';
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        const body = await res.json().catch(() => null);
        const msg = (body && body.error && body.error.message) || "تعذّر إرسال الطلب، حاول مرة أخرى. / Submission failed. Please try again.";
        showError(msg);
      }
    } catch (e) {
      showError("تعذّر الاتصال بالخادم، تحقق من الإنترنت. / Cannot reach the server. Check your connection.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "إرسال الطلب / Submit";
    }
  });
})();
