"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TextInput from "../components/textinput/TextInput.jsx";
import { addDaysToYmd } from "../components/timeboxing/utils/dateYmd.js";
import { getDayPlanRepository } from "../components/timeboxing/storage/dayPlan.repository.js";
import { hasDayPlanContent } from "../components/timeboxing/storage/dayPlan.schema.js";

export default function Page() {
  const dayPlanRepository = useMemo(() => getDayPlanRepository(), []);
  const saveTimerRef = useRef(null);

  const toLocalYmd = (d) => {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  };

  const [selectedDate, setSelectedDate] = useState(() => toLocalYmd(new Date()));

  const selectedDateLabel = useMemo(() => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  }, [selectedDate]);

  const [important3, setImportant3] = useState(["", "", ""]);
  const [brainDump, setBrainDump] = useState("");

  const [newTime, setNewTime] = useState("09:00");
  const [newContent, setNewContent] = useState("");
  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [readyDate, setReadyDate] = useState("");
  const [visibleMonthYmd, setVisibleMonthYmd] = useState(() => toLocalYmd(new Date()).slice(0, 7));
  const [markedDates, setMarkedDates] = useState(new Set());

  const canAdd = useMemo(() => {
    return newContent.trim().length > 0;
  }, [newContent]);

  const visibleMonthLabel = useMemo(() => {
    const [year, month] = visibleMonthYmd.split("-").map(Number);
    return `${year}년 ${month}월`;
  }, [visibleMonthYmd]);

  const calendarCells = useMemo(() => {
    const [year, month] = visibleMonthYmd.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    // 모달 높이 고정을 위해 항상 6주(42칸) 렌더링
    const total = 42;
    const cells = [];

    for (let idx = 0; idx < total; idx += 1) {
      const day = idx - startWeekday + 1;
      if (day < 1 || day > daysInMonth) {
        cells.push(null);
        continue;
      }

      const dateYmd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({
        day,
        dateYmd,
      });
    }

    return cells;
  }, [visibleMonthYmd]);

  const filledImportant3 = useMemo(
    () => important3.map((v) => v.trim()).filter(Boolean),
    [important3]
  );

  const editingItem = useMemo(() => {
    if (!editingId) return null;
    return items.find((it) => it.id === editingId) ?? null;
  }, [editingId, items]);

  const isEditingChanged = useMemo(() => {
    if (!editingItem) return false;
    return (
      editingItem.time !== newTime ||
      editingItem.content !== newContent.trim()
    );
  }, [editingItem, newTime, newContent]);

  const addItem = () => {
    if (!canAdd) return;
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setItems((prev) => [
      ...prev,
      {
        id,
        time: newTime,
        content: newContent.trim(),
      },
    ]);
    setNewContent("");
  };

  const startEditItem = (item) => {
    setEditingId(item.id);
    setNewTime(item.time);
    setNewContent(item.content);
  };

  const resetEditState = () => {
    setEditingId(null);
    setNewTime("09:00");
    setNewContent("");
  };

  const saveEditItem = () => {
    if (!editingId) return;
    const nextContent = newContent.trim();
    if (!nextContent) return;

    setItems((prev) =>
      prev.map((it) =>
        it.id === editingId
          ? {
              ...it,
              time: newTime,
              content: nextContent,
            }
          : it
      )
    );
    resetEditState();
  };

  const deleteEditItem = () => {
    if (!editingId) return;
    setItems((prev) => prev.filter((it) => it.id !== editingId));
    resetEditState();
  };

  const deleteItemById = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (editingId === id) {
      resetEditState();
    }
  };

  const closeInlineCalendar = () => {
    setIsDatePickerOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openInlineCalendar = (event) => {
    event?.preventDefault();
    event?.stopPropagation();

    const activeEl = document.activeElement;
    if (
      activeEl instanceof HTMLElement &&
      (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")
    ) {
      activeEl.blur();
    }

    // 입력 포커스/키보드 닫힘 중 레이아웃 흔들림을 피하려고 즉시 상단 이동 후 캘린더를 연다.
    window.scrollTo({ top: 0, behavior: "auto" });
    setVisibleMonthYmd(selectedDate.slice(0, 7));
    requestAnimationFrame(() => {
      setIsDatePickerOpen(true);
    });
  };

  useEffect(() => {
    let cancelled = false;
    setReadyDate("");

    const loadDayPlan = async () => {
      try {
        const plan = await dayPlanRepository.getByDate(selectedDate);
        if (cancelled) return;
        setImportant3(plan.important3);
        setBrainDump(plan.brainDump);
        setItems(plan.items);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load day plan", error);
          setImportant3(["", "", ""]);
          setBrainDump("");
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          resetEditState();
          setReadyDate(selectedDate);
        }
      }
    };

    loadDayPlan();
    return () => {
      cancelled = true;
    };
  }, [dayPlanRepository, selectedDate]);

  useEffect(() => {
    if (readyDate !== selectedDate) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      try {
        await dayPlanRepository.saveByDate(selectedDate, {
          important3,
          brainDump,
          items,
        });
      } catch (error) {
        console.error("Failed to save day plan", error);
      }
    }, 250);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [readyDate, selectedDate, important3, brainDump, items, dayPlanRepository]);

  useEffect(() => {
    if (!isDatePickerOpen) return;
    const [year, month] = visibleMonthYmd.split("-").map(Number);
    let cancelled = false;

    const loadMarkedDates = async () => {
      try {
        const list = await dayPlanRepository.listMarkedDatesInMonth(year, month);
        if (cancelled) return;
        setMarkedDates(new Set(list));
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load marked dates", error);
          setMarkedDates(new Set());
        }
      }
    };

    loadMarkedDates();
    return () => {
      cancelled = true;
    };
  }, [isDatePickerOpen, visibleMonthYmd, dayPlanRepository]);

  useEffect(() => {
    if (!isDatePickerOpen) return;
    if (!selectedDate.startsWith(`${visibleMonthYmd}-`)) return;

    const hasContent = hasDayPlanContent({ important3, brainDump, items });
    setMarkedDates((prev) => {
      const next = new Set(prev);
      if (hasContent) next.add(selectedDate);
      else next.delete(selectedDate);
      return next;
    });
  }, [isDatePickerOpen, selectedDate, visibleMonthYmd, important3, brainDump, items]);

  return (
    <main className="min-h-[100dvh] bg-[#F2F2F7] overflow-x-hidden">
      <header className="fixed inset-x-0 top-0 z-50 bg-[#F2F2F7]/95 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-md px-4 py-3">
          {!isDatePickerOpen ? (
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-label="전날"
                className={[
                  // iOS 캘린더 느낌: 배경/테두리 없이 심플한 아이콘 버튼
                  "h-10 min-w-[44px] select-none bg-transparent text-[22px] font-semibold leading-none",
                  "text-orange-700 active:opacity-60",
                  "focus:outline-none focus:ring-2 focus:ring-orange-500/25 rounded-md",
                ].join(" ")}
                onClick={() => setSelectedDate((d) => addDaysToYmd(d, -1))}
              >
                ‹
              </button>

              <button
                type="button"
                aria-label="날짜 선택 열기"
                className="rounded-md px-2 py-1 text-[13px] font-semibold text-slate-600 active:opacity-60 focus:outline-none focus:ring-2 focus:ring-orange-500/25"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const activeEl = document.activeElement;
                  if (
                    activeEl instanceof HTMLElement &&
                    (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")
                  ) {
                    activeEl.blur();
                  }
                }}
                onClick={openInlineCalendar}
                suppressHydrationWarning
              >
                <span className="inline-flex items-center">{selectedDateLabel}</span>
              </button>

              <button
                type="button"
                aria-label="다음날"
                className={[
                  // iOS 캘린더 느낌: 배경/테두리 없이 심플한 아이콘 버튼
                  "h-10 min-w-[44px] select-none bg-transparent text-[22px] font-semibold leading-none",
                  "text-orange-700 active:opacity-60",
                  "focus:outline-none focus:ring-2 focus:ring-orange-500/25 rounded-md",
                ].join(" ")}
                onClick={() => setSelectedDate((d) => addDaysToYmd(d, 1))}
              >
                ›
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between px-1">
              <p className="text-[13px] font-semibold text-slate-600" suppressHydrationWarning>
                {selectedDateLabel}
              </p>
              <button
                type="button"
                aria-label="오늘 날짜로 이동"
                onClick={() => {
                  const today = toLocalYmd(new Date());
                  setSelectedDate(today);
                  setVisibleMonthYmd(today.slice(0, 7));
                  closeInlineCalendar();
                }}
                className="h-8 min-w-[44px] rounded-md bg-transparent text-orange-700 active:opacity-60"
              >
                <span className="inline-flex items-center justify-center text-[17px]" aria-hidden>
                  ◎
                </span>
                <span className="sr-only">오늘</span>
              </button>
            </div>
          )}

          <div
            data-testid="inline-calendar-panel"
            className={[
              "overflow-hidden transition-all duration-300 ease-out",
              isDatePickerOpen ? "max-h-[320px] opacity-100 pt-3" : "max-h-0 opacity-0 pt-0",
            ].join(" ")}
          >
            <section
              className={[
                "rounded-2xl bg-transparent px-1 py-2",
                "transition-all duration-300 ease-out",
                isDatePickerOpen ? "translate-y-0 scale-100" : "-translate-y-1 scale-[0.98]",
              ].join(" ")}
            >
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  aria-label="이전 달"
                  onClick={() => {
                    const [year, month] = visibleMonthYmd.split("-").map(Number);
                    const prev = new Date(year, month - 2, 1);
                    setVisibleMonthYmd(
                      `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`
                    );
                  }}
                  className="h-9 min-w-[44px] rounded-md bg-transparent text-[20px] font-semibold text-orange-700 active:opacity-60"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="캘린더 접기"
                  onClick={closeInlineCalendar}
                  className="rounded-md px-2 py-1 text-sm font-semibold text-slate-700 active:opacity-60 focus:outline-none focus:ring-2 focus:ring-orange-500/25"
                >
                  {visibleMonthLabel}
                </button>
                <button
                  type="button"
                  aria-label="다음 달"
                  onClick={() => {
                    const [year, month] = visibleMonthYmd.split("-").map(Number);
                    const next = new Date(year, month, 1);
                    setVisibleMonthYmd(
                      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`
                    );
                  }}
                  className="h-9 min-w-[44px] rounded-md bg-transparent text-[20px] font-semibold text-orange-700 active:opacity-60"
                >
                  ›
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1.5 text-center text-[12px] font-semibold text-slate-400">
                {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                  <div key={d} className="py-1">
                    {d}
                  </div>
                ))}
              </div>

              <div className="mt-1 grid grid-cols-7 gap-y-1.5">
                {calendarCells.map((cell, idx) => {
                  if (!cell) {
                    return <div key={`empty_${idx}`} className="h-10" />;
                  }

                  const isSelected = cell.dateYmd === selectedDate;
                  const isMarked = markedDates.has(cell.dateYmd);

                  return (
                    <button
                      key={cell.dateYmd}
                      type="button"
                      onClick={() => {
                        setSelectedDate(cell.dateYmd);
                        closeInlineCalendar();
                      }}
                      className={[
                        "relative mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors",
                        isSelected
                          ? "bg-orange-600 text-white"
                          : "bg-transparent text-slate-700 hover:bg-black/[0.04]",
                        "focus:outline-none focus:ring-2 focus:ring-orange-500/25",
                      ].join(" ")}
                    >
                      {cell.day}
                      {isMarked ? (
                        <span
                          className={[
                            "absolute bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full",
                            isSelected ? "bg-white" : "bg-orange-500",
                          ].join(" ")}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </header>

      <div
        className={[
          "mx-auto w-full max-w-md px-4 pb-24 transition-[padding-top] duration-300 ease-out",
          isDatePickerOpen ? "pt-[380px]" : "pt-20",
        ].join(" ")}
      >
        <div className="space-y-8">
          {/* 1) 가장 중요한 3가지 */}
          <section>
            <div className="space-y-3">
              {important3.map((v, idx) => (
                <TextInput
                  key={idx}
                  value={v}
                  placeholder={`가장 중요한 일 ${idx + 1}`}
                  disabled={isDatePickerOpen}
                  inputClassName="text-[15px]"
                  onChange={(next) =>
                    setImportant3((prev) => {
                      const copy = [...prev];
                      copy[idx] = next;
                      return copy;
                    })
                  }
                />
              ))}
            </div>
          </section>

          {/* 2) 브레인 덤프 */}
          <section>
            <div>
              <textarea
                id="brain_dump"
                aria-label="브레인 덤프"
                value={brainDump}
                disabled={isDatePickerOpen}
                onChange={(e) => setBrainDump(e.target.value)}
                placeholder="예: 회의 준비, 이메일 확인, 아이디어 메모..."
                className={[
                  "block w-full border-0 border-b border-slate-200 bg-transparent px-0 py-2.5 text-[16px] text-slate-900 placeholder:text-slate-400",
                  "focus:border-orange-500 focus:outline-none focus:ring-0",
                  "disabled:cursor-not-allowed disabled:text-slate-400",
                  "resize-none min-h-[120px]",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            </div>
          </section>

          {/* 3) 시간, 내용 입력 */}
          <section>
            <div className="space-y-4">
              <div className="flex items-end gap-3">
                <div className="w-[120px] flex-none">
                  <TextInput
                    type="time"
                    value={newTime}
                    disabled={isDatePickerOpen}
                    onChange={setNewTime}
                    inputClassName="text-[15px]"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <TextInput
                    value={newContent}
                    placeholder="예: 09:00 - 고객 피드백 정리"
                    disabled={isDatePickerOpen}
                    inputClassName="text-[15px]"
                    onChange={setNewContent}
                  />
                </div>
                <div className="w-[56px]">
                  {editingId ? (
                    isEditingChanged ? (
                      <button
                        type="button"
                        aria-label="저장"
                        disabled={!canAdd}
                        onClick={saveEditItem}
                        className={[
                          "h-10 w-full select-none bg-transparent text-[18px] font-semibold leading-none",
                          "text-orange-700 active:opacity-60",
                          "focus:outline-none focus:ring-2 focus:ring-orange-500/25 rounded-md",
                          "disabled:cursor-not-allowed disabled:opacity-40",
                        ].join(" ")}
                      >
                        ✓
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-label="취소"
                        onClick={resetEditState}
                        className={[
                          "h-10 w-full select-none bg-transparent text-[18px] font-semibold leading-none",
                          "text-orange-700 active:opacity-60",
                          "focus:outline-none focus:ring-2 focus:ring-orange-500/25 rounded-md",
                        ].join(" ")}
                      >
                        ✕
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      aria-label="추가"
                      disabled={!canAdd}
                      onClick={addItem}
                      className={[
                        "h-10 w-full select-none bg-transparent text-[18px] font-semibold leading-none",
                        "text-orange-700 active:opacity-60",
                        "focus:outline-none focus:ring-2 focus:ring-orange-500/25 rounded-md",
                        "disabled:cursor-not-allowed disabled:opacity-40",
                      ].join(" ")}
                    >
                      +
                    </button>
                  )}
                </div>
              </div>

              {/* 추가된 항목 목록 */}
              {items.length > 0 ? (
                <div className="space-y-3">
                  {items.map((it) => (
                    <div
                      key={it.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => startEditItem(it)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          startEditItem(it);
                        }
                      }}
                      className="cursor-pointer rounded-md px-1 py-1 outline-none transition-colors hover:bg-black/[0.02] focus:bg-black/[0.04]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-orange-700">{it.time}</div>
                          <div className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900">
                            {it.content}
                          </div>
                        </div>
                        {editingId === it.id ? (
                          <button
                            type="button"
                            aria-label="항목 삭제"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteItemById(it.id);
                            }}
                            className="h-8 min-w-[32px] select-none bg-transparent text-[18px] font-semibold leading-none text-orange-700 active:opacity-60 focus:outline-none focus:ring-2 focus:ring-orange-500/25 rounded-md"
                          >
                            −
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-xs text-slate-500">아직 추가된 시간이 없어요.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30">
        <div className="mx-auto w-full max-w-md px-4 pb-4 pt-2">
          <div className="flex justify-end">
            <button
              type="button"
              aria-label="일정 리포트 열기"
              onClick={() => {
                setIsDatePickerOpen(false);
                setIsReportOpen(true);
              }}
              className={[
                "h-12 min-w-[48px] rounded-full bg-orange-600 px-4",
                "inline-flex items-center justify-center text-white shadow-md",
                "active:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500/30",
              ].join(" ")}
            >
              <i className="fas fa-clipboard-list text-[22px] leading-none" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {isReportOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
          onClick={() => setIsReportOpen(false)}
        >
          <div className="mx-auto flex h-full min-h-0 w-full max-w-md items-end justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-10">
            <section
              className="flex max-h-[min(88vh,calc(100dvh-2.5rem))] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-3">
                <p
                  className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-700"
                  suppressHydrationWarning
                >
                  {selectedDateLabel}
                </p>
                <button
                  type="button"
                  aria-label="리포트 닫기"
                  onClick={() => setIsReportOpen(false)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-transparent text-[18px] font-semibold leading-none text-slate-500 active:opacity-60"
                >
                  ✕
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4 [-webkit-overflow-scrolling:touch]">
              <div className="space-y-4">
                <div>
                  <h3 className="text-[13px] font-semibold text-slate-500">가장 중요한 3가지</h3>
                  {filledImportant3.length > 0 ? (
                    <ul className="mt-2 space-y-1.5">
                      {filledImportant3.map((v, idx) => (
                        <li key={`${idx}_${v}`} className="text-sm text-slate-900">
                          {idx + 1}. {v}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">작성된 항목이 없습니다.</p>
                  )}
                </div>

                <div className="h-px w-full bg-black/[0.06]" />

                <div>
                  <h3 className="text-[13px] font-semibold text-slate-500">브레인 덤프</h3>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-900">
                    {brainDump.trim() || "작성된 내용이 없습니다."}
                  </p>
                </div>

                <div className="h-px w-full bg-black/[0.06]" />

                <div>
                  <h3 className="text-[13px] font-semibold text-slate-500">시간 + 내용</h3>
                  {items.length > 0 ? (
                    <div className="mt-2 space-y-2.5">
                      {items.map((it) => (
                        <div key={it.id} className="flex items-start gap-3">
                          <div className="min-w-[58px] text-[12px] font-semibold text-orange-700">
                            {it.time}
                          </div>
                          <div className="flex-1 break-words text-sm text-slate-900">{it.content}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">추가된 일정이 없습니다.</p>
                  )}
                </div>
              </div>
              </div>
            </section>
          </div>
        </div>
      ) : null}

    </main>
  );
}
