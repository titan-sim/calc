// 커스텀 드롭다운 공용 토글 - 카드 맨 아래쪽에 있는 드롭다운은 아래로 펼치면 화면/카드 밖으로
// 잘려서 안 보이는 문제가 있었음. 열기 직전에 실제로 위/아래 여유 공간을 계산해서, 더 넓은 쪽으로
// 펼치고, 그 방향으로도 부족하면(항목이 아주 많은 목록이거나 카드 자체가 짧을 때) 실제로 남는
// 공간만큼만 max-height를 줄여서 그 안에서 스크롤되게 함 - 어느 경우에도 카드 경계를 절대 넘지 않음.

const DROPDOWN_LIST_MAX_HEIGHT = 250; // css의 기본 max-height와 맞춤

// 뷰포트 여백만 보면 안 됨: .battle-main-card처럼 위쪽 글로우 장식을 가두려고 overflow:hidden을
// 쓰는 카드가 있어서, 뷰포트에는 공간이 남아도 그 카드 경계에서 목록이 잘릴 수 있음 - 트리거의
// 조상 중 실제로 잘라내는(overflow가 hidden/clip인) 첫 번째 요소를 찾아서 그 경계를 기준으로 삼음
function findClippingAncestorRect(el) {
  let node = el.parentElement;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (style.overflow === "hidden" || style.overflowY === "hidden" || style.overflow === "clip" || style.overflowY === "clip") {
      return node.getBoundingClientRect();
    }
    node = node.parentElement;
  }
  return null;
}

function toggleDropdownList(trigger, list) {
  const isOpen = list.style.display === "block";
  document.querySelectorAll(".dropdown-list").forEach((el) => {
    el.style.display = "none";
    el.classList.remove("dropdown-list-up");
    el.style.removeProperty("max-height");
  });
  if (isOpen) return;

  list.style.display = "block";
  const triggerRect = trigger.getBoundingClientRect();
  const clipRect = findClippingAncestorRect(trigger);
  const boundaryBottom = clipRect ? Math.min(clipRect.bottom, window.innerHeight) : window.innerHeight;
  const boundaryTop = clipRect ? Math.max(clipRect.top, 0) : 0;
  const GAP = 6; // 목록이 경계선에 딱 붙지 않게 살짝 여유
  const spaceBelow = boundaryBottom - triggerRect.bottom - GAP;
  const spaceAbove = triggerRect.top - boundaryTop - GAP;

  const openUp = spaceAbove > spaceBelow;
  if (openUp) list.classList.add("dropdown-list-up");

  // 고른 방향의 실제 여유 공간이 기본 max-height(250)보다 좁으면, 그 공간만큼만 쓰도록 줄여서
  // 카드 경계를 절대 넘지 않게 함(내용이 많으면 그 안에서 스크롤)
  const available = Math.max(0, openUp ? spaceAbove : spaceBelow);
  if (available < DROPDOWN_LIST_MAX_HEIGHT) {
    list.style.maxHeight = `${Math.max(80, available)}px`;
  }
}
