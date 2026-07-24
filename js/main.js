window.addEventListener("DOMContentLoaded", () => {
  initSettingsDrawer();
  initRouter();
  initOverlayOutsideClickClose();
  initUpdateCheck();
});

// 사이트 전체에서 쓰는 팝업(.friend-picker-overlay)들은 각자 페이지에서 만들어지지만 배경(오버레이
// 자체)을 눌러도 안 닫히는 문제가 공통이었음 - 매 페이지마다 따로 고치는 대신, 오버레이 배경을
// 직접 클릭했을 때(모달 내용물이 아니라 e.target이 오버레이 그 자체일 때만) 그 안의 닫기 버튼을
// 대신 눌러주는 위임 리스너 하나로 모든 페이지의 팝업에 한 번에 적용함
//
// mousedown 시작 지점도 오버레이 자체인지 같이 기억해뒀다가 click에서 같이 확인함 - 안 그러면
// 모달 안(예: 드래그로 스크롤하는 프리셋 목록)에서 누른 채로 시작해서 손가락/마우스가 모달 밖
// 배경까지 미끄러진 뒤 떼는 경우, 브라우저가 "click"의 target을 mousedown/mouseup 두 지점의
// 공통 조상으로 계산하면서 오버레이 자신이 되어버려 의도치 않게 모달이 닫혀버림(실측 재현 확인)
function initOverlayOutsideClickClose() {
  let downStartedOnOverlay = null;
  const trackDownTarget = (e) => {
    downStartedOnOverlay = e.target.classList.contains("friend-picker-overlay") ? e.target : null;
  };
  document.addEventListener("mousedown", trackDownTarget);
  document.addEventListener("touchstart", trackDownTarget, { passive: true });
  document.addEventListener("click", (e) => {
    if (!e.target.classList.contains("friend-picker-overlay")) return;
    if (e.target !== downStartedOnOverlay) return;
    if (getComputedStyle(e.target).display === "none") return;
    const closeBtn = e.target.querySelector(".close-btn");
    if (closeBtn) closeBtn.click();
  });
}
