// 가상 학생 시뮬레이션: "모르는 개념"을 정해 두고 문제를 풀게 해서,
// 엔진이 출발점(진짜 원인)을 찾아내는지, 아는 개념을 모름으로 잘못 찍지 않는지 확인한다.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import * as K from '../src/coach.js';
import { makeQuiz } from '../../src/quiz.js';
import { patternsOf, makeSpec } from '../src/specgen.js';
import { GENERATORS, makeCalc } from '../src/calcgen.js';
const DATA = process.env.DATA || '../data';

function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// 앱과 같은 문제 풀: 강의 문제 + 개념 규격 문제(보기 조합 4가지씩) + 계산 문제(숫자 4가지씩)
const load = file => {
  const d = JSON.parse(readFileSync(new URL(`${DATA}/${file}.json`, import.meta.url), 'utf8'));
  const specs = JSON.parse(readFileSync(new URL(`../specs/${file}.json`, import.meta.url), 'utf8'));
  const by = new Map(d.concepts.map(c => [c.id, c]));
  for (const spec of specs) {
    const c = by.get(spec.c); if (!c) continue;
    const sib = specs.filter(x => x !== spec && by.get(x.c) && by.get(x.c).chapter === c.chapter);
    const ctx = { name: c.title, siblingFalse: sib.flatMap(x => (x.facts || []).filter(f => f.f)), siblingTerms: sib.flatMap(x => x.terms || []) };
    for (const p of patternsOf(spec, ctx)) for (let k = 1; k <= 4; k++) { const q = makeSpec(spec, p, k * 7 + 1, ctx); if (q) d.quizzes[`spec-${spec.c}-${p}-${k}`] = { ...q, id: `spec-${spec.c}-${p}-${k}`, concepts: q.concepts.filter(x => by.has(x)) }; }
  }
  for (const g of GENERATORS) if (g.subject === file) { const cs = g.nodes.filter(n => by.has(n)); if (cs.length) for (let k = 1; k <= 4; k++) { const c = makeCalc(g.id, k * 101); d.quizzes[`calc-${g.id}-${k}`] = { id: `calc-${g.id}-${k}`, kind: c.kind === 'mcq' ? 'mcq' : 'calc', options: c.opts, concepts: cs }; } }
  return d;
};

// 앱의 checkQuestion과 같은 규칙: 개념 지도 문제(def → core) 중 최근에 안 본 모양을 먼저
function gen(subject, cid, salt, state) {
  let first = null;
  for (const type of ['def', 'core']) {
    const g = makeQuiz(subject.concepts, { count: 1, ids: [cid], type, seed: (cid * 7919 + salt * 104729 + 17) >>> 0 }).questions.find(x => x.type === type && x.blame === cid);
    if (!g) continue;
    const id = `gen-${type}-${cid}-${salt}`;
    subject.quizzes[id] = { id, shape: `gen-${type}-${cid}`, kind: 'mcq', options: g.options, concepts: [cid], answer: [g.answer + 1] };
    if (!state || !K.isRecentShape(state, cid, subject.quizzes[id])) return id;
    first = first || id;
  }
  return first;
}
// 학생: blind 개념은 찍어서만 맞히고(객관식 1/4, 주관식 1/20), 아는 개념은 8% 실수
function student(blind, rand) {
  return q => { const unknown = q.concepts.some(c => blind.has(c)); const guess = q.kind === 'mcq' ? 1 / Math.max(2, (q.options || []).length || 4) : 0.05; return unknown ? rand() < guess : rand() > 0.08; };
}
function run(file, gapId, { seed = 1, n = 40 } = {}) {
  const subject = load(file), ix = K.createIndex(subject), rand = mulberry(seed);
  const pool = Object.values(subject.quizzes).filter(q => q.concepts.length).map(q => q.id);
  const state = K.emptyState();
  const blind = new Set([gapId]);
  for (const c of subject.concepts) if (ix.ancestorsWithDepth(c.id).has(gapId)) blind.add(c.id);
  const answer = student(blind, rand);
  let now = Date.parse('2026-11-09T09:00:00Z'), used = new Set(), checks = [], reached = false;
  for (let i = 0; i < n; i++) {
    const id = K.pickQuiz(ix, state, pool, used, now, rand); if (!id) break;
    used.add(id); const q = subject.quizzes[id]; const ok = answer(q);
    const ch = K.applyAnswer(ix, state, q, ok, now); now += 120000;
    if (!ok && q.concepts.some(c => blind.has(c))) reached = true;
    if (!ok && K.needsProbe(ix, state, q, ch)) {
      // 페이지와 같은 규칙: 틀린 개념의 확인 안 된 선행을 확인 문제로 하나씩 (한 번에 최대 8문제)
      const probe = K.startProbe(q.concepts[0], { also: q.concepts.slice(1) });
      for (let k = 0; k < 8; k++) {
        const target = K.probeTarget(ix, state, probe); if (target == null) break;
        let cq = K.checkQuizFor(ix, state, target, pool, used, now);
        if (!cq || K.isRecentShape(state, target, subject.quizzes[cq])) cq = gen(subject, target, used.size, state) || cq;
        if (!cq) { K.probeResult(ix, state, probe, null); continue; }
        used.add(cq); const cok = answer(subject.quizzes[cq]); K.applyAnswer(ix, state, subject.quizzes[cq], cok, now, { check: target }); now += 120000;
        K.probeResult(ix, state, probe, cok); checks.push(`${target}${cok ? '✓' : '✗'}`);
      }
      checks.push('|');
    }
  }
  return { subject, ix, state, g: K.guide(ix, state), checks, blind, reached };
}

let found = 0, trials = 0, falseStarts = 0, allStarts = 0, checkQs = 0, notReached = 0;
for (const [file, gap] of [['tcs', 41], ['tcs', 46], ['tcs', 85], ['tcs', 114], ['alg', 18], ['alg', 13]]) {
  for (const seed of (process.env.SEEDS ? process.env.SEEDS.split(',').map(Number) : [1, 2, 3])) {
    const r = run(file, gap, { seed });
    const starts = r.g.starts.map(s => s.id);
    // 출발점이 gap 자신이거나, gap에서 바로 이어진 개념이면 맞게 짚은 것 (gap 문제를 아직 못 풀었을 수 있음)
    const near = starts.some(c => c === gap || r.ix.byId.get(c).prereq.includes(gap));
    if (!r.reached) { notReached++; continue; }   // 40문제 동안 모르는 개념 쪽 문제를 한 번도 안 틀림 → 찾을 기회가 없었음
    trials++; if (near) found++;
    const extra = starts.filter(c => !r.blind.has(c));
    falseStarts += extra.length; allStarts += starts.length; checkQs += r.checks.filter(c => c !== '|').length;
    if (seed === 1) console.log(`${file} 모르는 개념 ${gap} ${r.ix.byId.get(gap).title} → 출발점 [${starts.join(', ')}] · 확인 문제 ${r.checks.join(' ')}`);
  }
}
console.log(`\n진짜 원인(또는 바로 다음 개념)을 출발점으로 짚은 비율: ${found}/${trials} · 출발점 ${allStarts}개 중 실제로는 아는 개념 ${falseStarts}개 (정밀도 ${Math.round((1 - falseStarts / allStarts) * 100)}%) · 40문제당 확인 문제 평균 ${(checkQs / trials).toFixed(1)}개 · 모르는 개념 쪽을 한 번도 안 틀린 경우 ${notReached}번 (제외)`);
assert.ok(found / trials >= 0.8, '진단 정확도가 너무 낮음');
assert.ok(1 - falseStarts / allStarts >= 0.7, '아는 개념을 출발점으로 너무 많이 찍음');

// 다 아는 학생은 출발점이 거의 없어야 한다 (실수 8%만큼만)
{
  const subject = load('tcs'), ix = K.createIndex(subject), state = K.emptyState(), pool = Object.keys(subject.quizzes), rand = mulberry(9);
  let now = Date.parse('2026-11-09T09:00:00Z'), used = new Set();
  for (let i = 0; i < 40; i++) { const id = K.pickQuiz(ix, state, pool, used, now, rand); used.add(id); K.applyAnswer(ix, state, subject.quizzes[id], rand() > 0.08, now); now += 120000; }
  const r = K.recommend(ix, state, now);
  console.log(`다 아는 학생 40문제: 정복 ${r.count.know} · 모험 중 ${r.count.half} · 정복 실패 ${r.count.unknown} · 출발점 ${r.guide.starts.length}`);
  assert.ok(r.guide.starts.length <= 4);
}
// 상태 규칙
{
  const ix = K.createIndex({ concepts: [{ id: 1, prereq: [], next: [2], stars: 5, chapter: 1 }, { id: 2, prereq: [1], next: [3], stars: 5, chapter: 1 }, { id: 3, prereq: [2], next: [], stars: 3, chapter: 1 }], quizzes: {}, scenes: {}, lessons: [] });
  const s = K.emptyState(), q = id => ({ id: 'q' + id + Math.random(), kind: 'mcq', options: [1, 2, 3, 4], concepts: [id] });
  assert.equal(K.statusOf(s, 2), 'none');
  K.applyAnswer(ix, s, q(2), true, 1); assert.equal(K.statusOf(s, 2), 'half'); assert.equal(K.streakOf(s, 2), 1);
  K.applyAnswer(ix, s, q(2), true, 2); assert.equal(K.statusOf(s, 2), 'half', '2번으로는 아직 정복 아님'); assert.equal(K.toKnow(s, 2), 1);
  K.applyAnswer(ix, s, q(2), true, 2); assert.equal(K.statusOf(s, 2), 'know', '3번 연속 맞히면 정복');
  assert.equal(K.statusOf(s, 1), 'none', '선행은 직접 풀기 전까지 그대로');
  K.applyAnswer(ix, s, q(2), false, 3); assert.equal(K.statusOf(s, 2), 'unknown', '앎이어도 틀리면 모름');
  K.applyAnswer(ix, s, q(2), true, 4); assert.equal(K.statusOf(s, 2), 'half');
  // 복습: 정복 직후 3일 뒤, 한 번 더 맞히면 7일 뒤
  const s2 = K.emptyState(); for (let k = 0; k < 3; k++) K.applyAnswer(ix, s2, q(1), true, 0);
  assert.ok(!K.isDue(s2, 1, 2 * K.DAY) && K.isDue(s2, 1, 3 * K.DAY));
  K.applyAnswer(ix, s2, q(1), true, 0); assert.ok(!K.isDue(s2, 1, 6 * K.DAY) && K.isDue(s2, 1, 7 * K.DAY));
  // 문제 모양 기억: 최근에 푼 모양은 다음 확인에서 뒤로 밀린다
  const quizzes = { a: { id: 'a', kind: 'mcq', concepts: [3] }, b: { id: 'b', kind: 'mcq', concepts: [3] } };
  const ixq = K.createIndex({ concepts: ix.subject.concepts, quizzes, scenes: {}, lessons: [] }), sq = K.emptyState();
  K.applyAnswer(ixq, sq, quizzes.a, true, 0);
  assert.deepEqual(K.recentShapes(sq, 3), ['a']);
  assert.equal(K.checkQuizFor(ixq, sq, 3, ['a', 'b'], new Set(), 0), 'b', '방금 푼 모양 a 말고 b');
  assert.equal(K.shapeOf({ id: 'spec-1-fact-true:123', tid: 'spec-1-fact-true' }), 'spec-1-fact-true', '같은 틀에서 나온 문제는 같은 모양');
  // 길잡이: 1, 2, 3 모두 모름 → 출발점은 1, 2·3은 막힘
  const s3 = K.emptyState(); for (const id of [1, 2, 3]) K.applyAnswer(ix, s3, q(id), false, 0);
  const g = K.guide(ix, s3);
  assert.deepEqual(g.starts.map(x => x.id), [1]); assert.deepEqual(g.starts[0].unlocks.sort(), [2, 3]); assert.deepEqual(g.blocked.sort(), [2, 3]);
  assert.deepEqual(K.chainTo(ix, s3, 1, 3), [1, 2, 3]);
  // 원인 찾기: 3을 틀림 → 2(안 봄)를 묻고 → 틀리면 1을 묻는다
  const s4 = K.emptyState(); K.applyAnswer(ix, s4, q(3), false, 0);
  const p = K.startProbe(3);
  assert.equal(K.probeTarget(ix, s4, p), 2); K.applyAnswer(ix, s4, q(2), false, 0); K.probeResult(ix, s4, p, false);
  assert.equal(K.probeTarget(ix, s4, p), 1); K.applyAnswer(ix, s4, q(1), true, 0); K.probeResult(ix, s4, p, true);
  assert.equal(K.probeTarget(ix, s4, p), 2, '선행을 다 본 뒤 찾은 모름(2)을 한 번 더 확인'); K.applyAnswer(ix, s4, q(2), false, 0); K.probeResult(ix, s4, p, false);
  assert.equal(K.probeTarget(ix, s4, p), null);
  assert.deepEqual(K.probeSummary(ix, s4, p).path, [2, 3]);
  // 실수: 3을 틀렸지만 선행은 다 알고, 3을 다시 맞힘 → 출발점 없음
  const s5 = K.emptyState(); for (const id of [1, 2]) for (let k = 0; k < 3; k++) K.applyAnswer(ix, s5, q(id), true, 0);
  K.applyAnswer(ix, s5, q(3), false, 0); const p5 = K.startProbe(3);
  assert.equal(K.probeTarget(ix, s5, p5), 3); K.applyAnswer(ix, s5, q(3), true, 0); K.probeResult(ix, s5, p5, true);
  assert.equal(K.probeTarget(ix, s5, p5), null); const sm = K.probeSummary(ix, s5, p5);
  assert.ok(sm.slip && sm.root === null); assert.equal(K.statusOf(s5, 3), 'half');
  // 여러 개념 문제를 틀리면 주 개념만 모름
  const s6 = K.emptyState(); K.applyAnswer(ix, s6, { id: 'm', kind: 'mcq', concepts: [3, 1] }, false, 0);
  assert.equal(K.statusOf(s6, 3), 'unknown'); assert.equal(K.statusOf(s6, 1), 'none');
  // 예전 저장(확률 v1) → 기록에서 다시 계산
  const old = { v: 1, k: { 2: { p: 0.9 } }, attempts: [{ q: 'a', c: [2], ok: 1, t: 1 }, { q: 'b', c: [2], ok: 1, t: 2 }, { q: 'd', c: [2], ok: 1, t: 2 }, { q: 'c', c: [3], ok: 0, t: 3 }], read: { '1-1': 5 }, gaps: {}, checks: {} };
  const m = K.migrate(old);
  assert.equal(m.v, 2); assert.equal(K.statusOf(m, 2), 'know'); assert.deepEqual(K.recentShapes(m, 2), ['a', 'b', 'd']); assert.equal(K.statusOf(m, 3), 'unknown'); assert.deepEqual(m.read, { '1-1': 5 });
  assert.equal(K.migrate(null).v, 2);
  console.log(`상태 규칙 확인: 미지의 영역 → 모험 중 → ${K.RULES.need}번 연속이면 정복, 틀리면 정복 실패, 복습 3·7일, 문제 모양 돌려쓰기, 길잡이·원인 찾기·예전 저장 변환`);
}
// 문제 모양 범위: 모든 개념이 서로 다른 모양 3가지 이상으로 확인될 수 있어야 "3번 연속 = 정복"이 같은 문제 외우기가 안 된다
for (const file of ['tcs', 'alg']) {
  const subject = load(file), shapes = new Map(subject.concepts.map(c => [c.id, new Set()]));
  for (const q of Object.values(subject.quizzes)) for (const c of q.concepts) if (shapes.has(c)) shapes.get(c).add(String(q.id).replace(/-\d+$/, ''));
  const thin = [];
  for (const c of subject.concepts) {
    if (c.title.startsWith('[범위 밖]')) continue;
    for (const type of ['def', 'core']) if (makeQuiz(subject.concepts, { count: 1, ids: [c.id], type, seed: 1 }).questions.some(x => x.type === type && x.blame === c.id)) shapes.get(c.id).add('gen-' + type);
    if (shapes.get(c.id).size < K.RULES.need) thin.push(`${c.id}(${shapes.get(c.id).size})`);
  }
  console.log(`${file} 문제 모양 ${K.RULES.need}가지 미만 개념: ${thin.length ? thin.join(' ') : '없음'}`);
  assert.deepEqual(thin, [], `${file}: 문제 모양이 모자란 개념`);
}
console.log('\n시뮬레이션 통과');
