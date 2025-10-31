// new_target_chart.js

/**
 * 폼 제출 이벤트를 처리하여 공략 게시판 게시글을 서버에 저장하는 함수
 * @param {Event} event - 폼 제출 이벤트 객체
 */
async function savePost(event) {
    // 폼의 기본 제출 동작(페이지 새로고침)을 막습니다.
    event.preventDefault();

    // 폼에서 제목과 내용 가져오기
    const title = document.getElementById('title').value;
    const content = document.getElementById('content').value;

    // [수정] characterId 대신 userId를 localStorage에서 가져옵니다.
    const userId = localStorage.getItem('userId');

    // 필수 값 유효성 검사
    if (!title || !content) {
        alert('제목과 내용을 모두 입력해주세요.');
        return;
    }

    if (!userId) {
        alert('로그인 정보가 없습니다. 로그인 후 다시 시도해주세요.');
        window.location.href = '1_login.html';
        return;
    }

    // 서버에 보낼 데이터 객체 생성
    const postData = {
        title: title,
        content: content,
        board_type: 'target', // 이 게시판은 '공략 게시판'
        userId: parseInt(userId, 10) // [수정] userId를 전송
    };

    try {
        const response = await fetch('/api/posts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(postData)
        });

        // 서버 응답 처리
        if (response.ok) {
            alert('게시글이 성공적으로 등록되었습니다!');
            window.location.href = 'target_chart.html'; // 등록 후 공략 게시판 목록으로 이동
        } else {
            const errorResult = await response.json();
            alert('게시글 등록에 실패했습니다: ' + (errorResult.message || '알 수 없는 오류'));
        }
    } catch (error) {
        console.error('게시글 저장 중 네트워크 또는 스크립트 오류 발생:', error);
        alert('서버와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
}

// 페이지의 모든 콘텐츠가 로드된 후, 폼의 submit 이벤트에 savePost 함수를 연결합니다.
document.addEventListener('DOMContentLoaded', () => {
    const postForm = document.getElementById('post-form'); // 폼의 ID가 'post-form'이라고 가정
    if (postForm) {
        postForm.addEventListener('submit', savePost);
    } else {
        console.error("게시글 작성 폼(id='post-form')을 찾을 수 없습니다.");
    }
});