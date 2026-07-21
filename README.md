# Daeho-AI.github.io

GitHub Pages가 직접 빌드하는 Jekyll 기반 개인 기술 블로그입니다. 콘텐츠는 Markdown/YAML로 관리하고, 검색·분류·읽기 편의 기능은 Liquid로 생성한 정적 데이터와 Vanilla JavaScript로 동작합니다. React, Vue, Next.js, 별도 관리자 서버, 데이터베이스나 Pages CMS를 사용하지 않습니다.

## 5분 수정 가이드

| 수정할 내용 | 수정 위치 |
| --- | --- |
| 이름, 직함, 소개 | `_data/profile.yml` |
| 홈 화면 구성 | `_data/home.yml` |
| 메뉴 | `_data/navigation.yml` |
| 사이트 기능 | `_data/site.yml` |
| 댓글과 분석 | `_data/integrations.yml` |
| 새 글 | `_posts` |
| 작성 중인 글 | `_drafts` |
| 프로젝트 | `_projects` |
| 색상과 여백 | `assets/css/main.css` |
| 작성 방법 | `docs/WRITING_GUIDE.md` |

가장 빠른 수정 순서:

1. `_data/profile.yml`에서 공개할 정보만 입력합니다.
2. `_data/home.yml`에서 섹션의 `enabled`, `order`, `limit`을 확인합니다.
3. `templates/post-template.md`로 첫 글을 만들고 처음에는 `published: false`로 둡니다.
4. `ruby scripts/validate-content.rb`와 production build를 실행합니다.
5. 공개 준비가 끝난 글만 `published: true`로 바꾸고 `main`에 반영합니다.

현재 확인된 공개 정보는 이름 `Daeho-AI`와 GitHub `https://github.com/Daeho-AI`입니다. 이메일, 위치, 직함, 소속, 소개, LinkedIn, 프로필 이미지와 기술 목록은 확인되지 않아 비어 있습니다. 가짜 경력, 논문, 프로젝트, 성과나 통계를 만들어 채우지 마세요.

더 자세한 문서:

- [콘텐츠 위치 지도](docs/CONTENT_MAP.md)
- [글 작성 가이드](docs/WRITING_GUIDE.md)
- [운영 가이드](docs/OPERATIONS_GUIDE.md)
- [컴포넌트 가이드](docs/COMPONENT_GUIDE.md)
- [게시 전 체크리스트](docs/PUBLISHING_CHECKLIST.md)

## 1. 사이트 소개와 소유자 편집 모드

일반 방문자는 공개 블로그를 읽기만 합니다. URL에 `?edit=1`을 붙이거나 `Ctrl+Shift+E`를 누른 경우에만 작은 소유자 로그인 진입점이 나타납니다.

1. `https://daeho-ai.github.io/?edit=1`을 엽니다.
2. **소유자 로그인**을 선택해 GitHub 팝업 로그인을 완료합니다.
3. 로그인 계정이 정확히 `Daeho-AI`이고 이 저장소에 쓰기 권한이 있을 때만 편집 세션이 발급됩니다.
4. 같은 블로그 화면에서 새 글, 현재 글·프로젝트, About, Contact, 프로필, 기술 목록과 이미지를 편집합니다.
5. 저장하면 Worker가 `main`에 커밋하고 커밋 링크와 GitHub Pages 배포 대기 안내를 표시합니다.

별도 `/admin/`, 외부 CMS나 GitHub 편집 화면으로 이동하지 않습니다. `app.pagescms.org`와 Pages CMS 설정도 사용하지 않습니다.

### 보안 경계

- 공개 사이트와 Jekyll 렌더링: GitHub Pages
- GitHub App OAuth, `state`, PKCE, 세션과 권한 확인: `editor-api/` Cloudflare Worker
- 실제 콘텐츠 저장: `Daeho-AI/Daeho-AI.github.io`의 `main`
- 브라우저 세션: 무작위 opaque ID만 저장, GitHub access token은 전달하지 않음
- 서버 검증: 정확한 계정, App 설치, 저장소 push/Contents write 권한, branch, 파일 allowlist
- 충돌 방지: 기존 파일의 GitHub blob SHA가 다르면 덮어쓰지 않고 409 반환
- CORS/CSP: 공개 blog origin과 설정된 Worker/API를 고정하고, 외부 연동은 기능별 allowlist에서만 허용
- 소유자 컨텍스트 격리: `?edit=1` 또는 유효한 편집 세션이 있으면 KaTeX, Mermaid, Giscus와 분석 도구의 제3자 자바스크립트를 로드하지 않음
- 클릭재킹 완화: iframe 안에서는 편집기 boot와 로그인을 거부하며, 일반 방문자에게는 작은 로더만 제공하고 편집 CSS·bundle은 내려받지 않음

Worker 설치, GitHub App callback, KV, secret, 필수 Rate Limiting 운영 조치와 배포는 [`editor-api/README.md`](editor-api/README.md)를 따릅니다. UI TypeScript를 고쳤다면 `tools/owner-editor-ui`에서 build해 `assets/js/owner-editor.bundle.js`를 함께 갱신합니다.

GitHub 저장소에서 직접 수정하는 방법은 Worker 장애나 긴급 복구 때 사용하는 비상 절차입니다.

## 2. 전체 구조

```text
_config.yml                    Jekyll, URL, collection, 기본값과 제외 설정
_data/site.yml                 기능 토글, 표시 개수, 테마와 전역 설정
_data/profile.yml              이름, 소개, 공개 연락처와 프로필
_data/home.yml                 홈 섹션의 표시, 순서, 설명과 개수
_data/navigation.yml           전역 메뉴
_data/categories.yml           카테고리 표시 정보
_data/skills.yml               기술/관심 분야
_data/social.yml               추가 공개 소셜 링크
_data/integrations.yml         Giscus, 분석, 뉴스레터와 문의 폼
_data/editor.yml               인페이지 편집 Worker 연결
_posts/                        공개 후보 게시글 Markdown
_drafts/                       production에서 제외되는 초안
_projects/                     프로젝트 Markdown collection
_layouts/                      페이지 종류별 HTML 골격
_includes/                     재사용 UI, SEO, 검색과 외부 연동
assets/css/                    공통, syntax, print, owner editor 스타일
assets/js/                     기능별 Vanilla JavaScript
assets/images/                 이미지와 업로드
templates/                     게시글·프로젝트·페이지 원본
docs/                          작성·운영 문서; 공개 build에서 제외
scripts/validate-content.rb    콘텐츠와 설정 검사
.github/workflows/validate.yml 검증 전용 CI; Pages 배포를 대체하지 않음
editor-api/                    소유자 인증·저장 Cloudflare Worker
tools/owner-editor-ui/         소유자 편집기 TypeScript 소스
```

주요 공개 페이지:

- `/`: 홈
- `/blog/`: 전체 글과 검색·필터·정렬
- `/categories/`, `/tags/`, `/series/`: 분류별 탐색
- `/archive/`: 연·월별 기록
- `/projects/`: 프로젝트 목록과 필터
- `/search/`: 전체 검색
- `/bookmarks/`: 이 브라우저에 저장한 북마크
- `/about/`, `/contact/`, `/privacy/`
- `/style-guide/`: 메뉴에 숨긴 디자인 점검 페이지, `noindex`

`docs`, `templates`, `scripts`, 개발 도구와 테스트는 `_config.yml`의 `exclude`로 공개 결과에서 제외합니다.

## 3. 프로필 수정

`_data/profile.yml`의 각 필드 위 주석에 표시 위치와 빈 값 동작이 적혀 있습니다.

- `name`: 문서와 SEO 작성자 이름. 필수
- `display_name`: 헤더·프로필 표시 이름. 비우면 `name`
- `headline`: 홈과 사이드바의 직함/짧은 제목
- `short_bio`: 홈, 사이드바, 작성자 카드의 짧은 소개
- `bio`: About 기본 소개
- `profile_image`, `profile_image_alt`: 이미지와 대체 텍스트
- `location`, `email`, `github`, `linkedin`: 공개할 값만 입력
- `organization`, `role`: 검증된 소속·역할만 입력
- `interests`: 관심 분야 YAML 배열
- `availability`: 공개 가능한 연락 상태
- `resume_url`: 공개 이력서 경로 또는 https URL

빈 선택값은 해당 UI 전체를 숨깁니다. 이름, 이메일과 GitHub 주소를 여러 HTML 파일에 반복 입력하지 않습니다. YAML 문장에 `:`, `#`가 있으면 큰따옴표로 감싸세요.

## 4. 홈 화면 수정

`_data/home.yml`에서 공지와 섹션을 관리합니다.

```yaml
sections:
  - id: recent_posts
    enabled: true
    title: "최근 게시글"
    description: "새로 작성하거나 업데이트한 기록"
    limit: 6
    order: 30
```

- `enabled: false`: 섹션 HTML 전체를 숨김
- `order`: 작은 숫자가 먼저 표시
- `limit`: 최대 표시 개수
- `title`, `description`: 섹션 제목과 안내

추천 글은 실제 `_posts`의 `featured: true` 또는 `pinned: true`, 주요 프로젝트는 `_projects`의 `featured: true`를 사용합니다. 데이터가 없으면 가짜 항목을 만들지 않고 섹션을 숨기거나 다음 행동을 안내하는 빈 상태를 표시합니다.

## 5. 메뉴 수정

`_data/navigation.yml`에서 관리합니다.

```yaml
- label: "Blog"
  url: "/blog/"
  new_tab: false
  order: 20
```

내부 주소는 `/blog/`처럼 루트 기준으로 적고 렌더링할 때 `relative_url`을 적용합니다. 외부 링크만 전체 `https` URL을 사용합니다. 메뉴가 많으면 핵심 Home, Blog, Projects, About만 우선 노출하고 Archive, Categories, Tags, Series, Bookmarks, Contact는 More 영역에 둡니다.

## 6. 새 글 작성

가장 안전한 원본은 `templates/post-template.md`입니다. 전체 필드 설명은 `docs/WRITING_GUIDE.md`에 있습니다.

### GitHub 웹 화면의 정확한 비상 절차

1. `_posts` 폴더를 엽니다.
2. **Add file**을 선택합니다.
3. **Create new file**을 선택합니다.
4. `YYYY-MM-DD-slug.md`를 입력합니다.
5. `templates/post-template.md`를 복사합니다.
6. front matter를 실제 값으로 수정합니다.
7. Markdown 본문을 작성합니다.
8. **Preview**에서 결과를 확인합니다.
9. **Commit changes**를 선택합니다.
10. GitHub Pages 배포 완료와 실제 공개 URL을 확인합니다.

파일명 slug에는 소문자 영문, 숫자와 하이픈만 사용합니다. 본문은 h2부터 시작하고, description·이미지 alt·분류를 공개 전에 확인합니다.

## 7. 초안 작성

두 가지 방법이 있습니다.

- `_drafts/slug.md`: production build에 포함되지 않는 Jekyll 초안
- `_posts/YYYY-MM-DD-slug.md` + `published: false`: 날짜와 최종 주소까지 미리 정한 비공개 글

`_drafts/example-post.md`는 구조를 보여 주는 비공개 예시입니다. 실제 글로 공개하지 말고 복사 후 제목·설명·분류와 본문을 모두 바꿉니다. 로컬에서만 초안을 보려면 `jekyll serve --drafts`를 사용합니다.

## 8. 글 공개와 비공개

- `published: false`: 공개 build에서 제외
- `published: true`: 다른 조건도 충족하면 공개
- `noindex: true`: 페이지는 열 수 있지만 검색엔진 색인과 sitemap에서 제외
- `search_exclude: true`: 사이트 내부 검색에서 제외

`noindex`와 `search_exclude`는 비밀 보호 기능이 아닙니다. 민감한 정보는 저장소에 커밋하지 않습니다. 공개 전에 템플릿 문구, TODO, 예시 URL과 이미지 경로가 남지 않았는지 검사합니다.

## 9. 예약 날짜 주의점

`_config.yml`은 `future: false`입니다. 미래 날짜의 게시글은 해당 시각 전까지 production build에서 숨겨질 수 있습니다.

- 파일명 날짜와 front matter 날짜를 맞춥니다.
- `+0900`처럼 시간대를 명시합니다.
- GitHub Pages build 시각과 캐시 때문에 정확히 초 단위 게시를 보장하지 않습니다.
- 예약 글이 즉시 보여야 한다고 가정하지 말고 배포 후 확인합니다.

## 10. 카테고리와 태그

```yaml
categories:
  - "큰 주제"
tags:
  - "세부 키워드"
```

둘 다 YAML 배열입니다. 기존 철자, 띄어쓰기와 대소문자를 재사용해 중복 분류를 피합니다. `/categories/`와 `/tags/`의 링크는 Blog query filter와 연결됩니다. 분류가 없는 글에 임의의 카테고리나 가짜 주제를 붙이지 않습니다.

## 11. 시리즈 작성

같은 시리즈의 글은 이름을 정확히 일치시킵니다.

```yaml
series: "시리즈 이름"
series_order: 1
```

순서는 1 이상의 정수이며 한 시리즈 안에서 중복하지 않습니다. 시리즈가 아닌 글은 `series: ""`, `series_order:`로 둡니다. 시리즈 UI는 값이 있는 글에서만 표시됩니다.

## 12. 프로젝트 추가

1. `templates/project-template.md`를 복사합니다.
2. `_projects/영문-슬러그.md`를 만듭니다.
3. title, summary, period, status, role, technologies에 확인된 값만 입력합니다.
4. 공개 저장소와 데모가 있을 때만 전체 https URL을 입력합니다.
5. 실제 추천 프로젝트만 `featured: true`로 설정합니다.
6. 다른 프로젝트와 겹치지 않는 `order`를 지정합니다.
7. 본문과 모바일 화면을 확인한 뒤 `published: true`로 바꿉니다.

가짜 역할, 소속, 성과, 사용자 수, 성능 수치를 만들어 카드나 본문을 채우지 않습니다. 빈 값의 버튼과 메타데이터는 숨겨집니다.

## 13. 이미지 업로드

소유자 편집 툴바의 **이미지 업로드**가 기본 방법입니다. 파일은 `assets/images/uploads/YYYY/MM/`에 저장되고 Markdown 경로를 받을 수 있습니다.

비상용 GitHub 웹 업로드:

1. `assets/images/uploads/YYYY/MM/`를 엽니다.
2. **Add file → Upload files**를 선택합니다.
3. 소문자 영문·숫자·하이픈 파일명을 사용합니다.
4. 업로드 후 실제 경로를 front matter 또는 Markdown에 입력합니다.

```yaml
cover: "/assets/images/uploads/2026/07/cover.webp"
cover_alt: "대표 이미지의 내용과 목적"
```

```liquid
![이미지 설명]({{ '/assets/images/uploads/2026/07/image.webp' | relative_url }})
```

파일 대소문자를 맞추고, 의미 있는 alt를 입력하고, 웹 표시 크기보다 지나치게 큰 원본은 최적화합니다. 소유자 업로드는 PNG, JPEG, GIF, WebP, AVIF를 지원하며 active content 위험이 있는 SVG 업로드는 허용하지 않습니다.

## 14. 댓글 연결

Giscus는 기본 비활성입니다. `_data/integrations.yml`에 다음 실제 값이 모두 있을 때만 켭니다.

- `repo`, `repo_id`
- `category`, `category_id`
- `mapping`, `strict`, `reactions_enabled`, `input_position`, `lang`

GitHub Discussions와 Giscus App 설치를 먼저 완료하고, Giscus 설정 화면이 제공한 ID만 사용합니다. 그다음 `giscus.enabled: true`, `_data/site.yml`의 `features.comments: true`를 설정합니다. 글별 `comments: false`는 해당 글의 댓글을 숨깁니다. 설정이 불완전하면 script, 제목과 빈 댓글 박스 모두 로드하지 않습니다.

자세한 순서는 `docs/OPERATIONS_GUIDE.md`에 있습니다.

## 15. 분석 도구 연결

`_data/integrations.yml`의 `analytics.provider`는 `google`, `umami`, `plausible` 중 하나입니다. provider별 실제 Measurement ID, website ID, domain 또는 script URL을 입력한 뒤에만 `analytics.enabled`와 `features.analytics`를 켭니다.

- 설정이 없으면 분석 script를 전혀 로드하지 않습니다.
- 쿠키를 쓰는 provider는 사용자 동의 전에 로드하지 않습니다.
- 거부와 Do Not Track을 존중합니다.
- API secret, OAuth token과 private key는 저장소에 넣지 않습니다.

## 16. 다크 모드

사이트는 `light`, `dark`, `system` 세 모드를 지원합니다. 기본값은 `_data/site.yml`의 `default_theme`입니다. 방문자의 선택은 localStorage에 저장되고, system 모드에서는 OS 변경을 따릅니다.

색상을 바꿀 때 `assets/css/main.css` 상단의 토큰을 수정합니다.

- 배경/표면: `--color-background`, `--color-surface`
- 본문/보조 글자: `--color-text`, `--color-muted`
- 강조/링크: `--color-primary`, `--color-primary-hover`
- 테두리/코드: `--color-border`, `--color-code-background`
- 너비/간격: `--content-width`, `--article-width`, `--sidebar-width`, `--space-*`

라이트와 다크 모두에서 링크, 코드, 표, tag, focus와 owner editor를 확인합니다. Giscus와 Mermaid가 활성화되면 테마 변경도 동기화되어야 합니다.

## 17. 검색 인덱스

`search.json`은 공개 게시글에서 정적으로 생성됩니다. title, URL, description, date, categories, tags, series, 제한된 searchable text, cover와 읽기 시간을 포함합니다.

다음은 제외됩니다.

- `published: false`
- `search_exclude: true`
- `noindex: true`
- drafts, docs, templates, Style Guide

검색 dialog는 `Ctrl+K`, `Cmd+K`, 입력 중이 아닐 때 `/`로 열 수 있고 `/search/`는 전체 결과를 제공합니다. 검색 fetch나 JavaScript가 실패해도 `/blog/`의 전체 HTML 목록은 읽을 수 있어야 합니다. production build 뒤 JSON을 검사합니다.

```bash
ruby -rjson -e 'JSON.parse(File.read("_site/search.json"))'
```

## 18. 북마크와 최근 본 글

두 기능은 서버 계정이 아니라 현재 브라우저의 localStorage를 사용합니다.

- 북마크: 카드/상세에서 추가·삭제, `/bookmarks/`에서 확인
- 최근 본 글: 중복을 제거해 최근 순 최대 5개 저장
- 다른 브라우저나 장치와 동기화되지 않음
- 글이 삭제되면 저장된 항목을 안전하게 정리
- localStorage를 사용할 수 없어도 글 읽기에는 영향 없음
- 기록 삭제 기능 제공

`_data/site.yml`에서 기능을 끄면 UI와 저장 동작을 함께 숨깁니다. 저장 사실과 분석/댓글 사용 여부는 `/privacy/`에 실제 설정과 일치하게 설명합니다.

## 19. 로컬 실행

Node.js는 Jekyll 공개 build에 필요하지 않습니다. owner editor TypeScript를 다시 build할 때만 필요합니다.

```bash
gem install github-pages --no-document
jekyll serve --livereload
```

브라우저에서 `http://127.0.0.1:4000`을 엽니다. 초안 포함은 `jekyll serve --drafts`, production 확인은 다음과 같습니다.

```bash
JEKYLL_ENV=production jekyll build --trace
```

Windows native gem 오류가 나면 RubyInstaller MSYS2 개발 도구를 확인합니다. 서버는 `Ctrl+C`로 종료합니다.

## 20. 콘텐츠 검증

```bash
ruby scripts/validate-content.rb
```

검사 내용:

- front matter, title, date와 파일명
- description 경고
- categories/tags/technologies/related posts 배열
- cover 파일과 cover_alt
- 중복 permalink와 프로젝트 order
- 외부 https URL
- `published: true` 문서의 템플릿 placeholder
- Giscus/분석/editor 설정의 필수값

`[ERROR]`가 있으면 종료 코드 1, `[WARN]`만 있으면 0입니다. 경고도 공개 전 검토합니다. 이어서 Jekyll production build, JSON/XML parse와 브라우저 점검을 수행합니다.

## 21. GitHub Pages 배포

이 저장소는 Pages의 branch build를 사용합니다.

1. **Settings → Pages**를 엽니다.
2. **Build and deployment → Source**를 **Deploy from a branch**로 선택합니다.
3. Branch `main`, 폴더 `/ (root)`를 저장합니다.
4. 변경을 `main`에 커밋하거나 병합합니다.
5. Pages 상태가 완료되면 `https://daeho-ai.github.io`를 확인합니다.

`_config.yml`의 `url`은 실제 공개 origin, `baseurl`은 사용자 사이트이므로 빈 문자열입니다. `.nojekyll`을 만들거나 검증 workflow를 임의의 배포 workflow로 바꾸지 않습니다.

## 22. CI 오류 확인

`.github/workflows/validate.yml`은 pull request와 `main` push에서 다음을 검사합니다.

1. Ruby와 GitHub Pages Jekyll 설치
2. 콘텐츠 검증
3. production build
4. 필수 페이지·검색·feed·sitemap·manifest 존재
5. JSON/XML 문법
6. 생성 HTML의 root-relative 내부 링크와 이미지

실패하면 **Actions → Validate Jekyll site**에서 첫 실패 step과 파일명을 확인합니다. 이 workflow는 읽기 권한만 사용하고 배포하지 않습니다.

## 23. 자주 발생하는 오류

- **YAML 오류:** tab 대신 공백을 쓰고, 콜론·#이 든 문장은 따옴표로 감쌉니다.
- **Windows timezone 데이터 오류:** `No source of timezone data could be found`가 나오면 `gem install tzinfo-data --no-document` 후 다시 build합니다.
- **글이 안 보임:** 파일명, `date`, 미래 시각, `published`, `noindex`를 확인합니다.
- **프로젝트가 안 보임:** `_projects` 바로 아래인지, front matter와 `published`를 확인합니다.
- **검색에 없음:** `search_exclude`, `noindex`, `published`와 `search.json` build를 확인합니다.
- **이미지가 깨짐:** 실제 경로, 대소문자, cover/alt와 업로드 commit을 확인합니다.
- **빈 링크:** 선택 URL은 값이 없으면 `""`로 두고 HTML을 직접 만들지 않습니다.
- **가로 스크롤:** 긴 URL, table, pre와 360px viewport를 확인합니다.
- **댓글/분석이 안 보임:** 전역 feature와 integration enabled, 모든 필수값, CSP와 브라우저 console을 확인합니다.
- **소유자 로그인이 안 됨:** Worker URL, GitHub App callback/설치/권한, CORS와 secret을 확인합니다.
- **저장 충돌:** 내용을 복사하고 최신 파일을 다시 불러온 뒤 수동으로 합칩니다. 강제 덮어쓰지 않습니다.
- **배포가 오래 걸림:** Actions와 Settings → Pages 상태가 끝날 때까지 기다립니다.
- **변경이 안 보임:** 배포 완료 후 강력 새로고침, 필요하면 service worker/site data를 확인합니다.

운영 진단과 외부 서비스 비활성화 절차는 `docs/OPERATIONS_GUIDE.md`에 있습니다.

## 24. 이전 버전으로 롤백

commit 이력을 보존하는 revert를 사용합니다.

```bash
git log --oneline
git revert <되돌릴-커밋-SHA>
git push origin main
```

GitHub 웹에서 commit 또는 merged PR의 **Revert**를 사용할 수도 있습니다. 운영 복구에 `git reset --hard`와 강제 push를 사용하지 않습니다. 롤백 commit의 Pages 배포가 끝난 뒤 사이트, 검색 index와 owner editor/Worker 호환성을 확인합니다.

## 최종 확인

- 실제 개인정보와 검증된 콘텐츠만 공개되었는가
- 홈, Blog, 분류, Archive, Projects, Search와 상세 페이지가 연결되는가
- 게시글·프로젝트 0개와 모든 선택값 빈 상태가 안전한가
- 검색, 필터, 목차, 코드 복사, 공유, 북마크와 최근 기록이 오류 없이 동작하는가
- 댓글·분석 미설정 상태에서 관련 UI와 외부 요청이 완전히 없는가
- 1440, 1280, 1024, 768, 430, 390, 360px에서 가로 스크롤이 없는가
- 키보드, focus-visible, dialog 포커스 복귀, alt, aria-live가 올바른가
- production build, `search.json`, `feed.xml`, `sitemap.xml`, 내부 링크 검사가 통과하는가
- GitHub Pages와 Worker에 비밀값이 노출되지 않았는가

게시글 공개 전에는 `docs/PUBLISHING_CHECKLIST.md`를 사용합니다.
