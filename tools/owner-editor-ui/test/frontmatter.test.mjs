import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { parse, stringify } from "yaml";

let modulePromise;

function loadFrontmatterModule() {
  if (!modulePromise) {
    modulePromise = readFile(new URL("../src/frontmatter.ts", import.meta.url), "utf8").then((typescriptSource) => {
      globalThis.__ownerEditorYaml = { parse, stringify };
      const testableSource = typescriptSource.replace(
        'import { parse, stringify } from "yaml";',
        "const { parse, stringify } = globalThis.__ownerEditorYaml;",
      );
      const { outputText } = ts.transpileModule(testableSource, {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
      });
      const source = Buffer.from(outputText).toString("base64");
      return import(`data:text/javascript;base64,${source}`);
    });
  }
  return modulePromise;
}

function newPostValues() {
  return {
    title: "테스트 글",
    subtitle: "",
    date: "2026-07-21",
    slug: "test-post",
    description: "새 글 front matter 회귀 검사",
    author: "Daeho-AI",
    categories: "Test",
    tags: "Regression",
    series: "",
    seriesOrder: "",
    cover: "",
    coverAlt: "",
    featured: false,
    pinned: false,
    toc: true,
    comments: false,
    math: false,
    mermaid: false,
    published: true,
    noindex: false,
    searchExclude: false,
    canonicalUrl: "",
    body: "본문",
  };
}

async function checkNewPostModificationDate() {
  const { createNewPostDocument, parseFrontMatterDocument } = await loadFrontmatterModule();
  const document = createNewPostDocument(newPostValues());
  const parsed = parseFrontMatterDocument(document.content);

  assert.equal(document.path, "_posts/2026-07-21-test-post.md");
  assert.equal(parsed.attributes.date, "2026-07-21");
  assert.equal(Object.hasOwn(parsed.attributes, "last_modified_at"), false);
  assert.doesNotMatch(document.content, /^last_modified_at:/m);
}

async function checkExistingModificationDate() {
  const { parseFrontMatterDocument } = await loadFrontmatterModule();
  const source = [
    "---",
    "layout: post",
    "title: 기존 글",
    "date: 2026-07-20 09:00:00 +0900",
    "last_modified_at: 2026-07-21 18:30:00 +0900",
    "---",
    "",
    "수정된 본문",
  ].join("\n");
  const parsed = parseFrontMatterDocument(source);

  assert.equal(parsed.attributes.last_modified_at, "2026-07-21 18:30:00 +0900");
  assert.match(parsed.body, /수정된 본문/);
}

await checkNewPostModificationDate();
await checkExistingModificationDate();
console.log("Owner editor front matter checks passed.");
