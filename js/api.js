/**
 * Athar API Client — connects frontend to backend
 */
window.AtharAPI = (function () {
  "use strict";

  // Auto-detect: localhost dev → local API; production → Render
  const BASE_URL = (function () {
    if (window._ATHAR_API_URL__) return String(window._ATHAR_API_URL__).replace(/\/$/, "");
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return "http://localhost:3000/api";
    return "https://athar-api-l8fn.onrender.com/api";
  })();

  const ACCESS_KEY = "athar_access_token_v1";
  const REFRESH_KEY = "athar_refresh_token_v1";
  const REMEMBER_KEY = "athar_remember_v1";

  let accessToken = null;
  let refreshToken = null;
  let refreshInFlight = null;

  function loadTokens() {
    try {
      const remembered = localStorage.getItem(REMEMBER_KEY) === "1";
      const store = remembered ? localStorage : sessionStorage;
      accessToken = sessionStorage.getItem(ACCESS_KEY) || localStorage.getItem(ACCESS_KEY);
      refreshToken = store.getItem(REFRESH_KEY) || localStorage.getItem(REFRESH_KEY);
    } catch { }
  }

  function saveTokens(at, rt, remember) {
    accessToken = at;
    refreshToken = rt;
    try {
      sessionStorage.setItem(ACCESS_KEY, at);
      const store = remember ? localStorage : sessionStorage;
      const other = remember ? sessionStorage : localStorage;
      store.setItem(REFRESH_KEY, rt);
      localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
      other.removeItem(REFRESH_KEY);
    } catch { }
  }

  function clearTokens() {
    accessToken = null;
    refreshToken = null;
    try {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(REMEMBER_KEY);
      sessionStorage.removeItem(ACCESS_KEY);
      sessionStorage.removeItem(REFRESH_KEY);
    } catch { }
  }

  class ApiError extends Error {
    constructor(status, code, message, details) {
      super(message || "Request failed");
      this.status = status;
      this.code = code;
      this.details = details;
    }
    isAuth() { return this.status === 401; }
    isValidation() { return this.status === 422; }
    isForbidden() { return this.status === 403; }
  }

  async function rawFetch(path, options = {}, opts = {}) {
    const { skipAuth = false, retry = true } = opts;
    const headers = new Headers(options.headers || {});
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    if (options.body && !(options.body instanceof FormData)) {
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    }
    if (!skipAuth && accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

    let response;
    try {
      response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    } catch {
      throw new ApiError(0, "NETWORK_ERROR", "Cannot reach server");
    }

    if (response.status === 401 && retry && !skipAuth && refreshToken) {
      try {
        await ensureFreshToken();
      } catch {
        clearTokens();
        throw new ApiError(401, "SESSION_EXPIRED", "Session expired");
      }
      return rawFetch(path, options, { ...opts, retry: false });
    }

    if (response.status === 204) return null;

    const ct = response.headers.get("content-type") || "";
    let body = null;
    if (ct.includes("application/json")) body = await response.json().catch(() => null);
    else if (ct.includes("text/csv")) body = await response.text();
    else if (ct.includes("application/pdf")) body = await response.blob();
    else body = await response.text().catch(() => null);

    if (!response.ok) {
      const err = (body && body.error) || {};
      throw new ApiError(
        response.status,
        err.code || `HTTP_${response.status}`,
        err.message || "Request failed",
        err.details,
      );
    }
    return body;
  }

  async function ensureFreshToken() {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      if (!refreshToken) throw new ApiError(401, "NO_REFRESH", "No refresh token");
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) throw new ApiError(res.status, "REFRESH_FAILED", "Refresh failed");
      const data = await res.json();
      const remembered = localStorage.getItem(REMEMBER_KEY) === "1";
      saveTokens(data.accessToken, data.refreshToken, remembered);
      return data;
    })();
    try { return await refreshInFlight; } finally { refreshInFlight = null; }
  }

  function qs(params) {
    if (!params) return "";
    const parts = [];
    for (const [k, v] of Object.entries(params)) {
      if (v === null || v === undefined || v === "") continue;
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
    return parts.length ? `?${parts.join("&")}` : "";
  }

  const get = (p, o) => rawFetch(p, { method: "GET" }, o);
  const post = (p, b, o) => rawFetch(p, { method: "POST", body: b ? JSON.stringify(b) : undefined }, o);
  const put = (p, b, o) => rawFetch(p, { method: "PUT", body: b ? JSON.stringify(b) : undefined }, o);
  const patch = (p, b, o) => rawFetch(p, { method: "PATCH", body: b ? JSON.stringify(b) : undefined }, o);
  const del = (p, o) => rawFetch(p, { method: "DELETE" }, o);

  loadTokens();

  return {
    loadTokens,
    hasSession: () => !!refreshToken,
    clearTokens,
    getAccessToken: () => accessToken,
    getBaseUrl: () => BASE_URL,

    auth: {
      async login(email, password, remember) {
        const data = await post("/auth/login", { email, password }, { skipAuth: true });
        saveTokens(data.accessToken, data.refreshToken, !!remember);
        return data;
      },
      async logout() {
        try {
          if (refreshToken) await post("/auth/logout", { refreshToken });
        } catch { }
        clearTokens();
      },
      async me() {
        const data = await get("/auth/me");
        return data.user;
      },
      async changePassword(currentPassword, newPassword) {
        return post("/auth/change-password", { currentPassword, newPassword });
      },
    },

    volunteers: {
      list: (params) => get(`/volunteers${qs(params)}`),
      get: async (id) => (await get(`/volunteers/${id}`)).volunteer,
      create: async (p) => (await post("/volunteers", p)).volunteer,
      update: async (id, p) => (await patch(`/volunteers/${id}`, p)).volunteer,
      archive: async (id) => (await del(`/volunteers/${id}`)).volunteer,
      restore: async (id) => (await post(`/volunteers/${id}/restore`)).volunteer,
      transfer: async (id, toCommitteeId, reason) =>
        (await post(`/volunteers/${id}/transfer`, { toCommitteeId, reason })).volunteer,
      importRows: (rows) => post("/volunteers/import", { rows }),
      bulkTransfer: (volunteerIds, toCommitteeId, reason) =>
        post("/volunteers/bulk-transfer", { volunteerIds, toCommitteeId, reason }),
    },

    committees: {
      list: (params) => get(`/committees${qs(params)}`),
      get: async (id) => (await get(`/committees/${id}`)).committee,
      create: async (p) => (await post("/committees", p)).committee,
      update: async (id, p) => (await patch(`/committees/${id}`, p)).committee,
      archive: async (id) => (await del(`/committees/${id}`)).committee,
      restore: async (id) => (await post(`/committees/${id}/restore`)).committee,
    },

    users: {
      list: () => get("/users"),
      resetPassword: (id, newPassword) => post(`/users/${id}/reset-password`, { newPassword }),
    },

    meetings: {
      list: (params) => get(`/meetings${qs(params)}`),
      get: async (id) => (await get(`/meetings/${id}`)).meeting,
      create: async (p) => (await post("/meetings", p)).meeting,
      update: async (id, p) => (await patch(`/meetings/${id}`, p)).meeting,
      delete: (id) => del(`/meetings/${id}`),
      getRoster: (id) => get(`/meetings/${id}/roster`),
      saveRoster: (id, records, markCompleted = true) =>
        post(`/meetings/${id}/roster`, { records, markMeetingCompleted: markCompleted }),
      autoHours: (id, autoApprove = false) =>
        post(`/meetings/${id}/auto-hours`, { autoApprove }),
    },

    hours: {
      list: (params) => get(`/volunteer-hours${qs(params)}`),
      get: async (id) => (await get(`/volunteer-hours/${id}`)).entry,
      create: async (p) => (await post("/volunteer-hours", p)).entry,
      update: async (id, p) => (await patch(`/volunteer-hours/${id}`, p)).entry,
      delete: (id) => del(`/volunteer-hours/${id}`),
      approve: async (id) => (await post(`/volunteer-hours/${id}/approve`)).entry,
      reject: async (id, reason) => (await post(`/volunteer-hours/${id}/reject`, { reason })).entry,
      bulkApprove: () => post("/volunteer-hours/bulk-approve"),
    },
    criteria: {
      list: async () => (await get("/evaluations/criteria")).items,
      create: async (p) => (await post("/evaluations/criteria", p)).criterion,
      update: async (id, p) => (await patch(`/evaluations/criteria/${id}`, p)).criterion,
      delete: (id) => del(`/evaluations/criteria/${id}`),
    },

    evaluations: {
      list: (params) => get(`/evaluations${qs(params)}`),
      get: async (id) => (await get(`/evaluations/${id}`)).evaluation,
      create: async (p) => (await post("/evaluations", p)).evaluation,
      update: async (id, p) => (await patch(`/evaluations/${id}`, p)).evaluation,
      delete: (id) => del(`/evaluations/${id}`),
    },

    certificates: {
      list: (params) => get(`/certificates${qs(params)}`),
      get: async (id) => (await get(`/certificates/${id}`)).certificate,
      create: async (p) => (await post("/certificates", p)).certificate,
      approve: async (id) => (await post(`/certificates/${id}/approve`)).certificate,
      revoke: async (id, reason) => (await post(`/certificates/${id}/revoke`, { reason })).certificate,
      delete: (id) => del(`/certificates/${id}`),
      verify: async (certificateNo) => (await get(`/certificates/verify/${encodeURIComponent(certificateNo)}`, { skipAuth: true })).certificate,
      downloadPdfBlob: (id) => rawFetch(`/certificates/${id}/pdf`, { method: "GET" }),
      async openPdfInNewTab(id) {
        const blob = await this.downloadPdfBlob(id);
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      },
    },

    verify: {
      check: (certificateNo) =>
        rawFetch(`/certificates/verify/${encodeURIComponent(certificateNo)}`, { method: "GET" }, { skipAuth: true }),
    },

    // =========================================================
    // Public endpoints — no authentication (application form)
    // =========================================================
    public: {
      committees: () => get("/public/committees", { skipAuth: true }),
      apply: (data) => post("/public/applications", data, { skipAuth: true }),
    },

    // =========================================================
    // Settings — Super Admin only for writes
    // =========================================================
    settings: {
      list: async () => (await get("/settings")).items,
      get: async (key) => (await get(`/settings/${encodeURIComponent(key)}`)).setting,
      set: async (key, value) =>
        (await put(`/settings/${encodeURIComponent(key)}`, { value })).setting,
      bulkUpdate: async (settingsObj) =>
        (await patch("/settings", { settings: settingsObj })).items,
    },

    // =========================================================
    // Audit Logs — read-only
    // =========================================================
    audit: {
      list: (params) => get(`/audit-logs${qs(params)}`),
      get: async (id) => (await get(`/audit-logs/${id}`)).log,
      stats: () => get("/audit-logs/stats"),
    },

    health: {
      check: () => rawFetch("/health", { method: "GET" }, { skipAuth: true }),
      ready: () => rawFetch("/health/ready", { method: "GET" }, { skipAuth: true }),
    },

    _utils: { ApiError, ensureFreshToken },
  };
})();