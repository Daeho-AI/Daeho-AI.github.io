---
layout: page
title: About
description: "소개와 관심 분야를 확인할 수 있습니다."
permalink: /about/
---

{% assign profile_bio = site.data.profile.bio | strip %}
{% if profile_bio != '' %}
{{ profile_bio }}
{% else %}
<div class="empty-state">
  <p>소개 내용은 아직 등록되지 않았습니다.</p>
</div>
{% endif %}

<!--
이 주석 아래에 자기소개, 관심 분야, 연구 방향, 경험, 목표 등을 Markdown으로 작성할 수 있습니다.
확인되지 않은 이력이나 성과는 실제 정보처럼 작성하지 마세요.
-->
