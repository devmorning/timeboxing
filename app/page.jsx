"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TextInput from "../components/textinput/TextInput.jsx";
import { addDaysToYmd } from "../components/timeboxing/utils/dateYmd.js";
import { getDayPlanRepository } from "../components/timeboxing/storage/dayPlan.repository.js";

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
  const [readyDate, setReadyDate] = useState("");

  const canAdd = useMemo(() => {
    return newContent.trim().length > 0;
  }, [newContent]);

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

  return (
    <main className="min-h-[100dvh] bg-[#F2F2F7] overflow-x-hidden">
      <header className="fixed inset-x-0 top-0 z-30 bg-[#F2F2F7]/95 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-md px-4 py-3">
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

            <div
              className="text-[13px] font-semibold text-slate-600"
              suppressHydrationWarning
            >
              {selectedDateLabel}
            </div>

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
        </div>
      </header>

      <div className="mx-auto w-full max-w-md px-4 pb-24 pt-20">
        <div className="space-y-8">
          {/* 1) 가장 중요한 3가지 */}
          <section>
            <div className="space-y-3">
              {important3.map((v, idx) => (
                <TextInput
                  key={idx}
                  value={v}
                  placeholder={`가장 중요한 일 ${idx + 1}`}
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
                    onChange={setNewTime}
                    inputClassName="text-[15px]"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <TextInput
                    value={newContent}
                    placeholder="예: 09:00 - 고객 피드백 정리"
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
              aria-label="TIME 버튼"
              onClick={() => setIsReportOpen(true)}
              className={[
                "h-11 min-w-[44px] rounded-full bg-orange-600 px-3",
                "inline-flex items-center justify-center text-[18px] font-semibold text-white shadow-md",
                "active:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500/30",
              ].join(" ")}
            >
              <span aria-hidden>◷</span>
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
              <div className="flex shrink-0 items-start justify-between border-b border-black/[0.06] px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700" suppressHydrationWarning>
                    {selectedDateLabel}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="리포트 닫기"
                  onClick={() => setIsReportOpen(false)}
                  className="h-9 min-w-[44px] rounded-md bg-transparent text-[18px] font-semibold text-slate-500 active:opacity-60"
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
