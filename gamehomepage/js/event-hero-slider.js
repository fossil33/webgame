// 페이지 로딩이 끝나면 실행될 함수 등록
document.addEventListener('DOMContentLoaded', () => {
    loadAndDisplayOngoingEvents();
});

// HTML 특수문자를 안전하게 변환하는 함수 (XSS 방지)
function escapeHTML(str = "") {
    if (!str) return "";
    return str.replace(/[&<>"']/g, match => {
        const escape = {
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            '"': '&quot;', "'": '&#39;'
        };
        return escape[match];
    });
}

// 날짜 형식을 'YYYY.MM.DD'로 바꾸는 함수
// (시작/종료 날짜 표시에 사용)
function formatDate(dateString) {
    if (!dateString) return ""; // 날짜 없으면 빈칸
    try {
        const date = new Date(dateString);
        // getTime() 결과가 NaN이면 유효하지 않은 날짜
        if (isNaN(date.getTime())) return "";

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}.${month}.${day}`;
    } catch (e) {
        console.error("날짜 형식 변환 오류:", e);
        return ""; // 오류 발생 시 빈칸
    }
}

// 진행 중인 이벤트를 불러와 슬라이더로 표시하는 메인 함수
async function loadAndDisplayOngoingEvents() {
    const sliderContainer = document.getElementById('event-hero-slider');
    const navContainer = document.getElementById('event-hero-nav'); // 네비게이션 컨테이너
    const sliderWrap = document.querySelector('.event-hero-slider-wrap'); // 전체 래퍼

    if (!sliderContainer || !navContainer || !sliderWrap) {
        console.error('필수 HTML 요소(슬라이더/네비게이션 컨테이너)를 찾을 수 없습니다.');
        return;
    }

    try {
        // 1. 서버에서 진행 중 이벤트 데이터 가져오기
        const response = await fetch('/api/events?status=ongoing');
        if (!response.ok) throw new Error(`이벤트 데이터 로딩 실패: ${response.status}`);
        const { events = [] } = await response.json();

        // 2. 이벤트 데이터 없을 시 처리
        if (!events || events.length === 0) {
            sliderContainer.innerHTML = '<div class="event-slide-placeholder"><p>진행 중인 이벤트가 없습니다.</p></div>';
            navContainer.innerHTML = ''; // 네비게이션도 비움
            return;
        }

        // 3. 슬라이드 및 네비게이션 HTML 생성
        let slidesHTML = '';
        let navHTML = '<ul class="event-nav-list">'; // 네비게이션 목록 시작

        events.forEach((event, index) => {
            const imageUrl = EVENT_IMAGE_MAP[event.id] || DEFAULT_EVENT_IMAGE;
            const title = event.title || '제목 없음';
            const detailUrl = `event_detail.html?id=${encodeURIComponent(event.id)}`;

            // 메인 이미지 슬라이드 (텍스트 제거)
            slidesHTML += `
                <div class="event-hero-slide">
                    <a href="${detailUrl}" class="slide-link">
                        <div class="slide-image" style="background-image: url('${escapeHTML(imageUrl)}');"></div>
                        
                    </a>
                </div>
            `;

            // 하단 제목 네비게이션 아이템
            navHTML += `
                <li class="event-nav-item">
                    
                    <button class="event-nav-button" data-slide-index="${index}">
                        ${escapeHTML(title)}
                    </button>
                </li>
            `;
        });

        navHTML += '</ul>'; // 네비게이션 목록 끝

        // 4. 생성된 HTML 삽입
        sliderContainer.innerHTML = slidesHTML;
        navContainer.innerHTML = navHTML;

        // 5. Tiny Slider 초기화
        const slider = tns({
            container: '#event-hero-slider',
            items: 1,
            slideBy: 'page',
            autoplay: true,
            autoplayButtonOutput: false,
            mouseDrag: true,
            controls: false, // 기본 화살표 숨김 (커스텀 사용 또는 생략 시)
            nav: false,      // 기본 점(dots) 숨김 (커스텀 네비 사용)
            speed: 400,
            autoplayTimeout: 5000,
            lazyload: true, // 이미지 지연 로딩 (선택 사항)
        });

        // 6. 커스텀 네비게이션 버튼에 클릭 이벤트 추가
        const navButtons = navContainer.querySelectorAll('.event-nav-button');
        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                const index = parseInt(button.getAttribute('data-slide-index'), 10);
                slider.goTo(index); // 슬라이더 이동
            });
        });

        // 7. 슬라이더 변경 시 커스텀 네비게이션 활성 상태 업데이트
        slider.events.on('indexChanged', (info) => {
            navButtons.forEach((button, index) => {
                button.classList.toggle('active', index === info.index);
                // (선택) 활성 탭이 가운데 오도록 스크롤 조절 로직 추가 가능
            });
        });

        // 초기 활성 상태 설정
        if (navButtons.length > 0) {
            navButtons[0].classList.add('active');
        }

        // 8. (선택) 커스텀 좌우 화살표 버튼 이벤트 연결
        const prevButton = sliderWrap.querySelector('.nav-prev');
        const nextButton = sliderWrap.querySelector('.nav-next');
        if (prevButton && nextButton) {
            prevButton.addEventListener('click', () => slider.goTo('prev'));
            nextButton.addEventListener('click', () => slider.goTo('next'));
        }

    } catch (error) {
        console.error('이벤트 슬라이더 생성 중 오류:', error);
        sliderContainer.innerHTML = '<div class="event-slide-placeholder"><p>오류 발생</p></div>';
        navContainer.innerHTML = '';
    }
}