import { createEmptyDayPlan, normalizeDayPlan } from "./dayPlan.schema.js";

function getApiBaseUrl() {
  const base =
    process.env.NEXT_PUBLIC_TIMEBOXING_API_BASE_URL ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost"
      : "https://timeboxing-api.vercel.app");
  return base.replace(/\/+$/, "");
}

const ACCESS_TOKEN_STORAGE_KEY = "timeboxing.accessToken";

export function getStoredAccessToken() {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || "";
  } catch (_error) {
    return "";
  }
}

export function setStoredAccessToken(token) {
  if (typeof window === "undefined") return;
  try {
    if (!token) {
      localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
      return;
    }
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  } catch (_error) {
    // ignore storage failures
  }
}

export function clearStoredAccessToken() {
  setStoredAccessToken("");
}

export function getApiAuthUrl(path = "") {
  return `${getApiBaseUrl()}${path}`;
}

export function createApiDayPlanRepository() {
  const apiBaseUrl = getApiBaseUrl();

  async function safeJson(res) {
    try {
      return await res.json();
    } catch (_error) {
      return null;
    }
  }

  async function requestJson(path, init) {
    const headers = {
      ...(init?.headers ?? {}),
    };
    const accessToken = getStoredAccessToken();

    if (init?.body != null && !("Content-Type" in headers)) {
      headers["Content-Type"] = "application/json";
    }
    if (accessToken && !("Authorization" in headers)) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const res = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
    });

    if (res.status === 401) {
      const error = new Error("Unauthorized");
      error.status = 401;
      throw error;
    }

    if (!res.ok) {
      const body = await safeJson(res);
      const error = new Error(body?.error || `Request failed: ${res.status}`);
      error.status = res.status;
      throw error;
    }

    return safeJson(res);
  }

  return {
    async getAuthMe() {
      return requestJson("/auth/me", { method: "GET" });
    },

    async getBootstrap(dateYmd) {
      return requestJson(`/auth/bootstrap?dateYmd=${dateYmd}`, { method: "GET" });
    },

    async logout() {
      return requestJson("/auth/logout", { method: "POST" });
    },

    async getByDate(dateYmd) {
      const data = await requestJson(`/api/day-plans/${dateYmd}`, { method: "GET" });
      return normalizeDayPlan(data ?? createEmptyDayPlan());
    },

    /**
     * timeboxing-api `GET /api/day-plans/range` 한 번으로 기간 내 플랜 수신 (Postgres 단일 쿼리).
     * @returns {Promise<Map<string, ReturnType<normalizeDayPlan>>>}
     */
    async getByDateRangeInclusive(startYmd, endYmd) {
      const data = await requestJson(
        `/api/day-plans/range?startYmd=${encodeURIComponent(startYmd)}&endYmd=${encodeURIComponent(endYmd)}`,
        { method: "GET" }
      );
      const plans = data?.plans ?? {};
      const map = new Map();
      for (const [ymd, plan] of Object.entries(plans)) {
        map.set(ymd, normalizeDayPlan(plan));
      }
      return map;
    },

    async saveByDate(dateYmd, plan) {
      await requestJson(`/api/day-plans/${dateYmd}`, {
        method: "PUT",
        body: JSON.stringify(plan),
      });
    },

    async startExecution(dateYmd, itemId) {
      const data = await requestJson(
        `/api/day-plans/${dateYmd}/items/${encodeURIComponent(itemId)}/execution/start`,
        { method: "POST" }
      );
      return data?.item ?? null;
    },

    async stopExecution(dateYmd, itemId) {
      const data = await requestJson(
        `/api/day-plans/${dateYmd}/items/${encodeURIComponent(itemId)}/execution/stop`,
        { method: "POST" }
      );
      return data?.item ?? null;
    },

    async listMarkedDatesInMonth(year, month) {
      const data = await requestJson(`/api/day-plans/marked/month?year=${year}&month=${month}`, {
        method: "GET",
      });
      return Array.isArray(data?.dates) ? data.dates : [];
    },

    async listMarkedDatesInRange(startYmd, endYmd) {
      const data = await requestJson(
        `/api/day-plans/marked/range?startYmd=${startYmd}&endYmd=${endYmd}`,
        { method: "GET" }
      );
      return Array.isArray(data?.dates) ? data.dates : [];
    },

    async listRepeatingTemplates() {
      const data = await requestJson("/api/repeating-templates", { method: "GET" });
      return Array.isArray(data?.templates) ? data.templates : [];
    },

    async createRepeatingTemplate(input) {
      const data = await requestJson("/api/repeating-templates", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return data?.template ?? null;
    },

    async updateRepeatingTemplate(templateId, input) {
      const data = await requestJson(`/api/repeating-templates/${templateId}`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
      return data?.template ?? null;
    },

    async deleteRepeatingTemplate(templateId) {
      await requestJson(`/api/repeating-templates/${templateId}`, {
        method: "DELETE",
      });
    },
  };
}
