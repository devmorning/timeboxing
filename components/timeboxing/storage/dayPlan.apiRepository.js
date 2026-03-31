import { createEmptyDayPlan, normalizeDayPlan } from "./dayPlan.schema.js";

function getApiBaseUrl() {
  const base =
    process.env.NEXT_PUBLIC_TIMEBOXING_API_BASE_URL ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost"
      : "https://timeboxing-api.vercel.app");
  return base.replace(/\/+$/, "");
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
    const res = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      mode: "cors",
      credentials: "include",
      headers: {
        ...(init?.headers ?? {}),
        "Content-Type": "application/json",
      },
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

    async logout() {
      return requestJson("/auth/logout", { method: "POST" });
    },

    async getByDate(dateYmd) {
      const data = await requestJson(`/api/day-plans/${dateYmd}`, { method: "GET" });
      return normalizeDayPlan(data ?? createEmptyDayPlan());
    },

    async saveByDate(dateYmd, plan) {
      await requestJson(`/api/day-plans/${dateYmd}`, {
        method: "PUT",
        body: JSON.stringify(plan),
      });
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
  };
}
