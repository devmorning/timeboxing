/**
 * 메인 챕터 세로 스크롤 + 좌우 날짜 스와이프 시 옆 열 세로 패럴렉스에 공통으로 쓰는 기하 유틸.
 *
 * 스냅 UX: 브라우저 네이티브 `scroll-snap-type: proximity` + 터치 관성에 맡기는 편이
 * `mandatory` + `scroll-behavior: smooth` + 강제 `min-h-full` 조합보다 자연스러운 경우가 많다
 * (특히 iOS/WebKit).
 */

/**
 * 스크롤 컨테이너 기준으로 el 상단까지의 콘텐츠 오프셋(px).
 * HTMLElement.offsetTop은 offsetParent 기준이라 래퍼·포지셔닝에 따라 깨질 수 있다.
 */
export function getScrollContentOffsetTop(root, el) {
  if (!root || !el || !(el instanceof HTMLElement) || !root.contains(el)) return 0;
  return (
    root.scrollTop +
    (el.getBoundingClientRect().top - root.getBoundingClientRect().top)
  );
}

/**
 * 메인 챕터 스크롤 박스에서 현재 포커스 챕터 인덱스.
 * 하단 러버밴드 보정은 `resolveMainChapterIdxWithLastChapterLatch`에서 처리.
 */
export function getMainChapterIdxFromScrollRoot(root) {
  if (!root) return 0;
  const chapters = Array.from(root.querySelectorAll("[data-main-chapter]"));
  if (!chapters.length) return 0;
  const probeTop = root.scrollTop + 12;
  let idx = 0;
  for (let i = 0; i < chapters.length; i += 1) {
    const el = chapters[i];
    if (el instanceof HTMLElement && getScrollContentOffsetTop(root, el) <= probeTop) idx = i;
  }
  return idx;
}

/** 스크롤 하단 근처에서 래치 — 큰 러버밴드에서도 ref로 마지막 챕터 유지 */
export const MAIN_CHAPTER_LATCH_NEAR_BOTTOM_PX = 360;

/**
 * 마지막 챕터 상단보다 이만큼 위로 스크롤해야 래치 해제(값이 클수록 하단 탄성에 관대).
 */
export const MAIN_CHAPTER_LATCH_LEAVE_ABOVE_LAST_CHAPTER_PX = 370;

/**
 * 챕터3 목록 끝 하단 오버스크롤 시 probe만 위로 튀는 현상 방지.
 * @param {{ current: boolean }} latchRef
 */
export function resolveMainChapterIdxWithLastChapterLatch({
  raw,
  prevIdx,
  lastIdx,
  scrollTop,
  scrollRange,
  lastChapterScrollTop,
  latchRef,
}) {
  if (lastIdx < 0) return raw;
  if (scrollRange <= 8) {
    latchRef.current = false;
    return raw;
  }

  const distFromBottom = Math.max(0, scrollRange - scrollTop);

  if (distFromBottom < MAIN_CHAPTER_LATCH_NEAR_BOTTOM_PX) {
    latchRef.current = true;
  }
  if (scrollTop < lastChapterScrollTop - MAIN_CHAPTER_LATCH_LEAVE_ABOVE_LAST_CHAPTER_PX) {
    latchRef.current = false;
  }

  if (prevIdx === lastIdx && raw < lastIdx && latchRef.current) {
    return lastIdx;
  }
  return raw;
}

/** 날짜 스와이프 중 옆 열에 더해지는 세로 패럴렉스 — 가로 당김(px)당 세로 이동 비율 */
export const ADJACENT_DAY_SWIPE_PARALLAX_Y_PER_PX = 0.03;

/**
 * 메인 챕터 상단 글로우 레이어: 본문보다 약간 느리게 움직이는 느낌(세로 패럴렉스).
 * 계수를 크게 잡아 짧은 터치 스크롤에도 체감되게 한다.
 */
export const MAIN_CHAPTER_BLUR_PARALLAX_FACTOR = 0.28;

/**
 * @param {HTMLElement} scrollRoot
 * @param {HTMLElement} sectionEl - [data-main-chapter] 섹션
 */
export function getChapterBlurParallaxTranslateY(
  scrollRoot,
  sectionEl,
  factor = MAIN_CHAPTER_BLUR_PARALLAX_FACTOR
) {
  if (!scrollRoot || !sectionEl || !(sectionEl instanceof HTMLElement)) return 0;
  const st = scrollRoot.scrollTop;
  const sectionStart = getScrollContentOffsetTop(scrollRoot, sectionEl);
  return -(st - sectionStart) * factor;
}
