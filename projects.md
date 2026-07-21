---
layout: page
title: Projects
description: "진행했거나 공개한 프로젝트를 모아 보는 페이지입니다."
permalink: /projects/
show_sidebar: true
prose: false
---

{% assign empty_projects = '' | split: '' %}
{% assign ordered_projects = empty_projects %}
{% if site.projects %}
  {% assign ordered_projects = site.projects | sort: 'order' %}
{% endif %}
<section class="listing-section" aria-label="전체 프로젝트">
  {% if ordered_projects.size > 0 %}
    <div class="project-list">
      {% for project in ordered_projects %}
        {% include project-card.html project=project %}
      {% endfor %}
    </div>
  {% else %}
    <div class="empty-state" role="status">
      <p>프로젝트를 준비 중입니다.</p>
    </div>
  {% endif %}
</section>
