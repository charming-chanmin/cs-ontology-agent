# 개념 정복 지도 — 구조 명세

이 문서는 학습 코치 웹 앱이 **어떻게 나뉘어 있고, 무엇을 바꾸려면 어디를 고치면 되는지** 적어 둔 명세다.
기능을 더하거나 이름·규칙을 바꿀 때 이 문서부터 본다. 코드를 바꾸면 이 문서도 같이 고친다.

- 버전: 0.7.0 (2026-11-10)
- 결과물: `docs/index.html` (GitHub Pages용 완성 문서) + `dist/artifact.html` (Claude 아티팩트용 조각). 내용은 같고 문서 뼈대만 다르다
- 경로 표기: 이 문서의 경로는 앱 폴더 기준이다. 저장소(cs-ontology-agent)에서는 앱 폴더가 `app/`이고,
  개념 지도 문제 생성기만 MCP 서버와 같이 쓰려고 저장소 루트의 `src/quiz.js`에 있다 (앱 폴더에서는 `src/quizgen.js`).

---

## 1. 한눈에

| 층 | 파일 | 맡는 일 | 모르는 것 |
|---|---|---|---|
| 데이터 | `data/*.json`, `specs/*.json` | 개념·선행 관계·강의·문제, 개념 규격 | 화면, 규칙 |
| 규칙 | `src/coach.js` | 상태 판정, 길잡이, 원인 찾기, 문제 고르기 | 화면에 보이는 이름 |
| 문제 생성 | `src/specgen.js`, `src/calcgen.js`, `src/quizgen.js` | 규격·계산·개념 지도에서 문제 만들기 | 상태 |
| 문구 | `src/copy.js` | 상태 이름·아이콘, 제목, 도움말, 둘러보기 문구 | 화면 배치 |
| 안내 장치 | `src/tour.js` | 처음 방문 질문, 둘러보기, ? 말풍선, 처음 한 번 도움말 | 문구 내용 |
| 화면 | `src/app.js`, `src/app.css`, `src/lecture.css`, `src/template.html` | 그리기, 세션 진행, 저장 | 규칙의 세부 |

원칙
1. **규칙 숫자는 `coach.js`의 `RULES` 한 곳**에만 있다. 문구는 그 값을 읽어서 문장을 만든다.
2. **화면에 보이는 글자는 `copy.js` 한 곳**에 모은다. `app.js`에는 구조와 짧은 연결 문구만 둔다.
3. 상태의 **내부 키(know·half·unknown·none)는 바꾸지 않는다.** 이름은 `copy.js`에서만 바꾼다.
4. 확률·점수로 짐작하지 않는다. 상태는 그 개념 문제를 **직접 푼 기록**으로만 정한다.
5. **공부할 때 화면 이해에 머리 쓰지 않게** (0.7 편의성 원칙)
   - 화면마다 지금 누를 버튼은 하나가 가장 크다 (길잡이: 지금 할 일 / 문제: 다음 / 개념 창: 정복하기).
   - 같은 뜻은 같은 낱말로 (`COPY.term`). 만든 사람만 아는 표시(생성기 이름, 개념 번호, 원고 메타)는 안 보인다.
   - 손이 덜 가게: 답하면 결과로 자동 스크롤, 다음 버튼은 화면 아래 고정, 다른 화면에 다녀와도 「풀던 문제로」, 지도는 보던 자리 유지.
   - 낯선 것엔 바로 옆에 **?** 를 단다. 설명은 그 자리에서 끝낸다.

---

## 2. 폴더와 빌드

```
build.py              조립: template.html의 자리표시를 각 파일로 채워 docs/index.html(완성 문서)과 dist/artifact.html(조각)을 만든다
src/template.html     뼈대 (header·nav·main·footer + 자리표시)
src/app.css           화면 모양 (상태 색 변수 --st-*, 카드, 도움말 말풍선 .hp-*, 둘러보기 .tour-*)
src/lecture.css       강의 본문 모양
src/coach.js          규칙 엔진 (ES 모듈, 테스트가 그대로 import)
src/quizgen.js        개념 지도 문제 생성기 (def·core·pre·next)
src/specgen.js        개념 규격 → 문제 생성기
src/calcgen.js        계산 문제 생성기 (29유형)
src/copy.js           화면 문구 사전 → COPY
src/tour.js           안내 장치 → GUIDE
src/app.js            화면·세션·저장
data/tcs.json         통합컴퓨터시스템: 개념 145(+범위 밖 2)·강의·장면·강의 문제
data/alg.json         알고리즘: 개념 73·강의·장면·강의 문제
specs/tcs.json        개념 규격 54개
specs/alg.json        개념 규격 27개
scripts/build_data.py     원본(source/) → data/*.json
scripts/clean_concepts.py 개념 글 다듬기·교정 (build_data.py가 부른다)
scripts/specs_more.py     규격 추가분 (specs/*.json에 합친다)
test/*.mjs            테스트 (8절)
```

### 조립 순서 (build.py)
| 자리표시 | 채우는 것 | 감싸는 이름 |
|---|---|---|
| `/*__APP_CSS__*/` | `src/app.css` | |
| `/*__LECTURE_CSS__*/` | `src/lecture.css` | |
| `<!--__DATA__-->` | 과목마다 `<script type="application/json" id="d-tcs">` (data + specs) | |
| `/*__COACH__*/` | `src/coach.js` | 전역 함수 |
| `/*__QUIZGEN__*/` | `src/quizgen.js` | 전역 함수 |
| `/*__CALC__*/` | `src/calcgen.js` | `CALC` |
| `/*__SPEC__*/` | `src/specgen.js` | `SPEC` |
| `/*__COPY__*/` | `src/copy.js` | `COPY` |
| `/*__TOUR__*/` | `src/tour.js` | `GUIDE` |
| `/*__APP__*/` | `src/app.js` (`/*__BUILD__*/{}` → 과목 목록) | 전역 |

- 조립할 때 `export `와 `import … ;` 줄은 지운다. 그래서 **모듈끼리 import는 한 줄짜리로만** 쓴다.
- 순서가 중요하다: `copy.js`는 `coach.js`의 `RULES`를, `tour.js`는 `COPY`와 `app.js`의 `helpCtx()`를, `app.js`는 전부를 쓴다.
- 명령: `python3 scripts/build_data.py` (원본이 바뀌었을 때) → `python3 build.py`
- `template.html`은 조각(제목·스타일 + 본문)이다. `build.py`가 GitHub Pages용으로 `<!doctype html>`, `<meta charset>`, **`<meta name="viewport">`** 를 씌워 `docs/index.html`을 만든다 (viewport가 없으면 폰에서 980px 데스크톱 폭으로 작게 보인다). 아티팩트는 뼈대를 직접 씌우므로 조각(`dist/artifact.html`)을 올린다.

---

## 3. 화면

주소: `#/과목/화면/인자` (예: `#/tcs/map/62` = 통컴시 지도에서 62번 개념 패널)

| 화면 키 | 탭 이름(copy) | 내용 (위에서부터) |
|---|---|---|
| `today` | 길잡이 | **지금 할 일**(버튼 하나) → **어디서부터 공부할까요?**(출발점 줄마다 정복하기·강의·🔍 기초 풀어 보기) → **개념 정복 현황**(숫자 4칸, 누르면 지도 필터) → **이어서 하면 좋은 것**(모험 중·다시 점검·안 푼 개념·이어서 읽기) → 최근 푼 문제(누르면 그 개념) → 접힌 **기록 · 설정** |
| `quiz` | 문제 | 문제 고르기(4가지, 추천 표시), 세션 진행, 결과 요약 |
| `lec` | 강의 | 스토리 강의 목록 → 강의(안 읽은 장면으로 버튼) → 장면 |
| `map` | 지도 | 상태 걸러 보기(⏳ 다시 점검 포함), 장별 칸, 개념 창 |

### 3.1 지금 할 일 (`nextAction`)
기록을 보고 하나만 고른다. 순서: 기록 없음 → 진단 12문제 / 출발점 있음 → 가장 많이 풀리는 출발점 정복(강의를 그 뒤로 안 읽었으면 「강의 먼저 보기」가 큰 버튼) / 다시 점검할 개념 / 모험 중 마무리 / 그 밖 → 오늘의 10문제. 큰 버튼이 오늘의 10문제가 아니면 아래에 「또는 오늘의 10문제」를 작게 붙인다.

### 3.2 화면 움직임 규칙
| 상황 | 동작 |
|---|---|
| 다른 탭·과목, 다른 강의로 이동 | 맨 위로 (`hashchange`) |
| 강의 장면 주소(`#/tcs/lec/2-3`) | 그 장면으로 |
| 지도에서 개념만 바꿈 | 보던 자리 그대로 |
| 폰(<900px)에서 개념을 누름 | 아래에서 **개념 창**(`.ap-side.open`)이 올라온다. 뒤는 어둡게(`.ap-sheet-bg`), 뒤 화면 스크롤 잠금(`body.ap-lock`). ×·바깥·Esc로 닫으면 보던 자리 그대로. 창이 열린 채 다른 개념으로 바꾸면 올라오는 움직임 생략(`.stay`) |
| 넓은 화면에서 개념을 누름 | 오른쪽에 붙은 창 (sticky) |
| 답을 고름 | 결과가 화면 아래쪽(62% 밑)에 있으면 결과 머리까지 부드럽게 내려 준다 (`showFeedback`) |
| 결과 화면 | **다음 버튼 줄**(`.ap-actbar`)이 화면 아래에 붙어 있다 (해설을 끝까지 안 내려도 됨) |
| 문제를 풀다 강의·지도·길잡이로 감 | 화면 아래 「← 풀던 문제로 · 제목 n/N」(`#resume`) |

### 3.3 해설 말 바꾸기 (`explOf`)
"옳지 않은 것은?"처럼 부정형 문제(`NEG_Q`)에서 정답이 아닌 보기의 해설이 "맞아."로 시작하면 내 답이 맞았다는 말로 읽힌다. 화면에서는 "맞는 내용이라 답이 아니에요."로, 정답 보기의 "틀렸어."는 "틀린 내용이라 정답이에요."로 바꿔 보여 준다 (데이터는 그대로). 규격 문제는 처음부터 "맞는 설명이에요 / 틀린 설명이에요"(보기 문장이 맞는지)로 쓴다.

세션(문제 풀기 한 판) 종류: `smart` 오늘의 10문제 · `diag` 진단 12문제 · `redo` 다시 도전 · `review` 다시 점검 · `concept` 「X」 정복하기(최대 RULES.need+1문제) · `pre` 「X」 원인 찾기(🔍 기초 풀어 보기 버튼) · `lesson` N강 문제 · `scene` 장면 문제

---

## 4. 상태 규칙 (src/coach.js)

### 4.1 숫자 규칙
```js
export const RULES = {
  need: 3,                     // 정복이 되려면 연속으로 맞혀야 하는 수
  reviewDays: [3, 7, 14, 30],  // 정복 뒤 다시 점검까지 (정복 직후 3일, 한 번 더 맞히면 7일 …)
  recentShapes: 4,             // 개념마다 기억하는 최근 문제 모양 수
};
```
이 값만 바꾸면 판정·화면 설명(“3번 연속”, “1/3”, “3일 → 7일 …”)이 같이 바뀐다.

### 4.2 개념 하나의 상태
| 키 | 화면 이름 (copy) | 조건 |
|---|---|---|
| `none` | 🌫️ 미지의 영역 | 그 개념 문제를 아직 안 풀었다 |
| `half` | 🧭 모험 중 (1/3, 2/3) | 마지막에 맞혔지만 연속 `need`번이 안 됐다 |
| `know` | 🚩 정복 | 연속 `need`번 맞혔다 |
| `unknown` | 💥 정복 실패 | 마지막으로 푼 문제를 틀렸다 |
| (덧붙임) | ⏳ 다시 점검 | `know`인데 마지막으로 맞힌 지 `reviewDays`만큼 지났다 |

- 정복해도 한 번 틀리면 바로 정복 실패. 다시 맞히면 모험 중 1/3부터.
- **여러 개념을 묻는 문제**: 맞히면 전부 반영, 틀리면 **주 개념(첫 번째)만** 정복 실패. 나머지는 원인 찾기에서 따로 확인한다.

### 4.3 길잡이 (온톨로지)
선행 관계 = “B를 이해하려면 A를 먼저 알아야 한다”.
| 역할 | 조건 | 뜻 |
|---|---|---|
| 출발점 `start` | 정복 실패인데 선행 중 정복 실패가 없다 | 여기부터 공부하면 된다 |
| 막힘 `blocked` | 정복 실패인데 선행 중에도 정복 실패가 있다 | 선행(출발점)부터 |

함수: `guide(ix, state)` → `{starts:[{id, unlocks}], blocked}`, `startsOf`, `chainTo(ix, state, from, to)` (출발점 → 목표 공부 순서)

### 4.4 원인 찾기 (probe)
문제를 틀리면 그 개념의 선행 중 **아직 확인 안 된 것**(none·half)을 확인 문제로 하나씩 묻는다.
- 선행을 틀리면 그 선행도 정복 실패 → 한 칸 더 내려간다. 이미 정복 실패인 선행은 묻지 않고 그쪽으로 내려간다.
- 선행을 다 본 뒤, 찾은 뿌리를 **한 번 더 확인**한다 (그 개념을 두 번 연속 틀렸으면 생략).
- 선행이 다 괜찮고 틀린 개념을 다시 맞히면 “실수”로 본다 (출발점 없음).
- 한도: 원인 찾기 한 번에 확인 문제 최대 8개(`MAXPROBE`), 한 판에 최대 3번(`MAXPROBES`). 둘 다 `app.js` 세션 부분.
- 함수: `needsProbe`, `startProbe`, `probeTarget`, `probeResult`, `probeSummary`

### 4.5 문제 모양 돌려쓰기
“3번 연속”이 같은 문제를 외워서 채워지지 않게, 개념마다 최근에 푼 **문제 모양**을 기억한다.
- 모양 = `shapeOf(quiz) = quiz.shape || quiz.tid || quiz.id`
  - 규격 문제: 규격×패턴마다 하나 (`spec-105-fact-true`) — 보기 조합은 낼 때마다 새로 뽑는다
  - 계산 문제: 유형마다 하나 (`calc-fcfs`) — 숫자는 낼 때마다 새로 뽑는다
  - 강의 문제: 문제마다 하나
  - 개념 지도 문제: 유형마다 하나 (`gen-def-tcs-62`, `gen-core-tcs-62`)
- 고를 때: 최근 모양은 점수 ×0.15(`scoreQuiz`), 확인 문제는 최근 모양을 맨 뒤로(`checkQuizFor`).
- 확인 문제가 최근 모양뿐이면 개념 지도 문제(def → core 순)로 바꾼다 (`app.js checkQuestion`).
- 보장: **모든 개념이 서로 다른 모양 3가지 이상**으로 확인될 수 있다 (`test/sim.mjs`가 검사).

### 4.6 문제 고르기
`recommend(ix, state, now)` → 출발점 → 모험 중 → 다시 점검 → 미지의 영역(★ 높은 순) 순서로 필요도를 매기고, `pickQuiz`가 필요도 × 문제 가중치로 고른다. 진단은 `diagnosticPool`(장마다 한 문제).

---

## 5. 저장

### 5.1 학습 기록 (과목마다 하나)
```js
{ v: 2,
  k: { [개념 id]: { n, c, streak, last, lastOk, h: '10110', q: [최근 모양 …] } },  // h = 최근 8번 ✓✗
  attempts: [ { q: 모양, c: [개념 id], ok: 1|0, t: 시각, chk?: 확인 대상, ai?: 1 } ],  // 최근 400개
  read: { '강의-장면': 시각 }, sessions, updated? }
```
- 위치: Claude 안에서 열면 아티팩트 `db`(+`user`) 캡빌리티로 `data/users/<uid>/learn-<과목>` (기기 간 동기화). 아니면 브라우저 `localStorage['lc-<과목>']`. 둘 다 안 되면 메모리.
- 상태는 저장하지 않고 **볼 때마다 `streak`과 `RULES.need`로 계산**한다. 그래서 `need`를 바꾸면 예전 기록에도 바로 적용된다 (예: 2번 연속 맞힌 개념은 need 3에서 모험 중 2/3).
- `migrate(raw)`: 예전 확률 형식(v1)이나 깨진 값은 `attempts`로 `k`를 다시 만든다. v2는 그대로 둔다.

### 5.2 안내 장치 기록 (브라우저마다)
`localStorage['lc-ui'] = { welcomed: 1, toured: 1, tips: { feedback: 1, probe: 1, check: 1 } }`
지우면 처음 방문 질문과 처음 한 번 도움말이 다시 나온다.

---

## 6. 문제 출처

| 출처 | 파일 | 모양 | 비고 |
|---|---|---|---|
| 강의 문제 | `data/*.json quizzes` | 문제마다 | 교재·공식 예시. 객관식·단답·계산 |
| 개념 규격 | `specs/*.json` + `specgen.js` | 규격×패턴 | 81규격 · 394패턴 · 보기 조합 무작위 |
| 계산 | `calcgen.js` | 유형 | 29유형 · 정답은 코드가 계산 |
| 개념 지도 | `quizgen.js` | 유형 | def·core (앱), def·pre·next (MCP 서버) |
| AI | `app.js` (Claude 안에서만) | `ai-…` | sample 캡빌리티 |

### 6.1 개념 지도 문제 유형 (quizgen.js)
| 유형 | 질문 | 지문 |
|---|---|---|
| `def` 개념 맞히기 | 이 문제를 해결하려고 나온 개념은? | 개념의 `why` |
| `core` 설명 맞히기 | 이 설명에 해당하는 개념은? | 개념의 `core` (170자까지) |
| `pre` 선행 찾기 | X를 이해하려면 바로 앞에서 알아야 하는 개념은? | |
| `next` 다음 찾기 | X를 알고 나면 바로 이어서 배울 수 있는 개념은? | |

- 지문 속 개념 이름은 `□□`로 가린다 (`titleTerms`: 제목 전체, ·/+ 로 나눈 조각, 괄호 안, 영문 약어, 띄어 쓴 3글자 이상 낱말).
- 오답 보기는 같은 장 → 가까운 장 → 전체 순으로 고른다.
- 기본 출제 비율(MCP 서버): def 40% · pre 40% · next 20%. `core`는 `opts.type`으로만 낸다.

### 6.2 개념 규격 형식 (specs/*.json)
```js
{ c: 개념 id, also?: [함께 묻는 개념 id], name?: 문제에 쓸 이름,
  facts?:    [{t: 참 문장, why}, {f: 틀린 문장, fix: 고친 문장, why}],
  terms?:    [{term, def, why?, alias?: [다른 이름]}],
  compare?:  {items: [A, B, …], rows: {속성: {A: 값, B: 값}}, why?: {속성: 설명}},
  seq?:      {name, steps: [단계…], why?},
  classify?: {name, groups: {묶음: [원소…]}, ask?: [물어볼 묶음], why?},
  essay?:    [{q, kw: [[핵심어, 같은 뜻…], …], model}] }
```
패턴: fact-true · fact-false · term-def · def-term · term-short · cmp-pick · cmp-false · seq-order · seq-next · cls-odd · essay.
어떤 패턴이 나올 수 있는지는 `patternsOf(spec, ctx)`가 재료 개수로 정한다 (예: fact-false는 참 3개 + 거짓 1개 이상).

---

## 7. 화면 문구 (src/copy.js)

`COPY`의 절
| 키 | 내용 |
|---|---|
| `app` | 앱 제목(개념 정복 지도)·태그라인 |
| `tabs` | 탭 이름 |
| `term` | 화면 전체에서 같은 뜻으로 쓰는 낱말: `pre` 기초 개념(=선행 개념) · `probe` 원인 찾기 · `icon` 🔍. 이 셋만 바꾸면 모든 화면이 따라 바뀐다 |
| `status.{know,half,unknown,none}` | `{label, icon, rule()}` 상태 이름·아이콘·한 줄 규칙 |
| `journey` | 상태를 늘어놓는 순서 (미지 → 모험 → 정복, 실패) |
| `role.{start,blocked}` | 출발점·막힘 이름과 설명 |
| `due` | 다시 점검 이름·아이콘 |
| `titles` | 카드 제목·부제 (함수면 ctx를 받는다). 지금 할 일 `next`, 이어서 하면 좋은 것 `more`, 기록·설정 `settings` 등 |
| `modes` | 문제 고르기 4가지 제목·설명 |
| `help.<키>` | ? 말풍선 `{title, body(ctx) → HTML}` |
| `welcome` | 처음 방문 질문 |
| `tour[]` | 둘러보기 단계 `{view, target, title, body()}` |
| `tourNav` | 둘러보기 버튼 글자 |
| `firstTips` | 처음 한 번만 저절로 뜨는 도움말 `{상황: help 키}` |
| `ai.tutor()` | AI 코치 시스템 프롬프트 |
| `foot(ctx)` | 화면 맨 아래 규칙 한 줄 |

`ctx` (app.js `helpCtx()`): `{ name, short, total, count: {know, half, unknown, none}, starts, blocked, due }`

### 조사
상태 이름은 바뀔 수 있으니 이름 뒤 조사를 글자로 박지 않는다.
- copy.js 안: `jo(낱말, '이', '가')`, `sj('unknown', '이', '가')` → “💥 정복 실패가”
- app.js 안: `SL(k, '이', '가')`(상태 이름 + 조사), `yo(낱말)` → 이에요/예요
- 생성기 안: `josa`(specgen), `eunNeun`(quizgen), `ro`(calcgen)

### 낱말 (헷갈리지 않게 하나로)
| 쓰는 말 | 안 쓰는 말 | 뜻 |
|---|---|---|
| 기초 개념 | 선행, 선행 개념 | 그 개념을 이해하려면 먼저 알아야 하는 개념 |
| 🔍 원인 찾기 (문제) | 확인, 확인 문제, 선행 확인 | 틀린 원인을 찾으려고 기초 개념을 짧은 문제로 물어보는 것 |
| 🔍 기초 N개 풀어 보기 | 선행 N개 확인 | 아직 안 물어본 기초 개념을 원인 찾기로 풀어 보는 버튼 |
| 다시 도전 | 실패·모험 중 다시 | 정복 실패·모험 중 개념만 다시 |
| 다시 점검 | 복습 | 정복 뒤 시간이 지나 다시 풀 때 |
| (안 보임) | 개념 규격 출제, 자동 생성, #번호, 노드·탐색표, Scene | 만든 사람만 아는 표시 |

app.js에서 `TERM`(= `COPY.term`) 뒤 조사는 `PJ('을', '를')`처럼 받침에 맞춰 붙인다.

### 말투
- 화면·도움말·둘러보기·문제 해설: **해요체** (맞는 설명이에요 / 틀린 설명이에요)
- 강의 본문·계산 풀이 단계·개념 데이터(why·core): 과외 선생 **반말** 그대로 (교재 원본 말투)
- AI 코치: 학생에게 해요체

---

## 8. 안내 장치 (src/tour.js → GUIDE)

| 장치 | 언제 | 모양 |
|---|---|---|
| 처음 방문 질문 | 기록이 하나도 없고 `welcomed`가 없을 때 첫 화면에서 | 가운데 카드 + 뒤 흐림. “처음이에요 · 1분 둘러보기” / “써 본 적 있어요 · 바로 시작” |
| 둘러보기 | 처음이에요, 또는 ? 도움말의 “둘러보기 다시 보기” | 대상 둘레 4조각을 반투명+흐림(`backdrop-filter: blur`)으로 덮고, 대상에 빛나는 테두리. 말풍선은 대상 아래(안 되면 위), 화면 안으로 맞춤 |
| ? 말풍선 | `data-help="키"` 버튼을 누를 때 | 버튼 옆 작은 말풍선 + 화살표. 바깥 클릭·Esc로 닫힘 |
| 처음 한 번 도움말 | 첫 피드백·첫 원인 찾기 시작·첫 원인 찾기 문제 | 해당 ? 말풍선이 저절로 한 번 열림 |

API
```js
GUIDE.init({ go, route: () => route, onDone: () => startSession(route.subj, 'diag') })
GUIDE.welcome()           // 처음 방문 질문
GUIDE.startTour()         // 둘러보기 1단계부터
GUIDE.openHelp(key, btn)  // ? 말풍선 (보통은 data-help 위임으로 자동)
GUIDE.closeHelp()
GUIDE.tipOnce(name, scope)  // COPY.firstTips[name]의 도움말을 scope 안 ? 버튼 옆에 한 번만
GUIDE.isOpen()            // 둘러보기·질문이 열려 있나 (열려 있으면 키보드 단축키를 막는다)
GUIDE.flags               // lc-ui 기록
```
- 문서 전체에 클릭 위임: `[data-help]` → 말풍선, `[data-tour-start]` → 둘러보기.
- 키보드: ←/→ 이전·다음, Esc 닫기. 말풍선 `role="dialog"`, ? 버튼 `aria-expanded`. 말풍선은 스크롤(개념 창 안 포함)을 따라간다.
- 앱 단축키(app.js): 문제에서 1~4 보기 고르기, 결과에서 Enter 다음, 지도에서 Esc 개념 창 닫기 (말풍선이 열려 있으면 말풍선부터).
- `prefers-reduced-motion: reduce`면 움직임 없이 바로 보인다.

---

## 9. 바꾸는 법

**상태 이름·아이콘 바꾸기** — `copy.js`의 `status.<키>.label`/`icon`만. 조사는 자동. 색은 `app.css`의 `--st-know` 등.

**정복 기준 바꾸기 (예: 4번 연속)** — `coach.js RULES.need = 4`. 화면 설명·진행 표시(1/4)·「X」 정복하기 문제 수가 같이 바뀐다. `test/sim.mjs`의 상태 규칙 검사(3번 연속 가정)도 고친다.

**? 도움말 하나 더하기**
1. `copy.js help`에 `새키: { title, body: c => '<p>…</p>' }`
2. 화면에서 `helpBtn('새키')` (또는 `cardHead(제목, '새키', 부제)`)
3. `node test/text.test.mjs` — 안 쓰는 도움말·깨진 글자를 잡아 준다

**둘러보기 단계 더하기**
1. 비출 요소에 `data-tour="이름"` 달기 (`app.js` 또는 `template.html`)
2. `copy.js tour[]`에 `{ view: 'map', target: '이름', title, body: () => '…' }` (순서 = 배열 순서)
3. `text.test.mjs`가 대상이 실제로 있는지 검사한다. 브라우저 점검(10절)으로 말풍선 위치를 본다

**처음 한 번 도움말 더하기** — `copy.js firstTips`에 `{상황: help 키}`, 그 상황에서 `GUIDE.tipOnce('상황', 범위요소)` 호출

**개념 규격 더하기** — `scripts/specs_more.py`(또는 `specs/*.json`)에 6.2 형식으로. `node test/spec.test.mjs`가 패턴마다 수백 개씩 만들어 보기 중복·정답·해설을 검사한다

**계산 유형 더하기** — `calcgen.js GENERATORS`에 `{ id, subject, label, nodes: [개념 id], make: T => ({ stem, answer, steps, kind, opts?, check? }) }`. `node test/calc.test.mjs`

**카드를 길잡이에 더하기** — `app.js`에 `xxxCard(key, st, r)`를 만들고 `renderToday()`의 순서에 끼운다. 제목은 `COPY.titles`, 설명은 `cardHead(제목, help키)`. 길잡이는 위에서 아래로 "할 일 → 이유 → 현황 → 기록" 순서를 지킨다.

**지금 할 일 규칙 바꾸기** — `app.js nextAction()`의 if 순서. `COPY.help.next`의 설명 목록도 같이 고친다.

**개념 글(why·core) 고치기** — 원본을 고치거나 `scripts/clean_concepts.py`의 `TCS_WHY`·`ALG_WHY`·`ALG_CARD`에 덮어쓰기 → `python3 scripts/build_data.py`

---

## 10. 테스트

| 명령 | 지키는 것 |
|---|---|
| `node test/sim.mjs` | 가상 학생으로 진단 정확도(진짜 원인 짚기 ≥80%, 정밀도 ≥70%), 상태 규칙(3번 연속·복습·모양 돌려쓰기·길잡이·원인 찾기·예전 저장 변환), **모든 개념 모양 3가지 이상** |
| `node test/spec.test.mjs` | 규격 81개로 문제 약 11만 8천 개: 보기 4개 중복 없음·정답 1개·보기마다 해설·서술형 모범답안 자기 채점 |
| `node test/calc.test.mjs` | 계산 29유형 × 500: 정답·결정성, 고정 사례 |
| `node test/text.test.mjs` | 화면에 나갈 모든 글자(강의 문제·규격·계산·개념 지도 def/core·COPY): undefined·NaN·엔티티·마크다운·빈 보기·조사·지문에 답 노출·둘러보기 대상 |
| `node test/text.test.mjs` (페이지 뼈대) | `docs/index.html`에 doctype·charset·viewport가 있는지 |
| 브라우저 점검 (Playwright, 390px·밝은/어두운) | 처음 방문 질문 → 둘러보기 10단계(대상 비춤·말풍선이 화면 안·대상을 안 가림) → 진단 → 처음 한 번 도움말 → ? 말풍선·Esc → 다시 열면 질문 안 뜸, 가로 넘침·콘솔 오류 없음 |
| 브라우저 점검 (아이폰 13 터치 흉내) | 답하면 결과로 스크롤, 다음 버튼 줄 고정, 강의에서 「풀던 문제로」, 지도 개념 창 열고 닫아도 스크롤 위치 그대로, 탭 바꾸면 맨 위 |
| 브라우저 점검 (1280px·어두운·알고리즘) | 길잡이·지도 옆 창·키보드(숫자·Enter) |

저장소에서는 `npm test`가 MCP 서버 연기 테스트와 위 네 개를 차례로 돌린다.

---

## 11. 바뀐 기록

**0.7.0 (2026-11-10) — 편의성 패치**
- 낱말 통일: 확인 문제 → 🔍 원인 찾기, 선행 → 기초 개념, 실패·모험 중 다시 → 다시 도전. 생성기 이름·개념 번호·원고 메타 숨김
- 길잡이: 맨 위 **지금 할 일** 카드(버튼 하나), 출발점은 한 줄씩, 현황 숫자 4칸(누르면 지도), 비슷한 카드 3개 → 「이어서 하면 좋은 것」 하나, 최근 푼 문제는 누르면 그 개념, 기록·설정은 접어 둠. 폰 길이 약 3,850px → 2,400px
- 문제: 다음 버튼 줄 화면 아래 고정, 답하면 결과로 자동 스크롤, 원인 찾기 문제에 "왜 내는지·맞히면/틀리면" 한 줄, 부정형 문제 해설 말 바꾸기, 컴퓨터에서 Enter로 다음
- 지도: 폰에서 개념 창이 아래에서 올라옴(닫으면 보던 자리), 창 안 할 일 버튼을 위로, ⏳ 다시 점검 필터, 상태 설명 4줄 삭제
- 공통: 탭을 바꾸면 맨 위부터, 「← 풀던 문제로」, 강의에 「안 읽은 장면으로」, 아래 설명 한 줄
- GitHub Pages 문서에 viewport·charset 추가 (폰에서 데스크톱 폭으로 작게 보이던 문제)


**0.6.0 (2026-11-10)**
- 상태 이름: 앎·확인 중·모름·안 봄 → 🚩 정복 · 🧭 모험 중 · 💥 정복 실패 · 🌫️ 미지의 영역 (내부 키는 그대로)
- 정복 기준: 2번 연속 → **3번 연속** (`RULES.need`). 예전에 2번 연속이던 개념은 “모험 중 2/3”으로 보인다
- 개념 지도 문제에 `core`(설명 맞히기) 추가 → 모든 개념이 문제 모양 3가지 이상
- 지문 가리기 강화(영문 약어·긴 낱말), 단서가 모자란 개념 글(why) 12개 보강
- 안내 장치: 처음 방문 질문, 10단계 둘러보기(흐림·빛 테두리), 화면 곳곳 ? 말풍선, 처음 한 번 도움말
- 구조: 화면 코드를 `app.js`·`app.css`로, 문구를 `copy.js`로, 안내 장치를 `tour.js`로 나눔. 화면 말투 해요체로 통일
