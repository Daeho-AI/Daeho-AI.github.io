---
layout: page
title: Style Guide
description: "블로그 구성 요소를 점검하기 위한 내부 디자인 가이드입니다."
permalink: /style-guide/
noindex: true
sitemap: false
body_class: style-guide-page
---

이 페이지는 실제 경력이나 프로젝트를 소개하지 않는 내부 디자인 점검용 페이지입니다. 전역 메뉴와 검색 인덱스에는 포함되지 않습니다.

## 제목과 본문

### 세 번째 단계 제목

한국어와 English가 함께 있는 본문, [내부 링크]({{ '/about/' | relative_url }}), **굵은 글씨**, *기울임 글씨*, `inline code`를 확인합니다.

- 순서 없는 목록
  - 중첩된 목록
- 긴 텍스트가 작은 화면에서도 가로 레이아웃을 깨뜨리지 않는지 확인합니다.

1. 첫 번째 순서
2. 두 번째 순서

> 인용문은 본문과 구분되지만 내용을 과도하게 강조하지 않습니다.

## Callout

<div class="callout callout-note" role="note"><strong>Note</strong><p>일반적인 참고 정보를 표시합니다.</p></div>
<div class="callout callout-tip" role="note"><strong>Tip</strong><p>작업에 도움이 되는 제안을 표시합니다.</p></div>
<div class="callout callout-important" role="note"><strong>Important</strong><p>놓치지 않아야 할 정보를 표시합니다.</p></div>
<div class="callout callout-warning" role="note"><strong>Warning</strong><p>주의가 필요한 상황을 표시합니다.</p></div>
<div class="callout callout-caution" role="note"><strong>Caution</strong><p>위험을 피하기 위한 내용을 표시합니다.</p></div>

## 코드 블록

{% raw %}
```liquid
{% assign title = page.title | default: site.title %}
<h1>{{ title | escape }}</h1>
```
{% endraw %}

## 표

<div class="table-wrapper">
  <table>
    <caption>반응형 표와 캡션 예시</caption>
    <thead><tr><th scope="col">항목</th><th scope="col">설명</th></tr></thead>
    <tbody><tr><th scope="row">텍스트</th><td>긴 셀 내용도 표 컨테이너 안에서 안전하게 표시합니다.</td></tr><tr><th scope="row">상태</th><td>색상 외에 텍스트 레이블을 함께 사용합니다.</td></tr></tbody>
  </table>
</div>

## 이미지와 캡션

<figure>
  <img src="{{ '/assets/images/default-og-image.png' | relative_url }}" alt="Daeho-AI 블로그 기본 미리보기 이미지" width="1200" height="630" loading="lazy" decoding="async">
  <figcaption>실제 콘텐츠 이미지가 아닌 디자인 점검용 기본 자산입니다.</figcaption>
</figure>

## 태그, 버튼과 카드

<ul class="tag-list" aria-label="태그 예시"><li class="tag">Tag</li><li class="tag">긴 태그 이름</li></ul>
<div class="button-row"><a class="button button-primary" href="#style-guide-dialog">기본 버튼</a><button class="button button-secondary" type="button">보조 버튼</button></div>
<article class="project-card"><div class="project-card-body"><p class="entry-kicker">Component sample</p><h3 class="entry-title">카드 제목</h3><p class="entry-summary">실제 프로젝트나 성과를 나타내지 않는 레이아웃 예시입니다.</p></div></article>

## Dialog와 Toast

<dialog id="style-guide-dialog" class="style-guide-dialog-demo" open aria-labelledby="style-guide-dialog-title">
  <h3 id="style-guide-dialog-title">Dialog 예시</h3>
  <p>포커스와 명암 대비를 점검하기 위한 비대화형 예시입니다.</p>
</dialog>
<div class="toast-region style-guide-toast" role="status" aria-live="polite">작업이 완료되었습니다.</div>

전역 테마 버튼으로 light, dark, system 상태에서 모든 구성 요소의 대비를 확인할 수 있습니다.
