// 학습 코치 화면 (길잡이 · 문제 · 강의 · 지도)
// 규칙·계산은 coach.js, 화면 문구(상태 이름·도움말·둘러보기)는 copy.js, 안내 장치는 tour.js에 있다.
// 이 파일은 데이터를 읽고, 화면을 그리고, 누른 버튼을 처리한다. 구조는 SPEC.md 참고.
const BUILD = /*__BUILD__*/{};
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const CIRC = ['①','②','③','④','⑤'];
const SUBJECTS = BUILD.subjects; // ['tcs','alg']
const now = () => Date.now();
const md = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };
// 받침 따라 조사 고르기 (영문·숫자는 읽는 소리 기준, 끝 괄호 설명은 건너뜀)
const josa = (w, a, b) => { const base = String(w).replace(/\s*\([^()]*\)\s*$/, '') || String(w); const ch = base.replace(/[\s)」』"'\]]+$/, '').slice(-1), code = ch.charCodeAt(0); if(code >= 0xAC00 && code <= 0xD7A3) return (code - 0xAC00) % 28 ? a : b; return /[136780lmnrLMNR]$/.test(ch) ? a : b; };

// ── 데이터 (과목을 처음 열 때 읽는다) ──
const SUBJ = {};
function S(key){
  if(!SUBJ[key]){
    const data = JSON.parse(document.getElementById('d-' + key).textContent);
    // 계산 유형: 문제 틀(template)만 등록해 두고, 낼 때마다 숫자를 새로 뽑아 만든다 (정답은 코드가 계산)
    const ids = new Set(data.concepts.map(c => c.id));
    for(const g of CALC.GENERATORS) if(g.subject === key){
      const cs = g.nodes.filter(n => ids.has(n)); if(!cs.length) continue;
      const c0 = data.concepts.find(c => c.id === cs[0]);
      data.quizzes['calc-' + g.id] = {id:'calc-' + g.id, template:true, gen:g.id, kind:'calc', src:'계산 자동 출제 · ' + g.label, concepts:cs, scene:c0.scenes[0] || null, weight:45, pub:true, stem:'', question_text:g.label};
    }
    // 개념 규격: 규격 하나 × 패턴마다 틀을 등록 (낼 때마다 보기 조합을 새로 뽑는다)
    const byC = new Map(data.concepts.map(c => [c.id, c]));
    for(const spec of data.specs || []){
      const c = byC.get(spec.c); if(!c) continue;
      const sib = data.specs.filter(x => x !== spec && byC.get(x.c) && byC.get(x.c).chapter === c.chapter);
      const ctx = {name:c.title, siblingFalse:sib.flatMap(x => (x.facts || []).filter(f => f.f)), siblingTerms:sib.flatMap(x => x.terms || [])};
      for(const p of SPEC.patternsOf(spec, ctx)){
        const id = `spec-${spec.c}-${p}`;
        data.quizzes[id] = {id, template:true, spec, ctx, pattern:p, kind:p === 'term-short' || p === 'essay' ? 'short' : 'mcq', src:'개념 규격 출제', concepts:[spec.c, ...(spec.also || [])].filter(x => byC.has(x)), scene:c.scenes[0] || null, weight:Math.max(40, c.prob || 0), pub:true, stem:'', question_text:c.title};
      }
    }
    SUBJ[key] = {data, ix:createIndex(data)};
  }
  return SUBJ[key];
}

// ── 저장: Claude 안에서 열면 계정에(기기 간 동기화), 아니면 이 브라우저에 ──
const store = {
  mode:'memory', ref:null, states:{}, queue:Promise.resolve(),
  localOK:(() => { try{ localStorage.setItem('__lc', '1'); localStorage.removeItem('__lc'); return true; }catch(e){ return false; } })(),
  load(key){
    if(this.states[key]) return this.states[key];
    let raw = null;
    if(this.localOK){ try{ raw = JSON.parse(localStorage.getItem('lc-' + key) || 'null'); }catch(e){} }
    this.states[key] = migrate(raw);
    return this.states[key];
  },
  save(key){
    const st = this.states[key]; if(!st) return;
    st.updated = now();
    if(this.localOK){ try{ localStorage.setItem('lc-' + key, JSON.stringify(st)); }catch(e){} }
    if(this.ref){ const doc = this.ref(key), snap = JSON.parse(JSON.stringify(st));
      this.queue = this.queue.then(() => doc.set(snap)).then(() => { if(this.err){ this.err = false; renderFoot(); } }).catch(() => { this.err = true; renderFoot(); }); }
  },
  async connect(){
    this.mode = this.localOK ? 'local' : 'memory';
    if(!(window.claude && typeof window.claude.use === 'function')) return;
    try{
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if(!db || !user) return;
      const uid = await user.id(); if(!uid) return;
      this.ref = key => db.doc('data/users/' + uid + '/learn-' + key);
      for(const key of SUBJECTS){
        const local = this.load(key);
        const snap = await this.ref(key).get();
        const remote = snap.exists ? snap.data() : null;
        if(remote && remote.v && (remote.updated || 0) >= (local.updated || 0)){ this.states[key] = migrate(remote); if(this.localOK){ try{ localStorage.setItem('lc-' + key, JSON.stringify(this.states[key])); }catch(e){} } }
        else if(local.attempts.length) await this.ref(key).set(JSON.parse(JSON.stringify(local)));
      }
      this.mode = 'db';
    }catch(e){ this.ref = null; }
  }
};

// ── 라우팅: #/과목/화면/인자 ──
let route = {subj:'tcs', view:'today', arg:null};
function parseHash(){
  const p = location.hash.replace(/^#\/?/, '').split('/');
  const subj = SUBJECTS.includes(p[0]) ? p[0] : (route.subj || 'tcs');
  const view = ['today','quiz','lec','map'].includes(p[1]) ? p[1] : 'today';
  return {subj, view, arg:p[2] ? decodeURIComponent(p[2]) : null};
}
function go(h){ if(location.hash === h) render(); else location.hash = h; }
// 다른 화면(또는 다른 강의)으로 가면 맨 위부터 보여 준다. 지도에서 개념만 바꿀 때는 보던 자리 그대로.
window.addEventListener('hashchange', () => {
  const prev = route; route = parseHash();
  const lecMove = route.view === 'lec' && prev.arg !== route.arg && !String(route.arg || '').includes('-');
  if(prev.subj !== route.subj || prev.view !== route.view || lecMove) window.scrollTo(0, 0);
  render();
});

// ── 공용 조각 ──
const ST = k => COPY.status[k];
const TERM = COPY.term;                                                       // 기초 개념 · 원인 찾기 · 🔍
const PJ = (a, b) => TERM.pre + josa(TERM.pre, a, b);                         // "기초 개념" + 조사
const cname = (key, id) => { const c = S(key).ix.byId.get(id); return c ? c.title : String(id); };
const cshort = (key, id) => { const c = S(key).ix.byId.get(id); return c ? (c.short || c.title) : String(id); };
const q_ = (key, id) => `「${esc(cshort(key, id))}」`;                       // 문장 속 개념 이름
const qj = (key, id, a, b) => q_(key, id) + josa(cshort(key, id), a, b);    // 「이름」+조사
const yo = w => josa(w, '이에요', '예요');                                     // ~이에요/~예요 (상태 이름을 바꿔도 조사가 맞게)
const SL = (k, a, b) => ST(k).label + (a ? josa(ST(k).label, a, b) : '');   // 상태 이름 + 조사
const ic = k => `<b class="ap-ic s-${k}" aria-hidden="true">${ST(k).icon}</b>`;
const pill = (k, extra = '') => `<span class="ap-st s-${k}">${ST(k).icon} ${ST(k).label}${extra}</span>`;
const progress = (st, id) => statusOf(st, id) === 'half' ? ` ${streakOf(st, id)}/${RULES.need}` : '';
const pillOf = (st, id) => pill(statusOf(st, id), progress(st, id));
const helpBtn = key => COPY.help[key] ? `<button type="button" class="ap-help" data-help="${key}" aria-label="${esc(COPY.help[key].title)}" aria-expanded="false">?</button>` : '';
const cardHead = (title, helpKey, sub) => `<div class="ap-ch3">${helpKey ? helpBtn(helpKey) : ''}<span>${title}</span></div>${sub ? `<p class="ap-sub">${sub}</p>` : ''}`;
const cchip = (key, st, id) => { const k = statusOf(st, id); return `<a class="ap-chip" href="#/${key}/map/${id}" title="${esc(ST(k).label + progress(st, id) + ': ' + ST(k).rule())}">${ic(k)}<span>${esc(cshort(key, id))}</span><span class="ap-hidden">(${ST(k).label})</span></a>`; };
const nchip = (key, id) => `<a class="ap-chip" href="#/${key}/map/${id}"><span>${esc(cshort(key, id))}</span></a>`;   // 이름만 (상태는 옆에 따로 보일 때)
const chips = (key, st, ids) => `<span class="ap-chips">${ids.map(id => cchip(key, st, id)).join('')}</span>`;
// 정복 실패 개념의 역할: 출발점(선행에 실패 없음) / 막힘(선행에 실패 있음)
function roleOf(key, st, id){ if(statusOf(st, id) !== 'unknown') return null; return unknownPre(S(key).ix, st, id).length ? 'blocked' : 'start'; }
const roleTag = r => r ? `<span class="ap-role${r === 'start' ? ' start' : ''}" title="${esc(COPY.role[r].tip)}">${COPY.role[r].label}</span>` : '';
function histHtml(st, id){ const s = st.k[id]; if(!s || !s.h) return ''; return `<span class="ap-hist" aria-label="최근 기록 ${s.h.split('').map(x => x === '1' ? '맞힘' : '틀림').join(', ')}">${s.h.split('').map(x => x === '1' ? '<span class="y">✓</span>' : '<span class="n">✗</span>').join('')}</span>`; }
// 상태를 한 줄로: 무엇을 보고 그렇게 판단했는지 + 정복까지 남은 것
function stateLine(st, id, t){
  const s = st.k[id], v = statusOf(st, id), N = RULES.need;
  if(v === 'none') return '아직 문제를 한 번도 풀지 않았어요';
  if(v === 'unknown') return `${wrongTwice(st, id) ? '가장 최근 2문제를 연속으로 틀렸어요' : '가장 최근에 푼 문제를 틀렸어요'} · 다시 ${N}번 연속 맞히면 정복`;
  if(v === 'half') return `${s.streak}번 연속 맞혔어요 · ${toKnow(st, id)}번 더 맞히면 정복`;
  return `${s.streak}번 연속 맞혔어요 · ${isDue(st, id, t) ? '다시 점검할 때가 됐어요' : `다음 점검 ${md(dueAt(st, id))}`}`;
}
function pathHtml(key, st, path){ return `<div class="ap-path">${path.map((id, i) => `${i ? '<span class="arr" aria-hidden="true">→</span>' : ''}${cchip(key, st, id)}`).join('')}</div>`; }
function sceneOf(key, cid){ const c = S(key).ix.byId.get(cid); return c && c.scenes.length ? c.scenes[0] : null; }
const sceneLink = (key, sid) => `#/${key}/lec/${sid}`;
const lecBtn = (key, cid, label = '강의 보기') => { const sid = sceneOf(key, cid); return sid ? `<a class="ap-btn sm" href="${sceneLink(key, sid)}">${label}</a>` : ''; };
const chLabel = (key, ch) => key === 'alg' ? `${ch}강` : `${ch}장`;
// 도움말(?)·둘러보기가 쓰는 지금 숫자
function helpCtx(){
  const key = route.subj, {data, ix} = S(key), r = recommend(ix, store.load(key), now());
  return {name:data.name, short:data.short, total:r.total, count:r.count, starts:r.guide.starts.length, blocked:r.guide.blocked.length, due:r.due.length, tried:store.load(key).attempts.length};
}

// ── 문제 풀 ──
function poolOf(key, filter = () => true){
  const {data, ix} = S(key);
  return Object.values(data.quizzes).filter(q => !q.tid && !q.adhoc && q.concepts.length && !q.concepts.every(c => !ix.live(c)) && filter(q)).map(q => q.id);
}
const normW = s => String(s).toLowerCase().replace(/[\s·\-_()（）]/g, '');
// 문제 틀 → 실제 문제 (규격 문제는 보기 조합을, 계산 문제는 숫자를 매번 새로. 정답·풀이는 코드가 만든다)
function materialize(key, qid){
  const {data} = S(key), t = data.quizzes[qid];
  if(!t || !t.template) return qid;
  const seed = ((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0) || 1;
  if(t.spec){
    let q = null, s = seed;
    for(let k = 0; k < 20 && !q; k++, s = (s * 1103515245 + 12345) >>> 0) q = SPEC.makeSpec(t.spec, t.pattern, s, t.ctx);
    if(!q) return null;
    const id = `${qid}:${s}`;
    data.quizzes[id] = {...q, concepts:t.concepts, id, tid:qid, src:t.src, weight:t.weight, scene:t.scene, pub:true, gen:true, tail:'', extra:q.extra || '',
      question_text:q.stem.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()};
    return id;
  }
  const c = CALC.makeCalc(t.gen, seed), id = `${qid}:${seed}`;
  const base = {id, tid:qid, src:t.src, weight:t.weight, concepts:t.concepts, scene:t.scene, pub:true, gen:true, stem:c.stem, question_text:c.stem.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), tail:''};
  if(c.kind === 'mcq') data.quizzes[id] = {...base, kind:'mcq', options:c.opts.map(o => esc(o)), answer:[c.answer + 1], expl:{[String(c.answer + 1)]:'정답이에요. 아래 풀이를 보세요.'}, extra:c.steps};
  else data.quizzes[id] = {...base, kind:'calc', answer_text:String(c.answer), answer_html:esc(c.answer), extra:c.steps, checkFn:c.check, input:c.input};
  return id;
}
// 문제가 모자란 개념은 개념 지도에서 직접 만든다 (개념 자체를 묻는 유형만)
//   def  "이 문제를 해결하려고 나온 개념은?" (왜 생겼나를 보여 줌)
//   core "이 설명에 해당하는 개념은?"     (핵심 내용을 보여 줌)
// 둘은 모양(shape)이 달라서, 연속 정답을 셀 때 서로 다른 문제로 친다.
const GEN_TYPES = ['def', 'core'];
function genQuiz(key, cid, salt = 0, type = 'def'){
  const {data} = S(key);
  const made = makeQuiz(data.concepts, {count:1, ids:[cid], type, seed:(cid * 7919 + salt * 104729 + 17) >>> 0});
  const g = made.questions.find(q => q.type === type && q.blame === cid);
  if(!g) return null;
  const id = `gen-${type}-${key}-${cid}-${salt}`;
  data.quizzes[id] = {id, shape:`gen-${type}-${key}-${cid}`, kind:'mcq', src:'개념 지도에서 자동 생성 · ' + QUIZ_TYPES[type], weight:null, concepts:[cid], scene:sceneOf(key, cid), pub:true, gen:true, adhoc:true,
    stem:`<p class="qtext">${esc(g.prompt)}</p>` + (g.quote ? `<blockquote>${esc(g.quote)}</blockquote>` : ''),
    options:g.options.map(o => esc(o.title)), answer:[g.answer + 1], tail:'', extra:`<p>${esc(g.explain)}</p>`,
    expl:Object.fromEntries(g.options.map((o, i) => [String(i + 1), esc(o.id === g.answer_id ? '정답이에요.' : o.note)])), question_text:g.prompt + (g.quote ? ' ' + g.quote : '')};
  return id;
}

// ── 세션(문제 풀기 한 판): 문제 고르기 → 채점 → 상태 갱신 → (틀리면) 원인 찾기 ──
let SES = null;
const MAXPROBE = 8, MAXPROBES = 3;   // 원인 찾기 한 번에 확인 문제 최대 8개, 한 판에 원인 찾기 최대 3번
function startSession(key, mode, arg){
  const st = store.load(key), {data, ix} = S(key), t = now(), r = recommend(ix, st, t);
  let pool, title, max = 10, queue = null, focus = null;
  if(mode === 'diag'){ pool = poolOf(key, q => q.kind === 'mcq'); queue = diagnosticPool(ix, st, pool, 12); max = queue.length; title = COPY.modes.diag.title; }
  else if(mode === 'review'){ const due = new Set(r.due); pool = poolOf(key, q => q.concepts.some(c => due.has(c))); title = COPY.modes.review.title; max = Math.min(10, Math.max(1, r.due.length * 2), pool.length); }
  else if(mode === 'half'){ const set = new Set(r.half); pool = poolOf(key, q => q.concepts.some(c => set.has(c))); title = '진행 중인 모험'; max = Math.min(10, Math.max(1, r.half.length * 2), pool.length); }
  else if(mode === 'redo'){ const set = new Set([...r.guide.unknown, ...r.half]); pool = poolOf(key, q => q.concepts.some(c => set.has(c))); title = COPY.modes.redo.title; max = Math.min(10, pool.length); }
  else if(mode === 'lesson'){ const L = data.lessons.find(l => String(l.num) === String(arg)); const sids = new Set(L ? L.scenes : []); pool = poolOf(key, q => sids.has(q.scene)); title = `${arg}강 문제`; max = Math.min(10, pool.length); }
  else if(mode === 'scene'){ pool = poolOf(key, q => q.scene === arg); title = `장면 ${arg} 문제`; max = pool.length; queue = pool.slice(); }
  else if(mode === 'concept'){ focus = +arg; pool = poolOf(key, q => q.concepts.includes(focus)); title = `「${cshort(key, focus)}」 정복하기`; max = RULES.need + 1; }
  else if(mode === 'pre'){ focus = +arg; pool = poolOf(key); title = `「${cshort(key, focus)}」 ${TERM.probe}`; max = 0; }
  else { pool = poolOf(key); title = COPY.modes.smart.title; }
  SES = {key, mode, title, pool, queue, max, focus, used:new Set(), n:0, results:[], changes:[], probe:null, probeQ:0, probes:[], cur:null, phase:'q', note:null};
  if(mode === 'pre'){ SES.probe = startProbe(focus, {manual:true}); SES.note = null; }
  st.sessions = (st.sessions || 0) + 1;
  nextQuestion();
  go(`#/${key}/quiz`);
}
// 확인 문제 고르기: 그 개념을 최근에 푼 모양이면 개념 지도 문제로라도 다른 모양을 낸다
function checkQuestion(key, cid){
  const st = store.load(key), {ix, data} = S(key);
  const from = SES.probe ? SES.probe.from : null, pick = f => checkQuizFor(ix, st, cid, poolOf(key, q => q.concepts.includes(cid) && f(q)), SES.used, now());
  // 다른 개념의 원인을 찾는 중이면, 틀린 그 개념이 섞이지 않은 문제를 먼저 고른다 ("따로 아는지" 보려고)
  let qid = (from != null && from !== cid ? pick(q => !q.concepts.includes(from)) : null) || pick(() => true);
  // 최근에 본 모양뿐이면 개념 지도 문제(def → core 순)로 바꾼다. 그것도 다 최근이면 원래 고른 걸 낸다.
  if(!qid || isRecentShape(st, cid, data.quizzes[qid])){
    for(const type of GEN_TYPES){
      const g = genQuiz(key, cid, SES.used.size + 2, type); if(!g) continue;
      if(!isRecentShape(st, cid, data.quizzes[g])){ qid = g; break; }
      if(!qid) qid = g;
    }
  }
  return qid;
}
function nextQuestion(){
  const key = SES.key, st = store.load(key), {ix} = S(key), t = now();
  Object.assign(SES, {phase:'q', text:'', grade:null, ai:null, choice:null, kwHit:null, aiGrade:null});
  // 1) 진행 중인 원인 찾기가 있으면 그 확인 문제부터
  if(SES.probe){
    while(SES.probeQ < MAXPROBE){
      const target = probeTarget(ix, st, SES.probe); if(target == null) break;
      const qid = checkQuestion(key, target), mid = qid && materialize(key, qid);
      if(mid){ SES.used.add(qid); SES.cur = {qid:mid, check:target, kind:SES.probe.kind}; SES.cur.why = checkWhy(key); SES.probeQ++; return; }
      probeResult(ix, st, SES.probe, null);
    }
    SES.note = {kind:'probe-end', after:closeProbe()};
  }
  // 2) 일반 문제
  if(SES.mode === 'concept' && SES.n > 0 && ['know', 'unknown'].includes(statusOf(st, SES.focus))){ SES.phase = 'done'; SES.cur = null; return; }
  if(SES.n >= SES.max){ SES.phase = 'done'; SES.cur = null; return; }
  for(let tries = 0; tries < 6; tries++){
    let qid = null;
    if(SES.mode === 'concept') qid = checkQuestion(key, SES.focus);
    else if(SES.queue){ while(SES.queue.length && !qid){ const x = SES.queue.shift(); if(!SES.used.has(x)) qid = x; } }
    else qid = pickQuiz(ix, st, SES.pool, SES.used, t);
    if(!qid) break;
    SES.used.add(qid);
    const mid = materialize(key, qid);
    if(mid){ SES.n++; SES.cur = {qid:mid}; return; }
  }
  SES.phase = 'done'; SES.cur = null;
}
function closeProbe(){
  const key = SES.key, st = store.load(key), {ix} = S(key), p = SES.probe;
  p.done = true;
  const sum = probeSummary(ix, st, p);
  SES.probes.push(sum);
  SES.probe = null;
  store.save(key);
  return sum;
}
function submitAnswer(correct, extra = {}){
  const key = SES.key, st = store.load(key), {data, ix} = S(key), t = now();
  const q = data.quizzes[SES.cur.qid];
  const ch = applyAnswer(ix, st, q, correct, t, {check:SES.cur.check ?? null, ai:extra.ai});
  SES.changes.push(ch);
  SES.results.push({qid:q.id, ok:correct, check:SES.cur.check ?? null});
  SES.phase = 'fb'; SES.correct = correct; SES.lastChanges = ch; SES.note = null;
  if(SES.cur.check != null && SES.probe){
    const v = probeResult(ix, st, SES.probe, correct);
    SES.note = {kind:'check', v, id:SES.cur.check, ck:SES.cur.kind};
    const more = SES.probeQ < MAXPROBE && probeTarget(ix, st, SES.probe) != null;
    if(!more) SES.note.after = closeProbe();
  } else if(!correct){
    const cid = q.concepts[0];
    if(SES.probes.length >= MAXPROBES) SES.note = {kind:'capped', id:cid};
    else if(needsProbe(ix, st, q, ch)){
      SES.probe = startProbe(cid, {also:q.concepts.slice(1)}); SES.probeQ = 0;
      const first = probeTarget(ix, st, SES.probe), already = SES.probe.log.filter(l => l.v === 'already').map(l => l.id);
      SES.note = {kind:'probe-start', id:cid, first, firstKind:SES.probe.kind, already, also:q.concepts.slice(1)};
      if(first == null) SES.note.after = closeProbe();
    } else SES.note = {kind:'known', id:cid, twice:wrongTwice(st, cid), blockers:unknownPre(ix, st, cid)};
  }
  store.save(key);
  render();
  showFeedback();
  // 처음 한 번만: 상태 변화·원인 찾기 설명을 저절로 띄운다
  const v = $('#view');
  if(SES.note && SES.note.kind === 'probe-start') GUIDE.tipOnce('probe', v); else GUIDE.tipOnce('feedback', v);
}

// ── 화면: 문제 ──
function ruleBox(){
  return `<div class="ap-rule">${helpBtn('status')}<span>${ic('none')} 처음 → 맞히면 ${ic('half')} ${ST('half').label} → <b>${RULES.need}번 연속</b>이면 ${ic('know')} ${ST('know').label}. 틀리면 ${ic('unknown')} ${SL('unknown', '이', '가')} 되고 ${TERM.icon} ${TERM.probe}가 시작돼요.</span></div>`;
}
// 문제 출처: 교재·기출처럼 학생에게 뜻 있는 것만 보여 준다 (생성기 이름은 숨김)
function srcLabel(q){
  const s = String(q.src || '');
  if(/자동 출제 · /.test(s)) return s.split(' · ').pop();
  if(!s || /규격|자동 생성|AI가/.test(s)) return '';
  return s;
}
function renderQuiz(){
  const key = route.subj, st = store.load(key), {data, ix} = S(key);
  if(!SES || SES.key !== key){
    const r = recommend(ix, st, now()), tried = st.attempts.length, redo = r.guide.unknown.length + r.half.length, M = COPY.modes;
    const lessons = data.lessons.map(L => `<option value="${L.num}">${L.num}강 · ${esc(L.title)}</option>`).join('');
    return `<div class="ap-narrow"><h2 class="ap-h2">${COPY.titles.quizHome}</h2>${ruleBox()}
      <div class="ap-ch3" style="margin-top:14px">${helpBtn('modes')}<span>무엇을 풀까요?</span></div>
      <div class="ap-modes" data-tour="modes">
        <button class="ap-mode${tried ? ' rec' : ''}" data-start="smart"><b>${M.smart.title}${tried ? ' <em>추천</em>' : ''}</b><span>${M.smart.desc}</span></button>
        <button class="ap-mode${tried ? '' : ' rec'}" data-start="diag"><b>${M.diag.title}${tried ? '' : ' <em>처음이면</em>'}</b><span>${tried ? M.diag.desc : M.diag.first}</span></button>
        <button class="ap-mode" data-start="redo" ${redo ? '' : 'disabled'}><b>${M.redo.title} · ${redo}개</b><span>${M.redo.desc}</span></button>
        <button class="ap-mode" data-start="review" ${r.due.length ? '' : 'disabled'}><b>${COPY.due.icon} ${M.review.title} · ${r.due.length}개</b><span>${M.review.desc}</span></button>
      </div>
      <div class="ap-card"><div class="ap-h3">강의 하나만 골라서</div><div class="ap-row"><select class="ap-sel" id="lessonSel" aria-label="강의 선택">${lessons}</select><button class="ap-btn" id="lessonGo">풀기</button></div></div></div>`;
  }
  if(SES.phase === 'done') return sessionSummary();
  const q = data.quizzes[SES.cur.qid], chk = SES.cur.check != null, fb = SES.phase === 'fb';
  const total = SES.max, shown = Math.min(SES.n, total), nChk = SES.results.filter(x => x.check != null).length;
  let h = `<div class="ap-narrow"><div class="ap-row" style="justify-content:space-between"><h2 class="ap-h2">${esc(SES.title)}</h2><button class="ap-btn sm" id="quit">그만 풀기</button></div>`;
  if(total) h += `<div class="ap-prog"><span>${shown}/${total}</span><div class="ap-bar" role="img" aria-label="${total}문제 중 ${shown}번째"><i style="width:${shown / total * 100}%"></i></div><span>맞힘 ${SES.results.filter(x => x.ok).length}/${SES.results.length}${nChk ? ` · ${TERM.icon} ${nChk}` : ''}</span></div>`;
  h += `<article class="ap-q${chk ? ' check' : ''}">`;
  if(chk) h += `<div class="ap-why">${helpBtn('check')}<span>${SES.cur.why || checkWhy(key)}</span></div>`;
  const src = srcLabel(q), live = q.concepts.filter(c => ix.live(c));
  h += `<div class="ap-qmeta"><span class="ap-badge">${q.kind === 'mcq' ? '객관식' : q.kind === 'calc' ? '계산' : '주관식'}</span>${src ? `<span class="ap-badge">${esc(src)}</span>` : ''}${q.ai ? '<span class="ap-badge ai">AI 생성</span>' : ''}<span class="ap-qc">${helpBtn('qc')}<span>${COPY.titles.qc}</span>${live.map(c => cchip(key, st, c)).join('')}</span></div>`;
  h += `<div class="lec">${q.stem}</div>`;
  if(q.kind === 'mcq'){
    h += `<div class="ap-opts" role="group" aria-label="보기">${q.options.map((o, i) => { const cls = !fb ? '' : q.answer.includes(i + 1) ? ' ok' : SES.choice === i ? ' bad' : ' off';
      return `<button class="ap-opt${cls}" data-opt="${i}"${fb ? ' aria-disabled="true"' : ''}><b>${CIRC[i]}</b><span class="lec">${o}</span></button>`; }).join('')}</div>`;
    if(!fb) h += `<p class="ap-kbd">키보드: 1~4로 고르기 · Enter로 다음</p>`;
  } else if(!fb){
    h += `<label class="ap-small ap-muted" for="ans">${q.kind === 'calc' ? '답 (풀이도 같이 적으면 AI가 어디서 틀렸는지 짚어 줘요)' : '답'}</label><textarea class="ap-ta" id="ans" placeholder="${esc(q.input ? '답: ' + q.input : '답을 적어 주세요')}">${esc(SES.text || '')}</textarea>
      <div class="ap-row" style="margin-top:8px"><button class="ap-btn pri" id="submit">채점하기</button><button class="ap-btn" id="reveal">모르겠어요, 답 보기</button></div>`;
    if(SES.grade === 'self') h += selfGradeBox(q);
    if(SES.grade === 'ai-wait') h += `<p class="ap-muted ap-small">AI가 채점하는 중…</p>`;
  }
  if(fb) h += feedbackHtml(key, st, q);
  h += `</article></div>`;
  return h;
}
function checkWhy(key){
  const id = SES.cur.check, p = SES.probe, head = `<b>${TERM.icon} ${TERM.probe} 문제</b> · `, tail = `<br><span class="ap-small ap-muted">맞히면 ${q_(key, id)}${josa(cshort(key, id), '은', '는')} 원인이 아니고, 틀리면 ${q_(key, id)}의 ${PJ('을', '를')} 이어서 물어봐요.</span>`;
  if(SES.cur.kind === 'again') return head + `방금 틀린 ${qj(key, id, '을', '를')} 다른 문제로 한 번 더 물어볼게요. 실수였는지, 정말 모르는지 가려요.`;
  const below = p ? p.stack[p.stack.length - 1] : null;
  if(p && p.also.includes(id) && below === p.from) return head + `방금 틀린 문제는 ${q_(key, p.from)}${josa(cshort(key, p.from), '과', '와')} ${qj(key, id, '을', '를')} 같이 물었어요. ${qj(key, id, '을', '를')} 아는지 볼게요.` + tail;
  if(below != null && below !== id) return head + `${qj(key, below, '을', '를')} 이해하려면 먼저 ${qj(key, id, '을', '를')} 알아야 해요(${TERM.pre}). ${qj(key, id, '을', '를')} 아는지 볼게요.` + tail;
  return head + `${qj(key, id, '을', '를')} 아는지 볼게요.` + tail;
}
function selfGradeBox(q){
  return `<div class="ap-fb"><h4>모범답안</h4><div class="lec"><p><b>${q.answer_html}</b></p>${q.extra || ''}</div>
    <p class="ap-small ap-muted">자동 채점이 안 되는 답이에요. 내 답이 같은 뜻이면 "맞았어요"를 눌러 주세요.${AI.ok ? '' : ' (Claude 안에서 열면 AI가 채점해요)'}</p>
    <div class="ap-row"><button class="ap-btn pri" data-self="1">맞았어요</button><button class="ap-btn" data-self="0">틀렸어요</button></div></div>`;
}
function transHint(st, c){
  const N = RULES.need;
  if(c.after === 'know') return c.before === 'know' ? `${c.streak}번 연속 · 다음 점검 ${md(dueAt(st, c.id))}` : '';
  if(c.after === 'half') return `${N - c.streak}번 더 맞히면 정복`;
  if(c.after === 'unknown') return `다시 ${N}번 연속 맞히면 정복`;
  return '';
}
function transHtml(key, st, ch, q){
  const rows = ch.map(c => { const same = c.before === c.after && c.after !== 'half';
    const after = pill(c.after, c.after === 'half' ? ` ${Math.min(c.streak, RULES.need)}/${RULES.need}` : '');
    const win = c.after === 'know' && c.before !== 'know' ? '<span class="ap-win" aria-label="정복">🚩 정복!</span>' : '';
    return `<li>${nchip(key, c.id)}${same ? after : `${pill(c.before)}<span class="ap-muted" aria-label="에서">→</span>${after}`}${win}<span class="hint">${transHint(st, c)}</span></li>`; });
  const skipped = q.concepts.filter(c => S(key).ix.live(c) && !ch.some(x => x.id === c));
  if(skipped.length) rows.push(`<li class="hint">${skipped.map(c => q_(key, c)).join(', ')}${josa(cshort(key, skipped[skipped.length - 1]), '은', '는')} 같이 묻는 문제였지만, 틀린 원인이 어느 쪽인지 몰라서 상태를 그대로 뒀어요.</li>`);
  return `<div class="ap-ch3" style="margin-top:10px">${helpBtn('change')}<span>${COPY.titles.change}</span></div><ul class="ap-trans">${rows.join('')}</ul>`;
}
// "옳지 않은 것은?" 같은 문제에서 보기 해설이 "맞아."로 시작하면, 내 답이 맞았다는 말로 읽힌다.
// 보기 문장이 맞는 내용인지·틀린 내용인지로 바꿔 말한다.
const NEG_Q = /않은|아닌|틀린|옳지|거리가 먼|관계없는|해당하지/;
function explOf(q, n){
  const e = q.expl[String(n)] || '';
  if(!NEG_Q.test(q.question_text || '')) return e;
  if(q.answer.includes(n)) return e.replace(/^(틀렸어요|틀렸어|틀린 설명(이에요|이야)?|틀림)[.!]?\s*/, '틀린 내용이라 정답이에요. ');
  return e.replace(/^(맞는 설명(이에요|이야|이다)?|맞아요|맞아|맞음|옳은 설명(이에요|이야)?|옳아요|옳아)[.!]?\s*/, '맞는 내용이라 답이 아니에요. ').trim();
}
function feedbackHtml(key, st, q){
  const ok = SES.correct;
  let h = `<div class="ap-fb ${ok ? 'ok' : 'bad'}" role="status" id="fb"><h4>${ok ? '✓ 맞았어요' : '✗ 틀렸어요'}${q.kind === 'mcq' ? ` · 정답 ${q.answer.map(n => CIRC[n - 1]).join(', ')}` : ''}</h4>`;
  if(q.kind === 'mcq'){
    if(!ok && SES.choice != null && q.expl[String(SES.choice + 1)]) h += `<div class="lec"><p><b>내가 고른 ${CIRC[SES.choice]}:</b> ${explOf(q, SES.choice + 1)}</p></div>`;
    const right = q.answer.map(n => q.expl[String(n)] ? `<p><b>정답 ${CIRC[n - 1]}:</b> ${explOf(q, n)}</p>` : '').join('');
    if(right) h += `<div class="lec">${right}</div>`;
    if(q.tail) h += `<div class="lec"><p>${q.tail}</p></div>`;
    const rest = q.options.map((_, i) => i + 1).filter(n => !q.answer.includes(n) && n - 1 !== SES.choice && q.expl[String(n)]);
    if(rest.length || q.extra) h += `<details${q.tid && String(q.tid).startsWith('calc') ? ' open' : ''}><summary class="ap-small">${rest.length ? '나머지 보기 해설' : ''}${rest.length && q.extra ? ' · ' : ''}${q.extra ? '풀이' : ''}</summary><div class="lec">${rest.map(n => `<p><b>${CIRC[n - 1]}:</b> ${explOf(q, n)}</p>`).join('')}${q.extra || ''}</div></details>`;
  } else {
    if(SES.aiGrade) h += `<p class="ap-small"><b>AI 채점 ${SES.aiGrade.score}/10</b> · ${esc(SES.aiGrade.feedback || '')}${SES.aiGrade.missing && SES.aiGrade.missing.length ? `<br>빠진 것: ${SES.aiGrade.missing.map(esc).join(', ')}` : ''}</p>`;
    if(SES.text) h += `<p class="ap-small ap-muted">내 답: ${esc(SES.text)}</p>`;
    if(SES.kwHit && q.kw) h += `<p class="ap-small">핵심어 ${SES.kwHit.score}/${SES.kwHit.total}: ${q.kw.map((k, i) => `<span class="${SES.kwHit.hit[i] ? 'ap-okc' : 'ap-noc'}">${SES.kwHit.hit[i] ? '✓' : '✗'} ${esc(k[0])}</span>`).join(' · ')}</p>`;
    h += `<div class="lec"><p><b>모범답안:</b> ${q.answer_html}</p>${q.extra || ''}</div>`;
  }
  h += transHtml(key, st, SES.lastChanges, q);
  h += `</div>`;
  h += noteHtml(key, st);
  if(SES.ai) h += aiBoxHtml();
  const sid = q.scene || sceneOf(key, q.concepts[0]);
  // 다음 버튼은 화면 아래에 붙어 있어서 해설을 끝까지 안 내려도 누를 수 있다
  h += `<div class="ap-actbar"><button class="ap-btn pri" id="next">${nextLabel()}</button>${sid ? `<a class="ap-btn" href="${sceneLink(key, sid)}">강의로 보기</a>` : ''}${AI.ok && !SES.ai ? '<button class="ap-btn" id="askAI">AI에게 물어보기</button>' : ''}</div>`;
  return h;
}
function nextLabel(){
  if(SES.probe && !SES.probe.done) return `${TERM.icon} ${TERM.probe} 문제 풀기 →`;
  const st = store.load(SES.key);
  if(SES.mode === 'concept' && ['know', 'unknown'].includes(statusOf(st, SES.focus))) return '결과 보기';
  return SES.n >= SES.max ? '결과 보기' : '다음 문제 →';
}
const probeHead = title => `<div class="ap-ch3">${helpBtn('probe')}<span>${title}</span></div>`;
function noteHtml(key, st){
  const n = SES.note; if(!n) return '';
  const {ix} = S(key), U = ST('unknown').label, P = TERM.pre;
  if(n.kind === 'capped') return `<div class="ap-probe">${probeHead(`${TERM.icon} ${TERM.probe}는 이번 판에 3번 했어요`)}<p>${qj(key, n.id, '은', '는')} ${SL('unknown', '으로', '로')} 표시해 뒀어요. 길잡이 화면에서 이어서 볼 수 있어요.</p></div>`;
  if(n.kind === 'known'){
    if(n.blockers.length) return `<div class="ap-probe">${probeHead(`${qj(key, n.id, '은', '는')} 기초가 비어 있어요`)}<p>${TERM.pre} ${n.blockers.map(b => q_(key, b)).join(', ')}${josa(cshort(key, n.blockers[n.blockers.length - 1]), '이', '가')} 아직 ${U}${yo(U)}. ${qj(key, n.blockers[0], '을', '를')} 먼저 정복하면 ${q_(key, n.id)}도 풀려요.</p><div class="ap-row" style="margin-top:6px">${lecBtn(key, n.blockers[0], '기초 강의 보기')}</div></div>`;
    return `<div class="ap-probe">${probeHead(`${qj(key, n.id, '은', '는')} ${n.twice ? '2번 연속 틀렸어요' : `아직 ${U}${yo(U)}`}`)}<p>${q_(key, n.id)}의 ${PJ('은', '는')} 괜찮아요. ${q_(key, n.id)} 강의를 다시 읽고 도전해 보세요.</p><div class="ap-row" style="margin-top:6px">${lecBtn(key, n.id)}</div></div>`;
  }
  if(n.kind === 'probe-start'){
    const pre = ix.byId.get(n.id).prereq.filter(ix.live), names = xs => xs.map(x => q_(key, x)).join(', ');
    let p = `<div class="ap-probe">${probeHead(`${TERM.icon} ${TERM.probe}를 시작할게요`)}<p>${qj(key, n.id, '이', '가')} ${pill('unknown')}${josa(U, '이', '가')} 됐어요. `;
    if(n.already.length) p += `${P} ${q_(key, n.already[0])}${josa(cshort(key, n.already[0]), '이', '가')} 이미 ${U}${josa(U, '이라서', '라서')}, ${q_(key, n.already[0])} 때문에 틀렸을 가능성이 커요.${n.first != null ? ` ${q_(key, n.already[0])}의 ${PJ('도', '도')} 짧은 문제로 물어볼게요.` : ''}`;
    else if(n.first == null) p += '';
    else if(n.firstKind === 'again') p += pre.length ? `${P} ${names(pre)}${josa(cshort(key, pre[pre.length - 1]), '은', '는')} 괜찮아요. 다른 문제로 한 번 더 볼게요.` : `${qj(key, n.id, '은', '는')} ${PJ('이', '가')} 없는 첫 개념이에요. 다른 문제로 한 번 더 볼게요.`;
    else { const last = pre.length ? cshort(key, pre[pre.length - 1]) : '';
      const what = pre.length ? `${P} ${names(pre)}${n.also.length ? `${josa(last, '과', '와')} 같이 묻던 개념을` : josa(last, '을', '를')}` : '같이 묻던 개념을';
      p += `틀린 이유가 기초에 있는지 보려고, ${what} 짧은 문제로 하나씩 물어볼게요. 답만 고르면 돼요.`; }
    p += '</p>';
    if(n.after) p += probeDoneText(key, st, n.after);
    return p + '</div>';
  }
  if(n.kind === 'check'){
    const name = q_(key, n.id), J = josa(cshort(key, n.id), '은', '는');
    let t;
    if(n.ck === 'again') t = n.v === 'ok' ? `다시 맞혔어요. 처음 틀린 건 실수였나 봐요. ${name}${J} 이제 ${pill('half')}${yo(ST('half').label)}.` : `또 틀렸어요. ${name}${J} ${pill('unknown')}${josa(U, '이', '가')} 맞아요.`;
    else t = n.v === 'ok' ? `${name} 맞혔어요 → ${pill('half')}. ${name}${J} 원인이 아니에요.` : `${name}도 틀렸어요 → ${pill('unknown')}. ${qj(key, n.id, '의', '의')} 기초로 한 칸 더 내려가 볼게요.`;
    let h = `<div class="ap-probe">${probeHead(`${TERM.icon} ${TERM.probe} 결과`)}<p>${t}</p>`;
    if(n.after) h += probeDoneText(key, st, n.after);
    return h + '</div>';
  }
  if(n.kind === 'probe-end') return `<div class="ap-probe">${probeDoneText(key, st, n.after)}</div>`;
  return '';
}
function probeDoneText(key, st, p){
  const left = p.left.length ? `<p class="ap-small ap-muted">아직 안 물어본 ${TERM.pre}: ${p.left.map(x => q_(key, x)).join(', ')} (길잡이에서 이어서 풀 수 있어요)</p>` : '';
  if(p.manual && (p.root == null || p.root === p.from)) return `<p><b>${TERM.probe} 끝.</b> 물어본 ${TERM.pre} 중에 ${SL('unknown', '은', '는')} 없었어요.</p>${left}`;
  if(p.slip || p.root == null) return `<p><b>${TERM.probe} 끝.</b> 실수였던 것 같아요. ${q_(key, p.from)}${josa(cshort(key, p.from), '은', '는')} ${pill('half')}${yo(ST('half').label)}.</p>${left}`;
  if(!p.found) return `<p><b>${TERM.probe} 끝 · 출발점은 ${q_(key, p.root)} 자체예요.</b> ${q_(key, p.root)}의 ${PJ('은', '는')} 괜찮아요. ${q_(key, p.root)} 강의부터 읽으면 돼요.</p><div class="ap-row" style="margin-top:6px">${lecBtn(key, p.root, '강의 보기')}</div>${left}`;
  return `<p><b>출발점을 찾았어요: ${q_(key, p.root)}</b></p>${pathHtml(key, st, p.path)}<p class="ap-small ap-muted">왼쪽부터 공부할 순서예요. ${qj(key, p.root, '을', '를')} 정복하면 ${q_(key, p.from)}까지 차례로 풀려요.</p><div class="ap-row" style="margin-top:6px">${lecBtn(key, p.root, '출발점 강의 보기')}</div>${left}`;
}
function sessionSummary(){
  const key = SES.key, st = store.load(key), sum = summarize(SES.changes);
  const ok = SES.results.filter(r => r.ok).length, roots = new Map(), nChk = SES.results.filter(r => r.check != null).length;
  for(const p of SES.probes) if(p.root != null && !p.slip && !(p.manual && p.root === p.from)){ if(!roots.has(p.root)) roots.set(p.root, {root:p.root, path:p.path, from:new Set()}); roots.get(p.root).from.add(p.from); }
  const gaps = [...roots.values()], won = sum.filter(x => x.after === 'know' && x.before !== 'know' && statusOf(st, x.id) === 'know');
  const by = s => sum.filter(x => statusOf(st, x.id) === s);
  let h = `<div class="ap-narrow"><h2 class="ap-h2">${esc(SES.title)} 끝</h2>
    <div class="ap-stats"><div class="ap-stat"><b>${ok}/${SES.results.length}</b><span>맞힘${nChk ? ` (${TERM.icon} ${TERM.probe} ${nChk}개 포함)` : ''}</span></div><div class="ap-stat"><b>${won.length}</b><span>${ST('know').icon} 새로 정복</span></div><div class="ap-stat"><b>${gaps.length}</b><span>찾은 출발점</span></div></div>`;
  if(won.length) h += `<div class="ap-card ap-wincard"><div class="ap-h3">${ST('know').icon} 새로 정복한 개념</div>${chips(key, st, won.map(x => x.id))}</div>`;
  if(SES.mode === 'pre' && SES.probes.length && !gaps.length) h += `<div class="ap-card">${probeDoneText(key, st, SES.probes[SES.probes.length - 1])}</div>`;
  if(gaps.length) h += `<div class="ap-card em">${cardHead('찾은 출발점 → 여기부터 공부하면 돼요', 'guide')}${gaps.map(g => `<div style="margin:8px 0">${pathHtml(key, st, g.path)}${g.from.size > 1 ? `<p class="ap-small ap-muted" style="margin:0 0 6px">틀린 개념 ${g.from.size}개(${[...g.from].map(f => q_(key, f)).join(', ')})가 모두 여기로 이어져요.</p>` : ''}<div class="ap-row"><button class="ap-btn sm pri" data-start="concept" data-arg="${g.root}">출발점 정복하기</button>${lecBtn(key, g.root, '출발점 강의 보기')}</div></div>`).join('')}</div>`;
  const groups = [['half', `${RULES.need}번 연속 맞히면 정복이에요`], ['unknown', '강의를 보고 다시 도전해요'], ['know', '정복한 개념이에요']].map(([s, d]) => { const xs = by(s); return xs.length ? `<li>${pill(s)} <span class="ap-small ap-muted">${d}</span><div style="margin-top:4px">${chips(key, st, xs.map(x => x.id))}</div></li>` : ''; }).join('');
  if(groups) h += `<div class="ap-card">${cardHead('이번에 푼 개념의 지금 상태', 'change')}<ul class="ap-glist">${groups}</ul></div>`;
  h += `<div class="ap-row"><a class="ap-btn pri" href="#/${key}/today">${COPY.tabs.today}에서 다음 목적지 보기</a><button class="ap-btn" data-start="smart">10문제 더</button><a class="ap-btn" href="#/${key}/map">지도 보기</a></div></div>`;
  return h;
}

// ── 화면: 길잡이 ──
// 위에서부터: 🧭 다음 목적지(하나만, 큰 버튼) → 개념 정복 현황(숫자·막대) → 추천 정복 코스(다른 선택지) → 최근 푼 문제 → 기록·설정
// 공부는 하기 싫은 게 보통이라 "할 일"이 아니라 탐험 말투로, 걸리는 시간과 "1번만 더"를 보여 줘서 시작 문턱을 낮춘다.
const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
// 며칠 연속 공부했나 (오늘 안 풀었으면 어제까지 이어진 날 수), 오늘 푼 문제 수
function streakInfo(st){
  const days = new Set(st.attempts.map(a => dayKey(a.t))), d = new Date(now()), today = dayKey(d);
  const todayN = st.attempts.filter(a => dayKey(a.t) === today).length;
  if(!days.has(today)) d.setDate(d.getDate() - 1);
  let n = 0; while(days.has(dayKey(d))){ n++; d.setDate(d.getDate() - 1); }
  return {days:n, today:todayN};
}
// 강의 장면 읽는 데 걸리는 시간(분): 글자 수 기준
const readMin = (key, sid) => { const sc = S(key).data.scenes[sid]; return Math.max(1, Math.round(String((sc && sc.text) || '').length / 450)); };
const progChip = (key, st, id) => `<a class="ap-chip" href="#/${key}/map/${id}">${ic('half')}<span>${esc(cshort(key, id))}</span><b class="ap-num">${streakOf(st, id)}/${RULES.need}</b></a>`;
const halfSorted = (st, ids) => ids.slice().sort((a, b) => streakOf(st, b) - streakOf(st, a));

// 다음 목적지 하나: 처음 → 진단 / 출발점 → 정복 / 다시 점검 / 진행 중인 모험 / 미지의 영역 탐험
function nextAction(key, st, r){
  const M = COPY.modes, g = r.guide, N = RULES.need;
  if(!st.attempts.length) return {kind:'diag', title:`${M.diag.title}로 첫 탐험을 시작해요`,
    why:`장마다 1문제씩 12문제를 풀면 지도에 아는 곳과 모르는 곳이 표시돼요. 약 10분 걸려요. 틀린 문제는 어디서부터 공부할지 알려 주는 단서가 되니까 부담 없이 풀어 보세요.`,
    btns:`<button class="ap-btn pri big" data-start="diag">${M.diag.title} 시작</button>`};
  if(g.starts.length){
    const s = g.starts[0], X = q_(key, s.id), sid = sceneOf(key, s.id), k = st.k[s.id], read = sid && (st.read[sid] || 0) > (k ? k.last : 0);
    const shown = s.unlocks.slice(0, 2), ups = shown.map(u => q_(key, u)).join(', ') + (s.unlocks.length > 2 ? ` 외 ${s.unlocks.length - 2}개` : '');
    const upsJ = (a, b) => s.unlocks.length > 2 ? b : josa(cshort(key, shown[shown.length - 1]), a, b);
    const why = s.unlocks.length
      ? `정복 실패한 ${ups}${upsJ('이', '가')} ${X}에서 막혔어요. ${qj(key, s.id, '을', '를')} 정복하면 ${ups}도 풀 수 있어요.`
      : `${X} 문제를 가장 최근에 틀렸어요. ${X}의 기초 개념은 괜찮아서 ${X}만 다시 잡으면 돼요.`;
    const steps = `<ol class="ap-path2">${sid ? `<li class="${read ? 'done' : ''}">📖 강의 장면 읽기 · 약 ${readMin(key, sid)}분${read ? ' · 읽음' : ''}</li>` : ''}<li>✏️ 문제 ${N}번 연속 맞히기</li></ol>`;
    const btns = read || !sid ? `<button class="ap-btn pri big" data-start="concept" data-arg="${s.id}">✏️ 문제 풀러 가기</button>${sid ? `<a class="ap-btn" href="${sceneLink(key, sid)}">강의 다시 보기</a>` : ''}`
      : `<a class="ap-btn pri big" href="${sceneLink(key, sid)}">📖 강의부터 읽기</a><button class="ap-btn" data-start="concept" data-arg="${s.id}">바로 문제 풀기</button>`;
    return {kind:'start', title:`${X} 정복하러 가기`, why, extra:steps, btns};
  }
  if(r.due.length) return {kind:'due', title:`${COPY.due.icon} 정복한 개념 ${r.due.length}개를 다시 점검할 때예요`,
    why:`정복하고 며칠이 지나면 잊기 쉬워요. 한 번씩만 맞히면 ${ic('know')} 정복이 유지되고, 다음 점검까지 기간이 길어져요.`,
    extra:`<div class="ap-chips" style="margin:-4px 0 12px">${r.due.slice(0, 4).map(id => cchip(key, st, id)).join('')}${r.due.length > 4 ? `<span class="ap-small ap-muted">외 ${r.due.length - 4}개</span>` : ''}</div>`,
    btns:`<button class="ap-btn pri big" data-start="review">${M.review.title} 시작</button>`};
  if(r.half.length){ const hs = halfSorted(st, r.half), top = hs[0], left = toKnow(st, top);
    return {kind:'half', title:'아직 진행 중인 모험이 있어요',
      why:`${qj(key, top, '은', '는')} ${streakOf(st, top)}번 연속 맞혔어요. ${left}번만 더 맞히면 ${ic('know')} 정복이에요.${hs.length > 1 ? ` 진행 중인 모험은 모두 ${hs.length}개예요.` : ''}`,
      extra:`<div class="ap-chips" style="margin:-4px 0 12px">${hs.slice(0, 4).map(id => progChip(key, st, id)).join('')}</div>`,
      btns:`<button class="ap-btn pri big" data-start="half">모험 이어가기</button>`}; }
  if(r.count.none) return {kind:'explore', title:`${ic('none')} 미지의 영역을 탐험해요`,
    why:`아직 문제를 풀지 않은 개념이 ${r.count.none}개 있어요. ★ 높은 개념(시험에 자주 나오는 개념)부터 10문제를 골라 드려요.`,
    btns:`<button class="ap-btn pri big" data-start="smart">${M.smart.title}</button>`};
  return {kind:'smart', title:'🏆 모든 개념을 정복했어요', why:'다시 점검할 때가 된 개념이 생기면 여기에서 알려 드려요.', btns:`<button class="ap-btn pri big" data-start="smart">${M.smart.title}</button>`};
}
function nextCard(key, st, a){
  const sk = streakInfo(st), fire = sk.today ? `🔥 ${sk.days}일 연속 · 오늘 ${sk.today}문제` : sk.days ? `🔥 ${sk.days}일 연속 중` : '';
  const alt = st.attempts.length && a.kind !== 'explore' && a.kind !== 'smart';
  return `<div class="ap-card ap-next" data-tour="start"><div class="ap-nhead">${cardHead(`🧭 ${COPY.titles.next}`, 'next')}${fire ? `<span class="ap-fire">${fire}</span>` : ''}</div>
    <div class="ap-ntitle">${a.title}</div><p class="ap-nwhy">${a.why}</p>${a.extra || ''}<div class="ap-row">${a.btns}</div>
    ${alt ? `<p class="ap-small ap-muted" style="margin:10px 0 0">다른 길로 가고 싶다면 <button class="ap-linkbtn" data-start="smart">${COPY.modes.smart.title}</button> · 지도 상태에 맞춰 골라 섞어 줘요</p>` : ''}</div>`;
}
function statusCard(key, st, r){
  const tot = r.total, c = r.count, J = COPY.journey, data = S(key).data, N = RULES.need, explored = tot - c.none, pct = n => Math.round(n / tot * 100);
  return `<div class="ap-card" data-tour="status">${cardHead(COPY.titles.status, 'status', COPY.titles.statusSub({name:data.name, total:tot}))}
    <div class="ap-counts">${J.map(s => `<button class="ap-count s-${s}" data-mapf-go="${s}" title="지도에서 ${ST(s).label}만 보기"><b>${c[s]}</b><span>${ST(s).icon} ${ST(s).label}</span></button>`).join('')}</div>
    <div class="ap-progline"><span>탐험 <b>${explored}</b>/${tot} · ${pct(explored)}%</span><span>${ST('know').icon} 정복 <b>${c.know}</b>/${tot} · ${pct(c.know)}%</span></div>
    <div class="ap-stack" role="img" aria-label="탐험 ${pct(explored)}%, 정복 ${pct(c.know)}%">${['know', 'half', 'unknown', 'none'].map(s => `<i class="s-${s}" style="width:${c[s] / tot * 100}%"></i>`).join('')}</div>
    <p class="ap-small ap-muted" style="margin:6px 0 0">${ic('none')} 미지의 영역 개념의 문제를 풀면 막대에 색이 칠해지고(탐험), 같은 개념을 ${N}번 연속 맞히면 ${ic('know')} 초록색(정복)으로 바뀌어요.</p>
    <p class="ap-small ap-muted" style="margin:4px 0 0">★5 핵심 개념 정복 ${r.coreKnow}/${r.coreTotal} · 읽은 강의 장면 ${Object.keys(st.read).length}/${Object.keys(data.scenes).length}</p></div>`;
}
// 추천 정복 코스: 다음 목적지로 고른 것은 빼고, 다른 선택지를 종류별로
function courseCard(key, st, r, a){
  const T = COPY.titles, M = COPY.modes, g = r.guide, {ix} = S(key), secs = [];
  const few = (ids, n = 4) => `<div class="ap-chips">${ids.slice(0, n).map(id => cchip(key, st, id)).join('')}${ids.length > n ? `<span class="ap-small ap-muted">외 ${ids.length - n}개</span>` : ''}</div>`;
  const sec = (head, help, btn, body) => `<section class="ap-csec"><div class="ap-mhead"><span class="ap-ch3" style="margin:0">${help ? helpBtn(help) : ''}<span>${head}</span></span>${btn || ''}</div>${body}</section>`;
  const row = s => `<li><div class="ap-ghead">${ic('unknown')}<a class="ap-gname" href="#/${key}/map/${s.id}">${esc(cshort(key, s.id))}</a><span class="ap-num" title="시험 중요도">${'★'.repeat(ix.byId.get(s.id).stars)}</span></div>
    ${s.unlocks.length ? `<div class="ap-small ap-muted">정복하면 ${s.unlocks.slice(0, 2).map(u => q_(key, u)).join(', ')}${s.unlocks.length > 2 ? ` 외 ${s.unlocks.length - 2}개` : ''}도 풀려요</div>` : ''}
    <div class="ap-row" style="margin-top:6px"><button class="ap-btn sm pri" data-start="concept" data-arg="${s.id}">정복하기</button>${lecBtn(key, s.id, '강의')}${s.unchecked.length ? `<button class="ap-btn sm" data-start="pre" data-arg="${s.id}" title="아직 안 풀어 본 ${TERM.pre}를 짧은 문제로 풀어서, 진짜 원인이 더 아래에 있는지 확인해요">${TERM.icon} 기초 ${s.unchecked.length}개 풀어 보기</button>` : ''}</div></li>`;
  const starts = a.kind === 'start' ? g.starts.slice(1) : g.starts;
  if(starts.length) secs.push(sec(`🧱 ${T.starts}`, 'roles', '', `<ol class="ap-glist2">${starts.slice(0, 3).map(row).join('')}</ol>${starts.length > 3 ? `<details><summary class="ap-small">출발점 ${starts.length - 3}개 더 보기</summary><ol class="ap-glist2">${starts.slice(3).map(row).join('')}</ol></details>` : ''}`));
  if(g.blocked.length) secs.push(sec(`🔒 ${COPY.role.blocked.label} · ${g.blocked.length}개`, 'guide', '', `<p class="ap-small ap-muted" style="margin:0 0 6px">기초 개념에 정복 실패가 있어서, 출발점을 정복하면 이어서 풀 수 있는 개념이에요.</p>${few(g.blocked)}`));
  if(r.half.length && a.kind !== 'half') secs.push(sec(`${ic('half')} ${T.half} · ${r.half.length}개`, 'change', `<button class="ap-btn sm" data-start="half">모험 이어가기</button>`, `<div class="ap-chips">${halfSorted(st, r.half).slice(0, 4).map(id => progChip(key, st, id)).join('')}${r.half.length > 4 ? `<span class="ap-small ap-muted">외 ${r.half.length - 4}개</span>` : ''}</div>`));
  if(r.due.length && a.kind !== 'due') secs.push(sec(`${COPY.due.icon} ${T.due} · ${r.due.length}개`, 'review', `<button class="ap-btn sm" data-start="review">${M.review.title}</button>`, few(r.due)));
  if(r.untested.length && a.kind !== 'explore') secs.push(sec(`${ic('none')} ${T.untested} · ${r.untested.length}개`, 'stars', `<button class="ap-btn sm" data-start="diag">진단으로 탐험</button>`, few(r.untested)));
  if(r.nextScene){ const sc = S(key).data.scenes[r.nextScene]; secs.push(sec(`📖 ${T.next_read}`, '', '', `<a class="ap-link" href="${sceneLink(key, r.nextScene)}">${sc.lesson}강 · ${esc(sc.title)} · 약 ${readMin(key, r.nextScene)}분 →</a>`)); }
  return `<div class="ap-card" data-tour="guide">${cardHead(T.course, 'guide', T.courseSub)}${secs.join('')}</div>`;
}
// 아직 푼 문제가 없을 때: 지금 할 것과 그다음에 일어날 일
function flowCard(){
  return `<div class="ap-card" data-tour="guide">${cardHead(COPY.titles.flow, 'guide')}<ol class="ap-flow">
    <li><b>${ic('none')} 탐험</b><span>진단 12문제나 강의로 지도의 안개를 걷어요.</span></li>
    <li><b>${TERM.icon} ${TERM.probe}</b><span>틀린 문제가 생기면 ${TERM.pre}를 짧은 문제로 짚어서, 지도에 ${roleTag('start')}(정복 실패의 뿌리)을 표시해요.</span></li>
    <li><b>${ic('know')} 정복</b><span>출발점부터 강의를 읽고 문제를 ${RULES.need}번 연속 맞혀요. 출발점 위에 쌓인 개념도 차례로 풀려요.</span></li></ol></div>`;
}
function recentCard(key, st){
  const xs = st.attempts.slice(-6).reverse();
  return `<div class="ap-card">${cardHead(COPY.titles.recent, 'recent')}<ul class="ap-list ap-recent">${xs.map(a => { const id = a.chk != null ? a.chk : a.c[0];
    return `<li><a href="#/${key}/map/${id}"><span class="ap-cname"><span class="${a.ok ? 'ap-okc' : 'ap-noc'}" aria-label="${a.ok ? '맞힘' : '틀림'}">${a.ok ? '✓' : '✗'}</span><span>${esc(cshort(key, id))}</span>${a.chk != null ? `<span class="ap-badge chk" title="틀린 문제의 원인을 찾으려고 낸 ${TERM.pre} 문제">${TERM.icon} ${TERM.probe}</span>` : ''}</span><span class="ap-num">${md(a.t)} ›</span></a></li>`; }).join('')}</ul></div>`;
}
function settingsCard(key){
  const data = S(key).data;
  return `<details class="ap-card ap-set"${RESET === key ? ' open' : ''}><summary>${COPY.titles.settings}</summary>
    <div class="ap-ch3" style="margin-top:10px">${helpBtn('storage')}<span>기록 저장</span></div><p class="ap-small ap-muted" style="margin:0 0 8px">${storeText()}</p>
    <div class="ap-row"><button class="ap-btn sm${RESET === key ? ' warn' : ''}" id="reset">${RESET === key ? '정말 지울까요? 한 번 더 누르면 지워져요' : `${esc(data.short)} 기록 지우기`}</button></div>
    <p class="ap-small ap-muted" style="margin:10px 0 0">컴퓨터 단축키: <kbd>1</kbd>~<kbd>4</kbd> 보기 고르기 · <kbd>Enter</kbd> 다음 · <kbd>Esc</kbd> 창 닫기</p></details>`;
}
function renderToday(){
  const key = route.subj, st = store.load(key), {data, ix} = S(key), t = now(), r = recommend(ix, st, t), a = nextAction(key, st, r);
  let h = `<div class="ap-narrow"><h2 class="ap-h2">${esc(data.name)}</h2>`;
  h += nextCard(key, st, a);
  h += statusCard(key, st, r);
  h += st.attempts.length ? courseCard(key, st, r, a) : flowCard();
  h += aiCoachHtml();
  if(st.attempts.length) h += recentCard(key, st);
  h += settingsCard(key);
  return h + `</div>`;
}
let RESET = null;
function storeText(){ return store.mode === 'db' ? 'Claude 계정에 저장돼요. 다른 기기에서 열어도 이어서 할 수 있어요.' : store.mode === 'local' ? '이 브라우저에만 저장돼요. 다른 기기와는 이어지지 않아요. (Claude 안에서 열면 계정에 저장돼요)' : '저장이 안 되는 환경이에요. 새로고침하면 사라져요.'; }

// ── 화면: 강의 ──
function renderLec(){
  const key = route.subj, st = store.load(key), {data} = S(key);
  const arg = route.arg;
  if(!arg){
    return `<div class="ap-narrow"><div class="ap-ch3 ap-h2row">${helpBtn('lessons')}<h2 class="ap-h2">${esc(data.name)} ${COPY.titles.lec}</h2></div><p class="ap-muted ap-small">강의마다 개념 하나에 이야기 장면 하나씩 구성했어요.</p><ul class="ap-lessons" data-tour="lessons">${data.lessons.map(L => {
      const read = L.scenes.filter(s => st.read[s]).length, cids = [...new Set(L.scenes.flatMap(s => data.scenes[s].concepts))], kn = cids.filter(c => statusOf(st, c) === 'know').length, un = cids.filter(c => statusOf(st, c) === 'unknown').length;
      return `<li><a class="ap-lcard" href="#/${key}/lec/${L.num}"><span class="n">${L.num}강</span><span class="t">${esc(L.title)}</span><span class="m">장면 ${read}/${L.scenes.length} 읽음 · ${ST('know').icon} 정복 ${kn}/${cids.length}${un ? ` · ${ST('unknown').icon} 실패 ${un}` : ''}</span><span class="ap-bar" style="margin-top:4px" role="img" aria-label="장면 ${L.scenes.length}개 중 ${read}개 읽음"><i style="width:${read / L.scenes.length * 100}%;background:var(--ink)"></i></span></a></li>`; }).join('')}</ul></div>`;
  }
  const [ln] = arg.split('-'), L = data.lessons.find(l => String(l.num) === ln);
  if(!L) return `<p>강의를 찾을 수 없어요.</p>`;
  const idx = data.lessons.indexOf(L), prev = data.lessons[idx - 1], next = data.lessons[idx + 1];
  const read = L.scenes.filter(s => st.read[s]).length, unread = L.scenes.find(s => !st.read[s]);
  let h = `<article class="ap-narrow"><div class="ap-row" style="margin-bottom:12px"><a class="ap-btn sm" href="#/${key}/lec">← 강의 목록</a>${prev ? `<a class="ap-btn sm" href="#/${key}/lec/${prev.num}">${prev.num}강</a>` : ''}${next ? `<a class="ap-btn sm" href="#/${key}/lec/${next.num}">${next.num}강 →</a>` : ''}</div>
    <div class="ap-lhead"><div class="ap-eyebrow">${L.num}강 · 장면 ${L.scenes.length}개 · ${read}개 읽음</div><h2>${esc(L.title)}</h2><p class="lede ap-muted">${L.lede}</p>${L.flow ? `<div class="flow"><span class="lab">이 강의 지도</span> ${L.flow}</div>` : ''}
    <div class="ap-row" style="margin-top:10px">${read && unread ? `<a class="ap-btn sm pri" href="#/${key}/lec/${unread}">안 읽은 장면으로 ↓</a>` : ''}<button class="ap-btn sm" data-start="lesson" data-arg="${L.num}">이 강 문제 풀기</button></div></div>`;
  L.scenes.forEach(sid => { const sc = data.scenes[sid], nq = poolOf(key, q => q.scene === sid).length;
    h += `<section class="ap-scene lec" id="sc-${sid}"><span class="ap-stag">장면 ${sc.k}${sc.stars ? ` · 중요도 ${'★'.repeat(sc.stars)}` : ''}${sc.tag ? ' · ' + esc(sc.tag) : ''}${st.read[sid] ? ' · ✓ 읽음' : ''}</span><h3>${esc(sc.title)}</h3>
      ${sc.concepts.length ? `<div class="ap-qc" style="margin:8px 0 4px"><span>이 장면의 개념</span>${sc.concepts.map(c => `${nchip(key, c)}${pillOf(st, c)}`).join(' ')}</div>` : ''}
      ${sc.html}
      <div class="ap-sfoot"><div class="ap-row"><button class="ap-btn sm${st.read[sid] ? '' : ' pri'}" data-read="${sid}">${st.read[sid] ? '✓ 읽음' : '다 읽었어요'}</button>${sc.concepts.length ? `<button class="ap-btn sm" data-start="concept" data-arg="${sc.concepts[0]}">개념 정복하기</button>` : ''}${nq ? `<button class="ap-btn sm" data-start="scene" data-arg="${sid}">이 장면 문제 ${nq}개</button>` : ''}${AI.ok && sc.concepts.length ? `<button class="ap-btn sm" data-aigen="${sc.concepts[0]}">AI가 새 문제 만들기</button>` : ''}</div></div></section>`; });
  if(L.sum) h += `<div class="sum lec" style="margin-top:36px;background:var(--surface);border:2px solid var(--ink);border-radius:10px;padding:14px 16px"><h3 style="font-family:var(--display);font-weight:400">📌 ${L.num}강 한 줄 요약</h3>${L.sum}</div>`;
  if(L.next) h += `<p class="ap-muted ap-small" style="margin-top:14px">${L.next}</p>`;
  h += `<div class="ap-row" style="margin-top:20px;justify-content:space-between">${prev ? `<a class="ap-btn" href="#/${key}/lec/${prev.num}">← ${prev.num}강</a>` : '<span></span>'}${next ? `<a class="ap-btn pri" href="#/${key}/lec/${next.num}">${next.num}강으로 →</a>` : ''}</div></article>`;
  return h;
}

// ── 화면: 지도 ──
// 폰: 칸을 누르면 개념 창이 아래에서 올라온다(닫으면 보던 자리 그대로). 넓은 화면: 오른쪽에 붙는다.
let MAPF = 'all', SHEET = false;   // SHEET: 방금 그린 화면에 개념 창이 열려 있었나 (열린 채 다른 개념으로 바꿀 땐 올라오는 움직임 생략)
function tileLine(key, st, id, t){
  const k = statusOf(st, id), role = roleOf(key, st, id);
  return `${ST(k).icon} ${ST(k).label}${progress(st, id)}${role ? ' · ' + COPY.role[role].label : ''}${isDue(st, id, t) ? ' · ' + COPY.due.label : ''}`;
}
function renderMap(){
  const key = route.subj, st = store.load(key), {data, ix} = S(key), t = now(), r = recommend(ix, st, t);
  const sel = route.arg ? +route.arg : null, open = sel != null && ix.byId.has(sel), due = new Set(r.due);
  const stay = SHEET && open ? ' stay' : ''; SHEET = open;
  const show = c => MAPF === 'all' || (MAPF === 'start' ? roleOf(key, st, c.id) === 'start' : MAPF === 'due' ? due.has(c.id) : statusOf(st, c.id) === MAPF);
  const F = [['all', '전체', r.total], ['unknown', `${ST('unknown').icon} ${ST('unknown').label}`, r.count.unknown], ['start', COPY.role.start.label, r.guide.starts.length], ['half', `${ST('half').icon} ${ST('half').label}`, r.count.half], ['due', `${COPY.due.icon} ${COPY.due.label}`, r.due.length], ['none', `${ST('none').icon} ${ST('none').label}`, r.count.none], ['know', `${ST('know').icon} ${ST('know').label}`, r.count.know]];
  let h = `<div class="ap-maplay"><div><div class="ap-ch3 ap-h2row">${helpBtn('map')}<h2 class="ap-h2">${COPY.titles.map}</h2></div><p class="ap-muted ap-small">${esc(data.name)} 개념 ${r.total}개를 장별 칸으로 나눴어요 · ★ 시험 중요도 ${helpBtn('stars')}</p>
    <div class="ap-filter" role="group" aria-label="상태별로 거르기" data-tour="filter">${F.map(([v, l, n]) => `<button data-mapf="${v}" aria-pressed="${MAPF === v}"${n || v === 'all' ? '' : ' class="zero"'}>${l} <span class="ap-num" style="color:inherit">${n}</span></button>`).join('')}</div>`;
  let any = false;
  for(const ch of data.chapters){
    const cs = data.concepts.filter(c => c.chapter === ch.id && !c.out && show(c)); if(!cs.length) continue;
    h += `<div class="ap-ch">${chLabel(key, ch.id)} · ${esc(ch.title)}</div><div class="ap-tiles">${cs.map(c => { const k = statusOf(st, c.id), role = roleOf(key, st, c.id), first = !any; any = true;
      return `<button class="ap-tile s-${k}${role === 'start' ? ' start' : ''}" data-cid="${c.id}"${first ? ' data-tour="tile"' : ''} aria-current="${c.id === sel}" aria-label="${esc(c.title)}, ${tileLine(key, st, c.id, t)}"><span class="id">${'★'.repeat(c.stars)}</span><span>${esc(c.short || c.title)}</span><span class="sl">${tileLine(key, st, c.id, t)}</span></button>`; }).join('')}</div>`;
  }
  if(!any) h += `<p class="ap-muted ap-small" style="margin-top:14px">이 조건에 맞는 개념이 없어요. <button class="ap-linkbtn" data-mapf="all">전체 보기</button></p>`;
  h += `</div>${open ? `<div class="ap-sheet-bg${stay}" data-close-sheet aria-hidden="true"></div>` : ''}<aside class="ap-side${open ? ' open' + stay : ''}" id="side"${open ? ` aria-label="${esc(cname(key, sel))} 설명"` : ''}>${open ? conceptPanel(key, sel) : `<div class="ap-card"><p class="ap-muted" style="margin:0">칸을 누르면 개념의 상태와 이유, 먼저 알아야 할 기초 개념, 정복하기 버튼이 여기에 나와요.</p></div>`}</aside></div>`;
  return h;
}
function conceptPanel(key, id){
  const st = store.load(key), {ix} = S(key), c = ix.byId.get(id), t = now(); if(!c) return '';
  const s = statusOf(st, id), role = roleOf(key, st, id), pre = c.prereq.filter(ix.live), nxt = c.next.filter(ix.live), U = ST('unknown').label, P = TERM.pre;
  const unchecked = uncheckedPre(ix, st, id);
  let guideBox = '';
  const X = q_(key, id);
  if(role === 'start') guideBox = `<div class="ap-probe" style="margin-top:10px">${cardHead('출발점이에요', 'roles')}<p>${X}의 ${P} 중에 ${SL('unknown', '은', '는')} 없어요. ${X}부터 정복하면 ${X} 위에 쌓인 개념도 풀려요.${unchecked.length ? ` 아직 안 풀어 본 ${P} ${unchecked.map(x => q_(key, x)).join(', ')}${josa(cshort(key, unchecked[unchecked.length - 1]), '은', '는')} <b>${TERM.icon} 기초 ${unchecked.length}개 풀어 보기</b>로 확인할 수 있어요.` : ''}</p></div>`;
  else if(s !== 'unknown' && unknownPre(ix, st, id).length){ const up = unknownPre(ix, st, id);
    guideBox = `<div class="ap-probe" style="margin-top:10px">${cardHead('기초가 비어 있어요', 'roles')}<p>${qj(key, id, '은', '는')} ${SL(s, '이지만', '지만')} ${P} ${up.map(x => q_(key, x)).join(', ')}${josa(cshort(key, up[up.length - 1]), '이', '가')} ${U}${yo(U)}. ${qj(key, up[0], '을', '를')} 정복해 두면 응용 문제에서 덜 흔들려요.</p></div>`; }
  else if(role === 'blocked'){ const starts = [...startsOf(ix, st, id)], path = chainTo(ix, st, starts[0], id), up = unknownPre(ix, st, id);
    guideBox = `<div class="ap-probe" style="margin-top:10px">${cardHead('막혀 있어요', 'roles')}<p>${P} ${up.map(x => q_(key, x)).join(', ')}${josa(cshort(key, up[up.length - 1]), '이', '가')} ${U}${yo(U)}. 아래 순서로 정복하면 ${X}까지 풀려요.</p>${pathHtml(key, st, path)}<div class="ap-row" style="margin-top:6px"><button class="ap-btn sm pri" data-start="concept" data-arg="${starts[0]}">출발점 ${q_(key, starts[0])} 정복하기</button></div>${starts.length > 1 ? `<p class="ap-small ap-muted">다른 출발점: ${starts.slice(1).map(x => q_(key, x)).join(', ')}</p>` : ''}</div>`; }
  return `<div class="ap-card ap-panel"><div class="ap-phead"><div class="ap-small ap-muted">${chLabel(key, c.chapter)} · 중요도 ${'★'.repeat(c.stars)} ${helpBtn('stars')}</div><button class="ap-sheet-x" data-close-sheet aria-label="닫기">×</button></div><h3 style="font-size:1.2rem;margin:4px 0 8px">${esc(c.title)}</h3>
    <div class="ap-row">${pillOf(st, id)}${roleTag(role)}${isDue(st, id, t) ? `<span class="ap-badge">${COPY.due.icon} ${COPY.due.label}</span>` : ''}</div>
    <dl class="ap-kv"><dt>${COPY.titles.panelBasis} ${helpBtn('basis')}</dt><dd>${stateLine(st, id, t)}</dd>${st.k[id] && st.k[id].h ? `<dt>${COPY.titles.panelHist}</dt><dd>${histHtml(st, id)} <span class="ap-small ap-muted">(오래된 것 → 최근)</span></dd>` : ''}</dl>
    <div class="ap-row" style="margin-top:4px"><button class="ap-btn pri" data-start="concept" data-arg="${id}">✏️ 정복하러 가기</button>${lecBtn(key, id)}${unchecked.length ? `<button class="ap-btn sm" data-start="pre" data-arg="${id}" title="아직 안 물어본 ${PJ('을', '를')} 짧은 문제로 풀어서 진짜 원인이 더 아래에 있는지 봐요">${TERM.icon} ${P.slice(0, 2)} ${unchecked.length}개 풀어 보기</button>` : ''}${AI.ok ? `<button class="ap-btn sm" data-aigen="${id}">AI 새 문제</button>` : ''}</div>
    <p class="ap-small ap-muted" style="margin:6px 0 0">문제 최대 ${RULES.need + 1}개 · ${RULES.need}번 연속 맞히면 정복 · 매번 다른 모양으로 나와요</p>
    ${guideBox}
    <div class="ap-cardk" style="margin-top:12px"><dl><div><dt>왜 필요한가</dt><dd>${esc(c.why)}</dd></div><div><dt>핵심</dt><dd>${esc(c.core)}</dd></div></dl></div>
    <dl class="ap-kv" style="margin-top:12px"><dt>${COPY.titles.panelPre}</dt><dd>${pre.length ? chips(key, st, pre) : `<span class="ap-small ap-muted">없음 (첫 개념)</span>`}</dd><dt>${COPY.titles.panelNext}</dt><dd>${nxt.length ? chips(key, st, nxt) : '<span class="ap-small ap-muted">없음</span>'}</dd></dl>
    <div class="ap-ch3" style="margin-top:12px">${helpBtn('lineage')}<span>${COPY.titles.lineage}</span><span class="ap-small ap-muted" style="font-weight:400">(위가 먼저 · 옆으로 밀어서 보기)</span></div><div class="ap-gwrap" id="lineage"></div></div>`;
}
function drawLineage(key, id){
  const box = $('#lineage'); if(!box) return;
  if(typeof dagre === 'undefined'){ box.innerHTML = '<p class="ap-small ap-muted">그래프를 못 불러왔어요.</p>'; return; }
  const st = store.load(key), {ix} = S(key), A = ix.ancestorsWithDepth(id, 3), c = ix.byId.get(id);
  const ids = [...A.keys(), id, ...c.next.filter(ix.live).slice(0, 4)], set = new Set(ids);
  const g = new dagre.graphlib.Graph(); g.setGraph({rankdir:'TB', nodesep:10, ranksep:26, marginx:6, marginy:6}); g.setDefaultEdgeLabel(() => ({}));
  const label = x => `${ST(statusOf(st, x)).icon} ${cshort(key, x)}`;
  const W = t => Math.min(180, 30 + [...t].reduce((a, ch) => a + (ch.codePointAt(0) > 0x2E80 ? 11.5 : 6.6), 0));
  for(const x of ids) g.setNode(String(x), {width:W(label(x)), height:28});
  const edges = []; for(const x of ids) for(const p of ix.byId.get(x).prereq) if(set.has(p)){ edges.push([p, x]); g.setEdge(String(p), String(x)); }
  dagre.layout(g);
  const gi = g.graph();
  const fill = x => { const s = statusOf(st, x); return s === 'none' ? 'var(--surface)' : `color-mix(in srgb,var(--st-${s}) 16%,var(--surface))`; };
  let svg = `<svg class="ap-graph" width="${Math.ceil(gi.width)}" height="${Math.ceil(gi.height)}" viewBox="0 0 ${Math.ceil(gi.width)} ${Math.ceil(gi.height)}" role="img" aria-label="${esc(c.title)}의 기초 개념 그림"><defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="var(--muted)"/></marker></defs>`;
  for(const [a, b] of edges){ const pts = g.edge(String(a), String(b)).points; const hot = statusOf(st, a) === 'unknown' && statusOf(st, b) === 'unknown';
    svg += `<path class="e${hot ? ' hot' : ''}" marker-end="url(#ar)" d="M${pts.map(p => `${p.x},${p.y}`).join('L')}"/>`; }
  for(const x of ids){ const p = g.node(String(x)), s = statusOf(st, x);
    svg += `<g class="n${x === id ? ' sel' : ''}${roleOf(key, st, x) === 'start' ? ' start' : ''}" data-cid="${x}" transform="translate(${p.x - p.width / 2},${p.y - 14})"><title>${esc(cname(key, x))}: ${ST(s).label}</title><rect width="${p.width}" height="28" rx="6" fill="${fill(x)}" stroke="var(--st-${s})"/><text x="8" y="18">${esc(label(x))}</text></g>`; }
  box.innerHTML = svg + '</svg>';
  box.querySelectorAll('[data-cid]').forEach(n => n.addEventListener('click', () => go(`#/${key}/map/${n.dataset.cid}`)));
}

// ── AI (Claude 안에서 열 때만: sample 캡빌리티) ──
const AI = {ok:false, s:null};
const sampleP = (window.claude && typeof window.claude.use === 'function') ? window.claude.use('sample').catch(() => null) : Promise.resolve(null);
sampleP.then(s => { AI.s = s; AI.ok = !!s; if(s && typeof render === 'function') render(); });
const AI_ERR = {not_granted:'Claude 사용을 허용하지 않아서 AI 기능을 쓸 수 없어요.', sampling_disabled:'이 계정에서는 Claude를 쓸 수 없어요.', rate_limited:'요청이 많아요. 잠시 뒤에 다시 해 주세요.', session_expired:'다시 로그인해야 해요.', refused:'이 요청에는 답할 수 없대요.', empty_completion:'답이 비었어요. 다시 해 주세요.', upstream_error:'연결이 끊겼어요. 다시 해 주세요.', invalid_json:'AI 답을 읽지 못했어요. 다시 해 주세요.'};
const aiErr = e => AI_ERR[e && e.code] || '잠깐 문제가 생겼어요. 다시 해 주세요.';
function aiOff(e){ if(e && (e.code === 'not_granted' || e.code === 'sampling_disabled')){ AI.ok = false; render(); } }
const TUTOR = COPY.ai.tutor();
function conceptContext(key, cid){
  const {data, ix} = S(key), st = store.load(key), c = ix.byId.get(cid), sid = sceneOf(key, cid), sc = sid ? data.scenes[sid] : null;
  const L = id => ST(statusOf(st, id)).label;
  return `[개념 #${c.id} ${c.title}]\n왜 필요한가: ${c.why}\n핵심: ${c.core}\n선행: ${c.prereq.filter(ix.live).map(p => `${cname(key, p)}(${L(p)})`).join(', ') || '없음'}\n학생 상태: ${L(cid)} — ${stateLine(st, cid, now())}` + (sc ? `\n[강의 발췌: ${sc.title}]\n${sc.text}` : '');
}
function questionContext(q, choice, text){
  const strip = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  let s = `[문제] ${q.question_text || strip(q.stem)}`;
  if(q.kind === 'mcq') s += `\n[보기] ${q.options.map((o, i) => `${i + 1}) ${strip(o)}`).join(' / ')}\n[정답] ${q.answer.join(', ')}\n[학생이 고른 답] ${choice != null ? choice + 1 : '없음'}\n[보기 해설] ${Object.entries(q.expl || {}).map(([k, v]) => `${k}: ${strip(v)}`).join(' / ')}`;
  else s += `\n[모범답안] ${q.answer_text}\n[학생 답] ${text || '(안 씀)'}`;
  if(q.extra) s += `\n[풀이] ${strip(q.extra).slice(0, 900)}`;
  return s;
}
// 주관식·계산 채점
async function aiGrade(key, q, text){
  const prompt = `${TUTOR}\n지금은 채점자 역할이야. 모범답안과 풀이를 기준으로 학생 답을 채점해. 표기가 달라도 뜻이 같으면 맞음. 계산 문제는 최종 답을 먼저 보고, 풀이가 있으면 어디서 틀렸는지 짚어.\nJSON 하나로만 답해: {"score": 0~10 정수, "correct": 7점 이상이면 true, "missing": ["빠진 핵심어"], "feedback": "학생에게 하는 한두 문장 (해요체)"}\n\n${questionContext(q, null, text)}`;
  return AI.s.json(prompt, {modelTier:'quick', cache:false});
}
// AI 질문 상자 (문제 피드백 안)
function aiBoxHtml(){
  return `<div class="ap-ai"><div class="ap-small"><b>AI 튜터</b> · 이 문제와 개념 자료만 근거로 답해요</div><div class="out" id="aiOut">${esc(SES.ai.out || '')}</div>
    <div class="ap-row" style="margin-top:8px"><input id="aiQ" placeholder="더 묻고 싶은 것 (예: 왜 ②가 아니에요?)" aria-label="AI에게 질문"><button class="ap-btn sm" id="aiSend">묻기</button></div></div>`;
}
async function askTutor(question){
  const key = SES.key, {data} = S(key), q = data.quizzes[SES.cur.qid];
  SES.ai = SES.ai || {msgs:[], out:''};
  const first = !SES.ai.msgs.length;
  const content = first ? `${TUTOR}\n\n${conceptContext(key, q.concepts[0])}\n\n${questionContext(q, SES.choice, SES.text)}\n\n학생 질문: ${question}` : question;
  SES.ai.msgs.push({role:'user', content});
  const out = $('#aiOut'); if(out) out.textContent = '생각하는 중…';
  try{
    const {text} = await AI.s(SES.ai.msgs, {modelTier:'default', cache:false, onText:({text}) => { const o = $('#aiOut'); if(o) o.textContent = text; }});
    SES.ai.msgs.push({role:'assistant', content:text}); SES.ai.out = text;
  }catch(e){ SES.ai.msgs.pop(); SES.ai.out = (e.text || '') + '\n' + aiErr(e); aiOff(e); }
  const o = $('#aiOut'); if(o) o.textContent = SES.ai.out;
}
// AI 새 문제 (개념 자료에 근거, 형식 검사 통과한 것만 낸다)
async function aiNewQuestion(key, cid){
  const {data} = S(key);
  const prompt = `${TUTOR}\n아래 개념 자료만 근거로 독학사 시험 스타일의 4지선다 문제 1개를 새로 만들어. 개념을 제대로 이해했는지 묻는 문제로. 정답은 하나. 보기마다 왜 맞고 틀린지 한 줄 해설 (해요체).\nJSON 하나로만 답해: {"stem": "문제", "options": ["보기1","보기2","보기3","보기4"], "answer": 1~4, "explanations": ["보기1 해설","보기2 해설","보기3 해설","보기4 해설"]}\n\n${conceptContext(key, cid)}`;
  const r = await AI.s.json(prompt, {modelTier:'default', cache:false});
  if(!r || typeof r.stem !== 'string' || !Array.isArray(r.options) || r.options.length !== 4 || !(r.answer >= 1 && r.answer <= 4) || !Array.isArray(r.explanations) || r.explanations.length < 4 || new Set(r.options.map(String)).size !== 4) throw {code:'invalid_json'};
  const id = `ai-${key}-${cid}-${Date.now()}`;
  data.quizzes[id] = {id, shape:`ai-${key}-${cid}`, kind:'mcq', src:'AI가 개념 자료로 만든 문제', ai:true, concepts:[cid], scene:sceneOf(key, cid), pub:true, weight:null, adhoc:true,
    stem:`<p class="qtext">${esc(r.stem)}</p>`, options:r.options.map(o => esc(o)), answer:[Math.round(r.answer)], tail:'', extra:'',
    expl:Object.fromEntries(r.explanations.slice(0, 4).map((e, i) => [String(i + 1), esc(e)])), question_text:r.stem};
  return id;
}
// 길잡이 화면의 AI 코치: 도구로 학습 기록과 온톨로지를 직접 조회한다
function aiCoachHtml(){
  if(!AI.ok) return '';
  return `<div class="ap-card"><div class="ap-h3">${COPY.titles.coach}</div><p class="ap-small ap-muted" style="margin:0 0 8px">Claude가 내 기록과 개념 지도를 직접 조회해서 오늘의 코스를 짜 줘요. 누른 사람의 Claude 사용량을 써요.</p><button class="ap-btn" id="coachRun">오늘의 코스 받기</button><div class="ap-trace" id="coachTrace"></div><div class="ap-ai ap-hidden" id="coachBox"><div class="out" id="coachOut"></div></div></div>`;
}
async function runCoach(){
  const key = route.subj, st = store.load(key), {data, ix} = S(key), t = now(), btn = $('#coachRun'), tr = $('#coachTrace'), out = $('#coachOut');
  btn.disabled = true; $('#coachBox').classList.remove('ap-hidden'); out.textContent = '생각하는 중…'; tr.textContent = '';
  const log = s => { tr.textContent += '→ ' + s + '\n'; };
  const T = id => ({id, title:cname(key, id), status:ST(statusOf(st, id)).label});
  const tools = [
    {name:'get_progress', description:`학생의 전체 진도: 푼 문제 수, 상태별 개념 수(${COPY.journey.map(k => ST(k).label).join('·')}), ★5 핵심 중 정복, 다시 점검할 때 된 개념 수.`, execute:() => { log('get_progress()'); const r = recommend(ix, st, t); return {attempts:st.attempts.length, counts:Object.fromEntries(COPY.journey.map(s => [ST(s).label, r.count[s]])), core_conquered:`${r.coreKnow}/${r.coreTotal}`, due:r.due.length}; }},
    {name:'get_guide', description:'정복 실패 길잡이: 출발점(정복 실패인데 선행은 괜찮음)마다, 그걸 정복하면 이어서 풀리는 정복 실패 개념과 아직 확인 안 된 선행.', execute:() => { log('get_guide()'); return recommend(ix, st, t).guide.starts.slice(0, 6).map(s => ({...T(s.id), unlocks:s.unlocks.slice(0, 6).map(T), unchecked_prereq:s.unchecked.map(T)})); }},
    {name:'get_half_and_due', description:'조금만 더 하면 정복인 개념(모험 중)과 다시 점검할 때 된 개념.', execute:() => { log('get_half_and_due()'); const r = recommend(ix, st, t); return {adventuring:r.half.slice(0, 8).map(T), due:r.due.slice(0, 8).map(T)}; }},
    {name:'get_recent_mistakes', description:'최근 틀린 문제 10개의 개념과 날짜.', execute:() => { log('get_recent_mistakes()'); return st.attempts.filter(a => !a.ok).slice(-10).map(a => ({concept:T(a.c[0]), check:a.chk != null, date:new Date(a.t).toISOString().slice(0, 10)})); }},
    {name:'get_concept', description:'개념 하나의 정의, 상태와 근거, 선행 개념(각 상태), 관련 강의 장면.', inputSchema:{type:'object', properties:{id:{type:'integer'}}, required:['id']},
      execute:({id}) => { log(`get_concept(${id})`); const c = ix.byId.get(Number(id)); if(!c) throw new Error('없는 개념이에요'); return {...T(c.id), basis:stateLine(st, c.id, t), why:c.why, core:c.core.slice(0, 300), prereq:c.prereq.filter(ix.live).map(T), lecture:c.scenes.map(s => `${data.scenes[s].lesson}강 ${data.scenes[s].title}`)}; }},
  ];
  const prompt = `${TUTOR}\n과목: ${data.name}. 도구로 학생 기록과 개념 지도를 조회해서 오늘 할 일을 정해. get_progress → get_guide → get_half_and_due 순서로 보고, 필요하면 get_concept.\n기록이 거의 없으면 진단부터 하라고 해. 학생에게 해요체로. 형식:\n지금 상태: 한두 줄\n오늘 순서: 최대 4단계, 각 줄 "개념 — 무엇을 할지(강의/정복하기/기초 풀어 보기) — 이유"\n한마디: 한 줄`;
  try{ const {text} = await AI.s(prompt, {tools, modelTier:'default', cache:false, onText:({text}) => { out.textContent = text; }}); out.textContent = text; }
  catch(e){ out.textContent = (e.text || '') + '\n' + aiErr(e); aiOff(e); }
  btn.disabled = false;
}

// ── 그리기 ──
function renderTop(){
  $('#appTitle').textContent = COPY.app.title;
  const tut = $('#tutBtn small'); if(tut) tut.textContent = `1분 · ${COPY.tour.length}단계`;
  $('#subjSeg').innerHTML = SUBJECTS.map(k => `<button data-subj="${k}" aria-pressed="${route.subj === k}">${esc(S(k).data.short)}</button>`).join('');
  $('#tabs').innerHTML = ['today', 'quiz', 'lec', 'map'].map(v => `<a href="#/${route.subj}/${v}"${route.view === v ? ' aria-current="page"' : ''}>${COPY.tabs[v]}${v === 'quiz' && SES && SES.key === route.subj && SES.phase !== 'done' ? ' •' : ''}</a>`).join('');
}
function renderFoot(){
  $('#foot').innerHTML = `${store.err ? '방금 기록을 저장하지 못했어요. 다음 문제를 풀면 다시 저장해요.<br>' : ''}${COPY.foot()} · 전체 개념 관계는 <a class="ap-link" href="https://charming-chanmin.github.io/cs-ontology-agent/explorer.html">온톨로지 탐색기</a>`;
}
const isPhone = () => window.innerWidth < 900;
function render(){
  const key = route.subj;
  GUIDE.closeHelp();
  renderTop(); renderFoot();
  const v = $('#view');
  v.innerHTML = route.view === 'quiz' ? renderQuiz() : route.view === 'lec' ? renderLec() : route.view === 'map' ? renderMap() : renderToday();
  wire(v, key);
  if(route.view === 'map' && route.arg) drawLineage(key, +route.arg);
  if(route.view !== 'map') SHEET = false;
  // 폰에서 개념 창이 열려 있으면 뒤 화면은 안 움직이게
  document.body.classList.toggle('ap-lock', route.view === 'map' && !!$('#side.open') && isPhone());
  if(route.view === 'lec' && route.arg && route.arg.includes('-')){ const el = document.getElementById('sc-' + route.arg); if(el) requestAnimationFrame(() => el.scrollIntoView({block:'start'})); }
  resumeChip(key);
}
// 문제를 풀다가 강의·지도로 가도 한 번에 돌아올 수 있게
function resumeChip(key){
  let rp = document.getElementById('resume');
  const on = SES && SES.key === key && SES.phase !== 'done' && route.view !== 'quiz';
  if(!on){ if(rp) rp.remove(); return; }
  if(!rp){ rp = document.createElement('a'); rp.id = 'resume'; rp.className = 'ap-resume'; document.body.appendChild(rp); }
  rp.href = `#/${key}/quiz`;
  rp.textContent = `← 풀던 문제로 · ${SES.title}${SES.max ? ` ${Math.min(SES.n, SES.max)}/${SES.max}` : ''}`;
}
const closeSheet = () => go(`#/${route.subj}/map`);
// 답한 뒤 결과가 화면 아래에 숨어 있으면 보이는 곳까지 내려 준다
function showFeedback(){
  const fb = $('#fb'); if(!fb) return;
  const top = fb.getBoundingClientRect().top;
  if(top > window.innerHeight * 0.62){
    const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({top:window.scrollY + top - Math.min(140, window.innerHeight * 0.18), behavior:calm ? 'auto' : 'smooth'});
  }
}
function wire(v, key){
  v.querySelectorAll('[data-start]').forEach(b => b.addEventListener('click', () => startSession(key, b.dataset.start, b.dataset.arg)));
  v.querySelectorAll('[data-cid]').forEach(b => { if(b.tagName === 'BUTTON') b.addEventListener('click', () => go(`#/${key}/map/${b.dataset.cid}`)); });
  v.querySelectorAll('[data-mapf]').forEach(b => b.addEventListener('click', () => { MAPF = b.dataset.mapf; render(); }));
  v.querySelectorAll('[data-mapf-go]').forEach(b => b.addEventListener('click', () => { MAPF = b.dataset.mapfGo; go(`#/${key}/map`); }));
  v.querySelectorAll('[data-close-sheet]').forEach(b => b.addEventListener('click', closeSheet));
  v.querySelectorAll('[data-read]').forEach(b => b.addEventListener('click', () => { const st = store.load(key), sid = b.dataset.read; if(st.read[sid]) delete st.read[sid]; else st.read[sid] = now(); store.save(key); b.textContent = st.read[sid] ? '✓ 읽음' : '다 읽었어요'; b.classList.toggle('pri', !st.read[sid]); }));
  v.querySelectorAll('[data-aigen]').forEach(b => b.addEventListener('click', async () => { b.disabled = true; b.textContent = 'AI가 만드는 중…';
    try{ const id = await aiNewQuestion(key, +b.dataset.aigen); SES = {key, mode:'ai', title:`AI 문제 · ${cshort(key, +b.dataset.aigen)}`, pool:[id], queue:[id], max:1, used:new Set(), n:0, results:[], changes:[], probe:null, probeQ:0, probes:[], cur:null, phase:'q', note:null}; nextQuestion(); go(`#/${key}/quiz`); }
    catch(e){ b.textContent = aiErr(e); aiOff(e); } }));
  const r = $('#reset'); if(r) r.onclick = () => { if(RESET === key){ store.states[key] = emptyState(); store.save(key); RESET = null; if(SES && SES.key === key) SES = null; } else RESET = key; render(); };
  const cr = $('#coachRun'); if(cr) cr.onclick = runCoach;
  const lg = $('#lessonGo'); if(lg) lg.onclick = () => startSession(key, 'lesson', $('#lessonSel').value);
  if(!SES || route.view !== 'quiz') return;
  const qt = $('#quit'); if(qt) qt.onclick = () => { if(SES.probe) closeProbe(); SES.phase = 'done'; render(); };
  v.querySelectorAll('[data-opt]').forEach(b => b.addEventListener('click', () => { if(SES.phase !== 'q') return; const q = S(key).data.quizzes[SES.cur.qid]; SES.choice = +b.dataset.opt; submitAnswer(q.answer.includes(SES.choice + 1)); }));
  const ta = $('#ans'); if(ta) ta.addEventListener('input', () => { SES.text = ta.value; });
  const sb = $('#submit'); if(sb) sb.onclick = async () => {
    const q = S(key).data.quizzes[SES.cur.qid], text = (SES.text || '').trim(); if(!text) { ta.focus(); return; }
    if(q.checkFn) return submitAnswer(!!q.checkFn(text));   // 계산 자동 출제: 코드가 계산한 정답과 비교
    if(q.accept){ const t = normW(text); if(q.accept.some(a => a && (t === a || (t.length >= 2 && (t.includes(a) || a.includes(t)))))) return submitAnswer(true); if(!AI.ok) return submitAnswer(false); }
    if(q.kw && !AI.ok){ const k = SPEC.keywordScore(q.kw, text); SES.kwHit = k; return submitAnswer(k.correct); }
    const auto = autoGrade(q, text);
    if(auto === true) return submitAnswer(true);
    if(AI.ok){ SES.grade = 'ai-wait'; render(); try{ const g = await aiGrade(key, q, text); SES.aiGrade = {score:Math.max(0, Math.min(10, Math.round(+g.score || 0))), feedback:String(g.feedback || ''), missing:Array.isArray(g.missing) ? g.missing.slice(0, 5).map(String) : []}; return submitAnswer(SES.aiGrade.score >= 7, {ai:true}); }catch(e){ aiOff(e); SES.grade = null; } }
    if(auto === false && q.auto && !/[a-z가-힣]/i.test(q.auto)) return submitAnswer(false);
    SES.grade = 'self'; render(); };
  const rv = $('#reveal'); if(rv) rv.onclick = () => { SES.aiGrade = null; submitAnswer(false); };
  v.querySelectorAll('[data-self]').forEach(b => b.addEventListener('click', () => { SES.aiGrade = null; submitAnswer(b.dataset.self === '1'); }));
  const nx = $('#next'); if(nx){ nx.onclick = () => { nextQuestion(); render(); window.scrollTo({top:0}); if(SES && SES.cur && SES.cur.check != null) GUIDE.tipOnce('check', $('#view')); }; nx.focus({preventScroll:true}); }
  const ask = $('#askAI'); if(ask) ask.onclick = () => { if(!SES.ai){ SES.ai = {msgs:[], out:''}; render(); askTutor(SES.correct ? '이 문제의 핵심 개념을 한 번 더 짧게 정리해 줘.' : '내가 고른 답이 왜 틀렸고, 무엇을 헷갈린 건지 짚어 줘.'); } };
  const as = $('#aiSend'); if(as){ const inp = $('#aiQ'); const send = () => { const t = inp.value.trim(); if(t){ inp.value = ''; askTutor(t); } }; as.onclick = send; inp.addEventListener('keydown', e => { if(e.key === 'Enter') send(); }); }
}
document.addEventListener('keydown', e => {
  if(GUIDE.isOpen() || e.metaKey || e.ctrlKey || e.altKey) return;
  // Esc: 도움말 말풍선이 없을 때 지도의 개념 창을 닫는다
  if(e.key === 'Escape' && route.view === 'map' && route.arg && !document.querySelector('.hp-pop')){ e.preventDefault(); closeSheet(); return; }
  if(route.view !== 'quiz' || !SES || e.target.closest('input,textarea,select')) return;
  if(SES.phase === 'q'){ const i = '1234'.indexOf(e.key); const b = i >= 0 && document.querySelector(`[data-opt="${i}"]`); if(b){ e.preventDefault(); b.click(); } }
  else if(SES.phase === 'fb' && e.key === 'Enter' && !e.target.closest('button,a,summary')){ const nx = $('#next'); if(nx){ e.preventDefault(); nx.click(); } }
});
document.addEventListener('click', e => { const b = e.target.closest('[data-subj]'); if(b) go(`#/${b.dataset.subj}/${route.view}`); });

// ── 시작 ──
GUIDE.init({go, route:() => route, onDone:() => { if(!store.load(route.subj).attempts.length) startSession(route.subj, 'diag'); }});
route = parseHash();
render();
store.connect().then(() => {
  render();
  // 처음 온 사람에게만: 기록이 하나도 없고, 둘러보기 질문에 답한 적도 없을 때
  const fresh = SUBJECTS.every(k => !store.load(k).attempts.length);
  if(fresh && !GUIDE.flags.welcomed && !GUIDE.isOpen()) GUIDE.welcome();
});
