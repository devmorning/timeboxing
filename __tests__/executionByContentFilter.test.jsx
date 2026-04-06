import { createEmptyDayPlan } from "../components/timeboxing/storage/dayPlan.schema.js";
import {
  collectYmdsNeededForWeekTrend,
  listWeekDaysYmd,
  listYmDaysYmd,
  sumExecutedSecondsMatchingContentOnCalendarDay,
} from "../components/timeboxing/utils/executionByContentFilter.js";
import { getSundayOfWeekForYmd } from "../components/timeboxing/utils/dateYmd.js";

describe("executionByContentFilter", () => {
  it("listYmDaysYmd: 2026년 3월은 31일", () => {
    expect(listYmDaysYmd(2026, 3)).toHaveLength(31);
    expect(listYmDaysYmd(2026, 3)[0]).toBe("2026-03-01");
    expect(listYmDaysYmd(2026, 3)[30]).toBe("2026-03-31");
  });

  it("getSundayOfWeekForYmd / listWeekDaysYmd / collectYmdsNeededForWeekTrend", () => {
    expect(getSundayOfWeekForYmd("2026-03-04")).toBe("2026-03-01");
    expect(listWeekDaysYmd("2026-03-01")).toEqual([
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
      "2026-03-06",
      "2026-03-07",
    ]);
    const needed = collectYmdsNeededForWeekTrend("2026-03-01");
    expect(needed[0]).toBe("2026-02-28");
    expect(needed[needed.length - 1]).toBe("2026-03-07");
  });

  it("키워드에 맞는 일정의 당일 실행 초만 합산", () => {
    const prev = createEmptyDayPlan();
    const cur = {
      ...createEmptyDayPlan(),
      items: [
        {
          id: "a",
          startTime: "23:00",
          endTime: "07:00",
          content: "수면",
          executedSeconds: 3600,
        },
      ],
    };
    const sec = sumExecutedSecondsMatchingContentOnCalendarDay("2026-03-02", cur, prev, "수면");
    expect(sec).toBeGreaterThan(0);
  });

  it("키워드 불일치 시 0", () => {
    const cur = {
      ...createEmptyDayPlan(),
      items: [
        {
          id: "a",
          startTime: "09:00",
          endTime: "10:00",
          content: "회의",
          executedSeconds: 1800,
        },
      ],
    };
    const sec = sumExecutedSecondsMatchingContentOnCalendarDay(
        "2026-03-01",
        cur,
        createEmptyDayPlan(),
        "수면"
    );
    expect(sec).toBe(0);
  });
});
