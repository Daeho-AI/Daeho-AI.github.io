---
layout: null
permalink: /service-worker.js
sitemap: false
---
"use strict";

const CACHE_PREFIX = "daeho-blog-";
const CACHE_NAME = `${CACHE_PREFIX}{{ site.time | date: '%s' }}`;
const OFFLINE_URL = "{{ '/' | relative_url }}";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "{{ '/assets/css/main.css' | relative_url }}",
  "{{ '/assets/css/syntax.css' | relative_url }}",
  "{{ '/assets/js/main.js' | relative_url }}",
  "{{ '/assets/images/favicon.svg' | relative_url }}",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") return caches.match(OFFLINE_URL);
        return Response.error();
      }),
  );
});
