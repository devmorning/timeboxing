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

describe("빠른 일정 + 실행", () => {
  it("하단 지금 버튼으로 일정이 생성된다", async () => {
    render(<PageClient {...initialProps} />);

    fireEvent.click(screen.getByTestId("quick-schedule-run"));

    await waitFor(() => {
      expect(screen.getByText(/지금 집중 ·/)).toBeInTheDocument();
    });
  });
});
