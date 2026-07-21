---
layout: page
title: Blog
description: "게시글을 검색하고 카테고리, 태그, 시리즈별로 탐색합니다."
permalink: /blog/
show_sidebar: true
prose: false
page_script: /assets/js/blog-filter.js
---

{% assign settings = site.data.site %}
{% assign category_options = site.categories | sort %}
{% assign configured_categories = site.data.categories | sort: 'order' %}
{% assign tag_options = site.tags | sort %}
{% assign series_options = site.posts | map: 'series' | compact | uniq | sort %}
{% assign pinned_posts = site.posts | where: 'pinned', true %}
{% assign regular_posts = site.posts | where_exp: 'post', 'post.pinned != true' %}

<section class="listing-section filter-page"
         aria-labelledby="blog-list-title"
         data-filter-root
         data-filter-kind="posts"
         data-per-page="{{ settings.posts_per_page | default: 8 }}">
  <div class="listing-summary">
    <h2 id="blog-list-title">전체 게시글</h2>
    <p><strong data-result-count>{{ site.posts.size }}</strong>개의 글</p>
  </div>

  {% if site.posts.size > 0 %}
    <form class="filter-form" action="{{ '/blog/' | relative_url }}" method="get" role="search" data-filter-form>
      <div class="filter-field filter-field-search">
        <label for="blog-filter-query">목록에서 검색</label>
        <input id="blog-filter-query" name="q" type="search" autocomplete="off" placeholder="제목, 설명, 태그 검색" data-filter-query>
      </div>
      <div class="filter-field">
        <label for="blog-filter-category">카테고리</label>
        <select id="blog-filter-category" name="category" data-filter-category>
          <option value="">전체 카테고리</option>
          {% assign rendered_categories = '|' %}
          {% for category_meta in configured_categories %}
            {% assign category_name = category_meta.name | strip %}
            {% assign category_posts = site.categories[category_name] %}
            {% if category_name != '' and category_posts.size > 0 %}
              <option value="{{ category_name | escape }}">{{ category_name | escape }} ({{ category_posts.size }})</option>
              {% capture rendered_categories %}{{ rendered_categories }}{{ category_name }}|{% endcapture %}
            {% endif %}
          {% endfor %}
          {% for category in category_options %}
            {% capture category_token %}|{{ category[0] }}|{% endcapture %}
            {% unless rendered_categories contains category_token %}<option value="{{ category[0] | escape }}">{{ category[0] | escape }} ({{ category[1].size }})</option>{% endunless %}
          {% endfor %}
        </select>
      </div>
      <div class="filter-field">
        <label for="blog-filter-tag">태그</label>
        <select id="blog-filter-tag" name="tag" data-filter-tag>
          <option value="">전체 태그</option>
          {% for tag in tag_options %}
            <option value="{{ tag[0] | escape }}">{{ tag[0] | escape }} ({{ tag[1].size }})</option>
          {% endfor %}
        </select>
      </div>
      <div class="filter-field">
        <label for="blog-filter-series">시리즈</label>
        <select id="blog-filter-series" name="series" data-filter-series>
          <option value="">전체 시리즈</option>
          {% for series_name in series_options %}
            {% if series_name and series_name != '' %}
              {% assign series_posts = site.posts | where: 'series', series_name %}
              <option value="{{ series_name | escape }}">{{ series_name | escape }} ({{ series_posts.size }})</option>
            {% endif %}
          {% endfor %}
        </select>
      </div>
      <div class="filter-field">
        <label for="blog-filter-sort">정렬</label>
        <select id="blog-filter-sort" name="sort" data-filter-sort>
          <option value="newest">최신순</option>
          <option value="oldest">오래된 순</option>
          <option value="title">제목순</option>
        </select>
      </div>
      <div class="filter-actions">
        <button class="button button-primary" type="submit">적용</button>
        <a class="button button-secondary" href="{{ '/blog/' | relative_url }}" data-filter-reset>필터 초기화</a>
      </div>
    </form>

    <noscript>
      <p class="notice-text">필터와 페이지 나누기는 JavaScript를 사용할 때 적용됩니다. 아래에는 모든 공개 게시글이 표시됩니다.</p>
    </noscript>

    <div class="active-filters" data-active-filters aria-live="polite" hidden></div>
    <div class="post-list" data-filter-list>
      {% for post in pinned_posts %}
        {% assign searchable_description = post.description | default: post.excerpt | strip_html | strip_newlines | normalize_whitespace %}
        <div class="filter-entry is-pinned"
             data-filter-item
             data-title="{{ post.title | downcase | escape }}"
             data-search="{{ post.title | append: ' ' | append: searchable_description | append: ' ' | append: post.series | append: ' ' | append: post.categories | append: ' ' | append: post.tags | downcase | escape }}"
             data-categories="{{ post.categories | join: '||' | escape }}"
             data-tags="{{ post.tags | join: '||' | escape }}"
             data-series="{{ post.series | default: '' | escape }}"
             data-date="{{ post.date | date_to_xmlschema }}"
             data-pinned="true">
          <p class="entry-kicker">고정 게시글</p>
          {% include post-card.html post=post %}
        </div>
      {% endfor %}
      {% for post in regular_posts %}
        {% assign searchable_description = post.description | default: post.excerpt | strip_html | strip_newlines | normalize_whitespace %}
        <div class="filter-entry"
             data-filter-item
             data-title="{{ post.title | downcase | escape }}"
             data-search="{{ post.title | append: ' ' | append: searchable_description | append: ' ' | append: post.series | append: ' ' | append: post.categories | append: ' ' | append: post.tags | downcase | escape }}"
             data-categories="{{ post.categories | join: '||' | escape }}"
             data-tags="{{ post.tags | join: '||' | escape }}"
             data-series="{{ post.series | default: '' | escape }}"
             data-date="{{ post.date | date_to_xmlschema }}"
             data-pinned="false">
          {% include post-card.html post=post %}
        </div>
      {% endfor %}
    </div>

    <div class="empty-state" data-filter-empty role="status" hidden>
      <p>선택한 검색어와 필터에 맞는 게시글이 없습니다.</p>
      <a class="button button-secondary" href="{{ '/blog/' | relative_url }}" data-filter-reset>전체 필터 초기화</a>
    </div>

    <nav class="pagination" aria-label="게시글 페이지" data-pagination hidden>
      <a href="{{ '/blog/' | relative_url }}" data-page-first>처음</a>
      <button type="button" data-page-previous>이전</button>
      <span data-page-status aria-live="polite"></span>
      <button type="button" data-page-next>다음</button>
      <a href="{{ '/blog/' | relative_url }}" data-page-last>마지막</a>
    </nav>
  {% else %}
    <div class="empty-state" role="status">
      <p>아직 등록된 글이 없습니다.</p>
      <a class="button button-secondary" href="{{ '/about/' | relative_url }}">블로그 소개 보기</a>
    </div>
  {% endif %}
</section>
