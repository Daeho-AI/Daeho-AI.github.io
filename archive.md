---
layout: page
title: Archive
description: "공개된 게시글을 연도와 월 순서로 모아 봅니다."
permalink: /archive/
prose: false
---

{% if site.posts.size > 0 %}
  {% assign current_year = site.time | date: '%Y' %}
  {% assign posts_by_year = site.posts | group_by_exp: 'post', 'post.date | date: "%Y"' %}
  <section class="archive-section" aria-labelledby="archive-timeline-title">
    <div class="listing-summary">
      <h2 id="archive-timeline-title">연도별 게시글</h2>
      <p>전체 {{ site.posts.size }}개</p>
    </div>
    <div class="archive-timeline">
      {% for year in posts_by_year %}
        <details class="archive-year"{% if year.name == current_year or forloop.first %} open{% endif %}>
          <summary>
            <span>{{ year.name }}년</span>
            <span class="item-count">{{ year.items.size }}개</span>
          </summary>
          {% assign posts_by_month = year.items | group_by_exp: 'post', 'post.date | date: "%m"' %}
          {% for month in posts_by_month %}
            <section class="archive-month" aria-labelledby="archive-{{ year.name }}-{{ month.name }}">
              <h3 id="archive-{{ year.name }}-{{ month.name }}">{{ month.name }}월 <span class="item-count">{{ month.items.size }}</span></h3>
              <ol class="archive-post-list">
                {% for post in month.items %}
                  <li>
                    <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: '%m.%d' }}</time>
                    <div>
                      <a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
                      <div class="archive-entry-meta">
                        {% if post.categories and post.categories.size > 0 %}
                          <span>
                            {% for category in post.categories %}
                              <a href="{{ '/blog/' | relative_url }}?category={{ category | url_encode }}">{{ category | escape }}</a>{% unless forloop.last %}, {% endunless %}
                            {% endfor %}
                          </span>
                        {% endif %}
                        {% if post.series and post.series != '' %}
                          <a href="{{ '/blog/' | relative_url }}?series={{ post.series | url_encode }}">{{ post.series | escape }}</a>
                        {% endif %}
                      </div>
                    </div>
                  </li>
                {% endfor %}
              </ol>
            </section>
          {% endfor %}
        </details>
      {% endfor %}
    </div>
  </section>
{% else %}
  <div class="empty-state" role="status">
    <p>아직 보관된 게시글이 없습니다.</p>
    <a class="button button-secondary" href="{{ '/blog/' | relative_url }}">블로그로 이동</a>
  </div>
{% endif %}
