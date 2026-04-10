import {
  MAIN_CHAPTER_LATCH_ARM_DIST_PX,
  MAIN_CHAPTER_LATCH_CLEAR_ABOVE_LAST_PX,
  MAIN_CHAPTER_RUBBER_IMMEDIATE_DIST_PX,
  resolveMainChapterIdxWithBottomRubberGuard,
} from "../components/timeboxing/utils/chapterScrollGeometry.js";

describe("resolveMainChapterIdxWithBottomRubberGuard", () => {
  const lastIdx = 2;
  const lastChapterScrollTop = 700;

  it("하단에 가깝(dist < 즉시 px)이면 래치 없이도 마지막 챕터 유지", () => {
    const latchRef = { current: false };
    const scrollRange = 1000;
    const scrollTop = 820;
    expect(scrollRange - scrollTop).toBeLessThan(MAIN_CHAPTER_RUBBER_IMMEDIATE_DIST_PX);

    const out = resolveMainChapterIdxWithBottomRubberGuard({
      raw: 1,
      prevIdx: lastIdx,
      lastIdx,
      scrollTop,
      scrollRange,
      lastChapterScrollTop,
      latchRef,
    });
    expect(out).toBe(lastIdx);
  });

  it("한 번 하단 근처에 들어오면 래치가 켜지고, 큰 탄성으로 dist가 커져도 유지", () => {
    const latchRef = { current: true };
    const scrollRange = 2000;
    const scrollTop = 400;
    expect(scrollRange - scrollTop).toBeGreaterThan(MAIN_CHAPTER_LATCH_ARM_DIST_PX);

    const out = resolveMainChapterIdxWithBottomRubberGuard({
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

  it("마지막 챕터 상단을 충분히 위로 지나면 래치 해제·raw 반영", () => {
    const latchRef = { current: true };
    const scrollRange = 2000;
    const scrollTop = lastChapterScrollTop - MAIN_CHAPTER_LATCH_CLEAR_ABOVE_LAST_PX - 30;

    expect(scrollTop).toBeLessThan(
      lastChapterScrollTop - MAIN_CHAPTER_LATCH_CLEAR_ABOVE_LAST_PX
    );

    const out = resolveMainChapterIdxWithBottomRubberGuard({
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
    const out = resolveMainChapterIdxWithBottomRubberGuard({
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

  it("하단 근처에서 래치 arm 후 동일 프레임에서 raw 하락해도 마지막 유지", () => {
    const latchRef = { current: false };
    const scrollRange = 1000;
    const scrollTop = 700;
    expect(scrollRange - scrollTop).toBeLessThan(MAIN_CHAPTER_LATCH_ARM_DIST_PX);

    const out = resolveMainChapterIdxWithBottomRubberGuard({
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
});
