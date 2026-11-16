# 달빛교회 홈페이지

대한예수교장로회 달빛교회 홈페이지. GitHub Pages로 `https://www.lightofmoon.org`에 서비스한다.
`main` 브랜치에 올리면 1~2분 뒤 사이트에 반영된다. 빌드 과정은 없고, 정적 HTML·CSS·JS 그대로다.

사용자(김무성 목사)는 개발자가 아니다. 설명은 쉬운 한국어로 하고, 해야 할 일은 화면 순서대로 안내한다.

## 구조

- `index.html` 첫 화면, `about.html` 교회소개, `worship.html` 예배안내, `sermon.html` 말씀과 설교, `news.html` 소식과 나눔(주보·후기)
- 스타일은 각 페이지 `<style>`과 인라인 `style`에 있다. 게시판 공통 모양만 `assets/css/board.css`.
- `assets/js/site.js`: 복사·펼치기 버튼, 유튜브 목록, 청소년 설교문(`data/youth.json`)
- `assets/js/board.js`: Firebase(Firestore) 게시판. 후기는 누구나, 주보·설교 안내·청소년 설교문은 관리자만 쓴다.
- `firestore.rules`: 보안 규칙. 고치면 사용자가 Firebase 콘솔의 Firestore → 규칙에 직접 붙여 넣어야 적용된다.
- `data/videos.json`: `.github/workflows/update-videos.yml`이 한 시간마다 갱신한다. 손으로 고치지 않는다.

## 주보 올리기

"이 주보를 홈페이지에 올려 줘"라는 요청을 받으면:

1. 주보를 쪽마다 PNG로 만든다. 가로 1400~1600px, 한 쪽 1MB 이하로 맞춘다.
2. `bulletins/YYYY-MM-DD-1.png`, `-2.png` … 로 저장한다. 날짜는 그 주보의 주일 날짜다.
3. `data/bulletins.json` 배열에 항목을 더한다.
   ```json
   { "date": "2026-11-22", "title": "주일 예배 주보", "pages": ["bulletins/2026-11-22-1.png", "bulletins/2026-11-22-2.png"] }
   ```
4. 커밋해서 `main`에 올린다. `news.html`의 주보 칸에 날짜순으로 나타나고, 가장 최근 주보가 펼쳐져 보인다.

주보에 교우의 전화번호·주소 같은 개인 정보가 있으면 올리기 전에 사용자에게 확인한다. 저장소와 사이트는 누구나 볼 수 있다.

## 청소년 설교문 추가 (파일로 넣을 때)

`data/youth.json` 배열 맨 앞에 항목을 더한다. `blocks`의 `k`는 `h`(소제목), `q`(인용), `p`(문단)다.
`sermon.html`의 `<noscript>` 안에도 같은 글을 넣어야 네이버 검색 로봇이 읽는다.

## 지킬 것

- 새 페이지를 만들면 `sitemap.xml`에 주소를 더하고, 모든 페이지의 메뉴(`<nav class="nav">`)를 함께 고친다.
- 올리기 전에 `python3 -m http.server`로 띄워 컴퓨터 폭과 휴대폰 폭(390px)에서 확인한다.
- 화면에 넣는 글은 `textContent`로만 넣는다. 게시판 글을 `innerHTML`로 넣지 않는다.
