// 공용 공룡 스프라이트 재생기 - 타이탄/공룡 대전/아레나 세 화면의 "공" 아바타 안에 그레이스케일
// 프레임 이미지(Idle 45장 루프 + Roar 30장 1회성)를 그대로 심음(팀 색 틴트는 깜빡임 문제로 제거 -
// 팀 구분은 호스트 쪽 box-shadow 글로우/체력바 색/좌우 위치로 충분함). 인스턴스별 타이머 대신
// 레지스트리 하나 + 단일 setInterval로 전부 구동함(동시에 15개 이상 떠 있을 수 있어서 인스턴스당
// 타이머는 낭비/드리프트 위험이 큼).
//
// 받은 원본 이미지 특성: 각 프레임이 투명 여백을 자른 "타이트 트림"이라 캔버스 크기가 프레임마다
// 미묘하게 다름(원본 오프셋 메타데이터 없음) - object-fit:contain + object-position:center bottom
// 으로 바닥 중앙 정렬(사용자 확인, 포즈에 따른 미세한 흔들림은 감수). 원본은 우측(머리)을 보고
// 있어서 "상대편"만 좌우 반전(css/dino-sprite.css의 [data-team="opp"])해서 서로 마주보게 함.

const DINO_SPRITE_IDLE_FRAMES = 45;
const DINO_SPRITE_ROAR_FRAMES = 30;
const DINO_SPRITE_IDLE_FRAME_MS = 1000 / 9;   // ~9fps 숨쉬기 루프
const DINO_SPRITE_ROAR_FRAME_MS = 1000 / 24;  // ~24fps 포효 1회 재생(약 1.25초)
const DINO_SPRITE_DRIVER_MS = 1000 / 30;      // 마스터 틱 - 인스턴스별 누적시간으로 각자 fps에 맞춰 프레임을 넘김

const dinoSpriteIdlePath = (i) => `./assets/dino/Idle/Dino-Idle_${i}.png`;
const dinoSpriteRoarPath = (i) => `./assets/dino/Roar/Dino-Roar_${i}.png`;

const dinoSpriteRegistry = new Map(); // id -> { img, hostEl, mode, frame, accumMs }
let dinoSpriteNextId = 1;
let dinoSpriteDriverTimer = null;

function dinoSpriteSetFrame(state, path) {
  state.img.src = path;
}

function dinoSpritePreloadAll() {
  for (let i = 0; i < DINO_SPRITE_IDLE_FRAMES; i++) { const im = new Image(); im.decoding = "async"; im.src = dinoSpriteIdlePath(i); }
  for (let i = 0; i < DINO_SPRITE_ROAR_FRAMES; i++) { const im = new Image(); im.decoding = "async"; im.src = dinoSpriteRoarPath(i); }
}
dinoSpritePreloadAll(); // 스크립트 로드 시 1회 - new Image() 워밍업은 렌더링을 막지 않으므로 바로 시작해도 안전(총 ~1.5MB)

function dinoSpriteResolveId(hostElOrId) {
  if (!hostElOrId) return null;
  return typeof hostElOrId === "string" ? hostElOrId : hostElOrId.dataset.dinoSpriteId || null;
}

function dinoSpriteMount(hostEl, team) {
  if (!hostEl) return null;
  if (hostEl.dataset.dinoSpriteId) dinoSpriteUnmount(hostEl); // 중복 mount 방지(방어적)

  const id = `ds${dinoSpriteNextId++}`;
  const wrap = document.createElement("div");
  wrap.className = "dino-sprite";
  wrap.dataset.team = team; // "mine" | "opp"

  const img = document.createElement("img");
  img.className = "dino-sprite-img";
  img.alt = "";
  img.draggable = false;

  wrap.appendChild(img);
  hostEl.appendChild(wrap);
  hostEl.dataset.dinoSpriteId = id;
  hostEl.dataset.dinoSpriteTeam = team; // 재마운트(자가치유) 시 team을 다시 안 받아도 되게 저장해둠

  const state = { img, hostEl, mode: "idle", frame: 0, accumMs: 0, roarFrameMs: DINO_SPRITE_ROAR_FRAME_MS };
  dinoSpriteSetFrame(state, dinoSpriteIdlePath(0));
  dinoSpriteRegistry.set(id, state);
  dinoSpriteEnsureDriver();
  return id;
}

function dinoSpriteUnmount(hostElOrId) {
  const id = dinoSpriteResolveId(hostElOrId);
  const state = id && dinoSpriteRegistry.get(id);
  if (state) {
    const node = state.hostEl.querySelector(":scope > .dino-sprite");
    if (node) node.remove();
    delete state.hostEl.dataset.dinoSpriteId;
    dinoSpriteRegistry.delete(id);
  }
  dinoSpriteMaybeStopDriver();
}

function dinoSpriteUnmountAll() {
  dinoSpriteRegistry.forEach((state) => {
    const node = state.hostEl.querySelector(":scope > .dino-sprite");
    if (node) node.remove();
    delete state.hostEl.dataset.dinoSpriteId;
  });
  dinoSpriteRegistry.clear();
  dinoSpriteMaybeStopDriver();
}

// 공격 모션("포효") 1회 재생 - host에 스프라이트가 mount 안 돼있으면(예: 타이탄 보스, 스프라이트가
// 없어 mount 자체를 안 함) 조용히 no-op.
//
// durationMs(선택): 이 재생이 끝날 때까지 걸릴 총 시간 - 넘기면 30프레임을 그 시간 안에 다 맞춰
// 재생하도록 프레임 간격을 다시 계산함(기본은 24fps 고정 약 1.25초). 공룡 대전의 "빠름"(턴 간격
// 150ms)처럼 다음 공격이 이전 포효가 끝나기 전에 또 들어오면, 매번 프레임 0으로 리셋되면서 30장
// 중 앞쪽 몇 장만 반복 노출돼 "중간 프레임 하나에서 멈춘 것처럼" 보이는 버그가 있었음(사용자 확인).
// 턴 간격(호출 측이 넘겨주는 실제 배틀 속도)에 맞춰 항상 끝까지 다 재생되도록 해서 해결 - 이렇게
// 하면 재생 중 또 호출돼도 "끊김"이 아니라 그냥 조금 더 빨리/느리게 자연스럽게 이어서 도는 것처럼
// 보임(게임에서 흔한 접근 - 재생 속도를 실제 상황 속도에 맞춰 조절).
//
// hostElOrId가 실제 엘리먼트고 연결은 돼있는데 레지스트리에 없으면(예: 정확한 원인은 특정 못했지만
// 실전에서 관찰된 "어느 순간 애니메이션이 멈추고 다시는 안 돌아옴" 버그 - 레지스트리가 한 번
// 비면 공용 드라이버가 스스로 멈추고 아무도 다시 mount를 안 불러줘서 영구히 멈춰있었음) 즉석으로
// 다시 mount해서 자가치유함 - 원인이 무엇이었든 다음 공격 때 알아서 되살아나게 하는 게 목적
function dinoSpriteTriggerAttack(hostElOrId, durationMs) {
  let id = dinoSpriteResolveId(hostElOrId);
  let state = id && dinoSpriteRegistry.get(id);
  if (!state && hostElOrId instanceof Element && hostElOrId.isConnected) {
    id = dinoSpriteMount(hostElOrId, hostElOrId.dataset.dinoSpriteTeam || "mine");
    state = id && dinoSpriteRegistry.get(id);
  }
  if (!state) return;
  state.mode = "roar";
  state.frame = 0;
  state.accumMs = 0;
  state.roarFrameMs = durationMs > 0 ? Math.max(16, durationMs / DINO_SPRITE_ROAR_FRAMES) : DINO_SPRITE_ROAR_FRAME_MS;
  dinoSpriteSetFrame(state, dinoSpriteRoarPath(0));
}

// 위 자가치유와 같은 목적으로, 공격자가 아니라도(idle 상태로 멈춰있던 나머지 공룡들도) 매 턴
// 한 번씩 호출해서 연결은 돼있는데 mount가 빠진 호스트를 되살림 - 이미 mount된 호스트는 dataset
// 체크 한 번으로 끝나서 매 턴 불러도 비용이 거의 없음
function dinoSpriteEnsureMounted(hostElOrId, team) {
  const hostEl = typeof hostElOrId === "string" ? document.getElementById(hostElOrId) : hostElOrId;
  if (!hostEl || !hostEl.isConnected) return;
  if (dinoSpriteRegistry.has(hostEl.dataset.dinoSpriteId)) return;
  dinoSpriteMount(hostEl, team);
}

function dinoSpriteEnsureDriver() {
  if (dinoSpriteDriverTimer) return;
  dinoSpriteDriverTimer = setInterval(dinoSpriteDriverTick, DINO_SPRITE_DRIVER_MS);
}

function dinoSpriteMaybeStopDriver() {
  if (dinoSpriteRegistry.size === 0 && dinoSpriteDriverTimer) {
    clearInterval(dinoSpriteDriverTimer);
    dinoSpriteDriverTimer = null;
  }
}

function dinoSpriteDriverTick() {
  dinoSpriteRegistry.forEach((state) => {
    if (!state.hostEl.isConnected) { dinoSpriteUnmount(state.hostEl); return; } // 페이지 이동 등으로 떨어져 나간 경우 자동 정리(안전망)
    state.accumMs += DINO_SPRITE_DRIVER_MS;
    const frameMs = state.mode === "roar" ? state.roarFrameMs : DINO_SPRITE_IDLE_FRAME_MS;
    if (state.accumMs < frameMs) return;
    state.accumMs -= frameMs;

    if (state.mode === "roar") {
      state.frame++;
      if (state.frame >= DINO_SPRITE_ROAR_FRAMES) {
        state.mode = "idle"; state.frame = 0; state.accumMs = 0;
        dinoSpriteSetFrame(state, dinoSpriteIdlePath(0));
      } else {
        dinoSpriteSetFrame(state, dinoSpriteRoarPath(state.frame));
      }
    } else {
      state.frame = (state.frame + 1) % DINO_SPRITE_IDLE_FRAMES;
      dinoSpriteSetFrame(state, dinoSpriteIdlePath(state.frame));
    }
  });
}

// SPA 라우터(js/router.js)엔 페이지 teardown 훅이 없음(renderRoute가 #app.innerHTML을 그냥 새
// 것으로 갈아치울 뿐) - 이 스크립트가 router.js보다 먼저 로드되어(index.html 순서) hashchange
// 리스너도 먼저 등록되므로, 매번 새 페이지가 mount되기 전에 이전 페이지 것부터 확실히 정리됨.
window.addEventListener("hashchange", dinoSpriteUnmountAll);
