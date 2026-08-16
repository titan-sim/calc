// 배포 버전 확인용 배너. 빌드 스텝/서비스워커가 전혀 없는 순수 정적 사이트라(Cloudflare Workers가
// 파일을 그대로 서빙), "새 버전이 배포됐다"를 알아낼 방법이 브라우저 캐시 무효화 신호 하나도 없음 -
// 대신 version.json 하나만 배포할 때마다 수동으로 값을 바꿔주고, 페이지가 처음 열릴 때의 버전을
// 기억해뒀다가 주기적으로 다시 받아와 달라지면 배너를 띄우는 가장 단순한 방식으로 구현함.
// 새 버전을 배포할 때는 반드시 version.json의 값을 바꿔야 이 배너가 동작함.
const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5분마다 폴링
let loadedAppVersion = null;

async function fetchAppVersion() {
  try {
    // 캐시된 옛 버전을 다시 받아오면 의미가 없으므로 캐시를 확실히 우회함
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.version || null;
  } catch (e) {
    return null;
  }
}

function showUpdateBanner() {
  if (document.getElementById("updateBanner")) return;
  const banner = document.createElement("div");
  banner.id = "updateBanner";
  banner.className = "update-banner";
  banner.innerHTML = `
    <span class="update-banner-text">${t("common.updateBanner.text")}</span>
    <button type="button" class="update-banner-refresh" id="updateBannerRefresh">${t("common.updateBanner.refreshBtn")}</button>
    <button type="button" class="update-banner-dismiss" id="updateBannerDismiss" aria-label="${t("common.updateBanner.dismissAriaLabel")}">✕</button>
  `;
  document.body.appendChild(banner);
  document.getElementById("updateBannerRefresh").onclick = () => location.reload();
  document.getElementById("updateBannerDismiss").onclick = () => banner.remove();
}

async function initUpdateCheck() {
  loadedAppVersion = await fetchAppVersion();
  // version.json 자체가 없거나 네트워크 문제면 조용히 기능을 꺼둠(필수 기능이 아니라 사이트
  // 이용에는 지장 없어야 함)
  if (!loadedAppVersion) return;

  const checkNow = async () => {
    const latest = await fetchAppVersion();
    if (latest && latest !== loadedAppVersion) showUpdateBanner();
  };

  setInterval(checkNow, UPDATE_CHECK_INTERVAL_MS);
  // 탭을 백그라운드에 오래 뒀다가 돌아왔을 때는 다음 폴링까지 기다리지 않고 바로 한 번 확인
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkNow();
  });
}
