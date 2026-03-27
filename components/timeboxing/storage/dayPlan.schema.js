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
          time: typeof it.time === "string" ? it.time : "09:00",
          content: typeof it.content === "string" ? it.content : "",
        }))
        .filter((it) => it.content.trim().length > 0)
    : base.items;

  return { important3, brainDump, items };
}
