// popular_chart.js

// [추가] 날짜를 "몇 분 전" 등으로 변경하는 함수
function formatTimeAgo(dateString) {
    const now = new Date();
    const postDate = new Date(dateString);

    // 날짜 파싱 실패 시 원본 문자열 반환
    if (isNaN(postDate.getTime())) {
        return dateString;
    }

    const seconds = Math.floor((now - postDate) / 1000);
    
    let interval = seconds / 31536000; // 1년
    if (interval > 1) {
        return Math.floor(interval) + "년 전";
    }
    interval = seconds / 2592000; // 1달
    if (interval > 1) {
        return Math.floor(interval) + "개월 전";
    }
    interval = seconds / 86400; // 1일 (24시간)
    if (interval > 1) {
        return Math.floor(interval) + "일 전";
    }
    interval = seconds / 3600; // 1시간 (60분)
    if (interval > 1) {
        return Math.floor(interval) + "시간 전";
    }
    interval = seconds / 60; // 1분
    if (interval > 1) {
        return Math.floor(interval) + "분 전";
    }
    return "방금 전";
}


// HTML 문자열을 안전하게 처리하기 위한 유틸리티 함수
function escapeHTML(str) {
    const p = document.createElement('p');
    p.appendChild(document.createTextNode(str || ''));
    return p.innerHTML;
}

// [수정] 게시글을 "Panel" 카드로 표시하는 함수
function displayPosts(posts) {
    const postListContainer = document.getElementById('postList');
    if (!postListContainer) {
        console.error("Error: 'postList' 요소를 찾을 수 없습니다.");
        return;
    }
    postListContainer.innerHTML = '';

    if (!posts || posts.length === 0) {
        postListContainer.innerHTML = '<p class="empty-message">게시글이 없습니다. 첫 번째 글을 등록하세요.</p>'; 
        return;
    }

    posts.forEach((post, index) => {
        const postCard = document.createElement('div');
        postCard.className = 'post-card';

        const nicknameDisplay = post.nickname ? escapeHTML(post.nickname) : '정보 없음'; 
        const detailPageLink = (post.board_type === 'popular') ? '9-2_see.html' : '10-2_see.html';
        const heartIcon = post.userHasLiked ? '❤️' : '♡';
        const likedClass = post.userHasLiked ? 'liked' : ''; 

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
    let apiUrl = '/api/posts?board_type=popular'; 

    if (userId) {
        apiUrl += `&userId=${userId}`;
    }

    if (searchType && keyword && keyword.trim() !== '') {
        apiUrl += `&searchType=${encodeURIComponent(searchType)}&keyword=${encodeURIComponent(keyword)}`;
    }

    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`게시글 로딩 실패: ${response.status} ${response.statusText}`); 
            }
            return response.json();
        })
        .then(posts => {
            displayPosts(posts);
        })
        .catch(err => {
            console.error('게시글 데이터 요청 또는 처리 중 오류:', err); 
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

// 좋아요 기능 함수
async function likePost(postId) {
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