"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from "react";
import TextInput from "../components/textinput/TextInput.jsx";
import { InlineCalendarMonth } from "../components/timeboxing/InlineCalendarMonth.jsx";
import { buildMonthKeys, getRangeYmdBounds } from "../components/timeboxing/utils/calendarMonth.js";
import { addDaysToYmd } from "../components/timeboxing/utils/dateYmd.js";
import { getDayPlanRepository } from "../components/timeboxing/storage/dayPlan.repository.js";
import {
  clearStoredAccessToken,
  getApiAuthUrl,
  setStoredAccessToken,
} from "../components/timeboxing/storage/dayPlan.apiRepository.js";
import { hasDayPlanContent, normalizeDayPlan } from "../components/timeboxing/storage/dayPlan.schema.js";

export default function PageClient({ initialAuthUser = null, initialSelectedDate = null, initialPlan = null }) {
  const dayPlanRepository = useMemo(() => getDayPlanRepository(), []);
  const saveTimerRef = useRef(null);
  const lastSavedPlanRef = useRef("");
  const skippedInitialLoadRef = useRef(false);
  const dayPlanCacheRef = useRef(new Map());
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState(initialAuthUser);

  const toLocalYmd = (d) => {
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  };

  const [selectedDate, setSelectedDate] = useState(() => initialSelectedDate || toLocalYmd(new Date()));

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

  const [important3, setImportant3] = useState(initialPlan?.important3 ?? ["", "", ""]);
  const [brainDump, setBrainDump] = useState(initialPlan?.brainDump ?? "");

  const [newTime, setNewTime] = useState("09:00");
  const [newContent, setNewContent] = useState("");
  const [items, setItems] = useState(initialPlan?.items ?? []);
  const [editingId, setEditingId] = useState(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [readyDate, setReadyDate] = useState(initialAuthUser && initialSelectedDate ? initialSelectedDate : "");
  const [isInitialSkeletonDelayDone, setIsInitialSkeletonDelayDone] = useState(Boolean(initialAuthUser));
  const [swipingItemId, setSwipingItemId] = useState(null);
  const [swipeOffsetX, setSwipeOffsetX] = useState(0);
  /** 인라인 캘린더에 표시할 월 목록 `YYYY-MM` (열 때만 설정) */
  const [calendarMonthRange, setCalendarMonthRange] = useState(null);
  const [markedDates, setMarkedDates] = useState(new Set());
  const swipeGestureRef = useRef({
    itemId: null,
    startX: 0,
    startY: 0,
    dragging: false,
    horizontalLocked: false,
    didMove: false,
  });
  const reportSwipeRef = useRef({
    startX: 0,
    startY: 0,
    tracking: false,
    horizontalLocked: false,
    moved: false,
  });

  const canAdd = useMemo(() => {
    return newContent.trim().length > 0;
  }, [newContent]);

  const sortItemsByTimeAsc = useCallback((list) => {
    return [...list].sort((a, b) => {
      if (a.time === b.time) return 0;
      return a.time < b.time ? -1 : 1;
    });
  }, []);

  const serializePlan = useCallback(
    (plan) =>
      JSON.stringify({
        important3: normalizeDayPlan(plan).important3,
        brainDump: normalizeDayPlan(plan).brainDump,
        items: sortItemsByTimeAsc(normalizeDayPlan(plan).items).map((it) => ({
          id: it.id,
          time: it.time,
          content: it.content,
          done: Boolean(it.done),
        })),
      }),
    [sortItemsByTimeAsc]
  );

  const filledImportant3 = useMemo(
    () => important3.map((v) => v.trim()).filter(Boolean),
    [important3]
  );

  useEffect(() => {
    if (!initialAuthUser?.id || !initialSelectedDate) return;
    lastSavedPlanRef.current = serializePlan(initialPlan);
    dayPlanCacheRef.current.set(initialSelectedDate, normalizeDayPlan(initialPlan));
  }, [initialAuthUser?.id, initialSelectedDate, initialPlan, serializePlan]);

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
    setItems((prev) =>
      sortItemsByTimeAsc([
        ...prev,
        {
          id,
          time: newTime,
          content: newContent.trim(),
          done: false,
        },
      ])
    );
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
      sortItemsByTimeAsc(
        prev.map((it) =>
          it.id === editingId
            ? {
                ...it,
                time: newTime,
                content: nextContent,
              }
            : it
        )
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

  const toggleItemDoneById = (id) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              done: !it.done,
            }
          : it
      )
    );
  };

  const handleItemTouchStart = (id, event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    swipeGestureRef.current = {
      itemId: id,
      startX: touch.clientX,
      startY: touch.clientY,
      dragging: true,
      horizontalLocked: false,
      didMove: false,
    };
    setSwipingItemId(id);
    setSwipeOffsetX(0);
  };

  const handleItemTouchMove = (id, event) => {
    const touch = event.touches?.[0];
    const gesture = swipeGestureRef.current;
    if (!touch || !gesture.dragging || gesture.itemId !== id) return;

    const dx = touch.clientX - gesture.startX;
    const dy = touch.clientY - gesture.startY;

    if (!gesture.horizontalLocked) {
      if (Math.abs(dx) < 6) return;
      if (Math.abs(dx) <= Math.abs(dy)) {
        gesture.dragging = false;
        setSwipingItemId(null);
        setSwipeOffsetX(0);
        return;
      }
      gesture.horizontalLocked = true;
    }

    const nextOffset = Math.max(-120, Math.min(96, dx));
    gesture.didMove = Math.abs(nextOffset) > 10;
    setSwipeOffsetX(nextOffset);
  };

  const handleItemTouchEnd = (id) => {
    const gesture = swipeGestureRef.current;
    const isSameItem = gesture.itemId === id;
    const shouldDelete = isSameItem && swipeOffsetX <= -72;
    const shouldToggleDone = isSameItem && swipeOffsetX >= 56;
    const didMove = isSameItem && gesture.didMove;

    swipeGestureRef.current = {
      itemId: null,
      startX: 0,
      startY: 0,
      dragging: false,
      horizontalLocked: false,
      didMove: false,
    };
    setSwipingItemId(null);
    setSwipeOffsetX(0);

    if (shouldDelete) {
      deleteItemById(id);
      return true;
    }
    if (shouldToggleDone) {
      toggleItemDoneById(id);
      return true;
    }
    return didMove;
  };

  const handleReportTouchStart = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    reportSwipeRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      tracking: true,
      horizontalLocked: false,
      moved: false,
    };
  };

  const handleReportTouchMove = (event) => {
    const touch = event.touches?.[0];
    const gesture = reportSwipeRef.current;
    if (!touch || !gesture.tracking) return;

    const dx = touch.clientX - gesture.startX;
    const dy = touch.clientY - gesture.startY;

    if (!gesture.horizontalLocked) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(dx) <= Math.abs(dy)) {
        gesture.tracking = false;
        return;
      }
      gesture.horizontalLocked = true;
    }
    if (Math.abs(dx) > 12) {
      gesture.moved = true;
    }
  };

  const handleReportTouchEnd = (event) => {
    const touch = event.changedTouches?.[0];
    const gesture = reportSwipeRef.current;
    if (!touch || !gesture.tracking) return;

    const dx = touch.clientX - gesture.startX;
    const isHorizontal = gesture.horizontalLocked || Math.abs(dx) > 24;

    reportSwipeRef.current = {
      startX: 0,
      startY: 0,
      tracking: false,
      horizontalLocked: false,
      moved: false,
    };

    if (!isHorizontal) return;

    if (dx <= -72) {
      setSelectedDate((d) => addDaysToYmd(d, 1));
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (dx >= 72) {
      setSelectedDate((d) => addDaysToYmd(d, -1));
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const closeInlineCalendar = useCallback(() => {
    setIsDatePickerOpen(false);
    setCalendarMonthRange(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handlePickCalendarDate = useCallback(
    (dateYmd) => {
      setSelectedDate(dateYmd);
      closeInlineCalendar();
    },
    [closeInlineCalendar]
  );

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
    // 무거운 월 목록 렌더는 transition으로 분리해 메인 스레드 블로킹 완화
    startTransition(() => {
      setCalendarMonthRange(buildMonthKeys(selectedDate.slice(0, 7), 12, 12));
    });
    requestAnimationFrame(() => {
      setIsDatePickerOpen(true);
    });
  };


  useEffect(() => {
    const initialSkeletonDelayMs = process.env.NODE_ENV === "test" ? 0 : 500;
    const timer = setTimeout(() => {
      setIsInitialSkeletonDelayDone(true);
    }, initialSkeletonDelayMs);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadBootstrap = async () => {
      const bootstrapDate = initialSelectedDate || toLocalYmd(new Date());

      try {
        const params = new URLSearchParams(window.location.search);
        const accessToken = params.get("token");
        if (accessToken) {
          setStoredAccessToken(accessToken);
          params.delete("token");
          const nextQuery = params.toString();
          const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
          window.history.replaceState({}, "", nextUrl);
        }
      } catch (_error) {
        // ignore URL parsing failures
      }

      try {
        const auth = await dayPlanRepository.getBootstrap?.(bootstrapDate);
        if (cancelled) return;
        if (auth?.authenticated && auth.user?.id) {
          const plan = normalizeDayPlan(auth?.plan ?? createEmptyDayPlan());
          setAuthUser(auth.user);
          lastSavedPlanRef.current = serializePlan(plan);
          dayPlanCacheRef.current.set(bootstrapDate, plan);
          setImportant3(plan.important3);
          setBrainDump(plan.brainDump);
          setItems(sortItemsByTimeAsc(plan.items));
          setReadyDate(bootstrapDate);
          skippedInitialLoadRef.current = initialSelectedDate === bootstrapDate;
          return;
        }
        clearStoredAccessToken();
        setAuthUser(null);
        setReadyDate("");
      } catch (error) {
        if (!cancelled) {
          if (error?.status !== 401) {
            console.error("Failed to load bootstrap data", error);
          }
          clearStoredAccessToken();
          setAuthUser(null);
          setReadyDate("");
        }
      } finally {
        if (!cancelled) {
          setAuthReady(true);
        }
      }
    };

    setAuthReady(false);
    loadBootstrap();

    return () => {
      cancelled = true;
    };
  }, [dayPlanRepository, initialSelectedDate, serializePlan, sortItemsByTimeAsc]);

  useEffect(() => {
    if (!authReady || !authUser?.id) return;

    if (skippedInitialLoadRef.current && initialSelectedDate === selectedDate) {
      skippedInitialLoadRef.current = false;
      setReadyDate(selectedDate);
      return;
    }

    const cachedPlan = dayPlanCacheRef.current.get(selectedDate);
    if (cachedPlan) {
      const normalizedPlan = normalizeDayPlan(cachedPlan);
      lastSavedPlanRef.current = serializePlan(normalizedPlan);
      setImportant3(normalizedPlan.important3);
      setBrainDump(normalizedPlan.brainDump);
      setItems(sortItemsByTimeAsc(normalizedPlan.items));
      resetEditState();
      setReadyDate(selectedDate);
      return;
    }

    let cancelled = false;

    const loadDayPlan = async () => {
      try {
        const plan = await dayPlanRepository.getByDate(selectedDate);
        if (cancelled) return;
        dayPlanCacheRef.current.set(selectedDate, plan);
        lastSavedPlanRef.current = serializePlan(plan);
        setImportant3(plan.important3);
        setBrainDump(plan.brainDump);
        setItems(sortItemsByTimeAsc(plan.items));
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
  }, [
    authReady,
    authUser?.id,
    dayPlanRepository,
    initialSelectedDate,
    selectedDate,
    sortItemsByTimeAsc,
    serializePlan,
  ]);

  useEffect(() => {
    if (!authUser?.id) return;
    if (readyDate !== selectedDate) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    const currentPlan = { important3, brainDump, items };
    const nextSnapshot = serializePlan(currentPlan);
    if (lastSavedPlanRef.current === nextSnapshot) return;

    saveTimerRef.current = setTimeout(async () => {
      try {
        await dayPlanRepository.saveByDate(selectedDate, currentPlan);
        dayPlanCacheRef.current.set(selectedDate, normalizeDayPlan(currentPlan));
        lastSavedPlanRef.current = nextSnapshot;
      } catch (error) {
        console.error("Failed to save day plan", error);
      }
    }, 250);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [authUser?.id, readyDate, selectedDate, important3, brainDump, items, dayPlanRepository, serializePlan]);

  useEffect(() => {
    if (!authUser?.id) return;
    if (!isDatePickerOpen || !calendarMonthRange?.length) return;
    let cancelled = false;

    const loadMarkedDates = async () => {
      try {
        const bounds = getRangeYmdBounds(calendarMonthRange);
        if (!bounds) return;

        let list;
        if (typeof dayPlanRepository.listMarkedDatesInRange === "function") {
          list = await dayPlanRepository.listMarkedDatesInRange(
            bounds.startYmd,
            bounds.endYmd
          );
        } else {
          const lists = await Promise.all(
            calendarMonthRange.map((ym) => {
              const [year, month] = ym.split("-").map(Number);
              return dayPlanRepository.listMarkedDatesInMonth(year, month);
            })
          );
          list = lists.flat();
        }

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
  }, [authUser?.id, isDatePickerOpen, calendarMonthRange, dayPlanRepository]);

  useEffect(() => {
    if (!isDatePickerOpen) return;

    const hasContent = hasDayPlanContent({ important3, brainDump, items });
    setMarkedDates((prev) => {
      const next = new Set(prev);
      if (hasContent) next.add(selectedDate);
      else next.delete(selectedDate);
      return next;
    });
  }, [isDatePickerOpen, selectedDate, important3, brainDump, items]);

  useEffect(() => {
    if (!isDatePickerOpen || !calendarMonthRange?.length) return;
    const ym = selectedDate.slice(0, 7);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(`cal-month-${ym}`);
        if (el && typeof el.scrollIntoView === "function") {
          el.scrollIntoView({ block: "center", behavior: "auto" });
        }
      });
    });
  }, [isDatePickerOpen, calendarMonthRange, selectedDate]);

  const isDayPlanLoading = !authReady || (authUser?.id && (readyDate === "" || !isInitialSkeletonDelayDone));

  const handleLogin = () => {
    window.location.href = getApiAuthUrl("/auth/google");
  };

  const handleLogout = async () => {
    try {
      await dayPlanRepository.logout?.();
    } finally {
      clearStoredAccessToken();
      setAuthUser(null);
      setAuthReady(true);
      setReadyDate("");
      setImportant3(["", "", ""]);
      setBrainDump("");
      setItems([]);
      setIsReportOpen(false);
      setIsDatePickerOpen(false);
    }
  };

  if (!authReady) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#F2F2F7] px-6">
        <section className="w-full max-w-sm rounded-3xl bg-white px-6 py-8 shadow-sm ring-1 ring-black/5">
          <div className="space-y-3 animate-pulse">
            <div className="mx-auto h-6 w-28 rounded-full bg-slate-200" />
            <div className="mx-auto h-4 w-52 rounded-full bg-slate-100" />
            <div className="mx-auto h-12 w-full rounded-xl bg-slate-200" />
          </div>
        </section>
      </main>
    );
  }

  if (authReady && !authUser) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#F2F2F7] px-6">
        <section className="w-full max-w-sm rounded-3xl bg-white px-6 py-8 shadow-sm ring-1 ring-black/5">
          <h1 className="text-center text-xl font-semibold text-slate-900">Timeboxing</h1>
          <p className="mt-3 text-center text-sm leading-6 text-slate-500">
            구글 계정으로 로그인하면 나만의 타임박싱 데이터를 안전하게 저장하고 불러올 수 있어요.
          </p>
          <button
            type="button"
            onClick={handleLogin}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white active:opacity-90"
          >
            <i className="fab fa-google text-[16px]" aria-hidden />
            <span>Google로 로그인</span>
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-[#F2F2F7] overflow-x-hidden">
      <header
        className={[
          "fixed inset-x-0 top-0 z-50 bg-[#F2F2F7]/95 backdrop-blur-sm transition-opacity duration-200",
          isReportOpen ? "pointer-events-none opacity-0" : "opacity-100",
        ].join(" ")}
      >
        <div className="mx-auto w-full max-w-md px-4 py-3">
          <div
            className={[
              "grid h-10 w-full grid-cols-[minmax(44px,auto)_1fr_minmax(44px,auto)] items-center",
              "gap-0",
            ].join(" ")}
          >
            {!isDatePickerOpen ? (
              <>
                <button
                  type="button"
                  aria-label="전날"
                  className={[
                    "flex h-10 w-full min-w-[44px] select-none items-center justify-center bg-transparent text-[22px] font-semibold leading-none",
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
                  className={[
                    "min-w-0 justify-self-stretch rounded-md px-2 py-1 text-center text-[13px] font-semibold text-slate-600",
                    "active:opacity-60 focus:outline-none focus:ring-2 focus:ring-orange-500/25",
                  ].join(" ")}
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
                  <span className="inline-flex w-full items-center justify-center">{selectedDateLabel}</span>
                </button>

                <button
                  type="button"
                  aria-label="다음날"
                  className={[
                    "flex h-10 w-full min-w-[44px] select-none items-center justify-center bg-transparent text-[22px] font-semibold leading-none",
                    "text-orange-700 active:opacity-60",
                    "focus:outline-none focus:ring-2 focus:ring-orange-500/25 rounded-md",
                  ].join(" ")}
                  onClick={() => setSelectedDate((d) => addDaysToYmd(d, 1))}
                >
                  ›
                </button>
              </>
            ) : (
              <>
                <div className="h-10 min-w-[44px]" aria-hidden />
                <button
                  type="button"
                  aria-label="캘린더 닫기"
                  onClick={closeInlineCalendar}
                  className={[
                    "min-w-0 justify-self-stretch rounded-md px-2 py-1 text-center text-[13px] font-semibold text-slate-600",
                    "active:opacity-60 focus:outline-none focus:ring-2 focus:ring-orange-500/25",
                  ].join(" ")}
                  suppressHydrationWarning
                >
                  <span className="inline-flex w-full items-center justify-center">{selectedDateLabel}</span>
                </button>
                <button
                  type="button"
                  aria-label="오늘 날짜로 이동"
                  onClick={() => {
                    const today = toLocalYmd(new Date());
                    setSelectedDate(today);
                    closeInlineCalendar();
                  }}
                  className="flex h-10 w-full min-w-[44px] shrink-0 items-center justify-center rounded-md bg-transparent text-orange-700 active:opacity-60"
                >
                  <span className="inline-flex items-center justify-center text-[17px]" aria-hidden>
                    ◎
                  </span>
                  <span className="sr-only">오늘</span>
                </button>
              </>
            )}
          </div>

          {authUser?.id ? (
            <div className="mt-1 flex justify-end">
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-700 active:opacity-60"
              >
                로그아웃
              </button>
            </div>
          ) : null}

          <div
            data-testid="inline-calendar-panel"
            className={[
              "overflow-hidden transition-[max-height,opacity,padding-top] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
              isDatePickerOpen
                ? "flex max-h-[calc(100dvh-4rem)] flex-col opacity-100 pt-3"
                : "max-h-0 opacity-0 pt-0",
            ].join(" ")}
          >
            <section
              className={[
                "flex min-h-0 flex-1 flex-col rounded-2xl bg-transparent px-1 py-2",
                "transition-[transform,opacity] duration-[460ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                isDatePickerOpen ? "translate-y-0 scale-100" : "-translate-y-1 scale-[0.98]",
              ].join(" ")}
            >
              {calendarMonthRange ? (
                <div
                  className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] px-0.5 pb-1"
                >
                  {calendarMonthRange.map((ym) => (
                    <InlineCalendarMonth
                      key={ym}
                      ym={ym}
                      selectedDate={selectedDate}
                      markedDates={markedDates}
                      onSelectDate={handlePickCalendarDate}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </header>

      <div
        className={[
          "mx-auto w-full max-w-md px-4 pb-24 transition-[padding-top] duration-300 ease-out",
          isDatePickerOpen ? "pt-[calc(100dvh-4rem)]" : "pt-20",
        ].join(" ")}
      >
        {isDayPlanLoading ? (
          <div className="space-y-8 animate-pulse" aria-label="일정 불러오는 중">
            <section>
              <div className="space-y-3">
                <div className="h-10 rounded-md bg-slate-200/70" />
                <div className="h-10 rounded-md bg-slate-200/70" />
                <div className="h-10 rounded-md bg-slate-200/70" />
              </div>
            </section>
            <section>
              <div className="h-[120px] rounded-md bg-slate-200/70" />
            </section>
            <section>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-[120px] rounded-md bg-slate-200/70" />
                  <div className="h-10 flex-1 rounded-md bg-slate-200/70" />
                  <div className="h-10 w-[56px] rounded-md bg-slate-200/70" />
                </div>
                <div className="space-y-3">
                  <div className="h-14 rounded-md bg-slate-200/60" />
                  <div className="h-14 rounded-md bg-slate-200/60" />
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-8 opacity-100 transition-opacity duration-200">
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
                <div className="flex items-center gap-3">
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
                        onClick={() => {
                          if (swipingItemId === it.id && swipeOffsetX !== 0) return;
                          startEditItem(it);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            startEditItem(it);
                          }
                        }}
                        onTouchStart={(e) => handleItemTouchStart(it.id, e)}
                        onTouchMove={(e) => handleItemTouchMove(it.id, e)}
                        onTouchEnd={(e) => {
                          const moved = handleItemTouchEnd(it.id);
                          if (moved) {
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        }}
                        onTouchCancel={() => {
                          handleItemTouchEnd(it.id);
                        }}
                        className={[
                          "cursor-pointer rounded-md px-1 py-1 outline-none transition-colors",
                          it.done ? "bg-emerald-50/70" : "hover:bg-black/[0.02] focus:bg-black/[0.04]",
                        ].join(" ")}
                        style={{
                          touchAction: "pan-y",
                          transform:
                            swipingItemId === it.id && swipeOffsetX !== 0
                              ? `translateX(${swipeOffsetX}px)`
                              : "translateX(0)",
                          transition:
                            swipingItemId === it.id
                              ? "none"
                              : "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold text-orange-700">{it.time}</div>
                            <div
                              className={[
                                "mt-1 whitespace-pre-wrap break-words text-sm",
                                it.done ? "text-slate-500 line-through" : "text-slate-900",
                              ].join(" ")}
                            >
                              {it.content}
                            </div>
                          </div>
                          {it.done ? (
                            <span className="mt-0.5 inline-flex h-5 min-w-[38px] items-center justify-center rounded-full bg-emerald-100 px-2 text-[11px] font-semibold text-emerald-700">
                              실행
                            </span>
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
        )}
      </div>

      {!isDatePickerOpen ? (
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
                  "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-600 p-0",
                  "text-white shadow-md",
                  "active:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500/30",
                ].join(" ")}
              >
                <i className="fas fa-clipboard-list text-[22px] leading-none" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isReportOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
          onClick={() => setIsReportOpen(false)}
        >
          <div className="mx-auto flex h-full min-h-0 w-full max-w-md items-stretch justify-center px-0 pb-0 pt-0">
            <section
              className="flex h-full w-full flex-col overflow-hidden bg-white"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={handleReportTouchStart}
              onTouchMove={handleReportTouchMove}
              onTouchEnd={handleReportTouchEnd}
              onTouchCancel={() => {
                reportSwipeRef.current = {
                  startX: 0,
                  startY: 0,
                  tracking: false,
                  horizontalLocked: false,
                  moved: false,
                };
              }}
              style={{ touchAction: "pan-y" }}
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
                  {brainDump.trim() ? (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-900">
                      {brainDump.trim()}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">작성된 내용이 없습니다.</p>
                  )}
                </div>

                <div className="h-px w-full bg-black/[0.06]" />

                <div>
                  <h3 className="text-[13px] font-semibold text-slate-500">시간 + 내용</h3>
                  {items.length > 0 ? (
                    <div className="mt-2 space-y-2.5">
                      {items.map((it) => (
                        <div
                          key={it.id}
                          className={[
                            "flex items-start gap-3 rounded-md px-2 py-1",
                            it.done ? "bg-emerald-50/70" : "",
                          ].join(" ")}
                        >
                          <div className="min-w-[58px] text-[12px] font-semibold text-orange-700">
                            {it.time}
                          </div>
                          <div
                            className={[
                              "flex-1 break-words text-sm",
                              it.done ? "text-slate-500 line-through" : "text-slate-900",
                            ].join(" ")}
                          >
                            {it.content}
                          </div>
                          {it.done ? (
                            <span className="inline-flex h-5 min-w-[38px] items-center justify-center rounded-full bg-emerald-100 px-2 text-[11px] font-semibold text-emerald-700">
                              실행
                            </span>
                          ) : null}
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
