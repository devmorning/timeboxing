import "@testing-library/jest-dom";

// 테스트 시 API 베이스 URL(실제 서버 없이도 일관되게)
process.env.NEXT_PUBLIC_TIMEBOXING_API_BASE_URL = "http://localhost";

global.fetch = jest.fn(async (input, init = {}) => {
  const url = typeof input === "string" ? input : input?.url ?? "";

  if (url.includes("/auth/me")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        authenticated: true,
        user: { id: "test-user", email: "test@example.com", name: "테스트 사용자" },
      }),
    };
  }

  if (url.includes("/auth/bootstrap")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        authenticated: true,
        user: { id: "test-user", email: "test@example.com", name: "테스트 사용자" },
        plan: {
          important3: ["", "", ""],
          brainDump: "",
          items: [],
        },
      }),
    };
  }

  if (url.includes("/auth/logout")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    };
  }

  if (url.includes("/api/day-plans/marked/")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ dates: [] }),
    };
  }

  if (init.method === "PUT") {
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    };
  }

  if (url.includes("/execution/start")) {
    const m = url.match(/\/items\/([^/]+)\/execution\/start/);
    const itemId = m ? decodeURIComponent(m[1]) : "test-item";
    return {
      ok: true,
      status: 200,
      json: async () => ({
        item: {
          id: itemId,
          executedSeconds: 0,
          executionStartedAt: new Date().toISOString(),
          done: true,
        },
      }),
    };
  }

  if (url.includes("/execution/stop")) {
    const m = url.match(/\/items\/([^/]+)\/execution\/stop/);
    const itemId = m ? decodeURIComponent(m[1]) : "test-item";
    return {
      ok: true,
      status: 200,
      json: async () => ({
        item: {
          id: itemId,
          executedSeconds: 60,
          executionStartedAt: null,
          done: false,
        },
      }),
    };
  }

  if (url.includes("/api/day-plans/")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        important3: ["", "", ""],
        brainDump: "",
        items: [],
      }),
    };
  }

  return {
    ok: true,
    status: 200,
    json: async () => ({}),
  };
});

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: jest.fn(),
});

Object.defineProperty(window, "requestAnimationFrame", {
  writable: true,
  value: (cb) => setTimeout(cb, 0),
});

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
