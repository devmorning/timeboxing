import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import TimeRangeSelectors from "../app/components/timeboxing/TimeRangeSelectors.jsx";

const STEP = 300;

function snapLocalNowToStep(d) {
  const totalSec = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  const rounded = Math.round(totalSec / STEP) * STEP;
  const wrapped = ((rounded % 86400) + 86400) % 86400;
  const h = Math.floor(wrapped / 3600);
  const m = Math.floor((wrapped % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function endFromStartAndDuration(startHHMM, durationMin) {
  const [sh, sm] = startHHMM.split(":").map(Number);
  const a = sh * 3600 + sm * 60;
  const addSec = durationMin * 60;
  const endSec = (a + addSec) % 86400;
  const h = Math.floor(endSec / 3600);
  const min = Math.floor((endSec % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function Harness({ initialStart = "09:00", initialEnd = "09:30", disabled = false }) {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  return (
    <TimeRangeSelectors
      startTime={start}
      endTime={end}
      onChangeStartTime={setStart}
      onChangeEndTime={setEnd}
      disabled={disabled}
    />
  );
}

describe("TimeRangeSelectors — 지금 맞춤", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("버튼 클릭 시 시작 시각이 5분 단위로 스냅된 현재 시각으로 바뀌고 구간 유지로 종료가 갱신된다", () => {
    const frozen = new Date(2026, 3, 10, 14, 37, 22);
    jest.setSystemTime(frozen);
    const expectedStart = snapLocalNowToStep(frozen);
    const expectedEnd = endFromStartAndDuration(expectedStart, 30);

    render(<Harness initialStart="09:00" initialEnd="09:30" />);

    fireEvent.click(screen.getByRole("button", { name: "시작 시간을 현재 시각으로 맞추기" }));

    expect(screen.getByLabelText("시작 시간 선택")).toHaveValue(expectedStart);
    expect(screen.getByLabelText("종료 시간 선택")).toHaveValue(expectedEnd);
  });

  it("disabled일 때 버튼이 비활성화되고 클릭해도 onChangeStartTime이 호출되지 않는다", () => {
    jest.setSystemTime(new Date(2026, 3, 10, 12, 0, 0));
    const onStart = jest.fn();

    render(
      <TimeRangeSelectors
        startTime="09:00"
        endTime="09:30"
        onChangeStartTime={onStart}
        onChangeEndTime={jest.fn()}
        disabled
      />
    );

    const btn = screen.getByRole("button", { name: "시작 시간을 현재 시각으로 맞추기" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("시스템 시각이 바뀐 뒤 다시 누르면 새 스냅 시각이 반영된다", () => {
    jest.setSystemTime(new Date(2026, 3, 10, 15, 0, 0));
    render(<Harness initialStart="09:00" initialEnd="09:30" />);
    const btn = screen.getByRole("button", { name: "시작 시간을 현재 시각으로 맞추기" });

    fireEvent.click(btn);
    expect(screen.getByLabelText("시작 시간 선택")).toHaveValue("15:00");

    jest.setSystemTime(new Date(2026, 3, 10, 15, 7, 0));
    fireEvent.click(btn);
    expect(screen.getByLabelText("시작 시간 선택")).toHaveValue("15:05");
  });
});
