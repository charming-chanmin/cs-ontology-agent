"""학습 코치 → 한 파일짜리 웹 앱 (저장소 docs/index.html). GitHub Pages와 Claude 아티팩트에 같은 파일을 쓴다.
  python3 app/build.py      (구조 명세: app/SPEC.md)

  src/template.html  뼈대 (자리표시만)
  src/app.css        화면 모양            → /*__APP_CSS__*/
  src/lecture.css    강의 본문 모양        → /*__LECTURE_CSS__*/
  data/*.json + specs/*.json                → <!--__DATA__-->
  src/coach.js       규칙·계산 엔진         → /*__COACH__*/
  ../src/quiz.js     개념 지도 문제 생성기  → /*__QUIZGEN__*/  (MCP 서버와 공용)
  src/calcgen.js     계산 문제 생성기       → /*__CALC__*/  (CALC 하나로 감쌈)
  src/specgen.js     규격 문제 생성기       → /*__SPEC__*/  (SPEC 하나로 감쌈)
  src/copy.js        화면 문구 사전         → /*__COPY__*/  (COPY 하나로 감쌈)
  src/tour.js        안내 장치(둘러보기·?) → /*__TOUR__*/  (GUIDE 하나로 감쌈)
  src/app.js         화면                   → /*__APP__*/
"""
import json, re, pathlib
root = pathlib.Path(__file__).resolve().parent
SRC = root / 'src'

def build(src_dir=SRC, data_dir=root / 'data', spec_dir=root / 'specs', quizgen=None, out=root / 'docs' / 'index.html'):
    read = lambda p: pathlib.Path(p).read_text(encoding='utf-8')
    strip = lambda s: re.sub(r'^import .*?;\n', '', re.sub(r'^export ', '', s, flags=re.M), flags=re.M)
    wrap = lambda name, s, names: f'const {name} = (() => {{\n{strip(s)}\nreturn {{ {", ".join(names)} }};\n}})();'
    t = read(src_dir / 'template.html')
    blocks = []
    for key in ['tcs', 'alg']:
        d = json.loads(read(data_dir / f'{key}.json'))
        d['specs'] = json.loads(read(spec_dir / f'{key}.json'))
        for s in d['scenes'].values(): s.pop('card', None)   # 화면에서 안 쓰는 원본 카드는 뺀다
        blocks.append(f'<script type="application/json" id="d-{key}">' + json.dumps(d, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + '</script>')
    copy = strip(read(src_dir / 'copy.js'))
    parts = {
        '/*__APP_CSS__*/': read(src_dir / 'app.css'),
        '/*__LECTURE_CSS__*/': read(src_dir / 'lecture.css'),
        '<!--__DATA__-->': '\n'.join(blocks),
        '/*__COACH__*/': strip(read(src_dir / 'coach.js')),
        '/*__QUIZGEN__*/': strip(read(quizgen or (src_dir / 'quizgen.js'))),
        '/*__CALC__*/': wrap('CALC', read(src_dir / 'calcgen.js'), ['GENERATORS', 'makeCalc']),
        '/*__SPEC__*/': wrap('SPEC', read(src_dir / 'specgen.js'), ['patternsOf', 'makeSpec', 'keywordScore', 'validateSpec']),
        '/*__COPY__*/': f'const COPY = (() => {{\n{copy}\nreturn COPY;\n}})();',
        '/*__TOUR__*/': read(src_dir / 'tour.js'),
        '/*__APP__*/': read(src_dir / 'app.js').replace('/*__BUILD__*/{}', json.dumps({'subjects': ['tcs', 'alg']})),
    }
    for k, v in parts.items():
        assert t.count(k) == 1, k
        t = t.replace(k, v)
    out.parent.mkdir(exist_ok=True)
    out.write_text(t, encoding='utf-8')
    return out, len(t.encode()) // 1024

if __name__ == '__main__':
    repo = root.parent
    out, kb = build(quizgen=repo / 'src' / 'quiz.js', out=repo / 'docs' / 'index.html')
    print(out.relative_to(repo), kb, 'KB')
