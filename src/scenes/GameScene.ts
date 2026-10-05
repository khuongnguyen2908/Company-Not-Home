import Phaser from 'phaser';
import {
  TILE, MAP_W, MAP_H, ROOMS, FURNITURE, DESKS, STATIONS, HIDE_SPOTS, BELL, station,
  GRID, ROOM_GRID, isWallTile, type Furniture,
} from '../game/map';
import { characterCanvas, chairCanvas, lightCanvas, glowCanvas, shadowCanvas, lookKey, tagText, CHAR_ORIGIN_Y } from '../render/chars';
import { visibilityPolygon } from '../game/vision';
import { furnitureArt, drawAnim, Pen, ventArt, ventKind, type Anim } from '../render/furniture';
import { GRID as MAP_GRID } from '../game/map';
import { DOOR_BLOCK, CAMERAS, FLOORS, TOP_WALL, PORTALS, LIFT_DOORS, CABIN, CABIN_DOOR, levelAt, levelName, ELEV_BLOCK, STAIRWELL, STAIRS_LEVEL, LANDINGS, STAIR_FLIGHTS } from '../game/map';
import { STICKERS } from '../game/data';
import { session } from '../session';
import { net } from '../net/room';
import { markFrame } from '../net/pump';
import { sfx } from '../audio';
import { slotStation, type Agent } from '../game/sim';

const INK = 0x1d1a2b;
const CHAR_SCALE = 0.78;

interface AgentView {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  tag: Phaser.GameObjects.Text;
}

export class GameScene extends Phaser.Scene {
  private views = new Map<number, AgentView>();
  private bodyViews: Phaser.GameObjects.Image[] = [];
  private markers = new Map<string, Phaser.GameObjects.Text>();
  private hideMarkers: Phaser.GameObjects.Text[] = [];
  private glows: Phaser.GameObjects.Image[] = [];
  private scanGlow!: Phaser.GameObjects.Image;
  private hrGlow!: Phaser.GameObjects.Image;
  private artGlow!: Phaser.GameObjects.Image;
  private urgent!: Phaser.GameObjects.Graphics;
  private camLeds!: Phaser.GameObjects.Graphics;
  private fidMarker: Phaser.GameObjects.Text | null = null;
  private deskLabels: Phaser.GameObjects.Text[] = [];
  private liftG: Phaser.GameObjects.Graphics | null = null;
  private liftLabels: Phaser.GameObjects.Text[] = [];
  private noiseIcons: Phaser.GameObjects.Text[] = [];
  private stickerBubble: Phaser.GameObjects.Text | null = null;
  private artMarker: Phaser.GameObjects.Text | null = null;
  private readyHalo: Phaser.GameObjects.Image | null = null;
  private fogTex!: Phaser.Textures.CanvasTexture;
  private fogImg!: Phaser.GameObjects.Image;
  private doorG!: Phaser.GameObjects.Graphics;
  private doorKey = '';
  private camX = 0; camY = 0;
  private zoom = 1;
  private flicker = 0;
  private flickerT = 4;
  private gameId = -1;
  private fogLevel = 0.72;

  constructor() { super('game'); }

  create() {
    // Cảnh này được bật/tắt nhiều lần (sảnh <-> văn phòng): xóa trạng thái cũ
    this.views = new Map(); this.bodyViews = []; this.markers = new Map(); this.hideMarkers = []; this.glows = [];
    this.gameId = -1; this.doorKey = ''; this.fidMarker = null; this.deskLabels = []; this.artMarker = null; this.readyHalo = null; this.noiseIcons = []; this.stickerBubble = null; this.liftG = null; this.liftLabels = []; this.floorTags = []; this.liftOpen = new Map(); this.emotes = new Map(); this.powerFxStart = -1; this.ventPop = new Map();
    const tex = (key: string, make: () => HTMLCanvasElement) => { if (!this.textures.exists(key)) this.textures.addCanvas(key, make()); };
    tex('chair', chairCanvas);
    tex('light', () => lightCanvas(256));
    tex('glow', () => glowCanvas('rgba(90,170,255,0.85)', 128));
    tex('scanglow', () => glowCanvas('rgba(80,255,150,0.95)', 128));
    tex('shadow', shadowCanvas);
    tex('hrglow', () => glowCanvas('rgba(255,90,190,0.95)', 128));
    tex('artglow', () => glowCanvas('rgba(255,200,60,0.95)', 128));

    this.drawMap();

    // Sương mù vẽ trên canvas nửa độ phân giải (mép bóng mềm nên không thấy khác) rồi phóng to
    if (this.textures.exists('fogc')) this.textures.remove('fogc');
    this.fogTex = this.textures.createCanvas('fogc', 4, 4)!;
    this.fogImg = this.add.image(0, 0, 'fogc').setOrigin(0, 0).setDepth(50000);
    this.doorG = this.add.graphics().setDepth(5);

    const fid = station('faceid');
    this.hrGlow = this.add.image(fid.mark.x * TILE, fid.mark.y * TILE + 4, 'hrglow').setScale(1.5).setDepth(40001)
      .setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    const cc = station('colorcheck');
    this.artGlow = this.add.image(cc.mark.x * TILE, cc.mark.y * TILE + 4, 'artglow').setScale(1.5).setDepth(40001).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    const sc = station('fingerprint');
    this.scanGlow = this.add.image(sc.mark.x * TILE, sc.mark.y * TILE + 4, 'scanglow').setScale(1.4).setDepth(40001)
      .setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    for (const d of DESKS) {
      // Quầng sáng màn hình lúc mất điện: đặt đúng chỗ màn hình dựng phía sau bàn (góc nhìn 3/4)
      const gl = this.add.image((d.x + 1) * TILE, d.y * TILE - 15, 'glow').setScale(1.6).setDepth(50001)
        .setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      this.glows.push(gl);
    }

    // Dấu "!" ở các điểm làm việc
    for (const s of STATIONS) {
      if (s.id === 'camera') continue;
      const t = this.add.text(s.mark.x * TILE, s.mark.y * TILE, '!', {
        fontFamily: '"Baloo 2", "Trebuchet MS", sans-serif', fontSize: '34px', fontStyle: '800',
        color: (s.id === 'router' || s.id === 'power') ? '#ff4d4d' : '#ffd23f', stroke: '#1d1a2b', strokeThickness: 6,
      }).setOrigin(0.5, 1).setDepth(50001).setVisible(false); // nổi trên lớp sương che tầm nhìn
      this.markers.set(s.id, t);
    }
    HIDE_SPOTS.forEach((h) => {
      const t = this.add.text(h.x * TILE + TILE / 2, h.y * TILE + 4, '◆', {
        fontFamily: 'sans-serif', fontSize: '18px', color: '#ff5d73', stroke: '#1d1a2b', strokeThickness: 4,
      }).setOrigin(0.5, 1).setDepth(55000).setVisible(false); // nổi trên sương để thấy từ xa
      this.hideMarkers.push(t);
    });

    this.urgent = this.add.graphics().setDepth(60000);
    this.camLeds = this.add.graphics().setDepth(4);
    const onResize = () => this.layout();
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
    this.layout();
  }

  private layout() {
    const w = this.scale.width, h = this.scale.height;
    this.zoom = Phaser.Math.Clamp(Math.min(w / 700, h / 560), w < h ? 0.68 : 0.6, 1.25);
    this.cameras.main.setZoom(this.zoom);
  }

  // ---------- Vẽ bản đồ ----------
  private drawMap() {
    // Bản đồ chỉ cần nướng một lần
    if (this.textures.exists('map') && this.textures.exists('mapfull')) { this.addMapLayers(); this.addFurniture(); this.addVents(); return; } // ván sau: dùng lại ảnh nền, vẫn phải đặt lại đồ đạc
    const g = this.add.graphics().setDepth(-100);
    // Sàn
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const id = ROOM_GRID[y * MAP_W + x];
      if (!id) continue;
      const r = ROOMS.find(r => r.id === id)!;
      const checker = r.pattern === 'checker' ? ((x + y) % 2 === 0) : r.pattern === 'stripe' ? y % 2 === 0 : false;
      g.fillStyle(checker ? r.floor2 : r.floor, 1);
      g.fillRect(x * TILE, y * TILE, TILE, TILE);
      if (id === 'open') { g.fillStyle(0x000000, 0.03); if ((x * 7 + y * 3) % 5 === 0) g.fillRect(x * TILE + 6, y * TILE + 6, 6, 6); }
    }
    // Tường
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (!isWallTile(x, y)) continue;
      const below = !isWallTile(x, y + 1) && y + 1 < MAP_H;
      if (below) {
        g.fillStyle(0x8a90b4, 1); g.fillRect(x * TILE, y * TILE, TILE, TILE);
        g.fillStyle(0x6d7398, 1); g.fillRect(x * TILE, y * TILE + TILE - 10, TILE, 10);
        g.fillStyle(0x9aa1c4, 1); g.fillRect(x * TILE, y * TILE, TILE, 6);
      } else {
        g.fillStyle(0x2b2e4a, 1); g.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
    // Viền đậm giữa sàn và tường
    g.lineStyle(5, INK, 1);
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (!isWallTile(x, y)) continue;
      const X = x * TILE, Y = y * TILE;
      const below = !isWallTile(x, y + 1) && y + 1 < MAP_H;
      if (!isWallTile(x, y + 1) && y + 1 < MAP_H) g.lineBetween(X, Y + TILE, X + TILE, Y + TILE);
      if (!isWallTile(x, y - 1) && y > 0) g.lineBetween(X, Y, X + TILE, Y);
      if (!isWallTile(x - 1, y) && x > 0) g.lineBetween(X, Y, X, Y + TILE);
      if (!isWallTile(x + 1, y) && x + 1 < MAP_W) g.lineBetween(X + TILE, Y, X + TILE, Y + TILE);
      if (below && (isWallTile(x, y - 1))) g.lineBetween(X, Y, X + TILE, Y);
    }
    // Trang trí tường: cửa thang máy VIP, cửa sổ, bảng
    this.decorWalls(g);
    // Nướng nền (sàn, tường, trang trí) thành một ảnh. Đồ đạc là vật thể riêng để che khuất đúng theo góc nhìn 3/4.
    g.generateTexture('map', MAP_W * TILE, MAP_H * TILE);
    // Bản có đủ đồ đạc (vẽ phẳng) cho màn hình camera an ninh
    for (const f of FURNITURE) {
      const art = furnitureArt(f.kind, f.w * TILE, f.h * TILE, { low: this.againstSouthWall(f) });
      const pen = new Pen(g, f.x * TILE, f.y * TILE + this.wallDy(f, art.up));
      art.draw(pen);
      for (const a of art.anims) drawAnim(pen, a, 0, { power: true, wifi: false, seed: 0 });
    }
    for (const h of HIDE_SPOTS) { const art = ventArt(ventKind(h.id)); const pen = new Pen(g, h.x * TILE, h.y * TILE); art.draw(pen); for (const a of art.anims) drawAnim(pen, a, 0, { power: true, wifi: false, seed: 0 }); }
    g.generateTexture('mapfull', MAP_W * TILE, MAP_H * TILE);
    g.destroy();
    this.addMapLayers();
    this.addFurniture();
    this.addVents();
  }

  private addMapLayers() {
    session.mapImage = this.textures.get('mapfull').getSourceImage() as CanvasImageSource;
    this.add.image(0, 0, 'map').setOrigin(0, 0).setDepth(-100);

    for (const r of ROOMS) {
      if (!r.label) continue;
      this.add.text((r.x + r.w / 2) * TILE, (r.y + r.h / 2) * TILE + (r.id === 'open' ? 0.2 * TILE : r.id === 'meeting' ? 3.6 * TILE : 0), r.name, {
        fontFamily: '"Baloo 2", "Trebuchet MS", sans-serif', fontSize: '40px', fontStyle: '800', color: '#1d1a2b',
      }).setOrigin(0.5).setAlpha(0.13).setDepth(-50);
    }
  }

  /** Đồ đạc: mỗi món là một ảnh riêng, thứ tự che khuất theo mép dưới chân đế; món nào có chuyển động thì có lớp vẽ riêng */
  private furnAnims: { g: Phaser.GameObjects.Graphics; x: number; y: number; cx: number; cy: number; rx: number; ry: number; anims: Anim[]; level: number; bx: number; by: number; bw: number; bh: number; seed: number; spot?: number }[] = [];
  private addFurniture() {
    this.furnAnims = [];
    FURNITURE.forEach((f, i) => {
      const W = f.w * TILE, H = f.h * TILE;
      const low = this.againstSouthWall(f);
      const art = furnitureArt(f.kind, W, H, { low });
      const key = `fu_${f.kind}_${W}_${H}${low ? '_low' : ''}`;
      const tw = W + art.left + art.right + art.pad * 2, th = H + art.up + art.pad * 2;
      if (!this.textures.exists(key)) {
        const g = this.make.graphics({ x: 0, y: 0 }, false);
        art.draw(new Pen(g, art.pad + art.left, art.pad + art.up));
        g.generateTexture(key, tw, th);
        g.destroy();
      }
      // đồ treo trên mặt tường: bỏ phần nhô lên, nằm gọn giữa mặt tường
      const X = f.x * TILE, Y = f.y * TILE + this.wallDy(f, art.up);
      // Món cho người ngồi lên (sofa): xếp theo mép trên để người ngồi nằm trên; còn lại theo mép dưới
      const depth = art.seatDepth ? Y + 2 : Y + H;
      this.add.image(X - art.pad - art.left, Y - art.up - art.pad, key).setOrigin(0, 0).setDepth(depth);
      if (art.anims.length) {
        const g = this.add.graphics().setDepth(depth + 0.5);
        this.furnAnims.push({ g, x: X, y: Y, cx: X + W / 2, cy: Y + H / 2, rx: W / 2 + 1.6 * TILE, ry: H / 2 + 1.6 * TILE, anims: art.anims, level: levelAt(X + W / 2, Y + H / 2), bx: X - art.left - 30, by: Y - art.up - 40, bw: W + art.left + art.right + 60, bh: H + art.up + 60, seed: i * 1.37 });
      }
    });
  }
  /** Đồ treo trên mặt tường (không chặn đường, nằm trên ô tường): hình vẽ vốn nhô lên trên, nên dời xuống cho nằm gọn trên mặt tường */
  private wallDy(f: { x: number; y: number; blocking: boolean }, up: number) {
    return !f.blocking && isWallTile(f.x, f.y) ? Math.max(0, up - 6) : 0;
  }
  /** Đồ đặt sát tường phía dưới (cả cạnh dưới đều là tường) */
  private againstSouthWall(f: { x: number; y: number; w: number; h: number }) {
    for (let x = f.x; x < f.x + f.w; x++) if (MAP_GRID[(f.y + f.h) * MAP_W + x] !== 0) return false;
    return true;
  }
  /** Lối trốn: đế tĩnh + lớp nắp/cửa động. Nắp bật khi có người chui (chỉ khi bạn nhìn thấy) */
  private ventPop = new Map<number, number>();
  private addVents() {
    HIDE_SPOTS.forEach((h, i) => {
      const kind = ventKind(h.id);
      const art = ventArt(kind);
      const key = `ve_${kind}`;
      if (!this.textures.exists(key)) {
        const g = this.make.graphics({ x: 0, y: 0 }, false);
        art.draw(new Pen(g, art.pad, art.pad + art.up));
        g.generateTexture(key, TILE + art.pad * 2, TILE + art.up + art.pad * 2);
        g.destroy();
      }
      const X = h.x * TILE, Y = h.y * TILE;
      const depth = art.flat ? -90 : Y + TILE;
      this.add.image(X - art.pad, Y - art.up - art.pad, key).setOrigin(0, 0).setDepth(depth);
      const g = this.add.graphics().setDepth(depth + 0.5);
      this.furnAnims.push({ g, x: X, y: Y, cx: X + TILE / 2, cy: Y + TILE / 2, rx: 0, ry: 0, anims: art.anims, level: levelAt(X + TILE / 2, Y + TILE / 2), bx: X - 30, by: Y - art.up - 40, bw: TILE + 60, bh: TILE + art.up + 60, seed: 50 + i * 1.7, spot: i });
    });
  }

  /** Vẽ chuyển động của đồ đạc đang trong khung nhìn ở tầng đang xem */
  private animateFurniture(world: NonNullable<typeof session.world>) {
    const view = this.cameras.main.worldView;
    const p = world.player;
    const lv = levelAt(p.x, p.y);
    const t = this.time.now / 1000;
    const opt = { power: world.sabotage?.kind !== 'power', wifi: world.sabotage?.kind === 'wifi', seed: 0, kick: 0 };
    // Ai đang làm việc ở cạnh máy nào thì máy đó "chạy" (bot đang làm, hoặc bạn đang mở mini-game)
    const workers = world.agents.filter(a => a.alive && (a.brain.workT > 0 && (a.brain.goal ?? '').startsWith('task:') || (a.isPlayer && !!document.querySelector('.modal .sheet.mini'))));
    for (const fa of this.furnAnims) {
      const on = fa.level === lv && fa.bx < view.right && fa.bx + fa.bw > view.x && fa.by < view.bottom && fa.by + fa.bh > view.y;
      if (!on) { if (fa.g.visible) { fa.g.clear(); fa.g.setVisible(false); } continue; }
      fa.g.setVisible(true).clear();
      const pen = new Pen(fa.g, fa.x, fa.y);
      opt.seed = fa.seed;
      if (fa.spot !== undefined) {
        const t0 = this.ventPop.get(fa.spot);
        opt.kick = t0 === undefined ? 0 : Math.max(0, 1 - (this.time.now - t0) / 700);
      } else opt.kick = workers.some(a => Math.abs(a.x - fa.cx) < fa.rx && Math.abs(a.y - fa.cy) < fa.ry) ? 1 : 0;
      for (const a of fa.anims) drawAnim(pen, a, t, opt);
    }
  }

  private box(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fill: number, r = 6, lw = 3.5) {
    g.fillStyle(fill, 1); g.fillRoundedRect(x, y, w, h, r);
    g.lineStyle(lw, INK, 1); g.strokeRoundedRect(x, y, w, h, r);
  }

  private decorWalls(g: Phaser.GameObjects.Graphics) {
    for (const f of FLOORS) {
      const ox = f.ox, oy = f.oy;
      if (f.id <= 3) {
        // Cửa sổ kính dọc tường ngoài phía trên
        // hàng tường dưới hành lang (chỗ cửa thang máy, cửa thoát hiểm) của tầng này; bản đồ mới có thể khác nhau giữa các tầng
        const hy = (LIFT_DOORS.find(l => l.level === f.id)?.tiles[0].y ?? oy + 13) - oy;
        const wy = oy + TOP_WALL(f.id); // mặt tường ngoài (tầng 1–3: hàng thứ hai)
        const onWall = (x: number) => FURNITURE.some(u => u.y === wy && u.x < ox + x + 2 && u.x + u.w > ox + x); // đồ treo trên tường ngoài
        for (const x of [3, 9, 15, 23, 29, 34].filter(x => x + 2 <= f.w - 1 && !onWall(x))) { // không đè lên cột tường ngoài cùng
          this.box(g, (ox + x) * TILE + 4, wy * TILE + 8, TILE * 1.6, TILE - 22, 0x9fd6ff, 3, 3);
          g.lineStyle(2, 0xffffff, 0.7); g.lineBetween((ox + x) * TILE + 12, wy * TILE + 30, (ox + x) * TILE + 26, wy * TILE + 14);
        }
        // Đồng hồ hành lang
        const cx = (ox + Math.min(32.5, f.w - 3.5)) * TILE, cy = (oy + hy + 0.5) * TILE;
        g.fillStyle(0xffffff, 1); g.fillCircle(cx, cy, 13); g.lineStyle(3, INK, 1); g.strokeCircle(cx, cy, 13);
        g.lineBetween(cx, cy, cx, cy - 9); g.lineBetween(cx, cy, cx + 6, cy + 2);
        // Lõi thang: khung inox quanh cửa thang máy và biển số tầng
        this.box(g, (ox + 15.8) * TILE, (oy + hy) * TILE - 4, 2.4 * TILE, 10, 0xc9ccd8, 2, 2);
        this.box(g, (ox + 18.1) * TILE, (oy + hy) * TILE + 6, 0.8 * TILE, 0.8 * TILE, 0x2e9cf0, 6, 3);
        // Cửa thoát hiểm vào giếng thang bộ
        this.exitDoor(g, (ox + 20) * TILE, (oy + hy) * TILE);
      }
      if (f.id === 2) {
        // Bảng KPI trên tường Phòng làm việc
        this.box(g, (ox + 6) * TILE + 6, (oy + TOP_WALL(f.id)) * TILE + 6, 2.6 * TILE, TILE - 16, 0xffffff, 3, 3);
        g.lineStyle(3, 0xe2412f, 1);
        g.beginPath(); g.moveTo((ox + 6.3) * TILE, (oy + TOP_WALL(f.id) + 0.65) * TILE); g.lineTo((ox + 7) * TILE, (oy + TOP_WALL(f.id) + 0.45) * TILE); g.lineTo((ox + 7.6) * TILE, (oy + TOP_WALL(f.id) + 0.55) * TILE); g.lineTo((ox + 8.4) * TILE, (oy + TOP_WALL(f.id) + 0.25) * TILE); g.strokePath();
      }
      if (f.id === 4) {
        // Sân thượng: lan can ngoài trời
        g.lineStyle(4, 0x9aa1b4, 1);
        for (let x = 1; x < 37; x += 1) g.lineBetween((ox + x) * TILE, (oy + 0.7) * TILE, (ox + x) * TILE, (oy + 1) * TILE);
        this.exitDoor(g, (ox + 18) * TILE, (oy + 8) * TILE);
      }
    }
    // Giếng thang bộ: bậc thang trên các đoạn cầu thang, cửa ra ở mỗi chiếu nghỉ
    for (const f of STAIR_FLIGHTS) for (let r = 0; r < f.h; r++) {
      // bậc thang thẳng đứng: vạch ngang trên mỗi bậc, mũi tên vàng chỉ hướng lên
      const X = f.x * TILE, Y = (f.y + r) * TILE, W = f.w * TILE;
      g.lineStyle(2, INK, 0.45); g.lineBetween(X + 4, Y + 10, X + W - 4, Y + 10); g.lineBetween(X + 4, Y + 32, X + W - 4, Y + 32);
      if (r === 1) { g.fillStyle(0xffe36e, 0.55); g.fillTriangle(X + W / 2, Y + 12, X + W / 2 - 9, Y + 28, X + W / 2 + 9, Y + 28); }
    }
    for (const l of LANDINGS) this.exitDoor(g, (STAIRWELL.x - 1) * TILE, l.y * TILE, true);
    // Buồng thang máy: vách inox, tay vịn, nắp trần
    g.fillStyle(0xe9edf5, 1); g.fillRect(CABIN.x * TILE, CABIN.y * TILE, 6, CABIN.h * TILE);
    g.lineStyle(4, 0x9aa1b4, 1); g.lineBetween(CABIN.x * TILE + 10, (CABIN.y + CABIN.h) * TILE - 18, (CABIN.x + CABIN.w) * TILE - 10, (CABIN.y + CABIN.h) * TILE - 18);
    // Camera an ninh gắn tường
    for (const c of CAMERAS) {
      const X = c.dev.x * TILE + TILE / 2, Y = c.dev.y * TILE + 14;
      this.box(g, X - 14, Y - 9, 28, 18, 0xe9edf5, 4, 3);
      g.fillStyle(0x2d3142, 1); g.fillCircle(X + 6, Y, 6); g.lineStyle(2.5, INK, 1); g.strokeCircle(X + 6, Y, 6);
      g.fillStyle(0x5fb8ff, 1); g.fillCircle(X + 6, Y, 2.5);
      g.lineStyle(4, INK, 1); g.lineBetween(X - 4, Y - 9, X - 4, Y - 16);
    }
  }

  /** Cửa thoát hiểm màu xanh (ngang trên tường, hoặc dọc ở chiếu nghỉ) */
  private exitDoor(g: Phaser.GameObjects.Graphics, X: number, Y: number, vertical = false) {
    if (vertical) { this.box(g, X + 8, Y + 2, TILE - 16, TILE - 4, 0x3fbf6a, 4, 3); g.fillStyle(0xffffff, 1); g.fillCircle(X + TILE - 16, Y + TILE / 2, 3); return; }
    this.box(g, X + 2, Y + 4, TILE - 4, TILE - 8, 0x3fbf6a, 4, 3);
    g.fillStyle(0xffffff, 1); g.fillRect(X + 10, Y + 14, TILE - 20, 6);
  }

  // ---------- Vòng lặp ----------
  update(_time: number, deltaMs: number) {
    const world = session.world;
    const dt = Math.min(0.05, deltaMs / 1000);
    session.onFrame(dt);
    markFrame();
    session.runDue();
    if (!world) return;
    if (this.gameId !== session.newGameId) this.resetViews();

    if (net.role === 'client' && net.client) {
      // Người vào phòng: không chạy mô phỏng (chủ phòng chạy). Dự đoán di chuyển của mình cho mượt, gửi điều khiển, làm mượt người khác.
      const c = net.client, me = world.player;
      const moving = !session.paused && world.phase === 'play' && me.hidden === null;
      const ix = moving ? session.input.x : 0, iy = moving ? session.input.y : 0;
      if (moving) world.moveBy(me, ix, iy, dt); else me.moving = false;
      c.sendInput(ix, iy, deltaMs);
      c.smooth(deltaMs);
      const ev = world.drainEvents();
      if (ev.length) { this.worldFx(world, ev); session.onEvents(ev); }
    } else if (!session.paused) {
      world.playerInput = session.input;
      world.update(dt);
      const ev = world.drainEvents();
      if (session.gameStats) { session.gameStats.tick(dt); if (ev.length) session.gameStats.onEvents(ev); }
      if (ev.length) this.worldFx(world, ev);
      if (ev.length) session.onEvents(ev);
      net.host?.tick(deltaMs, ev);
    } else net.host?.tick(deltaMs, []); // đang tạm dừng (tờ phân công, chọn nơi bắt đầu): vẫn gửi trạng thái

    const p = world.player;
    const w = this.scale.width, h = this.scale.height;
    if (p.lastPortal !== this.seenPortal) {
      // Vừa qua cửa thang bộ / thang máy: màn hình mờ rồi sáng lại ở chỗ mới
      this.seenPortal = p.lastPortal;
      if (p.lastPortal > 0) { this.camX = p.x; this.camY = p.y - 30; this.cameras.main.fadeIn(380, 5, 6, 13); }
    }
    const k = Math.min(1, dt * 9);
    this.camX += (p.x - this.camX) * k;
    this.camY += (p.y - 30 - this.camY) * k;
    this.cameras.main.setScroll(this.camX - w / 2, this.camY - h / 2);

    const pAlive = p.alive;
    const sab = world.sabotage?.kind;
    const myVision = !pAlive ? 99999 : world.visionOf(p);

    // Nhân vật
    for (const a of world.agents) {
      const v = this.views.get(a.id)!;
      let show = true;
      if (a.hidden !== null) show = false;
      else if (!a.alive && pAlive && !a.isPlayer) show = false;
      else if (!a.isPlayer && pAlive && !world.sees(p, a, 20)) show = false;
      else if (!a.isPlayer && !pAlive && levelAt(a.x, a.y) !== levelAt(p.x, p.y)) show = false; // hồn ma chỉ thấy người cùng tầng
      if (world.phase === 'meeting') show = show && a.alive;
      v.sprite.setVisible(show); v.shadow.setVisible(show && a.alive); v.tag.setVisible(show);
      if (!show) continue;
      const frame = a.moving ? (Math.floor(a.walkT * 7) % 2 === 0 ? 1 : 2) : 0;
      v.sprite.setTexture(`${this.texKey(a)}_${frame}`);
      v.sprite.setFlipX(a.facing < 0);
      const floatY = a.alive ? 0 : Math.sin(this.time.now / 300 + a.id) * 5 - 10;
      // Skin con ma bay lơ lửng, slime phập phồng
      const skinFloat = a.look.body === 'ghost' ? Math.sin(this.time.now / 320 + a.id) * 4 - 5 : 0;
      v.sprite.setPosition(a.x, a.y + 6 + floatY + skinFloat);
      if (a.look.body === 'slime') v.sprite.setScale(CHAR_SCALE * (1 + Math.sin(this.time.now / 260 + a.id) * 0.025), CHAR_SCALE * (1 - Math.sin(this.time.now / 260 + a.id) * 0.03));
      v.sprite.setAlpha(a.alive ? 1 : 0.42);
      v.sprite.setDepth(a.alive ? a.y : 39000 + a.y / 100); // hồn ma bay nổi trên mọi đồ vật
      v.shadow.setPosition(a.x, a.y + 4).setDepth(a.y - 1);
      // người thật mất kết nối: thẻ tên báo rõ, mờ đi
      const label = a.away ? `${a.name} #${a.empId} · mất kết nối` : `${a.name} #${a.empId}`;
      if (v.tag.text !== label) v.tag.setText(label);
      v.tag.setPosition(a.x, a.y - 66 + floatY).setDepth(30000 + a.y).setAlpha(a.away ? 0.55 : a.alive ? 1 : 0.6);
      const imposterMate = (p.role === 'impostor' || (p.role === 'crew' && p.dept === 'climber')) && a.role === 'impostor'; // Intern tham vọng cũng biết mặt Nội gián
      v.tag.setColor(imposterMate ? '#ff5d73' : '#ffffff');
    }

    // Ghế trống (xác)
    while (this.bodyViews.length < world.bodies.length) this.bodyViews.push(this.add.image(0, 0, 'chair').setOrigin(0.5, 0.85));
    this.bodyViews.forEach((img, i) => {
      const b = world.bodies[i];
      if (!b || world.phase === 'meeting') { img.setVisible(false); return; }
      const visible = !pAlive ? levelAt(b.x, b.y) === levelAt(p.x, p.y) : world.sees(p, b, 20);
      img.setVisible(visible).setPosition(b.x, b.y + 8).setDepth(b.y - 2);
    });

    // Dấu nhiệm vụ
    const bounce = Math.sin(this.time.now / 220) * 4;
    const wifiDown = sab === 'wifi';
    for (const [id, t] of this.markers) {
      let on = false;
      const isFix = id === 'router' || id === 'power';
      if (isFix) on = !!sab && sab !== 'boss' && ((sab === 'wifi' && id === 'router') || (sab === 'power' && id === 'power'));
      else on = !wifiDown && p.tasks.some(x => !x.done && slotStation(x) === id) && (p.role === 'crew' || p.alive);
      const s = station(id);
      t.setVisible(on && world.phase === 'play');
      t.setY(s.mark.y * TILE - 12 + bounce);
      // ngoài tầm nhìn: mờ và nhỏ hơn (vẫn thấy chỗ có việc)
      const far = Math.hypot((s.mark.x + 0.5) * TILE - p.x, s.mark.y * TILE - p.y) > world.visionOf(p) || levelAt((s.stand.x + 0.5) * TILE, (s.stand.y + 0.5) * TILE) !== levelAt(p.x, p.y);
      t.setScale(far ? 0.78 : 1);
      t.setAlpha((p.role === 'impostor' && !isFix ? 0.55 : 1) * (far ? 0.55 : 1));
    }
    // Dấu chỗ trốn: Nội gián luôn thấy; Engineer và Intern tham vọng thấy xanh khi dùng được, xám kèm số giây khi đang hồi chiêu
    const hideUser = p.alive && world.phase === 'play' && world.canHide(p);
    const engCd = p.role === 'crew' && p.dept === 'engineer' && p.hidden === null ? p.engCd : 0;
    const myLv = levelAt(p.x, p.y);
    this.hideMarkers.forEach((t, i) => {
      const onMyFloor = HIDE_SPOTS[i].level === myLv;
      t.setVisible(hideUser && onMyFloor);
      if (!hideUser || !onMyFloor) return;
      if (p.role === 'impostor') { if (t.text !== '◆') t.setText('◆').setColor('#ff5d73').setFontSize(18); t.setAlpha(1); return; }
      const ready = engCd <= 0;
      const txt = ready ? '◆' : `◆ ${Math.ceil(engCd)}`;
      if (t.text !== txt) t.setText(txt);
      t.setColor(ready ? '#4ee1a0' : '#9aa1b4').setFontSize(ready ? 22 : 16).setAlpha(ready ? 0.7 + Math.sin(this.time.now / 220) * 0.3 : 0.8);
    });
    // Máy của phòng ban sẵn sàng: dấu "!" nhún nhảy và quầng sáng (chỉ người có vai đó thấy)
    const artReady = p.role === 'crew' && p.dept === 'artist' && p.alive && !world.artistBlocked(p) && !p.artistScanning;
    if (!this.artMarker) {
      const cc = station('colorcheck');
      this.artMarker = this.add.text(cc.mark.x * TILE, cc.mark.y * TILE, '!', {
        fontFamily: '"Baloo 2", "Trebuchet MS", sans-serif', fontSize: '34px', fontStyle: '800', color: '#ffd23f', stroke: '#1d1a2b', strokeThickness: 6,
      }).setOrigin(0.5, 1).setDepth(55000); // nổi trên lớp sương để luôn thấy
      this.readyHalo = this.add.image(0, 0, 'artglow').setScale(1.1).setDepth(40000).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    }
    this.artMarker.setVisible(artReady && world.phase === 'play' && levelAt(p.x, p.y) === 3).setY(station('colorcheck').mark.y * TILE - 22 + bounce);
    const fidReady = p.role === 'crew' && p.dept === 'hr' && p.alive && !p.hrUsed && !world.faceIdBlocked(p);
    const haloAt = artReady ? station('colorcheck') : fidReady && !p.hrScanning ? station('faceid') : null;
    if (haloAt && world.phase === 'play') this.readyHalo!.setVisible(true).setTexture(artReady ? 'artglow' : 'hrglow').setPosition(haloAt.mark.x * TILE, haloAt.mark.y * TILE + 4).setAlpha(0.25 + Math.sin(this.time.now / 260) * 0.15);
    else this.readyHalo?.setVisible(false);
    if (!this.fidMarker) {
      const f = station('faceid');
      this.fidMarker = this.add.text(f.mark.x * TILE, f.mark.y * TILE, '!', {
        fontFamily: '"Baloo 2", "Trebuchet MS", sans-serif', fontSize: '34px', fontStyle: '800', color: '#ff5abe', stroke: '#1d1a2b', strokeThickness: 6,
      }).setOrigin(0.5, 1).setDepth(55000);
    }
    this.fidMarker.setVisible(fidReady && world.phase === 'play' && levelAt(p.x, p.y) === 3).setY(station('faceid').mark.y * TILE - 20 + bounce);

    // Sương mù tầm nhìn
    this.flickerT -= dt;
    if (this.flickerT <= 0) { this.flicker = 0.18; this.flickerT = 3 + Math.random() * 8; }
    this.flicker = Math.max(0, this.flicker - dt * 1.2);
    const fl = this.flicker > 0.1 && Math.random() < 0.5 ? 0.12 : 0;
    const target = !pAlive ? 0.15 : sab === 'power' ? 0.94 : 0.72;
    this.fogLevel += (target - this.fogLevel) * Math.min(1, dt * 4);
    const viewW = w / this.zoom, viewH = h / this.zoom;
    const viewL = this.camX - viewW / 2, viewT = this.camY - viewH / 2;
    let alpha = Math.min(1, this.fogLevel + fl);
    // Cúp điện: đèn chớp vài lần rồi mới tối hẳn
    if (sab === 'power') {
      if (this.powerFxStart < 0) this.powerFxStart = this.time.now;
      const e = (this.time.now - this.powerFxStart) / 1000;
      if (e < 1.3 && pAlive) alpha = Math.sin(e * 38) > 0.2 ? Math.min(alpha, 0.35) : alpha;
    } else this.powerFxStart = -1;
    const cw = Math.max(4, Math.ceil(w / 2)), ch = Math.max(4, Math.ceil(h / 2));
    if (this.fogTex.width !== cw || this.fogTex.height !== ch) this.fogTex.setSize(cw, ch);
    const ctx = this.fogTex.getContext();
    const fk = cw / viewW;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = sab === 'power' && pAlive ? `rgba(2,4,12,${alpha})` : `rgba(13,14,31,${alpha})`;
    ctx.fillRect(0, 0, cw, ch);
    if (pAlive) {
      // Chỉ thấy tầng mình đang đứng: các tầng khác (và khoảng trống giữa các tầng) tối hẳn
      const lv = levelAt(p.x, p.y);
      const area = lv === 0 ? { x: CABIN.x - 1, y: CABIN.y - 1, w: CABIN.w + 2, h: CABIN.h + 2 }
        : lv === STAIRS_LEVEL ? { x: STAIRWELL.x - 1, y: STAIRWELL.y - 1, w: STAIRWELL.w + 2, h: STAIRWELL.h + 2 }
        : (() => { const f = FLOORS[lv - 1]; return f ? { x: f.ox, y: f.oy, w: f.w, h: f.h } : null; })();
      if (area) {
        const ax = (area.x * TILE - viewL) * fk, ay = (area.y * TILE - viewT) * fk, aw = area.w * TILE * fk, ah = area.h * TILE * fk;
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, cw, ch); ctx.rect(ax, ay, aw, ah); ctx.fillStyle = '#05060d'; ctx.fill('evenodd');
        ctx.restore();
      }
    }
    if (pAlive) {
      // Vùng nhìn thấy có tường che (như Among Us), mép mờ dần theo bán kính
      const ex = p.x, ey = p.y - 20;
      const poly = visibilityPolygon(ex, ey, myVision);
      const cx = (ex - viewL) * fk, cy = (ey - viewT) * fk;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, myVision * fk);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(0.7, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = grad;
      ctx.beginPath();
      for (let i = 0; i < poly.length; i += 2) {
        const x = (poly[i] - viewL) * fk, y = (poly[i + 1] - viewT) * fk;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    this.fogTex.refresh();
    this.fogImg.setPosition(viewL, viewT).setDisplaySize(viewW, viewH);

    // Cửa đang bị khóa
    const dk = Array.from(DOOR_BLOCK.reduce((acc: number[], v, i) => (v ? (acc.push(i), acc) : acc), [])).join(',');
    if (dk !== this.doorKey) {
      this.doorKey = dk;
      const dg = this.doorG;
      dg.clear();
      if (dk) for (const id of dk.split(',').map(Number)) {
        const X = (id % MAP_W) * TILE, Y = Math.floor(id / MAP_W) * TILE;
        dg.fillStyle(0x6d7391, 1); dg.fillRect(X + 2, Y + 2, TILE - 4, TILE - 4);
        dg.lineStyle(2, 0x8a90b4, 1); for (let i = 1; i < 4; i++) dg.lineBetween(X + 4, Y + i * 12, X + TILE - 4, Y + i * 12);
        dg.lineStyle(4, INK, 1); dg.strokeRect(X + 2, Y + 2, TILE - 4, TILE - 4);
        dg.fillStyle(0xff3b3b, 1); dg.fillCircle(X + TILE / 2, Y + TILE / 2, 5);
      }
    }
    this.glows.forEach(g => g.setVisible(sab === 'power'));
    // Đèn đỏ trên camera: nhấp nháy khi có người đang xem
    this.camLeds.clear();
    const inUse = world.camsInUse();
    for (const c of CAMERAS) {
      const X = c.dev.x * TILE + TILE / 2 - 8, Y = c.dev.y * TILE + 10;
      const on = inUse && Math.floor(this.time.now / 400) % 2 === 0;
      this.camLeds.fillStyle(on ? 0xff2a2a : 0x5a2a2a, 1); this.camLeds.fillCircle(X, Y, 3.5);
      if (on) { this.camLeds.fillStyle(0xff2a2a, 0.35); this.camLeds.fillCircle(X, Y, 9); }
    }
    this.drawLift(world);
    this.animateFurniture(world);
    this.updateEmotes(world);

    // Mũi tên chỉ đường tới việc gấp (sự cố, sếp đi tuần), giống Among Us
    this.urgent.clear();
    // Sếp đi tuần: bàn của mình sáng viền vàng nhấp nháy, mã số trên bàn to và vàng
    { const mine = world.player, d = DESKS[mine.desk];
      const on = world.sabotage?.kind === 'boss' && mine.alive && mine.role === 'crew' && !mine.bossDone && !!d;
      if (on) {
        const a = 0.55 + 0.45 * Math.sin(this.time.now / 150);
        this.urgent.lineStyle(5, 0xffd23f, a); this.urgent.strokeRoundedRect(d.x * TILE - 8, d.y * TILE - 8, 2 * TILE + 16, 2 * TILE + 16, 10);
      }
      const lbl = this.deskLabels[mine.id];
      if (lbl) { lbl.setColor(on ? '#ffd23f' : '#ffffff').setScale(on ? 1.35 + 0.1 * Math.sin(this.time.now / 150) : 1).setDepth(on ? 30001 : lbl.depth); }
    }
    this.floorTags.forEach(t => t.setVisible(false));
    if (world.phase === 'play' && pAlive && p.role === 'crew') {
      const targets: { x: number; y: number }[] = [];
      if (sab === 'wifi' || sab === 'power') { const st = station(sab === 'wifi' ? 'router' : 'power'); targets.push({ x: (st.stand.x + 0.5) * TILE, y: (st.stand.y + 0.5) * TILE }); }
      if (sab === 'boss' && !p.bossDone) { const seat = DESKS[p.desk].seat; targets.push({ x: (seat.x + 0.5) * TILE, y: (seat.y + 0.5) * TILE }); }
      const hw = w / (2 * this.zoom) - 46, hh = h / (2 * this.zoom) - 70;
      const pulse = 1 + Math.sin(this.time.now / 140) * 0.12;
      let li = 0;
      for (const t0 of targets) {
        const t = this.routeHint(p, t0);
        if (t !== t0) this.floorTag(li++, t0, t);
        const dx = t.x - this.camX, dy = t.y - this.camY;
        const ang = Math.atan2(dy, dx);
        let ax: number, ay: number;
        if (Math.abs(dx) < hw && Math.abs(dy) < hh) {
          if (Math.hypot(t.x - p.x, t.y - p.y) < 1.4 * TILE) continue;
          // Mục tiêu trong màn hình: mũi tên lơ lửng phía trên chỉ xuống
          ax = t.x; ay = t.y - 70 + Math.sin(this.time.now / 160) * 6;
          this.drawArrow(ax, ay, Math.PI / 2, pulse);
          continue;
        }
        const k = Math.min(hw / Math.abs(dx || 1e-6), hh / Math.abs(dy || 1e-6));
        ax = this.camX + dx * k; ay = this.camY + dy * k;
        this.drawArrow(ax, ay, ang, pulse);
      }
    }

    // Loa của Sound Engineer: mũi tên có hình loa phát sóng âm chỉ tới ghế trống (ai còn sống cũng thấy, kể cả Nội gián)
    if (!this.noiseIcons.length) for (let i = 0; i < 3; i++) this.noiseIcons.push(this.add.text(0, 0, '🔊', { fontSize: '30px' }).setOrigin(0.5).setDepth(60001).setVisible(false));
    this.noiseIcons.forEach(t => t.setVisible(false));
    if (world.phase === 'play' && pAlive) {
      const hw = w / (2 * this.zoom) - 50, hh = h / (2 * this.zoom) - 74;
      world.noises.slice(0, 3).forEach((n0, i) => {
        const n = this.routeHint(p, n0);
        if (n !== n0) this.floorTag(3 + i, n0, n);
        const dx = n.x - this.camX, dy = n.y - this.camY;
        let ax: number, ay: number, ang: number;
        if (Math.abs(dx) < hw && Math.abs(dy) < hh) { ax = n.x; ay = n.y - 86 + Math.sin(this.time.now / 160) * 6; ang = Math.PI / 2; }
        else { const k = Math.min(hw / Math.abs(dx || 1e-6), hh / Math.abs(dy || 1e-6)); ax = this.camX + dx * k; ay = this.camY + dy * k; ang = Math.atan2(dy, dx); }
        // sóng âm lan ra quanh loa
        const g = this.urgent;
        const ph = (this.time.now / 600) % 1;
        for (let r = 0; r < 3; r++) {
          const rr = 18 + ((ph + r / 3) % 1) * 30;
          g.lineStyle(4, 0x2e9cf0, 1 - ((ph + r / 3) % 1)); g.strokeCircle(ax, ay, rr);
        }
        const tip = 40;
        const px = ax + Math.cos(ang) * tip, py = ay + Math.sin(ang) * tip;
        const pts = [[16, 0], [-10, -13], [-4, 0], [-10, 13]].map(([qx, qy]) => new Phaser.Math.Vector2(px + qx * Math.cos(ang) - qy * Math.sin(ang), py + qx * Math.sin(ang) + qy * Math.cos(ang)));
        g.fillStyle(0x2e9cf0, 1); g.fillPoints(pts, true); g.lineStyle(3.5, INK, 1); g.strokePoints(pts, true, true);
        g.fillStyle(0xffffff, 1); g.fillCircle(ax, ay, 19); g.lineStyle(3.5, INK, 1); g.strokeCircle(ax, ay, 19);
        this.noiseIcons[i].setVisible(true).setPosition(ax, ay).setScale(1 + Math.sin(this.time.now / 120) * 0.08);
      });
    }
    // Sticker hồn ma Truyền thông gửi: hiện trên đầu người nhận (chỉ người nhận thấy)
    if (!this.stickerBubble) this.stickerBubble = this.add.text(0, 0, '', { fontSize: '30px', backgroundColor: '#ffffff', padding: { x: 8, y: 4 } }).setOrigin(0.5, 1).setDepth(60002);
    const sm = p.stickerMsg;
    if (sm && pAlive && world.phase === 'play') {
      const txt = sm.stickers.map(i => STICKERS[i].e).join(' ');
      if (this.stickerBubble.text !== txt) this.stickerBubble.setText(txt);
      this.stickerBubble.setVisible(true).setPosition(p.x, p.y - 104 + Math.sin(this.time.now / 200) * 3);
    } else this.stickerBubble.setVisible(false);

    // Đèn máy chấm công: ai đứng gần cũng thấy (task hiển thị)
    const scanner = world.agents.find(a => a.scanning && a.alive);
    const seeScan = !!scanner && (!pAlive || world.sees(p, { x: this.scanGlow.x, y: this.scanGlow.y + 40 }, 40));
    this.scanGlow.setVisible(seeScan && world.phase === 'play').setAlpha(0.6 + Math.sin(this.time.now / 90) * 0.4);
    // Máy Face ID của HR: đang quét thì phát sáng hồng
    const hrScan = world.agents.find(a => a.hrScanning && a.alive);
    const seeHr = !!hrScan && (!pAlive || world.sees(p, { x: this.hrGlow.x + 40, y: this.hrGlow.y + 40 }, 40));
    this.hrGlow.setVisible(seeHr && world.phase === 'play').setAlpha(0.6 + Math.sin(this.time.now / 80) * 0.4);
    const artScan = world.agents.some(a => a.alive && a.artistScanning);
    const seeArt = artScan && (!pAlive || world.sees(p, { x: this.artGlow.x, y: this.artGlow.y + 40 }, 40));
    this.artGlow.setVisible(seeArt && world.phase === 'play').setAlpha(0.6 + Math.sin(this.time.now / 80) * 0.4);
  }

  /** Cửa thang máy mở/đóng, bảng số tầng trên cửa, biển cầu thang */
  private drawLift(world: NonNullable<typeof session.world>) {
    if (!this.liftG) {
      this.liftG = this.add.graphics().setDepth(-45);
      const st = { fontFamily: '"Baloo 2", "Trebuchet MS", sans-serif', fontSize: '18px', fontStyle: '800', color: '#ff5d5d', backgroundColor: '#1d1a2b', padding: { x: 5, y: 1 } };
      this.liftLabels = LIFT_DOORS.map(ld => this.add.text((ld.tiles[0].x + 1) * TILE, ld.tiles[0].y * TILE - 6, '', st).setOrigin(0.5, 1).setDepth(-44));
      this.liftLabels.push(this.add.text((CABIN_DOOR[0].x + 1) * TILE, CABIN.y * TILE + 4, '', st).setOrigin(0.5, 0).setDepth(-44));
      // Biển "Thang bộ" trên cửa thoát hiểm, biển tầng to ở mỗi chiếu nghỉ
      const sign = { fontFamily: '"Be Vietnam Pro", sans-serif', fontSize: '12px', fontStyle: '700', color: '#ffffff', backgroundColor: '#3fbf6a', padding: { x: 3, y: 1 } };
      for (const pt of PORTALS) {
        if (pt.fromLevel === STAIRS_LEVEL) {
          this.add.text((pt.from.x + 1.2) * TILE, pt.from.y * TILE + 4, pt.label === 'Sân thượng' ? 'S' : pt.label.replace('Tầng ', ''), {
            fontFamily: '"Baloo 2", sans-serif', fontSize: '44px', fontStyle: '800', color: '#ffffff', stroke: '#1d1a2b', strokeThickness: 6,
          }).setOrigin(0, 0.5).setDepth(-44);
          this.add.text((pt.from.x + 0.5) * TILE, (pt.from.y - 0.5) * TILE, '◀ Ra ' + pt.label, sign).setOrigin(0, 1).setDepth(-44);
        } else this.add.text((pt.from.x + 0.5) * TILE, pt.from.y * TILE - 2, '🚪 Thang bộ', sign).setOrigin(0.5, 1).setDepth(-44);
      }
    }
    const g = this.liftG; g.clear();
    const L = world.lift;
    const floorTxt = L.stuck ? `⚠ ${Math.round(L.pos)}` : `${L.dir > 0 ? '▲' : L.dir < 0 ? '▼' : ''}${Math.round(L.pos)}`;
    // Cửa thang máy trượt sang hai bên khi mở (độ mở chạy dần chứ không bật tắt)
    const dt = Math.min(0.05, this.game.loop.delta / 1000);
    const slide = (key: number, open: boolean, X: number, Y: number, inside: number) => {
      const cur = this.liftOpen.get(key) ?? 0;
      const v = Phaser.Math.Clamp(cur + (open ? 1 : -1) * dt * 3.5, 0, 1);
      this.liftOpen.set(key, v);
      const W = 2 * TILE - 8, H = TILE - 4, half = W / 2;
      g.fillStyle(inside, 1); g.fillRect(X + 4, Y + 2, W, H);
      const pw = half * (1 - v);
      if (pw > 1) {
        g.fillStyle(0xb9c0cf, 1); g.fillRect(X + 4, Y + 2, pw, H); g.fillRect(X + 4 + W - pw, Y + 2, pw, H);
        g.lineStyle(2.5, INK, 1); g.strokeRect(X + 4, Y + 2, pw, H); g.strokeRect(X + 4 + W - pw, Y + 2, pw, H);
      }
      g.lineStyle(3, INK, 1); g.strokeRect(X + 4, Y + 2, W, H);
    };
    LIFT_DOORS.forEach((ld, i) => {
      slide(ld.level, world.liftOpenAt(ld.level), ld.tiles[0].x * TILE, ld.tiles[0].y * TILE, 0xfff3c4);
      if (this.liftLabels[i].text !== floorTxt) this.liftLabels[i].setText(floorTxt);
    });
    const cOpen = !ELEV_BLOCK[CABIN_DOOR[0].y * MAP_W + CABIN_DOOR[0].x];
    slide(0, cOpen, CABIN_DOOR[0].x * TILE, CABIN_DOOR[0].y * TILE, 0x2d3142);
    const cab = this.liftLabels[this.liftLabels.length - 1];
    if (cab.text !== floorTxt) cab.setText(floorTxt);
  }

  /** Hiệu ứng trong thế giới game theo sự kiện mô phỏng */
  private worldFx(world: NonNullable<typeof session.world>, ev: ReturnType<NonNullable<typeof session.world>['drainEvents']>) {
    const p = world.player;
    for (const e of ev) {
      if (e.type === 'kill') {
        const seen = !p.alive || e.killer === p.id || world.sees(p, { x: e.x, y: e.y }, 40);
        if (!seen || e.victim === p.id) continue;
        this.killPoof(world, e.victim, e.x, e.y);
      }
      if (e.type === 'meeting') this.emotes.forEach(m => m.t.setVisible(false));
      if (e.type === 'vent') {
        const h = HIDE_SPOTS[e.spot], c = { x: (h.x + 0.5) * TILE, y: (h.y + 0.5) * TILE };
        const seen = p.alive ? world.sees(p, c, 30) : levelAt(c.x, c.y) === levelAt(p.x, p.y);
        if (seen) { this.ventPop.set(e.spot, this.time.now); if (Math.hypot(p.x - c.x, p.y - c.y) < 7 * TILE) sfx.clank(); }
      }
    }
  }

  /** Gài bẫy: tờ quyết định bay tới, nhân vật giật mình rồi tan thành ghế trống, giấy rơi lả tả */
  private killPoof(world: NonNullable<typeof session.world>, victimId: number, x: number, y: number) {
    const v = this.views.get(victimId);
    if (v) {
      const ghost = this.add.image(x, y + 6, v.sprite.texture.key).setOrigin(v.sprite.originX, v.sprite.originY).setScale(v.sprite.scaleX, v.sprite.scaleY).setDepth(y + 1);
      this.tweens.add({ targets: ghost, x: x + 6, duration: 60, yoyo: true, repeat: 3 });
      this.tweens.add({ targets: ghost, alpha: 0, scaleY: v.sprite.scaleY * 0.3, y: y + 20, delay: 300, duration: 450, ease: 'Quad.easeIn', onComplete: () => ghost.destroy() });
    }
    const memo = this.add.rectangle(x - 160, y - 120, 26, 34, 0xffffff).setStrokeStyle(3, INK).setDepth(y + 2).setAngle(-30);
    this.tweens.add({ targets: memo, x, y: y - 30, angle: 360, duration: 260, ease: 'Quad.easeIn', onComplete: () => memo.destroy() });
    const ring = this.add.circle(x, y - 20, 10, 0xffffff, 0.8).setDepth(y + 3);
    this.tweens.add({ targets: ring, radius: 70, alpha: 0, delay: 260, duration: 420, onComplete: () => ring.destroy() });
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
      const pap = this.add.rectangle(x, y - 30, 12, 16, 0xffffff).setStrokeStyle(2, INK).setDepth(y + 3).setAngle(Math.random() * 90);
      this.tweens.add({ targets: pap, x: x + Math.cos(ang) * (50 + Math.random() * 40), y: y - 30 + Math.sin(ang) * 40 + 70, angle: 400, alpha: 0, delay: 260, duration: 900 + Math.random() * 300, ease: 'Sine.easeOut', onComplete: () => pap.destroy() });
    }
  }

  /** Biểu cảm trên đầu: giật mình khi thấy ghế trống, lau mồ hôi khi sửa sự cố, gõ phím khi Sếp đi tuần */
  private updateEmotes(world: NonNullable<typeof session.world>) {
    const now = this.time.now;
    const p = world.player;
    for (const a of world.agents) {
      const v = this.views.get(a.id);
      if (!v) continue;
      let glyph = '';
      if (a.alive && world.phase === 'play') {
        if (a.brain.seenBody !== null) glyph = '❗';
        else if (world.sabotage?.kind === 'boss' && a.bossDone) glyph = '⌨️';
        else if (a.brain.goal === 'fix' && a.brain.workT > 0) glyph = '💦';
        else if (a.isPlayer && world.sabotage && world.sabotage.kind !== 'boss' && this.fixingSince > 0 && now - this.fixingSince < 400) glyph = '💦';
      }
      let em = this.emotes.get(a.id);
      if (!glyph) { if (em) em.t.setVisible(false); continue; }
      if (!em) { em = { t: this.add.text(0, 0, '', { fontSize: '26px' }).setOrigin(0.5, 1).setDepth(30500), until: 0, glyph: '' }; this.emotes.set(a.id, em); }
      if (em.glyph !== glyph) { em.glyph = glyph; em.t.setText(glyph); if (glyph === '❗') { em.t.setScale(0.2); this.tweens.add({ targets: em.t, scale: 1, duration: 220, ease: 'Back.easeOut' }); } }
      const visible = v.sprite.visible;
      em.t.setVisible(visible).setPosition(a.x + 22, a.y - 70 + Math.sin(now / 160) * 3);
    }
    void p;
  }
  fixingSince = -1;

  /** Nhãn tầng đích cạnh mũi tên khi mục tiêu ở tầng khác */
  private floorTags: Phaser.GameObjects.Text[] = [];
  private seenPortal = -99;
  private liftOpen = new Map<number, number>();
  private emotes = new Map<number, { t: Phaser.GameObjects.Text; until: number; glyph: string }>();
  private powerFxStart = -1;
  private floorTag(i: number, target: { x: number; y: number }, via: { x: number; y: number }) {
    while (this.floorTags.length <= i) this.floorTags.push(this.add.text(0, 0, '', {
      fontFamily: '"Baloo 2", sans-serif', fontSize: '16px', fontStyle: '800', color: '#ffffff', backgroundColor: '#e2412f', padding: { x: 6, y: 2 },
    }).setOrigin(0.5, 1).setDepth(60003).setVisible(false));
    const lv = levelAt(target.x, target.y), here = levelAt(this.camX, this.camY + 30);
    const txt = `${lv > here ? '▲' : '▼'} ${levelName(lv)}`;
    const w = this.scale.width, h = this.scale.height;
    const hw = w / (2 * this.zoom) - 60, hh = h / (2 * this.zoom) - 90;
    const dx = via.x - this.camX, dy = via.y - this.camY;
    const k = Math.min(1, hw / Math.abs(dx || 1e-6), hh / Math.abs(dy || 1e-6));
    this.floorTags[i].setText(txt).setPosition(this.camX + dx * k, this.camY + dy * k - 34).setVisible(true);
  }

  /** Mục tiêu ở tầng khác: chỉ về cửa thang bộ của tầng mình (trong thang máy thì chỉ ra cửa buồng) */
  private routeHint(p: { x: number; y: number }, t: { x: number; y: number }) {
    const a = levelAt(p.x, p.y), b = levelAt(t.x, t.y);
    if (a === b || a < 0 || b < 0) return t;
    if (a === 0) return { x: (CABIN_DOOR[0].x + 1) * TILE, y: CABIN_DOOR[0].y * TILE + 30 };
    if (a === STAIRS_LEVEL) {
      // Trong giếng thang: chỉ tới cửa ra ở chiếu nghỉ của tầng đích (đích trong thang máy thì ra tầng 2)
      const land = LANDINGS.find(l => l.level === (b >= 1 && b <= 4 ? b : 2))!;
      return { x: (STAIRWELL.x - 0.5) * TILE, y: (land.y + 0.5) * TILE };
    }
    const exit = PORTALS.find(pt => pt.fromLevel === a && pt.toLevel === STAIRS_LEVEL)!;
    return { x: (exit.from.x + 0.5) * TILE, y: (exit.from.y + 0.5) * TILE };
  }

  private drawArrow(x: number, y: number, ang: number, s: number) {
    const g = this.urgent;
    const pts = [[26, 0], [-14, -18], [-6, 0], [-14, 18]].map(([px, py]) => {
      const c = Math.cos(ang), sn = Math.sin(ang);
      return new Phaser.Math.Vector2(x + (px * c - py * sn) * s, y + (px * sn + py * c) * s);
    });
    g.fillStyle(0xe8443a, 1); g.fillPoints(pts, true);
    g.lineStyle(4, INK, 1); g.strokePoints(pts, true, true);
  }

  private texKey(a: Agent) { return 'ch_' + lookKey(a.look).replace(/[^a-z0-9]/gi, ''); }

  private resetViews() {
    const world = session.world!;
    this.gameId = session.newGameId;
    for (const v of this.views.values()) { v.sprite.destroy(); v.shadow.destroy(); v.tag.destroy(); }
    this.views.clear();
    this.fidMarker?.destroy(); this.fidMarker = null;
    this.bodyViews.forEach(b => b.destroy());
    this.bodyViews = [];
    for (const a of world.agents) {
      const shadow = this.add.image(a.x, a.y, 'shadow');
      // Mỗi ngoại hình một bộ texture 3 khung hình
      const key = this.texKey(a);
      for (const f of [0, 1, 2] as const) if (!this.textures.exists(`${key}_${f}`)) this.textures.addCanvas(`${key}_${f}`, characterCanvas(a.look, f));
      const sprite = this.add.image(a.x, a.y, `${key}_0`).setOrigin(0.5, CHAR_ORIGIN_Y).setScale(CHAR_SCALE);
      const tag = this.add.text(a.x, a.y - 66, `${a.name} #${a.empId}`, {
        fontFamily: '"Baloo 2", "Trebuchet MS", sans-serif', fontSize: '17px', fontStyle: '800',
        color: '#ffffff', padding: { x: 2, y: 1 },
        stroke: '#1d1a2b', strokeThickness: 5,
      }).setOrigin(0.5, 1);
      this.views.set(a.id, { sprite, shadow, tag });
    }
    // Mã số nhân viên hiện trên màn hình máy tính ở bàn của từng người (Open Space)
    this.deskLabels.forEach(t => t.destroy());
    this.deskLabels = world.agents.map(a => {
      const d = DESKS[a.desk];
      return this.add.text((d.x + 1) * TILE, d.y * TILE + 38, `#${a.empId}`, {
        fontFamily: '"Baloo 2", "Trebuchet MS", sans-serif', fontSize: '14px', fontStyle: '800', color: '#ffffff', stroke: '#1d4f8a', strokeThickness: 3,
      }).setOrigin(0.5).setDepth((d.y + 1) * TILE + 1);
    });
    this.camX = world.player.x; this.camY = world.player.y;
  }
}

