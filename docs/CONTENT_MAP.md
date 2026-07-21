# 콘텐츠 위치 지도

이 문서는 “어느 값을 바꾸면 화면의 어디가 바뀌는가”를 찾는 표입니다. 콘텐츠는 Markdown/YAML로 관리하고, 레이아웃과 동작은 `_layouts`, `_includes`, `assets`에서 관리합니다. 빈 값은 가능한 한 해당 UI 전체를 숨기며 빈 링크나 깨진 이미지를 만들지 않습니다.

## 가장 자주 수정하는 위치

| 화면 | 표시 영역 | 수정 파일 | 주요 필드 또는 내용 | 필수 | 비어 있을 때 | 입력 예시 |
| --- | --- | --- | --- | --- | --- | --- |
| 전체 | 사이트 제목·설명 | `_data/site.yml` | `title`, `description` | 권장 | `_config.yml` 값을 사용 | `title: "Daeho-AI"` |
| 전체 | 기능 켜기/끄기 | `_data/site.yml` | `features.*` | 예 | 기능별 기본값 사용 | `features.search: true` |
| 전체 | 이름·작성자 | `_data/profile.yml` | `name`, `display_name` | `name` 필수 | `display_name`은 `name` 사용 | `name: "Daeho-AI"` |
| 전체 | 메뉴 | `_data/navigation.yml` | `label`, `url`, `order`, `new_tab` | 메뉴별 필수 | 잘못된/빈 항목은 추가하지 않음 | `url: "/blog/"` |
| 전체 | 추가 소셜 링크 | `_data/social.yml` | `label`, `url`, `new_tab` | 아니요 | 소셜 목록을 숨김 | `url: "https://…"` |
| 홈 | 섹션 표시·순서 | `_data/home.yml` | `sections[].enabled`, `order`, `limit` | 예 | 비활성 섹션은 HTML도 출력하지 않음 | `id: recent_posts` |
| 홈 | 공지 배너 | `_data/home.yml` | `announcement.enabled`, `text`, `url` | 아니요 | 배너를 숨김 | `enabled: false` |
| 홈·사이드바 | 직함·짧은 소개 | `_data/profile.yml` | `headline`, `short_bio` | 아니요 | 해당 줄을 숨기거나 사이트 설명 사용 | `headline: "…"` |
| 홈·사이드바 | 프로필 이미지 | `_data/profile.yml` | `profile_image`, `profile_image_alt` | 아니요 | placeholder SVG 사용 | `/assets/images/profile.webp` |
| 홈·About | 관심 분야 | `_data/profile.yml` | `interests` | 아니요 | 해당 목록을 숨김 | `interests: ["…"]` |
| 홈·사이드바 | 기술 목록 | `_data/skills.yml` | `categories[].name`, `items` | 아니요 | 기술 섹션을 숨기거나 빈 상태 표시 | `items: ["Ruby"]` |
| 홈 | 추천 글 | `_posts/*.md` | `featured`, `pinned` | 아니요 | 추천 글 영역을 숨기거나 빈 상태 표시 | `featured: true` |
| 홈·Blog | 최근 글 | `_posts/*.md` | `date`, `published` | 글별 필수 | 공개 글이 없으면 안내 표시 | `published: true` |
| 홈·Projects | 주요 프로젝트 | `_projects/*.md` | `featured`, `order` | 아니요 | 준비 중 안내 표시 | `featured: true` |
| Contact | 이메일·공개 링크 | `_data/profile.yml` | `email`, `github`, `linkedin` | 아니요 | 값별 버튼 숨김 | `email: "name@example.com"` |
| Contact | 위치·연락 가능 상태 | `_data/profile.yml` | `location`, `availability` | 아니요 | 해당 행 숨김 | `availability: "…"` |
| Contact | 외부 문의 폼 | `_data/integrations.yml` | `contact_form_url` | 아니요 | 폼 링크 숨김 | 전체 `https` URL |
| Footer·홈 | 뉴스레터 링크 | `_data/integrations.yml` | `newsletter_url` | 아니요 | 구독 UI 숨김 | 전체 `https` URL |

## 게시글과 탐색

| 화면 | 표시 영역 | 수정 파일 | 주요 필드 또는 내용 | 필수 | 비어 있을 때 | 입력 예시 |
| --- | --- | --- | --- | --- | --- | --- |
| Blog 카드 | 제목·요약 | `_posts/*.md` | `title`, `description` | 예 | description은 excerpt fallback | `description: "…"` |
| Blog 카드 | 대표 이미지 | `_posts/*.md` | `cover`, `cover_alt` | 아니요 | 이미지 없는 목록형 카드 사용 | `/assets/images/posts/…` |
| Blog 필터 | 카테고리·태그·시리즈 | `_posts/*.md` | `categories`, `tags`, `series` | 아니요 | 해당 필터에서 제외 | YAML 배열/문자열 |
| Blog | 페이지당 글 수 | `_data/site.yml` | `posts_per_page` | 예 | 사이트 기본값 사용 | `8` |
| 검색 | 검색 활성화·결과 수 | `_data/site.yml` | `features.search`, `search_results_limit` | 예 | 검색 UI 전체 숨김 | `8` |
| 검색 | 글 포함 여부 | `_posts/*.md` | `search_exclude`, `noindex`, `published` | 아니요 | 기본적으로 공개 글 포함 | `search_exclude: true` |
| Categories | 설명·표시명 | `_data/categories.yml` | 카테고리별 설정 | 아니요 | 게시글의 카테고리명만 사용 | 실제 사용 카테고리만 추가 |
| Archive | 날짜·분류 | `_posts/*.md` | `date`, `categories`, `series` | 날짜 필수 | 없는 선택값만 숨김 | `date: … +0900` |
| Series | 시리즈 연결 | `_posts/*.md` | `series`, `series_order` | 아니요 | 시리즈 UI 숨김 | `series_order: 1` |
| Bookmarks | 기능 토글 | `_data/site.yml` | `features.bookmarks` | 예 | 버튼과 페이지 안내 숨김 | `true` |
| 최근 본 글 | 기능 토글 | `_data/site.yml` | `features.recently_viewed` | 예 | 기록 저장·UI 모두 중지 | `true` |

## 게시글 상세

| 표시 영역 | 수정 파일 | 필드 | 필수 | 비어 있을 때 |
| --- | --- | --- | --- | --- |
| 제목·부제목 | `_posts/*.md` | `title`, `subtitle` | 제목 필수 | 부제목 숨김 |
| 작성일·수정일 | `_posts/*.md` | `date`, `last_modified_at` | 작성일 필수 | 수정일이 없거나 같으면 숨김 |
| 작성자 | `_posts/*.md`, `_data/profile.yml` | `author`, `display_name` | 아니요 | 기본 프로필 이름 사용 |
| 예상 읽기 시간 | Markdown 본문 | 본문 길이 | 자동 | 최소 1분으로 표시하거나 짧은 글에서 생략 |
| 목차 | `_posts/*.md`, `_data/site.yml` | `toc`, `features.table_of_contents` | 아니요 | h2/h3가 부족하면 숨김 |
| 진행률 | `_data/site.yml` | `features.reading_progress` | 아니요 | 진행률 바 숨김 |
| 댓글 | `_posts/*.md`, `_data/site.yml`, `_data/integrations.yml` | `comments`, `features.comments`, `giscus.*` | 아니요 | 제목과 빈 박스까지 모두 숨김 |
| 수식 | `_posts/*.md` | `math` | 아니요 | 수식 자산 로드 안 함 |
| Mermaid | `_posts/*.md` | `mermaid` | 아니요 | Mermaid 자산 로드 안 함 |
| 관련 글 | 카테고리·태그·시리즈 | `series`, `tags`, `categories` | 아니요 | 섹션 숨김 |
| 검색엔진 색인 | `_posts/*.md` | `noindex`, `canonical_url` | 아니요 | 사이트 기본 canonical과 index 사용 |

## 프로젝트

| 표시 영역 | 수정 파일 | 필드 | 필수 | 비어 있을 때 |
| --- | --- | --- | --- | --- |
| 카드·상세 제목 | `_projects/*.md` | `title` | 예 | 검증 오류 |
| 요약 | `_projects/*.md` | `summary` | 권장 | 카드의 설명 영역 숨김 |
| 상태·기간·역할 | `_projects/*.md` | `status`, `period`, `role` | 아니요 | 값별 UI 숨김 |
| 기술 | `_projects/*.md` | `technologies` | 아니요 | 기술 칩 숨김 |
| 저장소·데모 버튼 | `_projects/*.md` | `repository_url`, `demo_url` | 아니요 | 값별 버튼 숨김 |
| 대표 이미지 | `_projects/*.md` | `cover`, `cover_alt` | 아니요 | 이미지 없는 프로젝트 카드 사용 |
| 관련 글 | `_projects/*.md` | `related_posts` | 아니요 | 관련 글 섹션 숨김 |
| 목록 순서 | `_projects/*.md` | `featured`, `order` | order 권장 | 기본 정렬 사용 |

## 외부 연동과 개인정보

| 기능 | 수정 파일 | 필수 값 | 비어 있거나 비활성일 때 |
| --- | --- | --- | --- |
| Giscus | `_data/integrations.yml` | `enabled`, `repo`, `repo_id`, `category`, `category_id` | 스크립트·제목·영역 모두 숨김 |
| Google Analytics 4 | `_data/integrations.yml` | `analytics.enabled`, `provider: google`, `google_measurement_id` | 스크립트 로드 안 함 |
| Umami | `_data/integrations.yml` | `provider: umami`, script URL, website ID | 스크립트 로드 안 함 |
| Plausible | `_data/integrations.yml` | `provider: plausible`, domain, script URL | 스크립트 로드 안 함 |
| PWA | `_data/site.yml` | `features.pwa` | service worker 등록 안 함 |
| 인페이지 편집 | `_data/editor.yml`, `editor-api/` | enabled, API URL, Worker secrets | 일반 방문자 화면에는 편집 UI 없음 |

분석 도구, 북마크, 최근 본 글과 최근 검색어의 로컬 저장 동작은 `privacy.md`에 공개 설명을 함께 유지합니다. 저장소에는 OAuth secret, 액세스 토큰, 분석 서비스 비밀키를 넣지 않습니다.

## 코드와 디자인을 수정할 때

| 목적 | 위치 |
| --- | --- |
| 공통 HTML 골격 | `_layouts/default.html` |
| 페이지 종류별 골격 | `_layouts/*.html` |
| 재사용 UI | `_includes/*.html` |
| 디자인 토큰과 공통 UI | `assets/css/main.css` |
| 코드 문법 색상 | `assets/css/syntax.css` |
| 인쇄/PDF | `assets/css/print.css` |
| 기능별 동작 | `assets/js/*.js` |
| 소유자 편집기 UI 소스 | `tools/owner-editor-ui/src` |
| 소유자 인증·저장 API | `editor-api/` |

소유자 편집기 파일 경로와 DOM 계약을 바꾸기 전에는 `editor-api/README.md`와 `tools/owner-editor-ui`를 함께 확인하세요.
