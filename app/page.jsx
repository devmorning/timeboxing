import PageClient from "./PageClient.jsx";

function toLocalYmd(d) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export default async function Page() {
  const initialSelectedDate = toLocalYmd(new Date());

  return (
    <PageClient
      initialAuthUser={null}
      initialSelectedDate={initialSelectedDate}
      initialPlan={null}
    />
  );
}
