import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Page from "../app/page.jsx";

describe("인라인 캘린더 열기", () => {
  it("날짜 버튼 클릭 시 인라인 캘린더가 열린다", async () => {
    render(<Page />);

    const panel = screen.getByTestId("inline-calendar-panel");
    expect(panel.className).toContain("max-h-0");

    fireEvent.click(screen.getByLabelText("날짜 선택 열기"));

    await waitFor(() => {
      expect(panel.className).toContain("max-h-[calc(100dvh-4rem)]");
    });
  });

  it("시간/내용 입력에 포커스 후에도 날짜 버튼으로 캘린더를 열 수 있다", async () => {
    render(<Page />);

    const contentInput = await screen.findByPlaceholderText("예: 09:00 - 고객 피드백 정리");
    contentInput.focus();
    fireEvent.change(contentInput, { target: { value: "테스트 일정" } });

    const panel = screen.getByTestId("inline-calendar-panel");
    fireEvent.click(screen.getByLabelText("날짜 선택 열기"));
    await waitFor(() => {
      expect(panel.className).toContain("max-h-[calc(100dvh-4rem)]");
    });
  });
});
