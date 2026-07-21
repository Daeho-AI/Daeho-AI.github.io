---
layout: page
title: Privacy
description: "이 사이트의 브라우저 저장 기능과 선택적 외부 서비스를 설명합니다."
permalink: /privacy/
---

{% assign settings = site.data.site %}
{% assign integrations = site.data.integrations %}
{% assign giscus_ready = false %}
{% if settings.features.comments and integrations.giscus.enabled and integrations.giscus.repo != '' and integrations.giscus.repo_id != '' and integrations.giscus.category != '' and integrations.giscus.category_id != '' %}{% assign giscus_ready = true %}{% endif %}
{% assign analytics_ready = false %}
{% if settings.features.analytics and integrations.analytics.enabled %}
  {% if integrations.analytics.provider == 'google' and integrations.analytics.google_measurement_id != '' %}{% assign analytics_ready = true %}{% endif %}
  {% if integrations.analytics.provider == 'umami' and integrations.analytics.umami_script_url != '' and integrations.analytics.umami_website_id != '' %}{% assign analytics_ready = true %}{% endif %}
  {% if integrations.analytics.provider == 'plausible' and integrations.analytics.plausible_domain != '' and integrations.analytics.plausible_script_url != '' %}{% assign analytics_ready = true %}{% endif %}
{% endif %}

## 브라우저에 저장되는 설정

- 선택한 화면 테마는 다음 방문에도 유지할 수 있도록 `localStorage`에 저장됩니다.
{% if settings.features.bookmarks %}- 북마크한 게시글 주소는 현재 브라우저의 `localStorage`에 저장됩니다.{% endif %}
{% if settings.features.recently_viewed %}- 최근 본 게시글 기록은 현재 브라우저의 `localStorage`에 최대 5개 저장됩니다.{% endif %}
{% if settings.features.search %}- 최근 검색어는 현재 브라우저의 `localStorage`에 최대 5개 저장할 수 있습니다.{% endif %}

브라우저 설정에서 사이트 데이터를 지우면 위 기록도 함께 삭제됩니다. 이 정보는 브라우저 간에 동기화되지 않습니다.

## 소유자 편집 모드

`?edit=1` 또는 소유자 단축키로 편집 모드를 연 경우에만 로그인 세션 식별자가 `sessionStorage`에 임시 저장됩니다. GitHub 액세스 토큰은 공개 페이지의 브라우저 저장소에 저장되지 않습니다.

## 댓글

{% if giscus_ready %}
댓글을 활성화한 게시글에서는 Giscus가 로드될 수 있으며, 댓글 작성 과정에는 GitHub의 개인정보 처리 조건이 적용됩니다.
{% else %}
현재 외부 댓글 서비스는 활성화되어 있지 않으며 댓글 스크립트나 빈 댓글 영역을 불러오지 않습니다.
{% endif %}

## 분석 도구

{% if analytics_ready %}
현재 설정된 분석 도구는 사용자가 동의한 경우에만 로드됩니다. 동의 선택은 브라우저에 저장할 수 있으며, 브라우저의 추적 방지 기능이 외부 요청을 추가로 제한할 수 있습니다.
{% else %}
현재 외부 분석 도구는 활성화되어 있지 않으며 방문 통계를 위한 외부 분석 스크립트를 불러오지 않습니다.
{% endif %}

## 외부 링크와 문의

외부 링크를 열면 해당 서비스의 개인정보 처리 방침이 적용됩니다. 공개된 문의 채널은 [Contact 페이지]({{ '/contact/' | relative_url }})에서 확인할 수 있습니다.
