# When2meet Calendar Fill

캘린더 iCal 주소로 when2meet 가용 시간을 자동으로 칠하는 크롬 익스텐션. OAuth 없음.

## 사용
1. iCal 주소 복사
   - Google (Notion 캘린더·삼성 캘린더도 Google 계정 동기화라면 이것): 설정 → (캘린더) → 캘린더 통합 → "iCal 형식의 비공개 주소"
   - Outlook: 설정 → 캘린더 → 공유 캘린더 → 캘린더 게시 → ICS 링크
   - iCloud: 캘린더 공유 → 공개 캘린더 → 링크 복사 (webcal:// 그대로 붙여넣기)
2. when2meet 이벤트 페이지에서 이름으로 로그인
3. 익스텐션 아이콘 → 주소 붙여넣기 → "내 캘린더로 채우기"

일정이 있는 칸은 불가능, 없는 칸은 가능으로 **덮어씁니다**. "바쁨 표시 안 함"(투명) 일정과 기본 종일 일정은 무시합니다.

## 개발
- 로드: `chrome://extensions` → 개발자 모드 → "압축해제된 확장 프로그램을 로드합니다" → 이 폴더
- 테스트: `node test.js`

## 웹스토어 배포
1. `zip -r ../when2meet-calendar-fill.zip manifest.json popup.html popup.js calendar.js vendor icons`
2. https://chrome.google.com/webstore/devconsole 개발자 등록($5, 1회) → 새 항목 → zip 업로드
3. 스토어 등록정보: 설명, 스크린샷(1280x800) 1장 이상, 아이콘 `icons/128.png`
4. 개인정보 보호: `PRIVACY.md`를 GitHub 등에 공개하고 URL 입력. 권한 사유:
   - `activeTab`, `scripting`: 사용자가 버튼을 누른 when2meet 탭의 격자를 읽고 칠하기 위해
   - `storage`: 사용자가 입력한 iCal 주소를 브라우저에 저장
   - 선택적 호스트 권한 `https://*/*`: 사용자가 입력한 iCal 주소의 도메인만, 처음 사용할 때 요청해 피드를 내려받기 위해
   - 원격 코드 없음 (ical.js는 `vendor/`에 포함)
5. 공개 범위: 지인용이면 "미등록(Unlisted)" — 링크 있는 사람만 설치, 업데이트 자동

업데이트 시 `manifest.json`의 `version`을 올리고 새 zip 업로드.
