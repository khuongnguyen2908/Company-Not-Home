// Các mini-game "chạy KPI" và sửa sự cố, dựng bằng HTML
import { sfx } from '../audio';

import type { MiniKind } from '../game/map';
export type { MiniKind };

const TITLES: Record<MiniKind, { title: string; hint: string }> = {
  excel: { title: 'Nhập liệu Excel', hint: 'Bấm đúng ô đang sáng. Sai một ô là phải làm lại từ đầu, như ngoài đời.' },
  wires: { title: 'Nối lại dây cáp server', hint: 'Chọn một đầu dây bên trái rồi nối sang đúng cổng cùng màu bên phải.' },
  fridge: { title: 'Dọn đồ mốc trong tủ lạnh chung', hint: 'Vứt hết đồ đã mốc. Đồ còn tươi là của sếp, đừng đụng vào.' },
  coffee: { title: 'Pha cà phê cho sếp', hint: 'Pha đúng công thức trên tờ giấy note rồi mang lên.' },
  copier: { title: 'Gỡ kẹt máy photocopy', hint: 'Đập liên tục vào máy cho đến khi giấy chạy lại. Ngừng tay là kẹt lại.' },
  stamp: { title: 'Ký duyệt hồ sơ', hint: 'Duyệt hồ sơ có chữ ký và số tiền trong hạn mức. Còn lại trả về.' },
  router: { title: 'Khởi động lại Router', hint: 'Giữ nút nguồn 3 giây. Thả tay ra là phải giữ lại từ đầu.' },
  power: { title: 'Bật lại cầu dao', hint: 'Gạt tất cả cầu dao lên vị trí BẬT.' },
  fingerprint: { title: 'Chấm công vân tay', hint: 'Đặt ngón tay lên máy quét và giữ 3 giây. Ai đứng gần cũng thấy đèn xanh.' },
  delivery: { title: 'Ký nhận hàng', hint: 'Ký vào ô chữ ký. Phải ký đủ dài, ký một chấm là shipper không chịu.' },
  waterplant: { title: 'Tưới cây ở sảnh', hint: 'Giữ nút tưới cho đến khi nước lên tới vạch xanh, đừng để tràn.' },
  backlog: { title: 'Sắp xếp backlog', hint: 'Bấm các thẻ theo thứ tự ưu tiên: P1 trước, P4 sau cùng.' },
  sprite: { title: 'Tô màu sprite', hint: 'Tô lưới bên phải cho giống hệt mẫu bên trái.' },
  bug: { title: 'Tái hiện bug', hint: 'Xem các bước gây lỗi rồi bấm lại đúng thứ tự.' },
  testbuild: { title: 'Test bản build', hint: 'Bắt hết 6 con bug đang bò trên màn hình.' },
  interview: { title: 'Xếp lịch phỏng vấn', hint: 'Chọn một ứng viên rồi bấm vào khung giờ người đó rảnh.' },
  balance: { title: 'Cân bằng chỉ số game', hint: 'Kéo ba thanh chỉ số vào đúng vùng xanh trên bảng trắng.' },
  projector: { title: 'Bật máy chiếu', hint: 'Bấm nút Nguồn vào cho tới khi màn hình hiện đúng cổng laptop.' },
  getwater: { title: 'Lấy nước tưới cây', hint: 'Giữ vòi nước, thả tay khi nước nằm trong vạch xanh.' },
  toilet: { title: 'Thay cuộn giấy', hint: 'Kéo hết cuộn cũ ra rồi lắp cuộn mới vào.' },
  printdoc: { title: 'In tài liệu', hint: 'Chọn đúng cài đặt in như trong yêu cầu rồi bấm In.' },
  minutes: { title: 'Lấy biên bản họp', hint: 'Tìm đúng biên bản cuộc họp sáng nay trong chồng giấy.' },
  pushbuild: { title: 'Đẩy bản build', hint: 'Bấm đẩy build rồi chờ thanh tải lên chạy xong. Đi chỗ khác là phải làm lại.' },
};

let current: { el: HTMLElement; cleanup: () => void } | null = null;

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
    body.innerHTML = `<div class="fillgame"><div class="tank"><div class="zone"></div><div class="water"></div></div><button class="primary big pour">${label}</button><p class="fill-msg"></p></div>`;
    const water = body.querySelector('.water') as HTMLElement, btn = body.querySelector('.pour') as HTMLElement, msg = body.querySelector('.fill-msg') as HTMLElement;
    let lv = 0, holding = false;
    btn.onpointerdown = (e) => { e.preventDefault(); holding = true; btn.setPointerCapture(e.pointerId); };
    const up = () => {
      if (!holding || finished) return; holding = false;
      if (lv >= 62 && lv <= 80) { sfx.sip(); done(); }
      else if (lv > 80) { sfx.fail(); msg.textContent = 'Tràn rồi! Đổ đi làm lại.'; lv = 0; }
      else if (lv > 0) { msg.textContent = 'Chưa đủ, giữ thêm chút nữa.'; }
    };
    btn.onpointerup = up; btn.onpointercancel = up;
    const id = window.setInterval(() => { if (holding && !finished) { lv = Math.min(100, lv + 1.6); if (lv >= 100) up(); } water.style.height = lv + '%'; }, 40);
    cleanups.push(() => clearInterval(id));
  };

  const builders: Record<MiniKind, () => void> = {
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
          else { sfx.fail(); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); toastIn(body, `Chưa tới lượt ${p}!`); }
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
        else { sfx.fail(); stepEl.textContent = 'Sai bước, xem lại từ đầu.'; play(); }
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
        } else { sfx.fail(); toastIn(body, 'Ứng viên không rảnh giờ đó.'); }
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
        else { sfx.fail(); toastIn(body, 'Sai cổng, màn hình vẫn xanh lè.'); }
      };
    },
    toilet() {
      let pulls = 0, stage = 0;
      body.innerHTML = `<div class="tp"><button class="roll" aria-label="Kéo giấy"><span class="sheet-tp"></span></button><p class="tp-msg">Kéo hết cuộn cũ ra (bấm liên tục).</p></div>`;
      const roll = body.querySelector('.roll') as HTMLElement, msg = body.querySelector('.tp-msg') as HTMLElement;
      roll.onclick = () => {
        if (finished) return;
        sfx.whoosh();
        if (stage === 0) { pulls++; roll.style.setProperty('--len', `${pulls * 9}px`); if (pulls >= 7) { stage = 1; roll.classList.add('empty'); msg.textContent = 'Lõi rỗng rồi. Bấm để lắp cuộn mới.'; } }
        else { roll.classList.remove('empty'); roll.classList.add('new'); done(); }
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
        if (st.sides !== want.sides || st.copies !== want.copies || st.color !== want.color) { sfx.fail(); toastIn(body, 'Sai cài đặt, in lại tốn giấy lắm!'); return; }
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
        else { sfx.fail(); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); toastIn(body, 'Không phải tờ này, đọc kỹ lại.'); }
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
              sfx.fail(); grid.classList.remove('shake'); void grid.offsetWidth; grid.classList.add('shake');
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
      const colors = [['#e2412f', 'Đỏ'], ['#f2b705', 'Vàng'], ['#2e9cf0', 'Xanh'], ['#ff5fa2', 'Hồng']];
      const right = [...colors.keys()].sort(() => Math.random() - 0.5);
      body.innerHTML = `<div class="wires"><svg class="wire-svg"></svg><div class="wcol l"></div><div class="wcol r"></div></div>`;
      const L = body.querySelector('.wcol.l') as HTMLElement, R = body.querySelector('.wcol.r') as HTMLElement;
      const svg = body.querySelector('svg') as SVGSVGElement;
      const box = body.querySelector('.wires') as HTMLElement;
      let sel: number | null = null; let connected = 0;
      const lefts: HTMLElement[] = [], rights: HTMLElement[] = [];
      colors.forEach(([c, n], i) => {
        const b = document.createElement('button'); b.className = 'port'; b.style.setProperty('--c', c); b.setAttribute('aria-label', 'Dây ' + n);
        b.onclick = () => { if (b.classList.contains('ok')) return; sel = i; lefts.forEach(x => x.classList.remove('sel')); b.classList.add('sel'); sfx.click(); };
        L.appendChild(b); lefts.push(b);
      });
      right.forEach((ci) => {
        const b = document.createElement('button'); b.className = 'port'; b.style.setProperty('--c', colors[ci][0]); b.setAttribute('aria-label', 'Cổng ' + colors[ci][1]);
        b.onclick = () => {
          if (sel === null || b.classList.contains('ok')) return;
          if (sel === ci) {
            const a = lefts[sel].getBoundingClientRect(), z = b.getBoundingClientRect(), o = box.getBoundingClientRect();
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const x1 = a.right - o.left, y1 = a.top + a.height / 2 - o.top, x2 = z.left - o.left, y2 = z.top + z.height / 2 - o.top;
            line.setAttribute('d', `M${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`);
            line.setAttribute('stroke', colors[ci][0]);
            svg.appendChild(line);
            lefts[sel].classList.add('ok'); lefts[sel].classList.remove('sel'); b.classList.add('ok');
            sel = null; connected++; sfx.click();
            if (connected >= colors.length) done();
          } else { sfx.fail(); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
        };
        R.appendChild(b); rights.push(b);
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
          else { sfx.fail(); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); toastIn(body, 'Đồ của sếp đấy! Để nguyên.'); }
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
        else { sfx.fail(); toastIn(body, have[0] < want[0] ? 'Sếp chê: nhạt như nước ốc!' : 'Sếp chê: sai công thức rồi em ơi.'); have.fill(0); render(); }
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
        else { ok = 0; sfx.fail(); toastIn(body, cur.valid ? 'Hồ sơ hợp lệ mà! Làm lại.' : 'Duyệt bừa là Kế toán tìm bạn đấy. Làm lại.'); }
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
