import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PageClient from "../app/PageClient.jsx";

const initialProps = {
  initialAuthUser: { id: "test-user", email: "test@example.com", name: "테스트 사용자" },
  initialSelectedDate: "2026-03-31",
  initialPlan: {
    important3: ["", "", ""],
    brainDump: "",
    items: [],
  },
};

describe("인라인 캘린더 열기", () => {
  const swipeLeft = async (target) => {
    fireEvent.touchStart(target, { touches: [{ clientX: 220, clientY: 240 }] });
    fireEvent.touchMove(target, { touches: [{ clientX: 120, clientY: 240 }] });
    fireEvent.touchEnd(target, { changedTouches: [{ clientX: 120, clientY: 240 }] });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 320));
    });
  };

  it("날짜 버튼 클릭 시 인라인 캘린더가 열린다", async () => {
    render(<PageClient {...initialProps} />);

    expect(screen.getByTestId("inline-calendar-panel").className).toContain("grid-rows-[0fr]");

    const expandBtn = screen.getByLabelText("날짜 패널 펼치기");
    expect(expandBtn).not.toBeDisabled();

    await act(async () => {
      expandBtn.click();
      // jest.setup.js: requestAnimationFrame → setTimeout(0)
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByTestId("inline-calendar-panel").className).toContain("grid-rows-[1fr]");
  });

  it("시간/내용 입력에 포커스 후에도 날짜 버튼으로 캘린더를 열 수 있다", async () => {
    render(<PageClient {...initialProps} />);

    fireEvent.click(screen.getByLabelText("일정 추가"));
    const contentInput = await screen.findByPlaceholderText("예: 고객 피드백 정리");
    contentInput.focus();
    fireEvent.change(contentInput, { target: { value: "테스트 일정" } });

    fireEvent.click(screen.getByLabelText("날짜 패널 펼치기"));
    await waitFor(() => {
      expect(screen.getByTestId("inline-calendar-panel").className).toContain("grid-rows-[1fr]");
    });
  });

  it("브레인덤프 영역에서 좌측 스와이프하면 다음날로 이동한다", async () => {
    render(<PageClient {...initialProps} />);

    const dateToggleBefore = screen.getByLabelText(/날짜 선택 열기 — 2026년 3월 31일/);
    expect(dateToggleBefore).toBeInTheDocument();

    const brainDump = document.getElementById("brain_dump");
    expect(brainDump).toBeTruthy();
    if (!brainDump) return;
    await swipeLeft(brainDump);

    await waitFor(() => {
      expect(screen.getByLabelText(/날짜 선택 열기 — 2026년 4월 1일/)).toBeInTheDocument();
    });
  });

  it("일정 목록 영역에서 좌측 스와이프하면 다음날로 이동한다", async () => {
    render(<PageClient {...initialProps} />);

    const scheduleSection = screen.getByLabelText("일정 목록");
    await swipeLeft(scheduleSection);

    await waitFor(() => {
      expect(screen.getByLabelText(/날짜 선택 열기 — 2026년 4월 1일/)).toBeInTheDocument();
    });
  });

  it("통계 버튼 클릭 시 일자별 통계 모달이 열린다", async () => {
    render(<PageClient {...initialProps} />);

    const statsBtn = screen.getByLabelText("일자별 통계 열기");
    expect(statsBtn).toBeVisible();

    fireEvent.click(statsBtn);

    await waitFor(() => {
      expect(screen.getByText("계획(종료−시작) 대비 실행 시간 달성률")).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "일정별 달성" })).toBeInTheDocument();
  });

  it("하단 통계·리포트 FAB가 표시되고 리포트 모달을 연다", async () => {
    render(<PageClient {...initialProps} />);

    const reportBtn = screen.getByLabelText("일정 리포트 열기");
    expect(screen.getByLabelText("일자별 통계 열기")).toBeVisible();
    expect(reportBtn).toBeVisible();

    fireEvent.click(reportBtn);

    await waitFor(() => {
      expect(screen.getByText("시간 + 내용")).toBeInTheDocument();
    });
  });

  it("날짜 이동 후 데이터 fetch 중에는 스켈레톤을 보여준다", async () => {
    jest.useFakeTimers();
    const originalFetch = global.fetch;

    const toLocalYmd = (d) => {
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yy}-${mm}-${dd}`;
    };
    const todayYmd = toLocalYmd(new Date());

    global.fetch = jest.fn((input, init = {}) => {
      const url = typeof input === "string" ? input : input?.url ?? "";
      if (url.includes(`/api/day-plans/${todayYmd}`)) {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: async () => ({
                important3: ["", "", ""],
                brainDump: "",
                items: [],
              }),
            });
          }, 250);
        });
      }
      return originalFetch(input, init);
    });

    render(<PageClient {...initialProps} />);

    fireEvent.click(screen.getByLabelText("날짜 패널 펼치기"));
    const goTodayBtn = await screen.findByRole("button", { name: /오늘 날짜로 이동/ });
    fireEvent.click(goTodayBtn);

    await waitFor(() => {
      expect(screen.getByRole("status", { name: "하루 불러오는 중" })).toBeInTheDocument();
    });

    await act(async () => {
      jest.advanceTimersByTime(1200);
    });

    await waitFor(() => {
      expect(screen.queryByRole("status", { name: "하루 불러오는 중" })).not.toBeInTheDocument();
    });

    global.fetch = originalFetch;
    jest.useRealTimers();
  });
});
