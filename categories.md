---
layout: page
title: Categories
description: "게시글을 주제별로 찾아봅니다."
permalink: /categories/
prose: false
---

{% assign categories = site.categories | sort %}
{% assign configured_categories = site.data.categories | sort: 'order' %}
{% if categories.size > 0 %}
  <div class="taxonomy-index" data-taxonomy-index="categories">
    <p class="taxonomy-summary">{{ categories.size }}개 카테고리 · {{ site.posts.size }}개 게시글</p>
    {% assign rendered_categories = '|' %}
    {% assign category_index = 0 %}
    {% for category_meta in configured_categories %}
      {% assign category_name = category_meta.name | strip %}
      {% assign category_posts = site.categories[category_name] %}
      {% if category_name != '' and category_posts.size > 0 %}
        {% assign category_index = category_index | plus: 1 %}
        {% include category-index-section.html name=category_name posts=category_posts meta=category_meta index=category_index %}
        {% capture rendered_categories %}{{ rendered_categories }}{{ category_name }}|{% endcapture %}
      {% endif %}
    {% endfor %}
    {% for category in categories %}
      {% capture category_token %}|{{ category[0] }}|{% endcapture %}
      {% unless rendered_categories contains category_token %}
        {% assign category_index = category_index | plus: 1 %}
        {% assign fallback_category_name = category[0] %}
        {% assign fallback_category_posts = category[1] %}
        {% include category-index-section.html name=fallback_category_name posts=fallback_category_posts index=category_index %}
      {% endunless %}
    {% endfor %}
  </div>
{% else %}
  <div class="empty-state" role="status">
    <p>아직 등록된 카테고리가 없습니다.</p>
    <a class="button button-secondary" href="{{ '/blog/' | relative_url }}">전체 게시글 보기</a>
  </div>
{% endif %}
