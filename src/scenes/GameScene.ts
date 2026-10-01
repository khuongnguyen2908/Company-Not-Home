import Phaser from 'phaser';
import {
  TILE, MAP_W, MAP_H, ROOMS, FURNITURE, DESKS, STATIONS, HIDE_SPOTS, BELL, station,
  GRID, ROOM_GRID, isWallTile, type Furniture,
} from '../game/map';
import { DEPTS, dept } from '../game/data';
import { characterCanvas, chairCanvas, lightCanvas, glowCanvas, shadowCanvas, holeCanvas } from '../render/chars';
import { session } from '../session';
import { VISION, VISION_DARK, VISION_IMP, slotStation, type Agent } from '../game/sim';

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
  private fogHole!: Phaser.GameObjects.Image;
  private fogRects!: Phaser.GameObjects.Graphics;
  private camX = 0; camY = 0;
  private zoom = 1;
  private flicker = 0;
  private flickerT = 4;
  private gameId = -1;
  private fogLevel = 0.72;

  constructor() { super('game'); }

  create() {
    // Tạo texture nhân vật cho mọi phòng ban
    for (const d of DEPTS) {
      for (const f of [0, 1, 2] as const) this.textures.addCanvas(`ch_${d.id}_${f}`, characterCanvas(d.id, f));
    }
    this.textures.addCanvas('chair', chairCanvas());
    this.textures.addCanvas('light', lightCanvas(256));
    this.textures.addCanvas('glow', glowCanvas('rgba(90,170,255,0.85)', 128));
    this.textures.addCanvas('scanglow', glowCanvas('rgba(80,255,150,0.95)', 128));
    this.textures.addCanvas('shadow', shadowCanvas());

    this.drawMap();

    this.textures.addCanvas('hole', holeCanvas(1024, 64));
    this.fogHole = this.add.image(0, 0, 'hole').setDepth(50000);
    this.fogRects = this.add.graphics().setDepth(50000);

    const sc = station('fingerprint');
    this.scanGlow = this.add.image(sc.mark.x * TILE, sc.mark.y * TILE + 4, 'scanglow').setScale(1.4).setDepth(40001)
      .setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    for (const d of DESKS) {
      const gl = this.add.image((d.x + 1) * TILE, d.y * TILE + 10, 'glow').setScale(1.6).setDepth(50001)
        .setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      this.glows.push(gl);
    }

    // Dấu "!" ở các điểm làm việc
    for (const s of STATIONS) {
      if (s.id === 'camera') continue;
      const t = this.add.text(s.mark.x * TILE, s.mark.y * TILE, '!', {
        fontFamily: '"Baloo 2", "Trebuchet MS", sans-serif', fontSize: '34px', fontStyle: '800',
        color: (s.id === 'router' || s.id === 'power') ? '#ff4d4d' : '#ffd23f', stroke: '#1d1a2b', strokeThickness: 6,
      }).setOrigin(0.5, 1).setDepth(40000).setVisible(false);
      this.markers.set(s.id, t);
    }
    HIDE_SPOTS.forEach((h) => {
      const t = this.add.text(h.x * TILE + TILE / 2, h.y * TILE + 4, '◆', {
        fontFamily: 'sans-serif', fontSize: '18px', color: '#ff5d73', stroke: '#1d1a2b', strokeThickness: 4,
      }).setOrigin(0.5, 1).setDepth(40000).setVisible(false);
      this.hideMarkers.push(t);
    });

    this.scale.on('resize', () => this.layout());
    this.layout();
  }

  private layout() {
    const w = this.scale.width, h = this.scale.height;
    this.zoom = Phaser.Math.Clamp(Math.min(w / 700, h / 560), w < h ? 0.68 : 0.6, 1.25);
    this.cameras.main.setZoom(this.zoom);
  }

  // ---------- Vẽ bản đồ ----------
  private drawMap() {
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
    for (const f of FURNITURE) this.drawFurniture(g, f);
    this.drawHideSpots(g);
    // Nướng bản đồ thành một texture duy nhất để không phải vẽ lại hàng nghìn hình mỗi khung hình
    g.generateTexture('map', MAP_W * TILE, MAP_H * TILE);
    g.destroy();
    session.mapImage = this.textures.get('map').getSourceImage() as CanvasImageSource;
    this.add.image(0, 0, 'map').setOrigin(0, 0).setDepth(-100);

    for (const r of ROOMS) {
      if (!r.label) continue;
      this.add.text((r.x + r.w / 2) * TILE, (r.y + r.h / 2) * TILE + (r.id === 'open' ? 0.2 * TILE : r.id === 'meeting' ? 3.6 * TILE : 0), r.name, {
        fontFamily: '"Baloo 2", "Trebuchet MS", sans-serif', fontSize: '40px', fontStyle: '800', color: '#1d1a2b',
      }).setOrigin(0.5).setAlpha(0.13).setDepth(-50);
    }
  }

  private box(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fill: number, r = 6, lw = 3.5) {
    g.fillStyle(fill, 1); g.fillRoundedRect(x, y, w, h, r);
    g.lineStyle(lw, INK, 1); g.strokeRoundedRect(x, y, w, h, r);
  }

  private decorWalls(g: Phaser.GameObjects.Graphics) {
    // Cửa thang máy VIP (tường phòng Giám đốc và Lễ tân)
    for (const [x, y] of [[1.6, 0.1], [1.6, 16.1]]) {
      this.box(g, x * TILE, y * TILE, 1.8 * TILE, 0.85 * TILE, 0xc9b26b, 4);
      g.lineStyle(3, INK, 1); g.lineBetween((x + 0.9) * TILE, y * TILE, (x + 0.9) * TILE, (y + 0.85) * TILE);
    }
    // Cửa sổ kính dọc hành lang
    for (const x of [3, 10, 23, 27, 38, 42, 54, 62]) {
      this.box(g, x * TILE + 4, 11 * TILE + 8, TILE * 1.6, TILE - 22, 0x9fd6ff, 3, 3);
      g.lineStyle(2, 0xffffff, 0.7); g.lineBetween(x * TILE + 12, 11 * TILE + 30, x * TILE + 26, 11 * TILE + 14);
    }
    // Bảng KPI trên tường Open Space
    this.box(g, 21 * TILE + 6, 16 * TILE + 6, 2.6 * TILE, TILE - 16, 0xffffff, 3, 3);
    g.lineStyle(3, 0xe2412f, 1);
    g.beginPath(); g.moveTo(21.3 * TILE, 16.65 * TILE); g.lineTo(22 * TILE, 16.45 * TILE); g.lineTo(22.6 * TILE, 16.55 * TILE); g.lineTo(23.4 * TILE, 16.25 * TILE); g.strokePath();
    // Gương WC
    this.box(g, 16 * TILE + 6, 36 * TILE + 6, 3 * TILE - 12, TILE - 16, 0xd8f3ff, 3, 3);
    // Đồng hồ treo tường Open Space
    const cx = 41.5 * TILE, cy = 16.5 * TILE;
    g.fillStyle(0xffffff, 1); g.fillCircle(cx, cy, 13); g.lineStyle(3, INK, 1); g.strokeCircle(cx, cy, 13);
    g.lineBetween(cx, cy, cx, cy - 9); g.lineBetween(cx, cy, cx + 6, cy + 2);
    // Biển "Lối ra" ở Lễ tân
    this.box(g, 6.2 * TILE, 30.9 * TILE, 1.6 * TILE, 0.4 * TILE, 0x3fbf6a, 3, 2);
  }

  private drawFurniture(g: Phaser.GameObjects.Graphics, f: Furniture) {
    const X = f.x * TILE, Y = f.y * TILE, W = f.w * TILE, H = f.h * TILE;
    switch (f.kind) {
      case 'desk':
      case 'computer': {
        this.box(g, X + 3, Y + 6, W - 6, H - 8, 0xd6a46c, 6);
        g.fillStyle(0xc28f58, 1); g.fillRect(X + 6, Y + H - 10, W - 12, 5);
        this.box(g, X + W / 2 - 22, Y - 14, 44, 30, 0x2d3142, 4, 3);
        g.fillStyle(f.kind === 'computer' ? 0x3fbf6a : 0x5fb8ff, 1); g.fillRect(X + W / 2 - 18, Y - 10, 36, 21);
        if (f.kind === 'computer') { g.fillStyle(0xffffff, 0.8); for (let i = 0; i < 3; i++) g.fillRect(X + W / 2 - 15, Y - 7 + i * 6, 30, 2); }
        this.box(g, X + W / 2 - 16, Y + 22, 32, 9, 0xeeeeee, 2, 2);
        g.fillStyle(0xffffff, 1); g.fillRect(X + 10, Y + 14, 12, 14); g.lineStyle(2, INK, 1); g.strokeRect(X + 10, Y + 14, 12, 14);
        break;
      }
      case 'bigdesk': {
        this.box(g, X + 2, Y + 4, W - 4, H - 6, 0x8a5a35, 8);
        g.fillStyle(0x7a4c2b, 1); g.fillRect(X + 8, Y + H - 14, W - 16, 6);
        this.box(g, X + W / 2 - 28, Y + 14, 56, 34, 0xbfc5d2, 4, 3);
        g.fillStyle(0x2d3142, 1); g.fillRect(X + W / 2 - 23, Y + 18, 46, 24);
        this.box(g, X + 18, Y + 20, 30, 40, 0xffffff, 2, 2.5);
        this.box(g, X + 22, Y + 16, 30, 40, 0xffffff, 2, 2.5);
        this.box(g, X + W - 56, Y + 62, 46, 14, 0xe8c547, 3, 2.5);
        g.fillStyle(0xc8323c, 1); g.fillCircle(X + W - 34, Y + 30, 10); g.lineStyle(3, INK, 1); g.strokeCircle(X + W - 34, Y + 30, 10);
        break;
      }
      case 'rack': {
        this.box(g, X + 4, Y - 18, W - 8, H + 14, 0x2a2f45, 4);
        for (let i = 0; i < 6; i++) {
          g.fillStyle(0x3b425e, 1); g.fillRect(X + 10, Y - 10 + i * 15, W - 20, 10);
          g.fillStyle(i % 3 === 0 ? 0xff5d5d : 0x4ee1a0, 1); g.fillCircle(X + W - 18, Y - 5 + i * 15, 2.5);
          g.fillStyle(0x4ee1a0, 1); g.fillCircle(X + W - 26, Y - 5 + i * 15, 2.5);
        }
        g.lineStyle(3, 0xff4d6d, 1); g.beginPath(); g.moveTo(X + 14, Y + H - 4); g.lineTo(X + 30, Y + H + 6); g.lineTo(X + 48, Y + H - 2); g.strokePath();
        g.lineStyle(3, 0xffd23f, 1); g.beginPath(); g.moveTo(X + 20, Y + H - 4); g.lineTo(X + 40, Y + H + 10); g.lineTo(X + 60, Y + H); g.strokePath();
        break;
      }
      case 'fridge': {
        this.box(g, X + 6, Y - 30, W - 12, H + 24, 0xf4f6fb, 8);
        g.lineStyle(3, INK, 1); g.lineBetween(X + 6, Y - 2, X + W - 6, Y - 2);
        g.fillStyle(0xb9c0cf, 1); g.fillRect(X + W - 22, Y - 22, 5, 14); g.fillRect(X + W - 22, Y + 4, 5, 10);
        g.fillStyle(0xff5fa2, 1); g.fillRect(X + 18, Y - 20, 10, 8); g.fillStyle(0xffd23f, 1); g.fillRect(X + 34, Y - 24, 9, 9);
        break;
      }
      case 'coffee': {
        this.box(g, X + 8, Y + 6, W - 16, H - 8, 0xa0a6b6, 4);
        this.box(g, X + 16, Y - 26, 40, 46, 0x2d2a33, 6);
        g.fillStyle(0xff5d5d, 1); g.fillCircle(X + 26, Y - 16, 3); g.fillStyle(0x4ee1a0, 1); g.fillCircle(X + 36, Y - 16, 3);
        this.box(g, X + 28, Y + 6, 14, 14, 0xffffff, 3, 2.5);
        this.box(g, X + 62, Y + 10, 22, 20, 0xffffff, 4, 2.5);
        break;
      }
      case 'copier': {
        this.box(g, X + 4, Y - 16, W - 8, H + 10, 0xd9dce6, 6);
        this.box(g, X + 12, Y - 26, W - 24, 14, 0xb9bfcf, 3, 3);
        g.fillStyle(0xffffff, 1); g.fillRect(X + 22, Y - 22, 40, 6);
        g.fillStyle(0xff3b3b, 1); g.fillCircle(X + W - 20, Y - 4, 5);
        this.box(g, X + 20, Y + 10, 50, 10, 0xffffff, 2, 2);
        break;
      }
      case 'meetingtable': {
        this.box(g, X + 4, Y + 4, W - 8, H - 8, 0xb07a4b, 26);
        g.fillStyle(0x9c6a3e, 1); g.fillRoundedRect(X + 14, Y + 14, W - 28, H - 28, 18);
        g.fillStyle(0xc8323c, 1); g.fillCircle(X + W / 2, Y + H / 2, 18);
        g.lineStyle(4, INK, 1); g.strokeCircle(X + W / 2, Y + H / 2, 18);
        g.fillStyle(0xff7a7a, 1); g.fillCircle(X + W / 2 - 5, Y + H / 2 - 5, 6);
        break;
      }
      case 'router': {
        this.box(g, X + 6, Y + 14, W - 12, 22, 0x2d3142, 4);
        g.lineStyle(3, INK, 1); g.lineBetween(X + 12, Y + 14, X + 8, Y - 4); g.lineBetween(X + W - 12, Y + 14, X + W - 8, Y - 4);
        g.fillStyle(0x4ee1a0, 1); for (let i = 0; i < 3; i++) g.fillCircle(X + 16 + i * 8, Y + 25, 2.5);
        break;
      }
      case 'panel': {
        this.box(g, X + 6, Y + 4, W - 12, H - 6, 0x9aa1b4, 4);
        g.fillStyle(0xffd23f, 1); g.fillTriangle(X + W / 2, Y + 10, X + W / 2 - 8, Y + 24, X + W / 2 + 8, Y + 24);
        for (let i = 0; i < 3; i++) { g.fillStyle(0x2d3142, 1); g.fillRect(X + 12 + i * 9, Y + 30, 6, 10); }
        break;
      }
      case 'sink': {
        this.box(g, X + 2, Y + 8, W - 4, H - 10, 0xf4f6fb, 6);
        for (let i = 0; i < 3; i++) { g.fillStyle(0xbfe6f2, 1); g.fillEllipse(X + 24 + i * TILE, Y + 26, 30, 16); g.lineStyle(2.5, INK, 1); g.strokeEllipse(X + 24 + i * TILE, Y + 26, 30, 16); }
        break;
      }
      case 'pantrytable': {
        this.box(g, X + 4, Y + 4, W - 8, H - 8, 0xf2f2f2, 14);
        for (let i = 0; i < 3; i++) this.box(g, X + 30 + i * 50, Y + 30, 20, 16, i === 1 ? 0xff9f43 : 0xffffff, 6, 2.5);
        break;
      }
      case 'sofa': {
        this.box(g, X + 2, Y - 8, W - 4, H + 4, 0x4d7cc7, 12);
        this.box(g, X + 10, Y + 6, W / 2 - 14, H - 14, 0x6a96dc, 8, 2.5);
        this.box(g, X + W / 2 + 4, Y + 6, W / 2 - 14, H - 14, 0x6a96dc, 8, 2.5);
        break;
      }
      case 'plant': {
        this.box(g, X + 12, Y + 22, W - 24, H - 24, 0xd97b4a, 4);
        for (const [dx, dy, r] of [[24, 14, 12], [14, 6, 9], [34, 6, 9], [24, -2, 9]]) {
          g.fillStyle(0x3fa66b, 1); g.fillCircle(X + dx, Y + dy, r); g.lineStyle(3, INK, 1); g.strokeCircle(X + dx, Y + dy, r);
        }
        break;
      }
      case 'counter': {
        this.box(g, X + 2, Y - 10, W - 4, H + 6, 0xe8d3b0, 8);
        g.fillStyle(0xd1b78d, 1); g.fillRect(X + 8, Y + H - 12, W - 16, 6);
        this.box(g, X + W - 80, Y - 26, 40, 26, 0x2d3142, 4, 3);
        g.fillStyle(0x5fb8ff, 1); g.fillRect(X + W - 76, Y - 22, 32, 17);
        this.box(g, X + 20, Y - 6, 26, 14, 0xffd23f, 3, 2.5);
        break;
      }
      case 'scanner': {
        this.box(g, X + 10, Y - 20, W - 20, H + 12, 0x3b3f4a, 6);
        this.box(g, X + 16, Y - 12, W - 32, 18, 0x9fe6b5, 4, 2.5);
        g.fillStyle(0x4ee1a0, 1); g.fillCircle(X + W / 2, Y + 18, 5);
        break;
      }
      case 'boxes': {
        this.box(g, X + 4, Y + 30, 46, 40, 0xc79a62, 3);
        this.box(g, X + 44, Y + 40, 44, 34, 0xd4a970, 3);
        this.box(g, X + 14, Y + 2, 40, 30, 0xd4a970, 3);
        g.lineStyle(2.5, 0xffffff, 0.8); g.lineBetween(X + 34, Y + 2, X + 34, Y + 32);
        break;
      }
      case 'bigplant': {
        this.box(g, X + 10, Y + 22, W - 20, H - 24, 0xffffff, 6);
        for (const [dx, dy, r] of [[24, 6, 14], [12, -4, 10], [36, -4, 10], [24, -16, 11]]) {
          g.fillStyle(0x2f9e5e, 1); g.fillCircle(X + dx, Y + dy, r); g.lineStyle(3, INK, 1); g.strokeCircle(X + dx, Y + dy, r);
        }
        break;
      }
      case 'easel': {
        g.lineStyle(4, INK, 1); g.lineBetween(X + 10, Y + H - 2, X + W / 2, Y - 20); g.lineBetween(X + W - 10, Y + H - 2, X + W / 2, Y - 20);
        this.box(g, X + 4, Y - 14, W - 8, 34, 0xffffff, 3, 3);
        g.fillStyle(0xff6b4a, 1); g.fillCircle(X + 18, Y + 2, 6); g.fillStyle(0x2e9cf0, 1); g.fillRect(X + 26, Y - 6, 12, 12);
        break;
      }
      case 'kanban': {
        this.box(g, X + 4, Y - 30, W - 8, H + 16, 0xffffff, 4);
        for (let c = 0; c < 3; c++) {
          g.lineStyle(2, 0xc9c4b5, 1); if (c) g.lineBetween(X + 4 + c * (W - 8) / 3, Y - 26, X + 4 + c * (W - 8) / 3, Y + H - 18);
          for (let r = 0; r < 3 - c; r++) { g.fillStyle([0xffe36e, 0xff9ec4, 0x9fe0ff][(c + r) % 3], 1); g.fillRect(X + 14 + c * (W - 8) / 3, Y - 22 + r * 18, 26, 14); }
        }
        break;
      }
      case 'projector': {
        this.box(g, X + 6, Y + 8, W - 12, 22, 0xe9edf5, 6);
        g.fillStyle(0x2d3142, 1); g.fillCircle(X + W / 2, Y + 19, 7);
        break;
      }
      case 'whiteboard': {
        this.box(g, X + 2, Y - 30, W - 4, H + 14, 0xffffff, 3);
        g.lineStyle(3, 0x2e9cf0, 1); g.lineBetween(X + 12, Y - 4, X + 40, Y - 16); g.lineBetween(X + 40, Y - 16, X + 60, Y - 10);
        g.lineStyle(3, 0xe2412f, 1); g.lineBetween(X + 12, Y + 2, X + 70, Y + 2);
        break;
      }
      case 'printer': {
        this.box(g, X + 6, Y - 10, W - 12, H + 4, 0xf0f1f5, 6);
        this.box(g, X + 16, Y - 20, W - 32, 12, 0xffffff, 2, 2.5);
        this.box(g, X + 20, Y + 18, W - 40, 10, 0xffffff, 2, 2);
        g.fillStyle(0x4ee1a0, 1); g.fillCircle(X + W - 20, Y + 2, 4);
        break;
      }
      case 'monitors': {
        this.box(g, X + 2, Y + 6, W - 4, H - 8, 0x4b5068, 6);
        for (let i = 0; i < 4; i++) {
          this.box(g, X + 10 + i * (W - 20) / 4, Y - 24, (W - 20) / 4 - 8, 30, 0x1d1a2b, 3, 3);
          g.fillStyle(0x3fbf6a, 0.55); g.fillRect(X + 14 + i * (W - 20) / 4, Y - 20, (W - 20) / 4 - 16, 22);
        }
        break;
      }
      case 'shelf': {
        this.box(g, X + 2, Y - 12, W - 4, H + 8, 0xa9805a, 4);
        for (let i = 0; i < W / 14 - 1; i++) { g.fillStyle([0xe2412f, 0x2e9cf0, 0xf2b705, 0x3fbf6a][i % 4], 1); g.fillRect(X + 8 + i * 14, Y - 8, 10, H - 4); }
        break;
      }
      case 'paper': {
        this.box(g, X + 14, Y + 6, W - 28, 20, 0xb9c0cf, 6, 3);
        g.fillStyle(0xffffff, 1); g.fillCircle(X + W / 2, Y + 16, 9); g.lineStyle(2.5, INK, 1); g.strokeCircle(X + W / 2, Y + 16, 9);
        break;
      }
      case 'hrdesk': {
        this.box(g, X + 3, Y + 4, W - 6, H - 6, 0xf4f6fb, 6);
        this.box(g, X + 20, Y + 10, 34, 24, 0xffffff, 2, 2.5);
        this.box(g, X + W - 60, Y - 14, 40, 28, 0x2d3142, 4, 3);
        g.fillStyle(0xff9ec4, 1); g.fillRect(X + W - 56, Y - 10, 32, 18);
        break;
      }
      case 'tap': {
        this.box(g, X + 2, Y + 8, W - 4, H - 10, 0xe9edf5, 6);
        g.fillStyle(0xbfe6f2, 1); g.fillEllipse(X + W / 2, Y + 26, 50, 18); g.lineStyle(2.5, INK, 1); g.strokeEllipse(X + W / 2, Y + 26, 50, 18);
        g.lineStyle(5, 0x8a90b4, 1); g.lineBetween(X + W / 2, Y + 10, X + W / 2, Y - 8); g.lineBetween(X + W / 2, Y - 8, X + W / 2 + 14, Y - 8);
        break;
      }
      case 'watercooler': {
        this.box(g, X + 12, Y + 12, W - 24, H - 14, 0xe9edf5, 4);
        this.box(g, X + 14, Y - 14, W - 28, 28, 0x8fd3ff, 10);
        break;
      }
    }
  }

  private drawHideSpots(g: Phaser.GameObjects.Graphics) {
    for (const h of HIDE_SPOTS) {
      const X = h.x * TILE, Y = h.y * TILE;
      if (h.id.startsWith('gam_ban')) {
        this.box(g, X - 10, Y + 4, TILE + 20, 16, 0xd6a46c, 4);
        g.lineStyle(3, INK, 1); g.lineBetween(X - 4, Y + 20, X - 4, Y + 44); g.lineBetween(X + TILE + 4, Y + 20, X + TILE + 4, Y + 44);
      } else if (h.id.startsWith('tu_hs')) {
        this.box(g, X + 6, Y - 20, TILE - 12, TILE + 14, 0x8c93a8, 4);
        for (let i = 0; i < 3; i++) { g.lineStyle(2.5, INK, 1); g.strokeRect(X + 12, Y - 14 + i * 18, TILE - 24, 14); g.fillStyle(INK, 1); g.fillRect(X + TILE / 2 - 4, Y - 9 + i * 18, 8, 3); }
      } else if (h.id === 'kho') {
        this.box(g, X + 4, Y - 16, TILE - 8, TILE + 10, 0xb08a5a, 4);
        g.lineStyle(2.5, INK, 1); g.lineBetween(X + 4, Y + 4, X + TILE - 4, Y + 4);
      } else if (h.id === 'buong_wc') {
        this.box(g, X + 2, Y - 24, TILE - 4, TILE + 18, 0xf2e7c9, 4);
        g.fillStyle(0x4ee1a0, 1); g.fillCircle(X + TILE - 12, Y + 4, 4);
      } else if (h.id.startsWith('san_kt')) {
        g.fillStyle(0x3b425e, 1); g.fillRect(X + 4, Y + 4, TILE - 8, TILE - 8);
        g.lineStyle(2.5, INK, 1); g.strokeRect(X + 4, Y + 4, TILE - 8, TILE - 8);
        g.lineStyle(1.5, 0x8a90b4, 1); for (let i = 1; i < 4; i++) g.lineBetween(X + 4 + i * 10, Y + 6, X + 4 + i * 10, Y + TILE - 6);
      } else if (h.id.startsWith('thang_may')) {
        g.fillStyle(0x000000, 0.12); g.fillRect(X + 4, Y + 4, TILE - 8, TILE - 8);
        g.lineStyle(2, INK, 0.5); g.strokeRect(X + 4, Y + 4, TILE - 8, TILE - 8);
      }
    }
  }

  // ---------- Vòng lặp ----------
  update(_time: number, deltaMs: number) {
    const world = session.world;
    const dt = Math.min(0.05, deltaMs / 1000);
    session.onFrame(dt);
    if (!world) return;
    if (this.gameId !== session.newGameId) this.resetViews();

    if (!session.paused) {
      world.playerInput = session.input;
      world.update(dt);
      const ev = world.drainEvents();
      if (ev.length) session.onEvents(ev);
    }

    const p = world.player;
    const w = this.scale.width, h = this.scale.height;
    const k = Math.min(1, dt * 9);
    this.camX += (p.x - this.camX) * k;
    this.camY += (p.y - 30 - this.camY) * k;
    this.cameras.main.setScroll(this.camX - w / 2, this.camY - h / 2);

    const pAlive = p.alive;
    const sab = world.sabotage?.kind;
    const myVision = !pAlive ? 99999 : (p.role === 'impostor' ? VISION_IMP : sab === 'power' ? VISION_DARK : VISION);

    // Nhân vật
    for (const a of world.agents) {
      const v = this.views.get(a.id)!;
      let show = true;
      if (a.hidden !== null) show = false;
      else if (!a.alive && pAlive && !a.isPlayer) show = false;
      else if (!a.isPlayer && pAlive && Math.hypot(a.x - p.x, a.y - p.y) > myVision + 20) show = false;
      if (world.phase === 'meeting') show = show && a.alive;
      v.sprite.setVisible(show); v.shadow.setVisible(show && a.alive); v.tag.setVisible(show);
      if (!show) continue;
      const frame = a.moving ? (Math.floor(a.walkT * 7) % 2 === 0 ? 1 : 2) : 0;
      v.sprite.setTexture(`ch_${a.dept}_${frame}`);
      v.sprite.setFlipX(a.facing < 0);
      const floatY = a.alive ? 0 : Math.sin(this.time.now / 300 + a.id) * 5 - 10;
      v.sprite.setPosition(a.x, a.y + 6 + floatY);
      v.sprite.setAlpha(a.alive ? 1 : 0.42);
      v.sprite.setDepth(a.y);
      v.shadow.setPosition(a.x, a.y + 4).setDepth(a.y - 1);
      v.tag.setPosition(a.x, a.y - 66 + floatY).setDepth(30000 + a.y).setAlpha(a.alive ? 1 : 0.6);
      const imposterMate = p.role === 'impostor' && a.role === 'impostor';
      v.tag.setColor(imposterMate ? '#ff5d73' : '#ffffff');
    }

    // Ghế trống (xác)
    while (this.bodyViews.length < world.bodies.length) this.bodyViews.push(this.add.image(0, 0, 'chair').setOrigin(0.5, 0.85));
    this.bodyViews.forEach((img, i) => {
      const b = world.bodies[i];
      if (!b || world.phase === 'meeting') { img.setVisible(false); return; }
      const visible = !pAlive || Math.hypot(b.x - p.x, b.y - p.y) <= myVision + 20;
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
      t.setAlpha(p.role === 'impostor' && !isFix ? 0.55 : 1);
    }
    this.hideMarkers.forEach(t => t.setVisible(p.role === 'impostor' && p.alive && world.phase === 'play'));

    // Sương mù tầm nhìn
    this.flickerT -= dt;
    if (this.flickerT <= 0) { this.flicker = 0.18; this.flickerT = 3 + Math.random() * 8; }
    this.flicker = Math.max(0, this.flicker - dt * 1.2);
    const fl = this.flicker > 0.1 && Math.random() < 0.5 ? 0.12 : 0;
    const target = !pAlive ? 0.15 : sab === 'power' ? 0.94 : 0.62;
    this.fogLevel += (target - this.fogLevel) * Math.min(1, dt * 4);
    const viewL = this.camX - w / (2 * this.zoom) - 40, viewT = this.camY - h / (2 * this.zoom) - 40;
    const viewR = this.camX + w / (2 * this.zoom) + 40, viewB = this.camY + h / (2 * this.zoom) + 40;
    const alpha = Math.min(1, this.fogLevel + fl);
    const color = 0x0d0e1f;
    const g = this.fogRects;
    g.clear();
    g.fillStyle(color, alpha);
    if (pAlive) {
      // Một tấm sương mù rất lớn có lỗ tròn ở giữa, luôn phủ kín màn hình
      const holeR = myVision * 1.18;
      const size = holeR * (1024 / 64);
      this.fogHole.setVisible(true).setPosition(p.x, p.y).setDisplaySize(size, size).setAlpha(alpha);
    } else {
      this.fogHole.setVisible(false);
      g.fillRect(viewL, viewT, viewR - viewL, viewB - viewT);
    }
    this.glows.forEach(g => g.setVisible(sab === 'power'));
    // Đèn máy chấm công: ai đứng gần cũng thấy (task hiển thị)
    const scanner = world.agents.find(a => a.scanning && a.alive);
    const seeScan = !!scanner && (!pAlive || Math.hypot(this.scanGlow.x - p.x, this.scanGlow.y - p.y) <= myVision + 40);
    this.scanGlow.setVisible(seeScan && world.phase === 'play').setAlpha(0.6 + Math.sin(this.time.now / 90) * 0.4);
  }

  private resetViews() {
    const world = session.world!;
    this.gameId = session.newGameId;
    for (const v of this.views.values()) { v.sprite.destroy(); v.shadow.destroy(); v.tag.destroy(); }
    this.views.clear();
    this.bodyViews.forEach(b => b.destroy());
    this.bodyViews = [];
    for (const a of world.agents) {
      const shadow = this.add.image(a.x, a.y, 'shadow');
      const sprite = this.add.image(a.x, a.y, `ch_${a.dept}_0`).setOrigin(0.5, 0.95).setScale(CHAR_SCALE);
      const tag = this.add.text(a.x, a.y - 66, a.name, {
        fontFamily: '"Baloo 2", "Trebuchet MS", sans-serif', fontSize: '17px', fontStyle: '800',
        color: '#ffffff', backgroundColor: dept(a.dept).color, padding: { x: 7, y: 1 },
        stroke: '#1d1a2b', strokeThickness: 3,
      }).setOrigin(0.5, 1);
      this.views.set(a.id, { sprite, shadow, tag });
    }
    this.camX = world.player.x; this.camY = world.player.y;
  }
}

