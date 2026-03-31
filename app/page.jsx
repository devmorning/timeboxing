import { cookies } from "next/headers";
import PageClient from "./PageClient.jsx";
import { createEmptyDayPlan, normalizeDayPlan } from "../components/timeboxing/storage/dayPlan.schema.js";

function getApiBaseUrl() {
  const base =
    process.env.NEXT_PUBLIC_TIMEBOXING_API_BASE_URL ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost"
      : "https://timeboxing-api.vercel.app");
  return base.replace(/\/+$/, "");
}

function toLocalYmd(d) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

async function fetchWithCookies(path) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ');

  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
    cache: "no-store",
  });

  if (!res.ok) return null;
  try {
    return await res.json();
  } catch (_error) {
    return null;
  }
}

export default async function Page() {
  const initialSelectedDate = toLocalYmd(new Date());
  const auth = await fetchWithCookies('/auth/me');
  const initialAuthUser = auth?.authenticated ? auth.user : null;

  let initialPlan = createEmptyDayPlan();
  if (initialAuthUser?.id) {
    const plan = await fetchWithCookies(`/api/day-plans/${initialSelectedDate}`);
    initialPlan = normalizeDayPlan(plan ?? createEmptyDayPlan());
  }

  return (
    <PageClient
      initialAuthUser={initialAuthUser}
      initialSelectedDate={initialSelectedDate}
      initialPlan={initialPlan}
    />
  );
}
