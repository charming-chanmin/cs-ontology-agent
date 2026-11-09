// MCP 클라이언트로 서버를 띄워 도구를 실제로 호출해 본다.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import assert from 'node:assert/strict';

const client = new Client({ name: 'smoke-test', version: '0.1.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: ['src/server.js'] }));
const call = async (name, args) => {
  const r = await client.callTool({ name, arguments: args });
  return { r, v: r.isError ? null : JSON.parse(r.content[0].text) };
};

const { tools } = await client.listTools();
console.log('tools:', tools.map(t => t.name).join(', '));
assert.equal(tools.length, 7);

const schema = await client.readResource({ uri: 'ontology://schema' });
const counts = JSON.parse(schema.contents[0].text).counts;
console.log('schema:', counts);
assert.deepEqual([counts.concepts, counts.prerequisite_edges, counts.chapters], [147, 222, 22]);

let { v } = await call('search_concepts', { query: '인터럽트', limit: 3 });
console.log('search 인터럽트 →', v.map(x => `${x.id} ${x.title}`).join(' / '));
assert.equal(v[0].id, 66);

// 자체 문제: 같은 seed면 같은 문제, 정답은 문제에 들어 있지 않다
({ v } = await call('generate_quiz', { seed: 42, scope: 'all' }));
const again = (await call('generate_quiz', { seed: 42, scope: 'all' })).v;
assert.deepEqual(v, again);
assert.equal(v.questions.length, 10);
for (const q of v.questions) assert.equal(q.options.length, 4);
assert.ok(!JSON.stringify(v).includes('answer'));
console.log(`문제 ${v.count}개 (seed ${v.seed}) → Q1 [${v.questions[0].type}] ${v.questions[0].prompt}${v.questions[0].quote ? ' / ' + v.questions[0].quote : ''}`);

// 채점: 모두 A로 찍었다고 하면 틀린 문제의 책임 개념이 나온다
({ v } = await call('grade_quiz', { seed: 42, scope: 'all', answers: Array(10).fill('A') }));
console.log('채점 →', v.score, '| 틀린 개념 →', v.wrong_concepts.join(', '));
assert.equal(v.score, '4/10');
assert.ok(v.wrong.every(w => w.blame && w.answer));
const short = await call('grade_quiz', { seed: 42, answers: ['A'] });
assert.equal(short.r.isError, true);

({ v } = await call('get_prerequisite_path', { id: 66 }));
console.log('66 선행 개수 →', v.total);
assert.equal(v.total, 26);

// 다단계 진단: 서버가 묻고, 학생이 답하고, 다시 부른다
const concepts = [43, 49, 68, 90]; // 틀린 문제의 책임 개념
const answers = { 40: 'known', 46: 'confused', 41: 'known', 45: 'confused', 66: 'known', 87: 'known' };
const known = [], confused = [], asked = [];
for (let turn = 1; turn <= 7; turn++) {
  ({ v } = await call('diagnose_wrong_answers', { concepts, known, confused, asked }));
  if (turn === 1) console.log('틀린 개념 →', v.wrong_concepts.map(c => c.id).join(', '), '| 공통 →', v.shared_prerequisites.map(c => `${c.id}(${c.shared_by})`).join(', '));
  if (!v.next_question) break;
  const id = v.next_question.id, a = answers[id] ?? 'skip';
  console.log(`Q${turn}: ${v.next_question.ask} → ${a}`);
  asked.push(id); if (a === 'known') known.push(id); if (a === 'confused') confused.push(id);
}
console.log('막힌 지점 →', v.plan.stuck_at.map(c => `${c.id} ${c.title}`).join(', '));
console.log('복습 순서 →', v.plan.review_order.map(c => c.id).join(' → '));
assert.deepEqual(v.plan.review_order.map(c => c.id), [45, 43, 46, 49, 68, 90]);

// 복습 순서로 다시 풀기
({ v } = await call('generate_quiz', { seed: 7, concept_ids: [45, 43, 46, 49, 68, 90] }));
console.log('복습 개념으로 다시 →', v.count, '문제');
assert.equal(v.count, 6);

const bad = await call('get_concept', { id: 999 });
assert.equal(bad.r.isError, true);
console.log('없는 번호 →', bad.r.content[0].text);

await client.close();
console.log('\n모든 확인 통과');
