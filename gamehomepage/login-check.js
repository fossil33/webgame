document.addEventListener('DOMContentLoaded', function () {
    const kakaoNickname = localStorage.getItem('kakaoNickname');
    const myNickname = localStorage.getItem('myNickname') || kakaoNickname;
  
    const loginMenu = document.getElementById('login-menu');
    const userNameMenu = document.getElementById('user-name-menu');
    const userNameElement = document.getElementById('user-name');
  
    if (kakaoNickname) {
      if (loginMenu) loginMenu.style.display = 'none';
      if (userNameMenu) userNameMenu.style.display = 'block';
      if (userNameElement) {
        userNameElement.textContent = myNickname;
      }
  
      const logoutBtn = document.getElementById('logout');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
          e.preventDefault();
          localStorage.removeItem('kakaoNickname');
          localStorage.removeItem('myNickname');
  
          // 카카오 로그아웃 (세션까지 종료)
          const REST_API_KEY = '2be7a79ef4969430357cb18e2f639bdc';
          const LOGOUT_REDIRECT_URI = 'http://15.164.218.17/1_login.html';
          window.location.href = `https://kauth.kakao.com/oauth/logout?client_id=${REST_API_KEY}&logout_redirect_uri=${LOGOUT_REDIRECT_URI}`;
        });
      }
    } else {
      if (loginMenu) loginMenu.style.display = 'block';
      if (userNameMenu) userNameMenu.style.display = 'none';
    }
  });
  