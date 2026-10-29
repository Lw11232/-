/* ══════════════════════════════════════════════════════════════
   bg.js — 首页背景视频播放器
   · 开场自动播放第一个作品的循环片段
   · 鼠标悬停作品名 → 切换到该作品片段（循环）
   · 鼠标离开 → 回到当前作品片段
   无遮罩层，画面原色直出
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var video = document.getElementById('bgVideo');
  var stage = document.getElementById('stage');
  if (!video) return;

  var works = [];
  var currentSlug = '';      // 当前正在放的
  var pending = null;        // 待切换的（防抖用）
  var hasReal = false;

  /* ── 载入清单 ── */
  fetch('./assets/works.json')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      works = d;
      var c = document.getElementById('workCount');
      if (c) c.textContent = (d.length < 10 ? '0' : '') + d.length;

      // 开场：播放第一个作品
      if (works.length) play(works[0].loop);
      window.__worksReady = true;
    })
    .catch(function () { works = []; });

  /* ── 核心：切到某个片段 ── */
  function play(src) {
    if (!src || src === currentSlug) return;
    currentSlug = src;

    video.src = src;
    video.load();
    video.classList.add('is-active');

    var p = video.play();
    if (p && p.catch) p.catch(function () {
      // 自动播放被拦截时（浏览器策略），静音重试
      video.muted = true;
      var p2 = video.play();
      if (p2 && p2.catch) p2.catch(function () {});
    });

    video.addEventListener('loadeddata', function () {
      if (stage) stage.classList.add('has-video');
      hasReal = true;
    }, { once: true });
  }

  /* ── hover 切换 ── */
  function findLoop(key) {
    for (var i = 0; i < works.length; i++) {
      if (works[i].key === key) return works[i].loop;
    }
    return null;
  }

  var hoverTimer = null;

  document.addEventListener('mouseover', function (e) {
    var link = e.target.closest && e.target.closest('.works__link');
    if (!link) return;
    var loop = findLoop(link.dataset.key);
    if (!loop) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () { play(loop); }, 90);
  });

  /* ── 离开名单区：回到该条目自身的片段 ── */
  document.addEventListener('mouseout', function (e) {
    var to = e.relatedTarget;
    if (to && to.closest && to.closest('.works')) return;
    clearTimeout(hoverTimer);
  });

  /* ── 页面隐藏时暂停，省资源 ── */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { video.pause(); }
    else { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
  });

  /* ── 点击作品时，背景跟随该作品 ── */
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('.works__link');
    if (!link) return;
    var loop = findLoop(link.dataset.key);
    if (loop) play(loop);
  });

  window.__playLoop = play;
})();