export const DAY_PLAN_STORE_NAME = "day_plans";

export function createEmptyDayPlan() {
  return {
    important3: ["", "", ""],
    brainDump: "",
    items: [],
  };
}

export function normalizeDayPlan(input) {
  const base = createEmptyDayPlan();
  if (!input || typeof input !== "object") return base;

  const important3 = Array.isArray(input.important3)
    ? input.important3.slice(0, 3).map((v) => (typeof v === "string" ? v : ""))
    : base.important3;
  while (important3.length < 3) important3.push("");

  const brainDump = typeof input.brainDump === "string" ? input.brainDump : "";

  const items = Array.isArray(input.items)
    ? input.items
        .filter((it) => it && typeof it === "object")
        .map((it) => ({
          id: typeof it.id === "string" ? it.id : `${Date.now()}_${Math.random().toString(16).slice(2)}`,
          startTime:
            typeof it.startTime === "string"
              ? it.startTime
              : typeof it.time === "string"
                ? it.time
                : "09:00",
          endTime: typeof it.endTime === "string" ? it.endTime : "",
          content: typeof it.content === "string" ? it.content : "",
          done: typeof it.done === "boolean" ? it.done : false,
          executedSeconds:
            typeof it.executedSeconds === "number" && Number.isFinite(it.executedSeconds)
              ? Math.max(0, Math.floor(it.executedSeconds))
              : typeof it.executionSeconds === "number" && Number.isFinite(it.executionSeconds)
                ? Math.max(0, Math.floor(it.executionSeconds))
                : 0,
          executionStartedAt:
            typeof it.executionStartedAt === "string" && it.executionStartedAt.length > 0
              ? it.executionStartedAt
              : null,
        }))
        .filter((it) => it.content.trim().length > 0)
    : base.items;

  return { important3, brainDump, items };
}

export function hasDayPlanContent(input) {
  const plan = normalizeDayPlan(input);
  if (plan.items.length > 0) return true;
  if (plan.brainDump.trim().length > 0) return true;
  return plan.important3.some((v) => v.trim().length > 0);
}
