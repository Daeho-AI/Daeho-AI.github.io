import { ApiError, getCommitDetails } from "./api";
import type { CommitResponse, EditorApi } from "./api";
import {
  createNewPostDocument,
  parseFrontMatterDocument,
  validateYamlDocument,
} from "./frontmatter";
import type { NewPostValues } from "./frontmatter";
import { copyText, mediaMarkdown, prepareMediaUpload } from "./media";
import type { EditorAction, FieldDefinition, OwnerEditorUI } from "./ui";

export interface EditorConfig {
  repository: string;
  branch: string;
  pageKind: string;
  pagePath: string;
  pageTitle: string;
}

type EditableAction = Exclude<EditorAction, "logout">;
type RawFormat = "frontmatter" | "yaml";

interface EditState {
  action: EditableAction;
  path?: string;
  sha?: string;
  format?: RawFormat;
  message?: string;
}

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function localIsoDate(): string {
  const now = new Date();
  const year = String(now.getFullYear()).padStart(4, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeRepositoryPath(path: string): string {
  const normalized = path.trim().replace(/^\/+/, "");
  if (
    !normalized ||
    normalized.includes("\\") ||
    normalized.includes("\0") ||
    normalized.includes("?") ||
    normalized.includes("#") ||
    normalized.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error("편집할 저장소 경로가 올바르지 않습니다.");
  }
  return normalized;
}

function rawField(label: string, content: string, hint: string): FieldDefinition[] {
  return [
    {
      name: "content",
      label,
      type: "textarea",
      value: content,
      required: true,
      rows: 30,
      hint,
      code: true,
      spellcheck: false,
    },
  ];
}

function newPostFields(): FieldDefinition[] {
  return [
    { name: "title", label: "제목", type: "text", required: true, autocomplete: "off" },
    { name: "date", label: "작성일", type: "date", value: localIsoDate(), required: true },
    {
      name: "slug",
      label: "영문 주소",
      type: "text",
      required: true,
      placeholder: "my-first-post",
      hint: "소문자 영문, 숫자, 하이픈을 사용합니다.",
      autocomplete: "off",
    },
    {
      name: "description",
      label: "요약",
      type: "textarea",
      rows: 3,
      hint: "목록과 검색 결과에 표시할 짧은 설명입니다.",
    },
    {
      name: "categories",
      label: "카테고리",
      type: "text",
      placeholder: "Research, Notes",
      hint: "쉼표 또는 줄바꿈으로 구분합니다.",
    },
    {
      name: "tags",
      label: "태그",
      type: "text",
      placeholder: "AI, Security",
      hint: "쉼표 또는 줄바꿈으로 구분합니다.",
    },
    {
      name: "published",
      label: "바로 공개하기",
      type: "checkbox",
      checked: true,
      hint: "선택을 해제하면 published: false 초안으로 저장되어 공개 페이지에서는 다시 열 수 없습니다.",
    },
    {
      name: "body",
      label: "본문 (Markdown)",
      type: "textarea",
      rows: 22,
      required: true,
      spellcheck: true,
    },
  ];
}

function uploadFields(): FieldDefinition[] {
  return [
    {
      name: "file",
      label: "이미지 파일",
      type: "file",
      required: true,
      accept: "image/png,image/jpeg,image/gif,image/webp,image/avif",
      hint: "10MB 이하 이미지를 선택하세요. 파일 이름은 안전한 영문 경로로 정리됩니다.",
    },
    {
      name: "alt",
      label: "대체 텍스트",
      type: "text",
      required: true,
      placeholder: "이미지의 내용과 목적을 설명하세요",
    },
  ];
}

function safeCommitUrl(url: string, repository: string, sha: string): string {
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:") return parsed.toString();
    } catch {
      // Use the repository-based fallback below.
    }
  }

  if (sha && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    return `https://github.com/${repository}/commit/${encodeURIComponent(sha)}`;
  }
  return "";
}

function friendlyApiError(error: ApiError): string {
  if (error.status === 403) return "이 저장소를 편집할 권한이 없습니다. 소유자 계정을 확인하세요.";
  if (error.status === 409) {
    return "다른 변경과 충돌했습니다. 현재 내용을 복사한 뒤 패널을 닫고 최신 파일을 다시 불러오세요.";
  }
  return error.message;
}

export class EditorController {
  private readonly api: EditorApi;
  private readonly ui: OwnerEditorUI;
  private readonly config: EditorConfig;
  private readonly onSessionExpired: () => void;
  private state: EditState | null = null;
  private opening = false;

  constructor(
    api: EditorApi,
    ui: OwnerEditorUI,
    config: EditorConfig,
    onSessionExpired: () => void,
  ) {
    this.api = api;
    this.ui = ui;
    this.config = config;
    this.onSessionExpired = onSessionExpired;
  }

  async open(action: EditableAction): Promise<void> {
    if (this.opening) return;
    this.opening = true;
    this.state = null;

    try {
      if (action === "new-post") {
        this.state = { action };
        this.ui.openPanel("새 게시글", newPostFields(), "게시글 저장");
        return;
      }

      if (action === "upload-image") {
        this.state = { action };
        this.ui.openPanel("이미지 업로드", uploadFields(), "이미지 업로드");
        return;
      }

      const target = this.targetForAction(action);
      this.ui.setStatus(`${target.title} 파일을 불러오고 있습니다.`, "info");
      const response = await this.api.getContent(target.path);
      if (typeof response.content !== "string") {
        throw new Error("편집 API가 파일 내용을 반환하지 않았습니다.");
      }

      this.state = {
        action,
        path: target.path,
        sha: response.sha,
        format: target.format,
        message: target.message,
      };
      this.ui.openPanel(target.title, rawField(target.label, response.content, target.hint), "변경 저장");
      this.ui.setStatus(`${target.path} 파일을 편집하고 있습니다.`, "info");
    } catch (error) {
      this.handleError(error);
    } finally {
      this.opening = false;
    }
  }

  async submit(formData: FormData): Promise<void> {
    if (!this.state) return;
    this.ui.setBusy(true);

    try {
      if (this.state.action === "new-post") {
        await this.saveNewPost(formData);
      } else if (this.state.action === "upload-image") {
        await this.uploadImage(formData);
      } else {
        await this.saveRawContent(formData, this.state);
      }
    } catch (error) {
      this.handleError(error);
    } finally {
      this.ui.setBusy(false);
    }
  }

  private targetForAction(action: EditableAction): {
    path: string;
    title: string;
    label: string;
    hint: string;
    format: RawFormat;
    message: string;
  } {
    if (action === "edit-current-post") {
      if (this.config.pageKind !== "post" || !this.config.pagePath) {
        throw new Error("현재 화면은 게시글 상세 페이지가 아닙니다.");
      }
      return {
        path: normalizeRepositoryPath(this.config.pagePath),
        title: this.config.pageTitle ? `게시글 편집: ${this.config.pageTitle}` : "현재 게시글 편집",
        label: "게시글 전체 Markdown",
        hint: "YAML front matter와 본문을 함께 편집합니다.",
        format: "frontmatter",
        message: `content: update post ${this.config.pageTitle || this.config.pagePath}`,
      };
    }

    if (action === "edit-current-project") {
      if (this.config.pageKind !== "project" || !this.config.pagePath) {
        throw new Error("현재 화면은 프로젝트 상세 페이지가 아닙니다.");
      }
      return {
        path: normalizeRepositoryPath(this.config.pagePath),
        title: this.config.pageTitle ? `프로젝트 편집: ${this.config.pageTitle}` : "현재 프로젝트 편집",
        label: "프로젝트 전체 Markdown",
        hint: "YAML front matter와 본문을 함께 편집합니다.",
        format: "frontmatter",
        message: `content: update project ${this.config.pageTitle || this.config.pagePath}`,
      };
    }

    const fixedTargets: Partial<
      Record<
        EditableAction,
        {
          path: string;
          title: string;
          label: string;
          hint: string;
          format: RawFormat;
          message: string;
        }
      >
    > = {
      "edit-about": {
        path: "about.md",
        title: "About 편집",
        label: "about.md 전체 Markdown",
        hint: "front matter 구분선과 본문을 함께 유지하세요.",
        format: "frontmatter",
        message: "content: update About page",
      },
      "edit-contact": {
        path: "contact.md",
        title: "Contact 편집",
        label: "contact.md 전체 Markdown",
        hint: "front matter 구분선과 본문을 함께 유지하세요.",
        format: "frontmatter",
        message: "content: update Contact page",
      },
      "edit-profile": {
        path: "_data/profile.yml",
        title: "프로필 데이터 편집",
        label: "profile.yml YAML",
        hint: "개인정보 공개 범위를 확인하고 YAML 들여쓰기를 유지하세요.",
        format: "yaml",
        message: "content: update profile data",
      },
      "edit-skills": {
        path: "_data/skills.yml",
        title: "기술 목록 편집",
        label: "skills.yml YAML",
        hint: "categories와 items의 YAML 들여쓰기를 유지하세요.",
        format: "yaml",
        message: "content: update skills data",
      },
    };

    const target = fixedTargets[action];
    if (!target) throw new Error("지원하지 않는 편집 작업입니다.");
    return { ...target, path: normalizeRepositoryPath(target.path) };
  }

  private async saveNewPost(formData: FormData): Promise<void> {
    const values: NewPostValues = {
      title: formString(formData, "title"),
      date: formString(formData, "date"),
      slug: formString(formData, "slug"),
      description: formString(formData, "description"),
      categories: formString(formData, "categories"),
      tags: formString(formData, "tags"),
      published: formData.has("published"),
      body: formString(formData, "body"),
    };
    const document = createNewPostDocument(values);
    const result = await this.api.putContent({
      path: document.path,
      content: document.content,
      message: `content: add post ${document.title}`,
    });
    this.finishSave(result, "저장 완료 · 게시글을 저장했습니다.");
  }

  private async saveRawContent(formData: FormData, state: EditState): Promise<void> {
    if (!state.path || !state.format || !state.message) throw new Error("편집 상태가 올바르지 않습니다.");
    const content = formString(formData, "content");
    if (state.format === "yaml") validateYamlDocument(content);
    else parseFrontMatterDocument(content);

    const result = await this.api.putContent({
      path: state.path,
      content,
      sha: state.sha,
      message: state.message,
    });
    this.finishSave(result, "저장 완료 · 변경 사항을 저장했습니다.");
  }

  private async uploadImage(formData: FormData): Promise<void> {
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("업로드할 이미지 파일을 선택하세요.");
    const altText = formString(formData, "alt");
    if (!altText.trim()) throw new Error("이미지 대체 텍스트를 입력하세요.");

    const request = await prepareMediaUpload(file);
    const result = await this.api.uploadMedia(request);
    const markdown = mediaMarkdown(result, altText);
    const copied = await copyText(markdown);
    const commit = getCommitDetails(result);
    const url = safeCommitUrl(commit.url, this.config.repository, commit.sha);
    this.ui.closePanel();
    this.state = null;
    this.ui.showMediaResult(markdown, copied, commit.sha, url);
    this.ui.toast("이미지 업로드가 완료되었습니다.");
  }

  private finishSave(result: CommitResponse, message: string): void {
    const commit = getCommitDetails(result);
    const url = safeCommitUrl(commit.url, this.config.repository, commit.sha);
    this.ui.closePanel();
    this.state = null;
    this.ui.showCommitResult(message, commit.sha, url);
    this.ui.toast(message);
  }

  private handleError(error: unknown): void {
    if (error instanceof ApiError) {
      if (error.status === 401 || error.status === 403) {
        this.ui.closePanel();
        this.state = null;
        this.onSessionExpired();
        return;
      }
      this.ui.setStatus(friendlyApiError(error), "error");
      return;
    }

    const message = error instanceof Error ? error.message : "편집 작업을 완료하지 못했습니다.";
    this.ui.setStatus(message, "error");
  }
}
