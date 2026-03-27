import { DAY_PLAN_STORE_NAME, createEmptyDayPlan, normalizeDayPlan } from "./dayPlan.schema.js";

const DB_NAME = "timeboxing_app";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DAY_PLAN_STORE_NAME)) {
        db.createObjectStore(DAY_PLAN_STORE_NAME, { keyPath: "date" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
  });
}

function withStore(db, mode, callback) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DAY_PLAN_STORE_NAME, mode);
    const store = tx.objectStore(DAY_PLAN_STORE_NAME);

    let settled = false;
    tx.oncomplete = () => {
      if (!settled) resolve(undefined);
    };
    tx.onerror = () => {
      if (!settled) reject(tx.error || new Error("IndexedDB transaction failed"));
    };
    tx.onabort = () => {
      if (!settled) reject(tx.error || new Error("IndexedDB transaction aborted"));
    };

    callback(store, (value) => {
      settled = true;
      resolve(value);
    }, (error) => {
      settled = true;
      reject(error);
    });
  });
}

export function createIndexedDbDayPlanRepository() {
  let dbPromise = null;

  const getDb = () => {
    if (!dbPromise) dbPromise = openDb();
    return dbPromise;
  };

  return {
    async getByDate(dateYmd) {
      const db = await getDb();
      const row = await withStore(
        db,
        "readonly",
        (store, done, fail) => {
          const req = store.get(dateYmd);
          req.onsuccess = () => done(req.result ?? null);
          req.onerror = () => fail(req.error || new Error("IndexedDB read failed"));
        }
      );

      if (!row) return createEmptyDayPlan();
      return normalizeDayPlan(row);
    },
    async saveByDate(dateYmd, plan) {
      const db = await getDb();
      const normalized = normalizeDayPlan(plan);
      const payload = {
        date: dateYmd,
        ...normalized,
        updatedAt: new Date().toISOString(),
      };

      await withStore(
        db,
        "readwrite",
        (store, done, fail) => {
          const req = store.put(payload);
          req.onsuccess = () => done(undefined);
          req.onerror = () => fail(req.error || new Error("IndexedDB write failed"));
        }
      );
    },
  };
}
