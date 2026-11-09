// 학습 코치 엔진: 개념 온톨로지 위에 "이 개념을 아는가"를 규칙으로 표시한다. 확률 계산은 쓰지 않는다.
//
// ■ 개념 하나의 상태 (그 개념 문제를 직접 푼 기록만 본다)
//   안 봄    아직 이 개념 문제를 안 풀었다
//   모름     마지막으로 푼 문제를 틀렸다
//   확인 중   마지막에 맞혔지만 연속 1번뿐이다 (한 번 더 맞히면 앎)
//   앎       2번 연속 맞혔다
//   + 복습 때: 앎인데 마지막으로 맞힌 지 오래됐다 (연속 2번 → 3일, 3번 → 7일, 4번 → 14일, 5번 이상 → 30일)
//
// ■ 온톨로지 길잡이 (선행 관계 = "B를 이해하려면 A를 먼저 알아야 한다")
//   막힘     모름인데, 선행 개념 중에도 모름이 있다 → 그 선행부터
//   출발점   모름인데, 선행 개념 중 모름은 없다 → 여기부터 공부하면 된다
//
// ■ 원인 찾기: 문제를 틀리면 그 개념의 선행 중 아직 확인 안 된 것(안 봄·확인 중)을
//   확인 문제로 하나씩 묻는다. 틀리면 그 선행도 모름 → 한 칸 더 내려간다. 맞히면 다음 선행.
//   이미 모름인 선행이 있으면 묻지 않고 바로 그쪽으로 내려간다.
// 페이지와 테스트가 이 파일 하나를 같이 쓴다.

export const DAY = 86400000;
export const NEED = 2;                       // 앎이 되려면 연속으로 맞혀야 하는 수
export const reviewDays = streak => (streak >= 5 ? 30 : { 2: 3, 3: 7, 4: 14 }[streak] || 3);
export const STATUS = {
  know: { label: '앎', icon: '✓', rule: '이 개념 문제를 2번 연속 맞혔어' },
  half: { label: '확인 중', icon: '◐', rule: '마지막에 맞혔어. 한 번 더 맞히면 앎' },
  unknown: { label: '모름', icon: '✗', rule: '이 개념 문제를 마지막에 틀렸어' },
  none: { label: '안 봄', icon: '○', rule: '아직 이 개념 문제를 안 풀었어' },
};
export const STATUS_KEYS = ['know', 'half', 'unknown', 'none'];

export function createIndex(subject) {
  const byId = new Map(subject.concepts.map(c => [c.id, c]));
  const ancMemo = new Map();
  // 선행 개념과 거리(1 = 바로 앞)
  function ancestorsWithDepth(id, max = 99) {
    const key = id + ':' + max;
    if (ancMemo.has(key)) return ancMemo.get(key);
    const dist = new Map(), queue = [[id, 0]];
    while (queue.length) {
      const [x, d] = queue.shift();
      if (d >= max) continue;
      for (const p of byId.get(x).prereq) if (byId.has(p) && !dist.has(p)) { dist.set(p, d + 1); queue.push([p, d + 1]); }
    }
    ancMemo.set(key, dist);
    return dist;
  }
  const depthMemo = new Map();
  const depth = id => {
    if (depthMemo.has(id)) return depthMemo.get(id);
    depthMemo.set(id, 0);
    const p = byId.get(id).prereq.filter(x => byId.has(x));
    const d = p.length ? 1 + Math.max(...p.map(depth)) : 0;
    depthMemo.set(id, d);
    return d;
  };
  // 중요도: 별(시험 중요도)과 출제 비중
  const weight = c => (c.stars / 5) * 0.7 + ((c.prob ?? c.stars * 12) / 100) * 0.3;
  const live = id => byId.has(id) && !byId.get(id).out;
  return { subject, byId, ancestorsWithDepth, depth, weight, live, quizzes: subject.quizzes, scenes: subject.scenes };
}

export const emptyState = () => ({ v: 2, k: {}, attempts: [], read: {}, sessions: 0 });
export function statusOf(state, id) {
  const s = state.k[id];
  if (!s || !s.n) return 'none';
  if (!s.streak) return 'unknown';
  return s.streak >= NEED ? 'know' : 'half';
}
// 앎이 될 때까지 더 맞혀야 하는 수 (앎이면 0)
export const toKnow = (state, id) => Math.max(0, NEED - ((state.k[id] && state.k[id].streak) || 0));
export function dueAt(state, id) {
  const s = state.k[id];
  return s && s.streak >= NEED ? s.lastOk + reviewDays(s.streak) * DAY : null;
}
export const isDue = (state, id, now) => { const d = dueAt(state, id); return d != null && d <= now; };

function record(state, ids, ok, t) {
  const changes = [];
  for (const id of ids) {
    const before = statusOf(state, id);
    const s = state.k[id] || (state.k[id] = { n: 0, c: 0, streak: 0, last: 0, lastOk: 0, h: '' });
    s.n += 1; s.last = t; s.h = (s.h + (ok ? '1' : '0')).slice(-8);
    if (ok) { s.c += 1; s.streak += 1; s.lastOk = t; } else s.streak = 0;
    changes.push({ id, before, after: statusOf(state, id), streak: s.streak });
  }
  return changes;
}
// 답이 바꾸는 개념: 맞히면 문제가 묻는 개념 전부, 틀리면 주 개념(첫 번째)만.
// (여러 개념을 같이 묻는 문제를 틀리면 어느 쪽 탓인지 모르니, 나머지는 원인 찾기에서 따로 확인한다)
export const hitIds = (ids, ok) => (ok ? ids : ids.slice(0, 1));
// 답 하나를 반영한다. 그 문제가 묻는 개념만 바뀐다 (선행 개념은 직접 확인하기 전까지 그대로)
export function applyAnswer(ix, state, quiz, correct, now, extra = {}) {
  const ids = quiz.concepts.filter(id => ix.byId.has(id));
  const changes = record(state, hitIds(ids, !!correct), !!correct, now);
  state.attempts.push({ q: quiz.tid || quiz.id, c: ids, ok: correct ? 1 : 0, t: now, ...(extra.check != null ? { chk: extra.check } : {}), ...(extra.ai ? { ai: 1 } : {}) });
  if (state.attempts.length > 400) state.attempts.splice(0, state.attempts.length - 400);
  return changes;
}
// 예전 저장 형식(확률 v1)이나 깨진 값 → 지금 형식. 푼 기록(attempts)에서 상태를 다시 계산한다
export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return emptyState();
  const out = emptyState();
  out.read = raw.read && typeof raw.read === 'object' ? raw.read : {};
  out.sessions = raw.sessions || 0;
  if (raw.updated) out.updated = raw.updated;
  const attempts = Array.isArray(raw.attempts) ? raw.attempts.filter(a => a && Array.isArray(a.c)) : [];
  if (raw.v === 2 && raw.k && typeof raw.k === 'object') { out.k = raw.k; out.attempts = attempts; return out; }
  for (const a of attempts) { record(out, hitIds(a.c, !!a.ok), !!a.ok, a.t || 0); out.attempts.push(a); }
  return out;
}

// ── 길잡이 ──
const pre = (ix, id) => ix.byId.get(id).prereq.filter(ix.live);
export const unknownPre = (ix, state, id) => pre(ix, id).filter(p => statusOf(state, p) === 'unknown');
export const uncheckedPre = (ix, state, id) => pre(ix, id).filter(p => ['none', 'half'].includes(statusOf(state, p)));
// 모름 개념에서 선행 쪽으로 모름을 따라 내려가 닿는 출발점들
export function startsOf(ix, state, id, memo = new Map()) {
  if (memo.has(id)) return memo.get(id);
  const out = new Set(); memo.set(id, out);
  const up = unknownPre(ix, state, id);
  if (!up.length) out.add(id);
  else for (const p of up) for (const s of startsOf(ix, state, p, memo)) out.add(s);
  return out;
}
// 출발점 → … → 모름 개념까지 모름으로만 이어진 가장 짧은 길
export function chainTo(ix, state, start, target) {
  if (start === target) return [target];
  const prev = new Map([[target, null]]), q = [target];
  while (q.length) {
    const x = q.shift();
    for (const p of unknownPre(ix, state, x)) if (!prev.has(p)) { prev.set(p, x); if (p === start) { const path = [p]; let y = x; while (y != null) { path.push(y); y = prev.get(y); } return path; } q.push(p); }
  }
  return [start, target];
}
export function guide(ix, state) {
  const C = ix.subject.concepts.filter(c => !c.out);
  const unknown = C.filter(c => statusOf(state, c.id) === 'unknown').map(c => c.id);
  const memo = new Map(), unlock = new Map();
  for (const id of unknown) for (const s of startsOf(ix, state, id, memo)) { if (!unlock.has(s)) unlock.set(s, []); if (s !== id) unlock.get(s).push(id); }
  const W = id => ix.weight(ix.byId.get(id));
  const starts = [...unlock.entries()].map(([id, ups]) => ({ id, unlocks: ups.sort((a, b) => ix.depth(a) - ix.depth(b) || W(b) - W(a)), unchecked: uncheckedPre(ix, state, id) }))
    .sort((a, b) => b.unlocks.length - a.unlocks.length || W(b.id) - W(a.id) || ix.depth(a.id) - ix.depth(b.id));
  const blocked = unknown.filter(id => unknownPre(ix, state, id).length);
  return { unknown, starts, blocked };
}

// ── 원인 찾기 ──
export const wrongTwice = (state, id) => !!(state.k[id] && state.k[id].h.endsWith('00'));
// 틀린 뒤 원인 찾기를 할지: 새로 모름이 됐거나, 아직 확인 안 된 선행·같이 묻던 개념이 남아 있을 때만
export function needsProbe(ix, state, quiz, changes) {
  const primary = quiz.concepts[0], ch = changes.find(c => c.id === primary);
  if (!ch || ch.after !== 'unknown') return false;
  if (ch.before !== 'unknown') return true;
  return uncheckedPre(ix, state, primary).length > 0 || quiz.concepts.slice(1).some(x => ix.live(x) && ['none', 'half'].includes(statusOf(state, x)));
}
// also: 틀린 문제가 같이 묻던 다른 개념 (선행처럼 먼저 확인한다)
export function startProbe(id, opts = {}) {
  return { from: id, also: (opts.also || []).filter(x => x !== id), stack: [id], asked: [], confirmed: [], current: null, n: 0, done: false, log: [], manual: !!opts.manual };
}
// 다음에 물을 개념. 없으면 null (끝)
//  1) 맨 아래 모름 개념(F)의 선행 중 이미 모름인 게 있으면 묻지 않고 그쪽으로 내려간다
//  2) 확인 안 된 선행(안 봄·확인 중)을 중요한 것부터 하나씩 묻는다
//  3) 더 물을 선행이 없으면 F 자체를 다른 문제로 한 번 더 묻는다 (한 번 틀린 게 실수였는지 확인)
export function probeTarget(ix, state, probe) {
  if (probe.done) return null;
  if (probe.current != null) return probe.current;
  const W = id => ix.weight(ix.byId.get(id));
  for (let guard = 0; guard < 60 && probe.stack.length; guard++) {
    const F = probe.stack[probe.stack.length - 1];
    const ps = [...new Set([...(F === probe.from ? probe.also.filter(ix.live) : []), ...pre(ix, F)])].filter(p => !probe.stack.includes(p));
    const already = ps.filter(p => statusOf(state, p) === 'unknown' && !probe.asked.includes(p)).sort((a, b) => W(b) - W(a))[0];
    if (already != null) { probe.stack.push(already); probe.asked.push(already); probe.log.push({ id: already, v: 'already' }); continue; }
    const cand = ps.filter(p => !probe.asked.includes(p) && ['none', 'half'].includes(statusOf(state, p)))
      .sort((a, b) => (probe.also.includes(b) - probe.also.includes(a)) || W(b) - W(a) || ix.depth(b) - ix.depth(a));
    if (cand.length) { probe.current = cand[0]; probe.asked.push(cand[0]); probe.kind = 'pre'; return cand[0]; }
    // 이미 2번 연속 틀린 개념은 확인할 필요 없이 모름
    if (statusOf(state, F) === 'unknown' && !probe.confirmed.includes(F) && !wrongTwice(state, F)) { probe.confirmed.push(F); probe.current = F; probe.kind = 'again'; return F; }
    break;
  }
  probe.done = true;
  return null;
}
// correct = null 이면 낼 문제가 없어서 건너뛴 것
export function probeResult(ix, state, probe, correct) {
  const X = probe.current, kind = probe.kind;
  probe.current = null; probe.n += 1;
  const v = correct === null ? 'skip' : correct ? 'ok' : 'no';
  probe.log.push({ id: X, v, kind });
  if (kind === 'again') { if (v === 'ok') probe.stack.pop(); }      // 다시 맞힘 → 아까는 실수. 한 칸 위로
  else if (v === 'no') probe.stack.push(X);                          // 선행도 틀림 → 그 아래로
  return v;
}
// 원인 찾기 결과: 가장 아래까지 내려간 모름 개념(root)과 그 길 (root가 맨 앞 = 공부할 순서)
export function probeSummary(ix, state, probe) {
  const root = probe.stack.length ? probe.stack[probe.stack.length - 1] : null;
  const again = probe.log.find(l => l.kind === 'again' && l.id === probe.from);
  return { from: probe.from, root, path: probe.stack.slice().reverse(), found: root != null && root !== probe.from, log: probe.log.slice(), manual: probe.manual,
    slip: !!(again && again.v === 'ok'), left: root != null ? uncheckedPre(ix, state, root).filter(p => !probe.asked.includes(p)) : [] };
}

// ── 오늘 할 일 ──
export function recommend(ix, state, now) {
  const C = ix.subject.concepts.filter(c => !c.out);
  const W = c => ix.weight(c);
  const count = { know: 0, half: 0, unknown: 0, none: 0 };
  for (const c of C) count[statusOf(state, c.id)]++;
  const due = C.filter(c => isDue(state, c.id, now)).sort((a, b) => W(b) - W(a)).map(c => c.id);
  const half = C.filter(c => statusOf(state, c.id) === 'half').sort((a, b) => W(b) - W(a)).map(c => c.id);
  const untested = C.filter(c => statusOf(state, c.id) === 'none').sort((a, b) => b.stars - a.stars || ix.depth(a.id) - ix.depth(b.id)).map(c => c.id);
  let nextScene = null;
  for (const L of ix.subject.lessons) { for (const sid of L.scenes) if (!state.read[sid]) { nextScene = sid; break; } if (nextScene) break; }
  const core = C.filter(c => c.stars === 5);
  return { count, total: C.length, due, half, untested, guide: guide(ix, state), nextScene,
    coreKnow: core.filter(c => statusOf(state, c.id) === 'know').length, coreTotal: core.length };
}

// ── 문제 고르기 ──
// 개념마다 "지금 물어볼 이유"를 점수로: 출발점(모름) > 확인 중 > 복습 때 > 안 봄 > 막힘 > 앎
export function needScore(ix, state, id, now) {
  const c = ix.byId.get(id); if (!c || c.out) return 0;
  const s = state.k[id], st = statusOf(state, id);
  // 출발점(모름)은 우선. 단 2번 연속 틀렸으면 강의를 다시 읽은 뒤에 묻는다 (같은 걸 계속 틀리게 하지 않게)
  const readAfter = st === 'unknown' && c.scenes && c.scenes.some(sid => (state.read[sid] || 0) > s.last);
  const root = st === 'unknown' && !unknownPre(ix, state, id).length;
  let base = root ? (wrongTwice(state, id) && !readAfter ? 1.2 : 5) : st === 'unknown' ? 0.8 : st === 'half' ? 4 : st === 'none' ? 2.2 : isDue(state, id, now) ? 3.5 : 0.25;
  if (s && now - s.last < 10 * 60000) base *= 0.25;   // 방금 푼 개념은 잠깐 쉬었다가
  return base * (0.5 + ix.weight(c));
}
export function scoreQuiz(ix, state, quiz, now) {
  let best = 0;
  for (const cid of quiz.concepts) best = Math.max(best, needScore(ix, state, cid, now));
  best *= 0.85 + (quiz.weight ?? 30) / 200;
  const lastSeen = state.attempts.findLast ? state.attempts.findLast(a => a.q === quiz.id) : [...state.attempts].reverse().find(a => a.q === quiz.id);
  if (lastSeen && now - lastSeen.t < DAY) best *= lastSeen.ok ? 0.1 : 0.4;
  return best;
}
export function pickQuiz(ix, state, pool, used, now, rand = Math.random) {
  const cand = pool.filter(id => !used.has(id)).map(id => ({ id, s: scoreQuiz(ix, state, ix.quizzes[id], now) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
  if (!cand.length) return null;
  const top = cand.slice(0, 6), sum = top.reduce((a, x) => a + x.s, 0);
  let r = rand() * sum;
  for (const x of top) { r -= x.s; if (r <= 0) return x.id; }
  return top[0].id;
}
// 진단: 장마다 중요한 개념부터 고르게 한 문제씩 (안 본 개념 먼저)
export function diagnosticPool(ix, state, pool, size = 12) {
  const byCh = new Map(), seenC = new Set();
  for (const id of pool) {
    const q = ix.quizzes[id], c = ix.byId.get(q.concepts[0]);
    if (!c || c.out) continue;
    if (!byCh.has(c.chapter)) byCh.set(c.chapter, []);
    byCh.get(c.chapter).push({ id, c: c.id, w: ix.weight(c) + (statusOf(state, c.id) !== 'none' ? -1 : 0) + (q.kind === 'mcq' ? 0.05 : 0) });
  }
  const lists = [...byCh.values()].map(l => l.sort((a, b) => b.w - a.w));
  const out = [];
  for (let round = 0; out.length < size && round < 8; round++) for (const l of lists) {
    const x = l.find(y => !seenC.has(y.c) && !out.includes(y.id));
    if (x && out.length < size) { out.push(x.id); seenC.add(x.c); }
  }
  return out;
}
// 확인 문제: 그 개념을 주로 묻는 문제 중 최근에 안 본 것
export function checkQuizFor(ix, state, conceptId, pool, used, now) {
  const ids = pool.filter(id => ix.quizzes[id] && ix.quizzes[id].concepts.includes(conceptId) && !used.has(id));
  if (!ids.length) return null;
  const recent = new Set(state.attempts.filter(a => now - a.t < 2 * DAY).map(a => a.q));
  const rank = id => { const q = ix.quizzes[id]; return (recent.has(id) ? 4 : 0) + (q.concepts[0] === conceptId ? 0 : 2) + (q.kind === 'mcq' ? 0 : 1); };
  return ids.sort((a, b) => rank(a) - rank(b))[0];
}

// 짧은 답 자동 채점
export function normalize(s) {
  return String(s).toLowerCase().replace(/\s+/g, '').replace(/(개|비트|번|회|가지|단계|bit|bits)$/, '');
}
export function autoGrade(quiz, text) {
  if (!quiz.auto) return null;
  const a = normalize(text);
  if (!a) return null;
  return a === quiz.auto;
}

// 세션 요약: 개념별 처음 상태 → 마지막 상태
export function summarize(changesList) {
  const m = new Map();
  for (const ch of changesList) for (const c of ch) {
    if (!m.has(c.id)) m.set(c.id, { id: c.id, before: c.before, after: c.after });
    else m.get(c.id).after = c.after;
  }
  return [...m.values()];
}
