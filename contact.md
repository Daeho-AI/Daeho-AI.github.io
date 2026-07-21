---
layout: page
title: Contact
description: "현재 공개된 연락 채널을 확인합니다."
permalink: /contact/
prose: false
---

{% assign profile = site.data.profile %}
{% assign integrations = site.data.integrations %}
{% assign email = profile.email | default: '' | strip %}
{% assign github = profile.github | default: '' | strip %}
{% assign linkedin = profile.linkedin | default: '' | strip %}
{% assign contact_form_url = integrations.contact_form_url | default: '' | strip %}
{% assign contact_form_prefix = contact_form_url | slice: 0, 8 %}

<section class="contact-section" aria-labelledby="contact-channels-title">
  <h2 id="contact-channels-title">연락 채널</h2>
  {% if profile.availability and profile.availability != '' %}
    <p class="contact-availability"><strong>현재 상태</strong> {{ profile.availability | escape }}</p>
  {% endif %}
  {% if profile.location and profile.location != '' %}
    <p><strong>위치</strong> {{ profile.location | escape }}</p>
  {% endif %}

  {% if email != '' or github != '' or linkedin != '' %}
    <div class="contact-actions">
      {% if email != '' %}<a class="button button-primary" href="mailto:{{ email | escape }}">이메일 보내기</a>{% endif %}
      {% if github != '' %}<a class="button button-secondary" href="{{ github | escape }}" target="_blank" rel="noopener noreferrer">GitHub</a>{% endif %}
      {% if linkedin != '' %}<a class="button button-secondary" href="{{ linkedin | escape }}" target="_blank" rel="noopener noreferrer">LinkedIn</a>{% endif %}
    </div>
  {% else %}
    <div class="empty-state" role="status"><p>아직 공개된 직접 연락처가 없습니다.</p></div>
  {% endif %}
</section>

{% if contact_form_url != '' and contact_form_prefix == 'https://' %}
  <section class="contact-section" aria-labelledby="contact-form-title">
    <h2 id="contact-form-title">외부 문의 양식</h2>
    <p>외부 서비스의 개인정보 처리 방침을 확인한 뒤 문의해 주세요.</p>
    <a class="button button-secondary" href="{{ contact_form_url | escape }}" target="_blank" rel="noopener noreferrer">문의 양식 열기</a>
  </section>
{% endif %}

<!-- 확인된 연락 안내가 더 필요하면 이 아래에 Markdown으로 추가하세요. -->
