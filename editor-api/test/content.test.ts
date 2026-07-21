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
    const validWithTime = `---\nlayout: post\ntitle: "시간 포함"\ndate: 2026-07-21 09:00:00 +0900\npublished: true\n---\n\n본문\n`;
    expect(validateTextContent("_posts/2026-07-21-owner-mode.md", validWithTime)).toBe(validWithTime);
    expect(() =>
      validateTextContent("_posts/2026-07-20-owner-mode.md", valid),
    ).toThrowError(/날짜/);
    expect(() =>
      validateTextContent("_projects/owner-mode.md", "---\npublished: yes\n---\n"),
    ).toThrowError();
    expect(() =>
      validateTextContent(
        "_posts/2026-13-99-owner-mode.md",
        "---\nlayout: post\ntitle: Invalid date\ndate: 2026-13-99\n---\n",
      ),
    ).toThrowError(/달력/);
    expect(() =>
      validateTextContent(
        "_posts/2026-07-21-owner-mode.md",
        "---\nlayout: post\ntitle: Invalid date suffix\ndate: 2026-07-21 garbage\n---\n",
      ),
    ).toThrowError(/날짜/);
    expect(() =>
      validateTextContent(
        "_posts/2026-07-21-owner-mode.md",
        "---\nlayout: post\ntitle: Invalid time\ndate: 2026-07-21 29:00:00 +0900\n---\n",
      ),
    ).toThrowError(/날짜/);
    expect(() =>
      validateTextContent("about.md", "\uFEFF---\ntitle: About\n---\n"),
    ).toThrowError(/BOM/);
  });

  it("enforces the complete post schema at the Worker boundary", () => {
    const valid = `---
layout: post
lang: ko
title: "스키마 검증"
description: "설명"
date: 2026-07-21 09:00:00 +0900
last_modified_at: 2026-07-22 10:30:00 +0900
author: daeho
categories: ["Security"]
tags: ["Worker"]
series: "API"
series_order: 1
cover: "/assets/images/uploads/2026/07/cover.webp"
cover_alt: "대표 이미지 설명"
featured: false
pinned: false
toc: true
comments: true
math: false
mermaid: false
published: true
noindex: false
search_exclude: false
canonical_url: "https://example.org/original"
---

본문
`;
    expect(validateTextContent("_posts/2026-07-21-schema.md", valid)).toBe(valid);

    const invalidDocuments = [
      valid.replace("layout: post", "layout: null"),
      valid.replace("layout: post", "layout: post\npermalink: /assets/js/payload.js"),
      valid.replace("layout: post", "layout: post\npage_script: //cdn.jsdelivr.net/payload.js"),
      valid.replace('categories: ["Security"]', "categories: Security"),
      valid.replace("featured: false", 'featured: "false"'),
      valid.replace("last_modified_at: 2026-07-22 10:30:00 +0900", "last_modified_at: yesterday"),
      valid.replace("https://example.org/original", "javascript:alert(1)"),
      valid.replace('cover_alt: "대표 이미지 설명"', 'cover_alt: ""'),
      valid.replace("/assets/images/uploads/2026/07/cover.webp", "data:text/html,payload"),
    ];
    invalidDocuments.forEach((content) => {
      expect(() => validateTextContent("_posts/2026-07-21-schema.md", content)).toThrowError(HttpError);
    });
  });

  it("enforces project fields and fixed page routes", () => {
    const project = `---
layout: project
title: "검증 프로젝트"
summary: "설명"
technologies: ["TypeScript"]
featured: false
order: 1
repository_url: "https://github.com/Daeho-AI/Daeho-AI.github.io"
demo_url: ""
cover: ""
cover_alt: ""
related_posts: []
published: true
noindex: false
---

본문
`;
    expect(validateTextContent("_projects/schema.md", project)).toBe(project);
    expect(() =>
      validateTextContent("_projects/schema.md", project.replace("https://github.com/Daeho-AI/Daeho-AI.github.io", "javascript:alert(1)")),
    ).toThrowError(/HTTPS/);
    expect(() =>
      validateTextContent("_projects/schema.md", project.replace("layout: project", "layout: project\npermalink: /")),
    ).toThrowError(/permalink/);

    const about = "---\nlayout: page\ntitle: About\npermalink: /about/\n---\n\n본문\n";
    expect(validateTextContent("about.md", about)).toBe(about);
    expect(() => validateTextContent("about.md", about.replace("/about/", "/admin/"))).toThrowError(/permalink/);
  });

  it("requires the expected YAML top-level shapes", () => {
    expect(validateTextContent("_data/profile.yml", 'name: "Daeho-AI"\n')).toContain("Daeho-AI");
    expect(validateTextContent("_data/navigation.yml", '- label: "Home"\n  url: "/"\n')).toContain("Home");
    expect(() => validateTextContent("_data/navigation.yml", "label: Home\n")).toThrowError(/목록/);
    expect(() => validateTextContent("_data/skills.yml", "categories: nope\n")).toThrowError(/categories/);
    expect(() =>
      validateTextContent("_data/profile.yml", "name: !ruby/object:ERB {}\n"),
    ).toThrowError(/지원하지 않는 YAML/);
    expect(() =>
      validateTextContent("_data/profile.yml", 'name: Daeho-AI\ngithub: "javascript:alert(1)"\n'),
    ).toThrowError(/HTTPS/);
    expect(() =>
      validateTextContent("_data/navigation.yml", '- label: Unsafe\n  url: "//evil.example/path"\n'),
    ).toThrowError(/경로/);
    expect(() =>
      validateTextContent("_data/social.yml", '- label: Unsafe\n  url: "http://evil.example/path"\n'),
    ).toThrowError(/HTTPS/);
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
