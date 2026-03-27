export default function Card({ children, className = "", padding = true }) {
  return (
    <div
      className={[
        "w-full max-w-full overflow-hidden rounded-[16px] bg-white shadow-sm ring-1 ring-black/5",
        padding ? "p-0" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

