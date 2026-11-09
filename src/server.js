#!/usr/bin/env node
// CS 개념 온톨로지 MCP 서버 (stdio)
// 어떤 AI 에이전트든 이 서버를 연결하면 같은 개념 지도를 "맥락"으로 쓸 수 있다.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as O from './ontology.js';
import { makeQuiz, gradeQuiz, QUIZ_SCOPES } from './quiz.js';

const server = new McpServer({ name: 'cs-ontology', version: '0.2.0' });
const json = value => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] });
const fail = msg => ({ isError: true, content: [{ type: 'text', text: msg }] });
const readOnly = { readOnlyHint: true, openWorldHint: false };

server.registerTool('search_concepts', {
  title: '개념 검색',
  description: '낱말로 개념을 찾는다. 결과는 개념 id, 제목, 중요도(별 1~5). 예: "인터럽트", "캐시".',
  inputSchema: { query: z.string().min(1), limit: z.number().int().min(1).max(20).optional() },
  annotations: readOnly,
}, async ({ query, limit }) => json(O.search(query, limit)));

server.registerTool('get_concept', {
  title: '개념 조회',
  description: '개념 하나의 정의(왜 생겼나, 핵심, 계산 이유), 중요도, 출제 정보, 바로 앞 개념, 바로 열리는 개념을 돌려준다.',
  inputSchema: { id: z.number().int() },
  annotations: readOnly,
}, async ({ id }) => { const c = O.getConcept(id); return c ? json(c) : fail(`개념 ${id}번은 없어. 1~${O.nodes.length} 사이로 넣어 줘.`); });

server.registerTool('get_prerequisite_path', {
  title: '선행 경로',
  description: '개념 하나를 이해하는 데 필요한 모든 선행 개념을 깊이별로 돌려준다. L0이 출발점이다.',
  inputSchema: { id: z.number().int() },
  annotations: readOnly,
}, async ({ id }) => O.byId.has(id) ? json(O.prerequisitePath(id)) : fail(`개념 ${id}번은 없어.`));

// ── 자체 문제: 같은 seed면 같은 문제라서 서버가 상태를 들고 있지 않아도 채점할 수 있다 ──
const scopeEnum = z.enum(Object.keys(QUIZ_SCOPES));
const quizArgs = {
  seed: z.number().int().min(1).max(4294967295).optional().describe('같은 seed면 같은 문제. 생략하면 새로 정한다.'),
  scope: scopeEnum.optional().describe(Object.entries(QUIZ_SCOPES).map(([k, v]) => `${k}=${v.label}`).join(', ')),
  count: z.number().int().min(1).max(20).optional(),
  concept_ids: z.array(z.number().int()).max(40).optional().describe('이 개념들로만 낸다 (복습 순서로 다시 풀기).'),
};
const quizOf = ({ seed, scope, count, concept_ids }) => makeQuiz(O.nodes, { seed, scope, count, ids: concept_ids });
const letterToIndex = a => {
  if (a == null || a === '') return null;
  const s = String(a).trim().toUpperCase();
  const i = 'ABCD'.indexOf(s);
  return i >= 0 ? i : /^[1-4]$/.test(s) ? Number(s) - 1 : null;
};

server.registerTool('generate_quiz', {
  title: '문제 만들기',
  description: '개념 지도에서 4지선다 문제를 만든다(교재 불필요). 유형: 개념 맞히기(정의를 보고 개념 고르기), 선행 찾기, 다음 찾기. '
    + '정답은 들어 있지 않다. 학생 답을 받으면 같은 seed·scope·count·concept_ids로 grade_quiz를 부른다.',
  inputSchema: quizArgs,
  annotations: readOnly,
}, async args => {
  const seed = args.seed ?? (Math.floor(Math.random() * 4294967294) + 1);
  const quiz = quizOf({ ...args, seed });
  return json({
    seed, scope: quiz.scope, scope_label: quiz.scope_label, count: quiz.questions.length,
    questions: quiz.questions.map(q => ({ no: q.no, type: q.type_label, prompt: q.prompt, quote: q.quote ?? undefined, options: q.options.map(o => `${o.letter}. ${o.title}`) })),
  });
});

server.registerTool('grade_quiz', {
  title: '채점',
  description: 'generate_quiz와 같은 인자에 학생 답(answers: "A"~"D" 또는 1~4, 건너뛴 문제는 null)을 넣으면 채점한다. '
    + '틀린 문제마다 정답, 고른 보기가 왜 틀렸는지, 책임 개념(blame)을 주고, wrong_concepts는 diagnose_wrong_answers의 concepts로 그대로 넣는다.',
  inputSchema: { ...quizArgs, seed: z.number().int().min(1).max(4294967295), answers: z.array(z.union([z.string(), z.number(), z.null()])).max(20) },
  annotations: readOnly,
}, async ({ answers, ...args }) => {
  const quiz = quizOf(args);
  if (answers.length !== quiz.questions.length) return fail(`문제는 ${quiz.questions.length}개인데 답이 ${answers.length}개야. 건너뛴 문제는 null로 넣어 줘.`);
  const g = gradeQuiz(quiz, answers.map(letterToIndex));
  const brief = id => ({ id, title: O.byId.get(id).title });
  return json({
    score: `${g.score}/${g.total}`,
    wrong: g.results.filter(r => !r.correct).map(r => ({
      no: r.no, chosen: r.chosen ? `${r.chosen.letter}. ${r.chosen.title}` : null, answer: `${r.answer.letter}. ${r.answer.title}`,
      why_wrong: r.note || undefined, explain: r.explain, blame: brief(r.blame),
    })),
    wrong_concepts: g.wrong_concepts,
  });
});

server.registerTool('rank_shared_prerequisites', {
  title: '공통 선행 개념',
  description: '개념 여러 개가 공통으로 기대는 가장 구체적인 선행 개념을, 공유하는 개념 수가 많은 순서로 돌려준다.',
  inputSchema: { ids: z.array(z.number().int()).min(1).max(30), limit: z.number().int().min(1).max(20).optional() },
  annotations: readOnly,
}, async ({ ids, limit }) => {
  const W = ids.filter(i => O.byId.has(i));
  return json(O.rankShared(W).slice(0, limit ?? 8).map(c => ({ id: c.id, title: O.byId.get(c.id).title, shared_by: `${c.cov}/${W.length}`, depth: c.depth })));
});

server.registerTool('diagnose_wrong_answers', {
  title: '오답 진단',
  description: '틀린 개념 목록(grade_quiz의 wrong_concepts)으로 진단한다. 처음엔 concepts만 넣으면 공통 선행 개념과 학생에게 물어볼 다음 질문(next_question)을 준다. '
    + '학생의 답을 known(설명 가능) / confused(헷갈림) / asked(넘어감 포함 이미 물어본 것)에 넣어 다시 부르면, next_question이 null이 될 때 plan(막힌 지점, 복습 순서)을 준다. '
    + '복습이 끝나면 review_order의 id를 generate_quiz의 concept_ids로 넣어 다시 풀게 한다.',
  inputSchema: {
    concepts: z.array(z.number().int()).min(1).max(30),
    known: z.array(z.number().int()).optional(),
    confused: z.array(z.number().int()).optional(),
    asked: z.array(z.number().int()).optional(),
  },
  annotations: readOnly,
}, async ({ concepts, known = [], confused = [], asked = [] }) => {
  const r = O.diagnose(concepts, known, confused, asked);
  return r.wrong_concepts.length ? json(r) : fail('아는 개념 번호가 없어. grade_quiz의 wrong_concepts나 search_concepts로 찾은 id를 넣어 줘.');
});

server.registerResource('ontology-schema', 'ontology://schema', {
  title: '온톨로지 스키마',
  description: '클래스, 관계, 규모',
  mimeType: 'application/json',
}, async uri => ({
  contents: [{
    uri: uri.href, mimeType: 'application/json',
    text: JSON.stringify({
      classes: ['Concept', 'Chapter', 'ExamItem'],
      relations: ['Concept prerequisite_of Concept', 'Concept belongs_to Chapter', 'Concept tested_by ExamItem'],
      counts: { concepts: O.nodes.length, prerequisite_edges: O.edgeCount, chapters: O.chapters.size, exam_items: O.examItemCount },
    }, null, 2),
  }],
}));

await server.connect(new StdioServerTransport());
