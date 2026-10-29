/* ══════════════════════════════════════════════════════════════
   INTERACTIVE EDITORIAL PORTFOLIO — main.js
   零依赖 · 可离线 · 单屏不滚动
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function hex2rgb(h) {
    h = String(h || '#333').trim().replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6) return [40, 40, 40];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function mixArr(a, b, t) {
    return [Math.round(lerp(a[0], b[0], t)),
            Math.round(lerp(a[1], b[1], t)),
            Math.round(lerp(a[2], b[2], t))];
  }
  function mix(a, b, t) {
    return 'rgb(' + Math.round(lerp(a[0], b[0], t)) + ',' +
                    Math.round(lerp(a[1], b[1], t)) + ',' +
                    Math.round(lerp(a[2], b[2], t)) + ')';
  }

  /* ══════════════════════════════════════════════
     1. 视频层：真实素材探测 + hover 切换
     ══════════════════════════════════════════════ */
  var videoEngine = (function () {
    var stage = $('#stage');
    var vids = $$('.stage__vid');
    var current = 0;
    var hasReal = false;

    if (!stage || !vids.length) return null;

    // 探测真实视频是否加载成功
    function detect() {
      var ready = vids.filter(function (v) {
        return v.readyState >= 2 || (v.videoWidth && v.videoWidth > 0);
      });
      if (ready.length) {
        hasReal = true;
        stage.classList.add('has-video');
      }
    }

    vids.forEach(function (v) {
      v.addEventListener('loadeddata', detect, { once: true });
      v.addEventListener('canplay', detect, { once: true });
      if (v.readyState >= 2) detect();
    });
    // 兜底：2 秒后再判一次
    setTimeout(detect, 2000);

    function play(i) {
      if (!hasReal) return;
      vids.forEach(function (v, n) {
        if (n === i) {
          v.classList.add('is-active');
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
        } else {
          v.classList.remove('is-active');
          try { v.pause(); } catch (e) {}
        }
      });
    }

    return {
      hasReal: function () { return hasReal; },
      play: play,
      current: function () { return current; }
    };
  })();

  /* ══════════════════════════════════════════════
     2. Canvas 伪视频（无真实素材时接管）
        多镜头场景 + hover 时同步切换色调
     ══════════════════════════════════════════════ */
  (function canvasFilm() {
    var cv = $('#bg');
    if (!cv) return;
    var ctx = cv.getContext('2d', { alpha: false });

    // 预渲染噪点颗粒（电影感磨砂质感，平铺复用，避免逐帧生成开销）
    var grain = document.createElement('canvas');
    grain.width = grain.height = 160;
    (function buildGrain() {
      var gx = grain.getContext('2d');
      var img = gx.createImageData(160, 160);
      for (var i = 0; i < img.data.length; i += 4) {
        var v = (Math.random() * 255) | 0;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      gx.putImageData(img, 0, 0);
    })();
    var grainPattern = ctx.createPattern(grain, 'repeat');

    var SCENES = [
      { a: '#1a2740', b: '#4a2f4e', c: '#c9a26b' },
      { a: '#2b1d12', b: '#5c3a20', c: '#e0b070' },
      { a: '#141c1e', b: '#2f3a34', c: '#8fa39a' },
      { a: '#0f2027', b: '#1d4e5f', c: '#7fd4e8' }
    ].map(function (s) {
      return { a: hex2rgb(s.a), b: hex2rgb(s.b), c: hex2rgb(s.c) };
    });

    var sceneIdx = 0;
    var external = -1;      // hover 强制指定的场景
    var W = 0, H = 0, raf = null, started = 0;
    var tNow = 0;
    var SCENE_MS = 7000;

    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(window.innerWidth * dpr));
      H = Math.max(1, Math.round(window.innerHeight * dpr));
      cv.width = W; cv.height = H;
    }

    function silhouette(yBase, amp, freq, speed, alpha, col) {
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(0, yBase);
      for (var x = 0; x <= W; x += Math.max(1.5, W / 360)) {
        var u = x / W;
        var y = yBase
          + Math.sin(u * freq + tNow * speed) * amp
          + Math.sin(u * freq * 2.3 + tNow * speed * 1.7) * amp * 0.42
          + Math.sin(u * freq * 4.1 + tNow * speed * 0.6) * amp * 0.18;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fillStyle = rgba(col, alpha);
      ctx.fill();
    }

    function paint(sc, t) {
      tNow = t;
      var MIN = Math.min(W, H);
      var horizon = H * (0.52 + 0.06 * Math.sin(t * 0.00008 + sc.c[0]));
      var pan = (t * 0.000018) % 1.6 - 0.3;

      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, mix(sc.a, [0, 0, 0], 0.35));
      g.addColorStop(0.5, mix(sc.a, sc.b, 0.55));
      g.addColorStop(1, mix(sc.b, [0, 0, 0], 0.55));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      var lp = 0.5 + 0.3 * Math.sin(t * 0.00004);
      var lx = lp * W, ly = horizon * 0.6;
      var sun = ctx.createRadialGradient(lx, ly, 0, lx, ly, MIN * 0.62);
      sun.addColorStop(0, rgba(sc.c, 0.5));
      sun.addColorStop(0.3, rgba(sc.c, 0.18));
      sun.addColorStop(1, rgba(sc.c, 0));
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, W, H);

      silhouette(horizon - MIN * 0.06, MIN * 0.035, 2.1, 0.00006, 0.5, mixArr(sc.b, sc.c, 0.4));
      silhouette(horizon + MIN * 0.05, MIN * 0.05, 3.4 + pan * 0.6, 0.000045, 0.85, mixArr(sc.b, [0, 0, 0], 0.4));

      var fg = ctx.createLinearGradient(0, horizon + MIN * 0.06, 0, H);
      fg.addColorStop(0, mix(sc.b, [0, 0, 0], 0.45));
      fg.addColorStop(1, mix(sc.a, [0, 0, 0], 0.78));
      ctx.fillStyle = fg;
      ctx.fillRect(0, horizon + MIN * 0.06, W, H - horizon);

      // 地面柔和反光（不用硬横条，改为大面积柔和渐变）
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var rf = ctx.createRadialGradient(lx, horizon + MIN * 0.18, 0, lx, horizon + MIN * 0.18, MIN * 0.55);
      rf.addColorStop(0, rgba(sc.c, 0.10));
      rf.addColorStop(1, rgba(sc.c, 0));
      ctx.fillStyle = rf;
      ctx.fillRect(0, horizon, W, H - horizon);
      ctx.restore();

      // 极细的水面横纹，透明度极低
      ctx.save();
      ctx.globalAlpha = 0.035;
      ctx.fillStyle = mix(sc.c, [255, 255, 255], 0.4);
      for (var r = 0; r < 26; r++) {
        var u = r / 26;
        var ry = horizon + MIN * 0.08 + u * u * (H - horizon) * 0.85;
        var rw = W * (0.06 + u * 0.34);
        ctx.fillRect(lx - rw / 2, ry, rw, 1);
      }
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.05;
      for (var k = 0; k < 3; k++) {
        var bx = ((t * 0.000012 * (k + 1) + k * 0.4) % 1.3 - 0.15) * W;
        var lg = ctx.createLinearGradient(bx, 0, bx + W * 0.16, H);
        lg.addColorStop(0, rgba(sc.c, 0.7));
        lg.addColorStop(1, rgba(sc.c, 0));
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(bx, 0); ctx.lineTo(bx + W * 0.05, 0);
        ctx.lineTo(bx + W * 0.26, H); ctx.lineTo(bx + W * 0.14, H);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();

      for (var i = 0; i < 4; i++) {
        var ph = t * (0.00022 + i * 0.00007) + i * 2.1;
        var cx = (0.5 + 0.46 * Math.sin(ph)) * W;
        var cy = (0.42 + 0.4 * Math.cos(ph * 1.33 + i)) * H;
        var rr = Math.max(MIN * 0.02, (0.05 + 0.055 * Math.sin(ph * 0.8 + i)) * MIN);
        var bg2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
        bg2.addColorStop(0, rgba(sc.c, 0.24));
        bg2.addColorStop(0.72, rgba(sc.c, 0.09));
        bg2.addColorStop(0.86, rgba(mixArr(sc.c, [255, 255, 255], 0.4), 0.15));
        bg2.addColorStop(1, rgba(sc.c, 0));
        ctx.fillStyle = bg2;
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
      }

      ctx.globalAlpha = 0.022;
      ctx.fillStyle = '#fff';
      for (var y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
      ctx.globalAlpha = 1;

      // 电影感颗粒：平铺噪点，overlay 混合，极淡（强化胶片磨砂质感）
      if (grainPattern) {
        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = grainPattern;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
      // 暗角（vignette）：聚焦中心、压暗四角，强化电影质感
      ctx.save();
      var vg = ctx.createRadialGradient(
        W * 0.5, H * 0.52, Math.min(W, H) * 0.16,
        W * 0.5, H * 0.5, Math.max(W, H) * 0.78
      );
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    function loop(now) {
      if (!started) started = now;
      var t = now - started;
      var idx = reduceMotion ? 0 : Math.floor(t / SCENE_MS) % SCENES.length;
      if (external >= 0) idx = external % SCENES.length;
      sceneIdx = idx;
      paint(SCENES[sceneIdx], t);
      raf = requestAnimationFrame(loop);
    }

    size();
    if (!reduceMotion) raf = requestAnimationFrame(loop);
    else paint(SCENES[0], 0);

    window.addEventListener('resize', function () {
      size();
      if (reduceMotion) paint(SCENES[sceneIdx], 0);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = null; }
      else if (!raf && !reduceMotion) requestAnimationFrame(loop);
    });

    // 暴露给 hover 逻辑：强制某个场景
    window.__setScene = function (i) { external = (i == null) ? -1 : i; };
  })();

  /* ══════════════════════════════════════════════
     3. hover 作品 → 切换视频 / Canvas 场景
     ══════════════════════════════════════════════ */
  (function hoverSwitch() {
    var items = $$('.works__item');
    if (!items.length) return;

    items.forEach(function (item) {
      var link = $('.works__link', item);
      if (!link) return;
      var idx = parseInt(link.dataset.idx, 10) || 0;

      function enter() {
        if (videoEngine && videoEngine.hasReal()) {
          videoEngine.play(idx);
        } else if (window.__setScene) {
          window.__setScene(idx);
        }
      }

      item.addEventListener('mouseenter', enter);
      item.addEventListener('focusin', enter);
      // 点击行为交给 player.js 处理（此处不拦截）
    });

    // 鼠标离开名单区 → 回到第 0 条
    var works = $('#works');
    if (works) {
      works.addEventListener('mouseleave', function () {
        if (videoEngine && videoEngine.hasReal()) videoEngine.play(0);
        else if (window.__setScene) window.__setScene(null);
      });
    }
  })();

  /* ══════════════════════════════════════════════
     4. 面板系统：联系 / 关于 / 右栏导航 / 作品聚焦
     ══════════════════════════════════════════════ */
  (function overlaySystem() {
    var body = document.body;
    var contactBtn = $('#contactBtn');
    var contactBtnTxt = contactBtn ? (contactBtn.querySelector('.chrome__btn-txt') || contactBtn) : null;

    function Panel(el) {
      this.el = el;
      this.inner = el.querySelector('.panel__inner');
      this.open = false;
    }
    // 暗膜高度跟随面板实际内容，保证所有文字落在暗膜内
    Panel.prototype.fit = function () {
      if (this.inner) this.el.style.setProperty('--mask-h', (this.inner.offsetHeight + 44) + 'px');
    };
    Panel.prototype.set = function (v) {
      this.open = v;
      this.el.classList.toggle('is-open', v);
      this.el.setAttribute('aria-hidden', String(!v));
      body.classList.toggle('panel-open', v);
      if (v) this.fit();
    };

    var panels = {};
    ['panel', 'about'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) panels[id] = new Panel(el);
    });

    function syncContactBtn() {
      if (contactBtnTxt) contactBtnTxt.textContent = (panels.panel && panels.panel.open) ? '关闭' : '联系方式';
    }
    if (panels.panel) {
      var origSet = panels.panel.set.bind(panels.panel);
      panels.panel.set = function (v) { origSet(v); syncContactBtn(); };
    }

    function markRail() {
      $$('.rail__btn').forEach(function (b) {
        var act = b.getAttribute('data-act');
        var on = (act === 'contact' && panels.panel && panels.panel.open) ||
                 (act === 'about' && panels.about && panels.about.open) ||
                 (act === 'works' && body.classList.contains('is-works-focus'));
        b.classList.toggle('is-on', !!on);
      });
    }

    function openPanel(id) {
      body.classList.remove('is-works-focus');
      Object.keys(panels).forEach(function (k) { if (k !== id) panels[k].set(false); });
      if (panels[id]) panels[id].set(true);
      markRail();
    }
    function closePanels() {
      Object.keys(panels).forEach(function (k) { if (panels[k].open) panels[k].set(false); });
      markRail();
    }

    // 顶栏「联系方式」
    if (contactBtn) {
      contactBtn.addEventListener('click', function () {
        if (panels.panel && panels.panel.open) panels.panel.set(false);
        else openPanel('panel');
        markRail();
      });
    }

    // 右栏导航：作品 / 关于 / 联系
    $$('.rail__btn').forEach(function (b) {
      var act = b.getAttribute('data-act');
      if (!act) return;
      b.addEventListener('click', function () {
        if (act === 'contact') {
          if (panels.panel && panels.panel.open) panels.panel.set(false);
          else openPanel('panel');
        } else if (act === 'about') {
          if (panels.about && panels.about.open) panels.about.set(false);
          else openPanel('about');
        } else if (act === 'works') {
          body.classList.toggle('is-works-focus');
        }
        markRail();
      });
    });

    // 关于面板里的「联系」按钮 → 切到联系面板
    var aboutCta = $('.about__cta');
    if (aboutCta) aboutCta.addEventListener('click', function () { openPanel('panel'); });

    // 点击面板空白处关闭
    Object.keys(panels).forEach(function (k) {
      var p = panels[k];
      p.el.addEventListener('click', function (e) {
        if (e.target === p.el || e.target === p.inner) { p.set(false); markRail(); }
      });
    });

    // Esc：关闭面板 / 退出作品聚焦
    window.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (body.classList.contains('is-works-focus')) body.classList.remove('is-works-focus');
      closePanels();
    });

    window.addEventListener('resize', function () {
      Object.keys(panels).forEach(function (k) { if (panels[k].open) panels[k].fit(); });
    });

    // ── 微信号点击复制（联系面板）──
    if (panels.panel) {
      var copyEl = panels.panel.el.querySelector('[data-copy]');
      if (copyEl) {
        var hint = document.createElement('span');
        hint.className = 'panel__copied';
        hint.textContent = '已复制';
        copyEl.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          var text = copyEl.getAttribute('data-copy') || '';
          var done = function () {
            if (copyEl.parentNode) copyEl.parentNode.appendChild(hint);
            hint.classList.add('is-on');
            setTimeout(function () { hint.classList.remove('is-on'); }, 1400);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done).catch(done);
          } else {
            try {
              var ta = document.createElement('textarea');
              ta.value = text;
              ta.style.position = 'fixed';
              ta.style.opacity = '0';
              document.body.appendChild(ta);
              ta.select();
              document.execCommand('copy');
              document.body.removeChild(ta);
            } catch (err) { /* 复制失败也要给提示 */ }
            done();
          }
        });
      }
    }
  })();

  /* ══════════════════════════════════════════════
     5. 北京时间 + 日期（锁定 UTC+8）
     ══════════════════════════════════════════════ */
  (function clock() {
    var tEl = $('#clockTime');
    var dEl = $('#dateStr');
    var CN_OFFSET = 8 * 60;

    function bjNow() {
      var now = new Date();
      return new Date(now.getTime() + (now.getTimezoneOffset() + CN_OFFSET) * 60000);
    }

    function tick() {
      var d = bjNow();
      if (tEl) tEl.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
      if (dEl) dEl.textContent = d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate());
    }
    tick();
    setInterval(tick, 1000);
  })();


  /* ══════════════════════════════════════════════
     6. 入场动画
     ──────────────────────────────────────────────
     开场页（gate）已移除，作品页即首屏：加载后直接依次浮现。
     ══════════════════════════════════════════════ */
  (function reveal() {
    var fxMap = [['.chrome', 'fx fx--1'], ['.works', 'fx fx--2'],
                 ['.clockblock', 'fx fx--3'], ['.counter', 'fx fx--3']];
    fxMap.forEach(function (m) {
      var el = $(m[0]);
      if (el) el.className += ' ' + m[1];
    });
    setTimeout(function () { document.body.classList.add('is-loaded'); }, 200);
  })();

  /* ══════════════════════════════════════════════
     7. 作品计数（优先读清单，兜底数 DOM）
     ══════════════════════════════════════════════ */
  (function count() {
    var el = $('#workCount');
    if (!el) return;
    var n = $$('.works__item').length;
    el.textContent = pad(n);
  })();

  /* ══════════════════════════════════════════════
     8. 光标金色光晕（电影聚光灯，跟随鼠标 rAF 平滑）
     ══════════════════════════════════════════════ */
  (function cursorGlow() {
    if (reduceMotion) return;
    if (window.matchMedia('(hover: none)').matches) return;
    var el = $('.cursor-glow');
    if (!el) return;

    var x = window.innerWidth / 2, y = window.innerHeight / 2;
    var tx = x, ty = y, raf = null;
    // 初始即居中，避免加载瞬间光晕停在左上角
    el.style.transform = 'translate(' + x + 'px,' + y + 'px)';

    function loop() {
      x = lerp(x, tx, 0.18);
      y = lerp(y, ty, 0.18);
      el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      if (Math.abs(x - tx) > 0.5 || Math.abs(y - ty) > 0.5) raf = requestAnimationFrame(loop);
      else raf = null;
    }

    window.addEventListener('mousemove', function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
  })();

  /* ══════════════════════════════════════════════
     9. 背景视差 + 景深（鼠标驱动 --px/--py，前景不动形成纵深）
     ══════════════════════════════════════════════ */
  (function stageParallax() {
    if (reduceMotion) return;
    var stage = $('#stage');
    if (!stage) return;

    var px = 0, py = 0, tx = 0, ty = 0, raf = null;

    function loop() {
      px = lerp(px, tx, 0.06);
      py = lerp(py, ty, 0.06);
      stage.style.setProperty('--px', px.toFixed(4));
      stage.style.setProperty('--py', py.toFixed(4));
      if (Math.abs(px - tx) > 0.002 || Math.abs(py - ty) > 0.002) raf = requestAnimationFrame(loop);
      else raf = null;
    }

    window.addEventListener('mousemove', function (e) {
      tx = (e.clientX / window.innerWidth - 0.5);
      ty = (e.clientY / window.innerHeight - 0.5);
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
  })();

})();