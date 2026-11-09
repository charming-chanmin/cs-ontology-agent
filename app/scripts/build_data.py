"""스토리 강의(통컴시 16강, 알고리즘 13강) + 개념 온톨로지 → 학습 코치 데이터.

출력: data/tcs.json, data/alg.json
- concepts: 개념(온톨로지 노드)과 선행 관계
- lessons/scenes: 강의 본문(문제 블록은 빼고 HTML로)
- quizzes: 강의 속 문제를 구조화 (객관식 보기·정답·보기별 해설, 주관식·계산 모범답안)
  pub=false: 교재·모의고사·공식 예시 원문 문제 (개인 학습용 빌드에만 넣고 공개 빌드에선 뺀다)
"""
import importlib.util, json, os, re, sys, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import clean_concepts

HOME = '/home/claude'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')


def load_builder(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def plain(html):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', html)).strip()


def parse_quiz(M, meta, lines):
    """강의 빌더의 quiz_html과 같은 문법을 구조화된 데이터로 읽는다 (알고리즘 빌더 문법 = 상위 집합)."""
    inline = M.inline
    parts = [m.strip() for m in meta.split('|')]
    pre, q, opts, ans, expl, extra = [], [], [], None, {}, []
    tbl, codebuf, kbuf, ybuf, qblock, rtbl = [], [], [], [], [], []

    def flush_tbl(target):
        nonlocal tbl, kbuf, ybuf
        if ybuf:
            kind, body = ybuf[0].strip(), [y for y in ybuf[1:] if y.strip()]
            target.append(M.tree_svg('', body) if kind == 'tree' else M.graph_svg('', body)); ybuf = []
        if kbuf: target.append(M.code_html(kbuf)); kbuf = []
        if tbl: target.append(M.table_html(tbl)); tbl = []

    def flush_code(target):
        nonlocal codebuf
        if codebuf: target.append(M.code_html(codebuf)); codebuf = []

    def flush_r():
        nonlocal rtbl
        if rtbl: extra.append(M.table_html(rtbl)); rtbl = []

    for ln in lines:
        if not ln.startswith('R:'): flush_r()
        if ln.startswith('P:'): pre.append('<p>' + inline(ln[2:].strip()) + '</p>')
        elif ln.startswith('Q:'): q.append(inline(ln[2:].strip()))
        elif ln.startswith('T:'): tbl.append(ln[2:].strip())
        elif ln.startswith('K:'): kbuf.append(ln[2:][1:] if ln[2:].startswith(' ') else ln[2:])
        elif ln.startswith('Y:'): ybuf.append(ln[2:].strip())
        elif ln.startswith('R:'): flush_code(extra); rtbl.append(ln[2:].strip())
        elif ln.startswith('H:'): flush_tbl(qblock); qblock.append(ln[2:].strip())
        elif re.match(r'^[1-5]\)', ln): flush_tbl(qblock); opts.append(inline(ln[2:].strip()))
        elif ln.startswith('A:'): flush_tbl(qblock); ans = ln[2:].strip()
        elif re.match(r'^[1-5]>', ln): expl[int(ln[0])] = inline(ln[2:].strip())
        elif ln.startswith('E:'): flush_code(extra); extra.append('<p>' + inline(ln[2:].strip()) + '</p>')
        elif ln.startswith('S:'):
            flush_code(extra)
            t, _, d = ln[2:].strip().partition('|')
            if extra and isinstance(extra[-1], list): extra[-1].append((t.strip(), d.strip()))
            else: extra.append([(t.strip(), d.strip())])
        elif ln.startswith('C:'): codebuf.append(ln[2:][1:] if ln[2:].startswith(' ') else ln[2:])
        elif ln.startswith('G:'):
            flush_code(extra); t, _, segs = ln[2:].partition('||'); extra.append(M.gantt_html(t.strip(), [segs.strip()]))
        elif ln.startswith('W:'): flush_code(extra); extra.append('<p class="warn">⚠️ ' + inline(ln[2:].strip()) + '</p>')
    flush_tbl(qblock); flush_r(); flush_code(extra)
    extra_html = ''.join(M.steps_html(e) if isinstance(e, list) else e for e in extra)
    stem = ''.join(pre) + ''.join((f'<p class="qtext">{x}</p>' if i == 0 else f'<p>{x}</p>') for i, x in enumerate(q)) + ''.join(qblock)
    kind_raw = parts[0] if parts else '객관식'
    src = parts[1] if len(parts) > 1 else ''
    m = re.search(r'출제\s*(\d+)%', meta)
    weight = int(m.group(1)) if m else None
    item = {'src': src, 'weight': weight, 'stem': stem, 'extra': extra_html, 'question_text': plain(stem)}
    if opts:
        head = (ans or '').split('·')[0]
        nums = [int(x) for x in re.findall(r'[1-5]', head)]
        item.update(kind='mcq', options=opts, answer=nums, tail=inline(ans.split('·', 1)[1].strip()) if ans and '·' in ans else '',
                    expl={str(k): v for k, v in expl.items()})
    else:
        item.update(kind='calc' if kind_raw.startswith('계산') else 'short', answer_html=inline(ans or ''), answer_text=plain(inline(ans or '')))
        # 짧은 답(숫자·기호·한 낱말)은 자동 채점용으로 정규화해 둔다
        a = item['answer_text']
        if a and len(a) <= 14 and not re.search(r'[,·=→]', a):
            item['auto'] = normalize(a)
    return item


def normalize(s):
    s = s.lower().replace(' ', '')
    s = re.sub(r'(개|비트|번|회|가지|단계|bit|bits)$', '', s)
    return s


def public(src):
    if re.match(r'^(교재|모의)', src): return False
    if re.match(r'^공식 예시 [\d\-]+$', src): return False
    return True


def first_card(raw_lines):
    """장면 원고에서 첫 개념 카드의 정의·목표를 꺼낸다."""
    card, inside = {}, False
    for ln in raw_lines:
        if ln.startswith('::card'):
            inside, card = True, {}
            continue
        if inside:
            if ln.strip() == '::':
                return card
            k, _, v = ln.partition(':')
            if k.strip() in ('정의', '책임', '목표', '수단'): card[k.strip()] = plain(v)
    return card


def scenes_raw(path):
    out, cur = [], None
    for ln in open(path, encoding='utf-8').read().split('\n'):
        if ln.startswith('=='):
            cur = []; out.append(cur); continue
        if cur is not None: cur.append(ln)
    return out


def parse_subject(M, src_dir, prefix):
    captured = []

    def fake_quiz(meta, lines, lint, where):
        captured.append((meta, list(lines)))
        return f'<!--QUIZ{len(captured) - 1}-->', True
    M.quiz_html = fake_quiz
    lessons, scenes, quizzes, lint = [], {}, {}, []
    for f in sorted(glob.glob(os.path.join(src_dir, 'l*.txt'))):
        L = M.parse_lesson(f, lint)
        raws = scenes_raw(f)
        lesson = {'num': L['num'], 'title': plain(M.inline(L['title'])), 'meta': plain(M.inline(L['meta'])), 'lede': M.inline(L['lede']),
                  'flow': M.inline(L['flow']), 'sum': ''.join('<p>' + M.inline(x.strip()) + '</p>' for x in L['sum'] if x.strip()),
                  'next': M.inline(L['next']) if L['next'] else '', 'scenes': []}
        for k, s in enumerate(L['scenes'], 1):
            sid = f"{L['num']}-{k}"
            body = ''.join(s['body'])
            qids = []
            for m in re.finditer(r'<!--QUIZ(\d+)-->', body):
                meta, lines = captured[int(m.group(1))]
                qid = f"{prefix}{L['num']}-{k}-{len(qids) + 1}"
                item = parse_quiz(M, meta, lines)
                item.update(id=qid, scene=sid, pub=public(item['src']))
                quizzes[qid] = item; qids.append(qid)
            body = re.sub(r'<!--QUIZ\d+-->', '', body)
            card = first_card(raws[k - 1]) if k - 1 < len(raws) else {}
            scenes[sid] = {'id': sid, 'lesson': L['num'], 'k': k, 'title': plain(M.inline(s['title'])), 'node': s['node'], 'stars': s['stars'],
                           'tag': s['tag'], 'html': body, 'quizzes': qids, 'card': card, 'text': plain(body)[:1600]}
            lesson['scenes'].append(sid)
        lessons.append(lesson)
    lessons.sort(key=lambda x: x['num'])
    return lessons, scenes, quizzes, lint


def expand_nodes(s):
    ids = []
    for a, b in re.findall(r'(\d+)(?:~(\d+))?', s):
        ids += list(range(int(a), int(b or a) + 1))
    return ids


# ── 알고리즘: 장면 = 개념. 선행 관계는 강의 구조를 보고 직접 정의 ──
ALG_PRE = {
    '0.1': [], '0.2': ['0.1'], '0.3': ['0.2'], '0.4': ['0.3'], '0.5': ['0.3'], '0.6': ['0.4', '0.5'],
    '1.1': [], '1.2': ['1.1'], '1.3': ['1.1'], '1.4': [], '1.5': ['1.3', '1.4'], '1.6': ['1.5'], '1.7': ['1.5'],
    '2.1': ['0.2', '1.5'], '2.2': ['2.1', '0.5'], '2.3': ['2.1'], '2.4': ['2.1'], '2.5': ['2.3', '0.4'], '2.6': ['2.5', '1.5'],
    '3.1': ['2.2'], '3.2': ['3.1'], '3.3': ['3.2', '2.1', '2.2'], '3.4': ['3.2', '2.5', '2.4'], '3.5': ['3.4', '2.3'], '3.6': ['3.4', '3.3'],
    '4.1': ['3.2'], '4.2': ['4.1'], '4.3': ['4.2', '1.7'], '4.4': ['3.3', '3.2'],
    '5.1': ['1.7'], '5.2': ['5.1', '2.1'], '5.3': ['5.1'], '5.4': ['5.1'], '5.5': ['5.4'], '5.6': ['5.2', '5.3', '5.4', '5.5'],
    '6.1': ['2.5', '2.6', '5.1'], '6.2': ['6.1', '1.7'], '6.3': ['4.4', '5.1'], '6.4': ['5.1', '1.5'], '6.5': ['6.1', '0.6'], '6.6': ['5.6', '6.1', '6.2', '6.3', '6.4'],
    '7.1': ['1.7', '2.1'], '7.2': ['7.1', '1.4'], '7.3': ['7.2'], '7.4': ['2.1', '1.5'], '7.5': ['7.4', '2.2'], '7.6': ['4.3', '7.2'],
    '8.1': ['3.1'], '8.2': ['8.1', '2.1', '2.2'], '8.3': ['8.2', '2.3', '2.5'], '8.4': ['8.2', '2.4'], '8.5': ['8.3'], '8.6': ['8.3', '8.4'],
    '9.1': ['8.2', '3.1'], '9.2': ['9.1', '8.6', '5.1'], '9.3': ['9.1', '4.4'], '9.4': ['8.4', '4.4'], '9.5': ['9.4', '8.2'],
    '10.1': ['1.1', '1.5'], '10.2': ['10.1', '6.1', '6.2', '7.2'], '10.3': ['10.1', '2.6', '2.5'], '10.4': ['10.1', '9.2', '4.4'], '10.5': ['10.1', '8.3'],
    '11.1': ['0.2', '1.5'], '11.2': ['10.4', '11.1'], '11.3': ['1.1'], '11.4': ['11.3', '5.1'],
    '12.1': ['1.5', '10.1'], '12.2': ['12.1', '8.1'], '12.3': ['12.2', '10.4'], '12.4': ['1.5', '2.1'], '12.5': ['1.7'], '12.6': ['10.1'],
}


def short_title(t):
    t = t.split(':', 1)[1].strip() if ':' in t else t
    return t


def build_tcs():
    M = load_builder('tcs_builder', f'{HOME}/tcs_story/build.py')
    lessons, scenes, quizzes, lint = parse_subject(M, f'{HOME}/tcs_story/src', 't')
    onto = json.load(open(f'{HOME}/cs_ontology/data/ontology.json', encoding='utf-8'))
    lay = json.load(open(f'{HOME}/cs_ontology/data/layout.json', encoding='utf-8'))
    concepts = []
    for n in onto['nodes']:
        concepts.append({'id': n['id'], 'title': n['title'], 'short': lay['short'][str(n['id'])] if str(n['id']) in lay['short'] else n['title'],
                         'stars': n['stars'], 'chapter': n['chapter'], 'why': n['why'], 'core': n['core'], 'calc': n.get('calc') or '',
                         'prereq': n['prereq'], 'next': n['next'], 'root': n['root'], 'prob': n['exam']['prob'],
                         'out': n['title'].startswith('[범위 밖]'), 'scenes': [], 'quizzes': []})
    by = {c['id']: c for c in concepts}
    for s in scenes.values():
        ids = [i for i in expand_nodes(s['node']) if i in by]
        s['concepts'] = ids
        for i in ids: by[i]['scenes'].append(s['id'])
    for q in quizzes.values():
        q['concepts'] = scenes[q['scene']]['concepts']
        for i in q['concepts']: by[i]['quizzes'].append(q['id'])
    chapters = [{'id': c['id'], 'title': c['title']} for c in onto['chapters']]
    return {'subject': 'tcs', 'name': '통합컴퓨터시스템', 'short': '통컴시', 'chapters': chapters, 'concepts': concepts,
            'lessons': lessons, 'scenes': scenes, 'quizzes': quizzes}, lint


def build_alg():
    M = load_builder('alg_builder', f'{HOME}/alg_story/build.py')
    lessons, scenes, quizzes, lint = parse_subject(M, f'{HOME}/alg_story/src', 'a')
    concepts, key2id = [], {}
    order = [sid for L in lessons for sid in L['scenes']]
    for i, sid in enumerate(order, 1):
        s = scenes[sid]
        key2id[f"{s['lesson']}.{s['k']}"] = i
    for i, sid in enumerate(order, 1):
        s = scenes[sid]
        key = f"{s['lesson']}.{s['k']}"
        card = s['card']
        why = card.get('목표') or card.get('책임') or ''
        core = card.get('정의') or ''
        if card.get('수단'): core = (core + ' / ' + card['수단']).strip(' /')
        if not core: core = s['text'][:200]
        if not why: why = s['text'][:90]
        concepts.append({'id': i, 'title': short_title(s['title']), 'short': short_title(s['title'])[:16], 'stars': s['stars'] or 3, 'chapter': s['lesson'],
                         'why': why, 'core': core[:420], 'calc': '', 'prereq': [key2id[p] for p in ALG_PRE[key]], 'next': [], 'root': not ALG_PRE[key],
                         'prob': None, 'out': False, 'scenes': [sid], 'quizzes': list(s['quizzes']), 'tag': s['node']})
        s['concepts'] = [i]
    by = {c['id']: c for c in concepts}
    for c in concepts:
        for p in c['prereq']: by[p]['next'].append(c['id'])
    for q in quizzes.values():
        q['concepts'] = scenes[q['scene']]['concepts']
    chapters = [{'id': L['num'], 'title': L['title']} for L in lessons]
    assert len(ALG_PRE) == len(order), (len(ALG_PRE), len(order))
    return {'subject': 'alg', 'name': '알고리즘', 'short': '알고리즘', 'chapters': chapters, 'concepts': concepts,
            'lessons': lessons, 'scenes': scenes, 'quizzes': quizzes}, lint


def check_dag(concepts):
    by = {c['id']: c for c in concepts}
    state = {}
    def visit(i):
        if state.get(i) == 1: raise SystemExit(f'cycle at {i}')
        if state.get(i) == 2: return
        state[i] = 1
        for p in by[i]['prereq']: visit(p)
        state[i] = 2
    for c in concepts: visit(c['id'])


if __name__ == '__main__':
    for build in (build_tcs, build_alg):
        data, lint = build()
        clean_concepts.clean(data)   # 화면에 찍히는 개념 글자 다듬기 (엔티티·마크다운 제거, 빈 개념 카드 채우기)
        check_dag(data['concepts'])
        qs = list(data['quizzes'].values())
        nq = {k: sum(1 for q in qs if q['kind'] == k) for k in ('mcq', 'short', 'calc')}
        pub = sum(1 for q in qs if q['pub'])
        noq = [c['id'] for c in data['concepts'] if not c['out'] and not c['quizzes']]
        nosc = [c['id'] for c in data['concepts'] if not c['out'] and not c['scenes']]
        auto = sum(1 for q in qs if q.get('auto'))
        print(f"{data['subject']}: 개념 {len(data['concepts'])} · 강의 {len(data['lessons'])} · 장면 {len(data['scenes'])} · 문제 {len(qs)} {nq} · 공개 {pub} · 짧은 답 자동채점 {auto}")
        print(f"   문제 없는 개념 {len(noq)} {noq[:20]} · 강의 없는 개념 {nosc}")
        json.dump(data, open(os.path.join(OUT, f"{data['subject']}.json"), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        print('   size KB', os.path.getsize(os.path.join(OUT, f"{data['subject']}.json")) // 1024, '| lint', len(lint))
