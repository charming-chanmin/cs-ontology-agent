import re, json, sys
src = open('source/concept-map.md', encoding='utf-8').read()

# chapters
chapters = []
for m in re.finditer(r'^## (\d+)장\. (.+?) \(노드 (\d+)~(\d+)\)\s*$', src, re.M):
    chapters.append({'id': int(m.group(1)), 'title': m.group(2), 'from': int(m.group(3)), 'to': int(m.group(4))})

def chapter_of(n):
    for c in chapters:
        if c['from'] <= n <= c['to']:
            return c['id']
    return None

ids_re = re.compile(r'(?:^|,\s)(\d{1,3})\s')
node_re = re.compile(r'^\*\*(\d+)\. (.+?)\*\* (★+☆*)(.*)$', re.M)
heads = list(node_re.finditer(src))
nodes = []
for i, h in enumerate(heads):
    nid = int(h.group(1)); title = h.group(2).strip()
    stars = h.group(3).count('★'); tail = h.group(4)
    end = heads[i+1].start() if i+1 < len(heads) else len(src)
    body = src[h.end():end]
    # cut at next section header
    body = re.split(r'\n---\n|\n## ', body)[0]
    fields = {}
    for line in body.splitlines():
        m = re.match(r'^- (선행|왜|핵심|계산 이유|다음|시험): (.*)$', line)
        if m: fields[m.group(1)] = m.group(2).strip()
    def ids(s):
        if not s or s.startswith('없음') or s.startswith('—'): return []
        return [int(x) for x in ids_re.findall(s)]
    exam = fields.get('시험', '')
    pm = re.search(r'(\d+)%', exam)
    types = []
    for t, k in [('객', 'mcq'), ('주', 'essay'), ('계산', 'calc'), ('그림', 'figure')]:
        if re.search(r'(^|[·\s])' + t + r'($|[·\s])', exam): types.append(k)
    refs = re.findall(r'(?:모의[12]-\d+(?:~\d+)?|공식 예시\d+(?:\(주관식\))?|응용\d+-\d|예시\d+-\d|\b\d{3}(?:~\d{3})?\b)', exam)
    nodes.append({
        'id': nid, 'title': title, 'stars': stars, 'root': '[뿌리]' in tail,
        'chapter': chapter_of(nid),
        'why': fields.get('왜', ''), 'core': fields.get('핵심', ''), 'calc': fields.get('계산 이유', ''),
        'prereq': ids(fields.get('선행', '')), 'next': ids(fields.get('다음', '')),
        'exam': {'prob': int(pm.group(1)) if pm else None, 'types': types, 'refs': refs, 'raw': exam},
        'warn': '⚠️' in exam,
    })

# chains
chains = []
for m in re.finditer(r'^- ([①-⑫]) (.+?): (.+)$', src, re.M):
    steps = [s.strip() for s in re.split(r'→', m.group(3))]
    chains.append({'no': m.group(1), 'name': m.group(2), 'steps': steps})

byid = {n['id']: n for n in nodes}
# checks
errs = []
assert len(nodes) == 147, len(nodes)
assert sorted(byid) == list(range(1, 148))
for n in nodes:
    if not n['why'] or not n['core']: errs.append(f"{n['id']} missing why/core")
    for p in n['prereq']:
        if p not in byid: errs.append(f"{n['id']} prereq {p} missing")
        elif n['id'] not in byid[p]['next']: errs.append(f"edge {p}->{n['id']} in prereq but not in next")
    for q in n['next']:
        if q not in byid: errs.append(f"{n['id']} next {q} missing")
        elif n['id'] not in byid[q]['prereq']: errs.append(f"edge {n['id']}->{q} in next but not in prereq")
from collections import Counter
sc = Counter(n['stars'] for n in nodes)
print('nodes', len(nodes), 'chapters', len(chapters), 'chains', len(chains))
print('stars', dict(sorted(sc.items(), reverse=True)), 'roots', sum(n['root'] for n in nodes))
edges = sorted({(p, n['id']) for n in nodes for p in n['prereq']} | {(n['id'], q) for n in nodes for q in n['next']})
print('edges', len(edges))
print('errors', len(errs)); print('\n'.join(errs[:40]))
# cycle check
import graphlib
ts = graphlib.TopologicalSorter({n['id']: set(n['prereq']) for n in nodes})
order = list(ts.static_order()); print('DAG ok, topo len', len(order))
json.dump({'meta': {'title': '통합컴퓨터시스템 개념 온톨로지', 'source': '통컴시_개념탐색표.md', 'version': 1},
           'chapters': chapters, 'chains': chains, 'nodes': nodes,
           'edges': [{'from': a, 'to': b, 'type': 'prerequisite_of'} for a, b in edges]},
          open('data/ontology.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('missing prob', [n['id'] for n in nodes if n['exam']['prob'] is None][:60])
