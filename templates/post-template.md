---
layout: post
lang: ko
title: "게시글 제목"
date: 2026-07-21
description: "목록과 검색 결과에 표시될 짧은 설명"
categories:
  - "카테고리"
tags:
  - "태그"
thumbnail: ""
published: false
---

이 문서를 복사해 `_posts/YYYY-MM-DD-영문주소.md` 파일을 만든 뒤 내용을 수정하세요.
게시 준비가 끝나면 위의 `published: false`를 `published: true`로 바꾸세요.

## 소제목

본문을 Markdown으로 작성합니다.

- 목록 항목
- 목록 항목

| 항목 | 설명 |
| --- | --- |
| 예시 | 표 내용 |

> 인용문은 `>`로 시작합니다.

[링크 이름](https://example.com)과 `인라인 코드`를 사용할 수 있습니다.

사이트에 올린 이미지는 다음처럼 내부 경로에 `relative_url` 필터를 적용합니다.

![이미지 설명]({{ '/assets/images/파일이름.jpg' | relative_url }})

```python
def example():
    return "코드 블록"
```
