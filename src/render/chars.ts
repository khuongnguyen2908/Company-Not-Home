// Vẽ nhân vật theo phong cách hoạt hình vector viền đậm, hoàn toàn bằng code.
// Ngoại hình do người chơi tự chọn: kiểu tóc, màu tóc, màu da, kiểu áo, màu áo, phụ kiện.

export const INK = '#1d1a2b';
/** Vùng vẽ nhân vật rộng 72; khung ảnh chừa lề mỗi bên để không skin nào bị cắt (kiểm bằng tests/skin_edges.py) */
export const CHAR_PAD_X = 9;
export const CHAR_PAD_B = 6;
export const CHAR_W = 72 + 2 * CHAR_PAD_X;
export const CHAR_TOP = 20; // chừa chỗ phía trên cho mũ pháp sư, ăng-ten robot, ống hút...
export const CHAR_H = 88 + CHAR_TOP + CHAR_PAD_B;
/** Điểm neo ở chân nhân vật (tỉ lệ theo chiều cao canvas) */
export const CHAR_ORIGIN_Y = (83.6 + CHAR_TOP) / CHAR_H;

import { type Look, lookKey, bodyDef, colors2 } from '../game/look';
export * from '../game/look';

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fillStroke(ctx: CanvasRenderingContext2D, fill: string, lw = 3.5) {
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
}

type C2 = readonly [string, string];
const SHORT_SLEEVE = ['none', 'tee', 'polo', 'hawaii', 'teamtee'];

/** Phần tóc phía sau đầu (vẽ trước đầu) */
function hairBack(ctx: CanvasRenderingContext2D, style: string, color: string) {
  ctx.fillStyle = color; ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
  const fs = () => { ctx.fill(); ctx.stroke(); };
  switch (style) {
    case 'long': rr(ctx, 14, 12, 28, 46, 12); fs(); break;
    case 'bob': rr(ctx, 15, 10, 32, 32, 14); fs(); break;
    case 'afro': ctx.beginPath(); ctx.arc(35, 20, 26, 0, Math.PI * 2); fs(); break;
    case 'braid':
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(18 - i * 0.8, 32 + i * 7, 5, 4.5, 0, 0, Math.PI * 2); fs(); }
      ctx.fillStyle = '#e2412f'; ctx.beginPath(); ctx.arc(14.5, 66, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      break;
  }
}

function hairPath(ctx: CanvasRenderingContext2D, style: string) {
  ctx.beginPath();
  switch (style) {
    case 'messy':
      ctx.moveTo(19, 27); ctx.lineTo(18, 14); ctx.lineTo(24, 17); ctx.lineTo(25, 7); ctx.lineTo(32, 12); ctx.lineTo(37, 4);
      ctx.lineTo(42, 11); ctx.lineTo(50, 6); ctx.lineTo(50, 14); ctx.lineTo(57, 15); ctx.lineTo(54, 22); ctx.lineTo(44, 18); ctx.lineTo(30, 20); ctx.lineTo(26, 30); ctx.closePath();
      break;
    case 'spiky':
      ctx.moveTo(20, 24); ctx.lineTo(22, 6); ctx.lineTo(30, 13); ctx.lineTo(36, 2); ctx.lineTo(42, 12); ctx.lineTo(50, 4); ctx.lineTo(52, 15); ctx.lineTo(57, 20);
      ctx.lineTo(44, 17); ctx.lineTo(28, 19); ctx.lineTo(25, 30); ctx.closePath();
      break;
    case 'slick': case 'topknot':
      ctx.moveTo(19, 28); ctx.quadraticCurveTo(18, 8, 38, 7); ctx.quadraticCurveTo(56, 8, 57, 22); ctx.quadraticCurveTo(44, 13, 30, 18); ctx.lineTo(26, 31); ctx.closePath();
      if (style === 'topknot') { ctx.moveTo(42, 4); ctx.rect(31, -2, 11, 8); }
      break;
    case 'side': case 'long': case 'braid':
      ctx.moveTo(19, 30); ctx.quadraticCurveTo(17, 7, 38, 7); ctx.quadraticCurveTo(57, 7, 57, 24); ctx.lineTo(52, 17); ctx.lineTo(40, 15); ctx.lineTo(28, 19); ctx.lineTo(25, 32); ctx.closePath();
      break;
    case 'short': case 'spacebuns':
      ctx.moveTo(19, 27); ctx.quadraticCurveTo(19, 8, 38, 8); ctx.quadraticCurveTo(55, 8, 56, 19); ctx.lineTo(42, 15); ctx.lineTo(27, 18); ctx.lineTo(25, 29); ctx.closePath();
      if (style === 'spacebuns') { ctx.moveTo(31, 6); ctx.arc(25, 7, 7, 0, Math.PI * 2); ctx.moveTo(51, 4); ctx.arc(45, 4, 7, 0, Math.PI * 2); }
      break;
    case 'bob':
      ctx.moveTo(18, 34); ctx.quadraticCurveTo(16, 7, 38, 7); ctx.quadraticCurveTo(57, 7, 57, 22); ctx.lineTo(46, 15); ctx.lineTo(30, 18); ctx.lineTo(26, 36); ctx.closePath();
      break;
    case 'bangs':
      ctx.moveTo(19, 28); ctx.quadraticCurveTo(18, 7, 38, 7); ctx.quadraticCurveTo(57, 7, 58, 22); ctx.lineTo(56, 22); ctx.lineTo(28, 21); ctx.lineTo(25, 31); ctx.closePath();
      break;
    case 'undercut':
      ctx.moveTo(22, 17); ctx.quadraticCurveTo(30, 0, 56, 9); ctx.lineTo(58, 17); ctx.lineTo(46, 15); ctx.lineTo(27, 19); ctx.closePath();
      break;
    case 'curly':
      for (const [cx, cy, r] of [[22, 22, 7], [24, 13, 8], [33, 8, 8], [43, 8, 8], [51, 13, 7], [20, 32, 6], [22, 40, 6]] as const) { ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2); }
      break;
    case 'afro':
      for (const [cx, cy, r] of [[28, 13, 6], [38, 10, 6], [48, 13, 6]] as const) { ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2); }
      break;
    case 'bun':
      ctx.moveTo(19, 30); ctx.quadraticCurveTo(17, 8, 38, 8); ctx.quadraticCurveTo(56, 8, 57, 21); ctx.lineTo(42, 15); ctx.lineTo(27, 19); ctx.lineTo(25, 32); ctx.closePath();
      ctx.moveTo(30, 5); ctx.arc(23, 5, 7, 0, Math.PI * 2);
      break;
    case 'pony':
      ctx.moveTo(19, 30); ctx.quadraticCurveTo(17, 8, 38, 8); ctx.quadraticCurveTo(56, 8, 57, 21); ctx.lineTo(42, 15); ctx.lineTo(27, 19); ctx.lineTo(25, 32); ctx.closePath();
      ctx.moveTo(20, 18); ctx.quadraticCurveTo(6, 22, 10, 42); ctx.quadraticCurveTo(16, 32, 22, 26); ctx.closePath();
      break;
    case 'balding':
      ctx.moveTo(19, 33); ctx.quadraticCurveTo(17, 22, 22, 15); ctx.lineTo(27, 19); ctx.lineTo(25, 34); ctx.closePath();
      ctx.moveTo(26, 13); ctx.quadraticCurveTo(30, 10, 33, 12); ctx.lineTo(30, 15); ctx.closePath();
      break;
    case 'bald':
      ctx.moveTo(20, 26); ctx.quadraticCurveTo(19, 20, 23, 16); ctx.lineTo(26, 26); ctx.closePath();
      break;
  }
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r1: number, r2: number, fill: string) {
  ctx.fillStyle = fill; ctx.beginPath();
  for (let k = 0; k < 10; k++) { const r = k % 2 ? r2 : r1, a = k / 10 * Math.PI * 2 - Math.PI / 2; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
}

// ---------- Lưng ----------
function drawBack(ctx: CanvasRenderingContext2D, id: string, [c1]: C2, frame: 0 | 1 | 2 = 0) {
  // Đồ sau lưng đung đưa theo nhịp bước
  const sway = frame === 1 ? 0.12 : frame === 2 ? -0.1 : 0;
  ctx.save(); ctx.translate(20, 48); ctx.rotate(sway); ctx.translate(-20, -48);
  drawBackInner(ctx, id, c1);
  ctx.restore();
}
function drawBackInner(ctx: CanvasRenderingContext2D, id: string, c1: string) {
  switch (id) {
    case 'cape': ctx.beginPath(); ctx.moveTo(18, 44); ctx.quadraticCurveTo(4, 62, 8, 80); ctx.lineTo(26, 76); ctx.lineTo(24, 46); ctx.closePath(); fillStroke(ctx, c1, 3); break;
    case 'dinotail':
      ctx.beginPath(); ctx.moveTo(18, 62); ctx.quadraticCurveTo(2, 70, 0, 80); ctx.quadraticCurveTo(12, 76, 22, 72); ctx.closePath(); fillStroke(ctx, c1, 3);
      for (const [x, y] of [[14, 44], [11, 52], [10, 60]]) { ctx.beginPath(); ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y); ctx.lineTo(x + 4, y + 4); ctx.closePath(); fillStroke(ctx, '#ffd23f', 2); }
      break;
    case 'horsetail':
      ctx.beginPath(); ctx.moveTo(18, 64); ctx.quadraticCurveTo(4, 66, 4, 82); ctx.quadraticCurveTo(8, 74, 12, 84); ctx.quadraticCurveTo(14, 74, 22, 70); ctx.closePath(); fillStroke(ctx, c1, 3);
      ctx.strokeStyle = shade(c1, 0.75); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(14, 68); ctx.quadraticCurveTo(8, 72, 8, 80); ctx.stroke();
      break;
    case 'backpack': rr(ctx, 6, 46, 14, 22, 5); fillStroke(ctx, c1, 3); rr(ctx, 8, 56, 10, 7, 2); fillStroke(ctx, shade(c1, 0.8), 2); break;
    case 'wings':
      for (const [dx, sc] of [[0, 1], [4, 0.8]] as const) {
        ctx.beginPath(); ctx.moveTo(22 + dx, 48); ctx.quadraticCurveTo(-2 + dx, 30 * sc + 10, 2 + dx, 62); ctx.quadraticCurveTo(10 + dx, 58, 22 + dx, 60); ctx.closePath(); fillStroke(ctx, c1, 2.5);
      }
      break;
  }
}

// ---------- Quần ----------
function drawLegs(ctx: CanvasRenderingContext2D, L: Look, frame: 0 | 1 | 2, bodyC: string, skinC: string) {
  const b = L.items.bottom, [c1, c2] = colors2(b.color || '#33384a');
  const lUp = frame === 1 ? 4 : 0, rUp = frame === 2 ? 4 : 0;
  if (L.body === 'ghost') return; // con ma không có chân
  const leg = b.id === 'none' ? bodyC : ['shorts', 'skirt', 'idolskirt'].includes(b.id) ? skinC : c1;
  rr(ctx, 22, 68 - lUp, 12, 15, 5); fillStroke(ctx, leg);
  rr(ctx, 38, 68 - rUp, 12, 15, 5); fillStroke(ctx, leg);
  if (b.id === 'shorts') { rr(ctx, 21, 66 - lUp, 14, 8, 3); fillStroke(ctx, c1, 2.5); rr(ctx, 37, 66 - rUp, 14, 8, 3); fillStroke(ctx, c1, 2.5); }
  if (b.id === 'jeans') { ctx.strokeStyle = c2; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(28, 70 - lUp); ctx.lineTo(28, 80 - lUp); ctx.moveTo(44, 70 - rUp); ctx.lineTo(44, 80 - rUp); ctx.stroke(); }
  if (b.id === 'ninjapants') for (const [x, up] of [[22, lUp], [38, rUp]]) { ctx.fillStyle = c2; ctx.fillRect(x + 1, 76 - up, 10, 3); }
  let shoe = INK;
  if (b.id === 'breeches') { shoe = c2; for (const [x, up] of [[21, lUp], [37, rUp]]) { rr(ctx, x, 74 - up, 14, 10, 3); fillStroke(ctx, c2, 2); } }
  if (b.id === 'robotlegs') { shoe = c2; for (const [x, up] of [[22, lUp], [38, rUp]]) { ctx.beginPath(); ctx.arc(x + 6, 74 - up, 3, 0, Math.PI * 2); fillStroke(ctx, c2, 1.5); } }
  if (b.id === 'dinolegs') shoe = c2;
  if (b.id === 'none' && L.body === 'robot') shoe = colors2(L.bodyColor)[1];
  rr(ctx, 21, 79 - lUp, 15, 6, 3); fillStroke(ctx, shoe, 1);
  rr(ctx, 37, 79 - rUp, 15, 6, 3); fillStroke(ctx, shoe, 1);
  if (b.id === 'dinolegs') for (const [x, up] of [[33, lUp], [49, rUp]]) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x, 80 - up); ctx.lineTo(x + 4, 82 - up); ctx.lineTo(x, 84 - up); ctx.fill(); }
}

/** Phần quần/váy phủ lên thân (váy, hakama) */
function drawBottomOver(ctx: CanvasRenderingContext2D, L: Look) {
  const b = L.items.bottom, [c1, c2] = colors2(b.color || '#33384a');
  switch (b.id) {
    case 'skirt': ctx.beginPath(); ctx.moveTo(16, 62); ctx.lineTo(56, 62); ctx.lineTo(60, 76); ctx.lineTo(12, 76); ctx.closePath(); fillStroke(ctx, c1, 3); break;
    case 'idolskirt':
      ctx.beginPath(); ctx.moveTo(15, 60); ctx.lineTo(57, 60); ctx.lineTo(63, 76); ctx.lineTo(9, 76); ctx.closePath(); fillStroke(ctx, c1, 3);
      ctx.strokeStyle = c2; ctx.lineWidth = 1.5; for (let x = 16; x < 58; x += 7) { ctx.beginPath(); ctx.moveTo(x, 62); ctx.lineTo(x - 2, 75); ctx.stroke(); }
      break;
    case 'hakama':
      ctx.beginPath(); ctx.moveTo(15, 62); ctx.lineTo(57, 62); ctx.lineTo(62, 80); ctx.lineTo(10, 80); ctx.closePath(); fillStroke(ctx, c1, 3);
      ctx.strokeStyle = c2; ctx.lineWidth = 1.8; for (const x of [24, 36, 48]) { ctx.beginPath(); ctx.moveTo(x, 64); ctx.lineTo(x + (x - 36) * 0.2, 79); ctx.stroke(); }
      break;
    case 'trousers': case 'jeans': case 'ninjapants': case 'breeches': case 'robotlegs': case 'dinolegs':
      rr(ctx, 16, 64, 40, 9, 4); fillStroke(ctx, c1, 2.5);
      if (b.id === 'trousers') { ctx.fillStyle = INK; ctx.fillRect(33, 64, 6, 4); }
      break;
  }
}

// ---------- Áo ----------
function topBase(L: Look, bodyC: string): string {
  const t = L.items.top;
  if (t.id === 'none') return bodyC;
  const [c1] = colors2(t.color);
  if (t.id === 'shirt' || t.id === 'sweatervest') return t.id === 'shirt' ? '#f8f8f8' : c1;
  if (t.id === 'pirate') return colors2(t.color)[0];
  return c1;
}

function drawTop(ctx: CanvasRenderingContext2D, L: Look) {
  const t = L.items.top, [c1, c2] = colors2(t.color || '#2e9cf0');
  switch (t.id) {
    case 'hoodie':
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(31, 46); ctx.lineTo(30, 56); ctx.moveTo(42, 46); ctx.lineTo(43, 56); ctx.stroke();
      rr(ctx, 26, 62, 22, 8, 4); fillStroke(ctx, shade(c1, 0.85), 2); break;
    case 'shirt': ctx.beginPath(); ctx.moveTo(35, 44); ctx.lineTo(39, 44); ctx.lineTo(41, 66); ctx.lineTo(37, 70); ctx.lineTo(33, 66); ctx.closePath(); fillStroke(ctx, c1, 2); break;
    case 'blazer':
      ctx.beginPath(); ctx.moveTo(30, 43); ctx.lineTo(37, 58); ctx.lineTo(44, 43); ctx.closePath(); fillStroke(ctx, '#ffffff', 2.5);
      ctx.fillStyle = INK; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(37, 62 + i * 6, 1.4, 0, Math.PI * 2); ctx.fill(); } break;
    case 'polo':
      for (const s of [1, -1]) { ctx.beginPath(); ctx.moveTo(37 - 8 * s, 43); ctx.lineTo(37 - 1 * s, 50); ctx.lineTo(37, 43); ctx.closePath(); fillStroke(ctx, shade(c1, 0.8), 2); }
      ctx.fillStyle = INK; for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(37, 53 + i * 5, 1.3, 0, Math.PI * 2); ctx.fill(); } break;
    case 'turtleneck':
      rr(ctx, 27, 39, 20, 9, 4); fillStroke(ctx, shade(c1, 0.85), 2.5);
      ctx.strokeStyle = shade(c1, 0.7); ctx.lineWidth = 1.5; for (let x = 20; x < 54; x += 6) { ctx.beginPath(); ctx.moveTo(x, 50); ctx.lineTo(x, 70); ctx.stroke(); } break;
    case 'cardigan':
      rr(ctx, 29, 43, 15, 30, 4); fillStroke(ctx, '#fff4e0', 2);
      ctx.fillStyle = INK; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(28, 52 + i * 7, 1.4, 0, Math.PI * 2); ctx.fill(); } break;
    case 'denim':
      rr(ctx, 29, 43, 15, 30, 4); fillStroke(ctx, c2, 2);
      ctx.strokeStyle = shade(c1, 0.65); ctx.lineWidth = 1.6; rr(ctx, 18, 52, 9, 7, 2); ctx.stroke(); rr(ctx, 46, 52, 9, 7, 2); ctx.stroke(); break;
    case 'hawaii':
      for (const [x, y, col] of [[22, 50, '#ffffff'], [44, 48, '#ffe36e'], [27, 64, '#ffe36e'], [49, 62, '#ffffff'], [36, 58, '#ff9ec4']] as const) {
        ctx.fillStyle = col; for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 1.9, 0, Math.PI * 2); ctx.fill(); }
      } break;
    case 'teamtee':
      ctx.beginPath(); ctx.arc(36, 60, 7, 0, Math.PI * 2); fillStroke(ctx, '#ffffff', 2);
      ctx.fillStyle = c1; ctx.font = '800 6px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('KPI', 36, 60.5); break;
    case 'sweatervest':
      ctx.beginPath(); ctx.moveTo(30, 43); ctx.lineTo(37, 55); ctx.lineTo(44, 43); ctx.closePath(); fillStroke(ctx, '#ffffff', 2);
      ctx.strokeStyle = shade(c1, 0.72); ctx.lineWidth = 1.4;
      for (const [x, y] of [[24, 60], [36, 64], [48, 60]]) { ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 4, y); ctx.closePath(); ctx.stroke(); } break;
    case 'ninja':
      rr(ctx, 15, 60, 42, 5, 2); fillStroke(ctx, c2, 2);
      ctx.strokeStyle = shade(c1, 1.6); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(28, 43); ctx.lineTo(44, 58); ctx.stroke(); break;
    case 'idol':
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(36, 50); ctx.lineTo(36 + 9 * s, 45); ctx.lineTo(36 + 9 * s, 55); ctx.closePath(); fillStroke(ctx, c2, 2); }
      star(ctx, 46, 64, 3.5, 1.5, c2); break;
    case 'jockey':
      ctx.save(); rr(ctx, 15, 42, 42, 32, 13); ctx.clip(); ctx.fillStyle = c2; ctx.fillRect(36, 40, 22, 36);
      ctx.fillStyle = '#ffffff'; for (let y = 48; y < 74; y += 8) ctx.fillRect(15, y, 42, 3); ctx.restore();
      rr(ctx, 15, 42, 42, 32, 13); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke(); break;
    case 'samurai':
      rr(ctx, 10, 42, 16, 12, 4); fillStroke(ctx, shade(c1, 0.6), 3); rr(ctx, 46, 42, 16, 12, 4); fillStroke(ctx, shade(c1, 0.6), 3);
      ctx.strokeStyle = c2; ctx.lineWidth = 1.5; for (let y = 58; y < 72; y += 4) { ctx.beginPath(); ctx.moveTo(18, y); ctx.lineTo(54, y); ctx.stroke(); } break;
    case 'wizard':
      ctx.beginPath(); ctx.moveTo(15, 60); ctx.lineTo(57, 60); ctx.lineTo(60, 78); ctx.lineTo(12, 78); ctx.closePath(); fillStroke(ctx, c1, 3);
      for (const [x, y] of [[22, 52], [45, 58], [30, 70], [50, 47]]) star(ctx, x, y, 3.2, 1.4, c2); break;
    case 'hero':
      ctx.beginPath(); ctx.moveTo(36, 50); ctx.lineTo(44, 57); ctx.lineTo(36, 64); ctx.lineTo(28, 57); ctx.closePath(); fillStroke(ctx, c2, 2);
      ctx.fillStyle = c1; ctx.font = '800 6px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('KPI', 36, 57.5);
      rr(ctx, 15, 64, 42, 4, 2); fillStroke(ctx, c2, 1.5); break;
    case 'pilot':
      rr(ctx, 26, 41, 22, 8, 4); fillStroke(ctx, c2, 2);
      ctx.strokeStyle = shade(c1, 0.6); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(37, 50); ctx.lineTo(37, 73); ctx.stroke(); break;
    case 'pirate':
      ctx.save(); rr(ctx, 15, 42, 42, 32, 13); ctx.clip(); ctx.fillStyle = c2; for (let y = 46; y < 76; y += 8) ctx.fillRect(15, y, 42, 4); ctx.restore();
      rr(ctx, 15, 42, 42, 32, 13); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke(); break;
    case 'robotplate':
      rr(ctx, 24, 50, 24, 16, 3); fillStroke(ctx, c2, 2.5);
      for (const [x, col] of [[29, '#ff5d5d'], [36, '#4ee1a0'], [43, '#ffe36e']] as const) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, 58, 2.6, 0, Math.PI * 2); ctx.fill(); } break;
    case 'dinosuit':
      rr(ctx, 24, 50, 24, 20, 10); fillStroke(ctx, c2, 2);
      ctx.strokeStyle = shade(c1, 0.7); ctx.lineWidth = 1.5; for (let y = 54; y < 68; y += 4) { ctx.beginPath(); ctx.moveTo(27, y); ctx.lineTo(45, y); ctx.stroke(); } break;
    case 'guard': rr(ctx, 41, 50, 9, 10, 2); fillStroke(ctx, '#e8c547', 2); break;
  }
}

// ---------- Cổ ----------
function drawNeck(ctx: CanvasRenderingContext2D, id: string, [c1]: C2) {
  if (id === 'none') return;
  if (id === 'clip') { rr(ctx, 44, 50, 10, 12, 2); fillStroke(ctx, '#ffffff', 2); ctx.fillStyle = '#1f6feb'; ctx.fillRect(46, 52, 6, 2.5); ctx.fillStyle = '#9aa1b4'; ctx.fillRect(47, 48, 4, 4); return; }
  if (id === 'scarf') {
    rr(ctx, 26, 40, 22, 7, 3); fillStroke(ctx, c1, 2);
    ctx.beginPath(); ctx.moveTo(28, 45); ctx.quadraticCurveTo(16, 52, 8, 48); ctx.lineTo(10, 55); ctx.quadraticCurveTo(20, 57, 30, 48); ctx.closePath(); fillStroke(ctx, c1, 2); return;
  }
  if (id === 'bowtie') { for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(37, 45); ctx.lineTo(37 + 7 * s, 41); ctx.lineTo(37 + 7 * s, 49); ctx.closePath(); fillStroke(ctx, c1, 2); } ctx.beginPath(); ctx.arc(37, 45, 2, 0, Math.PI * 2); fillStroke(ctx, shade(c1, 0.8), 1.5); return; }
  if (id === 'necklace') { ctx.strokeStyle = c1; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(29, 44); ctx.quadraticCurveTo(37, 54, 45, 44); ctx.stroke(); ctx.beginPath(); ctx.arc(37, 51, 3, 0, Math.PI * 2); fillStroke(ctx, c1, 1.5); return; }
  const cord = id === 'vip' ? '#e8c547' : c1;
  ctx.lineWidth = 2.5;
  if (id === 'rainbow') {
    const cols = ['#e2412f', '#ff7a2f', '#f2b705', '#4fb86b', '#2e9cf0', '#8a4fd8'];
    for (let i = 0; i < 6; i++) { ctx.strokeStyle = cols[i]; ctx.beginPath(); const t0 = i / 6, t1 = (i + 1) / 6;
      ctx.moveTo(29 + 7 * t0, 44 + 12 * t0); ctx.lineTo(29 + 7 * t1, 44 + 12 * t1); ctx.moveTo(44 - 8 * t0, 44 + 12 * t0); ctx.lineTo(44 - 8 * t1, 44 + 12 * t1); ctx.stroke(); }
  } else { ctx.strokeStyle = cord; ctx.beginPath(); ctx.moveTo(29, 44); ctx.lineTo(36, 56); ctx.lineTo(44, 44); ctx.stroke(); }
  if (id === 'pins') for (const [x, y, col] of [[31, 48, '#ff5fa2'], [41, 48, '#ffe36e'], [33, 52, '#4ee1a0']] as const) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.stroke(); }
  rr(ctx, 30.5, 55, 11, 13, 2); fillStroke(ctx, id === 'vip' ? '#ffe36e' : '#ffffff', 2);
  ctx.fillStyle = id === 'vip' ? '#b8860b' : cord; ctx.fillRect(32.5, 57, 7, 3);
}

// ---------- Tay cầm ----------
function drawHand(ctx: CanvasRenderingContext2D, id: string, [c1]: C2) {
  switch (id) {
    case 'coffee':
      rr(ctx, 55, 61, 11, 13, 2); fillStroke(ctx, '#ffffff', 2); ctx.fillStyle = '#8a5a35'; ctx.fillRect(57, 63, 7, 3);
      ctx.strokeStyle = '#c9ccd8'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(59, 58); ctx.quadraticCurveTo(61, 55, 59, 52); ctx.stroke(); break;
    case 'laptop': rr(ctx, 50, 66, 20, 12, 2); fillStroke(ctx, '#c9ccd8', 2); ctx.fillStyle = '#5fb8ff'; ctx.fillRect(53, 68, 14, 7); break;
    case 'clipboard':
      rr(ctx, 55, 56, 14, 18, 2); fillStroke(ctx, '#c79a62', 2.5);
      ctx.fillStyle = '#ffe36e'; ctx.fillRect(57, 60, 5, 5); ctx.fillStyle = '#ff9ec4'; ctx.fillRect(63, 61, 5, 5); ctx.fillStyle = '#9fe0ff'; ctx.fillRect(58, 67, 5, 5); break;
    case 'bottle': rr(ctx, 56, 55, 9, 20, 4); fillStroke(ctx, c1, 2); rr(ctx, 57, 51, 7, 5, 2); fillStroke(ctx, '#2d3142', 1.5); break;
    case 'wand': ctx.save(); ctx.translate(58, 70); ctx.rotate(-0.7); rr(ctx, -2, -18, 4, 22, 2); fillStroke(ctx, '#5a3a1f', 2); ctx.restore(); star(ctx, 70, 57, 4, 1.8, '#ffe36e'); break;
    case 'mic': ctx.save(); ctx.translate(58, 68); ctx.rotate(-0.3); rr(ctx, -2.5, -4, 5, 12, 2); fillStroke(ctx, '#2b2b33', 2); ctx.beginPath(); ctx.arc(0, -6, 4.5, 0, Math.PI * 2); fillStroke(ctx, c1, 2); ctx.restore(); break;
    case 'hook': ctx.strokeStyle = '#9aa1b4'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(58, 74, 5, Math.PI * 0.2, Math.PI * 1.4); ctx.stroke(); break;
    case 'whip': ctx.save(); ctx.translate(58, 72); ctx.rotate(0.6); rr(ctx, -1.5, -20, 3, 22, 1.5); fillStroke(ctx, '#3b2a20', 1.5); ctx.restore(); break;
    case 'bokken': ctx.save(); ctx.translate(57, 72); ctx.rotate(-0.4); rr(ctx, -2.5, -30, 5, 34, 2); fillStroke(ctx, '#b07a4b', 2); ctx.fillStyle = INK; ctx.fillRect(-3.5, -2, 7, 3); ctx.restore(); break;
    case 'shuriken': ctx.strokeStyle = '#9aa1b4'; ctx.lineWidth = 2.5; rr(ctx, 56, 62, 6, 11, 3); ctx.stroke(); rr(ctx, 58, 64, 3, 7, 1.5); ctx.stroke(); break;
  }
}

// ---------- Đầu theo cơ thể ----------
function drawHead(ctx: CanvasRenderingContext2D, L: Look) {
  const [c1, c2] = colors2(L.bodyColor);
  switch (L.body) {
    case 'cat':
      for (const [x1, x2, x3] of [[20, 24, 32], [44, 52, 56]]) { ctx.beginPath(); ctx.moveTo(x1, 16); ctx.lineTo(x2, 2); ctx.lineTo(x3, 12); ctx.closePath(); fillStroke(ctx, c1, 3); }
      ctx.beginPath(); ctx.arc(38, 27, 19, 0, Math.PI * 2); fillStroke(ctx, c1);
      ctx.fillStyle = '#ff9ec4'; ctx.beginPath(); ctx.moveTo(51, 33); ctx.lineTo(55, 33); ctx.lineTo(53, 35.5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2; for (const dy of [-1.5, 1.5]) { ctx.beginPath(); ctx.moveTo(55, 34 + dy); ctx.lineTo(63, 33 + dy * 2); ctx.stroke(); }
      return;
    case 'frog':
      ctx.beginPath(); ctx.ellipse(38, 30, 22, 16, 0, 0, Math.PI * 2); fillStroke(ctx, c1);
      for (const x of [43, 54]) { ctx.beginPath(); ctx.arc(x, 15, 7, 0, Math.PI * 2); fillStroke(ctx, c1, 3); ctx.beginPath(); ctx.arc(x, 15, 4.5, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); }
      ctx.fillStyle = shade(c1, 0.8); ctx.beginPath(); ctx.arc(28, 33, 2, 0, Math.PI * 2); ctx.arc(33, 39, 1.6, 0, Math.PI * 2); ctx.fill();
      return;
    case 'robot':
      rr(ctx, 19, 9, 38, 36, 8); fillStroke(ctx, c1);
      ctx.fillStyle = INK; rr(ctx, 39, 22, 18, 10, 3); ctx.fill();
      ctx.fillStyle = c2; ctx.fillRect(42, 25, 4, 4); ctx.fillRect(50, 25, 4, 4);
      ctx.strokeStyle = shade(c1, 0.6); ctx.lineWidth = 1.5; for (let x = 42; x <= 54; x += 3) { ctx.beginPath(); ctx.moveTo(x, 37); ctx.lineTo(x, 41); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(24, 27, 3, 0, Math.PI * 2); fillStroke(ctx, shade(c1, 0.8), 2);
      return;
    case 'alien':
      ctx.beginPath(); ctx.ellipse(38, 24, 19, 22, 0, 0, Math.PI * 2); fillStroke(ctx, c1);
      return;
    case 'ghost':
      ctx.beginPath(); ctx.arc(38, 27, 19, 0, Math.PI * 2); fillStroke(ctx, c1);
      ctx.fillStyle = c2; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.ellipse(41, 36, 3.5, 2.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      return;
    case 'cactus':
      rr(ctx, 20, 8, 36, 38, 16); fillStroke(ctx, c1);
      ctx.fillStyle = shade(c1, 1.4); for (const [x, y] of [[26, 16], [32, 12], [46, 14], [52, 20], [24, 38], [30, 42]]) { ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI * 2); ctx.fill(); }
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; ctx.beginPath(); ctx.arc(38 + Math.cos(a) * 4, 6 + Math.sin(a) * 4, 3, 0, Math.PI * 2); fillStroke(ctx, c2, 1.5); }
      ctx.beginPath(); ctx.arc(38, 6, 2.2, 0, Math.PI * 2); ctx.fillStyle = '#ffe36e'; ctx.fill();
      return;
    case 'coffee':
      ctx.beginPath(); ctx.ellipse(20, 26, 7, 10, 0, 0, Math.PI * 2); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(19, 9); ctx.lineTo(57, 9); ctx.lineTo(53, 46); ctx.lineTo(23, 46); ctx.closePath(); fillStroke(ctx, c1);
      ctx.beginPath(); ctx.ellipse(38, 10, 18, 4, 0, 0, Math.PI * 2); fillStroke(ctx, c2, 2.5);
      ctx.strokeStyle = '#c9ccd8'; ctx.lineWidth = 2; for (const x of [32, 42]) { ctx.beginPath(); ctx.moveTo(x, 4); ctx.quadraticCurveTo(x + 3, 0, x, -5); ctx.stroke(); }
      return;
    case 'toast':
      rr(ctx, 17, 6, 42, 40, 14); fillStroke(ctx, c2);
      rr(ctx, 22, 11, 32, 30, 10); ctx.fillStyle = c1; ctx.fill();
      return;
    case 'plant':
      for (const [x, y, r, a] of [[30, 6, 8, -0.6], [46, 4, 9, 0.5], [38, -2, 7, 0]] as const) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, 0, r * 0.6, r, 0, 0, Math.PI * 2); fillStroke(ctx, c2, 2.5); ctx.restore(); }
      ctx.beginPath(); ctx.moveTo(18, 12); ctx.lineTo(58, 12); ctx.lineTo(53, 46); ctx.lineTo(23, 46); ctx.closePath(); fillStroke(ctx, c1);
      rr(ctx, 16, 10, 44, 7, 3); fillStroke(ctx, shade(c1, 0.85), 3);
      return;
    case 'slime':
      ctx.globalAlpha = 0.88;
      ctx.beginPath(); ctx.moveTo(19, 40); ctx.quadraticCurveTo(14, 8, 38, 8); ctx.quadraticCurveTo(62, 8, 57, 40); ctx.quadraticCurveTo(54, 50, 50, 44); ctx.quadraticCurveTo(44, 50, 38, 44); ctx.quadraticCurveTo(28, 52, 24, 44); ctx.closePath(); fillStroke(ctx, c1);
      ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(28, 16, 5, 3, -0.5, 0, Math.PI * 2); ctx.fill();
      return;
  }
  ctx.beginPath(); ctx.arc(38, 27, 19, 0, Math.PI * 2); fillStroke(ctx, c1);
}

function drawFaceFeatures(ctx: CanvasRenderingContext2D, L: Look) {
  if (L.body === 'robot') return;
  ctx.fillStyle = INK;
  if (L.body === 'frog') { ctx.beginPath(); ctx.arc(44, 15, 2.6, 0, Math.PI * 2); ctx.arc(55, 15, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(40, 36); ctx.quadraticCurveTo(50, 41, 58, 34); ctx.stroke(); return; }
  if (L.body === 'alien') { for (const x of [44, 53]) { ctx.save(); ctx.translate(x, 25); ctx.rotate(0.35); ctx.beginPath(); ctx.ellipse(0, 0, 3.5, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); } ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(47, 37); ctx.lineTo(52, 37); ctx.stroke(); return; }
  ctx.beginPath(); ctx.ellipse(44, 28, 2.6, 3.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(52, 28, 2.6, 3.4, 0, 0, Math.PI * 2); ctx.fill();
  if (L.body === 'human' || L.body === 'cat') {
    ctx.fillStyle = L.marks.includes('blush') ? 'rgba(255,80,110,0.65)' : 'rgba(255,120,120,0.45)';
    ctx.beginPath(); ctx.ellipse(41, 35, 3.5, 2.2, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(46, 37); ctx.quadraticCurveTo(49, 38.5, 52, 36.5); ctx.stroke();
}

function drawMarks(ctx: CanvasRenderingContext2D, L: Look) {
  if (!['human', 'cat', 'alien', 'frog'].includes(L.body)) return;
  const m = L.marks;
  if (m.includes('freckles')) { ctx.fillStyle = 'rgba(140,80,40,0.7)'; for (const [x, y] of [[39, 32], [42, 31], [40.5, 34], [50, 32], [53, 33]]) { ctx.beginPath(); ctx.arc(x, y, 0.9, 0, Math.PI * 2); ctx.fill(); } }
  if (m.includes('mole')) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(53, 38, 1.1, 0, Math.PI * 2); ctx.fill(); }
  if (m.includes('scar')) { ctx.strokeStyle = '#b5524a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(36, 27); ctx.lineTo(39, 36); ctx.stroke(); ctx.lineWidth = 1; for (const t of [0.3, 0.6]) { ctx.beginPath(); ctx.moveTo(36 + 3 * t - 2, 27 + 9 * t); ctx.lineTo(36 + 3 * t + 2, 27 + 9 * t - 1); ctx.stroke(); } }
  if (m.includes('bandaid')) { ctx.save(); ctx.translate(40, 33); ctx.rotate(-0.5); rr(ctx, -5, -2, 10, 4, 2); fillStroke(ctx, '#f2c9a0', 1.2); ctx.restore(); }
}

// ---------- Phụ kiện đầu, mắt, tai, mặt ----------
function drawHeadItem(ctx: CanvasRenderingContext2D, id: string, [c1, c2]: C2) {
  switch (id) {
    case 'cap':
      ctx.beginPath(); ctx.moveTo(19, 22); ctx.quadraticCurveTo(20, 4, 38, 5); ctx.quadraticCurveTo(56, 5, 56, 20); ctx.closePath(); fillStroke(ctx, c1, 3);
      rr(ctx, 8, 17, 16, 6, 3); fillStroke(ctx, c1, 3); break;
    case 'beret': ctx.save(); ctx.translate(40, 9); ctx.rotate(-0.25); ctx.beginPath(); ctx.ellipse(0, 0, 18, 7, 0, 0, Math.PI * 2); fillStroke(ctx, c1, 3); ctx.beginPath(); ctx.arc(2, -7, 2.5, 0, Math.PI * 2); fillStroke(ctx, c1, 2); ctx.restore(); break;
    case 'beanie':
      ctx.beginPath(); ctx.moveTo(18, 20); ctx.quadraticCurveTo(20, 2, 38, 2); ctx.quadraticCurveTo(56, 2, 58, 20); ctx.closePath(); fillStroke(ctx, c1, 3);
      rr(ctx, 16, 15, 44, 7, 3); fillStroke(ctx, shade(c1, 0.8), 3); ctx.beginPath(); ctx.arc(38, 0, 4.5, 0, Math.PI * 2); fillStroke(ctx, '#ffffff', 2); break;
    case 'headband':
      ctx.save(); ctx.beginPath(); ctx.arc(38, 27, 19, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = c1; ctx.fillRect(15, 13, 46, 6); ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(20, 13); ctx.lineTo(57, 13); ctx.moveTo(19, 19); ctx.lineTo(57, 19); ctx.stroke(); break;
    case 'ninjaband':
      // dải vải buộc trán, nút phía sau với hai đuôi vải bay ra
      ctx.save(); ctx.beginPath(); ctx.arc(38, 27, 19.5, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = c1; ctx.fillRect(15, 12, 46, 7); ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(20, 12); ctx.lineTo(57, 12); ctx.moveTo(19, 19); ctx.lineTo(57.5, 19); ctx.stroke();
      ctx.beginPath(); ctx.arc(19, 16, 3.2, 0, Math.PI * 2); fillStroke(ctx, c1, 2);
      for (const [ex, ey] of [[6, 12], [8, 24]]) { ctx.beginPath(); ctx.moveTo(18, 15); ctx.quadraticCurveTo(12, ey - 2, ex, ey); ctx.lineTo(ex + 2, ey + 4); ctx.quadraticCurveTo(13, ey + 2, 18, 18); ctx.closePath(); fillStroke(ctx, c1, 2); }
      break;
    case 'bow':
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(26, 9); ctx.lineTo(26 + 10 * s, 3); ctx.lineTo(26 + 10 * s, 15); ctx.closePath(); fillStroke(ctx, c1, 2.5); }
      ctx.beginPath(); ctx.arc(26, 9, 3, 0, Math.PI * 2); fillStroke(ctx, shade(c1, 1.2), 2); break;
    case 'pencil':
      ctx.save(); ctx.translate(24, 22); ctx.rotate(-0.6); rr(ctx, -2.5, -12, 5, 22, 1.5); fillStroke(ctx, '#f2b705', 2);
      ctx.fillStyle = '#f6d0ae'; ctx.beginPath(); ctx.moveTo(-2.5, 10); ctx.lineTo(2.5, 10); ctx.lineTo(0, 15); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); break;
    case 'horseears':
      for (const [x, a] of [[30, -0.25], [47, 0.25]] as const) {
        ctx.save(); ctx.translate(x, 9); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(-5, 4); ctx.quadraticCurveTo(-4, -12, 0, -16); ctx.quadraticCurveTo(4, -12, 5, 4); ctx.closePath(); fillStroke(ctx, c1, 2.5);
        ctx.beginPath(); ctx.moveTo(-2.5, 2); ctx.quadraticCurveTo(-2, -8, 0, -11); ctx.quadraticCurveTo(2, -8, 2.5, 2); ctx.closePath(); ctx.fillStyle = '#ffb3c7'; ctx.fill();
        ctx.restore();
      }
      break;
    case 'ninjahood':
      ctx.beginPath(); ctx.arc(38, 27, 20.5, Math.PI * 1.02, Math.PI * 1.98); ctx.lineTo(58, 22); ctx.lineTo(18, 22); ctx.closePath(); fillStroke(ctx, c1, 3.5);
      ctx.beginPath(); ctx.moveTo(19, 16); ctx.quadraticCurveTo(8, 18, 4, 28); ctx.quadraticCurveTo(12, 22, 20, 21); ctx.closePath(); fillStroke(ctx, c2, 2); break;
    case 'wizardhat':
      ctx.beginPath(); ctx.moveTo(16, 16); ctx.lineTo(60, 16); ctx.lineTo(42, -12); ctx.closePath(); fillStroke(ctx, c1, 3.5);
      rr(ctx, 14, 13, 48, 6, 3); fillStroke(ctx, c1, 3); star(ctx, 40, 3, 3.5, 1.5, c2); break;
    case 'jockeyhelmet':
      ctx.beginPath(); ctx.arc(38, 22, 19, Math.PI, Math.PI * 2); ctx.closePath(); fillStroke(ctx, c1, 3.5);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(38, 4); ctx.lineTo(38, 22); ctx.stroke();
      rr(ctx, 50, 19, 14, 4, 2); fillStroke(ctx, '#2b2b33', 2); break;
    case 'piratehat':
      ctx.beginPath(); ctx.moveTo(14, 14); ctx.quadraticCurveTo(38, -10, 62, 14); ctx.quadraticCurveTo(38, 6, 14, 14); ctx.closePath(); fillStroke(ctx, c1, 3);
      ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(38, 7, 2.6, 0, Math.PI * 2); ctx.fill(); break;
    case 'antenna':
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(38, 8); ctx.lineTo(38, -4); ctx.stroke();
      ctx.beginPath(); ctx.arc(38, -5, 3.5, 0, Math.PI * 2); fillStroke(ctx, '#ff5d5d', 2); break;
    case 'goggles':
      for (const x of [34, 46]) { ctx.beginPath(); ctx.arc(x, 12, 5, 0, Math.PI * 2); fillStroke(ctx, '#9fd6ff', 2.5); }
      ctx.strokeStyle = '#6b4426'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(29, 12); ctx.lineTo(20, 14); ctx.stroke(); break;
    case 'guardcap':
      ctx.beginPath(); ctx.moveTo(19, 20); ctx.quadraticCurveTo(22, 4, 38, 4); ctx.quadraticCurveTo(54, 4, 56, 20); ctx.closePath(); fillStroke(ctx, '#26283a', 3);
      rr(ctx, 40, 16, 24, 6, 3); fillStroke(ctx, '#1a1b28', 3); ctx.fillStyle = '#e8c547'; ctx.beginPath(); ctx.arc(38, 11, 3, 0, Math.PI * 2); ctx.fill(); break;
  }
}

function drawDinoHoodBack(ctx: CanvasRenderingContext2D, [c1]: C2) { ctx.beginPath(); ctx.arc(38, 26, 24, 0, Math.PI * 2); fillStroke(ctx, c1, 3.5); }
function drawDinoHoodTeeth(ctx: CanvasRenderingContext2D, [, c2]: C2) {
  ctx.fillStyle = c2;
  for (let i = 0; i < 6; i++) { const a = Math.PI * (1.15 + i * 0.13); const x = 38 + Math.cos(a) * 19, y = 26 + Math.sin(a) * 19; ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y); ctx.lineTo(x, y + 5); ctx.closePath(); ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke(); }
}

function drawEyesItem(ctx: CanvasRenderingContext2D, id: string, [c1]: C2) {
  switch (id) {
    case 'glasses': case 'bigglasses': case 'roundglasses': {
      const r = id === 'bigglasses' ? 7 : id === 'roundglasses' ? 5.5 : 5;
      ctx.strokeStyle = c1; ctx.lineWidth = id === 'bigglasses' ? 3.5 : id === 'roundglasses' ? 1.8 : 2.5;
      ctx.fillStyle = 'rgba(200,230,255,0.35)';
      ctx.beginPath(); ctx.arc(44, 28, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(54, 28, r - 1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(44 - r, 27); ctx.lineTo(24, 25); ctx.stroke(); break;
    }
    case 'shades':
      rr(ctx, 38, 24, 11, 8, 3); fillStroke(ctx, c1, 2); rr(ctx, 50, 24, 9, 8, 3); fillStroke(ctx, c1, 2);
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(38, 27); ctx.lineTo(24, 25); ctx.stroke(); break;
    case 'eyepatch':
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(52, 28, 4.5, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(48, 26); ctx.lineTo(24, 20); ctx.stroke(); break;
    case 'heromask':
      rr(ctx, 39, 24, 19, 8, 3); fillStroke(ctx, c1, 1); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(44, 28, 1.6, 0, Math.PI * 2); ctx.arc(52, 28, 1.6, 0, Math.PI * 2); ctx.fill(); break;
  }
}

function drawEarsItem(ctx: CanvasRenderingContext2D, id: string, [c1]: C2) {
  switch (id) {
    case 'headphones':
      ctx.strokeStyle = c1; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.arc(37, 26, 21, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(26, 29, 6, 8, 0, 0, Math.PI * 2); fillStroke(ctx, c1, 3);
      ctx.fillStyle = '#4ee1a0'; ctx.beginPath(); ctx.arc(26, 29, 2, 0, Math.PI * 2); ctx.fill(); break;
    case 'headset':
      ctx.strokeStyle = c1; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(37, 26, 21, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(27, 30, 5, 7, 0, 0, Math.PI * 2); fillStroke(ctx, c1, 3);
      ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(29, 35); ctx.quadraticCurveTo(34, 44, 45, 41); ctx.stroke();
      ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(46, 41, 2.5, 0, Math.PI * 2); ctx.fill(); break;
    case 'earbuds':
      ctx.beginPath(); ctx.arc(27, 31, 3.2, 0, Math.PI * 2); fillStroke(ctx, '#ffffff', 2);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(27, 34); ctx.lineTo(28, 40); ctx.stroke(); break;
  }
}

function drawFaceItem(ctx: CanvasRenderingContext2D, id: string, [c1]: C2, hair: string) {
  switch (id) {
    case 'mask': rr(ctx, 39, 31, 19, 12, 4); fillStroke(ctx, c1, 2.5); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(39, 34); ctx.lineTo(27, 30); ctx.stroke(); break;
    case 'mustache': ctx.fillStyle = hair; ctx.beginPath(); ctx.moveTo(44, 34.5); ctx.quadraticCurveTo(49, 31, 55, 35); ctx.quadraticCurveTo(49, 33.5, 44, 36.5); ctx.closePath(); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke(); break;
    case 'beard': ctx.fillStyle = hair; ctx.beginPath(); ctx.moveTo(24, 30); ctx.quadraticCurveTo(27, 48, 42, 46); ctx.quadraticCurveTo(54, 45, 57, 33); ctx.quadraticCurveTo(50, 41, 46, 40); ctx.quadraticCurveTo(36, 42, 30, 32); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); break;
    case 'ninjamask': rr(ctx, 26, 33, 33, 13, 6); fillStroke(ctx, c1, 3); break;
  }
}

// ---------- Skin trọn người (không mặc đồ của người) ----------
function stickLimbs(ctx: CanvasRenderingContext2D, frame: 0 | 1 | 2, col: string, armY = 52) {
  const lUp = frame === 1 ? 4 : 0, rUp = frame === 2 ? 4 : 0;
  ctx.strokeStyle = INK; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(29, 66); ctx.lineTo(28, 82 - lUp); ctx.moveTo(44, 66); ctx.lineTo(45, 82 - rUp); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(29, 66); ctx.lineTo(28, 82 - lUp); ctx.moveTo(44, 66); ctx.lineTo(45, 82 - rUp); ctx.stroke();
  for (const [x, up] of [[28, lUp], [45, rUp]]) { rr(ctx, x - 6, 81 - up, 12, 5, 2.5); fillStroke(ctx, INK, 1); }
  return () => { // tay que vẽ sau thân
    ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(56, armY); ctx.lineTo(63, armY + 14); ctx.moveTo(18, armY); ctx.lineTo(11, armY + 14); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(56, armY); ctx.lineTo(63, armY + 14); ctx.moveTo(18, armY); ctx.lineTo(11, armY + 14); ctx.stroke();
    for (const x of [63, 11]) { ctx.beginPath(); ctx.arc(x, armY + 15, 3.5, 0, Math.PI * 2); fillStroke(ctx, '#ffffff', 2); }
  };
}

function drawSkinFull(ctx: CanvasRenderingContext2D, L: Look, frame: 0 | 1 | 2) {
  const [c1, c2] = colors2(L.bodyColor);
  const bob = frame === 0 ? 0 : -2;
  const lUp = frame === 1 ? 4 : 0, rUp = frame === 2 ? 4 : 0;
  const legs = (col: string, foot: string) => {
    rr(ctx, 22, 66 - lUp, 12, 17, 5); fillStroke(ctx, col); rr(ctx, 38, 66 - rUp, 12, 17, 5); fillStroke(ctx, col);
    rr(ctx, 21, 79 - lUp, 15, 6, 3); fillStroke(ctx, foot, 2); rr(ctx, 37, 79 - rUp, 15, 6, 3); fillStroke(ctx, foot, 2);
  };
  const torso = (col: string, belly?: string) => {
    rr(ctx, 12, 50, 10, 20, 5); fillStroke(ctx, col);
    rr(ctx, 15, 42, 42, 32, 13); fillStroke(ctx, col);
    if (belly) { ctx.beginPath(); ctx.ellipse(37, 60, 11, 10, 0, 0, Math.PI * 2); ctx.fillStyle = belly; ctx.fill(); }
  };
  const frontArm = (col: string, hand = col) => { rr(ctx, 50, 50, 10, 20, 5); fillStroke(ctx, col); ctx.beginPath(); ctx.arc(55, 71, 4.5, 0, Math.PI * 2); fillStroke(ctx, hand, 2.5); };
  switch (L.body) {
    case 'cat': {
      const belly = shade(c1, 1.25);
      legs(c1, belly);
      ctx.translate(0, bob);
      ctx.beginPath(); ctx.moveTo(18, 64); ctx.quadraticCurveTo(0, 62, 4, 44); ctx.quadraticCurveTo(8, 40, 10, 46); ctx.quadraticCurveTo(8, 58, 22, 60); ctx.closePath(); fillStroke(ctx, c1, 3);
      torso(c1, belly); frontArm(c1, belly);
      drawHead(ctx, L); drawFaceFeatures(ctx, L);
      return;
    }
    case 'frog': {
      const belly = shade(c1, 1.35);
      legs(c1, c1);
      for (const [x, up] of [[21, lUp], [37, rUp]]) { ctx.fillStyle = shade(c1, 0.8); for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(x + 3 + k * 5, 85 - up, 2.5, 0, Math.PI * 2); ctx.fill(); } }
      ctx.translate(0, bob);
      torso(c1, belly); frontArm(c1);
      drawHead(ctx, L); drawFaceFeatures(ctx, L);
      return;
    }
    case 'robot': {
      legs(c1, shade(c1, 0.6));
      for (const [x, up] of [[28, lUp], [44, rUp]]) { ctx.beginPath(); ctx.arc(x, 72 - up, 3, 0, Math.PI * 2); fillStroke(ctx, c2, 1.5); }
      ctx.translate(0, bob);
      rr(ctx, 12, 50, 10, 20, 3); fillStroke(ctx, c1);
      rr(ctx, 15, 42, 42, 32, 6); fillStroke(ctx, c1);
      rr(ctx, 24, 50, 24, 16, 3); fillStroke(ctx, '#2d3142', 2.5);
      for (const [x, col] of [[29, c2], [36, '#4ee1a0'], [43, '#ffe36e']] as [number, string][]) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, 58, 2.6, 0, Math.PI * 2); ctx.fill(); }
      rr(ctx, 50, 50, 10, 20, 3); fillStroke(ctx, c1); ctx.beginPath(); ctx.arc(55, 71, 4.5, 0, Math.PI * 2); fillStroke(ctx, shade(c1, 0.7), 2.5);
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(38, 9); ctx.lineTo(38, -3); ctx.stroke();
      ctx.beginPath(); ctx.arc(38, -4, 3.5, 0, Math.PI * 2); fillStroke(ctx, c2, 2);
      drawHead(ctx, L);
      return;
    }
    case 'alien': {
      legs(c1, shade(c1, 0.7));
      ctx.translate(0, bob);
      torso(c1);
      ctx.fillStyle = shade(c1, 0.8); for (const [x, y, r] of [[24, 52, 2.5], [44, 64, 3], [30, 66, 2]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      frontArm(c1);
      for (const [x, a] of [[30, -0.3], [46, 0.3]] as const) { ctx.save(); ctx.translate(x, 6); ctx.rotate(a); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, -8); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -10, 3, 0, Math.PI * 2); fillStroke(ctx, c1, 2); ctx.restore(); }
      drawHead(ctx, L); drawFaceFeatures(ctx, L);
      return;
    }
    case 'ghost': {
      // con ma chỉ bay lơ lửng (xử lý ở cảnh), hình vẽ đứng yên
      ctx.beginPath(); ctx.moveTo(14, 40); ctx.quadraticCurveTo(14, 6, 38, 6); ctx.quadraticCurveTo(62, 6, 60, 40);
      ctx.lineTo(60, 80); ctx.quadraticCurveTo(54, 74, 50, 82); ctx.quadraticCurveTo(44, 74, 38, 82); ctx.quadraticCurveTo(32, 74, 26, 82); ctx.quadraticCurveTo(20, 74, 14, 82); ctx.closePath();
      fillStroke(ctx, c1, 3.5);
      ctx.fillStyle = c2; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.ellipse(46, 36, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      for (const [x, a] of [[60, 0.5], [14, -0.5]] as const) { ctx.save(); ctx.translate(x, 50); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, 0, 4, 8, 0, 0, Math.PI * 2); fillStroke(ctx, c1, 2.5); ctx.restore(); }
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(44, 26, 3, 4.5, 0, 0, Math.PI * 2); ctx.ellipse(53, 26, 3, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(49, 34, 2.5, 3, 0, 0, Math.PI * 2); ctx.fill();
      return;
    }
    case 'cactus': {
      const arms = stickLimbs(ctx, frame, shade(c1, 0.8));
      ctx.translate(0, bob);
      rr(ctx, 20, 8, 36, 62, 16); fillStroke(ctx, c1);
      for (const [x1, s] of [[20, -1], [56, 1]] as const) { ctx.beginPath(); ctx.moveTo(x1, 50); ctx.lineTo(x1 + 8 * s, 50); ctx.quadraticCurveTo(x1 + 12 * s, 50, x1 + 12 * s, 44); ctx.lineTo(x1 + 12 * s, 34); ctx.lineTo(x1 + 6 * s, 34); ctx.lineTo(x1 + 6 * s, 44); ctx.lineTo(x1, 44); ctx.closePath(); fillStroke(ctx, c1, 3); }
      ctx.fillStyle = shade(c1, 1.4); for (const [x, y] of [[26, 16], [32, 12], [46, 14], [52, 20], [26, 52], [32, 60], [48, 56], [44, 66]]) { ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI * 2); ctx.fill(); }
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; ctx.beginPath(); ctx.arc(38 + Math.cos(a) * 4, 6 + Math.sin(a) * 4, 3, 0, Math.PI * 2); fillStroke(ctx, c2, 1.5); }
      ctx.beginPath(); ctx.arc(38, 6, 2.2, 0, Math.PI * 2); ctx.fillStyle = '#ffe36e'; ctx.fill();
      void arms; drawFaceFeatures(ctx, L);
      return;
    }
    case 'shark': case 'penguin': case 'panda': case 'shiba': case 'duck': {
      const B = L.body;
      const limb = B === 'panda' ? '#2b2b38' : c1;
      const foot = B === 'penguin' || B === 'duck' ? '#ff8a2f' : B === 'panda' ? '#2b2b38' : B === 'shiba' ? c2 : c2;
      legs(limb, foot);
      ctx.translate(0, bob);
      if (B === 'shark') { ctx.beginPath(); ctx.moveTo(18, 62); ctx.lineTo(2, 54); ctx.lineTo(6, 66); ctx.lineTo(2, 78); ctx.lineTo(20, 70); ctx.closePath(); fillStroke(ctx, c1, 3); }
      if (B === 'shiba') { ctx.beginPath(); ctx.arc(14, 52, 7, 0.3, Math.PI * 1.9); ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 5.5; ctx.strokeStyle = c1; ctx.stroke(); }
      const torsoC = B === 'panda' ? '#ffffff' : c1;
      rr(ctx, 12, 50, 10, 20, 5); fillStroke(ctx, limb);
      if (B === 'duck') { ctx.beginPath(); ctx.ellipse(36, 58, 23, 18, 0, 0, Math.PI * 2); fillStroke(ctx, c1); }
      else { rr(ctx, 15, 42, 42, 32, 13); fillStroke(ctx, torsoC); }
      if (B !== 'panda' && B !== 'duck') { ctx.beginPath(); ctx.ellipse(38, 60, 12, 12, 0, 0, Math.PI * 2); ctx.fillStyle = c2; ctx.fill(); }
      if (B === 'panda') { rr(ctx, 15, 42, 42, 9, 6); ctx.fillStyle = '#2b2b38'; ctx.fill(); }
      if (B === 'shark') { ctx.strokeStyle = shade(c1, 0.7); ctx.lineWidth = 1.8; for (const y of [48, 52, 56]) { ctx.beginPath(); ctx.moveTo(48, y); ctx.lineTo(52, y + 2); ctx.stroke(); } }
      // tay / vây / cánh
      if (B === 'penguin' || B === 'duck') { ctx.beginPath(); ctx.ellipse(54, 60, 6, 12, -0.3, 0, Math.PI * 2); fillStroke(ctx, c1, 3); }
      else if (B === 'shark') { ctx.beginPath(); ctx.moveTo(50, 52); ctx.lineTo(64, 66); ctx.lineTo(52, 66); ctx.closePath(); fillStroke(ctx, c1, 3); }
      else { rr(ctx, 50, 50, 10, 20, 5); fillStroke(ctx, limb); ctx.beginPath(); ctx.arc(55, 71, 4.5, 0, Math.PI * 2); fillStroke(ctx, B === 'shiba' ? c2 : limb, 2.5); }
      // đầu
      if (B === 'shark') {
        ctx.beginPath(); ctx.moveTo(30, 12); ctx.lineTo(38, -4); ctx.lineTo(44, 12); ctx.closePath(); fillStroke(ctx, c1, 3);
        ctx.beginPath(); ctx.ellipse(39, 28, 21, 18, 0, 0, Math.PI * 2); fillStroke(ctx, c1);
        ctx.beginPath(); ctx.ellipse(44, 36, 14, 7, 0, 0, Math.PI); ctx.fillStyle = c2; ctx.fill();
        ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(47, 23, 2.6, 3.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; for (let x = 36; x < 56; x += 4) { ctx.beginPath(); ctx.moveTo(x, 36); ctx.lineTo(x + 2, 40); ctx.lineTo(x + 4, 36); ctx.closePath(); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.stroke(); }
        ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(34, 36); ctx.quadraticCurveTo(46, 41, 58, 34); ctx.stroke();
        return;
      }
      if (B === 'penguin') {
        ctx.beginPath(); ctx.arc(38, 27, 19, 0, Math.PI * 2); fillStroke(ctx, c1);
        ctx.beginPath(); ctx.ellipse(46, 30, 11, 12, 0, 0, Math.PI * 2); ctx.fillStyle = c2; ctx.fill();
        ctx.beginPath(); ctx.moveTo(52, 31); ctx.lineTo(62, 33); ctx.lineTo(52, 36); ctx.closePath(); fillStroke(ctx, '#ff8a2f', 2);
        ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(46, 25, 2.4, 3, 0, 0, Math.PI * 2); ctx.ellipse(53, 25, 2.2, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,120,120,0.45)'; ctx.beginPath(); ctx.ellipse(42, 32, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
        return;
      }
      if (B === 'duck') {
        ctx.beginPath(); ctx.arc(40, 24, 17, 0, Math.PI * 2); fillStroke(ctx, c1);
        ctx.beginPath(); ctx.ellipse(56, 30, 9, 5, 0.1, 0, Math.PI * 2); fillStroke(ctx, c2, 2.5);
        ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(47, 20, 2.6, 3.3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(46.3, 19, 1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,120,120,0.45)'; ctx.beginPath(); ctx.ellipse(43, 28, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
        return;
      }
      if (B === 'panda') {
        for (const x of [24, 50]) { ctx.beginPath(); ctx.arc(x, 11, 6.5, 0, Math.PI * 2); fillStroke(ctx, '#2b2b38', 3); }
        ctx.beginPath(); ctx.arc(38, 27, 19, 0, Math.PI * 2); fillStroke(ctx, '#ffffff');
        ctx.fillStyle = '#2b2b38'; for (const x of [44, 53]) { ctx.save(); ctx.translate(x, 28); ctx.rotate(-0.4); ctx.beginPath(); ctx.ellipse(0, 0, 4, 5.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(44.5, 27, 1.6, 0, Math.PI * 2); ctx.arc(53.5, 27, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2b2b38'; ctx.beginPath(); ctx.ellipse(51, 35, 2.4, 1.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(47, 39); ctx.quadraticCurveTo(50, 40.5, 53, 38.5); ctx.stroke();
        return;
      }
      // shiba
      for (const [x1, x2, x3] of [[20, 24, 32], [44, 52, 56]]) { ctx.beginPath(); ctx.moveTo(x1, 16); ctx.lineTo(x2, 1); ctx.lineTo(x3, 12); ctx.closePath(); fillStroke(ctx, c1, 3); }
      ctx.beginPath(); ctx.arc(38, 27, 19, 0, Math.PI * 2); fillStroke(ctx, c1);
      ctx.beginPath(); ctx.ellipse(48, 34, 11, 8, 0, 0, Math.PI * 2); ctx.fillStyle = c2; ctx.fill();
      ctx.fillStyle = c2; for (const x of [42, 52]) { ctx.beginPath(); ctx.ellipse(x, 22, 2.5, 1.6, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(44, 27, 2.4, 3, 0, 0, Math.PI * 2); ctx.ellipse(52, 27, 2.4, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(56, 33, 2.4, 1.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(49, 38); ctx.quadraticCurveTo(52, 40, 55, 37); ctx.stroke();
      return;
    }
    // Gấu trắng (thiết kế riêng của game): mõm kem, mũi đen, tai tròn có lòng hồng
    case 'bearrain': case 'bearflower': {
      const fur = '#fbfbf7', cream = '#efe6d2', rain = '#ffd23f', rainDk = '#e0a800';
      const B = L.body;
      if (B === 'bearrain') legs(rain, rainDk); else legs(fur, cream);
      ctx.translate(0, bob);
      const head = (cx: number, cy: number, r: number, ears: boolean) => {
        if (ears) for (const x of [cx - 12, cx + 11]) { ctx.beginPath(); ctx.arc(x, cy - r + 3, 6, 0, Math.PI * 2); fillStroke(ctx, fur, 3); ctx.fillStyle = '#f6b8c8'; ctx.beginPath(); ctx.arc(x, cy - r + 3, 2.8, 0, Math.PI * 2); ctx.fill(); }
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); fillStroke(ctx, fur);
        ctx.beginPath(); ctx.ellipse(cx + 11, cy + 8, 9, 7, 0, 0, Math.PI * 2); ctx.fillStyle = cream; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(cx + 16, cy + 5, 3.2, 2.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(cx + 16, cy + 7); ctx.lineTo(cx + 15, cy + 11); ctx.quadraticCurveTo(cx + 12, cy + 13, cx + 9, cy + 11); ctx.stroke();
        for (const [x, y] of [[cx + 6, cy - 3], [cx + 14, cy - 4]]) { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, y, 2.4, 3.1, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x - 0.7, y - 1.2, 0.9, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = 'rgba(255,130,150,0.45)'; ctx.beginPath(); ctx.ellipse(cx + 2, cy + 6, 3.2, 2, 0, 0, Math.PI * 2); ctx.fill();
      };
      if (B === 'bearrain') {
        // áo mưa vàng dài qua hông, nẹp giữa và cúc gỗ, tay áo vàng, bàn tay gấu trắng
        rr(ctx, 12, 50, 10, 20, 5); fillStroke(ctx, rain);
        ctx.beginPath(); ctx.moveTo(18, 44); ctx.lineTo(56, 44); ctx.lineTo(60, 76); ctx.lineTo(13, 76); ctx.closePath(); fillStroke(ctx, rain);
        ctx.strokeStyle = rainDk; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(40, 47); ctx.lineTo(41, 75); ctx.stroke();
        for (const y of [52, 60, 68]) { rr(ctx, 42, y - 1.5, 6, 3, 1.5); fillStroke(ctx, '#b0753a', 1.3); }
        ctx.beginPath(); ctx.ellipse(28, 66, 5, 3, 0, 0, Math.PI * 2); ctx.fillStyle = rainDk; ctx.fill(); // túi áo
        rr(ctx, 50, 50, 10, 20, 5); fillStroke(ctx, rain); ctx.beginPath(); ctx.arc(55, 71, 4.5, 0, Math.PI * 2); fillStroke(ctx, fur, 2.5);
        // mũ trùm: ôm quanh đầu, có hai núm tai
        for (const x of [24, 50]) { ctx.beginPath(); ctx.arc(x, 7, 6, 0, Math.PI * 2); fillStroke(ctx, rain, 3); }
        ctx.beginPath(); ctx.arc(37, 26, 23, 0, Math.PI * 2); fillStroke(ctx, rain);
        ctx.strokeStyle = rainDk; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(37, 26, 19.5, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
        head(39, 29, 16, false);
        // giọt mưa lấp lánh trên mũ
        ctx.fillStyle = '#9fd6ff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
        for (const [x, y] of [[22, 20], [30, 9]]) { ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.quadraticCurveTo(x + 3, y, x, y + 2); ctx.quadraticCurveTo(x - 3, y, x, y - 4); ctx.fill(); ctx.stroke(); }
        return;
      }
      // Gấu đội hoa: vòng cánh hoa hướng dương quanh mặt, cổ áo lá xanh
      rr(ctx, 12, 50, 10, 20, 5); fillStroke(ctx, fur);
      rr(ctx, 15, 42, 42, 32, 13); fillStroke(ctx, fur);
      ctx.beginPath(); ctx.ellipse(38, 60, 12, 11, 0, 0, Math.PI * 2); ctx.fillStyle = cream; ctx.fill();
      rr(ctx, 50, 50, 10, 20, 5); fillStroke(ctx, fur); ctx.beginPath(); ctx.arc(55, 71, 4.5, 0, Math.PI * 2); fillStroke(ctx, fur, 2.5);
      for (const [x, rot] of [[30, -0.5], [44, 0.5]] as [number, number][]) { ctx.save(); ctx.translate(x, 45); ctx.rotate(rot); ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.5, 0, 0, Math.PI * 2); fillStroke(ctx, '#3fa66b', 2); ctx.restore(); }
      const petal = '#ffc928', petalDk = '#e89a10';
      for (let i = 0; i < 14; i++) {
        const t = (i / 14) * Math.PI * 2;
        ctx.save(); ctx.translate(38 + Math.cos(t) * 21, 27 + Math.sin(t) * 21); ctx.rotate(t + Math.PI / 2);
        ctx.beginPath(); ctx.ellipse(0, 0, 4.6, 8, 0, 0, Math.PI * 2); fillStroke(ctx, i % 2 ? petal : petalDk, 2.2);
        ctx.restore();
      }
      ctx.beginPath(); ctx.arc(38, 27, 19, 0, Math.PI * 2); ctx.fillStyle = '#5a9c3a'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
      head(38, 28, 16.5, false);
      return;
    }
    case 'zombie': {
      legs('#4a4f5e', INK);
      ctx.translate(0, bob);
      // sơ mi rách, cà vạt lỏng, quầng thâm vì OT
      rr(ctx, 12, 50, 10, 20, 5); fillStroke(ctx, c2);
      rr(ctx, 15, 42, 42, 32, 13); fillStroke(ctx, c2);
      ctx.fillStyle = c1; ctx.beginPath(); ctx.moveTo(18, 74); ctx.lineTo(22, 66); ctx.lineTo(26, 74); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(44, 74); ctx.lineTo(48, 64); ctx.lineTo(52, 74); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.translate(37, 45); ctx.rotate(0.25); ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(2, 0); ctx.lineTo(4, 18); ctx.lineTo(0, 22); ctx.lineTo(-4, 18); ctx.closePath(); fillStroke(ctx, '#7d2340', 2); ctx.restore();
      ctx.save(); ctx.translate(52, 56); ctx.rotate(-1.2); rr(ctx, -5, -4, 22, 10, 5); fillStroke(ctx, c2); ctx.beginPath(); ctx.arc(19, 1, 4.5, 0, Math.PI * 2); fillStroke(ctx, c1, 2.5); ctx.restore();
      ctx.beginPath(); ctx.arc(38, 27, 19, 0, Math.PI * 2); fillStroke(ctx, c1);
      ctx.fillStyle = shade(c1, 0.55); hairPath(ctx, 'messy'); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = 'rgba(90,40,90,0.45)'; for (const x of [44, 52]) { ctx.beginPath(); ctx.ellipse(x, 31, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#ffffff'; for (const x of [44, 52]) { ctx.beginPath(); ctx.arc(x, 27, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(44.5, 27.5, 1.2, 0, Math.PI * 2); ctx.arc(52.5, 26.5, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(45, 38); ctx.lineTo(48, 36.5); ctx.lineTo(51, 38); ctx.lineTo(54, 36.5); ctx.stroke();
      ctx.strokeStyle = '#7d2340'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(28, 20); ctx.lineTo(33, 25); ctx.stroke(); for (const t of [0.3, 0.7]) { ctx.beginPath(); ctx.moveTo(28 + 5 * t - 1.5, 20 + 5 * t + 1.5); ctx.lineTo(28 + 5 * t + 1.5, 20 + 5 * t - 1.5); ctx.stroke(); }
      return;
    }
    case 'skeleton': {
      const bone = c1;
      const lUp2 = lUp, rUp2 = rUp;
      ctx.strokeStyle = INK; ctx.lineWidth = 7.5; ctx.beginPath(); ctx.moveTo(30, 62); ctx.lineTo(29, 82 - lUp2); ctx.moveTo(43, 62); ctx.lineTo(44, 82 - rUp2); ctx.stroke();
      ctx.strokeStyle = bone; ctx.lineWidth = 4; ctx.stroke();
      for (const [x, up] of [[29, lUp2], [44, rUp2]]) { rr(ctx, x - 6, 81 - up, 12, 5, 2.5); fillStroke(ctx, bone, 2); }
      ctx.translate(0, bob);
      ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(37, 42); ctx.lineTo(37, 66); ctx.stroke(); ctx.strokeStyle = bone; ctx.lineWidth = 3; ctx.stroke();
      for (let i = 0; i < 4; i++) { const y = 47 + i * 5; ctx.beginPath(); ctx.moveTo(26 + i, y); ctx.quadraticCurveTo(37, y - 3, 48 - i, y); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = bone; ctx.lineWidth = 2.5; ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(37, 64, 10, 4, 0, 0, Math.PI * 2); fillStroke(ctx, bone, 2.5);
      for (const [x1, y1, x2, y2] of [[48, 46, 58, 66], [26, 46, 16, 66]]) { ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.strokeStyle = bone; ctx.lineWidth = 3; ctx.stroke(); ctx.beginPath(); ctx.arc(x2, y2 + 2, 3.5, 0, Math.PI * 2); fillStroke(ctx, bone, 2); }
      ctx.beginPath(); ctx.arc(38, 24, 17, 0, Math.PI * 2); fillStroke(ctx, bone);
      rr(ctx, 40, 34, 14, 9, 3); fillStroke(ctx, bone, 3);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(44, 24, 4, 5, 0, 0, Math.PI * 2); ctx.ellipse(53, 24, 3.5, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(48, 30); ctx.lineTo(46, 33); ctx.lineTo(50, 33); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2; for (let x = 43; x < 54; x += 3) { ctx.beginPath(); ctx.moveTo(x, 35); ctx.lineTo(x, 42); ctx.stroke(); }
      return;
    }
    // ---------- Skin không tay chân ----------
    case 'cloud': case 'drop': case 'mochi': case 'egg': case 'flame': case 'snake': {
      // mặt dễ thương: hai mắt, má hồng, miệng cười (nhìn sang phải như các skin khác)
      const face = (fx: number, fy: number, k = 1) => {
        ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(fx, fy, 2.6 * k, 3.4 * k, 0, 0, Math.PI * 2); ctx.ellipse(fx + 8 * k, fy, 2.6 * k, 3.4 * k, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,120,120,0.45)'; ctx.beginPath(); ctx.ellipse(fx - 3 * k, fy + 7 * k, 3.5 * k, 2.2 * k, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(fx + 2 * k, fy + 9 * k); ctx.quadraticCurveTo(fx + 5 * k, fy + 10.5 * k, fx + 8 * k, fy + 8.5 * k); ctx.stroke();
      };
      const shine = (x: number, y: number, rx: number, ry: number) => { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -0.5, 0, Math.PI * 2); ctx.fill(); };
      if (L.body === 'cloud') {
        // đám mây kiểu Google Cloud: thân trắng, viền trên 4 màu; lơ lửng nhún nhẹ
        const y0 = frame === 0 ? 0 : frame === 1 ? -3 : -1;
        ctx.translate(0, y0);
        const path = () => { ctx.beginPath(); ctx.moveTo(16, 70); ctx.arc(18, 58, 12, Math.PI * 0.5, Math.PI * 1.45); ctx.arc(32, 38, 15, Math.PI * 1.05, Math.PI * 1.85); ctx.arc(50, 42, 14, Math.PI * 1.3, Math.PI * 2.1); ctx.arc(58, 60, 10, Math.PI * 1.55, Math.PI * 0.5); ctx.closePath(); };
        path(); fillStroke(ctx, c1, 3.5);
        const G = ['#4285f4', '#ea4335', '#fbbc05', '#34a853'];
        ctx.lineWidth = 4;
        ([[18, 58, 12, 1.0, 1.45], [32, 38, 15, 1.05, 1.5], [32, 38, 15, 1.5, 1.85], [50, 42, 14, 1.3, 2.1]] as const).forEach(([x, y, r, a, b], i) => { ctx.strokeStyle = G[i]; ctx.beginPath(); ctx.arc(x, y, r - 4, Math.PI * a, Math.PI * b); ctx.stroke(); });
        face(40, 54); return;
      }
      if (L.body === 'drop') {
        // giọt nước: bước đi thì dẹt xuống một chút rồi nảy lên
        const sq = frame === 1 ? 0.92 : 1;
        ctx.translate(38, 84); ctx.scale(1 / sq, sq); ctx.translate(-38, -84);
        ctx.beginPath(); ctx.moveTo(38, 10); ctx.bezierCurveTo(46, 26, 62, 42, 62, 60); ctx.arc(38, 60, 24, 0, Math.PI); ctx.bezierCurveTo(14, 42, 30, 26, 38, 10); ctx.closePath();
        fillStroke(ctx, c1, 3.5); shine(28, 50, 5, 9); face(40, 58); return;
      }
      if (L.body === 'mochi') {
        // bánh mochi: dẻo, phồng xẹp khi bước; có đốm bột
        const w = frame === 0 ? 27 : frame === 1 ? 29 : 25, h = frame === 0 ? 22 : frame === 1 ? 20 : 24;
        ctx.beginPath(); ctx.moveTo(38 - w, 82); ctx.quadraticCurveTo(38 - w - 2, 82 - h * 2.1, 38, 82 - h * 2.2); ctx.quadraticCurveTo(38 + w + 2, 82 - h * 2.1, 38 + w, 82); ctx.closePath();
        fillStroke(ctx, c1, 3.5);
        ctx.fillStyle = 'rgba(255,255,255,0.75)'; for (const [x, y] of [[26, 52], [32, 46], [52, 50], [56, 60], [24, 64]]) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill(); }
        face(42, 62); return;
      }
      if (L.body === 'egg') {
        // quả trứng: lắc lư khi đi
        const tilt = frame === 1 ? -0.08 : frame === 2 ? 0.08 : 0;
        ctx.translate(38, 84); ctx.rotate(tilt); ctx.translate(-38, -84);
        ctx.beginPath(); ctx.ellipse(38, 52, 22, 31, 0, 0, Math.PI * 2); fillStroke(ctx, c1, 3.5);
        ctx.fillStyle = shade(c1, 0.85); for (const [x, y, r] of [[26, 40, 2], [50, 34, 1.6], [30, 70, 1.8], [54, 66, 1.4]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
        shine(28, 36, 5, 9); face(41, 50); return;
      }
      if (L.body === 'flame') {
        // ngọn lửa: các chóp lửa nhảy theo nhịp
        const f = frame === 1 ? 4 : frame === 2 ? -4 : 0;
        const tip = (x: number, y: number) => [x + f * 0.5, y - Math.abs(f)] as const;
        const [ax, ay] = tip(36, 6), [bx, by] = tip(22, 26), [cx, cy] = tip(54, 22);
        ctx.beginPath(); ctx.moveTo(38, 84); ctx.bezierCurveTo(10, 84, 10, 50, bx, by); ctx.quadraticCurveTo(30, 40, ax, ay); ctx.quadraticCurveTo(46, 30, cx, cy); ctx.bezierCurveTo(68, 50, 66, 84, 38, 84); ctx.closePath();
        fillStroke(ctx, c1, 3.5);
        ctx.fillStyle = '#ffe36e'; ctx.beginPath(); ctx.moveTo(38, 80); ctx.bezierCurveTo(22, 80, 24, 56, 34 + f * 0.3, 40); ctx.quadraticCurveTo(40, 52, 46, 46); ctx.bezierCurveTo(54, 60, 54, 80, 38, 80); ctx.closePath(); ctx.fill();
        face(39, 62, 0.9); return;
      }
      // con rắn: thân uốn lượn, sóng đổi theo nhịp di chuyển (trườn); đầu bên phải, lưỡi thè
      const ph = frame === 0 ? 0 : frame === 1 ? 1.3 : 2.6;
      ctx.lineCap = 'round';
      const pts: [number, number][] = [];
      // nằm giữa khung rộng 72: đuôi bắt đầu cách mép trái 10, đầu và lưỡi kết thúc trước mép phải
      for (let i = 0; i <= 12; i++) { const x = 10 + i * 2.75; pts.push([x, 74 + Math.sin(i * 0.75 + ph) * 5 * (i / 12)]); }
      const tube = (w: number, col: string) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };
      tube(18, INK); tube(12, c1);
      ctx.fillStyle = shade(c1, 0.75); for (let i = 2; i < 12; i += 2) { const [x, y] = pts[i]; ctx.beginPath(); ctx.ellipse(x, y, 2.4, 3.6, 0, 0, Math.PI * 2); ctx.fill(); }
      // đầu ngẩng lên
      const [hx, hy] = pts[12];
      ctx.strokeStyle = INK; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.quadraticCurveTo(hx + 6, hy - 4, hx + 6, hy - 22); ctx.stroke();
      ctx.strokeStyle = c1; ctx.lineWidth = 12; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(hx + 8, hy - 30, 13, 11, 0, 0, Math.PI * 2); fillStroke(ctx, c1, 3.5);
      if (frame !== 0) { ctx.strokeStyle = '#e2412f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx + 20, hy - 26); ctx.lineTo(hx + 25, hy - 26); ctx.lineTo(hx + 28, hy - 29); ctx.moveTo(hx + 25, hy - 26); ctx.lineTo(hx + 28, hy - 23); ctx.stroke(); }
      face(hx + 6, hy - 34, 0.8); return;
    }
    case 'coffee': case 'toast': case 'plant': case 'slime': case 'matcha': case 'banhmi': {
      const limbCol = L.body === 'slime' ? c1 : '#3b2a20';
      const arms = L.body === 'slime' ? null : stickLimbs(ctx, frame, limbCol, 50);
      ctx.translate(0, bob);
      if (L.body === 'coffee') {
        ctx.beginPath(); ctx.ellipse(16, 36, 8, 14, 0, 0, Math.PI * 2); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(16, 8); ctx.lineTo(60, 8); ctx.lineTo(55, 70); ctx.lineTo(21, 70); ctx.closePath(); fillStroke(ctx, c1);
        rr(ctx, 18, 44, 40, 8, 3); ctx.fillStyle = shade(c1, 0.88); ctx.fill();
        ctx.beginPath(); ctx.ellipse(38, 9, 21, 4.5, 0, 0, Math.PI * 2); fillStroke(ctx, c2, 2.5);
        ctx.strokeStyle = '#c9ccd8'; ctx.lineWidth = 2; for (const x of [32, 42]) { ctx.beginPath(); ctx.moveTo(x, 3); ctx.quadraticCurveTo(x + 3, -1, x, -6); ctx.stroke(); }
      } else if (L.body === 'toast') {
        ctx.beginPath(); ctx.moveTo(16, 70); ctx.lineTo(16, 24); ctx.quadraticCurveTo(10, 4, 38, 4); ctx.quadraticCurveTo(66, 4, 60, 24); ctx.lineTo(60, 70); ctx.closePath(); fillStroke(ctx, c2, 4);
        ctx.beginPath(); ctx.moveTo(21, 66); ctx.lineTo(21, 26); ctx.quadraticCurveTo(17, 10, 38, 10); ctx.quadraticCurveTo(59, 10, 55, 26); ctx.lineTo(55, 66); ctx.closePath(); ctx.fillStyle = c1; ctx.fill();
        ctx.fillStyle = shade(c1, 0.9); for (const [x, y] of [[28, 50], [44, 56], [36, 18]]) { ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill(); }
      } else if (L.body === 'plant') {
        for (const [x, y, r, a] of [[28, 16, 10, -0.6], [48, 14, 11, 0.5], [38, 4, 9, 0]] as const) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, 0, r * 0.6, r, 0, 0, Math.PI * 2); fillStroke(ctx, c2, 2.5); ctx.restore(); }
        ctx.beginPath(); ctx.moveTo(16, 24); ctx.lineTo(60, 24); ctx.lineTo(54, 70); ctx.lineTo(22, 70); ctx.closePath(); fillStroke(ctx, c1);
        rr(ctx, 13, 21, 50, 9, 3); fillStroke(ctx, shade(c1, 0.85), 3);
      } else if (L.body === 'matcha') {
        // ly nhựa nắp vòm, ống hút, lớp kem sữa trên nền matcha xanh
        ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(44, 8); ctx.lineTo(52, -12); ctx.stroke(); ctx.strokeStyle = '#2f9e5e'; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(18, 14); ctx.lineTo(58, 14); ctx.lineTo(53, 72); ctx.lineTo(23, 72); ctx.closePath(); fillStroke(ctx, '#e9f6e3');
        ctx.save(); ctx.beginPath(); ctx.moveTo(18, 14); ctx.lineTo(58, 14); ctx.lineTo(53, 72); ctx.lineTo(23, 72); ctx.closePath(); ctx.clip();
        ctx.fillStyle = c1; ctx.fillRect(10, 30, 60, 50); ctx.fillStyle = c2; ctx.fillRect(10, 22, 60, 10);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(22, 18, 4, 50); ctx.restore();
        ctx.beginPath(); ctx.moveTo(18, 14); ctx.lineTo(58, 14); ctx.lineTo(53, 72); ctx.lineTo(23, 72); ctx.closePath(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(38, 14, 22, 5, 0, 0, Math.PI * 2); fillStroke(ctx, '#ffffff', 3);
        ctx.beginPath(); ctx.arc(38, 12, 14, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fillStyle = 'rgba(230,245,255,0.8)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
      } else if (L.body === 'banhmi') {
        // ổ bánh mì dựng đứng, xẻ dọc lộ nhân dưa leo, đồ chua, ngò
        ctx.beginPath(); ctx.moveTo(22, 72); ctx.quadraticCurveTo(10, 40, 24, 8); ctx.quadraticCurveTo(38, -4, 52, 8); ctx.quadraticCurveTo(66, 40, 52, 72); ctx.closePath(); fillStroke(ctx, c1);
        ctx.strokeStyle = c2; ctx.lineWidth = 2.5; for (const y of [18, 32, 46, 60]) { ctx.beginPath(); ctx.moveTo(26, y + 4); ctx.lineTo(48, y - 4); ctx.stroke(); }
        ctx.save(); ctx.translate(20, 40); ctx.rotate(-0.08);
        ctx.fillStyle = '#7cc84a'; rr(ctx, -4, -22, 7, 44, 3); ctx.fill(); ctx.fillStyle = '#ff8a2f'; rr(ctx, -6, -14, 5, 30, 2); ctx.fill();
        ctx.fillStyle = '#2f9e5e'; for (const y of [-20, -4, 12]) { ctx.beginPath(); ctx.arc(-6, y, 3, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(46, 18, 3, 9, 0.2, 0, Math.PI * 2); ctx.fill();
      } else {
        // slime co giãn "nảy nảy" khi di chuyển
        const sq = frame === 1 ? 0.9 : frame === 2 ? 1.06 : 1;
        ctx.translate(38, 84); ctx.scale(1 / sq, sq); ctx.translate(-38, -84);
        ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.moveTo(14, 70); ctx.quadraticCurveTo(8, 10, 38, 8); ctx.quadraticCurveTo(68, 10, 62, 70); ctx.quadraticCurveTo(60, 86, 54, 80); ctx.quadraticCurveTo(48, 88, 42, 82); ctx.quadraticCurveTo(34, 90, 28, 82); ctx.quadraticCurveTo(18, 88, 14, 70); ctx.closePath(); fillStroke(ctx, c1);
        ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(26, 22, 6, 3.5, -0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(62, 54, 5, 8, 0.3, 0, Math.PI * 2); fillStroke(ctx, c1, 2.5);
      }
      arms?.();
      const fy = L.body === 'plant' ? 44 : L.body === 'matcha' ? 46 : L.body === 'banhmi' ? 34 : 34;
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(44, fy, 2.6, 3.4, 0, 0, Math.PI * 2); ctx.ellipse(52, fy, 2.6, 3.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,120,120,0.45)'; ctx.beginPath(); ctx.ellipse(41, fy + 7, 3.5, 2.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(46, fy + 9); ctx.quadraticCurveTo(49, fy + 10.5, 52, fy + 8.5); ctx.stroke();
      return;
    }
  }
}

/** frame: 0 đứng yên, 1 và 2 là hai nhịp bước chân */
export function drawCharacter(ctx: CanvasRenderingContext2D, L: Look, frame: 0 | 1 | 2, ox = 0, oy = 0) {
  ctx.save();
  ctx.translate(ox + CHAR_PAD_X, oy + CHAR_TOP);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // Skin: chỉ còn skin trọn người, không mặc đồ của người
  if (L.body !== 'human') { drawSkinFull(ctx, L, frame); ctx.restore(); return; }
  const bob = frame === 0 ? 0 : -2;
  const I = L.items;
  const body = bodyDef(L.body);
  const [bodyC, bodyC2] = colors2(L.bodyColor);
  const skinC = body.human ? bodyC : bodyC;
  const c = (s: keyof typeof I) => colors2(I[s].color || '#888888');

  drawLegs(ctx, L, frame, bodyC, skinC);
  if ((L.body as string) === 'ghost') { // đuôi ma uốn lượn thay cho chân
    ctx.beginPath(); ctx.moveTo(16, 66); ctx.lineTo(56, 66); ctx.quadraticCurveTo(58, 80, 52, 84); ctx.quadraticCurveTo(46, 78, 40, 84); ctx.quadraticCurveTo(34, 78, 28, 84); ctx.quadraticCurveTo(22, 78, 18, 84); ctx.closePath();
    fillStroke(ctx, bodyC); ctx.fillStyle = bodyC2; ctx.globalAlpha = 0.3; ctx.fill(); ctx.globalAlpha = 1;
  }
  ctx.translate(0, bob);
  drawBack(ctx, I.back.id, c('back'), frame);
  if (I.top.id === 'hoodie') { ctx.beginPath(); ctx.moveTo(17, 46); ctx.quadraticCurveTo(10, 32, 19, 24); ctx.lineTo(26, 42); ctx.closePath(); fillStroke(ctx, shade(c('top')[0], 0.85), 3); }
  const hoodHides = I.head.id === 'ninjahood' || I.head.id === 'dinohood';
  const showHair = body.hasHair && !hoodHides;
  if (showHair) hairBack(ctx, L.hairStyle, L.hair);

  const top = topBase(L, bodyC);
  rr(ctx, 12, 50, 10, 20, 5); fillStroke(ctx, top);
  rr(ctx, 15, 42, 42, 32, 13); fillStroke(ctx, top);
  if ((L.body as string) === 'robot' && I.top.id === 'none') { ctx.fillStyle = bodyC2; ctx.beginPath(); ctx.arc(36, 56, 4, 0, Math.PI * 2); ctx.fill(); }
  drawTop(ctx, L);
  drawBottomOver(ctx, L);
  drawNeck(ctx, I.neck.id, c('neck'));
  if (I.back.id === 'backpack') { ctx.strokeStyle = shade(c('back')[0], 0.7); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(24, 44); ctx.lineTo(22, 66); ctx.stroke(); }

  // Tay trước
  rr(ctx, 50, 50, 10, 20, 5); fillStroke(ctx, top);
  if (L.marks.includes('tattoo') && SHORT_SLEEVE.includes(I.top.id) && body.human) { ctx.fillStyle = '#2e5fb0'; ctx.beginPath(); ctx.moveTo(55, 66); ctx.bezierCurveTo(50, 62, 53, 58, 55, 61); ctx.bezierCurveTo(57, 58, 60, 62, 55, 66); ctx.fill(); }
  ctx.beginPath(); ctx.arc(55, 71, 4.5, 0, Math.PI * 2); fillStroke(ctx, bodyC, 2.5);
  drawHand(ctx, I.hand.id, c('hand'));

  if (I.head.id === 'dinohood') drawDinoHoodBack(ctx, c('head'));
  drawHead(ctx, L);
  if (I.head.id === 'dinohood') drawDinoHoodTeeth(ctx, c('head'));
  if (showHair) {
    hairPath(ctx, L.hairStyle);
    ctx.fillStyle = L.hair; ctx.strokeStyle = INK; ctx.lineWidth = 3.5; ctx.fill(); ctx.stroke();
  }
  drawFaceFeatures(ctx, L);
  drawMarks(ctx, L);
  drawFaceItem(ctx, I.face.id, c('face'), L.hair);
  drawEyesItem(ctx, I.eyes.id, c('eyes'));
  if (!hoodHides) drawEarsItem(ctx, I.ears.id, c('ears'));
  drawHeadItem(ctx, I.head.id, c('head'));
  ctx.restore();
}

export function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function characterCanvas(look: Look, frame: 0 | 1 | 2, scale = 1): HTMLCanvasElement {
  const c = makeCanvas(Math.ceil(CHAR_W * scale), Math.ceil(CHAR_H * scale));
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  drawCharacter(ctx, look, frame);
  return c;
}

let chairCache = '';
/** Ảnh ghế trống (dataURL) cho màn chuyển cảnh */
export function chairURL(): string {
  if (!chairCache) chairCache = chairCanvas().toDataURL();
  return chairCache;
}

const imgCache = new Map<string, HTMLCanvasElement>();
/** Ảnh nhân vật dạng canvas (dùng để vẽ lên camera an ninh) */
export function avatarImage(look: Look): HTMLCanvasElement {
  const k = lookKey(look);
  if (!imgCache.has(k)) imgCache.set(k, characterCanvas(look, 0, 1));
  return imgCache.get(k)!;
}

const avatarCache = new Map<string, string>();
/** Ảnh đại diện (dataURL) cho giao diện HTML */
export function avatarURL(look: Look): string {
  const k = lookKey(look);
  if (!avatarCache.has(k)) avatarCache.set(k, characterCanvas(look, 0, 2).toDataURL());
  return avatarCache.get(k)!;
}

/** Ghế xoay trống và lá đơn sa thải: dấu vết khi một người bị "đuổi việc" */
export function chairCanvas(): HTMLCanvasElement {
  const c = makeCanvas(80, 80);
  const ctx = c.getContext('2d')!;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // chân ghế
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(38, 56); ctx.lineTo(38, 68); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(22, 72); ctx.lineTo(54, 72); ctx.moveTo(38, 68); ctx.lineTo(24, 74); ctx.moveTo(38, 68); ctx.lineTo(52, 74); ctx.stroke();
  for (const x of [22, 54, 38]) { ctx.beginPath(); ctx.arc(x, 75, 3.5, 0, Math.PI * 2); ctx.fillStyle = '#333'; ctx.fill(); ctx.stroke(); }
  // lưng ghế, nghiêng đổ
  ctx.save(); ctx.translate(38, 40); ctx.rotate(-0.18);
  rr(ctx, -16, -30, 30, 30, 9); fillStroke(ctx, '#3d4659');
  rr(ctx, -20, 2, 40, 12, 6); fillStroke(ctx, '#4b5670');
  ctx.restore();
  // đơn sa thải
  ctx.save(); ctx.translate(58, 50); ctx.rotate(0.35);
  rr(ctx, -10, -13, 20, 26, 2); fillStroke(ctx, '#ffffff', 2.5);
  ctx.fillStyle = '#c8323c'; ctx.fillRect(-7, -9, 14, 3);
  ctx.fillStyle = '#9aa0ad'; for (let i = 0; i < 3; i++) ctx.fillRect(-7, -3 + i * 5, 14, 2);
  ctx.restore();
  return c;
}

export function lightCanvas(size = 256): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.72, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export function glowCanvas(color: string, size = 128): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export function shadowCanvas(): HTMLCanvasElement {
  const c = makeCanvas(48, 16);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(20,16,40,0.28)';
  ctx.beginPath(); ctx.ellipse(24, 8, 22, 7, 0, 0, Math.PI * 2); ctx.fill();
  return c;
}

/** Lớp sương mù có lỗ tròn trong suốt ở giữa (tầm nhìn), bán kính lỗ = r */
export function holeCanvas(size = 1024, r = 64): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0d0e1f';
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'destination-out';
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, r);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.72, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2); ctx.fill();
  return c;
}
