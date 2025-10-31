(function () {
  'use strict';

  // 전역으로 내보내서 nav 주입 후에만 호출
  window.siteMenuClone = function () {
    const jsCloneNavs = document.querySelectorAll('.js-clone-nav');
    const body = document.querySelector('.site-mobile-menu-body');

    // 필수 노드 없으면 아무것도 하지 않고 종료 (크래시 방지)
    if (!jsCloneNavs.length || !body) return;

    jsCloneNavs.forEach(nav => {
      const cloned = nav.cloneNode(true);
      cloned.className = 'site-nav-wrap';
      body.appendChild(cloned);
    });

    // 모바일 메뉴 컨테이너가 없으면 여기서 종료
    const mobileMenu = document.querySelector('.site-mobile-menu');
    if (!mobileMenu) return;

    // 하위 메뉴 처리
    setTimeout(() => {
      const hasChildrens = mobileMenu.querySelectorAll('.has-children');
      let counter = 0;

      hasChildrens.forEach(hasChild => {
        const refEl = hasChild.querySelector('a');
        if (!refEl) return;

        const span = document.createElement('span');
        span.className = 'arrow-collapse collapsed';
        hasChild.insertBefore(span, refEl);

        const arrow = hasChild.querySelector('.arrow-collapse');
        if (arrow) {
          arrow.setAttribute('data-bs-toggle', 'collapse');
          arrow.setAttribute('data-bs-target', '#collapseItem' + counter);
        }

        const dropdown = hasChild.querySelector('.dropdown');
        if (dropdown) {
          dropdown.className = 'collapse';
          dropdown.id = 'collapseItem' + counter;
        }
        counter++;
      });
    }, 0);

    // 토글 버튼
    const toggles = document.querySelectorAll('.js-menu-toggle');
    toggles.forEach(btn => {
      btn.addEventListener('click', () => {
        document.body.classList.toggle('offcanvas-menu');
        toggles.forEach(b => b.classList.toggle('active'));
      });
    });

    // 바깥 클릭 시 닫기
    const specified = document.querySelector('.site-mobile-menu');
    document.addEventListener('click', e => {
      if (!specified) return;
      const inside = specified.contains(e.target);
      const onToggle = [...toggles].some(b => b.contains(e.target));
      if (!inside && !onToggle) {
        document.body.classList.remove('offcanvas-menu');
        toggles.forEach(b => b.classList.remove('active'));
      }
    });
  };
})();
