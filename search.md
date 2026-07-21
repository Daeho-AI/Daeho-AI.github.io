---
layout: page
title: Search
description: "사이트의 공개 게시글과 프로젝트를 검색합니다."
permalink: /search/
noindex: true
sitemap: false
prose: false
---

{% assign searchable_post_count = 0 %}
{% for post in site.posts %}{% unless post.search_exclude == true or post.noindex == true or post.published == false %}{% assign searchable_post_count = searchable_post_count | plus: 1 %}{% endunless %}{% endfor %}
{% assign searchable_project_count = 0 %}
{% for project in site.projects %}{% unless project.published == false or project.search_exclude == true or project.noindex == true %}{% assign searchable_project_count = searchable_project_count | plus: 1 %}{% endunless %}{% endfor %}

{% if site.data.site.features.search %}
  <section class="search-page" data-search-page data-search-index-url="{{ '/search.json' | relative_url }}">
    <form class="search-form" action="{{ '/search/' | relative_url }}" method="get" role="search" data-search-page-form>
      <label for="search-page-input">검색어</label>
      <div class="search-input-wrap">
        <input id="search-page-input" name="q" type="search" autocomplete="off" placeholder="제목, 카테고리, 태그, 본문 검색" data-search-page-input>
        <button class="button button-primary" type="submit">검색</button>
      </div>
    </form>
    <div class="search-results" data-search-page-results aria-live="polite" aria-atomic="false"></div>

    <div class="search-fallback" data-search-fallback>
      <h2>검색 가능한 콘텐츠</h2>
      {% if searchable_post_count > 0 or searchable_project_count > 0 %}
        <ul class="simple-post-list">
          {% for post in site.posts %}{% unless post.search_exclude == true or post.noindex == true or post.published == false %}<li><span>게시글</span><a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a></li>{% endunless %}{% endfor %}
          {% for project in site.projects %}{% unless project.published == false or project.search_exclude == true or project.noindex == true %}<li><span>프로젝트</span><a href="{{ project.url | relative_url }}">{{ project.title | escape }}</a></li>{% endunless %}{% endfor %}
        </ul>
      {% else %}
        <div class="empty-state"><p>아직 검색할 수 있는 공개 콘텐츠가 없습니다.</p></div>
      {% endif %}
    </div>
    <noscript><p class="notice-text">JavaScript 검색을 사용할 수 없어 위에 전체 검색 대상 링크를 표시했습니다.</p></noscript>
  </section>
{% else %}
  <div class="empty-state"><p>사이트 검색 기능이 현재 비활성화되어 있습니다.</p><a class="button button-secondary" href="{{ '/blog/' | relative_url }}">전체 게시글 보기</a></div>
{% endif %}
