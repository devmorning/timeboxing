import { createEmptyDayPlan, normalizeDayPlan } from "./dayPlan.schema.js";

export function createMemoryDayPlanRepository() {
  const store = new Map();

  return {
    async getByDate(dateYmd) {
      const value = store.get(dateYmd);
      return normalizeDayPlan(value ?? createEmptyDayPlan());
    },
    async saveByDate(dateYmd, plan) {
      store.set(dateYmd, normalizeDayPlan(plan));
    },
  };
}
