import { createIndexedDbDayPlanRepository } from "./dayPlan.indexedDbRepository.js";
import { createMemoryDayPlanRepository } from "./dayPlan.memoryRepository.js";

let repository = null;

export function getDayPlanRepository() {
  if (repository) return repository;

  const canUseIndexedDb =
    typeof window !== "undefined" &&
    typeof window.indexedDB !== "undefined";

  repository = canUseIndexedDb
    ? createIndexedDbDayPlanRepository()
    : createMemoryDayPlanRepository();

  return repository;
}
