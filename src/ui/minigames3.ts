// Đợt C: bảo trì của Engineer, cạy / mở cửa thang máy, giả vờ gõ phím (kiểu Typer Shark), router, chấm công vân tay.
import { sfx } from '../audio';
import type { MiniCtx } from './minigames2';

type Builder = (c: MiniCtx & { hold?: (on: boolean) => void }) => void;
const rnd = (n: number) => Math.floor(Math.random() * n);
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = rnd(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const $ = <T extends Element = HTMLElement>(el: Element, s: string) => el.querySelector(s) as T;
const $$ = <T extends Element = HTMLElement>(el: Element, s: string) => [...el.querySelectorAll(s)] as T[];

// ---------------------------------------------------------------------------------------------
// Bảo trì nóc thang máy: 4 con ốc đầu bông tuyết, mỗi con 4 hướng; bấm xoay 90° cho khớp mũi tên
// ---------------------------------------------------------------------------------------------
const mt_lift: Builder = (c) => {
  const target = [0, 1, 2, 3].map(() => rnd(4));
  const cur = target.map(t => (t + 1 + rnd(3)) % 4);
  c.body.innerHTML = `<div class="ml3"><div class="ml3-plate">${cur.map((_, i) => `<div class="ml3-slot"><i class="ml3-arrow" style="transform:rotate(${target[i] * 90}deg)"></i><button type="button" class="ml3-bolt" data-i="${i}" aria-label="Ốc ${i + 1}">
    <svg viewBox="-20 -20 40 40"><g class="flake">${[0, 60, 120, 180, 240, 300].map(a => `<line x1="0" y1="0" x2="0" y2="-14" transform="rotate(${a})"/>`).join('')}<circle r="5"/><circle class="tip" cx="0" cy="-15" r="3.5"/></g></svg></button></div>`).join('')}</div>
    <p class="ml3-msg">Bấm vào ốc để xoay, cho chấm đỏ trùng với mũi tên vàng</p></div>`;
  const bolts = $$<HTMLButtonElement>(c.body, '.ml3-bolt');
  const paint = () => bolts.forEach((b, i) => { ($(b, '.flake') as unknown as SVGGElement).style.transform = `rotate(${cur[i] * 90}deg)`; b.classList.toggle('ok', cur[i] === target[i]); });
  bolts.forEach((b, i) => b.onclick = () => {
    if (c.isDone()) return;
    cur[i] = (cur[i] + 1) % 4; sfx.click(); paint();
    if (cur[i] === target[i]) sfx.ting();
    if (cur.every((v, k) => v === target[k])) c.done();
  });
  paint();
};

// ---------------------------------------------------------------------------------------------
// Sửa khóa tủ đồ: dò khóa số 3 chữ số; đèn mỗi số báo xanh (đúng) / vàng (gần) / đỏ (xa)
// ---------------------------------------------------------------------------------------------
const mt_cab: Builder = (c) => {
  const code = [rnd(10), rnd(10), rnd(10)];
  const cur = code.map(v => (v + 3 + rnd(5)) % 10);
  c.body.innerHTML = `<div class="mc3"><div class="mc3-door"><div class="mc3-lock">${cur.map((_, i) => `<div class="mc3-dial" data-i="${i}"><button type="button" data-d="1">▲</button><b>0</b><button type="button" data-d="-1">▼</button><i class="led"></i></div>`).join('')}</div>
    <p class="mc3-msg">Xoay từng số. Đèn xanh: đúng · vàng: gần đúng · đỏ: còn xa</p></div></div>`;
  const dials = $$(c.body, '.mc3-dial');
  const paint = () => dials.forEach((d, i) => {
    ($(d, 'b')).textContent = String(cur[i]);
    const dist = Math.min((cur[i] - code[i] + 10) % 10, (code[i] - cur[i] + 10) % 10);
    ($(d, '.led')).className = 'led ' + (dist === 0 ? 'g' : dist <= 2 ? 'y' : 'r');
  });
  dials.forEach((d, i) => $$<HTMLButtonElement>(d, 'button').forEach(b => b.onclick = () => {
    if (c.isDone()) return;
    cur[i] = (cur[i] + Number(b.dataset.d) + 10) % 10; sfx.click(); paint();
    if (cur.every((v, k) => v === code[k])) { ($(c.body, '.mc3-door')).classList.add('open'); c.done(); }
  }));
  paint();
};

// ---------------------------------------------------------------------------------------------
// Gia cố gầm bàn họp: đóng đinh cho bằng mặt; gõ thêm vào đinh đã bằng là đinh cong, phải nhổ ra đóng lại
// ---------------------------------------------------------------------------------------------
const mt_desk: Builder = (c) => {
  const h = [0, 1, 2, 3].map(() => 1 + rnd(3)); // số nhát còn lại
  const bent = [false, false, false, false];
  c.body.innerHTML = `<div class="md3"><div class="md3-beam">${h.map((_, i) => `<button type="button" class="md3-nail" data-i="${i}"><i class="shaft"></i><i class="head"></i></button>`).join('')}</div>
    <p class="md3-msg">Gõ từng cây đinh cho bằng mặt gỗ. Đinh đã bằng thì đừng gõ nữa!</p></div>`;
  const nails = $$<HTMLButtonElement>(c.body, '.md3-nail'), msg = $(c.body, '.md3-msg');
  const paint = () => nails.forEach((n, i) => { n.style.setProperty('--h', String(h[i])); n.classList.toggle('bent', bent[i]); n.classList.toggle('ok', h[i] === 0 && !bent[i]); });
  nails.forEach((n, i) => n.onclick = () => {
    if (c.isDone()) return;
    if (bent[i]) { bent[i] = false; h[i] = 2; sfx.whoosh(); msg.textContent = 'Đã nhổ đinh cong, đóng lại nào.'; paint(); return; }
    if (h[i] === 0) { bent[i] = true; c.fail(); msg.textContent = 'Gõ quá tay, đinh cong rồi! Bấm vào để nhổ ra.'; paint(); return; }
    h[i]--; sfx.stamp(); n.classList.remove('hit'); void n.offsetWidth; n.classList.add('hit'); paint();
    if (h.every(v => v === 0) && bent.every(b => !b)) c.done();
  });
  paint();
};

// ---------------------------------------------------------------------------------------------
// Sửa ống cáp: đổi chỗ các đầu cáp bên phải cho khớp màu bên trái (hết bắt chéo)
// ---------------------------------------------------------------------------------------------
const mt_floor: Builder = (c) => {
  const cols = ['#e2412f', '#f2b705', '#2e9cf0', '#3fbf6a'];
  let right = shuffle([0, 1, 2, 3]);
  while (right.every((v, i) => v === i)) right = shuffle([0, 1, 2, 3]);
  let sel: number | null = null;
  c.body.innerHTML = `<div class="mf3"><svg class="mf3-svg" viewBox="0 0 300 200" preserveAspectRatio="none"></svg>
    <div class="mf3-l">${cols.map(col => `<i style="--c:${col}"></i>`).join('')}</div><div class="mf3-r"></div>
    <p class="mf3-msg">Bấm 2 đầu cáp bên phải để đổi chỗ, cho các dây hết bắt chéo</p></div>`;
  const svg = $<SVGSVGElement>(c.body, '.mf3-svg'), R = $(c.body, '.mf3-r');
  const render = () => {
    svg.innerHTML = right.map((ci, slot) => { const y1 = 25 + ci * 50, y2 = 25 + slot * 50; return `<path d="M0 ${y1} C 150 ${y1}, 150 ${y2}, 300 ${y2}" stroke="${cols[ci]}" stroke-width="9" fill="none" stroke-linecap="round"/>`; }).join('');
    R.innerHTML = right.map((ci, slot) => `<button type="button" data-s="${slot}" style="--c:${cols[ci]}" class="${sel === slot ? 'sel' : ''}"></button>`).join('');
    $$<HTMLButtonElement>(R, 'button').forEach(b => b.onclick = () => {
      if (c.isDone()) return;
      const s = Number(b.dataset.s);
      if (sel === null) { sel = s; sfx.click(); render(); return; }
      if (sel !== s) { [right[sel], right[s]] = [right[s], right[sel]]; sfx.whoosh(); }
      sel = null; render();
      if (right.every((v, i) => v === i)) c.done();
    });
  };
  render();
};

// ---------------------------------------------------------------------------------------------
// Sửa ống gió: tháo 4 ốc lưới cũ → lau bụi trong ống → kéo lưới mới vào khe
// ---------------------------------------------------------------------------------------------
const mt_wc: Builder = (c) => {
  let stage = 0, dust = [100, 100, 100], down = false, lx = 0, ly = 0;
  c.body.innerHTML = `<div class="mw3"><div class="mw3-vent"><div class="mw3-inside">${dust.map((_, i) => `<i class="mw3-dust" data-i="${i}" style="left:${15 + i * 28}%;top:${25 + (i % 2) * 30}%"></i>`).join('')}</div>
    <div class="mw3-grill">${[0, 1, 2, 3].map(i => `<button type="button" class="mw3-screw s${i}"></button>`).join('')}</div><div class="mw3-slot"></div></div>
    <div class="mw3-new" draggable="false">Lưới lọc mới</div><p class="mw3-msg">Bước 1: bấm tháo 4 con ốc</p></div>`;
  const vent = $(c.body, '.mw3-vent'), grill = $(c.body, '.mw3-grill'), msg = $(c.body, '.mw3-msg'), fresh = $(c.body, '.mw3-new'), inside = $(c.body, '.mw3-inside');
  let screws = 4;
  $$<HTMLButtonElement>(c.body, '.mw3-screw').forEach(b => b.onclick = () => {
    if (stage !== 0 || b.classList.contains('off')) return;
    b.classList.add('off'); sfx.click();
    if (--screws === 0) { grill.classList.add('off'); stage = 1; msg.textContent = 'Bước 2: giữ chuột kéo qua lại để lau sạch bụi'; }
  });
  inside.addEventListener('pointerdown', (e) => { if (stage !== 1) return; down = true; lx = e.clientX; ly = e.clientY; inside.setPointerCapture(e.pointerId); e.preventDefault(); });
  inside.addEventListener('pointermove', (e) => {
    if (!down || stage !== 1) return;
    const d = Math.hypot(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('.mw3-dust') as HTMLElement | null;
    if (!el) return;
    const i = Number(el.dataset.i); if (dust[i] <= 0) return;
    dust[i] = Math.max(0, dust[i] - d * 1.1); el.style.opacity = String(dust[i] / 100);
    if (dust[i] <= 0) { el.remove(); sfx.ting(); }
    if (dust.every(v => v <= 0)) { stage = 2; msg.textContent = 'Bước 3: kéo lưới lọc mới vào khung'; fresh.classList.add('ready'); }
  });
  const stop = () => { down = false; }; inside.addEventListener('pointerup', stop); inside.addEventListener('pointercancel', stop);
  fresh.addEventListener('pointerdown', (e) => {
    if (stage !== 2 || c.isDone()) return;
    e.preventDefault(); fresh.setPointerCapture(e.pointerId);
    const r0 = fresh.getBoundingClientRect(), ox = e.clientX - r0.left, oy = e.clientY - r0.top;
    fresh.classList.add('drag');
    const mv = (m: PointerEvent) => { fresh.style.position = 'fixed'; fresh.style.left = (m.clientX - ox) + 'px'; fresh.style.top = (m.clientY - oy) + 'px'; };
    const up = (u: PointerEvent) => {
      fresh.removeEventListener('pointermove', mv); fresh.removeEventListener('pointerup', up);
      const v = vent.getBoundingClientRect();
      if (u.clientX > v.left && u.clientX < v.right && u.clientY > v.top && u.clientY < v.bottom) { fresh.remove(); grill.classList.remove('off'); grill.classList.add('new'); c.done(); }
      else { fresh.classList.remove('drag'); fresh.style.position = ''; fresh.style.left = ''; fresh.style.top = ''; c.toast('Kéo lưới vào đúng khung ống gió.'); }
    };
    fresh.addEventListener('pointermove', mv); fresh.addEventListener('pointerup', up);
  });
};

// ---------------------------------------------------------------------------------------------
// Cạy cửa thang máy: kéo xà beng vào khe cửa, rồi bẩy qua lại (trái, phải xen kẽ) cho khe mở rộng
// ---------------------------------------------------------------------------------------------
const pry: Builder = (c) => {
  let stage = 0, gap = 0, last = 0;
  c.body.innerHTML = `<div class="py3"><div class="py3-doors"><i class="dl"></i><i class="dr"></i><i class="py3-gap"></i><i class="py3-bar"></i></div>
    <div class="py3-tool">Xà beng</div>
    <div class="py3-ctrl" hidden><button type="button" data-d="-1">◀ Bẩy trái</button><div class="py3-meter"><i></i></div><button type="button" data-d="1">Bẩy phải ▶</button></div>
    <p class="py3-msg">Kéo xà beng vào khe giữa hai cánh cửa</p></div>`;
  const doors = $(c.body, '.py3-doors'), tool = $(c.body, '.py3-tool'), ctrl = $(c.body, '.py3-ctrl'), msg = $(c.body, '.py3-msg'), meter = $(c.body, '.py3-meter i'), bar = $(c.body, '.py3-bar');
  const render = () => { doors.style.setProperty('--gap', String(gap)); meter.style.width = gap + '%'; };
  tool.addEventListener('pointerdown', (e) => {
    if (stage !== 0) return; e.preventDefault(); tool.setPointerCapture(e.pointerId);
    const mv = (m: PointerEvent) => { tool.style.position = 'fixed'; tool.style.left = (m.clientX - 40) + 'px'; tool.style.top = (m.clientY - 14) + 'px'; };
    const up = (u: PointerEvent) => {
      tool.removeEventListener('pointermove', mv); tool.removeEventListener('pointerup', up);
      const r = doors.getBoundingClientRect(), mid = r.left + r.width / 2;
      if (Math.abs(u.clientX - mid) < 40 && u.clientY > r.top && u.clientY < r.bottom) {
        tool.remove(); doors.classList.add('bar-in'); stage = 1; ctrl.hidden = false; sfx.clank?.();
        msg.textContent = 'Bẩy trái, phải xen kẽ thật đều tay (hoặc phím ← →)';
      } else { tool.style.position = ''; tool.style.left = ''; tool.style.top = ''; c.toast('Đưa xà beng vào đúng khe giữa cửa.'); }
    };
    tool.addEventListener('pointermove', mv); tool.addEventListener('pointerup', up);
  });
  const lever = (d: number) => {
    if (stage !== 1 || c.isDone()) return;
    bar.style.transform = `translateX(-50%) rotate(${d * 18}deg)`;
    if (d === last) { msg.textContent = 'Phải đổi bên mới bẩy được!'; sfx.fail(); return; }
    last = d; gap = Math.min(100, gap + 7); sfx.click(); render();
    if (gap >= 100) { doors.classList.add('open'); c.done(); }
  };
  // khe tự khép dần nếu ngừng tay
  const id = window.setInterval(() => { if (stage === 1 && !c.isDone() && gap > 0) { gap = Math.max(0, gap - 1.2); render(); } }, 100);
  c.cleanups.push(() => clearInterval(id));
  $$<HTMLButtonElement>(c.body, '.py3-ctrl button').forEach(b => b.onclick = () => lever(Number(b.dataset.d)));
  const key = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft') lever(-1); if (e.key === 'ArrowRight') lever(1); };
  window.addEventListener('keydown', key); c.cleanups.push(() => window.removeEventListener('keydown', key));
  render();
};

// ---------------------------------------------------------------------------------------------
// Engineer mở cửa thang: tra chìa khóa cứu hộ, xoay đúng chiều, kéo hai cánh cửa sang hai bên
// ---------------------------------------------------------------------------------------------
const rescue: Builder = (c) => {
  const dir = Math.random() < 0.5 ? 1 : -1;
  let stage = 0, turns = 0, pull = 0;
  c.body.innerHTML = `<div class="rs3"><div class="rs3-doors"><i class="dl"></i><i class="dr"></i><button type="button" class="rs3-hole" aria-label="Lỗ khóa"><i class="key"></i></button></div>
    <div class="rs3-ctrl"><button type="button" data-r="-1">⟲ Xoay trái</button><button type="button" data-r="1">Xoay phải ⟳</button></div>
    <p class="rs3-msg">Bấm vào lỗ khóa trên cửa để tra chìa khóa cứu hộ</p></div>`;
  const doors = $(c.body, '.rs3-doors'), hole = $<HTMLButtonElement>(c.body, '.rs3-hole'), msg = $(c.body, '.rs3-msg'), ctrl = $(c.body, '.rs3-ctrl');
  ctrl.style.visibility = 'hidden';
  hole.onclick = () => { if (stage !== 0) return; stage = 1; hole.classList.add('in'); ctrl.style.visibility = 'visible'; sfx.click(); msg.textContent = `Xoay chìa ${dir > 0 ? 'theo' : 'ngược'} chiều kim đồng hồ 2 nấc (xem mũi tên trên ổ khóa)`; hole.dataset.dir = dir > 0 ? '⟳' : '⟲'; };
  $$<HTMLButtonElement>(ctrl, 'button').forEach(b => b.onclick = () => {
    if (stage !== 1 || c.isDone()) return;
    if (Number(b.dataset.r) !== dir) { c.fail(); c.toast('Sai chiều, chìa bị kẹt!'); turns = 0; ($(hole, '.key')).style.transform = ''; return; }
    turns++; ($(hole, '.key')).style.transform = `rotate(${dir * turns * 45}deg)`; sfx.click();
    if (turns >= 2) { stage = 2; ctrl.style.visibility = 'hidden'; doors.classList.add('unlocked'); msg.textContent = 'Mở khóa rồi! Kéo khe cửa sang hai bên (giữ và kéo ngang)'; }
  });
  let sx = 0, dragging = false;
  doors.addEventListener('pointerdown', (e) => { if (stage !== 2) return; dragging = true; sx = e.clientX; doors.setPointerCapture(e.pointerId); e.preventDefault(); });
  doors.addEventListener('pointermove', (e) => {
    if (!dragging || stage !== 2 || c.isDone()) return;
    pull = Math.min(100, pull + Math.abs(e.clientX - sx) * 0.6); sx = e.clientX;
    doors.style.setProperty('--gap', String(pull));
    if (pull >= 100) { doors.classList.add('open'); c.done(); }
  });
  const stop = () => { dragging = false; }; doors.addEventListener('pointerup', stop); doors.addEventListener('pointercancel', stop);
};

// ---------------------------------------------------------------------------------------------
// Giả vờ gõ phím (kiểu Typer Shark): chữ trôi về phía bạn, gõ đúng để "xử" trước khi sếp tới gần
// ---------------------------------------------------------------------------------------------
const WORDS = ['kpi', 'email', 'excel', 'slide', 'task', 'report', 'sprint', 'deadline', 'meeting', 'budget', 'review', 'ok'];
const desk: Builder = (c) => {
  const GOAL = 4;
  const queue = shuffle(WORDS).slice(0, GOAL + 2);
  type W = { text: string; typed: number; x: number; el: HTMLElement };
  const live: W[] = [];
  let killed = 0, next = 0, spawnT = 0, target: W | null = null;
  c.body.innerHTML = `<div class="dk3"><div class="dk3-screen"><div class="dk3-boss">🧑‍💼</div><div class="dk3-me">🙂⌨️</div></div>
    <div class="dk3-keys"></div><p class="dk3-msg">Gõ chữ đang bay tới trước khi nó chạm vào bạn · Đã xử 0/${GOAL}</p></div>`;
  const screen = $(c.body, '.dk3-screen'), keys = $(c.body, '.dk3-keys'), msg = $(c.body, '.dk3-msg');
  const spawn = () => { if (next >= queue.length) next = 0; const el = document.createElement('div'); el.className = 'dk3-word'; screen.appendChild(el); live.push({ text: queue[next++], typed: 0, x: 100, el }); };
  const paintKeys = () => {
    // điện thoại: hiện sẵn các phím chữ của các từ đang bay (kèm vài chữ mồi)
    const letters = new Set<string>(); live.forEach(w => w.text.split('').forEach(ch => letters.add(ch)));
    'aeiou'.split('').slice(0, Math.max(0, 8 - letters.size)).forEach(ch => letters.add(ch));
    const k = [...letters].sort().join('');
    if (keys.dataset.k === k) return;
    keys.dataset.k = k;
    keys.innerHTML = [...letters].sort().map(ch => `<button type="button" data-k="${ch}">${ch}</button>`).join('');
    $$<HTMLButtonElement>(keys, 'button').forEach(b => b.onpointerdown = (e) => { e.preventDefault(); type(b.dataset.k!); });
  };
  const type = (ch: string) => {
    if (c.isDone()) return;
    if (!target || target.typed >= target.text.length) target = live.find(w => w.text[0] === ch) ?? null;
    if (!target) { sfx.fail(); return; }
    if (target.text[target.typed] === ch) {
      target.typed++; sfx.click();
      if (target.typed >= target.text.length) {
        target.el.classList.add('pop'); const w = target; c.timers.push(window.setTimeout(() => w.el.remove(), 250));
        live.splice(live.indexOf(target), 1); target = null; killed++; sfx.ting();
        msg.textContent = `Gõ chữ đang bay tới trước khi nó chạm vào bạn · Đã xử ${killed}/${GOAL}`;
        if (killed >= GOAL) { c.done(); return; }
      }
    } else { sfx.fail(); target.el.classList.remove('shake'); void target.el.offsetWidth; target.el.classList.add('shake'); }
  };
  const id = window.setInterval(() => {
    if (c.isDone()) return;
    spawnT -= 0.05;
    if (spawnT <= 0 && live.length < 2) { spawn(); spawnT = 1.6; }
    for (const w of [...live]) {
      w.x -= 0.9 + w.text.length * 0.05;
      w.el.style.left = w.x + '%';
      w.el.style.top = (18 + (queue.indexOf(w.text) % 3) * 22) + '%';
      w.el.innerHTML = `<b>${w.text.slice(0, w.typed)}</b>${w.text.slice(w.typed)}`;
      if (w.x <= 12) {
        // chữ chạm vào bạn: sếp nhìn thấy, từ đó tính lại từ đầu
        c.fail(); c.toast('Sếp liếc qua màn hình! Gõ nhanh lên.');
        w.typed = 0; w.x = 100; if (target === w) target = null;
      }
    }
    paintKeys();
  }, 50);
  c.cleanups.push(() => clearInterval(id));
  const key = (e: KeyboardEvent) => { if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); type(e.key.toLowerCase()); } };
  window.addEventListener('keydown', key); c.cleanups.push(() => window.removeEventListener('keydown', key));
};

// ---------------------------------------------------------------------------------------------
// Khởi động lại Router: rút 3 dây → chờ đèn tắt hết → cắm lại đúng thứ tự ghi trên nhãn (sự cố, phải nhanh)
// ---------------------------------------------------------------------------------------------
const router: Builder = (c) => {
  const names = ['Nguồn', 'Internet', 'LAN'];
  const order = shuffle([0, 1, 2]);
  let stage = 0, k = 0;
  const plugged = [true, true, true];
  c.body.innerHTML = `<div class="rt3"><div class="rt3-box"><div class="rt3-leds">${names.map(() => '<i class="on"></i>').join('')}</div>
    <div class="rt3-ports">${names.map((n, i) => `<button type="button" class="rt3-port in" data-i="${i}"><span>${n}</span></button>`).join('')}</div></div>
    <div class="rt3-note">Nhãn dán: cắm lại theo thứ tự <b>${order.map(i => names[i]).join(' → ')}</b></div><p class="rt3-msg">Bước 1: rút cả 3 dây ra</p></div>`;
  const ports = $$<HTMLButtonElement>(c.body, '.rt3-port'), leds = $$(c.body, '.rt3-leds i'), msg = $(c.body, '.rt3-msg');
  const paint = () => { ports.forEach((p, i) => p.classList.toggle('in', plugged[i])); leds.forEach((l, i) => l.className = plugged[i] && (stage !== 1) ? 'on' : ''); };
  ports.forEach((p, i) => p.onclick = () => {
    if (c.isDone()) return;
    if (stage === 0 && plugged[i]) {
      plugged[i] = false; sfx.click(); paint();
      if (plugged.every(v => !v)) { stage = 1; msg.textContent = 'Chờ đèn tắt hết…'; c.timers.push(window.setTimeout(() => { stage = 2; msg.textContent = 'Bước 2: cắm lại theo đúng thứ tự trên nhãn'; sfx.ting(); }, 900)); }
      return;
    }
    if (stage === 2 && !plugged[i]) {
      if (i !== order[k]) { c.fail(); c.toast('Sai thứ tự! Rút ra cắm lại từ đầu.'); k = 0; plugged.fill(false); paint(); return; }
      plugged[i] = true; k++; sfx.click(); paint();
      if (k === 3) { msg.textContent = 'Đèn xanh hết rồi, có mạng!'; c.done(); }
    }
  });
  paint();
};

// ---------------------------------------------------------------------------------------------
// Chấm công vân tay: kéo ngón tay vào khung quét (khung trôi nhẹ), giữ trong khung cho đầy thanh.
// Đang quét thì máy sáng đèn (người khác đứng gần thấy được).
// ---------------------------------------------------------------------------------------------
const fingerprint: Builder = (c) => {
  const NEED = 2.2;
  let prog = 0, t = 0, holding = false, fx = 0, fy = 0;
  c.body.innerHTML = `<div class="fp3"><div class="fp3-pad"><div class="fp3-frame"></div><div class="fp3-finger">☝️</div></div><div class="fp3-bar"><i></i></div>
    <p class="fp3-msg">Giữ ngón tay và kéo vào khung xanh đang trôi, giữ trong khung cho đầy thanh</p></div>`;
  const pad = $(c.body, '.fp3-pad'), frame = $(c.body, '.fp3-frame'), finger = $(c.body, '.fp3-finger'), bar = $(c.body, '.fp3-bar i');
  const place = (e: PointerEvent) => { const r = pad.getBoundingClientRect(); fx = e.clientX - r.left; fy = e.clientY - r.top; finger.style.transform = `translate(${fx - 20}px, ${fy - 24}px)`; };
  pad.addEventListener('pointerdown', (e) => { holding = true; pad.setPointerCapture(e.pointerId); place(e); e.preventDefault(); });
  pad.addEventListener('pointermove', (e) => { if (holding) place(e); });
  const up = () => { holding = false; c.hold?.(false); pad.classList.remove('scan'); };
  pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
  const id = window.setInterval(() => {
    if (c.isDone()) return;
    t += 0.05;
    const r = pad.getBoundingClientRect();
    const cx = r.width / 2 + Math.sin(t * 0.9) * r.width * 0.22, cy = r.height / 2 + Math.sin(t * 1.3) * r.height * 0.18;
    frame.style.transform = `translate(${cx - 34}px, ${cy - 34}px)`;
    const inside = holding && Math.hypot(fx - cx, fy - cy) < 30;
    pad.classList.toggle('scan', inside); c.hold?.(inside);
    if (inside) { prog = Math.min(NEED, prog + 0.05); }
    bar.style.width = (prog / NEED * 100) + '%';
    if (prog >= NEED) { c.hold?.(false); c.done(); }
  }, 50);
  c.cleanups.push(() => { clearInterval(id); c.hold?.(false); });
};

export const MINI_V3: Record<string, Builder> = { mt_lift, mt_cab, mt_desk, mt_floor, mt_wc, router, fingerprint, pry, rescue, desk };
