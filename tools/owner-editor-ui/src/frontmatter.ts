import { parse, stringify } from "yaml";

export interface NewPostValues {
  title: string;
  date: string;
  slug: string;
  description: string;
  categories: string;
  tags: string;
  published: boolean;
  body: string;
}

export interface NewPostDocument {
  path: string;
  content: string;
  title: string;
}

export interface ParsedFrontMatter {
  attributes: Record<string, unknown>;
  body: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function splitListInput(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function normalizeSlug(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function createNewPostDocument(values: NewPostValues): NewPostDocument {
  const title = values.title.trim();
  const date = values.date.trim();
  const slug = normalizeSlug(values.slug);

  if (!title) throw new Error("게시글 제목을 입력하세요.");
  if (!validDate(date)) throw new Error("작성일을 YYYY-MM-DD 형식으로 입력하세요.");
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("영문 주소는 소문자 영문, 숫자, 하이픈으로 입력하세요.");
  }

  const attributes = {
    layout: "post",
    lang: "ko",
    title,
    date,
    description: values.description.trim(),
    categories: splitListInput(values.categories),
    tags: splitListInput(values.tags),
    thumbnail: "",
    published: values.published,
  };
  const yaml = stringify(attributes, { lineWidth: 0 }).trimEnd();
  const body = values.body.replace(/^\s*\n/, "").trimEnd();
  const content = `---\n${yaml}\n---\n\n${body}${body ? "\n" : ""}`;

  return {
    path: `_posts/${date}-${slug}.md`,
    content,
    title,
  };
}

export function parseFrontMatterDocument(content: string): ParsedFrontMatter {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (lines[0]?.trim() !== "---") {
    throw new Error("문서가 YAML front matter 구분선(---)으로 시작해야 합니다.");
  }

  const closingLine = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (closingLine < 0) {
    throw new Error("YAML front matter의 닫는 구분선(---)을 찾을 수 없습니다.");
  }

  const yamlSource = lines.slice(1, closingLine).join("\n");
  const attributes = parse(yamlSource) as unknown;
  if (!isRecord(attributes)) {
    throw new Error("YAML front matter는 키와 값으로 이루어진 객체여야 합니다.");
  }

  return {
    attributes,
    body: lines.slice(closingLine + 1).join("\n"),
  };
}

export function validateYamlDocument(content: string): void {
  if (!content.trim()) throw new Error("YAML 내용을 입력하세요.");
  const parsed = parse(content) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("YAML 최상위 값은 키와 값으로 이루어진 객체여야 합니다.");
  }
}
