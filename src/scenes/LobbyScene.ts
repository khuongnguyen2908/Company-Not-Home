// Sảnh chờ tầng G: người chơi đi lại tự do trong lúc chờ vào ca.
// Có máy thay đồ (đổi ngoại hình), bảng thông báo (cài đặt ván) và thang máy lên văn phòng.
import Phaser from 'phaser';
import { session } from '../session';
import { characterCanvas, shadowCanvas, lookKey, tagText, lookColor, type Look, CHAR_ORIGIN_Y } from '../render/chars';

const T = 48;
const W = 26, H = 16;
const INK = 0x1d1a2b;
const SPEED = 205;
const SCALE = 0.78;

// 0 tường, 1 sàn, 2 đồ chặn
const GRID = new Uint8Array(W * H);
for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) GRID[y * W + x] = 1;
const block = (x: number, y: number, w: number, h: number) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) GRID[j * W + i] = 2; };
block(2, 8, 6, 1);    // quầy lễ tân
block(21, 1, 2, 2);   // máy thay đồ
block(15, 12, 4, 1);  // sofa
block(23, 8, 1, 1);   // cây nước
block(1, 13, 1, 1); block(24, 13, 1, 1); block(1, 1, 1, 1); // chậu cây

const floorAt = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < W && ty < H && GRID[ty * W + tx] === 1;
const canStand = (px: number, py: number) => {
  for (const [x, y] of [[px - 11, py - 7], [px + 11, py - 7], [px - 11, py + 7], [px + 11, py + 7]]) if (!floorAt(Math.floor(x / T), Math.floor(y / T))) return false;
  return true;
};

// Vùng tương tác (theo ô): đứng cách mép vùng dưới ~1,3 ô là dùng được
export const LOBBY_SPOTS = {
  wardrobe: { x0: 21, y0: 0.3, x1: 23, y1: 2.9, x: 22 * T, y: 3.4 * T, label: '👕 Máy thay đồ' },
  // Cài đặt phòng nằm ở máy tính quầy lễ tân (giữa sảnh, không bị bảng nào che)
  board: { x0: 2, y0: 7.1, x1: 8, y1: 8.9, x: 5 * T, y: 6.75 * T, label: '⚙️ Máy tính lễ tân · Cài đặt phòng' },
  elevator: { x0: 10, y0: 0, x1: 16, y1: 1, x: 13 * T, y: 1.55 * T, label: '🛗 Thang máy lên văn phòng' },
};

interface Mover { phase: number; x: number; y: number; tx: number; ty: number; wait: number; facing: 1 | -1; moving: boolean; walkT: number; look: Look; name: string; color: string;
  sprite: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; tag: Phaser.GameObjects.Text }

export class LobbyScene extends Phaser.Scene {
  private me: Mover | null = null;
  private bots: Mover[] = [];
  private version = -1;
  private myKey = '';
  private camX = 13 * T; private camY = 8 * T;
  private zoom = 1;
  private spotLabels = new Map<string, Phaser.GameObjects.Text>();
  private glow!: Phaser.GameObjects.Graphics;

  constructor() { super('lobby'); }

  create() {
    this.me = null; this.bots = []; this.version = -1; this.myKey = '';
    if (!this.textures.exists('shadow')) this.textures.addCanvas('shadow', shadowCanvas());
    this.drawHall();
    // Viền phát sáng và nhãn luôn hiện cho những chỗ bấm được
    this.glow = this.add.graphics().setDepth(-30);
    this.spotLabels = new Map();
    for (const [k, sp] of Object.entries(LOBBY_SPOTS)) {
      this.spotLabels.set(k, this.add.text(sp.x, sp.y, sp.label, {
        fontFamily: '"Baloo 2", "Trebuchet MS", sans-serif', fontSize: '17px', fontStyle: '800', color: '#ffffff',
        backgroundColor: '#1d1a2b', padding: { x: 8, y: 3 },
      }).setOrigin(0.5, 0.5).setDepth(40000));
    }
    const onResize = () => this.layout();
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
    this.layout();
  }

  private layout() {
    const w = this.scale.width, h = this.scale.height;
    // Màn hình dọc (điện thoại): phóng theo chiều cao để nhân vật không quá nhỏ, camera tự cuộn ngang
    const fit = Math.min(w / 760, h / 520);
    const portrait = h > w ? Math.min(h / (H * T + 120), w / 420) : 0;
    this.zoom = Phaser.Math.Clamp(Math.max(fit, portrait), 0.62, 1.3);
    this.cameras.main.setZoom(this.zoom);
  }

  private box(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fill: number, r = 6, lw = 3.5) {
    g.fillStyle(fill, 1); g.fillRoundedRect(x, y, w, h, r);
    g.lineStyle(lw, INK, 1); g.strokeRoundedRect(x, y, w, h, r);
  }

  private label(x: number, y: number, text: string, size = 16, color = '#1d1a2b', bg?: string) {
    return this.add.text(x, y, text, {
      fontFamily: '"Baloo 2", "Trebuchet MS", sans-serif', fontSize: `${size}px`, fontStyle: '800', color,
      backgroundColor: bg, padding: bg ? { x: 6, y: 2 } : undefined,
    }).setOrigin(0.5).setDepth(-40);
  }

  private drawHall() {
    const g = this.add.graphics().setDepth(-100);
    // Sàn đá cẩm thạch kẻ ô
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (GRID[y * W + x] === 0) continue;
      g.fillStyle((x + y) % 2 ? 0xe9e4da : 0xdcd5c8, 1); g.fillRect(x * T, y * T, T, T);
    }
    // Thảm đỏ từ cửa vào tới thang máy
    g.fillStyle(0xc0392b, 0.85); g.fillRect(11 * T + 8, 2 * T, 4 * T - 16, 12 * T);
    g.lineStyle(3, 0xe8c547, 1); g.strokeRect(11 * T + 8, 2 * T, 4 * T - 16, 12 * T);
    // Tường
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (GRID[y * W + x] !== 0) continue;
      const front = y + 1 < H && GRID[(y + 1) * W + x] !== 0;
      g.fillStyle(front ? 0x8a90b4 : 0x2b2e4a, 1); g.fillRect(x * T, y * T, T, T);
      if (front) { g.fillStyle(0x6d7398, 1); g.fillRect(x * T, y * T + T - 10, T, 10); }
    }
    g.lineStyle(5, INK, 1); g.strokeRect(T, T, (W - 2) * T, (H - 2) * T);
    // Hai cửa thang máy lên văn phòng
    for (const ex of [10, 14]) {
      this.box(g, ex * T + 4, 0.05 * T, 2 * T - 8, 0.95 * T, 0xc9b26b, 4);
      g.lineStyle(3, INK, 1); g.lineBetween((ex + 1) * T, 0.05 * T, (ex + 1) * T, T);
    }
    this.box(g, 12 * T + 10, 0.15 * T, 2 * T - 20, 22, 0x1d1a2b, 4, 2);
    this.label(13 * T, 0.15 * T + 11, '▲ VĂN PHÒNG', 13, '#ff5d5d').setDepth(-40);
    // Bảng tin trên tường (trang trí)
    this.box(g, 3 * T, 0.12 * T, 3 * T, 0.82 * T, 0xc79a62, 4);
    this.box(g, 3 * T + 8, 0.2 * T, 3 * T - 16, 0.62 * T, 0xf6e7c1, 2, 2.5);
    for (const [px, c] of [[3.4, 0xffe36e], [4.2, 0xff9ec4], [5.0, 0x9fe0ff]] as const) { g.fillStyle(c, 1); g.fillRect(px * T, 0.28 * T, 0.6 * T, 0.42 * T); }
    // Máy thay đồ
    this.box(g, 21 * T + 2, 0.3 * T, 2 * T - 4, 2.6 * T, 0x8a5cf5, 10);
    this.box(g, 21 * T + 14, 0.6 * T, 2 * T - 28, 1.2 * T, 0x1d1a2b, 6, 3);
    g.fillStyle(0x9fe0ff, 0.9); g.fillRect(21 * T + 20, 0.7 * T, 2 * T - 40, 1.0 * T);
    this.box(g, 21 * T + 22, 2.05 * T, 2 * T - 44, 0.5 * T, 0xffe36e, 4, 2.5);
    this.label(22 * T, 2.3 * T, 'THAY ĐỒ', 12);
    // Quầy lễ tân
    this.box(g, 2 * T, 7.6 * T, 6 * T, 1.3 * T, 0xe8d3b0, 8);
    this.box(g, 3 * T, 7.2 * T, 1.1 * T, 0.7 * T, 0x2d3142, 4, 3);
    g.fillStyle(0x5fb8ff, 1); g.fillRect(3 * T + 6, 7.2 * T + 6, 1.1 * T - 12, 0.7 * T - 12);
    this.label(5 * T, 8.35 * T, 'LỄ TÂN · CHECK-IN', 15);
    // Sofa và bàn nước chờ
    this.box(g, 15 * T, 11.6 * T, 4 * T, 1.3 * T, 0x4d7cc7, 12);
    this.box(g, 15.4 * T, 12 * T, 1.5 * T, 0.7 * T, 0x6a96dc, 8, 2.5);
    this.box(g, 17.1 * T, 12 * T, 1.5 * T, 0.7 * T, 0x6a96dc, 8, 2.5);
    // Cây xanh, cây nước
    for (const [x, y] of [[1, 13], [24, 13], [1, 1]]) {
      this.box(g, x * T + 12, y * T + 22, T - 24, T - 24, 0xd97b4a, 4);
      for (const [dx, dy, r] of [[24, 14, 12], [14, 6, 9], [34, 6, 9], [24, -2, 9]]) { g.fillStyle(0x3fa66b, 1); g.fillCircle(x * T + dx, y * T + dy, r); g.lineStyle(3, INK, 1); g.strokeCircle(x * T + dx, y * T + dy, r); }
    }
    this.box(g, 23 * T + 12, 8 * T + 12, T - 24, T - 14, 0xe9edf5, 4);
    this.box(g, 23 * T + 14, 8 * T - 14, T - 28, 28, 0x8fd3ff, 10);
    // Cửa kính ra đường
    this.box(g, 11 * T, 15 * T + 4, 4 * T, T - 8, 0x9fd6ff, 4, 3);
    g.lineStyle(3, INK, 1); g.lineBetween(13 * T, 15 * T + 4, 13 * T, 16 * T - 4);
    // Chữ trên sàn
    this.label(13 * T, 10.2 * T, 'SẢNH TẦNG G', 40, '#1d1a2b').setAlpha(0.14);
  }

  private makeMover(name: string, look: Look, x: number, y: number): Mover {
    const key = this.ensureTex(look);
    const shadow = this.add.image(x, y, 'shadow');
    const sprite = this.add.image(x, y, `${key}_0`).setOrigin(0.5, CHAR_ORIGIN_Y).setScale(SCALE);
    const tag = this.add.text(x, y - 66, name, {
      fontFamily: '"Baloo 2", "Trebuchet MS", sans-serif', fontSize: '17px', fontStyle: '800', color: '#ffffff',
      padding: { x: 2, y: 1 }, stroke: '#1d1a2b', strokeThickness: 5,
    }).setOrigin(0.5, 1);
    return { phase: Math.random() * 10, x, y, tx: x, ty: y, wait: Math.random() * 3, facing: 1, moving: false, walkT: 0, look, name, color: lookColor(look), sprite, shadow, tag };
  }

  private ensureTex(look: Look) {
    const key = 'ch_' + lookKey(look).replace(/[^a-z0-9]/gi, '');
    for (const f of [0, 1, 2] as const) if (!this.textures.exists(`${key}_${f}`)) this.textures.addCanvas(`${key}_${f}`, characterCanvas(look, f));
    return key;
  }

  private randomFloor() {
    for (let i = 0; i < 40; i++) {
      const x = 2 + Math.floor(Math.random() * (W - 4)), y = 3 + Math.floor(Math.random() * (H - 5));
      if (floorAt(x, y)) return { x: x * T + T / 2, y: y * T + T / 2 };
    }
    return { x: 13 * T, y: 8 * T };
  }

  private syncPeople() {
    const L = session.lobby;
    if (!L.me.look) return;
    if (!this.me) {
      this.me = this.makeMover(`${L.me.name} #${L.me.empId}`, L.me.look, 13 * T, 9 * T);
      this.camX = this.me.x; this.camY = this.me.y;
    }
    const k = lookKey(L.me.look) + L.me.name + L.me.empId;
    if (k !== this.myKey) {
      this.myKey = k;
      this.me.look = L.me.look; this.me.name = L.me.name;
      this.ensureTex(L.me.look);
      this.me.tag.setText(`${L.me.name} #${L.me.empId}`);
    }
    if (this.version !== L.version) {
      this.version = L.version;
      for (const b of this.bots) { b.sprite.destroy(); b.shadow.destroy(); b.tag.destroy(); }
      this.bots = L.bots.map(p => { const s = this.randomFloor(); return this.makeMover(`${p.name} #${p.empId}`, p.look, s.x, s.y); });
    }
  }

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

  private draw(m: Mover) {
    const key = 'ch_' + lookKey(m.look).replace(/[^a-z0-9]/gi, '');
    const frame = m.moving ? (Math.floor(m.walkT * 7) % 2 === 0 ? 1 : 2) : 0;
    const fl = m.look.body === 'ghost' ? Math.sin(this.time.now / 320 + m.phase) * 4 - 5 : 0; // pha cố định cho mỗi người, không phụ thuộc vị trí
    m.sprite.setTexture(`${key}_${frame}`).setFlipX(m.facing < 0).setPosition(m.x, m.y + 6 + fl).setDepth(m.y);
    if (m.look.body === 'slime') m.sprite.setScale(SCALE * (1 + Math.sin(this.time.now / 260) * 0.025), SCALE * (1 - Math.sin(this.time.now / 260) * 0.03)); else m.sprite.setScale(SCALE);
    m.shadow.setPosition(m.x, m.y + 4).setDepth(m.y - 1);
    m.tag.setPosition(m.x, m.y - 66).setDepth(30000 + m.y);
  }

  update(_t: number, deltaMs: number) {
    const dt = Math.min(0.05, deltaMs / 1000);
    session.onFrame(dt);
    this.syncPeople();
    if (!this.me) return;
    const inp = session.paused ? { x: 0, y: 0 } : session.input;
    this.step(this.me, inp.x, inp.y, dt);
    this.draw(this.me);
    // Đồng nghiệp bot đi dạo, ngồi chờ
    for (const b of this.bots) {
      if (b.wait > 0) { b.wait -= dt; b.moving = false; }
      else {
        const dx = b.tx - b.x, dy = b.ty - b.y;
        if (Math.hypot(dx, dy) < 8) { b.wait = 1.5 + Math.random() * 4; const n = this.randomFloor(); b.tx = n.x; b.ty = n.y; }
        else {
          const ox = b.x, oy = b.y;
          this.step(b, dx, dy, dt * 0.55);
          if (Math.abs(b.x - ox) + Math.abs(b.y - oy) < 0.2) { const n = this.randomFloor(); b.tx = n.x; b.ty = n.y; }
        }
      }
      this.draw(b);
    }
    // Chỗ tương tác gần nhất
    type Spot = keyof typeof LOBBY_SPOTS;
    let near: Spot | null = null, nd = 1.3 * T;
    for (const k of Object.keys(LOBBY_SPOTS) as Spot[]) {
      const sp = LOBBY_SPOTS[k];
      const cx = Math.max(sp.x0 * T, Math.min(sp.x1 * T, this.me.x)), cy = Math.max(sp.y0 * T, Math.min(sp.y1 * T, this.me.y - 20));
      const d = Math.hypot(cx - this.me.x, cy - (this.me.y - 20));
      if (d < nd) { nd = d; near = k; }
    }
    session.lobby.near = near;
    const pulse = 0.45 + 0.35 * Math.sin(this.time.now / 260);
    this.glow.clear();
    for (const k of Object.keys(LOBBY_SPOTS) as Spot[]) {
      const sp = LOBBY_SPOTS[k], on = k === near;
      const pad = on ? 8 : 4;
      this.glow.lineStyle(on ? 6 : 4, 0xffd23f, on ? 1 : pulse);
      this.glow.strokeRoundedRect(sp.x0 * T - pad, sp.y0 * T - pad, (sp.x1 - sp.x0) * T + pad * 2, (sp.y1 - sp.y0) * T + pad * 2, 12);
      const lbl = this.spotLabels.get(k)!;
      lbl.setText(on ? `${sp.label} · Bấm E` : sp.label)
        .setBackgroundColor(on ? '#ffd23f' : '#1d1a2b').setColor(on ? '#1d1a2b' : '#ffffff')
        .setY(sp.y + (on ? Math.sin(this.time.now / 180) * 3 : 0));
    }
    // Camera theo người chơi, không trôi ra ngoài sảnh
    const w = this.scale.width, h = this.scale.height;
    const vw = w / this.zoom, vh = h / this.zoom;
    const k = Math.min(1, dt * 8);
    this.camX += (this.me.x - this.camX) * k; this.camY += (this.me.y - 30 - this.camY) * k;
    const cx = vw >= W * T ? (W * T) / 2 : Phaser.Math.Clamp(this.camX, vw / 2, W * T - vw / 2);
    const cy = vh >= H * T ? (H * T) / 2 : Phaser.Math.Clamp(this.camY, vh / 2, H * T - vh / 2);
    this.cameras.main.setScroll(cx - w / 2, cy - h / 2);
  }
}
