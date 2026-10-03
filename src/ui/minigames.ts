// Các mini-game "chạy KPI" và sửa sự cố, dựng bằng HTML
import { sfx } from '../audio';

import type { MiniKind } from '../game/map';
export type { MiniKind };

const MT_HINT = 'Siết chặt cả 4 con ốc: mỗi con bấm 3 lần cho tới khi chuyển xanh.';
export const TITLES: Record<MiniKind, { title: string; hint: string }> = {
  solar: { title: 'Lau tấm pin mặt trời', hint: 'Bấm vào ô pin còn bẩn để lau, mỗi ô 2 lần. Lau sạch hết là xong.' },
  antenna: { title: 'Chỉnh ăng-ten', hint: 'Xoay chảo sang trái hoặc phải cho tới khi đủ 5 vạch sóng, rồi bấm Khóa sóng.' },
  acpanel: { title: 'Kiểm tra cục nóng điều hòa', hint: 'Gạt 3 công tắc theo đúng thứ tự ghi trên bảng. Gạt sai là phải làm lại.' },
  darts: { title: '🎯 Ném phi tiêu xả stress', hint: 'Tâm ngắm đung đưa liên tục. Bấm "Ném" đúng lúc tâm nằm trong vòng đỏ ở giữa. Cần 3 phi tiêu trúng.' },
  claw: { title: '🧸 Gắp thú bông tặng sếp', hint: 'Cần gắp chạy qua lại. Bấm "Thả" khi cần gắp nằm ngay trên con gấu vàng.' },
  fishfeed: { title: '🐠 Cho cá ăn', hint: 'Bấm vào từng con cá để rắc thức ăn, mỗi con ăn đúng 3 hạt. Rắc quá tay là nước đục, phải làm lại.' },
  mt_lift: { title: '🔧 Bảo trì nóc thang máy', hint: MT_HINT },
  mt_cab: { title: '🔧 Sửa khóa tủ đồ', hint: MT_HINT },
  mt_desk: { title: '🔧 Gia cố gầm bàn họp', hint: MT_HINT },
  mt_floor: { title: '🔧 Sửa ống cáp', hint: MT_HINT },
  mt_wc: { title: '🔧 Sửa ống gió', hint: MT_HINT },
  excel: { title: 'Nhập liệu Excel', hint: 'Bấm đúng ô đang sáng. Sai một ô là phải làm lại từ đầu, như ngoài đời.' },
  wires: { title: 'Nối lại dây cáp server', hint: 'Cầm đầu dây bên trái, kéo sang đúng cổng cùng màu bên phải rồi thả tay.' },
  fridge: { title: 'Dọn đồ mốc trong tủ lạnh chung', hint: 'Vứt hết đồ đã mốc. Đồ còn tươi là của sếp, đừng đụng vào.' },
  coffee: { title: 'Pha cà phê cho sếp', hint: 'Pha đúng công thức trên tờ giấy note rồi mang lên.' },
  copier: { title: 'Gỡ kẹt máy photocopy', hint: 'Đập liên tục vào máy cho đến khi giấy chạy lại. Ngừng tay là kẹt lại.' },
  stamp: { title: 'Ký duyệt hồ sơ', hint: 'Duyệt hồ sơ có chữ ký và số tiền trong hạn mức. Còn lại trả về.' },
  router: { title: 'Khởi động lại Router', hint: 'Giữ nút nguồn 3 giây. Thả tay ra là phải giữ lại từ đầu.' },
  power: { title: 'Bật lại cầu dao', hint: 'Gạt tất cả cầu dao lên vị trí BẬT.' },
  fingerprint: { title: 'Chấm công vân tay', hint: 'Đặt ngón tay lên máy quét và giữ 3 giây. Ai đứng gần cũng thấy đèn xanh.' },
  delivery: { title: 'Ký nhận hàng', hint: 'Ký vào ô chữ ký. Phải ký đủ dài, ký một chấm là shipper không chịu.' },
  waterplant: { title: 'Tưới cây trên sân thượng', hint: 'Giữ nút tưới cho đến khi nước lên tới vạch xanh, đừng để tràn.' },
  backlog: { title: 'Sắp xếp backlog', hint: 'Bấm các thẻ theo thứ tự ưu tiên: P1 trước, P4 sau cùng.' },
  sprite: { title: 'Tô màu sprite', hint: 'Tô lưới bên phải cho giống hệt mẫu bên trái.' },
  bug: { title: 'Tái hiện bug', hint: 'Xem các bước gây lỗi rồi bấm lại đúng thứ tự.' },
  testbuild: { title: 'Test bản build', hint: 'Bắt hết 6 con bug đang bò trên màn hình.' },
  interview: { title: 'Xếp lịch phỏng vấn', hint: 'Chọn một ứng viên rồi bấm vào khung giờ người đó rảnh.' },
  balance: { title: 'Cân bằng chỉ số game', hint: 'Kéo ba thanh chỉ số vào đúng vùng xanh trên bảng trắng.' },
  projector: { title: 'Bật máy chiếu', hint: 'Bấm nút Nguồn vào cho tới khi màn hình hiện đúng cổng laptop.' },
  getwater: { title: 'Lấy nước tưới cây', hint: 'Giữ vòi nước, thả tay khi nước nằm trong vạch xanh.' },
  printdoc: { title: 'In tài liệu', hint: 'Chọn đúng cài đặt in như trong yêu cầu rồi bấm In.' },
  minutes: { title: 'Lấy biên bản họp', hint: 'Tìm đúng biên bản cuộc họp sáng nay trong chồng giấy.' },
  pushbuild: { title: 'Đẩy bản build', hint: 'Bấm đẩy build rồi chờ thanh tải lên chạy xong. Đi chỗ khác là phải làm lại.' },
};

let current: { el: HTMLElement; cleanup: () => void } | null = null;

// Nhấn giữ lâu trong mini-game (điện thoại): chặn chọn chữ, menu ảnh và quét chữ
if (typeof document !== 'undefined') {
  const inMini = (e: Event) => !!(e.target as HTMLElement | null)?.closest?.('.modal .sheet.mini, .modal .sheet.faceid-sheet');
  document.addEventListener('contextmenu', (e) => { if (inMini(e)) e.preventDefault(); });
  document.addEventListener('selectstart', (e) => { if (inMini(e)) e.preventDefault(); });
}

export function closeMini() {
  if (!current) return;
  current.cleanup();
  current.el.remove();
  current = null;
}

export function miniOpen() { return current !== null; }

export function openMini(root: HTMLElement, kind: MiniKind, onDone: () => void, opts: { fake?: boolean; onHold?: (on: boolean) => void } = {}) {
  closeMini();
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `
    <div class="sheet mini mini-${kind}" role="dialog" aria-label="${TITLES[kind].title}">
      <div class="sheet-head">
        <div>
          <h2>${TITLES[kind].title}</h2>
          <p class="hint">${opts.fake ? 'Bạn là Nội gián: chỉ cần trông như đang làm, việc này không tính KPI.' : TITLES[kind].hint}</p>
        </div>
        <button class="x" aria-label="Đóng">✕</button>
      </div>
      <div class="mini-body"></div>
    </div>`;
  root.appendChild(wrap);
  const body = wrap.querySelector('.mini-body') as HTMLElement;
  const timers: number[] = [];
  const cleanups: (() => void)[] = [];
  let finished = false;
  /** Sai: khung rung nhẹ */
  const fail = () => { sfx.fail(); const sh = wrap.querySelector('.sheet') as HTMLElement; sh.classList.remove('shake'); void sh.offsetWidth; sh.classList.add('shake'); };
  const done = () => {
    if (finished) return;
    finished = true;
    sfx.taskDone();
    body.classList.add('mini-done');
    timers.push(window.setTimeout(() => { closeMini(); onDone(); }, 550));
  };
  current = { el: wrap, cleanup: () => { timers.forEach(clearTimeout); cleanups.forEach(f => f()); opts.onHold?.(false); } };
  (wrap.querySelector('.x') as HTMLElement).onclick = () => closeMini();
  wrap.addEventListener('pointerdown', e => { if (e.target === wrap) closeMini(); });

  /** Nút giữ-để-làm: trả về hàm đặt tiến độ */
  const holdButton = (label: string, seconds: number, onTick?: () => void) => {
    body.innerHTML = `<div class="router"><button class="hold" aria-label="${label}"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="track"/><circle cx="50" cy="50" r="44" class="prog"/></svg><span>${label}</span></button></div>`;
    const btn = body.querySelector('.hold') as HTMLElement, prog = body.querySelector('.prog') as SVGCircleElement;
    const C = 2 * Math.PI * 44; prog.style.strokeDasharray = `${C}`; prog.style.strokeDashoffset = `${C}`;
    let t = 0, holding = false;
    const set = () => { prog.style.strokeDashoffset = `${C * (1 - t / seconds)}`; };
    btn.onpointerdown = (e) => { e.preventDefault(); holding = true; btn.setPointerCapture(e.pointerId); opts.onHold?.(true); };
    const up = () => { holding = false; opts.onHold?.(false); if (!finished) { t = 0; set(); } };
    btn.onpointerup = up; btn.onpointercancel = up;
    const id = window.setInterval(() => {
      if (holding && !finished) { t += 0.05; onTick?.(); set(); if (t >= seconds) { opts.onHold?.(false); done(); } }
    }, 50);
    cleanups.push(() => clearInterval(id));
    return body.querySelector('.router') as HTMLElement;
  };
  /** Bình nước: giữ để đổ, thả tay khi mực nước trong vùng xanh */
  const fillGame = (label: string) => {
    // Vạch xanh đặt ngẫu nhiên; logic và hình vẽ dùng chung đúng một cặp số (lo..hi) nên tới vạch là xong
    const lo = 34 + Math.floor(Math.random() * 40), hi = lo + 16;
    body.innerHTML = `<div class="fillgame"><div class="tank"><div class="zone" style="bottom:${lo}%;height:${hi - lo}%"></div><div class="water"></div></div><button class="primary big pour">${label}</button><p class="fill-msg"></p></div>`;
    const water = body.querySelector('.water') as HTMLElement, btn = body.querySelector('.pour') as HTMLElement, msg = body.querySelector('.fill-msg') as HTMLElement;
    let lv = 0, holding = false;
    btn.onpointerdown = (e) => { e.preventDefault(); holding = true; btn.setPointerCapture(e.pointerId); };
    const up = () => {
      if (!holding || finished) return; holding = false;
      if (lv >= lo && lv <= hi) { sfx.sip(); done(); }
      else if (lv > hi) { fail(); msg.textContent = 'Quá vạch rồi! Đổ đi làm lại.'; lv = 0; }
      else if (lv > 0) { msg.textContent = 'Chưa đủ, giữ thêm chút nữa.'; }
    };
    btn.onpointerup = up; btn.onpointercancel = up;
    const id = window.setInterval(() => { if (holding && !finished) { lv = Math.min(100, lv + 1.6); if (lv >= 100) up(); } water.style.height = lv + '%'; }, 40);
    cleanups.push(() => clearInterval(id));
  };

  /** Bảo trì chỗ trốn (Engineer): siết 4 con ốc, mỗi con bấm 3 lần */
  const maint = () => {
    body.innerHTML = `<div class="maint-plate">${[0, 1, 2, 3].map(i => `<button class="screw" data-i="${i}" aria-label="Ốc ${i + 1}"><i></i></button>`).join('')}<div class="maint-label">🔧</div></div>`;
    const turns = [0, 0, 0, 0];
    body.querySelectorAll<HTMLButtonElement>('.screw').forEach(b => b.onclick = () => {
      const i = Number(b.dataset.i);
      if (turns[i] >= 3) return;
      turns[i]++;
      (b.querySelector('i') as HTMLElement).style.transform = `rotate(${turns[i] * 120}deg)`;
      sfx.click();
      if (turns[i] >= 3) { b.classList.add('ok'); sfx.ting(); }
      if (turns.every(t => t >= 3)) done();
    });
  };
  const builders: Record<MiniKind, () => void> = {
    mt_lift: maint, mt_cab: maint, mt_desk: maint, mt_floor: maint, mt_wc: maint,
    solar() {
      // lưới 4x3 ô pin, một số ô bẩn (bụi hoặc lá), mỗi ô bẩn cần lau 2 lần
      const cells = Array.from({ length: 12 }, () => 0);
      const dirty = [...Array(12).keys()].sort(() => Math.random() - 0.5).slice(0, 6);
      for (const i of dirty) cells[i] = 2;
      body.innerHTML = `<div class="solar"><div class="sp-grid">${cells.map((c, i) => `<button type="button" class="sp-cell${c ? ' dirty' : ''}" data-i="${i}" aria-label="Ô pin ${i + 1}">${c ? (i % 3 === 0 ? '<i class="leaf"></i>' : '<i class="dust"></i>') : ''}</button>`).join('')}</div><p class="claw-msg sp-msg">Còn ${dirty.length} ô bẩn</p></div>`;
      const msg = body.querySelector('.sp-msg') as HTMLElement;
      body.querySelectorAll<HTMLButtonElement>('.sp-cell').forEach(b => b.onclick = () => {
        if (finished) return;
        const i = Number(b.dataset.i);
        if (cells[i] <= 0) { fail(); return; }
        cells[i]--;
        sfx.click();
        b.classList.add('wipe'); timers.push(window.setTimeout(() => b.classList.remove('wipe'), 250));
        if (cells[i] === 1) b.classList.add('half');
        if (cells[i] === 0) { b.classList.remove('dirty', 'half'); b.innerHTML = ''; b.classList.add('clean'); sfx.ting(); }
        const left = cells.filter(c => c > 0).length;
        msg.textContent = left ? `Còn ${left} ô bẩn` : 'Sạch bóng, pin hút nắng ngon lành!';
        if (!left) done();
      });
    },
    antenna() {
      // góc chảo 0..180 độ, sóng tốt nhất ở một góc ngẫu nhiên; đủ 5 vạch thì mới khóa được
      const target = 30 + Math.floor(Math.random() * 5) * 30;
      let ang = target > 90 ? 15 : 165;
      body.innerHTML = `<div class="antenna"><div class="an-sky"><div class="an-dish"><i></i></div></div>
        <div class="an-bars">${[1, 2, 3, 4, 5].map(i => `<span style="--h:${i * 8 + 6}px"></span>`).join('')}</div>
        <div class="dart-row"><button type="button" class="ghost-btn an-l">◀ Xoay trái</button><button type="button" class="primary an-lock" disabled>Khóa sóng</button><button type="button" class="ghost-btn an-r">Xoay phải ▶</button></div></div>`;
      const dish = body.querySelector('.an-dish') as HTMLElement, lock = body.querySelector('.an-lock') as HTMLButtonElement;
      const bars = [...body.querySelectorAll<HTMLElement>('.an-bars span')];
      const render = () => {
        dish.style.transform = `rotate(${ang - 90}deg)`;
        const n = Math.max(0, 5 - Math.round(Math.abs(ang - target) / 15));
        bars.forEach((b, i) => b.classList.toggle('on', i < n));
        lock.disabled = n < 5;
      };
      const turn = (d: number) => { if (finished) return; ang = Math.max(0, Math.min(180, ang + d)); sfx.click(); render(); };
      (body.querySelector('.an-l') as HTMLButtonElement).onclick = () => turn(-15);
      (body.querySelector('.an-r') as HTMLButtonElement).onclick = () => turn(15);
      lock.onclick = () => { if (!finished && !lock.disabled) done(); };
      render();
    },
    acpanel() {
      // bảng hướng dẫn ghi thứ tự 3 công tắc; gạt sai là tắt hết, làm lại
      const order = ['A', 'B', 'C'].sort(() => Math.random() - 0.5);
      body.innerHTML = `<div class="acp"><div class="acp-note">Thứ tự gạt: <b>${order.join(' → ')}</b></div>
        <div class="acp-row">${['A', 'B', 'C'].map(k => `<button type="button" class="acp-sw" data-k="${k}"><i></i><span>${k}</span></button>`).join('')}</div>
        <p class="claw-msg acp-msg">Gạt công tắc đầu tiên</p></div>`;
      let step = 0;
      const msg = body.querySelector('.acp-msg') as HTMLElement;
      const sws = [...body.querySelectorAll<HTMLButtonElement>('.acp-sw')];
      sws.forEach(b => b.onclick = () => {
        if (finished || b.classList.contains('on')) return;
        if (b.dataset.k !== order[step]) {
          fail(); msg.textContent = 'Sai thứ tự! Tắt hết, gạt lại từ đầu.';
          step = 0; sws.forEach(x => x.classList.remove('on'));
          return;
        }
        b.classList.add('on'); sfx.click(); step++;
        msg.textContent = step < 3 ? `Đúng rồi, công tắc tiếp theo (${step}/3)` : 'Cục nóng chạy êm rồi!';
        if (step === 3) done();
      });
    },
    darts() {
      body.innerHTML = `<div class="darts"><div class="board"><i class="r1"></i><i class="r2"></i><i class="r3"></i><span class="aim"></span></div>
        <div class="dart-row"><span class="dart-hits">Trúng: 0/3</span><button class="primary" type="button">🎯 Ném</button></div></div>`;
      const aim = body.querySelector('.aim') as HTMLElement, hitsEl = body.querySelector('.dart-hits') as HTMLElement;
      const board = body.querySelector('.board') as HTMLElement;
      let t = 0, hits = 0, ax = 0, ay = 0, spd = 1;
      const tick = window.setInterval(() => {
        t += 0.05 * spd; // tăng tốc mượt, không giật vị trí
        // quỹ đạo số 8 trơn tru, đi qua hồng tâm 2 lần mỗi vòng; trúng thì nhanh dần
        ax = Math.sin(t * 1.4) * 72; ay = Math.sin(t * 2.8) * 38;
        aim.style.transform = `translate(${ax}px, ${ay}px)`;
      }, 30);
      cleanups.push(() => clearInterval(tick));
      (body.querySelector('button') as HTMLButtonElement).onclick = () => {
        if (finished) return;
        const d = Math.hypot(ax, ay);
        const dot = document.createElement('b'); dot.className = 'hole'; dot.style.transform = `translate(${ax}px, ${ay}px)`; board.appendChild(dot);
        if (d < 26) { hits++; spd *= 1.18; sfx.ting(); } else fail();
        hitsEl.textContent = `Trúng: ${hits}/3`;
        if (hits >= 3) done();
      };
    },
    claw() {
      body.innerHTML = `<div class="clawbox"><div class="glass"><div class="crane"><span class="line"></span><span class="hook">🦾</span></div>
        <div class="toys"><span>🐻</span><span>🐰</span><span class="goal">🧸</span><span>🐸</span><span>🦄</span></div></div>
        <div class="dart-row"><span class="claw-msg">Canh cho chuẩn nhé</span><button class="primary" type="button">⬇️ Thả</button></div></div>`;
      const crane = body.querySelector('.crane') as HTMLElement, msg = body.querySelector('.claw-msg') as HTMLElement;
      const glass = body.querySelector('.glass') as HTMLElement, goal = body.querySelector('.goal') as HTMLElement;
      let t = 0, x = 0, busy = false;
      const tick = window.setInterval(() => {
        if (busy) return;
        t += 0.04; x = (Math.sin(t * 1.7) + 1) / 2;
        crane.style.left = `${x * 100}%`;
      }, 30);
      cleanups.push(() => clearInterval(tick));
      (body.querySelector('button') as HTMLButtonElement).onclick = () => {
        if (busy || finished) return;
        busy = true;
        const gr = glass.getBoundingClientRect(), tr = goal.getBoundingClientRect(), cr = crane.getBoundingClientRect();
        const off = Math.abs((cr.left + cr.width / 2) - (tr.left + tr.width / 2));
        crane.classList.add('drop');
        const ok = off < gr.width * 0.05;
        timers.push(window.setTimeout(() => {
          if (ok) { goal.classList.add('grabbed'); msg.textContent = 'Gắp được rồi! 🎉'; sfx.ting(); timers.push(window.setTimeout(done, 500)); }
          else { msg.textContent = 'Trượt mất rồi, thử lại!'; fail(); crane.classList.remove('drop'); busy = false; }
        }, 700));
      };
    },
    fishfeed() {
      const need = 3;
      body.innerHTML = `<div class="fishtank-mg"><div class="water"></div>${[0, 1, 2].map(i => `<button class="fish f${i}" data-i="${i}" type="button">${['🐟', '🐠', '🐡'][i]}<em>0/${need}</em></button>`).join('')}</div><p class="claw-msg tank-msg">Mỗi con đúng ${need} hạt</p>`;
      const fed = [0, 0, 0];
      const water = body.querySelector('.water') as HTMLElement, msg = body.querySelector('.tank-msg') as HTMLElement;
      body.querySelectorAll<HTMLButtonElement>('.fish').forEach(b => b.onclick = () => {
        if (finished) return;
        const i = Number(b.dataset.i);
        fed[i]++;
        sfx.click();
        (b.querySelector('em') as HTMLElement).textContent = `${fed[i]}/${need}`;
        b.classList.toggle('full', fed[i] === need);
        if (fed[i] > need) {
          water.classList.add('murky'); msg.textContent = 'Rắc quá tay, nước đục rồi! Thay nước làm lại.'; fail();
          fed.fill(0);
          timers.push(window.setTimeout(() => { water.classList.remove('murky'); body.querySelectorAll('.fish').forEach(f => { f.classList.remove('full'); (f.querySelector('em') as HTMLElement).textContent = `0/${need}`; }); msg.textContent = `Mỗi con đúng ${need} hạt`; }, 900));
          return;
        }
        if (fed.every(f => f === need)) { msg.textContent = 'Cả bể no nê!'; done(); }
      });
    },
    fingerprint() {
      const box = holdButton('Giữ ngón tay', 3, () => { if (Math.random() < 0.15) sfx.click(); });
      box.insertAdjacentHTML('afterbegin', '<p class="router-msg">Máy chấm công: "Vui lòng đặt lại ngón tay." (lần thứ 4)</p>');
      box.classList.add('scanner-box');
    },
    delivery() {
      body.innerHTML = `<div class="sign"><p>Biên nhận: <b>3 thùng giấy A4, 1 cây cảnh, 12 hộp trà sữa</b> (không ai nhận đặt)</p><canvas width="460" height="160" class="sign-pad"></canvas><div class="row"><button class="ghost-btn clear">Ký lại</button></div></div>`;
      const cv = body.querySelector('canvas') as HTMLCanvasElement, ctx = cv.getContext('2d')!;
      let len = 0, drawing = false, lx = 0, ly = 0;
      const pos = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
      const reset = () => { ctx.clearRect(0, 0, cv.width, cv.height); ctx.strokeStyle = '#c9c4b5'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(20, 120); ctx.lineTo(440, 120); ctx.stroke(); ctx.setLineDash([]); len = 0; };
      reset();
      cv.onpointerdown = (e) => { drawing = true; cv.setPointerCapture(e.pointerId); [lx, ly] = pos(e); };
      cv.onpointermove = (e) => {
        if (!drawing || finished) return;
        const [x, y] = pos(e);
        ctx.strokeStyle = '#1f3fbf'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(x, y); ctx.stroke();
        len += Math.hypot(x - lx, y - ly); lx = x; ly = y;
      };
      cv.onpointerup = () => { drawing = false; if (len > 650) done(); else if (len > 0) toastIn(body, 'Chữ ký ngắn quá, ký dài thêm.'); };
      (body.querySelector('.clear') as HTMLElement).onclick = reset;
    },
    waterplant() { fillGame('Giữ để tưới'); body.querySelector('.tank')!.classList.add('pot'); },
    getwater() { fillGame('Giữ vòi nước'); },
    backlog() {
      const items = [['P1', 'Sửa crash khi mở game'], ['P2', 'Thêm nút bỏ qua cutscene'], ['P3', 'Đổi màu nút Mua'], ['P4', 'Sếp muốn logo to hơn']];
      const shuffled = [...items].sort(() => Math.random() - 0.5);
      let next = 0;
      body.innerHTML = `<div class="kanban"><div class="kb-cards"></div><div class="kb-col"><b>Sprint này</b><ol class="kb-done"></ol></div></div>`;
      const cards = body.querySelector('.kb-cards') as HTMLElement, list = body.querySelector('.kb-done') as HTMLElement;
      for (const [p, t] of shuffled) {
        const b = document.createElement('button'); b.className = 'kb-card'; b.innerHTML = `<span class="prio p${p[1]}">${p}</span>${t}`;
        b.onclick = () => {
          if (finished) return;
          if (p === items[next][0]) { sfx.click(); b.remove(); list.insertAdjacentHTML('beforeend', `<li>${t}</li>`); next++; if (next >= items.length) done(); }
          else { fail(); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); toastIn(body, `Chưa tới lượt ${p}!`); }
        };
        cards.appendChild(b);
      }
    },
    sprite() {
      const N = 5, colors = ['#ffffff', '#ff6b4a', '#2e9cf0'];
      const target = Array.from({ length: N * N }, () => Math.random() < 0.45 ? 1 + Math.floor(Math.random() * 2) : 0);
      const cur = Array(N * N).fill(0);
      let brush = 1;
      body.innerHTML = `<div class="sprite"><div><small>Mẫu</small><div class="grid tgt"></div></div><div><small>Bản của bạn</small><div class="grid mine"></div></div><div class="brushes">${colors.map((c, i) => `<button class="brush${i === 1 ? ' on' : ''}" data-i="${i}" style="background:${c}" aria-label="Màu ${i}"></button>`).join('')}</div></div>`;
      const tg = body.querySelector('.tgt') as HTMLElement, mine = body.querySelector('.mine') as HTMLElement;
      target.forEach(v => { const d = document.createElement('div'); d.style.background = colors[v]; tg.appendChild(d); });
      cur.forEach((_, i) => {
        const b = document.createElement('button'); b.style.background = colors[0];
        b.onclick = () => { if (finished) return; cur[i] = cur[i] === brush ? 0 : brush; b.style.background = colors[cur[i]]; sfx.click(); if (cur.every((v, k) => v === target[k])) done(); };
        mine.appendChild(b);
      });
      body.querySelectorAll<HTMLButtonElement>('.brush').forEach(b => b.onclick = () => { brush = Number(b.dataset.i); body.querySelectorAll('.brush').forEach(x => x.classList.toggle('on', x === b)); });
    },
    bug() {
      const acts = [['Nhảy', '⬆️'], ['Mở túi đồ', '🎒'], ['Lưu game', '💾'], ['Thoát', '🚪']];
      const seq = Array.from({ length: 5 }, () => Math.floor(Math.random() * acts.length));
      let pos = 0, showing = true;
      body.innerHTML = `<div class="simon"><p class="simon-msg">Đang xem các bước gây lỗi…</p><div class="simon-pad">${acts.map((a, i) => `<button data-i="${i}"><span>${a[1]}</span>${a[0]}</button>`).join('')}</div><p class="simon-step"></p></div>`;
      const btns = [...body.querySelectorAll<HTMLButtonElement>('.simon-pad button')], msg = body.querySelector('.simon-msg') as HTMLElement, stepEl = body.querySelector('.simon-step') as HTMLElement;
      const play = () => {
        showing = true; pos = 0; msg.textContent = 'Đang xem các bước gây lỗi…';
        seq.forEach((k, i) => {
          timers.push(window.setTimeout(() => { btns[k].classList.add('lit'); sfx.click(); }, 700 + i * 650));
          timers.push(window.setTimeout(() => btns[k].classList.remove('lit'), 700 + i * 650 + 420));
        });
        timers.push(window.setTimeout(() => { showing = false; msg.textContent = 'Đến lượt bạn: làm lại đúng các bước.'; }, 700 + seq.length * 650));
      };
      btns.forEach((b, i) => b.onclick = () => {
        if (showing || finished) return;
        if (i === seq[pos]) { pos++; sfx.click(); stepEl.textContent = `${pos}/${seq.length} bước`; if (pos >= seq.length) { msg.textContent = 'Game crash! Đã tái hiện được bug.'; done(); } }
        else { fail(); stepEl.textContent = 'Sai bước, xem lại từ đầu.'; play(); }
      });
      play();
    },
    testbuild() {
      let left = 6;
      body.innerHTML = `<div class="buglab"><div class="screen-area"></div><p class="bug-count">Còn ${left} bug</p></div>`;
      const area = body.querySelector('.screen-area') as HTMLElement;
      for (let i = 0; i < 6; i++) {
        const b = document.createElement('button'); b.className = 'crawl'; b.textContent = '🐞'; b.setAttribute('aria-label', 'Bug');
        const move = () => { b.style.left = `${5 + Math.random() * 82}%`; b.style.top = `${5 + Math.random() * 78}%`; };
        move();
        const id = window.setInterval(move, 900 + Math.random() * 700); cleanups.push(() => clearInterval(id));
        b.onclick = () => { if (finished) return; sfx.bang(); b.remove(); left--; (body.querySelector('.bug-count') as HTMLElement).textContent = `Còn ${left} bug`; if (left <= 0) done(); };
        area.appendChild(b);
      }
    },
    interview() {
      const people = [['Hưng', '9:00'], ['Diệp', '10:30'], ['Kha', '14:00'], ['Tú', '16:00']];
      const slots = [...people.map(p => p[1])].sort(() => Math.random() - 0.5);
      body.innerHTML = `<div class="sched"><div class="cands">${people.map((p, i) => `<button class="cand" data-i="${i}"><b>${p[0]}</b><small>Chỉ rảnh lúc ${p[1]}</small></button>`).join('')}</div><div class="slots">${slots.map(t => `<button class="slot" data-t="${t}">${t}</button>`).join('')}</div></div>`;
      let sel: number | null = null, ok = 0;
      body.querySelectorAll<HTMLButtonElement>('.cand').forEach(b => b.onclick = () => { if (b.disabled) return; sel = Number(b.dataset.i); body.querySelectorAll('.cand').forEach(x => x.classList.toggle('sel', x === b)); sfx.click(); });
      body.querySelectorAll<HTMLButtonElement>('.slot').forEach(b => b.onclick = () => {
        if (sel === null || b.disabled) return;
        if (people[sel][1] === b.dataset.t) {
          b.disabled = true; b.textContent = `${b.dataset.t} · ${people[sel][0]}`; b.classList.add('ok');
          const c = body.querySelector(`.cand[data-i="${sel}"]`) as HTMLButtonElement; c.disabled = true; c.classList.remove('sel');
          sel = null; ok++; sfx.click(); if (ok >= people.length) done();
        } else { fail(); toastIn(body, 'Ứng viên không rảnh giờ đó.'); }
      });
    },
    balance() {
      const stats = [['Máu', '#e2412f'], ['Sát thương', '#f2b705'], ['Tốc độ', '#2e9cf0']];
      const zones = stats.map(() => 20 + Math.floor(Math.random() * 55));
      body.innerHTML = `<div class="balance">${stats.map((s, i) => `<label><span>${s[0]}</span><div class="bal-track"><i class="zone" style="left:${zones[i]}%"></i><input type="range" min="0" max="100" value="${Math.random() < 0.5 ? 2 : 98}" style="--c:${s[1]}" data-i="${i}"></div></label>`).join('')}<p class="bal-msg">Người chơi đang chửi trên diễn đàn: "game mất cân bằng!"</p></div>`;
      const inputs = [...body.querySelectorAll<HTMLInputElement>('input')];
      const check = () => { if (inputs.every((inp, i) => { const v = Number(inp.value); return v >= zones[i] && v <= zones[i] + 12; })) done(); };
      inputs.forEach(inp => inp.oninput = () => { if (!finished) check(); });
    },
    projector() {
      const inputs = ['HDMI 1', 'VGA', 'HDMI 2', 'USB-C', 'AV'];
      const want = inputs[1 + Math.floor(Math.random() * (inputs.length - 1))];
      let cur = 0;
      body.innerHTML = `<div class="proj"><div class="proj-screen"><b class="src">${inputs[0]}</b><small>Không có tín hiệu</small></div><p>Laptop đang cắm vào cổng <b>${want}</b>.</p><div class="row"><button class="ghost-btn next-src">Đổi nguồn vào</button><button class="primary ok-src">Chọn</button></div></div>`;
      const src = body.querySelector('.src') as HTMLElement;
      (body.querySelector('.next-src') as HTMLElement).onclick = () => { cur = (cur + 1) % inputs.length; src.textContent = inputs[cur]; sfx.click(); };
      (body.querySelector('.ok-src') as HTMLElement).onclick = () => {
        if (inputs[cur] === want) { (body.querySelector('.proj-screen') as HTMLElement).classList.add('on'); (body.querySelector('.proj-screen small') as HTMLElement).textContent = 'Slide 1/87: "Tổng kết quý"'; done(); }
        else { fail(); toastIn(body, 'Sai cổng, màn hình vẫn xanh lè.'); }
      };
    },
    printdoc() {
      const want = { sides: Math.random() < 0.5 ? '2 mặt' : '1 mặt', copies: 1 + Math.floor(Math.random() * 4), color: Math.random() < 0.5 ? 'Màu' : 'Trắng đen' };
      const st = { sides: '1 mặt', copies: 1, color: 'Trắng đen' };
      body.innerHTML = `<div class="print"><div class="note"><b>Yêu cầu:</b> ${want.copies} bản, ${want.sides}, ${want.color.toLowerCase()}</div>
        <div class="print-opts"><button class="opt sides">${st.sides}</button><div class="cnt"><button class="minus">−</button><b class="copies">${st.copies}</b><button class="plus">+</button></div><button class="opt color">${st.color}</button></div>
        <button class="primary big go-print">In</button><div class="bar"><i></i></div></div>`;
      const q = (c: string) => body.querySelector(c) as HTMLElement;
      q('.sides').onclick = () => { st.sides = st.sides === '1 mặt' ? '2 mặt' : '1 mặt'; q('.sides').textContent = st.sides; sfx.click(); };
      q('.color').onclick = () => { st.color = st.color === 'Màu' ? 'Trắng đen' : 'Màu'; q('.color').textContent = st.color; sfx.click(); };
      q('.minus').onclick = () => { st.copies = Math.max(1, st.copies - 1); q('.copies').textContent = String(st.copies); };
      q('.plus').onclick = () => { st.copies = Math.min(9, st.copies + 1); q('.copies').textContent = String(st.copies); };
      q('.go-print').onclick = () => {
        if (st.sides !== want.sides || st.copies !== want.copies || st.color !== want.color) { fail(); toastIn(body, 'Sai cài đặt, in lại tốn giấy lắm!'); return; }
        (q('.go-print') as HTMLButtonElement).disabled = true;
        let p = 0; const id = window.setInterval(() => { p += 4; (q('.bar i')).style.width = p + '%'; if (p % 20 === 0) sfx.key(); if (p >= 100) { clearInterval(id); done(); } }, 80);
        cleanups.push(() => clearInterval(id));
      };
    },
    minutes() {
      const docs = ['Biên bản họp 08:30 – Sprint review', 'Biên bản họp 08:30 – Sprint revew', 'Biên bản họp 18:30 – Sprint review', 'Thực đơn tiệc cuối năm', 'Biên bản họp 08:30 – Sprlnt review', 'Đơn xin nghỉ phép (chưa duyệt)'];
      const order = [...docs.keys()].sort(() => Math.random() - 0.5);
      body.innerHTML = `<div class="papers"><p>Cần: <b>${docs[0]}</b></p><div class="pile">${order.map(i => `<button class="paper-doc" data-i="${i}">${docs[i]}</button>`).join('')}</div></div>`;
      body.querySelectorAll<HTMLButtonElement>('.paper-doc').forEach(b => b.onclick = () => {
        if (finished) return;
        if (b.dataset.i === '0') { sfx.whoosh(); b.classList.add('ok'); done(); }
        else { fail(); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); toastIn(body, 'Không phải tờ này, đọc kỹ lại.'); }
      });
    },
    pushbuild() {
      body.innerHTML = `<div class="push"><pre class="term">$ git push origin release</pre><button class="primary big go">Đẩy build</button><div class="bar"><i></i></div><p class="push-msg"></p></div>`;
      const go = body.querySelector('.go') as HTMLButtonElement, bar = body.querySelector('.bar i') as HTMLElement, term = body.querySelector('.term') as HTMLElement;
      go.onclick = () => {
        go.disabled = true; let p = 0;
        const lines = ['Compressing objects…', 'Uploading 2.3 GB…', 'Chạy unit test… (bỏ qua 47 test)', 'Done.'];
        const id = window.setInterval(() => { p += 2; bar.style.width = p + '%'; if (p % 25 === 0) { term.textContent += '\n' + lines[p / 25 - 1]; sfx.modem(); } if (p >= 100) { clearInterval(id); done(); } }, 90);
        cleanups.push(() => clearInterval(id));
      };
    },

    excel() {
      const cols = 6, rows = 5, need = 6;
      let got = 0, active = -1;
      body.innerHTML = `<div class="xl"><div class="xl-bar"><span class="fx">fx</span><span class="xl-formula">=SUM(KPI_quý_này)</span></div><div class="xl-grid"></div><div class="xl-progress">0/${need} ô</div></div>`;
      const grid = body.querySelector('.xl-grid') as HTMLElement;
      grid.style.gridTemplateColumns = `28px repeat(${cols}, 1fr)`;
      const cells: HTMLElement[] = [];
      grid.innerHTML = '<div class="xl-h"></div>' + 'ABCDEF'.split('').map(c => `<div class="xl-h">${c}</div>`).join('');
      for (let r = 0; r < rows; r++) {
        const rh = document.createElement('div'); rh.className = 'xl-h'; rh.textContent = String(r + 1); grid.appendChild(rh);
        for (let c = 0; c < cols; c++) {
          const cell = document.createElement('button'); cell.className = 'xl-c';
          const i = cells.length;
          cell.onclick = () => {
            if (finished) return;
            if (i === active) {
              sfx.key(); cell.classList.remove('lit'); cell.classList.add('filled');
              cell.textContent = String(Math.floor(Math.random() * 900 + 100));
              got++; (body.querySelector('.xl-progress') as HTMLElement).textContent = `${got}/${need} ô`;
              if (got >= need) done(); else next();
            } else {
              fail(); grid.classList.remove('shake'); void grid.offsetWidth; grid.classList.add('shake');
              got = 0; cells.forEach(x => { x.classList.remove('filled'); x.textContent = ''; });
              (body.querySelector('.xl-progress') as HTMLElement).textContent = `Sai ô! Làm lại: 0/${need}`;
            }
          };
          grid.appendChild(cell); cells.push(cell);
        }
      }
      const next = () => {
        if (active >= 0) cells[active].classList.remove('lit');
        let n; do { n = Math.floor(Math.random() * cells.length); } while (n === active || cells[n].classList.contains('filled'));
        active = n; cells[n].classList.add('lit');
      };
      next();
    },
    wires() {
      // Cầm đầu dây bên trái kéo sang đúng cổng cùng màu bên phải
      const colors = [['#e2412f', 'Đỏ'], ['#f2b705', 'Vàng'], ['#2e9cf0', 'Xanh'], ['#ff5fa2', 'Hồng']];
      const right = [...colors.keys()].sort(() => Math.random() - 0.5);
      body.innerHTML = `<div class="wires"><svg class="wire-svg"></svg><div class="wcol l"></div><div class="wire-guide" aria-hidden="true"><b>Kéo từ đây</b><span>➜</span><b>cắm vào cổng cùng màu</b></div><div class="wcol r"></div></div>`;
      const L = body.querySelector('.wcol.l') as HTMLElement, R = body.querySelector('.wcol.r') as HTMLElement;
      const svg = body.querySelector('svg') as SVGSVGElement;
      const box = body.querySelector('.wires') as HTMLElement;
      let connected = 0;
      const lefts: HTMLElement[] = [];
      const curve = (x1: number, y1: number, x2: number, y2: number) => `M${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`;
      const anchor = (el: HTMLElement, side: 'r' | 'l') => {
        const r = el.getBoundingClientRect(), o = box.getBoundingClientRect();
        return [(side === 'r' ? r.right : r.left) - o.left, r.top + r.height / 2 - o.top];
      };
      colors.forEach(([c, n], i) => {
        const b = document.createElement('div'); b.className = 'port grab'; b.style.setProperty('--c', c); b.setAttribute('aria-label', 'Dây ' + n);
        b.dataset.i = String(i);
        L.appendChild(b); lefts.push(b);
        b.onpointerdown = (e) => {
          if (b.classList.contains('ok') || finished) return;
          e.preventDefault();
          b.setPointerCapture(e.pointerId);
          const [x1, y1] = anchor(b, 'r');
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          line.setAttribute('stroke', c); line.classList.add('live');
          svg.appendChild(line);
          sfx.click();
          const move = (ev: PointerEvent) => {
            const o = box.getBoundingClientRect();
            line.setAttribute('d', curve(x1, y1, ev.clientX - o.left, ev.clientY - o.top));
          };
          move(e);
          b.onpointermove = move;
          const end = (ev: PointerEvent) => {
            b.onpointermove = null; b.onpointerup = null; b.onpointercancel = null;
            const hit = (document.elementsFromPoint(ev.clientX, ev.clientY).find(el => (el as HTMLElement).classList?.contains('port') && (el as HTMLElement).parentElement === R) as HTMLElement | undefined);
            if (hit && hit.dataset.i === String(i) && !hit.classList.contains('ok')) {
              const [x2, y2] = anchor(hit, 'l');
              line.setAttribute('d', curve(x1, y1, x2, y2)); line.classList.remove('live');
              b.classList.add('ok'); hit.classList.add('ok');
              connected++; sfx.click();
              if (connected >= colors.length) done();
            } else {
              line.remove();
              if (hit) { fail(); hit.classList.remove('shake'); void hit.offsetWidth; hit.classList.add('shake'); }
            }
          };
          b.onpointerup = end; b.onpointercancel = end;
        };
      });
      right.forEach((ci) => {
        const b = document.createElement('div'); b.className = 'port'; b.style.setProperty('--c', colors[ci][0]); b.setAttribute('aria-label', 'Cổng ' + colors[ci][1]);
        b.dataset.i = String(ci);
        R.appendChild(b);
      });
    },
    fridge() {
      const fresh = ['🥛', '🍱', '🧃', '🍎', '🧀', '🥚', '🍰', '🥗', '🍙'];
      const n = 9, moldy = new Set<number>();
      while (moldy.size < 4) moldy.add(Math.floor(Math.random() * n));
      body.innerHTML = `<div class="fridge"><div class="shelves"></div><div class="fridge-note">Ghi chú dán tủ: "Đồ ai người nấy dọn!!!" — HR</div></div>`;
      const sh = body.querySelector('.shelves') as HTMLElement;
      let left = moldy.size;
      for (let i = 0; i < n; i++) {
        const b = document.createElement('button');
        b.className = 'food' + (moldy.has(i) ? ' moldy' : '');
        b.innerHTML = `<span>${fresh[i % fresh.length]}</span>${moldy.has(i) ? '<i class="mold"></i>' : ''}`;
        b.setAttribute('aria-label', moldy.has(i) ? 'Đồ ăn bị mốc' : 'Đồ ăn còn tươi');
        b.onclick = () => {
          if (b.classList.contains('gone')) return;
          if (moldy.has(i)) { b.classList.add('gone'); sfx.whoosh(); left--; if (left <= 0) done(); }
          else { fail(); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); toastIn(body, 'Đồ của sếp đấy! Để nguyên.'); }
        };
        sh.appendChild(b);
      }
    },
    coffee() {
      const ing = [['espresso', 'Shot espresso', '#5a3825'], ['sua', 'Sữa đặc', '#f4e7cf'], ['duong', 'Thìa đường', '#ffffff'], ['da', 'Viên đá', '#cdeeff']] as const;
      const want = ing.map((_, i) => i === 0 ? 1 + Math.floor(Math.random() * 3) : Math.floor(Math.random() * 4));
      const have = ing.map(() => 0);
      body.innerHTML = `<div class="coffee">
        <div class="note"><b>Sếp dặn:</b><ul>${ing.map((x, i) => `<li>${want[i]} ${x[1].toLowerCase()}</li>`).join('')}</ul><small>Sai là sếp gọi lên "nói chuyện riêng".</small></div>
        <div class="cup-area"><div class="cup"><div class="layers"></div></div>
        <div class="ing">${ing.map((x, i) => `<button data-i="${i}"><span class="dot" style="background:${x[2]}"></span>${x[1]} <b>0</b></button>`).join('')}</div>
        <div class="row"><button class="ghost-btn reset">Đổ đi làm lại</button><button class="primary serve">Mang lên cho sếp</button></div></div></div>`;
      const layers = body.querySelector('.layers') as HTMLElement;
      const render = () => {
        layers.innerHTML = '';
        ing.forEach((x, i) => { for (let k = 0; k < have[i]; k++) { const d = document.createElement('div'); d.style.background = x[2]; layers.appendChild(d); } });
        body.querySelectorAll<HTMLButtonElement>('.ing button').forEach((b, i) => { b.querySelector('b')!.textContent = String(have[i]); });
      };
      body.querySelectorAll<HTMLButtonElement>('.ing button').forEach(b => b.onclick = () => { const i = Number(b.dataset.i); if (have[i] < 5) { have[i]++; sfx.click(); render(); } });
      (body.querySelector('.reset') as HTMLElement).onclick = () => { have.fill(0); sfx.whoosh(); render(); };
      (body.querySelector('.serve') as HTMLElement).onclick = () => {
        if (have.every((h, i) => h === want[i])) { sfx.sip(); done(); }
        else { fail(); toastIn(body, have[0] < want[0] ? 'Sếp chê: nhạt như nước ốc!' : 'Sếp chê: sai công thức rồi em ơi.'); have.fill(0); render(); }
      };
    },
    copier() {
      let p = 0;
      body.innerHTML = `<div class="copier"><button class="copier-btn" aria-label="Đập vào máy photocopy"><span class="cp-top"></span><span class="cp-paper"></span><span class="cp-label">ĐẬP!</span></button><div class="bar"><i></i></div><div class="cp-msg">Lỗi E-404: kẹt giấy ở khay 2</div></div>`;
      const btn = body.querySelector('.copier-btn') as HTMLElement, bar = body.querySelector('.bar i') as HTMLElement;
      btn.onpointerdown = (e) => {
        e.preventDefault(); if (finished) return;
        p = Math.min(100, p + 8.5); sfx.bang();
        btn.classList.remove('hit'); void btn.offsetWidth; btn.classList.add('hit');
        if (p >= 100) { (body.querySelector('.cp-msg') as HTMLElement).textContent = 'Rè rè rè… giấy ra rồi!'; done(); }
      };
      const id = window.setInterval(() => { if (!finished) { p = Math.max(0, p - 2.2); } bar.style.width = p + '%'; }, 60);
      cleanups.push(() => clearInterval(id));
    },
    stamp() {
      let ok = 0; const need = 5;
      body.innerHTML = `<div class="stamp"><div class="doc"></div><div class="row"><button class="ghost-btn reject">Trả về</button><button class="primary approve">Duyệt</button></div><div class="st-progress">0/${need} hồ sơ</div></div>`;
      const docEl = body.querySelector('.doc') as HTMLElement;
      let cur = { signed: true, amount: 0, valid: true };
      const limit = 50;
      const titles = ['Đề xuất mua ghế công thái học', 'Tạm ứng tiếp khách', 'Thanh toán teambuilding Vũng Tàu', 'Mua thêm cây cảnh cho Open Space', 'Gia hạn phần mềm chấm công', 'Chi phí in standee "Chúng ta là gia đình"'];
      const next = () => {
        const signed = Math.random() < 0.65, amount = Math.floor(Math.random() * 90) + 5;
        cur = { signed, amount, valid: signed && amount <= limit };
        docEl.innerHTML = `<h3>${titles[Math.floor(Math.random() * titles.length)]}</h3>
          <p>Số tiền: <b>${amount} triệu</b> <small>(hạn mức ${limit} triệu)</small></p>
          <p>Người đề xuất ký: ${signed ? '<span class="sig">Ng.V.A</span>' : '<span class="nosig">(chưa ký)</span>'}</p>`;
        docEl.classList.remove('in'); void docEl.offsetWidth; docEl.classList.add('in');
      };
      const judge = (approve: boolean) => {
        if (finished) return;
        if (approve === cur.valid) { ok++; sfx.stamp(); }
        else { ok = 0; fail(); toastIn(body, cur.valid ? 'Hồ sơ hợp lệ mà! Làm lại.' : 'Duyệt bừa là Kế toán tìm bạn đấy. Làm lại.'); }
        (body.querySelector('.st-progress') as HTMLElement).textContent = `${ok}/${need} hồ sơ`;
        if (ok >= need) done(); else next();
      };
      (body.querySelector('.approve') as HTMLElement).onclick = () => judge(true);
      (body.querySelector('.reject') as HTMLElement).onclick = () => judge(false);
      next();
    },
    router() {
      body.innerHTML = `<div class="router"><div class="leds"><i></i><i></i><i></i><i></i></div><button class="hold" aria-label="Giữ nút nguồn"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="track"/><circle cx="50" cy="50" r="44" class="prog"/></svg><span>Giữ</span></button><p class="router-msg">Đèn WAN nhấp nháy đỏ. Đã thử rút ra cắm lại chưa?</p></div>`;
      const btn = body.querySelector('.hold') as HTMLElement, prog = body.querySelector('.prog') as SVGCircleElement;
      const C = 2 * Math.PI * 44; prog.style.strokeDasharray = `${C}`; prog.style.strokeDashoffset = `${C}`;
      let t = 0, holding = false;
      const set = () => { prog.style.strokeDashoffset = `${C * (1 - t / 3)}`; };
      btn.onpointerdown = (e) => { e.preventDefault(); holding = true; btn.setPointerCapture(e.pointerId); };
      const up = () => { holding = false; if (!finished) { t = 0; set(); } };
      btn.onpointerup = up; btn.onpointercancel = up;
      const id = window.setInterval(() => {
        if (holding && !finished) { t += 0.05; if (Math.random() < 0.3) sfx.modem(); set(); if (t >= 3) { body.querySelectorAll('.leds i').forEach(x => x.classList.add('on')); done(); } }
      }, 50);
      cleanups.push(() => clearInterval(id));
    },
    power() {
      const n = 5;
      const st = Array.from({ length: n }, () => Math.random() < 0.3);
      if (st.every(Boolean)) st[0] = false;
      body.innerHTML = `<div class="power"><div class="breakers"></div><p>Cảnh báo: không cắm ấm siêu tốc chung ổ với máy chủ.</p></div>`;
      const wrapB = body.querySelector('.breakers') as HTMLElement;
      st.forEach((on, i) => {
        const b = document.createElement('button'); b.className = 'breaker' + (on ? ' on' : ''); b.setAttribute('aria-label', 'Cầu dao ' + (i + 1));
        b.innerHTML = '<span></span>';
        b.onclick = () => { if (finished) return; st[i] = !st[i]; b.classList.toggle('on', st[i]); sfx.click(); if (st.every(Boolean)) { sfx.powerUp(); done(); } };
        wrapB.appendChild(b);
      });
    },
  };
  builders[kind]();
}

function toastIn(el: HTMLElement, msg: string) {
  const t = document.createElement('div');
  t.className = 'mini-toast';
  t.textContent = msg;
  el.appendChild(t);
  setTimeout(() => t.remove(), 1600);
}

/** Máy Face ID của HR: chọn một người rồi giữ tay quét 4 giây (máy phát sáng, ai đứng gần cũng thấy) */
export function openFaceId(
  root: HTMLElement,
  people: { id: number; name: string; url: string; bg: string }[],
  onHold: (on: boolean) => void,
  onDone: (target: number) => void,
) {
  closeMini();
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `
    <div class="sheet mini mini-faceid" role="dialog" aria-label="Máy Face ID">
      <div class="sheet-head">
        <div><h2>Máy Face ID</h2><p class="hint">Chọn một người để xác minh. Kết quả về sau 60 giây chơi, chỉ bạn thấy. Đang quét thì máy phát sáng hồng.</p></div>
        <button class="x" aria-label="Đóng">✕</button>
      </div>
      <div class="mini-body">
        <div class="fid-people">${people.map(p => `<button class="fid-p" data-id="${p.id}"><img src="${p.url}" alt=""><span>${p.name}</span></button>`).join('')}</div>
        <div class="fid-scan" hidden></div>
      </div>
    </div>`;
  root.appendChild(wrap);
  const body = wrap.querySelector('.mini-body') as HTMLElement;
  let timer = 0, holding = false, t = 0, finished = false;
  current = { el: wrap, cleanup: () => { clearInterval(timer); onHold(false); } };
  (wrap.querySelector('.x') as HTMLElement).onclick = () => closeMini();
  wrap.querySelectorAll<HTMLButtonElement>('.fid-p').forEach(b => b.onclick = () => {
    const id = Number(b.dataset.id);
    const who = people.find(p => p.id === id)!;
    (body.querySelector('.fid-people') as HTMLElement).hidden = true;
    const scan = body.querySelector('.fid-scan') as HTMLElement;
    scan.hidden = false;
    scan.innerHTML = `<p>Đang xác minh hồ sơ của <b>${who.name}</b></p>
      <div class="router scanner-box hr"><button class="hold" aria-label="Giữ để quét"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="track"/><circle cx="50" cy="50" r="44" class="prog"/></svg><span>Giữ để quét</span></button></div>`;
    const btn = scan.querySelector('.hold') as HTMLElement, prog = scan.querySelector('.prog') as SVGCircleElement;
    const C = 2 * Math.PI * 44; prog.style.strokeDasharray = `${C}`; prog.style.strokeDashoffset = `${C}`;
    btn.onpointerdown = (e) => { e.preventDefault(); holding = true; btn.setPointerCapture(e.pointerId); onHold(true); };
    const up = () => { holding = false; onHold(false); if (!finished) { t = 0; prog.style.strokeDashoffset = `${C}`; } };
    btn.onpointerup = up; btn.onpointercancel = up;
    timer = window.setInterval(() => {
      if (!holding || finished) return;
      t += 0.05; prog.style.strokeDashoffset = `${C * (1 - t / 4)}`;
      if (Math.random() < 0.12) sfx.click();
      if (t >= 4) {
        finished = true; onHold(false); sfx.taskDone();
        body.classList.add('mini-done');
        setTimeout(() => { closeMini(); onDone(id); }, 550);
      }
    }, 50);
  });
}

/** Quẹt thẻ nhân viên ở cửa từ: kéo thẻ qua đầu đọc với tốc độ vừa phải */
export function openCardSwipe(root: HTMLElement, onDone: () => void) {
  closeMini();
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `
    <div class="sheet mini mini-swipe" role="dialog" aria-label="Quẹt thẻ">
      <div class="sheet-head">
        <div><h2>Quẹt thẻ mở cửa</h2><p class="hint">Kéo thẻ nhân viên qua đầu đọc từ trái sang phải, không nhanh quá cũng không chậm quá.</p></div>
        <button class="x" aria-label="Đóng">✕</button>
      </div>
      <div class="mini-body">
        <div class="reader"><div class="reader-led"></div><div class="reader-slot"><div class="card-badge"><b>THẺ NHÂN VIÊN</b><i></i></div></div></div>
        <p class="swipe-msg">Cửa từ báo lỗi thẻ. Quẹt lại đi.</p>
      </div>
    </div>`;
  root.appendChild(wrap);
  const body = wrap.querySelector('.mini-body') as HTMLElement;
  const card = wrap.querySelector('.card-badge') as HTMLElement;
  const slot = wrap.querySelector('.reader-slot') as HTMLElement;
  const msg = wrap.querySelector('.swipe-msg') as HTMLElement;
  const led = wrap.querySelector('.reader-led') as HTMLElement;
  let startX = 0, t0 = 0, dragging = false, finished = false;
  current = { el: wrap, cleanup: () => {} };
  (wrap.querySelector('.x') as HTMLElement).onclick = () => closeMini();
  const maxX = () => slot.clientWidth - card.offsetWidth;
  card.onpointerdown = (e) => {
    if (finished) return;
    e.preventDefault(); dragging = true; startX = e.clientX; t0 = performance.now();
    card.setPointerCapture(e.pointerId); card.style.transition = 'none';
  };
  card.onpointermove = (e) => {
    if (!dragging) return;
    const x = Math.max(0, Math.min(maxX(), e.clientX - startX));
    card.style.transform = `translateX(${x}px)`;
  };
  const end = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    const x = Math.max(0, Math.min(maxX(), e.clientX - startX));
    const dt = (performance.now() - t0) / 1000;
    const reset = () => { card.style.transition = 'transform .25s'; card.style.transform = 'translateX(0)'; };
    if (x < maxX() * 0.92) { msg.textContent = 'Quẹt chưa hết thẻ.'; reset(); return; }
    if (dt < 0.35) { msg.textContent = 'Quẹt nhanh quá, máy không đọc kịp.'; sfx.fail(); led.className = 'reader-led bad'; reset(); return; }
    if (dt > 1.6) { msg.textContent = 'Quẹt chậm quá, thử lại.'; sfx.fail(); led.className = 'reader-led bad'; reset(); return; }
    finished = true; led.className = 'reader-led ok'; msg.textContent = 'Bíp! Cửa đã mở.'; sfx.ting();
    body.classList.add('mini-done');
    setTimeout(() => { closeMini(); onDone(); }, 500);
  };
  card.onpointerup = end; card.onpointercancel = end;
}

/** Máy so màu của Artist: chọn nhóm màu, giữ nút 3 giây để so, nhận kết quả Có / Không có */
export function openColorCheck(
  root: HTMLElement,
  groups: { id: string; name: string; hex: string }[],
  history: { name: string; hex: string; has: boolean }[],
  onHold: (on: boolean) => void,
  onDone: (group: string) => boolean | null,
) {
  closeMini();
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `
    <div class="sheet mini mini-color" role="dialog" aria-label="Máy so màu">
      <div class="sheet-head">
        <div><h2>🎨 Máy so màu</h2><p class="hint">Chọn một màu. Máy cho biết trên người Nội gián (ở bất kỳ chỗ nào) có màu đó không. Đang so thì máy phát sáng, người đứng gần sẽ thấy.</p></div>
        <button class="x" aria-label="Đóng">✕</button>
      </div>
      <div class="mini-body">
        <div class="cc-groups">${groups.map(g => `<button class="cc-g" data-id="${g.id}" style="--c:${g.hex}"><i></i><span>${g.name}</span></button>`).join('')}</div>
        <div class="cc-scan" hidden></div>
        ${history.length ? `<div class="cc-hist"><b>Đã so trước đây:</b> ${history.map(h => `<span><i style="background:${h.hex}"></i>${h.name}: ${h.has ? 'CÓ' : 'KHÔNG'}</span>`).join('')}</div>` : ''}
      </div>
    </div>`;
  root.appendChild(wrap);
  const body = wrap.querySelector('.mini-body') as HTMLElement;
  let timer = 0, holding = false, t = 0, finished = false;
  current = { el: wrap, cleanup: () => { clearInterval(timer); onHold(false); } };
  (wrap.querySelector('.x') as HTMLElement).onclick = () => closeMini();
  wrap.querySelectorAll<HTMLButtonElement>('.cc-g').forEach(b => b.onclick = () => {
    const g = groups.find(x => x.id === b.dataset.id)!;
    (body.querySelector('.cc-groups') as HTMLElement).hidden = true;
    const scan = body.querySelector('.cc-scan') as HTMLElement;
    scan.hidden = false;
    scan.innerHTML = `<p>So màu <b style="color:${g.hex};text-shadow:0 0 1px #000">${g.name}</b> với hồ sơ Nội gián</p>
      <div class="router scanner-box"><button class="hold" aria-label="Giữ để so màu"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="track"/><circle cx="50" cy="50" r="44" class="prog" style="stroke:${g.hex}"/></svg><span>Giữ để so</span></button></div>
      <div class="cc-result" hidden></div>`;
    const btn = scan.querySelector('.hold') as HTMLElement, prog = scan.querySelector('.prog') as SVGCircleElement;
    const C = 2 * Math.PI * 44; prog.style.strokeDasharray = `${C}`; prog.style.strokeDashoffset = `${C}`;
    btn.onpointerdown = (e) => { e.preventDefault(); holding = true; btn.setPointerCapture(e.pointerId); onHold(true); };
    const up = () => { holding = false; onHold(false); if (!finished) { t = 0; prog.style.strokeDashoffset = `${C}`; } };
    btn.onpointerup = up; btn.onpointercancel = up;
    timer = window.setInterval(() => {
      if (!holding || finished) return;
      t += 0.05; prog.style.strokeDashoffset = `${C * (1 - t / 3)}`;
      if (Math.random() < 0.12) sfx.click();
      if (t >= 3) {
        finished = true; onHold(false);
        const has = onDone(g.id);
        if (has === null) { closeMini(); return; }
        has ? sfx.fail() : sfx.taskDone();
        const r = scan.querySelector('.cc-result') as HTMLElement;
        (scan.querySelector('.router') as HTMLElement).hidden = true;
        r.hidden = false;
        r.className = 'cc-result ' + (has ? 'bad' : 'good');
        r.innerHTML = has ? `<b>CÓ</b><span>Ít nhất một Nội gián có màu ${g.name.toLowerCase()} trên người.</span>` : `<b>KHÔNG CÓ</b><span>Không Nội gián nào có màu ${g.name.toLowerCase()} trên người.</span>`;
      }
    }, 50);
  });
}

/** Giữ nút trong vài giây (cạy cửa thang, mở cửa thang kẹt...) */
export function openHold(root: HTMLElement, title: string, hint: string, label: string, seconds: number, onDone: () => void) {
  closeMini();
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `<div class="sheet mini" role="dialog" aria-label="${title}">
    <div class="sheet-head"><div><h2>${title}</h2><p class="hint">${hint}</p></div><button class="x" aria-label="Đóng">✕</button></div>
    <div class="mini-body"><div class="router"><button class="hold" aria-label="${label}"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" class="track"/><circle cx="50" cy="50" r="44" class="prog"/></svg><span>${label}</span></button></div></div></div>`;
  root.appendChild(wrap);
  const btn = wrap.querySelector('.hold') as HTMLElement, prog = wrap.querySelector('.prog') as SVGCircleElement;
  const C = 2 * Math.PI * 44; prog.style.strokeDasharray = `${C}`; prog.style.strokeDashoffset = `${C}`;
  let t = 0, holding = false, done = false;
  const timer = window.setInterval(() => {
    if (!holding || done) return;
    t += 0.05; prog.style.strokeDashoffset = `${C * (1 - t / seconds)}`;
    if (Math.random() < 0.15) sfx.click();
    if (t >= seconds) { done = true; sfx.taskDone(); setTimeout(() => { closeMini(); onDone(); }, 250); }
  }, 50);
  current = { el: wrap, cleanup: () => clearInterval(timer) };
  (wrap.querySelector('.x') as HTMLElement).onclick = () => closeMini();
  btn.onpointerdown = (e) => { e.preventDefault(); holding = true; btn.setPointerCapture(e.pointerId); };
  const up = () => { holding = false; if (!done) { t = 0; prog.style.strokeDashoffset = `${C}`; } };
  btn.onpointerup = up; btn.onpointercancel = up;
}
