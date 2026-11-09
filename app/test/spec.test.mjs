// 지식 규격 검사 + 생성 문제 품질 검사
// 1) 규격 형식(빈 칸·길이·중복·답이 새는 정의)  2) 패턴마다 수백 개 만들어 보기 4개 중복 없음·정답 1개·보기마다 해설
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { validateSpec, patternsOf, makeSpec, keywordScore } from '../src/specgen.js';

const SHOW = process.env.SHOW ? +process.env.SHOW : 0;
const strip = h => String(h).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
let total = 0, specsN = 0;
for (const key of ['tcs', 'alg']) {
  const data = JSON.parse(readFileSync(new URL(`../data/${key}.json`, import.meta.url), 'utf8'));
  const specs = JSON.parse(readFileSync(new URL(`../specs/${key}.json`, import.meta.url), 'utf8'));
  const by = new Map(data.concepts.map(c => [c.id, c]));
  for (const spec of specs) {
    specsN++;
    const c = by.get(spec.c); assert.ok(c, `${key} 규격의 개념 ${spec.c}가 온톨로지에 없음`);
    for (const a of spec.also || []) assert.ok(by.has(a), `${key} also ${a} 없음`);
    const err = validateSpec(spec, c.title);
    assert.deepEqual(err, [], `${key} #${spec.c} ${c.title} 규격 오류:\n  ${err.join('\n  ')}`);
    // 같은 장의 다른 규격에서 빌려 올 수 있는 틀린 문장·용어
    const sib = specs.filter(s => s !== spec && by.get(s.c).chapter === c.chapter);
    const ctx = { name: c.title, siblingFalse: sib.flatMap(s => (s.facts || []).filter(x => x.f)), siblingTerms: sib.flatMap(s => s.terms || []) };
    const pats = patternsOf(spec, ctx);
    assert.ok(pats.length >= 2, `${key} #${spec.c}: 만들 수 있는 패턴이 너무 적음 (${pats})`);
    for (const p of pats) {
      let ok = 0, nul = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const q = makeSpec(spec, p, seed, ctx);
        if (!q) { nul++; continue; }
        ok++; total++;
        if (q.kind === 'mcq') {
          assert.equal(q.options.length, 4, `${p} 보기 수`);
          assert.equal(new Set(q.options.map(o => strip(o).replace(/\s/g, ''))).size, 4, `${key} #${spec.c} ${p} seed ${seed}: 보기 중복 ${q.options}`);
          assert.equal(q.answer.length, 1); assert.ok(q.answer[0] >= 1 && q.answer[0] <= 4);
          for (let k = 1; k <= 4; k++) assert.ok(q.expl[String(k)] && strip(q.expl[String(k)]).length > 3, `${p}: 보기 ${k} 해설 없음`);
        } else {
          assert.ok(q.answer_text && q.answer_html, `${p}: 모범답안 없음`);
          if (q.kw) assert.ok(keywordScore(q.kw, q.answer_text).correct, `${key} #${spec.c} 서술형: 모범답안이 자기 핵심어 채점을 통과 못 함`);
        }
        assert.deepEqual(q.concepts, [spec.c, ...(spec.also || [])]);
      }
      assert.ok(ok >= 150, `${key} #${spec.c} ${p}: 300번 중 ${ok}번만 만들어짐`);
    }
    if (SHOW) {
      console.log(`\n■ ${key} #${spec.c} ${c.title} — 패턴 ${pats.join(', ')}`);
      for (const p of pats.slice(0, SHOW)) {
        const q = makeSpec(spec, p, 7, ctx) || makeSpec(spec, p, 8, ctx);
        console.log(`  [${p}] ${strip(q.stem)}`);
        if (q.kind === 'mcq') q.options.forEach((o, i) => console.log(`     ${q.answer[0] === i + 1 ? '●' : '○'} ${strip(o)}  — ${strip(q.expl[String(i + 1)])}`));
        else console.log(`     답: ${strip(q.answer_html)}`);
      }
    }
  }
}
console.log(`\n규격 ${specsN}개 · 생성 문제 ${total}개 검사 통과 (보기 4개 중복 없음 · 정답 1개 · 보기마다 해설 · 서술형 모범답안 자기 채점 통과)`);
