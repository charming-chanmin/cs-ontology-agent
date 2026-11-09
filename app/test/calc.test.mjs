// 계산 생성기 확인: 손으로 푼 고정 사례 + 모든 유형 무작위 500개씩 (형식·정답 일치)
import assert from 'node:assert/strict';
import { simulate, pageFaults, diskMove, toPostfix, sortPasses, heapInsert, order, dfs, bfs, dijkstra, kruskal, topo, GENERATORS, makeCalc } from '../src/calcgen.js';

const P = (...a) => a.map(([p, at, bt]) => ({ p, at, bt }));
// 스케줄링 (손 계산)
let r = simulate(P(['P1', 0, 5], ['P2', 1, 3], ['P3', 2, 8]), 'FCFS');
assert.deepEqual(r.rows.map(x => x.wait), [0, 4, 6]);
r = simulate(P(['P1', 0, 5], ['P2', 1, 3], ['P3', 2, 1]), 'RR', 2);
assert.deepEqual(r.order, ['P3', 'P2', 'P1']); assert.deepEqual(r.rows.map(x => x.wait), [4, 4, 2]);
r = simulate(P(['P1', 0, 8], ['P2', 1, 4], ['P3', 2, 9], ['P4', 3, 5]), 'SRT');   // 교과서 예: 평균 대기 6.5
assert.equal(r.rows.reduce((s, x) => s + x.wait, 0) / 4, 6.5);
r = simulate(P(['P1', 0, 6], ['P2', 1, 8], ['P3', 2, 7], ['P4', 3, 3]), 'SJF');   // P1 0-6, P4 6-9, P3 9-16, P2 16-24
assert.deepEqual(r.order, ['P1', 'P4', 'P3', 'P2']);
r = simulate(P(['P1', 0, 3], ['P2', 1, 6], ['P3', 2, 4], ['P4', 3, 5]), 'HRN');   // t=3: P2 (2+6)/6=1.33, P3 (1+4)/4=1.25, P4 1 → P2; t=9: P3 (7+4)/4=2.75, P4 (6+5)/5=2.2 → P3
assert.deepEqual(r.order, ['P1', 'P2', 'P3', 'P4']);
// 페이지 교체 (교과서 참조열: FIFO 15, LRU 12, OPT 9)
const refs = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1];
assert.equal(pageFaults(refs, 3, 'FIFO').faults, 15); assert.equal(pageFaults(refs, 3, 'LRU').faults, 12); assert.equal(pageFaults(refs, 3, 'OPT').faults, 9);
// 디스크 (교과서: head 53, FCFS 640, SSTF 236)
const q = [98, 183, 37, 122, 14, 124, 65, 67];
assert.equal(diskMove(53, q, 'FCFS').total, 640); assert.equal(diskMove(53, q, 'SSTF').total, 236);
assert.equal(diskMove(53, q, 'SCAN', 'down').total, 53 + 183);            // 0까지 갔다가 183까지
assert.equal(diskMove(53, q, 'C-SCAN', 'up').total, (199 - 53) + 199 + 37); // 199 → 0(복귀 포함) → 37
// 후위 표기
assert.equal(toPostfix('( A + B ) * C - D / E'.split(' ')).join(''), 'AB+C*DE/-');
assert.equal(toPostfix('A - B - C'.split(' ')).join(''), 'AB-C-');
// 정렬 회전
assert.deepEqual(sortPasses([5, 3, 8, 1, 9, 2], '선택', 2)[1], [1, 2, 8, 5, 9, 3]);
assert.deepEqual(sortPasses([5, 3, 8, 1, 9, 2], '버블', 1)[0], [3, 5, 1, 8, 2, 9]);
assert.deepEqual(sortPasses([5, 3, 8, 1, 9, 2], '삽입', 3)[2], [1, 3, 5, 8, 9, 2]);
// 힙
assert.deepEqual(heapInsert([3, 1, 6, 5, 2, 4]).pop(), [6, 5, 4, 1, 2, 3]);
// BST 순회
const t = { v: 50, l: { v: 30, l: { v: 20 }, r: { v: 40 } }, r: { v: 70, l: { v: 60 }, r: { v: 80 } } };
assert.deepEqual(order(t, 'pre'), [50, 30, 20, 40, 70, 60, 80]); assert.deepEqual(order(t, 'post'), [20, 40, 30, 60, 80, 70, 50]);
// 그래프
const V = ['A', 'B', 'C', 'D', 'E'], E = [['A', 'B', 4], ['A', 'C', 1], ['C', 'B', 2], ['B', 'D', 5], ['C', 'D', 8], ['D', 'E', 3]];
assert.deepEqual(dfs(V, E, 'A'), ['A', 'B', 'C', 'D', 'E']); assert.deepEqual(bfs(V, E, 'A'), ['A', 'B', 'C', 'D', 'E']);
assert.deepEqual(['B', 'C', 'D', 'E'].map(v => dijkstra(V, E, 'A').dist[v]), [3, 1, 8, 11]);
assert.equal(kruskal(V, E).total, 1 + 2 + 3 + 5);
assert.deepEqual(topo(['A', 'B', 'C', 'D'], [['B', 'A'], ['C', 'A'], ['A', 'D']]).out, ['B', 'C', 'A', 'D']);
console.log('고정 사례 통과');

// 모든 유형 무작위: 정답이 자기 check를 통과하고, 같은 seed면 같은 문제
let n = 0;
for (const g of GENERATORS) for (let s = 1; s <= 500; s++) {
  const a = makeCalc(g.id, s), b = makeCalc(g.id, s);
  assert.equal(a.stem, b.stem);
  assert.ok(a.stem && a.steps, g.id);
  if (a.kind === 'mcq') assert.ok(a.opts.length === 4 && a.answer >= 0 && new Set(a.opts).size === 4, g.id);
  else { assert.ok(a.check(a.answer), `${g.id} seed ${s}: 정답이 check 실패 (${a.answer})`); assert.ok(!a.check('정답 아님 999999'), g.id); }
  n++;
}
console.log(`유형 ${GENERATORS.length}개 × 500 = ${n}문제: 정답·결정성 확인`);
