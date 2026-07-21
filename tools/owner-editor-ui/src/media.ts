import type { MediaUploadRequest, MediaUploadResponse } from "./api";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function inferImageType(filename: string): string {
  const extension = filename.toLowerCase().split(".").pop();
  const types: Record<string, string> = {
    avif: "image/avif",
    gif: "image/gif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  return extension ? types[extension] || "" : "";
}

function sanitizeFilename(filename: string): string {
  const normalized = filename.normalize("NFKC").split(/[\\/]/).pop() || "";
  const extensionMatch = normalized.match(/\.[A-Za-z0-9]+$/);
  const extension = extensionMatch ? extensionMatch[0].toLowerCase() : "";
  const basename = normalized
    .slice(0, extension ? -extension.length : undefined)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "");

  return `${basename || `image-${Date.now()}`}${extension}`;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("이미지 파일을 읽지 못했습니다."));
    });
    reader.addEventListener("error", () => reject(new Error("이미지 파일을 읽지 못했습니다.")));
    reader.readAsDataURL(file);
  });
}

export async function prepareMediaUpload(file: File): Promise<MediaUploadRequest> {
  if (file.size <= 0) throw new Error("비어 있는 파일은 업로드할 수 없습니다.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("이미지는 10MB 이하 파일만 업로드할 수 있습니다.");

  const filename = sanitizeFilename(file.name);
  const contentType = file.type || inferImageType(filename);
  if (!["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    throw new Error("PNG, JPEG, GIF, WebP 또는 AVIF 이미지만 업로드할 수 있습니다.");
  }

  const dataUrl = await readAsDataUrl(file);
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) throw new Error("이미지 인코딩에 실패했습니다.");

  return {
    filename,
    contentBase64: dataUrl.slice(commaIndex + 1),
    contentType,
  };
}

function escapeAltText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\]/g, "\\]").trim() || "이미지 설명";
}

function markdownForPath(path: string, altText: string): string {
  const trimmed = path.trim();
  if (/^https?:\/\//i.test(trimmed)) return `![${escapeAltText(altText)}](${trimmed})`;

  const normalized = `/${trimmed.replace(/^\/+/, "")}`;
  return `![${escapeAltText(altText)}]({{ '${normalized}' | relative_url }})`;
}

export function mediaMarkdown(result: MediaUploadResponse, altText: string): string {
  if (result.markdown?.trim()) return result.markdown.trim();

  const path = result.markdownPath || result.path || result.url || "";
  if (!path.trim()) throw new Error("업로드 결과에 이미지 경로가 없습니다.");
  if (path.trim().startsWith("![")) return path.trim();
  return markdownForPath(path, altText);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the selection-based copy method.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.tabIndex = -1;
  textarea.className = "owner-editor-copy-buffer";
  document.body.append(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
