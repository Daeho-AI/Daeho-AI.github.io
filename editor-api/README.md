# Daeho owner editor API

이 디렉터리는 공개 Jekyll 블로그의 소유자 편집 모드에만 사용하는 Cloudflare Worker입니다. GitHub App OAuth 로그인과 저장소 쓰기를 서버에서 처리하며, GitHub 사용자 액세스 토큰은 브라우저에 전달하지 않습니다.

## 보안 구조

- OAuth 로그인은 무작위 `state`와 PKCE S256을 함께 검증합니다.
- 로그인 상태와 편집 세션은 서로 다른 Workers KV binding에 짧게 저장합니다.
- KV 값은 `SESSION_ENCRYPTION_KEY`로 AES-GCM 암호화하고, 브라우저에는 무작위 opaque 세션 ID만 보냅니다.
- 모든 API 요청은 정확한 `https://daeho-ai.github.io` Origin과 bearer 세션을 요구합니다.
- 로그인 때와 모든 인증 API 요청 때 GitHub `/user`와 저장소 권한을 다시 확인합니다.
- 계정은 `Daeho-AI`, 저장소는 `Daeho-AI/Daeho-AI.github.io`, 브랜치는 `main`으로 코드와 설정 양쪽에서 고정합니다.
- 기존 파일은 최신 blob SHA가 일치할 때만 갱신합니다. 충돌 시 기존 파일을 덮어쓰지 않습니다.
- 콘텐츠와 업로드 경로, 문서 크기, YAML/front matter, 이미지 MIME과 magic bytes를 Worker에서 검증합니다.

## API

| Method | Path | 설명 |
| --- | --- | --- |
| `GET` | `/health` | 비밀 값을 노출하지 않는 설정 상태 확인 |
| `GET` | `/auth/start?origin=…` | GitHub OAuth 팝업 시작 |
| `GET` | `/auth/callback` | OAuth state/PKCE 교환 후 opener에 세션 전달 |
| `GET` | `/api/session` | 세션·소유자·쓰기 권한 재확인 |
| `DELETE` | `/api/session` | 편집 세션 폐기 |
| `GET` | `/api/content?path=…` | 허용된 UTF-8 파일과 SHA 읽기 |
| `GET` | `/api/list?kind=posts\|projects` | 게시글 또는 프로젝트 파일 목록 |
| `PUT` | `/api/content` | Markdown/YAML 생성 또는 SHA 기반 수정 |
| `POST` | `/api/media` | 검증된 이미지를 월별 uploads 경로에 생성 |

허용되는 텍스트 파일은 `_posts/*.md`, `_projects/*.md`, `_data/profile.yml`, `_data/skills.yml`, `_data/navigation.yml`, `_data/social.yml`, `about.md`, `contact.md`입니다. 이미지는 Worker가 만든 `assets/images/uploads/YYYY/MM/` 경로에만 저장됩니다.

## 1. GitHub App 만들기

GitHub의 **Settings → Developer settings → GitHub Apps → New GitHub App**에서 비공개 App을 만듭니다.

- GitHub App name: 계정 안에서 고유한 이름, 예: `Daeho Blog Owner Editor`
- Homepage URL: `https://daeho-ai.github.io`
- Callback URL: `https://daeho-owner-editor-api.<workers.dev-subdomain>.workers.dev/auth/callback`
- Webhook: 비활성화
- Repository permissions → Contents: **Read and write**
- Repository permissions → Metadata: **Read-only**
- 이벤트 구독: 없음
- 설치 범위: **Only on this account**

App을 만든 뒤 `Daeho-AI` 계정에 설치하고 **Only select repositories**에서 `Daeho-AI.github.io` 하나만 선택합니다. App 설정 화면의 Client ID를 기록하고 Client secret을 새로 생성합니다. private key는 이 Worker 흐름에 필요하지 않습니다.

Callback URL의 `<workers.dev-subdomain>`은 Cloudflare 계정의 Workers & Pages 화면이나 `npx wrangler whoami` 출력에서 확인합니다. 실제 배포 URL이 예상과 다르면 App의 Callback URL을 실제 `/auth/callback` 주소로 고칩니다.

## 2. Cloudflare 배포

Node.js 20 이상에서 다음을 실행합니다.

```powershell
npm ci
npx wrangler login
npx wrangler whoami
```

루트의 `wrangler.jsonc`는 첫 배포 때 `OAUTH_STATES`와 `EDITOR_SESSIONS` KV를 자동 생성하도록 ID를 비워 두었습니다. 다음 세 비밀 값은 Git에 커밋하지 않습니다.

```text
GITHUB_CLIENT_ID="GitHub App Client ID"
GITHUB_CLIENT_SECRET="GitHub App Client secret"
SESSION_ENCRYPTION_KEY="최소 32자의 암호학적 무작위 값"
```

무작위 세션 암호화 키는 로컬에서 다음처럼 만들 수 있습니다.

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

세 값을 Git에서 무시되는 `.env.production.local`에 넣고, 첫 배포에서 함께 업로드합니다.

```powershell
npx wrangler deploy --secrets-file .env.production.local
```

Wrangler가 출력한 `https://…workers.dev` URL의 `/health`가 `{"ok":true}`를 반환하는지 확인합니다. 자동 생성된 KV ID가 `wrangler.jsonc`에 기록되면 그 변경은 커밋해 이후 배포가 같은 namespace를 사용하도록 합니다.

Cloudflare Dashboard에서 비밀 값을 넣는 경우에는 Worker의 **Settings → Variables and Secrets**에서 같은 세 이름을 encrypted secret으로 등록한 뒤 배포해도 됩니다.

## 3. 블로그와 연결

배포 URL을 저장소의 `_data/editor.yml`에 넣고 편집기를 활성화합니다.

```yaml
enabled: true
api_base_url: "https://daeho-owner-editor-api.<workers.dev-subdomain>.workers.dev"
owner_login: "Daeho-AI"
repository: "Daeho-AI/Daeho-AI.github.io"
branch: "main"
```

GitHub Pages 배포가 끝난 뒤 `https://daeho-ai.github.io/?edit=1`에서 로그인 버튼과 팝업 흐름을 확인합니다. 일반 URL에는 소유자 UI가 표시되지 않아야 합니다.

## 4. 배포 전 Rate Limiting 운영 조치

`/auth/start`는 로그인 전에도 OAuth state를 KV에 기록하므로 CORS나 `origin` query만으로 요청 남용을 막을 수 없습니다. 현재 저장소는 임시 메모리 카운터를 넣지 않습니다. Worker isolate마다 값이 달라지고 재시작 때 사라져 실제 보호처럼 보이기만 하기 때문입니다. 프로덕션 운영자는 [Cloudflare Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)을 배포 전에 연결해야 합니다.

1. Wrangler를 Rate Limiting API가 지원되는 `4.36.0` 이상으로 올리고 lockfile을 갱신합니다.
2. Cloudflare 계정 안에서 겹치지 않는 양의 정수 namespace ID 두 개를 정합니다. 아래 `1001`, `1002`는 예시이므로 그대로 재사용하지 않습니다.
3. `wrangler.jsonc`에 다음 binding을 추가합니다.

```jsonc
"ratelimits": [
  {
    "name": "AUTH_RATE_LIMITER",
    "namespace_id": "1001",
    "simple": { "limit": 10, "period": 60 }
  },
  {
    "name": "API_RATE_LIMITER",
    "namespace_id": "1002",
    "simple": { "limit": 120, "period": 60 }
  }
]
```

4. `Env`에 두 `RateLimit` binding을 선언합니다. `/auth/start`에서는 OAuth state를 만들기 전에 `AUTH_RATE_LIMITER.limit()`을 호출하고, `/api/*`에서는 KV 조회나 GitHub API 호출 전에 `API_RATE_LIMITER.limit()`을 호출합니다. 한 IP를 여러 사용자가 공유할 수 있으므로 임계값은 실제 로그를 보며 조정하되, 이 블로그는 소유자 한 명만 로그인하므로 초기 키는 `CF-Connecting-IP`와 route 종류를 조합할 수 있습니다. bearer나 GitHub token 원문은 key 또는 로그에 남기지 않습니다.
5. 거부 시 `429`와 `Retry-After`를 반환하는 단위 테스트를 추가하고 `npm run check`, `npm test`, `npx wrangler deploy` 순서로 배포합니다.
6. Workers Logs에서 `/auth/start`와 `/api/*`의 `429`를 확인하고, 정상 소유자 로그인이 막히거나 여러 Cloudflare location에서 공격이 분산되면 계정의 WAF Rate Limiting rule도 함께 적용합니다.

이 binding과 호출 코드를 실제 Cloudflare 계정 값으로 연결하기 전까지는 **애플리케이션 수준 rate limit이 적용된 것으로 간주하지 않습니다.** Origin 검증은 브라우저의 교차 출처 읽기를 막는 장치이지, 비브라우저 요청의 사용량 제한이 아닙니다.

## 개발과 테스트

```powershell
npm run check
npm test
npm run dev
```

Worker는 의도적으로 `https://daeho-ai.github.io` Origin에 고정되어 있으므로 localhost에서 연 Jekyll 페이지와 로컬 Worker 사이의 브라우저 통합 호출은 거부됩니다. 로컬에서는 단위 테스트와 `wrangler dev`로 Worker를 검증하고, 편집 UI는 임시 Jekyll 빌드에서 시각적으로 검증합니다. OAuth부터 저장까지의 전체 흐름은 배포된 Worker와 실제 공개 사이트에서만 확인하세요. 로컬 테스트를 위해 `BLOG_ORIGIN`이나 코드의 고정 계정·저장소 값을 완화하지 마세요.

## 운영

- `GITHUB_CLIENT_SECRET`이나 `SESSION_ENCRYPTION_KEY`를 교체하면 기존 OAuth/편집 세션은 즉시 사용할 수 없게 됩니다.
- GitHub App 설치 저장소와 Contents 권한을 주기적으로 확인합니다.
- Worker의 `BLOG_ORIGIN`, `OWNER_LOGIN`, `REPOSITORY`, `BRANCH`를 넓히지 않습니다.
- 문제가 생기면 `_data/editor.yml`의 `enabled`를 `false`로 바꾸면 공개 블로그는 그대로 유지하면서 편집 진입만 끌 수 있습니다.
- Pages CMS, `/admin/`, 외부 관리자 리다이렉트는 이 구조에 포함되지 않습니다.
