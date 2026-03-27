import { createEmptyDayPlan, hasDayPlanContent, normalizeDayPlan } from "./dayPlan.schema.js";

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
    async listMarkedDatesInMonth(year, month) {
      const mm = String(month).padStart(2, "0");
      const prefix = `${year}-${mm}-`;
      const result = [];

      store.forEach((value, key) => {
        if (!key.startsWith(prefix)) return;
        if (hasDayPlanContent(value)) result.push(key);
      });

      return result;
    },
    async listMarkedDatesInRange(startYmd, endYmd) {
      const result = [];
      store.forEach((value, key) => {
        if (key < startYmd || key > endYmd) return;
        if (hasDayPlanContent(value)) result.push(key);
      });
      return result;
    },
  };
}
