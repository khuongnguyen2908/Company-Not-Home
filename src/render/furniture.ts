// Bộ vẽ đồ đạc dùng chung cho văn phòng và sảnh chờ.
// Phong cách: góc nhìn 3/4 (mặt trên sáng, mặt trước tối, thấy chiều cao) kết hợp chất liệu "sticker có khối"
// (viền đen dày, bóng đổ mềm, vệt sáng, chi tiết nhỏ). Mỗi món vẽ trong toạ độ riêng: chân đế (footprint) là
// hình chữ nhật (0,0)–(W,H); phần cao của đồ vật được vẽ nhô lên phía trên (toạ độ y âm), tối đa `up` điểm ảnh.
import type Phaser from 'phaser';

type G = Phaser.GameObjects.Graphics;
const INK = 0x1d1a2b;

/** Pha màu sáng/tối: k > 0 sáng hơn, k < 0 tối hơn */
export function shade(c: number, k: number): number {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return (f(r) << 16) | (f(g) << 8) | f(b);
}

/** Bút vẽ có gốc toạ độ dịch chuyển, để vẽ cùng một món ở nhiều chỗ */
export class Pen {
  constructor(public g: G, public ox: number, public oy: number) {}
  fill(x: number, y: number, w: number, h: number, c: number, a = 1, r = 0) { this.g.fillStyle(c, a); if (r) this.g.fillRoundedRect(this.ox + x, this.oy + y, w, h, r); else this.g.fillRect(this.ox + x, this.oy + y, w, h); }
  box(x: number, y: number, w: number, h: number, c: number, r = 6, lw = 3.5) {
    this.g.fillStyle(c, 1); this.g.fillRoundedRect(this.ox + x, this.oy + y, w, h, r);
    if (lw) { this.g.lineStyle(lw, INK, 1); this.g.strokeRoundedRect(this.ox + x, this.oy + y, w, h, r); }
  }
  line(x1: number, y1: number, x2: number, y2: number, c = INK, w = 3, a = 1) { this.g.lineStyle(w, c, a); this.g.lineBetween(this.ox + x1, this.oy + y1, this.ox + x2, this.oy + y2); }
  circ(x: number, y: number, r: number, c: number, lw = 3) { this.g.fillStyle(c, 1); this.g.fillCircle(this.ox + x, this.oy + y, r); if (lw) { this.g.lineStyle(lw, INK, 1); this.g.strokeCircle(this.ox + x, this.oy + y, r); } }
  ell(x: number, y: number, w: number, h: number, c: number, lw = 3, a = 1) { this.g.fillStyle(c, a); this.g.fillEllipse(this.ox + x, this.oy + y, w, h); if (lw) { this.g.lineStyle(lw, INK, 1); this.g.strokeEllipse(this.ox + x, this.oy + y, w, h); } }
  poly(pts: number[], c: number, lw = 3, a = 1) {
    const p: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i < pts.length; i += 2) p.push({ x: this.ox + pts[i], y: this.oy + pts[i + 1] });
    this.g.fillStyle(c, a); this.g.fillPoints(p, true);
    if (lw) { this.g.lineStyle(lw, INK, 1); this.g.strokePoints(p, true); }
  }
  /** Vệt sáng mảnh */
  shine(x1: number, y1: number, x2: number, y2: number, w = 3) { this.line(x1, y1, x2, y2, 0xffffff, w, 0.5); }
  /** Bóng đổ mềm dưới chân đồ vật */
  shadow(x: number, y: number, w: number, h: number) { this.g.fillStyle(INK, 0.16); this.g.fillEllipse(this.ox + x + w / 2, this.oy + y + h / 2, w, h); }
  /**
   * Khối 3/4: mặt trước (cao `ht`) đứng trên đáy `yB`, mặt trên (sâu `d`) nằm ngay phía trên mặt trước.
   * Mặt trên sáng hơn, mặt trước tối hơn, có vệt sáng ở mép trên.
   */
  block(x: number, yB: number, w: number, d: number, ht: number, c: number, r = 6) {
    const top = shade(c, 0.22), front = shade(c, -0.16);
    // mặt trước
    this.g.fillStyle(front, 1); this.g.fillRoundedRect(this.ox + x, this.oy + yB - ht - 4, w, ht + 4, { tl: 0, tr: 0, bl: r, br: r });
    // mặt trên
    this.g.fillStyle(top, 1); this.g.fillRoundedRect(this.ox + x, this.oy + yB - ht - d, w, d, { tl: r, tr: r, bl: 0, br: 0 });
    this.g.lineStyle(3.5, INK, 1);
    this.g.strokeRoundedRect(this.ox + x, this.oy + yB - ht - d, w, d + ht, r);
    this.g.lineStyle(3, INK, 1); this.g.lineBetween(this.ox + x, this.oy + yB - ht, this.ox + x + w, this.oy + yB - ht);
    this.shine(x + 8, yB - ht - d + 5, x + Math.min(w - 8, w * 0.45), yB - ht - d + 5);
  }
}

/** Chuyển động gắn với một món đồ (vẽ lại mỗi khung hình trên lớp riêng) */
export type Anim =
  | { type: 'screen'; x: number; y: number; w: number; h: number; color: number }
  | { type: 'leds'; pts: [number, number][]; color: number }
  | { type: 'steam'; x: number; y: number }
  | { type: 'bubbles'; x: number; y: number; w: number; h: number }
  | { type: 'fan'; x: number; y: number; r: number }
  | { type: 'fish'; x: number; y: number; w: number; h: number; n: number }
  | { type: 'leaves'; x: number; y: number; s: number; big?: boolean }
  | { type: 'flowers'; x: number; y: number; w: number; h: number }
  | { type: 'scan'; x: number; y: number; w: number; h: number }
  | { type: 'pulse'; x: number; y: number; r: number; color: number }
  | { type: 'swatch'; x: number; y: number; w: number; h: number }
  | { type: 'chase'; x: number; y: number; w: number; n: number }
  | { type: 'claw'; x: number; y: number; h: number }
  | { type: 'drip'; x: number; y: number }
  | { type: 'blink'; x: number; y: number; color: number }
  | { type: 'shine'; x: number; y: number; w: number; h: number }
  | { type: 'canopy'; x: number; y: number; r: number }
  | { type: 'vent'; kind: VentKind };

export type VentKind = 'grate' | 'cable' | 'locker' | 'desk' | 'ceiling' | 'shaft' | 'hatch';
/** Loại lối trốn theo mã */
export function ventKind(id: string): VentKind {
  return id.startsWith('ong_gio') ? 'grate' : id.startsWith('ong_cap') ? 'cable' : id.startsWith('tu_do') ? 'locker' : id.startsWith('gam_ban') ? 'desk'
    : id.startsWith('tran') ? 'ceiling' : id.startsWith('tm_shaft') ? 'shaft' : 'hatch';
}
/** Đế tĩnh của lối trốn (ô 48x48). flat: nằm sát sàn (xếp dưới nhân vật) */
export function ventArt(kind: VentKind): FurnArt & { flat: boolean } {
  const W = 48, H = 48;
  let up = 0, flat = true;
  let draw: (p: Pen) => void = () => undefined;
  switch (kind) {
    case 'grate': draw = (p) => { p.box(6, 8, W - 12, H - 16, 0x4b5070, 4, 3); p.fill(10, 12, W - 20, H - 24, 0x15161f, 1, 2); }; break;
    case 'cable': draw = (p) => {
      p.box(5, 7, W - 10, H - 14, 0x6d7398, 4, 3); p.fill(9, 11, W - 18, H - 22, 0x15161f, 1, 2);
      p.line(12, 18, W - 12, 30, 0xe2412f, 3); p.line(12, 26, W - 12, 20, 0x2e9cf0, 3); p.line(12, 32, W - 12, 34, 0xffd23f, 3);
    }; break;
    case 'locker': up = 46; flat = false; draw = (p) => {
      p.shadow(4, H - 10, W - 8, 12);
      p.block(6, H - 4, W - 12, 14, 70, 0x8c93a8, 4);
      p.fill(11, H - 70, W - 22, 60, 0x15161f, 1, 2); // ô tủ (cánh tủ vẽ động)
    }; break;
    case 'desk': up = 14; flat = false; draw = (p) => {
      p.shadow(2, H - 8, W - 4, 10);
      p.block(2, H - 18, W - 4, 22, 10, 0xd6a46c, 4);
      p.fill(6, H - 18, W - 12, 14, 0x15161f, 0.85); // khoảng tối dưới gầm bàn
      p.line(6, H - 18, 6, H - 3, INK, 3.5); p.line(W - 6, H - 18, W - 6, H - 3, INK, 3.5);
    }; break;
    case 'ceiling': up = 40; flat = false; draw = (p) => {
      // ô trần lỏng (vẽ trên cao) và chiếc thang gấp dựng bên dưới
      p.box(6, -40, W - 12, 22, 0xf1efe8, 3, 2.5); p.fill(10, -36, W - 20, 14, 0xd9d5c8, 1, 2);
      p.line(14, H - 4, 20, -16, 0xb9c0cf, 5); p.line(34, H - 4, 28, -16, 0xb9c0cf, 5);
      p.line(14, H - 4, 20, -16, INK, 1.5); p.line(34, H - 4, 28, -16, INK, 1.5);
      for (let i = 0; i < 4; i++) { const y = H - 12 - i * 14; p.line(15 + i * 1.5, y, 33 - i * 1.5, y, INK, 3); }
    }; break;
    case 'shaft': case 'hatch': draw = (p) => {
      // nắp sàn kỹ thuật thang máy: khung viền sọc vàng đen, lỗ tối bên dưới (nắp vẽ động)
      p.box(4, 4, W - 8, H - 8, 0xffd23f, 4, 3);
      for (let i = 0; i < 8; i++) p.poly([4 + i * 10, 4, 9 + i * 10, 4, 4, 9 + i * 10, 4, 4 + i * 10].map((v, k) => k % 2 === 0 ? Math.min(W - 4, v) : Math.min(H - 4, v)), INK, 0);
      p.fill(9, 9, W - 18, H - 18, 0x15161f, 1, 2);
    }; break;
  }
  return { up, pad: 12, left: 0, right: 0, draw, anims: [{ type: 'vent', kind }], flat };
}

export interface FurnArt { up: number; pad: number; left: number; right: number; draw: (p: Pen) => void; anims: Anim[]; seatDepth?: boolean }

const WOOD = 0xc8915f, WOOD_D = 0x8a5a35, METAL = 0xb9c0cf, DARK = 0x3b425e, SCREEN = 0x5fb8ff;

/** Lá cây (dùng cho chậu cây và tán lá), có thể nghiêng theo góc `rot` để đung đưa */
export function drawLeaves(p: Pen, x: number, y: number, s: number, rot: number, big = false) {
  const leaf = (ang: number, len: number, wid: number, c: number) => {
    const a = ang + rot;
    const tx = x + Math.sin(a) * len, ty = y - Math.cos(a) * len;
    const nx = Math.cos(a) * wid, ny = Math.sin(a) * wid;
    const mx = x + Math.sin(a) * len * 0.5, my = y - Math.cos(a) * len * 0.5;
    p.poly([x, y, mx + nx, my + ny, tx, ty, mx - nx, my - ny], c, 2.5);
  };
  const L = s * (big ? 1.5 : 1);
  leaf(-1.0, L * 0.85, L * 0.22, 0x2fa05a); leaf(1.0, L * 0.85, L * 0.22, 0x2fa05a);
  leaf(-0.5, L, L * 0.24, 0x3fbf6a); leaf(0.5, L, L * 0.24, 0x3fbf6a);
  leaf(0, L * 1.1, L * 0.25, 0x58d07f);
  if (big) { leaf(-1.4, L * 0.7, L * 0.2, 0x2fa05a); leaf(1.4, L * 0.7, L * 0.2, 0x2fa05a); }
}

/** Màn hình nhỏ: cột sáng, viền đen */
function monitor(p: Pen, cx: number, yTop: number, w: number, h: number) {
  p.fill(cx - 4, yTop + h, 8, 7, DARK); p.box(cx - 10, yTop + h + 5, 20, 5, DARK, 2, 2);
  p.box(cx - w / 2, yTop, w, h, 0x2d3142, 4, 3);
  p.fill(cx - w / 2 + 4, yTop + 4, w - 8, h - 8, SCREEN);
}

/** Bản vẽ cho từng loại đồ. W, H: kích thước chân đế (điểm ảnh) */
/** opt.low: đồ sát tường phía dưới thì vẽ thấp (tủ thấp) để không che người đứng phía trên, và không quay lưng ra người nhìn */
export function furnitureArt(kind: string, W: number, H: number, opt: { low?: boolean } = {}): FurnArt {
  const anims: Anim[] = [];
  let up = 0;
  let draw: (p: Pen) => void = () => undefined;
  let seatDepth = false;
  let left = 0, right = 0; // phần vẽ tràn ra hai bên chân đế
  switch (kind) {
    case 'desk': case 'computer': case 'hrdesk': {
      up = 36;
      const scr = kind === 'computer' ? 0x3fbf6a : kind === 'hrdesk' ? 0xff9ec4 : SCREEN;
      draw = (p) => {
        p.shadow(2, H - 10, W - 4, 14);
        p.block(3, H - 3, W - 6, 30, 15, WOOD);
        p.box(10, H - 13, 18, 6, shade(WOOD, -0.35), 2, 2); // tay nắm ngăn kéo
        monitor(p, W / 2, -30, 46, 30);
        p.box(W / 2 - 18, 6, 36, 9, 0xeeeeee, 2, 2.5); // bàn phím
        p.box(8, 2, 15, 18, 0xffffff, 2, 2.5); p.line(11, 8, 20, 8, 0x9aa1b4, 2); p.line(11, 13, 18, 13, 0x9aa1b4, 2); // giấy tờ
        p.box(W - 22, 4, 12, 13, kind === 'hrdesk' ? 0xff9ec4 : 0xffffff, 3, 2.5); // cốc
        if (kind === 'hrdesk') { p.ell(W - 40, 6, 14, 8, 0x3fbf6a, 2); }
      };
      anims.push({ type: 'screen', x: W / 2 - 19, y: -26, w: 38, h: 22, color: scr });
      break;
    }
    case 'bigdesk': {
      up = 8;
      draw = (p) => {
        p.shadow(4, H - 14, W - 8, 18);
        p.block(3, H - 3, W - 6, 62, 24, WOOD_D, 8);
        p.box(W / 2 - 34, 10, 68, 8, 0x2d3142, 3, 2.5); // đế laptop
        p.box(W / 2 - 30, -6, 60, 18, 0x2d3142, 3, 2.5);
        p.box(14, 12, 26, 32, 0xffffff, 2, 2.5); p.line(18, 20, 34, 20, 0x9aa1b4, 2); p.line(18, 27, 32, 27, 0x9aa1b4, 2);
        p.circ(W - 24, 22, 11, 0x5fb8ff, 2.5); p.line(W - 24, 11, W - 24, 33, 0x3fbf6a, 3); // quả địa cầu
        p.box(W / 2 - 26, H - 22, 52, 12, 0xffd23f, 2, 2.5); // bảng tên
      };
      anims.push({ type: 'screen', x: W / 2 - 26, y: -3, w: 52, h: 12, color: 0x9fd6ff });
      break;
    }
    case 'rack': {
      up = 46;
      draw = (p) => {
        p.shadow(2, H - 10, W - 4, 14);
        for (let i = 0; i < 2; i++) {
          const x = 4 + i * (W - 8) / 2, w = (W - 8) / 2 - 3;
          p.block(x, H - 3, w, 24, H + 18, DARK, 4);
          for (let k = 0; k < 6; k++) { const y = H - 3 - (H + 18) + 8 + k * ((H + 10) / 6); p.box(x + 5, y, w - 10, 9, 0x2d3142, 2, 2); }
        }
      };
      const pts: [number, number][] = [];
      for (let i = 0; i < 2; i++) for (let k = 0; k < 6; k++) pts.push([4 + i * (W - 8) / 2 + 12, H - 3 - (H + 18) + 12 + k * ((H + 10) / 6)]);
      anims.push({ type: 'leds', pts, color: 0x3fbf6a });
      break;
    }
    case 'fridge': {
      up = 66;
      draw = (p) => {
        p.shadow(2, H - 10, W - 4, 14);
        p.block(8, H - 3, W - 16, 16, 92, 0xe9edf5, 8);
        p.line(W / 2, H - 92, W / 2, H - 6, INK, 3); p.line(8, H - 64, W - 8, H - 64, INK, 3);
        p.box(W / 2 - 12, H - 56, 5, 20, METAL, 2, 2); p.box(W / 2 + 7, H - 56, 5, 20, METAL, 2, 2);
        p.box(16, H - 50, 12, 12, 0xffd23f, 2, 2); p.circ(W - 22, H - 82, 5, 0xe2412f, 2);
        p.shine(14, H - 88, 14, H - 70);
      };
      break;
    }
    case 'coffee': {
      up = 44;
      draw = (p) => {
        p.shadow(2, H - 10, W - 4, 14);
        p.block(3, H - 3, W - 6, 24, 22, 0xe9edf5);
        // máy pha cà phê trên mặt tủ
        p.block(16, 2, 44, 10, 36, 0x9aa1b4, 6);
        p.box(26, -24, 24, 12, 0x2d3142, 2, 2.5); p.circ(56 - 8, -30, 3, 0xe2412f, 2);
        p.box(33, -12, 8, 6, 0x2d3142, 1, 2);
        p.box(30, -6, 14, 10, 0xffffff, 2, 2.5); // cốc
        p.box(W - 30, 0, 20, 14, 0xc26b3a, 3, 2.5); // hũ đường
      };
      anims.push({ type: 'steam', x: 37, y: -8 });
      break;
    }
    case 'copier': case 'printer': {
      up = kind === 'copier' ? 20 : 12; right = 8;
      const c = kind === 'copier' ? 0xd9dce6 : 0xe9edf5;
      draw = (p) => {
        p.shadow(2, H - 10, W - 4, 14);
        p.block(6, H - 3, W - 12, 26, kind === 'copier' ? 34 : 26, c);
        const top = H - 3 - (kind === 'copier' ? 34 : 26) - 26;
        p.box(12, top + 4, W - 40, 16, shade(c, -0.25), 3, 2.5); // nắp
        p.box(W - 26, top + 4, 16, 12, 0x2d3142, 2, 2); // bảng điều khiển
        p.box(16, top - 6, W - 48, 12, 0xffffff, 1, 2.5); // giấy
        p.box(W - 4, H - 22, 10, 14, 0xffffff, 1, 2.5); // khay giấy ra
      };
      anims.push({ type: 'blink', x: W - 18, y: H - 3 - (kind === 'copier' ? 34 : 26) - 26 + 10, color: 0x3fbf6a });
      break;
    }
    case 'meetingtable': {
      up = 6;
      draw = (p) => {
        p.shadow(6, H - 16, W - 12, 22);
        p.block(6, H - 4, W - 12, H - 30, 18, 0xb5835a, 18);
        for (let i = 0; i < 3; i++) { p.box(30 + i * 110, 18, 40, 28, 0xffffff, 2, 2.5); p.line(36 + i * 110, 26, 62 + i * 110, 26, 0x9aa1b4, 2); }
        for (let i = 0; i < 3; i++) { p.box(60 + i * 110, H - 70, 34, 22, 0x2d3142, 3, 2.5); }
        for (let i = 0; i < 4; i++) p.box(24 + i * 92, H / 2 - 12, 10, 18, 0x9fd6ff, 3, 2.5); // chai nước
        p.fill(W / 2 - 60, 30, 120, H - 90, 0xe2412f, 0.18, 10); // khăn trải bàn
      };
      break;
    }
    case 'router': {
      up = 30;
      draw = (p) => {
        p.shadow(4, H - 10, W - 8, 12);
        p.block(6, H - 3, W - 12, 18, 20, METAL);
        p.block(9, H - 25, W - 18, 8, 10, 0x2d3142, 4);
        p.line(14, H - 36, 10, H - 56, INK, 3.5); p.line(W - 14, H - 36, W - 10, H - 56, INK, 3.5);
      };
      anims.push({ type: 'leds', pts: [[16, H - 30], [24, H - 30], [32, H - 30]], color: 0x3fbf6a });
      break;
    }
    case 'panel': {
      up = 30;
      draw = (p) => {
        p.shadow(4, H - 10, W - 8, 12);
        p.block(6, H - 3, W - 12, 10, 64, 0x9aa1b4, 4);
        p.box(12, H - 60, W - 24, 44, 0xe9edf5, 3, 2.5);
        p.poly([W / 2, H - 54, W / 2 - 9, H - 34, W / 2 + 9, H - 34], 0xffd23f, 2.5);
        p.line(W / 2, H - 49, W / 2, H - 41, INK, 2.5);
      };
      anims.push({ type: 'leds', pts: [[16, H - 22], [26, H - 22]], color: 0x3fbf6a });
      break;
    }
    case 'sink': case 'tap': {
      up = 16;
      draw = (p) => {
        p.shadow(2, H - 10, W - 4, 14);
        p.block(3, H - 3, W - 6, 26, 22, 0xe9edf5);
        p.ell(W / 2, H - 38, W * 0.45, 16, 0xbfe6f2, 2.5);
        p.line(W / 2, H - 52, W / 2, H - 62, INK, 4); p.line(W / 2, H - 62, W / 2 + 10, H - 62, INK, 4);
        p.box(10, H - 44, 14, 10, 0xffd23f, 2, 2); // xà phòng
      };
      anims.push({ type: 'drip', x: W / 2 + 10, y: H - 58 });
      break;
    }
    case 'pantrytable': case 'table': {
      up = 4;
      draw = (p) => {
        p.shadow(4, H - 12, W - 8, 16);
        p.block(4, H - 3, W - 8, H - 26, 16, 0xd6a46c, 10);
        if (W > 60) {
          p.ell(W / 2, H / 2 - 12, 34, 16, 0xffffff, 2.5);
          p.circ(W / 2 - 8, H / 2 - 16, 5, 0xe2412f, 2); p.circ(W / 2 + 4, H / 2 - 17, 5, 0xffd23f, 2); p.circ(W / 2 + 10, H / 2 - 12, 4, 0x3fbf6a, 2);
          p.box(14, 10, 16, 12, 0xffffff, 3, 2.5); p.box(W - 30, 12, 16, 12, 0xffffff, 3, 2.5);
        } else p.box(W / 2 - 8, 4, 16, 10, 0xffffff, 3, 2.5);
      };
      break;
    }
    case 'sofa': {
      up = 26; seatDepth = true;
      draw = (p) => {
        p.shadow(2, H - 10, W - 4, 14);
        p.block(4, 14, W - 8, 10, 28, 0x3a8ee6, 10);                 // lưng tựa (phía sau)
        const seats = Math.max(1, Math.round(W / 48));
        p.block(14, H - 3, W - 28, 20, 14, 0x5aa6f0, 6);             // đệm ngồi
        for (let i = 1; i < seats; i++) p.line(14 + i * (W - 28) / seats, H - 37, 14 + i * (W - 28) / seats, H - 18, INK, 2.5);
        p.block(2, H - 3, 16, 30, 22, 0x3a8ee6, 6); p.block(W - 18, H - 3, 16, 30, 22, 0x3a8ee6, 6); // tay vịn
      };
      break;
    }
    case 'plant': case 'bigplant': {
      const big = kind === 'bigplant';
      up = big ? 64 : 42;
      draw = (p) => {
        p.shadow(W / 2 - 18, H - 12, 36, 12);
        p.poly([W / 2 - 15, H - 26, W / 2 + 15, H - 26, W / 2 + 11, H - 4, W / 2 - 11, H - 4], 0xc26b3a, 3);
        p.ell(W / 2, H - 26, 34, 10, 0xd9844f, 3); p.ell(W / 2, H - 26, 24, 5, 0x5a3a22, 0);
      };
      anims.push({ type: 'leaves', x: W / 2, y: H - 28, s: big ? 30 : 24, big });
      break;
    }
    case 'watercooler': case 'cooler': {
      up = 58;
      draw = (p) => {
        p.shadow(W / 2 - 18, H - 12, 36, 12);
        p.block(W / 2 - 16, H - 3, 32, 12, 40, 0xe9edf5, 5);
        p.box(W / 2 - 6, H - 30, 5, 6, 0x5fb8ff, 1, 2); p.box(W / 2 + 2, H - 30, 5, 6, 0xe2412f, 1, 2);
        p.box(W / 2 - 13, H - 92, 26, 38, 0x9fd6ff, 10, 3); p.shine(W / 2 - 7, H - 86, W / 2 - 7, H - 66);
      };
      anims.push({ type: 'bubbles', x: W / 2 - 10, y: H - 88, w: 20, h: 30 });
      break;
    }
    case 'counter': {
      up = 30;
      draw = (p) => {
        p.shadow(4, H - 12, W - 8, 16);
        p.block(3, H - 3, W - 6, 26, 24, 0xb07a4f, 8);
        p.fill(6, H - 20, W - 12, 6, 0xe2412f, 0.85); // dải màu công ty ở mặt trước
        if (W >= 140) monitor(p, W * 0.3, -26, 40, 26);
        p.box(W * 0.55, 0, 26, 16, 0xffffff, 2, 2.5); p.line(W * 0.55 + 4, 7, W * 0.55 + 20, 7, 0x9aa1b4, 2);
        p.ell(W - 22, 8, 24, 8, 0x9aa1b4, 2.5); p.poly([W - 31, 8, W - 22, -6, W - 13, 8], 0xffd23f, 2.5); // chuông
      };
      if (W >= 140) anims.push({ type: 'screen', x: W * 0.3 - 16, y: -22, w: 32, h: 18, color: SCREEN });
      break;
    }
    case 'scanner': {
      up = 34;
      draw = (p) => {
        p.shadow(W / 2 - 16, H - 12, 32, 12);
        p.block(W / 2 - 12, H - 3, 24, 10, 42, 0x9aa1b4, 4);
        p.poly([W / 2 - 18, H - 58, W / 2 + 18, H - 58, W / 2 + 14, H - 42, W / 2 - 14, H - 42], 0x2d3142, 3);
        p.fill(W / 2 - 11, H - 54, 22, 9, 0x5fb8ff);
      };
      anims.push({ type: 'scan', x: W / 2 - 11, y: H - 54, w: 22, h: 9 });
      break;
    }
    case 'faceid': {
      up = 50;
      draw = (p) => {
        p.shadow(W / 2 - 16, H - 12, 32, 12);
        p.block(W / 2 - 14, H - 3, 28, 12, 70, 0xe9edf5, 6);
        p.box(W / 2 - 10, H - 76, 20, 26, 0x2d3142, 3, 2.5);
        p.circ(W / 2, H - 66, 5, 0xff9ec4, 2); p.line(W / 2 - 6, H - 54, W / 2 + 6, H - 54, 0xff9ec4, 2.5);
        p.circ(W / 2, H - 80, 3, 0xe2412f, 2);
      };
      anims.push({ type: 'pulse', x: W / 2, y: H - 63, r: 14, color: 0xff5abe });
      break;
    }
    case 'colorcheck': {
      up = 42;
      draw = (p) => {
        p.shadow(W / 2 - 18, H - 12, 36, 12);
        p.block(W / 2 - 18, H - 3, 36, 14, 52, 0xffd23f, 6);
        p.box(W / 2 - 13, H - 64, 26, 22, 0x2d3142, 3, 2.5);
        p.circ(W / 2 - 7, H - 30, 3.5, 0xe2412f, 2); p.circ(W / 2 + 7, H - 30, 3.5, 0x3fbf6a, 2);
      };
      anims.push({ type: 'swatch', x: W / 2 - 9, y: H - 60, w: 18, h: 14 });
      break;
    }
    case 'boxes': {
      up = 24;
      draw = (p) => {
        p.shadow(2, H - 12, W - 4, 16);
        const n = Math.max(1, Math.round(W / 48));
        for (let i = 0; i < n; i++) {
          const x = 4 + i * (W - 8) / n, w = (W - 8) / n - 4;
          p.block(x, H - 3, w, 18, H > 60 ? 40 : 26, 0xd6a46c, 3);
          p.line(x + w / 2, H - 3 - (H > 60 ? 40 : 26) - 18, x + w / 2, H - 3 - (H > 60 ? 40 : 26), 0xf6d79c, 4);
        }
        if (H > 60) { p.block(10, H - 50, W / 2 - 14, 14, 20, 0xc8915f, 3); }
      };
      break;
    }
    case 'easel': {
      up = 52;
      draw = (p) => {
        p.shadow(W / 2 - 16, H - 10, 32, 10);
        p.line(W / 2 - 14, H - 4, W / 2 - 4, H - 70, WOOD_D, 4); p.line(W / 2 + 14, H - 4, W / 2 + 4, H - 70, WOOD_D, 4); p.line(W / 2, H - 10, W / 2, H - 66, WOOD_D, 4);
        p.box(W / 2 - 20, H - 96, 40, 34, 0xffffff, 2, 3);
        p.circ(W / 2 - 8, H - 82, 6, 0xffd23f, 0); p.poly([W / 2 - 18, H - 66, W / 2 - 4, H - 80, W / 2 + 6, H - 72, W / 2 + 18, H - 84, W / 2 + 18, H - 66], 0x3fbf6a, 0);
        p.box(W / 2 - 22, H - 64, 44, 5, WOOD_D, 2, 2);
      };
      break;
    }
    case 'kanban': case 'whiteboard': {
      up = 44;
      const cork = kind === 'kanban';
      draw = (p) => {
        p.box(4, H - 78, W - 8, 52, cork ? 0xc79a62 : 0xffffff, 4, 3.5);
        if (cork) {
          const cols = Math.max(2, Math.round(W / 48));
          for (let c = 0; c < cols; c++) for (let r = 0; r < 2; r++) p.box(12 + c * (W - 24) / cols, H - 72 + r * 22, (W - 24) / cols - 8, 16, [0xffe36e, 0xff9ec4, 0x9fd6ff][(c + r) % 3], 1, 2);
        } else {
          p.line(14, H - 66, W * 0.5, H - 66, 0x2e9cf0, 2.5); p.line(14, H - 56, W * 0.65, H - 56, 0xe2412f, 2.5); p.line(14, H - 46, W * 0.4, H - 46, 0x3fbf6a, 2.5);
          p.box(W * 0.62, H - 72, 20, 18, 0xffffff, 3, 2);
        }
        p.box(10, H - 28, W - 20, 6, cork ? WOOD_D : METAL, 2, 2.5);
      };
      break;
    }
    case 'projector': {
      up = 20;
      draw = (p) => {
        p.shadow(4, H - 10, W - 8, 12);
        p.block(6, H - 3, W - 12, 10, 30, METAL, 4);
        p.block(8, H - 33, W - 16, 14, 14, 0xe9edf5, 5);
        p.circ(W / 2 - 4, H - 40, 6, 0x2d3142, 2.5);
      };
      anims.push({ type: 'pulse', x: W / 2 - 4, y: H - 40, r: 9, color: 0xfff3a0 });
      break;
    }
    case 'monitors': {
      up = 40;
      draw = (p) => {
        p.shadow(4, H - 12, W - 8, 16);
        p.block(3, H - 3, W - 6, 26, 18, 0x6d7398, 6);
        const n = Math.max(2, Math.round(W / 96));
        for (let i = 0; i < n; i++) monitor(p, (i + 0.5) * W / n, -32, Math.min(64, W / n - 16), 36);
        p.box(W / 2 - 20, 6, 40, 10, 0xeeeeee, 2, 2.5);
      };
      {
        const n = Math.max(2, Math.round(W / 96));
        for (let i = 0; i < n; i++) { const w = Math.min(64, W / n - 16); anims.push({ type: 'screen', x: (i + 0.5) * W / n - w / 2 + 4, y: -28, w: w - 8, h: 28, color: 0x9aa1b4 }); }
      }
      break;
    }
    case 'shelf': {
      const tall = H > 60;
      up = opt.low ? 10 : tall ? 40 : 54;
      draw = (p) => {
        p.shadow(2, H - 10, W - 4, 14);
        if (opt.low) {
          // tủ hồ sơ thấp: hai ngăn kéo, trên có chồng giấy
          p.block(4, H - 3, W - 8, 18, 30, 0xb07a4f, 4);
          p.line(W / 2, H - 31, W / 2, H - 6, INK, 2.5);
          p.box(W / 4 - 8, H - 22, 16, 5, 0x6b4426, 2, 2); p.box(W * 3 / 4 - 8, H - 22, 16, 5, 0x6b4426, 2, 2);
          p.box(10, H - 54, 26, 10, 0xffffff, 1, 2.5); p.box(W - 34, H - 52, 22, 8, 0xffe36e, 1, 2.5);
          return;
        }
        const ht = tall ? H + 10 : 78;
        p.block(4, H - 3, W - 8, 14, ht, 0xb07a4f, 4);
        const rows = 3, inner = ht - 14;
        const colors = [0xe2412f, 0x2e9cf0, 0xffd23f, 0x3fbf6a, 0x8a4fd8, 0xff9ec4];
        for (let r = 0; r < rows; r++) {
          const y = H - 3 - ht + 8 + r * (inner / rows);
          p.fill(10, y, W - 20, inner / rows - 6, 0x6b4426);
          let x = 13, i = r * 3;
          while (x < W - 20) { const bw = 6 + ((i * 7) % 5); p.fill(x, y + 4 + (i % 3), bw, inner / rows - 12 - (i % 3), colors[i % colors.length]); p.line(x, y + 4 + (i % 3), x, y + inner / rows - 8, INK, 1.5); x += bw + 2; i++; }
          p.line(8, y + inner / rows - 6, W - 8, y + inner / rows - 6, INK, 3);
        }
      };
      break;
    }
    case 'paper': {
      draw = (p) => { p.box(W / 2 - 14, H / 2 - 10, 28, 20, 0xffffff, 2, 2.5); };
      break;
    }
    case 'dartboard': {
      up = 30;
      draw = (p) => {
        p.circ(W / 2, H - 50, 20, 0x2d3142, 3.5); p.circ(W / 2, H - 50, 15, 0xf4f1e8, 0); p.circ(W / 2, H - 50, 10, 0x2e9cf0, 0); p.circ(W / 2, H - 50, 4.5, 0xe2412f, 0);
        p.line(W / 2 + 6, H - 54, W / 2 + 16, H - 64, 0xffd23f, 2.5);
      };
      break;
    }
    case 'claw': {
      up = 70;
      draw = (p) => {
        p.shadow(2, H - 12, W - 4, 16);
        p.block(6, H - 3, W - 12, 30, 34, 0xff7ab8, 8);           // thân máy
        p.box(10, H - 37 - 30 - 72, W - 20, 78, 0xd8f3ff, 6, 3.5); // lồng kính
        p.shine(18, H - 130, 18, H - 80, 4);
        p.box(4, H - 37 - 30 - 84, W - 8, 16, 0xff7ab8, 6, 3.5);   // mái
        const ty = H - 82;
        for (const [x, c] of [[24, 0xffd23f], [40, 0xc8eec0], [58, 0x9fd6ff], [72, 0xff9ec4]] as const) p.circ(x * W / 96, ty, 8, c, 2.5);
        p.box(W / 2 - 10, H - 30, 20, 8, 0x2d3142, 2, 2); p.circ(W - 22, H - 22, 5, 0xe2412f, 2.5);
      };
      anims.push({ type: 'chase', x: 8, y: H - 37 - 30 - 76, w: W - 16, n: 8 });
      anims.push({ type: 'claw', x: W / 2, y: H - 37 - 30 - 66, h: 28 });
      break;
    }
    case 'fishtank': case 'aquarium': {
      const tall = H > W;
      up = tall ? 40 : 40;
      draw = (p) => {
        p.shadow(2, H - 10, W - 4, 14);
        p.block(4, H - 3, W - 8, tall ? H - 40 : 18, 16, 0x6d7398, 4); // chân đế
        p.box(6, tall ? -34 : H - 74, W - 12, tall ? H + 10 : 56, 0x7fc4ff, 6, 3.5);
        p.fill(10, tall ? -26 : H - 66, W - 20, 6, 0xffffff, 0.35);
        p.poly(tall ? [10, H - 32, 18, H - 50, 22, H - 32] : [16, H - 22, 24, H - 44, 28, H - 22], 0x3fbf6a, 2);
        p.ell(W - 22, tall ? H - 30 : H - 24, 16, 8, 0xd6a46c, 2);
      };
      anims.push(tall ? { type: 'fish', x: 10, y: -24, w: W - 20, h: H - 6, n: 3 } : { type: 'fish', x: 12, y: H - 64, w: W - 24, h: 40, n: 4 });
      anims.push(tall ? { type: 'bubbles', x: 12, y: -20, w: 14, h: H - 20 } : { type: 'bubbles', x: W - 30, y: H - 66, w: 14, h: 40 });
      break;
    }
    case 'gardenbed': {
      up = 16;
      draw = (p) => {
        p.shadow(4, H - 12, W - 8, 16);
        p.block(4, H - 3, W - 8, H - 30, 22, WOOD, 6);
        p.fill(12, 4, W - 24, H - 44, 0x6b4426, 1, 6);
        for (let x = 20; x < W - 10; x += 26) p.line(x, 6, x, H - 42, shade(WOOD, -0.3), 2);
      };
      anims.push({ type: 'flowers', x: 16, y: 6, w: W - 32, h: H - 46 });
      break;
    }
    case 'acunit': {
      up = 30;
      draw = (p) => {
        p.shadow(4, H - 12, W - 8, 16);
        p.block(6, H - 3, W - 12, 34, 52, 0xd9dce6, 6);
        p.circ(W / 2, H - 30, 22, 0x6d7398, 3.5);
        for (let i = -2; i <= 2; i++) p.line(W / 2 - 20, H - 30 + i * 7, W / 2 + 20, H - 30 + i * 7, 0x9aa1b4, 1.5);
      };
      anims.push({ type: 'fan', x: W / 2, y: H - 30, r: 18 });
      break;
    }
    case 'watertank': {
      up = 40;
      draw = (p) => {
        p.shadow(6, H - 16, W - 12, 22);
        p.fill(18, H - 30, W - 36, 24, METAL, 1, 4);
        p.box(14, 6 - up, W - 28, H + up - 34, 0x9fb4d8, 30, 3.5);
        p.ell(W / 2, 6 - up + 16, W - 30, 30, 0xbfd0ea, 3);
        for (const y of [H * 0.25, H * 0.55]) p.line(16, y, W - 16, y, INK, 2.5);
        p.line(W - 34, 6 - up + 26, W - 34, H - 30, INK, 3); p.line(W - 24, 6 - up + 26, W - 24, H - 30, INK, 3);
        for (let y = 0; y < H; y += 12) p.line(W - 34, y, W - 24, y, INK, 2);
      };
      break;
    }
    case 'solar': {
      // dàn pin mặt trời nghiêng trên giá: ô pin xanh đậm, khung nhôm
      up = 22;
      draw = (p) => {
        p.shadow(4, H - 12, W - 8, 16);
        p.line(14, H - 4, 14, H - 26, INK, 4); p.line(W - 14, H - 4, W - 14, H - 26, INK, 4);
        p.poly([4, H - 24, W - 4, H - 24, W - 12, -18, 12, -18], 0x2b4c8a, 3.5);
        const cols = Math.max(3, Math.round(W / 34)), rows = 3;
        for (let c = 1; c < cols; c++) { const x0 = 4 + (W - 8) * c / cols, x1 = 12 + (W - 24) * c / cols; p.line(x0, H - 24, x1, -18, 0x9fb4d8, 2); }
        for (let r = 1; r < rows; r++) { const y = -18 + (H - 6) * r / rows, k = r / rows; p.line(12 - 8 * k, y, W - 12 + 8 * k, y, 0x9fb4d8, 2); }
        p.shine(20, -12, 40, -12, 3);
      };
      anims.push({ type: 'shine', x: 14, y: -16, w: W - 28, h: H - 10 });
      break;
    }
    case 'antenna': {
      // cột ăng-ten có chảo thu sóng, đèn đỏ trên đỉnh
      up = 70;
      draw = (p) => {
        p.shadow(W / 2 - 14, H - 10, 28, 10);
        p.box(W / 2 - 12, H - 14, 24, 10, 0x9aa1b4, 3, 3);
        p.line(W / 2, H - 14, W / 2, H - 100, INK, 5); p.line(W / 2, H - 14, W / 2, H - 100, 0xc9ccd8, 2.5);
        p.line(W / 2 - 10, H - 70, W / 2 + 10, H - 70, INK, 3); p.line(W / 2 - 7, H - 84, W / 2 + 7, H - 84, INK, 3);
        p.ell(W / 2 + 10, H - 56, 22, 28, 0xe9edf5, 3); p.line(W / 2 + 10, H - 56, W / 2 + 18, H - 58, INK, 2.5);
      };
      anims.push({ type: 'blink', x: W / 2, y: H - 102, color: 0xe2412f });
      break;
    }
    case 'liftpanel': {
      up = 10;
      draw = (p) => { p.box(W / 2 - 10, H - 46, 20, 36, 0x2d3142, 4, 3); for (let i = 0; i < 3; i++) p.circ(W / 2, H - 38 + i * 10, 3.5, 0xffe36e, 1.5); };
      break;
    }
    // ---------- Riêng sảnh chờ ----------
    case 'wardrobe': {
      up = 50;
      draw = (p) => {
        p.shadow(2, H - 12, W - 4, 16);
        p.block(4, H - 3, W - 8, 24, H + 26, 0x8a4fd8, 10);
        p.box(14, -18, W - 28, 44, 0xbfe6f2, 6, 3);
        p.line(W / 2, -8, W / 2, -2, INK, 2.5); p.poly([W / 2, -2, W / 2 - 14, 10, W / 2 + 14, 10], 0xffffff, 2.5); // móc áo trên màn
        for (const [x, c] of [[0.3, 0xffd23f], [0.5, 0x3fbf6a], [0.7, 0xe2412f]] as const) p.circ(W * x, H - 26, 6, c, 2.5);
      };
      anims.push({ type: 'shine', x: 14, y: -18, w: W - 28, h: 44 });
      break;
    }
    case 'mirror': {
      up = 50;
      draw = (p) => {
        p.shadow(2, H - 10, W - 4, 12);
        p.box(6, -40, W - 12, H + 34, 0xc79a62, 12, 3.5);
        p.box(11, -34, W - 22, H + 22, 0xe9f6ff, 9, 2.5);
      };
      anims.push({ type: 'shine', x: 11, y: -34, w: W - 22, h: H + 22 });
      break;
    }
    case 'busstop': {
      up = 70; left = W * 2;
      draw = (p) => {
        p.box(-W * 2 + 8, -68, W * 3 - 16, 14, 0x3fbf6a, 4, 3);       // mái che
        p.line(-W * 2 + 16, -54, -W * 2 + 16, H - 8, INK, 4); p.line(W - 16, -54, W - 16, H - 8, INK, 4);
        p.box(W / 2 - 12, -30, 24, 36, 0xffd23f, 3, 3);               // bảng giờ xe
        p.line(W / 2 - 6, -20, W / 2 + 6, -20, INK, 2); p.line(W / 2 - 6, -12, W / 2 + 6, -12, INK, 2);
        p.line(W / 2, 6, W / 2, H - 6, INK, 4);
      };
      break;
    }
    case 'bench': {
      up = 22; seatDepth = true;
      draw = (p) => {
        p.shadow(2, H - 10, W - 4, 12);
        p.block(4, 18, W - 8, 6, 18, WOOD, 4);   // tựa lưng
        p.block(6, H - 6, W - 12, 18, 10, WOOD, 4);
        p.line(12, H - 6, 12, H - 2, INK, 4); p.line(W - 12, H - 6, W - 12, H - 2, INK, 4);
      };
      break;
    }
    case 'tree': {
      up = 74;
      draw = (p) => {
        p.shadow(W / 2 - 30, H - 14, 60, 18);
        // gốc có rễ, thân có vân
        p.poly([W / 2 - 7, H - 50, W / 2 + 7, H - 50, W / 2 + 9, H - 10, W / 2 + 16, H - 4, W / 2 - 16, H - 4, W / 2 - 9, H - 10], 0x8a5a35, 3);
        p.line(W / 2 - 2, H - 44, W / 2 - 1, H - 20, 0x6b4426, 2); p.line(W / 2 + 3, H - 36, W / 2 + 4, H - 14, 0x6b4426, 2);
        p.ell(W / 2, H - 4, 26, 6, 0x6b4426, 0, 0.5);
      };
      anims.push({ type: 'canopy', x: W / 2, y: H - 60, r: 26 });
      break;
    }
  }
  return { up, pad: 12, left, right, draw, anims, seatDepth };
}

/** Vẽ một khung hình chuyển động. t: giây; off: mất điện (màn hình, đèn tắt) */
export function drawAnim(p: Pen, a: Anim, t: number, opt: { power: boolean; wifi: boolean; seed: number; kick?: number }) {
  const kick = opt.kick ?? 0;
  const off = !opt.power;
  switch (a.type) {
    case 'vent': drawVent(p, a.kind, t, kick, opt.seed); break;
    case 'screen': {
      // Mất điện: máy tính chạy pin nên màn hình vẫn sáng (dịu hơn), đúng như mô tả sự cố "chỉ còn ánh sáng màn hình"
      p.fill(a.x, a.y, a.w, a.h, off ? shade(a.color, -0.25) : a.color);
      // các dòng chữ chạy lên như đang gõ việc
      const rows = Math.floor(a.h / 6);
      for (let r = 0; r < rows; r++) {
        const k = (r + Math.floor(t * (2 + kick * 8) + opt.seed)) % 5;
        p.fill(a.x + 3, a.y + 3 + r * 6, Math.max(4, (a.w - 8) * (0.35 + k * 0.13)), 2, 0xffffff, 0.75);
      }
      if (Math.sin(t * 3 + opt.seed) > 0.2) p.fill(a.x + a.w - 6, a.y + a.h - 6, 3, 3, 0xffffff, 0.9); // con trỏ nhấp nháy
      break;
    }
    case 'leds': {
      a.pts.forEach(([x, y], i) => {
        const on = off ? false : Math.sin(t * (3 + (i % 3)) * (1 + kick * 3) + i * 1.7 + opt.seed) > -0.2;
        const c = opt.wifi && a.color === 0x3fbf6a ? 0xe2412f : a.color;
        p.g.fillStyle(on ? c : 0x2d3142, 1); p.g.fillCircle(p.ox + x, p.oy + y, 2.6);
      });
      break;
    }
    case 'blink': {
      const on = !off && Math.sin(t * (2.2 + kick * 12) + opt.seed) > 0;
      p.g.fillStyle(on ? a.color : 0x2d3142, 1); p.g.fillCircle(p.ox + a.x, p.oy + a.y, 3);
      if (kick > 0 && !off) {
        // đang in: tờ giấy trượt ra khay
        const k = (t * 0.9) % 1;
        p.box(a.x + 8 + k * 10, a.y + 18, 12, 9, 0xffffff, 1, 2);
      }
      break;
    }
    case 'steam': {
      if (off) break;
      if (kick > 0) { p.line(a.x, a.y - 6, a.x, a.y + 2, 0x6b4426, 3); }
      for (let i = 0; i < (kick > 0 ? 5 : 3); i++) {
        const k = (t * (0.6 + kick * 0.5) + i / (kick > 0 ? 5 : 3) + opt.seed * 0.1) % 1;
        p.g.fillStyle(0xffffff, 0.55 * (1 - k)); p.g.fillCircle(p.ox + a.x + Math.sin(k * 6 + i) * 4, p.oy + a.y - k * 26, 3 + k * 4);
      }
      break;
    }
    case 'bubbles': {
      for (let i = 0; i < 4; i++) {
        const k = (t * 0.5 + i / 4 + opt.seed * 0.13) % 1;
        p.g.lineStyle(1.5, 0xffffff, 0.8 * (1 - k * 0.6)); p.g.strokeCircle(p.ox + a.x + (i % 2) * a.w * 0.6 + Math.sin(k * 8) * 2, p.oy + a.y + a.h - k * a.h, 1.6 + (i % 2));
      }
      break;
    }
    case 'fan': {
      const spin = off ? 0 : t * 9;
      for (let i = 0; i < 3; i++) {
        const ang = spin + i * (Math.PI * 2 / 3);
        p.poly([a.x, a.y, a.x + Math.cos(ang) * a.r, a.y + Math.sin(ang) * a.r, a.x + Math.cos(ang + 0.6) * a.r * 0.8, a.y + Math.sin(ang + 0.6) * a.r * 0.8], 0x9aa1b4, 2);
      }
      p.circ(a.x, a.y, 4, 0x2d3142, 2);
      break;
    }
    case 'fish': {
      const cols = [0xff7a2f, 0xffd23f, 0xff9ec4, 0x58d07f];
      for (let i = 0; i < a.n; i++) {
        const sp = (0.35 + i * 0.12) * (1 + kick * 5);
        const ph = (t * sp + i * 0.37 + opt.seed * 0.07) % 2;
        const dir = ph < 1 ? 1 : -1;
        const u = ph < 1 ? ph : 2 - ph;
        const x = a.x + 6 + u * (a.w - 12), y = a.y + a.h * (0.25 + 0.5 * ((i * 0.37) % 1)) + Math.sin(t * 2 + i) * 3;
        p.g.fillStyle(cols[i % cols.length], 1); p.g.fillEllipse(p.ox + x, p.oy + y, 10, 6);
        p.g.fillTriangle(p.ox + x - dir * 5, p.oy + y, p.ox + x - dir * 9, p.oy + y - 3, p.ox + x - dir * 9, p.oy + y + 3);
      }
      break;
    }
    case 'leaves': drawLeaves(p, a.x, a.y, a.s, Math.sin(t * 1.3 + opt.seed) * 0.06 + Math.sin(t * 28) * 0.22 * kick, a.big); break;
    case 'flowers': {
      const cols = [0xff9ec4, 0xffd23f, 0xe2412f, 0xffffff, 0x8a4fd8];
      let i = 0;
      for (let y = a.y + 8; y < a.y + a.h; y += 16) for (let x = a.x + 6; x < a.x + a.w; x += 18) {
        const sw = Math.sin(t * 1.6 + i * 0.7 + opt.seed) * 2;
        p.line(x, y + 8, x + sw, y, 0x2fa05a, 2.5);
        p.g.fillStyle(cols[i % cols.length], 1); p.g.fillCircle(p.ox + x + sw, p.oy + y, 4); p.g.lineStyle(1.5, INK, 1); p.g.strokeCircle(p.ox + x + sw, p.oy + y, 4);
        i++;
      }
      break;
    }
    case 'scan': {
      if (off) { p.fill(a.x, a.y, a.w, a.h, 0x15161f); break; }
      const k = (Math.sin(t * (2.4 + kick * 6)) + 1) / 2;
      p.fill(a.x, a.y + k * (a.h - 2), a.w, 2, 0xffffff, 0.9);
      break;
    }
    case 'pulse': {
      if (off) break;
      const k = (t * 0.8 + opt.seed * 0.1) % 1;
      p.g.lineStyle(2.5, a.color, 0.7 * (1 - k)); p.g.strokeCircle(p.ox + a.x, p.oy + a.y, a.r * (0.4 + k * 0.8));
      break;
    }
    case 'swatch': {
      if (off) { p.fill(a.x, a.y, a.w, a.h, 0x15161f); break; }
      const cols = [0xe2412f, 0xffd23f, 0x3fbf6a, 0x2e9cf0, 0x8a4fd8, 0xff9ec4];
      const i = Math.floor(t * (1.2 + kick * 5)) % cols.length;
      p.fill(a.x, a.y, a.w / 2, a.h, cols[i]); p.fill(a.x + a.w / 2, a.y, a.w / 2, a.h, cols[(i + 2) % cols.length]);
      break;
    }
    case 'chase': {
      for (let i = 0; i < a.n; i++) {
        const on = !off && (Math.floor(t * 6) + i) % 3 === 0;
        p.g.fillStyle(on ? 0xffe36e : 0xc94f8a, 1); p.g.fillCircle(p.ox + a.x + 6 + i * (a.w - 12) / (a.n - 1), p.oy + a.y, 3);
      }
      break;
    }
    case 'claw': {
      const sw = Math.sin(t * 0.9 + opt.seed) * 12;
      p.line(a.x + sw, a.y, a.x + sw, a.y + a.h, INK, 2);
      p.line(a.x + sw, a.y + a.h, a.x + sw - 6, a.y + a.h + 7, INK, 2.5); p.line(a.x + sw, a.y + a.h, a.x + sw + 6, a.y + a.h + 7, INK, 2.5);
      p.g.fillStyle(0x9aa1b4, 1); p.g.fillCircle(p.ox + a.x + sw, p.oy + a.y + a.h, 3.5);
      break;
    }
    case 'drip': {
      const k = (t * 0.7 + opt.seed * 0.1) % 1;
      if (k < 0.7) { p.g.fillStyle(0x5fb8ff, 1); p.g.fillCircle(p.ox + a.x, p.oy + a.y + k * 12, 2.2); }
      break;
    }
    case 'shine': {
      // vệt sáng lướt chéo qua mặt kính
      const k = ((t * 0.35 + opt.seed * 0.1) % 1.6) - 0.3;
      if (k < 0 || k > 1) break;
      const x = a.x + k * a.w;
      p.g.fillStyle(0xffffff, 0.45);
      p.g.fillPoints([{ x: p.ox + x, y: p.oy + a.y + 2 }, { x: p.ox + x + 8, y: p.oy + a.y + 2 }, { x: p.ox + Math.max(a.x, x - 10), y: p.oy + a.y + a.h - 2 }, { x: p.ox + Math.max(a.x, x - 18), y: p.oy + a.y + a.h - 2 }], true);
      break;
    }
    case 'canopy': {
      // tán lá nhiều tầng: lớp tối phía dưới, lớp giữa, lớp sáng phía trên, chùm lá nhỏ, vệt sáng; ngọn đung đưa nhiều hơn gốc
      const sw = Math.sin(t * 1.1 + opt.seed) * 2.5;
      const R = a.r;
      const layer = (dy: number, k: number) => sw * (1 + (-dy) / 18) * k;
      const dark = 0x3a8f3e, mid = 0x4fae4c, light = 0x6fcd68;
      p.circ(a.x - R * 0.55 + layer(8, 0.6), a.y + 8, R * 0.62, dark, 3); p.circ(a.x + R * 0.55 + layer(8, 0.6), a.y + 8, R * 0.62, dark, 3); p.circ(a.x + layer(10, 0.6), a.y + 10, R * 0.66, dark, 3);
      p.circ(a.x - R * 0.42 + layer(-2, 0.8), a.y - 4, R * 0.62, mid, 3); p.circ(a.x + R * 0.42 + layer(-2, 0.8), a.y - 4, R * 0.62, mid, 3);
      p.circ(a.x + layer(-14, 1), a.y - 14, R * 0.7, light, 3);
      for (const [dx, dy] of [[-0.5, -0.2], [0.35, -0.55], [0.1, 0.2], [-0.1, -0.7]] as const) { p.ell(a.x + dx * R + layer(dy * R, 1), a.y + dy * R, 8, 5, shade(light, 0.25), 1.5); }
      p.shine(a.x - R * 0.3 + layer(-14, 1), a.y - 24, a.x + 2 + layer(-14, 1), a.y - 27);
      break;
    }
  }
}

/** Nắp / cửa lối trốn: đóng bình thường; kick 0..1 là vừa có người chui (nắp bật lên, bụi bay) */
function drawVent(p: Pen, kind: VentKind, t: number, kick: number, seed: number) {
  const W = 48, H = 48;
  const pop = kick > 0 ? Math.sin(Math.min(1, kick) * Math.PI) : 0; // 0 → 1 → 0
  const dust = (x: number, y: number, n: number) => {
    if (kick <= 0) return;
    const u = 1 - kick;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + seed;
      p.g.fillStyle(0xd9d5c8, 0.75 * kick); p.g.fillCircle(p.ox + x + Math.cos(a) * (8 + u * 22), p.oy + y + Math.sin(a) * (4 + u * 10) - u * 10, 3 + u * 3);
    }
  };
  switch (kind) {
    case 'grate': {
      // lưới thông gió: nan rung nhẹ, làn hơi bay lên; có người chui thì lưới bật hẳn lên
      const lift = pop * 16, tilt = pop * 0.35;
      const ox = 6, oy = 8 - lift;
      p.g.fillStyle(0x9aa1b4, 1); p.g.lineStyle(3, INK, 1);
      const pts = [{ x: ox, y: oy }, { x: ox + W - 12, y: oy - tilt * 20 }, { x: ox + W - 12, y: oy + H - 16 - tilt * 20 }, { x: ox, y: oy + H - 16 }].map(q => ({ x: p.ox + q.x, y: p.oy + q.y }));
      p.g.fillPoints(pts, true); p.g.strokePoints(pts, true);
      for (let i = 1; i < 5; i++) { const y = oy + i * (H - 16) / 5 + Math.sin(t * 6 + i) * 0.6; p.line(ox + 4, y - tilt * 10, ox + W - 16, y - tilt * 18, INK, 2); }
      for (const [x, y] of [[ox + 3, oy + 3], [ox + W - 15, oy + 3], [ox + 3, oy + H - 19], [ox + W - 15, oy + H - 19]]) p.g.fillStyle(INK, 1), p.g.fillCircle(p.ox + x, p.oy + y - tilt * 10, 1.8);
      if (kick <= 0) for (let i = 0; i < 2; i++) { const u = (t * 0.5 + i * 0.5 + seed * 0.1) % 1; p.g.fillStyle(0xffffff, 0.35 * (1 - u)); p.g.fillCircle(p.ox + 16 + i * 14 + Math.sin(u * 6) * 3, p.oy + 14 - u * 22, 3 + u * 3); }
      dust(W / 2, H / 2, 7);
      break;
    }
    case 'cable': {
      // nắp sàn kỹ thuật: tấm thép gân có tay kéo, đèn hổ phách nháy chậm
      const lift = pop * 14;
      p.box(5, 7 - lift, W - 10, H - 14, 0xb9c0cf, 4, 3);
      for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) p.line(10 + i * 7, 14 + j * 9 - lift, 13 + i * 7, 11 + j * 9 - lift, 0x8c93a8, 2);
      p.box(W / 2 - 7, H - 16 - lift, 14, 5, 0x4b5070, 2, 2);
      const on = Math.sin(t * 1.6 + seed) > 0.6;
      p.g.fillStyle(on ? 0xffb020 : 0x6b4a10, 1); p.g.fillCircle(p.ox + W - 10, p.oy + 10 - lift, 2.6);
      dust(W / 2, H / 2, 6);
      break;
    }
    case 'locker': {
      // cánh tủ có khe thoáng; thỉnh thoảng hé khe sáng; có người chui thì cánh mở toang rồi đóng sập
      const open = pop;
      const dw = (W - 22) * (1 - open * 0.75);
      p.box(11, H - 70, dw, 60, 0xa8aec0, 2, 2.5);
      for (let i = 0; i < 4; i++) p.line(14, H - 64 + i * 5, 11 + dw - 4, H - 64 + i * 5, INK, 1.5);
      p.box(11 + dw - 7, H - 42, 3, 10, 0x4b5070, 1, 1.5);
      if (kick <= 0 && Math.sin(t * 0.7 + seed) > 0.92) p.fill(12, H - 40, 2, 20, 0xfff3a0, 0.8);
      dust(W / 2, H - 14, 6);
      break;
    }
    case 'desk': {
      // gầm bàn: có người chui thì mặt bàn rung, bụi bay ra từ gầm
      if (kick > 0) { const sh = Math.sin(t * 60) * 2 * kick; p.box(2 + sh, H - 18 - 22 - 10 - 4, W - 4, 6, 0xe7b98a, 2, 2); }
      dust(W / 2, H - 10, 6);
      break;
    }
    case 'ceiling': {
      // ô trần: có người chui thì ô trần lệch sang, vụn thạch cao rơi; lúc yên thì thỉnh thoảng rơi một hạt bụi
      const slide = pop * 14;
      p.box(10 + slide, -36, W - 20, 14, 0xe9e4d6, 2, 2);
      if (kick > 0) for (let i = 0; i < 6; i++) { const u = 1 - kick; p.g.fillStyle(0xf1efe8, kick); p.g.fillRect(p.ox + 12 + i * 5, p.oy - 20 + u * (40 + i * 6), 3, 3); }
      else { const u = (t * 0.3 + seed * 0.1) % 1; if (u < 0.5) { p.g.fillStyle(0xf1efe8, 0.8); p.g.fillRect(p.ox + 24, p.oy - 20 + u * 80, 2, 2); } }
      break;
    }
    case 'shaft': case 'hatch': {
      // nắp thép có khắc hình thang máy (hai cánh cửa + mũi tên lên xuống); có người chui thì nắp bật lên
      const lift = pop * 12;
      p.box(9, 9 - lift, W - 18, H - 18, 0xb9c0cf, 3, 2.5);
      p.box(16, 14 - lift, 14, 20, 0x9aa1b4, 1, 2); p.line(23, 14 - lift, 23, 34 - lift, INK, 1.5);
      p.poly([36, 16 - lift, 33, 21 - lift, 39, 21 - lift], 0x3fbf6a, 1.5); p.poly([36, 32 - lift, 33, 27 - lift, 39, 27 - lift], 0xe2412f, 1.5);
      const on = Math.sin(t * 2 + seed) > 0.4;
      p.g.fillStyle(on ? 0xffb020 : 0x6b4a10, 1); p.g.fillCircle(p.ox + W - 13, p.oy + H - 13 - lift, 2.4);
      dust(W / 2, H / 2, 6);
      break;
    }
  }
}
