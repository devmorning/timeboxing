import { cookies, headers } from "next/headers";
import PageClient from "./PageClient.jsx";
import { createEmptyDayPlan, normalizeDayPlan } from "../components/timeboxing/storage/dayPlan.schema.js";

async function getApiBaseUrl() {
  const headerStore = await headers();
  const proto = headerStore.get("x-forwarded-proto") || "http";
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
  if (!host) return "/api/proxy";
  return `${proto}://${host}/api/proxy`;
}

function toLocalYmd(d) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

async function fetchWithCookies(path) {
  const cookieStore = await cookies();
  const apiBaseUrl = await getApiBaseUrl();
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ');

  const res = await fetch(`${apiBaseUrl}${path}`, {
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
  const bootstrap = await fetchWithCookies(`/auth/bootstrap?dateYmd=${initialSelectedDate}`);
  const initialAuthUser = bootstrap?.authenticated ? bootstrap.user : null;
  const initialPlan = initialAuthUser?.id
    ? normalizeDayPlan(bootstrap?.plan ?? createEmptyDayPlan())
    : createEmptyDayPlan();

  return (
    <PageClient
      initialAuthUser={initialAuthUser}
      initialSelectedDate={initialSelectedDate}
      initialPlan={initialPlan}
    />
  );
}
