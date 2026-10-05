import { session } from '../session';
import { World, BOSS_TIME, killCooldownFor, type Agent, type GameEvent, type SabotageKind } from '../game/sim';
import { fmt } from '../content/text';
import { iconSvg, stationIcon, ICON_ART } from './icons';
import { PLAYER_NAMES, BOT_NAMES, ROLE_INFO, SPECIAL_ROLES, COLOR_GROUPS, STICKERS, normalize, type RoleDept } from '../game/data';
import { ROOMS, TILE, MAP_W, MAP_H, DESKS, HIDE_SPOTS, CAMERAS, BELL, LOCKABLE_ROOMS, FLOORS, SPAWN_POINTS, levelAt, levelName, type RoomId, station, taskDef, roomAt, roomName, GRID, type MiniKind } from '../game/map';
import { slotStation, IT_CAM_TIME, IT_CD, SAB_CD, ENG_CD, ADMIN_CD, MEDIA_CD, CLIMBER_CD, PRY_AFTER } from '../game/sim';
import { avatarURL, avatarImage, chairURL, characterCanvas, tagText, nameInk, GUARD_LOOK, randomLook, lookKey, lookColor, normalizeLook, DEFAULT_LOOK, SKIN_TONES, CHAR_H, CHAR_W, CHAR_TOP, CHAR_ORIGIN_Y, SKINS, HAIR_COLORS, HAIR_STYLES, PALETTE, BODIES, MARKS, ITEMS, SLOT_NAMES, itemDef, bodyDef, colors2, defaultColor, type Look, type Slot, type ItemDef } from '../render/chars';
import { sfx } from '../audio';
import { openMini, closeMini, miniOpen, openFaceId, openCardSwipe, openColorCheck, openV3 } from './minigames';
import { GameStats, statsText } from '../game/stats';
/** Chế độ admin (?admin): thống kê ván và nút sao chép số liệu, chỉ dành cho người làm game thử nghiệm trước khi phát hành */
export const ADMIN = new URLSearchParams(location.search).has('admin');
import { act, actAsync, net, NetHost, NetClient, newRoomCode, normalizeCode, MAX_PLAYERS, HOST_GONE_MS, HOST_LOST_MS, type Profile } from '../net/room';
import { TabTransport, MultiTransport, newPeerId } from '../net/transport';
import { PeerTransport, type PeerCtor, type P2PStatus } from '../net/peer';
import { Peer } from 'peerjs';
/** Màn chia ô chỉ dùng kênh nội bộ (chạy cả khi không có mạng); bình thường thêm P2P để máy khác vào được */
const USE_P2P = !new URLSearchParams(location.search).get('mt');
import { startPump } from '../net/pump';
import { DirectoryAnnouncer, fetchRooms, cleanRoomName, type RoomEntry } from '../net/directory';

/** Mã máy cố định cho từng tab (giữ nguyên khi tải lại trang) để vào lại đúng nhân vật; mỗi ô ?multitest một mã riêng */
const NET_SUFFIX = MT_SLOT_RAW() ? ':mt' + MT_SLOT_RAW() : '';
function MT_SLOT_RAW() { return new URLSearchParams(location.search).get('mt'); }
function stablePeerId() { const k = 'ngvp-peer' + NET_SUFFIX; let id = sessionStorage.getItem(k); if (!id) { id = newPeerId(); sessionStorage.setItem(k, id); } return id; }
const ROOM_KEY = 'ngvp-room' + NET_SUFFIX;
/** Phòng vừa ở (nhớ cả khi đóng tab, trong 10 phút) để hiện nút "Vào lại phòng"; kèm mã máy cũ để nhận lại đúng nhân vật */
const LAST_KEY = 'ngvp-last' + NET_SUFFIX;
function lastRoom(): { code: string; peer: string; at: number } | null {
  try { const v = JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null'); return v && Date.now() - v.at < 10 * 60000 ? v : null; } catch { return null; }
}
function rememberRoom(code: string, peer: string) { try { localStorage.setItem(LAST_KEY, JSON.stringify({ code, peer, at: Date.now() })); } catch { /* bỏ qua */ } }
function forgetRoom() { try { localStorage.removeItem(LAST_KEY); } catch { /* bỏ qua */ } sessionStorage.removeItem(ROOM_KEY); }

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
const EMOJIS = ['👍', '👎', '❓', '😂', '😡', '🤔'];
const LOCK_SVG = '<svg class="lock-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="12" rx="3" fill="currentColor"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="3"/></svg>';

/** Phím điều khiển (máy tính chỉnh được; phím mũi tên luôn dùng để di chuyển) */
type KeyAction = 'up' | 'down' | 'left' | 'right' | 'use' | 'report' | 'kill' | 'sab' | 'hide' | 'map' | 'laptop';
const DEFAULT_KEYS: Record<KeyAction, string> = { up: 'w', down: 's', left: 'a', right: 'd', use: 'e', report: 'r', kill: 'q', sab: 'f', hide: ' ', map: 'tab', laptop: 'c' };
// ---------- Sơ đồ tòa nhà: icon vẽ, ghim việc, màu phòng ----------
const MAP_ICON: Record<string, string> = { '🛗': 'lift', '🪜': 'stairs', '🔔': 'bell', '📹': 'camera', '⚡': 'breaker', '📶': 'router', '🎨': 'palette', '🪪': 'idcard', '🔒': 'lock' };
const mapIconCache = new Map<string, HTMLImageElement>();
function mapIcon(name: string | undefined): HTMLImageElement | null {
  if (!name) return null;
  let img = mapIconCache.get(name);
  if (!img) {
    img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 64 64">${ICON_ART[name] ?? ICON_ART.work}</svg>`);
    mapIconCache.set(name, img);
  }
  return img;
}
const mapAvatarCache = new Map<string, HTMLImageElement>();
function mapAvatar(look: Look): HTMLImageElement {
  const url = avatarURL(look);
  let img = mapAvatarCache.get(url);
  if (!img) { img = new Image(); img.src = url; mapAvatarCache.set(url, img); }
  return img;
}
/** Ghim việc: giọt nước ngược màu vàng có dấu "!", nảy nhẹ */
function drawTaskPin(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fill: string) {
  const r = size * 0.95, by = Math.sin(performance.now() / 260 + x) * 3;
  const top = y - r * 2.2 + by;
  ctx.fillStyle = 'rgba(29,26,43,.25)'; ctx.beginPath(); ctx.ellipse(x, y + 2, r * 0.7, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, y + by); ctx.bezierCurveTo(x - r * 1.2, top + r * 1.4, x - r * 1.1, top, x, top); ctx.bezierCurveTo(x + r * 1.1, top, x + r * 1.2, top + r * 1.4, x, y + by);
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#1d1a2b'; ctx.stroke();
  ctx.fillStyle = '#1d1a2b'; ctx.font = `800 ${Math.round(r * 1.25)}px "Baloo 2", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('!', x, top + r * 0.75);
}
const ROOM_TINT: [string, string][] = [
  ['meeting', '#ffe9b8'], ['open', '#f4e3c8'], ['pantry', '#fff2c2'], ['print', '#e6e8f0'], ['reception', '#f6dccb'], ['security', '#dfe6f5'],
  ['fun', '#d6eefc'], ['power', '#e9e4d6'], ['director', '#f0d9c4'], ['hr', '#fbdcea'], ['server', '#d8e4f2'], ['qa', '#e2f3dc'], ['art', '#f7ecc9'],
  ['roof_garden', '#cdeac0'], ['roof_terrace', '#e9e4d8'], ['roof_ac', '#dcdfe6'], ['hall', '#ddd6c6'], ['stairs', '#c9c4d8'], ['cabin', '#e6e8f0'],
];
function mapRoomColor(id: string | null): string {
  if (!id) return '#d3ccbb';
  for (const [pre, c] of ROOM_TINT) if (id.startsWith(pre)) return c;
  return '#ece3cc';
}

type ActState = 'off' | 'ready' | 'target' | 'alarm' | 'cool' | 'active' | 'done';
interface ActView { icon: string; label: string; state: ActState; cd?: number; cdMax?: number }

const KEY_NAMES: Record<KeyAction, string> = {
  up: 'Đi lên', down: 'Đi xuống', left: 'Sang trái', right: 'Sang phải', use: 'Làm việc / Dùng', report: 'Báo cáo ghế trống',
  kill: 'Gài bẫy (Nội gián)', sab: 'Phá hoại (Nội gián)', hide: 'Trốn / Ra ngoài', map: 'Sơ đồ', laptop: 'Kỹ năng: Laptop (IT) / Họp gấp (PO)',
};
const keyLabel = (k: string) => k === ' ' ? 'Space' : k === 'tab' ? 'Tab' : k === 'enter' ? 'Enter' : k === 'shift' ? 'Shift' : k === 'control' ? 'Ctrl'
  : k.startsWith('arrow') ? ({ arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→' } as Record<string, string>)[k] : k.length === 1 ? k.toUpperCase() : k;
const isTouch = () => window.matchMedia('(pointer: coarse)').matches;

/** Màn chia ô ?multitest: mỗi ô một hồ sơ riêng (không ghi đè lên nhau) */
export const MT_SLOT = new URLSearchParams(location.search).get('mt');
const STATS_KEY = 'noi-gian-van-phong:stats' + (MT_SLOT ? ':mt' + MT_SLOT : '');
const CHAT_COOLDOWN = 2000;
const PREFS_KEY = 'noi-gian-van-phong:prefs' + (MT_SLOT ? ':mt' + MT_SLOT : '');
function loadStats(): Stats {
  const base: Stats = { played: 0, wins: 0, crewWins: 0, impWins: 0, streak: 0, bestStreak: 0, fastestWin: null };
  try { const raw = localStorage.getItem(STATS_KEY); if (raw) return { ...base, ...JSON.parse(raw) }; } catch { /* bỏ qua */ }
  return base;
}
function saveStats(s: Stats) { try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch { /* bỏ qua */ } }
interface Prefs {
  name: string; look: Look; bots: number; imps: number; muted: boolean; anonVotes: boolean;
  roles: Record<Exclude<RoleDept, 'intern'>, boolean>;
  maxSpecial: number;
  /** Chế độ thử nghiệm: 'random' = bình thường, 'impostor', hoặc một phòng ban */
  testRole: 'random' | 'impostor' | RoleDept;
  vision: number;
  keys: Record<KeyAction, string>;
  music: boolean;
}
function loadPrefs(): Prefs {
  const base: Prefs = { name: MT_SLOT ? `Người ${MT_SLOT}` : '', look: randomLook(), bots: 7, imps: 1, muted: false, anonVotes: false, roles: { hr: true, director: true, it: true, po: true, producer: true, developer: true, artist: true, sound: true, admin: true, engineer: true, media: true, animator: true, tester: true, gd: true, climber: true }, maxSpecial: 3, testRole: 'random', vision: 1, keys: { ...DEFAULT_KEYS }, music: true };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const p = { ...base, ...JSON.parse(raw) };
      p.look = normalizeLook(p.look); // ngoại hình lưu từ bản cũ được chuyển sang kiểu mới
      p.roles = { ...base.roles, ...(p.roles ?? {}) };
      p.keys = { ...DEFAULT_KEYS, ...(p.keys ?? {}) };
      return p;
    }
  } catch { /* bỏ qua */ }
  return base;
}
function savePrefs(p: Prefs) { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* bỏ qua */ } }

export const SAB_INFO: Record<SabotageKind, { name: string; icon: string; desc: string }> = {
  wifi: { name: 'Rớt mạng', icon: '📶', desc: 'Tắt camera, ẩn danh sách việc, máy Face ID và laptop IT mất kết nối' },
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
    this.showMainMenu();
  }

  // ================= SẢNH =================
  // ================= MÀN HÌNH CHÍNH =================
  showMainMenu() {
    this.switchScene('lobby');
    session.world = null;
    this.lobbyHud = null;
    this.root.innerHTML = '';
    const p = this.prefs;
    // Nhạc nền màn hình chính (trình duyệt chỉ cho phát sau lần chạm/bấm đầu tiên)
    sfx.setMusic(p.music);
    const el = document.createElement('div');
    const startTitleMusic = () => { if (!el.isConnected && this.root.children.length) return; sfx.unlock(); sfx.startMusic('title'); };
    startTitleMusic();
    window.addEventListener('pointerdown', startTitleMusic, { once: true });
    window.addEventListener('keydown', startTitleMusic, { once: true });
    el.className = 'mainmenu title-screen';
    const crowd = Array.from({ length: 7 }, () => randomLook());
    crowd[3] = p.look;
    el.innerHTML = `
      ${titleBackdrop()}
      <div class="ts-crowd">${crowd.map((l, i) => `<img src="${avatarURL(l)}" alt="" style="--i:${i}">`).join('')}</div>
      <div class="ts-content">
        <h1 class="ts-title">${esc(fmt('ui.title.line1'))}<br>${esc(fmt('ui.title.line2'))} <span class="ts-snake">${esc(fmt('ui.title.snake'))}</span></h1>
        <p class="ts-tag">${esc(fmt('ui.title.tagline'))}</p>
        ${session.contentTest ? `<p class="ts-test">🧪 Đang chạy nội dung thử (${session.contentTest} mục) · <a href="?content">Mở công cụ nội dung</a></p>` : ''}
        <div class="ts-panel">
          <!-- Thẻ nhân viên: nhân vật (bấm để thay đồ), tên hiển thị, mã số -->
          <div class="mm-card">
            <button class="mm-av" id="go-avatar" type="button" aria-label="Mở máy thay đồ"><img src="${avatarURL(this.prefs.look)}" alt=""><span>Thay đồ</span></button>
            <div class="mm-fields">
              <div class="field"><label for="f-name">Tên hiển thị</label>
                <div class="name-row">
                  <input id="f-name" maxlength="12" autocomplete="off" placeholder="Nhập tên hoặc bấm xí ngầu" value="${esc(this.sessName)}">
                  <button class="dice" id="f-dice" type="button" aria-label="Chọn tên ngẫu nhiên" title="Chọn tên ngẫu nhiên">🎲</button>
                </div>
                <p class="name-err" id="name-err" hidden>Cần có tên trước khi vào sảnh.</p></div>
              <div class="field"><label for="f-id">Mã số nhân viên</label>
                <div class="name-row id-row"><span class="id-hash">#</span>
                  <input id="f-id" inputmode="numeric" maxlength="3" autocomplete="off" placeholder="100 – 999" value="${esc(this.sessId)}">
                  <button class="dice" id="f-iddice" type="button" aria-label="Bốc mã ngẫu nhiên" title="Bốc mã ngẫu nhiên">🎲</button>
                </div>
                <p class="name-err" id="id-err" hidden>Mã số gồm 3 chữ số, từ 100 đến 999.</p></div>
            </div>
          </div>
          <div class="mm-buttons">
            <button class="primary big" id="go-offline">🏢 Chơi với bot<small>Một mình cùng đồng nghiệp bot</small></button>
            <button class="ghost-btn big" id="go-online">🌐 Chơi nhiều người<small>Tạo phòng hoặc vào bằng mã phòng</small></button>
            <div class="mm-row three"><button class="ghost-btn" id="go-stats">🏆 Thành tích</button><button class="ghost-btn" id="go-howto">📖 Hướng dẫn</button><button class="ghost-btn" id="go-settings">⚙️ Cài đặt</button></div>
          </div>
        </div>
      </div>`;
    this.root.appendChild(el);
    const nameIn = $('#f-name', el) as HTMLInputElement;
    $('#f-dice', el).onclick = () => {
      sfx.unlock(); sfx.click();
      const pool = PLAYER_NAMES.filter(n => n !== nameIn.value.trim());
      nameIn.value = pool[Math.floor(Math.random() * pool.length)];
      const d = $('#f-dice', el); d.classList.remove('dice-roll'); void d.offsetWidth; d.classList.add('dice-roll');
      $('#name-err', el).hidden = true;
    };
    nameIn.oninput = () => { if (nameIn.value.trim()) $('#name-err', el).hidden = true; };
    const idIn = $('#f-id', el) as HTMLInputElement;
    idIn.oninput = () => { idIn.value = idIn.value.replace(/[^0-9]/g, '').slice(0, 3); $('#id-err', el).hidden = true; };
    $('#f-iddice', el).onclick = () => { sfx.unlock(); sfx.click(); idIn.value = String(100 + Math.floor(Math.random() * 900)); $('#id-err', el).hidden = true; };
    const profileOk = () => {
      const name = nameIn.value.trim().slice(0, 12);
      if (!name) { $('#name-err', el).hidden = false; nameIn.focus(); return false; }
      const id = idIn.value.trim();
      if (id && !/^[1-9][0-9]{2}$/.test(id)) { $('#id-err', el).hidden = false; idIn.focus(); return false; }
      sfx.unlock(); sfx.click();
      p.name = name; savePrefs(p);
      this.sessName = name; this.sessId = id || String(100 + Math.floor(Math.random() * 900));
      return true;
    };
    const go = () => { if (profileOk()) this.enterLobby(); };
    this.titleProfileOk = profileOk;
    nameIn.onkeydown = (e) => { if (e.key === 'Enter') go(); };
    $('#go-offline', el).onclick = go;
    $('#go-online', el).onclick = () => { if (profileOk()) this.openOnlineMenu(); };
    $('#go-stats', el).onclick = () => this.infoModal('Thành tích', this.statsHtml());
    // Hướng dẫn = Luật chơi + Điều khiển
    $('#go-howto', el).onclick = () => {
      const m = this.infoModal('Hướng dẫn', `<div class="mm-guide"><button class="ghost-btn big" type="button" data-g="rules">📖 Luật chơi<small>Hai phe, cách thắng, các vai</small></button><button class="ghost-btn big" type="button" data-g="keys">🎮 Điều khiển<small>Phím, cần điều khiển trên điện thoại</small></button></div>`);
      m.querySelectorAll<HTMLButtonElement>('[data-g]').forEach(b => b.onclick = () => { m.remove(); if (b.dataset.g === 'rules') this.openRules(); else this.openControls(); });
    };
    // Cài đặt: nhạc nền, âm thanh hiệu ứng
    $('#go-settings', el).onclick = () => {
      const m = this.infoModal('Cài đặt', `<div class="mm-guide"><button class="ghost-btn big" type="button" id="st-music"></button><button class="ghost-btn big" type="button" id="st-sfx"></button></div>`);
      this.bindMusicButton($('#st-music', m));
      const sb = $('#st-sfx', m), lab = () => { sb.textContent = this.prefs.muted ? '🔇 Âm thanh hiệu ứng: Tắt' : '🔊 Âm thanh hiệu ứng: Bật'; };
      lab(); sb.onclick = () => { this.prefs.muted = !this.prefs.muted; savePrefs(this.prefs); sfx.setMuted(this.prefs.muted); lab(); };
    };
    // Bấm nhân vật trên thẻ nhân viên: mở máy thay đồ; lưu xong thì ảnh trên thẻ cập nhật
    $('#go-avatar', el).onclick = () => {
      sfx.unlock(); sfx.click();
      this.openWardrobe();
      const img = $('#go-avatar img', el) as HTMLImageElement;
      const t = window.setInterval(() => { if (!document.querySelector('.ae-done')) { window.clearInterval(t); img.src = avatarURL(this.prefs.look); session.paused = false; } }, 300);
    };
    // Link mời (?room=MÃ): có tên rồi thì vào thẳng phòng; chưa có tên thì điền sẵn mã vào menu chơi nhiều người
    // Vừa rời một phòng (kể cả đã đóng tab): nút vào lại phòng, nhận lại đúng nhân vật nếu còn trong 60 giây
    const lr = lastRoom();
    if (lr && !MT_SLOT && net.role === 'solo') {
      const b = document.createElement('button');
      b.className = 'ghost-btn big rejoin-btn'; b.type = 'button';
      b.innerHTML = `↩ Vào lại phòng ${esc(lr.code)}<small>Bạn vừa rời phòng lúc ${new Date(lr.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</small>`;
      $('#go-online', el).insertAdjacentElement('afterend', b);
      b.onclick = () => { if (profileOk()) this.joinRoom(lr.code, lr.peer); };
    }
    // link mời, hoặc vừa tải lại trang khi đang ở trong phòng (vào lại đúng nhân vật cũ)
    const invite = new URLSearchParams(location.search).get('room') ?? sessionStorage.getItem(ROOM_KEY);
    if (invite && !MT_SLOT && !this.inviteUsed) {
      this.inviteUsed = true;
      const code = normalizeCode(invite);
      if (p.name) { if (!nameIn.value) nameIn.value = p.name; window.setTimeout(() => { if (profileOk()) this.joinRoom(code); }, 150); }
      else { $('#go-online', el).onclick = () => { if (profileOk()) this.openOnlineMenu(code); }; nameIn.focus(); }
    }
    // Màn chia ô ?multitest: ô 1 tự tạo phòng, các ô khác tự vào phòng
    if (MT_SLOT && !this.mtStarted) {
      this.mtStarted = true;
      const code = new URLSearchParams(location.search).get('room') ?? 'MTT-234';
      if (!nameIn.value) nameIn.value = p.name || `Người ${MT_SLOT}`;
      window.setTimeout(() => { if (!profileOk()) return; if (MT_SLOT === '1') this.createRoom(code); else this.joinRoom(code); }, MT_SLOT === '1' ? 200 : 700 + Number(MT_SLOT) * 150);
    }
  }

  private statsHtml() {
    const s = this.stats;
    return `<div class="stats big-stats">
      <div><b>${s.played}</b><span>ván đã chơi</span></div>
      <div><b>${s.crewWins}</b><span>thắng làm Nhân viên</span></div>
      <div><b>${s.impWins}</b><span>thắng làm Nội gián</span></div>
      <div><b>${s.bestStreak}</b><span>chuỗi thắng dài nhất</span></div>
      <div><b>${s.fastestWin !== null ? fmtTime(s.fastestWin) : '–'}</b><span>thắng nhanh nhất</span></div>
    </div>`;
  }

  /** Hộp xác nhận vẽ trong game (không dùng hộp thoại của trình duyệt, vốn bị chặn trong khung nhúng) */
  private confirmBox(title: string, msg: string, okLabel = 'Đồng ý', cancelLabel = 'Hủy'): Promise<boolean> {
    return new Promise(resolve => {
      const wasPaused = session.paused;
      const m = document.createElement('div');
      m.className = 'modal confirm-modal';
      m.innerHTML = `<div class="sheet confirm-sheet" role="alertdialog" aria-label="${esc(title)}"><h2>${esc(title)}</h2><p>${esc(msg)}</p>
        <div class="row"><button class="ghost-btn" data-v="0">${esc(cancelLabel)}</button><button class="primary danger" data-v="1">${esc(okLabel)}</button></div></div>`;
      this.root.appendChild(m);
      const done = (v: boolean) => { m.remove(); session.paused = wasPaused; sfx.click(); resolve(v); };
      m.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.onclick = () => done(b.dataset.v === '1'));
      m.addEventListener('pointerdown', e => { if (e.target === m) done(false); });
      (m.querySelector('button[data-v="0"]') as HTMLButtonElement).focus();
    });
  }

  /** Popup thông tin. beforeClose trả về false thì không đóng (ví dụ còn thay đổi chưa lưu) */
  private infoModal(title: string, html: string, onClose?: () => void, beforeClose?: () => Promise<boolean>): HTMLElement {
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<div class="sheet info-sheet" role="dialog" aria-label="${title}"><div class="sheet-head"><h2>${title}</h2><button class="x art" aria-label="Đóng">${iconSvg('close')}</button></div><div class="info-body">${html}</div></div>`;
    this.root.appendChild(m);
    const close = () => { m.remove(); session.paused = false; onClose?.(); };
    const tryClose = async () => { if (beforeClose && !(await beforeClose())) return; close(); };
    (m as any).__close = close;
    (m.querySelector('.x') as HTMLElement).onclick = tryClose;
    m.addEventListener('pointerdown', e => { if (e.target === m) tryClose(); });
    return m;
  }

  /** Chuyển cảnh Phaser giữa sảnh tầng G và văn phòng */
  private switchScene(to: 'lobby' | 'game') {
    const g = session.phaser;
    if (!g) return;
    const other = to === 'lobby' ? 'game' : 'lobby';
    if (g.scene.isActive(other) || g.scene.isPaused(other)) g.scene.stop(other);
    if (!g.scene.isActive(to)) g.scene.start(to);
  }

  // ================= SẢNH CHỜ TẦNG G =================
  private lobbyHud: HTMLElement | null = null;
  /** Tên và mã số trong lần chơi này (mở lại game thì để trống) */
  private sessName = '';
  private sessId = '';

  /** Đồng nghiệp bot ngồi chờ ở sảnh: giữ nguyên khi đổi cài đặt, chỉ thêm/bớt cho đủ số */
  private syncLobbyBots() {
    const L = session.lobby, p = this.prefs;
    const used = new Set([normalize(p.name), ...L.bots.map(b => normalize(b.name))]);
    while (L.bots.length > p.bots) L.bots.pop();
    const pool = BOT_NAMES.filter(n => !used.has(normalize(n)));
    while (L.bots.length < p.bots && pool.length) L.bots.push({ name: pool.splice(Math.floor(Math.random() * pool.length), 1)[0], look: randomLook(), empId: '' });
    L.bots = L.bots.filter(b => normalize(b.name) !== normalize(p.name));
    // Mã số của bot không trùng với ai (kể cả mã người chơi vừa đổi)
    const ids = new Set([L.me.empId]);
    for (const b of L.bots) {
      if (!/^[1-9][0-9]{2}$/.test(b.empId) || ids.has(b.empId)) { let x = ''; do { x = String(100 + Math.floor(Math.random() * 900)); } while (ids.has(x)); b.empId = x; }
      ids.add(b.empId);
    }
    L.version++;
  }

  /** Popup đổi mã số nhân viên ở sảnh */
  private openIdEditor() {
    session.paused = true;
    const m = this.infoModal('Mã số nhân viên', `
      <p class="ae-note">3 chữ số từ 100 đến 999. Mã hiện trên thẻ tên, trong phòng họp và trên máy tính ở bàn làm việc của bạn.</p>
      <div class="name-row id-row"><span class="id-hash">#</span><input id="f-id2" inputmode="numeric" maxlength="3" autocomplete="off" value="${esc(this.sessId)}" placeholder="333">
        <button class="dice" id="f-iddice" type="button" aria-label="Bốc mã ngẫu nhiên">🎲</button></div>
      <p class="name-err" id="id-err2" hidden></p>
      <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="primary" id="id-save">Lưu mã số</button></div>`);
    const inp = $('#f-id2', m) as HTMLInputElement;
    inp.oninput = () => { inp.value = inp.value.replace(/[^0-9]/g, '').slice(0, 3); };
    $('#f-iddice', m).onclick = () => { inp.value = this.randomFreeId(); sfx.click(); };
    $('#id-save', m).onclick = () => {
      const v = inp.value.trim();
      const err = $('#id-err2', m);
      if (!/^[1-9][0-9]{2}$/.test(v)) { err.textContent = 'Mã số gồm 3 chữ số, từ 100 đến 999.'; err.hidden = false; return; }
      this.sessId = v; session.lobby.me.empId = v;
      this.syncLobbyBots(); this.renderLobbyPeople(); sfx.taskDone();
      (m as any).__close();
    };
    inp.focus(); inp.select();
  }

  private randomFreeId() {
    const used = new Set(session.lobby.bots.map(b => b.empId));
    let x = ''; do { x = String(100 + Math.floor(Math.random() * 900)); } while (used.has(x));
    return x;
  }

  enterLobby() {
    this.switchScene('lobby');
    session.world = null;
    session.paused = false;
    closeMini();
    sfx.stopBossSteps();
    const p = this.prefs;
    if (!/^[1-9][0-9]{2}$/.test(this.sessId)) this.sessId = this.randomFreeId();
    session.lobby.me = { name: this.sessName || p.name, look: p.look, empId: this.sessId };
    if (net.role !== 'solo') { const mine = (net.host?.players.find(x => x.host) ?? net.client?.room?.players.find(x => x.peer === net.client?.tr.peerId)); if (mine) session.lobby.me.empId = mine.empId; }
    else { session.lobby.online = false; this.syncLobbyBots(); }
    this.root.innerHTML = '';
    const hud = document.createElement('div');
    hud.className = 'hud lobby-hud';
    hud.innerHTML = `
      <div class="lobby-card card-lite">
        <b class="lc-title">Sảnh tầng G</b>
        <span class="lc-mode">Phòng offline · chơi với bot</span>
        <p class="lc-test" hidden></p>
        <button class="lc-id" id="l-id" type="button">Mã số của bạn: <b></b> <i>✏️ Đổi</i></button>
        <button class="lc-toggle" id="l-toggle" aria-expanded="false"><span class="lc-faces"></span><span class="lc-sum"></span><i>▾</i></button>
        <ul class="lc-people" hidden></ul>
      </div>
      <div class="top-right"><button class="icon-btn art" id="l-menu" aria-label="Menu">${iconSvg('menu')}</button></div>
      <div class="menu-pop card-lite" hidden>
        <button class="menu-item" id="l-mute"></button>
        <button class="menu-item" id="l-music"></button>
        <button class="menu-item" id="l-keys">🎮 Điều khiển</button>
        <button class="menu-item" id="l-rules">📖 Luật chơi</button>
        <button class="menu-item danger" id="l-exit">🚪 Về màn hình chính</button>
      </div>
      <div class="actions"><button class="act" id="l-use"><span class="ic"></span><i class="sweep"></i><em class="cd"></em><span class="lb"></span><kbd data-k="use"></kbd><b class="done-badge">✓</b></button></div>
      <button class="lchat-feed" type="button" aria-label="Xem lại tin nhắn"></button>
      <div class="lchat-history card-lite" hidden><div class="lch-head"><b>Tin nhắn trong sảnh</b><button class="x art" type="button" aria-label="Đóng">${iconSvg('close')}</button></div><div class="lchat-log" aria-live="polite"></div></div>
      <form class="lchat-bar" autocomplete="off" hidden>
        <div class="lchat-quick" data-keep-emoji>${['👋', '😂', '👍', 'Đi thôi!', 'Đợi tí!'].map(q => `<button type="button" data-q="${q}">${q}</button>`).join('')}</div>
        <div class="lchat-row"><input class="lchat-in" maxlength="120" placeholder="Nhập tin nhắn, Enter để gửi, Esc để đóng" aria-label="Tin nhắn"><button type="submit" class="lchat-send">Gửi</button></div>
      </form>
      <button class="lchat-btn" type="button" aria-label="Chat (Enter)">${iconSvg('chat')}<kbd>Enter</kbd></button>
      <div class="joy" aria-hidden="true"><div class="joy-knob"></div></div>`;
    this.root.appendChild(hud);
    this.lobbyHud = hud;
    this.hudEl = hud;
    const muteLabel = () => { $('#l-mute', hud).textContent = this.prefs.muted ? '🔇 Âm thanh: Tắt' : '🔊 Âm thanh: Bật'; };
    muteLabel();
    $('#l-mute', hud).onclick = () => { this.prefs.muted = !this.prefs.muted; savePrefs(this.prefs); sfx.setMuted(this.prefs.muted); muteLabel(); };
    $('#l-menu', hud).onclick = () => { const m = $('.menu-pop', hud); m.hidden = !m.hidden; };
    $('#l-exit', hud).onclick = () => { if (net.role !== 'solo') { forgetRoom(); this.leaveNet(); } this.showMainMenu(); };
    if (net.role !== 'solo') ($('#l-exit', hud)).textContent = net.host ? '🚪 Đóng phòng, về màn hình chính' : '🚪 Rời phòng, về màn hình chính';
    $('#l-keys', hud).onclick = () => { $('.menu-pop', hud).hidden = true; this.openControls(); };
    $('#l-rules', hud).onclick = () => { $('.menu-pop', hud).hidden = true; this.openRules(); };
    this.bindMusicButton($('#l-music', hud));
    this.renderKeyHints();
    // Nhạc nền vui vẻ ở sảnh chờ; tiếng ồn văn phòng tắt hẳn
    sfx.ambientLevel(0);
    sfx.setMusic(this.prefs.music);
    sfx.startMusic('lobby');
    $('#l-use', hud).onclick = () => this.lobbyUse();
    $('#l-id', hud).onclick = () => this.openIdEditor();
    $('#l-toggle', hud).onclick = () => {
      const list = $('.lc-people', hud), open = !!list.hidden;
      list.hidden = !open; $('#l-toggle', hud).setAttribute('aria-expanded', String(open)); hud.querySelector('.lobby-card')!.classList.toggle('open', open);
    };
    this.bindJoystick($('.joy', hud));
    this.renderLobbyPeople();
    this.bindLobbyChat(hud);
  }

  // ---------- Chat ở sảnh chờ ----------
  private chatLast = 0;
  /**
   * Chat ở sảnh:
   * - Không gõ: góc trái dưới hiện 4 tin gần nhất, mỗi tin tự mờ đi sau 8 giây.
   * - Enter (hoặc nút chat): mở thanh gõ ở giữa phía dưới. Enter gửi xong là đóng ngay, nhân vật đi tiếp được.
   * - Bấm vào dòng tin: mở lịch sử đầy đủ.
   */
  private bindLobbyChat(hud: HTMLElement) {
    const feed = $('.lchat-feed', hud), hist = $('.lchat-history', hud), log = $('.lchat-log', hud);
    const bar = $('.lchat-bar', hud) as HTMLFormElement, input = $('.lchat-in', hud) as HTMLInputElement;
    const scene = () => session.phaser?.scene.getScene('lobby') as unknown as { chatSay?: (t: string) => void } | undefined;
    const open = (on: boolean) => {
      bar.hidden = !on; hud.classList.toggle('chatting', on);
      if (on) { input.value = ''; window.setTimeout(() => input.focus(), 0); } else input.blur();
    };
    const send = (text: string) => {
      const t = text.trim();
      if (!t) return false;
      const now = performance.now();
      if (now - this.chatLast < 1500) { this.toast('Chậm lại chút, đợi 1–2 giây rồi gửi tiếp nhé'); return false; }
      this.chatLast = now;
      scene()?.chatSay?.(t.slice(0, 120));
      return true;
    };
    session.lobby.onChat = (m) => {
      // Lịch sử đầy đủ
      const row = document.createElement('p');
      row.className = 'lchat-msg' + (m.me ? ' me' : '');
      row.innerHTML = `<b>${esc(m.name)} <small>#${m.empId}</small></b> `;
      row.appendChild(document.createTextNode(m.text));
      log.appendChild(row);
      while (log.children.length > 80) log.firstElementChild?.remove();
      log.scrollTop = log.scrollHeight;
      // Dòng tin trôi: tối đa 4 tin, tự mờ
      const line = document.createElement('span');
      line.className = 'lf-line' + (m.me ? ' me' : '');
      line.innerHTML = `<b>${esc(m.name)}</b> `;
      line.appendChild(document.createTextNode(m.text));
      feed.appendChild(line);
      while (feed.children.length > 4) feed.firstElementChild?.remove();
      window.setTimeout(() => line.classList.add('gone'), 8000);
      window.setTimeout(() => line.remove(), 8600);
    };
    bar.onsubmit = (e) => { e.preventDefault(); if (send(input.value)) open(false); else if (!input.value.trim()) open(false); };
    input.onkeydown = (e) => { if (e.key === 'Escape') { e.preventDefault(); open(false); } e.stopPropagation(); };
    input.onblur = () => window.setTimeout(() => { if (document.activeElement !== input && !bar.contains(document.activeElement)) open(false); }, 150);
    hud.querySelectorAll<HTMLButtonElement>('.lchat-quick button').forEach(b => {
      b.onpointerdown = (e) => e.preventDefault(); // giữ ô gõ không mất tiêu điểm
      b.onclick = () => { if (send(b.dataset.q!)) open(false); };
    });
    $('.lchat-btn', hud).onclick = () => open(!!bar.hidden);
    feed.onclick = () => { hist.hidden = false; log.scrollTop = log.scrollHeight; };
    $('.lch-head .x', hist).onclick = () => { hist.hidden = true; };
    this.lobbyChatOpen = open;
  }
  private lobbyChatOpen: ((on: boolean) => void) | null = null;
  private ghostHop: ((dir: 1 | -1) => void) | null = null;

  /** Cập nhật thông tin cho màn hình phòng và bảng Nhân viên của tháng trên tường sảnh */
  private syncLobbyInfo() {
    if (session.lobby.online) { this.refreshOnlineLobby(); return; }
    const p = this.prefs, L = session.lobby, n = 1 + L.bots.length;
    const enabled = SPECIAL_ROLES.filter(r => p.roles[r]).length;
    L.info = { title: 'Phòng offline', people: n, max: n, imps: n <= 6 ? 1 : p.imps, roles: Math.min(enabled, p.maxSpecial), wins: this.stats.wins, played: this.stats.played, streak: this.stats.streak };
  }

  private renderLobbyPeople() {
    const hud = this.lobbyHud; if (!hud) return;
    if (session.lobby.online) { this.refreshOnlineLobby(); return; }
    const L = session.lobby;
    const people = [{ ...L.me, me: true }, ...L.bots.map(b => ({ ...b, me: false }))];
    $('.lc-people', hud).innerHTML = people.map(x => `<li><img src="${avatarURL(x.look!)}" alt=""><span>${esc(x.name)} <small>#${x.empId}</small>${x.me ? ' (bạn)' : ''}</span></li>`).join('');
    $('.lc-faces', hud).innerHTML = people.slice(0, 6).map(x => `<img src="${avatarURL(x.look!)}" alt="">`).join('');
    $('.lc-sum', hud).textContent = `${people.length} người · ${this.prefs.imps} Nội gián`;
    $('#l-id b', hud).textContent = '#' + L.me.empId;
    const tb = hud.querySelector('.lc-test') as HTMLElement | null;
    const tr = this.prefs.testRole;
    if (tb) { tb.hidden = tr === 'random'; tb.textContent = tr === 'random' ? '' : `🧪 Chế độ thử nghiệm: bạn sẽ là ${tr === 'impostor' ? 'Nội gián' : ROLE_INFO[tr].name}`; }
  }

  private lobbyUse() {
    const near = session.lobby.near;
    const info = session.lobby.nearInfo;
    if (session.paused) return;
    if (!near && info && !info.big) {
      // Tương tác nhỏ: ngồi sofa, bấm chuông, vuốt mèo, lấy nước...
      const sc = session.phaser?.scene.getScene('lobby') as unknown as { interact?: (k: string) => void } | undefined;
      sfx.unlock(); sc?.interact?.(info.key);
      return;
    }
    if (!near) return;
    sfx.unlock(); sfx.click();
    if (near === 'wardrobe') this.openWardrobe();
    else if (near === 'board') { if (session.lobby.online) this.openRoomPanel(); else this.openBoard(); }
    else if (near === 'elevator') { if (session.lobby.online) this.startOnlineFromLobby(); else this.startFromLobby(); }
  }

  /** Bắt đầu ca từ sảnh: cảnh mọi người vào thang máy đi lên văn phòng */
  private startFromLobby() {
    const sc = session.phaser?.scene.getScene('lobby') as unknown as { playElevator?: (done: () => void) => void } | undefined;
    if (!sc?.playElevator || !this.lobbyHud) { this.startGame(); return; }
    this.lobbyHud.classList.add('cutscene');
    sc.playElevator(() => this.startGame());
  }

  /** Máy thay đồ: chỉnh ngoại hình (và tên) */
  /** Luật chơi: mở được từ màn hình chính, menu sảnh và menu trong ca (chơi offline thì tạm dừng ván) */
  private openRules() {
    const wasPaused = session.paused;
    session.paused = true;
    const m = this.infoModal('Luật chơi', howtoHtml(), () => { session.paused = wasPaused; });
    m.querySelector('.sheet')!.classList.add('rules-sheet');
  }

  private bindMusicButton(btn: HTMLElement) {
    const label = () => { btn.textContent = this.prefs.music ? '🎵 Nhạc nền: Bật' : '🎵 Nhạc nền: Tắt'; };
    label();
    btn.onclick = () => { this.prefs.music = !this.prefs.music; savePrefs(this.prefs); sfx.setMusic(this.prefs.music); label(); };
  }

  /** Cập nhật chữ phím trên các nút theo cài đặt hiện tại */
  private renderKeyHints() {
    this.root.querySelectorAll<HTMLElement>('kbd[data-k]').forEach(k => { k.textContent = keyLabel(this.prefs.keys[k.dataset.k as KeyAction]); });
  }

  private capturing: KeyAction | null = null;
  /** Bảng điều khiển: máy tính đổi được phím, điện thoại chỉ xem hướng dẫn */
  private openControls() {
    const wasPaused = session.paused;
    const touch = isTouch();
    const p = this.prefs;
    const rows = () => (Object.keys(KEY_NAMES) as KeyAction[]).map(a => `<div class="kb-row"><span>${KEY_NAMES[a]}</span>
      <button type="button" class="kb-key${this.capturing === a ? ' wait' : ''}" data-a="${a}" ${touch ? 'disabled' : ''}>${this.capturing === a ? 'Nhấn phím mới…' : keyLabel(p.keys[a])}</button></div>`).join('');
    const html = touch
      ? `<div class="kb-mobile"><div class="kb-phone"><div class="kb-joy">Cần điều khiển</div><div class="kb-btns"><i>Làm việc</i><i>Báo cáo</i><i>Sơ đồ</i></div></div>
          <p><b>Bạn đang chơi trên điện thoại:</b> kéo cần điều khiển ở góc trái để di chuyển, chạm các nút tròn ở góc phải để làm việc, báo cáo, gài bẫy... Trên điện thoại không cần và không đổi được phím.</p>
          <p class="ae-note">Chơi trên máy tính thì vào đây để đổi phím theo ý thích.</p></div>`
      : `<p class="kb-tip">Bấm vào ô phím rồi nhấn phím mới. Phím mũi tên luôn dùng được để di chuyển. Nhấn Esc để hủy.</p><div class="kb-list">${rows()}</div>
         <div class="row kb-foot"><button type="button" class="ghost-btn kb-reset">Khôi phục mặc định</button></div>`;
    session.paused = true;
    const m = this.infoModal('Điều khiển', html, () => { this.capturing = null; session.paused = wasPaused; this.renderKeyHints(); });
    m.querySelector('.sheet')!.classList.add('kb-sheet');
    if (touch) return;
    const refresh = () => { (m.querySelector('.kb-list') as HTMLElement).innerHTML = rows(); bind(); };
    const bind = () => m.querySelectorAll<HTMLButtonElement>('.kb-key').forEach(b => b.onclick = () => { this.capturing = b.dataset.a as KeyAction; sfx.click(); refresh(); });
    bind();
    (m.querySelector('.kb-reset') as HTMLElement).onclick = () => { p.keys = { ...DEFAULT_KEYS }; savePrefs(p); this.capturing = null; sfx.whoosh(); refresh(); };
    const onKey = (e: KeyboardEvent) => {
      if (!this.capturing) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const k = e.key.toLowerCase();
      if (k === 'escape') { this.capturing = null; refresh(); return; }
      if (k.startsWith('arrow')) { this.capturing = null; refresh(); this.toast('Phím mũi tên đã dành cho di chuyển'); return; }
      // Trùng phím với hành động khác: đổi chỗ cho nhau
      const other = (Object.keys(p.keys) as KeyAction[]).find(a => a !== this.capturing && p.keys[a] === k);
      if (other) p.keys[other] = p.keys[this.capturing];
      p.keys[this.capturing] = k;
      savePrefs(p); this.capturing = null; sfx.click(); refresh();
    };
    window.addEventListener('keydown', onKey, true);
    const obs = new MutationObserver(() => { if (!m.isConnected) { window.removeEventListener('keydown', onKey, true); obs.disconnect(); } });
    obs.observe(this.root, { childList: true });
  }

  /** Máy thay đồ: chỉnh trên bản nháp, chỉ lưu khi bấm "Xong" */
  private openWardrobe() {
    session.paused = true;
    const p = this.prefs;
    const original = JSON.stringify(p.look);
    let draft: Look = JSON.parse(original);
    const m = this.infoModal('Máy thay đồ', `${avatarEditorHtml()}<div class="ae-done-row"><span class="ae-dirty" hidden>Chưa lưu</span><button class="primary big ae-done" type="button">Lưu</button></div>`,
      () => { session.lobby.me = { ...session.lobby.me, look: p.look }; this.renderLobbyPeople(); },
      async () => JSON.stringify(draft) === original || this.confirmBox('Bỏ các thay đổi?', 'Trang phục vừa chỉnh chưa được lưu. Muốn lưu thì bấm "Xong".', 'Bỏ', 'Tiếp tục chỉnh'));
    m.querySelector('.sheet')!.classList.add('wardrobe-sheet');
    mountAvatarEditor(m, () => draft, (look) => {
      draft = look;
      (m.querySelector('.ae-dirty') as HTMLElement).hidden = JSON.stringify(draft) === original;
    }, (t, msg) => this.confirmBox(t, msg, 'Đặt lại', 'Thôi'));
    (m.querySelector('.ae-done') as HTMLElement).onclick = () => {
      p.look = draft; savePrefs(p); session.lobby.me = { ...session.lobby.me, look: draft };
      sfx.taskDone();
      (m as any).__close();
    };
  }

  /** Bảng thông báo: luật của ván (chủ phòng chỉnh) */
  /** Máy tính lễ tân: chỉnh trên bản nháp, bấm "Xác nhận" mới lưu */
  private openBoard() {
    session.paused = true;
    const p = this.prefs;
    const pick = () => ({ bots: p.bots, imps: p.imps, roles: { ...p.roles }, maxSpecial: p.maxSpecial, anonVotes: p.anonVotes, testRole: p.testRole });
    const d = pick();
    const original = JSON.stringify(d);
    const testOpts: { v: Prefs['testRole']; n: string }[] = [
      { v: 'random', n: '🎲 Ngẫu nhiên (bình thường)' }, { v: 'impostor', n: '🐍 Nội gián' },
      ...(['intern', ...SPECIAL_ROLES] as RoleDept[]).map(r => ({ v: r, n: `${ROLE_INFO[r].icon} ${ROLE_INFO[r].name}` })),
    ];
    const m = this.infoModal('Máy tính lễ tân · Cài đặt phòng', `
      <div class="field"><span>Số đồng nghiệp (bot): <b id="bots-v">${d.bots}</b></span>
        <input type="range" id="f-bots" min="4" max="9" value="${d.bots}"></div>
      <div class="field"><span>Số Nội gián</span>
        <div class="seg" id="f-imps"><button data-v="1">1</button><button data-v="2">2</button></div>
        <p class="rt-note" id="imp-hint"></p></div>
      <div class="field"><span>Vai có kỹ năng được bốc trong ván</span>
        <div class="role-toggles roles7">${SPECIAL_ROLES.map(r => `<label class="rt"><input type="checkbox" data-r="${r}" ${d.roles[r] ? 'checked' : ''}><b>${ROLE_INFO[r].icon} ${ROLE_INFO[r].name}</b><small>${ROLE_INFO[r].short}</small></label>`).join('')}</div></div>
      <div class="field"><span>Số vai có kỹ năng tối đa mỗi ván: <b id="max-v">${d.maxSpecial}</b></span>
        <input type="range" id="f-max" min="0" max="15" value="${d.maxSpecial}">
        <p class="rt-note">Mỗi ván hệ thống bốc ngẫu nhiên tối đa chừng này vai trong các vai đang bật. Những người còn lại là Thực tập sinh. Ai được vai gì chỉ người đó biết, còn danh sách vai có trong ván thì công khai.</p></div>
      <div class="field"><span>Hiển thị phiếu bầu</span>
        <div class="seg" id="f-anon"><button data-v="0">Công khai ai vote ai</button><button data-v="1">Ẩn danh</button></div></div>
      <div class="field test-field"><span>🧪 Chế độ thử nghiệm: vai của tôi</span>
        <select id="f-test">${testOpts.map(o => `<option value="${o.v}" ${d.testRole === o.v ? 'selected' : ''}>${o.n}</option>`).join('')}</select>
        <p class="rt-note">Dùng để test game: chọn trước vai của bạn ở ván tới. Ván thử nghiệm không tính vào thành tích.</p></div>
      <div class="board-foot"><span class="ae-dirty" hidden>Chưa lưu</span><button class="primary big" id="board-ok" type="button">Xác nhận</button></div>`,
      undefined,
      async () => JSON.stringify(d) === original || this.confirmBox('Bỏ các thay đổi?', 'Cài đặt phòng vừa chỉnh chưa được lưu. Muốn lưu thì bấm "Xác nhận".', 'Bỏ', 'Tiếp tục chỉnh'));
    m.querySelector('.sheet')!.classList.add('board-sheet');
    const dirty = () => { (m.querySelector('.ae-dirty') as HTMLElement).hidden = JSON.stringify(d) === original; };
    const seg = (id: string, val: string, cb: (v: string) => void) => {
      const box = $('#' + id, m);
      const set = (v: string) => box.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
      set(val);
      box.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.onclick = () => { set(b.dataset.v!); cb(b.dataset.v!); dirty(); });
    };
    const impHint = () => {
      const players = d.bots + 1;
      const t = $('#imp-hint', m);
      const two = $('#f-imps', m).querySelector('button[data-v="2"]') as HTMLButtonElement;
      two.disabled = players <= 6;
      if (players <= 6 && d.imps === 2) { d.imps = 1; $('#f-imps', m).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === '1')); }
      if (players <= 6) t.textContent = 'Ván 6 người trở xuống chỉ có 1 Nội gián (như Among Us). Hồi chiêu gài bẫy tự chỉnh theo số người.';
      else if (d.imps === 1 && players >= 9) t.textContent = `Ván ${players} người với 1 Nội gián hơi dễ cho Nhân viên. Muốn kịch tính hơn thì chọn 2 Nội gián.`;
      else t.textContent = 'Hồi chiêu gài bẫy tự chỉnh theo số người và số Nội gián để hai phe cân bằng.';
    };
    seg('f-imps', String(d.imps), v => { d.imps = Number(v); impHint(); });
    seg('f-anon', d.anonVotes ? '1' : '0', v => d.anonVotes = v === '1');
    const range = $('#f-bots', m) as HTMLInputElement;
    range.oninput = () => { d.bots = Number(range.value); $('#bots-v', m).textContent = range.value; impHint(); dirty(); };
    m.querySelectorAll<HTMLInputElement>('.role-toggles input').forEach(inp => inp.onchange = () => { d.roles = { ...d.roles, [inp.dataset.r!]: inp.checked }; dirty(); });
    const maxR = $('#f-max', m) as HTMLInputElement;
    maxR.oninput = () => { d.maxSpecial = Number(maxR.value); $('#max-v', m).textContent = maxR.value; dirty(); };
    ($('#f-test', m) as HTMLSelectElement).onchange = (e) => { d.testRole = (e.target as HTMLSelectElement).value as Prefs['testRole']; dirty(); };
    impHint();
    $('#board-ok', m).onclick = () => {
      Object.assign(p, d); savePrefs(p);
      this.syncLobbyBots(); this.renderLobbyPeople();
      sfx.taskDone();
      (m as any).__close();
    };
  }

  startGame() {
    if (net.role === 'host') { this.startNetGame(); return; }
    const p = this.prefs;
    const w = new World({ playerName: session.lobby.me.name || p.name, playerLook: p.look, roles: p.roles, maxSpecial: p.maxSpecial,
      playerRole: p.testRole === 'random' ? 'random' : p.testRole === 'impostor' ? 'impostor' : 'crew',
      playerDept: p.testRole !== 'random' && p.testRole !== 'impostor' ? p.testRole : undefined, bots: p.bots, impostors: p.imps, botProfiles: session.lobby.bots, playerEmpId: session.lobby.me.empId });
    session.world = w;
    this.enterGameUi();
  }


  // ================= CHƠI NHIỀU NGƯỜI =================
  private titleProfileOk: () => boolean = () => false;
  /** trạng thái đường P2P (null: không dùng / chưa bật) */
  private p2pStatus: P2PStatus | null = null;
  private p2pText(): string {
    const host = !!net.host;
    switch (this.p2pStatus) {
      case 'ready': return host ? '🌐 Bạn bè ở máy khác vào được bằng mã hoặc link mời' : '🌐 Đã kết nối qua mạng';
      case 'connecting': return host ? '🌐 Đang mở cổng cho máy khác vào…' : '🌐 Đang kết nối tới chủ phòng qua mạng…';
      case 'notfound': return '🌐 Chưa thấy chủ phòng, đang thử lại…';
      case 'offline': return host ? '⚠️ Không kết nối được máy giới thiệu: chỉ chơi được các tab trong trình duyệt này' : '⚠️ Không kết nối được máy giới thiệu, kiểm tra mạng của bạn';
      default: return '';
    }
  }
  private inviteUsed = false;
  private mtStarted = false;

  /** Lệnh từ thanh công cụ của màn chia ô (?multitest) */
  mtCommand(cmd: string, arg?: number, extra?: { name?: string; role?: string }) {
    if (cmd === 'role' && extra?.name) { if (!extra.role) this.forcedRoles.delete(extra.name); else this.forcedRoles.set(extra.name, extra.role); return; }
    const w = session.world;
    if (cmd === 'start' && net.host && !net.host.inGame) {
      // chờ đủ các ô vào phòng (tối đa 6 giây) rồi mới bắt đầu, để không ô nào vào muộn bị từ chối
      const want = arg ?? 0, t0 = performance.now();
      const tryStart = () => { const h = net.host; if (!h || h.inGame) return; if (h.players.length >= want || performance.now() - t0 > 6000) this.startNetGame(); else window.setTimeout(tryStart, 250); };
      tryStart();
    }
    if (cmd === 'again' && net.host && w?.phase === 'ended') this.startNetGame();
    if (cmd === 'ready') { const go = this.root.querySelector('.reveal #go') as HTMLButtonElement | null; if (go && !go.classList.contains('is-ready')) go.click(); }
    if (cmd === 'meeting' && net.host && w && w.phase === 'play') { const a = w.agents.find(x => x.alive && !x.human) ?? w.player; w.emergencyCd = 0; w.callEmergency(a, 'bell'); }
    if (cmd === 'imp' && typeof arg === 'number') this.forcedImpSeat = arg;
  }
  private roomEl: HTMLElement | null = null;
  /** Màn chia ô ?multitest: ép một ghế người thật làm Nội gián ở ván tới (-1: không ép) */
  forcedImpSeat = -1;
  /** Màn chia ô ?multitest: giao vai cho từng người (theo tên "Người N") ở ván tới */
  forcedRoles = new Map<string, string>();
  /** Giao vai cho một nhân vật: đổi vai với người đang giữ vai đó (nếu có) để số Nội gián và các vai khác không đổi */
  private assignRole(w: World, a: Agent, role: string) {
    const swap = (x: Agent, y: Agent) => { [x.role, y.role] = [y.role, x.role]; [x.dept, y.dept] = [y.dept, x.dept]; [x.tasks, y.tasks] = [y.tasks, x.tasks]; [x.killCd, y.killCd] = [y.killCd, x.killCd]; };
    if (role === 'impostor') { if (a.role !== 'impostor') { const b = w.agents.find(o => o.role === 'impostor' && !this.forcedRoles.has(o.name)); if (b) swap(a, b); } return; }
    if (a.role === 'impostor') { const b = w.agents.find(o => o.role === 'crew' && !this.forcedRoles.has(o.name)); if (b) swap(a, b); }
    const holder = w.agents.find(o => o !== a && o.role === 'crew' && o.dept === role);
    if (holder) { [a.dept, holder.dept] = [holder.dept, a.dept]; return; }
    const old = a.dept;
    a.dept = role as Agent['dept'];
    w.roleList = w.roleList.filter(r => r !== old);
    if (role !== 'intern' && !w.roleList.includes(role as never)) w.roleList.push(role as never);
  }

  /** Phiếu ẩn danh: chơi nhiều người thì theo cài đặt phòng, chơi một mình thì theo cài đặt riêng */
  private anonVotesOn() { const st = net.host?.settings ?? net.client?.room?.settings; return net.role !== 'solo' && st ? !!st.anonVotes : this.prefs.anonVotes; }
  private myProfile(): Profile {
    return { name: this.sessName || this.prefs.name || 'Bạn', look: this.prefs.look, empId: this.sessId || String(100 + Math.floor(Math.random() * 900)) };
  }

  /** Menu Chơi nhiều người: tạo phòng mới hoặc vào bằng mã */
  /** Chơi nhiều người: Tạo phòng mới / Phòng Public (danh sách) / Phòng Private (nhập mã). prefill: mã từ link mời */
  openOnlineMenu(prefill = '') {
    const me = this.myProfile();
    const m = this.infoModal('Chơi nhiều người', '<div class="online-menu"></div>');
    const box = m.querySelector('.online-menu') as HTMLElement;
    let refresh = 0;
    const stopRefresh = () => { window.clearInterval(refresh); refresh = 0; };
    new MutationObserver((_r, o) => { if (!m.isConnected) { stopRefresh(); o.disconnect(); } }).observe(document.body, { childList: true, subtree: true });
    const back = '<button type="button" class="ghost-btn om-back" aria-label="Quay lại">← Quay lại</button>';
    const view = (k: 'menu' | 'create' | 'public' | 'private') => {
      stopRefresh();
      if (k === 'menu') {
        box.innerHTML = `
          <button class="primary big" type="button" id="on-new">➕ Tạo phòng mới<small>Vào sảnh chung, bạn là chủ phòng</small></button>
          <button class="ghost-btn big" type="button" id="on-public">🌐 Phòng Public<small>Chọn từ danh sách phòng đang mở</small></button>
          <button class="ghost-btn big" type="button" id="on-private">🔒 Phòng Private<small>Nhập mã phòng bạn bè gửi</small></button>
          <p class="small">Thử nhiều người một mình: mở trang với <b>?multitest=4</b> ở cuối địa chỉ.</p>`;
        (box.querySelector('#on-new') as HTMLButtonElement).onclick = () => view('create');
        (box.querySelector('#on-public') as HTMLButtonElement).onclick = () => view('public');
        (box.querySelector('#on-private') as HTMLButtonElement).onclick = () => view('private');
      } else if (k === 'create') {
        box.innerHTML = `${back}
          <label class="om-field">Tên phòng<input id="on-name" maxlength="24" value="${esc(`Phòng của ${me.name}`)}" autocomplete="off"></label>
          <label class="om-switch"><span><b>Phòng Public</b><small id="on-pubnote">Hiện trong danh sách Phòng Public</small></span><input type="checkbox" id="on-pub" checked><i aria-hidden="true"></i></label>
          <button class="primary big" type="button" id="on-create">Tạo phòng<small>Mã phòng có ngay khi vào sảnh</small></button>`;
        const pub = box.querySelector('#on-pub') as HTMLInputElement;
        pub.onchange = () => { ($('#on-pubnote', box)).textContent = pub.checked ? 'Hiện trong danh sách Phòng Public' : 'Chỉ vào được bằng mã phòng hoặc link mời'; };
        (box.querySelector('#on-create') as HTMLButtonElement).onclick = () => {
          const name = cleanRoomName(($('#on-name', box) as HTMLInputElement).value, `Phòng của ${me.name}`);
          m.remove(); this.createRoom(undefined, { name, pub: pub.checked });
        };
      } else if (k === 'public') {
        box.innerHTML = `${back}<div class="om-bar"><span id="om-count">Đang tìm phòng…</span><button type="button" class="ghost-btn" id="om-refresh">⟳ Làm mới</button></div><div class="om-list"></div>`;
        const list = box.querySelector('.om-list') as HTMLElement;
        const load = () => {
          void fetchRooms({ p2p: USE_P2P ? Peer as unknown as PeerCtor : null }).then(rooms => {
            if (!list.isConnected) return;
            ($('#om-count', box)).textContent = rooms.length ? `${rooms.length} phòng · tự làm mới mỗi 5 giây` : 'Tự làm mới mỗi 5 giây';
            list.innerHTML = rooms.length ? rooms.map((r: RoomEntry) => {
              const full = r.players >= r.max, play = r.status === 'play';
              return `<div class="om-room"><div><b>${esc(r.name)}<span class="om-tag ${play ? 'play' : 'wait'}">${play ? 'Đang chơi' : 'Đang chờ'}</span></b><small>Chủ phòng: ${esc(r.host)} · ${r.players}/${r.max} người</small></div>
                <button type="button" class="${play || full ? 'ghost-btn' : 'primary'}" data-code="${esc(r.code)}" ${play || full ? 'disabled' : ''}>${play ? 'Đang chơi' : full ? 'Đủ người' : 'Vào'}</button></div>`;
            }).join('') : `<div class="om-empty"><p>Chưa có phòng công khai nào.</p><button type="button" class="primary" id="om-new">➕ Tạo phòng mới</button></div>`;
            list.querySelectorAll<HTMLButtonElement>('[data-code]').forEach(btn => btn.onclick = () => { m.remove(); this.joinRoom(btn.dataset.code!); });
            const nb = list.querySelector('#om-new') as HTMLButtonElement | null; if (nb) nb.onclick = () => view('create');
          });
        };
        load(); refresh = window.setInterval(load, 5000);
        (box.querySelector('#om-refresh') as HTMLButtonElement).onclick = () => { sfx.click(); load(); };
      } else {
        box.innerHTML = `${back}<p>Nhập mã phòng bạn bè gửi cho bạn</p>
          <div class="on-join"><input id="on-code" maxlength="8" placeholder="Ví dụ KPI-482" value="${esc(prefill)}" autocomplete="off"><button class="primary" type="button" id="on-go">Vào phòng</button></div>
          <p class="on-err" hidden></p><p class="small">Hoặc mở thẳng link mời bạn bè gửi, không cần nhập mã.</p>`;
        const code = box.querySelector('#on-code') as HTMLInputElement;
        const join = () => {
          const c = normalizeCode(code.value);
          if (!/^[A-Z]{3}-[0-9]{3}$/.test(c)) { const e = box.querySelector('.on-err') as HTMLElement; e.hidden = false; e.textContent = 'Mã phòng gồm 3 chữ và 3 số, ví dụ KPI-482.'; code.focus(); return; }
          m.remove(); this.joinRoom(c);
        };
        (box.querySelector('#on-go') as HTMLButtonElement).onclick = join;
        code.onkeydown = (e) => { if (e.key === 'Enter') join(); };
        if (!prefill) code.focus();
      }
      const bk = box.querySelector('.om-back') as HTMLButtonElement | null; if (bk) bk.onclick = () => view('menu');
    };
    view(prefill ? 'private' : 'menu');
  }

  /** Rời phòng hiện tại (chủ phòng: đóng phòng) */
  leaveNet() {
    this.dirAnn?.stop(); this.dirAnn = null; // gỡ khỏi danh sách Phòng Public
    if (net.host) net.host.close();
    if (net.client) { net.client.leave(); session.world = null; } // bản sao không bao giờ được tự chạy như ván chơi một mình
    net.host = null; net.client = null; net.role = 'solo';
    session.lobby.online = false; session.lobby.remote.clear(); session.lobby.sendState = session.lobby.sendChat = session.lobby.sendFx = null;
    this.onlineLobbyOn = false;
    sessionStorage.removeItem(ROOM_KEY);
    this.rejoinPop(null);
    this.roomEl?.remove(); this.roomEl = null;
    this.netBanner(false);
  }

  /** Báo danh phòng Public cho danh bạ */
  private dirAnn: DirectoryAnnouncer | null = null;
  private createOpts: { name?: string; pub?: boolean } = {};
  createRoom(code = newRoomCode(), opts: { name?: string; pub?: boolean } = this.createOpts) {
    this.createOpts = opts;
    this.leaveNet();
    startPump();
    const tab = new TabTransport(code);
    const multi = new MultiTransport([tab]);
    this.p2pStatus = USE_P2P ? 'connecting' : null;
    if (USE_P2P) {
      const p2p = new PeerTransport(tab.peerId, 'host', code, Peer as unknown as PeerCtor);
      multi.add(p2p);
      p2p.onStatus = (st) => {
        if (st === 'taken' && net.host?.code === code && net.host.players.length === 1) { this.createRoom(newRoomCode(), opts); return; } // mã trùng phòng khác: đổi mã
        this.p2pStatus = st; this.renderRoom();
      };
    }
    const h = new NetHost(multi, code, this.myProfile(), { timers: false });
    net.host = h; net.role = 'host';
    const pr = this.prefs;
    h.settings = { fillBots: true, seats: Math.max(4, Math.min(MAX_PLAYERS, pr.bots + 1)), imps: pr.imps === 2 ? 2 : 1, roles: { ...pr.roles }, maxSpecial: pr.maxSpecial, discussTime: 60, voteTime: 30, anonVotes: pr.anonVotes, killCd: 0, name: '', public: true };
    h.settings.name = cleanRoomName(opts.name ?? '', `Phòng của ${h.me.name}`);
    h.settings.public = opts.pub ?? true;
    // phòng Public: báo danh cho danh sách Phòng Public (đổi tên / Public / người vào ra thì cập nhật ngay)
    this.dirAnn = new DirectoryAnnouncer(() => {
      const x = net.host;
      if (x !== h || !x.settings.public) return null;
      return { code: x.code, name: x.settings.name, host: `${x.me.name} #${x.me.empId}`, players: x.players.length, max: Math.min(MAX_PLAYERS, Math.max(4, x.settings.seats)), status: x.inGame ? 'play' : 'wait' };
    }, { p2p: USE_P2P ? Peer as unknown as PeerCtor : null }).start();
    h.onRoomChange = () => { this.renderRoom(); this.refreshOnlineLobby(); this.dirAnn?.now(); };
    h.onNote = (t) => this.notify(t);
    // chủ phòng tắt tab / tải lại trang: báo cả phòng đóng ngay (không để mọi người chơi tiếp một mình)
    window.addEventListener('pagehide', () => { if (net.host === h) h.close(); }, { once: true });
    net.onError = (m) => this.toast(m);
    this.showRoom();
    h.broadcastRoom();
  }

  /** Vào phòng. peer: mã máy cũ (vào lại để nhận đúng nhân vật cũ) */
  joinRoom(code: string, peer?: string) {
    const resuming = !!peer || sessionStorage.getItem(ROOM_KEY) === code || lastRoom()?.code === code;
    this.leaveNet();
    startPump();
    // nhận lại nhân vật cũ chỉ khi bấm "Vào lại phòng" (peer) hoặc tải lại đúng tab này (mã máy của tab);
    // vào bằng mã / từ danh sách ở tab khác thì là người mới (không chiếm chỗ của tab đang chơi)
    const myPeer = peer ?? stablePeerId();
    sessionStorage.setItem('ngvp-peer' + NET_SUFFIX, myPeer);
    const multi = new MultiTransport([new TabTransport(code, myPeer)]);
    const c = new NetClient(multi, code, this.myProfile(), { timers: false });
    net.client = c; net.role = 'client';
    // kênh nội bộ không thấy chủ phòng trong 1,2 giây (chủ phòng ở máy khác): bật P2P
    this.p2pStatus = null;
    if (USE_P2P) window.setTimeout(() => {
      if (net.client !== c || c.room) return;
      const p2p = new PeerTransport(myPeer, 'client', code, Peer as unknown as PeerCtor);
      multi.add(p2p);
      this.p2pStatus = 'connecting';
      p2p.onStatus = (st) => { this.p2pStatus = st; this.renderRoom(); };
      c.join();
    }, 1200);
    sessionStorage.setItem(ROOM_KEY, code);
    rememberRoom(code, myPeer);
    if (resuming && !MT_SLOT) this.rejoinPop(code);
    c.onNote = (t) => this.notify(t);
    c.onHostLost = (lost) => this.netBanner(lost);
    net.onError = (m) => this.toast(m);
    c.onRoom = () => { rememberRoom(code, myPeer); if (this.roomEl?.classList.contains('room-panel')) this.renderRoom(); if (!c.replica) window.setTimeout(() => { if (!c.replica) this.rejoinPop(null); }, 1200); if (!c.replica) this.showRoom(); }; // đang ở màn kết quả thì chờ chủ phòng bấm Về phòng
    c.onReject = (r) => { forgetRoom(); this.leaveNet(); this.showMainMenu(); this.infoModal('Không vào được phòng', `<p>${esc(r)}</p>`); };
    c.onStart = (rep) => { this.rejoinPop(null); this.startClientGame(rep); };
    c.onEnd = () => this.showRoom();
    c.onClosed = () => { forgetRoom(); this.leaveNet(); closeMini(); this.showMainMenu(); this.infoModal('Phòng đã đóng', '<p>Chủ phòng đã đóng phòng hoặc mất kết nối quá lâu.</p>'); };
    this.showRoom();
    // gõ cửa vài lần (chủ phòng có thể chưa sẵn sàng); không thấy phòng thì báo
    let tries = 0;
    const knock = () => {
      if (net.client !== c || c.room) return;
      if (++tries > 20) {
        const offline = this.p2pStatus === 'offline';
        forgetRoom(); this.leaveNet(); this.showMainMenu();
        if (offline) this.infoModal('Không kết nối được', `<p>Máy của bạn không kết nối được máy giới thiệu để vào phòng <b>${esc(code)}</b> ở máy khác. Kiểm tra mạng (một số mạng công ty chặn kết nối này), rồi thử lại.</p>`);
        else this.infoModal('Không tìm thấy phòng', `<p>Không thấy phòng <b>${esc(code)}</b>. Kiểm tra lại mã, hoặc phòng đã đóng.</p>`);
        return;
      }
      c.join(); window.setTimeout(knock, 700);
    };
    knock();
  }

  /** Màn hình phòng: danh sách người, cài đặt (chủ phòng chỉnh), bắt đầu ván */
  showRoom() {
    closeMini();
    // đã biết phòng: vào sảnh tầng G chung (màn hình danh sách chỉ còn dùng lúc đang tìm phòng)
    if (net.host || net.client?.room) { this.enterOnlineLobby(); return; }
    this.root.querySelectorAll('.overlay, .modal').forEach(e => e.remove());
    if (!this.roomEl || !this.roomEl.isConnected) {
      const el = document.createElement('div');
      el.className = 'room-screen';
      this.root.appendChild(el);
      this.roomEl = el;
    }
    session.paused = true;
    this.renderRoom();
  }

  private renderRoom() {
    const el = this.roomEl;
    if (!el || !el.isConnected) return;
    const host = net.host, cl = net.client;
    const room = host ? { code: host.code, players: host.players, settings: host.settings, inGame: host.inGame } : cl?.room;
    if (!room) { el.innerHTML = `<div class="room-card"><h2>Đang tìm phòng…</h2><p class="small">${esc(cl?.code ?? '')}</p><p class="room-p2p">${esc(this.p2pText())}</p><div class="room-foot"><button class="ghost-btn" id="rm-leave" type="button">Hủy</button></div></div>`; (el.querySelector('#rm-leave') as HTMLButtonElement).onclick = () => { forgetRoom(); this.leaveNet(); this.showMainMenu(); }; return; }
    const me = host ? host.tr.peerId : cl!.tr.peerId;
    const st = room.settings;
    const total = st.fillBots ? Math.max(st.seats, room.players.length) : room.players.length;
    const imps = total <= 6 ? 1 : st.imps;
    const cap = Math.min(MAX_PLAYERS, Math.max(4, st.seats));
    const empty = Math.max(0, total - room.players.length);
    const link = `${location.origin}${location.pathname}?room=${room.code}`;
    const canStart = total >= 4;
    el.innerHTML = `<div class="room-card">
      <div class="room-head"><div><small>PHÒNG</small><h2>${esc(room.code)}</h2></div>
        <div class="room-share"><button type="button" class="ghost-btn" id="rm-code">Sao chép mã</button><button type="button" class="ghost-btn" id="rm-link">Sao chép link mời</button></div></div>
      <ul class="room-players">${room.players.map(p => `<li class="${p.peer === me ? 'me' : ''}${p.lost ? ' lost' : ''}"><img src="${avatarURL(normalizeLook(p.look))}" alt=""><span><b>${esc(p.name)}</b><small>#${esc(p.empId)}</small></span>${p.host ? '<em class="tag host">Chủ phòng</em>' : ''}${p.peer === me ? '<em class="tag you">Bạn</em>' : ''}${p.lost ? '<em class="tag lost">Mất kết nối</em>' : ''}</li>`).join('')}
        ${Array.from({ length: empty }, () => `<li class="seat">${st.fillBots ? '<span class="bot">Bot</span>' : 'Ghế trống'}</li>`).join('')}</ul>
      <div class="room-set">
        <section><h4>Phòng</h4>
          <label class="om-field">Tên phòng<input id="rm-name" maxlength="24" value="${esc(st.name || '')}" ${host ? '' : 'disabled'} autocomplete="off"></label>
          <label class="om-switch"><span><b>Phòng Public</b><small>${st.public ? 'Hiện trong danh sách Phòng Public' : 'Chỉ vào được bằng mã phòng hoặc link mời'}</small></span><input type="checkbox" id="rm-pub" ${st.public ? 'checked' : ''} ${host ? '' : 'disabled'}><i aria-hidden="true"></i></label>
        </section>
        <section><h4>Người chơi</h4>
          <label><input type="checkbox" id="rm-bots" ${st.fillBots ? 'checked' : ''} ${host ? '' : 'disabled'}> Ghế trống có bot chơi cùng</label>
          <label>Số ghế <select id="rm-seats" ${host ? '' : 'disabled'}>${[4, 5, 6, 7, 8, 9, 10].map(n => `<option value="${n}" ${n === st.seats ? 'selected' : ''} ${n < room.players.length ? 'disabled' : ''}>${n}</option>`).join('')}</select></label>
          <label>Nội gián <select id="rm-imps" ${host && total > 6 ? '' : 'disabled'}><option value="1" ${imps === 1 ? 'selected' : ''}>1</option><option value="2" ${imps === 2 ? 'selected' : ''}>2</option></select></label>
          <label>Hồi chiêu gài bẫy <select id="rm-kcd" ${host ? '' : 'disabled'}><option value="0" ${!st.killCd ? 'selected' : ''}>Tự động (${killCooldownFor(total, imps)} giây)</option>${[20, 25, 30, 45, 60].map(n => `<option value="${n}" ${n === st.killCd ? 'selected' : ''}>${n} giây</option>`).join('')}</select></label>
        </section>
        <section><h4>Vai có kỹ năng <small>(tối đa <select id="rm-max" ${host ? '' : 'disabled'}>${[0, 1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${n === st.maxSpecial ? 'selected' : ''}>${n}</option>`).join('')}</select> vai mỗi ván)</small></h4>
          <div class="rm-roles">${SPECIAL_ROLES.map(r => `<button type="button" class="rm-role${st.roles[r] !== false ? ' on' : ''}" data-r="${r}" ${host ? '' : 'disabled'} title="${esc(ROLE_INFO[r].name)}">${ROLE_INFO[r].icon} ${esc(ROLE_INFO[r].name)}</button>`).join('')}</div>
        </section>
        <section><h4>Cuộc họp</h4>
          <label>Thảo luận <select id="rm-disc" ${host ? '' : 'disabled'}>${[30, 45, 60, 90, 120].map(n => `<option value="${n}" ${n === st.discussTime ? 'selected' : ''}>${n} giây</option>`).join('')}</select></label>
          <label>Bỏ phiếu <select id="rm-vote" ${host ? '' : 'disabled'}>${[15, 30, 45, 60].map(n => `<option value="${n}" ${n === st.voteTime ? 'selected' : ''}>${n} giây</option>`).join('')}</select></label>
          <label><input type="checkbox" id="rm-anon" ${st.anonVotes ? 'checked' : ''} ${host ? '' : 'disabled'}> Phiếu ẩn danh</label>
        </section>
        ${host ? '' : '<p class="small rm-ro">Chỉ chủ phòng chỉnh được cài đặt.</p>'}
      </div>
      <p class="room-note">${room.players.length}/${cap} người · ván ${total} người, ${imps} Nội gián${canStart ? '' : ' · cần ít nhất 4 người (bật bot để chơi ngay)'}</p>
      ${this.p2pText() ? `<p class="room-p2p ${this.p2pStatus}">${esc(this.p2pText())}</p>` : ''}
      <p class="room-flash" hidden></p>
      <div class="room-foot"><button class="ghost-btn" id="rm-leave" type="button">Rời phòng</button>
        ${host ? `<button class="primary big" id="rm-start" type="button" ${canStart ? '' : 'disabled'}>Bắt đầu ván</button>` : `<span class="room-wait">Chờ chủ phòng bắt đầu…</span>`}</div>
    </div>`;
    const copy = (txt: string, btn: HTMLElement) => { navigator.clipboard?.writeText(txt).then(() => { btn.textContent = 'Đã sao chép!'; window.setTimeout(() => this.renderRoom(), 1200); }).catch(() => undefined); };
    (el.querySelector('#rm-code') as HTMLButtonElement).onclick = (e) => copy(room.code, e.currentTarget as HTMLElement);
    (el.querySelector('#rm-link') as HTMLButtonElement).onclick = (e) => copy(link, e.currentTarget as HTMLElement);
    (el.querySelector('#rm-leave') as HTMLButtonElement).onclick = () => { forgetRoom(); this.leaveNet(); this.showMainMenu(); };
    if (host) {
      const nm = el.querySelector('#rm-name') as HTMLInputElement;
      nm.onchange = () => { host.settings.name = cleanRoomName(nm.value, `Phòng của ${host.me.name}`); host.broadcastRoom(); };
      (el.querySelector('#rm-pub') as HTMLInputElement).onchange = (e) => { host.settings.public = (e.target as HTMLInputElement).checked; host.broadcastRoom(); };
      (el.querySelector('#rm-bots') as HTMLInputElement).onchange = (e) => { host.settings.fillBots = (e.target as HTMLInputElement).checked; host.broadcastRoom(); };
      (el.querySelector('#rm-seats') as HTMLSelectElement).onchange = (e) => { host.settings.seats = Number((e.target as HTMLSelectElement).value); host.broadcastRoom(); };
      (el.querySelector('#rm-imps') as HTMLSelectElement).onchange = (e) => { host.settings.imps = Number((e.target as HTMLSelectElement).value) === 2 ? 2 : 1; host.broadcastRoom(); };
      (el.querySelector('#rm-kcd') as HTMLSelectElement).onchange = (e) => { host.settings.killCd = Number((e.target as HTMLSelectElement).value); host.broadcastRoom(); };
      (el.querySelector('#rm-max') as HTMLSelectElement).onchange = (e) => { host.settings.maxSpecial = Number((e.target as HTMLSelectElement).value); host.broadcastRoom(); };
      (el.querySelector('#rm-disc') as HTMLSelectElement).onchange = (e) => { host.settings.discussTime = Number((e.target as HTMLSelectElement).value); host.broadcastRoom(); };
      (el.querySelector('#rm-vote') as HTMLSelectElement).onchange = (e) => { host.settings.voteTime = Number((e.target as HTMLSelectElement).value); host.broadcastRoom(); };
      (el.querySelector('#rm-anon') as HTMLInputElement).onchange = (e) => { host.settings.anonVotes = (e.target as HTMLInputElement).checked; host.broadcastRoom(); };
      el.querySelectorAll<HTMLButtonElement>('.rm-role').forEach(b => b.onclick = () => { const r = b.dataset.r!; host.settings.roles = { ...host.settings.roles, [r]: host.settings.roles[r] === false }; host.broadcastRoom(); });
      const sb = el.querySelector('#rm-start') as HTMLButtonElement | null;
      if (sb) sb.onclick = () => this.startNetGame();
    }
  }

  // ---------- Sảnh tầng G chung (online) ----------
  private onlineLobbyOn = false;
  private sentLookKey = '';
  private lobbyScene() { return session.phaser?.scene.getScene('lobby') as unknown as { remoteSay?: (p: string, t: string) => void; remoteFx?: (p: string, k: string) => void; playElevator?: (done: () => void) => void } | undefined; }
  /** Vào (hoặc làm mới) sảnh chung của phòng */
  private enterOnlineLobby() {
    const L = session.lobby, h = net.host, c = net.client;
    if (this.onlineLobbyOn && this.lobbyHud?.isConnected && session.world === null) { this.refreshOnlineLobby(); return; }
    this.roomEl?.remove(); this.roomEl = null;
    L.online = true;
    L.bots = []; L.version++;
    L.remote.clear();
    // trạng thái / chat / nghịch đồ của mình đi lên mạng; của người khác về sảnh
    L.sendState = h ? (st, ms) => { h.setMyLobby(st); h.lobbyTick(ms); } : (st, ms) => c?.sendLobby(st, ms);
    L.sendChat = h ? (t) => h.lobbyChat(t) : (t) => c?.sendLobbyChat(t);
    L.sendFx = h ? (k) => h.lobbyFx(k) : (k) => c?.sendLobbyFx(k);
    const say = (peer: string, t: string) => this.lobbyScene()?.remoteSay?.(peer, t);
    const fx = (peer: string, k: string) => this.lobbyScene()?.remoteFx?.(peer, k);
    if (h) { h.onLobbyChat = say; h.onLobbyFx = fx; }
    if (c) { c.onLobbyChat = say; c.onLobbyFx = fx; c.onLobbyGo = () => this.playOnlineElevator(); }
    this.onlineLobbyOn = true;
    this.enterLobby();
    this.refreshOnlineLobby();
  }
  /** Danh sách người, màn hình phòng trên tường, thẻ góc trái */
  private refreshOnlineLobby() {
    const hud = this.lobbyHud; if (!hud || !session.lobby.online) return;
    const h = net.host, c = net.client;
    const room = h ? { code: h.code, players: h.players, settings: h.settings } : c?.room;
    if (!room) return;
    const me = h ? h.tr.peerId : c!.tr.peerId;
    const st = room.settings, total = st.fillBots ? Math.max(st.seats, room.players.length) : room.players.length, imps = total <= 6 ? 1 : st.imps;
    const cap = Math.min(MAX_PLAYERS, Math.max(4, st.seats));
    session.lobby.info = { ...session.lobby.info, title: `Phòng ${room.code}`, people: room.players.length, max: cap, imps, roles: Math.min(SPECIAL_ROLES.filter(r => this.prefs.roles[r]).length, this.prefs.maxSpecial) };
    const title = $('.lc-title', hud);
    if (title.dataset.code !== room.code) {
      title.dataset.code = room.code;
      title.innerHTML = `Phòng ${esc(room.code)} <button type="button" class="lc-copy" data-what="code" title="Sao chép mã phòng">Sao chép mã</button><button type="button" class="lc-copy" data-what="link" title="Sao chép link vào phòng">Sao chép link</button>`;
      // sao chép mã phòng, hoặc link vào thẳng phòng (?room=MÃ)
      title.querySelectorAll<HTMLButtonElement>('.lc-copy').forEach(cp => cp.onclick = (e) => {
        e.stopPropagation();
        const label = cp.textContent!, txt = cp.dataset.what === 'link' ? `${location.origin}${location.pathname}?room=${room.code}` : room.code;
        navigator.clipboard?.writeText(txt).then(() => { cp.textContent = 'Đã chép!'; cp.classList.add('ok'); window.setTimeout(() => { cp.textContent = label; cp.classList.remove('ok'); }, 1400); }).catch(() => { this.infoModal('Sao chép', `<input class="gs-text" readonly value="${esc(txt)}" style="width:100%">`); });
      });
    }
    ($('.lc-mode', hud)).innerHTML = `${h ? 'Bạn là chủ phòng' : 'Chơi nhiều người'} · ${room.players.length}/${cap} người${st.fillBots ? ` · ${Math.max(0, total - room.players.length)} bot` : ''}${this.p2pText() ? `<br><small class="lc-p2p">${esc(this.p2pText())}</small>` : ''}`;
    $('.lc-people', hud).innerHTML = room.players.map(x => `<li class="${x.lost ? 'lost' : ''}"><img src="${avatarURL(normalizeLook(x.look))}" alt=""><span>${esc(x.name)} <small>#${esc(x.empId)}</small>${x.peer === me ? ' (bạn)' : ''}${x.host ? ' · chủ phòng' : ''}${x.lost ? ' · mất kết nối' : ''}</span></li>`).join('');
    $('.lc-faces', hud).innerHTML = room.players.slice(0, 6).map(x => `<img src="${avatarURL(normalizeLook(x.look))}" alt="">`).join('');
    $('.lc-sum', hud).textContent = `${room.players.length} người · ${imps} Nội gián`;
    // mã số do chủ phòng cấp (không trùng trong phòng): hiện mã, không cho đổi ở sảnh online
    const mine = room.players.find(x => x.peer === me);
    $('#l-id b', hud).textContent = '#' + (mine?.empId ?? '');
    const editI = hud.querySelector('#l-id i') as HTMLElement | null; if (editI) editI.hidden = true;
    ($('#l-id', hud) as HTMLButtonElement).disabled = true;
  }
  /** Mỗi khung hình ở sảnh online: chép danh sách người khác (hồ sơ + trạng thái) cho cảnh vẽ */
  private syncOnlineLobbyFrame() {
    const L = session.lobby; if (!L.online) return;
    const h = net.host, c = net.client;
    const players = h ? h.players : c?.room?.players ?? [];
    const states = h ? h.lobby : c?.lobby ?? new Map();
    const me = h ? h.tr.peerId : c?.tr.peerId;
    const seen = new Set<string>();
    for (const p of players) {
      if (p.peer === me) continue;
      seen.add(p.peer);
      const cur = L.remote.get(p.peer);
      const look = cur && lookKey(cur.look) === lookKey(normalizeLook(p.look)) ? cur.look : normalizeLook(p.look);
      L.remote.set(p.peer, { name: p.name, empId: p.empId, look, lost: !!p.lost, s: states.get(p.peer) ?? null });
    }
    for (const k of [...L.remote.keys()]) if (!seen.has(k)) L.remote.delete(k);
  }
  /** Quầy lễ tân ở sảnh online: bảng cài đặt phòng (chủ phòng chỉnh, người khác xem) */
  private openRoomPanel() {
    const el = document.createElement('div');
    el.className = 'room-screen room-panel';
    this.root.appendChild(el);
    this.roomEl = el;
    this.renderRoom();
    const close = document.createElement('button'); close.className = 'x art room-x'; close.type = 'button'; close.innerHTML = iconSvg('close');
    const shut = () => { el.remove(); if (this.roomEl === el) this.roomEl = null; };
    el.addEventListener('click', (e) => { if (e.target === el) shut(); });
    const attach = () => { const card = el.querySelector('.room-card'); if (card && !card.querySelector('.room-x')) card.prepend(close); };
    attach(); new MutationObserver(attach).observe(el, { childList: true });
    close.onclick = shut;
  }
  /** Chủ phòng bấm vào ca ở thang máy: cả phòng cùng xem cảnh thang máy rồi vào ván */
  private startOnlineFromLobby() {
    const h = net.host;
    if (!h) { this.toast('Chờ chủ phòng bấm vào ca nhé', 2200); return; }
    const total = h.settings.fillBots ? Math.max(h.settings.seats, h.players.length) : h.players.length;
    if (total < 4) { this.toast('Cần ít nhất 4 người (bật bot ở quầy lễ tân để chơi ngay)', 2600); return; }
    h.lobbyGo();
    this.playOnlineElevator();
  }
  private playOnlineElevator() {
    const sc = this.lobbyScene();
    this.roomEl?.remove(); this.roomEl = null;
    if (!sc?.playElevator || !this.lobbyHud) { if (net.host) this.startNetGame(); return; }
    this.lobbyHud.classList.add('cutscene');
    sc.playElevator(() => { if (net.host) this.startNetGame(); /* người vào phòng: chờ lệnh bắt đầu của chủ phòng */ });
  }

  /** Chủ phòng bắt đầu ván: người thật ngồi các ghế đầu, bot điền phần còn lại */
  startNetGame() {
    const h = net.host;
    if (!h) return;
    const humans = h.players;
    const total = h.settings.fillBots ? Math.max(h.settings.seats, humans.length) : humans.length;
    if (total < 4) { this.toast('Cần ít nhất 4 người (bật bot để chơi ngay)'); return; }
    const imps = total <= 6 ? 1 : h.settings.imps;
    const p = this.prefs;
    const remote = humans.filter(x => !x.host);
    const me = humans.find(x => x.host)!;
    const st = h.settings;
    const roles = Object.fromEntries(SPECIAL_ROLES.map(r => [r, st.roles[r] !== false])) as typeof p.roles;
    const w = new World({ playerName: me.name, playerLook: p.look, roles, maxSpecial: st.maxSpecial, discussTime: st.discussTime, voteTime: st.voteTime,
      killCd: st.killCd > 0 ? st.killCd : undefined, // 0: tự động theo cỡ ván
      playerRole: p.testRole === 'random' ? 'random' : p.testRole === 'impostor' ? 'impostor' : 'crew',
      playerDept: p.testRole !== 'random' && p.testRole !== 'impostor' ? p.testRole : undefined,
      bots: total - 1, impostors: imps, botProfiles: remote.map(r => ({ name: r.name, look: normalizeLook(r.look), empId: r.empId })), playerEmpId: me.empId });
    w.anonVotes = !!st.anonVotes; // phiếu ẩn danh: chủ phòng giấu hẳn ai bầu ai trong dữ liệu gửi đi
    const seat = new Map<string, number>([[h.tr.peerId, 0]]);
    remote.forEach((r, i) => { seat.set(r.peer, i + 1); w.setHuman(i + 1, true); });
    // ?multitest: ép một ghế làm Nội gián (đổi vai với một Nội gián khác)
    if (this.forcedImpSeat >= 0 && this.forcedImpSeat < w.agents.length && w.agents[this.forcedImpSeat].role !== 'impostor') {
      const a = w.agents[this.forcedImpSeat], b = w.agents.find(o => o.role === 'impostor' && o.id !== a.id)!;
      [a.role, b.role] = [b.role, a.role]; [a.dept, b.dept] = [b.dept, a.dept]; [a.tasks, b.tasks] = [b.tasks, a.tasks]; [a.killCd, b.killCd] = [b.killCd, a.killCd];
    }
    // ?multitest: giao vai theo yêu cầu (theo tên)
    for (const [name, role] of this.forcedRoles) { const a = w.agents.find(o => o.name === name); if (a) this.assignRole(w, a, role); }
    this.roomEl?.remove(); this.roomEl = null;
    session.world = w;
    h.startGame(w, seat);
    this.enterGameUi();
  }

  /** Người vào phòng: nhận ván từ chủ phòng */
  startClientGame(rep: World) {
    this.roomEl?.remove(); this.roomEl = null;
    session.world = rep;
    this.enterGameUi();
  }

  /** Thông báo của phòng: trong ván hiện như thông báo nổi, ở màn hình phòng hiện dưới danh sách */
  private notify(text: string) {
    if (this.hudEl?.isConnected && !this.roomEl && session.world) { this.toast(text, 3200); return; }
    if (this.lobbyHud?.isConnected && !this.roomEl) {
      const n = document.createElement('div'); n.className = 'lobby-note'; n.textContent = text; this.lobbyHud.appendChild(n);
      window.setTimeout(() => n.remove(), 4000); return;
    }
    const f = this.roomEl?.querySelector('.room-flash') as HTMLElement | null;
    if (f) { f.hidden = false; f.textContent = text; window.setTimeout(() => { if (f.textContent === text) f.hidden = true; }, 4000); }
  }
  /** Người vào phòng: popup mất kết nối với chủ phòng, đếm ngược tới lúc coi như phòng đóng */
  private netBanner(on: boolean) {
    let b = document.querySelector('.net-pop') as HTMLElement | null;
    if (!on) { b?.remove(); return; }
    if (b) return;
    b = document.createElement('div'); b.className = 'net-pop';
    b.innerHTML = `<div class="np-card"><i class="np-spin"></i><h3>Mất kết nối với chủ phòng</h3><p>Đang chờ kết nối lại… <b class="np-left">10</b> giây</p><button type="button" class="ghost-btn">Về màn hình chính</button></div>`;
    document.body.appendChild(b);
    (b.querySelector('button') as HTMLButtonElement).onclick = () => { this.leaveNet(); closeMini(); this.showMainMenu(); };
    const t0 = performance.now(), el = b;
    const tick = () => { if (!el.isConnected) return; const left = Math.max(0, Math.ceil((HOST_GONE_MS - HOST_LOST_MS - (performance.now() - t0)) / 1000)); (el.querySelector('.np-left') as HTMLElement).textContent = String(left); window.setTimeout(tick, 250); };
    tick();
  }
  /** Popup "Đang vào lại phòng làm việc…" (tải lại trang, mở lại link, bấm Vào lại phòng) */
  private rejoinPop(code: string | null) {
    document.querySelector('.rejoin-pop')?.remove();
    if (!code) return;
    const b = document.createElement('div'); b.className = 'net-pop rejoin-pop';
    b.innerHTML = `<div class="np-card"><i class="np-spin"></i><h3>Đang vào lại phòng làm việc</h3><p>Phòng <b>${esc(code)}</b> · đang kết nối với chủ phòng…</p></div>`;
    document.body.appendChild(b);
  }

  /** Phần giao diện chung khi vào ván (một mình, chủ phòng, người vào phòng) */
  private enterGameUi() {
    this.doneSeen = new Set(); this.lastFloorBanner = -1; this.lastDeptTxt = ''; this.lastRoomTitle = '';
    this.lobbyHud = null;
    this.spawnPickerOpen = false;
    this.root.innerHTML = '';
    closeMini();
    this.switchScene('game');
    sfx.stopMusic();
    session.newGameId++;
    session.paused = true;
    // thống kê chỉ ghi ở chế độ admin (người chơi thường không có, cũng không ghi ngầm)
    session.gameStats = !ADMIN || net.role === 'client' || !session.world ? null : new GameStats(session.world, session.world.player.id);
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
        <div class="my-dept"></div>
        <div class="kpi"><span>KPI phòng ban</span><div class="kpi-bar"><i></i></div><button class="t-toggle" type="button" aria-label="Thu gọn danh sách việc">▾</button></div>
        <ul class="task-list"></ul>
      </div>
      <div class="top-right">
        ${net.role !== 'solo' ? `<button class="room-chip" id="b-room" type="button" title="Bấm để sao chép link mời / vào lại phòng">Phòng <b>${esc(net.host?.code ?? net.client?.code ?? '')}</b></button>` : ''}
        <button class="icon-btn art" id="b-menu" aria-label="Menu" aria-expanded="false">${iconSvg('menu')}</button>
      </div>
      <div class="menu-pop card-lite" hidden>
        <button class="menu-item" id="b-mute"></button>
        <button class="menu-item" id="b-music"></button>
        <button class="menu-item" id="b-keys">🎮 Điều khiển</button>
        <button class="menu-item" id="b-rules">📖 Luật chơi</button>
        <button class="menu-item danger" id="b-quit">🚪 Rời ca, về sảnh tầng G</button>
      </div>
      <button class="map-btn" id="b-map" aria-label="Mở sơ đồ (phím Tab)"><span class="ic">${iconSvg('map')}</span><span class="lb">SƠ ĐỒ</span><kbd data-k="map">Tab</kbd><i class="alarm-dot"></i></button>
      <div class="sab-banner" hidden></div>
      <div class="room-name"></div>
      <div class="toast" hidden></div>
      <div class="actions">
        <button class="act" id="a-laptop" hidden><span class="ic"></span><i class="sweep"></i><em class="cd"></em><span class="lb"></span><kbd data-k="laptop"></kbd><b class="done-badge">✓</b></button>
        <button class="act" id="a-sab" hidden><span class="ic"></span><i class="sweep"></i><em class="cd"></em><span class="lb"></span><kbd data-k="sab"></kbd><b class="done-badge">✓</b></button>
        <button class="act" id="a-hide" hidden><span class="ic"></span><i class="sweep"></i><em class="cd"></em><span class="lb"></span><kbd data-k="hide"></kbd><b class="done-badge">✓</b></button>
        <button class="act" id="a-kill" hidden><span class="ic"></span><i class="sweep"></i><em class="cd"></em><span class="lb"></span><kbd data-k="kill"></kbd><b class="done-badge">✓</b></button>
        <button class="act" id="a-report" hidden><span class="ic"></span><i class="sweep"></i><em class="cd"></em><span class="lb"></span><kbd data-k="report"></kbd><b class="done-badge">✓</b></button>
        <button class="act" id="a-gup" hidden><span class="ic"></span><i class="sweep"></i><em class="cd"></em><span class="lb"></span><kbd>PgUp</kbd><b class="done-badge">✓</b></button>
        <button class="act" id="a-gdown" hidden><span class="ic"></span><i class="sweep"></i><em class="cd"></em><span class="lb"></span><kbd>PgDn</kbd><b class="done-badge">✓</b></button>
        <button class="act" id="a-use"><span class="ic"></span><i class="sweep"></i><em class="cd"></em><span class="lb"></span><kbd data-k="use"></kbd><b class="done-badge">✓</b></button>
      </div>
      <div class="hide-ctrl" hidden>
        <button class="vent-arrow" id="h-next" aria-label="Chuồn sang chỗ trốn bên kia"><span class="va-ic">➜</span><span class="va-lb"></span><kbd data-k="use">E</kbd></button>
        <div class="hide-name"></div>
        <button class="vent-exit" id="h-exit">Ra ngoài<kbd data-k="hide">Space</kbd></button>
      </div>
      <div class="joy" aria-hidden="true"><div class="joy-knob"></div></div>
      <div class="sab-menu" hidden></div>
      <div class="cam-wrap" hidden>
        <div class="cam-top"><b class="cam-title">Camera an ninh</b><span class="cam-ch"></span><button class="cam-exit" id="cam-close">Thoát ✕</button></div>
        <div class="cam-screen"><canvas width="1280" height="720"></canvas><div class="cam-label"></div></div>
        <div class="cam-bottom"><button class="cam-nav" id="cam-prev" aria-label="Kênh trước">◀</button><div class="cam-dots"></div><button class="cam-nav" id="cam-next" aria-label="Kênh sau">▶</button></div>
        <div class="roster"></div>
      </div>
      <div class="minimap-wrap" hidden><div class="minimap card-lite"><div class="mm-head"><b>Sơ đồ tòa nhà</b><div class="mm-tabs" hidden><button data-m="map">🗺️ Sơ đồ</button><button data-m="sab">⚡ Phá hoại</button></div><button class="x art" id="mm-close" aria-label="Đóng">${iconSvg('close')}</button></div><div class="mm-floors" role="tablist"></div><div class="mm-canvas"><canvas width="1320" height="764"></canvas><div class="mm-sab"></div></div>
        <div class="mm-legend">
          <span><i class="lg pin">!</i>Việc của bạn</span><span><i class="lg you"></i>Bạn</span><span><i class="lg desk"></i>Bàn của bạn</span>
          <span><i class="lgi">${iconSvg('breaker')}</i>Tủ cầu dao</span><span><i class="lgi">${iconSvg('router')}</i>Router</span><span><i class="lgi">${iconSvg('camera')}</i>Xem camera</span>
          <span><i class="lgi">${iconSvg('bell')}</i>Chuông họp</span><span><i class="lgi">${iconSvg('lock')}</i>Cửa đang khóa</span><span><i class="lgi">${iconSvg('lift')}</i>Thang máy</span><span><i class="lgi">${iconSvg('stairs')}</i>Thang bộ</span><span class="lg-hr" hidden><i class="lgi">${iconSvg('idcard')}</i>Máy Face ID</span>
        </div><p class="mm-note"></p></div></div>
      <div class="fake-work" hidden><div>Đang giả vờ làm việc…</div><div class="bar"><i></i></div></div>`;
    this.root.appendChild(hud);
    this.hudEl = hud;
    this.lastHud = '';
    // Xóa sạch trạng thái của ván trước (trước đây sót lại làm nhân vật bị khóa di chuyển)
    this.camsOpen = false; this.mapOpen = false; this.sabMenuOpen = false;
    this.laptopT = 0; this.fakeT = 0; this.cutsceneActive = false; this.hrReadyToasted = false;
    $('#b-map', hud).onclick = () => this.toggleMap(undefined, 'map');
    $('#mm-close', hud).onclick = () => this.toggleMap(false);
    hud.querySelectorAll<HTMLButtonElement>('.mm-tabs button').forEach(b => b.onclick = () => this.toggleMap(true, b.dataset.m as 'map' | 'sab'));
    this.buildSabotageMap(hud);

    $('#cam-close', hud).onclick = () => this.toggleCams(false);
    $('#cam-prev', hud).onclick = () => this.camChannel(-1);
    $('#cam-next', hud).onclick = () => this.camChannel(1);
    $('.cam-dots', hud).innerHTML = CAMERAS.map((_, i) => `<i data-i="${i}"></i>`).join('');
    const muteLabel = () => { $('#b-mute', hud).textContent = this.prefs.muted ? '🔇 Âm thanh: Tắt' : '🔊 Âm thanh: Bật'; };
    muteLabel();
    $('#b-mute', hud).onclick = () => {
      this.prefs.muted = !this.prefs.muted; savePrefs(this.prefs); sfx.setMuted(this.prefs.muted); muteLabel();
    };
    $('#b-menu', hud).onclick = () => this.toggleMenu();
    const chip = hud.querySelector('#b-room') as HTMLButtonElement | null;
    if (chip) chip.onclick = () => {
      const code = net.host?.code ?? net.client?.code ?? '';
      navigator.clipboard?.writeText(`${location.origin}${location.pathname}?room=${code}`).then(() => this.toast(`Đã sao chép link phòng ${code}`, 1800)).catch(() => this.toast(`Mã phòng: ${code}`, 2500));
    };
    // Hồn ma đổi tầng
    const ghostHop = (dir: 1 | -1) => { const w = session.world; if (!w) return; const err = act('ghostFloor', dir); if (err) this.toast(err); else sfx.whoosh(); };
    $('#a-gup', hud).onclick = () => ghostHop(1);
    $('#a-gdown', hud).onclick = () => ghostHop(-1);
    this.ghostHop = ghostHop;
    // Thu gọn bảng việc (nhất là trên điện thoại)
    const tasksBox = $('.tasks', hud);
    const collapsed = localStorage.getItem('noi-gian:tasks-collapsed');
    if (collapsed === '1' || (collapsed === null && window.innerWidth < 760)) tasksBox.classList.add('collapsed');
    $('.t-toggle', hud).onclick = () => {
      const c = tasksBox.classList.toggle('collapsed');
      try { localStorage.setItem('noi-gian:tasks-collapsed', c ? '1' : '0'); } catch { /* bỏ qua */ }
      sfx.click();
    };
    $('#b-keys', hud).onclick = () => { this.toggleMenu(false); this.openControls(); };
    $('#b-rules', hud).onclick = () => { this.toggleMenu(false); this.openRules(); };
    this.bindMusicButton($('#b-music', hud));
    this.renderKeyHints();
    $('#b-quit', hud).onclick = async () => {
      this.toggleMenu(false);
      const msg = net.role === 'host' ? 'Bạn là chủ phòng: rời ca sẽ đóng phòng, ván của mọi người kết thúc.' : net.role === 'client' ? 'Bạn sẽ rời phòng; bot chơi thay bạn trong ván này.' : 'Ván đang chơi sẽ kết thúc và bạn quay về sảnh tầng G.';
      const ok = await this.confirmBox('Rời ca làm việc?', msg, 'Rời ca', 'Ở lại làm tiếp');
      if (!ok) return;
      sfx.stopBossSteps();
      if (net.role !== 'solo') { forgetRoom(); this.leaveNet(); this.showMainMenu(); } else this.enterLobby();
    };
    $('#a-use', hud).onclick = () => this.doUse();
    $('#a-laptop', hud).onclick = () => this.doLaptop();
    $('#a-report', hud).onclick = () => this.doReport();
    $('#a-kill', hud).onclick = () => this.doKill();
    $('#a-sab', hud).onclick = () => this.toggleSabMenu();
    $('#a-hide', hud).onclick = () => this.doHide();
    $('#h-next', hud).onclick = () => { act('hideMove'); sfx.whoosh(); };
    $('#h-exit', hud).onclick = () => { act('hide', null); sfx.whoosh(); };
    this.bindJoystick($('.joy', hud));
  }

  private showRoleReveal() {
    const w = session.world!, p = w.player;
    const imp = p.role === 'impostor';
    const neutral = w.isNeutral(p);
    const climber = p.role === 'crew' && p.dept === 'climber';
    const mates = w.agents.filter(a => a.role === 'impostor' && a !== p);
    const el = document.createElement('div');
    el.className = 'overlay reveal ' + (imp ? 'imp' : neutral ? 'neutral' : 'crew');
    el.innerHTML = `
      <div class="reveal-envelope" aria-hidden="true"><div class="env-back"><b>${esc(fmt('ui.title.tower'))}</b><span>${esc(fmt('ui.reveal.envelope'))}</span><i class="env-seal">${imp ? '🐍' : '✉️'}</i></div></div>
      <div class="reveal-card">
        ${imp ? '<span class="reveal-snake" aria-hidden="true">🐍</span>' : ''}
        <p class="reveal-kicker">${esc(fmt('ui.reveal.kicker'))}</p>
        <h1>${imp ? esc(fmt('ui.reveal.imp')) : `Bạn là ${ROLE_INFO[p.dept as RoleDept].name}`}</h1>
        <p>${neutral
          ? (climber ? `Bạn là phe thứ ba. Nội gián ván này ở dưới (họ không biết bạn). Hạ cả hai phe, sống sót tới cuối cùng.` : `Bạn là phe thứ ba: đầu tàu dự án, người công ty không thể để mất. Nếu công ty sa thải bạn, dự án sụp đổ, cả công ty thua và chỉ mình bạn thắng.`)
          : imp
          ? `Gài bẫy cho đồng nghiệp bị đuổi việc mà không ai thấy. Thắng khi số Nội gián bằng số Nhân viên.${mates.length ? ' Đồng bọn của bạn ở dưới, đừng gài bẫy nhau.' : ' Ván này bạn hành động một mình.'}`
          : `Bạn thuộc phe Nhân viên. Chạy đủ KPI hoặc tìm ra ${w.aliveImp().length} Nội gián trong số ${w.agents.length - 1} đồng nghiệp.`}</p>
        <div class="reveal-team">${w.agents.map(a => { const mate = (imp || climber) && a.role === 'impostor'; return `<figure class="${mate ? 'mate' : ''}" data-id="${a.id}"><img src="${avatarURL(a.look)}" alt=""><figcaption style="--dc:${a.color};--dt:${tagText(a.color)}">${esc(a.name)} #${a.empId}${a.isPlayer ? ' (bạn)' : ''}</figcaption><span class="rd-tag wait">Đang đọc</span></figure>`; }).join('')}</div>
        ${imp
          ? `<div class="dept-card imp"><b>Phòng ban: không có</b><p>Bạn có thể tự nhận bất kỳ phòng ban nào khi họp. Coi chừng phòng ban thật lên tiếng phản bác.</p></div>`
          : `<div class="dept-card"><b>${ROLE_INFO[p.dept as RoleDept].icon} Phòng ban bí mật của bạn: ${ROLE_INFO[p.dept as RoleDept].name}</b><p>${ROLE_INFO[p.dept as RoleDept].ability}</p>
              <ul class="dept-rules">${ROLE_INFO[p.dept as RoleDept].rules.map(r => `<li>${r}</li>`).join('')}</ul>
              ${p.dept === 'developer' ? `<div class="dev-pick"><b>Chọn một đồng nghiệp để backup:</b><div class="dev-list">${w.agents.filter(a => a !== p).map(a => `<button type="button" data-id="${a.id}"><img src="${avatarURL(a.look)}" alt=""><span>${esc(a.name)} #${a.empId}</span></button>`).join('')}</div><small class="dev-warn">Bắt buộc chọn 1 người trước khi bấm Sẵn sàng.</small></div>` : ''}
            </div>`}
        <p class="role-list">Có trong ván: ${this.roleListText()}</p>
        <p class="ready-msg">Mọi người đọc phân công, ai sẵn sàng thì bấm nút. Đủ người là vào ca.</p>
        <button class="primary big" id="go">${esc(fmt('ui.reveal.ready'))}</button>
      </div>`;
    this.root.appendChild(el);
    setTimeout(() => { sfx.whoosh(); }, 500);
    setTimeout(() => { imp ? sfx.alarm() : sfx.ting(); }, 1000);
    el.querySelectorAll<HTMLButtonElement>('.dev-list button').forEach(b => b.onclick = () => {
      act('setBackup', Number(b.dataset.id));
      if (net.role === 'client') p.devBackup = Number(b.dataset.id); // bản sao cập nhật ngay, chủ phòng xác nhận sau
      el.querySelectorAll('.dev-list button').forEach(x => x.classList.toggle('on', x === b));
      sfx.click();
    });
    // Mọi người phải bấm Sẵn sàng thì mới vào ca. Chơi offline: bot đọc xong phân công rồi tự sẵn sàng.
    // Đủ người thì đếm ngược 2 giây rồi vào ca; trong lúc đó ai bấm hủy thì dừng lại.
    const ready = new Set<number>();
    let startTimer: { cancel: () => void } | null = null;
    const btn = $('#go', el) as HTMLButtonElement;
    const refresh = () => {
      const left = w.agents.length - ready.size;
      const meReady = ready.has(p.id);
      btn.classList.toggle('is-ready', meReady);
      btn.innerHTML = meReady ? esc(fmt('ui.reveal.cancel')) : esc(fmt('ui.reveal.ready'));
      $('.ready-msg', el).textContent = left > 0 ? (meReady ? `Đang chờ ${left} người sẵn sàng…` : 'Mọi người đọc phân công, ai sẵn sàng thì bấm nút. Đủ người là vào ca.') : 'Đủ người! Vào ca sau 2 giây…';
      startTimer?.cancel(); startTimer = null;
      // Chơi một mình / chủ phòng: đủ người thì 2 giây sau vào ca (chủ phòng báo cả phòng). Người vào phòng chờ lệnh của chủ phòng.
      if (left === 0 && net.role !== 'client') startTimer = session.later(() => { if (ready.size === w.agents.length) { el.remove(); session.paused = false; net.host?.go(); } }, 2000);
    };
    const setReady = (id: number, on: boolean) => {
      if (on) ready.add(id); else ready.delete(id);
      const tag = el.querySelector(`.reveal-team figure[data-id="${id}"] .rd-tag`) as HTMLElement | null;
      if (tag) {
        tag.className = 'rd-tag ' + (on ? 'ok' : 'wait');
        tag.textContent = on ? '✓ Sẵn sàng' : 'Đang đọc';
        if (on) { tag.classList.remove('pop'); void tag.offsetWidth; tag.classList.add('pop'); }
      }
      refresh();
      net.host?.broadcastReady([...ready]); // chủ phòng: cả phòng thấy ai đã sẵn sàng
    };
    // Bot đọc xong phân công rồi tự sẵn sàng (chỉ máy chạy mô phỏng mới điều khiển bot)
    const timers = net.role === 'client' ? [] : w.agents.filter(a => !a.human).map(a => window.setTimeout(() => { if (el.isConnected) { setReady(a.id, true); sfx.click(); } }, 1200 + Math.random() * 4500));
    if (net.host) net.host.onReadyMsg = (id, on) => { if (el.isConnected) { setReady(id, on); if (on) sfx.click(); } };
    if (net.client) {
      // người vào phòng: danh sách sẵn sàng do chủ phòng phát; chủ phòng báo vào ca thì đóng tờ phân công
      net.client.onReady = (ids) => { if (!el.isConnected) return; for (const a of w.agents) { const on = ids.includes(a.id); if (on !== ready.has(a.id)) setReady(a.id, on); } };
      net.client.onGo = () => { el.remove(); session.paused = false; };
    }
    btn.onclick = () => {
      if (ready.has(p.id)) {
        // Hủy sẵn sàng: đọc lại phân công, được đổi người backup
        setReady(p.id, false);
        net.client?.sendReady(false);
        el.querySelectorAll<HTMLButtonElement>('.dev-list button').forEach(b => b.disabled = false);
        sfx.click();
        return;
      }
      if (p.role === 'crew' && p.dept === 'developer' && p.devBackup === null) {
        const warn = el.querySelector('.dev-warn') as HTMLElement;
        warn.textContent = '⚠️ Bạn phải chọn 1 đồng nghiệp để backup trước khi sẵn sàng!';
        warn.classList.remove('shake'); void warn.offsetWidth; warn.classList.add('shake');
        el.querySelector('.dev-pick')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        sfx.fail();
        return;
      }
      el.querySelectorAll<HTMLButtonElement>('.dev-list button').forEach(b => b.disabled = true);
      sfx.taskDone();
      setReady(p.id, true);
      net.client?.sendReady(true);
    };
    void timers;
  }

  /** Danh sách phòng ban có trong ván, công khai cho mọi người */
  private roleListText() {
    const w = session.world!;
    // dùng số Nội gián công khai (máy người vào phòng không biết ai là Nội gián nên không tự đếm được)
    const impN = w.impostorTotal;
    const crewN = w.agents.length - impN;
    const parts = w.roleList.map(r => `1 ${ROLE_INFO[r].name}`);
    const interns = crewN - w.roleList.length;
    if (interns > 0) parts.push(`${interns} Thực tập sinh`);
    return parts.join(' · ') + ` · ${impN} Nội gián`;
  }

  /** Thông báo nổi dạng giấy note: icon theo nội dung, có thanh thời gian chạy ngược */
  private toast(msg: string, ms = 2200) {
    const t = this.hudEl?.querySelector('.toast') as HTMLElement | null;
    if (!t) return;
    const lead = /^[\p{Extended_Pictographic}]/u.test(msg);
    const kind = /(Cúp điện|Mất|kẹt|thất bại|Hết|không|Không|⚠|😨|bị gài)/.test(msg) ? 'warn' : /(Đã |đã |rồi!|Xong|sống lại)/.test(msg) ? 'ok' : 'info';
    t.className = 'toast ' + kind;
    t.innerHTML = `${lead ? '' : iconSvg(kind === 'warn' ? 'warn' : kind === 'ok' ? 'check' : 'info')}<span></span><i class="toast-bar" style="animation-duration:${ms}ms"></i>`;
    (t.querySelector('span') as HTMLElement).textContent = msg;
    t.hidden = false;
    t.classList.remove('in'); void t.offsetWidth; t.classList.add('in');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => { t.hidden = true; }, ms);
  }

  // ---------- Hành động ----------
  private doUse() {
    const w = session.world; if (!w || w.phase !== 'play' || session.paused) return;
    const p = w.player;
    if (p.hidden !== null) { act('hideMove'); sfx.whoosh(); return; }
    const ctx = w.context(p);
    if (!ctx.use) return;
    sfx.unlock();
    if (ctx.use.kind === 'bell') { const err = act('callEmergency'); if (err) this.toast(err); return; }
    if (ctx.use.kind === 'desk') {
      openV3(this.root, 'desk', 'Giả vờ gõ phím', 'Sếp đi tuần! Gõ đúng các chữ đang bay tới trước khi chúng chạm vào bạn.', () => { act('bossCheckIn'); });
      return;
    }
    if (ctx.use.kind === 'camera') { this.camFromRoom = true; this.toggleCams(true); return; }
    if (ctx.use.kind === 'liftcall') {
      if (w.lift.stuck) { this.toast('Mất điện, thang máy đang kẹt. Đi thang bộ nhé!'); return; }
      act('liftCall', levelAt(p.x, p.y)); sfx.click(); this.toast('Đã gọi thang máy', 1400); return;
    }
    if (ctx.use.kind === 'liftpanel') { this.openLiftPanel(); return; }
    if (ctx.use.kind === 'pry') {
      const err = w.pryBlocked(p); if (err) { this.toast(err); return; }
      openV3(this.root, 'pry', 'Cạy cửa thang máy', 'Thang kẹt vì mất điện. Đưa xà beng vào khe cửa rồi bẩy trái, phải xen kẽ.', () => { const e2 = act('pryOut'); if (e2) this.toast(e2); });
      return;
    }
    if (ctx.use.kind === 'rescue') {
      openV3(this.root, 'rescue', 'Mở cửa thang máy', 'Bạn là Engineer: tra chìa khóa cứu hộ, xoay đúng chiều, rồi kéo cửa sang hai bên.', () => { const e2 = act('liftRescue'); if (e2) this.toast(e2); else this.toast('Đã mở cửa thang máy!', 2000); });
      return;
    }
    if (ctx.use.kind === 'colorcheck') { this.openColorCheck(); return; }
    if (ctx.use.kind === 'door') { const room = ctx.use.room!; openCardSwipe(this.root, () => { act('unlockDoors', room); }); return; }
    if (ctx.use.kind === 'faceid') {
      const err = w.faceIdBlocked(p);
      if (err) { this.toast(err); return; }
      const people = w.agents.filter(a => a.alive && a !== p).map(a => ({ id: a.id, name: esc(a.name), url: avatarURL(a.look), bg: tint(a.color) }));
      this.faceIdOpen = true;
      openFaceId(this.root, people, (on) => { act('flag', 'hrScanning', on && p.alive && !w.faceIdBlocked(p)); }, (target) => {
        this.faceIdOpen = false;
        const e2 = w.faceIdBlocked(p);
        if (e2) this.toast(e2); else act('startFaceId', target);
      });
      return;
    }
    if (ctx.use.kind === 'fix') {
      openMini(this.root, ctx.use.station!.id as MiniKind, () => { act('fixSabotage'); });
      return;
    }
    if (ctx.use.kind === 'task') {
      const st = ctx.use.station!;
      if (p.role === 'impostor') { this.fakeT = 3; return; }
      openMini(this.root, st.id as MiniKind, () => { act('completeTask', st.id); }, {
        // Chấm công vân tay: ai đứng gần cũng thấy đèn quét
        onHold: st.id === 'fingerprint' ? (on) => { act('flag', 'scanning', on && p.alive); } : undefined,
      });
    }
  }
  private laptopT = 0;
  private faceIdOpen = false;
  private hrReadyToasted = false;
  private doLaptop() {
    const w = session.world; if (!w || w.phase !== 'play' || session.paused) return;
    const pl = w.player;
    if (pl.dept === 'po' && pl.role === 'crew') { this.doPoCall(); return; }
    if (pl.dept === 'admin' && pl.role === 'crew') {
      if (pl.adminViewing) { act('adminClose'); return; }
      void actAsync('adminOpen').then(err => { if (err) this.toast(err); else sfx.modem(); });
      return;
    }
    if (pl.dept === 'media' && pl.role === 'crew') { this.openMediaPanel(); return; }
    if (pl.dept === 'animator' && pl.role === 'crew') { this.openAnimator(); return; }
    if (pl.dept === 'tester' && pl.role === 'crew') { this.startTestTag(); return; }
    const err = w.itBlocked(w.player);
    if (err) { this.toast(err); return; }
    act('useLaptop');
    this.camFromRoom = false;
    this.toggleCams(true);
    this.laptopT = IT_CAM_TIME;
    sfx.modem();
  }
  /** Hiệu ứng toàn màn hình khi có sự cố: nhiễu sọc khi rớt mạng, bóng sếp lướt qua khi Sếp đi tuần */
  private screenFx(kind: 'static' | 'boss', ms: number) {
    const el = document.createElement('div');
    el.className = 'screen-fx ' + kind;
    // Sếp đi tuần: không còn bóng đen đi ngang màn hình; mặt Sếp hiện trên dải thông báo sự cố (xem phần Banner sự cố)
    if (kind === 'boss') return;
    this.hudEl.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  private floorBanner(lv: number) {
    const sub = fmt(`ui.floor.sub.${lv}`);
    this.hudEl.querySelector('.floor-banner')?.remove();
    const el = document.createElement('div');
    el.className = 'floor-banner';
    el.innerHTML = `<b>${levelName(lv).toUpperCase()}</b><span>${sub}</span>`;
    this.hudEl.appendChild(el);
    setTimeout(() => el.remove(), 1900);
  }

  /** Bảng nút trong buồng thang máy */
  private openLiftPanel() {
    const w = session.world!, p = w.player;
    const m = this.infoModal('🛗 Chọn tầng', `<div class="lift-panel">${[3, 2, 1].map(f => `<button type="button" data-f="${f}" class="${w.liftFloor() === f ? 'here' : w.lift.requests.has(f) ? 'lit' : ''}">${f}</button>`).join('')}</div>
      <p class="ae-note">Thang máy chạy từ tầng 1 tới tầng 3, không lên sân thượng. Tối đa ${w.liftCapacity} người một buồng.</p>`);
    m.querySelector('.sheet')!.classList.add('lift-sheet');
    m.querySelectorAll<HTMLButtonElement>('.lift-panel button').forEach(b => b.onclick = () => {
      const e2 = act('liftPress', Number(b.dataset.f));
      if (e2) this.toast(e2); else sfx.click();
      (m as any).__close();
    });
  }

  /** Animator: chọn người để làm lại anim (đổi mạng) */
  private openAnimator() {
    const w = session.world!, p = w.player;
    const err = w.animatorBlocked(p);
    if (err) { this.toast(err); return; }
    const cands = w.reviveCandidates(p);
    const m = this.infoModal('🎬 Làm lại anim', `<p class="ae-note">Chọn một đồng nghiệp đã bị gài bẫy. Họ sẽ sống lại ngay chỗ bạn đứng, còn <b>bạn sẽ đổi mạng</b> thành ghế trống tại đó. Chỉ dùng được 1 lần mỗi ván.</p>
      <div class="dev-list">${cands.map(a => `<button type="button" data-id="${a.id}"><img src="${avatarURL(a.look)}" alt=""><span>${esc(a.name)} #${a.empId}</span></button>`).join('')}</div>`);
    m.querySelectorAll<HTMLButtonElement>('.dev-list button').forEach(b => b.onclick = async () => {
      const t = w.agents[Number(b.dataset.id)];
      const ok = await this.confirmBox('Đổi mạng?', `${t.name} #${t.empId} sẽ sống lại, còn bạn thành ghế trống. Không thể hoàn tác.`, 'Làm lại anim', 'Thôi');
      if (!ok) return;
      (m as any).__close();
      const e2 = act('animatorRevive', t.id);
      if (e2) this.toast(e2);
    });
  }

  /** Tester: bấm là viết testcase ngay cho người đứng gần nhất */
  private startTestTag() {
    const w = session.world!, p = w.player;
    const err = w.testerBlocked(p);
    if (err) { this.toast(err); return; }
    const near = w.testerTargets(p);
    if (!near.length) { this.toast('Đứng sát cạnh một người để viết testcase'); return; }
    const e2 = act('testerTag', near[0].id);
    if (e2) this.toast(e2);
  }

  /** Cập nhật một nút hành động: icon, chữ, trạng thái, hồi chiêu và hoạt cảnh chuyển trạng thái */
  private setAct(el: HTMLButtonElement, o: ActView & { show?: boolean }) {
    const show = o.show ?? true;
    if (el.hidden === show) { el.hidden = !show; if (show) this.animOnce(el, 'appear'); }
    if (!show) return;
    if (el.dataset.icon !== o.icon) {
      $('.ic', el).innerHTML = iconSvg(o.icon);
      if (el.dataset.icon) this.animOnce(el, 'swap');
      el.dataset.icon = o.icon;
    }
    const lbl = o.label.toUpperCase();
    const lb = $('.lb', el); if (lb.textContent !== lbl) lb.textContent = lbl;
    el.setAttribute('aria-label', o.label);
    const prev = el.dataset.state as ActState | undefined;
    if (prev !== o.state) {
      if (prev) el.classList.remove('st-' + prev);
      el.classList.add('st-' + o.state);
      el.dataset.state = o.state;
      if (prev === 'cool' && o.state !== 'cool') { this.animOnce(el, 'flash'); if (el.id === 'a-kill') sfx.ting(); }
      else if (o.state === 'target' || o.state === 'alarm') this.animOnce(el, 'pop');
      else if (o.state === 'done') this.animOnce(el, 'pop');
    }
    el.disabled = o.state === 'off' || o.state === 'cool' || o.state === 'done';
    const cd = $('.cd', el);
    if (o.state === 'cool' && o.cd && o.cd > 0) {
      const t = String(Math.ceil(o.cd));
      if (cd.textContent !== t) cd.textContent = t;
      el.style.setProperty('--p', String(Math.max(0, Math.min(1, o.cd / (o.cdMax || o.cd)))));
    } else if (cd.textContent) cd.textContent = '';
  }
  private animOnce(el: HTMLElement, cls: string) {
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    window.setTimeout(() => el.classList.remove(cls), 750);
  }

  /** Người chơi biết người này là Nội gián (Nội gián thấy đồng bọn, Intern tham vọng thấy mọi Nội gián) */
  private seesAsImpostor(a: { role: string; id: number }) {
    const p = session.world!.player;
    // mình là Nội gián: tên mình cũng đỏ (như trên nhân vật); đồng bọn đỏ; Intern tham vọng thấy Nội gián đỏ. Chỉ máy mình thấy.
    return a.role === 'impostor' && (p.role === 'impostor' || (p.role === 'crew' && p.dept === 'climber'));
  }

  private vitalsEl: HTMLElement | null = null;
  /** Bảng chấm công của Admin: không dừng game, tự đóng khi hết pin */
  /** Bảng chấm công của Admin: popup che toàn màn hình (đang xem thì không thấy gì bên dưới, đứng yên) */
  private renderVitals() {
    const w = session.world!, p = w.player;
    if (!this.vitalsEl) {
      const el = document.createElement('div');
      el.className = 'modal vitals-modal';
      el.innerHTML = `<div class="sheet info-sheet vitals-sheet" role="dialog" aria-label="Bảng chấm công">
        <div class="sheet-head"><h2>${iconSvg('clipboard').replace('class="ico"', 'class="ico vt-ico"')} Bảng chấm công</h2><button class="x art" aria-label="Đóng">${iconSvg('close')}</button></div>
        <div class="vt-bat"><span class="vt-bat-lb">Pin</span><div class="vt-bar"><i></i></div><b></b></div>
        <div class="info-body"><div class="vt-grid"></div></div>
      </div>`;
      (el.querySelector('.x') as HTMLElement).onclick = () => { act('adminClose'); };
      el.onclick = (e) => { if (e.target === el) act('adminClose'); };
      this.root.appendChild(el);
      this.vitalsEl = el;
    }
    const el = this.vitalsEl;
    const bat = Math.max(0, p.adminBattery);
    const bar = el.querySelector('.vt-bar i') as HTMLElement;
    bar.style.width = `${(bat / 10) * 100}%`;
    bar.classList.toggle('low', bat < 3);
    (el.querySelector('.vt-bat b') as HTMLElement).textContent = `${bat.toFixed(1)}s`;
    const key = w.vitals().map(v => v.status).join(',');
    if (el.dataset.k !== key) {
      el.dataset.k = key;
      (el.querySelector('.vt-grid') as HTMLElement).innerHTML = w.vitals().map(v => {
        const a = w.agents[v.id];
        const name = `<b${this.seesAsImpostor(a) ? ' class="bad"' : ''}>${esc(a.name)}</b><small>#${a.empId}</small>`;
        if (v.status === 'alive') return `<div class="vt-card ok"><img src="${avatarURL(a.look)}" alt="">${name}<span class="vt-st">Đang làm việc<i class="vt-dots"><u></u><u></u><u></u></i></span></div>`;
        if (v.status === 'dead') return `<div class="vt-card dead"><img src="${avatarURL(a.look)}" alt="">${name}<span class="vt-note">ĐÃ NGHỈ VIỆC<small>Ghế trống</small></span></div>`;
        return `<div class="vt-card out"><img src="${avatarURL(a.look)}" alt="">${name}<span class="vt-stamp">BỊ SA THẢI</span></div>`;
      }).join('');
    }
  }

  /** Truyền thông (hồn ma): chọn 1–3 sticker trong 6 sticker ngẫu nhiên, gửi cho người sống ở gần */
  private mediaRerollAt = 0;
  private openMediaPanel() {
    const w = session.world!, p = w.player;
    const err = w.mediaBlocked(p);
    if (err) { this.toast(err); return; }
    const targets = w.mediaTargets(p);
    if (!targets.length) { this.toast('Lại gần một người còn sống để liên lạc'); return; }
    let target = targets[0].id;
    let hand: number[] = [];
    let chosen: number[] = [];
    const deal = () => { const pool = STICKERS.map((_, i) => i).sort(() => Math.random() - 0.5); hand = pool.slice(0, 6); chosen = []; };
    deal();
    closeMini();
    const wrap = document.createElement('div');
    wrap.className = 'modal media-modal';
    this.root.appendChild(wrap);
    const close = () => { wrap.remove(); clearInterval(tick); };
    const render = () => {
      const now = performance.now();
      const rerollLeft = Math.max(0, Math.ceil((this.mediaRerollAt - now) / 1000));
      wrap.innerHTML = `<div class="sheet media-sheet" role="dialog" aria-label="Liên lạc">
        <div class="sheet-head"><div><h2>📸 Liên lạc với người sống</h2><p class="hint">Chọn 1 đến 3 sticker theo thứ tự để ghép thành ý. Chỉ người nhận thấy, và họ không biết ai gửi.</p></div><button class="x art" aria-label="Đóng">${iconSvg('close')}</button></div>
        ${targets.length > 1 ? `<div class="md-targets">${targets.map(t => `<button data-t="${t.id}" class="${t.id === target ? 'on' : ''}"><img src="${avatarURL(t.look)}" alt=""><span>${esc(t.name)} #${t.empId}</span></button>`).join('')}</div>` : `<p class="md-to">Gửi cho: <b>${esc(w.agents[target].name)} #${w.agents[target].empId}</b></p>`}
        <div class="md-slots">${[0, 1, 2].map(i => `<div class="md-slot">${chosen[i] !== undefined ? STICKERS[chosen[i]].e : ''}</div>`).join('<span class="md-plus">+</span>')}</div>
        <div class="md-hand">${hand.map(i => `<button class="md-st${chosen.includes(i) ? ' used' : ''}" data-i="${i}">${STICKERS[i].e}</button>`).join('')}</div>
        <div class="md-foot">
          <button class="ghost-btn" id="md-reroll" ${rerollLeft > 0 ? 'disabled' : ''}>🔄 <span class="md-rl">Đổi${rerollLeft > 0 ? ` (${rerollLeft}s)` : ''}</span></button>
          <button class="ghost-btn" id="md-cancel">Hủy</button>
          <button class="primary" id="md-use" ${chosen.length ? '' : 'disabled'}>Gửi</button>
        </div></div>`;
      (wrap.querySelector('.x') as HTMLElement).onclick = close;
      $('#md-cancel', wrap).onclick = close;
      $('#md-reroll', wrap).onclick = () => { if (performance.now() < this.mediaRerollAt) return; this.mediaRerollAt = performance.now() + 10000; deal(); sfx.whoosh(); render(); };
      wrap.querySelectorAll<HTMLButtonElement>('.md-targets button').forEach(b => b.onclick = () => { target = Number(b.dataset.t); sfx.click(); render(); });
      wrap.querySelectorAll<HTMLButtonElement>('.md-st').forEach(b => b.onclick = () => {
        const i = Number(b.dataset.i);
        if (chosen.includes(i)) chosen = chosen.filter(x => x !== i); else if (chosen.length < 3) chosen.push(i);
        sfx.click(); render();
      });
      wrap.querySelectorAll<HTMLElement>('.md-slot').forEach((sl, k) => sl.onclick = () => { if (chosen[k] !== undefined) { chosen.splice(k, 1); render(); } });
      $('#md-use', wrap).onclick = () => {
        void actAsync('mediaSend', target, chosen).then(e2 => {
          if (e2) { this.toast(e2); sfx.fail(); return; }
          sfx.ting(); close(); this.toast('Đã gửi sticker 📸', 1500);
        });
      };
    };
    // Chỉ cập nhật chữ đếm ngược trên nút Đổi, không dựng lại cả khung
    const tick = window.setInterval(() => {
      if (!wrap.isConnected) { clearInterval(tick); return; }
      const btn = wrap.querySelector('#md-reroll') as HTMLButtonElement | null;
      if (!btn) return;
      const left = Math.max(0, Math.ceil((this.mediaRerollAt - performance.now()) / 1000));
      btn.disabled = left > 0;
      const txt = left > 0 ? `Đổi (${left}s)` : 'Đổi';
      const lbl = btn.querySelector('.md-rl') as HTMLElement | null;
      if (lbl && lbl.textContent !== txt) lbl.textContent = txt;
    }, 250);
    render();
  }

  private async doPoCall() {
    const w = session.world!;
    const err = w.poBlocked(w.player);
    if (err) { this.toast(err); return; }
    session.paused = true;
    const ok = await this.confirmBox('Họp gấp?', 'Bạn chỉ có 1 lần họp gấp mỗi ván, và cả phòng sẽ biết bạn là Product Owner.', 'Gọi họp ngay', 'Để sau');
    session.paused = false;
    if (!ok) return;
    const e2 = await actAsync('poCall');
    if (e2) this.toast(e2); else sfx.tingBurst();
  }

  private openColorCheck() {
    const w = session.world!, p = w.player;
    const err = w.artistBlocked(p);
    if (err) { this.toast(err); return; }
    const groups = w.groupsInGame().map(id => COLOR_GROUPS.find(g => g.id === id)!);
    const hist = p.artistResults.map(r => { const g = COLOR_GROUPS.find(x => x.id === r.group)!; return { name: g.name, hex: g.hex, has: r.has }; });
    openColorCheck(this.root, groups, hist, on => { act('flag', 'artistScanning', on && p.alive); }, gid => {
      // chờ kết quả (người vào phòng: chủ phòng xử lý xong thì bản sao đã có kết quả mới)
      return actAsync('artistCheck', gid).then(e2 => {
        if (e2) { this.toast(e2); return null; }
        const me = session.world?.player;
        const last = me?.artistResults[me.artistResults.length - 1];
        return last && last.group === gid ? last.has : null;
      });
    });
  }

  private doReport() {
    const w = session.world; if (!w || session.paused) return;
    const c = w.context(w.player);
    if (c.report) act('report', c.report.victim);
  }
  private doKill() {
    const w = session.world; if (!w || session.paused) return;
    const c = w.context(w.player);
    if (c.kill) act('kill', c.kill.id);
  }
  private doHide() {
    const w = session.world; if (!w || session.paused) return;
    const p = w.player;
    if (p.hidden !== null) { act('hide', null); sfx.whoosh(); return; }
    const c = w.context(p);
    if (c.hide !== null) { act('hide', c.hide); sfx.whoosh(); }
  }

  /** Phá hoại giờ nằm ngay trên sơ đồ tòa nhà (như Among Us) */
  private toggleSabMenu(force?: boolean) {
    if (force === false) return;
    this.toggleMap(this.mapOpen && this.mapMode === 'sab' ? false : true, 'sab');
  }

  private sabBtns: { el: HTMLButtonElement; kind: SabotageKind | 'door'; room?: RoomId; level: number }[] = [];
  private buildSabotageMap(hud: HTMLElement) {
    const w = session.world!;
    const box = $('.mm-sab', hud);
    box.innerHTML = '';
    this.sabBtns = [];
    if (w.player.role !== 'impostor') return;
    const pos = (room: RoomId, dx = 0, dy = 0) => {
      const R = ROOMS.find(r => r.id === room)!;
      const Fl = FLOORS[R.level - 1];
      return { left: ((R.x - Fl.ox + R.w / 2 + dx) / 38) * 100, top: ((R.y - Fl.oy + R.h / 2 + dy) / 22) * 100 };
    };
    const add = (kind: SabotageKind | 'door', room: RoomId, dx: number, dy: number, html: string, cls: string) => {
      const b = document.createElement('button');
      b.className = 'sab-pin ' + cls;
      const p = pos(room, dx, dy);
      b.style.left = p.left + '%'; b.style.top = p.top + '%';
      b.innerHTML = html + '<em class="sab-cd"></em>';
      b.onclick = () => {
        const err = kind === 'door' ? act('lockDoors', room) : act('sabotage', kind);
        if (err) this.toast(err); else { sfx.bang(); if (kind === 'door') this.toast(`Đã khóa cửa ${roomName(room)} trong 10 giây`); }
      };
      box.appendChild(b);
      this.sabBtns.push({ el: b, kind, room, level: ROOMS.find(r => r.id === room)!.level });
    };
    add('power', 'power', -2.6, 0, '<span class="si">⚡</span><b>Cúp điện</b>', 'big');
    add('wifi', 'server', -2, 0, '<span class="si">📶</span><b>Rớt mạng</b>', 'big');
    add('boss', 'director', -2, 0, '<span class="si">👞</span><b>Sếp đi tuần</b>', 'big');
    for (const room of LOCKABLE_ROOMS) {
      const shifted = room === 'power' || room === 'server' || room === 'director';
      add('door', room, shifted ? 3 : 0, shifted ? 0 : 1.6, LOCK_SVG, 'door');
    }
  }

  private updateSabotageMap() {
    const w = session.world!;
    for (const s of this.sabBtns) {
      s.el.hidden = s.level !== this.mapFloor; // chỉ hiện nút của tầng đang xem
      let blocked: string | null; let label = '';
      if (s.kind === 'door') {
        blocked = w.doorBlocked(w.player, s.room!);
        const locked = w.doorLocks.get(s.room!);
        const cd = w.doorCd.get(s.room!) ?? 0;
        label = locked !== undefined ? `${Math.ceil(locked)}s` : cd > 0 ? `${Math.ceil(cd)}` : '';
        s.el.classList.toggle('active', locked !== undefined);
      } else {
        const active = w.sabotage?.kind === s.kind;
        blocked = active ? 'Đang diễn ra' : w.sabotage ? 'Đang có sự cố khác' : (s.kind === 'boss' && w.bossUsed) ? 'Đã dùng' : w.sabCd > 0 ? `${Math.ceil(w.sabCd)}` : null;
        label = active ? (s.kind === 'boss' ? `${Math.ceil(w.sabotage!.t)}s` : 'Đang xảy ra') : (s.kind === 'boss' && w.bossUsed) ? 'Đã dùng' : w.sabCd > 0 && !w.sabotage ? `${Math.ceil(w.sabCd)}` : '';
        s.el.classList.toggle('active', active);
      }
      s.el.disabled = !!blocked;
      const cd = s.el.querySelector('.sab-cd') as HTMLElement;
      if (cd.textContent !== label) cd.textContent = label;
    }
  }

  private camsOpen = false;
  private toggleCams(force?: boolean) {
    this.camsOpen = force ?? !this.camsOpen;
    if (!this.camsOpen) this.laptopT = 0;
    $('.cam-wrap', this.hudEl).hidden = !this.camsOpen;
  }

  private menuOpen = false;
  private toggleMenu(force?: boolean) {
    this.menuOpen = force ?? !this.menuOpen;
    const m = this.hudEl?.querySelector('.menu-pop') as HTMLElement | null;
    if (m) m.hidden = !this.menuOpen;
    this.hudEl?.querySelector('#b-menu')?.setAttribute('aria-expanded', String(this.menuOpen));
  }

  /** Đóng mọi lớp phủ đang mở (camera, sơ đồ, menu phá hoại, menu) */
  private closeOverlays() {
    this.toggleSabMenu(false); this.toggleMap(false); this.toggleCams(false); this.toggleMenu(false);
    this.fakeT = 0;
    // Bảng chấm công là popup riêng: họp, bị gài hay hết ván đều phải đóng
    if (this.vitalsEl) { this.vitalsEl.remove(); this.vitalsEl = null; }
  }

  private camIdx = 0;
  private camFromRoom = false;
  private camChannel(d: number) {
    this.camIdx = (this.camIdx + d + CAMERAS.length) % CAMERAS.length;
    sfx.click();
  }

  private drawCams() {
    const w = session.world!;
    const wifiDown = w.sabotage?.kind === 'wifi';
    const powerDown = w.sabotage?.kind === 'power';
    const mapImg = session.mapImage;
    const cv = $('.cam-screen canvas', this.hudEl) as HTMLCanvasElement;
    const c = CAMERAS[this.camIdx];
    const ctx = cv.getContext('2d')!;
    const sx = c.x * TILE, sy = c.y * TILE, sw = c.w * TILE, sh = c.h * TILE;
    const k = Math.min(cv.width / sw, cv.height / sh);
    const ox = (cv.width - sw * k) / 2, oy = (cv.height - sh * k) / 2;
    $('.cam-label', this.hudEl).textContent = `CAM ${this.camIdx + 1} · ${c.name}`;
    $('.cam-ch', this.hudEl).textContent = `Kênh ${this.camIdx + 1}/${CAMERAS.length}`;
    this.hudEl.querySelectorAll<HTMLElement>('.cam-dots i').forEach((d, i) => d.classList.toggle('on', i === this.camIdx));
    ctx.fillStyle = '#0b0b10'; ctx.fillRect(0, 0, cv.width, cv.height);
    if (wifiDown || powerDown) {
      for (let i = 0; i < 1600; i++) { ctx.fillStyle = Math.random() < 0.5 ? '#bbb' : '#222'; ctx.fillRect(Math.random() * cv.width, Math.random() * cv.height, 4, 4); }
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(cv.width / 2 - 260, cv.height / 2 - 50, 520, 100);
      ctx.fillStyle = '#fff'; ctx.font = '800 40px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(powerDown ? 'MẤT ĐIỆN' : 'MẤT TÍN HIỆU', cv.width / 2, cv.height / 2);
    } else {
      if (mapImg) ctx.drawImage(mapImg, sx, sy, sw, sh, ox, oy, sw * k, sh * k);
      const sorted = [...w.agents].filter(a => a.alive && a.hidden === null && a.x >= sx && a.x < sx + sw && a.y >= sy && a.y < sy + sh).sort((p, q) => p.y - q.y);
      for (const a of sorted) {
        const img = avatarImage(a.look);
        const h = CHAR_H * 0.78 * k, wd = CHAR_W * 0.78 * k;
        ctx.save();
        if (a.facing < 0) { ctx.translate(ox + (a.x - sx) * k, 0); ctx.scale(-1, 1); ctx.translate(-(ox + (a.x - sx) * k), 0); }
        ctx.drawImage(img, ox + (a.x - sx) * k - wd / 2, oy + (a.y - sy) * k - h * CHAR_ORIGIN_Y, wd, h);
        ctx.restore();
        ctx.font = `700 ${Math.round(13 * k)}px "Be Vietnam Pro", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
        const lbl = `${a.name} #${a.empId}`;
        ctx.strokeText(lbl, ox + (a.x - sx) * k, oy + (a.y - sy) * k - h); ctx.fillText(lbl, ox + (a.x - sx) * k, oy + (a.y - sy) * k - h);
      }
      for (const b of w.bodies) {
        if (b.x < sx || b.x >= sx + sw || b.y < sy || b.y >= sy + sh) continue;
        ctx.drawImage(this.chairImg, ox + (b.x - sx) * k - 40 * k, oy + (b.y - sy) * k - 70 * k, 80 * k, 80 * k);
      }
      // hiệu ứng camera: vạch quét, viền tối
      ctx.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 0; y < cv.height; y += 4) ctx.fillRect(0, y, cv.width, 1);
      const g = ctx.createRadialGradient(cv.width / 2, cv.height / 2, cv.height * 0.3, cv.width / 2, cv.height / 2, cv.height * 0.9);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
    }
    if (Math.floor(performance.now() / 600) % 2) { ctx.fillStyle = '#e8443a'; ctx.beginPath(); ctx.arc(34, 34, 12, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.font = '700 24px ui-monospace, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('REC', 56, 35);
    // Sổ ra vào chỉ có ở Phòng bảo vệ (không có trên laptop)
    const roster = $('.roster', this.hudEl);
    roster.hidden = !this.camFromRoom;
    if (!this.camFromRoom) return;
    if (wifiDown || powerDown) { roster.textContent = 'Sổ ra vào: không hoạt động'; return; }
    const counts = new Map<string, number>();
    for (const a of w.agents) {
      if (!a.alive || a.hidden !== null) continue;
      const r = roomName(roomAt(a.x, a.y));
      counts.set(r, (counts.get(r) ?? 0) + 1);
    }
    roster.innerHTML = '<b>Sổ ra vào</b> ' + ROOMS.filter(r => r.label).map(r => `<span>${r.name}: ${counts.get(r.name) ?? 0}</span>`).join('');
  }

  private chairImg = (() => { const i = new Image(); i.src = chairURL(); return i; })();

  /** Nội gián có hai thẻ: Sơ đồ (như Nhân viên) và Phá hoại (tô đỏ, chỉ còn nút phá hoại) */
  private mapMode: 'map' | 'sab' = 'map';
  private toggleMap(force?: boolean, mode?: 'map' | 'sab') {
    const imp = session.world?.player.role === 'impostor';
    if (mode && this.mapOpen && force === undefined && mode !== this.mapMode) force = true; // đang mở thẻ khác thì chuyển thẻ
    const wasOpen = this.mapOpen;
    this.mapOpen = force ?? !this.mapOpen;
    this.mapMode = imp ? (mode ?? this.mapMode) : 'map';
    if (this.mapOpen && !wasOpen && session.world) {
      const pl = session.world.player, lv = levelAt(pl.x, pl.y);
      // Sơ đồ phá hoại mở ở tầng có nhiều mục tiêu, sơ đồ thường mở ở tầng mình đang đứng
      this.mapFloor = lv >= 1 && lv <= 4 ? lv : Math.round(session.world.lift.pos);
      this.lastMapLevel = lv;
      this.mapFloorKey = '';
    }
    const mm = this.hudEl.querySelector('.minimap') as HTMLElement | null;
    mm?.classList.toggle('sab-mode', this.mapMode === 'sab');
    const tabs = this.hudEl.querySelector('.mm-tabs') as HTMLElement | null;
    if (tabs) {
      tabs.hidden = !imp;
      tabs.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.classList.toggle('on', b.dataset.m === this.mapMode));
    }
    const head = this.hudEl.querySelector('.minimap .mm-head b');
    if (head) head.textContent = this.mapMode === 'sab' ? 'Phá hoại' : 'Sơ đồ tòa nhà';
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
          if (e.victim === p.id) { sfx.tear(); closeMini(); this.closeOverlays(); this.showFired(w.agents[e.killer]); }
          else if (near || e.killer === p.id) sfx.tear();
          break;
        }
        case 'meeting':
          closeMini(); this.closeOverlays();
          sfx.stopBossSteps(); sfx.tingBurst();
          this.showMeetingSplash();
          break;
        case 'sabotage':
          sfx.alarm();
          // Mất điện / mất mạng: máy Face ID ngừng ngay
          if ((e.kind === 'power' || e.kind === 'wifi') && this.faceIdOpen && miniOpen()) { closeMini(); this.faceIdOpen = false; this.toast(e.kind === 'power' ? 'Mất điện, máy Face ID tắt ngúm!' : 'Mất mạng, máy Face ID mất kết nối!'); }
          if (e.kind === 'power') sfx.powerDown();
          if (e.kind === 'boss') { sfx.startBossSteps(); sfx.ambientLevel(0.05); }
          if (e.kind === 'wifi') sfx.modem();
          if (e.kind === 'wifi') this.screenFx('static', 2600);
          if (e.kind === 'boss') this.screenFx('boss', 46000);
          break;
        case 'sabotage_end':
          this.hudEl?.querySelectorAll('.screen-fx.boss').forEach(x => x.remove());
          if (e.kind === 'boss') { sfx.stopBossSteps(); sfx.ambientLevel(0.18); if (w.phase === 'play') this.toast(fmt('ui.sab.bossLeft')); }
          if (e.kind === 'power' && w.phase === 'play') { sfx.powerUp(); this.toast(fmt('ui.sab.powerBack')); }
          if (e.kind === 'wifi' && w.phase === 'play') { sfx.ting(); this.toast('WiFi đã kết nối lại.'); }
          break;
        case 'task':
          if (e.agent === p.id) this.toast('Xong một đầu việc. KPI +1');
          break;
        case 'boss_ok':
          if (e.agent === p.id) this.toast('Sếp gật gù đi qua. An toàn!');
          break;
        case 'revive':
          if (e.target === p.id) { sfx.tingBurst(); this.toast('🎬 Animator vừa làm lại anim cho bạn: bạn được sống lại!', 4500); }
          if (e.animator === p.id) { sfx.tear(); this.toast(`🎬 Bạn đã đổi mạng để ${w.agents[e.target].name} sống lại.`, 4500); }
          break;
        case 'test_tag':
          if (e.tester === p.id) { sfx.ting(); this.toast(`🧪 Đã viết testcase cho ${w.agents[e.target].name} #${w.agents[e.target].empId}. Log sẽ có khi họp.`, 3500); }
          break;
        case 'lift_arrive':
          if (levelAt(p.x, p.y) === 0 || levelAt(p.x, p.y) === e.floor) sfx.ting();
          break;
        case 'lift_pry':
          if (e.agent === p.id) this.toast('Bạn đã cạy cửa thoát ra!', 2000);
          break;
        case 'lift_rescue':
          if (levelAt(p.x, p.y) === 0) { sfx.tingBurst(); this.toast('Engineer đã mở cửa thang từ bên ngoài, ra được rồi!', 3000); }
          break;
        case 'noise':
          if (p.alive) { sfx.alarm(); this.toast(`🔊 Loa báo động! ${w.agents[e.victim].name} #${w.agents[e.victim].empId} vừa bị gài bẫy, lần theo mũi tên!`, 5000); }
          break;
        case 'eng_sense':
          if (e.agent === p.id) { sfx.fail(); this.toast('😨 Có ai đó trong này!', 3000); }
          break;
        case 'media_msg':
          if (e.to === p.id) { sfx.ting(); this.toast('📸 Một hồn ma vừa nhắn cho bạn (nhìn trên đầu)', 3000); }
          break;
        case 'backup_used':
          if (e.killer === p.id) { sfx.fail(); this.toast('Bẫy thất bại! Mục tiêu có bản backup, bạn mất lượt hồi chiêu.', 3500); }
          if (e.dev === p.id) { sfx.ting(); this.toast(`Bản backup của ${w.agents[e.victim].name} #${w.agents[e.victim].empId} vừa được dùng: ai đó đã định gài bẫy họ!`, 5000); }
          break;
        case 'doors': {
          const near = Math.hypot(p.x - (ROOMS.find(r => r.id === e.room)!.x + 6) * TILE, p.y - (ROOMS.find(r => r.id === e.room)!.y + 5) * TILE) < 12 * TILE;
          if (e.locked) { if (near || e.by === p.id) sfx.bang(); if (roomAt(p.x, p.y) === e.room && p.alive) this.toast(`Cửa ${roomName(e.room)} báo lỗi thẻ, bị khóa 10 giây! Quẹt thẻ ở cửa để mở sớm.`, 3500); }
          else if (near) sfx.ting();
          if (!e.locked && miniOpen() && e.by !== p.id && this.root.querySelector('.mini-swipe') && roomAt(p.x, p.y) === e.room) closeMini();
          break;
        }
        case 'hr_sent':
          if (e.agent === p.id) this.toast(`Đã gửi yêu cầu Face ID của ${w.agents[e.target].name}. Chờ phòng HR duyệt 60 giây.`, 3200);
          break;
        case 'hr_result':
          if (e.agent === p.id) {
            sfx.ting();
            this.toast(`Kết quả Face ID: ${w.agents[e.target].name} ${e.imp ? 'LÀ NỘI GIÁN!' : 'là nhân viên thật.'}`, 5000);
          }
          break;
        case 'gameover':
          sfx.stopBossSteps();
          closeMini(); this.closeOverlays();
          // Nếu đang chiếu cảnh bị gài bẫy thì chờ cảnh đó xong mới hiện kết quả
          if (!this.meetEl && !this.cutsceneActive) session.later(() => this.showGameOver(), 1000);
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
        <img class="kc-killer blurred" src="${avatarURL(killer.look)}" alt="">
        <div class="kc-folder"></div>
        <img class="kc-victim" src="${avatarURL(p.look)}" alt="">
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
    el.innerHTML = `<div class="fired-card"><div class="box">📦</div><h1>${esc(fmt('ui.fired.title'))}</h1>
      <p>${esc(fmt('ui.fired.body'))}</p>
      <p>Giờ bạn là <b>Hồn ma OT</b>: đi xuyên tường, ${session.world!.player.role === 'crew' ? 'vẫn làm task không lương để cứu KPI cho team.' : 'vẫn có thể phá hoại.'} Người sống không thấy và không nghe bạn.</p>
      <button class="primary" id="ok">${esc(fmt('ui.fired.ok'))}</button></div>`;
    this.root.appendChild(el);
    $('#ok', el).onclick = () => el.remove();
    setTimeout(() => el.remove(), 9000);
  }

  // ================= PHÒNG HỌP =================
  /** Màn chuyển cảnh trước khi vào họp (đồng hồ cuộc họp tạm dừng) */
  private showMeetingSplash() {
    const w = session.world!;
    const m = w.meeting;
    if (!m) return; // cuộc họp đã kết thúc (gói tin đến trễ)
    const rep = w.agents[m.reporter];
    session.paused = true;
    const el = document.createElement('div');
    el.className = 'overlay splash ' + m.via;
    if (m.via === 'body') {
      el.innerHTML = `<div class="sp-stage">
          <h1 class="sp-title">${esc(fmt('ui.splash.body.title'))}</h1>
          <div class="sp-scene"><img class="sp-rep point runin" src="${avatarURL(rep.look)}" alt=""><span class="sp-mega small" aria-hidden="true">📢</span><img class="sp-chair zoom" src="${chairURL()}" alt=""></div>
          <p class="sp-sub">${esc(fmt('ui.splash.body.sub', { reporter: rep.name, victim: w.agents[m.victim!].name, room: roomName(m.room) }))}</p>
        </div>`;
      setTimeout(() => sfx.stamp(), 500);
      el.classList.add('shake-red');
    } else if (m.via === 'po') {
      el.innerHTML = `<div class="sp-stage">
          <h1 class="sp-title">${esc(fmt('ui.splash.po.title'))}</h1>
          <div class="sp-scene"><img class="sp-rep" src="${avatarURL(rep.look)}" alt=""><div class="sp-mega" aria-hidden="true">📣</div></div>
          <p class="sp-sub">${esc(fmt('ui.splash.po.sub', { reporter: rep.name, id: rep.empId }))}</p>
        </div>`;
      setTimeout(() => sfx.tingBurst(), 300);
    } else {
      el.innerHTML = `<div class="sp-stage">
          <h1 class="sp-title">${esc(fmt('ui.splash.bell.title'))}</h1>
          <div class="sp-scene"><img class="sp-rep" src="${avatarURL(rep.look)}" alt=""><div class="sp-bell" aria-hidden="true"><span class="bell-dome"></span><span class="bell-base"></span><span class="bell-press"></span></div></div>
          <p class="sp-sub">${esc(fmt('ui.splash.bell.sub', { reporter: rep.name }))}</p>
        </div>`;
    }
    this.root.appendChild(el);
    session.later(() => { el.remove(); session.paused = false; this.showMeeting(); }, 2200);
  }

  private recoverPhase = ''; private recoverSince = 0;
  private showMeeting() {
    if (this.meetEl?.isConnected) return; // không bao giờ mở phòng họp hai lần
    const w = session.world!;
    const m = w.meeting;
    if (!m) return;
    this.selectedVote = null;
    this.resultShown = false;
    this.voteOpened = false;
    this.meetChatCount = 0;
    const rep = w.agents[m.reporter];
    const reason = m.victim !== null
      ? `${esc(rep.name)} phát hiện ghế của ${esc(w.agents[m.victim].name)} trống ở ${roomName(m.room)}`
      : `${esc(rep.name)} bấm chuông họp khẩn`;
    const el = document.createElement('div');
    el.className = 'overlay meet';
    el.innerHTML = `
      <div class="meet-win">
        <div class="meet-top">
          <div class="meet-title"><b>Họp khẩn</b><span>${reason}</span><small class="meet-roles">Có trong ván: ${this.roleListText()}</small></div>
          <div class="meet-timer"><span class="m-phase-pill" id="m-phase">THẢO LUẬN</span><span class="m-clock" id="m-time">--</span></div>
        </div>
        <div class="meet-main">
          <div class="tiles"></div>
          <aside class="chat">
            <div class="chat-head">Trò chuyện trong cuộc họp</div>
            <div class="chat-log" aria-live="polite"></div>
            <div class="emoji-bar" role="group" aria-label="Thả cảm xúc">${EMOJIS.map(e => `<button type="button" class="emo" data-e="${e}" aria-label="Thả ${e}">${e}</button>`).join('')}</div>
            <form class="chat-form"><input id="m-input" maxlength="120" autocomplete="off" placeholder="${w.player.alive ? 'Nhắc tên hoặc mã số (vd: 333) để buộc tội, bênh vực…' : 'Hồn ma nói không ai nghe…'}"><button class="primary" type="submit">Gửi</button></form>
          </aside>
        </div>
        <div class="meet-bar">
          <span class="fake-ctl" title="Mic bị IT khóa">🎙️ Tắt tiếng</span>
          <span class="fake-ctl" title="Camera bị IT khóa">📷 Tắt camera</span>
          <div class="vote-status" id="m-status"></div>
          <button class="ghost-btn dir-btn" id="m-director" hidden>✅ Công bố chức vụ Director</button>
          <button class="ghost-btn" id="m-ready">Sẵn sàng bỏ phiếu</button>
          <button class="ghost-btn" id="m-skip" disabled>Bỏ qua, chưa đủ bằng chứng</button>
          <button class="primary danger" id="m-vote" disabled>Vote sa thải</button>
        </div>
      </div>`;
    this.root.appendChild(el);
    this.meetEl = el;
    const tiles = $('.tiles', el);
    const isProducer = w.player.role === 'crew' && w.player.dept === 'producer' && w.player.alive;
    for (const a of w.agents) {
      const t = document.createElement('button');
      t.className = 'tile' + (a.alive ? '' : ' dead') + (a.id === m.reporter ? ' reporter' : '');
      t.dataset.id = String(a.id);
      t.disabled = !a.alive || a.isPlayer || !w.player.alive;
      const mate = this.seesAsImpostor(a);
      t.innerHTML = `<div class="cam" style="--dc:${a.color};--dt:${tagText(a.color)}"><img src="${avatarURL(a.look)}" alt=""></div>
        <div class="tile-info"><b class="${mate ? 'mate' : ''}"><span class="tn">${esc(a.name)}${a.isPlayer ? ' (bạn)' : ''}</span><span class="emp-id">#${a.empId}</span></b><small class="tile-role">${a.alive ? (a.directorRevealed ? '✅ Director' : a.poRevealed ? '✅ Product Owner' : '') : 'Đã nghỉ việc'}</small></div>
        ${a.id === m.reporter ? '<span class="badge">📢</span>' : ''}<span class="voted" hidden>Đã vote</span><div class="voters"></div>
        ${isProducer && a.alive ? `<span class="shield${w.player.prodLast === a.id ? ' blocked' : ''}" role="button" data-id="${a.id}" title="${w.player.prodLast === a.id ? 'Đã bảo lãnh ở cuộc họp trước' : 'Bảo lãnh người này'}">🛡️</span>` : ''}`;
      t.onclick = (ev) => { if ((ev.target as HTMLElement).classList.contains('shield')) return; this.pickVote(a.id); };
      tiles.appendChild(t);
    }
    $('#m-skip', el).onclick = () => this.castVote('skip');
    // Intern tham vọng: tố cáo nặc danh (1 lần mỗi ván)
    if (w.player.role === 'crew' && w.player.dept === 'climber' && w.player.alive && !w.player.anonUsed) {
      const btn = document.createElement('button');
      btn.className = 'ghost-btn anon-btn'; btn.textContent = '📰 Tố cáo nặc danh';
      btn.onclick = () => {
        const opts = w.agents.filter(a => a.alive && a !== w.player);
        const pick2 = this.infoModal('📰 Tố cáo nặc danh', `<p class="ae-note">Chọn người để hệ thống đăng tin "nguồn giấu tên: người này là Nội gián". Thật hay bịa tùy bạn. Chỉ dùng 1 lần mỗi ván.</p><div class="dev-list">${opts.map(a => `<button type="button" data-id="${a.id}"><img src="${avatarURL(a.look)}" alt=""><span>${esc(a.name)} #${a.empId}</span></button>`).join('')}</div>`);
        pick2.querySelectorAll<HTMLButtonElement>('.dev-list button').forEach(b => b.onclick = () => {
          const e2 = act('anonAccuse', Number(b.dataset.id));
          (pick2 as any).__close();
          if (e2) this.flashStatus(e2); else { btn.remove(); sfx.ting(); }
        });
      };
      $('#m-skip', el).after(btn);
    }
    // Producer: bấm 🛡️ để bí mật bảo lãnh (bấm lại để bỏ)
    if (isProducer) {
      const note = document.createElement('p');
      note.className = 'prod-note';
      note.textContent = '🛡️ Bạn là Producer: bấm khiên trên ô của một người để bí mật bảo lãnh. Bấm lại để bỏ.';
      tiles.prepend(note);
      tiles.querySelectorAll<HTMLElement>('.shield').forEach(sh => sh.onclick = (ev) => {
        ev.stopPropagation();
        const id = Number(sh.dataset.id);
        const cur = w.meeting?.protect;
        const err = cur === id ? act('setProtect', null) : act('setProtect', id);
        if (err) { this.flashStatus(err); sfx.fail(); return; }
        tiles.querySelectorAll('.shield').forEach(x => x.classList.toggle('on', Number((x as HTMLElement).dataset.id) === w.meeting?.protect));
        note.textContent = w.meeting?.protect != null ? `🛡️ Đang bảo lãnh: ${w.agents[w.meeting.protect].name} #${w.agents[w.meeting.protect].empId}` : '🛡️ Chưa bảo lãnh ai.';
        sfx.click();
      });
    }
    $('#m-ready', el).onclick = () => { act('skipDiscussion'); sfx.click(); };
    const dirBtn = $('#m-director', el) as HTMLButtonElement;
    dirBtn.hidden = !(w.player.role === 'crew' && w.player.dept === 'director' && w.player.alive && !w.player.directorRevealed);
    dirBtn.onclick = () => { act('revealDirector'); dirBtn.hidden = true; sfx.stamp(); };
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
      act('react', b.dataset.e!);
      startCooldown();
    });
    ($('.chat-form', el) as HTMLFormElement).onsubmit = (e) => {
      e.preventDefault();
      const inp = $('#m-input', el) as HTMLInputElement;
      const v = inp.value.trim();
      if (!v || performance.now() < chatReadyAt) return;
      act('chat', v);
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
    act('vote', v);
    sfx.click();
    ($('#m-vote', this.meetEl!) as HTMLButtonElement).disabled = true;
    ($('#m-skip', this.meetEl!) as HTMLButtonElement).disabled = true;
    this.meetEl!.querySelectorAll<HTMLButtonElement>('.tile').forEach(t => t.disabled = true);
    // Còn ai chưa vote thì cho bot quyết nhanh hơn
    if (net.role !== 'client') setTimeout(() => w.fastForwardVotes(), 2500); // chủ phòng điều khiển cuộc họp
  }

  private updateMeeting() {
    const w = session.world!;
    const m = w.meeting;
    const el = this.meetEl!;
    if (!m) return;
    const discussing = m.t < m.discussEnd;
    const phase = m.result ? 'KẾT QUẢ' : discussing ? 'THẢO LUẬN' : 'BỎ PHIẾU';
    const ph = $('#m-phase', el);
    if (ph.textContent !== phase) { ph.textContent = phase; ph.className = 'm-phase-pill ' + (m.result ? 'res' : discussing ? 'talk' : 'vote'); }
    const left = m.result ? -1 : Math.max(0, Math.ceil((discussing ? m.discussEnd : m.duration) - m.t));
    const clock = $('#m-time', el);
    const txt = left < 0 ? '' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (clock.textContent !== txt) {
      clock.textContent = txt;
      // Còn 5 giây: đồng hồ đỏ, nảy từng nhịp, kèm tiếng tích tắc
      const urgent = left >= 0 && left <= 5;
      clock.classList.toggle('urgent', urgent);
      if (urgent && left > 0) { clock.classList.remove('tick'); void clock.offsetWidth; clock.classList.add('tick'); sfx.click(); }
    }
    el.classList.toggle('voting', !discussing && !m.result);
    const ready = $('#m-ready', el) as HTMLButtonElement;
    ready.hidden = !discussing;
    const canVote = !discussing && !m.result && w.player.alive && !m.votes.has(w.player.id);
    ($('#m-skip', el) as HTMLButtonElement).disabled = !canVote;
    if (!discussing && !this.voteOpened) { this.voteOpened = true; sfx.ting(); }
    const log = $('.chat-log', el);
    while (this.meetChatCount < m.chat.length) {
      const c = m.chat[this.meetChatCount++];
      if (c.ghost && w.player.alive && c.from !== w.player.id) continue; // tin của hồn ma: người còn sống không đọc được
      if (c.to !== undefined && c.to !== w.player.id) continue; // tin riêng (log Tester) chỉ người nhận thấy
      const a = w.agents[c.from];
      const row = document.createElement('div');
      row.className = 'msg' + (a.isPlayer && !c.system && !c.anon ? ' me' : '') + (!a.alive && !c.anon ? ' ghost' : '') + (c.system ? ' system' : '');
      if (c.alert) row.classList.add('alert');
      row.innerHTML = c.alert
        ? `<span class="alert-ic">${iconSvg('warn')}</span><div><p>${esc(c.text)}</p></div>`
        : c.anon
        ? `<span class="anon-ic">📰</span><div><b class="anon-name">Nguồn tin giấu tên</b><p>${esc(c.text)}</p></div>`
        : `<img src="${avatarURL(a.look)}" alt=""><div><b style="color:${this.seesAsImpostor(a) ? '#e2412f' : nameInk(a.color)}">${esc(a.name)} <span class="chat-id">#${a.empId}</span></b><p>${esc(c.text)}</p></div>`;
      if (c.anon) row.classList.add('anon');
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
    for (const a of w.agents) {
      if (!a.directorRevealed) continue;
      const lab = el.querySelector(`.tile[data-id="${a.id}"] .tile-role`) as HTMLElement | null;
      if (lab && !lab.textContent) { lab.textContent = '✅ Director (phiếu x2)'; lab.closest('.tile')?.classList.add('director'); }
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
        const html = this.anonVotesOn()
          ? voters.map(() => '<span class="anon-vote" title="Phiếu ẩn danh"></span>').join('')
          : voters.map(v => `<img src="${avatarURL(w.agents[v].look)}" title="${esc(w.agents[v].name)} #${w.agents[v].empId}" alt="">`).join('');
        if (holder) holder.innerHTML = html;
        else $('#m-status', el).innerHTML = `Bỏ qua: <span class="skipvoters">${html || '0'}</span>`;
      }
      session.later(() => this.showEjection(), 3200); // chạy đúng giờ dù tab chủ phòng bị ẩn
    }
  }

  private showEjection() {
    const w = session.world!;
    const m = w.meeting;
    // người vào phòng: chủ phòng có thể đã kết thúc cuộc họp trước khi tới lúc mở màn sa thải
    if (!m || !m.result) { this.meetEl?.remove(); return; }
    const r = m.result;
    this.meetEl?.remove();
    this.meetEl = null;
    const el = document.createElement('div');
    el.className = 'overlay eject';
    if (r.ejected !== null) {
      const a = w.agents[r.ejected];
      const impLeft = w.aliveImp().filter(x => x.id !== a.id).length;
      el.innerHTML = `<div class="eject-stage">
          <div class="door"><span>Lối ra</span></div>
          <div class="drag"><img class="victim" src="${avatarURL(a.look)}" alt=""><img class="guard" src="${avatarURL(GUARD_LOOK)}" alt=""></div>
          <div class="stamp-mark">Bị sa thải</div>
        </div>
        <p class="eject-text typing" data-text="${esc(fmt(a.role === 'impostor' ? 'ui.eject.imp' : 'ui.eject.crew', { name: a.name, id: a.empId }))}" data-imp="${a.role === 'impostor' ? 1 : 0}"></p>
        <p class="eject-sub late">${esc(fmt('ui.eject.left', { n: impLeft }))}</p>`;
      setTimeout(() => sfx.stamp(), 2100);
    } else if (r.saved !== undefined) {
      el.innerHTML = `<div class="eject-stage"><div class="paper-fly">🛡️</div></div>
        <p class="eject-text">${esc(fmt('ui.eject.saved'))}</p>
        <p class="eject-sub">${esc(fmt('ui.eject.savedSub'))}</p>`;
    } else {
      el.innerHTML = `<div class="eject-stage"><div class="paper-fly">📄</div></div>
        <p class="eject-text">${esc(fmt(r.tie ? 'ui.eject.tie' : 'ui.eject.skip'))}</p>
        <p class="eject-sub">${esc(fmt('ui.eject.skipSub'))}</p>`;
    }
    this.root.appendChild(el);
    sfx.whoosh();
    // Gõ chữ từng ký tự như máy đánh chữ, bắt đầu sau khi bảo vệ kéo người ra cửa
    const ty = el.querySelector('.typing') as HTMLElement | null;
    if (ty) {
      const full = ty.dataset.text ?? '';
      let i = 0;
      window.setTimeout(() => {
        const tick = window.setInterval(() => {
          if (!ty.isConnected) { clearInterval(tick); return; }
          i++; ty.textContent = full.slice(0, i);
          if (i % 2 === 0) sfx.click();
          if (i >= full.length) { clearInterval(tick); if (ty.dataset.imp === '1') ty.classList.add('was-imp-line'); }
        }, 1500 / Math.max(10, full.length));
      }, 1300);
    }
    session.later(() => {
      el.remove();
      if (net.role === 'client') return; // người vào phòng: chủ phòng kết thúc cuộc họp; màn chọn nơi bắt đầu tự mở khi nhận được lựa chọn
      w.finishMeeting();
      if (w.phase === 'ended') this.showGameOver();
      else if (w.spawnOffer) this.showSpawnPicker();
      else if (w.spawnOffers.size) this.waitOthersSpawn(w); // mình là hồn ma nhưng người khác còn đang chọn
    }, 4800);
  }

  /**
   * Chọn nơi bắt đầu sau họp (kiểu Airship): 3 lựa chọn riêng của bạn, 10 giây.
   * Game tạm dừng trong lúc chọn; hết giờ thì máy chọn ngẫu nhiên giúp.
   */
  private spawnPickerOpen = false;
  /** người vào phòng: đã chọn nơi bắt đầu sau cuộc họp thứ mấy */
  private spawnDoneFor = -1;
  /** Chủ phòng: ván tạm dừng tới khi mọi người thật đã chọn nơi bắt đầu (ai không chọn thì 10,5 giây sau tự ở lại Phòng họp) */
  private waitOthersSpawn(w: World) {
    session.paused = true;
    const tick = () => {
      if (session.world !== w || w.phase !== 'play') return;
      if (w.spawnOffers.size === 0) { session.paused = false; this.root.querySelector('.spawn-wait')?.remove(); return; }
      if (!this.root.querySelector('.spawn-wait')) { const d = document.createElement('div'); d.className = 'spawn-wait'; d.textContent = 'Đang chờ đồng nghiệp chọn nơi bắt đầu…'; this.root.appendChild(d); }
      session.later(tick, 120);
    };
    tick();
  }
  private showSpawnPicker() {
    const w = session.world!, p = w.player;
    const offer = w.spawnOffer;
    if (!offer || this.spawnPickerOpen) return;
    this.spawnPickerOpen = true;
    session.paused = true;
    const myTasksOn = (lv: number) => p.tasks.filter(t => !t.done && levelAt((station(slotStation(t)).stand.x + 0.5) * TILE, (station(slotStation(t)).stand.y + 0.5) * TILE) === lv).length;
    const el = document.createElement('div');
    el.className = 'modal spawn-modal';
    el.innerHTML = `<div class="sheet info-sheet spawn-sheet" role="dialog" aria-label="Chọn nơi bắt đầu">
      <div class="sheet-head"><h2>Chọn nơi bắt đầu</h2><b class="sp-left">10</b></div>
      <p class="sp-here">Bạn đang ở: <b>${esc(roomName(roomAt(p.x, p.y) ?? 'meeting'))} · ${esc(levelName(levelAt(p.x, p.y)))}</b></p>
      <p class="sp-sub">Phòng họp luôn có sẵn; 2 nơi còn lại là của riêng bạn, không ai biết bạn chọn đâu.</p>
      <div class="sp-cards">${offer.map((idx, i) => {
        const sp = SPAWN_POINTS[idx];
        const n = p.role === 'crew' && p.dept !== 'gd' && p.dept !== 'climber' ? myTasksOn(sp.level) : 0;
        return `<button type="button" class="sp-card${i === 0 ? ' stay' : ''}" data-i="${i}">${i === 0 ? '<span class="sp-default">Hết giờ sẽ ở lại đây</span>' : ''}<span class="sp-ic">${iconSvg(sp.icon)}</span><b>${esc(roomName(sp.room))}</b><small>${esc(levelName(sp.level))}${sp.level === levelAt(p.x, p.y) ? ' <i class="sp-same">Cùng tầng</i>' : ''}</small>${n ? `<em>${n} việc của bạn ở tầng này</em>` : '<em class="none">Không có việc của bạn</em>'}</button>`;
      }).join('')}</div>
      <div class="sp-bar"><i></i></div>
    </div>`;
    this.root.appendChild(el);
    sfx.ting();
    let left = 10, done = false;
    const finish = (i: number) => {
      if (done) return;
      done = true;
      clearInterval(tick);
      if (net.role === 'client') { act('chooseSpawn', i); w.spawnOffers.delete(w.meId); this.spawnDoneFor = w.meetingCount; } else w.chooseSpawn(i);
      el.classList.add('closing');
      this.spawnPickerOpen = false;
      setTimeout(() => { el.remove(); if (session.world === w && w.phase === 'play') { if (net.host) this.waitOthersSpawn(w); else session.paused = false; } }, 200);
      sfx.whoosh();
    };
    el.querySelectorAll<HTMLButtonElement>('.sp-card').forEach(b => b.onclick = () => finish(Number(b.dataset.i)));
    const tick = window.setInterval(() => {
      left--;
      const lb = el.querySelector('.sp-left') as HTMLElement | null;
      if (lb) { lb.textContent = String(Math.max(0, left)); lb.classList.toggle('urgent', left <= 3); }
      if (left <= 3 && left > 0) sfx.click();
      if (left <= 0) finish(-1); // hết giờ: ở lại Phòng họp
    }, 1000);
    // thanh thời gian chạy ngược (CSS) đồng bộ 10 giây
    (el.querySelector('.sp-bar i') as HTMLElement).style.animationDuration = '10s';
  }

  // ================= KẾT THÚC =================
  /** Thống kê các ván đã chơi từ lúc mở game (chỉ trong phiên, không lưu lâu dài) */
  private statsLog: string[] = [];
  private statsPanelHtml(): string {
    if (!ADMIN) return '';
    const gs = session.gameStats;
    if (!gs) return net.role === 'client' ? '<details class="go-stats"><summary>📊 Thống kê ván</summary><p class="small">Thống kê đầy đủ hiện có ở máy chủ phòng.</p></details>' : '';
    const s = gs.finish();
    const text = statsText(s, this.statsLog.length + 1);
    if (this.lastStatsText !== text) { this.statsLog.push(text); this.lastStatsText = text; }
    const mm = (x: number | null) => x === null ? '–' : `${Math.floor(x / 60)}:${String(Math.round(x % 60)).padStart(2, '0')}`;
    const me = s.me;
    const mine = me.role === 'Nội gián'
      ? `<li>Bạn gài <b>${me.kills}</b> lần · hồi chiêu xong → gài được TB <b>${me.waits.length ? (me.waits.reduce((a, b) => a + b, 0) / me.waits.length).toFixed(1) + 's' : '–'}</b> · phá hoại ${me.sabotages} lần</li>`
      : `<li>Việc của bạn: <b>${me.tasksDone}/${me.tasksTotal}</b>${me.votes.length ? ` · phiếu trúng Nội gián ${me.votes.filter(v => v.ok).length}/${me.votes.filter(v => v.ok !== null).length}` : ''}</li>`;
    return `<details class="go-stats"><summary>📊 Thống kê ván</summary>
      <ul class="gs-list">
        <li>Kết thúc: <b>${esc(s.endKind)}</b> · KPI ${s.kpiAtEnd}%</li>
        <li>Chơi <b>${mm(s.play)}</b> (cả ván tính họp ${mm(s.full)}) · vụ gài đầu ${mm(s.firstKill)} · họp đầu ${mm(s.firstMeeting)}</li>
        <li>${s.kills} vụ gài · ${s.meetings} cuộc họp (${s.noEject} không ai bị sa thải) · sa thải trúng Nội gián ${s.ejectImp}/${s.ejectTotal}</li>
        <li>Sếp đi tuần: ${s.boss.used ? (s.boss.won ? `<b>thắng</b> (${s.boss.late} người không về kịp)` : 'có dùng, không thắng') : 'không dùng'}${me.bossDoneSec !== null ? ` · bạn về bàn sau ${me.bossDoneSec.toFixed(1)}s` : ''}</li>
        ${mine}
      </ul>
      <ol class="gs-time">${s.timeline.map(e => `<li><time>${mm(e.t)}</time>${esc(e.text)}</li>`).join('')}</ol>
      <div class="gs-copy"><button type="button" class="ghost-btn" id="gs-one">Sao chép ván này</button><button type="button" class="ghost-btn" id="gs-all">Sao chép tất cả (${this.statsLog.length} ván)</button></div>
    </details>`;
  }
  private lastStatsText = '';

  /** Nơi đặt bàn của người chơi (Sếp đi tuần): "Về bàn: Tầng 3 · Phòng HR" */
  private deskWhere(p: Agent) {
    const seat = DESKS[p.desk]?.seat;
    if (!seat) return 'Về bàn gõ phím!';
    const x = (seat.x + 0.5) * TILE, y = (seat.y + 0.5) * TILE;
    return `Về bàn: ${levelName(levelAt(x, y))} · ${roomName(roomAt(x, y) ?? 'open')}`;
  }

  private showGameOver() {
    const w = session.world!;
    if (this.root.querySelector('.gameover')) return;
    session.paused = true;
    closeMini();
    const p = w.player;
    const myTeam = w.isNeutral(p) ? p.dept : p.role;
    const won = w.winner === myTeam;
    const s = this.stats;
    const testGame = this.prefs.testRole !== 'random';
    if (!testGame) { // ván thử nghiệm không tính thành tích
      s.played++;
      if (won) {
        s.wins++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak);
        if (p.role === 'impostor') s.impWins++; else s.crewWins++;
        if (s.fastestWin === null || w.time < s.fastestWin) s.fastestWin = Math.round(w.time);
      } else s.streak = 0;
      saveStats(s);
    }
    const imps = w.agents.filter(a => a.role === 'impostor');
    const el = document.createElement('div');
    el.className = 'overlay gameover ' + (w.winner === 'crew' ? 'crew' : w.winner === 'impostor' ? 'imp' : 'neutral');
    // Hoạt cảnh nền theo phe thắng
    const winners = w.agents.filter(a => w.winner === 'crew' ? a.role === 'crew' && !w.isNeutral(a) : w.winner === 'impostor' ? a.role === 'impostor' : a.dept === w.winner);
    const fx = w.winner === 'crew'
      ? `<div class="go-fx confetti">${Array.from({ length: 36 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 7) * 0.18}s;--c:${['#ffd23f', '#e2412f', '#2e9cf0', '#3fbf6a', '#ff9ec4', '#8a4fd8'][i % 6]}"></i>`).join('')}
         <div class="go-team">${winners.slice(0, 8).map((a, i) => `<img src="${avatarURL(a.look)}" alt="" style="--d:${i * 0.12}s">`).join('')}</div></div>`
      : w.winner === 'impostor'
      ? `<div class="go-fx lightsout"><div class="floors"><span style="--d:.3s">Tầng 3</span><span style="--d:.9s">Tầng 2</span><span style="--d:1.5s">Tầng 1</span></div>
         <div class="go-villain">${winners.map(a => `<img src="${avatarURL(a.look)}" alt="">`).join('')}<b>${esc(fmt('ui.go.laugh'))}</b></div></div>`
      : `<div class="go-fx neutral"><span class="go-big">${w.winner === 'gd' ? '🎲' : '📈'}</span><div class="go-team solo">${winners.map(a => `<img src="${avatarURL(a.look)}" alt="">`).join('')}</div></div>`;
    el.innerHTML = fx + `<div class="go-card">
      <p class="reveal-kicker">${won ? 'Bạn thắng' : 'Bạn thua'} · ${fmtTime(w.time)}</p>
      <h1>${esc(fmt('ui.go.' + w.winner))}</h1>
      <p>${esc(w.winReason)}</p>
      <div class="reveal-team">${imps.map(a => `<figure class="mate"><img src="${avatarURL(a.look)}" alt=""><figcaption style="--dc:${a.color};--dt:${tagText(a.color)}">${esc(a.name)} #${a.empId}</figcaption></figure>`).join('')}</div>
      <p class="small">Nội gián ván này: ${imps.map(a => esc(a.name)).join(', ')}. Chuỗi thắng hiện tại: ${s.streak}.</p>
      <div class="go-roles">${w.agents.map(a => `<span><img src="${avatarURL(a.look)}" alt="">${esc(a.name)} #${a.empId}: <b class="${a.role === 'impostor' ? 'bad' : w.isNeutral(a) ? 'neu' : ''}">${a.role === 'impostor' ? 'Nội gián' : ROLE_INFO[a.dept as RoleDept].name}</b></span>`).join('')}</div>
      ${this.statsPanelHtml()}
      <div class="row"><button class="ghost-btn" id="lobby">Về sảnh</button><button class="primary big" id="again">Chơi ván mới</button></div>
    </div>`;
    this.root.appendChild(el);
    (won ? sfx.taskDone() : sfx.fail());
    // nút sao chép thống kê
    const copyBtn = (id: string, text: () => string) => {
      const b = el.querySelector(id) as HTMLButtonElement | null;
      if (!b) return;
      b.onclick = () => {
        const old = b.textContent;
        navigator.clipboard?.writeText(text()).then(() => { b.textContent = 'Đã sao chép!'; window.setTimeout(() => { b.textContent = old; }, 1500); })
          .catch(() => { this.infoModal('Sao chép thống kê', `<textarea class="gs-text" readonly>${esc(text())}</textarea>`); });
      };
    };
    copyBtn('#gs-one', () => this.statsLog[this.statsLog.length - 1] ?? '');
    copyBtn('#gs-all', () => `# Thống kê ${this.statsLog.length} ván · ${new Date().toLocaleString('vi-VN')}\n\n` + this.statsLog.join('\n\n'));
    if (net.role === 'host') {
      ($('#lobby', el)).textContent = 'Về phòng';
      $('#again', el).onclick = () => this.startNetGame();
      $('#lobby', el).onclick = () => { net.host!.endGame(); this.showRoom(); };
    } else if (net.role === 'client') {
      ($('#again', el)).hidden = true;
      ($('#lobby', el)).textContent = 'Rời phòng';
      $('#lobby', el).onclick = () => { forgetRoom(); this.leaveNet(); this.showMainMenu(); };
      el.querySelector('.row')!.insertAdjacentHTML('beforeend', '<span class="room-wait">Chờ chủ phòng bắt đầu ván mới…</span>');
    } else {
      $('#again', el).onclick = () => this.startGame();
      $('#lobby', el).onclick = () => this.enterLobby();
    }
  }

  // ================= MỖI KHUNG HÌNH =================
  private frame(dt: number) {
    if (session.lobby.online && !session.world) {
      this.syncOnlineLobbyFrame();
      // đổi ngoại hình ở máy thay đồ: báo cả phòng (gửi lại hồ sơ)
      const L = session.lobby, k = L.me.look ? lookKey(L.me.look) + L.me.name : '';
      if (k && k !== this.sentLookKey) {
        this.sentLookKey = k;
        if (net.host) { const mine = net.host.players.find(x => x.host); if (mine && L.me.look) { mine.look = L.me.look; mine.name = L.me.name; net.host.broadcastRoom(); } }
        else if (net.client && L.me.look) { net.client.me = { ...net.client.me, look: L.me.look, name: L.me.name }; net.client.join(); }
      }
    }
    // người vào phòng (vừa vào lại): lỡ sự kiện "bắt đầu họp" / "hết ván" thì tự mở đúng màn đang diễn ra
    // (chỉ khi trạng thái đó đã kéo dài quá 3,5 giây: lúc bình thường sự kiện tới cùng gói tin và luồng thường tự mở)
    { const w = session.world;
      if (net.role === 'client' && w && !document.querySelector('.reveal')) {
        const now = performance.now();
        if (w.phase !== this.recoverPhase) { this.recoverPhase = w.phase; this.recoverSince = now; }
        const stale = now - this.recoverSince > 3500;
        if (stale && w.phase === 'meeting' && w.meeting && !this.meetEl?.isConnected && !this.root.querySelector('.overlay.splash, .overlay.eject')) { session.paused = false; this.showMeeting(); }
        if (stale && w.phase === 'ended' && !this.root.querySelector('.gameover') && !this.cutsceneActive && !this.meetEl?.isConnected) this.showGameOver();
      } }
    // người vào phòng: mở màn chọn nơi bắt đầu khi nhận được lựa chọn (mỗi cuộc họp một lần; ảnh chụp đến trễ không mở lại)
    { const w = session.world; if (net.role === 'client' && w && w.phase === 'play' && w.spawnOffer && !this.spawnPickerOpen && !this.meetEl && this.spawnDoneFor !== w.meetingCount) this.showSpawnPicker(); }
    // Gộp bàn phím và cần điều khiển
    let x = 0, y = 0;
    const K = this.prefs.keys;
    if (this.keys.has(K.left) || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has(K.right) || this.keys.has('arrowright')) x += 1;
    if (this.keys.has(K.up) || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has(K.down) || this.keys.has('arrowdown')) y += 1;
    if (this.joy.active) { x = this.joy.x; y = this.joy.y; }
    if (miniOpen() || this.fakeT > 0 || this.camsOpen || this.vitalsEl) { x = 0; y = 0; }
    session.input = { x, y };

    const w = session.world;
    if (!w && this.lobbyHud) {
      const near = session.lobby.near;
      const use = $('#l-use', this.lobbyHud) as HTMLButtonElement;
      const info = session.lobby.nearInfo;
      this.setAct(use, info
        ? { icon: info.icon, label: info.label, state: near === 'elevator' ? 'alarm' : 'target' }
        : { icon: 'work', label: 'Dùng', state: 'off' });
      this.syncLobbyInfo();
      return;
    }
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
    // ===== Nút hành động: mỗi nút tự đổi icon, chữ và trạng thái theo đúng tình huống =====
    const use = $('#a-use', this.hudEl) as HTMLButtonElement;
    {
      const u = ctx.use;
      let o: ActView = { icon: 'work', label: 'Làm việc', state: 'off' };
      if (u) switch (u.kind) {
        case 'task': o = { icon: stationIcon(u.station?.id), label: u.station?.name ?? u.label, state: 'target' }; break; // hiện đúng tên việc: In tài liệu, Pha cà phê...
        case 'fix': o = { icon: stationIcon(u.station?.id), label: 'Sửa sự cố', state: 'alarm' }; break;
        case 'bell':
          o = p.emergencyLeft <= 0 ? { icon: 'bell', label: 'Hết lượt họp', state: 'done' }
            : w.emergencyCd > 0 ? { icon: 'bell', label: 'Họp khẩn', state: 'cool', cd: w.emergencyCd, cdMax: 15 }
            : w.sabotage?.kind === 'boss' ? { icon: 'bell', label: 'Sếp đang tuần', state: 'off' }
            : { icon: 'bell', label: 'Họp khẩn', state: 'alarm' };
          break;
        case 'desk': o = { icon: 'desk', label: 'Ngồi vào bàn', state: 'alarm' }; break;
        case 'camera': o = { icon: 'camera', label: 'Xem camera', state: 'target' }; break;
        case 'faceid': o = { icon: 'idcard', label: 'Face ID', state: 'target' }; break;
        case 'door': o = { icon: 'keycard', label: 'Quẹt thẻ', state: 'alarm' }; break;
        case 'colorcheck': o = { icon: 'palette', label: 'So màu', state: 'target' }; break;
        case 'liftcall': o = { icon: 'lift', label: w.lift.stuck ? 'Thang kẹt' : w.lift.requests.has(levelAt(p.x, p.y)) ? 'Đang gọi…' : 'Gọi thang', state: w.lift.stuck ? 'off' : w.lift.requests.has(levelAt(p.x, p.y)) ? 'active' : 'target' }; break;
        case 'liftpanel': o = { icon: 'liftPanel', label: 'Chọn tầng', state: 'target' }; break;
        case 'pry': o = w.lift.stuckT < PRY_AFTER ? { icon: 'crowbar', label: 'Cạy cửa', state: 'cool', cd: PRY_AFTER - w.lift.stuckT, cdMax: PRY_AFTER } : { icon: 'crowbar', label: 'Cạy cửa', state: 'alarm' }; break;
        case 'rescue': o = { icon: 'wrench', label: 'Mở cửa thang', state: 'alarm' }; break;
      }
      this.setAct(use, o);
    }
    // Hồn ma: nút lên/xuống tầng (tầng cao nhất/thấp nhất thì nút tương ứng mờ)
    {
      const lv = levelAt(p.x, p.y), cur = lv >= 1 && lv <= 4 ? lv : lv === 0 ? Math.round(w.lift.pos) : p.ghostLv;
      this.setAct($('#a-gup', this.hudEl) as HTMLButtonElement, { show: !p.alive, icon: 'stairs', label: 'Lên tầng', state: cur >= 4 ? 'off' : 'ready' });
      this.setAct($('#a-gdown', this.hudEl) as HTMLButtonElement, { show: !p.alive, icon: 'stairs', label: 'Xuống tầng', state: cur <= 1 ? 'off' : 'ready' });
    }
    const rep = $('#a-report', this.hudEl) as HTMLButtonElement;
    this.setAct(rep, { show: p.alive, icon: 'report', label: 'Báo cáo', state: ctx.report ? 'alarm' : 'off' });
    const isImp = p.role === 'impostor';
    const isClimber = p.role === 'crew' && p.dept === 'climber';
    const kill = $('#a-kill', this.hudEl) as HTMLButtonElement;
    {
      const max = isClimber ? CLIMBER_CD : w.killCdBase;
      // đang trốn: hồi chiêu đứng yên, nút ghi rõ "Tạm dừng"
      this.setAct(kill, { show: (isImp || isClimber) && p.alive, icon: 'trap', label: p.hidden !== null && p.killCd > 0 ? 'Tạm dừng' : 'Gài bẫy',
        state: p.killCd > 0 ? 'cool' : ctx.kill ? 'target' : 'off', cd: p.killCd, cdMax: Math.max(max, p.killCd) });
    }
    // Nội gián: trạng thái đồng bọn (sẵn sàng / còn bao nhiêu giây / đang trốn / đã nghỉ việc), chỉ Nội gián thấy
    {
      const card = this.hudEl.querySelector('.tasks') as HTMLElement | null;
      let line = card?.querySelector('.mate-line') as HTMLElement | null;
      const mates = isImp ? w.agents.filter(a => a.role === 'impostor' && a.id !== p.id) : [];
      if (card && mates.length) {
        if (!line) { line = document.createElement('div'); line.className = 'mate-line'; card.querySelector('.my-dept')?.insertAdjacentElement('afterend', line); }
        const txt = mates.map(m => `${m.name} #${m.empId}: ${!m.alive ? (m.ejected ? 'bị sa thải' : 'đã nghỉ việc') : m.killCd > 0 ? `còn ${Math.ceil(m.killCd)}s${m.hidden !== null ? ' (đang trốn)' : ''}` : 'sẵn sàng gài'}`).join(' · ');
        const html = `🐍 Đồng bọn · ${esc(txt)}`;
        if (line.innerHTML !== html) line.innerHTML = html;
      } else line?.remove();
    }
    const sab = $('#a-sab', this.hudEl) as HTMLButtonElement;
    this.setAct(sab, { show: isImp, icon: 'sabotage', label: w.sabotage ? 'Đang phá' : 'Phá hoại',
      state: w.sabotage ? 'active' : w.sabCd > 0 ? 'cool' : 'ready', cd: w.sabCd, cdMax: SAB_CD });
    // như Among Us: đang hồi chiêu phá hoại lớn vẫn mở được bảng (để khóa cửa, cửa có hồi chiêu riêng); số đếm vẫn hiện trên nút
    if (isImp) sab.disabled = false;
    const hideB = $('#a-hide', this.hudEl) as HTMLButtonElement;
    const isEng = p.role === 'crew' && p.dept === 'engineer';
    this.setAct(hideB, { show: (isImp || isEng || isClimber) && p.alive, icon: 'hide', label: 'Trốn',
      state: isEng && p.hidden === null && p.engCd > 0 ? 'cool' : ctx.hide !== null ? 'target' : 'off', cd: p.engCd, cdMax: ENG_CD });
    const hc = $('.hide-ctrl', this.hudEl);
    hc.hidden = p.hidden === null;
    if (p.hidden !== null) {
      const here = HIDE_SPOTS[p.hidden], pi = w.pairOf(p.hidden), there = pi >= 0 ? HIDE_SPOTS[pi] : null;
      $('.hide-name', hc).textContent = `Đang trốn: ${here.name}`;
      $('.va-lb', hc).textContent = there ? there.name : 'Buồng thang không ở tầng này';
      ($('#h-next', hc) as HTMLButtonElement).disabled = !there;
      // Mũi tên chỉ hướng chỗ trốn bên kia (khác tầng thì chỉ lên/xuống)
      const lvA = here.level, lvB = there ? there.level : here.level;
      const ang = !there ? -Math.PI / 2 : lvA !== lvB ? (lvB === 0 || lvB > lvA ? -Math.PI / 2 : Math.PI / 2) : Math.atan2(there.y - here.y, there.x - here.x);
      const arrow = $('#h-next', hc);
      const R = Math.min(window.innerWidth, window.innerHeight) * 0.22;
      arrow.style.left = `calc(50% + ${Math.cos(ang) * R}px)`;
      arrow.style.top = `calc(50% + ${Math.sin(ang) * R}px)`;
      ($('.va-ic', hc)).style.transform = `rotate(${ang}rad)`;
    }
    $('.actions', this.hudEl).classList.toggle('hidden-mode', p.hidden !== null);

    // Năng lực phòng ban
    const lap = $('#a-laptop', this.hudEl) as HTMLButtonElement;
    const crewP = p.role === 'crew';
    const isIt = crewP && p.dept === 'it' && p.alive;
    const isPo = crewP && p.dept === 'po' && p.alive && !p.poUsed;
    const isAdmin = crewP && p.dept === 'admin' && p.alive;
    const isMedia = crewP && p.dept === 'media' && !p.alive;
    const isAnim = crewP && p.dept === 'animator' && p.alive && !p.animUsed;
    const isTester = crewP && p.dept === 'tester' && p.alive;
    const poDone = crewP && p.dept === 'po' && p.alive && p.poUsed;
    const animDone = crewP && p.dept === 'animator' && p.alive && p.animUsed;
    let ab: ActView & { show: boolean } = { show: false, icon: 'work', label: '', state: 'off' };
    if (isIt) ab = this.laptopT > 0 ? { show: true, icon: 'laptop', label: 'Đang xem', state: 'active' }
      : p.itCd > 0 ? { show: true, icon: 'laptop', label: 'Laptop', state: 'cool', cd: p.itCd, cdMax: IT_CD + 10 }
      : w.itBlocked(p) ? { show: true, icon: 'laptop', label: 'Mất kết nối', state: 'off' }
      : { show: true, icon: 'laptop', label: 'Laptop', state: 'ready' };
    else if (isPo) ab = { show: true, icon: 'megaphone', label: 'Họp gấp', state: w.poBlocked(p) ? 'off' : 'ready' };
    else if (poDone) ab = { show: true, icon: 'megaphone', label: 'Đã họp gấp', state: 'done' };
    else if (isAdmin) ab = p.adminViewing ? { show: true, icon: 'clipboard', label: 'Đóng bảng', state: 'active' }
      : p.adminCd > 0 ? { show: true, icon: 'clipboard', label: 'Chấm công', state: 'cool', cd: p.adminCd, cdMax: ADMIN_CD }
      : w.adminBlocked(p) ? { show: true, icon: 'clipboard', label: p.adminBattery <= 0.05 ? 'Hết pin' : 'Mất kết nối', state: 'off' }
      : { show: true, icon: 'clipboard', label: 'Chấm công', state: 'ready' };
    else if (isMedia) ab = p.mediaCd > 0 ? { show: true, icon: 'photo', label: 'Liên lạc', state: 'cool', cd: p.mediaCd, cdMax: MEDIA_CD }
      : { show: true, icon: 'photo', label: 'Liên lạc', state: w.mediaTargets(p).length ? 'target' : 'off' };
    else if (isAnim) ab = { show: true, icon: 'clapper', label: 'Làm lại anim', state: w.animatorBlocked(p) ? 'off' : 'target' };
    else if (animDone) ab = { show: true, icon: 'clapper', label: 'Đã dùng', state: 'done' };
    else if (isTester) ab = p.testUsed ? { show: true, icon: 'flask', label: 'Đã viết', state: 'done' }
      : { show: true, icon: 'flask', label: 'Viết testcase', state: w.testerTargets(p).length ? 'target' : 'off' };
    this.setAct(lap, ab);
    if (isAdmin && p.adminViewing) this.renderVitals(); else if (this.vitalsEl) { this.vitalsEl.remove(); this.vitalsEl = null; }
    const camTitle = $('.cam-title', this.hudEl);
    const wantTitle = this.laptopT > 0 ? `Laptop IT · còn ${Math.ceil(this.laptopT)} giây` : 'Camera an ninh';
    if (camTitle.textContent !== wantTitle) camTitle.textContent = wantTitle;
    if (this.laptopT > 0) {
      this.laptopT -= dt;
      if (this.laptopT <= 0 || w.sabotage?.kind === 'wifi' || !p.alive) { this.laptopT = 0; this.toggleCams(false); }
    }
    const md = $('.my-dept', this.hudEl);
    let deptTxt: string;
    if (p.role === 'impostor') deptTxt = 'Phòng ban: <b>không có</b> (tự nhận bừa khi họp)';
    else {
      deptTxt = `Phòng ban bí mật: <b>${ROLE_INFO[p.dept as RoleDept].name}</b>`;
      if (p.dept === 'hr') {
        if (p.hrPending) deptTxt += `<br>Face ID ${esc(w.agents[p.hrPending.target].name)}: chờ ${Math.ceil(p.hrPending.left)}s`;
        else if (p.hrResult) deptTxt += `<br>Face ID: <b class="${p.hrResult.imp ? 'bad' : 'good'}">${esc(w.agents[p.hrResult.target].name)} ${p.hrResult.imp ? 'LÀ NỘI GIÁN' : 'là nhân viên thật'}</b>`;
        else if (p.hrUsed) deptTxt += '<br>Face ID: kết quả đã mất';
        else {
          const wait = w.faceIdUnlockIn();
          const blocked = w.faceIdBlocked(p);
          deptTxt += wait > 0 ? `<br>Máy Face ID (Phòng HR) mở sau <b>${Math.ceil(wait)}s</b>`
            : blocked ? `<br>Máy Face ID: ${blocked}` : '<br><b class="good">Máy Face ID ở Phòng HR đã sẵn sàng</b>';
          if (wait <= 0 && !this.hrReadyToasted) { this.hrReadyToasted = true; sfx.ting(); this.toast('Máy Face ID ở Phòng HR đã mở! Xem vị trí trên sơ đồ (Tab).', 4000); }
        }
      }
      if (p.dept === 'director') deptTxt += p.directorRevealed ? '<br>Đã công bố: phiếu x2' : '<br>Công bố chức vụ trong cuộc họp';
      if (p.dept === 'po') deptTxt += p.poUsed ? '<br>Đã dùng quyền họp gấp' : `<br>Nút 📣 Họp gấp sẵn sàng (phím ${keyLabel(this.prefs.keys.laptop)})`;
      if (p.dept === 'producer') deptTxt += p.prodLast !== null ? `<br>Họp trước đã bảo lãnh: ${esc(w.agents[p.prodLast].name)}` : '<br>Bảo lãnh một người trong mỗi cuộc họp';
      if (p.dept === 'developer') deptTxt += p.devBackup === null ? '<br>Chưa chọn người backup' : p.devUsed ? `<br>Backup của ${esc(w.agents[p.devBackup].name)} <b class="bad">đã được dùng</b>` : `<br>Đang backup: <b>${esc(w.agents[p.devBackup].name)} #${w.agents[p.devBackup].empId}</b>`;
      if (p.dept === 'sound') deptTxt += '<br>Bị gài bẫy thì loa tự hú báo mọi người';
      if (p.dept === 'animator') deptTxt += p.animUsed ? '<br>Đã làm lại anim' : `<br>🎬 Làm lại anim: ${w.reviveCandidates(p).length ? `<b class="good">có ${w.reviveCandidates(p).length} người có thể hồi sinh</b>` : 'chưa biết ai nghỉ việc (thấy ghế trống hoặc vào họp mới biết)'}`;
      if (p.dept === 'tester') deptTxt += p.testTarget !== null ? `<br>Đã viết testcase cho: <b>${esc(w.agents[p.testTarget].name)} #${w.agents[p.testTarget].empId}</b> (log khi họp)` : '<br>Đứng sát một người rồi bấm 🧪 Viết testcase';
      if (p.dept === 'gd') deptTxt += '<br><b class="neu">Phe thứ ba</b>: người công ty không thể sa thải. Bị sa thải là dự án sụp đổ, và bạn thắng.';
      if (p.dept === 'climber') deptTxt += `<br><b class="neu">Phe thứ ba</b>: Nội gián là ${w.agents.filter(a => a.role === 'impostor').map(a => `${esc(a.name)} #${a.empId}${a.alive ? '' : ' (đã nghỉ)'}`).join(', ')}`;
      if (p.dept === 'admin') deptTxt += p.adminViewing ? '<br>Đang xem Bảng chấm công' : `<br>Pin Bảng chấm công: <b>${p.adminBattery.toFixed(0)}s</b>${p.adminCd > 0 ? ` · mở lại sau ${Math.ceil(p.adminCd)}s` : ''}`;
      if (p.dept === 'engineer') deptTxt += p.hidden !== null ? `<br>Đang trốn: còn <b>${Math.ceil(15 - p.engHideT)}s</b>` : p.engCd > 0 ? `<br>Chỗ trốn hồi chiêu ${Math.ceil(p.engCd)}s` : '<br>Dùng được chỗ trốn (phím trốn)';
      if (p.dept === 'media') deptTxt += p.alive ? '<br>Kỹ năng mở khi bạn thành hồn ma' : '<br>📸 Lại gần người sống để gửi sticker';
      if (p.dept === 'artist') {
        const bl = w.artistBlocked(p);
        const last = p.artistResults[p.artistResults.length - 1];
        if (last) { const gn = COLOR_GROUPS.find(g => g.id === last.group)!.name; deptTxt += `<br>So màu ${gn}: <b class="${last.has ? 'bad' : 'good'}">${last.has ? 'Nội gián CÓ' : 'Nội gián KHÔNG có'}</b>`; }
        deptTxt += bl ? `<br>${bl}` : '<br><b class="good">Máy so màu ở Studio Art đã sẵn sàng</b>';
      }
    }
    if (this.lastDeptTxt !== deptTxt) { this.lastDeptTxt = deptTxt; md.innerHTML = deptTxt; }

    // Bảng nhiệm vụ: chỉ cập nhật khi đổi
    const k = w.crewTasksDone();
    const sabKey = w.sabotage ? `${w.sabotage.kind}:${Math.ceil(w.sabotage.t)}:${w.aliveCrew().filter(c => c.bossDone).length}` : '';
    const key = `${k.done}/${k.total}|${p.tasks.map(t => t.done ? 'x' : t.step).join('')}|${p.alive}|${sabKey}|${p.bossDone}|${levelAt(p.x, p.y)}`;
    if (key !== this.lastHud) {
      this.lastHud = key;
      ($('.kpi-bar i', this.hudEl)).style.width = `${(k.done / Math.max(1, k.total)) * 100}%`;
      const list = $('.task-list', this.hudEl);
      const items: string[] = [];
      const wifiDown = w.sabotage?.kind === 'wifi';
      if (isImp) items.push(`<li class="imp-note">Gài bẫy đồng nghiệp. Việc dưới đây chỉ để giả vờ.</li>`);
      else if (w.isNeutral(p)) items.push(`<li class="imp-note">Phe thứ ba: việc dưới đây là việc giả, không tính KPI.</li>`);
      else if (!p.alive) items.push(`<li class="imp-note">Hồn ma OT: làm nốt việc để cứu KPI.</li>`);
      if (w.sabotage) {
        const s = w.sabotage;
        const txt = s.kind === 'boss' ? `${this.deskWhere(p)} (${Math.ceil(s.t)}s) ${p.bossDone || isImp ? '✓' : ''}`
          : s.kind === 'wifi' ? 'Khởi động lại router (Phòng Server, Tầng 3)' : 'Bật lại cầu dao (Kho điện, Tầng 1)';
        items.push(`<li class="sab">${SAB_INFO[s.kind].icon} ${txt}</li>`);
      }
      if (wifiDown) items.push('<li class="imp-note">Mất kết nối Jira… không tải được danh sách việc.</li>');
      else {
        // Nhóm việc theo tầng: tầng đang đứng lên đầu, các tầng khác theo khoảng cách
        const myLv = levelAt(p.x, p.y);
        const here = myLv >= 1 && myLv <= 4 ? myLv : myLv === 0 ? Math.round(w.lift.pos) : 0;
        const groups = new Map<number, string[]>();
        const floorOf = (st: ReturnType<typeof station>) => st.room === 'cabin' ? 0 : levelAt((st.stand.x + 0.5) * TILE, (st.stand.y + 0.5) * TILE);
        for (const t of p.tasks) {
          const def = taskDef(t.taskId);
          const st = station(t.done ? def.steps[def.steps.length - 1] : slotStation(t));
          const steps = def.steps.length > 1 ? ` (${t.done ? def.steps.length : t.step}/${def.steps.length})` : '';
          const label = def.steps.length > 1 && !t.done ? `${def.name}${steps}: ${st.name.toLowerCase()}` : def.name + steps;
          const lv = floorOf(st);
          if (!groups.has(lv)) groups.set(lv, []);
          const fresh = t.done && !this.doneSeen.has(t.taskId);
          if (t.done) this.doneSeen.add(t.taskId);
          groups.get(lv)!.push(`<li class="${t.done ? 'done' : ''}${fresh ? ' just-done' : ''}${def.type === 'common' ? ' common' : ''}">${roomName(st.room)}: ${label}</li>`);
        }
        const order = [...groups.keys()].sort((a, b) => (a === here ? -1 : b === here ? 1 : Math.abs(a - here) - Math.abs(b - here) || a - b));
        for (const lv of order) {
          const name = lv === 0 ? '🛗 Trong thang máy' : levelName(lv);
          items.push(`<li class="floor-h${lv === here ? ' here' : ''}">${lv === here ? '📍 ' : ''}${name}${lv === here ? ' (bạn đang ở đây)' : ''}</li>`, ...groups.get(lv)!);
        }
      }
      list.innerHTML = items.join('');
    }
    // Banner sự cố
    const ban = $('.sab-banner', this.hudEl);
    if (w.sabotage) {
      ban.hidden = false;
      const s = w.sabotage;
      ban.className = 'sab-banner ' + s.kind;
      // điện thoại dựng đứng: nằm ngay dưới khung việc, trải ngang
      if (window.innerWidth <= 600) { const tb = this.hudEl.querySelector('.tasks')?.getBoundingClientRect(); ban.style.top = `${Math.round((tb?.bottom ?? 120) + 8)}px`; } else ban.style.top = '';
      const narrow = window.innerWidth < 1000; // điện thoại: bản rút gọn một dòng
      const txt = s.kind === 'boss'
        ? (narrow ? `Về bàn · ${Math.ceil(s.t)}s · ${w.aliveCrew().filter(c => c.bossDone).length}/${w.aliveCrew().length} đã ngồi`
          : fmt('ui.sab.boss', { s: Math.ceil(s.t), done: w.aliveCrew().filter(c => c.bossDone).length, total: w.aliveCrew().length }))
        : s.kind === 'power' ? fmt('ui.sab.power') : fmt('ui.sab.wifi');
      if (s.kind === 'boss') {
        // mặt Sếp (màu thật) ở đầu dải thông báo, chữ đếm ngược bên cạnh
        if (!ban.querySelector('.sab-face')) ban.innerHTML = `<img class="sab-face" src="${avatarURL(GUARD_LOOK)}" alt="Sếp"><span class="sab-txt"></span>`;
        const t = ban.querySelector('.sab-txt') as HTMLElement;
        if (t.textContent !== txt) t.textContent = txt;
      } else if (ban.textContent !== txt) ban.textContent = txt;
    } else ban.hidden = true;
    // Biển tên tầng trượt xuống khi vừa sang tầng mới
    $('#b-map', this.hudEl).classList.toggle('alarm', !!w.sabotage && w.sabotage.kind !== 'boss' && p.role !== 'impostor');
    { const lvb = levelAt(p.x, p.y);
      if (lvb >= 1 && lvb <= 4 && lvb !== this.lastFloorBanner && w.phase === 'play') {
        const first = this.lastFloorBanner === -1;
        this.lastFloorBanner = lvb;
        if (!first) this.floorBanner(lvb);
      } }
    { const lv = levelAt(p.x, p.y); const rn = roomName(roomAt(p.x, p.y)); const t = lv === 0 ? `🛗 Thang máy · tầng ${Math.round(w.lift.pos)}${w.lift.stuck ? ' · ĐANG KẸT' : ''}` : lv === 5 ? '🪜 Thang bộ' : lv === 4 ? rn : `${levelName(lv)} · ${rn}`; const el = $('.room-name', this.hudEl); if (this.lastRoomTitle !== t) { this.lastRoomTitle = t; el.textContent = t; } }
    if (this.mapOpen) { this.drawMinimap(); if (this.sabBtns.length) this.updateSabotageMap(); }
    if (w.playerWatching !== this.camsOpen) act('watch', this.camsOpen);
    if (this.camsOpen) this.drawCams();
  }

  /** Tầng đang xem trên sơ đồ (mặc định là tầng mình đang đứng) */
  private mapFloor = 2;
  private mapFloorKey = '';
  private lastMapLevel = 0;
  private lastDeptTxt = '';
  private lastRoomTitle = '';
  private doneSeen = new Set<string>();
  private lastFloorBanner = -1;
  private renderMapFloors() {
    const w = session.world!, p = w.player;
    // Đang mở sơ đồ mà đổi tầng: sơ đồ nhảy theo tầng mới
    const nowLv = levelAt(p.x, p.y);
    if (nowLv >= 1 && nowLv <= 4 && nowLv !== this.lastMapLevel) { this.lastMapLevel = nowLv; this.mapFloor = nowLv; this.mapFloorKey = ''; }
    const box = this.hudEl.querySelector('.mm-floors') as HTMLElement;
    const myLv = levelAt(p.x, p.y) || Math.round(w.lift.pos);
    const counts = FLOORS.map(f => p.tasks.filter(t => !t.done && levelAt((station(slotStation(t)).stand.x + 0.5) * TILE, (station(slotStation(t)).stand.y + 0.5) * TILE) === f.id).length);
    const key = `${this.mapFloor}|${myLv}|${counts.join(',')}|${w.sabotage?.kind ?? ''}`;
    if (key === this.mapFloorKey) return;
    this.mapFloorKey = key;
    const sabFloor = (k: string) => k === 'power' ? 1 : k === 'wifi' ? 3 : 0;
    box.innerHTML = FLOORS.slice().reverse().map(f => {
      const i = f.id - 1;
      const alarm = w.sabotage && sabFloor(w.sabotage.kind) === f.id;
      return `<button type="button" data-f="${f.id}" class="${f.id === this.mapFloor ? 'on' : ''}${alarm ? ' alarm' : ''}">${f.id === myLv ? '📍 ' : ''}${f.name}${counts[i] && w.sabotage?.kind !== 'wifi' ? ` <i>!${counts[i]}</i>` : ''}</button>`;
    }).join('');
    box.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.onclick = () => { this.mapFloor = Number(b.dataset.f); this.mapFloorKey = ''; sfx.click(); });
  }

  private drawMinimap() {
    const w = session.world!;
    this.renderMapFloors();
    const cv = $('.minimap canvas', this.hudEl) as HTMLCanvasElement;
    const ctx = cv.getContext('2d')!;
    const F = FLOORS[this.mapFloor - 1];
    const k = cv.width / (38 * TILE);
    const ox = F.ox * TILE, oy = F.oy * TILE;
    const M = (px: number, py: number) => [(px - ox) * k, (py - oy) * k] as const; // điểm pixel bản đồ -> pixel sơ đồ
    const P = (tx: number, ty: number) => M((tx + 0.5) * TILE, (ty + 0.5) * TILE);
    const onFloor = (tx: number, ty: number) => levelAt((tx + 0.5) * TILE, (ty + 0.5) * TILE) === F.id;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#2b2e4a'; ctx.fillRect(0, 0, cv.width, cv.height);
    // Mỗi phòng một màu nhạt, hành lang xám ấm; viền đậm giữa sàn và tường
    for (let y = F.oy; y < F.oy + F.h; y++) for (let x = F.ox; x < F.ox + F.w; x++) {
      if (GRID[y * MAP_W + x] === 0) continue;
      const rid = roomAt((x + 0.5) * TILE, (y + 0.5) * TILE);
      ctx.fillStyle = GRID[y * MAP_W + x] === 2 ? '#a9a290' : mapRoomColor(rid);
      const [X, Y] = M(x * TILE, y * TILE);
      ctx.fillRect(X, Y, TILE * k + 0.6, TILE * k + 0.6);
    }
    ctx.strokeStyle = '#1d1a2b'; ctx.lineWidth = 3;
    for (let y = F.oy; y < F.oy + F.h; y++) for (let x = F.ox; x < F.ox + F.w; x++) {
      if (GRID[y * MAP_W + x] === 0) continue;
      const [X, Y] = M(x * TILE, y * TILE), s0 = TILE * k;
      if (GRID[(y - 1) * MAP_W + x] === 0) { ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + s0, Y); ctx.stroke(); }
      if (GRID[(y + 1) * MAP_W + x] === 0) { ctx.beginPath(); ctx.moveTo(X, Y + s0); ctx.lineTo(X + s0, Y + s0); ctx.stroke(); }
      if (GRID[y * MAP_W + x - 1] === 0) { ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X, Y + s0); ctx.stroke(); }
      if (GRID[y * MAP_W + x + 1] === 0) { ctx.beginPath(); ctx.moveTo(X + s0, Y); ctx.lineTo(X + s0, Y + s0); ctx.stroke(); }
    }
    // Tên phòng trong nhãn bo tròn
    ctx.font = '800 22px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const r of ROOMS) if (r.label && r.level === F.id) {
      const [X, Y0] = M((r.x + r.w / 2) * TILE, (r.y + r.h / 2) * TILE), Y = Y0 + (r.id === 'meeting' ? 60 : 0);
      const tw = ctx.measureText(r.name).width + 22;
      ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.roundRect(X - tw / 2, Y - 15, tw, 30, 15); ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#1d1a2b'; ctx.stroke();
      ctx.fillStyle = '#1d1a2b'; ctx.fillText(r.name, X, Y + 1);
    }
    const p = w.player;
    const wifiDown = w.sabotage?.kind === 'wifi';
    const sab = w.sabotage?.kind;
    const pulse = 1 + Math.sin(performance.now() / 180) * 0.15;
    const badge = (x: number, y: number, fill: string, glyph: string, size = 17, glyphColor = '#1d1a2b') => {
      // "!" là ghim việc; còn lại là icon vẽ trên đế tròn mang màu trạng thái
      if (glyph === '!') { drawTaskPin(ctx, x, y + 4, size, fill); return; }
      ctx.beginPath(); ctx.arc(x, y, size + 3, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#1d1a2b'; ctx.stroke();
      const img = mapIcon(MAP_ICON[glyph]);
      if (img && img.complete && img.naturalWidth) ctx.drawImage(img, x - size * 1.05, y - size * 1.05, size * 2.1, size * 2.1);
      else { ctx.fillStyle = glyphColor; ctx.font = `800 ${Math.round(size * 1.25)}px "Baloo 2", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(glyph, x, y + 1); }
    };
    // Lõi thang: thang máy (kèm vị trí buồng) và thang bộ
    if (F.id <= 3) {
      const [lx, ly] = P(F.ox + 16.5, F.oy + 13);
      const here = Math.abs(w.lift.pos - F.id) < 0.01;
      badge(lx, ly, here ? (w.lift.stuck ? '#e8443a' : '#8a4fd8') : '#cfd3e3', '🛗', 17);
      if (here) { ctx.fillStyle = '#fff'; ctx.font = '800 15px "Be Vietnam Pro", sans-serif'; ctx.fillText(w.lift.stuck ? 'Kẹt' : 'Buồng thang', lx, ly + 30); }
    }
    { const sx2 = F.id === 4 ? 18 : 20, sy2 = F.id === 4 ? 8 : 13; const [qx, qy] = P(F.ox + sx2, F.oy + sy2); badge(qx, qy, '#3fbf6a', '🪜', 16); }
    const sabView = this.mapMode === 'sab';
    if (sabView) {
      ctx.fillStyle = 'rgba(232,68,58,0.28)'; ctx.fillRect(0, 0, cv.width, cv.height);
      if (levelAt(p.x, p.y) === F.id) { const [X, Y] = M(p.x, p.y); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e8443a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(X, Y, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      $('.mm-note', this.hudEl).textContent = 'Chọn tầng ở trên rồi bấm biểu tượng để phá hoại. Số trên nút là giây hồi chiêu.';
      return;
    }
    // Bàn của bạn
    const desk = DESKS[p.desk];
    if (onFloor(desk.x, desk.y)) { const [X, Y] = M(desk.x * TILE, desk.y * TILE); ctx.strokeStyle = '#1f6feb'; ctx.lineWidth = 4; ctx.strokeRect(X - 2, Y - 2, 2 * TILE * k + 4, TILE * k + 4); }
    // Điểm cố định
    if (onFloor(BELL.x, BELL.y)) { const bell = P(BELL.x - 0.5, BELL.y - 0.5); badge(bell[0], bell[1], '#e8443a', '🔔', 17, '#fff'); }
    const fixed: [string, string, string, number][] = [['camera', '#9aa1c4', '📹', 17], ['power', sab === 'power' ? '#e8443a' : '#cfd3e3', '⚡', sab === 'power' ? 19 * pulse : 16], ['router', sab === 'wifi' ? '#e8443a' : '#cfd3e3', '📶', sab === 'wifi' ? 19 * pulse : 16]];
    for (const [id, col, gl, sz] of fixed) { const st = station(id); if (onFloor(st.stand.x, st.stand.y)) { const q = P(st.mark.x - 0.5, st.mark.y); badge(q[0], q[1], col, gl, sz); } }
    const isHr = p.role === 'crew' && p.dept === 'hr';
    ($('.lg-hr', this.hudEl) as HTMLElement).hidden = !isHr;
    const label = (x: number, y: number, txt: string, color: string, align: CanvasTextAlign) => {
      ctx.font = '800 18px "Be Vietnam Pro", sans-serif'; ctx.textAlign = align; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.strokeText(txt, x, y); ctx.fillStyle = color; ctx.fillText(txt, x, y); ctx.textAlign = 'center';
    };
    if (p.role === 'crew' && p.dept === 'artist') {
      const cc = station('colorcheck');
      if (onFloor(cc.stand.x, cc.stand.y)) {
        const q = P(cc.mark.x - 0.5, cc.mark.y), bl = w.artistBlocked(p);
        badge(q[0], q[1], bl ? '#ffe9a8' : '#ffd23f', '🎨', bl ? 16 : 19 * pulse);
        label(q[0] - 26, q[1], bl ? 'Chưa mở' : 'Sẵn sàng!', bl ? '#1d1a2b' : '#b8860b', 'right');
      }
    }
    if (isHr) {
      const f = station('faceid');
      if (onFloor(f.stand.x, f.stand.y)) {
        const q = P(f.mark.x - 0.5, f.mark.y);
        const wait = w.faceIdUnlockIn(), blocked = w.faceIdBlocked(p), ready = !blocked && !p.hrUsed;
        badge(q[0], q[1], ready ? '#ff5abe' : '#ffc7e8', '🪪', ready ? 19 * pulse : 17);
        label(q[0] + 26, q[1], p.hrPending ? `Chờ kết quả ${Math.ceil(p.hrPending.left)}s` : p.hrUsed ? 'Đã dùng' : wait > 0 ? `Mở sau ${Math.ceil(wait)}s` : blocked ? 'Tạm ngừng' : 'Sẵn sàng!', ready ? '#d4007a' : '#1d1a2b', 'left');
      }
    }
    // Phòng đang bị khóa cửa
    for (const room of LOCKABLE_ROOMS) {
      const R = ROOMS.find(r => r.id === room)!;
      if (R.level !== F.id) continue;
      const locked = w.doorLocks.get(room);
      if (locked !== undefined && p.role !== 'impostor') { const [lx, ly] = M((R.x + R.w / 2) * TILE, (R.y + R.h / 2) * TILE + 40); badge(lx, ly, '#e8443a', '🔒', 17); label(lx, ly + 30, `${Math.ceil(locked)}s`, '#e8443a', 'center'); }
    }
    // Việc của bạn (việc trong buồng thang máy hiện ở cửa thang)
    if (!wifiDown) for (const t of p.tasks) if (!t.done) {
      const st = station(slotStation(t));
      if (st.room === 'cabin' && F.id <= 3) { const q = P(F.ox + 17, F.oy + 12.6); badge(q[0], q[1], '#ffd23f', '!', 14); continue; }
      if (!onFloor(st.stand.x, st.stand.y)) continue;
      const q = P(st.mark.x - 0.5, st.mark.y - 0.3);
      badge(q[0], q[1], '#ffd23f', '!', 15);
    }
    // Sếp đi tuần: khoanh bàn của mình
    if (sab === 'boss' && !p.bossDone && onFloor(desk.x, desk.y)) {
      const [X, Y] = M((desk.x + 1) * TILE, (desk.y + 0.5) * TILE);
      ctx.strokeStyle = '#e8443a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(X, Y, 30 * pulse, 0, Math.PI * 2); ctx.stroke();
      // nhãn "Bàn của bạn" cạnh vòng tròn
      ctx.font = '800 15px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lw = ctx.measureText('Bàn của bạn').width + 16;
      ctx.fillStyle = '#e8443a'; ctx.beginPath(); ctx.roundRect(X - lw / 2, Y - 58, lw, 22, 11); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText('Bàn của bạn', X, Y - 47);
    }
    $('.mm-note', this.hudEl).textContent = wifiDown
      ? 'Mất kết nối: danh sách việc tạm thời không hiển thị.'
      : sab === 'boss' ? `Sếp đi tuần! ${this.deskWhere(p)} (vòng đỏ "Bàn của bạn") ngay.` : 'Bấm tên tầng ở trên để xem các tầng khác. Số trong ô tầng là số việc của bạn ở tầng đó.';
    // Bạn: mặt nhân vật trong vòng tròn, vòng sáng nhấp nháy, nhãn "Bạn"
    if (levelAt(p.x, p.y) === F.id) {
      const [X, Y] = M(p.x, p.y);
      const ring = 22 + Math.sin(performance.now() / 220) * 4;
      ctx.beginPath(); ctx.arc(X, Y, ring + 6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(232,68,58,.22)'; ctx.fill();
      ctx.beginPath(); ctx.arc(X, Y, 22, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#e8443a'; ctx.stroke();
      const face = mapAvatar(p.look);
      if (face.complete && face.naturalWidth) {
        ctx.save(); ctx.beginPath(); ctx.arc(X, Y, 19, 0, Math.PI * 2); ctx.clip();
        const fw = 46, fh = fw * face.naturalHeight / face.naturalWidth;
        ctx.drawImage(face, X - fw / 2, Y - 18, fw, fh); ctx.restore();
      }
      ctx.font = '800 17px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText('Bạn').width + 16;
      ctx.fillStyle = '#e8443a'; ctx.beginPath(); ctx.roundRect(X - tw / 2, Y - 50, tw, 22, 11); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#1d1a2b'; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillText('Bạn', X, Y - 38);
    }
  }

  // ================= ĐIỀU KHIỂN =================
  private bindInput() {
    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      const K = this.prefs.keys;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k) || Object.values(K).includes(k)) e.preventDefault();
      if (!session.world && this.lobbyHud && !session.paused) {
        if (k === 'enter') { e.preventDefault(); this.lobbyChatOpen?.(true); return; }
        if (k === K.use) this.lobbyUse();
        return;
      }
      if (!session.world || session.paused) return;
      if (k === 'escape') { closeMini(); this.toggleSabMenu(false); this.toggleMap(false); this.toggleCams(false); if (session.world.player.adminViewing) session.world.adminClose(session.world.player); }
      if (this.meetEl || miniOpen()) return;
      if (this.camsOpen) {
        if (k === 'arrowleft' || k === K.left) this.camChannel(-1);
        else if (k === 'arrowright' || k === K.right) this.camChannel(1);
        else if (k === K.use || k === K.map) this.toggleCams(false);
        return;
      }
      if ((k === 'pageup' || k === 'pagedown') && !session.world.player.alive) { e.preventDefault(); this.ghostHop?.(k === 'pageup' ? 1 : -1); return; }
      if (k === K.use) this.doUse();
      else if (k === K.report) this.doReport();
      else if (k === K.kill) this.doKill();
      else if (k === K.sab && session.world.player.role === 'impostor') this.toggleSabMenu();
      else if (k === K.hide) this.doHide();
      else if (k === K.map) this.toggleMap(undefined, 'map');
      else if (k === K.laptop) this.doLaptop();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    // rời cửa sổ hoặc chuyển tab: trình duyệt không gửi "thả phím", nên xóa sạch phím đang giữ và cần điều khiển (không để nhân vật trôi)
    // Điện thoại: nút trong giao diện chơi nhận lệnh NGAY LÚC CHẠM XUỐNG (không chờ nhấc tay), để vừa giữ cần điều khiển vừa bấm nút
    const FAST = '.hud .act, .hud .icon-btn, .hud .map-btn, .hud .lchat-btn, .hud .room-chip, .hud .vent-arrow, .hud .vent-exit';
    document.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      const b = (e.target as HTMLElement).closest?.(FAST) as HTMLButtonElement | null;
      if (!b || b.disabled) return;
      e.preventDefault();
      (b as HTMLElement & { _fast?: number })._fast = performance.now();
      b.click();
    }, true);
    document.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest?.(FAST) as (HTMLElement & { _fast?: number }) | null;
      if (b?._fast && e.isTrusted && performance.now() - b._fast < 700) { e.preventDefault(); e.stopImmediatePropagation(); } // bỏ "click" tự sinh sau khi đã bấm lúc chạm xuống
    }, true);
    const releaseAll = () => { this.keys.clear(); this.joy.x = 0; this.joy.y = 0; this.joy.active = false; session.input = { x: 0, y: 0 }; };
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  }

  /**
   * Cần điều khiển "nổi" (điện thoại): vùng nhận chạm là nửa trái màn hình, chạm xuống đâu thì vòng cần điều khiển
   * hiện ra ngay dưới ngón tay, nhấc tay thì ẩn. Vùng này nằm DƯỚI các nút (nút vẫn nhận chạm trước).
   * Mỗi ngón theo dõi riêng: ngón đang giữ cần điều khiển không bị ngón khác làm mất.
   */
  private bindJoystick(el: HTMLElement) {
    const hud = el.parentElement;
    if (hud && hud.firstElementChild !== el) hud.prepend(el); // nằm dưới mọi nút trong giao diện
    const knob = $('.joy-knob', el);
    let base = el.querySelector('.joy-base') as HTMLElement | null;
    if (!base) { base = document.createElement('div'); base.className = 'joy-base'; base.appendChild(knob); el.appendChild(base); }
    let id: number | null = null, cx = 0, cy = 0;
    const R = 52;
    el.addEventListener('pointerdown', (e) => {
      if (id !== null) return; // đã có một ngón điều khiển
      id = e.pointerId; el.setPointerCapture(id);
      cx = e.clientX; cy = e.clientY;
      const r = el.getBoundingClientRect();
      base!.style.left = `${cx - r.left}px`; base!.style.top = `${cy - r.top}px`;
      el.classList.add('on');
      this.joy.active = true; move(e);
      sfx.unlock();
      e.preventDefault();
    });
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      // vùng chết nhỏ ở giữa để chạm nhẹ không làm nhân vật trôi
      const k = d < 8 ? 0 : 1;
      this.joy.x = dx / R * k; this.joy.y = dy / R * k;
    };
    el.addEventListener('pointermove', move);
    const end = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null; this.joy.active = false; this.joy.x = 0; this.joy.y = 0;
      knob.style.transform = '';
      el.classList.remove('on');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  }

}

function fmtTime(s: number) {
  const m = Math.floor(s / 60), r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}


const howtoHtml = () => `
  <div class="rules">
    <h3>Mục tiêu</h3>
    <p><b>Nhân viên</b> thắng khi chạy đủ 100% KPI, hoặc sa thải hết Nội gián qua các cuộc họp.</p>
    <p><b>Nội gián</b> thắng khi số Nội gián còn lại bằng số Nhân viên, hoặc khi cả công ty không về bàn kịp lúc Sếp đi tuần.</p>

    <h3>Nhân viên làm gì</h3>
    <p>Tới các dấu <span class="bang">!</span> để làm việc (xem danh sách góc trên bên trái và sơ đồ). Thấy <b>ghế trống</b> của đồng nghiệp bị gài bẫy thì bấm Báo cáo. Nghi ai thì chạy về Phòng họp bấm <b>chuông họp khẩn</b> (mỗi người 1 lần mỗi ván).</p>

    <h3>Nội gián làm gì</h3>
    <p>Gài bẫy cho đồng nghiệp bị đuổi việc mà không ai thấy, chui qua các <b>lối trốn</b> (nắp trần thang máy, ống cáp, ống gió, gầm bàn, tủ đồ, trần thạch cao), và gây sự cố trên sơ đồ phá hoại:</p>
    <ul>
      <li><b>Cúp điện:</b> tầm nhìn Nhân viên còn rất nhỏ, thang máy kẹt (ai đang ở trong bị nhốt), camera, máy Face ID và máy so màu ngừng chạy. Việc thường vẫn làm được. Sửa ở tủ cầu dao trong Kho điện (Tầng 1).</li>
      <li><b>Rớt mạng:</b> tắt camera, ẩn danh sách việc. Sửa router ở Phòng Server.</li>
      <li><b>Sếp đi tuần</b> (1 lần mỗi ván): ai cũng phải về bàn trong 45 giây, không kịp là Nội gián thắng.</li>
      <li><b>Khóa cửa</b> một phòng 10 giây. Người bị nhốt quẹt thẻ ở cửa để mở sớm.</li>
    </ul>
    <p>Nội gián không có phòng ban thật nhưng có thể <b>nhận bừa</b> bất kỳ phòng ban nào khi họp.</p>
    <p><b>Hồi chiêu gài bẫy:</b> hai Nội gián bắt đầu ván và sau mỗi cuộc họp với hồi chiêu như nhau; ai vừa gài thì chỉ người đó phải chờ lại. Hồi chiêu <b>đứng yên khi đang trốn</b> trong lối trốn. Nội gián thấy trạng thái của đồng bọn trên khung việc. Lưu ý: <b>Intern tham vọng</b> (phe thứ ba) cũng gài bẫy được, nên có thể có người nghỉ việc dù Nội gián chưa ra tay.</p>

    <h3>Họp</h3>
    <p>60 giây thảo luận rồi 30 giây bỏ phiếu. Gõ tên hoặc mã số (vd: #333) để buộc tội hay bênh vực. Người bị nhiều phiếu nhất bị sa thải; hòa phiếu hoặc đa số bỏ qua thì không ai bị sa thải.</p>

    <h3>Phòng ban bí mật</h3>
    <p>Mỗi ván, hệ thống bốc ngẫu nhiên một số vai có kỹ năng cho Nhân viên (chỉnh ở máy tính lễ tân). Ai được vai gì chỉ người đó biết; danh sách vai có trong ván thì công khai.</p>
    <div class="role-cards">${([...SPECIAL_ROLES, 'intern'] as RoleDept[]).map(r => `<div class="role-card"><b>${ROLE_INFO[r].icon} ${ROLE_INFO[r].name}</b><p>${ROLE_INFO[r].ability}</p><ul>${ROLE_INFO[r].rules.map(x => `<li>${x}</li>`).join('')}</ul></div>`).join('')}</div>

    <h3>Điều khiển</h3>
    <p class="keys">Máy tính: WASD hoặc phím mũi tên để đi, E làm việc, R báo cáo, Q gài bẫy, F phá hoại, Space trốn, Tab sơ đồ, C kỹ năng phòng ban. Đổi phím trong menu 🎮 Điều khiển. Điện thoại: cần điều khiển ảo bên trái, nút bấm bên phải.</p>
  </div>`;

/** Khung chỉnh ngoại hình (máy thay đồ): 5 thẻ lớn, thẻ con, lưới hình thu nhỏ, bảng màu theo món */
function avatarEditorHtml(): string {
  return `<div class="ae">
    <div class="ae-left">
      <div class="ae-stage"><canvas class="ae-canvas" width="240" height="${Math.ceil(CHAR_H * 3) + 8}" aria-label="Xem trước nhân vật"></canvas></div>
      <div class="ae-tools">
        <button type="button" class="ae-tool" data-a="turn" title="Xoay nhân vật">🔄 Xoay</button>
        <button type="button" class="ae-tool" data-a="undo" title="Hoàn tác">↩️ Hoàn tác</button>
        <button type="button" class="ae-tool" data-a="random" title="Ngẫu nhiên">🎲 Ngẫu nhiên</button>
        <button type="button" class="ae-tool danger" data-a="reset" title="Đặt lại mặc định">🧹 Đặt lại</button>
      </div>
    </div>
    <div class="ae-right">
      <div class="ae-tabs" role="tablist">
        <button type="button" data-t="hair">💇<span>Tóc</span></button><button type="button" data-t="skin">🧴<span>Da</span></button>
        <button type="button" data-t="clothes">👕<span>Quần áo</span></button><button type="button" data-t="acc">🕶️<span>Phụ kiện</span></button>
        <button type="button" data-t="body">🐸<span>Skin</span></button>
      </div>
      <div class="ae-subs" role="tablist"></div>
      <div class="ae-grid"></div>
      <div class="ae-colors"></div>
    </div>
  </div>`;
}

type AeTab = 'hair' | 'skin' | 'clothes' | 'acc' | 'body';
const AE_SUBS: Record<AeTab, { id: string; name: string }[]> = {
  hair: [], skin: [], body: [],
  clothes: [{ id: 'top', name: 'Áo' }, { id: 'bottom', name: 'Quần' }],
  acc: (['head', 'eyes', 'ears', 'face', 'neck', 'hand', 'back'] as Slot[]).map(s => ({ id: s, name: SLOT_NAMES[s] })),
};
/** Ô thu nhỏ chỉ cần nhìn phần trên người với các món ở đầu, mặt */
const UPPER: string[] = ['head', 'eyes', 'ears', 'face', 'hair', 'skin'];

function mountAvatarEditor(root: HTMLElement, get: () => Look, set: (l: Look) => void, confirmFn: (t: string, m: string) => Promise<boolean>) {
  const cv = root.querySelector('.ae-canvas') as HTMLCanvasElement;
  const grid = root.querySelector('.ae-grid') as HTMLElement;
  const colorsEl = root.querySelector('.ae-colors') as HTMLElement;
  const subsEl = root.querySelector('.ae-subs') as HTMLElement;
  let tab: AeTab = get().body === 'human' ? 'clothes' : 'body', sub = tab === 'clothes' ? 'top' : '', facing = 1;
  const locked = (t: AeTab) => t !== 'body' && get().body !== 'human';
  const history: Look[] = [];
  const clone = (l: Look): Look => JSON.parse(JSON.stringify(l));
  const apply = (l: Look) => { history.push(clone(get())); if (history.length > 40) history.shift(); set(l); refresh(); };

  // Ảnh xem trước dùng một nhân vật MẪU cố định (người, da sáng, tóc đen ngắn, đồ cơ bản), chỉ đổi đúng món đang xem;
  // không lấy theo nhân vật hiện tại của người chơi
  const baseOf = (src: Look): Look => {
    const b = clone(src);
    b.body = 'human'; b.bodyColor = SKINS[1]; b.marks = []; b.hairStyle = HAIR_STYLES[0].id; b.hair = HAIR_COLORS[0];
    for (const slot of Object.keys(b.items) as Slot[]) { const d = ITEMS[slot][0]; b.items[slot] = { id: d.id, color: defaultColor(d, '#2e9cf0') }; }
    return b;
  };
  const thumb = (look: Look, upper: boolean) => {
    const full = characterCanvas(look, 0, upper ? 1.5 : 0.85);
    if (!upper) return full.toDataURL();
    const c = document.createElement('canvas'); c.width = full.width; c.height = Math.round((CHAR_TOP + 48.5) * 1.5); // đầu và vai
    c.getContext('2d')!.drawImage(full, 0, 0); return c.toDataURL();
  };
  const swatch = (val: string, on: boolean, label: string) => {
    const [a, b] = colors2(val);
    return `<button type="button" class="ae-sw${on ? ' on' : ''}" data-c="${val}" aria-label="${label}" style="--a:${a};--b:${b}"></button>`;
  };

  const renderPreview = () => {
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const img = characterCanvas(get(), 0, 3);
    ctx.save();
    if (facing < 0) { ctx.translate(cv.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(img, (cv.width - img.width) / 2, 4);
    ctx.restore();
  };

  const renderSubs = () => {
    const list = AE_SUBS[tab];
    subsEl.hidden = !list.length || locked(tab);
    subsEl.innerHTML = list.map(x => `<button type="button" data-s="${x.id}" class="${x.id === sub ? 'on' : ''}">${x.name}${x.id !== 'top' && x.id !== 'bottom' && get().items[x.id as Slot].id !== 'none' ? ' •' : ''}</button>`).join('');
    subsEl.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.onclick = () => { sub = b.dataset.s!; sfx.click(); refresh(); });
  };

  const renderGrid = () => {
    const L = get();
    let html = '', colors = '';
    if (locked(tab)) {
      grid.innerHTML = `<div class="ae-locked"><div class="ae-lock-ic">🔒</div><p>Đang dùng skin <b>${bodyDef(L.body).name}</b>, nên không mặc được đồ của người.</p><p>Chọn <b>Skin → Người</b> để thay đồ. Quần áo và phụ kiện cũ của bạn vẫn được giữ nguyên.</p><button type="button" class="primary ae-to-human">Quay về Người</button></div>`;
      grid.classList.remove('marks-mode');
      colorsEl.innerHTML = '';
      (grid.querySelector('.ae-to-human') as HTMLElement).onclick = () => { const L2 = clone(get()); L2.body = 'human'; L2.bodyColor = SKINS[2]; sfx.click(); apply(L2); };
      return;
    }
    if (tab === 'hair') {
      const hairOk = bodyDef(L.body).hasHair;
      html = HAIR_STYLES.map(h => { const v = { ...baseOf(L), hairStyle: h.id }; return cell(h.id, h.name, thumb(v, true), L.hairStyle === h.id); }).join('');
      colors = `<small>Màu tóc</small><div class="ae-sws">${HAIR_COLORS.map(c => swatch(c, L.hair === c, 'Màu tóc')).join('')}</div>`
        + (hairOk ? '' : `<p class="ae-note">Skin "${bodyDef(L.body).name}" không có tóc. Chọn Skin → Người để thấy kiểu tóc.</p>`);
    } else if (tab === 'skin') {
      html = `<div class="ae-marks">${MARKS.map(m => `<button type="button" class="ae-mark${L.marks.includes(m.id) ? ' on' : ''}" data-m="${m.id}"><img src="${thumb({ ...baseOf(L), marks: [m.id] }, true)}" alt=""><span>${m.name}</span></button>`).join('')}</div>`;
      const bd = bodyDef(L.body);
      colors = bd.human
        ? `<small>Màu da · 6 tông tự nhiên và 19 màu vui</small><div class="ae-sws">${SKIN_TONES.map(c => swatch(c, L.bodyColor === c, 'Màu da')).join('')}</div><p class="ae-note">Chi tiết da có thể chọn nhiều cái cùng lúc.</p>`
        : `<p class="ae-note">Đang dùng skin "${bd.name}". Màu chỉnh ở thẻ Skin.</p>`;
    } else if (tab === 'body') {
      html = BODIES.map(b => { const v = { ...baseOf(L), body: b.id, bodyColor: b.id === 'human' ? SKINS[1] : b.def }; return cell(b.id, b.name, thumb(v, false), L.body === b.id); }).join('');
      colors = L.body === 'human' ? '<p class="ae-note">Người: màu da chỉnh ở thẻ Da. Chọn một skin để biến thành thứ khác cho vui.</p>' : colorRow(bodyDef(L.body), L.bodyColor, 'Màu skin');
    } else {
      const slot = sub as Slot;
      html = ITEMS[slot].map(d => {
        const v = baseOf(L); v.items[slot] = { id: d.id, color: defaultColor(d, '#2e9cf0') };
        return cell(d.id, d.name, thumb(v, UPPER.includes(slot)), L.items[slot].id === d.id);
      }).join('');
      colors = colorRow(itemDef(slot, L.items[slot].id), L.items[slot].color, `Màu ${SLOT_NAMES[slot].toLowerCase()}`);
    }
    grid.innerHTML = html;
    grid.classList.toggle('marks-mode', tab === 'skin');
    colorsEl.innerHTML = colors;
    // Gắn sự kiện
    grid.querySelectorAll<HTMLButtonElement>('.ae-cell').forEach(b => b.onclick = () => {
      const L2 = clone(get()); const id = b.dataset.id!;
      if (tab === 'hair') L2.hairStyle = id;
      else if (tab === 'body') { const d = bodyDef(id); L2.body = id; L2.bodyColor = d.id === get().body ? get().bodyColor : d.id === 'human' ? SKINS[2] : d.def; }
      else { const slot = sub as Slot; L2.items[slot] = { id, color: defaultColor(itemDef(slot, id), get().items[slot].color) }; }
      sfx.click(); apply(L2);
    });
    grid.querySelectorAll<HTMLButtonElement>('.ae-mark').forEach(b => b.onclick = () => {
      const L2 = clone(get()); const m = b.dataset.m!;
      L2.marks = L2.marks.includes(m) ? L2.marks.filter(x => x !== m) : [...L2.marks, m];
      sfx.click(); apply(L2);
    });
    colorsEl.querySelectorAll<HTMLButtonElement>('.ae-sw').forEach(b => b.onclick = () => {
      const L2 = clone(get()); const col = b.dataset.c!;
      if (tab === 'hair') L2.hair = col;
      else if (tab === 'skin' || tab === 'body') L2.bodyColor = col;
      else L2.items[sub as Slot].color = col;
      sfx.click(); apply(L2);
    });
  };
  const cell = (id: string, name: string, src: string, on: boolean) =>
    `<button type="button" class="ae-cell${on ? ' on' : ''}" data-id="${id}" title="${name}"><img src="${src}" alt=""><span>${name}</span></button>`;
  const colorRow = (d: ItemDef, cur: string, label: string) => {
    if (d.id === 'none') return '';
    if (d.color === 'fixed') return `<p class="ae-note">Món "${d.name}" có màu cố định.</p>`;
    if (d.color === 'free') return `<small>${label}</small><div class="ae-sws">${PALETTE.map(c => swatch(c, cur === c, label)).join('')}</div>`;
    return `<small>${label} · phối màu cài sẵn</small><div class="ae-sws">${(d.color as string[]).map(c => swatch(c, cur === c, label)).join('')}</div>`;
  };

  const refresh = () => {
    root.querySelectorAll<HTMLButtonElement>('.ae-tabs button').forEach(b => { b.classList.toggle('on', b.dataset.t === tab); b.classList.toggle('locked', locked(b.dataset.t as AeTab)); });
    renderPreview(); renderSubs(); renderGrid();
  };
  root.querySelectorAll<HTMLButtonElement>('.ae-tabs button').forEach(b => b.onclick = () => {
    tab = b.dataset.t as AeTab; const subs = AE_SUBS[tab]; sub = subs.length ? subs[0].id : ''; sfx.click(); refresh();
  });
  root.querySelectorAll<HTMLButtonElement>('.ae-tool').forEach(b => b.onclick = () => {
    const a = b.dataset.a;
    if (a === 'turn') { facing = -facing; renderPreview(); sfx.whoosh(); }
    if (a === 'undo') { const prev = history.pop(); if (prev) { set(prev); refresh(); sfx.click(); } }
    if (a === 'random') { apply(randomLook()); sfx.whoosh(); }
    if (a === 'reset') {
      confirmFn('Đặt lại nhân vật?', 'Nhân vật về trạng thái gốc: người, da mặc định, tóc ngắn, không quần áo và phụ kiện. Có thể bấm Hoàn tác để lấy lại.').then(ok => {
        if (!ok) return;
        apply(DEFAULT_LOOK()); tab = 'clothes'; sub = 'top'; refresh(); sfx.whoosh();
      });
    }
  });
  refresh();
}

/** Cảnh nền màn hình chính: tòa nhà văn phòng lúc hoàng hôn, cửa sổ sáng đèn tăng ca */
function titleBackdrop(): string {
  let rnd = 7;
  const r = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; };
  const win = (x: number, y: number, cols: number, rows: number, w: number, h: number, gap: number, lit: number) => {
    let o = '';
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const on = r() < lit;
      o += `<rect x="${x + i * (w + gap)}" y="${y + j * (h + gap)}" width="${w}" height="${h}" rx="2" fill="${on ? '#ffd86b' : '#3a3e62'}"${on ? ' class="lit"' : ''}/>`;
    }
    return o;
  };
  // dãy nhà phía xa lặp thêm hai bên (hình rộng gấp đôi để luôn co giãn theo chiều cao, không cắt đỉnh tòa nhà)
  const farBase = [[0, 330, 140, 270], [130, 260, 120, 340], [240, 360, 160, 240], [380, 300, 110, 300], [1160, 280, 130, 320], [1280, 350, 150, 250], [1420, 240, 180, 360]];
  const far = [...farBase, ...farBase.map(([x, y, w, h]) => [x - 1600, y, w, h]), ...farBase.map(([x, y, w, h]) => [x + 1600, y, w, h])]
    .map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#3b2f5c"/>${win(x + 14, y + 20, Math.floor((w - 20) / 22), Math.floor((h - 40) / 30), 12, 18, 10, 0.3)}`).join('');
  const tower = `<rect x="800" y="70" width="480" height="530" fill="#2b2e4a" stroke="#1d1a2b" stroke-width="8"/>
    <rect x="840" y="20" width="400" height="56" rx="10" fill="#ffe36e" stroke="#1d1a2b" stroke-width="7"/>
    <text x="1040" y="60" text-anchor="middle" font-family="Baloo 2, Trebuchet MS, sans-serif" font-weight="800" font-size="40" fill="#1d1a2b">${esc(fmt('ui.title.tower'))}</text>
    ${win(830, 100, 10, 12, 30, 26, 14, 0.45)}
    <rect x="960" y="520" width="160" height="80" fill="#9fd6ff" stroke="#1d1a2b" stroke-width="6"/><line x1="1040" y1="520" x2="1040" y2="600" stroke="#1d1a2b" stroke-width="5"/>`;
  const mid = [[670, 230, 120, 370], [1280, 200, 130, 400]]
    .map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#4a3f75" stroke="#1d1a2b" stroke-width="6"/>${win(x + 14, y + 20, 4, Math.floor((h - 40) / 34), 18, 22, 10, 0.4)}`).join('');
  return `<div class="ts-sky"><i class="ts-sun"></i></div>
    <svg class="ts-city" viewBox="-800 0 3200 640" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      ${far}${mid}${tower}
      <rect x="-800" y="600" width="3200" height="40" fill="#1d1a2b"/>
      <rect x="-800" y="596" width="3200" height="8" fill="#c9a77c"/>
    </svg>`;
}
