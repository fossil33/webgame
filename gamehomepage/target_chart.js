// target_chart.js (댓글 수 아이콘 추가 완료)

// [추가] 날짜를 "몇 분 전" 등으로 변경하는 함수
function formatTimeAgo(dateString) {
    const now = new Date();
    const postDate = new Date(dateString);

    if (isNaN(postDate.getTime())) {
         // 'YYYY-MM-DD HH:MM:SS' 형식을 수동으로 파싱 시도 (T, Z가 없는 경우)
        const parts = dateString.split(/[\s-:]/);
        if (parts.length >= 6) {
            // JS의 Date 월은 0부터 시작하므로 -1
            const date = new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]);
            if (!isNaN(date.getTime())) {
                // 재귀 호출 대신 바로 계산
                const seconds = Math.floor((now - date) / 1000);
                return formatSecondsAgo(seconds);
            }
        }
        return dateString; // 최종 실패 시 원본 반환
    }

    const seconds = Math.floor((now - postDate) / 1000);
    return formatSecondsAgo(seconds);
}

// [추가] 초(second)를 기준으로 문자열을 반환하는 헬퍼 함수
function formatSecondsAgo(seconds) {
    let interval = seconds / 31536000; // 1년
    if (interval > 1) return Math.floor(interval) + "년 전";
    interval = seconds / 2592000; // 1달
    if (interval > 1) return Math.floor(interval) + "개월 전";
    interval = seconds / 86400; // 1일
    if (interval > 1) return Math.floor(interval) + "일 전";
    interval = seconds / 3600; // 1시간
    if (interval > 1) return Math.floor(interval) + "시간 전";
    interval = seconds / 60; // 1분
    if (interval > 1) return Math.floor(interval) + "분 전";
    if (seconds < 0) return "방금 전"; // 클라이언트 시간 오류 방지
    return Math.max(0, Math.floor(seconds)) + "초 전"; // 0초 미만 방지
}


// HTML 문자열을 안전하게 처리하기 위한 유틸리티 함수
function escapeHTML(str) {
    const p = document.createElement('p');
    p.appendChild(document.createTextNode(str || ''));
    return p.innerHTML;
}

// [★수정★] 게시글 목록을 카드 UI로 화면에 표시하는 함수
function displayPosts(posts) {
    const postListContainer = document.getElementById('postList'); 
    if (!postListContainer) {
        console.error("Error: 'postList' 요소를 찾을 수 없습니다.");
        return;
    }
    postListContainer.innerHTML = ''; 

    if (!posts || posts.length === 0) {
        postListContainer.innerHTML = '<p class="empty-message">게시글이 없습니다.</p>';
        return;
    }

    posts.forEach((post) => { 
        const postCard = document.createElement('div');
        postCard.className = 'post-card';

        const nicknameDisplay = post.nickname ? escapeHTML(post.nickname) : '정보 없음';
        const detailPageLink = '10-2_see.html'; 
        const heartIcon = post.userHasLiked ? '❤️' : '♡';
        const likedClass = post.userHasLiked ? 'liked' : ''; 

        // [★수정★] 댓글 수 표시 stat-item 추가
        postCard.innerHTML = `
            <div class="post-main">
                <h3 class="post-title">
                    <a href='${detailPageLink}?id=${post.id}'>${escapeHTML(post.title)}</a>
                </h3>
                <div class="post-meta">
                    <span>${nicknameDisplay}</span>
                    <span class="meta-divider">|</span>
                    <span>${formatTimeAgo(post.date)}</span> 
                </div>
            </div>
            <div class="post-stats">
                <div class="stat-item">
                    <span class="icon-eye"></span> <span>${post.view_count || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="icon-chat_bubble_outline"></span> <span>${post.comments_count || 0}</span>
                </div> 
                <div class="like-container stat-item">
                    <button id="like-btn-${post.id}" class="like-button ${likedClass}" onclick="likePost(${post.id})">${heartIcon}</button>
                    <span id="like-count-${post.id}" class="like-count">${post.like_count || 0}</span>
                </div>
            </div>
        `;
        
        postListContainer.appendChild(postCard); 
    });
}

// 서버에서 게시글 데이터를 가져와 화면에 표시하는 함수
function fetchAndDisplayPosts(searchType = '', keyword = '') {
    const userId = localStorage.getItem('userId');
    let apiUrl = '/api/posts?board_type=target'; 

    if (userId) {
        apiUrl += `&userId=${userId}`;
    }

    if (searchType && keyword && keyword.trim() !== '') {
        apiUrl += `&searchType=${encodeURIComponent(searchType)}&keyword=${encodeURIComponent(keyword)}`;
    }

    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`공략 게시글 로딩 실패: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(posts => {
            // [★중요★] API 응답에 comments_count 필드가 포함되어 있는지 확인 필요
            displayPosts(posts); 
        })
        .catch(err => {
            console.error('공략 게시글 데이터 요청 또는 처리 중 오류:', err);
            const postListContainer = document.getElementById('postList');
            if (postListContainer) {
                 postListContainer.innerHTML = '<p class="empty-message">게시글을 불러오는 데 실패했습니다.</p>';
            }
        });
}


// '검색' 버튼 클릭 시 호출될 함수 (기존과 동일)
function performSearch() {
    // ... (기존 코드와 동일) ...
    const searchTypeElement = document.getElementById('searchType');
    const searchInputElement = document.getElementById('searchInput');

    if (!searchTypeElement || !searchInputElement) {
        console.error("Error: 검색 관련 HTML 요소를 찾을 수 없습니다.");
        return;
    }

    const searchType = searchTypeElement.value;
    const keyword = searchInputElement.value.trim();

    if (!keyword) {
        fetchAndDisplayPosts();
        return;
    }

    if (searchType === 'title' || searchType === 'writer') {
        fetchAndDisplayPosts(searchType, keyword);
    } else {
        fetchAndDisplayPosts();
    }
}

// 좋아요 기능 함수 (UI 업데이트 로직은 ID 기반이므로 수정 불필요)
async function likePost(postId) {
    // ... (기존 코드와 동일) ...
    const userId = localStorage.getItem('userId');

    if (!userId) {
        alert('좋아요를 누르려면 로그인이 필요합니다.');
        window.location.href = "1_login.html";
        return;
    }

    try {
        const response = await fetch('/api/like', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: parseInt(userId, 10),
                post_id: postId
            })
        });

        const result = await response.json();

        if (response.ok) {
            const likeButton = document.getElementById(`like-btn-${postId}`);
            const likeCountSpan = document.getElementById(`like-count-${postId}`);
            
            if (likeButton && likeCountSpan) {
                if(result.liked) {
                    likeButton.innerHTML = '❤️';
                    likeButton.classList.add('liked'); 
                } else {
                    likeButton.innerHTML = '♡';
                    likeButton.classList.remove('liked');
                }
                likeCountSpan.innerText = result.newLikeCount; 
            }
        } else {
            alert(result.message || '좋아요 처리에 실패했습니다.');
        }
    } catch (error) {
        console.error('좋아요 API 호출 중 오류 발생:', error);
        alert('좋아요 처리 중 오류가 발생했습니다.');
    }
}


// 페이지가 처음 로드될 때 실행되는 코드 (기존과 동일)
document.addEventListener('DOMContentLoaded', function() {
    fetchAndDisplayPosts();
});