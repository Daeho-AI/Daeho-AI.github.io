# 운영 가이드

이 사이트는 GitHub Pages가 Jekyll 정적 사이트를 빌드하고, Cloudflare Worker가 소유자 로그인과 저장소 쓰기만 담당합니다. `/admin/`, Pages CMS, 별도 데이터베이스를 사용하지 않습니다.

## 운영 구조

```text
방문자 브라우저 ──읽기──> GitHub Pages / Jekyll
소유자 브라우저 ──OAuth·저장──> Cloudflare Worker ──커밋──> GitHub 저장소 main
GitHub 저장소 main ──Pages build──> 공개 사이트
```

브라우저에는 GitHub access token이 전달되지 않습니다. Worker는 정확한 `Daeho-AI` 계정, `Daeho-AI/Daeho-AI.github.io` 저장소 쓰기 권한, 허용된 branch와 파일 경로를 서버에서 검증합니다.

## 일상적인 콘텐츠 운영

1. 공개 사이트에 `?edit=1`을 붙이거나 `Ctrl+Shift+E`를 누릅니다.
2. **소유자 로그인**으로 GitHub 인증을 완료합니다.
3. 같은 페이지의 툴바에서 글·프로젝트·About·Contact·프로필·기술을 수정합니다.
4. 저장 뒤 표시되는 커밋 링크를 확인합니다.
5. GitHub Pages 배포가 끝난 뒤 실제 URL에서 결과를 확인합니다.

이미지는 툴바의 **이미지 업로드**로 `assets/images/uploads/YYYY/MM/`에 저장할 수 있습니다. 충돌 오류가 나면 편집 중인 내용을 안전한 곳에 복사하고 패널을 닫은 뒤 최신 파일을 다시 불러옵니다.

## 소유자 편집기 운영

### GitHub App

GitHub App은 private 설정을 권장합니다.

- Homepage URL: 공개 블로그 URL
- Callback URL: 실제 Worker URL의 `/auth/callback`
- Repository permission: Contents `Read and write`, Metadata `Read-only`
- 설치 범위: `Daeho-AI/Daeho-AI.github.io` 저장소만 선택
- OAuth 로그인 계정: 정확히 `Daeho-AI`

Client secret을 저장소나 `.env` 커밋에 넣지 않습니다. GitHub App ID를 추측하거나 예시 값을 실제 설정처럼 사용하지 않습니다.

### Worker 비밀값과 배포

`editor-api/README.md`를 기준 문서로 사용합니다. 기본 명령은 다음과 같습니다.

```powershell
cd editor-api
npm ci
npm run check
npm test
npx wrangler login
npx wrangler whoami
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put SESSION_ENCRYPTION_KEY
npx wrangler deploy
```

`SESSION_ENCRYPTION_KEY`는 최소 32자의 암호학적 무작위 값이어야 합니다. `wrangler secret put` 프롬프트에 직접 입력하고 PowerShell 기록이나 문서에 값을 남기지 않습니다. OAuth state와 편집 세션용 KV binding은 `wrangler.jsonc`의 `OAUTH_STATES`, `EDITOR_SESSIONS`를 사용합니다.

배포 URL을 확인한 뒤 `_data/editor.yml`을 설정합니다.

```yaml
enabled: true
api_base_url: "https://실제-worker-주소.workers.dev"
owner_login: "Daeho-AI"
repository: "Daeho-AI/Daeho-AI.github.io"
branch: "main"
```

Worker가 준비되지 않은 상태에서는 `enabled: false`, `api_base_url: ""`로 두어 작동하지 않는 로그인 버튼을 공개하지 않습니다. Worker URL을 바꾸면 GitHub App Callback URL과 CSP `connect-src` 생성 결과도 확인합니다.

### 편집기 프런트엔드 변경

`assets/js/owner-editor.bundle.js`는 생성 결과입니다. TypeScript 소스를 수정한 뒤 다음을 실행합니다.

```powershell
cd tools/owner-editor-ui
npm ci
npm run check
npm test --if-present
npm run build
```

생성 bundle과 소스를 함께 커밋합니다. `_includes/owner-editor.html`의 ID/data 속성, `_posts`, `_projects`, `about.md`, `contact.md`, `_data/profile.yml`, `_data/skills.yml` 경로를 바꿀 때는 Worker allowlist와 UI 코드를 동시에 수정해야 합니다.

## GitHub Pages 배포

기본 배포는 GitHub Pages의 branch build를 유지합니다.

1. **Settings → Pages**를 엽니다.
2. Source를 **Deploy from a branch**로 선택합니다.
3. Branch는 `main`, 폴더는 `/ (root)`를 선택합니다.
4. 변경을 `main`에 커밋하거나 병합합니다.
5. Pages와 Actions 상태가 완료된 뒤 `https://daeho-ai.github.io`를 확인합니다.

`.nojekyll`을 만들지 않습니다. `.github/workflows/validate.yml`은 검증만 담당하며 Pages 배포 방식을 대체하지 않습니다.

## 로컬 실행과 production build

GitHub Pages와 호환되는 Ruby/Jekyll 환경에서 실행합니다.

```bash
gem install github-pages --no-document
ruby scripts/validate-content.rb
JEKYLL_ENV=production jekyll build --trace
jekyll serve --livereload
```

초안까지 볼 때만 `jekyll serve --drafts`를 사용합니다. production build에는 `_drafts`, `docs`, `templates`, `scripts`, `editor-api`, `tools`가 포함되지 않아야 합니다.

Windows에서 `No source of timezone data could be found`가 나오면 IANA timezone 데이터 gem을 설치한 뒤 다시 실행합니다.

```powershell
gem install tzinfo-data --no-document
```

## 기능 토글

`_data/site.yml`의 `features`를 한 곳에서 관리합니다.

- `search`: 검색 dialog와 `/search/`
- `bookmarks`: localStorage 북마크와 `/bookmarks/`
- `recently_viewed`: 최근 본 글
- `reading_progress`: 게시글 진행률
- `table_of_contents`: 자동 목차 기본값
- `comments`: 댓글 전역 허용
- `analytics`: 분석 전역 허용
- `pwa`: service worker 등록
- `edit_on_github`: 비상용 GitHub 편집 링크
- `author_card`: 글 하단 작성자 카드
- `sidebar`: 홈/Blog 사이드바

기능을 끌 때 UI만 숨기지 말고 관련 스크립트와 외부 요청도 로드되지 않는지 확인합니다.

## Giscus 연결

Giscus는 기본 비활성입니다. 활성화 전 다음을 준비합니다.

1. 저장소에서 GitHub Discussions를 활성화합니다.
2. Giscus App을 필요한 저장소에 설치합니다.
3. 사용할 Discussions 카테고리를 만듭니다.
4. Giscus 설정 화면에서 실제 값을 확인합니다.
5. `_data/integrations.yml`의 `giscus` 필드를 채웁니다.

필수 값:

- `repo`: `owner/repository`
- `repo_id`: Giscus가 제공한 repository ID
- `category`: 실제 Discussions category 이름
- `category_id`: Giscus가 제공한 category ID
- `mapping`, `strict`, `reactions_enabled`, `input_position`, `lang`

모든 값이 확인된 뒤 `giscus.enabled: true`와 `_data/site.yml`의 `features.comments: true`를 설정합니다. 글별 `comments: false`는 전역 설정보다 우선합니다. 값이 하나라도 부족하면 댓글 제목, 빈 영역과 외부 script가 모두 없어야 합니다. 임의 ID를 만들지 않습니다.

## 분석 도구 연결

분석은 기본 비활성이며 Google Analytics 4, Umami, Plausible 중 하나만 선택합니다.

### Google Analytics 4

```yaml
analytics:
  enabled: true
  provider: "google"
  google_measurement_id: "실제 Measurement ID"
```

### Umami

```yaml
analytics:
  enabled: true
  provider: "umami"
  umami_script_url: "실제 https script URL"
  umami_website_id: "실제 website ID"
```

### Plausible

```yaml
analytics:
  enabled: true
  provider: "plausible"
  plausible_domain: "daeho-ai.github.io"
  plausible_script_url: "https://plausible.io/js/script.js"
```

그다음 `_data/site.yml`의 `features.analytics: true`를 설정합니다. 설정이 완전할 때만 provider script를 로드하고, 쿠키를 쓰는 provider는 동의 전 로드하지 않습니다. 거부 선택과 Do Not Track을 존중합니다. 비밀 API 키를 `_data`에 넣지 않습니다.

## RSS 확인

공개 주소는 `/feed.xml`입니다.

- `published: false`, `noindex: true` 글이 포함되지 않는지 확인합니다.
- title, absolute URL, 게시·수정일, description, categories/tags를 확인합니다.
- 브라우저 또는 XML parser로 문법을 검사합니다.
- 헤더/footer의 RSS 링크가 실제 feed로 연결되는지 확인합니다.

```bash
ruby -rrexml/document -e 'REXML::Document.new(File.read("_site/feed.xml"))'
```

## Sitemap과 robots 확인

- `/sitemap.xml`에는 공개 페이지, 글과 프로젝트만 포함합니다.
- `published: false`, `noindex: true`, Search, Bookmarks, Style Guide, docs/templates/drafts는 제외합니다.
- `/robots.txt`의 Sitemap 값은 절대 URL이어야 합니다.

```bash
ruby -rrexml/document -e 'REXML::Document.new(File.read("_site/sitemap.xml"))'
```

## Custom domain

Custom domain을 사용한다면:

1. DNS 공급자에서 GitHub Pages 안내에 맞는 레코드를 설정합니다.
2. **Settings → Pages → Custom domain**에 정확한 domain을 저장합니다.
3. 저장소 루트의 `CNAME`을 GitHub가 관리하는지 확인합니다.
4. `_config.yml`의 `url`을 실제 `https` 주소로 변경합니다.
5. GitHub App Homepage/Callback, Worker `BLOG_ORIGIN`, CORS와 CSP를 새 origin에 맞춥니다.
6. canonical, Open Graph, feed, sitemap과 OAuth 로그인을 다시 테스트합니다.

origin 변경은 인증 경계를 바꾸므로 단순 디자인 설정처럼 처리하지 않습니다.

## PWA와 캐시

`features.pwa` 기본값은 false입니다. manifest는 제공할 수 있지만 service worker는 true일 때만 등록합니다.

- HTML: network-first
- 정적 자산: stale-while-revalidate
- cache 이름: 버전 포함
- activate: 이전 cache 제거
- offline과 404를 구분

최신 글이 오래된 cache에 고정되면 먼저 `features.pwa: false`로 등록을 중단하고, 브라우저 DevTools의 **Application → Service Workers / Storage**에서 기존 service worker와 site data를 제거합니다. cache version 변경 없이 같은 파일을 오래 유지하지 않습니다.

일반 CSS/JS 반영 지연은 Pages 배포 완료 후 강력 새로고침으로 확인합니다. 테마·북마크·최근 기록·최근 검색어를 지우려면 해당 origin의 localStorage를 삭제합니다. 이는 다른 장치의 데이터에는 영향을 주지 않습니다.

## 댓글·분석 즉시 비활성화

외부 서비스 장애나 개인정보 정책 변경 시 먼저 `_data/site.yml`의 `features.comments` 또는 `features.analytics`를 false로 바꾸고 배포합니다. 이어서 `_data/integrations.yml`의 provider `enabled`도 false로 바꿉니다. 공개 HTML에서 해당 script, iframe, 빈 UI가 사라졌는지 확인합니다.

## 오류 확인

### Jekyll build 실패

- 오류에 표시된 YAML/Liquid 파일과 줄을 먼저 확인합니다.
- YAML tab, 들여쓰기, 콜론이 든 따옴표 없는 문자열을 확인합니다.
- `ruby scripts/validate-content.rb`를 실행합니다.
- GitHub Pages가 지원하지 않는 plugin을 추가하지 않았는지 확인합니다.

### 검색 실패

- production build의 `search.json`을 JSON parser로 검사합니다.
- 브라우저 Network에서 404/CSP 오류를 확인합니다.
- `search_exclude`, `noindex`, `published` 값을 확인합니다.
- fetch 실패 시에도 `/blog/` 전체 목록과 기본 링크가 작동해야 합니다.

### 소유자 로그인 실패

- `_data/editor.yml`의 URL과 실제 Worker URL을 비교합니다.
- GitHub App callback이 정확히 `/auth/callback`인지 확인합니다.
- App이 대상 저장소에 설치되어 있고 Contents write 권한이 있는지 확인합니다.
- `wrangler whoami`, Worker log와 KV binding을 확인합니다.
- 브라우저 콘솔의 CORS/CSP 오류를 확인하되 access token을 log로 출력하지 않습니다.

### 저장 충돌

HTTP 409는 다른 커밋이 먼저 반영된 상태입니다. 기존 파일을 강제로 덮어쓰지 말고 현재 편집 내용을 복사한 뒤 최신 파일을 다시 불러와 변경을 합칩니다.

## 백업

GitHub commit 이력이 기본 백업입니다. 추가 백업이 필요하면 읽기 전용 clone 또는 GitHub의 repository archive를 안전한 저장소에 보관합니다. Worker secret은 저장소 백업에 포함하지 말고 각 서비스의 secret 관리 기능에서 별도로 회전·복구합니다.

```bash
git clone https://github.com/Daeho-AI/Daeho-AI.github.io.git
```

정기 백업에 개인 토큰이 포함된 remote URL, `.env`, Wrangler 인증 파일을 넣지 않습니다.

## 안전한 롤백

공개 이력을 보존하는 `git revert`를 우선합니다.

```bash
git log --oneline
git revert <되돌릴-커밋-SHA>
git push origin main
```

GitHub 웹에서 해당 commit 또는 merged PR의 **Revert**를 사용할 수도 있습니다. `git reset --hard`와 강제 push는 공유 이력과 복구 가능성을 손상할 수 있으므로 운영 롤백 절차로 사용하지 않습니다. 롤백 뒤에도 Pages 배포 완료와 Worker 설정의 호환성을 확인합니다.

## 배포 후 점검

- `/`, `/blog/`, `/projects/`, `/about/`, `/contact/`
- `/archive/`, `/categories/`, `/tags/`, `/series/`
- `/search/`, `/bookmarks/`, `/privacy/`, `/404.html`
- 게시글/프로젝트 상세, search JSON, feed, sitemap, robots
- 소유자 로그인, 읽기·쓰기 권한, 저장 충돌, 로그아웃
- 360~1440px, 키보드, 라이트/다크/system, 브라우저 console 0 errors

검증이 끝나기 전에는 기능이 “운영 가능하다”고 기록하지 않습니다.
