import { createEmptyDayPlan, normalizeDayPlan } from "./dayPlan.schema.js";

function getApiBaseUrl() {
  const base =
    process.env.NEXT_PUBLIC_TIMEBOXING_API_BASE_URL ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost"
      : "https://timeboxing-api.vercel.app");
  return base.replace(/\/+$/, "");
}

function getAuthProxyBaseUrl() {
  return "/api/proxy";
}

export function getApiAuthUrl(path = "") {
  return `${getAuthProxyBaseUrl()}${path}`;
}

export function createApiDayPlanRepository() {
  const apiBaseUrl = getApiBaseUrl();
  const authProxyBaseUrl = getAuthProxyBaseUrl();

  async function safeJson(res) {
    try {
      return await res.json();
    } catch (_error) {
      return null;
    }
  }

  async function requestJson(baseUrl, path, init, options = {}) {
    const headers = {
      ...(init?.headers ?? {}),
    };

    if (init?.body != null && !("Content-Type" in headers)) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      credentials: "include",
      ...(options.mode ? { mode: options.mode } : {}),
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
      return requestJson(authProxyBaseUrl, "/auth/me", { method: "GET" });
    },

    async logout() {
      return requestJson(authProxyBaseUrl, "/auth/logout", { method: "POST" });
    },

    async getByDate(dateYmd) {
      const data = await requestJson(apiBaseUrl, `/api/day-plans/${dateYmd}`, { method: "GET" }, {
        mode: "cors",
      });
      return normalizeDayPlan(data ?? createEmptyDayPlan());
    },

    async saveByDate(dateYmd, plan) {
      await requestJson(
        apiBaseUrl,
        `/api/day-plans/${dateYmd}`,
        {
          method: "PUT",
          body: JSON.stringify(plan),
        },
        { mode: "cors" }
      );
    },

    async listMarkedDatesInMonth(year, month) {
      const data = await requestJson(
        apiBaseUrl,
        `/api/day-plans/marked/month?year=${year}&month=${month}`,
        { method: "GET" },
        { mode: "cors" }
      );
      return Array.isArray(data?.dates) ? data.dates : [];
    },

    async listMarkedDatesInRange(startYmd, endYmd) {
      const data = await requestJson(
        apiBaseUrl,
        `/api/day-plans/marked/range?startYmd=${startYmd}&endYmd=${endYmd}`,
        { method: "GET" },
        { mode: "cors" }
      );
      return Array.isArray(data?.dates) ? data.dates : [];
    },
  };
}
