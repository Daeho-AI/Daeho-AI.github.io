---
layout: page
title: Archive
description: "게시글을 연도, 카테고리, 태그별로 찾아볼 수 있습니다."
permalink: /archive/
prose: false
---

{% if site.posts.size > 0 %}
  {% assign posts_by_year = site.posts | group_by_exp: 'post', 'post.date | date: "%Y"' %}
  <section class="archive-section" aria-labelledby="archive-years-title">
    <h2 id="archive-years-title">연도별 게시글</h2>
    {% for year in posts_by_year %}
      <section class="archive-year" aria-labelledby="year-{{ year.name }}">
        <h3 id="year-{{ year.name }}">{{ year.name }} <span class="item-count">{{ year.items.size }}</span></h3>
        <ol class="archive-post-list">
          {% for post in year.items %}
            <li>
              <time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: '%m.%d' }}</time>
              <a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
              {% if post.categories and post.categories.size > 0 %}
                <span class="archive-post-category">
                  {% for category in post.categories %}{{ category | escape }}{% unless forloop.last %}, {% endunless %}{% endfor %}
                </span>
              {% endif %}
            </li>
          {% endfor %}
        </ol>
      </section>
    {% endfor %}
  </section>

  {% assign archive_categories = site.categories | sort %}
  {% assign archive_tags = site.tags | sort %}
  <div class="taxonomy-columns">
    <section class="archive-section" aria-labelledby="archive-categories-title">
      <h2 id="archive-categories-title">카테고리</h2>
      {% if archive_categories.size > 0 %}
        <div class="taxonomy-groups">
          {% for category in archive_categories %}
            <section class="taxonomy-group" id="category-{{ category[0] | slugify }}">
              <h3>{{ category[0] | escape }} <span class="item-count">{{ category[1].size }}</span></h3>
              <ul>
                {% for post in category[1] %}
                  <li><a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a></li>
                {% endfor %}
              </ul>
            </section>
          {% endfor %}
        </div>
      {% else %}
        <p class="muted-text">등록된 카테고리가 없습니다.</p>
      {% endif %}
    </section>

    <section class="archive-section" aria-labelledby="archive-tags-title">
      <h2 id="archive-tags-title">태그</h2>
      {% if archive_tags.size > 0 %}
        <div class="taxonomy-groups">
          {% for tag in archive_tags %}
            <section class="taxonomy-group" id="tag-{{ tag[0] | slugify }}">
              <h3>{{ tag[0] | escape }} <span class="item-count">{{ tag[1].size }}</span></h3>
              <ul>
                {% for post in tag[1] %}
                  <li><a href="{{ post.url | relative_url }}">{{ post.title | escape }}</a></li>
                {% endfor %}
              </ul>
            </section>
          {% endfor %}
        </div>
      {% else %}
        <p class="muted-text">등록된 태그가 없습니다.</p>
      {% endif %}
    </section>
  </div>
{% else %}
  <div class="empty-state" role="status">
    <p>아직 등록된 글이 없습니다.</p>
  </div>
{% endif %}
