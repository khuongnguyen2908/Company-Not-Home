// Vẽ nhân vật theo phong cách hoạt hình vector viền đậm, hoàn toàn bằng code
import { type DeptId } from '../game/data';

export const INK = '#1d1a2b';
export const CHAR_W = 72;
export const CHAR_H = 88;

interface Look {
  shirt: string; pants: string; skin: string; hair: string;
  hairStyle: 'messy' | 'side' | 'slick' | 'spiky' | 'bun' | 'pony' | 'short' | 'curly';
}

const LOOKS: Record<DeptId | 'guard', Look> = {
  it: { shirt: '#5b6b80', pants: '#2f3542', skin: '#f2c49b', hair: '#2b2118', hairStyle: 'messy' },
  mkt: { shirt: '#ff5fa2', pants: '#f4efe6', skin: '#f6d0ae', hair: '#7a3b1f', hairStyle: 'curly' },
  acc: { shirt: '#9fdba9', pants: '#4a4a5c', skin: '#efc29a', hair: '#1c1c22', hairStyle: 'side' },
  hr: { shirt: '#30418c', pants: '#22295a', skin: '#f3c7a1', hair: '#3a2a1e', hairStyle: 'slick' },
  sales: { shirt: '#ffffff', pants: '#30343f', skin: '#e9b98f', hair: '#1e1a17', hairStyle: 'spiky' },
  design: { shirt: '#f2b705', pants: '#3b3a4a', skin: '#f6d0ae', hair: '#4b2e1d', hairStyle: 'short' },
  admin: { shirt: '#f2832f', pants: '#5a4636', skin: '#f3c7a1', hair: '#2e1f17', hairStyle: 'bun' },
  legal: { shirt: '#7d2340', pants: '#2b1c22', skin: '#eab993', hair: '#8b8b95', hairStyle: 'side' },
  intern: { shirt: '#2e9cf0', pants: '#355c8c', skin: '#f6d0ae', hair: '#3b2a20', hairStyle: 'short' },
  cs: { shirt: '#8a5cf5', pants: '#3a2f5c', skin: '#f2c49b', hair: '#1f1712', hairStyle: 'pony' },
  guard: { shirt: '#26283a', pants: '#1a1b28', skin: '#e3b089', hair: '#111', hairStyle: 'short' },
};

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

/** frame: 0 đứng yên, 1 và 2 là hai nhịp bước chân */
export function drawCharacter(ctx: CanvasRenderingContext2D, d: DeptId | 'guard', frame: 0 | 1 | 2, ox = 0, oy = 0) {
  const L = LOOKS[d];
  ctx.save();
  ctx.translate(ox, oy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const bob = frame === 0 ? 0 : -2;

  // Chân
  const lUp = frame === 1 ? 4 : 0, rUp = frame === 2 ? 4 : 0;
  rr(ctx, 22, 68 - lUp, 12, 15, 5); fillStroke(ctx, L.pants);
  rr(ctx, 38, 68 - rUp, 12, 15, 5); fillStroke(ctx, L.pants);
  // Giày
  rr(ctx, 21, 79 - lUp, 15, 6, 3); fillStroke(ctx, INK, 1);
  rr(ctx, 37, 79 - rUp, 15, 6, 3); fillStroke(ctx, INK, 1);

  ctx.translate(0, bob);
  // Tay sau
  rr(ctx, 12, 50, 10, 20, 5); fillStroke(ctx, L.shirt);
  // Thân
  rr(ctx, 15, 42, 42, 32, 13); fillStroke(ctx, L.shirt);

  // Chi tiết áo theo phòng ban
  if (d === 'hr' || d === 'legal') {
    ctx.beginPath(); ctx.moveTo(30, 43); ctx.lineTo(37, 58); ctx.lineTo(44, 43); ctx.closePath(); fillStroke(ctx, '#ffffff', 2.5);
    ctx.beginPath(); ctx.moveTo(35.5, 46); ctx.lineTo(38.5, 46); ctx.lineTo(40, 58); ctx.lineTo(37, 61); ctx.lineTo(34, 58); ctx.closePath();
    fillStroke(ctx, d === 'hr' ? '#c8323c' : '#e8c547', 1.5);
  }
  if (d === 'sales') {
    ctx.beginPath(); ctx.moveTo(35, 44); ctx.lineTo(39, 44); ctx.lineTo(41, 66); ctx.lineTo(37, 70); ctx.lineTo(33, 66); ctx.closePath();
    fillStroke(ctx, '#e2412f', 2);
  }
  if (d === 'admin') {
    rr(ctx, 30, 43, 12, 30, 4); fillStroke(ctx, '#fff4e0', 2);
  }
  if (d === 'guard') {
    rr(ctx, 41, 50, 9, 10, 2); fillStroke(ctx, '#e8c547', 2);
  }
  // Dây đeo thẻ tên (lanyard)
  if (d !== 'guard') {
    ctx.strokeStyle = d === 'intern' ? '#ff4d6d' : '#1f6feb';
    ctx.lineWidth = d === 'intern' ? 4 : 2.5;
    ctx.beginPath(); ctx.moveTo(29, 44); ctx.lineTo(36, 56); ctx.lineTo(44, 44); ctx.stroke();
    const bw = d === 'intern' ? 15 : 11, bh = d === 'intern' ? 17 : 13;
    rr(ctx, 36 - bw / 2, 55, bw, bh, 2); fillStroke(ctx, '#ffffff', 2);
    ctx.fillStyle = '#1f6feb'; ctx.fillRect(36 - bw / 2 + 2, 57, bw - 4, 3);
  }
  // Tay trước
  rr(ctx, 50, 50, 10, 20, 5); fillStroke(ctx, L.shirt);
  ctx.beginPath(); ctx.arc(55, 71, 4.5, 0, Math.PI * 2); fillStroke(ctx, L.skin, 2.5);

  // Đầu
  ctx.beginPath(); ctx.arc(38, 27, 19, 0, Math.PI * 2); fillStroke(ctx, L.skin);

  // Tóc
  ctx.fillStyle = L.hair;
  ctx.strokeStyle = INK; ctx.lineWidth = 3.5;
  ctx.beginPath();
  switch (L.hairStyle) {
    case 'messy':
      ctx.moveTo(19, 27); ctx.lineTo(18, 14); ctx.lineTo(24, 17); ctx.lineTo(25, 7); ctx.lineTo(32, 12); ctx.lineTo(37, 4);
      ctx.lineTo(42, 11); ctx.lineTo(50, 6); ctx.lineTo(50, 14); ctx.lineTo(57, 15); ctx.lineTo(54, 22); ctx.lineTo(44, 18); ctx.lineTo(30, 20); ctx.lineTo(26, 30); ctx.closePath();
      break;
    case 'spiky':
      ctx.moveTo(20, 24); ctx.lineTo(22, 6); ctx.lineTo(30, 13); ctx.lineTo(36, 2); ctx.lineTo(42, 12); ctx.lineTo(50, 4); ctx.lineTo(52, 15); ctx.lineTo(57, 20);
      ctx.lineTo(44, 17); ctx.lineTo(28, 19); ctx.lineTo(25, 30); ctx.closePath();
      break;
    case 'slick':
      ctx.moveTo(19, 28); ctx.quadraticCurveTo(18, 8, 38, 7); ctx.quadraticCurveTo(56, 8, 57, 22); ctx.quadraticCurveTo(44, 13, 30, 18); ctx.lineTo(26, 31); ctx.closePath();
      break;
    case 'side':
      ctx.moveTo(19, 30); ctx.quadraticCurveTo(17, 7, 38, 7); ctx.quadraticCurveTo(57, 7, 57, 24); ctx.lineTo(52, 17); ctx.lineTo(40, 15); ctx.lineTo(28, 19); ctx.lineTo(25, 32); ctx.closePath();
      break;
    case 'short':
      ctx.moveTo(19, 27); ctx.quadraticCurveTo(19, 8, 38, 8); ctx.quadraticCurveTo(55, 8, 56, 19); ctx.lineTo(42, 15); ctx.lineTo(27, 18); ctx.lineTo(25, 29); ctx.closePath();
      break;
    case 'curly':
      for (const [cx, cy, r] of [[22, 22, 7], [24, 13, 8], [33, 8, 8], [43, 8, 8], [51, 13, 7], [20, 32, 6], [22, 40, 6]] as const) {
        ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      }
      break;
    case 'bun':
      ctx.moveTo(19, 30); ctx.quadraticCurveTo(17, 8, 38, 8); ctx.quadraticCurveTo(56, 8, 57, 21); ctx.lineTo(42, 15); ctx.lineTo(27, 19); ctx.lineTo(25, 32); ctx.closePath();
      ctx.moveTo(30, 5); ctx.arc(23, 5, 7, 0, Math.PI * 2);
      break;
    case 'pony':
      ctx.moveTo(19, 30); ctx.quadraticCurveTo(17, 8, 38, 8); ctx.quadraticCurveTo(56, 8, 57, 21); ctx.lineTo(42, 15); ctx.lineTo(27, 19); ctx.lineTo(25, 32); ctx.closePath();
      ctx.moveTo(20, 18); ctx.quadraticCurveTo(6, 22, 10, 42); ctx.quadraticCurveTo(16, 32, 22, 26); ctx.closePath();
      break;
  }
  ctx.fill(); ctx.stroke();

  // Mắt và miệng (nhìn sang phải)
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.ellipse(44, 28, 2.6, 3.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(52, 28, 2.6, 3.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,120,120,0.45)';
  ctx.beginPath(); ctx.ellipse(41, 35, 3.5, 2.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(46, 37); ctx.quadraticCurveTo(49, 38.5, 52, 36.5); ctx.stroke();

  // Phụ kiện
  ctx.lineWidth = 3;
  if (d === 'it') {
    ctx.strokeStyle = '#3b3f4a'; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.arc(37, 26, 21, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(26, 29, 6, 8, 0, 0, Math.PI * 2); fillStroke(ctx, '#3b3f4a', 3);
    ctx.fillStyle = '#4ee1a0'; ctx.beginPath(); ctx.arc(26, 29, 2, 0, Math.PI * 2); ctx.fill();
  }
  if (d === 'mkt') {
    rr(ctx, 33, 6, 11, 6, 3); fillStroke(ctx, '#222', 2.5);
    rr(ctx, 46, 7, 10, 6, 3); fillStroke(ctx, '#222', 2.5);
  }
  if (d === 'acc' || d === 'legal') {
    const r = d === 'acc' ? 7 : 5;
    ctx.strokeStyle = INK; ctx.lineWidth = d === 'acc' ? 3.5 : 2.5;
    ctx.fillStyle = 'rgba(200,230,255,0.35)';
    ctx.beginPath(); ctx.arc(44, 28, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(54, 28, r - 1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(44 - r, 27); ctx.lineTo(24, 25); ctx.stroke();
  }
  if (d === 'design') {
    ctx.save(); ctx.translate(38, 9); ctx.rotate(-0.25);
    ctx.beginPath(); ctx.ellipse(0, 0, 18, 7, 0, 0, Math.PI * 2); fillStroke(ctx, '#c0392b', 3);
    ctx.beginPath(); ctx.arc(2, -7, 2.5, 0, Math.PI * 2); fillStroke(ctx, '#c0392b', 2);
    ctx.restore();
  }
  if (d === 'intern') {
    ctx.beginPath(); ctx.moveTo(19, 22); ctx.quadraticCurveTo(20, 4, 38, 5); ctx.quadraticCurveTo(56, 5, 56, 20); ctx.closePath(); fillStroke(ctx, '#ff4d6d', 3);
    rr(ctx, 8, 17, 16, 6, 3); fillStroke(ctx, '#ff4d6d', 3);
  }
  if (d === 'cs') {
    ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(37, 26, 21, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(27, 30, 5, 7, 0, 0, Math.PI * 2); fillStroke(ctx, '#2b2b33', 3);
    ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(29, 35); ctx.quadraticCurveTo(34, 44, 45, 41); ctx.stroke();
    ctx.fillStyle = '#2b2b33'; ctx.beginPath(); ctx.arc(46, 41, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  if (d === 'guard') {
    ctx.beginPath(); ctx.moveTo(19, 20); ctx.quadraticCurveTo(22, 4, 38, 4); ctx.quadraticCurveTo(54, 4, 56, 20); ctx.closePath(); fillStroke(ctx, '#26283a', 3);
    rr(ctx, 40, 16, 24, 6, 3); fillStroke(ctx, '#1a1b28', 3);
    ctx.fillStyle = '#e8c547'; ctx.beginPath(); ctx.arc(38, 11, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function characterCanvas(d: DeptId | 'guard', frame: 0 | 1 | 2, scale = 1): HTMLCanvasElement {
  const c = makeCanvas(Math.ceil(CHAR_W * scale), Math.ceil(CHAR_H * scale));
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  drawCharacter(ctx, d, frame);
  return c;
}

const avatarCache = new Map<string, string>();
/** Ảnh đại diện (dataURL) cho giao diện HTML: phòng họp, màn hình chọn phòng ban... */
export function avatarURL(d: DeptId | 'guard'): string {
  if (!avatarCache.has(d)) avatarCache.set(d, characterCanvas(d, 0, 2).toDataURL());
  return avatarCache.get(d)!;
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
