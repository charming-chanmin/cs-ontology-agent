// 온톨로지 로딩 + 추론. 웹 데모(docs/index.html)와 같은 규칙을 쓴다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, '..', 'data', 'ontology.json'), 'utf8'));

export const nodes = data.nodes;
export const chapters = new Map(data.chapters.map(c => [c.id, c]));
export const byId = new Map(nodes.map(n => [n.id, n]));
export const edgeCount = data.edges.length;

const brief = id => ({ id, title: byId.get(id).title });

// ── Concept ─prerequisite_of→ Concept ──
const ancMemo = new Map();
export function ancestors(id) {
  if (ancMemo.has(id)) return ancMemo.get(id);
  const s = new Set();
  for (const p of byId.get(id).prereq) { s.add(p); for (const a of ancestors(p)) s.add(a); }
  ancMemo.set(id, s);
  return s;
}
const depthMemo = new Map();
export function depth(id) {
  if (depthMemo.has(id)) return depthMemo.get(id);
  const p = byId.get(id).prereq;
  const d = p.length ? 1 + Math.max(...p.map(depth)) : 0;
  depthMemo.set(id, d);
  return d;
}
const closure = ids => { const s = new Set(); for (const k of ids) { s.add(k); for (const a of ancestors(k)) s.add(a); } return s; };

// ── Concept ─tested_by→ ExamItem ──
function expandRef(r) {
  r = r.replace(/\(주관식\)/, '');
  let m = r.match(/^(\d{3})~(\d{3})$/);
  if (m) { const a = []; for (let i = +m[1]; i <= +m[2]; i++) a.push(String(i).padStart(3, '0')); return a; }
  m = r.match(/^(모의[12])-(\d+)~(\d+)$/);
  if (m) { const a = []; for (let i = +m[2]; i <= +m[3]; i++) a.push(`${m[1]}-${String(i).padStart(2, '0')}`); return a; }
  return [r];
}
const itemIdx = new Map();
for (const n of nodes) for (const r of n.exam.refs) for (const k of expandRef(r)) {
  if (!itemIdx.has(k)) itemIdx.set(k, new Set());
  itemIdx.get(k).add(n.id);
}
export const examItemCount = itemIdx.size;

export function resolveItem(raw) {
  const t = String(raw).trim().replace(/\s+/g, '');
  let m;
  if ((m = t.match(/^(?:교재)?(\d{1,3})(?:번)?$/))) { const k = String(+m[1]).padStart(3, '0'); return { input: raw, item: '교재 ' + k, concepts: [...(itemIdx.get(k) || [])] }; }
  if ((m = t.match(/^모의([12])[-_.]?(\d{1,2})(?:번)?$/))) { const k = `모의${m[1]}-${String(+m[2]).padStart(2, '0')}`; return { input: raw, item: k, concepts: [...(itemIdx.get(k) || [])] }; }
  if ((m = t.match(/^(?:공식)?예시0?(\d)$/))) { const k = `공식 예시0${m[1]}`; return { input: raw, item: k, concepts: [...(itemIdx.get(k) || [])] }; }
  if ((m = t.match(/^[#cC](\d{1,3})$/)) && byId.has(+m[1])) return { input: raw, item: '개념 ' + m[1], concepts: [+m[1]] };
  const hit = nodes.find(n => n.title.replace(/\s/g, '').includes(t));
  return { input: raw, item: hit ? hit.title : String(raw), concepts: hit ? [hit.id] : [] };
}

// ── 조회 ──
export function getConcept(id) {
  const n = byId.get(id);
  if (!n) return null;
  return {
    id: n.id, title: n.title, stars: n.stars, root: n.root,
    chapter: `${n.chapter}장 ${chapters.get(n.chapter).title}`,
    why: n.why, core: n.core, calc: n.calc || undefined,
    exam: { probability_pct: n.exam.prob, types: n.exam.types, refs: n.exam.refs },
    prerequisites: n.prereq.map(brief), unlocks: n.next.map(brief),
  };
}
export function prerequisitePath(id) {
  const levels = {};
  for (const a of [...ancestors(id)].sort((x, y) => x - y)) (levels['L' + depth(a)] ||= []).push(brief(a));
  return { concept: brief(id), total: ancestors(id).size, levels };
}
export function search(query, limit = 8) {
  const q = String(query).trim();
  if (!q) return [];
  return nodes
    .map(n => ({ n, s: (n.title === q ? 10 : n.title.startsWith(q) ? 5 : n.title.includes(q) ? 3 : 0) + (n.why.includes(q) ? 1 : 0) + (n.core.includes(q) ? 1 : 0) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s || b.n.stars - a.n.stars)
    .slice(0, limit)
    .map(x => ({ id: x.n.id, title: x.n.title, stars: x.n.stars }));
}

// ── 진단 추론 ──
// 여러 개념이 공통으로 기대는 "가장 구체적인" 선행 개념: 공유 수가 같거나 큰 다른 후보의 조상이면 뺀다.
export function rankShared(W, exclude = new Set()) {
  const cov = new Map();
  for (const w of W) for (const a of ancestors(w)) if (!exclude.has(a) && !W.includes(a)) cov.set(a, (cov.get(a) || 0) + 1);
  const c = [...cov.keys()];
  return c
    .filter(a => !c.some(b => b !== a && cov.get(b) >= cov.get(a) && ancestors(b).has(a)))
    .map(a => ({ id: a, cov: cov.get(a), depth: depth(a) }))
    .sort((x, y) => y.cov - x.cov || y.depth - x.depth || byId.get(y.id).stars - byId.get(x.id).stars);
}
export function nextQuestion(W, known = [], confused = [], asked = []) {
  const kc = closure(known), askedSet = new Set([...asked, ...known, ...confused]);
  const deeper = confused.flatMap(g => byId.get(g).prereq)
    .filter(p => !askedSet.has(p) && !kc.has(p) && !W.includes(p))
    .sort((a, b) => byId.get(b).stars - byId.get(a).stars || depth(b) - depth(a));
  if (deeper.length) return deeper[0];
  const pick = rankShared(W, new Set([...kc, ...askedSet])).find(c => !askedSet.has(c.id) && !kc.has(c.id));
  return pick ? pick.id : null;
}
export function reviewPlan(W, known = [], confused = []) {
  let roots = confused.filter(g => !confused.some(h => h !== g && ancestors(g).has(h)));
  const direct = roots.length === 0;
  if (direct) roots = W.slice();
  const path = new Set(W);
  for (const r of roots) for (const w of W) {
    if (r === w) { path.add(r); continue; }
    if (!ancestors(w).has(r)) continue;
    path.add(r);
    for (const x of ancestors(w)) if (ancestors(x).has(r)) path.add(x);
  }
  const kc = closure(known);
  const order = [...path]
    .filter(x => !kc.has(x) || W.includes(x) || confused.includes(x))
    .sort((a, b) => depth(a) - depth(b) || a - b);
  return { stuck_at: roots.map(brief), problem_is_the_concept_itself: direct, review_order: order.map(brief) };
}
export function diagnose(items, known = [], confused = [], asked = []) {
  const resolved = items.map(resolveItem);
  const W = [...new Set(resolved.flatMap(r => r.concepts))].sort((a, b) => a - b);
  const shared = rankShared(W).slice(0, 6).map(c => ({ ...brief(c.id), shared_by: `${c.cov}/${W.length}` }));
  const q = W.length ? nextQuestion(W, known, confused, asked) : null;
  return {
    exam_items: resolved.map(r => ({ input: r.input, item: r.item, concepts: r.concepts.map(brief) })),
    wrong_concepts: W.map(brief),
    shared_prerequisites: shared,
    next_question: q == null ? null : { ...brief(q), why: byId.get(q).why, ask: `${q} ${byId.get(q).title}, 설명할 수 있어?` },
    plan: (known.length || confused.length) ? reviewPlan(W, known, confused) : null,
  };
}
