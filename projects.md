---
layout: page
title: Projects
description: "공개된 프로젝트를 상태와 기술별로 탐색합니다."
permalink: /projects/
show_sidebar: true
prose: false
page_script: /assets/js/project-filter.js
---

{% assign published_projects = site.projects | where_exp: 'project', 'project.published != false' %}
{% assign featured_projects = published_projects | where: 'featured', true | sort: 'order' %}
{% assign regular_projects = published_projects | where_exp: 'project', 'project.featured != true' | sort: 'order' %}

<section class="listing-section filter-page"
         aria-labelledby="project-list-title"
         data-filter-root
         data-filter-kind="projects"
         data-per-page="{{ site.data.site.posts_per_page | default: 8 }}">
  <div class="listing-summary">
    <h2 id="project-list-title">전체 프로젝트</h2>
    <p><strong data-result-count>{{ published_projects.size }}</strong>개의 프로젝트</p>
  </div>

  {% if published_projects.size > 0 %}
    <form class="filter-form" action="{{ '/projects/' | relative_url }}" method="get" role="search" data-filter-form>
      <div class="filter-field filter-field-search">
        <label for="project-filter-query">프로젝트 검색</label>
        <input id="project-filter-query" name="q" type="search" autocomplete="off" placeholder="이름, 역할, 기술 검색" data-filter-query>
      </div>
      <div class="filter-field">
        <label for="project-filter-status">상태</label>
        <select id="project-filter-status" name="status" data-filter-status>
          <option value="">전체 상태</option>
          {% assign seen_statuses = '|' %}
          {% for project in published_projects %}
            {% assign project_status = project.status | default: '' | strip %}
            {% if project_status != '' %}
              {% capture status_token %}|{{ project_status }}|{% endcapture %}
              {% unless seen_statuses contains status_token %}
                <option value="{{ project_status | escape }}">{{ project_status | escape }}</option>
                {% capture seen_statuses %}{{ seen_statuses }}{{ project_status }}|{% endcapture %}
              {% endunless %}
            {% endif %}
          {% endfor %}
        </select>
      </div>
      <div class="filter-field">
        <label for="project-filter-technology">기술</label>
        <select id="project-filter-technology" name="technology" data-filter-technology>
          <option value="">전체 기술</option>
          {% assign seen_technologies = '|' %}
          {% for project in published_projects %}
            {% for technology in project.technologies %}
              {% assign technology_name = technology | strip %}
              {% if technology_name != '' %}
                {% capture technology_token %}|{{ technology_name }}|{% endcapture %}
                {% unless seen_technologies contains technology_token %}
                  <option value="{{ technology_name | escape }}">{{ technology_name | escape }}</option>
                  {% capture seen_technologies %}{{ seen_technologies }}{{ technology_name }}|{% endcapture %}
                {% endunless %}
              {% endif %}
            {% endfor %}
          {% endfor %}
        </select>
      </div>
      <div class="filter-field">
        <label for="project-filter-sort">정렬</label>
        <select id="project-filter-sort" name="sort" data-filter-sort>
          <option value="featured">추천·순서순</option>
          <option value="period">최근 기간순</option>
          <option value="title">제목순</option>
        </select>
      </div>
      <div class="filter-actions">
        <button class="button button-primary" type="submit">적용</button>
        <a class="button button-secondary" href="{{ '/projects/' | relative_url }}" data-filter-reset>필터 초기화</a>
      </div>
    </form>

    <noscript>
      <p class="notice-text">필터와 정렬은 JavaScript를 사용할 때 적용됩니다. 아래에는 모든 공개 프로젝트가 표시됩니다.</p>
    </noscript>

    <div class="active-filters" data-active-filters aria-live="polite" hidden></div>
    <div class="project-list" data-filter-list>
      {% for project in featured_projects %}
        <div class="filter-entry is-featured"
             data-filter-item
             data-title="{{ project.title | downcase | escape }}"
             data-search="{{ project.title | append: ' ' | append: project.summary | append: ' ' | append: project.role | append: ' ' | append: project.technologies | downcase | escape }}"
             data-status="{{ project.status | default: '' | escape }}"
             data-technologies="{{ project.technologies | join: '||' | escape }}"
             data-period="{{ project.period | default: '' | escape }}"
             data-order="{{ project.order | default: 9999 }}"
             data-featured="true">
          <p class="entry-kicker">추천 프로젝트</p>
          {% include project-card.html project=project %}
        </div>
      {% endfor %}
      {% for project in regular_projects %}
        <div class="filter-entry"
             data-filter-item
             data-title="{{ project.title | downcase | escape }}"
             data-search="{{ project.title | append: ' ' | append: project.summary | append: ' ' | append: project.role | append: ' ' | append: project.technologies | downcase | escape }}"
             data-status="{{ project.status | default: '' | escape }}"
             data-technologies="{{ project.technologies | join: '||' | escape }}"
             data-period="{{ project.period | default: '' | escape }}"
             data-order="{{ project.order | default: 9999 }}"
             data-featured="false">
          {% include project-card.html project=project %}
        </div>
      {% endfor %}
    </div>

    <div class="empty-state" data-filter-empty role="status" hidden>
      <p>선택한 조건에 맞는 프로젝트가 없습니다.</p>
      <a class="button button-secondary" href="{{ '/projects/' | relative_url }}" data-filter-reset>전체 필터 초기화</a>
    </div>
    <nav class="pagination" aria-label="프로젝트 페이지" data-pagination hidden>
      <a href="{{ '/projects/' | relative_url }}" data-page-first>처음</a>
      <button type="button" data-page-previous>이전</button>
      <span data-page-status aria-live="polite"></span>
      <button type="button" data-page-next>다음</button>
      <a href="{{ '/projects/' | relative_url }}" data-page-last>마지막</a>
    </nav>
  {% else %}
    <div class="empty-state" role="status">
      <p>공개된 프로젝트를 준비 중입니다.</p>
      <a class="button button-secondary" href="{{ '/about/' | relative_url }}">소개 보기</a>
    </div>
  {% endif %}
</section>
