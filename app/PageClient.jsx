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
import ComposerContentInput from "./components/timeboxing/ComposerContentInput.jsx";
import TimeRangeSelectors from "./components/timeboxing/TimeRangeSelectors.jsx";
import {
  clearStoredAccessToken,
  getApiAuthUrl,
  setStoredAccessToken,
} from "../components/timeboxing/storage/dayPlan.apiRepository.js";
import { hasDayPlanContent, normalizeDayPlan } from "../components/timeboxing/storage/dayPlan.schema.js";

function parseHHMMToSecondsFromMidnight(s) {
  if (!s || typeof s !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number.parseInt(m[1], 10);
  const min = Number.parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  return h * 3600 + min * 60;
}

/** 종료 시간이 있을 때만 (종료 − 시작) 초. 없으면 null */
function getPlannedDurationSeconds(startTime, endTime) {
  const st = typeof startTime === "string" ? startTime : "09:00";
  const et = typeof endTime === "string" ? endTime.trim() : "";
  if (!et) return null;
  const a = parseHHMMToSecondsFromMidnight(st);
  const b = parseHHMMToSecondsFromMidnight(et);
  if (a == null || b == null) return null;
  return Math.max(0, b - a);
}

const SECONDS_PER_DAY = 86400;

const DAY_TIMELINE_PALETTE = [
  "bg-orange-500/85",
  "bg-sky-500/85",
  "bg-emerald-500/85",
  "bg-violet-500/85",
  "bg-amber-500/85",
  "bg-rose-500/85",
  "bg-cyan-500/85",
  "bg-indigo-500/85",
];

function formatSecondsAsDurationKo(sec) {
  const n = Math.max(0, Math.floor(sec));
  if (n <= 0) return "0분";
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

function isDayPlanItemUuid(id) {
  return (
      typeof id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  );
}

const MODAL_TRANSITION_MS = 320;

/** 인라인 캘린더 패널과 유사한 이징으로 모달 열림·닫힘 */
function useModalOpenAnimation(isOpen, onFullyClosed) {
  const [closing, setClosing] = useState(false);
  const [entered, setEntered] = useState(false);
  const onClosedRef = useRef(onFullyClosed);
  onClosedRef.current = onFullyClosed;

  useEffect(() => {
    if (!isOpen) {
      setEntered(false);
      setClosing(false);
      return;
    }
    setClosing(false);
    setEntered(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(id);
  }, [isOpen]);

  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(() => {
      setClosing(false);
      setEntered(false);
      onClosedRef.current();
    }, MODAL_TRANSITION_MS);
    return () => clearTimeout(t);
  }, [closing]);

  const requestClose = useCallback(() => {
    if (!isOpen) return;
    setClosing(true);
  }, [isOpen]);

  const showOverlay = entered && !closing;

  return { requestClose, showOverlay };
}

function modalBackdropClass(showOverlay) {
  return [
    "fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px]",
    "transition-[opacity] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
    showOverlay ? "opacity-100" : "opacity-0",
  ].join(" ");
}

function modalPanelClass(showOverlay) {
  return [
    "flex h-full w-full flex-col overflow-hidden bg-white",
    "transition-[opacity,transform] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
    showOverlay ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
  ].join(" ");
}

export default function PageClient({ initialAuthUser = null, initialSelectedDate = null, initialPlan = null }) {
  const dayPlanRepository = useMemo(() => getDayPlanRepository(), []);
  const saveTimerRef = useRef(null);
  const lastSavedPlanRef = useRef("");
  const skippedInitialLoadRef = useRef(false);
  const dayPlanCacheRef = useRef(new Map());
  const [authReady, setAuthReady] = useState(Boolean(initialAuthUser?.id));
  const [isAuthBootstrapDone, setIsAuthBootstrapDone] = useState(Boolean(initialAuthUser?.id));
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

  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("");
  const [newContent, setNewContent] = useState("");
  const [items, setItems] = useState(initialPlan?.items ?? []);
  const [editingId, setEditingId] = useState(null);
  const [activeExecutionItemId, setActiveExecutionItemId] = useState(null);
  const [activeExecutionStartedAtMs, setActiveExecutionStartedAtMs] = useState(null);
  const [executionNowMs, setExecutionNowMs] = useState(Date.now());
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [readyDate, setReadyDate] = useState(initialAuthUser && initialSelectedDate ? initialSelectedDate : "");
  const [isInitialSkeletonDelayDone, setIsInitialSkeletonDelayDone] = useState(Boolean(initialAuthUser));
  const [showDayPlanSkeleton, setShowDayPlanSkeleton] = useState(true);
  const [showDayPlanContent, setShowDayPlanContent] = useState(false);
  const [swipingItemId, setSwipingItemId] = useState(null);
  const [swipeOffsetX, setSwipeOffsetX] = useState(0);
  /** 인라인 캘린더에 표시할 월 목록 `YYYY-MM` (열 때만 설정) */
  const [calendarMonthRange, setCalendarMonthRange] = useState(null);
  const [markedDates, setMarkedDates] = useState(new Set());
  const [repeatingTemplates, setRepeatingTemplates] = useState([]);
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(false);
  const [templateDraftContent, setTemplateDraftContent] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState(null);
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

  const templateSwipeRef = useRef({
    templateId: null,
    startX: 0,
    startY: 0,
    dragging: false,
    horizontalLocked: false,
    didMove: false,
    offsetX: 0,
  });
  const [swipingTemplateId, setSwipingTemplateId] = useState(null);
  const [templateSwipeOffsetX, setTemplateSwipeOffsetX] = useState(0);
  const deleteRepeatingTemplateRef = useRef(null);
  const applyRepeatingTemplateRef = useRef(null);
  const suppressTemplateItemClickUntilRef = useRef(0);
  const statsSwipeRef = useRef({
    startX: 0,
    startY: 0,
    tracking: false,
  });

  const canAdd = useMemo(() => {
    return newContent.trim().length > 0;
  }, [newContent]);

  const sortItemsByTimeAsc = useCallback((list) => {
    return [...list].sort((a, b) => {
      const aStart = a.startTime || a.time || "09:00";
      const bStart = b.startTime || b.time || "09:00";
      if (aStart === bStart) {
        const aEnd = a.endTime || "";
        const bEnd = b.endTime || "";
        if (aEnd === bEnd) return 0;
        return aEnd < bEnd ? -1 : 1;
      }
      return aStart < bStart ? -1 : 1;
    });
  }, []);

  const serializePlan = useCallback(
      (plan) =>
          JSON.stringify({
            important3: normalizeDayPlan(plan).important3,
            brainDump: normalizeDayPlan(plan).brainDump,
            items: sortItemsByTimeAsc(normalizeDayPlan(plan).items).map((it) => ({
              id: it.id,
              startTime: it.startTime || it.time || "09:00",
              endTime: it.endTime || "",
              content: it.content,
              done: Boolean(it.done),
              executedSeconds:
                typeof it.executedSeconds === "number" && Number.isFinite(it.executedSeconds)
                  ? Math.max(0, Math.floor(it.executedSeconds))
                  : 0,
            })),
          }),
      [sortItemsByTimeAsc]
  );

  const filledImportant3 = useMemo(
      () => important3.map((v) => v.trim()).filter(Boolean),
      [important3]
  );

  const templateDraftCanSave = useMemo(() => templateDraftContent.trim().length > 0, [templateDraftContent]);

  const editingTemplate = useMemo(() => {
    if (!editingTemplateId) return null;
    return repeatingTemplates.find((t) => t.id === editingTemplateId) ?? null;
  }, [editingTemplateId, repeatingTemplates]);

  const isEditingTemplateChanged = useMemo(() => {
    if (!editingTemplate) return false;
    return editingTemplate.content !== templateDraftContent.trim();
  }, [editingTemplate, templateDraftContent]);

  const [statsDayYmd, setStatsDayYmd] = useState(() => initialSelectedDate || toLocalYmd(new Date()));
  const [dailyStats, setDailyStats] = useState({
    loading: false,
    dateYmd: "",
    items: [],
    totalPlannedSeconds: 0,
    totalExecutedSeconds: 0,
    dayAchievementPercent: null,
  });

  const statsDayLabel = useMemo(() => {
    const [y, m, d] = statsDayYmd.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  }, [statsDayYmd]);

  const prevStatsOpenRef = useRef(false);
  useEffect(() => {
    if (isStatsOpen && !prevStatsOpenRef.current) {
      setStatsDayYmd(selectedDate);
    }
    prevStatsOpenRef.current = isStatsOpen;
  }, [isStatsOpen, selectedDate]);

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
        (editingItem.startTime || editingItem.time || "09:00") !== newStartTime ||
        (editingItem.endTime || "") !== newEndTime ||
        editingItem.content !== newContent.trim()
    );
  }, [editingItem, newContent, newEndTime, newStartTime]);

  const addItem = () => {
    if (!canAdd) return;
    const id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setItems((prev) =>
        sortItemsByTimeAsc([
          ...prev,
          {
            id,
            startTime: newStartTime,
            endTime: newEndTime,
            content: newContent.trim(),
            done: false,
            executedSeconds: 0,
          },
        ])
    );
    setNewContent("");
  };

  const startEditItem = (item) => {
    setEditingId(item.id);
    setNewStartTime(item.startTime || item.time || "09:00");
    setNewEndTime(item.endTime || "");
    setNewContent(item.content);
  };

  const resetEditState = () => {
    setEditingId(null);
    setNewStartTime("09:00");
    setNewEndTime("");
    setNewContent("");
  };

  const resetTemplateDraft = useCallback(() => {
    setEditingTemplateId(null);
    setTemplateDraftContent("");
  }, []);

  const finalizeReportClose = useCallback(() => {
    setIsReportOpen(false);
  }, []);

  const finalizeStatsClose = useCallback(() => {
    setIsStatsOpen(false);
  }, []);

  const finalizeTemplatesClose = useCallback(() => {
    setIsTemplatesOpen(false);
    resetTemplateDraft();
  }, [resetTemplateDraft]);

  const reportModalAnim = useModalOpenAnimation(isReportOpen, finalizeReportClose);
  const statsModalAnim = useModalOpenAnimation(isStatsOpen, finalizeStatsClose);
  const templatesModalAnim = useModalOpenAnimation(isTemplatesOpen, finalizeTemplatesClose);

  const closeReportModal = reportModalAnim.requestClose;
  const closeStatsModal = statsModalAnim.requestClose;
  const closeTemplatesModal = templatesModalAnim.requestClose;

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
                      startTime: newStartTime,
                      endTime: newEndTime,
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
    if (activeExecutionItemId === editingId) {
      setActiveExecutionItemId(null);
      setActiveExecutionStartedAtMs(null);
      setExecutionNowMs(Date.now());
    }
    resetEditState();
  };

  const deleteItemById = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (activeExecutionItemId === id) {
      setActiveExecutionItemId(null);
      setActiveExecutionStartedAtMs(null);
      setExecutionNowMs(Date.now());
    }
    if (editingId === id) {
      resetEditState();
    }
  };

  const resetExecutionState = useCallback(() => {
    setActiveExecutionItemId(null);
    setActiveExecutionStartedAtMs(null);
    setExecutionNowMs(Date.now());
  }, []);

  const startExecution = useCallback(
      (id, nowMs) => {
        const startedAt = nowMs ?? Date.now();

        // 실행 중이던 항목이 있다면 먼저 정지시킨다.
        if (activeExecutionItemId && activeExecutionItemId !== id) {
          const elapsedSeconds =
              activeExecutionStartedAtMs
                ? Math.max(0, Math.floor((startedAt - activeExecutionStartedAtMs) / 1000))
                : 0;

          setItems((prev) =>
              prev.map((it) =>
                  it.id === activeExecutionItemId
                      ? {
                        ...it,
                        done: false,
                        executedSeconds: (it.executedSeconds ?? 0) + elapsedSeconds,
                      }
                      : it
              )
          );
        }

        setActiveExecutionItemId(id);
        setActiveExecutionStartedAtMs(startedAt);
        setExecutionNowMs(startedAt);

        setItems((prev) =>
            prev.map((it) => (it.id === id ? { ...it, done: true } : it))
        );
      },
      [activeExecutionItemId, activeExecutionStartedAtMs]
  );

  const stopExecution = useCallback(
      (id, nowMs) => {
        const now = nowMs ?? Date.now();
        const elapsedSeconds =
            activeExecutionItemId === id && activeExecutionStartedAtMs
              ? Math.max(0, Math.floor((now - activeExecutionStartedAtMs) / 1000))
              : 0;

        setItems((prev) =>
            prev.map((it) =>
                it.id === id
                    ? {
                      ...it,
                      done: false,
                      executedSeconds: (it.executedSeconds ?? 0) + elapsedSeconds,
                    }
                    : it
            )
        );

        resetExecutionState();
      },
      [activeExecutionItemId, activeExecutionStartedAtMs, resetExecutionState]
  );

  const mergeExecutionItemIntoState = useCallback(
      (updated) => {
        if (!updated || typeof updated.id !== "string") return;
        setItems((prev) => {
          const next = sortItemsByTimeAsc(
              prev.map((it) => (it.id === updated.id ? { ...it, ...updated } : it))
          );
          dayPlanCacheRef.current.set(
              selectedDate,
              normalizeDayPlan({ important3, brainDump, items: next })
          );
          return next;
        });
      },
      [brainDump, important3, selectedDate, sortItemsByTimeAsc]
  );

  const toggleExecutionBySwipe = useCallback(
      async (id) => {
        const target = items.find((it) => it.id === id);
        if (!target) return;

        const running =
            Boolean(target.executionStartedAt) || Boolean(target.done);

        if (isDayPlanItemUuid(id) && typeof dayPlanRepository.startExecution === "function") {
          try {
            if (!running) {
              try {
                const updated = await dayPlanRepository.startExecution(selectedDate, id);
                if (updated) mergeExecutionItemIntoState(updated);
              } catch (err) {
                if (err?.status === 404) {
                  await dayPlanRepository.saveByDate(
                      selectedDate,
                      normalizeDayPlan({ important3, brainDump, items })
                  );
                  lastSavedPlanRef.current = serializePlan({ important3, brainDump, items });
                  const updated = await dayPlanRepository.startExecution(selectedDate, id);
                  if (updated) mergeExecutionItemIntoState(updated);
                } else {
                  throw err;
                }
              }
            } else if (target.executionStartedAt) {
              const updated = await dayPlanRepository.stopExecution(selectedDate, id);
              if (updated) mergeExecutionItemIntoState(updated);
            } else {
              stopExecution(id, Date.now());
            }
          } catch (error) {
            console.error("Execution API failed", error);
          }
          return;
        }

        if (!running) {
          startExecution(id, Date.now());
        } else {
          stopExecution(id, Date.now());
        }
      },
      [
        items,
        selectedDate,
        dayPlanRepository,
        mergeExecutionItemIntoState,
        startExecution,
        stopExecution,
        important3,
        brainDump,
        serializePlan,
      ]
  );

  const getDisplayedExecutionSeconds = useCallback(
      (item) => {
        const base = typeof item.executedSeconds === "number" ? Math.max(0, Math.floor(item.executedSeconds)) : 0;
        if (item.executionStartedAt) {
          const ms = Date.parse(item.executionStartedAt);
          if (Number.isFinite(ms)) {
            return base + Math.max(0, Math.floor((executionNowMs - ms) / 1000));
          }
        }
        if (activeExecutionItemId === item.id && activeExecutionStartedAtMs) {
          return base + Math.max(0, Math.floor((executionNowMs - activeExecutionStartedAtMs) / 1000));
        }
        return base;
      },
      [activeExecutionItemId, activeExecutionStartedAtMs, executionNowMs]
  );

  const formatSecondsToMMSS = useCallback((totalSeconds) => {
    const s = Math.max(0, Math.floor(totalSeconds));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    const serverRunning = items.some((it) => Boolean(it.executionStartedAt));
    if (!serverRunning && (!activeExecutionItemId || !activeExecutionStartedAtMs)) return;
    const intervalId = window.setInterval(() => setExecutionNowMs(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [items, activeExecutionItemId, activeExecutionStartedAtMs]);

  useEffect(() => {
    // 날짜 전환 시에는 실행(가상 타이머) 상태를 끊어준다.
    resetExecutionState();
  }, [selectedDate, resetExecutionState]);

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
      toggleExecutionBySwipe(id);
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

  const handleStatsTouchStart = useCallback((event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    statsSwipeRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      tracking: true,
    };
  }, []);

  const handleStatsTouchEnd = useCallback(
      (event) => {
        const touch = event.changedTouches?.[0];
        const gesture = statsSwipeRef.current;
        statsSwipeRef.current = {
          startX: 0,
          startY: 0,
          tracking: false,
        };

        if (!touch || !gesture.tracking) return;

        const dx = touch.clientX - gesture.startX;
        const dy = touch.clientY - gesture.startY;

        if (dy >= 96 && Math.abs(dy) > Math.abs(dx)) {
          closeStatsModal();
          event.preventDefault();
          event.stopPropagation();
        }
      },
      [closeStatsModal]
  );

  const handleTemplateTouchStart = useCallback((id, event) => {
    const touch = event.touches?.[0];
    if (!touch) return;

    templateSwipeRef.current = {
      templateId: id,
      startX: touch.clientX,
      startY: touch.clientY,
      dragging: true,
      horizontalLocked: false,
      didMove: false,
      offsetX: 0,
    };

    setSwipingTemplateId(id);
    setTemplateSwipeOffsetX(0);
  }, []);

  const handleTemplateTouchMove = useCallback((id, event) => {
    const touch = event.touches?.[0];
    const gesture = templateSwipeRef.current;
    if (!touch || !gesture.dragging || gesture.templateId !== id) return;

    const dx = touch.clientX - gesture.startX;
    const dy = touch.clientY - gesture.startY;

    if (!gesture.horizontalLocked) {
      if (Math.abs(dx) < 6) return;
      if (Math.abs(dx) <= Math.abs(dy)) {
        gesture.dragging = false;
        setSwipingTemplateId(null);
        setTemplateSwipeOffsetX(0);
        return;
      }
      gesture.horizontalLocked = true;
    }

    const nextOffset = Math.max(-120, Math.min(96, dx));
    gesture.didMove = Math.abs(nextOffset) > 10;
    gesture.offsetX = nextOffset;
    setTemplateSwipeOffsetX(nextOffset);
  }, []);

  const handleTemplateTouchEnd = useCallback(
      (id) => {
        const gesture = templateSwipeRef.current;
        const isSame = gesture.templateId === id;
        const offset = gesture.offsetX ?? 0;
        const shouldDelete = isSame && offset <= -72;
        const shouldApplyRight = isSame && offset >= 72;
        const didMove = isSame && gesture.didMove;

        templateSwipeRef.current = {
          templateId: null,
          startX: 0,
          startY: 0,
          dragging: false,
          horizontalLocked: false,
          didMove: false,
          offsetX: 0,
        };

        setSwipingTemplateId(null);
        setTemplateSwipeOffsetX(0);

        if (shouldDelete) {
          suppressTemplateItemClickUntilRef.current = Date.now() + 500;
          deleteRepeatingTemplateRef.current?.(id);
          return true;
        }
        if (shouldApplyRight) {
          const template = repeatingTemplates.find((t) => t.id === id);
          if (template) {
            suppressTemplateItemClickUntilRef.current = Date.now() + 500;
            applyRepeatingTemplateRef.current?.(template);
            closeTemplatesModal();
          }
          return true;
        }
        return didMove;
      },
      [repeatingTemplates, closeTemplatesModal]
  );

  const handleTemplatesModalTouchStart = useCallback((event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    statsSwipeRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      tracking: true,
    };
  }, []);

  const handleTemplatesModalTouchEnd = useCallback(
      (event) => {
        const touch = event.changedTouches?.[0];
        const gesture = statsSwipeRef.current;
        statsSwipeRef.current = {
          startX: 0,
          startY: 0,
          tracking: false,
        };

        if (!touch || !gesture.tracking) return;

        const dx = touch.clientX - gesture.startX;
        const dy = touch.clientY - gesture.startY;

        if (dy >= 96 && Math.abs(dy) > Math.abs(dx)) {
          closeTemplatesModal();
          event.preventDefault();
          event.stopPropagation();
        }
      },
      [closeTemplatesModal]
  );

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
          setIsAuthBootstrapDone(true);
          setAuthReady(true);
        }
      }
    };

    if (!initialAuthUser?.id) {
      setIsAuthBootstrapDone(false);
      setAuthReady(false);
    }
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
      resetExecutionState();
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
        resetExecutionState();
        setImportant3(plan.important3);
        setBrainDump(plan.brainDump);
        setItems(sortItemsByTimeAsc(plan.items));
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load day plan", error);
          resetExecutionState();
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

  const hasCachedSelectedPlan = dayPlanCacheRef.current.has(selectedDate);
  const isDateTransitionLoading =
      Boolean(authUser?.id) &&
      readyDate !== "" &&
      readyDate !== selectedDate &&
      !hasCachedSelectedPlan;
  const isDayPlanLoading =
      !authReady ||
      (authUser?.id &&
          (readyDate === "" ||
              (readyDate !== selectedDate && !hasCachedSelectedPlan) ||
              !isInitialSkeletonDelayDone));

  useEffect(() => {
    if (isDayPlanLoading) {
      setShowDayPlanSkeleton(true);
      setShowDayPlanContent(false);
      return;
    }

    const contentTimer = setTimeout(() => {
      setShowDayPlanContent(true);
    }, 150);

    const skeletonTimer = setTimeout(() => {
      setShowDayPlanSkeleton(false);
    }, 340);

    return () => {
      clearTimeout(contentTimer);
      clearTimeout(skeletonTimer);
    };
  }, [isDayPlanLoading]);

  const [showAuthTransitionContent, setShowAuthTransitionContent] = useState(Boolean(initialAuthUser?.id));

  useEffect(() => {
    if (!isAuthBootstrapDone) {
      setShowAuthTransitionContent(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowAuthTransitionContent(true);
    }, 220);

    return () => clearTimeout(timer);
  }, [isAuthBootstrapDone]);

  useEffect(() => {
    if (!isReportOpen && !isStatsOpen && !isTemplatesOpen) return;

    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY;
    const previousBodyStyle = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    const previousHtmlOverscroll = html.style.overscrollBehavior;

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    html.style.overscrollBehavior = "none";

    return () => {
      body.style.overflow = previousBodyStyle.overflow;
      body.style.position = previousBodyStyle.position;
      body.style.top = previousBodyStyle.top;
      body.style.width = previousBodyStyle.width;
      html.style.overscrollBehavior = previousHtmlOverscroll;
      window.scrollTo(0, scrollY);
    };
  }, [isReportOpen, isStatsOpen, isTemplatesOpen]);

  useEffect(() => {
    if (!isStatsOpen || !authUser?.id) return;

    let cancelled = false;

    const loadDailyStats = async () => {
      setDailyStats((prev) => ({ ...prev, loading: true }));
      try {
        const dateYmd = statsDayYmd;
        let plan;
        if (dayPlanCacheRef.current.has(dateYmd)) {
          plan = normalizeDayPlan(dayPlanCacheRef.current.get(dateYmd));
        } else {
          plan = await dayPlanRepository.getByDate(dateYmd);
          dayPlanCacheRef.current.set(dateYmd, plan);
        }

        if (cancelled) return;

        const rawItems = sortItemsByTimeAsc(normalizeDayPlan(plan).items);
        const items = rawItems.map((it) => {
          const startTime = it.startTime || it.time || "09:00";
          const planned = getPlannedDurationSeconds(startTime, it.endTime);
          const executed = Math.max(0, Math.floor(it.executedSeconds ?? 0));
          let achievementPercent = null;
          if (planned != null && planned > 0) {
            achievementPercent = Math.min(100, (executed / planned) * 100);
          }
          const startSec = parseHHMMToSecondsFromMidnight(startTime);
          const daySharePercent =
              planned != null && planned > 0 ? (planned / SECONDS_PER_DAY) * 100 : null;
          return {
            id: it.id,
            content: it.content,
            startTime,
            endTime: it.endTime || "",
            plannedSeconds: planned,
            executedSeconds: executed,
            achievementPercent,
            startSecondsFromMidnight: startSec ?? 0,
            daySharePercent,
          };
        });

        let totalPlannedSeconds = 0;
        let weightedPlanned = 0;
        let weightedExecuted = 0;
        for (const row of items) {
          if (row.plannedSeconds != null && row.plannedSeconds > 0) {
            totalPlannedSeconds += row.plannedSeconds;
            weightedPlanned += row.plannedSeconds;
            weightedExecuted += row.executedSeconds;
          }
        }
        const totalExecutedSeconds = items.reduce((s, r) => s + r.executedSeconds, 0);
        const dayAchievementPercent =
            weightedPlanned > 0 ? Math.min(100, (weightedExecuted / weightedPlanned) * 100) : null;

        setDailyStats({
          loading: false,
          dateYmd,
          items,
          totalPlannedSeconds,
          totalExecutedSeconds,
          dayAchievementPercent,
        });
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load daily stats", error);
        setDailyStats({
          loading: false,
          dateYmd: statsDayYmd,
          items: [],
          totalPlannedSeconds: 0,
          totalExecutedSeconds: 0,
          dayAchievementPercent: null,
        });
      }
    };

    loadDailyStats();

    return () => {
      cancelled = true;
    };
  }, [authUser?.id, dayPlanRepository, isStatsOpen, sortItemsByTimeAsc, statsDayYmd]);

  useEffect(() => {
    if (!isTemplatesOpen || !authUser?.id) return;

    let cancelled = false;

    const loadTemplates = async () => {
      setIsTemplatesLoading(true);
      try {
        const templates = await dayPlanRepository.listRepeatingTemplates?.();
        if (!cancelled) {
          setRepeatingTemplates(Array.isArray(templates) ? templates : []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load repeating templates", error);
          setRepeatingTemplates([]);
        }
      } finally {
        if (!cancelled) {
          setIsTemplatesLoading(false);
        }
      }
    };

    loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [authUser?.id, dayPlanRepository, isTemplatesOpen]);

  const applyRepeatingTemplate = useCallback((template) => {
    if (!template) return;
    setNewContent(typeof template.content === "string" ? template.content : "");
    setEditingId(null);
  }, []);

  useEffect(() => {
    applyRepeatingTemplateRef.current = applyRepeatingTemplate;
  }, [applyRepeatingTemplate]);

  const startEditingTemplate = useCallback((template) => {
    setEditingTemplateId(template.id);
    setTemplateDraftContent(template.content);
  }, []);

  const saveRepeatingTemplate = useCallback(async () => {
    const content = templateDraftContent.trim();
    if (!content) return;

    try {
      if (editingTemplateId) {
        const updated = await dayPlanRepository.updateRepeatingTemplate?.(editingTemplateId, {
          content,
        });
        if (updated) {
          setRepeatingTemplates((prev) =>
            prev.map((item) => (item.id === editingTemplateId ? updated : item))
          );
        }
      } else {
        const created = await dayPlanRepository.createRepeatingTemplate?.({
          content,
        });
        if (created) {
          setRepeatingTemplates((prev) =>
            [...prev, created].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          );
        }
      }
      resetTemplateDraft();
    } catch (error) {
      console.error("Failed to save repeating template", error);
    }
  }, [dayPlanRepository, editingTemplateId, resetTemplateDraft, templateDraftContent]);

  const deleteRepeatingTemplate = useCallback(
      async (templateId) => {
        try {
          await dayPlanRepository.deleteRepeatingTemplate?.(templateId);
          setRepeatingTemplates((prev) => prev.filter((item) => item.id !== templateId));
          if (editingTemplateId === templateId) {
            resetTemplateDraft();
          }
        } catch (error) {
          console.error("Failed to delete repeating template", error);
        }
      },
      [dayPlanRepository, editingTemplateId, resetTemplateDraft]
  );

  useEffect(() => {
    deleteRepeatingTemplateRef.current = deleteRepeatingTemplate;
  }, [deleteRepeatingTemplate]);

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
      setActiveExecutionItemId(null);
      setActiveExecutionStartedAtMs(null);
      setExecutionNowMs(Date.now());
      setIsReportOpen(false);
      setIsStatsOpen(false);
      setIsTemplatesOpen(false);
      setIsDatePickerOpen(false);
    }
  };

  if (!authUser) {
    return (
        <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#F2F2F7]">
          <div
              className="pointer-events-none absolute inset-0 opacity-70"
              aria-hidden
              style={{
                backgroundImage:
                    "radial-gradient(circle at top, rgba(255,255,255,0.85), transparent 42%), linear-gradient(180deg, rgba(255,255,255,0.28), rgba(0,0,0,0.03))",
              }}
          />
          <section
              className="relative mx-auto flex w-full max-w-md flex-col px-8 py-12 sm:px-10"
              style={{ paddingBottom: "max(3rem, calc(env(safe-area-inset-bottom) + 2rem))" }}
          >
          <div className="relative min-h-[70dvh]">
            <div
                className={[
                  "absolute inset-0 w-full transition-[opacity,transform,filter] duration-820 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity,transform]",
              showAuthTransitionContent
                ? "pointer-events-none absolute inset-0 translate-y-0.5 scale-[0.998] opacity-0 blur-[0.5px]"
                : "translate-y-0 scale-100 opacity-100 blur-0",
                ].join(" ")}
                aria-hidden={showAuthTransitionContent}
            >
            <div className="flex min-h-[70dvh] items-center justify-center">
                <div className="flex items-center gap-3" aria-hidden>
                  <div className="space-y-2">
                    <div className="h-[2px] w-3.5 rounded-full bg-slate-300" />
                    <div className="h-[2px] w-3.5 rounded-full bg-slate-300" />
                    <div className="h-[2px] w-3.5 rounded-full bg-slate-300" />
                  </div>
                  <div className="space-y-2.5">
                    <div className="h-2.5 w-11 rounded-full bg-slate-700/85" />
                    <div className="h-2.5 w-9 rounded-full bg-slate-400/85" />
                    <div className="h-2.5 w-13 rounded-full bg-slate-700/85" />
                  </div>
                </div>
              </div>
            </div>

            <div
                className={[
                  "absolute inset-0 w-full transition-[opacity,transform,filter] duration-650 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity,transform]",
              showAuthTransitionContent
                ? "translate-y-0 scale-100 opacity-100 blur-0"
                : "pointer-events-none translate-y-1 scale-[0.998] opacity-0 blur-[2px]",
                ].join(" ")}
                aria-hidden={!showAuthTransitionContent}
            >
              <div className="flex min-h-[70dvh] flex-col justify-center">
                <div>
                  <h1 className="text-[42px] font-semibold leading-[0.9] tracking-[-0.08em] text-slate-950 sm:text-[52px]">
                    Time
                    <span className="ml-2 inline-block text-slate-300">/</span>
                    <br />
                    <span className="inline-block pl-6">boxing</span>
                  </h1>
                  <p className="mt-3 text-[18px] leading-[1.35] tracking-[-0.03em] text-slate-700">
                    Plan your day.
                  </p>
                  <p className="mt-2 text-[14px] leading-6 text-slate-400">
                    Focus on what matters most.
                  </p>
                </div>

                <div className="mt-14 max-w-sm">
                  <button
                      type="button"
                      onClick={handleLogin}
                      aria-label="Google로 로그인"
                      className="group flex h-16 w-16 items-center justify-center rounded-full bg-[#1F1F1F] text-white shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] active:opacity-90"
                  >
                    <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-5 w-5 transition-transform duration-150 group-active:scale-95"
                    >
                      <path
                          fill="#EA4335"
                          d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.7 3.7 14.6 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.6-3.7 8.6-8.9 0-.6-.1-1.1-.2-1.6z"
                      />
                      <path
                          fill="#34A853"
                          d="M3 16.7l3.1-2.4c.8 1.9 2.6 3.2 5 3.2 3 0 4.7-2 5.3-3H12v-3.8h8.4c.1.4.2 1 .2 1.6 0 5.2-3.5 8.9-8.6 8.9-3.8 0-7-2.2-8.6-5.5z"
                      />
                      <path
                          fill="#FBBC05"
                          d="M4.8 7.9C4.3 8.9 4 10 4 11.2c0 1.2.3 2.3.8 3.3l-1.8 2.2C2.4 15.4 2 13.8 2 12s.4-3.4 1.1-4.8z"
                      />
                      <path
                          fill="#4285F4"
                          d="M12 4.8c2 0 3.4.9 4.2 1.6l2.8-2.8C17.3 2 14.9 1 12 1 8.1 1 4.7 3.2 3 6.4l3 2.3C6.8 6.4 9.1 4.8 12 4.8z"
                      />
                    </svg>
                  </button>
                  <p className="mt-5 text-[11px] leading-5 tracking-[0.12em] text-slate-300">
                    TAP TO SIGN IN
                  </p>
                </div>
              </div>
            </div>
          </div>
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
                        disabled={isDateTransitionLoading}
                        className={[
                          "flex h-10 w-full min-w-[44px] select-none items-center justify-center bg-transparent text-[22px] font-semibold leading-none",
                          "text-orange-700 active:opacity-60",
                          "focus:outline-none focus:ring-2 focus:ring-orange-500/25 rounded-md",
                          isDateTransitionLoading ? "cursor-wait opacity-40" : "",
                        ].join(" ")}
                        onClick={() => setSelectedDate((d) => addDaysToYmd(d, -1))}
                    >
                      ‹
                    </button>

                    <button
                        type="button"
                        aria-label="날짜 선택 열기"
                        disabled={isDateTransitionLoading}
                        className={[
                          "min-w-0 justify-self-stretch rounded-md px-2 py-1 text-center text-[13px] font-semibold text-slate-600",
                          "active:opacity-60 focus:outline-none focus:ring-2 focus:ring-orange-500/25",
                          isDateTransitionLoading ? "cursor-wait opacity-50" : "",
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
                        disabled={isDateTransitionLoading}
                        className={[
                          "flex h-10 w-full min-w-[44px] select-none items-center justify-center bg-transparent text-[22px] font-semibold leading-none",
                          "text-orange-700 active:opacity-60",
                          "focus:outline-none focus:ring-2 focus:ring-orange-500/25 rounded-md",
                          isDateTransitionLoading ? "cursor-wait opacity-40" : "",
                        ].join(" ")}
                        onClick={() => setSelectedDate((d) => addDaysToYmd(d, 1))}
                    >
                      ›
                    </button>
                  </>
              ) : (
                  <>
                    <button
                        type="button"
                        aria-label="오늘 날짜로 이동"
                        disabled={isDateTransitionLoading}
                        onClick={() => {
                          const today = toLocalYmd(new Date());
                          setSelectedDate(today);
                          closeInlineCalendar();
                        }}
                        className={[
                          "flex h-10 w-full min-w-[44px] shrink-0 items-center justify-center rounded-md bg-transparent text-orange-700 active:opacity-60",
                          "focus:outline-none focus:ring-2 focus:ring-orange-500/25",
                          isDateTransitionLoading ? "cursor-wait opacity-40" : "",
                        ].join(" ")}
                    >
                      <span className="inline-flex items-center justify-center text-[17px]" aria-hidden>
                        ◎
                      </span>
                      <span className="sr-only">오늘</span>
                    </button>
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
                    <div className="flex min-w-[44px] items-center justify-end">
                      <button
                          type="button"
                          aria-label="로그아웃"
                          onClick={handleLogout}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-transparent text-slate-500 active:opacity-60 focus:outline-none focus:ring-2 focus:ring-orange-500/25"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]">
                          <path
                              fill="currentColor"
                              d="M10 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3v-2H7V6h3zm5.59 3.41L14.17 8.83 16.34 11H9v2h7.34l-2.17 2.17 1.42 1.42L20.17 12z"
                          />
                        </svg>
                      </button>
                    </div>
                  </>
              )}
            </div>

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
          <div className="relative grid">
            {showDayPlanSkeleton ? (
                <div
                    className={[
                      "col-start-1 row-start-1 space-y-8 animate-pulse transition-[opacity,transform,filter] duration-420 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      isDayPlanLoading
                        ? "opacity-100 translate-y-0 scale-100 blur-0"
                        : "pointer-events-none opacity-0 -translate-y-0.5 scale-[0.996] blur-[1.5px]",
                    ].join(" ")}
                    aria-label="일정 불러오는 중"
                >
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
            ) : null}
            <div
                className={[
                  "col-start-1 row-start-1 space-y-8 transition-[opacity,transform,filter] duration-420 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  showDayPlanContent
                    ? "opacity-100 translate-y-0 scale-100 blur-0"
                    : "pointer-events-none opacity-0 translate-y-1 scale-[0.998] blur-[2px]",
                ].join(" ")}
            >
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
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <TimeRangeSelectors
                          startTime={newStartTime}
                          endTime={newEndTime}
                          onChangeStartTime={setNewStartTime}
                          onChangeEndTime={setNewEndTime}
                          disabled={isDatePickerOpen}
                      />
                    </div>
                    <div className="flex items-end gap-3">
                      <div className="min-w-0 flex-1">
                        <ComposerContentInput
                            value={newContent}
                            placeholder="예: 고객 피드백 정리"
                            disabled={isDatePickerOpen}
                            onChange={setNewContent}
                        />
                      </div>
                      <div className="w-[56px] shrink-0">
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
                                <div className="w-min max-w-full shrink-0 whitespace-nowrap select-none text-[13px] font-semibold tabular-nums leading-snug tracking-tight text-orange-700">
                                  {it.endTime ? `${it.startTime} - ${it.endTime}` : it.startTime}
                                </div>
                                <div className="min-w-0 flex-1 basis-0">
                                  <div
                                      className={[
                                        "whitespace-pre-wrap break-words text-sm leading-snug",
                                        it.done ? "text-slate-500 line-through" : "text-slate-900",
                                      ].join(" ")}
                                  >
                                    {it.content}
                                  </div>
                                </div>
                                {(it.done || (it.executedSeconds ?? 0) > 0) ? (
                                    <span
                                        className={[
                                          "inline-flex h-5 min-w-[5.25rem] shrink-0 items-center justify-center rounded-full px-2 text-[11px] font-semibold tabular-nums",
                                          it.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600",
                                        ].join(" ")}
                                    >
                                      실행 {formatSecondsToMMSS(getDisplayedExecutionSeconds(it))}
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
          </div>
        </div>

        {!isDatePickerOpen ? (
            <div className="fixed inset-x-0 bottom-0 z-30">
              <div className="mx-auto w-full max-w-md px-4 pb-4 pt-2">
                <div className="flex justify-end gap-2">
                  <button
                      type="button"
                      aria-label="반복 내용 관리 열기"
                      onClick={() => {
                        setIsDatePickerOpen(false);
                        setIsTemplatesOpen(true);
                      }}
                      className={[
                        "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white p-0",
                        "text-slate-900 shadow-md ring-1 ring-black/[0.06]",
                        "active:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500/20",
                      ].join(" ")}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[20px] w-[20px]">
                      <path
                          fill="currentColor"
                          d="M4 7.5C4 6.67 4.67 6 5.5 6h8C14.33 6 15 6.67 15 7.5v8c0 .83-.67 1.5-1.5 1.5h-8C4.67 17 4 16.33 4 15.5zm5-3C9 3.67 9.67 3 10.5 3h8c.83 0 1.5.67 1.5 1.5v8c0 .83-.67 1.5-1.5 1.5H17v-6.5C17 5.57 15.43 4 13.5 4H9z"
                      />
                    </svg>
                  </button>
                  <button
                      type="button"
                      aria-label="일자별 통계 열기"
                      onClick={() => {
                        setIsDatePickerOpen(false);
                        setStatsDayYmd(selectedDate);
                        setIsStatsOpen(true);
                      }}
                      className={[
                        "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-900 p-0",
                        "text-white shadow-md",
                        "active:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500/30",
                      ].join(" ")}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[20px] w-[20px]">
                      <path
                          fill="currentColor"
                          d="M5 19V9h3v10zm5 0V5h3v14zm5 0v-7h3v7z"
                      />
                    </svg>
                  </button>
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
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[22px] w-[22px]">
                      <path
                          fill="currentColor"
                          d="M9 3a2 2 0 0 0-2 2H6a2 2 0 0 0-2 2v11a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a2 2 0 0 0-2-2h-1a2 2 0 0 0-2-2zm0 2h6v2H9zm-1 6h8v2H8zm0 4h8v2H8z"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
        ) : null}

        {isTemplatesOpen ? (
            <div
                className={modalBackdropClass(templatesModalAnim.showOverlay)}
                onClick={closeTemplatesModal}
            >
              <div className="flex h-full min-h-0 w-full max-w-none items-stretch justify-center px-0 pb-0 pt-0">
                <section
                    className={modalPanelClass(templatesModalAnim.showOverlay)}
                    onClick={(e) => e.stopPropagation()}
                    onTouchStart={handleTemplatesModalTouchStart}
                    onTouchEnd={handleTemplatesModalTouchEnd}
                    onTouchCancel={() => {
                      statsSwipeRef.current = {
                        startX: 0,
                        startY: 0,
                        tracking: false,
                      };
                    }}
                    style={{ touchAction: "pan-y" }}
                >
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.06] px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug text-slate-700">반복 내용</p>
                      <p className="mt-0.5 text-[12px] text-slate-400">자주 쓰는 타임블록 내용을 저장해두고 빠르게 불러오세요</p>
                    </div>
                    <button
                        type="button"
                        aria-label="반복 내용 모달 닫기"
                        onClick={closeTemplatesModal}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-transparent text-[18px] font-semibold leading-none text-slate-500 active:opacity-60"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4 [-webkit-overflow-scrolling:touch]">
                    <div className="space-y-5">
                      <section>
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <ComposerContentInput
                                  value={templateDraftContent}
                                  placeholder="예: 데일리 체크인, 메일 확인, 운동"
                                  onChange={setTemplateDraftContent}
                              />
                            </div>
                            <div className="w-[56px]">
                              {editingTemplateId ? (
                                  isEditingTemplateChanged ? (
                                      <button
                                          type="button"
                                          aria-label="저장"
                                          disabled={!templateDraftCanSave}
                                          onClick={saveRepeatingTemplate}
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
                                          onClick={resetTemplateDraft}
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
                                      disabled={!templateDraftCanSave}
                                      onClick={saveRepeatingTemplate}
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
                        </div>
                      </section>

                      <section>
                        <div className="flex items-center justify-between">
                          <h3 className="text-[13px] font-semibold text-slate-500">저장된 반복 내용</h3>
                          <span className="text-[11px] text-slate-400">{repeatingTemplates.length}개</span>
                        </div>

                        {isTemplatesLoading ? (
                            <div className="mt-4 space-y-3">
                              {Array.from({ length: 4 }).map((_, idx) => (
                                  <div key={idx} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
                              ))}
                            </div>
                        ) : repeatingTemplates.length > 0 ? (
                            <div className="mt-3 space-y-3">
                              {repeatingTemplates.map((template) => (
                                  <div
                                      key={template.id}
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => {
                                        if (Date.now() < suppressTemplateItemClickUntilRef.current) return;
                                        startEditingTemplate(template);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          startEditingTemplate(template);
                                        }
                                      }}
                                      onTouchStart={(e) => handleTemplateTouchStart(template.id, e)}
                                      onTouchMove={(e) => handleTemplateTouchMove(template.id, e)}
                                      onTouchEnd={(e) => {
                                        const moved = handleTemplateTouchEnd(template.id);
                                        if (moved) {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }
                                      }}
                                      onTouchCancel={() => {
                                        templateSwipeRef.current = {
                                          templateId: null,
                                          startX: 0,
                                          startY: 0,
                                          dragging: false,
                                          horizontalLocked: false,
                                          didMove: false,
                                          offsetX: 0,
                                        };
                                        setSwipingTemplateId(null);
                                        setTemplateSwipeOffsetX(0);
                                      }}
                                      className={[
                                        "cursor-pointer rounded-md px-1 py-1 outline-none transition-colors",
                                        "hover:bg-black/[0.02] focus:bg-black/[0.04]",
                                      ].join(" ")}
                                      style={{
                                        touchAction: "pan-y",
                                        transform:
                                            swipingTemplateId === template.id && templateSwipeOffsetX !== 0
                                                ? `translateX(${templateSwipeOffsetX}px)`
                                                : "translateX(0)",
                                        transition:
                                            swipingTemplateId === template.id
                                                ? "none"
                                                : "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
                                      }}
                                  >
                                        <div className="flex items-start gap-2">
                                          <div className="min-w-0 flex-1">
                                            <div className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900">
                                              {template.content}
                                            </div>
                                          </div>
                                        </div>
                                  </div>
                              ))}
                            </div>
                        ) : (
                            <p className="mt-4 text-sm text-slate-400">아직 저장된 반복 내용이 없습니다.</p>
                        )}
                      </section>
                    </div>
                  </div>
                </section>
              </div>
            </div>
        ) : null}

        {isStatsOpen ? (
            <div
                className={modalBackdropClass(statsModalAnim.showOverlay)}
                onClick={closeStatsModal}
            >
              <div className="flex h-full min-h-0 w-full max-w-none items-stretch justify-center px-0 pb-0 pt-0">
                <section
                    className={modalPanelClass(statsModalAnim.showOverlay)}
                    onClick={(e) => e.stopPropagation()}
                    onTouchStart={handleStatsTouchStart}
                    onTouchEnd={handleStatsTouchEnd}
                    onTouchCancel={() => {
                      statsSwipeRef.current = {
                        startX: 0,
                        startY: 0,
                        tracking: false,
                      };
                    }}
                    style={{ touchAction: "pan-y" }}
                >
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.06] px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug text-slate-700">{statsDayLabel}</p>
                      <p className="mt-0.5 text-[12px] text-slate-400">계획(종료−시작) 대비 실행 시간 달성률</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                          type="button"
                          aria-label="이전 날"
                          onClick={() => setStatsDayYmd((prev) => addDaysToYmd(prev, -1))}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-transparent text-[18px] font-semibold leading-none text-slate-500 active:opacity-60"
                      >
                        ‹
                      </button>
                      <button
                          type="button"
                          aria-label="다음 날"
                          onClick={() => setStatsDayYmd((prev) => addDaysToYmd(prev, 1))}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-transparent text-[18px] font-semibold leading-none text-slate-500 active:opacity-60"
                      >
                        ›
                      </button>
                      <button
                          type="button"
                          aria-label="통계 닫기"
                          onClick={closeStatsModal}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-transparent text-[18px] font-semibold leading-none text-slate-500 active:opacity-60"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4 [-webkit-overflow-scrolling:touch]">
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-slate-50 px-4 py-4">
                          <p className="text-[12px] font-medium text-slate-500">계획 시간 합</p>
                          <p className="mt-2 text-lg font-semibold tracking-[-0.04em] text-slate-900">
                            {dailyStats.loading
                              ? "…"
                              : formatSecondsAsDurationKo(dailyStats.totalPlannedSeconds)}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">종료 시간이 있는 일정만 합산</p>
                        </div>
                        <div className="rounded-2xl bg-emerald-50 px-4 py-4">
                          <p className="text-[12px] font-medium text-emerald-700">실행 기록 합</p>
                          <p className="mt-2 text-lg font-semibold tracking-[-0.04em] text-emerald-800">
                            {dailyStats.loading
                              ? "…"
                              : formatSecondsAsDurationKo(dailyStats.totalExecutedSeconds)}
                          </p>
                          <p className="mt-1 text-[11px] text-emerald-600/80">스와이프로 누적한 실행 시간</p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-4">
                        <p className="text-[12px] font-medium text-slate-500">이 날짜 하루 달성률</p>
                        <p className="mt-1 text-[32px] font-semibold tabular-nums tracking-[-0.04em] text-slate-900">
                          {dailyStats.loading
                              ? "…"
                              : dailyStats.dayAchievementPercent != null
                                ? `${dailyStats.dayAchievementPercent.toFixed(1)}%`
                                : "—"}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          종료 시간이 있는 항목만, 실행 ÷ 계획 시간으로 가중 평균
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-[13px] font-semibold text-slate-500">24시간 대비 계획 비중</h3>
                          <span className="text-[11px] text-slate-400">하루 86400초 기준</span>
                        </div>
                        <p className="mt-1 text-[11px] leading-snug text-slate-400">
                          시작·종료로 잡힌 계획 시간이 전체 하루에서 차지하는 비율입니다. 시간대가 겹치면 막대가 겹쳐 보일 수 있고, 비중 합계가 100%를 넘을 수 있습니다.
                        </p>

                        {dailyStats.loading ? (
                            <div className="mt-4 h-24 animate-pulse rounded-xl bg-slate-100" />
                        ) : (() => {
                          const planRows = dailyStats.items.filter(
                              (r) => r.plannedSeconds != null && r.plannedSeconds > 0
                          );
                          return planRows.length > 0 ? (
                              <>
                                <div className="relative mt-4 h-16 w-full overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/80">
                                  {[0, 6, 12, 18].map((h) => (
                                      <div
                                          key={`tick_${h}`}
                                          className="pointer-events-none absolute bottom-0 top-0 z-0 border-l border-slate-200/90"
                                          style={{ left: `${(h / 24) * 100}%` }}
                                          aria-hidden
                                      />
                                  ))}
                                  {planRows.map((row, idx) => {
                                    const leftPct = (row.startSecondsFromMidnight / SECONDS_PER_DAY) * 100;
                                    const widthPct = (row.plannedSeconds / SECONDS_PER_DAY) * 100;
                                    const w = Math.max(widthPct, 0.2);
                                    return (
                                        <div
                                            key={`tl_${row.id}`}
                                            className={[
                                              "absolute bottom-2 top-2 z-[1] min-h-[28px] rounded-sm ring-1 ring-white/50",
                                              DAY_TIMELINE_PALETTE[idx % DAY_TIMELINE_PALETTE.length],
                                            ].join(" ")}
                                            style={{
                                              left: `${leftPct}%`,
                                              width: `${Math.min(100 - leftPct, w)}%`,
                                            }}
                                            title={`${row.content}\n${row.startTime}–${row.endTime}\n하루의 ${row.daySharePercent?.toFixed(1)}%`}
                                        />
                                    );
                                  })}
                                </div>
                                <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-slate-400">
                                  <span>0:00</span>
                                  <span>6:00</span>
                                  <span>12:00</span>
                                  <span>18:00</span>
                                  <span>24:00</span>
                                </div>
                                <ul className="mt-4 space-y-2.5">
                                  {planRows.map((row, idx) => (
                                      <li key={`dsp_${row.id}`} className="flex items-start gap-2 text-sm">
                                        <span
                                            className={[
                                              "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm",
                                              DAY_TIMELINE_PALETTE[idx % DAY_TIMELINE_PALETTE.length].replace(
                                                  "/85",
                                                  ""
                                              ),
                                            ].join(" ")}
                                            aria-hidden
                                        />
                                        <div className="min-w-0 flex-1">
                                          <p className="font-medium text-slate-900">
                                            {row.daySharePercent != null ? row.daySharePercent.toFixed(1) : "0.0"}%
                                            <span className="ml-1.5 text-[12px] font-normal text-slate-500">
                                              ({formatSecondsAsDurationKo(row.plannedSeconds ?? 0)} / 24시간)
                                            </span>
                                          </p>
                                          <p className="mt-0.5 line-clamp-2 text-[13px] text-slate-600">{row.content}</p>
                                          <p className="mt-0.5 text-[11px] text-slate-400">
                                            {row.startTime} – {row.endTime}
                                          </p>
                                        </div>
                                      </li>
                                  ))}
                                </ul>
                              </>
                          ) : (
                              <p className="mt-4 text-sm text-slate-400">
                                종료 시간이 설정된 일정이 없어 24시간 비중을 계산할 수 없습니다.
                              </p>
                          );
                        })()}
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[13px] font-semibold text-slate-500">일정별 달성</h3>
                          <span className="text-[11px] text-slate-400">실행 / 계획</span>
                        </div>

                        {dailyStats.loading ? (
                            <div className="mt-4 space-y-4">
                              {Array.from({ length: 4 }).map((_, idx) => (
                                  <div key={idx} className="h-16 animate-pulse rounded-xl bg-slate-100" />
                              ))}
                            </div>
                        ) : dailyStats.items.length > 0 ? (
                            <ul className="mt-4 space-y-4">
                              {dailyStats.items.map((row) => (
                                  <li key={row.id} className="rounded-xl border border-slate-100 bg-white px-3 py-3">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[12px] font-semibold tabular-nums leading-snug tracking-tight text-orange-700">
                                          {row.endTime
                                              ? `${row.startTime} – ${row.endTime}`
                                              : row.startTime}
                                        </p>
                                        <p className="mt-1 line-clamp-2 text-sm leading-snug text-slate-900">{row.content}</p>
                                      </div>
                                      <div className="shrink-0 text-right">
                                        {row.achievementPercent != null ? (
                                            <span className="text-sm font-semibold tabular-nums text-emerald-700">
                                              {row.achievementPercent.toFixed(1)}%
                                            </span>
                                        ) : (
                                            <span className="text-[11px] text-slate-400">비율 없음</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="mt-2 space-y-1">
                                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                        <div
                                            className="h-2 rounded-full bg-emerald-500 transition-[width]"
                                            style={{
                                              width:
                                                  row.achievementPercent != null
                                                    ? `${Math.min(100, row.achievementPercent)}%`
                                                    : "0%",
                                            }}
                                        />
                                      </div>
                                      <p className="text-[11px] text-slate-500">
                                        실행 {formatSecondsAsDurationKo(row.executedSeconds)}
                                        {row.plannedSeconds != null && row.plannedSeconds > 0
                                            ? ` · 계획 ${formatSecondsAsDurationKo(row.plannedSeconds)}`
                                            : row.endTime
                                              ? ""
                                              : " · 종료 시간 없음"}
                                      </p>
                                    </div>
                                  </li>
                              ))}
                            </ul>
                        ) : (
                            <p className="mt-4 text-sm text-slate-400">이 날짜에 일정이 없습니다.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
        ) : null}

        {isReportOpen ? (
            <div
                className={modalBackdropClass(reportModalAnim.showOverlay)}
                onClick={closeReportModal}
            >
              <div className="flex h-full min-h-0 w-full max-w-none items-stretch justify-center px-0 pb-0 pt-0">
                <section
                    className={modalPanelClass(reportModalAnim.showOverlay)}
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
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.06] px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                    <p
                        className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-700"
                        suppressHydrationWarning
                    >
                      {selectedDateLabel}
                    </p>
                    <button
                        type="button"
                        aria-label="리포트 닫기"
                        onClick={closeReportModal}
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
                                    <div className="w-min max-w-full shrink-0 whitespace-nowrap text-[12px] font-semibold tabular-nums leading-snug tracking-tight text-orange-700">
                                      {it.endTime ? `${it.startTime} - ${it.endTime}` : it.startTime}
                                    </div>
                                    <div
                                        className={[
                                          "min-w-0 flex-1 basis-0 break-words text-sm leading-snug",
                                          it.done ? "text-slate-500 line-through" : "text-slate-900",
                                        ].join(" ")}
                                    >
                                      {it.content}
                                    </div>
                                    {(it.done || (it.executedSeconds ?? 0) > 0) ? (
                                        <span
                                            className={[
                                              "inline-flex h-5 min-w-[5.25rem] shrink-0 items-center justify-center rounded-full px-2 text-[11px] font-semibold tabular-nums",
                                              it.done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600",
                                            ].join(" ")}
                                        >
                                          실행 {formatSecondsToMMSS(getDisplayedExecutionSeconds(it))}
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
