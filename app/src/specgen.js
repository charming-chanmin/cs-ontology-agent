// 지식 규격(JSON) → 시험 문제 생성기
// 개념마다 규격을 한 번만 쓰면, 보기 조합을 바꿔 가며 문제를 계속 만든다.
// 모든 보기에 해설이 붙는다: 참 문장은 why, 틀린 문장은 fix(맞게 고치면) + why.
//
// 규격 형식 (개념 하나)
// { c: 개념 id, also?: [함께 묻는 개념 id],
//   facts?:    [{t: 참 문장, why}, {f: 틀린 문장, fix: 고친 문장, why}],
//   terms?:    [{term, def, why?, alias?: [다른 이름]}],
//   compare?:  {items: [A, B, ...], rows: {속성: {A: 값, B: 값}}, why?: {속성: 설명}},
//   seq?:      {name, steps: [단계...], why?},
//   classify?: {name, groups: {묶음: [원소...]}, why?: {묶음: 설명}},
//   essay?:    [{q, kw: [[핵심어, 같은 뜻...], ...], model}],
//   name?: 문제에 쓸 개념 이름 (온톨로지 제목이 어색할 때) }
// 패턴: fact-true · fact-false · term-def · def-term · term-short · cmp-pick · cmp-false · seq-order · seq-next · cls-odd · essay

const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const escS = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// 받침 따라 조사 고르기. 끝의 괄호 설명은 건너뛴다: 시스템 호출(SVC) → '호출' 기준
const josa = (w, a, b) => { const base = String(w).replace(/\s*\([^()]*\)\s*$/, '') || String(w); const ch = base.replace(/[\s)」』"'\]]+$/, '').slice(-1), code = ch.charCodeAt(0); if (code >= 0xAC00 && code <= 0xD7A3) return (code - 0xAC00) % 28 ? a : b; return /[136780lmnrLMNR]$/.test(ch) ? a : b; };
// 물어볼 수 있는 묶음: 원소가 3개 이상이고, ask가 있으면 그 안에서만 ("~ 아닌 것"류 묶음으로 이중 부정 질문이 나오지 않게)
const clsAsk = cl => Object.keys(cl.groups).filter(g => cl.groups[g].length >= 3 && (!cl.ask || cl.ask.includes(g)));
const normT = s => String(s).toLowerCase().replace(/[\s·\-_()（）]/g, '');

// 어떤 규격으로 어떤 패턴을 만들 수 있는지
export function patternsOf(spec, ctx = {}) {
  const P = [];
  const T = (spec.facts || []).filter(x => x.t), F = (spec.facts || []).filter(x => x.f);
  const poolF = F.length + (ctx.siblingFalse || []).length;
  if (T.length >= 1 && poolF >= 3) P.push('fact-true');
  if (T.length >= 3 && F.length >= 1) P.push('fact-false');
  const terms = spec.terms || [], poolTerms = terms.length + (ctx.siblingTerms || []).length;
  if (terms.length >= 1 && poolTerms >= 4) { P.push('term-def', 'def-term'); }
  if (terms.length >= 1) P.push('term-short');
  if (spec.compare) {
    const rows = Object.keys(spec.compare.rows);
    if (rows.length >= 2 && (spec.compare.items.length - 1) * rows.length >= 3) P.push('cmp-pick');   // 오답 보기 3개를 만들 수 있을 때만
    if (rows.length >= 4) P.push('cmp-false');
  }
  if (spec.seq && spec.seq.steps.length >= 3) P.push('seq-order');
  if (spec.seq && spec.seq.steps.length >= 5) P.push('seq-next');
  if (spec.classify && clsAsk(spec.classify).length && Object.keys(spec.classify.groups).length >= 2) P.push('cls-odd');
  if (spec.essay && spec.essay.length) P.push('essay');
  return P;
}

// 문제 만들기. ctx = {name: 개념 이름, siblingFalse: [다른 개념의 틀린 문장], siblingTerms: [다른 개념의 용어]}
export function makeSpec(spec, pattern, seed, ctx = {}) {
  const r = rngOf(seed);
  const pick = a => a[Math.floor(r() * a.length)];
  const shuffle = a => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
  const take = (a, n) => shuffle(a).slice(0, n);
  const name = spec.name || ctx.name || '이 개념';
  const concepts = [spec.c, ...(spec.also || [])];
  const mcq = (stem, opts, correct) => {
    // opts: [{text, expl}] 4개, correct: 정답 인덱스(섞기 전)
    const order = shuffle(opts.map((_, i) => i));
    return { kind: 'mcq', stem, options: order.map(i => escS(opts[i].text)), answer: [order.indexOf(correct) + 1],
      expl: Object.fromEntries(order.map((i, k) => [String(k + 1), escS(opts[i].expl)])), concepts };
  };
  const tExpl = x => `맞는 설명이에요. ${x.why || ''}`.trim();
  const fExpl = x => `틀렸어요. 맞게 고치면 → ${x.fix}${x.why ? '. ' + x.why : ''}`;

  if (pattern === 'fact-true' || pattern === 'fact-false') {
    const T = spec.facts.filter(x => x.t), F = spec.facts.filter(x => x.f);
    if (pattern === 'fact-true') {
      const right = pick(T);
      const wrong = take(F, 3);
      if (wrong.length < 3) wrong.push(...take(ctx.siblingFalse || [], 3 - wrong.length));
      const opts = [{ text: right.t, expl: tExpl(right) }, ...wrong.map(x => ({ text: x.f, expl: fExpl(x) }))];
      return mcq(`<p class="qtext">「${escS(name)}」에 대한 설명으로 <b>옳은 것</b>은?</p>`, opts, 0);
    }
    const wrong = pick(F), right = take(T, 3);
    const opts = [{ text: wrong.f, expl: fExpl(wrong) }, ...right.map(x => ({ text: x.t, expl: tExpl(x) }))];
    return mcq(`<p class="qtext">「${escS(name)}」에 대한 설명으로 <b>옳지 않은 것</b>은?</p>`, opts, 0);
  }
  if (pattern === 'term-def' || pattern === 'def-term' || pattern === 'term-short') {
    const pool = [...spec.terms, ...(ctx.siblingTerms || [])];
    const x = pick(spec.terms);
    if (pattern === 'term-short') {
      const accept = [x.term, ...(x.alias || [])].map(normT);
      return { kind: 'short', stem: `<p class="qtext">다음 설명에 해당하는 용어를 쓰시오.</p><blockquote>${escS(x.def)}</blockquote>`,
        answer_text: x.term, answer_html: `<b>${escS(x.term)}</b>${x.alias && x.alias.length ? ` (${escS(x.alias.join(', '))})` : ''}`,
        extra: `<p>${escS(x.why || x.def)}</p>`, accept, concepts };
    }
    // 오답 보기는 같은 개념의 용어부터, 모자라면 같은 장의 다른 개념에서
    const ok = o => normT(o.term) !== normT(x.term) && normT(o.def) !== normT(x.def);
    const others = [...shuffle(spec.terms.filter(ok)), ...shuffle((ctx.siblingTerms || []).filter(ok))].slice(0, 3);
    if (pattern === 'term-def') {
      const opts = [{ text: x.term, expl: `맞아요. ${x.term} = ${x.def}` }, ...others.map(o => ({ text: o.term, expl: `${o.term}${josa(o.term, '은', '는')} ${o.def}` }))];
      return mcq(`<p class="qtext">다음 설명에 해당하는 것은?</p><blockquote>${escS(x.def)}</blockquote>`, opts, 0);
    }
    const opts = [{ text: x.def, expl: `맞아요. ${x.why || `${x.term}${josa(x.term, '을', '를')} 정확히 설명한 문장이에요.`}` }, ...others.map(o => ({ text: o.def, expl: `이건 ${o.term}에 대한 설명이에요.` }))];
    return mcq(`<p class="qtext"><b>${escS(x.term)}</b>에 대한 설명으로 옳은 것은?</p>`, opts, 0);
  }
  if (pattern === 'cmp-pick') {
    const { items, rows } = spec.compare, why = spec.compare.why || {};
    const A = pick(items), attrs = Object.keys(rows);
    const rightAttr = pick(attrs);
    const say = (attr, it) => `${attr}: ${rows[attr][it]}`;
    // 오답: 다른 항목의 값 (같은 값이면 쓰지 않는다)
    const cands = [];
    for (const attr of shuffle(attrs)) for (const it of shuffle(items)) if (it !== A && rows[attr][it] !== rows[attr][A]) cands.push({ attr, it });
    const seen = new Set([say(rightAttr, A)]), wrong = [];
    for (const c of cands) { const s = say(c.attr, c.it); if (!seen.has(s) && wrong.length < 3) { seen.add(s); wrong.push(c); } }
    if (wrong.length < 3) return null;
    const opts = [{ text: say(rightAttr, A), expl: `맞아요. ${A}의 ${rightAttr}${josa(rightAttr, '은', '는')} ${rows[rightAttr][A]}. ${why[rightAttr] || ''}`.trim() },
      ...wrong.map(c => ({ text: say(c.attr, c.it), expl: `이건 ${c.it}의 ${c.attr}${josa(c.attr, '이에요', '예요')}. ${A}${josa(A, '은', '는')} ${rows[c.attr][A]}. ${why[c.attr] || ''}`.trim() }))];
    return mcq(`<p class="qtext"><b>${escS(A)}</b>의 특징으로 옳은 것은?</p>`, opts, 0);
  }
  if (pattern === 'cmp-false') {
    const { items, rows } = spec.compare, why = spec.compare.why || {};
    const [A, B] = take(items, 2), attrs = Object.keys(rows).filter(a => rows[a][A] !== rows[a][B]);
    if (attrs.length < 4) return null;
    const chosen = take(attrs, 4), bad = chosen[0];
    const line = (attr, swap) => `${attr} — ${A}: ${swap ? rows[attr][B] : rows[attr][A]} / ${B}: ${swap ? rows[attr][A] : rows[attr][B]}`;
    const opts = [{ text: line(bad, true), expl: `거꾸로예요. ${A}: ${rows[bad][A]}, ${B}: ${rows[bad][B]}. ${why[bad] || ''}`.trim() },
      ...chosen.slice(1).map(a => ({ text: line(a, false), expl: `맞아요. ${A}${josa(A, '은', '는')} ${rows[a][A]}, ${B}${josa(B, '은', '는')} ${rows[a][B]}. ${why[a] || ''}`.trim() }))];
    return mcq(`<p class="qtext">${escS(A)}${josa(A, '과', '와')} ${escS(B)}${josa(B, '을', '를')} 비교한 것으로 <b>옳지 않은 것</b>은?</p>`, opts, 0);
  }
  if (pattern === 'seq-order') {
    const st = spec.seq.steps, right = st.join(' → ');
    const perms = new Set([right]), wrong = [];
    for (let k = 0; k < 40 && wrong.length < 3; k++) {
      const x = st.slice(); const i = Math.floor(r() * (x.length - 1)); const j = r() < 0.6 ? i + 1 : Math.floor(r() * x.length);
      [x[i], x[j]] = [x[j], x[i]]; const s = x.join(' → '); if (!perms.has(s)) { perms.add(s); wrong.push(s); }
    }
    // 단계가 적으면(3개) 무작위 교환으로는 오답이 모자랄 수 있다 → 나머지 순서를 전부 만들어 채운다
    if (wrong.length < 3 && st.length <= 5) {
      const all = []; const perm = (a, k) => { if (k === a.length) { all.push(a.join(' → ')); return; } for (let i = k; i < a.length; i++) { const b = a.slice(); [b[k], b[i]] = [b[i], b[k]]; perm(b, k + 1); } };
      perm(st.slice(), 0);
      for (const s of shuffle(all)) if (wrong.length < 3 && !perms.has(s)) { perms.add(s); wrong.push(s); }
    }
    if (wrong.length < 3) return null;
    const opts = [{ text: right, expl: `맞아요. ${spec.seq.why || ''}`.trim() }, ...wrong.map(w => ({ text: w, expl: `순서가 섞였어요. 바른 순서: ${right}` }))];
    return mcq(`<p class="qtext">${escS(spec.seq.name)}의 순서로 옳은 것은?</p>`, opts, 0);
  }
  if (pattern === 'seq-next') {
    const st = spec.seq.steps, i = Math.floor(r() * (st.length - 1));
    const others = take(st.filter((_, k) => k !== i + 1 && k !== i), 3);
    const opts = [{ text: st[i + 1], expl: `맞아요. ${st.join(' → ')}` }, ...others.map(o => ({ text: o, expl: `${o}${josa(o, '은', '는')} ${st.indexOf(o) + 1}번째 단계예요. 순서: ${st.join(' → ')}` }))];
    return mcq(`<p class="qtext">${escS(spec.seq.name)}에서 <b>${escS(st[i])}</b> 바로 다음 단계는?</p>`, opts, 0);
  }
  if (pattern === 'cls-odd') {
    const groups = spec.classify.groups, why = spec.classify.why || {}, names = clsAsk(spec.classify);
    const G = pick(names), inG = take(groups[G], 3);
    const outName = pick(Object.keys(groups).filter(g => g !== G)), odd = pick(groups[outName]);
    const opts = [{ text: odd, expl: `${odd}${josa(odd, '은', '는')} ${outName}에 속해요. ${why[outName] || ''}`.trim() }, ...inG.map(x => ({ text: x, expl: `${G}에 속해요. ${why[G] || ''}`.trim() }))];
    return mcq(`<p class="qtext">다음 중 <b>${escS(G)}</b>에 속하지 <b>않는</b> 것은? <span class="note">(${escS(spec.classify.name)})</span></p>`, opts, 0);
  }
  if (pattern === 'essay') {
    const e = pick(spec.essay);
    return { kind: 'short', essay: true, stem: `<p class="qtext">${escS(e.q)}</p>`, answer_text: e.model, answer_html: escS(e.model),
      extra: `<p>채점 핵심어: ${e.kw.map(k => `<b>${escS(k[0])}</b>`).join(' · ')}</p>`, kw: e.kw, concepts };
  }
  return null;
}

// 서술형 핵심어 채점: 핵심어 묶음 중 몇 개가 들어갔나 (같은 뜻 낱말 인정)
export function keywordScore(kw, text) {
  const t = normT(text);
  const hit = kw.map(group => group.some(w => t.includes(normT(w))));
  return { hit, score: hit.filter(Boolean).length, total: kw.length, correct: hit.filter(Boolean).length >= Math.ceil(kw.length * 0.67) };
}

// 규격 검사: 문제를 만들기 전에 형식과 상식적인 품질을 확인한다
export function validateSpec(spec, conceptName = '') {
  const err = [];
  const str = (v, where, max = 120) => { if (typeof v !== 'string' || !v.trim()) err.push(`${where}: 비었음`); else if (v.length > max) err.push(`${where}: 너무 김(${v.length}자)`); };
  if (typeof spec.c !== 'number') err.push('c(개념 id) 없음');
  for (const [i, x] of (spec.facts || []).entries()) {
    if (x.t) { str(x.t, `facts[${i}].t`, 90); str(x.why, `facts[${i}].why`, 140); }
    else if (x.f) { str(x.f, `facts[${i}].f`, 90); str(x.fix, `facts[${i}].fix`, 90); str(x.why, `facts[${i}].why`, 140); }
    else err.push(`facts[${i}]: t도 f도 없음`);
  }
  const all = (spec.facts || []).map(x => normT(x.t || x.f));
  if (new Set(all).size !== all.length) err.push('facts: 같은 문장 중복');
  for (const [i, x] of (spec.terms || []).entries()) {
    str(x.term, `terms[${i}].term`, 40); str(x.def, `terms[${i}].def`, 110);
    if (x.def && x.term && normT(x.def).includes(normT(x.term))) err.push(`terms[${i}]: 정의에 용어(${x.term})가 그대로 들어 있어 답이 샘`);
  }
  if (spec.compare) {
    const { items, rows } = spec.compare;
    if (!Array.isArray(items) || items.length < 2) err.push('compare.items 2개 이상');
    for (const [a, v] of Object.entries(rows || {})) for (const it of items) if (!v || typeof v[it] !== 'string' || !v[it].trim()) err.push(`compare.rows.${a}.${it} 비었음`);
  }
  if (spec.seq) { if (!Array.isArray(spec.seq.steps) || spec.seq.steps.length < 3) err.push('seq.steps 3개 이상'); if (new Set(spec.seq.steps).size !== spec.seq.steps.length) err.push('seq.steps 중복'); }
  if (spec.classify) {
    const g = spec.classify.groups || {}, members = Object.values(g).flat();
    if (Object.keys(g).length < 2) err.push('classify.groups 2개 이상');
    if (new Set(members).size !== members.length) err.push('classify: 한 원소가 두 묶음에 있음');
  }
  for (const [i, e] of (spec.essay || []).entries()) { str(e.q, `essay[${i}].q`, 120); str(e.model, `essay[${i}].model`, 260); if (!Array.isArray(e.kw) || e.kw.length < 2) err.push(`essay[${i}].kw 2개 이상`); }
  return err;
}
