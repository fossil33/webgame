/**
 * [이벤트 이미지 공통 설정]
 * 이 파일에서 ID별 이미지 경로를 설정하면
 * event.js (목록)와 event_detail.js (상세)에 모두 적용됩니다.
 */

// (DB의 post_id를 key로 사용합니다)
const EVENT_IMAGE_MAP = {

  12: 'images/출석.jpg',
  13: 'images/버프.jpg',
  14: 'images/버프.jpg',
};

const DEFAULT_EVENT_IMAGE = 'images/game_default.jpg';

const FEATURED_EVENT_ID = 12;

window.EVENT_IMAGE_MAP     = EVENT_IMAGE_MAP;
window.DEFAULT_EVENT_IMAGE = DEFAULT_EVENT_IMAGE;
window.FEATURED_EVENT_ID   = FEATURED_EVENT_ID;