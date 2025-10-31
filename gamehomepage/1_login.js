const inputs = document.querySelectorAll(".input");

function addcl() {
  let parent = this.parentNode.parentNode;
  parent.classList.add("focus");
}

function remcl() {
  let parent = this.parentNode.parentNode;
  if (this.value == "") {
    parent.classList.remove("focus");
  }
}

inputs.forEach(input => {
  input.addEventListener("focus", addcl);
  input.addEventListener("blur", remcl);
});
// 로그인 성공 시 호출되는 함수 예제
function onLoginSuccess(response) {
    const kakaoNickname = response.profile.nickname;
    localStorage.setItem('kakaoNickname', kakaoNickname);
    localStorage.setItem('userId', kakaoId); // ✅ 이 줄 추가!
    // 로그인 후 메인 페이지로 이동
    window.location.href = '4_main.html';
}

