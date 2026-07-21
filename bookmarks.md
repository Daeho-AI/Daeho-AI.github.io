---
layout: page
title: Bookmarks
description: "이 브라우저에 저장한 개인 북마크를 확인합니다."
permalink: /bookmarks/
noindex: true
sitemap: false
prose: false
---

{% if site.data.site.features.bookmarks %}
  <section class="bookmarks-page" data-bookmarks-page data-search-index-url="{{ '/posts.json' | relative_url }}">
    <p class="notice-text">북마크는 현재 브라우저에만 저장되며 다른 기기나 브라우저와 동기화되지 않습니다.</p>
    <p data-bookmarks-status aria-live="polite">저장된 북마크를 불러오는 중입니다.</p>
    <ol class="bookmark-list" data-bookmark-list></ol>
    <div class="empty-state" data-bookmarks-empty hidden>
      <p>북마크한 게시글이 없습니다.</p>
      <a class="button button-secondary" href="{{ '/blog/' | relative_url }}">게시글 둘러보기</a>
    </div>
    <button class="button button-secondary" type="button" data-bookmarks-clear hidden>북마크 전체 삭제</button>
    <noscript><p class="notice-text">북마크는 브라우저 저장소를 사용하는 기능이므로 JavaScript가 필요합니다.</p></noscript>
  </section>
{% else %}
  <div class="empty-state"><p>북마크 기능이 현재 비활성화되어 있습니다.</p><a class="button button-secondary" href="{{ '/blog/' | relative_url }}">전체 게시글 보기</a></div>
{% endif %}
