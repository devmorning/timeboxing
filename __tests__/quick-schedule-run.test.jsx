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
        id: "item-0",
        startTime: "08:00",
        endTime: "08:30",
        content: "기존 일정",
        done: false,
        executedSeconds: 0,
      },
    ],
  },
};

describe("일정 추가 모달: 추가 후 실행", () => {
  beforeEach(() => {
    jest.spyOn(crypto, "randomUUID").mockReturnValue("local-test-new-item");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("내용 입력 후 추가·실행 버튼으로 항목이 생기고 타이머가 시작된다", async () => {
    render(<PageClient {...initialProps} />);

    fireEvent.click(screen.getByRole("button", { name: "일정 추가" }));

    const input = await screen.findByPlaceholderText("예: 고객 피드백 정리");
    fireEvent.change(input, { target: { value: "모달 추가 실행 테스트" } });

    fireEvent.click(screen.getByTestId("schedule-add-and-run"));

    await waitFor(() => {
      expect(screen.getByText("모달 추가 실행 테스트")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("모달 추가 실행 테스트"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^타이머 중지/ })).toBeInTheDocument();
    });
  });
});
