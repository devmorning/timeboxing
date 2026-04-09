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

/** 메인 챕터 스크롤 박스에서 현재 포커스 챕터 인덱스 */
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

/** 날짜 스와이프 중 옆 열에 더해지는 세로 패럴렉스 — 가로 당김(px)당 세로 이동 비율 */
export const ADJACENT_DAY_SWIPE_PARALLAX_Y_PER_PX = 0.03;
