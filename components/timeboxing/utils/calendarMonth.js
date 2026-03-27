/** @param {string} ym `YYYY-MM` */
export function buildMonthKeys(centerYm, past = 12, future = 12) {
  const [y, m] = centerYm.split("-").map(Number);
  const keys = [];
  for (let i = -past; i <= future; i += 1) {
    const d = new Date(y, m - 1 + i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

/** @param {string} ym `YYYY-MM` */
export function getCellsForMonth(ym) {
  const [year, month] = ym.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const total = 42;
  const cells = [];
  for (let idx = 0; idx < total; idx += 1) {
    const day = idx - startWeekday + 1;
    if (day < 1 || day > daysInMonth) {
      cells.push(null);
      continue;
    }
    const dateYmd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ day, dateYmd });
  }
  return cells;
}

/** @param {string} ym `YYYY-MM` */
export function formatMonthTitle(ym) {
  const [year, month] = ym.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
  });
}

/** 월 키 배열로 IndexedDB 범위 조회용 `YYYY-MM-DD` 구간 */
export function getRangeYmdBounds(monthKeys) {
  if (!monthKeys?.length) return null;
  const firstYm = monthKeys[0];
  const lastYm = monthKeys[monthKeys.length - 1];
  const [ly, lm] = lastYm.split("-").map(Number);
  const lastDay = new Date(ly, lm, 0).getDate();
  return {
    startYmd: `${firstYm}-01`,
    endYmd: `${lastYm}-${String(lastDay).padStart(2, "0")}`,
  };
}
