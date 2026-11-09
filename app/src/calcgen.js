// 계산 문제 생성기: 숫자를 바꿔 가며 실전형 계산 문제를 무한히 만든다.
// 정답은 코드가 직접 계산하고(지어내지 않음), 풀이 단계도 같이 만든다.
// 웹 앱과 MCP 서버가 같이 쓴다. 같은 seed면 같은 문제가 나온다.

const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const tools = r => ({
  int: (a, b) => a + Math.floor(r() * (b - a + 1)),
  pick: arr => arr[Math.floor(r() * arr.length)],
  shuffle: arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  distinct: (n, a, b) => { const s = new Set(); while (s.size < n) s.add(a + Math.floor(r() * (b - a + 1))); return [...s]; },
});
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const table = (head, rows) => `<div class="tablewrap"><table class="tt"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const code = lines => `<div class="codebox"><pre>${esc(lines.join('\n'))}</pre></div>`;
const r2 = x => Math.round(x * 100) / 100;
// 받침 따라 조사 (숫자·영문은 읽는 소리 기준: 0 영, 1 일, 3 삼, 6 육, 7 칠, 8 팔 / L·M·N·R은 받침. 끝 괄호 설명은 건너뜀)
const josa = (w, a, b) => { const base = String(w).replace(/\s*\([^()]*\)\s*$/, '') || String(w); const ch = base.replace(/[\s)"'\]]+$/, '').slice(-1), code = ch.charCodeAt(0); if (code >= 0xAC00 && code <= 0xD7A3) return (code - 0xAC00) % 28 ? a : b; return /[136780lmnrLMNR]$/.test(ch) ? a : b; };
const ro = w => { const ch = (String(w).replace(/\s*\([^()]*\)\s*$/, '') || String(w)).replace(/[\s)"'\]]+$/, '').slice(-1), code = ch.charCodeAt(0);
  if (code >= 0xAC00 && code <= 0xD7A3) { const j = (code - 0xAC00) % 28; return j && j !== 8 ? '으로' : '로'; }
  return /[036mnMN]$/.test(ch) ? '으로' : '로'; };   // (으)로: ㄹ 받침(1·7·8·L·R)과 받침 없음은 '로'

// ── 답 비교 ──
const tokens = s => String(s).toUpperCase().replace(/[→>,·\-\[\]()]/g, ' ').trim().split(/\s+/).filter(Boolean);
const stripP = t => t.replace(/^P(?=\d)/, '');
export const check = {
  num: (want, tol = 0.01) => input => { const m = String(input).replace(/[−–]/g, '-').replace(/,/g, '').match(/-?\d+(\.\d+)?/); return !!m && Math.abs(parseFloat(m[0]) - want) <= tol + 1e-9; },
  nums: want => input => { const got = (String(input).replace(/,(?=\d{3}\b)/g, '').match(/-?\d+(\.\d+)?/g) || []).map(Number); return got.length === want.length && got.every((v, i) => Math.abs(v - want[i]) < 1e-6); },
  seq: want => input => { const a = tokens(input).map(stripP), b = want.map(x => stripP(String(x).toUpperCase())); return a.length === b.length && a.every((x, i) => x === b[i]); },
  bits: want => input => { const z = x => String(x).toUpperCase().replace(/\(\d+\)|[^0-9A-F]/g, '').replace(/^0+(?=.)/, ''); return z(input) === z(want); },
  text: want => input => String(input).toUpperCase().replace(/\s+/g, '') === String(want).toUpperCase().replace(/\s+/g, ''),
};

// ═════════ 통합컴퓨터시스템 ═════════
function sched(T, kind) {
  const n = T.int(3, 4), names = Array.from({ length: n }, (_, i) => `P${i + 1}`);
  let procs;
  for (let tries = 0; tries < 50; tries++) {
    const arr = [0, ...T.distinct(n - 1, 1, 6).sort((a, b) => a - b)];
    procs = names.map((p, i) => ({ p, at: arr[i], bt: T.int(1, 8) }));
    if (kind !== 'RR' || procs.some(x => x.bt > 2)) break;
  }
  const q = kind === 'RR' ? T.pick([2, 3]) : null;
  const res = simulate(procs, kind, q);
  const ask = T.pick(['avg', 'order']);
  const full = { FCFS: 'FCFS', SJF: 'SJF(비선점)', SRT: 'SRT(선점 SJF)', RR: `RR(시간 할당량 ${q})`, HRN: 'HRN' }[kind];
  const rule = kind === 'RR' ? '<p class="note">같은 시각에 새 프로세스 도착과 할당 시간 종료가 겹치면, 새로 도착한 프로세스가 먼저 큐에 들어가.</p>' : '<p class="note">조건이 같으면 먼저 도착한 프로세스부터.</p>';
  const stem = `<p class="qtext">다음 프로세스를 <b>${full}</b>${ro(full)} 스케줄링할 때 ${ask === 'avg' ? '<b>평균 대기 시간</b>은? (소수 둘째 자리까지)' : '<b>작업이 끝나는 순서</b>는?'}</p>${table(['프로세스', '도착 시간', '실행 시간'], procs.map(x => [x.p, x.at, x.bt]))}${rule}`;
  const avg = r2(res.rows.reduce((s, x) => s + x.wait, 0) / n);
  const steps = `<p>간트 차트</p>${code([res.gantt.map(g => `${g.p}[${g.a}-${g.b}]`).join(' ')])}${table(['프로세스', '종료', '반환 = 종료 − 도착', '대기 = 반환 − 실행'], res.rows.map(x => [x.p, x.end, x.tat, x.wait]))}<p>평균 대기 = (${res.rows.map(x => x.wait).join(' + ')}) ÷ ${n} = <b>${avg}</b> · 끝나는 순서 <b>${res.order.join(' → ')}</b></p>`;
  return ask === 'avg'
    ? { stem, input: '숫자 (예: 3.33)', answer: String(avg), check: check.num(avg, 0.011), steps }
    : { stem, input: '순서 (예: P1 P3 P2)', answer: res.order.join(' '), check: check.seq(res.order), steps };
}
export function simulate(procs, kind, q) {
  const ps = procs.map((x, i) => ({ ...x, i, rem: x.bt, end: null }));
  let t = 0; const gantt = [], order = [];
  const push = (p, a, b) => { const last = gantt[gantt.length - 1]; if (last && last.p === p && last.b === a) last.b = b; else gantt.push({ p, a, b }); };
  if (kind === 'RR') {
    const queue = [], arrived = new Set();
    const admit = upto => { for (const x of ps) if (!arrived.has(x.i) && x.at <= upto) { arrived.add(x.i); queue.push(x); } };
    admit(0);
    while (order.length < ps.length) {
      if (!queue.length) { const nx = Math.min(...ps.filter(x => !arrived.has(x.i)).map(x => x.at)); push('-', t, nx); t = nx; admit(t); continue; }
      const cur = queue.shift(); const run = Math.min(q, cur.rem);
      push(cur.p, t, t + run); t += run; cur.rem -= run;
      admit(t);
      if (cur.rem === 0) { cur.end = t; order.push(cur.p); } else queue.push(cur);
    }
  } else if (kind === 'SRT') {
    while (order.length < ps.length) {
      const ready = ps.filter(x => x.at <= t && x.rem > 0);
      if (!ready.length) { const nx = Math.min(...ps.filter(x => x.rem > 0).map(x => x.at)); push('-', t, nx); t = nx; continue; }
      ready.sort((a, b) => a.rem - b.rem || a.at - b.at || a.i - b.i);
      const cur = ready[0]; push(cur.p, t, t + 1); t += 1; cur.rem -= 1;
      if (cur.rem === 0) { cur.end = t; order.push(cur.p); }
    }
  } else {
    while (order.length < ps.length) {
      const ready = ps.filter(x => x.at <= t && x.end == null);
      if (!ready.length) { const nx = Math.min(...ps.filter(x => x.end == null).map(x => x.at)); push('-', t, nx); t = nx; continue; }
      const key = { FCFS: x => [x.at, x.i], SJF: x => [x.bt, x.at, x.i], HRN: x => [-((t - x.at + x.bt) / x.bt), x.at, x.i] }[kind];
      ready.sort((a, b) => { const ka = key(a), kb = key(b); for (let k = 0; k < ka.length; k++) if (ka[k] !== kb[k]) return ka[k] - kb[k]; return 0; });
      const cur = ready[0]; push(cur.p, t, t + cur.bt); t += cur.bt; cur.end = t; order.push(cur.p);
    }
  }
  const rows = ps.map(x => ({ p: x.p, end: x.end, tat: x.end - x.at, wait: x.end - x.at - x.bt }));
  return { gantt, order, rows };
}

export function pageFaults(refs, frames, kind) {
  const mem = [], loaded = [], trace = []; let faults = 0;
  refs.forEach((p, t) => {
    const hit = mem.includes(p); let out = null;
    if (!hit) {
      faults++;
      if (mem.length < frames) { mem.push(p); loaded.push(t); }
      else {
        let v;
        if (kind === 'FIFO') v = loaded.indexOf(Math.min(...loaded));
        else if (kind === 'LRU') { const lastUse = mem.map(m => refs.lastIndexOf(m, t - 1)); v = lastUse.indexOf(Math.min(...lastUse)); }
        else { const nextUse = mem.map(m => { const k = refs.indexOf(m, t + 1); return k < 0 ? Infinity : k; }); const far = Math.max(...nextUse); const cands = nextUse.map((u, i) => u === far ? i : -1).filter(i => i >= 0); v = cands.sort((a, b) => loaded[a] - loaded[b])[0]; }
        out = mem[v]; mem[v] = p; loaded[v] = t;
      }
    }
    trace.push({ p, mem: mem.slice(), fault: !hit, out });
  });
  return { faults, trace };
}
function pagerep(T) {
  const kind = T.pick(['FIFO', 'LRU', 'OPT']), frames = 3, len = T.int(10, 12);
  const refs = Array.from({ length: len }, () => T.int(0, 5));
  for (let i = 1; i < len; i++) if (refs[i] === refs[i - 1]) refs[i] = (refs[i] + T.int(1, 4)) % 6;
  const { faults, trace } = pageFaults(refs, frames, kind);
  const stem = `<p class="qtext">프레임 ${frames}개, <b>${kind}</b> 교체일 때 다음 참조열의 <b>페이지 부재 횟수</b>는? (처음 빈 프레임을 채우는 것도 부재로 센다)</p>${code([refs.join(' ')])}`;
  const steps = table(['참조', ...Array.from({ length: frames }, (_, i) => `프레임 ${i + 1}`), '부재'], trace.map(x => [x.p, ...Array.from({ length: frames }, (_, i) => x.mem[i] ?? ''), x.fault ? `F${x.out != null ? ` (${x.out} 나감)` : ''}` : ''])) + `<p>부재 <b>${faults}</b>번</p>`;
  return { stem, input: '숫자', answer: String(faults), check: check.num(faults, 0), steps, nodes: [115] };
}

export function diskMove(head, reqs, kind, dir, max = 199) {
  let pos = head, path = [head], total = 0; const left = reqs.slice();
  const go = x => { total += Math.abs(x - pos); pos = x; path.push(x); };
  if (kind === 'FCFS') reqs.forEach(go);
  else if (kind === 'SSTF') while (left.length) { left.sort((a, b) => Math.abs(a - pos) - Math.abs(b - pos) || a - b); go(left.shift()); }
  else {
    const lo = reqs.filter(x => x < head).sort((a, b) => b - a), hi = reqs.filter(x => x >= head).sort((a, b) => a - b);
    if (kind === 'SCAN') {
      if (dir === 'up') { hi.forEach(go); if (lo.length) { go(max); lo.forEach(go); } }
      else { lo.forEach(go); if (hi.length) { go(0); hi.forEach(go); } }
    } else { // C-SCAN: 끝까지 간 뒤 반대쪽 끝으로 돌아오는 거리도 셈
      if (dir === 'up') { hi.forEach(go); if (lo.length) { go(max); go(0); lo.slice().reverse().forEach(go); } }
      else { lo.forEach(go); if (hi.length) { go(0); go(max); hi.slice().reverse().forEach(go); } }
    }
  }
  return { total, path };
}
function disk(T) {
  const kind = T.pick(['FCFS', 'SSTF', 'SCAN', 'C-SCAN']), head = T.int(40, 140), reqs = T.distinct(T.int(5, 7), 5, 195).filter(x => x !== head);
  const dir = T.pick(['up', 'down']);
  const { total, path } = diskMove(head, reqs, kind, dir);
  const conv = kind === 'SCAN' ? `헤드는 지금 <b>${dir === 'up' ? '큰 번호(199) 쪽' : '작은 번호(0) 쪽'}</b>으로 움직이는 중이고, 끝(0 또는 199)까지 갔다가 돌아와.` : kind === 'C-SCAN' ? `헤드는 <b>${dir === 'up' ? '199 쪽' : '0 쪽'}</b>으로 움직이고, 끝까지 간 뒤 반대쪽 끝으로 돌아가. <b>돌아가는 거리도 이동 거리에 포함</b>해.` : kind === 'SSTF' ? '거리가 같으면 번호가 작은 쪽부터.' : '';
  const stem = `<p class="qtext">실린더 0~199, 헤드가 <b>${head}</b>에 있을 때 <b>${kind}</b>${ro(kind)} 처리하면 헤드의 <b>총 이동 거리</b>는?</p>${code(['요청 큐: ' + reqs.join(', ')])}${conv ? `<p class="note">${conv}</p>` : ''}`;
  const steps = `${code([path.join(' → ')])}<p>${path.slice(1).map((x, i) => `|${x}−${path[i]}|`).join(' + ')} = <b>${total}</b></p>`;
  return { stem, input: '숫자', answer: String(total), check: check.num(total, 0), steps, nodes: [119] };
}
function base(T) {
  const v = T.int(37, 250), kind = T.pick(['10→2', '10→8', '10→16', '2→10', '2→16', '16→2']);
  const bin = v.toString(2), oct = v.toString(8), hex = v.toString(16).toUpperCase();
  const [from, to] = kind.split('→');
  const src = { 10: String(v), 2: bin, 16: hex }[from], ans = { 10: String(v), 2: bin, 8: oct, 16: hex }[to];
  const stem = `<p class="qtext">${from}진수 <b>${src}</b>${josa(src, '을', '를')} ${to}진수로 바꾸면?</p>`;
  let steps;
  if (from === '10') { const rows = []; let x = v; const b = +to; while (x > 0) { rows.push([x, Math.floor(x / b), (x % b).toString(16).toUpperCase()]); x = Math.floor(x / b); } steps = `<p>${to}${ro(to)} 계속 나누고 나머지를 아래에서 위로 읽어.</p>${table(['수', `÷${to} 몫`, '나머지'], rows)}<p>→ <b>${ans}</b></p>`; }
  else if (from === '2' && to === '10') steps = `<p>${bin.split('').map((d, i) => `${d}×2^${bin.length - 1 - i}`).join(' + ')} = <b>${v}</b></p>`;
  else if (from === '2') { const pad = bin.padStart(Math.ceil(bin.length / 4) * 4, '0'); steps = `<p>오른쪽부터 4자리씩 끊어: ${pad.match(/.{4}/g).join(' ')} → <b>${hex}</b></p>`; }
  else steps = `<p>16진 한 자리 = 2진 4자리: ${hex.split('').map(h => parseInt(h, 16).toString(2).padStart(4, '0')).join(' ')} → 앞의 0을 빼면 <b>${bin}</b></p>`;
  return { stem, input: to === '10' ? '숫자' : `${to}진수`, answer: ans, check: check.bits(ans), steps, nodes: [4] };
}
function twos(T) {
  const kind = T.pick(['encode', 'decode']);
  if (kind === 'encode') {
    const v = T.int(5, 120), pos = v.toString(2).padStart(8, '0'), inv = pos.split('').map(b => b === '0' ? '1' : '0').join(''), ans = ((256 - v) & 255).toString(2).padStart(8, '0');
    return { stem: `<p class="qtext"><b>−${v}</b>${josa(v, '을', '를')} 8비트 2의 보수로 나타내면?</p>`, input: '8비트', answer: ans, check: check.bits(ans), steps: code([`+${v}       = ${pos}`, `1의 보수  = ${inv}  (전부 뒤집기)`, `+1        = ${ans}`]), nodes: [16] };
  }
  const v = T.int(5, 120), bits = ((256 - v) & 255).toString(2).padStart(8, '0');
  const inv = bits.split('').map(b => b === '0' ? '1' : '0').join('');
  return { stem: `<p class="qtext">8비트 2의 보수 <b>${bits}</b>가 나타내는 10진수는?</p>`, input: '숫자 (음수면 −)', answer: String(-v), check: check.num(-v, 0), steps: code([`맨 앞 비트가 1 → 음수`, `뒤집고 +1: ${inv} + 1 = ${v.toString(2).padStart(8, '0')} = ${v}`, `→ −${v}`]), nodes: [16] };
}
function gray(T) {
  const n = T.int(4, 6), b = Array.from({ length: n }, (_, i) => i === 0 ? '1' : T.pick(['0', '1'])).join('');
  const g = b.split('').map((c, i) => i === 0 ? c : String(+b[i - 1] ^ +c)).join('');
  if (T.pick([true, false])) return { stem: `<p class="qtext">2진수 <b>${b}</b>${josa(b, '을', '를')} 그레이 코드로 바꾸면?</p>`, input: '비트', answer: g, check: check.bits(g), steps: `<p>첫 비트는 그대로, 그다음은 <b>바로 앞 2진 비트 XOR 지금 비트</b>.</p>${code(b.split('').map((c, i) => i === 0 ? `g1 = ${c}` : `g${i + 1} = ${b[i - 1]} ⊕ ${c} = ${g[i]}`))}<p>→ <b>${g}</b></p>`, nodes: [21] };
  const back = []; let prev = '';
  for (let i = 0; i < n; i++) { const v = i === 0 ? g[0] : String(+prev ^ +g[i]); back.push(i === 0 ? `b1 = ${v}` : `b${i + 1} = ${prev} ⊕ ${g[i]} = ${v}`); prev = v; }
  return { stem: `<p class="qtext">그레이 코드 <b>${g}</b>${josa(g, '을', '를')} 2진수로 바꾸면?</p>`, input: '비트', answer: b, check: check.bits(b), steps: `<p>첫 비트는 그대로, 그다음은 <b>방금 구한 2진 비트 XOR 지금 그레이 비트</b>.</p>${code(back)}<p>→ <b>${b}</b></p>`, nodes: [21] };
}
function hamming(T) {
  const d = Array.from({ length: 4 }, () => T.int(0, 1));
  const p1 = d[0] ^ d[1] ^ d[3], p2 = d[0] ^ d[2] ^ d[3], p4 = d[1] ^ d[2] ^ d[3];
  const codeword = [p1, p2, d[0], p4, d[1], d[2], d[3]];
  if (T.pick([true, false])) {
    const bits = Array.from({ length: 7 }, () => T.int(0, 1)), ones = bits.filter(Boolean).length, even = T.pick([true, false]);
    const pb = even ? ones % 2 : 1 - ones % 2;
    return { stem: `<p class="qtext">7비트 데이터 <b>${bits.join('')}</b>에 <b>${even ? '짝수' : '홀수'} 패리티</b> 비트를 붙일 때 패리티 비트 값은?</p>`, input: '0 또는 1', answer: String(pb), check: check.bits(String(pb)), steps: `<p>1의 개수 = ${ones}. 전체 1의 개수가 ${even ? '짝수' : '홀수'}가 되게 → <b>${pb}</b></p>`, nodes: [23] };
  }
  const pos = T.int(1, 7), recv = codeword.slice(); recv[pos - 1] ^= 1;
  const c1 = recv[0] ^ recv[2] ^ recv[4] ^ recv[6], c2 = recv[1] ^ recv[2] ^ recv[5] ^ recv[6], c4 = recv[3] ^ recv[4] ^ recv[5] ^ recv[6];
  const syn = c4 * 4 + c2 * 2 + c1;
  return { stem: `<p class="qtext">짝수 패리티 해밍 코드(위치 1~7 = P1 P2 D1 P4 D2 D3 D4)를 받았더니 <b>${recv.join('')}</b>였어. 오류가 1비트일 때 <b>오류 위치</b>는?</p>`, input: '1~7', answer: String(syn), check: check.num(syn, 0),
    steps: code([`C1 = 1·3·5·7번 XOR = ${recv[0]}⊕${recv[2]}⊕${recv[4]}⊕${recv[6]} = ${c1}`, `C2 = 2·3·6·7번 XOR = ${recv[1]}⊕${recv[2]}⊕${recv[5]}⊕${recv[6]} = ${c2}`, `C4 = 4·5·6·7번 XOR = ${recv[3]}⊕${recv[4]}⊕${recv[5]}⊕${recv[6]} = ${c4}`, `C4 C2 C1 = ${c4}${c2}${c1}(2) = ${syn}번 비트 오류`, `고치면 ${codeword.join('')}`]), nodes: [23] };
}
function pipeline(T) {
  const k = T.int(3, 6), n = T.int(6, 40);
  if (T.pick([true, false])) return { stem: `<p class="qtext">${k}단계 파이프라인에서 명령어 <b>${n}개</b>를 처리하는 데 필요한 클록 수는? (해저드 없음)</p>`, input: '숫자', answer: String(k + n - 1), check: check.num(k + n - 1, 0), steps: `<p>첫 명령어가 ${k}클록에 끝나고, 그 뒤로 한 클록마다 하나씩 끝나. k + n − 1 = ${k} + ${n} − 1 = <b>${k + n - 1}</b></p>`, nodes: [49] };
  const sp = r2(n * k / (k + n - 1));
  return { stem: `<p class="qtext">${k}단계 파이프라인에서 명령어 ${n}개를 처리할 때, 파이프라인이 없을 때보다 몇 배 빠른가? (속도 향상, 소수 둘째 자리까지)</p>`, input: '숫자', answer: String(sp), check: check.num(sp, 0.011), steps: `<p>없을 때 n·k = ${n * k}클록, 있을 때 k+n−1 = ${k + n - 1}클록 → ${n * k} ÷ ${k + n - 1} = <b>${sp}</b></p>`, nodes: [49] };
}
function cpu(T) {
  const clock = T.pick([500, 800, 1000, 1200, 2000, 2400]), cpi = T.pick([1, 1.5, 2, 2.5, 4]);
  if (T.pick([true, false])) { const mips = r2(clock / cpi); return { stem: `<p class="qtext">클럭 <b>${clock}MHz</b>, 평균 CPI <b>${cpi}</b>인 CPU의 MIPS는?</p>`, input: '숫자', answer: String(mips), check: check.num(mips, 0.011), steps: `<p>MIPS = 클럭(MHz) ÷ CPI = ${clock} ÷ ${cpi} = <b>${mips}</b></p>`, nodes: [48] }; }
  const ic = T.pick([2, 4, 5, 6, 8, 10]) * 1e6, ms = r2(ic * cpi / (clock * 1e6) * 1000);
  return { stem: `<p class="qtext">명령어 <b>${ic / 1e6}백만 개</b>, 평균 CPI <b>${cpi}</b>, 클럭 <b>${clock}MHz</b>일 때 CPU 실행 시간은 몇 ms? (소수 둘째 자리까지)</p>`, input: 'ms', answer: String(ms), check: check.num(ms, 0.011), steps: `<p>CPU 시간 = 명령어 수 × CPI ÷ 클럭 = ${ic / 1e6}×10⁶ × ${cpi} ÷ (${clock}×10⁶) 초 = <b>${ms}ms</b></p>`, nodes: [48] };
}
function cacheAvg(T) {
  const h = T.pick([0.8, 0.85, 0.9, 0.95, 0.98]), tc = T.pick([2, 5, 10, 20]), tm = T.pick([50, 60, 100, 120, 200]);
  const avg = r2(h * tc + (1 - h) * (tc + tm));
  return { stem: `<p class="qtext">캐시 적중률 <b>${h * 100}%</b>, 캐시 접근 <b>${tc}ns</b>, 주기억 접근 <b>${tm}ns</b>일 때 평균 접근 시간은? (실패하면 캐시를 본 뒤 주기억에 가서 <b>${tc}+${tm}ns</b>가 든다)</p>`, input: 'ns', answer: String(avg), check: check.num(avg, 0.011), steps: `<p>평균 = h·Tc + (1−h)·(Tc+Tm) = ${h}×${tc} + ${r2(1 - h)}×${tc + tm} = <b>${avg}ns</b></p>`, nodes: [55] };
}
function marmbr(T) {
  const k = T.int(10, 20), w = T.pick([8, 16, 24, 32]), words = 2 ** k;
  const pretty = words >= 1024 ? `${words / 1024}K` : String(words);
  return { stem: `<p class="qtext">용량이 <b>${pretty} × ${w}비트</b>인 주기억장치의 MAR과 MBR은 각각 몇 비트?</p>`, input: 'MAR MBR (예: 12 16)', answer: `${k} ${w}`, check: check.nums([k, w]), steps: `<p>MAR = 워드 수를 가리킬 주소 비트: ${pretty} = 2^${k} → <b>${k}비트</b>. MBR = 한 워드 크기 → <b>${w}비트</b>.</p>`, nodes: [36] };
}
function raid(T) {
  const lvl = T.pick([0, 1, 5, 6]), n = lvl === 1 ? T.pick([2, 4, 6]) : T.int(lvl === 6 ? 4 : 3, 8), s = T.pick([500, 1000, 2000, 4000]);
  const cap = { 0: n * s, 1: n * s / 2, 5: (n - 1) * s, 6: (n - 2) * s }[lvl];
  const why = { 0: '나눠 쓰기만 해서 전부 사용', 1: '똑같이 복제해서 절반', 5: '디스크 1개 분량이 패리티', 6: '디스크 2개 분량이 패리티' }[lvl];
  return { stem: `<p class="qtext">${s}GB 디스크 <b>${n}개</b>로 <b>RAID ${lvl}</b>${josa(lvl, '을', '를')} 만들면 실제로 쓸 수 있는 용량은 몇 GB?</p>`, input: 'GB', answer: String(cap), check: check.num(cap, 0), steps: `<p>RAID ${lvl}: ${why} → <b>${cap}GB</b></p>`, nodes: [62] };
}
export function toPostfix(tokens) {
  const prec = { '+': 1, '-': 1, '*': 2, '/': 2 }, out = [], st = [];
  for (const t of tokens) {
    if (/^[A-Z]$/.test(t)) out.push(t);
    else if (t === '(') st.push(t);
    else if (t === ')') { while (st.length && st[st.length - 1] !== '(') out.push(st.pop()); st.pop(); }
    else { while (st.length && st[st.length - 1] !== '(' && prec[st[st.length - 1]] >= prec[t]) out.push(st.pop()); st.push(t); }
  }
  while (st.length) out.push(st.pop());
  return out;
}
function postfix(T) {
  const L = 'ABCDE'.split(''), ops = ['+', '-', '*', '/'];
  const forms = [
    () => ['(', 'A', T.pick(ops), 'B', ')', T.pick(ops), 'C'],
    () => ['A', T.pick(ops), 'B', T.pick(ops), 'C', T.pick(ops), 'D'],
    () => ['(', 'A', T.pick(ops), 'B', ')', T.pick(ops), '(', 'C', T.pick(ops), 'D', ')'],
    () => ['A', T.pick(ops), '(', 'B', T.pick(ops), 'C', ')', T.pick(ops), 'D'],
    () => ['(', 'A', T.pick(ops), 'B', ')', T.pick(ops), 'C', T.pick(ops), 'D', T.pick(ops), 'E'],
  ];
  const tk = T.pick(forms)(); const ans = toPostfix(tk).join('');
  const infix = tk.join(' ').replace(/\( /g, '(').replace(/ \)/g, ')');
  return { stem: `<p class="qtext">중위 표기 <b>${esc(infix)}</b>${josa(infix, '을', '를')} 후위 표기로 바꾸면?</p>`, input: '예: AB+C*', answer: ans, check: check.text(ans), steps: `<p>피연산자는 바로 쓰고, 연산자는 스택에 넣되 <b>우선순위가 같거나 높은 연산자가 스택 위에 있으면 먼저 꺼내.</b> 괄호가 닫히면 여는 괄호까지 꺼내.</p><p>→ <b>${esc(ans)}</b></p>`, nodes: [42] };
}

// ═════════ 알고리즘 ═════════
export function sortPasses(a, kind, k) {
  const x = a.slice(), snaps = [];
  if (kind === '선택') for (let i = 0; i < k; i++) { let m = i; for (let j = i + 1; j < x.length; j++) if (x[j] < x[m]) m = j; [x[i], x[m]] = [x[m], x[i]]; snaps.push(x.slice()); }
  if (kind === '버블') for (let p = 0; p < k; p++) { for (let j = 0; j < x.length - 1 - p; j++) if (x[j] > x[j + 1]) [x[j], x[j + 1]] = [x[j + 1], x[j]]; snaps.push(x.slice()); }
  if (kind === '삽입') for (let i = 1; i <= k; i++) { const v = x[i]; let j = i - 1; while (j >= 0 && x[j] > v) { x[j + 1] = x[j]; j--; } x[j + 1] = v; snaps.push(x.slice()); }
  return snaps;
}
function sortpass(T) {
  const kind = T.pick(['선택', '버블', '삽입']), a = T.distinct(6, 1, 30), k = T.int(1, 3);
  const snaps = sortPasses(a, kind, k), ans = snaps[k - 1];
  const rule = { 선택: '남은 것 중 가장 작은 값을 찾아 맨 앞과 바꾸는 것이 1회전', 버블: '앞에서부터 이웃끼리 비교해 큰 값을 뒤로 보내 끝까지 가는 것이 1회전', 삽입: '두 번째 값부터 하나씩 앞쪽 정렬된 부분에 끼워 넣는 것이 1회전' }[kind];
  return { stem: `<p class="qtext">오름차순 <b>${kind} 정렬</b>에서 <b>${k}회전</b>이 끝난 뒤 배열은?</p>${code([a.join(' ')])}<p class="note">${rule}.</p>`, input: '배열 (예: 1 5 3 …)', answer: ans.join(' '), check: check.seq(ans), steps: code([`처음  : ${a.join(' ')}`, ...snaps.map((s, i) => `${i + 1}회전: ${s.join(' ')}`)]), nodes: [{ 선택: 31, 버블: 32, 삽입: 33 }[kind]] };
}
function bsearch(T) {
  const n = T.int(9, 15), arr = T.distinct(n, 2, 99).sort((a, b) => a - b), target = T.pick(arr);
  let lo = 0, hi = n - 1; const seen = [], rows = [];
  while (lo <= hi) { const mid = Math.floor((lo + hi) / 2); seen.push(arr[mid]); rows.push([lo, hi, mid, arr[mid], arr[mid] === target ? '찾음' : arr[mid] < target ? '오른쪽으로' : '왼쪽으로']); if (arr[mid] === target) break; if (arr[mid] < target) lo = mid + 1; else hi = mid - 1; }
  return { stem: `<p class="qtext">다음 정렬된 배열에서 이진 탐색으로 <b>${target}</b>${josa(target, '을', '를')} 찾을 때, <b>비교하는 값을 순서대로</b> 쓰면? (mid = ⌊(low+high)/2⌋, 인덱스 0부터)</p>${code([arr.join(' ')])}`, input: '값 순서 (예: 25 56)', answer: seen.join(' '), check: check.seq(seen), steps: table(['low', 'high', 'mid', 'arr[mid]', ''], rows), nodes: [43] };
}
function bstBuild(keys) { const root = { v: keys[0] }; for (const k of keys.slice(1)) { let c = root; for (;;) { const d = k < c.v ? 'l' : 'r'; if (!c[d]) { c[d] = { v: k }; break; } c = c[d]; } } return root; }
export function order(t, kind) { const out = []; const f = n => { if (!n) return; if (kind === 'pre') out.push(n.v); f(n.l); if (kind === 'in') out.push(n.v); f(n.r); if (kind === 'post') out.push(n.v); }; if (kind === 'level') { const q = [t]; while (q.length) { const n = q.shift(); out.push(n.v); if (n.l) q.push(n.l); if (n.r) q.push(n.r); } } else f(t); return out; }
function treeSvg(t) {
  let x = 0; const pos = new Map(), edges = []; let depth = 0;
  const walk = (n, d) => { if (!n) return; walk(n.l, d + 1); pos.set(n, { x: x++, d }); depth = Math.max(depth, d); walk(n.r, d + 1); };
  walk(t, 0);
  const W = 46, H = 56, P = 22, w = (x - 1) * W + P * 2, h = depth * H + P * 2;
  const pt = n => { const p = pos.get(n); return [P + p.x * W, P + p.d * H]; };
  for (const [n] of pos) for (const c of [n.l, n.r]) if (c) { const [a, b] = pt(n), [cx, cy] = pt(c); edges.push(`<line x1="${a}" y1="${b}" x2="${cx}" y2="${cy}" stroke="currentColor" stroke-opacity=".45"/>`); }
  const nodes = [...pos.keys()].map(n => { const [a, b] = pt(n); return `<circle cx="${a}" cy="${b}" r="15" fill="var(--surface)" stroke="currentColor"/><text x="${a}" y="${b + 4.5}" text-anchor="middle" font-size="13" fill="currentColor">${esc(n.v)}</text>`; });
  return `<svg class="gen-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="이진 트리">${edges.join('')}${nodes.join('')}</svg>`;
}
const ORDER = { pre: '전위', in: '중위', post: '후위', level: '레벨' };
function bst(T) {
  const keys = T.distinct(7, 10, 99), kind = T.pick(['pre', 'post', 'level']), t = bstBuild(keys), ans = order(t, kind);
  return { stem: `<p class="qtext">빈 이진 탐색 트리에 다음 순서로 넣은 뒤 <b>${ORDER[kind]} 순회</b> 결과는?</p>${code([keys.join(', ')])}`, input: '값 순서', answer: ans.join(' '), check: check.seq(ans), steps: `<p>완성된 트리</p>${treeSvg(t)}<p>${ORDER[kind]} 순회 → <b>${ans.join(' ')}</b></p>`, nodes: [26, 23] };
}
function traverse(T) {
  const labels = 'ABCDEFGHI'.split('').slice(0, T.int(7, 9));
  const root = { v: labels[0] }, all = [root];
  for (const v of labels.slice(1)) { for (;;) { const p = T.pick(all), d = T.pick(['l', 'r']); if (!p[d] && depthOf(root, p) < 3) { p[d] = { v }; all.push(p[d]); break; } } }
  const kind = T.pick(['pre', 'in', 'post']), ans = order(root, kind);
  return { stem: `<p class="qtext">다음 이진 트리를 <b>${ORDER[kind]} 순회</b>하면?</p>${treeSvg(root)}`, input: '예: A B D …', answer: ans.join(' '), check: check.seq(ans), steps: `<p>${{ pre: '나 → 왼쪽 → 오른쪽', in: '왼쪽 → 나 → 오른쪽', post: '왼쪽 → 오른쪽 → 나' }[kind]} 순서를 모든 노드에 똑같이 적용해.</p><p>→ <b>${ans.join(' ')}</b></p>`, nodes: [23] };
}
function depthOf(root, target) { let d = -1; const f = (n, k) => { if (!n) return; if (n === target) d = k; f(n.l, k + 1); f(n.r, k + 1); }; f(root, 0); return d; }
export function heapInsert(keys) { const h = [], snaps = []; for (const k of keys) { h.push(k); let i = h.length - 1; while (i > 0) { const p = Math.floor((i - 1) / 2); if (h[p] >= h[i]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } snaps.push(h.slice()); } return snaps; }
function heap(T) {
  const keys = T.distinct(T.int(6, 8), 1, 50), snaps = heapInsert(keys), ans = snaps[snaps.length - 1];
  return { stem: `<p class="qtext">빈 <b>최대 힙</b>에 다음 순서로 넣은 뒤 힙을 배열(레벨 순서)로 쓰면?</p>${code([keys.join(', ')])}`, input: '배열', answer: ans.join(' '), check: check.seq(ans), steps: `<p>맨 끝에 넣고 부모보다 크면 계속 바꿔 올려.</p>${code(keys.map((k, i) => `${k} 넣음 → ${snaps[i].join(' ')}`))}`, nodes: [29] };
}
function hash(T) {
  const m = T.pick([7, 11, 13]), keys = T.distinct(T.int(5, 6), 10, 99), slots = Array(m).fill(null), rows = [];
  for (const k of keys) { let h = k % m, probes = [h]; while (slots[h] !== null) { h = (h + 1) % m; probes.push(h); } slots[h] = k; rows.push([k, `${k} mod ${m} = ${k % m}`, probes.join(' → ')]); }
  const target = keys[keys.length - 1], ans = slots.indexOf(target);
  return { stem: `<p class="qtext">크기 ${m}인 해시 테이블, h(k) = k mod ${m}, <b>선형 조사</b>로 다음 키를 순서대로 넣을 때 마지막 키 <b>${target}</b>${josa(target, '은', '는')} 몇 번 칸에 들어가? (칸 번호 0부터)</p>${code([keys.join(', ')])}`, input: '칸 번호', answer: String(ans), check: check.num(ans, 0), steps: table(['키', '해시', '찾은 칸'], rows), nodes: [46, 45] };
}
function graphSvg(V, E, weighted) {
  const R = 78, cx = 110, cy = 100, pts = {}; V.forEach((v, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / V.length; pts[v] = [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
  const lines = E.map(([a, b, w]) => { const [x1, y1] = pts[a], [x2, y2] = pts[b]; const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-opacity=".45"/>${weighted ? `<text x="${mx}" y="${my - 3}" text-anchor="middle" font-size="12" fill="currentColor" paint-order="stroke" stroke="var(--surface)" stroke-width="4">${w}</text>` : ''}`; });
  const nodes = V.map(v => `<circle cx="${pts[v][0]}" cy="${pts[v][1]}" r="14" fill="var(--surface)" stroke="currentColor"/><text x="${pts[v][0]}" y="${pts[v][1] + 4.5}" text-anchor="middle" font-size="13" fill="currentColor">${v}</text>`);
  return `<svg class="gen-svg" viewBox="0 0 220 200" width="220" height="200" role="img" aria-label="그래프">${lines.join('')}${nodes.join('')}</svg>`;
}
function randGraph(T, n, extra, weighted) {
  const V = 'ABCDEFG'.split('').slice(0, n), E = [], has = new Set(), key = (a, b) => [a, b].sort().join('');
  for (let i = 1; i < n; i++) { const a = V[i], b = V[T.int(0, i - 1)]; E.push([b, a]); has.add(key(a, b)); }
  let guard = 0; while (E.length < n - 1 + extra && guard++ < 100) { const a = T.pick(V), b = T.pick(V); if (a !== b && !has.has(key(a, b))) { E.push([a, b]); has.add(key(a, b)); } }
  if (weighted) { const ws = T.shuffle(Array.from({ length: 15 }, (_, i) => i + 1)); E.forEach((e, i) => e.push(ws[i])); }
  return { V, E };
}
const adj = (V, E) => { const m = Object.fromEntries(V.map(v => [v, []])); for (const [a, b, w] of E) { m[a].push([b, w]); m[b].push([a, w]); } for (const v of V) m[v].sort((x, y) => x[0] < y[0] ? -1 : 1); return m; };
export function dfs(V, E, s) { const A = adj(V, E), seen = new Set(), out = []; const go = v => { seen.add(v); out.push(v); for (const [u] of A[v]) if (!seen.has(u)) go(u); }; go(s); return out; }
export function bfs(V, E, s) { const A = adj(V, E), seen = new Set([s]), q = [s], out = []; while (q.length) { const v = q.shift(); out.push(v); for (const [u] of A[v]) if (!seen.has(u)) { seen.add(u); q.push(u); } } return out; }
function traversal(T) {
  const g = randGraph(T, T.int(6, 7), T.int(2, 3), false), kind = T.pick(['DFS', 'BFS']), ans = kind === 'DFS' ? dfs(g.V, g.E, 'A') : bfs(g.V, g.E, 'A');
  return { stem: `<p class="qtext">A에서 시작해 <b>${kind}</b>로 방문하는 순서는? (이웃이 여럿이면 <b>알파벳 순서</b>로)</p>${graphSvg(g.V, g.E, false)}${code(['간선: ' + g.E.map(e => e[0] + e[1]).join(' ')])}`, input: '예: A B D …', answer: ans.join(' '), check: check.seq(ans), steps: `<p>${kind === 'DFS' ? '갈 수 있는 데까지 깊이 가고, 막히면 되돌아와서 다음 이웃으로 (스택·재귀).' : '시작점의 이웃을 모두 큐에 넣고, 꺼낸 순서대로 그 이웃을 또 넣어 (한 겹씩).'}</p><p>→ <b>${ans.join(' ')}</b></p>`, nodes: [kind === 'DFS' ? 50 : 51] };
}
export function dijkstra(V, E, s) {
  const A = adj(V, E), dist = Object.fromEntries(V.map(v => [v, Infinity])), done = new Set(), rows = []; dist[s] = 0;
  while (done.size < V.length) {
    const u = V.filter(v => !done.has(v)).sort((a, b) => dist[a] - dist[b] || (a < b ? -1 : 1))[0]; done.add(u);
    for (const [v, w] of A[u]) if (!done.has(v) && dist[u] + w < dist[v]) dist[v] = dist[u] + w;
    rows.push([u, ...V.map(v => dist[v] === Infinity ? '∞' : dist[v])]);
  }
  return { dist, rows };
}
function shortest(T) {
  const g = randGraph(T, T.int(5, 6), T.int(2, 3), true), { dist, rows } = dijkstra(g.V, g.E, 'A'), others = g.V.slice(1), ans = others.map(v => dist[v]);
  return { stem: `<p class="qtext">다익스트라로 A에서 각 정점까지 <b>최단 거리</b>를 구해 ${others.join(' ')} 순서로 쓰면?</p>${graphSvg(g.V, g.E, true)}${code(['간선(가중치): ' + g.E.map(e => `${e[0]}${e[1]}(${e[2]})`).join(' ')])}`, input: '거리 순서 (예: 3 5 …)', answer: ans.join(' '), check: check.nums(ans), steps: `<p>아직 확정 안 된 정점 중 거리가 가장 짧은 것을 확정하고, 그 이웃의 거리를 줄일 수 있으면 줄여.</p>${table(['확정', ...g.V], rows)}`, nodes: [57] };
}
export function kruskal(V, E) {
  const parent = Object.fromEntries(V.map(v => [v, v])), find = x => parent[x] === x ? x : (parent[x] = find(parent[x])), pickd = [], rows = [];
  for (const [a, b, w] of E.slice().sort((x, y) => x[2] - y[2])) { const ra = find(a), rb = find(b); if (ra !== rb) { parent[ra] = rb; pickd.push([a, b, w]); rows.push([`${a}${b}`, w, '선택']); } else rows.push([`${a}${b}`, w, '사이클 → 버림']); if (pickd.length === V.length - 1) break; }
  return { total: pickd.reduce((s, e) => s + e[2], 0), rows };
}
function mst(T) {
  const g = randGraph(T, T.int(5, 6), T.int(2, 4), true), { total, rows } = kruskal(g.V, g.E);
  return { stem: `<p class="qtext">크루스칼 알고리즘으로 구한 <b>최소 비용 신장 트리의 총 비용</b>은?</p>${graphSvg(g.V, g.E, true)}${code(['간선(가중치): ' + g.E.map(e => `${e[0]}${e[1]}(${e[2]})`).join(' ')])}`, input: '숫자', answer: String(total), check: check.num(total, 0), steps: `<p>가중치가 작은 간선부터, 사이클이 생기지 않으면 고른다. 정점 ${g.V.length}개면 간선 ${g.V.length - 1}개에서 끝.</p>${table(['간선', '가중치', ''], rows)}<p>총 비용 <b>${total}</b></p>`, nodes: [55, 54] };
}
export function topo(V, E) { const indeg = Object.fromEntries(V.map(v => [v, 0])); for (const [, b] of E) indeg[b]++; const out = [], rows = []; const ready = () => V.filter(v => indeg[v] === 0 && !out.includes(v)).sort(); while (out.length < V.length) { const r = ready(); const v = r[0]; rows.push([r.join(' '), v]); out.push(v); for (const [a, b] of E) if (a === v) indeg[b]--; } return { out, rows }; }
function topoq(T) {
  const n = T.int(5, 6), V = 'ABCDEF'.split('').slice(0, n), order0 = T.shuffle(V), E = [], has = new Set();
  for (let i = 1; i < n; i++) { const a = order0[T.int(0, i - 1)], b = order0[i]; E.push([a, b]); has.add(a + b); }
  for (let k = 0; k < 2; k++) { const i = T.int(0, n - 2), j = T.int(i + 1, n - 1), a = order0[i], b = order0[j]; if (!has.has(a + b)) { E.push([a, b]); has.add(a + b); } }
  const { out, rows } = topo(V, E);
  return { stem: `<p class="qtext">다음 방향 그래프를 위상 정렬하면? (들어오는 간선이 없는 정점이 여럿이면 <b>알파벳 순서</b>로)</p>${code(['간선(앞 → 뒤): ' + E.map(e => `${e[0]}→${e[1]}`).join(' ')])}`, input: '예: A C B …', answer: out.join(' '), check: check.seq(out), steps: `${table(['진입 차수 0인 정점', '꺼냄'], rows)}<p>→ <b>${out.join(' ')}</b></p>`, nodes: [52] };
}
const BIGO = ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n²)', 'O(n³)', 'O(2ⁿ)'];
function bigo(T) {
  const forms = [
    { c: ['for (i = 0; i < n; i++)', '    sum += i;'], a: 'O(n)', w: '한 번 도는 반복 n번' },
    { c: ['for (i = 0; i < n; i++)', '    for (j = 0; j < n; j++)', '        sum++;'], a: 'O(n²)', w: 'n번 안에 n번' },
    { c: ['for (i = 0; i < n; i++)', '    for (j = 0; j < i; j++)', '        sum++;'], a: 'O(n²)', w: '0+1+…+(n−1) = n(n−1)/2' },
    { c: ['for (i = n; i > 1; i = i / 2)', '    sum++;'], a: 'O(log n)', w: '반씩 줄면 log₂n번' },
    { c: ['for (i = 0; i < n; i++)', '    for (j = 1; j < n; j = j * 2)', '        sum++;'], a: 'O(n log n)', w: 'n번 × log n번' },
    { c: ['for (i = 0; i < n; i++)', '    for (j = 0; j < n; j++)', '        for (k = 0; k < n; k++)', '            sum++;'], a: 'O(n³)', w: 'n × n × n' },
    { c: ['sum = n * (n + 1) / 2;'], a: 'O(1)', w: 'n과 상관없이 한 번' },
    { c: ['for (i = 0; i < n; i++) sum++;', 'for (j = 0; j < n; j++) sum++;'], a: 'O(n)', w: 'n + n = 2n, 계수는 버림' },
    { c: ['int f(int n) {', '    if (n <= 1) return 1;', '    return f(n - 1) + f(n - 1);', '}'], a: 'O(2ⁿ)', w: '한 번 부를 때마다 둘로 갈라짐: T(n) = 2T(n−1) + 1' },
  ];
  const f = T.pick(forms), wrong = T.shuffle(BIGO.filter(x => x !== f.a)).slice(0, 3), opts = T.shuffle([f.a, ...wrong]);
  return { kind: 'mcq', stem: `<p class="qtext">다음 코드의 시간 복잡도는?</p>${code(f.c)}`, opts, answer: opts.indexOf(f.a), steps: `<p>${f.w} → <b>${f.a}</b></p>`, nodes: [11, 9] };
}
function recur(T) {
  const forms = [['T(n) = T(n/2) + 1', 'O(log n)', '이진 탐색: 반씩 줄이며 한 번씩'], ['T(n) = 2T(n/2) + n', 'O(n log n)', '병합 정렬: 높이 log n, 층마다 n'], ['T(n) = T(n−1) + n', 'O(n²)', 'n + (n−1) + … + 1'], ['T(n) = 2T(n−1) + 1', 'O(2ⁿ)', '하노이 탑: 매번 두 배'], ['T(n) = T(n−1) + 1', 'O(n)', '한 번씩 n번'], ['T(n) = 2T(n/2) + 1', 'O(n)', '1 + 2 + 4 + … + n ≈ 2n']];
  const [eq, a, w] = T.pick(forms), wrong = T.shuffle(BIGO.filter(x => x !== a)).slice(0, 3), opts = T.shuffle([a, ...wrong]);
  return { kind: 'mcq', stem: `<p class="qtext">점화식 <b>${eq}</b>의 시간 복잡도는?</p>`, opts, answer: opts.indexOf(a), steps: `<p>${w} → <b>${a}</b></p>`, nodes: [19] };
}

// ── 목록 ──
export const GENERATORS = [
  { id: 'fcfs', subject: 'tcs', label: 'FCFS 스케줄링', nodes: [86, 92], make: T => sched(T, 'FCFS') },
  { id: 'sjf', subject: 'tcs', label: 'SJF 스케줄링', nodes: [87, 92], make: T => sched(T, 'SJF') },
  { id: 'srt', subject: 'tcs', label: 'SRT 스케줄링', nodes: [90, 92], make: T => sched(T, 'SRT') },
  { id: 'rr', subject: 'tcs', label: 'RR 스케줄링', nodes: [89, 92], make: T => sched(T, 'RR') },
  { id: 'hrn', subject: 'tcs', label: 'HRN 스케줄링', nodes: [88, 92], make: T => sched(T, 'HRN') },
  { id: 'page', subject: 'tcs', label: '페이지 교체 부재 횟수', nodes: [115], make: pagerep },
  { id: 'disk', subject: 'tcs', label: '디스크 스케줄링 이동 거리', nodes: [119], make: disk },
  { id: 'base', subject: 'tcs', label: '진법 변환', nodes: [4], make: base },
  { id: 'twos', subject: 'tcs', label: '2의 보수', nodes: [16], make: twos },
  { id: 'gray', subject: 'tcs', label: '그레이 코드', nodes: [21], make: gray },
  { id: 'hamming', subject: 'tcs', label: '패리티·해밍 코드', nodes: [23], make: hamming },
  { id: 'pipeline', subject: 'tcs', label: '파이프라인 클록 수', nodes: [49], make: pipeline },
  { id: 'cpu', subject: 'tcs', label: 'CPU 성능 (MIPS·실행 시간)', nodes: [48], make: cpu },
  { id: 'cache', subject: 'tcs', label: '캐시 평균 접근 시간', nodes: [55], make: cacheAvg },
  { id: 'marmbr', subject: 'tcs', label: 'MAR·MBR 비트 수', nodes: [36], make: marmbr },
  { id: 'raid', subject: 'tcs', label: 'RAID 용량', nodes: [62], make: raid },
  { id: 'postfix', subject: 'tcs', label: '중위 → 후위 표기', nodes: [42], make: postfix },
  { id: 'sortpass', subject: 'alg', label: '정렬 회전 추적', nodes: [31, 32, 33], make: sortpass },
  { id: 'bsearch', subject: 'alg', label: '이진 탐색 비교 순서', nodes: [43], make: bsearch },
  { id: 'bst', subject: 'alg', label: 'BST 삽입 후 순회', nodes: [26, 23], make: bst },
  { id: 'traverse', subject: 'alg', label: '이진 트리 순회', nodes: [23], make: traverse },
  { id: 'heap', subject: 'alg', label: '최대 힙 삽입', nodes: [29], make: heap },
  { id: 'hash', subject: 'alg', label: '해싱 선형 조사', nodes: [46, 45], make: hash },
  { id: 'graphtrav', subject: 'alg', label: 'DFS·BFS 방문 순서', nodes: [50, 51], make: traversal },
  { id: 'dijkstra', subject: 'alg', label: '다익스트라 최단 거리', nodes: [57], make: shortest },
  { id: 'kruskal', subject: 'alg', label: '크루스칼 MST 비용', nodes: [55, 54], make: mst },
  { id: 'topo', subject: 'alg', label: '위상 정렬', nodes: [52], make: topoq },
  { id: 'bigo', subject: 'alg', label: '코드 시간 복잡도', nodes: [11, 9], make: bigo },
  { id: 'recur', subject: 'alg', label: '점화식 시간 복잡도', nodes: [19], make: recur },
];

// 생성기 id + seed → 문제 (다시 만들어도 같은 문제)
export function makeCalc(genId, seed) {
  const g = GENERATORS.find(x => x.id === genId);
  if (!g) throw new Error(`없는 계산 유형: ${genId}`);
  const q = g.make(tools(rng(seed)));
  return { gen: g.id, seed, subject: g.subject, label: g.label, kind: q.kind || 'calc', nodes: q.nodes || g.nodes, ...q };
}
