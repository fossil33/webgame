// ranking.js (상위 5명만 표시하도록 수정)

// -----------------------------
// 공통 유틸
// -----------------------------

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}

// 여러 후보 URL 중 먼저 성공하는 것을 사용 (API 버전 호환용)
async function tryEndpoints(urls) {
  let lastErr;
  for (const u of urls) {
    try { return await getJSON(u); }
    catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// <tr> 생성 함수
function tr(html) {
  const el = document.createElement('tr');
  el.innerHTML = html;
  return el;
}

// 리스트 비우기 + 비어있을 때 메시지 (<tr> 버전)
function setEmpty(tbodyEl, msg = '랭킹 정보가 없습니다.') {
  if (!tbodyEl) return;
  tbodyEl.innerHTML = ''; // tbody 비우기
  tbodyEl.appendChild(tr(`<td colspan="3" class="empty-message">${msg}</td>`));
}

// 'Coming Soon' 카드를 위한 기본 포디움 생성 함수
function renderPlaceholderRanking(headerTitle, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    // 테이블 본문에 "Coming Soon!" 메시지 설정
    setEmpty(tbody, 'Coming Soon!');

    // 헤더에 기본 포디움 HTML 생성
    const header = tbody.closest('.leaderboard-card').querySelector('.leaderboard-header');
    if (header) {
        header.innerHTML = `
            <h1>${headerTitle}</h1>
            <div class="top-three-players">
                <div class="top-player rank-1"><span class="trophy-icon">🏆</span><span class="player-name">PLAYER</span><span class="player-score">...</span></div>
                <div class="top-player rank-2"><span class="trophy-icon">🥈</span><span class="player-name">PLAYER</span><span class="player-score">...</span></div>
                <div class="top-player rank-3"><span class="trophy-icon">🥉</span><span class="player-name">PLAYER</span><span class="player-score">...</span></div>
            </div>
        `;
    }
}


// -----------------------------
// 랭킹 렌더링 공통 함수 (전투력, 레벨 등)
// -----------------------------
async function renderRanking(type, tbodyId, valueLabel) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  try {
    // [★수정★] API 요청 시 상위 5명만 가져오도록 limit 변경
    const top = await tryEndpoints([
      `/api/rankings/${type}?limit=5`, // 상위 5개만 요청
      `/api/rankings?type=${type}` // 호환용
    ]);

    if (!top || !top.length) {
      // 데이터 없을 때 기본 포디움 표시
      const header = tbody.closest('.leaderboard-card').querySelector('.leaderboard-header');
      if (header) {
          const headerTitle = header.querySelector('h1')?.textContent || 'LEADERBOARD';
          header.innerHTML = `<h1>${headerTitle}</h1><div class="top-three-players"><div class="top-player rank-1"><span class="trophy-icon">🏆</span><span class="player-name">PLAYER</span><span class="player-score">...</span></div><div class="top-player rank-2"><span class="trophy-icon">🥈</span><span class="player-name">PLAYER</span><span class="player-score">...</span></div><div class="top-player rank-3"><span class="trophy-icon">🥉</span><span class="player-name">PLAYER</span><span class="player-score">...</span></div></div>`;
      }
      setEmpty(tbody);
      return;
    }

    const finalRanking = top.map(row => ({
      rank: Number(row.rank),
      character_name: row.character_name ?? row.name ?? '무명',
      value: Math.floor(Number(row[type] ?? row.ranking_value ?? 0))
    }));

    // 상위 3명은 헤더 포디움에 표시
    const topThree = finalRanking.slice(0, 3);
    // [★수정★] 테이블에는 4, 5등만 표시
    const otherRanks = finalRanking.slice(3, 5); // 3번째 인덱스부터 5번째 인덱스 *전까지* (즉, 3, 4 인덱스 -> 4등, 5등)

    const header = tbody.closest('.leaderboard-card').querySelector('.leaderboard-header');
    if (header) {
        const headerTitle = header.querySelector('h1')?.textContent || 'LEADERBOARD';
        let topThreeHtml = `<h1>${headerTitle}</h1><div class="top-three-players">`;
        for (let i = 0; i < 3; i++) {
            const player = topThree[i];
            const rankNum = i + 1;
            const playerName = player ? player.character_name : 'PLAYER';
            const playerScore = player ? player.value.toLocaleString() : '...';
            const trophyIcon = (rankNum === 1 ? '🏆' : (rankNum === 2 ? '🥈' : '🥉'));
            topThreeHtml += `<div class="top-player rank-${rankNum}"><span class="trophy-icon">${trophyIcon}</span><span class="player-name">${playerName}</span><span class="player-score">${playerScore}</span></div>`;
        }
        topThreeHtml += `</div>`;
        header.innerHTML = topThreeHtml;
    }

    // 나머지 랭킹(4, 5등) 테이블에 추가
    tbody.innerHTML = ''; // tbody 비우기
    
    if (otherRanks.length === 0 && topThree.length > 0) { // 상위 3명은 있는데 4, 5등이 없는 경우
        setEmpty(tbody, '4, 5등 정보가 없습니다.'); // 메시지 변경
    } else if (otherRanks.length === 0 && topThree.length === 0) { // 상위 5명 아무도 없는 경우
        setEmpty(tbody); // 기본 메시지 '랭킹 정보가 없습니다.'
    } else {
        otherRanks.forEach(row => {
          tbody.appendChild(tr(`
            <td class="rank">${row.rank.toString().padStart(2, '0')}</td>
            <td class="name">${row.character_name}</td>
            <td class="value">${row.value.toLocaleString()}</td>
          `));
        });
    }

  } catch (e) {
    console.error(`${type} 랭킹 로딩 실패:`, e);
    // 에러 발생 시 기본 포디움 표시
    const header = tbody.closest('.leaderboard-card').querySelector('.leaderboard-header');
    if (header) {
        const headerTitle = header.querySelector('h1')?.textContent || 'LEADERBOARD';
        header.innerHTML = `<h1>${headerTitle}</h1><div class="top-three-players"><div class="top-player rank-1"><span class="trophy-icon">🏆</span><span class="player-name">PLAYER</span><span class="player-score">...</span></div><div class="top-player rank-2"><span class="trophy-icon">🥈</span><span class="player-name">PLAYER</span><span class="player-score">...</span></div><div class="top-player rank-3"><span class="trophy-icon">🥉</span><span class="player-name">PLAYER</span><span class="player-score">...</span></div></div>`;
    }
    setEmpty(tbody, `${valueLabel} 랭킹을 불러오지 못했습니다.`);
  }
}

// -----------------------------
// 페이지 로드 시
// -----------------------------
document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([
    renderRanking('power', 'power-list', '전투력'),
    renderRanking('level', 'level-list', '레벨'),
    renderPlaceholderRanking('BOSS BATTLE', 'boss-list'),
    renderPlaceholderRanking('QUEST COMPLETE', 'progress-list')
  ]);
});