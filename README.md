# Daeho-AI.github.io

이 저장소는 GitHub Pages가 직접 빌드하는 Jekyll 기반 개인 블로그입니다. 일반 방문자는 기존 공개 화면을 읽기만 하고, 저장소 소유자는 같은 블로그 화면에서 로그인해 글·프로젝트·프로필을 편집할 수 있습니다. 별도 `/admin/` 페이지나 Pages CMS는 사용하지 않습니다.

공개 사이트와 콘텐츠 렌더링은 GitHub Pages/Jekyll이 계속 담당합니다. GitHub 로그인, 소유자·쓰기 권한 확인, 세션 발급과 저장소 커밋은 `editor-api/`의 Cloudflare Worker가 담당하고, 브라우저에는 GitHub 액세스 토큰을 전달하지 않습니다.

## 빠른 수정 위치

| 바꾸려는 내용 | 수정할 위치 |
| --- | --- |
| 이름 및 소개 | `_data/profile.yml` |
| 이메일·GitHub·LinkedIn | `_data/profile.yml` |
| 추가 소셜 링크 | `_data/social.yml` |
| 상단 메뉴 | `_data/navigation.yml` |
| 기술 목록 | `_data/skills.yml` |
| 블로그 글 | `_posts` |
| 프로젝트 | `_projects` |
| About 내용 | `about.md` |
| Contact 내용 | `contact.md` |
| 색상과 디자인 | `assets/css/main.css` |

확인된 정보만 공개하기 위해 현재 이름은 `Daeho-AI`, GitHub 주소는 `https://github.com/Daeho-AI`로 설정되어 있습니다. 이메일, 위치, 직함, 소개, LinkedIn, 프로필 이미지와 기술 목록은 비어 있습니다.

## 소유자 편집 모드

일상적인 콘텐츠 관리는 공개 블로그 안의 소유자 편집 모드를 사용합니다.

1. `https://daeho-ai.github.io/?edit=1`을 열거나 블로그에서 `Ctrl+Shift+E`를 누릅니다.
2. 오른쪽 아래의 **소유자 로그인**을 선택해 GitHub 팝업 로그인을 완료합니다.
3. 로그인 계정이 정확히 `Daeho-AI`이고 이 저장소에 쓰기 권한이 있을 때만 편집 툴바가 열립니다.
4. 새 글, 현재 게시글·프로젝트, About, Contact, 프로필, 기술 목록을 같은 화면의 편집 패널에서 수정합니다.
5. 저장하면 Worker가 `main` 브랜치에 커밋하고 커밋 링크와 Pages 배포 대기 안내를 표시합니다.

툴바의 **이미지 업로드**는 파일을 `assets/images/uploads/YYYY/MM/`에 저장하고 Markdown에서 사용할 경로를 돌려줍니다. 편집 세션은 짧게 유지되며, 로그아웃하거나 만료되면 다시 인증해야 합니다.

### 보안 경계

- GitHub OAuth `state`와 PKCE 검증, 세션 저장, GitHub 사용자 확인과 저장소 쓰기 권한 확인은 Worker에서 수행합니다.
- 허용된 저장소, 브랜치와 파일 경로만 수정할 수 있습니다. 브라우저가 임의 경로나 다른 저장소를 요청해도 Worker가 거부합니다.
- 기존 파일 수정에는 현재 GitHub blob SHA가 필요하므로, 다른 변경과 충돌하면 덮어쓰지 않고 다시 불러오도록 안내합니다.
- CORS는 공개 블로그 origin만 허용하고, GitHub 액세스 토큰은 Worker의 세션 저장소 밖으로 노출하지 않습니다.
- 공개 페이지 CSP는 저장소의 스크립트와 설정된 Worker 연결만 허용합니다. 콘텐츠는 Markdown을 기본으로 작성하며 raw HTML의 인라인 스크립트는 실행되지 않습니다.

설치·비밀 값·GitHub App 권한·Cloudflare 배포 방법은 [`editor-api/README.md`](editor-api/README.md)에 정리되어 있습니다. 편집기 소스를 바꾼 경우에는 [`tools/owner-editor-ui`](tools/owner-editor-ui)의 빌드 명령으로 `assets/js/owner-editor.bundle.js`를 다시 생성해야 합니다.

아래의 저장소 직접 수정 방법은 Worker 장애나 긴급 복구 때 사용하는 비상 절차입니다.

## 1. 사이트 구조 설명

콘텐츠와 디자인은 다음처럼 분리되어 있습니다.

```text
_config.yml                 사이트 주소와 Jekyll 설정
_data/                      프로필, 메뉴, 기술, 소셜 링크
_posts/                     블로그 게시글
_projects/                  프로젝트 문서
_layouts/                   페이지 종류별 HTML 뼈대
_includes/                  여러 화면에서 공유하는 HTML 조각
assets/css/main.css         색상, 글꼴, 간격, 반응형 디자인
assets/js/main.js           모바일 메뉴와 테마 전환
assets/js/owner-editor.bundle.js  공개 화면 내 소유자 편집기
assets/images/              사이트에서 사용하는 이미지
editor-api/                 GitHub 인증·저장을 담당하는 Cloudflare Worker
tools/owner-editor-ui/      소유자 편집기 TypeScript 소스와 빌드 설정
templates/                  게시글과 프로젝트 작성 원본
index.html                  홈
blog.md                     블로그 목록
projects.md                 프로젝트 목록
about.md                    About 본문
contact.md                  Contact 본문
archive.md                  연도별 글 목록
404.html                    찾을 수 없는 주소 안내
```

`_data`의 YAML 값은 여러 화면에서 공유되므로 이름이나 링크를 HTML마다 반복해서 수정할 필요가 없습니다. `templates`와 `README.md`는 `_config.yml`의 `exclude`에 포함되어 공개 사이트 결과물에는 생성되지 않습니다.

## 2. 이름과 소개 수정 방법

`_data/profile.yml`을 열고 다음 값을 수정합니다.

- `name`: 문서와 메타데이터에서 사용할 이름
- `display_name`: 헤더와 프로필에 보여 줄 이름
- `headline`: 직함 또는 짧은 제목
- `short_bio`: 홈과 사이드바에 표시할 한두 문장 소개
- `bio`: 조금 더 긴 소개
- `location`: 공개할 위치. 공개하지 않으려면 `""` 유지
- `availability`: 활동 가능 여부처럼 짧게 표시할 문구

YAML에서는 콜론(`:`), `#`, 따옴표가 포함된 문장을 큰따옴표로 감싸는 것이 안전합니다. 입력하지 않을 항목은 `""`로 두면 화면에서 숨겨집니다.

## 3. 이메일과 GitHub 링크 수정 방법

`_data/profile.yml`의 다음 항목을 수정합니다.

- `email`: 공개할 이메일 주소. 빈 값이면 이메일 버튼이 표시되지 않습니다.
- `github`: 전체 GitHub URL
- `linkedin`: 전체 LinkedIn URL. 사용하지 않으면 빈 값 유지
- `profile_image`: `/assets/images/파일이름.jpg` 형식의 내부 경로

GitHub와 LinkedIn은 링크가 화면마다 달라지지 않도록 `_data/profile.yml`에서 한 번만 관리합니다. 그 밖의 공개 소셜 링크는 `_data/social.yml`의 `[]`를 삭제한 뒤 추가하고 각 항목의 `name`, `label`, `url`, `new_tab`을 설정합니다. 주소가 없는 항목은 추가하지 않거나 `url: ""`로 두세요. 이메일처럼 공개 범위를 신중히 결정해야 하는 정보는 본인이 공개하기로 한 값만 입력하세요.

## 4. 메뉴 수정 방법

`_data/navigation.yml`의 항목을 추가, 삭제하거나 순서를 바꿉니다.

- `label`: 화면에 표시할 메뉴 이름
- `url`: 이동할 내부 주소 또는 전체 외부 URL
- `new_tab`: 새 탭에서 열려면 `true`, 같은 탭이면 `false`
- `order`: 표시 순서. 작은 숫자가 먼저 표시됩니다.

내부 페이지 주소는 `/blog/`처럼 사이트 루트 기준으로 적습니다. 레이아웃에서 `relative_url` 필터를 적용하므로 사용자 사이트와 로컬 미리보기에서 모두 안전하게 연결됩니다.

## 5. 기술 목록 수정 방법

`_data/skills.yml`에는 현재 확인된 기술이 없어 `categories: []`로 되어 있습니다. 파일 안의 주석 예시를 참고해 빈 배열을 다음 구조의 목록으로 바꿉니다.

```yaml
categories:
  - name: "카테고리 이름"
    items:
      - "기술 이름"
      - "기술 이름"
```

카테고리와 기술은 필요한 만큼 추가하거나 삭제할 수 있습니다. AI / Machine Learning, Automotive Security, Cybersecurity, Vehicle Networks, LLM / RAG, Programming, Research 등은 구조를 설명하기 위한 카테고리 예시일 뿐 현재 프로필의 실제 기술로 등록되어 있지 않습니다.

## 6. 비상용: 저장소에서 새 블로그 게시글 작성

가장 안전한 방법은 `templates/post-template.md`를 복사하는 것입니다. GitHub 웹 화면에서는 다음 순서로 작성합니다.

1. 저장소에서 `_posts` 폴더를 엽니다.
2. 오른쪽 위의 **Add file**을 선택합니다.
3. **Create new file**을 선택하고 `YYYY-MM-DD-영문주소.md` 형식으로 파일 이름을 입력합니다.
4. `templates/post-template.md`의 전체 내용을 복사해 새 파일에 붙여 넣습니다.
5. `title`, `date`, `description`, `categories`, `tags`와 본문을 수정합니다. 영어 글은 `lang: en`으로 바꿉니다.
6. 공개할 준비가 됐다면 `published: true`로 바꾸고 **Commit changes**를 선택합니다.
7. GitHub Pages 자동 빌드와 배포가 끝날 때까지 기다립니다.

게시글 본문에는 일반 Markdown 제목, 목록, 표, 인용문, 링크, 이미지, 코드 블록과 인라인 코드를 사용할 수 있습니다. 사이트 기본 언어는 한국어이지만 게시글별 `lang` 값으로 영어 문서의 언어도 올바르게 지정할 수 있습니다. 템플릿 자체는 사이트 빌드에서 제외됩니다.

## 7. 게시글 파일 이름 규칙

파일 이름은 반드시 `YYYY-MM-DD-영문주소.md` 형식을 사용합니다.

- 올바른 예: `2026-07-21-first-post.md`
- 피해야 할 예: `첫 글.md`, `2026_07_21_post.md`, `post.md`

날짜 부분은 front matter의 `date`와 맞추고, 영문 주소 부분은 소문자 영문·숫자·하이픈만 사용하는 것이 안전합니다. 파일 이름의 날짜가 미래이면 GitHub Pages 설정에 따라 해당 날짜 전까지 보이지 않을 수 있습니다.

## 8. 게시글 공개 및 비공개 방법

게시글 위쪽의 front matter에서 다음 값을 사용합니다.

- `published: true`: 빌드 결과에 게시글 포함
- `published: false`: 초안으로 유지하고 사이트에서는 숨김

초안을 작성할 때는 `false`로 시작하고, 제목·날짜·본문·링크를 확인한 뒤 `true`로 바꾸세요. 단순히 목록에서만 숨기는 방식이 아니라 Jekyll 빌드 결과에서 제외되므로 초안 공개를 막는 데 더 안전합니다.

## 9. 비상용: 저장소에서 새 프로젝트 추가

1. `templates/project-template.md`의 내용을 복사합니다.
2. `_projects` 폴더에 `영문주소.md` 파일을 만듭니다. 예: `_projects/my-project.md`.
3. `title`, `summary`, `period`, `status`, `role`, `technologies`를 확인된 정보로 수정합니다.
4. 저장소나 데모가 공개되어 있다면 `repository_url`, `demo_url`에 전체 URL을 입력합니다. 없다면 빈 값으로 둡니다.
5. 홈의 주요 프로젝트에 표시하려면 `featured: true`로 설정합니다.
6. 목록 순서는 `order` 숫자로 조절합니다.
7. 공개할 준비가 끝나면 `published: true`로 바꾸고 커밋합니다.

front matter 아래에는 프로젝트 목적, 진행 내용과 검증 가능한 결과를 Markdown으로 작성합니다. 확인되지 않은 성과, 역할이나 수치는 입력하지 마세요. 주소가 빈 외부 링크는 화면에 표시되지 않습니다.

## 10. 비상용: 저장소에서 이미지 업로드

GitHub 웹 화면에서 `assets/images` 폴더를 열고 **Add file → Upload files**로 이미지를 올립니다. 파일 이름은 공백 대신 하이픈을 사용하고 영문 소문자로 작성하는 것이 좋습니다.

프로필이나 대표 이미지는 YAML/front matter에 루트 기준 경로를 입력합니다.

```yaml
profile_image: "/assets/images/profile.jpg"
thumbnail: "/assets/images/post-thumbnail.jpg"
```

Markdown 본문에서는 다음처럼 `relative_url` 필터를 사용합니다.

```liquid
![이미지 설명]({{ '/assets/images/example.jpg' | relative_url }})
```

파일 이름의 대소문자는 정확히 일치해야 합니다. 접근성을 위해 `이미지 설명`을 비워 두지 말고, 불필요하게 큰 이미지는 올리기 전에 웹용 크기로 줄이세요.

## 11. 색상 변경 방법

`assets/css/main.css` 맨 위의 CSS 사용자 정의 속성을 수정합니다. 대표적으로 다음 변수가 있습니다.

- `--color-background`: 페이지 배경
- `--color-surface`: 구분 영역 배경
- `--color-text`: 본문 글자
- `--color-muted`: 보조 글자
- `--color-primary`: 링크와 강조 색상
- `--color-border`: 테두리
- `--content-width`: 전체 콘텐츠 너비
- `--sidebar-width`: 사이드바 너비
- `--radius`: 둥근 모서리
- `--shadow`: 그림자

라이트와 다크 테마의 변수가 별도로 정의되어 있으므로 둘 다 충분한 대비가 나오는지 확인하세요. 다른 CSS 규칙의 숫자나 색상을 직접 반복 수정하기보다 상단 변수를 먼저 바꾸는 것이 유지보수에 좋습니다.

## 12. 로컬 미리보기 방법

로컬 미리보기는 선택 사항이며, 이미 생성된 편집기 번들을 포함한 사이트 배포 자체에는 Node.js나 npm이 필요하지 않습니다. 편집기 TypeScript 소스를 수정하고 번들을 다시 만들 때만 Node.js가 필요합니다.

1. Ruby와 RubyGems를 설치합니다.
2. 터미널에서 저장소 루트로 이동합니다.
3. GitHub Pages와 같은 의존성 묶음을 설치합니다: `gem install github-pages`.
4. 미리보기 서버를 실행합니다: `jekyll serve --livereload`.
5. 브라우저에서 `http://127.0.0.1:4000`을 엽니다.

종료하려면 터미널에서 `Ctrl+C`를 누릅니다. Windows에서 native gem 설치 오류가 나면 RubyInstaller의 MSYS2 개발 도구가 설치되어 있는지 확인하세요. 로컬 설치가 어렵다면 작은 변경을 초안 브랜치에서 먼저 확인한 뒤 GitHub Pages에 반영할 수 있습니다.

## 13. GitHub Pages 배포 방식

이 사이트는 별도 GitHub Actions 워크플로 없이 GitHub Pages의 Jekyll 빌드를 사용합니다.

1. GitHub 저장소의 **Settings → Pages**를 엽니다.
2. **Build and deployment**의 Source를 **Deploy from a branch**로 선택합니다.
3. Branch는 `main`, 폴더는 `/ (root)`를 선택하고 저장합니다.
4. 변경 사항을 `main`에 커밋하거나 병합합니다.
5. Pages 화면의 배포 상태가 완료될 때까지 기다린 뒤 `https://daeho-ai.github.io`를 엽니다.

사용자 사이트이므로 `_config.yml`의 `url`은 `https://daeho-ai.github.io`, `baseurl`은 빈 문자열입니다. `.nojekyll`을 만들거나 임의의 Pages 배포 워크플로를 추가하지 마세요. 저장소가 공개되어야 하는지는 GitHub 요금제와 Pages 정책에 따라 달라질 수 있으므로 현재 저장소의 Pages 화면 안내를 따릅니다.

## 14. 자주 발생하는 오류 해결 방법

- **빌드가 실패함:** 최근 수정한 YAML의 들여쓰기가 공백 두 칸 단위인지 확인합니다. 탭은 사용하지 마세요. 값에 콜론이 있으면 따옴표로 감쌉니다.
- **게시글이 보이지 않음:** 파일 이름이 `YYYY-MM-DD-영문주소.md`인지, 날짜가 미래가 아닌지, `published: true`인지 확인합니다.
- **프로젝트가 보이지 않음:** 파일이 `_projects` 바로 아래에 있는지, front matter가 `---`로 시작하고 끝나는지, `published: true`인지 확인합니다.
- **이미지가 보이지 않음:** 실제 파일 경로와 대소문자가 일치하는지, 내부 경로에 `relative_url`을 사용했는지 확인합니다.
- **링크가 잘못 열림:** 내부 링크는 `/경로/`, 외부 링크는 `https://`로 시작하는 전체 주소를 사용합니다. 빈 URL을 따옴표 사이에 공백 없이 `""`로 둡니다.
- **디자인 변경이 반영되지 않음:** Pages 배포 완료 후 강력 새로고침을 하거나 브라우저 캐시를 지웁니다.
- **로컬에서는 되지만 Pages에서 실패함:** `_config.yml`에 GitHub Pages가 지원하지 않는 플러그인이 추가되지 않았는지 확인합니다.
- **404가 발생함:** Pages 소스가 `main`의 `/ (root)`인지 확인하고, 메뉴 주소 끝의 슬래시와 실제 페이지 permalink를 비교합니다.
- **YAML 해석 오류가 남:** front matter의 시작과 끝에 각각 `---` 한 줄이 있는지 확인하고 온라인 YAML 검사기 또는 로컬 빌드 메시지의 파일/줄 번호를 확인합니다.
- **배포가 오래 걸림:** 저장소의 **Actions** 탭 또는 **Settings → Pages**에서 빌드 상태를 확인합니다. 같은 변경을 연속 커밋하기보다 진행 중인 빌드가 끝날 때까지 기다립니다.

## 편집 후 확인 목록

- 이메일, 위치, 소개처럼 비워 둔 개인정보가 의도대로 공개되었는지 확인합니다.
- 홈, 블로그, 프로젝트, About, Contact와 Archive 페이지를 직접 열어 봅니다.
- 게시글과 프로젝트가 없을 때 빈 상태 문구가 정상적으로 보이는지 확인합니다.
- 390px 안팎 모바일 화면에서 메뉴, 표와 코드 블록 때문에 페이지 전체 가로 스크롤이 생기지 않는지 확인합니다.
- 라이트/다크 모드에서 본문, 링크, 테두리와 코드의 대비를 확인합니다.
- 키보드의 Tab 키로 메뉴, 링크와 테마 전환 버튼을 사용할 수 있는지 확인합니다.
