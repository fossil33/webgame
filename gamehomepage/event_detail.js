// event_detail.js 파일의 새 전체 코드

document.addEventListener('DOMContentLoaded', () => {
    // URL 쿼리스트링에서 게시글 ID 가져오기
    const id = new URLSearchParams(location.search).get('id');
    if (!id) {
        document.getElementById('page-heading').textContent = "이벤트를 찾을 수 없습니다.";
        return;
    }

    // 서버에 게시글 상세 데이터 요청
    fetch(`/api/posts/${id}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('데이터 로딩 실패');
            }
            return response.json();
        })
        .then(ev => {
            // 헤더, 메타 정보, 히어로 이미지 설정
            document.getElementById('ev-title').textContent = ev.title;
            const badge = document.getElementById('ev-badge');

            badge.textContent = ev.badgeText;
            badge.className = `ev-badge ${ev.status}`;

            document.getElementById('ev-meta').innerHTML = `
                <span>작성자 ${ev.nickname || 'GM'}</span>
                <span>등록 ${ev.date}</span>
            `;

            const imageUrl = EVENT_IMAGE_MAP[ev.id] || DEFAULT_EVENT_IMAGE;

            // [수정] 2. <div>의 배경이 아닌 <img>의 src 속성에 이미지 URL 적용
            const heroImg = document.getElementById('ev-hero-img');
            if (heroImg) {
                heroImg.src = imageUrl;
            }
            
            // 본문 내용 설정 (DB의 content 필드를 HTML로 렌더링)
            const content = document.getElementById('ev-content');
            content.innerHTML = ev.content;

            // 링크 복사 버튼 이벤트
            document.getElementById('btn-copy').addEventListener('click', () => {
                navigator.clipboard.writeText(location.href)
                    .then(() => alert("이벤트 링크가 복사되었습니다."))
                    .catch(() => alert("링크 복사에 실패했습니다."));
            });
        })
        .catch(error => {
            console.error("이벤트 상세 정보 로딩 실패:", error);
            document.getElementById('page-heading').textContent = "이벤트를 불러오는 데 실패했습니다.";
            document.getElementById('ev-content').innerHTML = '';
        });
});