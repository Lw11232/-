/* ══════════════════════════════════════════════════════════════
   works.js — hover 播循环片段 / 点击进入播放器（支持系列选集）
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function $(s, r) { return (r || document).querySelector(s); }
  function $$$ (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function mmss(sec) {
    if (!isFinite(sec)) sec = 0;
    return Math.floor(sec / 60) + ':' + pad(Math.floor(sec % 60));
  }

  /* ══════════ 状态 ══════════ */
  var works = [];        // 作品清单
  var curWork = -1;      // 当前作品索引
  var curPart = 0;       // 当前集索引

  /* ══════════ 播放器 ══════════ */
  var player = $('#player');
  var video = $('#playerVideo');
  var closeBtn = $('#playerClose');
  var label = $('#playerLabel');
  var nowEl = $('#playerNow');
  var totalEl = $('#playerTotal');
  var progress = $('#playerProgress');
  var navLabel = $('#playerIndex');
  var prevBtn = $('#playerPrev');
  var nextBtn = $('#playerNext');
  var partsBar = $('#playerParts');

  var pOpen = false;
  var loading = false;

  /* 大体积完整版（如种梨三集各 90MB+）需要缓冲提示 */
  function showLoading(on) {
    loading = on;
    var box = $('#playerLoading');
    if (box) box.style.opacity = on ? '1' : '0';
  }

  function renderParts(w) {
    if (!partsBar) return;
    if (w.parts.length <= 1) {
      partsBar.innerHTML = '';
      partsBar.style.display = 'none';
      return;
    }
    partsBar.style.display = 'flex';
    partsBar.innerHTML = w.parts.map(function (p, i) {
      return '<button class="part' + (i === curPart ? ' is-on' : '') +
             '" data-part="' + i + '">' + p.label + '</button>';
    }).join('');
  }

  function loadPart(i) {
    var w = works[curWork];
    if (!w) return;
    if (i < 0) i = w.parts.length - 1;
    if (i >= w.parts.length) i = 0;
    curPart = i;

    var pt = w.parts[i];
    showLoading(true);
    // 轻量版（线上版）不带完整版视频：full 为空时回落到 loop 预览片段
    var src = pt.full || w.loop || '';
    if (!src) {
      showLoading(false);
      label.textContent = w.name + (pt.label ? ' · ' + pt.label : '') + ' — ' + w.cat;
      return;
    }
    video.src = src;
    video.loop = !pt.full;      // 回落到预览片段时循环播放
    video.load();
    video.addEventListener('canplay', function () { showLoading(false); }, { once: true });
    video.addEventListener('waiting', function () { showLoading(true); }, { once: true });

    label.textContent = w.name + (pt.label ? ' · ' + pt.label : '') + ' — ' + w.cat;
    navLabel.textContent = pad(i + 1) + ' / ' + pad(w.parts.length);
    progress.style.width = '0%';
    nowEl.textContent = '0:00';
    totalEl.textContent = '0:00';

    renderParts(w);
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
  }

  function openWork(wi, pi) {
    if (!works.length) return;
    if (wi < 0) wi = works.length - 1;
    if (wi >= works.length) wi = 0;
    curWork = wi;
    loadPart(pi || 0);

    if (!pOpen) {
      pOpen = true;
      player.classList.add('is-open');
      player.setAttribute('aria-hidden', 'false');
    }
  }

  function closePlayer() {
    if (!pOpen) return;
    pOpen = false;
    player.classList.remove('is-open');
    player.setAttribute('aria-hidden', 'true');
    video.pause();
    setTimeout(function () {
      if (!pOpen) { video.removeAttribute('src'); video.load(); }
    }, 520);
  }

  if (closeBtn) closeBtn.addEventListener('click', closePlayer);
  var bd = $('.player__backdrop');
  if (bd) bd.addEventListener('click', closePlayer);

  if (prevBtn) prevBtn.addEventListener('click', function () {
    loadPart(curPart - 1);
  });
  if (nextBtn) nextBtn.addEventListener('click', function () {
    loadPart(curPart + 1);
  });

  // 集数切换
  if (partsBar) {
    partsBar.addEventListener('click', function (e) {
      var b = e.target.closest('.part');
      if (!b) return;
      loadPart(parseInt(b.dataset.part, 10) || 0);
    });
  }

  video.addEventListener('timeupdate', function () {
    var d = video.duration;
    if (!isFinite(d) || !d) return;
    nowEl.textContent = mmss(video.currentTime);
    totalEl.textContent = mmss(d);
    progress.style.width = (video.currentTime / d * 100) + '%';
  });
  video.addEventListener('loadedmetadata', function () {
    if (isFinite(video.duration)) totalEl.textContent = mmss(video.duration);
  });
  video.addEventListener('ended', function () {
    var w = works[curWork];
    if (w && w.parts.length > 1) loadPart(curPart + 1);  // 多集自动连播
  });

  window.addEventListener('keydown', function (e) {
    if (!pOpen) return;
    if (e.key === 'Escape') closePlayer();
    else if (e.key === 'ArrowLeft') loadPart(curPart - 1);
    else if (e.key === 'ArrowRight') loadPart(curPart + 1);
    else if (e.key === ' ') { e.preventDefault(); video.paused ? video.play() : video.pause(); }
  });

  /* ══════════ 列表交互：hover 播循环 / click 进播放器 ══════════ */
  function findByKey(key) {
    for (var i = 0; i < works.length; i++) if (works[i].key === key) return i;
    return -1;
  }

  document.addEventListener('mouseover', function (e) {
    var item = e.target.closest && e.target.closest('.works__item');
    if (!item) return;
    var key = $('.works__link', item).dataset.key;
    var i = findByKey(key);
    if (i < 0) return;
  });

  document.addEventListener('mouseleave', function (e) {
    if (e.target.closest && e.target.closest('.works')) return;
  }, true);

  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('.works__link');
    if (!link) return;
    e.preventDefault();
    var i = findByKey(link.dataset.key);
    if (i >= 0) openWork(i, 0);
  });

  /* ══════════ 列表自适应缩放 ══════════ */
  /* 18 条作品在 900px 高度下会溢出，按实际测量动态缩放 */
  function fitWorks() {
    var el = $('.works');
    var inner = $('.works__inner');
    if (!el || !inner) return;

    // 重置后测量自然高度（缩放基准：左上角，不做垂直位移）
    el.style.transform = 'scale(1)';
    var natural = inner.scrollHeight;
    // 原站名单可超出视口（不缩放），但过长时缩一点保证可见
    var avail = window.innerHeight - el.offsetTop - 20;

    if (natural > avail && avail > 0) {
      var s = Math.max(0.62, avail / natural);
      el.style.transform = 'scale(' + s.toFixed(3) + ')';
    } else {
      el.style.transform = 'scale(1)';
    }
  }

  /* ══════════════════════════════════════════════════════════════
     「编辑」定位
     ────────────────────────────────────────────────────────────
     · 横向：position:relative + left 偏移，让「编」字左缘
             与作品元信息「奢侈品」的「奢」字左缘上下对齐
             （元信息悬停后左缘 = 条目右缘 + 12px，与 CSS 的 left:100%+12px 一致）
     · 纵向：完全交给 CSS —— .chrome 的 align-items:baseline
             让「编辑」「左栏」「联系方式」原生同基线
             （不依赖 JS 测量，缓存旧 JS 也不会错位）
     ══════════════════════════════════════════════════════════════ */
  var CHAR_W_RATIO = 0.55;    // 字宽 ≈ |字距| + 字号 × 0.55
  var EDIT_GAP_CHARS = 8;      // 回退用（无列表时的估算）
  var META_GAP_PX = 12;        // 元信息左缘相对条目右缘的间距（同 CSS）

  function syncRolePosition() {
    var role = $('.chrome__cell--c');
    var roleTxt = $('.chrome__txt', role);
    /* 姓名已移除（左上角改为作品计数），改用左栏容器做存在性锚点 */
    var ref = $('.chrome__cell--l');
    var firstWork = $('.works__link');
    if (!role || !roleTxt || !ref || !firstWork) return;

    // 窄屏（≤1040）：「编辑」钉在右上角（由 CSS 控制），不做动态跟随
    if (window.matchMedia('(max-width: 1040px)').matches) {
      role.style.left = '';
      // 「联系方式」左移让位，避免与「编辑」重叠
      var cellR = $('.chrome__cell--r');
      if (cellR) cellR.style.transform = 'translateX(-78px)';
      return;
    }

    // ── 复位，避免多次调用累积偏移 ──
    role.style.left = '0px';
    var btn = document.getElementById('contactBtn');
    if (btn) btn.style.transform = '';

    // ── 横向：编辑左缘 = 名单右缘 + 12px（即悬停后的「奢」字左缘）──
    //    position:relative 时 left 是「相对自身原位的偏移量」，
    //    所以要用目标左缘减去当前左缘
    var listEl = firstWork.parentElement
      ? firstWork.parentElement.parentElement : null;
    if (listEl) {
      var lb = listEl.getBoundingClientRect();
      var cur = role.getBoundingClientRect();
      var targetLeft = lb.right + META_GAP_PX;
      role.style.left = (targetLeft - cur.left).toFixed(1) + 'px';
    } else {
      var wb = firstWork.getBoundingClientRect();
      var cs = getComputedStyle(firstWork);
      var ls = Math.abs(parseFloat(cs.letterSpacing) || 0);
      var fs = parseFloat(cs.fontSize) || 12;
      var charW = ls + fs * CHAR_W_RATIO;
      var cur2 = role.getBoundingClientRect();
      role.style.left = (wb.left + charW * EDIT_GAP_CHARS - cur2.left).toFixed(1) + 'px';
    }
  }

  /* ══════════════════════════════════════════════════════════════
     分组分隔线宽度
     ────────────────────────────────────────────────────────────
     每条线的长度 = 它「上方那一组」里最宽条目的宽度，
     让线条长短跟随分组分量（而非全部等长）。
     例：奢侈品组有 RICHARD MILLE 055（最宽）→ 线最长；
         视觉实验组只有「云海仙宫」→ 线最短。
     ══════════════════════════════════════════════════════════════ */
  function syncSepWidths() {
    var list = $('.works__list');
    if (!list) return;
    var kids = list.children;
    var i, j;

    // 1) 收集每组的最大条目宽度
    var groupW = {};
    for (i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (!el.classList || !el.classList.contains('works__item')) continue;
      var cat = el.getAttribute('data-cat') || '';
      var w = el.getBoundingClientRect().width;
      if (!(cat in groupW) || w > groupW[cat]) groupW[cat] = w;
    }

    // 2) 遍历：分隔线归属于它「前面」的那一组（即上一段内容的类别）
    var lastCat = null;
    for (i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k.classList && k.classList.contains('works__sep')) {
        // 这条线分隔的是「上一组」和「下一组」→ 归上一组
        if (lastCat && groupW[lastCat]) {
          k.style.width = groupW[lastCat].toFixed(1) + 'px';
        }
        continue;
      }
      if (k.classList && k.classList.contains('works__item')) {
        lastCat = k.getAttribute('data-cat') || lastCat;
      }
    }
  }

  function relayout() {
    fitWorks();
    syncRolePosition();
    syncSepWidths();
  }

  window.addEventListener('resize', relayout);
  // 字体加载完成后度量会变，需重算
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { relayout(); });
  }
  window.addEventListener('load', function () { setTimeout(relayout, 60); });

  /* ══════════ 加载清单 ══════════ */
  fetch('./assets/works.json')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      works = d;
      var c = $('#workCount');
      if (c) c.textContent = pad(d.length);
      // 等布局稳定后再测量
      setTimeout(fitWorks, 60);
      setTimeout(relayout, 140);
    })
    .catch(function () { works = []; });

  window.__works = works;
  window.__fitWorks = fitWorks;
})();
