---
layout: page
title: Blog
description: "최근 게시글을 최신순으로 확인할 수 있습니다."
permalink: /blog/
show_sidebar: true
prose: false
---

<section class="listing-section" aria-label="전체 게시글">
  {% if site.posts.size > 0 %}
    <div class="post-list">
      {% for post in site.posts %}
        {% include post-card.html post=post %}
      {% endfor %}
    </div>
  {% else %}
    <div class="empty-state" role="status">
      <p>아직 등록된 글이 없습니다.</p>
    </div>
  {% endif %}
</section>
