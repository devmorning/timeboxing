import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PageClient from "../app/PageClient.jsx";

const initialProps = {
  initialAuthUser: { id: "test-user", email: "test@example.com", name: "테스트 사용자" },
  initialSelectedDate: "2026-03-31",
  initialPlan: {
    important3: ["", "", ""],
    brainDump: "",
    items: [
      {
        id: "item-1",
        startTime: "09:00",
        endTime: "09:30",
        content: "테스트 일정",
        done: false,
        executedSeconds: 0,
      },
    ],
  },
};

describe("일정 항목 인라인 확장", () => {
  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: true });
    jest.setSystemTime(new Date("2026-03-31T12:00:00"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("항목 클릭 시 일정 수정 모달 대신 인라인 타이머 토글이 열린다", () => {
    render(<PageClient {...initialProps} />);

    expect(screen.queryByRole("button", { name: "타이머 시작" })).not.toBeInTheDocument();
    expect(screen.queryByText("일정 수정")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("테스트 일정"));

    expect(screen.getByRole("button", { name: "타이머 시작" })).toBeInTheDocument();
    expect(screen.queryByText("일정 수정")).not.toBeInTheDocument();
  });

  it("타이머 토글 버튼이 시작/중지로 전환된다", () => {
    render(<PageClient {...initialProps} />);

    fireEvent.click(screen.getByText("테스트 일정"));
    const startBtn = screen.getByRole("button", { name: "타이머 시작" });

    expect(startBtn).toBeEnabled();

    fireEvent.click(startBtn);

    expect(screen.getByRole("button", { name: "타이머 중지" })).toBeEnabled();
  });

  it("인라인 삭제 버튼 클릭 시 항목이 제거된다", () => {
    render(<PageClient {...initialProps} />);

    fireEvent.click(screen.getByText("테스트 일정"));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect(screen.queryByText("테스트 일정")).not.toBeInTheDocument();
  });

  it("펼친 영역에서 내용을 수정하면 바로 목록에 반영된다", async () => {
    render(<PageClient {...initialProps} />);

    fireEvent.click(screen.getByText("테스트 일정"));

    const inputs = screen.getAllByPlaceholderText("예: 고객 피드백 정리");
    const inlineInput = inputs[inputs.length - 1];
    fireEvent.change(inlineInput, { target: { value: "인라인에서 수정한 일정" } });

    await waitFor(() => {
      expect(screen.getByText("인라인에서 수정한 일정")).toBeInTheDocument();
    });
  });

  it("항목을 펼치기 전에는 종료 버튼이 없고, 펼치면 보인다", () => {
    render(<PageClient {...initialProps} />);

    expect(screen.queryByTestId("schedule-item-end-extend")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("테스트 일정"));

    const endBtn = screen.getByTestId("schedule-item-end-extend");
    expect(endBtn).toBeInTheDocument();
    expect(endBtn).toBeVisible();
  });

  it("종료 버튼: 계획 종료보다 늦은 시각이면 종료 시각을 지금으로 맞춘다", async () => {
    jest.setSystemTime(new Date("2026-03-31T14:15:30"));

    render(<PageClient {...initialProps} />);

    fireEvent.click(screen.getByText("테스트 일정"));
    fireEvent.click(screen.getByTestId("schedule-item-end-extend"));

    await waitFor(() => {
      expect(screen.getByText(/09:00\s*–\s*14:15/)).toBeInTheDocument();
    });
  });

  it("종료 버튼: 타이머 실행 중이면 먼저 중지하고 종료 시각을 연장한다", async () => {
    jest.setSystemTime(new Date("2026-03-31T14:15:30"));

    render(<PageClient {...initialProps} />);

    fireEvent.click(screen.getByText("테스트 일정"));
    fireEvent.click(screen.getByRole("button", { name: "타이머 시작" }));

    expect(screen.getByRole("button", { name: "타이머 중지" })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("schedule-item-end-extend"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "타이머 시작" })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/09:00\s*–\s*14:15/)).toBeInTheDocument();
    });
  });
});
