// post_see.js (목록 버튼 로직 수정 완료)

// 날짜를 "몇 분 전" 등으로 변경하는 함수
function formatTimeAgo(dateString) {
    const now = new Date();
    // UTC 시간을 로컬 시간으로 변환 (기본값이 UTC 'Z'인 경우 대비)
    const postDate = new Date(dateString);

    // 날짜 파싱 실패 시 원본 문자열 반환
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

// 초(second)를 기준으로 문자열을 반환하는 헬퍼 함수
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


document.addEventListener('DOMContentLoaded', async function () {
    const params = new URLSearchParams(window.location.search);
    const postId = params.get('id');
    let currentBoardType = 'popular'; // 기본값 (혹시 모를 오류 대비)

    if (!postId) {
        document.getElementById('postTitle').innerText = '게시물을 찾을 수 없습니다';
        return;
    }

    try {
        const response = await fetch(`/api/posts/${postId}`);
        if (!response.ok) {
            throw new Error("게시글 정보를 불러오는 데 실패했습니다.");
        }
        
        const post = await response.json();
        currentBoardType = post.board_type || 'popular'; // API 응답에서 board_type 저장

        document.getElementById('postTitle').innerText = post.title;
        document.getElementById('postAuthor').innerText = "작성자: " + (post.nickname || '정보 없음');
        document.getElementById('postDate').innerText = "작성일: " + formatTimeAgo(post.date);
        document.getElementById('postContent').innerText = post.content;
        document.getElementById('postView').innerText = "조회수: " + (post.view_count ?? 0);

        const loggedInUserId = localStorage.getItem('userId');
        const deleteBtn = document.getElementById('deleteBtn');

        if (deleteBtn && loggedInUserId && post.author_user_id && String(loggedInUserId) === String(post.author_user_id)) {
            deleteBtn.style.display = 'inline-block';

            deleteBtn.addEventListener('click', async () => {
                if (!confirm('정말로 이 게시물을 삭제하시겠습니까?')) return;

                try {
                    const deleteResponse = await fetch(`/api/posts/${postId}?userId=${loggedInUserId}`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                    });
                    
                    const result = await deleteResponse.json();
                    if (!deleteResponse.ok) throw new Error(result.message || '삭제에 실패했습니다.');

                    alert(result.message);
                    
                    const redirectUrl = (currentBoardType === 'popular') ? 'popular_chart.html' : 'target_chart.html';
                    window.location.href = redirectUrl;

                } catch (error) {
                    alert('오류가 발생했습니다: ' + error.message);
                }
            });
        }
    } catch (err) {
        console.error('Error fetching post details:', err);
        document.getElementById('postTitle').innerText = '게시물 없음';
        document.getElementById('postContent').innerText = '요청하신 게시물을 찾을 수 없습니다.';
    }

    // --- 이하 댓글 기능 ---
    const loadComments = async () => {
        const commentList = document.getElementById('commentList');
        if (!commentList) return;
        commentList.innerHTML = '';
        try {
            const response = await fetch(`/api/comments?post_id=${postId}`);
            const comments = await response.json();
            if (!response.ok) throw new Error(comments.message || '알 수 없는 오류');
            if (comments.length === 0) {
                commentList.innerHTML = '<p class="empty-comment">작성된 댓글이 없습니다.</p>';
                return;
            }
            comments.forEach(comment => {
                const div = document.createElement('div');
                div.classList.add('comment');
                div.innerHTML = `
                    <div class="comment-header">
                        <h4 class="comment-author">${comment.user_nickname || '사용자 없음'}</h4>
                        <span class="comment-date">${formatTimeAgo(comment.created_at)}</span>
                    </div>
                    <p class="comment-content">${comment.content}</p>
                `;
                commentList.appendChild(div);
            });
        } catch (err) {
            console.error('Error loading comments:', err);
            commentList.innerHTML = '<p class="error-message">댓글을 불러오는 데 실패했습니다.</p>';
        }
    };
    
    const commentButton = document.getElementById('commentButton');
    if (commentButton) {
        commentButton.addEventListener('click', async () => {
            const commentInput = document.getElementById('commentInput');
            const commentText = commentInput.value.trim();
            const userId = localStorage.getItem('userId');
            
            if (!userId) {
                alert("댓글을 작성하려면 로그인이 필요합니다.");
                window.location.href = '1_login.html'; // 로그인 페이지로 이동
                return;
            }
            if (!commentText) {
                alert("댓글 내용을 입력하세요.");
                return;
            }

            const commentData = { 
                post_id: parseInt(postId, 10), 
                userId: parseInt(userId, 10), 
                content: commentText 
            };
            
            try {
                const response = await fetch('/api/comments', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(commentData) 
                });
                
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || '댓글 저장에 실패했습니다.');
                
                commentInput.value = '';
                await loadComments(); // 댓글 목록 새로고침
                
            } catch (err) {
                alert("댓글 저장 중 오류가 발생했습니다: " + err.message);
            }
        });
    }

    // [★수정★] 목록 버튼 이벤트 (board_type에 따라 다른 페이지로 이동)
    const listBtn = document.getElementById('listBtn');
    if (listBtn) {
        listBtn.addEventListener('click', () => {
            // API에서 가져온 currentBoardType을 사용
            const listPageUrl = (currentBoardType === 'popular') ? 'popular_chart.html' : 'target_chart.html';
            window.location.href = listPageUrl;
        });
    }

    await loadComments(); // 페이지 로드 시 댓글 불러오기
});