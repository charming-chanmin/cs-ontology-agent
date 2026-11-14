// 화면 문구 사전 — 상태 이름, 카드 제목, 도움말(?), 둘러보기(튜토리얼) 문구를 전부 여기 모아 둔다.
// 이름이나 설명을 바꾸려면 이 파일만 고치면 된다. 숫자 규칙(몇 번 연속이면 정복인지 등)은 coach.js의 RULES를 읽어서 쓴다.
// 문구는 해요체. 함수로 된 항목은 지금 숫자(개수·과목 이름 등)를 ctx로 받아 문장을 만든다.
//   ctx = { name: '통합컴퓨터시스템', short: '통컴시', total, count: {know, half, unknown, none}, starts, blocked, due }
// 자세한 구조는 SPEC.md "화면 문구" 절 참고.
import { RULES } from './coach.js';

const need = () => RULES.need;
const days = () => RULES.reviewDays.join('일 → ') + '일';

// 화면 곳곳에서 같은 뜻으로 쓰는 낱말
//   pre   = 선행 개념(그 개념을 이해하려면 먼저 알아야 하는 개념)
//   probe = 틀린 원인을 찾으려고 기초 개념을 짧은 문제로 물어보는 과정, 그 문제
const TERM = { pre: '기초 개념', probe: '원인 찾기', icon: '🔍' };

export const COPY = {
  app: {
    title: '개념 정복 지도',
    eyebrow: 'Ontology Learning Coach',
    tagline: '시험 범위를 개념 하나하나의 땅으로 나누고, 문제를 풀어 한 칸씩 정복하는 학습 코치',
  },
  tabs: { today: '길잡이', quiz: '문제', lec: '강의', map: '지도' },

  // 화면 곳곳에서 같은 뜻으로 쓰는 낱말 (위의 TERM 한 곳에서만 바꾸면 된다)
  term: TERM,

  // 개념 상태 4가지 (키는 coach.js와 같다: know · half · unknown · none)
  status: {
    know: { label: '정복', icon: '🚩', rule: () => `문제를 ${need()}번 연속 맞힌 개념` },
    half: { label: '모험 중', icon: '🧭', rule: () => `가장 최근 문제를 맞혔고, ${need()}번 연속까지 가는 중인 개념` },
    unknown: { label: '정복 실패', icon: '💥', rule: () => `가장 최근에 푼 문제를 틀린 개념. 다시 ${need()}번 연속 맞히면 정복` },
    none: { label: '미지의 영역', icon: '🌫️', rule: () => '아직 문제를 한 번도 풀지 않은 개념' },
  },
  // 상태를 보여 주는 순서: 여정 순서(미지 → 모험 → 정복) + 실패
  journey: ['none', 'half', 'know', 'unknown'],
  // 정복 실패 개념의 역할 (길잡이)
  role: {
    start: { label: '출발점', tip: '정복 실패인데 기초 개념(먼저 알아야 할 개념)은 괜찮아요. 여기부터 공부하면 돼요' },
    blocked: { label: '막힘', tip: '기초 개념도 정복 실패예요. 기초(출발점)부터 정복하면 같이 풀려요' },
  },
  due: { label: '다시 점검', icon: '⏳' },

  titles: {
    next: '다음 목적지',
    status: '개념 정복 현황',
    statusSub: c => `${c.name} 전체 개념 ${c.total}개 중`,
    course: '추천 정복 코스',
    courseSub: '다음 목적지 말고도 골라 갈 수 있는 곳이에요',
    flow: '공부는 이렇게 흘러가요',
    starts: '출발점 · 정복 실패의 뿌리',
    half: '진행 중인 모험',
    due: '다시 점검할 때',
    untested: '아직 안 가 본 곳 (★ 높은 순)',
    next_read: '이어서 읽을 강의',
    recent: '최근 푼 문제',
    settings: '기록 · 설정',
    coach: 'AI 코치',
    quizHome: '문제 풀기',
    map: '개념 정복 지도',
    lec: '스토리 강의',
    panelBasis: '판단 근거',
    panelHist: '최근 기록',
    panelPre: '먼저 알아야 할 것 (기초 개념)',
    panelNext: '이걸 알면 배울 것',
    lineage: '기초 개념 그림',
    change: '개념 상태 변화',
    qc: '묻는 개념',
  },

  modes: {
    smart: { title: '오늘의 10문제', desc: '출발점 → 모험 중 → 다시 점검 → 미지의 영역 순으로 골라 섞어 줘요' },
    diag: { title: '진단 12문제', desc: '장마다 한 문제씩 넓게 풀어서 미지의 영역을 빠르게 걷어 내요', first: '처음이면 이것부터. 장마다 한 문제씩 넓게 풀어요' },
    redo: { title: '다시 도전', desc: '정복 실패했거나 아직 모험 중인 개념만 다시 풀어요' },
    review: { title: '다시 점검', desc: '정복했지만 시간이 지나 다시 확인할 때가 된 개념이에요' },
  },

  // 화면 곳곳의 ? 버튼. body(ctx)는 HTML 문자열을 돌려준다
  help: {
    next: {
      title: '다음 목적지는 어떻게 골라요?',
      body: () => `<p>지도 상태를 보고 지금 가장 먼저 가면 좋은 곳 하나를 골라요.</p>
        <ol><li>문제를 한 번도 안 풀었으면 → <b>${COPY.modes.diag.title}</b></li><li>${tag('start')}${jo(COPY.role.start.label, '이', '가')} 있으면 → 정복했을 때 같이 풀리는 개념이 가장 많은 출발점</li><li>정복한 지 오래된 개념이 있으면 → ${COPY.due.icon} 다시 점검</li><li>${s('half')}인 개념이 있으면 → 모험 이어가기</li><li>그 밖에는 → ${s('none')} 탐험</li></ol>
        <p class="hp-note">아래 <b>추천 정복 코스</b>에서 다른 곳을 골라도 돼요.</p>`,
    },
    status: {
      title: '개념 정복 현황 보는 법',
      body: c => `<p>${c.name} 시험 범위를 개념 ${c.total}개로 나눴어요. 개념마다 문제를 푼 기록으로 상태가 정해져요.</p>
        <ul>${COPY.journey.map(k => `<li>${s(k)}: ${COPY.status[k].rule()}</li>`).join('')}</ul>
        <p><b>예시</b> · 한 개념의 문제를 푼 순서대로 (✓ 맞힘 · ✗ 틀림)</p>
        <ul><li>✓ ✓ ✓ → ${s('know')}</li><li>✗ ✓ ✓ → ${s('half')} 2/${need()}: 첫 문제는 틀렸지만 다음 2문제를 연속으로 맞혔어요</li><li>✓ ✓ ✗ → ${s('unknown')}: 앞의 2문제는 맞혔지만 가장 최근 문제를 틀렸어요</li></ul>
        <p class="hp-note">점수나 확률로 짐작하지 않아요. 숫자 칸을 누르면 지도에서 그 상태의 개념만 볼 수 있어요.</p>`,
    },
    guide: {
      title: '추천 정복 코스는 어떻게 골라요?',
      body: c => `<p>개념마다 <b>기초 개념</b>(먼저 알아야 하는 개념)이 정해져 있어요. 예를 들어 「디코더」를 이해하려면 「조합회로」를 먼저 알아야 해요.</p>
        <p>정복 실패한 개념에서 기초 개념 쪽으로 따라 내려가면, 기초 개념은 괜찮은데 자기는 정복 실패인 개념이 나와요. 그 개념이 ${tag('start')}${jo(COPY.role.start.label, '이에요', '예요')}. 출발점을 정복하면 출발점 위에 쌓인 개념도 차례로 풀려요.</p>
        <p>기초 개념에도 정복 실패가 있는 개념은 ${tag('blocked')}${jo(COPY.role.blocked.label, '이에요', '예요')}. 출발점을 먼저 정복하면 돼요.</p>
        <p><b>${TERM.icon} 기초 N개 풀어 보기</b>: 아직 안 풀어 본 기초 개념을 짧은 문제로 풀어서, 진짜 원인이 더 아래에 있는지 확인해요.</p>
        ${c.count.unknown ? `<p>지금: 정복 실패 ${c.count.unknown}개 → 출발점 ${c.starts}개 · 막힘 ${c.blocked}개</p>` : ''}`,
    },
    roles: {
      title: '출발점과 막힘',
      body: () => `<ul><li>${tag('start')} ${COPY.role.start.tip}</li><li>${tag('blocked')} ${COPY.role.blocked.tip}</li></ul>`,
    },
    probe: {
      title: `${TERM.icon} 원인 찾기가 뭐예요?`,
      body: () => `<p>문제를 틀린 이유는 두 가지 중 하나예요. 그 개념 자체를 몰라서, 또는 그 개념의 <b>기초 개념</b>을 몰라서.</p>
        <p>그래서 틀린 개념의 기초 개념을 짧은 문제로 하나씩 물어봐요. 이 문제가 <b>${TERM.icon} 원인 찾기 문제</b>예요.</p>
        <ul><li>원인 찾기 문제를 맞히면 → 그 기초 개념은 원인이 아니에요</li><li>원인 찾기 문제를 틀리면 → 그 기초 개념의 기초 개념을 이어서 물어봐요</li><li>기초 개념이 다 괜찮으면 → 처음 틀린 개념을 다른 문제로 한 번 더 물어서 실수였는지 가려요</li></ul>
        <p>원인 찾기가 끝나면 어디서부터 공부하면 되는지(${tag('start')}) 알려 줘요. 따로 할 건 없고 문제만 풀면 돼요.</p>
        <p class="hp-note">한 번에 최대 8문제, 한 판에 3번까지만 해요.</p>`,
    },
    check: {
      title: `${TERM.icon} 원인 찾기 문제`,
      body: () => `<p>방금 틀린 문제의 원인을 찾으려고 낸 문제예요. 파란 테두리로 표시돼요.</p><p>보통 문제처럼 답만 고르면 돼요. 결과에 따라 다음 원인 찾기 문제가 나오거나 원인 찾기가 끝나요.</p><p>원인 찾기 문제도 그 개념 상태에 반영돼요. 맞히면 ${s('half')}, 틀리면 ${sj('unknown', '이', '가')} 돼요.</p>`,
    },
    recent: {
      title: '최근 푼 문제 보는 법',
      body: () => `<ul><li><b class="ap-okc">✓</b> 맞힘 · <b class="ap-noc">✗</b> 틀림</li><li><span class="ap-badge chk">${TERM.icon} 원인 찾기</span>: 틀린 문제의 원인을 찾으려고 낸 기초 개념 문제</li></ul><p>줄을 누르면 그 개념의 상태와 정복하기 버튼이 있는 개념 창이 열려요.</p>`,
    },
    change: {
      title: '개념 상태 변화',
      body: () => `<p>방금 푼 문제로 개념 상태가 어떻게 바뀌었는지 보여 줘요.</p><p>${s('half')} 옆의 <b>1/${need()}</b>, <b>2/${need()}</b>는 연속으로 맞힌 횟수예요. ${need()}/${need()}이 되면 ${sj('know', '이에요', '예요')}.</p>`,
    },
    qc: {
      title: '묻는 개념',
      body: () => '<p>문제를 맞히거나 틀리면 「묻는 개념」에 적힌 개념들의 상태가 바뀌어요.</p>',
    },
    stars: {
      title: '★ 중요도',
      body: () => '<p>시험 중요도예요. <b>★5</b>가 가장 자주 나오는 핵심 개념이에요.</p><p class="hp-note">교재와 공식 예시 문제를 보고 정한 추정치예요.</p>',
    },
    basis: {
      title: '판단 근거',
      body: () => `<p>개념 상태가 정해진 이유예요. <b>최근 기록</b>은 개념 문제를 푼 결과를 먼저 푼 것부터 늘어놓았어요 (✓ 맞힘, ✗ 틀림).</p>`,
    },
    lineage: {
      title: '기초 개념 그림 읽는 법',
      body: () => `<p>위에 있는 개념일수록 먼저 알아야 하는 개념이에요. 화살표는 "위 개념을 알아야 → 아래 개념을 이해할 수 있다"는 뜻이에요.</p>
        <ul><li>굵은 테두리: 지금 보고 있는 개념</li><li>점선 테두리: ${tag('start')}</li><li>빨간 선: 정복 실패한 개념끼리 이어진 길</li></ul><p class="hp-note">그림이 넓으면 옆으로 밀어서 보세요.</p>`,
    },
    review: {
      title: '다시 점검',
      body: () => `<p>정복한 개념도 시간이 지나면 잊어요. 정복하고 <b>${days()}</b>이 지날 때마다 다시 풀 때가 됐다고 알려 줘요.</p><p>다시 점검 문제를 맞히면 ${s('know')}이 유지되고 다음 점검까지 기간이 길어져요.</p>`,
    },
    modes: {
      title: '어떤 걸 풀까요?',
      body: () => `<ul>${['smart', 'diag', 'redo', 'review'].map(k => `<li><b>${COPY.modes[k].title}</b>: ${COPY.modes[k].desc}</li>`).join('')}</ul><p class="hp-note">고르기 어려우면 <b>${COPY.modes.smart.title}</b>를 누르세요.</p>`,
    },
    map: {
      title: '개념 정복 지도 보는 법',
      body: c => `<p>${c.name} 개념 ${c.total}개를 장별 칸으로 나눈 지도예요. 칸 색과 글자가 개념 상태예요.</p><p>위쪽 버튼으로 정복 실패, 출발점, 모험 중 같은 상태만 골라 볼 수 있어요.</p>`,
    },
    lessons: {
      title: '스토리 강의',
      body: () => '<p>강의마다 개념 하나에 이야기 장면 하나씩 구성했어요.</p><p class="hp-note">강의 목록의 막대는 읽은 장면 수예요.</p>',
    },
    storage: {
      title: '기록은 어디에 저장돼요?',
      body: () => `<p><b>Claude 안에서 열면</b> Claude 계정에 저장돼요. 다른 기기에서도 이어서 할 수 있어요.</p>
        <p><b>웹으로 열면</b> 지금 쓰는 브라우저에만 저장돼요. 이럴 때 지워질 수 있어요:</p>
        <ul><li>브라우저의 방문 기록·사이트 데이터 삭제</li><li>시크릿 창을 닫을 때</li><li>아이폰 사파리에서 7일 넘게 안 열었을 때 (홈 화면에 추가해서 쓰면 괜찮아요)</li></ul>
        <p class="hp-note">답은 채점하는 순간 바로 저장돼요. 새로고침하면 풀던 판의 진행 위치만 사라져요.</p>`,
    },
  },

  // 처음 방문 질문
  welcome: {
    title: '개념 정복 지도에 오신 걸 환영해요',
    body: c => `<p>시험 범위를 <b>개념 ${c.total}개의 땅</b>으로 나누고, 문제를 풀면서 한 칸씩 정복하는 학습 도구예요.</p><p>틀리면 어디서부터 막혔는지 찾아서 <b>공부 순서</b>를 알려 줘요.</p>`,
    question: '여기 처음 오셨나요?',
    yes: '처음이에요 · 1분 둘러보기',
    no: '써 본 적 있어요 · 바로 시작',
    foot: '튜토리얼은 맨 위 「사용법 튜토리얼」 버튼으로 언제든 다시 볼 수 있어요.',
  },

  // 둘러보기(튜토리얼) 단계. view = 그 단계에서 보여 줄 화면, target = 비출 요소(data-tour 값)
  tour: [
    { view: 'today', target: 'subject', title: '과목 고르기', body: () => '통합컴퓨터시스템(통컴시)과 알고리즘의 기록은 따로 쌓여요.' },
    { view: 'today', target: 'tabs', title: '화면은 4개예요', body: () => `<b>${COPY.tabs.today}</b>: 다음 목적지와 정복 현황<br><b>${COPY.tabs.quiz}</b>: 문제 풀기<br><b>${COPY.tabs.lec}</b>: 스토리 강의<br><b>${COPY.tabs.map}</b>: 개념 전체의 정복 상태` },
    { view: 'today', target: 'start', title: '🧭 다음 목적지', body: () => '지도 상태를 보고, 지금 가장 먼저 가면 좋은 개념 하나를 골라 둬요. 큰 버튼을 누르면 바로 시작해요.' },
    { view: 'today', target: 'status', title: '개념 정복 현황', body: () => `처음엔 모든 개념이 ${sj('none', '이에요', '예요')}.<br>문제를 맞히면 ${s('half')}, 같은 개념을 <b>${need()}번 연속</b> 맞히면 ${s('know')}.<br>틀리면 ${sj('unknown', '이', '가')} 되고, 다시 ${need()}번 연속 맞히면 정복이에요.` },
    { view: 'today', target: 'guide', title: '추천 정복 코스', body: () => `다음 목적지 말고도 골라 갈 수 있는 개념들이에요. 틀린 문제가 생기면 ${tag('start')}(정복 실패의 뿌리)이 맨 위에 나와요.` },
    { view: 'quiz', target: 'modes', title: '문제 고르기', body: () => `고르기 어려우면 <b>${COPY.modes.smart.title}</b>.<br>문제를 틀리면 <b>${TERM.icon} 원인 찾기 문제</b>가 이어서 나와요. 틀린 이유가 기초 개념에 있는지 확인하는 짧은 문제예요.` },
    { view: 'map', target: 'filter', title: '개념 정복 지도', body: () => '개념 전체를 장별 칸으로 나눴어요. 버튼을 누르면 정복 실패, 출발점, 모험 중 같은 상태만 골라 볼 수 있어요.' },
    { view: 'map', target: 'tile', title: '칸 하나 = 개념 하나', body: () => '칸을 누르면 개념 창이 열려요. 상태의 이유, 먼저 알아야 할 기초 개념, 정복하기 버튼이 있어요.' },
    { view: 'lec', target: 'lessons', title: '스토리 강의', body: () => '강의마다 개념 하나에 이야기 장면 하나씩 구성했어요.' },
  ],
  // done: 튜토리얼 마지막 버튼. 아직 푼 문제가 없으면 진단으로 바로 이어 준다
  tourNav: { prev: '이전', next: '다음', skip: '건너뛰기', done: c => c.tried ? '튜토리얼 끝' : '진단 12문제로 시작', close: '닫기' },

  // 처음 한 번만 저절로 뜨는 도움말 (help 키)
  firstTips: { feedback: 'change', probe: 'probe', check: 'check' },

  ai: {
    tutor: () => `너는 독학사 컴퓨터공학 1:1 과외 선생이야. 학생은 자바를 쓰는 초급 개발자야. 학생에게는 다정한 존댓말(해요체)로, 짧고 쉽게, 옛날 방식의 문제 → 그래서 나온 개념 흐름으로 설명해. 아래 자료에 없는 사실은 지어내지 마. 모르면 모른다고 해. 학생의 개념 상태는 정복(${need()}번 연속 맞힘)·모험 중(맞히는 중)·정복 실패(가장 최근 문제를 틀림)·미지의 영역(안 풀어 봄)으로 표시돼. 확률이나 퍼센트로 말하지 마.`,
  },

  foot: c => `상태는 그 개념 문제를 직접 푼 기록으로만 정해요 · ${need()}번 연속 맞히면 ${COPY.status.know.icon} ${COPY.status.know.label}`,
};

// 문구 안에서 쓰는 작은 조각 (상태 이름을 바꿔도 조사가 맞게: sj('unknown', '이', '가') → "💥 정복 실패가")
function jo(w, a, b) { const ch = String(w).slice(-1), c = ch.charCodeAt(0); return (c >= 0xAC00 && c <= 0xD7A3 ? (c - 0xAC00) % 28 : /[136780lmnrLMNR]/.test(ch)) ? a : b; }
function sj(k, a, b) { return s(k) + jo(COPY.status[k].label, a, b); }
function s(k) { const x = COPY.status[k]; return `<span class="ap-st s-${k}">${x.icon} ${x.label}</span>`; }
function tag(r) { return `<span class="ap-role${r === 'start' ? ' start' : ''}">${COPY.role[r].label}</span>`; }
