// Các mini-game "chạy KPI" và sửa sự cố, dựng bằng HTML
import { sfx } from '../audio';

export type MiniKind = 'excel' | 'wires' | 'fridge' | 'coffee' | 'copier' | 'stamp' | 'router' | 'power';

const TITLES: Record<MiniKind, { title: string; hint: string }> = {
  excel: { title: 'Nhập liệu Excel', hint: 'Bấm đúng ô đang sáng. Sai một ô là phải làm lại từ đầu, như ngoài đời.' },
  wires: { title: 'Nối lại dây cáp server', hint: 'Chọn một đầu dây bên trái rồi nối sang đúng cổng cùng màu bên phải.' },
  fridge: { title: 'Dọn đồ mốc trong tủ lạnh chung', hint: 'Vứt hết đồ đã mốc. Đồ còn tươi là của sếp, đừng đụng vào.' },
  coffee: { title: 'Pha cà phê cho sếp', hint: 'Pha đúng công thức trên tờ giấy note rồi mang lên.' },
  copier: { title: 'Gỡ kẹt máy photocopy', hint: 'Đập liên tục vào máy cho đến khi giấy chạy lại. Ngừng tay là kẹt lại.' },
  stamp: { title: 'Ký duyệt hồ sơ', hint: 'Duyệt hồ sơ có chữ ký và số tiền trong hạn mức. Còn lại trả về.' },
  router: { title: 'Khởi động lại Router', hint: 'Giữ nút nguồn 3 giây. Thả tay ra là phải giữ lại từ đầu.' },
  power: { title: 'Bật lại cầu dao', hint: 'Gạt tất cả cầu dao lên vị trí BẬT.' },
};

let current: { el: HTMLElement; cleanup: () => void } | null = null;

export function closeMini() {
  if (!current) return;
  current.cleanup();
  current.el.remove();
  current = null;
}

export function miniOpen() { return current !== null; }

export function openMini(root: HTMLElement, kind: MiniKind, onDone: () => void, opts: { fake?: boolean } = {}) {
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
  current = { el: wrap, cleanup: () => { timers.forEach(clearTimeout); cleanups.forEach(f => f()); } };
  (wrap.querySelector('.x') as HTMLElement).onclick = () => closeMini();
  wrap.addEventListener('pointerdown', e => { if (e.target === wrap) closeMini(); });

  const builders: Record<MiniKind, () => void> = {
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
