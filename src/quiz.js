// 개념 지도에서 객관식 문제를 만든다.
// 웹 데모(docs/index.html)와 MCP 서버가 이 파일 하나를 같이 쓴다. 시드가 같으면 어디서든 같은 문제가 나온다.
//
// 문제 유형 (모두 온톨로지에서 나온다)
//   def  개념 맞히기: 개념의 "왜 생겼나"를 보여 주고(개념 이름은 □□로 가림) 어떤 개념인지 고른다
//   core 설명 맞히기: 개념의 "핵심 내용"을 보여 주고(개념 이름은 □□로 가림) 어떤 개념인지 고른다 (opts.type으로만 낸다)
//   pre  선행 찾기:   X를 이해하려면 바로 앞에서 알아야 하는 개념을 고른다 (prerequisite_of 관계)
//   next 다음 찾기:   X를 알고 나면 바로 이어서 배울 수 있는 개념을 고른다
// 오답 보기는 일부러 헷갈리게 고른다: 같은 장 개념, 그리고 방향이 반대인 개념(선행 문제엔 뒤 개념, 다음 문제엔 앞 개념).

export const QUIZ_SCOPES = {
  all: { label: '전체', from: 1, to: 22 },
  core: { label: '★5 반드시', from: 1, to: 22, stars: 5 },
  hw: { label: '하드웨어 (1~10장)', from: 1, to: 10 },
  os: { label: 'OS·시스템SW (11~18장)', from: 11, to: 18 },
  trend: { label: '최신 기술 (19~22장)', from: 19, to: 22 },
};
export const QUIZ_TYPES = { def: '개념 맞히기', pre: '선행 찾기', next: '다음 찾기', core: '설명 맞히기' };
const LETTERS = 'ABCD';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 개념 이름에서 가릴 낱말: "곱셈·나눗셈 (부스 알고리즘)" → 곱셈·나눗셈, 곱셈, 나눗셈, 부스 알고리즘 (+ 영문 약어)
export function titleTerms(title) {
  const base = title.replace(/^\[범위 밖\]\s*/, '');
  const main = base.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  const inner = (base.match(/\((.*?)\)/) || [])[1];
  // 영문 약어(ROM·MAR·VM…)도 따로 가린다: "ROM 종류"만 가리면 설명 속 "ROM"이 답을 알려 준다
  const latin = base.match(/[A-Za-z][A-Za-z0-9-]+/g) || [];
  // 띄어 쓴 긴 낱말(3글자 이상)도 따로: "세그먼테이션 혼용"이면 "세그먼테이션"
  const words = main.split(/[\s·/,+:]+/).filter(w => w.length >= 3 && !['vs', '그리고'].includes(w));
  const parts = [main, ...main.split(/[·/,+]| vs /), ...(inner ? inner.split(/[·,/]/) : []), ...latin, ...words];
  return [...new Set(parts.map(s => s.trim()).filter(s => s.length >= 2))].sort((a, b) => b.length - a.length);
}
export const maskTerms = (text, terms) => terms.reduce((t, w) => t.split(w).join('□□'), text);

const cut = (s, n) => (s.length > n ? s.slice(0, n).trimEnd() + '…' : s);
// 받침 따라 은/는 (괄호 설명은 건너뜀: 시스템 호출(SVC) → '호출' 기준)
const eunNeun = w => { const b = String(w).replace(/\s*\([^()]*\)\s*$/, '') || String(w); const ch = b.slice(-1), c = ch.charCodeAt(0); return (c >= 0xAC00 && c <= 0xD7A3 ? (c - 0xAC00) % 28 : /[136780lmnrLMNR]/.test(ch)) ? '은' : '는'; };

/**
 * @param nodes 온톨로지 개념 배열 ({id, title, stars, chapter, why, core, prereq, next})
 * @param opts  {count=10, scope='all', seed=1, ids} ids를 주면 그 개념들만으로 낸다 (복습 후 다시 풀기)
 */
export function makeQuiz(nodes, opts = {}) {
  const seed = (Number(opts.seed) || 1) >>> 0;
  const scope = QUIZ_SCOPES[opts.scope] ? opts.scope : 'all';
  const rand = mulberry32(seed);
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  const byId = new Map(nodes.map(n => [n.id, n]));
  const usable = n => !!n && !n.title.startsWith('[범위 밖]');
  const memoA = new Map(), memoD = new Map();
  const walk = (id, key, memo) => {
    if (memo.has(id)) return memo.get(id);
    const s = new Set();
    for (const p of byId.get(id)[key]) { s.add(p); for (const x of walk(p, key, memo)) s.add(x); }
    memo.set(id, s);
    return s;
  };
  const anc = id => walk(id, 'prereq', memoA), desc = id => walk(id, 'next', memoD);
  const okIds = list => list.filter(i => usable(byId.get(i)));
  const can = (n, t) => (t === 'def' ? !!n.why : t === 'core' ? !!n.core : t === 'pre' ? okIds(n.prereq).length > 0 : okIds(n.next).length > 0);
  const T = id => byId.get(id).title;

  // 문제를 낼 개념: 범위 안, 별 2개 이상. 중요한 개념이 더 자주 나오게 별점 가중 셔플.
  const S = QUIZ_SCOPES[scope];
  let pool = Array.isArray(opts.ids) && opts.ids.length
    ? [...new Set(opts.ids.map(Number))].map(i => byId.get(i)).filter(usable)
    : nodes.filter(n => usable(n) && n.stars >= 2 && n.chapter >= S.from && n.chapter <= S.to && (!S.stars || n.stars >= S.stars));
  pool = pool.map(n => ({ n, k: Math.pow(rand(), 1 / Math.max(1, n.stars)) })).sort((a, b) => b.k - a.k).map(x => x.n);
  const count = Math.max(1, Math.min(20, Number(opts.count) || 10, pool.length));

  // 유형 비율: 개념 맞히기 40% · 선행 찾기 40% · 다음 찾기 20%
  // opts.type을 주면 그 유형만 낸다 (예: 'def' = 개념 자체를 묻는 문제만)
  const plan = QUIZ_TYPES[opts.type] ? Array.from({ length: count }, () => opts.type)
    : shuffle(Array.from({ length: count }, (_, i) => (i < Math.round(count * 0.4) ? 'def' : i < Math.round(count * 0.8) ? 'pre' : 'next')));

  const chapterOf = id => byId.get(id).chapter;
  const inChapters = chs => nodes.filter(n => chs.includes(n.chapter)).map(n => n.id);
  const near = ch => nodes.filter(n => Math.abs(n.chapter - ch) <= 1).map(n => n.id);
  const everyone = nodes.map(n => n.id);
  function distract(correct, ban, tiers) {
    const out = [], seen = new Set([correct, ...ban]);
    for (const [list, cap] of tiers) {
      let took = 0;
      for (const id of shuffle(list)) {
        if (out.length >= 3 || took >= cap) break;
        if (seen.has(id) || !usable(byId.get(id))) continue;
        seen.add(id); out.push(id); took++;
      }
    }
    return out.length === 3 ? out : null;
  }

  function build(n, type) {
    let prompt, quote = null, correct, blame, ds, explain, noteFor;
    if (type === 'def') {
      correct = n.id; blame = n.id;
      prompt = '이 문제를 해결하려고 나온 개념은?';
      quote = maskTerms(n.why, titleTerms(n.title));
      ds = distract(correct, [], [[inChapters([n.chapter]), 3], [near(n.chapter), 3], [everyone, 3]]);
      explain = `「${n.title}」 ${n.why}. 핵심: ${cut(n.core, 110)}`;
      noteFor = id => `고른 「${T(id)}」${eunNeun(T(id))} 이 문제를 풀려고 나왔어요: ${byId.get(id).why}`;
    } else if (type === 'core') {
      correct = n.id; blame = n.id;
      prompt = '이 설명에 해당하는 개념은?';
      quote = cut(maskTerms(n.core, titleTerms(n.title)), 170);
      ds = distract(correct, [], [[inChapters([n.chapter]), 3], [near(n.chapter), 3], [everyone, 3]]);
      explain = `「${n.title}」 — ${cut(n.core, 140)}. 왜 생겼나: ${n.why}`;
      noteFor = id => `고른 「${T(id)}」${eunNeun(T(id))} 이런 개념이에요: ${cut(byId.get(id).core, 90)}`;
    } else if (type === 'pre') {
      const cand = okIds(n.prereq);
      correct = cand[Math.floor(rand() * cand.length)]; blame = n.id;
      prompt = `「${n.title}」 — 이걸 이해하려면 바로 앞에서 알아야 하는 개념은?`;
      ds = distract(correct, [...anc(n.id), n.id], [[[...desc(n.id)], 1], [inChapters([n.chapter, chapterOf(correct)]), 3], [near(n.chapter), 3], [everyone, 3]]);
      explain = `「${n.title}」의 바로 앞 개념: ${okIds(n.prereq).map(T).join(' · ')}.`;
      noteFor = id => (desc(n.id).has(id) ? `고른 「${T(id)}」${eunNeun(T(id))} 「${n.title}」 다음에 배우는 쪽이에요. 방향이 반대예요.` : `고른 「${T(id)}」${eunNeun(T(id))} 「${n.title}」의 선행 개념이 아니에요.`);
    } else {
      const cand = okIds(n.next);
      correct = cand[Math.floor(rand() * cand.length)]; blame = correct;
      prompt = `「${n.title}」 — 이걸 알고 나면 바로 이어서 배울 수 있는 개념은?`;
      ds = distract(correct, [...desc(n.id), n.id], [[[...anc(n.id)], 1], [inChapters([n.chapter, chapterOf(correct)]), 3], [near(n.chapter), 3], [everyone, 3]]);
      explain = `「${n.title}」에서 바로 열리는 개념: ${okIds(n.next).map(T).join(' · ')}.`;
      noteFor = id => (anc(n.id).has(id) ? `고른 「${T(id)}」${eunNeun(T(id))} 「${n.title}」보다 먼저 배우는 쪽이에요. 방향이 반대예요.` : `고른 「${T(id)}」${eunNeun(T(id))} 「${n.title}」에서 바로 열리지 않아요.`);
    }
    if (!ds) return null;
    const ids = shuffle([correct, ...ds]);
    return {
      type, type_label: QUIZ_TYPES[type], prompt, quote,
      options: ids.map((id, k) => ({ letter: LETTERS[k], id, title: T(id), note: id === correct ? '' : noteFor(id) })),
      answer: ids.indexOf(correct), answer_id: correct, blame, explain,
    };
  }

  // 슬롯마다 그 유형을 낼 수 있는 개념을 찾는다. 오답 보기가 모자라면(뿌리 개념의 "다음 찾기" 등) 다른 유형으로 바꾼다.
  const left = pool.slice(), questions = [];
  for (const want of plan) {
    let q = null;
    while (!q && left.length) {
      let k = left.findIndex(n => can(n, want));
      if (k < 0) k = 0;
      const n = left.splice(k, 1)[0];
      for (const t of [want, 'def', 'pre', 'next']) { if (can(n, t) && (q = build(n, t))) break; }
    }
    if (!q) break;
    questions.push({ no: questions.length + 1, ...q });
  }
  const custom = Array.isArray(opts.ids) && opts.ids.length > 0;
  return { seed, scope: custom ? 'custom' : scope, scope_label: custom ? '고른 개념' : S.label, questions };
}

// 학생 답(0~3, null = 건너뜀)을 채점한다. 틀린 문제의 blame 개념이 진단의 입력이 된다.
export function gradeQuiz(quiz, picks) {
  const results = quiz.questions.map((q, i) => {
    const p = picks[i];
    const chosen = p == null || !q.options[p] ? null : q.options[p];
    return { no: q.no, type: q.type, correct: p === q.answer, chosen, answer: q.options[q.answer], blame: q.blame, note: chosen ? chosen.note : '', explain: q.explain };
  });
  const wrong = results.filter(r => !r.correct);
  return { score: results.length - wrong.length, total: results.length, results, wrong_concepts: [...new Set(wrong.map(r => r.blame))].sort((a, b) => a - b) };
}
