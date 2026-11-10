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
    know: { label: '정복', icon: '🚩', rule: () => `이 개념 문제를 ${need()}번 연속 맞혔어요` },
    half: { label: '모험 중', icon: '🧭', rule: () => `맞히는 중이에요. ${need()}번 연속 맞히면 정복이에요` },
    unknown: { label: '정복 실패', icon: '💥', rule: () => '마지막 문제를 틀렸어요. 다시 도전하면 돼요' },
    none: { label: '미지의 영역', icon: '🌫️', rule: () => '아직 이 개념 문제를 안 풀었어요' },
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
    next: '지금 할 일',
    status: '개념 정복 현황',
    statusSub: c => `${c.short} 개념 ${c.total}개 중 ${COPY.status.know.icon} 정복 ${c.count.know}개`,
    guide: '어디서부터 공부할까요?',
    guideEmpty: '아직 정복 실패한 개념이 없어요',
    more: '이어서 하면 좋은 것',
    half: '조금만 더 하면 정복',
    due: '다시 점검할 때',
    untested: '아직 안 푼 개념 (중요한 순)',
    next_read: '이어서 읽기',
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
    smart: { title: '오늘의 10문제', desc: '출발점 → 모험 중 → 다시 점검 → 미지의 영역 순으로 알아서 골라요' },
    diag: { title: '진단 12문제', desc: '장마다 한 문제씩 넓게 풀어서 미지의 영역을 빠르게 걷어 내요', first: '처음이면 이것부터. 장마다 한 문제씩 넓게 풀어요' },
    redo: { title: '다시 도전', desc: '정복 실패했거나 아직 모험 중인 개념만 다시 풀어요' },
    review: { title: '다시 점검', desc: '정복했지만 시간이 지나 다시 확인할 때가 된 개념이에요' },
  },

  // 화면 곳곳의 ? 버튼. body(ctx)는 HTML 문자열을 돌려준다
  help: {
    next: {
      title: '지금 할 일은 어떻게 정해요?',
      body: () => `<p>지금 기록을 보고 <b>가장 먼저 할 일 하나</b>만 골라 드려요. 큰 버튼만 누르면 돼요.</p>
        <ol><li>처음이면 <b>${COPY.modes.diag.title}</b></li><li>${tag('start')}${jo(COPY.role.start.label, '이', '가')} 있으면 가장 많은 개념이 같이 풀리는 출발점 정복</li><li>${COPY.due.icon} 다시 점검할 개념</li><li>${s('half')} 마무리</li><li>그 밖엔 <b>${COPY.modes.smart.title}</b></li></ol>
        <p class="hp-note">다른 걸 하고 싶으면 아래 카드나 <b>${COPY.tabs.quiz}</b> 탭에서 골라도 돼요.</p>`,
    },
    status: {
      title: '개념 정복 현황이 뭐예요?',
      body: c => `<p>${c.name} 시험 범위를 <b>개념 ${c.total}개</b>로 나누고, 개념 하나하나를 지도의 땅 한 칸처럼 봐요. 문제를 풀 때마다 그 땅의 상태가 바뀌어요.</p>
        <p class="hp-flow">${s('none')} → ${s('half')} → ${s('know')}</p>
        <ul><li>${s('none')}: 아직 안 풀어 본 개념</li><li>${s('half')}: 맞히는 중 (1/${need()}, 2/${need()}처럼 연속으로 몇 번 맞혔는지 보여 줘요)</li><li>${s('know')}: <b>${need()}번 연속</b> 맞힌 개념</li><li>${s('unknown')}: 마지막에 틀린 개념. 다시 ${need()}번 연속 맞히면 정복</li></ul>
        <p>지금: ${COPY.journey.map(k => `${s(k)} ${c.count[k]}개`).join(' · ')}</p>
        <p class="hp-note">숫자를 누르면 지도에서 그 상태의 개념만 볼 수 있어요. 점수나 확률로 짐작하지 않고, 그 개념 문제를 직접 푼 기록만 봐요.</p>`,
    },
    guide: {
      title: '길잡이는 어떻게 길을 찾아요?',
      body: c => `<p>개념마다 <b>기초 개념</b>(그 개념을 이해하려면 먼저 알아야 하는 개념)이 정해져 있어요. 예를 들어 디코더를 이해하려면 조합회로를 먼저 알아야 해요.</p>
        <p>정복 실패한 개념에서 기초 쪽으로 따라 내려가, <b>기초는 괜찮은데 자기는 정복 실패인 개념</b>을 찾아요. 이게 ${tag('start')}${jo(COPY.role.start.label, '이에요', '예요')}. 출발점부터 정복하면 그 위 개념들이 차례로 풀려요.</p>
        <p>기초에도 정복 실패가 있는 개념은 ${tag('blocked')}${jo(COPY.role.blocked.label, '으로', '로')} 표시해요. 출발점을 정복한 뒤에 다시 풀면 돼요.</p>
        <p><b>${COPY.term.icon} 기초 N개 풀어 보기</b>는 아직 안 물어본 기초 개념을 짧은 문제로 풀어 보는 버튼이에요. 진짜 원인이 더 아래에 있는지 알 수 있어요.</p>
        ${c.count.unknown ? `<p>지금: 정복 실패 ${c.count.unknown}개 → 출발점 ${c.starts}개 · 막힘 ${c.blocked}개</p>` : ''}`,
    },
    roles: {
      title: '출발점과 막힘',
      body: () => `<ul><li>${tag('start')} ${COPY.role.start.tip}</li><li>${tag('blocked')} ${COPY.role.blocked.tip}</li></ul>`,
    },
    probe: {
      title: `${TERM.icon} 원인 찾기가 뭐예요?`,
      body: () => `<p>문제를 틀리면 "그 개념을 몰라서"일 수도 있고 "그 밑의 <b>기초 개념</b>을 몰라서"일 수도 있어요.</p>
        <p>그래서 기초 개념을 짧은 문제로 하나씩 물어봐요. 이게 <b>${COPY.term.icon} 원인 찾기 문제</b>예요.</p>
        <ul><li>맞히면 → 거기는 원인이 아니에요</li><li>틀리면 → 한 칸 더 기초로 내려가요</li><li>기초가 다 괜찮으면 → 틀린 개념을 다른 문제로 한 번 더 물어서 실수였는지 가려요</li></ul>
        <p>끝나면 <b>어디서부터 공부하면 되는지</b>(${tag('start')}) 알려 줘요. 따로 할 건 없어요. 문제만 풀면 돼요.</p>
        <p class="hp-note">한 번에 최대 8문제, 한 판에 3번까지만 해요. 그만두고 싶으면 <b>그만 풀기</b>를 누르세요.</p>`,
    },
    check: {
      title: `${TERM.icon} 원인 찾기 문제`,
      body: () => `<p>방금 틀린 문제의 <b>원인을 찾으려고</b> 앱이 낸 문제예요. 파란 테두리로 표시돼요.</p><p>보통 문제처럼 답만 고르면 돼요. 결과에 따라 앱이 알아서 다음 기초 개념으로 내려가거나 끝내요.</p><p>이 문제도 그 개념 상태에 반영돼요. 맞히면 ${s('half')}, 틀리면 ${sj('unknown', '이', '가')} 돼요.</p>`,
    },
    recent: {
      title: '최근 푼 문제 보는 법',
      body: () => `<ul><li><b class="ap-okc">✓</b> 맞힘 · <b class="ap-noc">✗</b> 틀림</li><li><span class="ap-badge chk">${COPY.term.icon} 원인 찾기</span>: 틀린 문제의 원인을 찾으려고 앱이 낸 기초 개념 문제</li></ul><p>줄을 누르면 그 개념의 지금 상태와 할 일(정복하기·강의)이 나와요.</p>`,
    },
    change: {
      title: '개념 상태 변화',
      body: () => `<p>방금 문제로 그 개념의 상태가 어떻게 바뀌었는지 보여 줘요.</p><p>${s('half')} 옆의 <b>1/${need()}</b>는 연속으로 몇 번 맞혔는지예요. ${need()}/${need()}이 되면 ${sj('know', '이에요', '예요')}.</p>`,
    },
    qc: {
      title: '묻는 개념',
      body: () => '<p>이 문제를 맞히거나 틀리면 여기 적힌 개념의 상태가 바뀌어요. 개념 이름을 누르면 지도에서 그 개념을 볼 수 있어요.</p>',
    },
    stars: {
      title: '★ 중요도',
      body: () => '<p>시험 중요도예요. <b>★5</b>가 가장 자주 나오는 핵심 개념이에요.</p><p class="hp-note">교재와 공식 예시 문제를 보고 정한 추정치예요.</p>',
    },
    basis: {
      title: '판단 근거',
      body: () => `<p>왜 이 상태인지 보여 줘요. <b>최근 기록</b>은 이 개념 문제를 푼 결과를 오래된 것부터 늘어놓은 거예요 (✓ 맞힘, ✗ 틀림).</p>`,
    },
    lineage: {
      title: '기초 개념 그림 읽는 법',
      body: () => `<p>위에 있을수록 먼저 알아야 하는 개념이에요. 화살표는 "위 개념을 알아야 → 아래 개념을 이해할 수 있다"는 뜻이에요.</p>
        <ul><li>굵은 테두리: 지금 보고 있는 개념</li><li>점선 테두리: ${tag('start')}</li><li>빨간 선: 정복 실패끼리 이어진 길</li></ul><p>칸을 누르면 그 개념으로 이동해요. 그림이 넓으면 옆으로 밀어서 보세요.</p>`,
    },
    review: {
      title: '다시 점검',
      body: () => `<p>정복한 개념도 시간이 지나면 잊어요. 정복한 뒤 <b>${days()}</b> 간격으로 다시 풀 때가 됐다고 알려 줘요. 연속으로 맞힐수록 간격이 길어져요.</p>`,
    },
    modes: {
      title: '어떤 걸 풀까요?',
      body: () => `<ul>${['smart', 'diag', 'redo', 'review'].map(k => `<li><b>${COPY.modes[k].title}</b>: ${COPY.modes[k].desc}</li>`).join('')}</ul><p class="hp-note">고민되면 <b>${COPY.modes.smart.title}</b>. 알아서 골라 줘요.</p>`,
    },
    map: {
      title: '개념 정복 지도 보는 법',
      body: c => `<p>${c.name}의 개념 ${c.total}개를 장별로 늘어놓은 지도예요. 칸마다 지금 상태가 적혀 있어요.</p><p>위의 버튼으로 상태별로 걸러 볼 수 있어요. 칸을 누르면 판단 근거, 먼저 알아야 할 개념, 할 일 버튼이 나와요.</p>`,
    },
    lessons: {
      title: '스토리 강의',
      body: () => '<p>장면 하나에 개념 하나씩, 이야기로 설명해요. 다 읽었으면 장면 끝의 <b>다 읽었어요</b>를 누르고, 그 장면 문제나 <b>개념 정복하기</b>로 정복해 보세요.</p><p class="hp-note">강의 안에서는 <b>안 읽은 장면으로</b> 버튼으로 읽던 곳부터 이어서 볼 수 있어요.</p>',
    },
    storage: {
      title: '기록은 어디에 저장돼요?',
      body: () => `<p><b>Claude 안에서 열면</b> Claude 계정에 저장돼요. 다른 기기에서도 이어서 할 수 있어요.</p>
        <p><b>웹으로 열면</b> 이 브라우저에만 저장돼요. 이럴 때 지워질 수 있어요:</p>
        <ul><li>브라우저의 방문 기록·사이트 데이터 삭제</li><li>시크릿 창을 닫을 때</li><li>아이폰 사파리에서 7일 넘게 안 열었을 때 (홈 화면에 추가해서 쓰면 괜찮아요)</li></ul>
        <p class="hp-note">답은 채점하는 순간 바로 저장돼요. 풀던 판의 위치만 새로고침하면 사라져요.</p>`,
    },
    about: {
      title: '도움이 필요하세요?',
      body: c => `<p>${COPY.app.tagline}예요.</p><p>화면 곳곳의 <b>?</b> 버튼을 누르면 그 부분 설명이 나와요. 기록 저장·지우기와 단축키는 <b>${COPY.tabs.today}</b> 맨 아래 <b>${COPY.titles.settings}</b>에 있어요.</p><div class="hp-actions"><button class="ap-btn sm pri" data-tour-start="1">둘러보기 다시 보기</button></div>`,
    },
  },

  // 처음 방문 질문
  welcome: {
    title: '개념 정복 지도에 오신 걸 환영해요',
    body: c => `<p>시험 범위를 <b>개념 ${c.total}개의 땅</b>으로 나누고, 문제를 풀면서 한 칸씩 정복하는 학습 도구예요.</p><p>틀리면 어디서부터 막혔는지 찾아서 <b>공부 순서</b>를 알려 줘요.</p>`,
    question: '여기 처음 오셨나요?',
    yes: '처음이에요 · 1분 둘러보기',
    no: '써 본 적 있어요 · 바로 시작',
    foot: '둘러보기는 오른쪽 위 ? 버튼에서 언제든 다시 볼 수 있어요.',
  },

  // 둘러보기(튜토리얼) 단계. view = 그 단계에서 보여 줄 화면, target = 비출 요소(data-tour 값)
  tour: [
    { view: 'today', target: 'subject', title: '과목 고르기', body: () => '통합컴퓨터시스템(통컴시)과 알고리즘을 따로 정복해요. 기록도 과목마다 따로 쌓여요.' },
    { view: 'today', target: 'tabs', title: '화면은 4개예요', body: () => `<b>${COPY.tabs.today}</b> 지금 할 일 · <b>${COPY.tabs.quiz}</b> 문제 풀기 · <b>${COPY.tabs.lec}</b> 스토리 강의 · <b>${COPY.tabs.map}</b> 모든 개념의 정복 상태` },
    { view: 'today', target: 'start', title: '지금 할 일', body: () => '기록을 보고 지금 제일 먼저 할 일을 <b>하나만</b> 골라 줘요. 고민 말고 큰 버튼만 누르면 돼요.' },
    { view: 'today', target: 'guide', title: '어디서부터 공부할지 알려 줘요', body: () => `틀린 개념이 생기면 기초 개념을 따라 내려가서 ${tag('start')}${jo(COPY.role.start.label, '을', '를')} 찾아 여기에 늘어놓아요. 위에서부터 <b>정복하기</b>를 누르면 돼요.` },
    { view: 'today', target: 'status', title: '개념 정복 현황', body: () => `개념 하나하나가 지도의 땅이에요. 처음엔 모두 ${sj('none', '이에요', '예요')}.<br>문제를 맞히면 ${s('half')}, <b>${need()}번 연속</b> 맞히면 ${s('know')}! 틀리면 ${sj('unknown', '이', '가')} 되고 다시 도전하면 돼요.` },
    { view: 'quiz', target: 'modes', title: '문제 고르는 방법', body: () => `고민되면 <b>${COPY.modes.smart.title}</b>. 알아서 골라 줘요.<br>틀리면 <b>${COPY.term.icon} 원인 찾기</b>가 시작돼요. 기초 개념을 짧은 문제로 물어서 어디서부터 막혔는지 찾아 줘요. 답만 고르면 돼요.` },
    { view: 'map', target: 'filter', title: '개념 정복 지도', body: () => '모든 개념이 장별로 칸에 담겨 있어요. 버튼으로 정복 실패, 출발점, 모험 중만 골라 볼 수 있어요.' },
    { view: 'map', target: 'tile', title: '칸 하나 = 개념 하나', body: () => '칸을 누르면 그 개념 창이 열려요(폰은 아래에서 올라와요). <b>왜 이 상태인지</b>, <b>먼저 알아야 할 개념</b>, 그리고 <b>정복하기·강의</b> 버튼이 있어요.' },
    { view: 'lec', target: 'lessons', title: '스토리 강의', body: () => '장면 하나에 개념 하나씩 이야기로 설명해요. 읽고 나서 장면 끝 버튼으로 바로 정복해 보세요.' },
    { view: 'today', target: 'help', title: '막히면 ? 버튼을 누르세요', body: () => '화면 곳곳의 <b>?</b> 버튼을 누르면 그 부분 설명이 나와요. 이 둘러보기도 여기서 다시 볼 수 있어요.', last: true },
  ],
  tourNav: { prev: '이전', next: '다음', skip: '건너뛰기', done: '진단 12문제로 시작', close: '닫기' },

  // 처음 한 번만 저절로 뜨는 도움말 (help 키)
  firstTips: { feedback: 'change', probe: 'probe', check: 'check' },

  ai: {
    tutor: () => `너는 독학사 컴퓨터공학 1:1 과외 선생이야. 학생은 자바를 쓰는 초급 개발자야. 학생에게는 다정한 존댓말(해요체)로, 짧고 쉽게, 옛날 방식의 문제 → 그래서 나온 개념 흐름으로 설명해. 아래 자료에 없는 사실은 지어내지 마. 모르면 모른다고 해. 학생의 개념 상태는 정복(${need()}번 연속 맞힘)·모험 중(맞히는 중)·정복 실패(마지막에 틀림)·미지의 영역(안 풀어 봄)으로 표시돼. 확률이나 퍼센트로 말하지 마.`,
  },

  foot: c => `상태는 그 개념 문제를 직접 푼 기록으로만 정해요 · ${need()}번 연속 맞히면 ${COPY.status.know.icon} ${COPY.status.know.label}`,
};

// 문구 안에서 쓰는 작은 조각 (상태 이름을 바꿔도 조사가 맞게: sj('unknown', '이', '가') → "💥 정복 실패가")
function jo(w, a, b) { const ch = String(w).slice(-1), c = ch.charCodeAt(0); return (c >= 0xAC00 && c <= 0xD7A3 ? (c - 0xAC00) % 28 : /[136780lmnrLMNR]/.test(ch)) ? a : b; }
function sj(k, a, b) { return s(k) + jo(COPY.status[k].label, a, b); }
function s(k) { const x = COPY.status[k]; return `<span class="ap-st s-${k}">${x.icon} ${x.label}</span>`; }
function tag(r) { return `<span class="ap-role${r === 'start' ? ' start' : ''}">${COPY.role[r].label}</span>`; }
