document.addEventListener('DOMContentLoaded', function() {
    const mainCategoriesContainer = document.getElementById('mainCategories');
    const subCategoriesContainer = document.getElementById('subCategoriesContainer');
    const inquiryFormContainer = document.getElementById('inquiryFormContainer');

    const inquiryConfig = {
        "id-security": {
            name: "아이디정보/보안",
            subCategories: {
                "account-theft": "계정 도용",
                "security-service": "보안 서비스 문의",
                "login-issues": "로그인 오류"
            }
        },
        "game-inquiry": {
            name: "게임 문의",
            subCategories: { // Based on image_570013.png
                "game-usage": "게임 이용 문의", // Text from image: "게임 이용 문의"
                "game-error-report": "게임 오류 신고", // Text from image: "게임 오류 신고"
                "homepage-error-report": "홈페이지 오류 신고", // Text from image: "홈페이지 오류 신고"
                "user-report": "불량 이용자 신고" // Text from image: "불량 이용자 신고"
            }
        },
        "event-inquiry": {
            name: "이벤트 문의",
            subCategories: {
                "event-participation": "이벤트 참여/진행",
                "event-reward": "이벤트 보상 문의",
                "event-rules": "이벤트 규정 문의"
            }
        },
        "recovery": {
            name: "복구",
            subCategories: {
                "item-recovery": "아이템 복구",
                "character-recovery": "캐릭터 복구",
            }
        },
        "install-run": {
            name: "실행",
            subCategories: {
                "runtime-error": "실행 오류",
                "compatibility": "호환성 문제",
                "update-error": "업데이트 오류"
            }
        }
    };

    function createGameErrorReportForm(mainCategoryKey, subCategoryKey) {
        inquiryFormContainer.innerHTML = '';

        const mainCatName = inquiryConfig[mainCategoryKey]?.name || mainCategoryKey;
        const subCatName = inquiryConfig[mainCategoryKey]?.subCategories[subCategoryKey] || subCategoryKey;
        // Using "게임 오류>콘텐츠 버그 신고" specifically for this form as per image_56fff5.png
        const formSpecificCategoryTitle = "게임 오류 > 콘텐츠 버그 신고";


        const form = document.createElement('form');
        form.id = 'gameErrorReportForm';
        // form.className = 'p-4 border rounded'; // CSS will handle styling

        const formTitle = document.createElement('h4');
        formTitle.textContent = '02 문의입력';
        formTitle.className = 'mb-4'; // Increased margin
        form.appendChild(formTitle);

        const inquiryTypeDiv = document.createElement('div');
        inquiryTypeDiv.className = 'mb-3 form-group row';
        inquiryTypeDiv.innerHTML = `
            <label class="col-sm-2 col-form-label">상담분류</label>
            <div class="col-sm-10">
                <input type="text" readonly class="form-control-plaintext" value="${formSpecificCategoryTitle}">
            </div>
        `;
        form.appendChild(inquiryTypeDiv);

        const serverCharDiv = document.createElement('div');
        serverCharDiv.className = 'mb-3 form-group row';
        serverCharDiv.innerHTML = `
            <label for="gameServer" class="col-sm-2 col-form-label">게임서버</label>
            <div class="col-sm-4">
                <select id="gameServer" class="form-select">
                    <option selected disabled value="">서버 선택</option>
                    <option value="server1">서버1</option>
                </select>
            </div>
            <label for="characterName" class="col-sm-2 col-form-label text-sm-end">캐릭터명</label>
            <div class="col-sm-4">
                <input type="text" class="form-control" id="characterName" placeholder="GM도라에몽">
            </div>
        `;
        form.appendChild(serverCharDiv);

        const titleDiv = document.createElement('div');
        titleDiv.className = 'mb-3 form-group row';
        titleDiv.innerHTML = `
            <label for="inquiryTitle" class="col-sm-2 col-form-label">제목</label>
            <div class="col-sm-10">
                <input type="text" class="form-control" id="inquiryTitle" placeholder="문의하고자 하시는 내용의 키워드를 적어주세요!">
            </div>
        `;
        form.appendChild(titleDiv);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'mb-3 form-group row';
        // Placeholder text directly from image_56fff5.png
        const contentPlaceholder = `[필수기재사항]
1. 오류 확인 날짜/시간:
2. 오류발생 퀘스트/맵 이름: (퀘스트 관련 오류일 경우 진행단계도 써주세요)
3. 오류 내용: (예. 퀘스트, 아이템명을 가지고 NPC와 대화를 해도 진행이 되지 않아요)

※ 오류 메시지 및 오류 발생 시 전체화면 스크린샷이 있다면 첨부해주세요.
   게임 내에서 Print Screen 키로 스크린샷 저장`;
        contentDiv.innerHTML = `
            <label for="inquiryContent" class="col-sm-2 col-form-label">내용</label>
            <div class="col-sm-10">
                <textarea class="form-control" id="inquiryContent" rows="10" placeholder="${contentPlaceholder}"></textarea>
            </div>
        `;
        form.appendChild(contentDiv);

        const attachmentDiv = document.createElement('div');
        attachmentDiv.className = 'mb-3 form-group row align-items-center';
        attachmentDiv.innerHTML = `
            <label for="attachment" class="col-sm-2 col-form-label">첨부파일</label>
            <div class="col-sm-10">
                <div class="input-group">
                    <input type="file" class="form-control" id="attachment" aria-describedby="attachmentHelp">
                    <button class="btn btn-outline-secondary" type="button" id="clearAttachment">파일삭제</button>
                </div>
                <small id="attachmentHelp" class="form-text text-muted">(0MB/최대 10MB)</small>
            </div>
        `;
        form.appendChild(attachmentDiv);

        const emailDiv = document.createElement('div');
        emailDiv.className = 'mb-3 form-group row';
        emailDiv.innerHTML = `
            <label class="col-sm-2 col-form-label">이메일</label>
            <div class="col-sm-10">
                <div class="form-check mb-2">
                    <input class="form-check-input" type="checkbox" id="receiveEmail" checked>
                    <label class="form-check-label" for="receiveEmail">
                        이메일로 답변받기
                    </label>
                </div>
                <div class="input-group">
                    <input type="text" class="form-control" placeholder="이메일 아이디" id="emailId">
                    <span class="input-group-text">@</span>
                    <input type="text" class="form-control" placeholder="도메인 직접입력" id="emailDomain">
                    <select class="form-select" id="emailDomainSelect" style="max-width: 150px;">
                        <option value="">선택하세요</option>
                        <option value="naver.com">naver.com</option>
                        <option value="gmail.com">gmail.com</option>
                        <option value="daum.net">daum.net</option>
                        <option value="hanmail.net">hanmail.net</option>
                        <option value="nate.com">nate.com</option>
                        <option value="manual">직접입력</option>
                    </select>
                </div>
            </div>
        `;
        form.appendChild(emailDiv);

        const phoneDiv = document.createElement('div');
        phoneDiv.className = 'mb-3 form-group row';
        phoneDiv.innerHTML = `
            <label class="col-sm-2 col-form-label">휴대폰번호</label>
            <div class="col-sm-10">
                <div class="form-check mb-2">
                    <input class="form-check-input" type="checkbox" id="receiveSms" checked>
                    <label class="form-check-label" for="receiveSms">
                        SMS 알림받기 <small class="text-muted">(SMS 발송시간 : 오전10시~오후10시 / 심야 답변 시 다음날 오전10시 문자 발송)</small>
                    </label>
                </div>
                <div class="input-group">
                    <select class="form-select" id="phonePrefix" style="max-width: 100px;">
                        <option value="010">010</option><option value="011">011</option><option value="016">016</option>
                        <option value="017">017</option><option value="018">018</option><option value="019">019</option>
                    </select>
                    <span class="input-group-text">-</span>
                    <input type="text" class="form-control" id="phoneMid" maxlength="4" placeholder="1234">
                    <span class="input-group-text">-</span>
                    <input type="text" class="form-control" id="phoneLast" maxlength="4" placeholder="5678">
                </div>
            </div>
        `;
        form.appendChild(phoneDiv);

        const pcSpecDiv = document.createElement('div');
        pcSpecDiv.className = 'mb-4 form-group row'; // Increased margin
        pcSpecDiv.innerHTML = `
            <label class="col-sm-2 col-form-label">PC사양수집</label>
            <div class="col-sm-10">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="collectPcSpec">
                    <label class="form-check-label" for="collectPcSpec">
                        PC사양정보를 보내주시면 보다 정확한 처리가 가능합니다.
                    </label>
                </div>
                <div class="mt-2">
                    <button type="button" class="btn btn-sm btn-outline-secondary" id="btnCollectPcSpec">수집</button>
                    <a href="#" id="pcSpecCollectedLink" class="ms-2" style="display:none; color: blue; text-decoration: underline;">수집완료</a>
                    <span id="pcSpecStatus" class="ms-2 text-muted"></span>
                    <p class="form-text text-muted small mt-1">문제해결 이외의 다른 용도로 사용되지 않습니다. 본 기능은 IE에서만 사용 가능합니다.</p>
                </div>
            </div>
        `;
        form.appendChild(pcSpecDiv);

        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'mt-4 pt-3 text-center border-top'; // Added border-top for separation
        buttonsDiv.innerHTML = `
            <button type="submit" class="btn btn-primary me-2">문의하기</button>
            <button type="button" class="btn btn-secondary" id="cancelInquiry">취소</button>
        `;
        form.appendChild(buttonsDiv);

        inquiryFormContainer.appendChild(form);

        form.querySelector('#clearAttachment').addEventListener('click', () => {
            form.querySelector('#attachment').value = '';
        });

        const emailDomainSelect = form.querySelector('#emailDomainSelect');
        const emailDomainInput = form.querySelector('#emailDomain');
        emailDomainSelect.addEventListener('change', function() {
            if (this.value === "manual") {
                emailDomainInput.value = '';
                emailDomainInput.readOnly = false;
                emailDomainInput.placeholder = "도메인 직접입력";
                emailDomainInput.focus();
            } else if (this.value) {
                emailDomainInput.value = this.value;
                emailDomainInput.readOnly = true;
            } else {
                 emailDomainInput.value = '';
                 emailDomainInput.readOnly = true; // Or false if you want it editable when "선택하세요"
                 emailDomainInput.placeholder = "도메인";
            }
        });
        // Initialize email domain input based on select (if a value is pre-selected)
        if (emailDomainSelect.value && emailDomainSelect.value !== "manual") {
            emailDomainInput.value = emailDomainSelect.value;
            emailDomainInput.readOnly = true;
        } else if (emailDomainSelect.value === "manual"){
            emailDomainInput.readOnly = false;
        } else {
            emailDomainInput.readOnly = true; // Default to readonly if "선택하세요"
            emailDomainInput.placeholder = "도메인";
        }


        form.querySelector('#btnCollectPcSpec').addEventListener('click', () => {
            const pcSpecStatus = form.querySelector('#pcSpecStatus');
            const pcSpecCollectedLink = form.querySelector('#pcSpecCollectedLink');
            if (form.querySelector('#collectPcSpec').checked) {
                pcSpecStatus.textContent = 'PC 사양 수집 기능은 현재 브라우저에서 지원되지 않습니다. DxDiag 정보를 직접 첨부해주세요.';
                pcSpecCollectedLink.style.display = 'none';
                alert('PC 사양 수집 기능은 현재 브라우저에서 지원되지 않습니다. 필요한 경우 DxDiag 실행 후 해당 정보를 "내용"란에 추가하거나 파일로 첨부해주세요.');
            } else {
                pcSpecStatus.textContent = 'PC사양 수집에 동의해주세요.';
                pcSpecCollectedLink.style.display = 'none';
            }
        });

        form.addEventListener('submit', function(event) {
            event.preventDefault();
            if (!form.querySelector('#gameServer').value) {
                alert('게임서버를 선택해주세요.'); form.querySelector('#gameServer').focus(); return;
            }
            if (!form.querySelector('#characterName').value.trim()) {
                alert('캐릭터명을 입력해주세요.'); form.querySelector('#characterName').focus(); return;
            }
            if (!form.querySelector('#inquiryTitle').value.trim()) {
                alert('제목을 입력해주세요.'); form.querySelector('#inquiryTitle').focus(); return;
            }
            if (!form.querySelector('#inquiryContent').value.trim()) {
                alert('내용을 입력해주세요.'); form.querySelector('#inquiryContent').focus(); return;
            }
            if (form.querySelector('#receiveEmail').checked && (!form.querySelector('#emailId').value.trim() || !form.querySelector('#emailDomain').value.trim())) {
                alert('이메일 주소를 올바르게 입력해주세요.'); form.querySelector('#emailId').focus(); return;
            }
            if (form.querySelector('#receiveSms').checked && (!form.querySelector('#phoneMid').value.trim() || !form.querySelector('#phoneLast').value.trim() || form.querySelector('#phoneMid').value.length < 3 || form.querySelector('#phoneLast').value.length < 4 )) {
                alert('휴대폰번호를 올바르게 입력해주세요.'); form.querySelector('#phoneMid').focus(); return;
            }
            alert('문의가 접수되었습니다. (실제 전송 기능은 구현되지 않았습니다)');
        });
        
        form.querySelector('#cancelInquiry').addEventListener('click', () => {
            if (confirm('작성을 취소하시겠습니까? 작성 중인 내용은 저장되지 않습니다.')) {
                inquiryFormContainer.innerHTML = '';
                 // Optionally reset active sub-category
                const activeSubCategory = subCategoriesContainer.querySelector('.sub-category-group .btn.active');
                if (activeSubCategory) activeSubCategory.classList.remove('active');
            }
        });
    }

    function createGenericForm(mainCategoryKey, subCategoryKey) {
        inquiryFormContainer.innerHTML = '';
        const mainCatName = inquiryConfig[mainCategoryKey]?.name || mainCategoryKey;
        const subCatName = inquiryConfig[mainCategoryKey]?.subCategories[subCategoryKey] || subCategoryKey;

        const form = document.createElement('form');
        form.id = `${subCategoryKey}Form`;

        const formTitle = document.createElement('h4');
        formTitle.textContent = '02 문의입력';
        formTitle.className = 'mb-4';
        form.appendChild(formTitle);

        const inquiryTypeDiv = document.createElement('div');
        inquiryTypeDiv.className = 'mb-3 form-group row';
        inquiryTypeDiv.innerHTML = `
            <label class="col-sm-2 col-form-label">상담분류</label>
            <div class="col-sm-10">
                <input type="text" readonly class="form-control-plaintext" value="${mainCatName} > ${subCatName}">
            </div>
        `;
        form.appendChild(inquiryTypeDiv);

        form.innerHTML += `
            <div class="mb-3 form-group row">
                <label for="genericTitle" class="col-sm-2 col-form-label">제목</label>
                <div class="col-sm-10">
                    <input type="text" class="form-control" id="genericTitle" placeholder="제목을 입력하세요">
                </div>
            </div>
            <div class="mb-3 form-group row">
                <label for="genericContent" class="col-sm-2 col-form-label">내용</label>
                <div class="col-sm-10">
                    <textarea class="form-control" id="genericContent" rows="8" placeholder="문의하실 내용을 자세하게 입력해주세요."></textarea>
                </div>
            </div>
            <div class="mb-3 form-group row">
                <label for="genericAttachment" class="col-sm-2 col-form-label">첨부파일</label>
                <div class="col-sm-10">
                     <input type="file" class="form-control" id="genericAttachment">
                </div>
            </div>
             <div class="mt-4 pt-3 text-center border-top">
                <button type="submit" class="btn btn-primary me-2">문의하기</button>
                <button type="button" class="btn btn-secondary" id="cancelGenericInquiry">취소</button>
            </div>
        `;
        inquiryFormContainer.appendChild(form);

        form.querySelector('#cancelGenericInquiry').addEventListener('click', () => {
             if (confirm('작성을 취소하시겠습니까? 작성 중인 내용은 저장되지 않습니다.')) {
                inquiryFormContainer.innerHTML = '';
                const activeSubCategory = subCategoriesContainer.querySelector('.sub-category-group .btn.active');
                if (activeSubCategory) activeSubCategory.classList.remove('active');
            }
        });

        form.addEventListener('submit', function(event) {
            event.preventDefault();
            if (!form.querySelector('#genericTitle').value.trim()) {
                alert('제목을 입력해주세요.'); form.querySelector('#genericTitle').focus(); return;
            }
            if (!form.querySelector('#genericContent').value.trim()) {
                alert('내용을 입력해주세요.'); form.querySelector('#genericContent').focus(); return;
            }
            alert('"' + subCatName + '" 관련 문의가 접수되었습니다. (실제 전송 기능은 구현되지 않았습니다)');
        });
    }

    function displaySubCategories(mainCategoryKey) {
        subCategoriesContainer.innerHTML = '';
        inquiryFormContainer.innerHTML = '';

        const category = inquiryConfig[mainCategoryKey];
        if (category && category.subCategories) {
            const subCategoryGroup = document.createElement('div');
            subCategoryGroup.className = 'sub-category-group';
            
            Object.keys(category.subCategories).forEach((subKey) => {
                const subCategoryName = category.subCategories[subKey];
                const link = document.createElement('a');
                link.href = '#';
                link.className = 'btn btn-outline-secondary';
                link.textContent = subCategoryName;
                link.dataset.mainCategoryKey = mainCategoryKey;
                link.dataset.subCategoryKey = subKey;

                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    subCategoryGroup.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
                    this.classList.add('active');

                    if (mainCategoryKey === 'game-inquiry' && subKey === 'game-error-report') {
                        createGameErrorReportForm(mainCategoryKey, subKey);
                    } else {
                        createGenericForm(mainCategoryKey, subKey);
                    }
                });
                subCategoryGroup.appendChild(link);
            });
            subCategoriesContainer.appendChild(subCategoryGroup);
        }
    }

    mainCategoriesContainer.addEventListener('click', function(e) {
        if (e.target.tagName === 'A' && e.target.classList.contains('nav-link')) {
            e.preventDefault();
            if (e.target.classList.contains('active')) return; // Do nothing if already active

            mainCategoriesContainer.querySelectorAll('.nav-link').forEach(tab => tab.classList.remove('active'));
            e.target.classList.add('active');
            displaySubCategories(e.target.dataset.category);
        }
    });

    const activeMainCategory = mainCategoriesContainer.querySelector('.nav-link.active');
    if (activeMainCategory) {
        displaySubCategories(activeMainCategory.dataset.category);
        // Automatically select "게임 오류 신고" and display its form if "게임 문의" is the active main category on load.
        if (activeMainCategory.dataset.category === "game-inquiry") {
            const gameErrorSubCategoryLink = subCategoriesContainer.querySelector('a[data-sub-category-key="game-error-report"]');
            if (gameErrorSubCategoryLink) {
                gameErrorSubCategoryLink.click(); // Simulate click to trigger form display and active state
            }
        }
    }
});