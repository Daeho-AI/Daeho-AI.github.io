# 글 작성 가이드

이 사이트의 실제 콘텐츠는 `_posts`, `_projects`와 Markdown 페이지에 저장됩니다. 공개 화면의 소유자 편집 모드는 같은 파일을 GitHub API로 커밋하는 편의 기능이며, 콘텐츠 형식 자체는 표준 Jekyll front matter와 Markdown입니다.

## 새 글을 만드는 세 가지 방법

### 1. 공개 화면의 소유자 편집 모드

1. `https://daeho-ai.github.io/?edit=1`을 열거나 `Ctrl+Shift+E`를 누릅니다.
2. **소유자 로그인**을 선택하고 `Daeho-AI` GitHub 계정으로 인증합니다.
3. **새 글 작성**에서 제목, 날짜, 영문 주소, 설명, 분류와 본문을 입력합니다.
4. 저장 결과의 커밋 링크를 확인하고 GitHub Pages 배포를 기다립니다.

현재 글의 모든 고급 front matter를 세밀하게 조정해야 한다면 **현재 게시글 수정**의 원문 편집 또는 아래 템플릿 방식을 사용합니다. 소유자 편집기는 GitHub 토큰을 브라우저에 저장하지 않으며, Worker가 계정과 저장소 쓰기 권한을 다시 검사합니다.

### 2. 로컬 또는 Git 클라이언트

1. `templates/post-template.md`를 `_posts/YYYY-MM-DD-영문-슬러그.md`로 복사합니다.
2. 템플릿 주석을 읽고 예시 값을 모두 실제 내용으로 바꿉니다.
3. 로컬 preview와 콘텐츠 검증을 실행합니다.
4. 준비가 끝나면 `published: true`로 바꾸고 커밋합니다.

### 3. GitHub 웹 화면 비상 절차

1. 저장소의 `_posts` 폴더를 엽니다.
2. **Add file → Create new file**을 선택합니다.
3. `YYYY-MM-DD-영문-슬러그.md`를 입력합니다.
4. `templates/post-template.md`의 전체 내용을 복사합니다.
5. front matter와 본문을 수정하고 **Preview**에서 Markdown을 확인합니다.
6. **Commit changes**로 저장하고 Pages 배포 상태를 확인합니다.

평상시에는 블로그 안의 소유자 편집 모드를 사용하고, GitHub 웹 편집은 Worker 장애나 복구 때 사용합니다.

## 파일명과 주소

게시글 파일명은 다음 규칙을 사용합니다.

```text
_posts/YYYY-MM-DD-lowercase-slug.md
```

- 날짜와 front matter의 `date`를 맞춥니다.
- slug는 소문자 영문, 숫자와 하이픈만 사용합니다.
- 같은 날짜에 같은 slug를 두 번 만들지 않습니다.
- 예약 날짜의 글은 `_config.yml`의 `future: false` 때문에 해당 시각 전에는 공개 빌드에 나타나지 않을 수 있습니다.

프로젝트 파일명은 `_projects/lowercase-slug.md`입니다. 일반 페이지는 저장소 루트의 Markdown 파일과 `permalink`로 관리합니다.

## 게시글 front matter

전체 원본은 `templates/post-template.md`에 있습니다.

| 필드 | 용도 | 작성 규칙 |
| --- | --- | --- |
| `layout` | 게시글 레이아웃 | `post` 유지 |
| `lang` | 문서 언어 | `ko`, `en`처럼 BCP 47 언어 코드 사용 |
| `title` | 카드·상세·검색·SEO 제목 | 구체적으로 작성, 템플릿 문구 제거 |
| `subtitle` | 상세 제목 아래 선택 부제목 | 없으면 `""` |
| `description` | 카드·검색·SEO 설명 | 약 80~160자, 본문과 일치 |
| `date` | 게시일 | 시간대 포함 권장 |
| `last_modified_at` | 의미 있는 최종 수정일 | 단순 오탈자 수정은 선택 |
| `author` | 작성자 식별자 | 기본값 `Daeho-AI`, 임의 인물 생성 금지 |
| `categories` | 큰 주제 분류 | 1~2개 권장, YAML 배열 |
| `tags` | 세부 키워드 | 기존 표기 재사용, YAML 배열 |
| `series` | 연속 글 묶음 | 없으면 빈 문자열 |
| `series_order` | 시리즈 순서 | 시리즈가 있을 때 양의 정수 |
| `cover` | 카드·상단 이미지 | 내부 루트 경로 또는 검증된 https URL |
| `cover_alt` | 대표 이미지 대체 텍스트 | cover가 있으면 필수 |
| `featured` | 홈 추천 후보 | 실제 추천 글만 `true` |
| `pinned` | Blog 상단 고정 후보 | 필요한 글만 `true` |
| `toc` | h2/h3 목차 | 글별 설정, 사이트 기능 토글도 켜져야 함 |
| `comments` | Giscus 허용 | 전역 설정이 완성되어야 실제 표시 |
| `math` | 수식 자산 로드 | 수식이 있는 글만 `true` |
| `mermaid` | Mermaid 자산 로드 | 다이어그램이 있는 글만 `true` |
| `published` | 공개 빌드 포함 | 초안 `false`, 공개 `true` |
| `noindex` | 검색엔진 색인 제외 | 민감하지 않지만 색인 불필요한 문서에 사용 |
| `search_exclude` | 내부 검색 제외 | 검색 결과에 부적합한 글만 `true` |
| `canonical_url` | 외부 원문 주소 | 다른 원문이 있을 때만 전체 https URL |

이전 글에서 `thumbnail`과 `thumbnail_alt`를 사용했다면 레이아웃은 호환 fallback으로 읽을 수 있습니다. 새 글은 `cover`, `cover_alt`를 사용합니다.

## 제목과 설명 쓰기

- 제목은 글이 해결하거나 설명하는 대상을 드러냅니다.
- 설명은 첫 문장을 그대로 자르기보다 독자가 얻게 될 내용을 독립 문장으로 씁니다.
- “최고”, “완벽”, “혁신적”처럼 검증되지 않은 표현과 가짜 수치를 쓰지 않습니다.
- 제목은 본문의 h1으로 자동 출력되므로 본문은 h2(`##`)부터 시작합니다.
- `<!--more-->`를 넣으면 그 앞부분을 excerpt 경계로 사용할 수 있습니다.

## 카테고리, 태그와 시리즈

- 카테고리는 넓은 주제이며 가능한 한 기존 카테고리를 재사용합니다.
- 태그는 기술, 도구 또는 세부 주제입니다. 대소문자와 띄어쓰기를 통일합니다.
- 시리즈 이름은 모든 편에서 완전히 같아야 합니다.
- `series_order`는 1부터 시작하고 한 시리즈 안에서 중복하지 않습니다.
- 분류가 없으면 빈 배열 `[]` 또는 빈 문자열을 사용하며 임의의 “기타”를 만들 필요는 없습니다.

## 대표 이미지와 본문 이미지

소유자 편집기의 **이미지 업로드**는 `assets/images/uploads/YYYY/MM/`에 저장하고 Markdown 경로를 제공합니다. 직접 올릴 때도 소문자 영문·숫자·하이픈 파일명을 권장합니다.

```markdown
![대체 텍스트]({{ '/assets/images/uploads/2026/07/example.webp' | relative_url }})
```

- alt는 “이미지”가 아니라 내용과 목적을 설명합니다.
- 장식 이미지는 빈 alt를 사용할 수 있지만, 정보성 이미지는 비우지 않습니다.
- 사진·스크린샷은 WebP/AVIF를 고려하고 표시 크기보다 지나치게 큰 원본을 피합니다.
- GIF는 자동 재생과 파일 크기를 고려합니다.
- SVG는 스크립트·외부 참조 위험 때문에 소유자 업로드 API에서 허용하지 않습니다.
- 출처가 필요하면 이미지 다음에 명확한 캡션과 링크를 적습니다.

## 링크

내부 링크는 Jekyll의 `relative_url`을 적용하면 로컬 preview와 Pages 모두에서 안전합니다.

```liquid
[블로그 목록]({{ '/blog/' | relative_url }})
```

외부 링크는 전체 `https` URL을 쓰고, 내용과 관계없는 추적 파라미터를 붙이지 않습니다. raw HTML로 새 창 링크를 만들 때는 `rel="noopener noreferrer"`를 함께 사용합니다.

## 코드

언어 이름을 지정한 fenced code block을 사용합니다.

````markdown
```ruby
puts "코드 예시"
```
````

비밀키, 토큰, 실제 고객 데이터와 개인 식별 정보를 예시에 넣지 않습니다. 파일명이나 설명이 필요하면 코드 블록 바로 앞의 문장으로 제공합니다. 코드 복사 버튼은 렌더링된 코드 텍스트만 복사합니다.

## 표

```markdown
| 항목 | 설명 |
| --- | --- |
| 예시 | 실제 내용으로 교체 |
```

첫 행을 헤더로 쓰고, 표만으로 의미를 전달하기 어려우면 앞 문장에서 요약합니다. 복잡한 표는 모바일에서 가로 스크롤되므로 열 수를 최소화합니다. HTML 표가 필요하면 `<caption>`을 사용합니다.

## Callout

다음 다섯 레이블을 지원합니다.

```markdown
> [!NOTE]
> 보충 설명

> [!TIP]
> 도움이 되는 방법

> [!IMPORTANT]
> 반드시 알아야 할 내용

> [!WARNING]
> 주의가 필요한 내용

> [!CAUTION]
> 손상이나 위험을 막기 위한 경고
```

색상만으로 의미를 전달하지 않도록 레이블을 그대로 유지합니다.

## 각주와 인용

Kramdown 각주는 다음 형식입니다.

```markdown
근거가 필요한 문장입니다.[^source]

[^source]: 출처 설명과 전체 URL
```

긴 인용은 필요한 범위만 사용하고 출처 링크를 함께 제공합니다. 저작권이 있는 글을 장문으로 복제하지 않습니다.

## 수식

수식이 있는 글에서만 `math: true`를 설정합니다.

```text
인라인 수식: $a^2 + b^2 = c^2$

블록 수식:
$$
E = mc^2
$$
```

수식 렌더러가 실패해도 원문을 이해할 수 있도록 주변 문장으로 의미를 설명합니다.

## Mermaid

다이어그램이 있는 글에서만 `mermaid: true`를 설정합니다.

````markdown
```mermaid
flowchart LR
  A[입력] --> B[처리]
  B --> C[출력]
```
````

노드 텍스트만으로 흐름을 이해할 수 있게 하고, 복잡한 다이어그램은 작은 화면에서도 읽을 수 있는지 확인합니다.

## 초안, 공개와 예약

- `_drafts`는 로컬에서 `jekyll serve --drafts`를 사용할 때만 보입니다.
- `_posts` 안에서도 `published: false`면 공개 빌드에서 제외됩니다.
- 미래 날짜는 `_config.yml`의 `future: false`에 따라 예약 시각 전까지 숨겨질 수 있습니다.
- 초안 예시는 `_drafts/example-post.md`에만 두며 실제 글로 오인할 콘텐츠를 `_posts`에 만들지 않습니다.

## 수정일과 SEO

내용, 코드나 결론을 의미 있게 바꿨다면 `last_modified_at`을 갱신합니다. 단순 맞춤법 수정만으로 매번 바꿀 필요는 없습니다. `description`과 `cover`는 검색 결과와 공유 카드에도 쓰이므로 공개 전 실제 URL에서 확인합니다. `canonical_url`은 동일 콘텐츠의 권위 있는 원문이 다른 주소에 있을 때만 입력합니다.

## 미리보기와 검증

```bash
ruby scripts/validate-content.rb
JEKYLL_ENV=production jekyll build
jekyll serve --drafts --livereload
```

다음 화면을 확인합니다.

- 홈 추천/최근 글과 이미지 없는 카드
- Blog 검색·필터·정렬·페이지 상태
- 글 상세 목차·코드 복사·표·이미지 확대·공유·북마크
- Categories, Tags, Series, Archive, Search
- 360/390/430px 모바일과 라이트/다크/system 테마

마지막으로 `docs/PUBLISHING_CHECKLIST.md`를 완료합니다.
