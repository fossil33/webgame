// event.js — DB(Posts)에서 이벤트를 불러와 카드 목록으로 렌더링
// 상단 탭(전체/진행중/종료) + 검색 적용

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

let cacheEvents = [];   // 마지막으로 받아온 목록을 캐시해 검색시 재사용

/* ---------- 유틸 ---------- */
function escapeHTML(s = "") {
  return s.replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[m]);
}
function stripHtml(s = "") {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function plainSummary(content, len = 90) {
  const txt = stripHtml(content || "");
  return txt.length > len ? (txt.slice(0, len) + "…") : txt;
}
function formatDate(dt) {
  try {
    const d = new Date(dt);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch { return dt || ""; }
}
function getKeyword() {
  return ($("#eventSearch")?.value || "").trim().toLowerCase();
}

/* 한글/영문 라벨을 표준값으로 정규화 */
function normalizeFilter(v = "") {
  const t = v.toString().trim().toLowerCase();
  if (["all", "전체"].includes(t)) return "all";
  if (["ongoing", "진행중", "진행"].includes(t)) return "ongoing";
  if (["ended", "종료", "완료"].includes(t)) return "ended";
  return "all";
}

/* 현재 활성 탭에서 필터 읽기(라벨/데이터 속성 모두 지원) */
function currentFilter() {
  const active = $(".tab-btn.active");
  if (!active) return "all";
  const byData = active.dataset?.filter;
  if (byData) return normalizeFilter(byData);
  return normalizeFilter(active.textContent);
}

/* ---------- API ---------- */
async function fetchEvents(filter) {
  const r = await fetch(`/api/events?status=${encodeURIComponent(filter)}`);
  if (!r.ok) throw new Error(`GET /api/events ${r.status}`);
  const { events = [] } = await r.json();
  return events;
}

/* ---------- 렌더 ---------- */
/* ---------- 렌더 ---------- */
function renderGrid(events) {
  const grid = $("#event-list") || $("#event-grid") || $(".event-grid") || document.body;

  // 검색어로 클라이언트 필터
  const kw = getKeyword();
  const data = !kw
    ? events
    : events.filter(ev => {
        const hay = `${ev.title || ""} ${stripHtml(ev.content || "")}`.toLowerCase();
        return hay.includes(kw);
      });

  grid.innerHTML = "";

  if (!data.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#6b7280;padding:26px;">이벤트가 없습니다.</div>`;
    return;
  }

  data.forEach((ev, i) => {
    // [삭제] 3. 기존 그라데이션 클래스 라인 삭제
    // const thumbClass = ["thumb-g1","thumb-g2","thumb-g3","thumb-g4"][i % 4];
    
    // [추가] 4. 매핑에서 이미지 URL 가져오기
    const imageUrl = EVENT_IMAGE_MAP[ev.id] || DEFAULT_EVENT_IMAGE;

    const badgeText  = ev.status === "ongoing" ? "진행중" : "종료";
    const summary    = plainSummary(ev.content, 90);
    const author     = ev.author || "하이요";
    const date       = formatDate(ev.created_at);

    const card = document.createElement("article");
    card.className = "event-card";
    card.dataset.id = ev.id;
    card.innerHTML = `
      <div class="event-thumb" style="background-image: url('${escapeHTML(imageUrl)}');">
        <span class="event-badge ${ev.status}">${badgeText}</span>
      </div>
      <div class="event-body">
        <h3 class="event-title">${escapeHTML(ev.title || "")}</h3>
        <p class="event-summary">${escapeHTML(summary)}</p>
        <div class="event-meta">
          <span>작성자 ${escapeHTML(author)}</span>
          <span>등록 ${escapeHTML(date)}</span>
        </div>
        <button class="event-cta" data-open="${ev.id}">자세히 보기</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

/* ---------- 상호작용 ---------- */
function initTabsNormalization() {
  // 탭에 data-filter가 없으면 텍스트를 보고 자동 세팅
  $$(".tab-btn").forEach(btn => {
    if (!btn.dataset.filter) {
      btn.dataset.filter = normalizeFilter(btn.textContent);
    } else {
      btn.dataset.filter = normalizeFilter(btn.dataset.filter);
    }
  });

  // 활성 탭이 없다면 첫 번째를 강제로 활성화
  if (!$(".tab-btn.active") && $(".tab-btn")) {
    const first = $(".tab-btn");
    first.classList.add("active");
    first.setAttribute("aria-pressed", "true");
  }
}

function bindInteractions() {
  // 문서 레벨 위임: 탭이 .event-wrap 밖에 있어도 동작
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (btn) {
      // 활성 토글
      $$(".tab-btn").forEach(b => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");

      // 표준 필터값 보장
      btn.dataset.filter = normalizeFilter(btn.dataset.filter || btn.textContent);

      // 서버에서 재조회 후 렌더
      loadAndRender(true);
      return;
    }

    // 카드/버튼 클릭 → 상세 이동
    const card = e.target.closest(".event-card");
    if (card?.dataset?.id) {
      location.href = `event_detail.html?id=${encodeURIComponent(card.dataset.id)}`;
    }
  });

  // 검색은 캐시된 데이터로만 재렌더(서버 호출 없음)
  $("#eventSearch")?.addEventListener("input", () => renderGrid(cacheEvents));
}

/* ---------- 데이터 로드 ---------- */
async function loadAndRender(fetchFromServer = true) {
  try {
    if (fetchFromServer) {
      const filter = currentFilter();               // all | ongoing | ended
      cacheEvents = await fetchEvents(filter);      // 캐시에 보관
    }
    renderGrid(cacheEvents);
  } catch (err) {
    console.error(err);
    const grid = $("#event-list") || $("#event-grid") || $(".event-grid") || document.body;
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#ef4444;padding:26px;">이벤트를 불러오지 못했습니다.</div>`;
  }
}

/* ====== 초기화: 한 번만, 안전하게 ====== */
let __eventPageInited = false;

function __doInitEventPage() {
  if (__eventPageInited) return;
  __eventPageInited = true;
  initTabsNormalization();
  bindInteractions();
  loadAndRender(true);
}

/* 페이지에서 명시적으로 호출할 수 있도록 노출 */
window.initializeEventPage = __doInitEventPage;

/* 혹시 event.html에서 호출을 못 해도 자동으로 1번 초기화 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', __doInitEventPage, { once: true });
} else {
  setTimeout(__doInitEventPage, 0);
}
