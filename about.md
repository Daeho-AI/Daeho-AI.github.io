---
layout: page
title: About
description: "공개된 소개와 관심 분야를 확인합니다."
permalink: /about/
prose: false
---

{% assign profile = site.data.profile %}
{% assign profile_bio = profile.bio | default: '' | strip %}
{% assign has_interests = false %}
{% if profile.interests and profile.interests.size > 0 %}{% assign has_interests = true %}{% endif %}
{% assign has_skills = false %}
{% for category in site.data.skills.categories %}
  {% if category.items and category.items.size > 0 %}{% assign has_skills = true %}{% endif %}
{% endfor %}

{% if profile_bio != '' %}
  <section class="about-section prose" aria-labelledby="about-introduction-title">
    <h2 id="about-introduction-title">소개</h2>
    {{ profile_bio | markdownify }}
  </section>
{% else %}
  <div class="empty-state" role="status">
    <p>공개된 소개 내용은 아직 등록되지 않았습니다.</p>
  </div>
{% endif %}

{% if profile.role != '' or profile.organization != '' or profile.location != '' %}
  <section class="about-section" aria-labelledby="about-profile-title">
    <h2 id="about-profile-title">프로필</h2>
    <dl class="profile-details">
      {% if profile.role and profile.role != '' %}<div><dt>역할</dt><dd>{{ profile.role | escape }}</dd></div>{% endif %}
      {% if profile.organization and profile.organization != '' %}<div><dt>소속</dt><dd>{{ profile.organization | escape }}</dd></div>{% endif %}
      {% if profile.location and profile.location != '' %}<div><dt>위치</dt><dd>{{ profile.location | escape }}</dd></div>{% endif %}
    </dl>
  </section>
{% endif %}

{% if has_interests %}
  <section class="about-section" aria-labelledby="about-interests-title">
    <h2 id="about-interests-title">관심 분야</h2>
    <ul class="tag-list">
      {% for interest in profile.interests %}<li class="tag">{{ interest | escape }}</li>{% endfor %}
    </ul>
  </section>
{% endif %}

{% if has_skills %}
  <section class="about-section" aria-labelledby="about-skills-title">
    <h2 id="about-skills-title">기술</h2>
    <div class="skill-groups">
      {% for category in site.data.skills.categories %}
        {% if category.items and category.items.size > 0 %}
          <section class="skill-group" aria-labelledby="about-skill-{{ forloop.index }}">
            <h3 id="about-skill-{{ forloop.index }}">{{ category.name | escape }}</h3>
            <ul class="tag-list">{% for skill in category.items %}<li class="tag">{{ skill | escape }}</li>{% endfor %}</ul>
          </section>
        {% endif %}
      {% endfor %}
    </div>
  </section>
{% endif %}

{% if profile.availability != '' or profile.github != '' or profile.email != '' or profile.linkedin != '' or profile.resume_url != '' %}
  <section class="about-section" aria-labelledby="about-links-title">
    <h2 id="about-links-title">연락과 링크</h2>
    {% if profile.availability and profile.availability != '' %}<p>{{ profile.availability | escape }}</p>{% endif %}
    <div class="button-row">
      {% if profile.github and profile.github != '' %}<a class="button button-primary" href="{{ profile.github | escape }}" target="_blank" rel="noopener noreferrer">GitHub</a>{% endif %}
      {% if profile.email and profile.email != '' %}<a class="button button-secondary" href="mailto:{{ profile.email | escape }}">이메일</a>{% endif %}
      {% if profile.linkedin and profile.linkedin != '' %}<a class="button button-secondary" href="{{ profile.linkedin | escape }}" target="_blank" rel="noopener noreferrer">LinkedIn</a>{% endif %}
      {% if profile.resume_url and profile.resume_url != '' %}
        {% if profile.resume_url contains '://' %}{% assign resume_href = profile.resume_url %}{% else %}{% assign resume_href = profile.resume_url | relative_url %}{% endif %}
        <a class="button button-secondary" href="{{ resume_href | escape }}"{% if profile.resume_url contains '://' %} target="_blank" rel="noopener noreferrer"{% endif %}>이력서</a>
      {% endif %}
    </div>
  </section>
{% endif %}

<!--
확인된 자기소개, 연구 방향, 주요 경험과 현재 집중 분야가 생기면 이 주석 아래에 Markdown으로 추가하세요.
확인되지 않은 이력, 소속, 성과나 수치는 실제 정보처럼 작성하지 않습니다.
-->
