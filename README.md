# 달빛교회 홈페이지

대한예수교장로회 달빛교회 홈페이지입니다. GitHub Pages로 서비스합니다.

## 구성

| 파일 | 내용 |
|---|---|
| `index.html` | 첫 화면 |
| `about.html` | 교회소개 |
| `worship.html` | 예배안내·오시는 길 |
| `sermon.html` | 말씀과 설교 (설교 안내, 최근 설교, 짧은 말씀, 청소년 설교문) |
| `assets/` | 그림과 화면 동작 코드 |
| `data/videos.json` | 유튜브 최근 영상 목록. 한 시간마다 자동으로 갱신됩니다. |
| `data/youth.json` | 청소년 설교문 |

## 최근 설교 자동 갱신

`.github/workflows/update-videos.yml`이 한 시간마다 `scripts/update_videos.py`를 실행해
유튜브 채널의 새 영상과 쇼츠를 `data/videos.json`에 반영합니다.
바로 반영하고 싶으면 GitHub의 Actions 탭에서 "최근 설교 영상 갱신"을 골라 "Run workflow"를 누릅니다.

## 내 컴퓨터에서 미리 보기

```
python3 -m http.server 8000
```

그다음 브라우저에서 http://localhost:8000 을 엽니다.
