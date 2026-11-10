// 글자 점검: 화면에 찍힐 모든 문제 글자(강의 문제 · 규격 문제 · 계산 문제 · 개념 지도 문제)와 개념 설명을 실제로 만들어 보고
// 깨진 출력(undefined·NaN·[object]·두 번 이스케이프된 &lt;·마크다운 기호)과 조사 틀림(을/를·은/는·이/가·과/와·으로/로)을 찾는다.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { patternsOf, makeSpec } from '../src/specgen.js';
import { GENERATORS, makeCalc } from '../src/calcgen.js';
import { makeQuiz, titleTerms } from '../../src/quiz.js';
import { COPY } from '../src/copy.js';

const SHOW = +(process.env.SHOW || 0);
// HTML → 화면에 보이는 글자 (태그 제거 → 엔티티 한 번 풀기). <pre>·<code> 안은 코드라 따로 다룬다
const visible = h => String(h ?? '').replace(/<(pre|code)[^>]*>[\s\S]*?<\/\1>/g, ' ⟦코드⟧ ').replace(/<\/?(p|div|br|li|ul|ol|blockquote|h\d|table|tr|td|th|svg|details|summary)\b[^>]*>/g, ' ').replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ').trim();
const has = (ch) => { const c = ch.charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3 ? ((c - 0xAC00) % 28 !== 0) : /[136780lmnrLMNR]/.test(ch); };
const rieul = ch => { const c = ch.charCodeAt(0); return (c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 === 8) || /[lLrR]/.test(ch) || ch === '1' || ch === '7' || ch === '8'; };
const HARD = [
  ['undefined', /\bundefined\b/], ['NaN', /\bNaN\b/], ['[object]', /\[object /], ['보이는 엔티티', /&(lt|gt|amp|quot|#\d+);/],
  ['마크다운 기호', /\*\*|(^|[^_])__(?!_)/], ['채워지지 않은 자리', /\$\{|\{\{|\}\}/], ['빈 괄호', /(^|[^\w)])\(\s*\)|「\s*」/],
];
const SOFT = [
  ['공백 두 칸', / {2,}/], ['문장부호 앞 공백', / [.,!?](?=\s|$)(?! 버튼)/], ['마침표 두 번', /[^.]\.\.(?!\.)/],
];
// 조사 검사: 받침이 확실히 보이는 자리(한글 바로 뒤 을/를, 」·) 뒤의 조사)만 본다
function josaIssues(t) {
  const out = [];
  for (const m of t.matchAll(/([가-힣A-Za-z0-9])(을|를)(?=[\s.,!?)」]|$)/g)) {
    const want = has(m[1]) ? '을' : '를';
    if (m[2] !== want && !/[A-Za-z]/.test(m[1]) && !(/[0-9]/.test(m[1]) && /[A-Za-z][0-9]+$/.test(t.slice(0, m.index + 1)))) out.push(`${m[1]}${m[2]} → ${m[1]}${want}`);
  }
  for (const m of t.matchAll(/([가-힣A-Za-z0-9])([」)])(은|는|이|가|과|와|으로|로)(?=[\s.,!?]|$)/g)) {
    // 괄호 뒤 조사는 괄호 앞 낱말에 붙는다: 컴퓨터(에니악)는 → '터' 기준
    let last = m[1], alt = null;
    if (m[2] === ')') {
      let depth = 0, i = m.index + 1; for (; i >= 0; i--) { if (t[i] === ')') depth++; else if (t[i] === '(' && --depth === 0) break; }
      const inner = t.slice(i + 1, m.index + 1);
      if (/^[가-하ㄱ-ㅎ]$/.test(inner)) last = inner;          // 빈칸 기호 (가)·(나)는 그 글자로 읽는다
      else {
        const before = t.slice(0, Math.max(0, i));
        // BG(버스 승인)와처럼 앞 낱말에 붙기도 하고, f(n)이처럼 괄호 안까지 읽기도 한다 → 둘 중 하나만 맞으면 통과
        if (/[A-Za-z0-9_]$/.test(before)) { alt = inner.trim().slice(-1); last = before.slice(-1); }
        else { const b = before.trimEnd(); if (!b) continue; last = b.slice(-1); if (!/[가-힣A-Za-z0-9]/.test(last)) continue; }
      }
    }
    if (/[0-9]/.test(last) && /[A-Za-z][0-9]*$/.test(t.slice(0, m.index + 1).replace(/[」)].*$/, ''))) continue;   // P3·R1 같은 이름은 읽는 법이 갈려서 뺀다
    const b = has(last), p = m[3];
    const want = { 은: b ? '은' : '는', 는: b ? '은' : '는', 이: b ? '이' : '가', 가: b ? '이' : '가', 과: b ? '과' : '와', 와: b ? '과' : '와', 으로: b && !rieul(last) ? '으로' : '로', 로: b && !rieul(last) ? '으로' : '로' }[p];
    const ok2 = alt && /[가-힣A-Za-z0-9]/.test(alt) && (() => { const b2 = has(alt); return p === { 은: b2 ? '은' : '는', 는: b2 ? '은' : '는', 이: b2 ? '이' : '가', 가: b2 ? '이' : '가', 과: b2 ? '과' : '와', 와: b2 ? '과' : '와', 으로: b2 && !rieul(alt) ? '으로' : '로', 로: b2 && !rieul(alt) ? '으로' : '로' }[p]; })();
    if (p !== want && !ok2) out.push(`${last}${m[2]}${p} → ${want}  …${t.slice(Math.max(0, m.index - 25), m.index + 6)}…`);
  }
  return out;
}
const found = new Map();   // 검사 이름 → [예시]
const note = (kind, where, text) => { if (!found.has(kind)) found.set(kind, []); const l = found.get(kind); if (l.length < 400) l.push(`${where}: ${text}`); };
let checked = 0;
function audit(where, html, { code = false } = {}) {
  const t = visible(html); if (!t) return;
  checked++;
  for (const [k, re] of HARD) { const m = t.match(re); if (m && !(code && k === '마크다운 기호')) note(k, where, `…${t.slice(Math.max(0, m.index - 25), m.index + 25)}…`); }
  for (const [k, re] of SOFT) { const m = t.match(re); if (m) note(k, where, `…${t.slice(Math.max(0, m.index - 20), m.index + 20)}…`); }
  for (const j of josaIssues(t)) note('조사', where, j + `  (…${t.slice(0, 60)}…)`);
}
function auditQuiz(where, q) {
  audit(where + ' 문제', q.stem);
  (q.options || []).forEach((o, i) => { audit(`${where} 보기${i + 1}`, o); if (!visible(o)) note('빈 보기', where, `보기 ${i + 1}`); });
  for (const [k, v] of Object.entries(q.expl || {})) audit(`${where} 해설${k}`, v);
  audit(where + ' 풀이', q.extra); audit(where + ' 답', q.answer_html); audit(where + ' 꼬리', q.tail);
  if (q.kind === 'mcq' && q.options) {
    const vis = q.options.map(o => visible(o).replace(/\s/g, ''));
    if (new Set(vis).size !== vis.length) note('보기 중복', where, vis.join(' | '));
    if (!q.answer || !q.answer.every(n => n >= 1 && n <= q.options.length)) note('정답 번호 오류', where, JSON.stringify(q.answer));
  }
}

for (const key of ['tcs', 'alg']) {
  const data = JSON.parse(readFileSync(new URL(`../data/${key}.json`, import.meta.url), 'utf8'));
  const specs = JSON.parse(readFileSync(new URL(`../specs/${key}.json`, import.meta.url), 'utf8'));
  const by = new Map(data.concepts.map(c => [c.id, c]));
  // 1) 개념·강의 글자
  for (const c of data.concepts) for (const f of ['title', 'short', 'why', 'core']) audit(`${key} 개념#${c.id} ${f}`, c[f].replace(/&/g, '&amp;').replace(/</g, '&lt;'));
  for (const s of Object.values(data.scenes)) audit(`${key} 장면${s.id} 제목`, s.title.replace(/&/g, '&amp;').replace(/</g, '&lt;'));
  for (const L of data.lessons) audit(`${key} ${L.num}강 제목`, L.title.replace(/&/g, '&amp;').replace(/</g, '&lt;'));
  // 2) 강의 속 문제 (원문)
  for (const q of Object.values(data.quizzes)) auditQuiz(`${key} 강의문제 ${q.id}`, q);
  // 3) 규격 문제: 패턴마다 40개
  for (const spec of specs) {
    const c = by.get(spec.c);
    const sib = specs.filter(x => x !== spec && by.get(x.c) && by.get(x.c).chapter === c.chapter);
    const ctx = { name: c.title, siblingFalse: sib.flatMap(x => (x.facts || []).filter(f => f.f)), siblingTerms: sib.flatMap(x => x.terms || []) };
    for (const p of patternsOf(spec, ctx)) for (let s = 1; s <= 40; s++) { const q = makeSpec(spec, p, s * 977 + 3, ctx); if (q) auditQuiz(`${key} 규격#${spec.c} ${p}`, q); }
  }
  // 4) 개념 지도 문제(개념 맞히기 def · 설명 맞히기 core): 모든 개념 × 두 유형
  //    가린 지문(quote)에 개념 이름(영문 약어 포함)이 남으면 답이 보이는 것이라 막는다
  for (const c of data.concepts) for (const type of ['def', 'core']) {
    const g = makeQuiz(data.concepts, { count: 1, ids: [c.id], type, seed: c.id * 31 + 7 }).questions.find(x => x.type === type);
    if (!g) continue;
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    auditQuiz(`${key} 지도문제(${type})#${c.id}`, { stem: esc(g.prompt) + ' ' + esc(g.quote || ''), options: g.options.map(o => esc(o.title)), answer: [g.answer + 1], expl: Object.fromEntries(g.options.map((o, i) => [i + 1, esc(o.note || '정답')])), extra: esc(g.explain), kind: 'mcq' });
    for (const w of titleTerms(c.title)) if (g.quote.includes(w)) note('지문에 답 노출', `${key}#${c.id} ${type}`, w);
    if (g.quote.replace(/□□/g, '').replace(/[^가-힣A-Za-z0-9]/g, '').length < 12) note('지문이 너무 짧음', `${key}#${c.id} ${type}`, g.quote);
  }
}
// 5) 계산 문제: 유형마다 40개
for (const g of GENERATORS) for (let s = 1; s <= 40; s++) {
  const c = makeCalc(g.id, s * 7919 + 1);
  if (g.id === 'postfix') { c.steps = c.steps.replace(/\*\*/g, '× ×'); c.answer = String(c.answer).replace(/\*\*/g, '× ×'); }   // 후위표기의 ** 는 곱셈 두 번이라 정상
  auditQuiz(`계산 ${g.id}`, { stem: c.stem, extra: c.steps, options: c.opts ? c.opts.map(o => String(o).replace(/&/g, '&amp;').replace(/</g, '&lt;')) : null, answer: c.kind === 'mcq' ? [c.answer + 1] : null, kind: c.kind === 'mcq' ? 'mcq' : 'calc', answer_html: String(c.answer) });
}

// 6) 화면 문구 사전(copy.js): 함수는 예시 숫자를 넣어 문장을 만들어 본다
{
  const ctx = { name: '통합컴퓨터시스템', short: '통컴시', total: 145, count: { know: 3, half: 2, unknown: 1, none: 139 }, starts: 1, blocked: 0, due: 0 };
  const walk = (v, where) => {
    if (typeof v === 'function') { const out = v(ctx); if (typeof out === 'string') audit(`문구 ${where}`, out); }
    else if (typeof v === 'string') audit(`문구 ${where}`, v);
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${where}.${k}`);
  };
  walk(COPY, 'COPY');
  // 둘러보기가 비추는 대상(data-tour)이 화면 코드에 실제로 있는지
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8') + readFileSync(new URL('../src/template.html', import.meta.url), 'utf8');
  for (const st of COPY.tour) if (!app.includes(`data-tour="${st.target}"`)) note('둘러보기 대상 없음', st.target, st.title);
  for (const k of Object.keys(COPY.help)) if (!app.includes(`'${k}'`) && !app.includes(`"${k}"`)) note('안 쓰는 도움말', k, COPY.help[k].title);
}

const hard = ['지문에 답 노출', '지문이 너무 짧음', '둘러보기 대상 없음', 'undefined', 'NaN', '[object]', '보이는 엔티티', '마크다운 기호', '채워지지 않은 자리', '빈 괄호', '빈 보기', '보기 중복', '정답 번호 오류', '조사'];
console.log(`글자 점검: 화면 글자 ${checked}개`);
for (const [k, l] of found) {
  const uniq = [...new Set(l.map(x => x.replace(/ (보기|해설)\d+:/, ':')))];
  console.log(`  ${hard.includes(k) ? '✗' : '·'} ${k} ${l.length}건${SHOW || hard.includes(k) ? '\n     ' + uniq.slice(0, SHOW || 8).join('\n     ') : ''}`);
}
const bad = hard.filter(k => found.has(k));
assert.deepEqual(bad, [], `고칠 글자 문제: ${bad.join(', ')}`);
console.log('글자 점검 통과');
