import { createMemoryDayPlanRepository } from "./dayPlan.memoryRepository.js";
import { createApiDayPlanRepository } from "./dayPlan.apiRepository.js";

let repository = null;

export function getDayPlanRepository() {
  if (repository) return repository;

  if (typeof window !== "undefined" && typeof fetch === "function") {
    repository = createApiDayPlanRepository();
  } else {
    repository = createMemoryDayPlanRepository();
  }

  return repository;
}
