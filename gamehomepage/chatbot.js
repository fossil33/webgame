// --- 전역 변수 선언 ---
let lexruntime;
let lexBotId; // 챗봇 ID를 저장할 전역 변수

const chatOutput = document.getElementById('messages');
const chatInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-btn');

let currentSessionId = 'SESSION_' + Date.now();
let currentSessionState = undefined;

// --- AWS 및 챗봇 초기화 (비동기) ---
async function initializeChatbot() {
    try {
        // 1. 서버에 챗봇 설정(키)을 요청합니다.
        const response = await fetch('/api/chat-config');
        if (!response.ok) {
            throw new Error('서버에서 챗봇 설정을 가져오는 데 실패했습니다.');
        }
        const config = await response.json();

        // 2. 받아온 botId를 전역 변수에 저장
        lexBotId = config.botId; 

        // 3. SDK 설정
        AWS.config.update({ region: config.region });
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: config.identityPoolId
        });
        
        // 4. lexruntime 변수를 초기화합니다.
        lexruntime = new AWS.LexRuntimeV2();

        console.log("✅ 챗봇 초기화 성공.");

        // 5. (중요) 초기화가 성공한 후에 환영 메시지와 이벤트 배너를 로드합니다.
        if (typeof triggerInitialWelcomeMessage === 'function') {
             triggerInitialWelcomeMessage();
        }
        if (typeof loadAsideEventBanner === 'function') {
            loadAsideEventBanner();
        }

    } catch (error) {
        console.error("🚨 챗봇 초기화 실패:", error);
        if (chatOutput) {
            appendMessage('챗봇', `챗봇 연결에 실패했습니다: ${error.message}`);
        }
    }
}

// --- Helper function to parse markdown-like links ---
function escapeHTML(s = "") {
  return String(s).replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[m]);
}

// --- Helper function to parse markdown-like links ---
function parseLinks(text) {
    // 정규식: [링크텍스트](URL) 형식을 <a href="URL" target="_blank">링크텍스트</a> 로 변환
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    return text.replace(regex, '<a href="$2" target="_blank">$1</a>');
}

// 메시지를 채팅창에 추가하는 함수 (parseLinks 추가)
function appendMessage(sender, message, isHtml = false) {
    const messageElement = document.createElement('div');
    // messageElement.classList.add('message', sender.toLowerCase()); // 스타일링을 위해 클래스 추가 (옵션)

    let formattedMessage = message.replace(/\n/g, '<br>');
    if (sender === '챗봇') { // 챗봇 메시지에만 링크 파싱 적용
        formattedMessage = parseLinks(formattedMessage);
    }
    
    // HTML 직접 삽입 시 주의 (XSS). 여기서는 parseLinks가 제어된 변환을 수행한다고 가정
    messageElement.innerHTML = `<strong>${sender}:</strong> ${formattedMessage}`; 
    
    if (chatOutput) {
        chatOutput.appendChild(messageElement);
        chatOutput.scrollTop = chatOutput.scrollHeight;
    } else {
        console.error("chatOutput element not found");
    }
}

// --- 자주 묻는 질문 버튼을 채팅창에 추가하는 함수 ---
function showQuickQuestionButtons() {
    if (!chatOutput) return;

    const buttonsContainer = document.createElement('div');
    buttonsContainer.classList.add('quick-questions-container'); // 스타일링을 위한 클래스 (chatbot.css 에 추가 필요)
    buttonsContainer.style.padding = "10px 0"; // 약간의 여백

    const questions = [
        { text: "게시물 보기", utterance: "게시물 보여줘" },
        { text: "장비 드랍 확률", utterance: "장비 드랍 확률을 보여줘" },
        { text: "랭킹 보기", utterance: "랭킹을 보여줘" }
    ];

    questions.forEach(q => {
        const button = document.createElement('button');
        button.classList.add('quick-question-btn'); // 스타일링을 위한 클래스
        // 기본 스타일 예시 (chatbot.css 에서 더 상세히 정의 가능)
        button.style.margin = "5px";
        button.style.padding = "8px 12px";
        button.style.border = "1px solid #007bff";
        button.style.backgroundColor = "#ffffffff";
        button.style.color = "#007bff";
        button.style.borderRadius = "5px";
        button.style.cursor = "pointer";
        
        button.textContent = q.text;
        button.addEventListener('click', () => {
            // 사용자가 버튼을 클릭했음을 채팅창에 표시 (선택 사항)
            // appendMessage('나', q.utterance); 
            sendLexRequest(q.utterance); // 해당 발화로 Lex 요청
            // 버튼 클릭 후 버튼들 숨기기 (선택 사항)
            // buttonsContainer.style.display = 'none'; 
        });
        buttonsContainer.appendChild(button);
    });

    chatOutput.appendChild(buttonsContainer);
    chatOutput.scrollTop = chatOutput.scrollHeight;
}


// Lex 요청을 보내고 응답을 처리하는 공통 함수
async function sendLexRequest(textToSend, isInitialTrigger = false) {
    // 🚨 lexruntime과 lexBotId가 모두 초기화되었는지 확인
    if (!lexruntime || !lexBotId) {
        console.warn("Lex 런타임이 아직 준비되지 않았습니다. 잠시 후 다시 시도하세요.");
        if (!isInitialTrigger) {
             appendMessage('챗봇', '챗봇이 아직 연결 중입니다. 잠시 후 다시 시도해 주세요.');
        }
        return; 
    }

    if (!isInitialTrigger) {
        appendMessage('나', textToSend);
    }

    const params = {
        botAliasId: 'TSTALIASID', 
        botId: lexBotId,     // 🚨 하드코딩된 ID 대신 전역 변수 사용
        localeId: 'ko_KR',
        sessionId: currentSessionId,
        text: textToSend,
    };

    if (currentSessionState) {
        params.sessionState = currentSessionState;
    }

    console.log("Sending params to Lex: ", JSON.stringify(params, null, 2));

    try {
        const data = await lexruntime.recognizeText(params).promise();
        console.log("Received data from Lex: ", JSON.stringify(data, null, 2));

        if (data.messages && data.messages.length > 0) {
            data.messages.forEach(message => {
                appendMessage('챗봇', message.content);
            });
            // WelcomeIntent 응답을 받은 후 버튼 표시
            if (data.sessionState && data.sessionState.intent && data.sessionState.intent.name === 'WelcomeIntent' && data.sessionState.intent.state === 'Fulfilled') {
                showQuickQuestionButtons();
            }

        } else {
            if (!(data.sessionState && data.sessionState.dialogAction && data.sessionState.dialogAction.type === 'ElicitSlot')) {
                appendMessage('챗봇', '응답이 없습니다.');
            }
        }

        if (data.sessionState) {
            const dialogActionType = data.sessionState.dialogAction ? data.sessionState.dialogAction.type : null;
            if (dialogActionType === 'ElicitSlot' || dialogActionType === 'ConfirmIntent' || dialogActionType === 'Delegate') {
                currentSessionState = data.sessionState;
            } else {
                currentSessionState = undefined;
                currentSessionId = 'SESSION_' + Date.now();
            }
        } else {
            currentSessionState = undefined;
            currentSessionId = 'SESSION_' + Date.now();
        }

    } catch (err) {
        console.error("Lex Error:", err);
        appendMessage('챗봇', '오류가 발생했습니다. 자세한 내용은 콘솔을 확인하세요.');
        currentSessionState = undefined;
        currentSessionId = 'SESSION_' + Date.now();
    }
}

// 사용자가 입력창에 직접 입력 후 전송하는 함수
async function sendMessageFromInput() {
    const inputText = chatInput.value.trim();
    if (inputText === '') return;
    sendLexRequest(inputText, false);
    chatInput.value = '';
    chatInput.focus();
}

// 초기 환영 메시지를 트리거하는 함수
function triggerInitialWelcomeMessage() {
    sendLexRequest("CLIENT_AUTO_TRIGGER_WELCOME", true);
}


// 이벤트 리스너 연결
if (chatInput) {
    chatInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            sendMessageFromInput();
        }
    });
} else {
    console.error("chatInput element not found");
}

if (sendButton) {
    sendButton.addEventListener('click', sendMessageFromInput);
} else {
    console.error("sendButton element not found");
}

async function loadAsideEventBanner() {
    const sliderContainer = document.getElementById('event-slider');
    const counterElement = document.getElementById('event-slider-counter');
    const controlsContainer = document.querySelector('.event-slider-controls');

    if (!sliderContainer || !counterElement || !controlsContainer) {
        console.error("Event slider elements not found.");
        return;
    }

    try {
        // 1. "ongoing" 상태의 이벤트 목록을 API로 가져옵니다.
        const response = await fetch('/api/events?status=ongoing');
        if (!response.ok) throw new Error('Failed to fetch events');
        
        const { events = [] } = await response.json();

        if (events.length === 0) {
            sliderContainer.innerHTML = `<div class="event-slide"><p style="padding: 16px; color: var(--muted);">진행중인 이벤트가 없습니다.</p></div>`;
            controlsContainer.style.display = 'none'; // 이벤트가 없으면 컨트롤 숨김
            return;
        }

        // 2. 이벤트 데이터를 HTML 슬라이드 DOM으로 변환합니다.
        // (event_config.js의 IMAGE_MAP을 사용)
const slidesHtml = events.map(event => {
            const imageUrl = (typeof EVENT_IMAGE_MAP !== 'undefined' && EVENT_IMAGE_MAP[event.id])
                                ? EVENT_IMAGE_MAP[event.id]
                                : (typeof DEFAULT_EVENT_IMAGE !== 'undefined' ? DEFAULT_EVENT_IMAGE : ''); // event_config.js 참조
            const detailPageUrl = `event_detail.html?id=${encodeURIComponent(event.id)}`;
            const title = event.title || '이벤트 상세 보기';

            // ★★★ 수정된 부분: img 태그 대신 a 태그에 style로 배경 이미지 설정 ★★★
            return `
            <div class="event-slide">
                <a href="${detailPageUrl}"
                   title="${escapeHTML(title)}"
                   style="background-image: url('${escapeHTML(imageUrl)}');">
                    </a>
            </div>`;
        }).join('');
        sliderContainer.innerHTML = slidesHtml;

        // 3. Tiny-Slider를 초기화합니다.
        const slider = tns({
            container: '#event-slider',
            items: 1,
            slideBy: 'page',
            autoplay: true, // 자동 회전 활성화
            autoplayButtonOutput: false,
            autoplayTimeout: 5000, // 5초마다 회전
            mouseDrag: true,
            nav: false, // 기본 nav(dot) 숨김
            controls: false // 기본 controls(arrow) 숨김
        });

        // 4. 커스텀 컨트롤 버튼에 이벤트 연결
        controlsContainer.querySelector('[data-controls="prev"]').addEventListener('click', () => slider.goTo('prev'));
        controlsContainer.querySelector('[data-controls="next"]').addEventListener('click', () => slider.goTo('next'));

        // 5. 슬라이더 인덱스 변경 시 카운터 업데이트
        function updateCounter(info) {
            const displayIndex = info.displayIndex || 1;
            const slideCount = info.slideCount || 1;
            counterElement.textContent = `${displayIndex} / ${slideCount}`;
        }
        
        slider.events.on('indexChanged', updateCounter);

        // 6. 초기 카운터 설정
        updateCounter(slider.getInfo());

    } catch (error) {
        console.error("Error loading event banner:", error);
        sliderContainer.innerHTML = `<div class="event-slide"><p style="padding: 16px; color: var(--muted);">이벤트 로드 실패.</p></div>`;
        controlsContainer.style.display = 'none';
    }
}