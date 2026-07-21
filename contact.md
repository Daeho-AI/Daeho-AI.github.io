---
layout: page
title: Contact
description: "공개된 연락 채널을 확인할 수 있습니다."
permalink: /contact/
prose: false
---

{% assign profile = site.data.profile %}
{% assign email = profile.email | default: '' | strip %}
{% assign github = profile.github | default: '' | strip %}
{% assign linkedin = profile.linkedin | default: '' | strip %}

<section class="contact-section" aria-labelledby="contact-channels-title">
  <h2 id="contact-channels-title">연락 채널</h2>
  {% if profile.availability and profile.availability != '' %}
    <p class="contact-availability"><strong>현재 상태</strong> {{ profile.availability | escape }}</p>
  {% endif %}
  {% if email != '' or github != '' or linkedin != '' %}
    <div class="contact-actions">
      {% if email != '' %}
        <a class="button button-primary" href="mailto:{{ email | escape }}">이메일 보내기</a>
      {% endif %}
      {% if github != '' %}
        <a class="button button-secondary" href="{{ github | escape }}" target="_blank" rel="noopener noreferrer">GitHub</a>
      {% endif %}
      {% if linkedin != '' %}
        <a class="button button-secondary" href="{{ linkedin | escape }}" target="_blank" rel="noopener noreferrer">LinkedIn</a>
      {% endif %}
    </div>
  {% else %}
    <div class="empty-state" role="status">
      <p>아직 공개된 연락처가 없습니다.</p>
    </div>
  {% endif %}
</section>

<!-- 이 페이지의 안내 문구는 Markdown으로 자유롭게 추가하거나 수정할 수 있습니다. -->
