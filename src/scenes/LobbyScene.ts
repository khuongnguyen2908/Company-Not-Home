// Sảnh chờ tầng G: trong nhà (sảnh công ty) và ngoài phố (vỉa hè, đường xe chạy, trạm xe buýt).
// Người chơi xuống xe buýt rồi đi bộ vào qua cửa kính tự động. Trong sảnh: thay đồ, cài đặt phòng,
// ngồi sofa, vài món nghịch vặt, chat bằng bong bóng. Tới thang máy để bắt đầu ca.
import Phaser from 'phaser';
import { session } from '../session';
import { characterCanvas, shadowCanvas, lookKey, lookColor, type Look, CHAR_ORIGIN_Y } from '../render/chars';
import { ICON_ART } from '../ui/icons';
import { furnitureArt, drawAnim, Pen, shade } from '../render/furniture';
import { drawVehicle, drawCat } from '../render/street';
import { sfx } from '../audio';
import { net } from '../net/room';
import { LOBBY_LINES, LOBBY_REPLIES, BUS_JOKES, normalize } from '../game/data';

const T = 48;
const W = 20, H = 16;
const INK = 0x1d1a2b;
const SPEED = 205;
const SCALE = 0.78;
const LANE_Y = [13.6 * T, 14.95 * T]; // làn sát vỉa hè (trái → phải), làn xa (phải → trái)

// ---------- Lưới va chạm: 0 chặn, 1 sàn ----------
const GRID = new Uint8Array(W * H);
const setRect = (x: number, y: number, w: number, h: number, v: number) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < W && j < H) GRID[j * W + i] = v; };
setRect(1, 1, 18, 9, 1);   // trong sảnh
setRect(9, 10, 2, 1, 1);   // cửa kính
setRect(0, 11, 20, 2, 1);  // vỉa hè
interface Furn { kind: string; x: number; y: number; w: number; h: number }
const FURN: Furn[] = [
  { kind: 'counter', x: 2, y: 4, w: 4, h: 1 },
  { kind: 'wardrobe', x: 16, y: 1, w: 2, h: 2 }, { kind: 'mirror', x: 18, y: 1, w: 1, h: 2 },
  { kind: 'aquarium', x: 1, y: 6, w: 1, h: 2 }, { kind: 'cooler', x: 18, y: 6, w: 1, h: 1 },
  { kind: 'sofa', x: 5, y: 7, w: 3, h: 1 }, { kind: 'table', x: 6, y: 6, w: 1, h: 1 },
  { kind: 'sofa', x: 12, y: 7, w: 3, h: 1 }, { kind: 'table', x: 13, y: 6, w: 1, h: 1 },
  { kind: 'plant', x: 1, y: 1, w: 1, h: 1 }, { kind: 'plant', x: 1, y: 9, w: 1, h: 1 }, { kind: 'plant', x: 18, y: 9, w: 1, h: 1 },
  { kind: 'busstop', x: 2, y: 11, w: 1, h: 1 }, { kind: 'bench', x: 14, y: 11, w: 2, h: 1 },
  { kind: 'tree', x: 5, y: 11, w: 1, h: 1 }, { kind: 'tree', x: 17, y: 11, w: 1, h: 1 },
];
for (const f of FURN) setRect(f.x, f.y, f.w, f.h, 0);

const floorAt = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < W && ty < H && GRID[ty * W + tx] === 1;
const canStand = (px: number, py: number) => {
  for (const [x, y] of [[px - 11, py - 7], [px + 11, py - 7], [px - 11, py + 7], [px + 11, py + 7]]) if (!floorAt(Math.floor(x / T), Math.floor(y / T))) return false;
  return true;
};
/** Tìm đường trên lưới sảnh (BFS 4 hướng), trả về các tâm ô */
function findPath(fx: number, fy: number, tx: number, ty: number): { x: number; y: number }[] | null {
  const s = Math.floor(fy / T) * W + Math.floor(fx / T), g = ty * W + tx;
  if (!floorAt(tx, ty)) return null;
  const prev = new Int32Array(W * H).fill(-2);
  const q = [s]; prev[s] = -1;
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    if (c === g) break;
    const cx = c % W, cy = (c / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, n = ny * W + nx;
      if (!floorAt(nx, ny) || prev[n] !== -2) continue;
      prev[n] = c; q.push(n);
    }
  }
  if (prev[g] === -2) return null;
  const out: { x: number; y: number }[] = [];
  for (let c = g; c !== -1 && c !== s; c = prev[c]) out.push({ x: (c % W) * T + T / 2, y: ((c / W) | 0) * T + T / 2 });
  return out.reverse();
}

// ---------- Ba chỗ tương tác lớn (có biển nổi) ----------
export const LOBBY_SPOTS = {
  wardrobe: { x0: 16, y0: 1, x1: 19, y1: 3, x: 17 * T, y: 3.75 * T, label: 'Thay đồ', icon: 'hanger' },
  board: { x0: 2, y0: 4, x1: 4.6, y1: 5, x: 3.3 * T, y: 3.1 * T, label: 'Cài đặt phòng', icon: 'computer' },
  elevator: { x0: 8, y0: 0, x1: 12, y1: 1, x: 10 * T, y: 2.15 * T, label: 'Bắt đầu làm việc', icon: 'punchclock' },
};
type SpotKey = keyof typeof LOBBY_SPOTS;

// Chỗ ngồi: sofa trong sảnh, ghế đá ngoài vỉa hè
const SEATS = [
  ...[5, 6, 7].map(x => ({ x, y: 7, kind: 'sofa' as const })),
  ...[12, 13, 14].map(x => ({ x, y: 7, kind: 'sofa' as const })),
  ...[14, 15].map(x => ({ x, y: 11, kind: 'bench' as const })),
];
// Tương tác nhỏ: không biển, chỉ lấp lánh khi đứng sát
const MINI = [
  { key: 'bell', x: 5.6, y: 4.35, icon: 'bell', label: 'Bấm chuông' },
  { key: 'water', x: 18.5, y: 6.5, icon: 'cup', label: 'Lấy nước' },
  { key: 'fish', x: 1.5, y: 7, icon: 'fish', label: 'Gõ kính' },
  { key: 'plant:0', x: 1.5, y: 9.5, icon: 'plant', label: 'Tưới cây' },
  { key: 'plant:1', x: 18.5, y: 9.5, icon: 'plant', label: 'Tưới cây' },
  { key: 'bus', x: 2.5, y: 11.5, icon: 'bus', label: 'Xem giờ xe' },
];

interface Mover {
  id: number; phase: number; x: number; y: number; facing: 1 | -1; moving: boolean; walkT: number; look: Look; name: string; empId: string;
  sprite: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; tag: Phaser.GameObjects.Text;
  path: { x: number; y: number }[]; wait: number; seat: number | null; arrived: boolean; cupUntil: number; isMe: boolean;
  /** sảnh online: người thật ở máy khác (mã máy), điều khiển bằng trạng thái nhận qua mạng */
  peer?: string;
}
interface Vehicle { kind: 'car' | 'moto' | 'bus' | 'taxi'; lane: 0 | 1; x: number; v: number; color: number; len: number;
  stopAt?: number; state: 'drive' | 'stopped' | 'leave'; t: number; drop?: Mover[]; dropped?: number; roll: number; door: number }
interface Bubble { m: Mover; text: string; until: number; born: number; mine: boolean; mention: boolean; g: Phaser.GameObjects.Graphics; nameT: Phaser.GameObjects.Text; msgT: Phaser.GameObjects.Text }

export class LobbyScene extends Phaser.Scene {
  private me: Mover | null = null;
  private bots: Mover[] = [];
  private version = -1;
  private myKey = '';
  private camX = 10 * T; private camY = 12 * T;
  private zoom = 1;
  private spotLabels = new Map<string, Phaser.GameObjects.Text>();
  private spotIcons = new Map<string, Phaser.GameObjects.Image>();
  private glow!: Phaser.GameObjects.Graphics;
  private signGlow!: Phaser.GameObjects.Graphics;
  private sparkle: Phaser.GameObjects.Image | null = null;
  private dynG!: Phaser.GameObjects.Graphics;      // cửa kính, cửa thang máy
  private carG!: Phaser.GameObjects.Graphics;      // xe cộ
  private fxG!: Phaser.GameObjects.Graphics;       // hiệu ứng nhỏ (sóng chuông, giọt nước)
  private floorText!: Phaser.GameObjects.Text;
  private screenText!: Phaser.GameObjects.Text;
  private infoKey = '';
  private vehicles: Vehicle[] = [];
  private nextCar = 1;
  private arrivals: { kind: 'bus' | 'taxi'; people: Mover[]; stopX: number }[] = [];
  private seats: (number | null)[] = SEATS.map(() => null);
  private catSeat = 5;
  private catT = 0;
  private fishScare = 0;
  private plantShake = [0, 0];
  private doorOpen = 0;
  private bubbles: Bubble[] = [];
  private chatT = 22;
  private fx: { kind: 'ring' | 'drop' | 'text'; x: number; y: number; t: number; vx?: number; vy?: number; obj?: Phaser.GameObjects.Text }[] = [];
  private cut: null | { t: number; stage: 'walk' | 'enter' | 'close' | 'ride' | 'fade'; floor: number; done: () => void; doorsOpen: number } = null;

  /** Mã phiên dựng sảnh: tăng mỗi lần vào sảnh, đặt về -1 khi sảnh tắt. Ảnh tạo xong chỉ được đặt nếu phiên còn sống. */
  private session = 0;
  private live = -1;
  private alive(token: number) { return token === this.live; }
  /** đang ở sảnh của phòng chơi nhiều người mà mình không phải chủ phòng */
  private guestOnline() { return session.lobby.online && net.role === 'client'; }

  constructor() { super('lobby'); }

  create() {
    const token = ++this.session; this.live = token;
    this.events.once('shutdown', () => { if (this.live === token) this.live = -1; });
    this.me = null; this.bots = []; this.version = -1; this.myKey = ''; this.cut = null;
    this.vehicles = []; this.arrivals = []; this.seats = SEATS.map(() => null); this.bubbles = []; this.fx = []; this.infoKey = '';
    this.catG = null; this.sparkle = null; this.doorOpen = 0; this.chatT = 22; // cảnh được dựng lại mỗi lần vào sảnh
    this.catSeat = 5; this.seats[this.catSeat] = -99; // mèo nằm trên sofa
    if (!this.textures.exists('shadow')) this.textures.addCanvas('shadow', shadowCanvas());
    this.drawStatic();
    this.glow = this.add.graphics().setDepth(-30);
    this.dynG = this.add.graphics().setDepth(-36);
    this.carG = this.add.graphics().setDepth(-20);
    this.fxG = this.add.graphics().setDepth(45000);
    this.signGlow = this.add.graphics().setDepth(39990);
    this.spotLabels = new Map(); this.spotIcons = new Map();
    for (const [k, sp] of Object.entries(LOBBY_SPOTS)) {
      this.spotLabels.set(k, this.add.text(sp.x, sp.y + 34, sp.label.toUpperCase(), {
        fontFamily: '"Baloo 2", "Trebuchet MS", sans-serif', fontSize: '19px', fontStyle: '800', color: '#ffffff', stroke: '#1d1a2b', strokeThickness: 7,
      }).setOrigin(0.5, 0.5).setDepth(40000));
      this.iconTexture(sp.icon, () => { if (this.alive(token)) this.spotIcons.set(k, this.add.image(sp.x, sp.y - 6, 'ico_' + sp.icon).setDisplaySize(58, 58).setDepth(40000)); });
    }
    this.iconTexture('sparkle', () => { if (this.alive(token)) this.sparkle = this.add.image(0, 0, 'ico_sparkle').setDisplaySize(26, 26).setDepth(40001).setVisible(false); });
    this.iconTexture('cat', () => undefined);
    // Bảng số tầng trên thang máy (mặc định G), màn hình phòng, bảng Nhân viên của tháng
    // Mũi tên chỉ cửa, chỉ hiện khi bạn đang đứng ngoài vỉa hè
    this.doorArrowG = this.add.graphics().setDepth(39995);
    this.doorArrowT = this.add.text(10 * T, 0, 'VÀO CÔNG TY', { fontFamily: '"Baloo 2", sans-serif', fontSize: '18px', fontStyle: '800', color: '#ffe36e', stroke: '#1d1a2b', strokeThickness: 6 }).setOrigin(0.5, 1).setDepth(39996).setVisible(false);
    this.floorText = this.add.text(10 * T, 0.2 * T, 'G', { fontFamily: '"Baloo 2", sans-serif', fontSize: '15px', fontStyle: '800', color: '#ffe36e' }).setOrigin(0.5, 0.5).setDepth(-34);
    this.screenText = this.add.text(14.8 * T, 0.48 * T, '', { fontFamily: '"Be Vietnam Pro", sans-serif', fontSize: '11px', fontStyle: '700', color: '#bfe6ff', align: 'center', lineSpacing: 2 }).setOrigin(0.5, 0.5).setDepth(-34).setVisible(false); // bỏ màn hình thông tin phòng (đã có khung góc trái)
    const onResize = () => this.layout();
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => { this.scale.off('resize', onResize); session.lobby.nearInfo = null; });
    this.layout();
    this.cameras.main.fadeIn(350, 5, 6, 13);
  }

  /** Tạo ảnh từ icon vẽ để dùng trong cảnh */
  private iconTexture(name: string, ready: () => void) {
    const key = 'ico_' + name;
    if (this.textures.exists(key)) { ready(); return; }
    const img = new Image();
    img.onload = () => { if (!this.textures.exists(key)) this.textures.addImage(key, img); ready(); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 64 64">${ICON_ART[name]}</svg>`);
  }

  private layout() {
    const w = this.scale.width, h = this.scale.height;
    this.zoom = Phaser.Math.Clamp(Math.min(w / 760, h / 600), 0.6, 1.3);
    this.cameras.main.setZoom(this.zoom);
  }

  private box(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fill: number, r = 6, lw = 3.5) {
    g.fillStyle(fill, 1); g.fillRoundedRect(x, y, w, h, r);
    g.lineStyle(lw, INK, 1); g.strokeRoundedRect(x, y, w, h, r);
  }

  // ---------- Vẽ phần cố định ----------
  private drawStatic() {
    const g = this.add.graphics().setDepth(-100);
    // Sàn trong sảnh: đá kẻ ô ấm
    for (let y = 1; y <= 9; y++) for (let x = 1; x <= 18; x++) { g.fillStyle((x + y) % 2 ? 0xefe4d0 : 0xe4d6bd, 1); g.fillRect(x * T, y * T, T, T); }
    // Thảm đỏ từ cửa kính tới thang máy
    g.fillStyle(0xc0392b, 0.9); g.fillRect(9 * T + 6, 1 * T, 2 * T - 12, 10 * T);
    g.lineStyle(3, 0xe8c547, 1); g.strokeRect(9 * T + 6, 1 * T, 2 * T - 12, 10 * T);
    const P = new Pen(g, 0, 0);
    // Tường trong cùng: mảng tường, chân tường tối, đèn tường
    g.fillStyle(0x8a90b4, 1); g.fillRect(0, 0, W * T, T);
    g.fillStyle(0x6d7398, 1); g.fillRect(0, T - 12, W * T, 12);
    P.line(0, T - 12, W * T, T - 12, INK, 2.5); P.line(0, T, W * T, T, INK, 3.5);
    for (const x of [1.5, 6.8, 18.3]) { P.box(x * T - 8, 0.18 * T, 16, 12, 0xfff3a0, 4, 2.5); g.fillStyle(0xfff3a0, 0.18); g.fillCircle(x * T, 0.3 * T + 6, 22); }
    g.fillStyle(0x2b2e4a, 1); g.fillRect(0, T, T, 10 * T); g.fillRect(19 * T, T, T, 10 * T);
    P.line(T, T, T, 10 * T, INK, 3.5); P.line(19 * T, T, 19 * T, 10 * T, INK, 3.5);
    // Thang máy: khung kim loại có mái, bảng số tầng, nút gọi bên cạnh
    P.box(8.25 * T, 0.02 * T, 3.5 * T, 1.02 * T, 0xc9ccd8, 8, 3.5);
    P.fill(8.25 * T + 4, 0.02 * T + 3, 3.5 * T - 8, 8, shade(0xc9ccd8, 0.3), 1, 4);
    P.box(9.5 * T, 0.03 * T, 1.0 * T, 0.32 * T, 0x1d1a2b, 4, 2.5);
    P.box(11.85 * T, 0.32 * T, 16, 26, 0x9aa1b4, 4, 2.5); P.poly([11.85 * T + 8, 0.32 * T + 6, 11.85 * T + 3, 0.32 * T + 14, 11.85 * T + 13, 0.32 * T + 14], 0xffe36e, 1.5);
    // Mặt tiền kính: khung trên dưới, ô kính có vệt sáng chéo
    g.fillStyle(0x9fd6ff, 0.8); g.fillRect(0, 10 * T, W * T, T);
    for (let x = 0; x < W; x++) {
      if (x === 9 || x === 10) continue;
      P.line(x * T + 10, 10 * T + 34, x * T + 22, 10 * T + 12, 0xffffff, 3, 0.55);
      P.line(x * T, 10 * T, x * T, 11 * T, 0x4b5070, 4);
    }
    P.fill(0, 10 * T, W * T, 7, 0x4b5070); P.fill(0, 11 * T - 6, W * T, 6, 0x4b5070);
    P.line(0, 10 * T, W * T, 10 * T, INK, 3.5); P.line(0, 11 * T, W * T, 11 * T, INK, 3.5);
    // Khung cửa kính tự động
    P.box(9 * T - 6, 10 * T - 4, 2 * T + 12, 10, 0x4b5070, 3, 3);
    // Vỉa hè: gạch sáng có mạch, nắng
    for (let y = 11; y <= 12; y++) for (let x = 0; x < W; x++) { g.fillStyle((x + y) % 2 ? 0xf3efe6 : 0xe9e4d8, 1); g.fillRect(x * T, y * T, T, T); g.lineStyle(1.5, 0xd6cfbf, 1); g.strokeRect(x * T, y * T, T, T); }
    // Lòng đường, bó vỉa (mặt trên sáng, mặt bên tối), lan can có trụ
    g.fillStyle(0x4b4a55, 1); g.fillRect(0, 13 * T, W * T, 3 * T);
    for (let i = 0; i < 90; i++) { g.fillStyle(0x5a5965, 1); g.fillCircle((i * 97) % (W * T), 13 * T + 20 + ((i * 53) % (2.6 * T)), 1.5); }
    P.fill(0, 13 * T - 8, W * T, 6, 0xd6d3cb); P.fill(0, 13 * T - 2, W * T, 8, 0x9a978f);
    P.line(0, 13 * T - 8, W * T, 13 * T - 8, INK, 2.5); P.line(0, 13 * T + 6, W * T, 13 * T + 6, INK, 2.5);
    for (let x = 0; x < W * 2; x++) { if (x === 18 || x === 19 || x === 20 || x === 21) continue; P.box(x * T / 2 + 8, 13 * T - 26, 6, 18, 0x9aa1b4, 2, 2); }
    P.line(0, 13 * T - 22, 9 * T, 13 * T - 22, INK, 4); P.line(11 * T, 13 * T - 22, W * T, 13 * T - 22, INK, 4);
    P.line(0, 13 * T - 22, 9 * T, 13 * T - 22, 0xc9ccd8, 2); P.line(11 * T, 13 * T - 22, W * T, 13 * T - 22, 0xc9ccd8, 2);
    // Vạch qua đường trước cửa, vạch chia làn
    for (let i = 0; i < 6; i++) P.fill(9 * T + 4 + i * 15, 13 * T + 10, 9, 2.6 * T, 0xf1efe8, 0.85);
    for (let x = 0; x < W; x++) if (x < 9 || x > 10) P.fill(x * T + 6, 14.3 * T - 2, 24, 4, 0xf1efe8);
    // Đồ đạc: mỗi món là một ảnh riêng (cùng bộ vẽ với văn phòng), thứ tự che khuất theo mép dưới
    this.furnAnims = [];
    FURN.forEach((f, i) => {
      const kind = f.kind === 'cooler' ? 'watercooler' : f.kind;
      const Wd = f.w * T, Hd = f.h * T;
      const art = furnitureArt(kind, Wd, Hd);
      const key = `lfu_${kind}_${Wd}_${Hd}`;
      if (!this.textures.exists(key)) {
        const tg = this.make.graphics({ x: 0, y: 0 }, false);
        art.draw(new Pen(tg, art.pad + art.left, art.pad + art.up));
        tg.generateTexture(key, Wd + art.left + art.right + art.pad * 2, Hd + art.up + art.pad * 2);
        tg.destroy();
      }
      const X = f.x * T, Y = f.y * T;
      const depth = art.seatDepth ? Y + 2 : Y + Hd;
      this.add.image(X - art.pad - art.left, Y - art.up - art.pad, key).setOrigin(0, 0).setDepth(depth);
      if (art.anims.length) this.furnAnims.push({ f, g: this.add.graphics().setDepth(depth + 0.5), anims: art.anims, seed: i * 1.37 });
    });
  }
  private furnAnims: { f: Furn; g: Phaser.GameObjects.Graphics; anims: ReturnType<typeof furnitureArt>['anims']; seed: number }[] = [];

  // ---------- Nhân vật ----------
  private ensureTex(look: Look) {
    const key = 'ch_' + lookKey(look).replace(/[^a-z0-9]/gi, '');
    for (const f of [0, 1, 2] as const) if (!this.textures.exists(`${key}_${f}`)) this.textures.addCanvas(`${key}_${f}`, characterCanvas(look, f));
    return key;
  }
  private makeMover(id: number, name: string, empId: string, look: Look, isMe: boolean): Mover {
    const key = this.ensureTex(look);
    const shadow = this.add.image(-500, -500, 'shadow');
    const sprite = this.add.image(-500, -500, `${key}_0`).setOrigin(0.5, CHAR_ORIGIN_Y).setScale(SCALE);
    const tag = this.add.text(-500, -500, `${name} #${empId}`, {
      fontFamily: '"Baloo 2", "Trebuchet MS", sans-serif', fontSize: '16px', fontStyle: '800', color: '#ffffff', padding: { x: 2, y: 1 }, stroke: '#1d1a2b', strokeThickness: 5,
    }).setOrigin(0.5, 1);
    sprite.setVisible(false); shadow.setVisible(false); tag.setVisible(false);
    return { id, phase: Math.random() * 10, x: -500, y: -500, facing: 1, moving: false, walkT: 0, look, name, empId, sprite, shadow, tag, path: [], wait: 1 + Math.random() * 3, seat: null, arrived: false, cupUntil: 0, isMe };
  }
  private destroyMover(m: Mover) { m.sprite.destroy(); m.shadow.destroy(); m.tag.destroy(); if (m.seat !== null) this.seats[m.seat] = null; for (const b of this.bubbles.filter(x => x.m === m)) this.killBubble(b); }

  private syncPeople() {
    const L = session.lobby;
    if (!L.me.look) return;
    if (L.online) {
      // sảnh online: bỏ hết bot của sảnh chơi một mình (cảnh có thể đang chạy sẵn từ trước)
      for (const b of this.bots.filter(x => !x.peer)) this.destroyMover(b);
      this.bots = this.bots.filter(x => x.peer);
      this.arrivals = this.arrivals.filter(a => a.people.every(m => m.isMe || m.peer));
      this.syncRemote(); if (this.me) { this.syncMe(); return; }
    } else if (this.bots.some(x => x.peer)) {
      // rời phòng online, về sảnh chơi một mình: bỏ người của phòng cũ, dựng lại bot
      for (const b of this.bots.filter(x => x.peer)) this.destroyMover(b);
      this.bots = this.bots.filter(x => !x.peer);
      this.version = -1;
    }
    if (!this.me) {
      this.me = this.makeMover(0, L.me.name, L.me.empId, L.me.look, true);
      this.myKey = lookKey(L.me.look) + L.me.name + L.me.empId;
      this.version = L.version;
      if (L.online) {
        // sảnh online: mình tới bằng xe buýt; người khác đã được dựng riêng (đứng sẵn hoặc đi taxi tới)
        this.arrivals.unshift({ kind: 'bus', people: [this.me], stopX: 2.6 * T }); // chuyến của mình luôn tới trước
        return;
      }
      this.bots = L.bots.map((p, i) => this.makeMover(i + 1, p.name, p.empId, p.look, false));
      // Xe buýt chở bạn và vài đồng nghiệp tới, phần còn lại đi taxi
      this.arrivals.push({ kind: 'bus', people: [this.me, ...this.bots.slice(0, 3)], stopX: 2.6 * T });
      for (let i = 3; i < this.bots.length; i += 3) this.arrivals.push({ kind: 'taxi', people: this.bots.slice(i, i + 3), stopX: (i % 2 ? 13.5 : 6.5) * T });
      return;
    }
    this.syncMe();
    if (this.version !== L.version && !L.online) {
      this.version = L.version;
      this.syncBots();
    }
  }
  /** Ngoại hình / tên của mình đổi (thay đồ, đổi mã số) */
  private syncMe() {
    const L = session.lobby;
    if (!this.me || !L.me.look) return;
    const k = lookKey(L.me.look) + L.me.name + L.me.empId;
    if (k !== this.myKey) {
      this.myKey = k;
      this.me.look = L.me.look; this.me.name = L.me.name; this.me.empId = L.me.empId;
      this.ensureTex(L.me.look);
      this.me.tag.setText(`${L.me.name} #${L.me.empId}`);
    }
  }
  private syncBots() {
    const L = session.lobby;
    {
      // Giữ những bot vẫn còn, bot mới đi taxi tới, bot bị bớt thì về
      const keep: Mover[] = [];
      const fresh: Mover[] = [];
      L.bots.forEach((p, i) => {
        const old = this.bots.find(b => b.name === p.name);
        if (old) { old.look = p.look; old.empId = p.empId; old.tag.setText(`${p.name} #${p.empId}`); this.ensureTex(p.look); keep.push(old); }
        else { const m = this.makeMover(100 + this.version * 20 + i, p.name, p.empId, p.look, false); keep.push(m); fresh.push(m); }
      });
      for (const b of this.bots) if (!keep.includes(b)) this.destroyMover(b);
      this.bots = keep;
      for (let i = 0; i < fresh.length; i += 3) this.arrivals.push({ kind: 'taxi', people: fresh.slice(i, i + 3), stopX: (6 + Math.random() * 8) * T });
    }
  }

  // ---------- Sảnh online: người thật ở máy khác ----------
  private remoteSeq = 1000;
  /** Dựng / bỏ / cập nhật người khác theo danh sách nhận qua mạng */
  private syncRemote() {
    const R = session.lobby.remote;
    for (const b of [...this.bots]) if (b.peer && !R.has(b.peer)) { this.destroyMover(b); this.bots = this.bots.filter(x => x !== b); } // người đã rời phòng
    for (const [peer, r] of R) {
      let m = this.bots.find(b => b.peer === peer);
      if (!m) {
        if (!r.s) continue; // chưa nhận được trạng thái của người này: chưa dựng
        m = this.makeMover(this.remoteSeq++, r.name, r.empId, r.look, false);
        m.peer = peer;
        this.bots.push(m);
        // Không đặt xe riêng cho người khác: họ hiện ra đúng chỗ xuống xe ở máy họ rồi bước vào theo đúng đường họ đi
        m.arrived = false; m.x = r.s.x; m.y = r.s.y;
      }
      const key = lookKey(r.look) + r.name + r.empId + (r.lost ? '!' : '');
      if ((m as Mover & { netKey?: string }).netKey !== key) {
        (m as Mover & { netKey?: string }).netKey = key;
        m.look = r.look; m.name = r.name; m.empId = r.empId; this.ensureTex(r.look);
        m.tag.setText(r.lost ? `${r.name} #${r.empId} · mất kết nối` : `${r.name} #${r.empId}`);
      }
      m.tag.setAlpha(r.lost ? 0.55 : 1);
    }
  }
  /** Người khác: đi mượt tới vị trí họ gửi, ngồi đúng ghế, cầm cốc nước */
  private driveRemote(m: Mover, dt: number) {
    const s = session.lobby.remote.get(m.peer!)?.s;
    if (!s) return;
    if (!m.arrived) {
      // ở máy họ vừa xuống xe: hiện ra ở đó (mờ dần vào), từ đây đi theo trạng thái
      if (!s.arrived) { m.sprite.setAlpha(0); m.shadow.setAlpha(0); m.tag.setAlpha(0); return; }
      m.arrived = true; m.x = s.x; m.y = s.y;
      m.sprite.setVisible(true); m.shadow.setVisible(true); m.tag.setVisible(true);
      this.tweens.add({ targets: [m.sprite, m.shadow, m.tag], alpha: 1, duration: 350 });
    }
    if (this.cut) return;
    if (s.seat !== null && m.seat !== s.seat) { this.standUp(m); this.sit(m, s.seat); }
    if (s.seat === null && m.seat !== null) this.standUp(m);
    if (m.seat === null) {
      const d = Math.hypot(s.x - m.x, s.y - m.y);
      if (d > 3 * T) { m.x = s.x; m.y = s.y; } else { const k = Math.min(1, dt * 12); m.x += (s.x - m.x) * k; m.y += (s.y - m.y) * k; }
      m.facing = s.f; m.moving = !!s.m || d > 4;
      if (m.moving) m.walkT += dt;
    }
    m.cupUntil = s.cup ? this.time.now + 500 : 0;
  }
  /** Người khác chat: bong bóng trên đầu họ */
  remoteSay(peer: string, text: string) {
    const m = this.bots.find(b => b.peer === peer);
    if (!m || !m.arrived) return;
    this.say(m, text);
    session.lobby.onChat?.({ name: m.name, empId: m.empId, text, me: false });
  }
  /** Người khác nghịch đồ: hiệu ứng ở máy mình */
  remoteFx(_peer: string, key: string) { this.playFx(key); }

  private step(m: Mover, ix: number, iy: number, dt: number) {
    const len = Math.hypot(ix, iy);
    if (len < 0.05) { m.moving = false; return; }
    const sp = SPEED * dt * Math.min(1, len);
    const dx = (ix / len) * sp, dy = (iy / len) * sp;
    if (Math.abs(dx) > 0.01) m.facing = dx > 0 ? 1 : -1;
    if (canStand(m.x + dx, m.y)) m.x += dx;
    if (canStand(m.x, m.y + dy)) m.y += dy;
    m.moving = true; m.walkT += dt;
  }
  /** Đi theo lộ trình đã tìm; trả về true khi tới nơi */
  private follow(m: Mover, dt: number, speed = 0.6): boolean {
    const p = m.path[0];
    if (!p) { m.moving = false; return true; }
    const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy), st = SPEED * speed * dt;
    if (d <= st) { m.x = p.x; m.y = p.y; m.path.shift(); }
    else { m.x += dx / d * st; m.y += dy / d * st; if (Math.abs(dx) > 1) m.facing = dx > 0 ? 1 : -1; }
    m.moving = true; m.walkT += dt;
    return m.path.length === 0;
  }
  private goTo(m: Mover, tx: number, ty: number) { m.path = findPath(m.x, m.y, tx, ty) ?? []; }
  private randomInside() {
    for (let i = 0; i < 40; i++) { const x = 2 + Math.floor(Math.random() * 16), y = 2 + Math.floor(Math.random() * 7); if (floorAt(x, y)) return { x, y }; }
    return { x: 10, y: 5 };
  }

  private draw(m: Mover) {
    const vis = m.arrived || m.sprite.visible;
    if (!vis) return;
    let look = m.look;
    if (m.cupUntil > this.time.now) look = { ...m.look, items: { ...m.look.items, hand: { id: 'coffee', color: '#ffffff' } } };
    const key = this.ensureTex(look);
    const frame = m.moving ? (Math.floor(m.walkT * 7) % 2 === 0 ? 1 : 2) : 0;
    const fl = m.look.body === 'ghost' ? Math.sin(this.time.now / 320 + m.phase) * 4 - 5 : 0;
    const seated = m.seat !== null;
    m.sprite.setTexture(`${key}_${frame}`).setFlipX(m.facing < 0);
    if (seated) {
      // Ngồi: giữ nguyên hình người, chỉ đặt lên trên lớp ghế; chân thả xuống trước mép đệm
      const s0 = SEATS[m.seat!];
      m.sprite.setPosition(m.x, s0.y * T + (s0.kind === 'sofa' ? 44 : 42) + fl).setDepth(m.y);
    } else m.sprite.setPosition(m.x, m.y + 6 + fl).setDepth(m.y);
    if (m.look.body === 'slime') m.sprite.setScale(SCALE * (1 + Math.sin(this.time.now / 260) * 0.025), SCALE * (1 - Math.sin(this.time.now / 260) * 0.03)); else m.sprite.setScale(SCALE);
    m.shadow.setPosition(m.x, m.y + 4).setDepth(m.y - 1).setVisible(!seated && m.sprite.visible);
    // Thẻ tên luôn ngay trên đầu (lúc ngồi đầu thấp hơn vì thân hạ xuống đệm)
    const headY = seated ? m.sprite.y - 70 : m.y - 64;
    m.tag.setPosition(m.x, headY).setDepth(30000 + m.y);
  }

  // ---------- Ngồi ----------
  private sit(m: Mover, i: number) {
    if (this.seats[i] !== null) return false;
    if (m.seat !== null) this.seats[m.seat] = null;
    this.seats[i] = m.id; m.seat = i; m.path = []; m.moving = false;
    m.x = SEATS[i].x * T + T / 2; m.y = SEATS[i].y * T + T / 2 - (SEATS[i].kind === 'sofa' ? 2 : 0);
    return true;
  }
  private standUp(m: Mover) {
    if (m.seat === null) return;
    const s = SEATS[m.seat]; this.seats[m.seat] = null; m.seat = null;
    const ty = s.kind === 'bench' ? s.y + 1 : (floorAt(s.x, s.y - 1) ? s.y - 1 : s.y + 1);
    m.x = s.x * T + T / 2; m.y = ty * T + T / 2;
  }

  // ---------- Xe cộ, xe buýt, taxi ----------
  private spawnVehicle(lane: 0 | 1, kind: Vehicle['kind'], extra: Partial<Vehicle> = {}) {
    const len = kind === 'bus' ? 4.2 * T : kind === 'moto' ? 0.9 * T : 1.9 * T;
    const dir = lane === 0 ? 1 : -1;
    const v = kind === 'bus' ? 150 : kind === 'moto' ? 240 + Math.random() * 60 : 190 + Math.random() * 70;
    const colors = [0xe2412f, 0x2e9cf0, 0x3fbf6a, 0xffffff, 0x8a4fd8, 0x2d3142, 0xff9ec4];
    this.vehicles.push({ kind, lane, x: dir > 0 ? -len : W * T + len, v: v * dir, color: kind === 'taxi' ? 0xffd23f : kind === 'bus' ? 0xffc93c : colors[Math.floor(Math.random() * colors.length)], len, state: 'drive', t: 0, roll: 0, door: 0, ...extra });
  }
  /** Hướng chạy của làn: làn 0 sang phải, làn 1 sang trái */
  private laneDir(lane: 0 | 1) { return lane === 0 ? 1 : -1; }
  /** Đầu làn còn trống để xe mới vào (không sinh xe chồng lên xe khác) */
  private laneFree(lane: 0 | 1) {
    const startX = lane === 0 ? -2 * T : (W + 2) * T;
    return !this.vehicles.some(o => o.lane === lane && Math.abs(o.x - startX) < o.len / 2 + 3.5 * T);
  }
  /** Tốc độ tối đa để không đâm vào xe phía trước cùng làn (giữ khoảng cách, dừng chờ khi xe trước đỗ) */
  private followCap(v: Vehicle) {
    const dir = this.laneDir(v.lane);
    let gap = Infinity;
    for (const o of this.vehicles) {
      if (o === v || o.lane !== v.lane) continue;
      const ahead = (o.x - v.x) * dir;
      if (ahead <= 0) continue;
      gap = Math.min(gap, ahead - (o.len + v.len) / 2);
    }
    return gap < 18 ? 0 : Math.max(0, (gap - 18) * 3);
  }
  private vehiclesTick(dt: number) {
    // Xe chở người tới (mỗi lúc một chuyến)
    const busy = this.vehicles.some(v => v.drop);
    if (!busy && this.arrivals.length && this.laneFree(0)) {
      const a = this.arrivals.shift()!;
      this.spawnVehicle(0, a.kind, { stopAt: a.stopX, drop: a.people, dropped: 0, v: a.kind === 'bus' ? 230 : 260 });
    }
    // Xe chạy qua để phố sống động (làn sát vỉa hè tạm nhường khi có xe đang đỗ)
    this.nextCar -= dt;
    if (this.nextCar <= 0) {
      this.nextCar = 1.4 + Math.random() * 2.6;
      const lane: 0 | 1 = this.vehicles.some(v => v.drop) ? 1 : (Math.random() < 0.5 ? 0 : 1);
      const r = Math.random();
      if (this.laneFree(lane)) { this.spawnVehicle(lane, r < 0.15 ? 'bus' : r < 0.32 ? 'taxi' : 'car'); if (Math.random() < 0.12) sfx.honk(); }
    }
    for (const v of this.vehicles) {
      v.t += dt;
      const cap = this.followCap(v);
      if (v.stopAt !== undefined && v.state === 'drive') {
        const dist = v.stopAt - v.x;
        const sp = Math.min(cap, Math.max(30, Math.min(Math.abs(v.v), dist * 2.2)));
        v.x += sp * dt; v.roll += sp * dt;
        if (dist < 3) { v.x = v.stopAt; v.state = 'stopped'; v.t = 0; if (v.kind === 'bus') sfx.busBrake(); }
        continue;
      }
      if (v.state === 'stopped') {
        // Thả từng người xuống vỉa hè
        const n = v.drop?.length ?? 0;
        if (v.drop && v.dropped! < n && v.t > 0.5 + v.dropped! * 0.3) {
          const m = v.drop[v.dropped!];
          const ox = (v.dropped! - (n - 1) / 2) * 0.8 * T;
          m.x = Phaser.Math.Clamp(v.x + ox, 0.6 * T, (W - 0.6) * T); m.y = 12.35 * T;
          if (!canStand(m.x, m.y)) m.x = v.x;
          m.arrived = true; m.sprite.setVisible(true).setAlpha(0); m.tag.setVisible(true);
          this.tweens.add({ targets: m.sprite, alpha: 1, duration: 250 });
          if (!m.isMe) { const t = this.randomInside(); this.goTo(m, t.x, t.y); m.wait = 0; }
          sfx.pop();
          v.dropped!++;
        }
        if (v.t > 0.8 + n * 0.3) { v.state = 'leave'; v.drop = undefined; }
        continue;
      }
      // chạy bình thường hoặc rời đi (tăng tốc dần)
      const target = v.state === 'leave' ? Math.abs(v.v) : Math.abs(v.v);
      const cur = Math.min(cap, v.state === 'leave' ? Math.min(target, 40 + v.t * 160) : target);
      v.x += cur * Math.sign(v.v || 1) * dt; v.roll += cur * dt;
    }
    this.vehicles = this.vehicles.filter(v => v.x > -6 * T && v.x < (W + 6) * T);
    // Vẽ (làn xa trước, làn gần sau để xe gần che xe xa)
    const g = this.carG; g.clear();
    const pen = new Pen(g, 0, 0);
    for (const v of [...this.vehicles].sort((a, b) => a.lane - b.lane)) {
      const dir: 1 | -1 = v.lane === 0 ? 1 : -1;
      // cửa xe buýt mở khi đang đỗ thả khách; thân xe nhún nhẹ ngay lúc vừa phanh
      v.door = Phaser.Math.Clamp(v.door + (v.state === 'stopped' && v.kind === 'bus' ? 1 : -1) * dt * 3, 0, 1);
      const bob = v.state === 'stopped' && v.t < 0.35 ? Math.sin(v.t * 18) * 2 * (1 - v.t / 0.35) : 0;
      drawVehicle(pen, v.kind, v.x, LANE_Y[v.lane], v.len, v.color, dir, v.roll, v.door, bob);
    }
  }

  // ---------- Bong bóng chat: mỗi người một bong bóng, tối đa 4 cái đầy đủ, tự né nhau ----------
  say(m: Mover, text: string, mine = false) {
    const clean = text.trim().slice(0, 120);
    if (!clean) return;
    for (const b of this.bubbles.filter(x => x.m === m)) this.killBubble(b);
    const meName = session.lobby.me.name;
    const mention = !mine && !!meName && normalize(clean).includes(normalize(meName));
    const g = this.add.graphics().setDepth(50000);
    const nameT = this.add.text(0, 0, m.name, { fontFamily: '"Be Vietnam Pro", sans-serif', fontSize: '10px', fontStyle: '800', color: '#6b6880' }).setDepth(50001);
    const msgT = this.add.text(0, 0, '', { fontFamily: '"Be Vietnam Pro", sans-serif', fontSize: '13px', fontStyle: '700', color: '#1d1a2b', wordWrap: { width: 170, useAdvancedWrap: true }, maxLines: 2 }).setDepth(50001);
    const dur = Math.min(6000, 2800 + clean.length * 55);
    this.bubbles.push({ m, text: clean, until: this.time.now + dur, born: this.time.now, mine, mention, g, nameT, msgT });
  }
  private killBubble(b: Bubble) { b.g.destroy(); b.nameT.destroy(); b.msgT.destroy(); this.bubbles = this.bubbles.filter(x => x !== b); }
  /** Mốc đặt bong bóng: lúc ngồi thân hạ thấp nên mốc cũng hạ theo */
  private headBase(m: Mover) { return m.seat !== null ? m.sprite.y - 6 : m.y; }
  private bubblesTick() {
    const now = this.time.now;
    for (const b of [...this.bubbles]) if (now > b.until || !b.m.sprite.visible) this.killBubble(b);
    const live = [...this.bubbles].sort((a, b) => Number(b.mine || b.mention) - Number(a.mine || a.mention) || b.born - a.born);
    const full = live.slice(0, 4), compact = live.slice(4);
    const crowded = live.length >= 3;
    const shown = new Set<Mover>();
    // Không né nhau: bong bóng nằm ngay trên đầu người nói, tin mới hơn nằm đè lên tin cũ
    const order = [...full].sort((a, c) => a.born - c.born);
    order.forEach((b, rank) => {
      let txt = b.text;
      if (crowded && !b.mine && !b.mention && txt.length > 20) txt = txt.slice(0, 18) + '…';
      else if (txt.length > 44) txt = txt.slice(0, 42) + '…';
      if (b.msgT.text !== txt) b.msgT.setText(txt);
      const w = Math.max(b.msgT.width, b.nameT.width) + 16, h = b.msgT.height + b.nameT.height + 10;
      const r = { x: b.m.x - w / 2, y: this.headBase(b.m) - 74 - h, w, h };
      const fade = Math.min(1, (b.until - now) / 400);
      const z = 50000 + rank * 3;
      b.g.clear().setAlpha(fade).setDepth(z);
      b.g.fillStyle(0xffffff, 1); b.g.fillRoundedRect(r.x, r.y, r.w, r.h, 10);
      b.g.lineStyle(b.mention ? 4 : 3, b.mention ? 0xf2b705 : INK, 1); b.g.strokeRoundedRect(r.x, r.y, r.w, r.h, 10);
      const tx = b.m.x;
      b.g.fillStyle(0xffffff, 1); b.g.fillTriangle(tx - 7, r.y + r.h - 2, tx + 7, r.y + r.h - 2, b.m.x, this.headBase(b.m) - 62);
      b.g.lineStyle(3, b.mention ? 0xf2b705 : INK, 1); b.g.lineBetween(tx - 7, r.y + r.h, b.m.x, this.headBase(b.m) - 62); b.g.lineBetween(tx + 7, r.y + r.h, b.m.x, this.headBase(b.m) - 62);
      b.nameT.setPosition(r.x + 8, r.y + 4).setAlpha(fade).setVisible(true).setDepth(z + 1);
      b.msgT.setPosition(r.x + 8, r.y + 4 + b.nameT.height).setAlpha(fade).setVisible(true).setDepth(z + 1);
      shown.add(b.m);
    });
    for (const b of compact) {
      // Quá đông: thu lại thành chấm "…" nhỏ trên đầu
      b.nameT.setVisible(false); b.msgT.setVisible(false);
      b.g.clear().setAlpha(1);
      b.g.fillStyle(0xffffff, 1); b.g.fillRoundedRect(b.m.x - 16, this.headBase(b.m) - 96, 32, 18, 9);
      b.g.lineStyle(2.5, INK, 1); b.g.strokeRoundedRect(b.m.x - 16, this.headBase(b.m) - 96, 32, 18, 9);
      b.g.fillStyle(INK, 1); for (let i = -1; i <= 1; i++) b.g.fillCircle(b.m.x + i * 7, this.headBase(b.m) - 87, 2.2);
    }
    // Đang có bong bóng đầy đủ thì ẩn thẻ tên (tên đã nằm trong bong bóng)
    for (const m of [this.me, ...this.bots]) if (m && m.arrived) m.tag.setVisible(!shown.has(m) && !this.cut);
  }
  /** Gọi từ khung chat của giao diện */
  chatSay(text: string) {
    if (!this.me || !this.me.arrived) return;
    this.say(this.me, text, true);
    session.lobby.onChat?.({ name: this.me.name, empId: this.me.empId, text, me: true });
    if (session.lobby.online) { session.lobby.sendChat?.(text); return; } // sảnh online: người thật đọc, bot không đáp
    // Nhắc tên bot thì bot đáp lại
    const n = normalize(text);
    const hit = this.bots.find(b => b.arrived && n.includes(normalize(b.name)));
    if (hit) this.time.delayedCall(1200 + Math.random() * 900, () => this.botSay(hit, LOBBY_REPLIES[Math.floor(Math.random() * LOBBY_REPLIES.length)]));
  }
  private botSay(m: Mover, text: string) {
    if (!m.arrived || this.live < 0) return;
    this.say(m, text);
    session.lobby.onChat?.({ name: m.name, empId: m.empId, text, me: false });
  }

  // ---------- Tương tác nhỏ ----------
  interact(key: string) {
    const me = this.me; if (!me) return;
    if (key.startsWith('sit:')) { const i = Number(key.slice(4)); if (this.sit(me, i)) sfx.pop(); return; }
    if (key === 'bell' || key === 'cat' || key === 'fish' || key.startsWith('plant:')) { this.playFx(key); if (session.lobby.online) session.lobby.sendFx?.(key); return; }
    if (key === 'water') {
      me.cupUntil = this.time.now + 20000; sfx.splash();
      this.say(me, 'Ực ực… 💧', true);
      this.waterFx();
      if (session.lobby.online) session.lobby.sendFx?.('water');
      return;
    }
    if (key === 'bus') { this.say(me, BUS_JOKES[Math.floor(Math.random() * BUS_JOKES.length)], true); return; }
  }
  /** Bình nước: bọt nước sủi lên trong bình, giọt nước bay lên */
  private waterFx() {
    const x = 18.5 * T, y = 6.2 * T;
    for (let k = 0; k < 6; k++) {
      const b = this.add.circle(x + (Math.random() - 0.5) * 14, y + 6, 3 + Math.random() * 3, 0xbfe6ff, 0.95).setStrokeStyle(1.5, 0x2e9cf0).setDepth(40000);
      this.tweens.add({ targets: b, y: y - 34 - Math.random() * 16, alpha: 0, scale: 0.6, duration: 650 + k * 90, delay: k * 70, ease: 'Sine.easeOut', onComplete: () => b.destroy() });
    }
    const d = this.add.text(x, y - 20, '💧', { fontSize: '22px' }).setOrigin(0.5).setDepth(40001);
    this.tweens.add({ targets: d, y: y - 70, alpha: 0, duration: 1100, ease: 'Sine.easeOut', onComplete: () => d.destroy() });
  }
  /** Hiệu ứng nghịch đồ dùng chung (mình làm, hoặc người khác làm trong sảnh online) */
  private playFx(key: string) {
    if (key === 'water') { this.waterFx(); return; }
    if (key === 'bell') { sfx.ting(); this.fx.push({ kind: 'ring', x: 5.6 * T, y: 4.2 * T, t: 0 }); this.popText(5.6 * T, 3.6 * T, 'ting!'); return; }
    if (key === 'cat') {
      sfx.meow(); this.catT = 1.2; this.popText(SEATS[this.catSeat].x * T + T / 2, SEATS[this.catSeat].y * T - 6, 'meo~');
      if (Math.random() < 0.35) { const free = SEATS.map((_, i) => i).filter(i => this.seats[i] === null && SEATS[i].kind === 'sofa'); if (free.length) { this.seats[this.catSeat] = null; this.catSeat = free[Math.floor(Math.random() * free.length)]; this.seats[this.catSeat] = -99; } }
      return;
    }
    if (key === 'fish') { this.fishScare = 1.6; sfx.tapGlass(); return; }
    if (key.startsWith('plant:')) {
      const i = Number(key.slice(6)); this.plantShake[i] = 0.9; sfx.splash();
      const px = (i ? 18.5 : 1.5) * T, py = 9.2 * T;
      for (let k = 0; k < 7; k++) this.fx.push({ kind: 'drop', x: px + (Math.random() - 0.5) * 20, y: py - 20, t: 0, vx: (Math.random() - 0.5) * 120, vy: -120 - Math.random() * 80 });
      return;
    }
  }
  private popText(x: number, y: number, s: string) {
    const t = this.add.text(x, y, s, { fontFamily: '"Baloo 2", sans-serif', fontSize: '18px', fontStyle: '800', color: '#ffe36e', stroke: '#1d1a2b', strokeThickness: 5 }).setOrigin(0.5).setDepth(46000);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }
  private fxTick(dt: number) {
    const g = this.fxG; g.clear();
    for (const f of this.fx) {
      f.t += dt;
      if (f.kind === 'ring') { g.lineStyle(3, 0xffe36e, 1 - f.t / 0.6); g.strokeCircle(f.x, f.y, 10 + f.t * 60); }
      if (f.kind === 'drop') { f.vy! += 500 * dt; f.x += f.vx! * dt; f.y += f.vy! * dt; g.fillStyle(0x5fb8ff, 1 - f.t / 0.7); g.fillCircle(f.x, f.y, 3.5); }
    }
    this.fx = this.fx.filter(f => f.t < 0.7);
    // Đồ động: cửa kính tự động, cửa thang máy, bể cá, cây, mèo
    const dg = this.dynG; dg.clear();
    const people = [this.me, ...this.bots].filter((m): m is Mover => !!m && m.arrived);
    const nearDoor = people.some(m => Math.hypot(m.x - 10 * T, m.y - 10.5 * T) < 1.7 * T);
    this.doorOpen = Phaser.Math.Clamp(this.doorOpen + (nearDoor ? 1 : -1) * dt * 4, 0, 1);
    const D = new Pen(dg, 0, 0);
    // Cửa kính tự động: hai cánh trượt, có tay nắm và vệt sáng
    const pw = (T - 2) * (1 - this.doorOpen);
    if (pw > 2) {
      for (const [x0, w0] of [[9 * T, pw], [11 * T - pw, pw]] as const) {
        D.box(x0, 10 * T + 2, w0, T - 6, 0xd8f3ff, 2, 3);
        D.line(x0 + 6, 10 * T + 36, x0 + Math.min(w0 - 4, 18), 10 * T + 12, 0xffffff, 3, 0.7);
      }
      D.box(9 * T + pw - 8, 10 * T + 16, 4, 16, 0x4b5070, 1, 1.5); D.box(11 * T - pw + 4, 10 * T + 16, 4, 16, 0x4b5070, 1, 1.5);
    }
    // Cửa thang máy: kim loại xước, khe giữa, mở khi cả nhóm bước vào
    const L = this.cut ? this.cut.doorsOpen : 0;
    const ew = 1.45 * T * (1 - L);
    D.fill(8.55 * T, 0.4 * T, 2.9 * T, 0.62 * T, 0xfff3c4);
    if (ew > 2) {
      D.box(8.55 * T, 0.4 * T, ew, 0.62 * T, 0xe9edf5, 2, 2.5); D.box(11.45 * T - ew, 0.4 * T, ew, 0.62 * T, 0xe9edf5, 2, 2.5);
      for (let i = 0; i < 3; i++) { D.line(8.55 * T + 6, 0.4 * T + 6 + i * 8, 8.55 * T + Math.max(8, ew - 6), 0.4 * T + 6 + i * 8, 0xc9ccd8, 1.5); D.line(11.45 * T - ew + 6, 0.4 * T + 6 + i * 8, 11.45 * T - 6, 0.4 * T + 6 + i * 8, 0xc9ccd8, 1.5); }
    }
    D.line(8.55 * T, 0.4 * T, 11.45 * T, 0.4 * T, INK, 3);
    // Chuyển động của đồ đạc (cá, lá cây, bong bóng nước, vệt sáng gương...)
    this.fishScare = Math.max(0, this.fishScare - dt);
    this.plantShake[0] = Math.max(0, this.plantShake[0] - dt); this.plantShake[1] = Math.max(0, this.plantShake[1] - dt);
    const t = this.time.now / 1000;
    for (const fa of this.furnAnims) {
      fa.g.clear();
      const kick = fa.f.kind === 'aquarium' ? Math.min(1, this.fishScare) : fa.f.kind === 'plant' && fa.f.y === 9 ? Math.min(1, this.plantShake[fa.f.x === 1 ? 0 : 1]) : 0;
      const pen = new Pen(fa.g, fa.f.x * T, fa.f.y * T);
      for (const a of fa.anims) drawAnim(pen, a, t, { power: true, wifi: false, seed: fa.seed, kick });
    }
    // Mèo nằm trên đệm sofa: ngủ cuộn tròn, được vuốt thì vươn vai vẫy đuôi
    this.catT = Math.max(0, this.catT - dt);
    if (!this.catG) this.catG = this.add.graphics();
    const cs = SEATS[this.catSeat];
    this.catG.clear().setDepth(cs.y * T + 3);
    drawCat(new Pen(this.catG, 0, 0), cs.x * T + T / 2, cs.y * T + 22, t, this.catT > 0 ? 1 - this.catT / 1.2 : 0);
  }
  private catG: Phaser.GameObjects.Graphics | null = null;
  private doorArrowG!: Phaser.GameObjects.Graphics;
  private doorArrowT!: Phaser.GameObjects.Text;
  private doorArrowTick() {
    const me = this.me;
    const outside = !!me && me.arrived && me.y > 10.9 * T && !this.cut;
    this.doorArrowT.setVisible(outside);
    const g = this.doorArrowG.clear();
    if (!outside) return;
    const bob = Math.sin(this.time.now / 180) * 6;
    const x = 10 * T, y = 9.2 * T + bob; // mũi tên ngay trên cửa kính, chĩa xuống cửa
    g.fillStyle(0xffe36e, 1); g.lineStyle(4, INK, 1);
    const pts = [{ x: x - 10, y: y - 26 }, { x: x + 10, y: y - 26 }, { x: x + 10, y: y - 6 }, { x: x + 22, y: y - 6 }, { x, y: y + 16 }, { x: x - 22, y: y - 6 }, { x: x - 10, y: y - 6 }];
    g.fillPoints(pts, true); g.strokePoints(pts, true);
    this.doorArrowT.setPosition(x, y - 32);
  }

  // ---------- Màn hình phòng, bảng Nhân viên của tháng ----------
  private infoTick() {
    const I = session.lobby.info, me = session.lobby.me;
    const key = JSON.stringify(I) + me.name + (me.look ? lookKey(me.look) : '');
    if (key === this.infoKey) return;
    this.infoKey = key;
    this.screenText.setText(`${I.title.toUpperCase()} · ${I.people}/${I.max} NGƯỜI\n${I.imps} Nội gián · ${I.roles} vai có kỹ năng`);
  }

  // ---------- Cảnh thang máy lúc vào ca ----------
  playElevator(done: () => void) {
    if (this.cut || !this.me) { done(); return; }
    this.cut = { t: 0, stage: 'walk', floor: 0, done, doorsOpen: 0 };
    const people = [this.me, ...this.bots];
    people.forEach((m, i) => {
      this.standUp(m);
      if (!m.arrived) { m.arrived = true; m.sprite.setVisible(true); m.tag.setVisible(true); m.x = 10 * T; m.y = 12.3 * T; }
      const slot = (i % 5) - 2, row = Math.floor(i / 5);
      const tx = 10 + Math.round(slot * 0.9) - (slot < 0 ? 1 : 0), ty = 2 + row;
      m.path = findPath(m.x, m.y, Phaser.Math.Clamp(tx, 8, 11), ty) ?? [];
      (m as Mover & { slot?: { x: number; y: number } }).slot = { x: 10 * T + slot * 0.85 * T, y: (1.7 + row * 0.75) * T };
    });
    for (const b of [...this.bubbles]) this.killBubble(b);
    const skip = () => { if (this.cut && this.cut.stage !== 'fade') { this.cut.stage = 'fade'; this.cut.t = 0; this.cameras.main.fadeOut(250, 5, 6, 13); } };
    this.time.delayedCall(400, () => { window.addEventListener('keydown', skip, { once: true }); window.addEventListener('pointerdown', skip, { once: true }); });
    this.events.once('shutdown', () => { window.removeEventListener('keydown', skip); window.removeEventListener('pointerdown', skip); });
    sfx.ting();
  }
  private cutsceneTick(dt: number) {
    const c = this.cut; if (!c || !this.me) { this.floorText.setText('G'); return; }
    c.t += dt;
    const people = [this.me, ...this.bots];
    const want = c.stage === 'walk' || c.stage === 'enter' ? 1 : 0;
    c.doorsOpen = Phaser.Math.Clamp(c.doorsOpen + (want ? 1 : -1) * dt * 2.6, 0, 1);
    if (c.stage === 'walk') {
      let all = true;
      for (const m of people) {
        const slot = (m as Mover & { slot?: { x: number; y: number } }).slot!;
        if (m.path.length) { all = false; this.follow(m, dt, 1.25); continue; }
        // Từ ô cuối của lộ trình trượt vào đúng chỗ xếp hàng
        const dx = slot.x - m.x, dy = slot.y - m.y, d = Math.hypot(dx, dy);
        if (d > 4) { all = false; const st = SPEED * 1.1 * dt; m.x += dx / d * Math.min(st, d); m.y += dy / d * Math.min(st, d); m.moving = true; m.walkT += dt; }
        else m.moving = false;
      }
      if (c.t > 3.2 && !all) {
        // Ai còn chưa tới: mờ đi rồi hiện ra ở hàng chờ như vừa chạy vội tới
        for (const m of people) {
          const slot = (m as Mover & { slot?: { x: number; y: number } }).slot!;
          if (Math.hypot(slot.x - m.x, slot.y - m.y) > 4) { m.path = []; m.x = slot.x; m.y = slot.y; m.sprite.setAlpha(0); this.tweens.add({ targets: m.sprite, alpha: 1, duration: 250 }); }
        }
        all = true;
      }
      if (all) { c.stage = 'enter'; c.t = 0; }
    } else if (c.stage === 'enter') {
      for (const m of people) { m.y -= dt * 90; m.moving = true; m.walkT += dt; m.sprite.setAlpha(Math.max(0, 1 - c.t * 2.2)); m.tag.setAlpha(Math.max(0, 1 - c.t * 3)); m.shadow.setAlpha(Math.max(0, 1 - c.t * 2.2)); }
      if (c.t > 0.5) { c.stage = 'close'; c.t = 0; for (const m of people) m.moving = false; }
    } else if (c.stage === 'close') {
      if (c.t > 0.45) { c.stage = 'ride'; c.t = 0; sfx.click(); }
    } else if (c.stage === 'ride') {
      const f = Math.min(2, Math.floor(c.t / 0.45));
      if (f !== c.floor) { c.floor = f; f === 2 ? sfx.ting() : sfx.click(); }
      if (c.t > 1.25) { c.stage = 'fade'; c.t = 0; this.cameras.main.fadeOut(380, 5, 6, 13); }
    } else if (c.stage === 'fade') {
      if (c.t > 0.42) { const d = c.done; this.cut = null; window.setTimeout(d, 0); return; }
    }
    this.floorText.setText(['G', '1', '2'][c.floor]);
  }

  // ---------- Vòng lặp ----------
  update(_t: number, deltaMs: number) {
    const dt = Math.min(0.05, deltaMs / 1000);
    session.onFrame(dt);
    this.syncPeople();
    this.vehiclesTick(dt);
    if (!this.me) return;
    const me = this.me;
    // Người chơi
    const inp = session.paused || this.cut || !me.arrived ? { x: 0, y: 0 } : session.input;
    if (!this.cut) {
      if (me.seat !== null && Math.hypot(inp.x, inp.y) > 0.3) this.standUp(me);
      if (me.seat === null) this.step(me, inp.x, inp.y, dt); else me.moving = false;
    }
    this.draw(me);
    // Sảnh online: gửi trạng thái của mình lên mạng
    if (session.lobby.online) session.lobby.sendState?.({ x: Math.round(me.x), y: Math.round(me.y), f: me.facing, m: me.moving ? 1 : 0, seat: me.seat, cup: me.cupUntil > this.time.now ? 1 : 0, arrived: me.arrived ? 1 : 0 }, deltaMs);
    // Bot: đi dạo trong sảnh, thỉnh thoảng ra sofa ngồi (người ở máy khác thì theo trạng thái nhận qua mạng)
    for (const b of this.bots) {
      if (b.peer) { this.driveRemote(b, dt); if (b.arrived) this.draw(b); continue; }
      if (!b.arrived) continue;
      if (!this.cut) {
        if (b.path.length) { if (this.follow(b, dt) && (b as Mover & { wantSeat?: number }).wantSeat !== undefined) { const ws = (b as Mover & { wantSeat?: number }).wantSeat!; (b as Mover & { wantSeat?: number }).wantSeat = undefined; if (!this.sit(b, ws)) b.wait = 1; else b.wait = 6 + Math.random() * 10; } }
        else if (b.wait > 0) { b.wait -= dt; b.moving = false; }
        else {
          this.standUp(b);
          const free = SEATS.map((_, i) => i).filter(i => this.seats[i] === null && SEATS[i].kind === 'sofa');
          if (free.length && Math.random() < 0.35) {
            const i = free[Math.floor(Math.random() * free.length)], s = SEATS[i];
            this.goTo(b, s.x, floorAt(s.x, s.y - 1) ? s.y - 1 : s.y + 1); (b as Mover & { wantSeat?: number }).wantSeat = i;
          } else { const t = this.randomInside(); this.goTo(b, t.x, t.y); }
          b.wait = 2 + Math.random() * 4;
        }
      }
      this.draw(b);
    }
    // Bot thỉnh thoảng nói vu vơ (khoảng 20–30 giây một câu cho cả sảnh)
    this.chatT -= dt;
    if (this.chatT <= 0 && !this.cut) {
      this.chatT = 20 + Math.random() * 10;
      const pool = session.lobby.online ? [] : this.bots.filter(b => b.arrived && !b.peer);
      if (pool.length) this.botSay(pool[Math.floor(Math.random() * pool.length)], LOBBY_LINES[Math.floor(Math.random() * LOBBY_LINES.length)]);
    }
    // Chỗ tương tác gần nhất: so khoảng cách thật giữa biển lớn, món nhỏ và chỗ ngồi
    let near: SpotKey | null = null;
    let mini: { key: string; icon: string; label: string; x: number; y: number } | null = null;
    const hx = me.x, hy = me.y - 20;
    if (me.arrived && !this.cut && me.seat === null) {
      let best = 1.1 * T;
      for (const k of Object.keys(LOBBY_SPOTS) as SpotKey[]) {
        if (k === 'elevator' && this.guestOnline()) continue; // người vào phòng: chỉ chủ phòng bắt đầu ca, không có nút E ở đây
        const sp = LOBBY_SPOTS[k];
        const cx = Math.max(sp.x0 * T, Math.min(sp.x1 * T, hx)), cy = Math.max(sp.y0 * T, Math.min(sp.y1 * T, hy));
        const d = Math.hypot(cx - hx, cy - hy) + 0.15 * T; // biển lớn nhường món nhỏ khi đứng ngang nhau
        if (d < best) { best = d; near = k; mini = null; }
      }
      for (const o of MINI) { const d = Math.hypot(o.x * T - hx, o.y * T - hy); if (d < best) { best = d; near = null; mini = { ...o, x: o.x * T, y: o.y * T }; } }
      const cs = SEATS[this.catSeat]; const dc = Math.hypot(cs.x * T + T / 2 - hx, cs.y * T + T / 2 - hy);
      if (dc < best) { best = dc; near = null; mini = { key: 'cat', icon: 'cat', label: 'Vuốt mèo', x: cs.x * T + T / 2, y: cs.y * T + 10 }; }
      SEATS.forEach((st, i) => {
        if (this.seats[i] !== null) return;
        const d = Math.hypot(st.x * T + T / 2 - hx, st.y * T + T / 2 - me.y) - 0.15 * T; // đo từ chân: đứng sát mép ghế là ngồi được
        if (d < best) { best = d; near = null; mini = { key: 'sit:' + i, icon: 'sofa', label: 'Ngồi', x: st.x * T + T / 2, y: st.y * T + 12 }; }
      });
    }
    session.lobby.near = near;
    const m0 = mini as { key: string; icon: string; label: string; x: number; y: number } | null;
    session.lobby.nearInfo = near ? { key: near, icon: LOBBY_SPOTS[near].icon, label: LOBBY_SPOTS[near].label, big: true }
      : m0 ? { key: m0.key, icon: m0.icon, label: m0.label, big: false } : null;
    if (this.sparkle) {
      this.sparkle.setVisible(!!m0);
      if (m0) this.sparkle.setPosition(m0.x, m0.y - 34 + Math.sin(this.time.now / 160) * 3).setAngle(this.time.now / 12 % 360);
    }
    // Biển lớn: nhún nhẹ, đứng gần thì phát sáng
    const pulse = 0.45 + 0.35 * Math.sin(this.time.now / 260);
    this.glow.clear(); this.signGlow.clear();
    for (const k of Object.keys(LOBBY_SPOTS) as SpotKey[]) {
      const sp = LOBBY_SPOTS[k], on = k === near;
      const pad = on ? 8 : 4;
      this.glow.lineStyle(on ? 6 : 3, 0xffd23f, on ? 1 : pulse * 0.6);
      if (!(k === 'elevator' && this.guestOnline())) this.glow.strokeRoundedRect(sp.x0 * T - pad, sp.y0 * T - pad, (sp.x1 - sp.x0) * T + pad * 2, (sp.y1 - sp.y0) * T + pad * 2, 12);
      const bob = Math.sin(this.time.now / (on ? 170 : 420) + sp.x) * (on ? 5 : 3);
      const ico = this.spotIcons.get(k);
      if (ico) ico.setY(sp.y - 6 + bob).setDisplaySize(on ? 70 : 56, on ? 70 : 56).setVisible(!this.cut);
      if (on) { this.signGlow.fillStyle(0xffe36e, 0.25 + 0.15 * Math.sin(this.time.now / 160)); this.signGlow.fillCircle(sp.x, sp.y - 6 + bob, 44); }
      const lab = this.spotLabels.get(k)!;
      const want = k === 'elevator' && this.guestOnline() ? 'CHỜ CHỦ PHÒNG BẮT ĐẦU' : sp.label.toUpperCase();
      if (lab.text !== want) lab.setText(want);
      lab.setY(sp.y + 34 + bob).setColor(on ? '#ffe36e' : '#ffffff').setScale(on ? 1.08 : 1).setVisible(!this.cut);
    }
    this.fxTick(dt);
    this.doorArrowTick();
    this.bubblesTick();
    this.infoTick();
    this.cutsceneTick(dt);
    if (!this.sys.isActive()) return;
    // Camera theo người chơi (lúc vào ca thì nhìn về thang máy)
    const w = this.scale.width, h = this.scale.height;
    const vw = w / this.zoom, vh = h / this.zoom;
    const k = Math.min(1, dt * 6);
    const fx = this.cut ? 10 * T : me.arrived ? me.x : 4 * T, fy = this.cut ? 3.5 * T : me.arrived ? me.y - 30 : 12 * T;
    this.camX += (fx - this.camX) * k; this.camY += (fy - this.camY) * k;
    const cx = vw >= W * T ? (W * T) / 2 : Phaser.Math.Clamp(this.camX, vw / 2, W * T - vw / 2);
    const cy = vh >= H * T ? (H * T) / 2 : Phaser.Math.Clamp(this.camY, vh / 2, H * T - vh / 2);
    this.cameras.main.setScroll(cx - w / 2, cy - h / 2);
  }
}
