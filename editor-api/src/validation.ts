import { parseDocument } from "yaml";

const MAX_TEXT_BYTES = 512 * 1024;
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

const FIXED_CONTENT_PATHS = new Set([
  "_data/profile.yml",
  "_data/skills.yml",
  "_data/navigation.yml",
  "_data/social.yml",
  "about.md",
  "contact.md",
]);

const POST_PATH = /^_posts\/(\d{4}-\d{2}-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const PROJECT_PATH = /^_projects\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const UPLOAD_PATH = /^assets\/images\/uploads\/\d{4}\/\d{2}\/[a-z0-9]+(?:[._-][a-z0-9]+)*\.(?:avif|gif|jpe?g|png|webp)$/;

const MEDIA_TYPES: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

function badRequest(code: string, message: string): never {
  throw new HttpError(400, code, message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isAllowedContentPath(path: string): boolean {
  return FIXED_CONTENT_PATHS.has(path) || POST_PATH.test(path) || PROJECT_PATH.test(path);
}

export function validateContentPath(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) {
    badRequest("invalid_path", "허용된 콘텐츠 파일 경로가 아닙니다.");
  }
  if (
    value !== value.trim() ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value.includes("//") ||
    value.includes("\0") ||
    value.split("/").some((part) => part === "." || part === "..") ||
    !/^[\x20-\x7e]+$/.test(value) ||
    !isAllowedContentPath(value)
  ) {
    badRequest("invalid_path", "허용된 콘텐츠 파일 경로가 아닙니다.");
  }
  return value;
}

function parseYaml(source: string, label: string): unknown {
  const document = parseDocument(source, { prettyErrors: false });
  if (document.errors.length > 0) {
    badRequest("invalid_yaml", `${label}의 YAML 형식이 올바르지 않습니다.`);
  }
  if (document.warnings.length > 0) {
    badRequest("unsupported_yaml", `${label}에 지원하지 않는 YAML 태그 또는 구문이 있습니다.`);
  }
  try {
    return document.toJS({ maxAliasCount: 50 }) as unknown;
  } catch {
    badRequest("invalid_yaml", `${label}의 YAML 별칭 사용이 너무 많습니다.`);
  }
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function frontMatterDatePart(value: unknown): string {
  if (typeof value !== "string") return "";
  const match = value
    .trim()
    .match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\s*(Z|[+-]\d{2}:?\d{2}))?)?$/);
  if (!match || !isValidIsoDate(match[1])) return "";
  if (match[2] === undefined) return match[1];

  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const second = match[4] === undefined ? 0 : Number(match[4]);
  if (hour > 23 || minute > 59 || second > 59) return "";

  const zone = match[5] || "";
  if (zone && zone !== "Z") {
    const zoneDigits = zone.slice(1).replace(":", "");
    const zoneHour = Number(zoneDigits.slice(0, 2));
    const zoneMinute = Number(zoneDigits.slice(2, 4));
    if (zoneHour > 14 || zoneMinute > 59 || (zoneHour === 14 && zoneMinute !== 0)) return "";
  }
  return match[1];
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function validateOptionalString(record: Record<string, unknown>, key: string, label = key): void {
  if (hasOwn(record, key) && typeof record[key] !== "string") {
    badRequest("invalid_frontmatter_field", `${label} 값은 문자열이어야 합니다.`);
  }
}

function validateStringArray(record: Record<string, unknown>, key: string): void {
  if (!hasOwn(record, key)) return;
  const value = record[key];
  if (
    !Array.isArray(value) ||
    value.length > 100 ||
    value.some((item) => typeof item !== "string" || !item.trim() || item.length > 200)
  ) {
    badRequest("invalid_frontmatter_array", `${key} 값은 비어 있지 않은 문자열 배열이어야 합니다.`);
  }
}

function validateBooleanFields(record: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    if (hasOwn(record, field) && typeof record[field] !== "boolean") {
      badRequest("invalid_frontmatter_boolean", `${field} 값은 true 또는 false여야 합니다.`);
    }
  }
}

function validateOptionalPositiveInteger(record: Record<string, unknown>, key: string): void {
  if (!hasOwn(record, key) || record[key] === null || record[key] === "") return;
  const value = record[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    badRequest("invalid_frontmatter_integer", `${key} 값은 1 이상의 정수여야 합니다.`);
  }
}

function validateOptionalDate(record: Record<string, unknown>, key: string): void {
  if (!hasOwn(record, key) || record[key] === null || record[key] === "") return;
  if (!frontMatterDatePart(record[key])) {
    badRequest("invalid_frontmatter_date", `${key} 날짜 형식이 올바르지 않습니다.`);
  }
}

function validHttpsUrl(value: string): boolean {
  if (!value || value !== value.trim() || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function validateOptionalHttpsUrl(record: Record<string, unknown>, key: string): void {
  if (!hasOwn(record, key) || record[key] === "") return;
  const value = record[key];
  if (typeof value !== "string" || !validHttpsUrl(value)) {
    badRequest("invalid_external_url", `${key} 값은 userinfo가 없는 전체 HTTPS URL이어야 합니다.`);
  }
}

function validInternalUrl(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("\0")) {
    return false;
  }
  try {
    const url = new URL(value, "https://daeho-ai.github.io");
    return url.origin === "https://daeho-ai.github.io";
  } catch {
    return false;
  }
}

function validateOptionalInternalOrHttpsUrl(record: Record<string, unknown>, key: string): void {
  if (!hasOwn(record, key) || record[key] === "") return;
  const value = record[key];
  if (typeof value !== "string" || (!validHttpsUrl(value) && !validInternalUrl(value))) {
    badRequest("invalid_url", `${key} 값은 사이트 내부 절대 경로 또는 전체 HTTPS URL이어야 합니다.`);
  }
}

function validCoverUrl(value: string): boolean {
  if (validHttpsUrl(value)) return true;
  const normalized = value.startsWith("/") ? value : `/${value}`;
  if (!validInternalUrl(normalized)) return false;
  try {
    const url = new URL(normalized, "https://daeho-ai.github.io");
    return url.pathname.startsWith("/assets/images/") && !url.search && !url.hash;
  } catch {
    return false;
  }
}

function validateCover(record: Record<string, unknown>): void {
  for (const [imageKey, altKey] of [["cover", "cover_alt"], ["thumbnail", "thumbnail_alt"]] as const) {
    if (!hasOwn(record, imageKey) || record[imageKey] === "") continue;
    const image = record[imageKey];
    const alt = record[altKey];
    if (typeof image !== "string" || !validCoverUrl(image)) {
      badRequest("invalid_cover", `${imageKey} 값은 assets/images 내부 경로 또는 전체 HTTPS URL이어야 합니다.`);
    }
    if (typeof alt !== "string" || !alt.trim()) {
      badRequest("missing_cover_alt", `${imageKey}가 있으면 ${altKey} 대체 텍스트가 필요합니다.`);
    }
  }
}

function rejectUnsafePresentationFields(record: Record<string, unknown>): void {
  for (const field of ["permalink", "page_script"]) {
    if (hasOwn(record, field)) {
      badRequest("forbidden_frontmatter_field", `${field} 값은 소유자 편집 API에서 변경할 수 없습니다.`);
    }
  }
}

function validateDocumentSchema(path: string, attributes: Record<string, unknown>): void {
  const isPost = POST_PATH.test(path);
  const isProject = PROJECT_PATH.test(path);
  const expectedLayout = isPost ? "post" : "project";
  if (attributes.layout !== expectedLayout) {
    badRequest("invalid_layout", `${path}의 layout은 ${expectedLayout}여야 합니다.`);
  }
  rejectUnsafePresentationFields(attributes);

  if (typeof attributes.title !== "string" || !attributes.title.trim()) {
    badRequest("missing_title", "게시글과 프로젝트에는 제목이 필요합니다.");
  }
  if ("published" in attributes && typeof attributes.published !== "boolean") {
    badRequest("invalid_published", "published 값은 true 또는 false여야 합니다.");
  }

  if (isPost) {
    for (const field of ["lang", "subtitle", "description", "author", "series", "cover", "cover_alt", "thumbnail", "thumbnail_alt", "canonical_url"]) {
      validateOptionalString(attributes, field);
    }
    validateStringArray(attributes, "categories");
    validateStringArray(attributes, "tags");
    validateOptionalPositiveInteger(attributes, "series_order");
    if (attributes.series_order !== null && attributes.series_order !== "" && hasOwn(attributes, "series_order")) {
      if (typeof attributes.series !== "string" || !attributes.series.trim()) {
        badRequest("missing_series", "series_order를 사용하려면 series 이름이 필요합니다.");
      }
    }
    validateBooleanFields(attributes, [
      "featured",
      "pinned",
      "toc",
      "comments",
      "math",
      "mermaid",
      "published",
      "noindex",
      "search_exclude",
    ]);
    validateOptionalDate(attributes, "last_modified_at");
    validateOptionalHttpsUrl(attributes, "canonical_url");
  } else if (isProject) {
    for (const field of ["summary", "description", "period", "status", "role", "repository_url", "demo_url", "cover", "cover_alt", "thumbnail", "thumbnail_alt"]) {
      validateOptionalString(attributes, field);
    }
    validateStringArray(attributes, "technologies");
    validateStringArray(attributes, "related_posts");
    validateOptionalPositiveInteger(attributes, "order");
    validateBooleanFields(attributes, ["featured", "published", "noindex", "search_exclude"]);
    validateOptionalDate(attributes, "last_modified_at");
    validateOptionalHttpsUrl(attributes, "repository_url");
    validateOptionalHttpsUrl(attributes, "demo_url");
  }
  validateCover(attributes);
}

function validateDataDocument(path: string, content: string): void {
  const value = parseYaml(content, path);
  if (path === "_data/navigation.yml" || path === "_data/social.yml") {
    if (!Array.isArray(value)) badRequest("invalid_yaml_shape", `${path}는 YAML 목록이어야 합니다.`);
    value.forEach((item, index) => {
      if (!isRecord(item)) badRequest("invalid_yaml_shape", `${path}의 ${index + 1}번째 항목은 YAML 객체여야 합니다.`);
      if (path === "_data/navigation.yml") validateOptionalInternalOrHttpsUrl(item, "url");
      else validateOptionalHttpsUrl(item, "url");
    });
    return;
  }
  if (!isRecord(value)) badRequest("invalid_yaml_shape", `${path}는 YAML 객체여야 합니다.`);
  if (path === "_data/skills.yml" && !Array.isArray(value.categories)) {
    badRequest("invalid_skills", "기술 목록에는 categories 배열이 필요합니다.");
  }
  if (path === "_data/profile.yml") {
    validateOptionalHttpsUrl(value, "github");
    validateOptionalHttpsUrl(value, "linkedin");
    validateOptionalInternalOrHttpsUrl(value, "resume_url");
    if (hasOwn(value, "email") && value.email !== "") {
      if (typeof value.email !== "string" || !/^[^\s@]+@[^\s@]+$/.test(value.email)) {
        badRequest("invalid_email", "email 형식이 올바르지 않습니다.");
      }
    }
  }
}

function validateMarkdownDocument(path: string, content: string): void {
  const normalized = content.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) badRequest("invalid_frontmatter", "Markdown 문서는 YAML front matter로 시작해야 합니다.");
  const attributes = parseYaml(match[1], `${path} front matter`);
  if (!isRecord(attributes)) {
    badRequest("invalid_frontmatter", "Markdown front matter는 YAML 객체여야 합니다.");
  }

  if (POST_PATH.test(path) || PROJECT_PATH.test(path)) validateDocumentSchema(path, attributes);

  if (path === "about.md" || path === "contact.md") {
    if (attributes.layout !== "page") badRequest("invalid_layout", `${path}의 layout은 page여야 합니다.`);
    if (hasOwn(attributes, "page_script")) {
      badRequest("forbidden_frontmatter_field", "page_script 값은 소유자 편집 API에서 변경할 수 없습니다.");
    }
    const expectedPermalink = path === "about.md" ? "/about/" : "/contact/";
    if (attributes.permalink !== expectedPermalink) {
      badRequest("invalid_permalink", `${path}의 permalink는 ${expectedPermalink}여야 합니다.`);
    }
  }

  const postMatch = path.match(POST_PATH);
  if (postMatch) {
    if (!isValidIsoDate(postMatch[1])) {
      badRequest("invalid_post_date", "게시글 파일명의 날짜가 실제 달력 날짜여야 합니다.");
    }
    const date = frontMatterDatePart(attributes.date);
    if (!date || date !== postMatch[1]) {
      badRequest("date_mismatch", "게시글 파일명의 날짜와 front matter 날짜가 같아야 합니다.");
    }
  }
}

export function validateTextContent(path: string, value: unknown): string {
  if (typeof value !== "string") badRequest("invalid_content", "콘텐츠는 UTF-8 문자열이어야 합니다.");
  if (value.startsWith("\uFEFF")) {
    badRequest("invalid_content_encoding", "UTF-8 BOM 없이 문서를 저장해야 합니다.");
  }
  const byteLength = new TextEncoder().encode(value).byteLength;
  if (byteLength === 0 || byteLength > MAX_TEXT_BYTES || value.includes("\0")) {
    badRequest("invalid_content_size", "콘텐츠는 비어 있지 않은 512KB 이하 UTF-8 문서여야 합니다.");
  }
  if (path.startsWith("_data/")) validateDataDocument(path, value);
  else validateMarkdownDocument(path, value);
  return value;
}

export function validateSha(value: unknown, required: boolean): string | undefined {
  if (value === undefined || value === null || value === "") {
    if (required) throw new HttpError(409, "sha_required", "최신 파일 SHA가 필요합니다. 다시 불러오세요.");
    return undefined;
  }
  if (typeof value !== "string" || !/^[a-f0-9]{40}$/i.test(value)) {
    badRequest("invalid_sha", "파일 SHA 형식이 올바르지 않습니다.");
  }
  return value.toLowerCase();
}

export function validateCommitMessage(value: unknown, fallback: string): string {
  const message = typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim() : "";
  const normalized = (message || fallback).replace(/\s+/g, " ");
  if (normalized.length < 3) badRequest("invalid_commit_message", "커밋 메시지는 3자 이상이어야 합니다.");
  return normalized.slice(0, 120);
}

function decodeBase64(value: string): Uint8Array {
  if (value.length === 0 || value.length > Math.ceil(MAX_MEDIA_BYTES / 3) * 4 + 8) {
    badRequest("invalid_media_size", "이미지는 10MB 이하만 업로드할 수 있습니다.");
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    badRequest("invalid_base64", "이미지 인코딩이 올바르지 않습니다.");
  }
  try {
    const binary = atob(value);
    if (binary.length === 0 || binary.length > MAX_MEDIA_BYTES) {
      badRequest("invalid_media_size", "이미지는 10MB 이하만 업로드할 수 있습니다.");
    }
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    badRequest("invalid_base64", "이미지 인코딩이 올바르지 않습니다.");
  }
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function matchesMagic(bytes: Uint8Array, extension: string): boolean {
  if (extension === "png") {
    return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  }
  if (extension === "jpg" || extension === "jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (extension === "gif") {
    return bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6));
  }
  if (extension === "webp") {
    return bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP";
  }
  if (extension === "avif") {
    return bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp" && ["avif", "avis"].includes(ascii(bytes, 8, 4));
  }
  return false;
}

export interface ValidatedMedia {
  bytes: Uint8Array;
  baseName: string;
  extension: string;
  contentType: string;
}

export function validateMediaInput(value: unknown): ValidatedMedia {
  if (!isRecord(value)) badRequest("invalid_request", "이미지 업로드 요청이 올바르지 않습니다.");
  const filename = typeof value.filename === "string" ? value.filename.normalize("NFKC") : "";
  const contentType = typeof value.contentType === "string" ? value.contentType.toLowerCase() : "";
  const contentBase64 = typeof value.contentBase64 === "string" ? value.contentBase64 : "";
  const safeName = filename.split(/[\\/]/).pop() || "";
  if (!filename || filename !== safeName) {
    badRequest("invalid_filename", "이미지 파일 이름에는 경로를 포함할 수 없습니다.");
  }
  const match = safeName.match(/^(.+)\.([A-Za-z0-9]+)$/);
  if (!match) badRequest("invalid_filename", "이미지 파일 이름과 확장자를 확인하세요.");
  const extension = match[2].toLowerCase();
  if (!MEDIA_TYPES[extension] || MEDIA_TYPES[extension] !== contentType) {
    badRequest("unsupported_media", "PNG, JPEG, GIF, WebP 또는 AVIF 이미지만 업로드할 수 있습니다.");
  }
  const baseName = match[1]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  if (!baseName) badRequest("invalid_filename", "파일 이름에는 영문 또는 숫자가 필요합니다.");
  const bytes = decodeBase64(contentBase64);
  if (!matchesMagic(bytes, extension)) {
    badRequest("media_signature_mismatch", "파일 확장자와 실제 이미지 형식이 일치하지 않습니다.");
  }
  return { bytes, baseName, extension, contentType };
}

export function buildUploadPath(media: ValidatedMedia, suffix: string, now = new Date()): string {
  const year = now.getUTCFullYear().toString();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const safeSuffix = suffix.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  const path = `assets/images/uploads/${year}/${month}/${media.baseName}-${safeSuffix}.${media.extension}`;
  if (!safeSuffix || !UPLOAD_PATH.test(path)) throw new Error("Generated upload path is invalid");
  return path;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}
