/**
 * Athar — Public volunteer application page (no authentication).
 * Talks to POST /api/public/applications and GET /api/public/committees.
 */
(function () {
  "use strict";

  // ---- API base (same detection rules as the main app) ----
  const BASE_URL = (function () {
    if (window._ATHAR_API_URL__) return String(window._ATHAR_API_URL__).replace(/\/$/, "");
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return "http://localhost:3000/api";
    return "https://athar-api-l8fn.onrender.com/api";
  })();

  const I18N = {
    ar: {
      title: "التطوع مع مؤسسة أثر",
      subtitle: "املأ النموذج التالي وسيتواصل معك فريقنا قريباً بإذن الله.",
      full_name_en: "الاسم الكامل (بالإنجليزية)",
      full_name_ar: "الاسم الكامل (بالعربية)",
      national_id: "رقم الهوية / الإقامة",
      dob: "تاريخ الميلاد",
      phone: "رقم الجوال",
      whatsapp: "رقم الواتساب",
      email: "البريد الإلكتروني",
      gender: "الجنس",
      male: "ذكر",
      female: "أنثى",
      nationality: "الجنسية",
      study_level: "المستوى الدراسي",
      lvl_secondary: "ثانوي",
      lvl_diploma: "دبلوم",
      lvl_bachelor: "بكالوريوس",
      lvl_master: "ماجستير",
      lvl_phd: "دكتوراه",
      lvl_other: "أخرى",
      committee: "اللجنة المفضلة",
      no_pref: "بدون تفضيل",
      skills: "المهارات",
      skills_hint: "افصل بين المهارات بفاصلة أو |",
      notes: "ملاحظات إضافية",
      contact_hint: "يجب توفير رقم واتساب أو بريد إلكتروني على الأقل.",
      submit: "إرسال الطلب",
      sending: "جارٍ الإرسال…",
      success_title: "تم استلام طلبك بنجاح ✓",
      success_body: "شكراً لتطوعك مع مؤسسة أثر. سيقوم فريقنا بمراجعة طلبك والتواصل معك عبر الواتساب أو البريد الإلكتروني.",
      success_ref: "رقم الطلب",
      err_name: "يرجى كتابة الاسم الكامل.",
      err_contact: "يرجى إدخال رقم واتساب أو بريد إلكتروني.",
      err_duplicate: "يبدو أن هذا الطلب مسجل مسبقاً. تواصل معنا إن كنت تعتقد أن هناك خطأ.",
      err_rate: "تم إرسال عدد كبير من الطلبات من هذا الجهاز. حاول لاحقاً.",
      err_generic: "تعذّر إرسال الطلب. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.",
      footer: "نظام إدارة المتطوعين — مؤسسة أثر",
      toggle: "English",
    },
    en: {
      title: "Volunteer with Athar Foundation",
      subtitle: "Fill in the form below and our team will contact you soon.",
      full_name_en: "Full Name (English)",
      full_name_ar: "الاسم الكامل (بالعربية)",
      national_id: "National ID / Iqama",
      dob: "Date of Birth",
      phone: "Phone Number",
      whatsapp: "WhatsApp Number",
      email: "Email Address",
      gender: "Gender",
      male: "Male",
      female: "Female",
      nationality: "Nationality",
      study_level: "Study Level",
      lvl_secondary: "Secondary",
      lvl_diploma: "Diploma",
      lvl_bachelor: "Bachelor",
      lvl_master: "Master",
      lvl_phd: "PhD",
      lvl_other: "Other",
      committee: "Preferred Committee",
      no_pref: "No preference",
      skills: "Skills",
      skills_hint: "Separate skills with a comma or |",
      notes: "Additional Notes",
      contact_hint: "A WhatsApp number or an email address is required.",
      submit: "Submit Application",
      sending: "Sending…",
      success_title: "Application received ✓",
      success_body: "Thank you for volunteering with Athar Foundation. Our team will review your application and contact you via WhatsApp or email.",
      success_ref: "Reference",
      err_name: "Please enter your full name.",
      err_contact: "Please provide a WhatsApp number or an email address.",
      err_duplicate: "It looks like this application was already submitted. Contact us if you think this is a mistake.",
      err_rate: "Too many submissions from this device. Please try again later.",
      err_generic: "Could not submit the application. Check your connection and try again.",
      footer: "Volunteer Management System — Athar Foundation",
      toggle: "العربية",
    },
  };

  let lang = (new URLSearchParams(window.location.search).get("lang") || "ar") === "en" ? "en" : "ar";

  function applyLang() {
    const dict = I18N[lang];
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (dict[key] != null) el.textContent = dict[key];
    });

    document.getElementById("page-title").textContent = dict.title;
    document.getElementById("page-subtitle").textContent = dict.subtitle;
    document.getElementById("contact-hint").textContent = dict.contact_hint;
    document.getElementById("footer-text").textContent = dict.footer;
    document.getElementById("lang-toggle").textContent = dict.toggle;
    document.getElementById("f-skills").placeholder = lang === "ar" ? "تصوير، تصميم، إلقاء..." : "Photography, design, public speaking...";
    document.getElementById("f-notes").placeholder = lang === "ar" ? "أخبرنا عن دوافعك للتطوع..." : "Tell us why you'd like to volunteer...";

    const submitBtn = document.getElementById("submit-btn");
    if (submitBtn && !submitBtn.disabled) submitBtn.textContent = dict.submit;
  }

  function showError(msg) {
    const box = document.getElementById("form-error");
    box.textContent = msg;
    box.style.display = "block";
    box.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function clearError() {
    const box = document.getElementById("form-error");
    box.style.display = "none";
  }

  // ---- Load committees (best effort) ----
  async function loadCommittees() {
    try {
      const res = await fetch(`${BASE_URL}/public/committees`, { headers: { Accept: "application/json" } });
      if (!res.ok) return;
      const data = await res.json();
      const select = document.getElementById("f-committee");
      (data.items || []).forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = lang === "ar" ? (c.nameAr || c.nameEn) : (c.nameEn || c.nameAr);
        select.appendChild(opt);
      });
    } catch {
      // Offline or API unavailable — the form still works without a committee.
    }
  }

  function wireForm() {
    const form = document.getElementById("apply-form");
    const dobInput = document.getElementById("f-dob");
    dobInput.max = new Date().toISOString().slice(0, 10);

    ["f-whatsapp", "f-email"].forEach((id) => {
      document.getElementById(id).addEventListener("input", clearError);
    });
    document.getElementById("f-fullName").addEventListener("input", clearError);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearError();

      const fullName = document.getElementById("f-fullName").value.trim();
      const fullNameAr = document.getElementById("f-fullNameAr").value.trim();
      const whatsapp = document.getElementById("f-whatsapp").value.trim();
      const email = document.getElementById("f-email").value.trim();

      if (fullName.length < 2) { showError(I18N[lang].err_name); return; }
      if (!whatsapp && !email) { showError(I18N[lang].err_contact); return; }

      const skillsRaw = document.getElementById("f-skills").value.trim();

      const payload = {
        fullName,
        fullNameAr: fullNameAr || null,
        nationalId: document.getElementById("f-nationalId").value.trim() || null,
        phone: document.getElementById("f-phone").value.trim() || null,
        whatsapp: whatsapp || null,
        email: email || null,
        dob: dobInput.value || null,
        gender: document.getElementById("f-gender").value || null,
        nationality: document.getElementById("f-nationality").value.trim() || null,
        studyLevel: document.getElementById("f-studyLevel").value || null,
        committeeId: document.getElementById("f-committee").value || null,
        skills: skillsRaw ? skillsRaw.split(/[,|،]/).map((s) => s.trim()).filter(Boolean).slice(0, 20) : [],
        notes: document.getElementById("f-notes").value.trim() || null,
        website: document.getElementById("f-website").value || null,
      };

      const submitBtn = document.getElementById("submit-btn");
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="spinner"></span>${I18N[lang].sending}`;

      try {
        const res = await fetch(`${BASE_URL}/public/applications`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.status === 201) {
          const data = await res.json().catch(() => ({}));
          showSuccess(data.applicationId);
          return;
        }

        const body = await res.json().catch(() => null);
        const code = body && body.error && body.error.code;
        if (res.status === 429) showError(I18N[lang].err_rate);
        else if (res.status === 409 || code === "ALREADY_APPLIED") showError(I18N[lang].err_duplicate);
        else if (res.status === 422 && body && body.error && body.error.details) {
          const first = Array.isArray(body.error.details) ? body.error.details[0] : null;
          showError(first && first.message ? first.message : I18N[lang].err_generic);
        } else {
          showError(I18N[lang].err_generic);
        }
      } catch {
        showError(I18N[lang].err_generic);
      }

      submitBtn.disabled = false;
      submitBtn.textContent = I18N[lang].submit;
    });
  }

  function showSuccess(applicationId) {
    const dict = I18N[lang];
    document.getElementById("apply-card").innerHTML = `
      <div class="success-view">
        <div class="check">🎉</div>
        <h2>${dict.success_title}</h2>
        <p>${dict.success_body}</p>
        ${applicationId ? `<div class="ref">${dict.success_ref}: ${String(applicationId).slice(0, 8).toUpperCase()}</div>` : ""}
      </div>
    `;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.getElementById("lang-toggle").addEventListener("click", () => {
    lang = lang === "ar" ? "en" : "ar";
    applyLang();
    // Refresh committee option labels for the new language.
    const select = document.getElementById("f-committee");
    Array.from(select.options).forEach((opt) => opt.remove());
    const none = document.createElement("option");
    none.value = "";
    none.textContent = I18N[lang].no_pref;
    select.appendChild(none);
    loadCommittees();
  });

  applyLang();
  wireForm();
  loadCommittees();
})();
