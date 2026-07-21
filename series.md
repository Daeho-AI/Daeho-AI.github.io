---
layout: page
title: Series
description: "연속된 게시글을 시리즈 순서대로 읽습니다."
permalink: /series/
prose: false
---

{% assign series_names = site.posts | map: 'series' | compact | uniq | sort %}
{% assign series_count = 0 %}
{% for series_name in series_names %}{% if series_name and series_name != '' %}{% assign series_count = series_count | plus: 1 %}{% endif %}{% endfor %}
{% if series_count > 0 %}
  <div class="series-index">
    <p class="taxonomy-summary">{{ series_count }}개 시리즈</p>
    {% for series_name in series_names %}
      {% if series_name and series_name != '' %}
        {% assign series_posts = site.posts | where: 'series', series_name | sort: 'series_order' %}
        <section class="series-section" id="series-{{ forloop.index }}">
          <header class="taxonomy-heading">
            <h2>{{ series_name | escape }}</h2>
            <a href="{{ '/blog/' | relative_url }}?series={{ series_name | url_encode }}">전체 {{ series_posts.size }}개 보기</a>
          </header>
          <ol class="series-post-list">
            {% for post in series_posts %}
              <li>
                <span class="series-order">{% if post.series_order %}{{ post.series_order }}{% else %}{{ forloop.index }}{% endif %}</span>
                <div><a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a><time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: site.data.site.date_format | default: '%Y.%m.%d' }}</time></div>
              </li>
            {% endfor %}
          </ol>
        </section>
      {% endif %}
    {% endfor %}
  </div>
{% else %}
  <div class="empty-state" role="status">
    <p>아직 등록된 시리즈가 없습니다.</p>
    <a class="button button-secondary" href="{{ '/blog/' | relative_url }}">전체 게시글 보기</a>
  </div>
{% endif %}
