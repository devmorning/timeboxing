import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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

describe("인접 날 캐러셀 프리뷰", () => {
  it("캐러셀 모드에서 전날·다음날 날짜 카드(aria-label)가 DOM에 노출된다", async () => {
    render(<PageClient {...initialProps} />);

    await waitFor(
      () => {
        const cards = screen.queryAllByLabelText(/^날짜 미리보기 —/);
        expect(cards.length).toBeGreaterThanOrEqual(2);
      },
      { timeout: 4000 }
    );
  });

  it("전날 미리보기 카드에 선택일 이전 날짜가 표시된다", async () => {
    render(<PageClient {...initialProps} />);

    await waitFor(
      () => {
        expect(screen.getAllByLabelText(/^날짜 미리보기 —/).length).toBeGreaterThanOrEqual(2);
      },
      { timeout: 4000 }
    );

    const labels = screen
        .getAllByLabelText(/^날짜 미리보기 —/)
        .map((el) => el.getAttribute("aria-label") ?? "");

    // 2026-03-31 기준 전날 = 30일
    expect(labels.some((t) => t.includes("30일"))).toBe(true);
  });
});
