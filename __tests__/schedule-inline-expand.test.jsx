import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
  it("항목 클릭 시 일정 수정 모달 대신 인라인 제어(타이머 시작/중지)가 열린다", () => {
    render(<PageClient {...initialProps} />);

    expect(screen.queryByRole("button", { name: "타이머 시작" })).not.toBeInTheDocument();
    expect(screen.queryByText("일정 수정")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("테스트 일정"));

    expect(screen.getByRole("button", { name: "타이머 시작" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "타이머 중지" })).toBeInTheDocument();
    expect(screen.queryByText("일정 수정")).not.toBeInTheDocument();
  });

  it("타이머 시작 후 중지 버튼이 활성화된다", () => {
    render(<PageClient {...initialProps} />);

    fireEvent.click(screen.getByText("테스트 일정"));
    const startBtn = screen.getByRole("button", { name: "타이머 시작" });
    const stopBtn = screen.getByRole("button", { name: "타이머 중지" });

    expect(startBtn).toBeEnabled();
    expect(stopBtn).toBeDisabled();

    fireEvent.click(startBtn);

    expect(screen.getByRole("button", { name: "타이머 시작" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "타이머 중지" })).toBeEnabled();
  });
});
