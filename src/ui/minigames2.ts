// Đợt B: các mini-game làm lại theo phản hồi. Mỗi mini-game có khung riêng hợp nội dung (bàn giấy, laptop,
// máy pha cà phê, máy in, terminal, bể cá, tấm pin, tủ điện, máy gắp thú, bảng trắng...).
import { sfx } from '../audio';

export interface MiniCtx {
  body: HTMLElement;
  done: () => void;
  fail: () => void;
  isDone: () => boolean;
  timers: number[];
  cleanups: (() => void)[];
  toast: (msg: string) => void;
}
type Builder = (c: MiniCtx) => void;

const rnd = (n: number) => Math.floor(Math.random() * n);
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = rnd(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const pick = <T,>(a: T[]) => a[rnd(a.length)];
const $ = <T extends Element = HTMLElement>(el: Element, s: string) => el.querySelector(s) as T;
const $$ = <T extends Element = HTMLElement>(el: Element, s: string) => [...el.querySelectorAll(s)] as T[];
const NAMES = ['Hưng', 'Diệp', 'Kha', 'Tú', 'Ngân', 'Phát', 'Linh', 'Quý', 'Thư', 'Bảo'];

// ---------------------------------------------------------------------------------------------
// Ký duyệt hồ sơ (kiểu Papers Please): đối chiếu sổ quy định rồi đóng dấu Duyệt hoặc Trả về
// ---------------------------------------------------------------------------------------------
const stamp: Builder = (c) => {
  const DEPTS: [string, number][] = shuffle([['Marketing', 5], ['Kỹ thuật', 20], ['Nhân sự', 3], ['Kinh doanh', 10]] as [string, number][]).slice(0, 3);
  const TODAY = 3;
  type Doc = { name: string; dept: string; amount: number; signed: boolean; due: number; bad: string | null };
  const make = (): Doc => {
    const [dept, lim] = pick(DEPTS);
    const d: Doc = { name: pick(NAMES), dept, amount: 1 + rnd(lim), signed: true, due: TODAY + 1 + rnd(6), bad: null };
    if (Math.random() < 0.55) {
      const v = pick(['amount', 'sign', 'due']);
      if (v === 'amount') { d.amount = lim + 1 + rnd(Math.max(2, Math.round(lim / 2))); d.bad = `vượt hạn mức ${dept} (${lim} triệu)`; }
      if (v === 'sign') { d.signed = false; d.bad = 'thiếu chữ ký'; }
      if (v === 'due') { d.due = 1 + rnd(TODAY - 1); d.bad = 'đã quá hạn'; }
    }
    return d;
  };
  const docs = [make(), make(), make()];
  if (docs.every(d => !d.bad)) { docs[rnd(3)].signed = false; docs.forEach(d => { if (!d.signed) d.bad = 'thiếu chữ ký'; }); }
  let i = 0;
  c.body.innerHTML = `<div class="st2">
    <div class="st2-book"><b>SỔ QUY ĐỊNH</b><small>Hôm nay: 0${TODAY}/10</small>
      <ul>${DEPTS.map(([d, l]) => `<li>${d}: tối đa <b>${l} triệu</b></li>`).join('')}<li>Phải có <b>chữ ký</b></li><li>Hạn đề nghị <b>từ hôm nay</b> trở đi</li></ul></div>
    <div class="st2-desk"><div class="st2-paper"></div><div class="st2-count"></div></div>
    <div class="st2-stamps"><button class="st2-ok" type="button">DUYỆT</button><button class="st2-no" type="button">TRẢ VỀ</button></div>
  </div>`;
  const paper = $(c.body, '.st2-paper'), count = $(c.body, '.st2-count');
  const show = () => {
    const d = docs[i];
    paper.className = 'st2-paper in';
    paper.innerHTML = `<h4>GIẤY ĐỀ NGHỊ CHI</h4>
      <p><span>Người đề nghị</span><b>${d.name}</b></p><p><span>Phòng ban</span><b>${d.dept}</b></p>
      <p><span>Số tiền</span><b>${d.amount} triệu</b></p><p><span>Hạn đề nghị</span><b>0${d.due}/10</b></p>
      <p class="sig"><span>Chữ ký</span>${d.signed ? `<i class="sig-ink">${d.name}</i>` : '<i class="sig-none">(trống)</i>'}</p>`;
    count.textContent = `Hồ sơ ${i + 1}/${docs.length}`;
  };
  const decide = (approve: boolean) => {
    if (c.isDone() || paper.classList.contains('out')) return;
    const d = docs[i];
    if (approve === !d.bad) {
      sfx.stamp();
      paper.insertAdjacentHTML('beforeend', `<em class="st2-mark ${approve ? 'ok' : 'no'}">${approve ? 'ĐÃ DUYỆT' : 'TRẢ VỀ'}</em>`);
      paper.classList.add('out');
      c.timers.push(window.setTimeout(() => { i++; if (i >= docs.length) c.done(); else show(); }, 520));
    } else {
      c.fail();
      c.toast(approve ? `Không duyệt được: hồ sơ ${d.bad}.` : 'Hồ sơ này hợp lệ mà, xem lại sổ quy định!');
    }
  };
  $<HTMLButtonElement>(c.body, '.st2-ok').onclick = () => decide(true);
  $<HTMLButtonElement>(c.body, '.st2-no').onclick = () => decide(false);
  show();
};

// ---------------------------------------------------------------------------------------------
// Xếp lịch phỏng vấn: kéo nối Giờ ← Ứng viên → Phòng ban
// ---------------------------------------------------------------------------------------------
const interview: Builder = (c) => {
  const times = shuffle(['8:30', '9:00', '10:30', '13:30', '14:00', '15:30', '16:00']).slice(0, 4);
  const depts = shuffle(['Kỹ thuật', 'Marketing', 'Nhân sự', 'Kinh doanh', 'Art']).slice(0, 4);
  const names = shuffle(NAMES).slice(0, 3);
  const cands = names.map((n, k) => ({ n, t: times[k], d: depts[k] })); // giờ/phòng thứ 4 là mồi nhử
  const T = shuffle(times), D = shuffle(depts);
  c.body.innerHTML = `<div class="iv2"><svg class="iv2-svg"></svg>
    <div class="iv2-col"><b>Khung giờ</b>${T.map(t => `<div class="iv2-slot" data-t="${t}">${t}</div>`).join('')}</div>
    <div class="iv2-col mid"><b>Ứng viên</b>${cands.map((x, k) => `<div class="iv2-cand" data-k="${k}"><i class="dot l" data-side="t"></i><div><strong>${x.n}</strong><small>Rảnh lúc ${x.t}<br>Ứng tuyển: ${x.d}</small></div><i class="dot r" data-side="d"></i></div>`).join('')}</div>
    <div class="iv2-col"><b>Phòng ban</b>${D.map(d => `<div class="iv2-dept" data-d="${d}">${d}</div>`).join('')}</div>
  </div>`;
  const box = $(c.body, '.iv2'), svg = $<SVGSVGElement>(c.body, '.iv2-svg');
  const need = cands.length * 2;
  let made = 0;
  const pt = (el: Element, side: 'l' | 'r') => { const r = el.getBoundingClientRect(), o = box.getBoundingClientRect(); return [(side === 'r' ? r.right : r.left) - o.left, r.top + r.height / 2 - o.top]; };
  const line = (cls: string) => { const l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); l.setAttribute('class', cls); svg.appendChild(l); return l; };
  $$(c.body, '.iv2-cand .dot').forEach(dot => {
    dot.addEventListener('pointerdown', (e) => {
      const ev = e as PointerEvent;
      if (c.isDone() || dot.classList.contains('ok')) return;
      ev.preventDefault();
      const side = (dot as HTMLElement).dataset.side as 't' | 'd';
      const k = Number((dot.closest('.iv2-cand') as HTMLElement).dataset.k);
      const [x1, y1] = pt(dot, side === 't' ? 'l' : 'r');
      const ln = line('drag'); ln.setAttribute('x1', String(x1)); ln.setAttribute('y1', String(y1)); ln.setAttribute('x2', String(x1)); ln.setAttribute('y2', String(y1));
      const move = (m: PointerEvent) => { const o = box.getBoundingClientRect(); ln.setAttribute('x2', String(m.clientX - o.left)); ln.setAttribute('y2', String(m.clientY - o.top)); };
      const up = (u: PointerEvent) => {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
        const tgt = document.elementFromPoint(u.clientX, u.clientY)?.closest(side === 't' ? '.iv2-slot' : '.iv2-dept') as HTMLElement | null;
        const want = side === 't' ? cands[k].t : cands[k].d;
        if (tgt && (tgt.dataset.t ?? tgt.dataset.d) === want && !tgt.classList.contains('ok')) {
          const [x2, y2] = pt(tgt, side === 't' ? 'r' : 'l');
          ln.setAttribute('x2', String(x2)); ln.setAttribute('y2', String(y2)); ln.setAttribute('class', 'ok');
          dot.classList.add('ok'); tgt.classList.add('ok'); sfx.click();
          if (++made >= need) c.done();
        } else {
          ln.remove();
          if (tgt) { c.fail(); c.toast(side === 't' ? `${cands[k].n} không rảnh giờ đó.` : `${cands[k].n} không ứng tuyển phòng đó.`); }
        }
      };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
      c.cleanups.push(() => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); });
    });
  });
};

// ---------------------------------------------------------------------------------------------
// Nhập liệu Excel: chép số từ phiếu giấy sang bảng tính (bàn phím số hoặc bàn phím máy)
// ---------------------------------------------------------------------------------------------
const excel: Builder = (c) => {
  const labels = shuffle(['Văn phòng phẩm', 'Tiền điện', 'Cà phê sếp', 'Teambuilding', 'Mực in', 'Trà sữa họp']).slice(0, 4);
  const vals = labels.map(() => String(120 + rnd(8800)));
  let row = 0, cur = '';
  c.body.innerHTML = `<div class="xl2">
    <div class="xl2-paper"><b>PHIẾU CHI THÁNG 10</b>${labels.map((l, k) => `<p><span>${l}</span><b>${Number(vals[k]).toLocaleString('vi-VN')}</b></p>`).join('')}<small>(đơn vị: nghìn đồng)</small></div>
    <div class="xl2-screen"><div class="xl2-bar">Book1.xlsx</div><table>${labels.map((l, k) => `<tr data-r="${k}"><td class="n">${k + 2}</td><td>${l}</td><td class="v"></td></tr>`).join('')}</table>
      <div class="xl2-pad">${['7', '8', '9', '4', '5', '6', '1', '2', '3', '⌫', '0', '↵'].map(k => `<button type="button" data-k="${k}">${k}</button>`).join('')}</div></div>
  </div>`;
  const rows = $$(c.body, 'tr');
  const paint = () => rows.forEach((r, k) => { r.classList.toggle('on', k === row); if (k === row) ($(r, '.v')).textContent = cur; });
  const press = (k: string) => {
    if (c.isDone()) return;
    if (/^\d$/.test(k)) { if (cur.length < 5) cur += k; sfx.click(); }
    else if (k === '⌫') cur = cur.slice(0, -1);
    else if (k === '↵') {
      const cell = $(rows[row], '.v');
      if (cur === vals[row]) { cell.classList.add('ok'); row++; cur = ''; sfx.ting(); if (row >= rows.length) { c.done(); return; } }
      else { cell.classList.remove('bad'); void (cell as HTMLElement).offsetWidth; cell.classList.add('bad'); c.fail(); c.toast('Sai số rồi, gõ lại ô này.'); cur = ''; }
    }
    paint();
  };
  $$(c.body, '.xl2-pad button').forEach(b => (b as HTMLButtonElement).onclick = () => press((b as HTMLElement).dataset.k!));
  const key = (e: KeyboardEvent) => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('⌫'); else if (e.key === 'Enter') { e.preventDefault(); press('↵'); } };
  window.addEventListener('keydown', key); c.cleanups.push(() => window.removeEventListener('keydown', key));
  paint();
};

// ---------------------------------------------------------------------------------------------
// Pha cà phê: chiết espresso và đánh sữa bằng cách giữ cần tới vạch; đường, đá bấm đủ số
// ---------------------------------------------------------------------------------------------
const coffee: Builder = (c) => {
  const want = { shot: 1 + rnd(2), milk: rnd(2), sugar: rnd(3), ice: rnd(3) };
  const have = { shot: 0, milk: 0, sugar: 0, ice: 0 };
  c.body.innerHTML = `<div class="cf2">
    <div class="cf2-note"><b>Sếp dặn:</b><ul><li>${want.shot} shot espresso</li><li>${want.milk ? 'Có' : 'Không'} sữa</li><li>${want.sugar} thìa đường</li><li>${want.ice} viên đá</li></ul></div>
    <div class="cf2-machine"><div class="cf2-gauge"><i class="band"></i><i class="fill"></i></div><div class="cf2-cup"><div class="cf2-layers"></div></div>
      <div class="cf2-btns"><button type="button" class="cf2-hold" data-h="shot">Giữ: chiết espresso</button><button type="button" class="cf2-hold" data-h="milk">Giữ: đánh sữa</button>
      <button type="button" data-a="sugar">+ Đường <b>0</b></button><button type="button" data-a="ice">+ Đá <b>0</b></button></div>
      <div class="cf2-row"><button type="button" class="ghost-btn reset">Đổ đi làm lại</button><button type="button" class="primary serve">Mang lên cho sếp</button></div></div>
  </div>`;
  const gauge = $(c.body, '.cf2-gauge'), fill = $(c.body, '.cf2-gauge .fill'), band = $(c.body, '.cf2-gauge .band'), layers = $(c.body, '.cf2-layers');
  let lo = 60, hi = 78, lv = 0, holding: string | null = null;
  const newBand = () => { lo = 45 + rnd(35); hi = lo + 16; band.style.bottom = lo + '%'; band.style.height = (hi - lo) + '%'; };
  const render = () => {
    layers.innerHTML = [...Array(have.shot)].map(() => '<i class="esp"></i>').join('') + (have.milk ? '<i class="milk"></i>' : '') + [...Array(have.ice)].map(() => '<i class="ice"></i>').join('');
    ($(c.body, '[data-a="sugar"] b')).textContent = String(have.sugar); ($(c.body, '[data-a="ice"] b')).textContent = String(have.ice);
  };
  newBand();
  $$(c.body, '.cf2-hold').forEach(b => {
    b.addEventListener('pointerdown', (e) => { if (c.isDone()) return; (e as PointerEvent).preventDefault(); holding = (b as HTMLElement).dataset.h!; lv = 0; gauge.classList.add('on'); (b as HTMLElement).setPointerCapture((e as PointerEvent).pointerId); });
    const up = () => {
      if (!holding || c.isDone()) return;
      const what = holding as 'shot' | 'milk'; holding = null; gauge.classList.remove('on');
      if (lv >= lo && lv <= hi) { if (what === 'shot') have.shot++; else have.milk = 1; sfx.sip(); }
      else if (lv > hi) { c.fail(); c.toast('Tràn ra ngoài rồi!'); }
      else c.toast('Chưa tới vạch, giữ lâu hơn.');
      lv = 0; fill.style.height = '0%'; newBand(); render();
    };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  });
  const id = window.setInterval(() => { if (holding && !c.isDone()) { lv = Math.min(100, lv + 2.2); fill.style.height = lv + '%'; } }, 40);
  c.cleanups.push(() => clearInterval(id));
  $$(c.body, '[data-a]').forEach(b => (b as HTMLButtonElement).onclick = () => { if (c.isDone()) return; const k = (b as HTMLElement).dataset.a as 'sugar' | 'ice'; have[k] = Math.min(5, have[k] + 1); sfx.click(); render(); });
  $<HTMLButtonElement>(c.body, '.reset').onclick = () => { have.shot = 0; have.milk = 0; have.sugar = 0; have.ice = 0; render(); sfx.whoosh(); };
  $<HTMLButtonElement>(c.body, '.serve').onclick = () => {
    if (c.isDone()) return;
    if (have.shot === want.shot && have.milk === want.milk && have.sugar === want.sugar && have.ice === want.ice) c.done();
    else { c.fail(); c.toast('Sai công thức! Sếp nhăn mặt. Đổ đi làm lại.'); }
  };
  render();
};

// ---------------------------------------------------------------------------------------------
// In tài liệu: chỉnh máy in theo email của sếp; giữa chừng sếp gửi email sửa yêu cầu
// ---------------------------------------------------------------------------------------------
const printdoc: Builder = (c) => {
  const want = { size: pick(['A4', 'A3']), copies: 1 + rnd(5), duplex: Math.random() < 0.5, color: Math.random() < 0.5 };
  const set = { size: 'A4', copies: 1, duplex: false, color: true };
  const desc = (w: typeof want) => `khổ ${w.size}, ${w.copies} bản, ${w.duplex ? 'in 2 mặt' : 'in 1 mặt'}, ${w.color ? 'in màu' : 'đen trắng'}`;
  c.body.innerHTML = `<div class="pr2">
    <div class="pr2-mail"><b>Sếp</b><p>In giúp anh báo cáo nhé: ${desc(want)}.</p></div>
    <div class="pr2-mail2" hidden></div>
    <div class="pr2-panel"><div class="pr2-lcd"></div>
      <div class="pr2-ctrls">
        <div><span>Khổ giấy</span><button type="button" data-c="size">A4</button></div>
        <div><span>Số bản</span><button type="button" data-c="minus">−</button><b class="pr2-n">1</b><button type="button" data-c="plus">+</button></div>
        <div><span>2 mặt</span><button type="button" data-c="duplex">Tắt</button></div>
        <div><span>Màu</span><button type="button" data-c="color">Màu</button></div>
      </div><button type="button" class="primary pr2-go">IN</button></div>
  </div>`;
  let changes = 0, revised = false;
  const lcd = $(c.body, '.pr2-lcd');
  const render = () => {
    ($(c.body, '[data-c="size"]')).textContent = set.size; ($(c.body, '.pr2-n')).textContent = String(set.copies);
    ($(c.body, '[data-c="duplex"]')).textContent = set.duplex ? 'Bật' : 'Tắt'; ($(c.body, '[data-c="color"]')).textContent = set.color ? 'Màu' : 'Đen trắng';
    lcd.textContent = `${set.size} · ${set.copies} bản · ${set.duplex ? '2 mặt' : '1 mặt'} · ${set.color ? 'MÀU' : 'Đ/T'}`;
  };
  const revise = () => {
    // sếp đổi ý một mục
    revised = true;
    const k = pick(['size', 'copies', 'duplex', 'color'] as const);
    let note = '';
    if (k === 'size') { want.size = want.size === 'A4' ? 'A3' : 'A4'; note = `in khổ ${want.size} nhé`; }
    if (k === 'copies') { want.copies = want.copies >= 5 ? want.copies - 2 : want.copies + 2; note = `in ${want.copies} bản thôi`; }
    if (k === 'duplex') { want.duplex = !want.duplex; note = want.duplex ? 'in 2 mặt cho đỡ tốn giấy' : 'in 1 mặt thôi'; }
    if (k === 'color') { want.color = !want.color; note = want.color ? 'in màu cho đẹp' : 'in đen trắng thôi, tiết kiệm mực'; }
    const m2 = $(c.body, '.pr2-mail2'); m2.hidden = false; m2.innerHTML = `<b>Sếp</b><p>À sửa lại: ${note}!</p>`; sfx.ting();
  };
  $$(c.body, '[data-c]').forEach(b => (b as HTMLButtonElement).onclick = () => {
    if (c.isDone()) return;
    const k = (b as HTMLElement).dataset.c!;
    if (k === 'size') set.size = set.size === 'A4' ? 'A3' : 'A4';
    if (k === 'minus') set.copies = Math.max(1, set.copies - 1);
    if (k === 'plus') set.copies = Math.min(9, set.copies + 1);
    if (k === 'duplex') set.duplex = !set.duplex;
    if (k === 'color') set.color = !set.color;
    sfx.click(); render();
    if (!revised && ++changes >= 2) c.timers.push(window.setTimeout(revise, 400));
  });
  $<HTMLButtonElement>(c.body, '.pr2-go').onclick = () => {
    if (c.isDone()) return;
    if (!revised) { revise(); c.toast('Khoan, sếp vừa nhắn thêm!'); return; }
    const bad = [set.size !== want.size && 'khổ giấy', set.copies !== want.copies && 'số bản', set.duplex !== want.duplex && 'in 2 mặt', set.color !== want.color && 'màu'].filter(Boolean);
    if (!bad.length) c.done(); else { c.fail(); c.toast(`Sai: ${bad.join(', ')}. Đọc lại tin nhắn của sếp.`); }
  };
  render();
};

// ---------------------------------------------------------------------------------------------
// Đẩy bản build: thanh tải lên chạy; giữa chừng có xung đột code, chọn dòng đúng theo quy ước
// ---------------------------------------------------------------------------------------------
const CONFLICTS: { rule: string; good: string; bad: string }[] = [
  { rule: 'Luôn kiểm tra null trước khi dùng', good: 'if (user) user.save();', bad: 'user.save();' },
  { rule: 'Không để mật khẩu trong code', good: 'const key = env.API_KEY;', bad: 'const key = "123456";' },
  { rule: 'Vòng lặp phải có điểm dừng', good: 'for (i = 0; i < n; i++)', bad: 'while (true) {}' },
  { rule: 'Không xóa test của người khác', good: 'test("thanh toán", ...)', bad: '// test("thanh toán") xóa cho nhanh' },
  { rule: 'Tên biến phải có nghĩa', good: 'const totalPrice = a + b;', bad: 'const x2 = a + b;' },
  { rule: 'Không in log bí mật ra màn hình', good: 'log("Đăng nhập thành công");', bad: 'log("Mật khẩu: " + pass);' },
];
const pushbuild: Builder = (c) => {
  const pool = shuffle(CONFLICTS);
  const stops = [30, 65];
  let p = 0, paused = false, ci = 0;
  c.body.innerHTML = `<div class="pb2"><div class="pb2-term"><p>$ git push origin main</p><p class="pb2-log">Đang tải lên…</p><div class="pb2-bar"><i></i><b>0%</b></div></div><div class="pb2-conf" hidden></div></div>`;
  const bar = $(c.body, '.pb2-bar i'), pct = $(c.body, '.pb2-bar b'), conf = $(c.body, '.pb2-conf'), log = $(c.body, '.pb2-log');
  const ask = () => {
    paused = true;
    const k = pool[ci++ % pool.length];
    const opts = shuffle([['good', k.good], ['bad', k.bad]]);
    conf.hidden = false;
    conf.innerHTML = `<b>XUNG ĐỘT CODE</b><small>Quy ước nhóm: ${k.rule}</small>${opts.map(([t, code]) => `<button type="button" data-t="${t}"><code>${code.replace(/</g, '&lt;')}</code></button>`).join('')}`;
    log.textContent = 'Phát hiện xung đột, chọn dòng code đúng để tiếp tục.';
    $$(conf, 'button').forEach(b => (b as HTMLButtonElement).onclick = () => {
      if (c.isDone()) return;
      if ((b as HTMLElement).dataset.t === 'good') { conf.hidden = true; paused = false; log.textContent = 'Đã gộp code, tải tiếp…'; sfx.ting(); }
      else { c.fail(); p = Math.max(0, p - 15); c.toast('Sai quy ước! Bị trả về, tải lại một đoạn.'); ask(); }
    });
  };
  const id = window.setInterval(() => {
    if (paused || c.isDone()) return;
    p = Math.min(100, p + 1.25);
    bar.style.width = p + '%'; pct.textContent = Math.floor(p) + '%';
    if (stops.length && p >= stops[0]) { stops.shift(); ask(); }
    if (p >= 100) { log.textContent = 'Build thành công!'; c.done(); }
  }, 60);
  c.cleanups.push(() => clearInterval(id));
};

// ---------------------------------------------------------------------------------------------
// Cho cá ăn (kiểu Feeding Frenzy): điều khiển cá nhỏ ăn đủ hạt, né cá to
// ---------------------------------------------------------------------------------------------
const fishfeed: Builder = (c) => {
  const W = 340, H = 220, GOAL = 8;
  c.body.innerHTML = `<div class="ff2"><div class="ff2-tank"><i class="ff2-me">🐟</i><i class="ff2-big">🦈</i></div><p class="ff2-msg">Đã ăn 0/${GOAL} hạt · Rê chuột hoặc kéo ngón tay để bơi</p></div>`;
  const tank = $(c.body, '.ff2-tank'), me = $(c.body, '.ff2-me'), big = $(c.body, '.ff2-big'), msg = $(c.body, '.ff2-msg');
  let mx = W / 2, my = H - 40, tx = mx, ty = my, eaten = 0, inv = 0, t = 0, spawnT = 0, face = 1;
  const pellets: { x: number; y: number; el: HTMLElement }[] = [];
  const aim = (e: PointerEvent) => { const r = tank.getBoundingClientRect(); tx = Math.max(12, Math.min(W - 12, (e.clientX - r.left) * W / r.width)); ty = Math.max(12, Math.min(H - 12, (e.clientY - r.top) * H / r.height)); };
  tank.addEventListener('pointermove', aim); tank.addEventListener('pointerdown', (e) => { aim(e); tank.setPointerCapture(e.pointerId); });
  const id = window.setInterval(() => {
    if (c.isDone()) return;
    const dt = 0.03; t += dt; inv = Math.max(0, inv - dt);
    // cá của bạn bơi theo con trỏ (có quán tính)
    const nx = mx + (tx - mx) * 0.14, ny = my + (ty - my) * 0.14;
    if (Math.abs(nx - mx) > 0.3) face = nx > mx ? 1 : -1;
    mx = nx; my = ny;
    me.style.transform = `translate(${mx - 14}px, ${my - 14}px) scaleX(${-face})`;
    me.style.opacity = inv > 0 ? String(0.4 + 0.6 * Math.round((t * 10) % 1)) : '1';
    // cá to tuần tra qua lại, nhấp nhô
    const bx = W / 2 + Math.sin(t * 0.9) * (W / 2 - 30), by = H / 2 + Math.sin(t * 1.7) * 50;
    big.style.transform = `translate(${bx - 22}px, ${by - 22}px) scaleX(${Math.cos(t * 0.9) > 0 ? -1 : 1})`;
    if (inv <= 0 && Math.hypot(mx - bx, my - by) < 32) {
      inv = 1.2; eaten = Math.max(0, eaten - 2); c.fail(); c.toast('Bị cá to đớp mất 2 hạt!');
      mx += (mx - bx) * 0.8; my += (my - by) * 0.8;
    }
    // hạt thức ăn rơi chậm từ trên xuống
    spawnT -= dt;
    if (spawnT <= 0 && pellets.length < 5) { spawnT = 0.7; const el = document.createElement('b'); el.className = 'ff2-food'; tank.appendChild(el); pellets.push({ x: 20 + Math.random() * (W - 40), y: -6, el }); }
    for (let i = pellets.length - 1; i >= 0; i--) {
      const f = pellets[i]; f.y += 34 * dt; f.x += Math.sin(t * 2 + i) * 0.3;
      f.el.style.transform = `translate(${f.x}px, ${f.y}px)`;
      if (Math.hypot(f.x - mx, f.y - my) < 18) { f.el.remove(); pellets.splice(i, 1); eaten++; sfx.pop(); }
      else if (f.y > H) { f.el.remove(); pellets.splice(i, 1); }
    }
    msg.textContent = `Đã ăn ${eaten}/${GOAL} hạt · Né con cá to!`;
    if (eaten >= GOAL) c.done();
  }, 30);
  c.cleanups.push(() => clearInterval(id));
};

// ---------------------------------------------------------------------------------------------
// Lau tấm pin: bình xịt cho vết bẩn, chổi cho lá; chọn công cụ rồi kéo qua lại trên ô
// ---------------------------------------------------------------------------------------------
const solar: Builder = (c) => {
  const kinds = [...Array(12)].map(() => 'clean');
  const dirty = shuffle([...Array(12).keys()]).slice(0, 6);
  dirty.forEach((k, j) => { kinds[k] = j % 2 ? 'leaf' : 'dust'; });
  const left: number[] = kinds.map(k => (k === "clean" ? 0 : 100));
  let tool: 'spray' | 'broom' = 'spray', down = false, lastX = 0, lastY = 0, warned = -1;
  c.body.innerHTML = `<div class="so2"><div class="so2-tools"><button type="button" class="on" data-t="spray">💦 Bình xịt<small>vết bẩn</small></button><button type="button" data-t="broom">🧹 Chổi<small>lá cây</small></button></div>
    <div class="so2-grid">${kinds.map((k, i) => `<div class="so2-cell" data-i="${i}">${k === 'clean' ? '' : `<i class="${k}"></i>`}</div>`).join('')}</div><p class="so2-msg">Chọn công cụ rồi giữ chuột kéo qua lại trên ô bẩn</p></div>`;
  const msg = $(c.body, '.so2-msg'), grid = $(c.body, '.so2-grid');
  $$(c.body, '.so2-tools button').forEach(b => (b as HTMLButtonElement).onclick = () => { tool = (b as HTMLElement).dataset.t as typeof tool; $$(c.body, '.so2-tools button').forEach(x => x.classList.toggle('on', x === b)); sfx.click(); });
  const scrub = (e: PointerEvent) => {
    if (!down || c.isDone()) return;
    const d = Math.hypot(e.clientX - lastX, e.clientY - lastY); lastX = e.clientX; lastY = e.clientY;
    const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest('.so2-cell') as HTMLElement | null;
    if (!cell) return;
    const i = Number(cell.dataset.i);
    if (left[i] <= 0) return;
    const ok = (kinds[i] === 'dust' && tool === 'spray') || (kinds[i] === 'leaf' && tool === 'broom');
    if (!ok) { if (warned !== i) { warned = i; c.toast(kinds[i] === 'leaf' ? 'Lá cây phải dùng chổi quét.' : 'Vết bẩn phải dùng bình xịt.'); } return; }
    left[i] = Math.max(0, left[i] - d * 0.9);
    const ic = cell.querySelector('i') as HTMLElement | null; if (ic) ic.style.opacity = String(left[i] / 100);
    if (left[i] <= 0) { cell.classList.add('clean'); ic?.remove(); sfx.ting(); }
    const n = left.filter(v => v > 0).length;
    msg.textContent = n ? `Còn ${n} ô bẩn` : 'Sạch bóng, pin hút nắng ngon lành!';
    if (!n) c.done();
  };
  grid.addEventListener('pointerdown', (e) => { down = true; lastX = e.clientX; lastY = e.clientY; grid.setPointerCapture(e.pointerId); e.preventDefault(); });
  grid.addEventListener('pointermove', scrub);
  const up = () => { down = false; };
  grid.addEventListener('pointerup', up); grid.addEventListener('pointercancel', up);
};

// ---------------------------------------------------------------------------------------------
// Kiểm tra cục nóng: gạt 5 công tắc theo đúng thứ tự trên bảng
// ---------------------------------------------------------------------------------------------
const acpanel: Builder = (c) => {
  const keys = ['A', 'B', 'C', 'D', 'E'];
  const order = shuffle(keys);
  c.body.innerHTML = `<div class="ac2"><div class="ac2-note">Thứ tự gạt: <b>${order.join(' → ')}</b></div>
    <div class="ac2-row">${keys.map(k => `<button type="button" class="ac2-sw" data-k="${k}"><i></i><span>${k}</span></button>`).join('')}</div>
    <p class="ac2-msg">Gạt công tắc đầu tiên</p></div>`;
  let step = 0;
  const msg = $(c.body, '.ac2-msg'), sws = $$<HTMLButtonElement>(c.body, '.ac2-sw');
  sws.forEach(b => b.onclick = () => {
    if (c.isDone() || b.classList.contains('on')) return;
    if (b.dataset.k !== order[step]) { c.fail(); msg.textContent = 'Sai thứ tự! Tắt hết, gạt lại từ đầu.'; step = 0; sws.forEach(x => x.classList.remove('on')); return; }
    b.classList.add('on'); sfx.click(); step++;
    msg.textContent = step < keys.length ? `Đúng rồi (${step}/${keys.length})` : 'Cục nóng chạy êm rồi!';
    if (step === keys.length) c.done();
  });
};

// ---------------------------------------------------------------------------------------------
// Gắp thú bông: gắp đúng 2 con theo danh sách ngẫu nhiên; mỗi lần gắp xong thú xáo chỗ, cần gắp nhanh hơn
// ---------------------------------------------------------------------------------------------
const claw: Builder = (c) => {
  const TOYS = ['🧸', '🐰', '🐥', '🐸', '🐷'];
  const wantList = shuffle(TOYS).slice(0, 2);
  const got = new Set<string>();
  let order = shuffle(TOYS), x = 0, t = 0, spd = 1, dropping = false;
  c.body.innerHTML = `<div class="cl2"><div class="cl2-list">Cần gắp: ${wantList.map(w => `<span data-w="${w}">${w}</span>`).join('')}</div>
    <div class="cl2-box"><div class="cl2-claw"><i class="rope"></i><i class="hook"></i></div><div class="cl2-toys"></div></div>
    <button type="button" class="primary big cl2-drop">Thả cần gắp</button></div>`;
  const box = $(c.body, '.cl2-box'), clawEl = $(c.body, '.cl2-claw'), toysEl = $(c.body, '.cl2-toys');
  // vị trí thú: tâm từ 13% tới 85%, luôn nằm trong tầm cần gắp (cần chạy 8%–92%)
  const slotLeft = (i: number) => 8 + i * 18;
  const layout = () => { toysEl.innerHTML = order.map((ty, i) => `<span data-t="${ty}" style="left:${slotLeft(i)}%">${ty}</span>`).join(''); };
  layout();
  const id = window.setInterval(() => {
    if (dropping || c.isDone()) return;
    t += 0.03 * spd;
    x = 50 + Math.sin(t * 1.6) * 42; // phần trăm chiều ngang
    clawEl.style.left = x + '%';
  }, 30);
  c.cleanups.push(() => clearInterval(id));
  $<HTMLButtonElement>(c.body, '.cl2-drop').onclick = () => {
    if (dropping || c.isDone()) return;
    dropping = true; clawEl.classList.add('down'); sfx.whoosh();
    c.timers.push(window.setTimeout(() => {
      const idx = order.findIndex((_, i) => Math.abs(slotLeft(i) + 5 - x) < 6.5);
      const toy = idx >= 0 ? order[idx] : null;
      clawEl.classList.remove('down');
      if (!toy) { c.toast('Trượt rồi, thử lại.'); sfx.fail(); }
      else if (!wantList.includes(toy) || got.has(toy)) { c.fail(); c.toast('Không phải con này!'); }
      else {
        got.add(toy); sfx.ting();
        ($(c.body, `.cl2-list [data-w="${toy}"]`)).classList.add('ok');
        if (got.size >= wantList.length) { c.done(); return; }
        order = shuffle(order); layout(); spd *= 1.25;
      }
      c.timers.push(window.setTimeout(() => { dropping = false; }, 350));
    }, 650));
    void box;
  };
};

// ---------------------------------------------------------------------------------------------
// Cân bằng chỉ số: vùng xanh hẹp, 3 thanh ảnh hưởng lẫn nhau (tăng một chỉ số thì chỉ số kế tiếp tụt)
// ---------------------------------------------------------------------------------------------
const balance: Builder = (c) => {
  const stats = [['Máu', '#e2412f'], ['Sát thương', '#f2b705'], ['Tốc độ', '#2e9cf0']];
  const zones = stats.map(() => 18 + rnd(52));
  const vals = stats.map(() => 50);
  c.body.innerHTML = `<div class="bl2"><p class="bl2-tip">Tăng một chỉ số thì chỉ số bên dưới tụt theo (Tốc độ kéo Máu tụt). Kéo cả 3 vào vùng xanh.</p>
    ${stats.map((s, i) => `<label><span>${s[0]}</span><div class="bl2-track"><i class="zone" style="left:${zones[i]}%"></i><input type="range" min="0" max="100" value="50" style="--c:${s[1]}"></div><b class="bl2-v">50</b></label>`).join('')}</div>`;
  const inputs = $$<HTMLInputElement>(c.body, 'input'), outs = $$(c.body, '.bl2-v');
  const sync = () => inputs.forEach((inp, i) => { inp.value = String(Math.round(vals[i])); outs[i].textContent = String(Math.round(vals[i])); outs[i].classList.toggle('in', vals[i] >= zones[i] && vals[i] <= zones[i] + 8); });
  inputs.forEach((inp, i) => inp.oninput = () => {
    if (c.isDone()) return;
    const nv = Number(inp.value), d = nv - vals[i];
    vals[i] = nv;
    const j = (i + 1) % 3;
    vals[j] = Math.max(0, Math.min(100, vals[j] - d * 0.4));
    sync();
    if (vals.every((v, k) => v >= zones[k] && v <= zones[k] + 8)) c.done();
  });
  sync();
};

export const MINI_V2: Record<string, Builder> = { stamp, interview, excel, coffee, printdoc, pushbuild, fishfeed, solar, acpanel, claw, balance };
