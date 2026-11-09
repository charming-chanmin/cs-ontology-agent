"""학습 코치 웹 앱 빌드 → docs/index.html (GitHub Pages와 Claude 아티팩트에 같은 파일을 쓴다)
  app/src/template.html  화면
  app/src/coach.js       개념 상태(앎·확인 중·모름·안 봄)·길잡이·원인 찾기 엔진
  app/src/specgen.js     개념 규격(app/specs/*.json) → 문제 생성기
  app/src/calcgen.js     계산 문제 생성기 (숫자를 바꿔 출제, 정답은 코드가 계산)
  src/quiz.js            개념 지도 문제 생성기 (탐색기·MCP와 공용)
  app/data/*.json        개념·강의·강의 속 문제 (app/scripts/build_data.py로 생성)"""
import json, re, pathlib
app = pathlib.Path(__file__).resolve().parent
repo = app.parent
t = (app / 'src' / 'template.html').read_text(encoding='utf-8')
strip = lambda s: re.sub(r'^export ', '', s, flags=re.M)
wrap = (lambda name, src, names: f'const {name} = (() => {{\n{strip(src)}\nreturn {{ {", ".join(names)} }};\n}})();')
parts = {
    '/*__LECTURE_CSS__*/': (app / 'src' / 'lecture.css').read_text(encoding='utf-8'),
    '/*__COACH__*/': strip((app / 'src' / 'coach.js').read_text(encoding='utf-8')),
    '/*__QUIZGEN__*/': strip((repo / 'src' / 'quiz.js').read_text(encoding='utf-8')),
    '/*__CALC__*/': wrap('CALC', (app / 'src' / 'calcgen.js').read_text(encoding='utf-8'), ['GENERATORS', 'makeCalc']),
    '/*__SPEC__*/': wrap('SPEC', (app / 'src' / 'specgen.js').read_text(encoding='utf-8'), ['patternsOf', 'makeSpec', 'keywordScore', 'validateSpec']),
    '/*__BUILD__*/{}': json.dumps({'subjects': ['tcs', 'alg']}),
}
blocks = []
for key in ['tcs', 'alg']:
    d = json.loads((app / 'data' / f'{key}.json').read_text(encoding='utf-8'))
    d['specs'] = json.loads((app / 'specs' / f'{key}.json').read_text(encoding='utf-8'))
    for s in d['scenes'].values(): s.pop('card', None)   # 화면에서 안 쓰는 원본 카드는 뺀다
    blocks.append(f'<script type="application/json" id="d-{key}">' + json.dumps(d, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + '</script>')
parts['<!--__DATA__-->'] = '\n'.join(blocks)
for k, v in parts.items():
    assert t.count(k) == 1, k
    t = t.replace(k, v)
(repo / 'docs' / 'index.html').write_text(t, encoding='utf-8')
print('docs/index.html', len(t.encode()) // 1024, 'KB')
