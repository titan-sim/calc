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
function initOverlayOutsideClickClose() {
  document.addEventListener("click", (e) => {
    if (!e.target.classList.contains("friend-picker-overlay")) return;
    if (getComputedStyle(e.target).display === "none") return;
    const closeBtn = e.target.querySelector(".close-btn");
    if (closeBtn) closeBtn.click();
  });
}
