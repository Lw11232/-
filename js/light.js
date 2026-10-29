/* ══════════════════════════════════════════════════════════════
   light.js — 浅色版交互
   · 十字靶心光标（difference 混合，亮暗底都可见）
   · 作品卡指针高光（card glow）
   · 菜单面板 / 顶栏滚动态 / Hero 主视觉视差 / 滚动入场
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* ── 年份 ── */
  var y = $('#yearNow');
  if (y) y.textContent = new Date().getFullYear();

  /* ── 顶栏滚动态 ── */
  var nav = $('.navbar');
  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    if (nav) nav.classList.toggle('is-scrolled', y > 24);
    document.body.classList.toggle('is-scrolled', y > 40);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── 菜单面板 ── */
  var menu = $('#menu');
  var openBtn = $('#menuOpen');
  function setMenu(open) {
    if (!menu) return;
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if (openBtn) openBtn.addEventListener('click', function () { setMenu(true); });
  $$('[data-menu-close]').forEach(function (el) {
    el.addEventListener('click', function () { setMenu(false); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenu(false);
  });

  var fine = window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches;

  /* ── 十字靶心光标 ── */
  var cursor = $('#cursor');
  if (cursor && fine) {
    var cx = 0, cy = 0, curX = 0, curY = 0;
    var scale = 1, targetScale = 1, raf = 0, seen = false;

    document.body.classList.add('has-cursor');

    window.addEventListener('pointermove', function (e) {
      cx = e.clientX; cy = e.clientY;
      if (!seen) { seen = true; curX = cx; curY = cy; }
      var t = e.target;
      targetScale = (t && t.closest && t.closest('a,button,.work-card,.tabs button')) ? 1.55 : 1;
      start();
    }, { passive: true });

    function start() { if (!raf) raf = requestAnimationFrame(tick); }
    function tick() {
      raf = 0;
      curX += (cx - curX) * 0.3;
      curY += (cy - curY) * 0.3;
      scale += (targetScale - scale) * 0.22;
      cursor.style.transform = 'translate3d(' + curX.toFixed(1) + 'px,' + curY.toFixed(1) + 'px,0) scale(' + scale.toFixed(3) + ')';
      if (Math.abs(cx - curX) > 0.2 || Math.abs(cy - curY) > 0.2 || Math.abs(targetScale - scale) > 0.005) start();
    }
  }

  /* ── 作品卡指针高光 ── */
  var glowRaf = 0, glowCard = null, glowX = 0, glowY = 0;
  document.addEventListener('pointermove', function (e) {
    if (!e.target.closest) return;
    var card = e.target.closest('.work-card');
    if (!card) return;
    var media = card.querySelector('.work-media');
    if (!media) return;
    glowCard = media; glowX = e.clientX; glowY = e.clientY;
    if (!glowRaf) glowRaf = requestAnimationFrame(applyGlow);
  }, { passive: true });

  function applyGlow() {
    glowRaf = 0;
    if (!glowCard) return;
    var r = glowCard.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var mx = (glowX - r.left) / r.width * 100;
    var my = (glowY - r.top) / r.height * 100;
    glowCard.style.setProperty('--mx', mx.toFixed(1) + '%');
    glowCard.style.setProperty('--my', my.toFixed(1) + '%');
  }

  /* ── Hero 主视觉轻微视差 ── */
  var hero = $('.hero'), hv = $('.hero-visual');
  if (hero && hv && fine) {
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      var dx = (e.clientX - r.left) / r.width - 0.5;
      var dy = (e.clientY - r.top) / r.height - 0.5;
      hv.style.transform = 'translate3d(' + (dx * -12).toFixed(1) + 'px,' + (dy * -8).toFixed(1) + 'px,0)';
    }, { passive: true });
    hero.addEventListener('pointerleave', function () { hv.style.transform = ''; });
  }

  /* ── 滚动入场 ── */
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) {
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }) : null;

  var REVEAL = '.work-card, .skill-card, .profile-card, .section-header, .about-copy, .footer__left, .footer__right';

  function observeAll() {
    if (!io) return;
    $$(REVEAL).forEach(function (el) {
      if (el.dataset.rv) return;
      el.dataset.rv = '1';
      el.classList.add('reveal');
      io.observe(el);
    });
  }
  observeAll();

  var grid = $('#galGrid');
  if (grid && 'MutationObserver' in window) {
    new MutationObserver(observeAll).observe(grid, { childList: true });
  }
  setTimeout(observeAll, 700);
  setTimeout(observeAll, 1800);
})();
