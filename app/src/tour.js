// 안내 장치: 처음 방문 질문 · 둘러보기(튜토리얼) · ? 도움말 말풍선 · 처음 한 번만 뜨는 도움말.
// 문구는 전부 copy.js(COPY)에서 읽는다. 이 파일은 "어떻게 보여 줄지"만 맡는다.
// 앱(app.js)이 넘겨주는 것: go(해시), route, helpCtx() (지금 과목의 개수 등), onDone(마지막 단계 버튼)
//
// 둘러보기 단계 하나 = { view, target, title, body } (copy.js COPY.tour)
//   view   : 그 단계에서 열 화면 (today · quiz · lec · map)
//   target : 비출 요소의 data-tour 값. 화면 요소에 data-tour="status"처럼 달아 둔다
// 비추는 방법: 대상 둘레를 뺀 화면 네 조각을 반투명 + 흐림(backdrop-filter)으로 덮고, 대상에 빛나는 테두리를 두른다.

const GUIDE = (() => {
  const KEY = 'lc-ui';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  const flags = load();
  const set = (k, v) => { flags[k] = v; try { localStorage.setItem(KEY, JSON.stringify(flags)); } catch (e) {} };
  const calm = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const vw = () => document.documentElement.clientWidth, vh = () => window.innerHeight;
  let opts = {}, root = null, steps = [], idx = 0, lastFocus = null, mode = null, timer = 0;

  // ── 덮개 ──
  function overlay() {
    if (root) return root;
    lastFocus = document.activeElement;
    root = document.createElement('div');
    root.className = 'tour';
    root.innerHTML = '<div class="tour-shade"></div><div class="tour-shade"></div><div class="tour-shade"></div><div class="tour-shade"></div>'
      + '<div class="tour-ring" aria-hidden="true"></div><div class="tour-tip" role="dialog" aria-modal="true" aria-labelledby="tourT" tabindex="-1"></div>';
    document.body.appendChild(root);
    requestAnimationFrame(() => root && root.classList.add('on'));
    root.addEventListener('click', onClick);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return root;
  }
  function close() {
    if (!root) return;
    const r = root; root = null; mode = null; clearTimeout(timer);
    window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true);
    r.classList.remove('on');
    setTimeout(() => r.remove(), calm() ? 0 : 260);
    if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
  }
  const shadeBox = (el, x, y, w, h) => Object.assign(el.style, { left: x + 'px', top: y + 'px', width: Math.max(0, w) + 'px', height: Math.max(0, h) + 'px' });
  const targetOf = st => st && st.target ? document.querySelector(`[data-tour="${st.target}"]`) : null;

  // 지금 단계의 대상 둘레에 구멍을 내고, 말풍선을 위나 아래에 붙인다
  function place() {
    if (!root) return;
    const [t, r, b, l] = root.querySelectorAll('.tour-shade'), ring = root.querySelector('.tour-ring'), tip = root.querySelector('.tour-tip');
    const W = vw(), H = vh(), el = mode === 'tour' ? targetOf(steps[idx]) : null;
    if (!el) {   // 비출 대상이 없으면 화면 전체를 덮고 말풍선을 가운데에
      shadeBox(t, 0, 0, W, H); shadeBox(r, 0, 0, 0, 0); shadeBox(b, 0, 0, 0, 0); shadeBox(l, 0, 0, 0, 0);
      ring.style.opacity = 0; tip.classList.add('center'); tip.style.left = tip.style.top = ''; return;
    }
    tip.classList.remove('center');
    const pad = 6, R = el.getBoundingClientRect();
    const x = Math.max(4, R.left - pad), y = Math.max(4, R.top - pad), x2 = Math.min(W - 4, R.right + pad), y2 = Math.min(H - 4, R.bottom + pad);
    shadeBox(t, 0, 0, W, y); shadeBox(b, 0, y2, W, H - y2); shadeBox(l, 0, y, x, y2 - y); shadeBox(r, x2, y, W - x2, y2 - y);
    Object.assign(ring.style, { opacity: 1, left: x + 'px', top: y + 'px', width: (x2 - x) + 'px', height: (y2 - y) + 'px' });
    const tw = tip.offsetWidth, th = tip.offsetHeight, gap = 14;
    let top, up = false;
    if (H - y2 >= th + gap + 8) top = y2 + gap;
    else if (y >= th + gap + 8) { top = y - th - gap; up = true; }
    else top = Math.max(8, H - th - 8);
    const cx = (x + x2) / 2, left = Math.min(Math.max(12, cx - tw / 2), W - tw - 12);
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
    tip.classList.toggle('up', up);
    const arrow = tip.querySelector('.tour-arrow');
    if (arrow) arrow.style.left = Math.min(Math.max(16, cx - left), tw - 16) + 'px';
  }

  // ── 처음 방문 질문 ──
  function welcome(o = {}) {
    opts = { ...opts, ...o }; overlay(); mode = 'welcome';
    const w = COPY.welcome, tip = root.querySelector('.tour-tip');
    tip.innerHTML = `<div class="tour-hello" aria-hidden="true">🗺️</div><h3 id="tourT">${w.title}</h3><div class="tour-body">${w.body(helpCtx())}</div>
      <p class="tour-q">${w.question}</p><div class="tour-choice"><button class="ap-btn pri" data-g="yes">${w.yes}</button><button class="ap-btn" data-g="no">${w.no}</button></div><p class="tour-foot">${w.foot}</p>`;
    place(); animateIn(tip);
    setTimeout(() => { const b = tip.querySelector('[data-g="yes"]'); if (b) b.focus({ preventScroll: true }); }, 30);
  }
  // ── 둘러보기 ──
  function startTour(o = {}) {
    opts = { ...opts, ...o }; set('welcomed', Date.now());
    steps = COPY.tour.slice(); overlay(); mode = 'tour'; show(0);
  }
  function show(k) {
    idx = Math.max(0, Math.min(steps.length - 1, k));
    const st = steps[idx], tip = root.querySelector('.tour-tip');
    tip.classList.remove('in');
    const r = opts.route();
    if (st.view && (r.view !== st.view || r.arg)) opts.go(`#/${r.subj}/${st.view}`);
    clearTimeout(timer);
    let tries = 0;
    const ready = () => {   // 화면이 바뀐 뒤 대상이 그려질 때까지 기다린다
      if (!root || mode !== 'tour') return;
      const el = targetOf(st);
      if (!el && tries++ < 12) { timer = setTimeout(ready, 50); return; }
      if (el) el.scrollIntoView({ block: 'center', behavior: calm() ? 'auto' : 'smooth' });
      timer = setTimeout(() => { renderTip(st); place(); animateIn(tip); }, el && !calm() ? 340 : 20);
    };
    timer = setTimeout(ready, 40);
  }
  function renderTip(st) {
    const tip = root.querySelector('.tour-tip'), n = steps.length, nav = COPY.tourNav, last = idx === n - 1, ctx = helpCtx();
    const done = typeof nav.done === 'function' ? nav.done(ctx) : nav.done;   // 푼 문제가 없으면 "진단 12문제로 시작", 있으면 "튜토리얼 끝"
    tip.innerHTML = `<i class="tour-arrow" aria-hidden="true"></i><div class="tour-step">${idx + 1} / ${n}</div><h3 id="tourT">${st.title}</h3><div class="tour-body">${st.body(ctx)}</div>
      <div class="tour-dots" aria-hidden="true">${steps.map((_, i) => `<i class="${i === idx ? 'on' : ''}"></i>`).join('')}</div>
      <div class="tour-nav">${last ? `${ctx.tried ? '<span></span>' : `<button class="ap-btn sm" data-g="close">${nav.close}</button>`}<span></span><button class="ap-btn sm" data-g="prev">${nav.prev}</button><button class="ap-btn sm pri" data-g="done">${done}</button>`
        : `<button class="tour-skip" data-g="skip">${nav.skip}</button><span></span>${idx ? `<button class="ap-btn sm" data-g="prev">${nav.prev}</button>` : ''}<button class="ap-btn sm pri" data-g="next">${nav.next} →</button>`}</div>`;
    setTimeout(() => { const b = tip.querySelector('[data-g="next"],[data-g="done"]'); if (b) b.focus({ preventScroll: true }); }, 30);
  }
  function animateIn(tip) { tip.classList.remove('in'); void tip.offsetWidth; tip.classList.add('in'); }
  function finish(startDiag) {
    set('welcomed', Date.now()); set('toured', Date.now()); close();
    if (startDiag && opts.onDone) opts.onDone();
  }
  function onClick(e) {
    const b = e.target.closest('[data-g]'); if (!b) return;
    const g = b.dataset.g;
    if (g === 'yes') startTour();
    else if (g === 'no') { set('welcomed', Date.now()); close(); }
    else if (g === 'next') show(idx + 1);
    else if (g === 'prev') show(idx - 1);
    else if (g === 'skip' || g === 'close') finish(false);
    else if (g === 'done') finish(true);
  }

  // ── ? 도움말 말풍선 ──
  let pop = null, popBtn = null;
  function closeHelp() {
    if (!pop) return;
    const p = pop; pop = null;
    if (popBtn) popBtn.setAttribute('aria-expanded', 'false');
    p.classList.remove('on'); setTimeout(() => p.remove(), calm() ? 0 : 150);
  }
  function openHelp(key, btn) {
    const h = COPY.help[key]; if (!h || !btn) return;
    if (pop && popBtn === btn) { closeHelp(); return; }
    closeHelp();
    pop = document.createElement('div');
    pop.className = 'hp-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', h.title);
    pop.innerHTML = `<i class="hp-arrow" aria-hidden="true"></i><div class="hp-head"><b>${h.title}</b><button class="hp-x" type="button" aria-label="닫기">×</button></div><div class="hp-body">${h.body(helpCtx())}</div>`;
    document.body.appendChild(pop); popBtn = btn; btn.setAttribute('aria-expanded', 'true');
    placePop(); requestAnimationFrame(() => pop && pop.classList.add('on'));
  }
  function placePop() {
    if (!pop || !popBtn) return;
    const R = popBtn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight, W = vw(), H = vh();
    const cx = R.left + R.width / 2, left = Math.min(Math.max(12, cx - w / 2), W - w - 12);
    const up = H - R.bottom < h + 18 && R.top > h + 18;
    pop.style.left = (left + window.scrollX) + 'px';
    pop.style.top = ((up ? R.top - h - 10 : R.bottom + 10) + window.scrollY) + 'px';
    pop.classList.toggle('up', up);
    pop.querySelector('.hp-arrow').style.left = Math.min(Math.max(14, cx - left), w - 14) + 'px';
  }
  // 처음 한 번만 저절로 뜨는 도움말: 그 영역 안의 ? 버튼에 붙여서 연다
  function tipOnce(name, scope) {
    const key = COPY.firstTips[name]; if (!key || root) return;
    const seen = flags.tips || {}; if (seen[name]) return;
    const btn = (scope || document).querySelector(`[data-help="${key}"]`); if (!btn) return;
    set('tips', { ...seen, [name]: Date.now() });
    setTimeout(() => openHelp(key, btn), calm() ? 0 : 450);
  }

  document.addEventListener('click', e => {
    const hb = e.target.closest('[data-help]');
    if (hb) { e.preventDefault(); openHelp(hb.dataset.help, hb); return; }
    if (e.target.closest('[data-tour-start]')) { closeHelp(); startTour(); return; }
    if (pop && (!pop.contains(e.target) || e.target.closest('.hp-x'))) closeHelp();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (pop) { const b = popBtn; closeHelp(); if (b) b.focus(); } else if (root) finish(false); return; }
    if (root && mode === 'tour') { if (e.key === 'ArrowRight') show(idx + 1); else if (e.key === 'ArrowLeft') show(idx - 1); }
  }, true);
  window.addEventListener('resize', placePop);
  window.addEventListener('scroll', placePop, true);   // 개념 창(시트) 안에서 스크롤해도 말풍선이 버튼을 따라간다

  return {
    flags, welcome, startTour, openHelp, closeHelp, tipOnce,
    isOpen: () => !!root,
    init(o) { opts = { ...opts, ...o }; },
  };
})();
