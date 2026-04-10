import {
  MAIN_CHAPTER_LATCH_LEAVE_ABOVE_LAST_CHAPTER_PX,
  MAIN_CHAPTER_LATCH_NEAR_BOTTOM_PX,
  resolveMainChapterIdxWithLastChapterLatch,
} from "../components/timeboxing/utils/chapterScrollGeometry.js";

describe("resolveMainChapterIdxWithLastChapterLatch", () => {
  const lastIdx = 2;
  const lastChapterScrollTop = 700;

  it("하단 근처에서 래치가 켜지고 raw가 떨어져도 마지막 챕터 유지", () => {
    const latchRef = { current: false };
    const scrollRange = 1000;
    const scrollTop = 920;
    expect(scrollRange - scrollTop).toBeLessThan(MAIN_CHAPTER_LATCH_NEAR_BOTTOM_PX);

    const out = resolveMainChapterIdxWithLastChapterLatch({
      raw: 1,
      prevIdx: lastIdx,
      lastIdx,
      scrollTop,
      scrollRange,
      lastChapterScrollTop,
      latchRef,
    });
    expect(latchRef.current).toBe(true);
    expect(out).toBe(lastIdx);
  });

  it("큰 러버밴드로 distFromBottom이 커져도 래치가 유지되면 마지막 챕터 유지", () => {
    const latchRef = { current: true };
    const scrollRange = 2000;
    const scrollTop = 520;
    expect(scrollRange - scrollTop).toBeGreaterThan(MAIN_CHAPTER_LATCH_NEAR_BOTTOM_PX);

    const out = resolveMainChapterIdxWithLastChapterLatch({
      raw: 1,
      prevIdx: lastIdx,
      lastIdx,
      scrollTop,
      scrollRange,
      lastChapterScrollTop,
      latchRef,
    });
    expect(latchRef.current).toBe(true);
    expect(out).toBe(lastIdx);
  });

  it("마지막 챕터 상단을 충분히 위로 벗어나면 래치 해제 후 raw 반영", () => {
    const latchRef = { current: true };
    const scrollRange = 2000;
    const scrollTop = lastChapterScrollTop - MAIN_CHAPTER_LATCH_LEAVE_ABOVE_LAST_CHAPTER_PX - 20;

    expect(scrollTop).toBeLessThan(lastChapterScrollTop - MAIN_CHAPTER_LATCH_LEAVE_ABOVE_LAST_CHAPTER_PX);

    const out = resolveMainChapterIdxWithLastChapterLatch({
      raw: 1,
      prevIdx: lastIdx,
      lastIdx,
      scrollTop,
      scrollRange,
      lastChapterScrollTop,
      latchRef,
    });
    expect(latchRef.current).toBe(false);
    expect(out).toBe(1);
  });

  it("스크롤 여유가 거의 없으면 래치 끄고 raw 그대로", () => {
    const latchRef = { current: true };
    const out = resolveMainChapterIdxWithLastChapterLatch({
      raw: 0,
      prevIdx: lastIdx,
      lastIdx,
      scrollTop: 0,
      scrollRange: 4,
      lastChapterScrollTop,
      latchRef,
    });
    expect(latchRef.current).toBe(false);
    expect(out).toBe(0);
  });
});
