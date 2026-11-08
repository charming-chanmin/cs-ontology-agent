#!/usr/bin/env node
// CS 개념 온톨로지 MCP 서버 (stdio)
// 어떤 AI 에이전트든 이 서버를 연결하면 같은 개념 지도를 "맥락"으로 쓸 수 있다.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as O from './ontology.js';

const server = new McpServer({ name: 'cs-ontology', version: '0.1.0' });
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

server.registerTool('find_concepts_for_exam_items', {
  title: '문제 → 개념',
  description: '교재 문제 번호("056"), 모의고사("모의1-22"), 공식 예시("예시06")를 받아 각 문제가 묻는 개념을 돌려준다.',
  inputSchema: { items: z.array(z.string()).min(1).max(30) },
  annotations: readOnly,
}, async ({ items }) => json(items.map(O.resolveItem).map(r => ({ input: r.input, item: r.item, concepts: r.concepts.map(id => ({ id, title: O.byId.get(id).title })) }))));

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
  description: '틀린 문제 목록으로 진단한다. 처음엔 items만 넣으면 공통 선행 개념과 학생에게 물어볼 다음 질문(next_question)을 준다. '
    + '학생의 답을 known(설명 가능) / confused(헷갈림) / asked(넘어감 포함 이미 물어본 것)에 넣어 다시 부르면, next_question이 null이 될 때 plan(막힌 지점, 복습 순서)을 준다.',
  inputSchema: {
    items: z.array(z.string()).min(1).max(30),
    known: z.array(z.number().int()).optional(),
    confused: z.array(z.number().int()).optional(),
    asked: z.array(z.number().int()).optional(),
  },
  annotations: readOnly,
}, async ({ items, known = [], confused = [], asked = [] }) => json(O.diagnose(items, known, confused, asked)));

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
