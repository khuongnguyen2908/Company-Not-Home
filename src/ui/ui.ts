import { session } from '../session';
import { World, BOSS_TIME, type Agent, type GameEvent, type SabotageKind } from '../game/sim';
import { DEPTS, PLAYER_NAMES, dept, type DeptId } from '../game/data';
import { ROOMS, TILE, MAP_W, MAP_H, DESKS, HIDE_SPOTS, CAMERAS, station, taskDef, roomAt, roomName, GRID, type MiniKind } from '../game/map';
import { slotStation } from '../game/sim';
import { avatarURL, avatarImage, chairURL } from '../render/chars';
import { sfx } from '../audio';
import { openMini, closeMini, miniOpen } from './minigames';

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// ---------- Lưu thành tích (localStorage) ----------
interface Stats { played: number; wins: number; crewWins: number; impWins: number; streak: number; bestStreak: number; fastestWin: number | null }
/** Pha màu phòng ban với trắng để làm nền avatar nhỏ (nhân vật vẫn nổi rõ) */
function tint(hex: string, amount = 0.38): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c * amount + 255 * (1 - amount));
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}
const deptBg = (d: DeptId) => tint(dept(d).color);
const EMOJIS = ['👍', '👎', '❓', '😂', '😡', '🤔'];

const STATS_KEY = 'noi-gian-van-phong:stats';
const CHAT_COOLDOWN = 2000;
const PREFS_KEY = 'noi-gian-van-phong:prefs';
function loadStats(): Stats {
  const base: Stats = { played: 0, wins: 0, crewWins: 0, impWins: 0, streak: 0, bestStreak: 0, fastestWin: null };
  try { const raw = localStorage.getItem(STATS_KEY); if (raw) return { ...base, ...JSON.parse(raw) }; } catch { /* bỏ qua */ }
  return base;
}
function saveStats(s: Stats) { try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch { /* bỏ qua */ } }
interface Prefs { name: string; dept: DeptId; bots: number; imps: number; muted: boolean; anonVotes: boolean }
function loadPrefs(): Prefs {
  const base: Prefs = { name: '', dept: 'gd', bots: 7, imps: 1, muted: false, anonVotes: false };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = { ...base, ...JSON.parse(raw) };
      if (!DEPTS.some(d => d.id === p.dept)) p.dept = base.dept; // phòng ban cũ không còn
      return p;
    }
  } catch { /* bỏ qua */ }
  return base;
}
function savePrefs(p: Prefs) { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* bỏ qua */ } }

const SAB_INFO: Record<SabotageKind, { name: string; icon: string; desc: string }> = {
  wifi: { name: 'Rớt mạng', icon: '📶', desc: 'Tắt camera an ninh trên sơ đồ, không gửi được email khẩn' },
  power: { name: 'Cúp điện', icon: '💡', desc: 'Nhân viên gần như mù, chỉ còn ánh sáng màn hình' },
  boss: { name: 'Sếp đi tuần', icon: '👞', desc: `Ai không về bàn gõ phím trong ${BOSS_TIME} giây là cả team thua` },
};

export class UI {
  root: HTMLElement;
  prefs = loadPrefs();
  stats = loadStats();
  keys = new Set<string>();
  joy = { x: 0, y: 0, active: false };
  private hudEl!: HTMLElement;
  private lastHud = '';
  private meetEl: HTMLElement | null = null;
  private meetChatCount = 0;
  private selectedVote: number | 'skip' | null = null;
  private resultShown = false;
  private voteOpened = false;
  private cutsceneActive = false;
  private reactCount = 0;
  private fakeT = 0;
  private toastTimer = 0;
  private mapOpen = false;
  private sabMenuOpen = false;

  constructor(root: HTMLElement) {
    this.root = root;
    sfx.setMuted(this.prefs.muted);
    this.bindInput();
    session.onEvents = (e) => this.onEvents(e);
    session.onFrame = (dt) => this.frame(dt);
    this.showLobby();
  }

  // ================= SẢNH =================
  showLobby() {
    session.world = null;
    this.root.innerHTML = '';
    const p = this.prefs, s = this.stats;
    const el = document.createElement('div');
    el.className = 'lobby';
    el.innerHTML = `
      <div class="portal">
        <header class="portal-head">
          <div class="logo-badge"><img src="${avatarURL('hr')}" alt=""></div>
          <div>
            <h1>Nội Gián Văn Phòng</h1>
            <p class="tagline">Cổng chấm công nội bộ. Một trong số đồng nghiệp đang âm thầm phá dự án.</p>
          </div>
        </header>
        <div class="portal-grid">
          <section class="card form">
            <div class="field"><label for="f-name">Họ tên hiển thị trên thẻ</label>
              <div class="name-row">
                <input id="f-name" maxlength="12" autocomplete="off" placeholder="Nhập tên hoặc bấm xí ngầu" value="${esc(p.name)}">
                <button class="dice" id="f-dice" type="button" aria-label="Chọn tên ngẫu nhiên" title="Chọn tên ngẫu nhiên">🎲</button>
              </div>
              <p class="name-err" id="name-err" hidden>Cần có tên trước khi vào ca.</p></div>
            <div class="field"><span>Phòng ban</span>
              <div class="dept-grid" role="radiogroup" aria-label="Chọn phòng ban">
                ${DEPTS.map(d => `<button class="dept${d.id === p.dept ? ' on' : ''}" data-d="${d.id}" role="radio" aria-checked="${d.id === p.dept}" style="--dc:${d.color}">
                  <img src="${avatarURL(d.id)}" alt=""><b>${d.name}</b></button>`).join('')}
              </div>
              <p class="dept-desc" id="dept-desc">${dept(p.dept).desc}</p>
            </div>
          </section>
          <section class="card settings">
            <p class="role-note">Vai trò (Nhân viên hay Nội gián) do hệ thống bốc ngẫu nhiên khi vào ca. Không ai được chọn, kể cả bạn.</p>
            <div class="field"><span>Số đồng nghiệp (bot): <b id="bots-v">${p.bots}</b></span>
              <input type="range" id="f-bots" min="4" max="9" value="${p.bots}"></div>
            <div class="field"><span>Số Nội gián</span>
              <div class="seg" id="f-imps"><button data-v="1">1</button><button data-v="2">2</button></div></div>
            <div class="field"><span>Hiển thị phiếu bầu</span>
              <div class="seg" id="f-anon"><button data-v="0">Công khai ai vote ai</button><button data-v="1">Ẩn danh</button></div></div>
            <button class="primary big" id="start">Chấm công vào ca</button>
            <div class="stats">
              <div><b>${s.played}</b><span>ván đã chơi</span></div>
              <div><b>${s.crewWins}</b><span>thắng làm Nhân viên</span></div>
              <div><b>${s.impWins}</b><span>thắng làm Nội gián</span></div>
              <div><b>${s.bestStreak}</b><span>chuỗi thắng dài nhất</span></div>
              <div><b>${s.fastestWin !== null ? fmtTime(s.fastestWin) : '–'}</b><span>thắng nhanh nhất</span></div>
            </div>
          </section>
          <section class="card howto">
            <h3>Cách chơi</h3>
            <p><b>Nhân viên</b> chạy KPI: tới các dấu <span class="bang">!</span> để làm việc. Thấy ghế trống của đồng nghiệp thì báo cáo, rồi họp và vote sa thải kẻ đáng ngờ.</p>
            <p><b>Nội gián</b> gài bẫy cho đồng nghiệp bị đuổi việc, trốn dưới gầm bàn hay trong thang máy VIP, và gây sự cố: rớt mạng, cúp điện, sếp đi tuần.</p>
            <p class="keys">Vai trò được bốc ngẫu nhiên mỗi ván. Di chuyển: WASD hoặc phím mũi tên. E làm việc, R báo cáo, Q gài bẫy, F phá hoại, Space trốn, Tab mở sơ đồ. Trên điện thoại có cần điều khiển ảo.</p>
          </section>
        </div>
      </div>`;
    this.root.appendChild(el);
    const seg = (id: string, val: string, cb: (v: string) => void) => {
      const box = $('#' + id, el);
      const set = (v: string) => box.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
      set(val);
      box.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.onclick = () => { set(b.dataset.v!); cb(b.dataset.v!); });
    };
    seg('f-imps', String(p.imps), v => p.imps = Number(v));
    seg('f-anon', p.anonVotes ? '1' : '0', v => p.anonVotes = v === '1');
    el.querySelectorAll<HTMLButtonElement>('.dept').forEach(b => b.onclick = () => {
      p.dept = b.dataset.d as DeptId;
      el.querySelectorAll('.dept').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
      $('#dept-desc', el).textContent = dept(p.dept).desc;
    });
    const range = $('#f-bots', el) as HTMLInputElement;
    range.oninput = () => { p.bots = Number(range.value); $('#bots-v', el).textContent = range.value; };
    const nameIn = $('#f-name', el) as HTMLInputElement;
    const startBtn = $('#start', el) as HTMLButtonElement;
    const syncName = () => {
      const ok = nameIn.value.trim().length > 0;
      startBtn.disabled = !ok;
      if (ok) $('#name-err', el).hidden = true;
    };
    nameIn.oninput = syncName;
    syncName();
    $('#f-dice', el).onclick = () => {
      sfx.unlock(); sfx.click();
      const pool = PLAYER_NAMES.filter(n => n !== nameIn.value.trim());
      nameIn.value = pool[Math.floor(Math.random() * pool.length)];
      const d = $('#f-dice', el); d.classList.remove('roll'); void d.offsetWidth; d.classList.add('roll');
      syncName();
    };
    nameIn.onkeydown = (e) => { if (e.key === 'Enter') startBtn.click(); };
    startBtn.onclick = () => {
      const name = nameIn.value.trim().slice(0, 12);
      if (!name) { $('#name-err', el).hidden = false; nameIn.focus(); return; }
      sfx.unlock();
      p.name = name;
      savePrefs(p);
      this.startGame();
    };
  }

  startGame() {
    const p = this.prefs;
    this.root.innerHTML = '';
    closeMini();
    const w = new World({ playerName: p.name, playerDept: p.dept, playerRole: 'random', bots: p.bots, impostors: p.imps });
    session.world = w;
    session.newGameId++;
    session.paused = true;
    this.buildHud();
    sfx.startAmbient();
    sfx.ambientLevel(0.18);
    this.showRoleReveal();
  }

  // ================= GIAO DIỆN TRONG GAME =================
  private buildHud() {
    const hud = document.createElement('div');
    hud.className = 'hud';
    hud.innerHTML = `
      <div class="tasks card-lite">
        <div class="kpi"><span>KPI phòng ban</span><div class="kpi-bar"><i></i></div></div>
        <ul class="task-list"></ul>
      </div>
      <div class="top-right">
        <button class="icon-btn" id="b-email" aria-label="Gửi email khẩn CC All">📧</button>
        <button class="icon-btn" id="b-mute" aria-label="Bật/tắt âm thanh">${this.prefs.muted ? '🔇' : '🔊'}</button>
        <button class="icon-btn" id="b-quit" aria-label="Về sảnh">🚪</button>
      </div>
      <button class="map-btn" id="b-map" aria-label="Mở sơ đồ (phím Tab)"><span class="ic">🗺️</span><span>Sơ đồ</span><kbd>Tab</kbd></button>
      <div class="sab-banner" hidden></div>
      <div class="room-name"></div>
      <div class="toast" hidden></div>
      <div class="actions">
        <button class="act" id="a-sab" hidden><span class="ic">⚡</span><span class="lb">Phá hoại</span><kbd>F</kbd></button>
        <button class="act" id="a-hide" hidden><span class="ic">🫥</span><span class="lb">Trốn</span><kbd>Space</kbd></button>
        <button class="act danger" id="a-kill" hidden><span class="ic">📂</span><span class="lb">Gài bẫy</span><kbd>Q</kbd><em class="cd"></em></button>
        <button class="act alert" id="a-report" hidden><span class="ic">📢</span><span class="lb">Báo cáo</span><kbd>R</kbd></button>
        <button class="act" id="a-use"><span class="ic">💼</span><span class="lb">Làm việc</span><kbd>E</kbd></button>
      </div>
      <div class="hide-ctrl" hidden>
        <div class="hide-name"></div>
        <button class="act" id="h-next">Chuồn sang</button>
        <button class="act" id="h-exit">Ra ngoài</button>
      </div>
      <div class="joy" aria-hidden="true"><div class="joy-knob"></div></div>
      <div class="sab-menu" hidden></div>
      <div class="cam-wrap" hidden><div class="cams card-lite"><div class="mm-head"><b>Camera an ninh</b><button class="x" id="cam-close" aria-label="Đóng">✕</button></div><div class="cam-grid">${CAMERAS.map((c, i) => `<figure><canvas data-i="${i}" width="320" height="200"></canvas><figcaption>${c.name}</figcaption></figure>`).join('')}</div><div class="roster"></div></div></div>
      <div class="minimap-wrap" hidden><div class="minimap card-lite"><div class="mm-head"><b>Sơ đồ tầng 7</b><button class="x" id="mm-close" aria-label="Đóng">✕</button></div><canvas width="460" height="320"></canvas><p class="mm-note"></p></div></div>
      <div class="fake-work" hidden><div>Đang giả vờ làm việc…</div><div class="bar"><i></i></div></div>`;
    this.root.appendChild(hud);
    this.hudEl = hud;
    this.lastHud = '';
    $('#b-map', hud).onclick = () => this.toggleMap();
    $('#mm-close', hud).onclick = () => this.toggleMap(false);
    $('#cam-close', hud).onclick = () => this.toggleCams(false);
    $('#b-email', hud).onclick = () => this.email();
    $('#b-mute', hud).onclick = () => {
      this.prefs.muted = !this.prefs.muted; savePrefs(this.prefs); sfx.setMuted(this.prefs.muted);
      $('#b-mute', hud).textContent = this.prefs.muted ? '🔇' : '🔊';
    };
    $('#b-quit', hud).onclick = () => { if (confirm('Rời ca làm việc và về sảnh?')) { sfx.stopBossSteps(); this.showLobby(); } };
    $('#a-use', hud).onclick = () => this.doUse();
    $('#a-report', hud).onclick = () => this.doReport();
    $('#a-kill', hud).onclick = () => this.doKill();
    $('#a-sab', hud).onclick = () => this.toggleSabMenu();
    $('#a-hide', hud).onclick = () => this.doHide();
    $('#h-next', hud).onclick = () => { const w = session.world!; w.hideMove(w.player); sfx.whoosh(); };
    $('#h-exit', hud).onclick = () => { const w = session.world!; w.hide(w.player, null); sfx.whoosh(); };
    this.bindJoystick($('.joy', hud));
  }

  private showRoleReveal() {
    const w = session.world!, p = w.player;
    const imp = p.role === 'impostor';
    const mates = w.agents.filter(a => a.role === 'impostor' && a !== p);
    const el = document.createElement('div');
    el.className = 'overlay reveal ' + (imp ? 'imp' : 'crew');
    el.innerHTML = `
      <div class="reveal-card">
        <p class="reveal-kicker">Quyết định phân công</p>
        <h1>${imp ? 'Bạn là Nội gián' : 'Bạn là Nhân viên'}</h1>
        <p>${imp
          ? `Gài bẫy cho đồng nghiệp bị đuổi việc mà không ai thấy. Thắng khi số Nội gián bằng số Nhân viên.${mates.length ? ' Đồng bọn của bạn ở dưới, đừng gài bẫy nhau.' : ' Ván này bạn hành động một mình.'}`
          : `Chạy đủ KPI hoặc tìm ra ${w.aliveImp().length} Nội gián trong số ${w.agents.length - 1} đồng nghiệp.`}</p>
        <div class="reveal-team">${(imp ? w.agents.filter(a => a.role === 'impostor') : w.agents).map(a => `<figure class="${imp ? 'mate' : ''}"><img src="${avatarURL(a.dept)}" alt=""><figcaption style="--dc:${dept(a.dept).color}">${esc(a.name)}${a.isPlayer ? ' (bạn)' : ''}</figcaption></figure>`).join('')}</div>
        <button class="primary big" id="go">Bắt đầu ca làm việc</button>
      </div>`;
    this.root.appendChild(el);
    sfx.ting();
    $('#go', el).onclick = () => { el.remove(); session.paused = false; };
  }

  private toast(msg: string, ms = 2200) {
    const t = $('.toast', this.hudEl);
    t.textContent = msg; t.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => { t.hidden = true; }, ms);
  }

  // ---------- Hành động ----------
  private doUse() {
    const w = session.world; if (!w || w.phase !== 'play' || session.paused) return;
    const p = w.player;
    const ctx = w.context(p);
    if (!ctx.use) return;
    sfx.unlock();
    if (ctx.use.kind === 'bell') { const err = w.callEmergency(p, 'bell'); if (err) this.toast(err); return; }
    if (ctx.use.kind === 'desk') {
      openMiniDesk(this.root, () => w.bossCheckIn(p));
      return;
    }
    if (ctx.use.kind === 'camera') { this.toggleCams(true); return; }
    if (ctx.use.kind === 'fix') {
      openMini(this.root, ctx.use.station!.id as MiniKind, () => { if (w.sabotage && w.sabotage.kind !== 'boss') w.fixSabotage(p); });
      return;
    }
    if (ctx.use.kind === 'task') {
      const st = ctx.use.station!;
      if (p.role === 'impostor') { this.fakeT = 3; return; }
      openMini(this.root, st.id as MiniKind, () => w.completeTask(p, st.id), {
        // Chấm công vân tay: ai đứng gần cũng thấy đèn quét
        onHold: st.id === 'fingerprint' ? (on) => { p.scanning = on && p.alive; } : undefined,
      });
    }
  }
  private doReport() {
    const w = session.world; if (!w || session.paused) return;
    const c = w.context(w.player);
    if (c.report) w.report(w.player, c.report);
  }
  private doKill() {
    const w = session.world; if (!w || session.paused) return;
    const c = w.context(w.player);
    if (c.kill) w.tryKill(w.player, c.kill);
  }
  private doHide() {
    const w = session.world; if (!w || session.paused) return;
    const p = w.player;
    if (p.hidden !== null) { w.hide(p, null); sfx.whoosh(); return; }
    const c = w.context(p);
    if (c.hide !== null) { w.hide(p, c.hide); sfx.whoosh(); }
  }
  private email() {
    const w = session.world; if (!w || session.paused) return;
    if (w.phase !== 'play') return;
    if (!confirm('Gửi email khẩn CC All để triệu tập họp? Mỗi người chỉ được gửi một lần mỗi ván.')) return;
    const err = w.callEmergency(w.player, 'email');
    if (err) this.toast(err);
  }
  private toggleSabMenu(force?: boolean) {
    const w = session.world!;
    this.sabMenuOpen = force ?? !this.sabMenuOpen;
    const m = $('.sab-menu', this.hudEl);
    m.hidden = !this.sabMenuOpen;
    if (!this.sabMenuOpen) return;
    m.innerHTML = `<div class="card-lite"><h3>Gây sự cố</h3>${(Object.keys(SAB_INFO) as SabotageKind[]).map(k => {
      const dis = k === 'boss' && w.bossUsed;
      return `<button class="sab-opt" data-k="${k}" ${dis ? 'disabled' : ''}><span class="ic">${SAB_INFO[k].icon}</span><span><b>${SAB_INFO[k].name}</b><small>${dis ? 'Đã dùng ván này' : SAB_INFO[k].desc}</small></span></button>`;
    }).join('')}</div>`;
    m.querySelectorAll<HTMLButtonElement>('.sab-opt').forEach(b => b.onclick = () => {
      const err = w.triggerSabotage(w.player, b.dataset.k as SabotageKind);
      if (err) this.toast(err);
      this.toggleSabMenu(false);
    });
  }
  private camsOpen = false;
  private toggleCams(force?: boolean) {
    this.camsOpen = force ?? !this.camsOpen;
    $('.cam-wrap', this.hudEl).hidden = !this.camsOpen;
  }

  private drawCams() {
    const w = session.world!;
    const wifiDown = w.sabotage?.kind === 'wifi';
    const mapImg = session.mapImage;
    this.hudEl.querySelectorAll<HTMLCanvasElement>('.cam-grid canvas').forEach(cv => {
      const c = CAMERAS[Number(cv.dataset.i)];
      const ctx = cv.getContext('2d')!;
      const sx = c.x * TILE, sy = c.y * TILE, sw = c.w * TILE, sh = c.h * TILE;
      const k = Math.min(cv.width / sw, cv.height / sh);
      const ox = (cv.width - sw * k) / 2, oy = (cv.height - sh * k) / 2;
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, cv.width, cv.height);
      if (wifiDown) {
        for (let i = 0; i < 500; i++) { ctx.fillStyle = Math.random() < 0.5 ? '#ddd' : '#333'; ctx.fillRect(Math.random() * cv.width, Math.random() * cv.height, 3, 3); }
        ctx.fillStyle = '#fff'; ctx.font = '700 16px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Mất tín hiệu', cv.width / 2, cv.height / 2);
        return;
      }
      if (mapImg) ctx.drawImage(mapImg, sx, sy, sw, sh, ox, oy, sw * k, sh * k);
      const sorted = [...w.agents].filter(a => a.alive && a.hidden === null && a.x >= sx && a.x < sx + sw && a.y >= sy && a.y < sy + sh).sort((p, q) => p.y - q.y);
      for (const a of sorted) {
        const img = avatarImage(a.dept);
        const h = 88 * 0.78 * k * 1.15, wd = 72 * 0.78 * k * 1.15;
        ctx.drawImage(img, ox + (a.x - sx) * k - wd / 2, oy + (a.y - sy) * k - h * 0.95, wd, h);
      }
      for (const b of w.bodies) {
        if (b.x < sx || b.x >= sx + sw || b.y < sy || b.y >= sy + sh) continue;
        ctx.fillStyle = '#e8443a'; ctx.beginPath(); ctx.arc(ox + (b.x - sx) * k, oy + (b.y - sy) * k, 5, 0, Math.PI * 2); ctx.fill();
      }
      if (Math.floor(performance.now() / 600) % 2) { ctx.fillStyle = '#e8443a'; ctx.beginPath(); ctx.arc(14, 14, 5, 0, Math.PI * 2); ctx.fill(); }
    });
    // Sổ ra vào: đếm người theo phòng, không ghi tên
    const roster = $('.roster', this.hudEl);
    if (wifiDown) { roster.textContent = 'Sổ ra vào: mất kết nối'; return; }
    const counts = new Map<string, number>();
    for (const a of w.agents) {
      if (!a.alive || a.hidden !== null) continue;
      const r = roomName(roomAt(a.x, a.y));
      counts.set(r, (counts.get(r) ?? 0) + 1);
    }
    roster.innerHTML = '<b>Sổ ra vào</b> ' + ROOMS.filter(r => r.label).map(r => `<span>${r.name}: ${counts.get(r.name) ?? 0}</span>`).join('');
  }

  private toggleMap(force?: boolean) {
    this.mapOpen = force ?? !this.mapOpen;
    $('.minimap-wrap', this.hudEl).hidden = !this.mapOpen;
  }

  // ---------- Sự kiện từ mô phỏng ----------
  private onEvents(evs: GameEvent[]) {
    const w = session.world!;
    const p = w.player;
    for (const e of evs) {
      switch (e.type) {
        case 'kill': {
          const near = Math.hypot(e.x - p.x, e.y - p.y) < 6 * TILE;
          if (e.victim === p.id) { sfx.tear(); closeMini(); this.showFired(w.agents[e.killer]); }
          else if (near || e.killer === p.id) sfx.tear();
          break;
        }
        case 'meeting':
          closeMini(); this.toggleSabMenu(false); this.toggleMap(false); this.toggleCams(false);
          sfx.stopBossSteps(); sfx.tingBurst();
          this.showMeetingSplash();
          break;
        case 'sabotage':
          sfx.alarm();
          if (e.kind === 'power') sfx.powerDown();
          if (e.kind === 'boss') { sfx.startBossSteps(); sfx.ambientLevel(0.05); }
          if (e.kind === 'wifi') sfx.modem();
          break;
        case 'sabotage_end':
          if (e.kind === 'boss') { sfx.stopBossSteps(); sfx.ambientLevel(0.18); if (w.phase === 'play') this.toast('Sếp đi rồi. Thở phào.'); }
          if (e.kind === 'power' && w.phase === 'play') { sfx.powerUp(); this.toast('Có điện lại rồi!'); }
          if (e.kind === 'wifi' && w.phase === 'play') { sfx.ting(); this.toast('WiFi đã kết nối lại.'); }
          break;
        case 'task':
          if (e.agent === p.id) this.toast('Xong một đầu việc. KPI +1');
          break;
        case 'boss_ok':
          if (e.agent === p.id) this.toast('Sếp gật gù đi qua. An toàn!');
          break;
        case 'gameover':
          sfx.stopBossSteps();
          // Nếu đang chiếu cảnh bị gài bẫy thì chờ cảnh đó xong mới hiện kết quả
          if (!this.meetEl && !this.cutsceneActive) setTimeout(() => this.showGameOver(), 1000);
          break;
      }
    }
  }

  private showFired(killer: Agent) {
    const p = session.world!.player;
    // Đoạn cắt cảnh ngắn: hồ sơ lỗi bay vào mặt, giấy tung tóe, đóng dấu, tối sầm
    const cut = document.createElement('div');
    cut.className = 'overlay killcut';
    cut.innerHTML = `<div class="kc-stage">
        <img class="kc-killer" src="${avatarURL(killer.dept)}" alt="">
        <div class="kc-folder"></div>
        <img class="kc-victim" src="${avatarURL(p.dept)}" alt="">
        ${Array.from({ length: 8 }, (_, i) => `<i class="kc-paper" style="--a:${i * 45}deg;--d:${80 + (i % 3) * 30}px"></i>`).join('')}
        <div class="kc-stamp">Đuổi việc</div>
      </div>`;
    this.root.appendChild(cut);
    setTimeout(() => sfx.stamp(), 900);
    this.cutsceneActive = true;
    setTimeout(() => {
      cut.remove();
      this.cutsceneActive = false;
      if (session.world?.phase === 'ended') this.showGameOver();
      else this.showFiredCard(killer);
    }, 2100);
  }

  private showFiredCard(killer: Agent) {
    const el = document.createElement('div');
    el.className = 'overlay fired';
    el.innerHTML = `<div class="fired-card"><div class="box">📦</div><h1>Bạn đã bị đuổi việc</h1>
      <p><b>${esc(killer.name)}</b> (${dept(killer.dept).name}) đã ném hồ sơ lỗi vào mặt bạn.</p>
      <p>Giờ bạn là <b>Hồn ma OT</b>: đi xuyên tường, ${session.world!.player.role === 'crew' ? 'vẫn làm task không lương để cứu KPI cho team.' : 'vẫn có thể phá hoại.'} Người sống không thấy và không nghe bạn.</p>
      <button class="primary" id="ok">Ôm thùng carton đi tiếp</button></div>`;
    this.root.appendChild(el);
    $('#ok', el).onclick = () => el.remove();
    setTimeout(() => el.remove(), 9000);
  }

  // ================= PHÒNG HỌP =================
  /** Màn chuyển cảnh trước khi vào họp (đồng hồ cuộc họp tạm dừng) */
  private showMeetingSplash() {
    const w = session.world!;
    const m = w.meeting!;
    const rep = w.agents[m.reporter];
    session.paused = true;
    const el = document.createElement('div');
    el.className = 'overlay splash ' + m.via;
    if (m.via === 'body') {
      el.innerHTML = `<div class="sp-stage">
          <h1 class="sp-title">Phát hiện ghế trống!</h1>
          <div class="sp-scene"><img class="sp-rep point" src="${avatarURL(rep.dept)}" alt=""><img class="sp-chair" src="${chairURL()}" alt=""></div>
          <p class="sp-sub">${esc(rep.name)} báo cáo ghế của ${esc(w.agents[m.victim!].name)} ở ${roomName(m.room)}</p>
        </div>`;
      setTimeout(() => sfx.stamp(), 500);
    } else {
      el.innerHTML = `<div class="sp-stage">
          <h1 class="sp-title">${m.via === 'bell' ? 'Chuông họp khẩn!' : 'Email khẩn!'}</h1>
          <div class="sp-scene"><img class="sp-rep" src="${avatarURL(rep.dept)}" alt="">
            <div class="sp-mail"><div class="sp-mail-head"><b>KHẨN</b> · CC All</div><p><b>Từ:</b> ${esc(rep.name)} (${dept(rep.dept).name})</p><p><b>Tiêu đề:</b> Họp gấp ngay bây giờ!!!</p></div></div>
          <p class="sp-sub">${esc(rep.name)} ${m.via === 'bell' ? 'bấm chuông triệu tập cả công ty' : 'gửi email khẩn tới toàn công ty'}</p>
        </div>`;
    }
    this.root.appendChild(el);
    setTimeout(() => { el.remove(); session.paused = false; this.showMeeting(); }, 2200);
  }

  private showMeeting() {
    const w = session.world!;
    const m = w.meeting!;
    this.selectedVote = null;
    this.resultShown = false;
    this.voteOpened = false;
    this.meetChatCount = 0;
    const rep = w.agents[m.reporter];
    const reason = m.victim !== null
      ? `${esc(rep.name)} phát hiện ghế của ${esc(w.agents[m.victim].name)} trống ở ${roomName(m.room)}`
      : m.via === 'bell' ? `${esc(rep.name)} bấm chuông họp khẩn` : `${esc(rep.name)} gửi email khẩn CC All`;
    const el = document.createElement('div');
    el.className = 'overlay meet';
    el.innerHTML = `
      <div class="meet-win">
        <div class="meet-top">
          <div class="meet-title"><b>Họp khẩn</b><span>${reason}</span></div>
          <div class="meet-timer"><span class="rec">●</span> <span id="m-phase">Thảo luận</span> <span id="m-time">--</span></div>
        </div>
        <div class="meet-main">
          <div class="tiles"></div>
          <aside class="chat">
            <div class="chat-head">Trò chuyện trong cuộc họp</div>
            <div class="chat-log" aria-live="polite"></div>
            <div class="emoji-bar" role="group" aria-label="Thả cảm xúc">${EMOJIS.map(e => `<button type="button" class="emo" data-e="${e}" aria-label="Thả ${e}">${e}</button>`).join('')}</div>
            <form class="chat-form"><input id="m-input" maxlength="120" autocomplete="off" placeholder="${w.player.alive ? 'Nhắc tên ai đó để buộc tội hoặc bênh vực…' : 'Hồn ma nói không ai nghe…'}"><button class="primary" type="submit">Gửi</button></form>
          </aside>
        </div>
        <div class="meet-bar">
          <span class="fake-ctl" title="Mic bị IT khóa">🎙️ Tắt tiếng</span>
          <span class="fake-ctl" title="Camera bị IT khóa">📷 Tắt camera</span>
          <div class="vote-status" id="m-status"></div>
          <button class="ghost-btn" id="m-ready">Sẵn sàng bỏ phiếu</button>
          <button class="ghost-btn" id="m-skip" disabled>Bỏ qua, chưa đủ bằng chứng</button>
          <button class="primary danger" id="m-vote" disabled>Vote sa thải</button>
        </div>
      </div>`;
    this.root.appendChild(el);
    this.meetEl = el;
    const tiles = $('.tiles', el);
    for (const a of w.agents) {
      const t = document.createElement('button');
      t.className = 'tile' + (a.alive ? '' : ' dead') + (a.id === m.reporter ? ' reporter' : '');
      t.dataset.id = String(a.id);
      t.disabled = !a.alive || a.isPlayer || !w.player.alive;
      const mate = w.player.role === 'impostor' && a.role === 'impostor';
      t.innerHTML = `<div class="cam" style="--dc:${dept(a.dept).color}"><img src="${avatarURL(a.dept)}" alt=""></div>
        <div class="tile-info"><b class="${mate ? 'mate' : ''}">${esc(a.name)}${a.isPlayer ? ' (bạn)' : ''}</b><small>${a.alive ? dept(a.dept).name : 'Đã nghỉ việc'}</small></div>
        ${a.id === m.reporter ? '<span class="badge">📢</span>' : ''}<span class="voted" hidden>Đã vote</span><div class="voters"></div>`;
      t.onclick = () => this.pickVote(a.id);
      tiles.appendChild(t);
    }
    $('#m-skip', el).onclick = () => this.castVote('skip');
    $('#m-ready', el).onclick = () => { w.skipDiscussion(); sfx.click(); };
    if (!w.player.alive) ($('#m-ready', el) as HTMLButtonElement).disabled = true;
    $('#m-vote', el).onclick = () => { if (this.selectedVote !== null) this.castVote(this.selectedVote); };
    if (!w.player.alive) { ($('#m-skip', el) as HTMLButtonElement).disabled = true; }
    let chatReadyAt = 0;
    this.reactCount = 0;
    const sendBtn = $('.chat-form .primary', el) as HTMLButtonElement;
    const startCooldown = () => {
      // Chờ 2 giây giữa hai lần chat hoặc thả emoji
      chatReadyAt = performance.now() + CHAT_COOLDOWN;
      sendBtn.disabled = true;
      el.querySelectorAll<HTMLButtonElement>('.emo').forEach(b => b.disabled = true);
      let left = CHAT_COOLDOWN / 1000;
      sendBtn.textContent = `${left}s`;
      const id = window.setInterval(() => {
        left--;
        if (left <= 0 || !this.meetEl) {
          clearInterval(id); sendBtn.disabled = false; sendBtn.textContent = 'Gửi';
          el.querySelectorAll<HTMLButtonElement>('.emo').forEach(b => b.disabled = false);
        } else sendBtn.textContent = `${left}s`;
      }, 1000);
    };
    el.querySelectorAll<HTMLButtonElement>('.emo').forEach(b => b.onclick = () => {
      if (performance.now() < chatReadyAt || w.meeting?.result) return;
      w.react(w.player.id, b.dataset.e!);
      startCooldown();
    });
    ($('.chat-form', el) as HTMLFormElement).onsubmit = (e) => {
      e.preventDefault();
      const inp = $('#m-input', el) as HTMLInputElement;
      const v = inp.value.trim();
      if (!v || performance.now() < chatReadyAt) return;
      w.playerChat(v);
      inp.value = '';
      startCooldown();
    };
  }

  private pickVote(id: number) {
    const w = session.world!;
    if (!w.meeting || w.meeting.votes.has(w.player.id) || w.meeting.result) return;
    if (w.meeting.t < w.meeting.discussEnd) { this.flashStatus('Đang thảo luận, chưa mở bỏ phiếu.'); return; }
    this.selectedVote = id;
    this.meetEl!.querySelectorAll('.tile').forEach(t => t.classList.toggle('sel', (t as HTMLElement).dataset.id === String(id)));
    const btn = $('#m-vote', this.meetEl!) as HTMLButtonElement;
    btn.disabled = false;
    btn.textContent = `Vote sa thải ${w.agents[id].name}`;
  }

  private flashStatus(msg: string) {
    const st = $('#m-status', this.meetEl!);
    st.textContent = msg; st.classList.add('warn');
    setTimeout(() => st.classList.remove('warn'), 1200);
  }

  private castVote(v: number | 'skip') {
    const w = session.world!;
    if (!w.meeting || w.meeting.result || w.meeting.t < w.meeting.discussEnd) return;
    w.vote(w.player, v);
    sfx.click();
    ($('#m-vote', this.meetEl!) as HTMLButtonElement).disabled = true;
    ($('#m-skip', this.meetEl!) as HTMLButtonElement).disabled = true;
    this.meetEl!.querySelectorAll<HTMLButtonElement>('.tile').forEach(t => t.disabled = true);
    // Còn ai chưa vote thì cho bot quyết nhanh hơn
    setTimeout(() => w.fastForwardVotes(), 2500);
  }

  private updateMeeting() {
    const w = session.world!;
    const m = w.meeting;
    const el = this.meetEl!;
    if (!m) return;
    const discussing = m.t < m.discussEnd;
    $('#m-phase', el).textContent = m.result ? 'Kết quả' : discussing ? 'Thảo luận' : 'Bỏ phiếu';
    $('#m-time', el).textContent = m.result ? '' : `${Math.max(0, Math.ceil((discussing ? m.discussEnd : m.duration) - m.t))}s`;
    el.classList.toggle('voting', !discussing && !m.result);
    const ready = $('#m-ready', el) as HTMLButtonElement;
    ready.hidden = !discussing;
    const canVote = !discussing && !m.result && w.player.alive && !m.votes.has(w.player.id);
    ($('#m-skip', el) as HTMLButtonElement).disabled = !canVote;
    if (!discussing && !this.voteOpened) { this.voteOpened = true; sfx.ting(); }
    const log = $('.chat-log', el);
    while (this.meetChatCount < m.chat.length) {
      const c = m.chat[this.meetChatCount++];
      const a = w.agents[c.from];
      const row = document.createElement('div');
      row.className = 'msg' + (a.isPlayer ? ' me' : '') + (!a.alive ? ' ghost' : '');
      row.innerHTML = `<img src="${avatarURL(a.dept)}" alt="" style="background:${deptBg(a.dept)}"><div><b style="color:${dept(a.dept).color}">${esc(a.name)}</b><p>${esc(c.text)}</p></div>`;
      log.appendChild(row);
      log.scrollTop = log.scrollHeight;
      if (!a.isPlayer) sfx.ting();
    }
    while (this.reactCount < m.reactions.length) {
      const r = m.reactions[this.reactCount++];
      const tile = el.querySelector(`.tile[data-id="${r.from}"]`);
      if (!tile) continue;
      const f = document.createElement('span');
      f.className = 'react-float';
      f.textContent = r.emoji;
      f.style.left = `${30 + Math.random() * 40}%`;
      tile.appendChild(f);
      setTimeout(() => f.remove(), 2600);
      sfx.click();
    }
    for (const [voter] of m.votes) {
      const t = el.querySelector(`.tile[data-id="${voter}"] .voted`) as HTMLElement | null;
      if (t) t.hidden = false;
    }
    const aliveN = w.agents.filter(a => a.alive).length;
    if (!m.result && !$('#m-status', el).classList.contains('warn')) {
      $('#m-status', el).textContent = discussing ? 'Bỏ phiếu mở sau khi thảo luận' : `${m.votes.size}/${aliveN} người đã vote`;
    }
    if (m.result && !this.resultShown) {
      this.resultShown = true;
      for (const [target, voters] of m.result.tally) {
        const holder = target === 'skip' ? null : el.querySelector(`.tile[data-id="${target}"] .voters`);
        const html = this.prefs.anonVotes
          ? voters.map(() => '<span class="anon-vote" title="Phiếu ẩn danh"></span>').join('')
          : voters.map(v => `<img src="${avatarURL(w.agents[v].dept)}" title="${esc(w.agents[v].name)}" alt="" style="background:${deptBg(w.agents[v].dept)}">`).join('');
        if (holder) holder.innerHTML = html;
        else $('#m-status', el).innerHTML = `Bỏ qua: <span class="skipvoters">${html || '0'}</span>`;
      }
      setTimeout(() => this.showEjection(), 3200);
    }
  }

  private showEjection() {
    const w = session.world!;
    const m = w.meeting!;
    const r = m.result!;
    this.meetEl?.remove();
    this.meetEl = null;
    const el = document.createElement('div');
    el.className = 'overlay eject';
    if (r.ejected !== null) {
      const a = w.agents[r.ejected];
      const impLeft = w.aliveImp().filter(x => x.id !== a.id).length;
      el.innerHTML = `<div class="eject-stage">
          <div class="door"><span>Lối ra</span></div>
          <div class="drag"><img class="victim" src="${avatarURL(a.dept)}" alt=""><img class="guard" src="${avatarURL('guard')}" alt=""></div>
          <div class="stamp-mark">Bị sa thải</div>
        </div>
        <p class="eject-text">${esc(a.name)} ${a.role === 'impostor' ? '<b class="was-imp">là Nội gián.</b>' : 'không phải Nội gián.'}</p>
        <p class="eject-sub">Còn ${impLeft} Nội gián trong công ty.</p>`;
      setTimeout(() => sfx.stamp(), 2100);
    } else {
      el.innerHTML = `<div class="eject-stage"><div class="paper-fly">📄</div></div>
        <p class="eject-text">${r.tie ? 'Hòa phiếu. Không ai bị sa thải.' : 'Đa số chọn bỏ qua. Không ai bị sa thải.'}</p>
        <p class="eject-sub">"Thôi để họp tiếp vào thứ Hai."</p>`;
    }
    this.root.appendChild(el);
    sfx.whoosh();
    setTimeout(() => {
      el.remove();
      w.finishMeeting();
      if (w.phase === 'ended') this.showGameOver();
    }, 4800);
  }

  // ================= KẾT THÚC =================
  private showGameOver() {
    const w = session.world!;
    if (this.root.querySelector('.gameover')) return;
    session.paused = true;
    closeMini();
    const p = w.player;
    const won = w.winner === p.role;
    const s = this.stats;
    s.played++;
    if (won) {
      s.wins++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak);
      if (p.role === 'crew') s.crewWins++; else s.impWins++;
      if (s.fastestWin === null || w.time < s.fastestWin) s.fastestWin = Math.round(w.time);
    } else s.streak = 0;
    saveStats(s);
    const imps = w.agents.filter(a => a.role === 'impostor');
    const el = document.createElement('div');
    el.className = 'overlay gameover ' + (w.winner === 'crew' ? 'crew' : 'imp');
    el.innerHTML = `<div class="go-card">
      <p class="reveal-kicker">${won ? 'Bạn thắng' : 'Bạn thua'} · ${fmtTime(w.time)}</p>
      <h1>${w.winner === 'crew' ? 'Nhân viên thắng' : 'Nội gián thắng'}</h1>
      <p>${esc(w.winReason)}</p>
      <div class="reveal-team">${imps.map(a => `<figure class="mate"><img src="${avatarURL(a.dept)}" alt=""><figcaption style="--dc:${dept(a.dept).color}">${esc(a.name)}</figcaption></figure>`).join('')}</div>
      <p class="small">Nội gián ván này: ${imps.map(a => esc(a.name)).join(', ')}. Chuỗi thắng hiện tại: ${s.streak}.</p>
      <div class="row"><button class="ghost-btn" id="lobby">Về sảnh</button><button class="primary big" id="again">Chơi ván mới</button></div>
    </div>`;
    this.root.appendChild(el);
    (won ? sfx.taskDone() : sfx.fail());
    $('#again', el).onclick = () => this.startGame();
    $('#lobby', el).onclick = () => this.showLobby();
  }

  // ================= MỖI KHUNG HÌNH =================
  private frame(dt: number) {
    // Gộp bàn phím và cần điều khiển
    let x = 0, y = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    if (this.joy.active) { x = this.joy.x; y = this.joy.y; }
    if (miniOpen() || this.fakeT > 0 || this.camsOpen) { x = 0; y = 0; }
    session.input = { x, y };

    const w = session.world;
    if (!w || !this.hudEl) return;
    if (this.meetEl) { this.updateMeeting(); return; }
    if (w.phase !== 'play') return;
    const p = w.player;

    if (this.fakeT > 0) {
      this.fakeT -= dt;
      const f = $('.fake-work', this.hudEl);
      f.hidden = this.fakeT <= 0;
      ($('.fake-work .bar i', this.hudEl)).style.width = `${(1 - this.fakeT / 3) * 100}%`;
      if (Math.random() < 0.2) sfx.key();
    }

    const ctx = w.context(p);
    const use = $('#a-use', this.hudEl) as HTMLButtonElement;
    use.disabled = !ctx.use;
    $('.lb', use).textContent = ctx.use?.label ?? 'Làm việc';
    const rep = $('#a-report', this.hudEl); rep.hidden = !p.alive;
    (rep as HTMLButtonElement).disabled = !ctx.report;
    const isImp = p.role === 'impostor';
    const kill = $('#a-kill', this.hudEl) as HTMLButtonElement;
    kill.hidden = !isImp || !p.alive;
    kill.disabled = !ctx.kill || p.killCd > 0;
    $('.cd', kill).textContent = p.killCd > 0 ? String(Math.ceil(p.killCd)) : '';
    const sab = $('#a-sab', this.hudEl) as HTMLButtonElement;
    sab.hidden = !isImp;
    sab.disabled = !!w.sabotage || w.sabCd > 0;
    $('.lb', sab).textContent = w.sabCd > 0 && !w.sabotage ? `Phá hoại ${Math.ceil(w.sabCd)}` : 'Phá hoại';
    const hideB = $('#a-hide', this.hudEl) as HTMLButtonElement;
    hideB.hidden = !isImp || !p.alive;
    hideB.disabled = ctx.hide === null && p.hidden === null;
    const hc = $('.hide-ctrl', this.hudEl);
    hc.hidden = p.hidden === null;
    if (p.hidden !== null) {
      $('.hide-name', hc).textContent = `Đang trốn: ${HIDE_SPOTS[p.hidden].name}`;
      $('#h-next', hc).textContent = `Chuồn sang ${HIDE_SPOTS[HIDE_SPOTS[p.hidden].pair].name}`;
    }
    $('.actions', this.hudEl).classList.toggle('hidden-mode', p.hidden !== null);
    ($('#b-email', this.hudEl) as HTMLButtonElement).disabled = !p.alive || p.emergencyLeft <= 0;

    // Bảng nhiệm vụ: chỉ cập nhật khi đổi
    const k = w.crewTasksDone();
    const sabKey = w.sabotage ? `${w.sabotage.kind}:${Math.ceil(w.sabotage.t)}:${w.aliveCrew().filter(c => c.bossDone).length}` : '';
    const key = `${k.done}/${k.total}|${p.tasks.map(t => t.done ? 'x' : t.step).join('')}|${p.alive}|${sabKey}|${p.bossDone}`;
    if (key !== this.lastHud) {
      this.lastHud = key;
      ($('.kpi-bar i', this.hudEl)).style.width = `${(k.done / Math.max(1, k.total)) * 100}%`;
      const list = $('.task-list', this.hudEl);
      const items: string[] = [];
      const wifiDown = w.sabotage?.kind === 'wifi';
      if (isImp) items.push(`<li class="imp-note">Gài bẫy đồng nghiệp. Việc dưới đây chỉ để giả vờ.</li>`);
      else if (!p.alive) items.push(`<li class="imp-note">Hồn ma OT: làm nốt việc để cứu KPI.</li>`);
      if (w.sabotage) {
        const s = w.sabotage;
        const txt = s.kind === 'boss' ? `Về bàn gõ phím! (${Math.ceil(s.t)}s) ${p.bossDone || isImp ? '✓' : ''}`
          : s.kind === 'wifi' ? 'Khởi động lại router (Phòng Server)' : 'Bật lại cầu dao (Kho điện)';
        items.push(`<li class="sab">${SAB_INFO[s.kind].icon} ${txt}</li>`);
      }
      if (wifiDown) items.push('<li class="imp-note">Mất kết nối Jira… không tải được danh sách việc.</li>');
      else for (const t of p.tasks) {
        const def = taskDef(t.taskId);
        const st = station(t.done ? def.steps[def.steps.length - 1] : slotStation(t));
        const steps = def.steps.length > 1 ? ` (${t.done ? def.steps.length : t.step}/${def.steps.length})` : '';
        const label = def.steps.length > 1 && !t.done ? `${def.name}${steps}: ${st.name.toLowerCase()}` : def.name + steps;
        items.push(`<li class="${t.done ? 'done' : ''}${def.type === 'common' ? ' common' : ''}">${roomName(st.room)}: ${label}</li>`);
      }
      list.innerHTML = items.join('');
    }
    // Banner sự cố
    const ban = $('.sab-banner', this.hudEl);
    if (w.sabotage) {
      ban.hidden = false;
      const s = w.sabotage;
      ban.className = 'sab-banner ' + s.kind;
      ban.textContent = s.kind === 'boss'
        ? `Sếp đi tuần! Về bàn và giả vờ gõ phím: ${Math.ceil(s.t)}s (${w.aliveCrew().filter(c => c.bossDone).length}/${w.aliveCrew().length} đã ngồi)`
        : s.kind === 'power' ? 'Cúp điện! Bật lại cầu dao ở hành lang dưới' : 'Rớt mạng! Khởi động lại router ở phòng server';
    } else ban.hidden = true;
    $('.room-name', this.hudEl).textContent = roomName(roomAt(p.x, p.y));
    if (this.mapOpen) this.drawMinimap();
    if (this.camsOpen) this.drawCams();
  }

  private drawMinimap() {
    const w = session.world!;
    const cv = $('.minimap canvas', this.hudEl) as HTMLCanvasElement;
    const ctx = cv.getContext('2d')!;
    const sx = cv.width / (MAP_W * TILE), sy = cv.height / (MAP_H * TILE);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#2b2e4a'; ctx.fillRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (GRID[y * MAP_W + x] === 0) continue;
      ctx.fillStyle = GRID[y * MAP_W + x] === 2 ? '#b9b2a0' : '#e6dcc4';
      ctx.fillRect(x * TILE * sx, y * TILE * sy, TILE * sx + 0.5, TILE * sy + 0.5);
    }
    ctx.fillStyle = '#1d1a2b'; ctx.font = '700 11px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center';
    for (const r of ROOMS) if (r.label) ctx.fillText(r.name, (r.x + r.w / 2) * TILE * sx, (r.y + r.h / 2) * TILE * sy);
    const p = w.player;
    const wifiDown = w.sabotage?.kind === 'wifi';
    if (!wifiDown) for (const t of p.tasks) if (!t.done) {
      const st = station(slotStation(t));
      ctx.fillStyle = '#f2b705'; ctx.beginPath(); ctx.arc((st.stand.x + 0.5) * TILE * sx, (st.stand.y + 0.5) * TILE * sy, 5, 0, Math.PI * 2); ctx.fill();
    }
    if (w.sabotage && w.sabotage.kind !== 'boss') {
      const st = station(w.sabotage!.kind === 'wifi' ? 'router' : 'power');
      ctx.fillStyle = '#e8443a'; ctx.beginPath(); ctx.arc((st.stand.x + 0.5) * TILE * sx, (st.stand.y + 0.5) * TILE * sy, 7, 0, Math.PI * 2); ctx.fill();
    }
    const desk = DESKS[p.desk];
    ctx.strokeStyle = '#1f6feb'; ctx.lineWidth = 2; ctx.strokeRect(desk.x * TILE * sx, desk.y * TILE * sy, 2 * TILE * sx, TILE * sy);
    const cam = station('camera');
    ctx.strokeStyle = '#1d1a2b'; ctx.lineWidth = 2; ctx.fillStyle = '#9aa1c4';
    ctx.fillRect((cam.stand.x - 0.3) * TILE * sx, (cam.stand.y - 0.3) * TILE * sy, 10, 10);
    $('.mm-note', this.hudEl).textContent = wifiDown
      ? 'Mất kết nối: danh sách việc tạm thời không hiển thị.'
      : 'Chấm vàng là việc của bạn, khung xanh là bàn của bạn, ô xám là camera ở Phòng bảo vệ.';
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e8443a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x * sx, p.y * sy, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // ================= ĐIỀU KHIỂN =================
  private bindInput() {
    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault();
      if (!session.world || session.paused) return;
      if (k === 'escape') { closeMini(); this.toggleSabMenu(false); this.toggleMap(false); this.toggleCams(false); }
      if (this.meetEl || miniOpen()) return;
      if (k === 'e') this.doUse();
      else if (k === 'r') this.doReport();
      else if (k === 'q') this.doKill();
      else if (k === 'f' && session.world.player.role === 'impostor') this.toggleSabMenu();
      else if (k === ' ') this.doHide();
      else if (k === 'tab' || k === 'm') this.toggleMap();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  private bindJoystick(el: HTMLElement) {
    const knob = $('.joy-knob', el);
    let id: number | null = null, cx = 0, cy = 0;
    const R = 46;
    el.addEventListener('pointerdown', (e) => {
      id = e.pointerId; el.setPointerCapture(id);
      const r = el.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      this.joy.active = true; move(e);
      sfx.unlock();
    });
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joy.x = dx / R; this.joy.y = dy / R;
    };
    el.addEventListener('pointermove', move);
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null; this.joy.active = false; this.joy.x = 0; this.joy.y = 0;
      knob.style.transform = '';
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** Sếp đi tuần: bấm liên tục để "giả vờ gõ phím" */
function openMiniDesk(root: HTMLElement, onDone: () => void) {
  closeMini();
  const wrap = document.createElement('div');
  wrap.className = 'modal';
  wrap.innerHTML = `<div class="sheet mini"><div class="sheet-head"><div><h2>Giả vờ gõ phím</h2><p class="hint">Gõ thật nhanh trước khi sếp đi ngang qua!</p></div></div>
    <div class="mini-body"><div class="typing"><pre class="screen"></pre><button class="primary big type-btn">Gõ lạch cạch</button></div></div></div>`;
  root.appendChild(wrap);
  const scr = wrap.querySelector('.screen') as HTMLElement;
  const text = 'Kính gửi anh/chị, em xin phép cập nhật tiến độ dự án theo đúng kế hoạch đã đề ra ạ...';
  let i = 0;
  (wrap.querySelector('.type-btn') as HTMLElement).onpointerdown = (e) => {
    e.preventDefault();
    for (let k = 0; k < 6; k++) setTimeout(() => sfx.key(), k * 40);
    i = Math.min(text.length, i + 9);
    scr.textContent = text.slice(0, i) + '▌';
    if (i >= text.length) { sfx.taskDone(); setTimeout(() => { wrap.remove(); onDone(); }, 300); }
  };
}
