---
layout: page
title: Tags
description: "태그별 게시글을 검색하고 찾아봅니다."
permalink: /tags/
prose: false
page_script: /assets/js/blog-filter.js
---

{% assign tags = site.tags | sort %}
{% if tags.size > 0 %}
  <section class="taxonomy-filter" data-blog-browser data-filter-root data-filter-kind="tags" data-per-page="9999">
    <form class="filter-form compact-filter-form" action="{{ '/tags/' | relative_url }}" method="get" role="search" data-filter-form>
      <div class="filter-field filter-field-search">
        <label for="tag-filter-query">태그 검색</label>
        <input id="tag-filter-query" name="q" type="search" autocomplete="off" placeholder="태그 이름" data-filter-query>
      </div>
      <div class="filter-actions">
        <button class="button button-primary" type="submit">검색</button>
        <a class="button button-secondary" href="{{ '/tags/' | relative_url }}" data-filter-reset>초기화</a>
      </div>
    </form>
    <noscript><p class="notice-text">아래에는 모든 태그가 표시됩니다.</p></noscript>
    <p><strong data-result-count>{{ tags.size }}</strong>개의 태그</p>
    <div class="taxonomy-index" data-filter-list>
      {% for tag in tags %}
        <section class="taxonomy-section" id="tag-{{ forloop.index }}" data-filter-item data-title="{{ tag[0] | downcase | escape }}" data-search="{{ tag[0] | downcase | escape }}">
          <header class="taxonomy-heading">
            <h2>{{ tag[0] | escape }}</h2>
            <a href="{{ '/blog/' | relative_url }}?tag={{ tag[0] | url_encode }}">게시글 {{ tag[1].size }}개 보기</a>
          </header>
          <ol class="taxonomy-post-list">
            {% for post in tag[1] %}
              <li><time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: site.data.site.date_format | default: '%Y.%m.%d' }}</time><a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a></li>
            {% endfor %}
          </ol>
        </section>
      {% endfor %}
    </div>
    <div class="empty-state" data-filter-empty hidden><p>검색어와 일치하는 태그가 없습니다.</p><a href="{{ '/tags/' | relative_url }}" data-filter-reset>전체 태그 보기</a></div>
  </section>
{% else %}
  <div class="empty-state" role="status">
    <p>아직 등록된 태그가 없습니다.</p>
    <a class="button button-secondary" href="{{ '/blog/' | relative_url }}">전체 게시글 보기</a>
  </div>
{% endif %}
