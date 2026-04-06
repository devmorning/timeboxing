import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  it("날짜 버튼 클릭 시 인라인 캘린더가 열린다", async () => {
    render(<PageClient {...initialProps} />);

    const panel = screen.getByTestId("inline-calendar-panel");
    expect(panel.className).toContain("max-h-0");

    fireEvent.click(screen.getByLabelText("날짜 선택 열기"));

    await waitFor(() => {
      expect(panel.className).toContain("max-h-[calc(100dvh-4rem)]");
    });
  });

  it("시간/내용 입력에 포커스 후에도 날짜 버튼으로 캘린더를 열 수 있다", async () => {
    render(<PageClient {...initialProps} />);

    const contentInput = await screen.findByPlaceholderText("예: 고객 피드백 정리");
    contentInput.focus();
    fireEvent.change(contentInput, { target: { value: "테스트 일정" } });

    const panel = screen.getByTestId("inline-calendar-panel");
    fireEvent.click(screen.getByLabelText("날짜 선택 열기"));
    await waitFor(() => {
      expect(panel.className).toContain("max-h-[calc(100dvh-4rem)]");
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
});
