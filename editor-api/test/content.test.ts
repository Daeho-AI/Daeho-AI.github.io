import { describe, expect, it } from "vitest";
import {
  buildUploadPath,
  HttpError,
  isAllowedContentPath,
  validateContentPath,
  validateMediaInput,
  validateTextContent,
} from "../src/validation";

describe("repository content validation", () => {
  it("allows only the locked Jekyll content paths", () => {
    expect(isAllowedContentPath("_posts/2026-07-21-owner-mode.md")).toBe(true);
    expect(isAllowedContentPath("_projects/owner-mode.md")).toBe(true);
    expect(isAllowedContentPath("_data/profile.yml")).toBe(true);
    expect(isAllowedContentPath("about.md")).toBe(true);
    expect(isAllowedContentPath("README.md")).toBe(false);
    expect(() => validateContentPath("_posts/../_config.yml")).toThrowError(HttpError);
    expect(() => validateContentPath("/about.md")).toThrowError(HttpError);
    expect(() => validateContentPath("_data/editor.yml")).toThrowError(HttpError);
  });

  it("validates post front matter and filename dates", () => {
    const valid = `---\nlayout: post\ntitle: "소유자 모드"\ndate: 2026-07-21\npublished: true\n---\n\n본문\n`;
    expect(validateTextContent("_posts/2026-07-21-owner-mode.md", valid)).toBe(valid);
    expect(() =>
      validateTextContent("_posts/2026-07-20-owner-mode.md", valid),
    ).toThrowError(/날짜/);
    expect(() =>
      validateTextContent("_projects/owner-mode.md", "---\npublished: yes\n---\n"),
    ).toThrowError();
    expect(() =>
      validateTextContent(
        "_posts/2026-13-99-owner-mode.md",
        "---\ntitle: Invalid date\ndate: 2026-13-99\n---\n",
      ),
    ).toThrowError(/달력/);
    expect(() =>
      validateTextContent(
        "_posts/2026-07-21-owner-mode.md",
        "---\ntitle: Invalid date suffix\ndate: 2026-07-21 garbage\n---\n",
      ),
    ).toThrowError(/날짜/);
    expect(() =>
      validateTextContent("about.md", "\uFEFF---\ntitle: About\n---\n"),
    ).toThrowError(/BOM/);
  });

  it("requires the expected YAML top-level shapes", () => {
    expect(validateTextContent("_data/profile.yml", 'name: "Daeho-AI"\n')).toContain("Daeho-AI");
    expect(validateTextContent("_data/navigation.yml", '- label: "Home"\n  url: "/"\n')).toContain("Home");
    expect(() => validateTextContent("_data/navigation.yml", "label: Home\n")).toThrowError(/목록/);
    expect(() => validateTextContent("_data/skills.yml", "categories: nope\n")).toThrowError(/categories/);
    expect(() =>
      validateTextContent("_data/profile.yml", "name: !ruby/object:ERB {}\n"),
    ).toThrowError(/지원하지 않는 YAML/);
  });

  it("checks image MIME, magic bytes, and generates an upload-only path", () => {
    const pngBytes = String.fromCharCode(137, 80, 78, 71, 13, 10, 26, 10);
    const media = validateMediaInput({
      filename: "My Screenshot.PNG",
      contentType: "image/png",
      contentBase64: btoa(pngBytes),
    });
    const path = buildUploadPath(media, "abc123", new Date("2026-07-21T00:00:00Z"));
    expect(path).toBe("assets/images/uploads/2026/07/my-screenshot-abc123.png");
    expect(() =>
      validateMediaInput({
        filename: "payload.svg",
        contentType: "image/svg+xml",
        contentBase64: btoa("<svg><script>alert(1)</script></svg>"),
      }),
    ).toThrowError(/PNG/);
    expect(() =>
      validateMediaInput({
        filename: "../My Screenshot.PNG",
        contentType: "image/png",
        contentBase64: btoa(pngBytes),
      }),
    ).toThrowError(/경로/);
  });
});
