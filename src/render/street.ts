// Bộ vẽ đường phố và con mèo ở sảnh: cùng phong cách 3/4 + sticker với đồ đạc (viền đen dày, mặt trên sáng,
// mặt bên tối, vệt sáng, bóng đổ). Vẽ lại mỗi khung hình nên bánh xe quay, cửa xe buýt mở, mèo thở được.
import { Pen, shade } from './furniture';

const INK = 0x1d1a2b;
export type VehicleKind = 'car' | 'taxi' | 'bus' | 'moto';

/**
 * Vẽ một chiếc xe nhìn chéo từ phía trước mặt đường (thấy nóc và hông xe).
 * cx, cy: tâm xe trên làn; len: chiều dài; dir: 1 chạy sang phải, -1 sang trái;
 * roll: quãng đường đã chạy (để bánh xe quay); door: 0..1 độ mở cửa xe buýt; bob: nhún thân xe.
 */
export function drawVehicle(p: Pen, kind: VehicleKind, cx: number, cy: number, len: number, color: number, dir: 1 | -1, roll: number, door = 0, bob = 0) {
  const x0 = cx - len / 2, front = dir > 0 ? x0 + len : x0;
  const fx = (k: number) => dir > 0 ? x0 + len * k : x0 + len * (1 - k); // k: 0 đuôi xe → 1 đầu xe
  if (kind === 'moto') { drawMoto(p, cx, cy, dir, roll, color); return; }
  const tall = kind === 'bus' ? 34 : 18, topD = kind === 'bus' ? 20 : 16;
  const yTop = cy - (tall + topD) / 2 + bob;
  // bóng đổ
  p.g.fillStyle(INK, 0.2); p.g.fillEllipse(p.ox + cx, p.oy + cy + tall / 2 + 6, len * 1.02, 14);
  // hông xe (mặt trước, tối) và nóc xe (mặt trên, sáng)
  const side = shade(color, -0.18), top = shade(color, 0.2);
  p.box(x0, yTop + topD - 4, len, tall + 4, side, 10, 3.5);
  p.box(x0 + 2, yTop, len - 4, topD + 2, top, 9, 3.5);
  if (kind === 'bus') {
    // dãy cửa sổ, cửa lên xuống ở gần đầu xe, bảng tuyến
    const n = 5;
    for (let i = 0; i < n; i++) {
      const k0 = 0.08 + i * 0.15;
      const wx = Math.min(fx(k0), fx(k0 + 0.12));
      p.box(wx, yTop + topD + 2, len * 0.12, 13, 0xbfe6f2, 3, 2.5);
      p.shine(wx + 3, yTop + topD + 5, wx + 8, yTop + topD + 5, 2);
    }
    const dx = Math.min(fx(0.84), fx(0.94)), dw = len * 0.1;
    p.fill(dx, yTop + topD + 1, dw, tall - 4, 0x2d3142);
    const open = (dw / 2) * door;
    p.box(dx - open, yTop + topD + 1, dw / 2, tall - 4, 0xbfe6f2, 2, 2.5);
    p.box(dx + dw / 2 + open, yTop + topD + 1, dw / 2, tall - 4, 0xbfe6f2, 2, 2.5);
    p.box(Math.min(fx(0.82), fx(0.98)), yTop + 3, len * 0.16, topD - 6, 0x3fbf6a, 3, 2.5); // bảng tuyến trên nóc
    p.fill(Math.min(fx(0.84), fx(0.96)) + 4, yTop + 7, len * 0.08, 3, 0xffffff, 0.9);
  } else {
    // ca-bin: kính chắn gió và cửa kính bên hông
    const cx0 = Math.min(fx(0.28), fx(0.72)), cw = len * 0.44;
    p.box(cx0, yTop - 6, cw, topD + 4, shade(color, 0.32), 8, 3);
    p.fill(dir > 0 ? cx0 + cw - 12 : cx0 + 3, yTop - 3, 9, topD - 2, 0xbfe6f2, 1, 3);
    p.box(cx0 + 4, yTop + topD + 1, cw - 8, 10, 0xbfe6f2, 3, 2.5);
    p.line(cx0 + cw / 2, yTop + topD + 1, cx0 + cw / 2, yTop + topD + 11, INK, 2);
    p.shine(cx0 + 8, yTop + topD + 4, cx0 + 16, yTop + topD + 4, 2);
    if (kind === 'taxi') {
      p.box(cx0 + cw / 2 - 12, yTop - 14, 24, 9, 0xfff3a0, 2, 2.5);
      for (let i = 0; i < 4; i++) p.fill(x0 + 10 + i * 8, yTop + topD + tall - 8, 4, 4, i % 2 ? 0xffffff : INK);
      for (let i = 0; i < 4; i++) p.fill(x0 + len - 42 + i * 8, yTop + topD + tall - 8, 4, 4, i % 2 ? INK : 0xffffff);
    }
  }
  // đèn pha (vàng) ở đầu xe, đèn hậu (đỏ) ở đuôi
  const ly = yTop + topD + 4;
  p.box(dir > 0 ? front - 7 : front + 1, ly, 6, 7, 0xfff3a0, 2, 2);
  p.box(dir > 0 ? x0 + 1 : x0 + len - 7, ly, 6, 7, 0xe2412f, 2, 2);
  // bánh xe quay theo quãng đường đã chạy
  const wy = yTop + topD + tall - 2, wr = kind === 'bus' ? 9 : 8;
  for (const k of kind === 'bus' ? [0.14, 0.8] : [0.2, 0.8]) wheel(p, fx(k), wy, wr, roll);
}

function wheel(p: Pen, x: number, y: number, r: number, roll: number) {
  p.circ(x, y, r, 0x2d3142, 3);
  p.circ(x, y, r * 0.45, 0xb9c0cf, 2);
  const a = roll / r;
  p.line(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, x - Math.cos(a) * r * 0.45, y - Math.sin(a) * r * 0.45, INK, 1.5);
}

function drawMoto(p: Pen, cx: number, cy: number, dir: 1 | -1, roll: number, color: number) {
  p.g.fillStyle(INK, 0.2); p.g.fillEllipse(p.ox + cx, p.oy + cy + 14, 46, 10);
  wheel(p, cx - 15 * dir, cy + 8, 7, roll); wheel(p, cx + 15 * dir, cy + 8, 7, roll);
  p.poly([cx - 18 * dir, cy + 4, cx + 14 * dir, cy + 4, cx + 18 * dir, cy - 4, cx - 8 * dir, cy - 6], color, 3);
  p.line(cx + 14 * dir, cy - 4, cx + 18 * dir, cy - 14, INK, 3); // tay lái
  // người lái đội mũ bảo hiểm
  p.box(cx - 6, cy - 22, 12, 18, 0x2e9cf0, 4, 2.5);
  p.circ(cx + 2 * dir, cy - 28, 7, 0xffd23f, 2.5);
  p.fill(cx + 3 * dir - (dir > 0 ? 0 : 5), cy - 30, 5, 3, 0x2d3142);
  p.box(dir > 0 ? cx + 17 : cx - 21, cy - 2, 4, 4, 0xfff3a0, 1, 1.5);
}

/**
 * Mèo văn phòng. pose: 'sleep' cuộn tròn ngủ (có chữ z bay), 'stretch' vươn vai khi được vuốt.
 * t: giây (để thở, vẫy đuôi); k: 0..1 tiến độ vươn vai.
 */
export function drawCat(p: Pen, x: number, y: number, t: number, k: number) {
  const O = 0xf2b705, D = shade(O, -0.22), L = shade(O, 0.35);
  p.g.fillStyle(INK, 0.18); p.g.fillEllipse(p.ox + x, p.oy + y + 9, 40, 9);
  if (k <= 0) {
    // ngủ cuộn tròn
    const br = 1 + Math.sin(t * 2) * 0.04;
    p.ell(x, y, 34, 18 * br, O, 3);
    p.line(x - 6, y - 8, x - 2, y + 2, D, 3); p.line(x + 2, y - 8, x + 6, y + 2, D, 3); // vằn
    p.ell(x + 12, y - 4, 16, 13, O, 3);                         // đầu gục
    p.poly([x + 6, y - 9, x + 8, y - 17, x + 12, y - 10], O, 2.5); p.poly([x + 13, y - 10, x + 17, y - 17, x + 19, y - 8], O, 2.5);
    p.line(x + 9, y - 4, x + 12, y - 4, INK, 2); p.line(x + 15, y - 4, x + 18, y - 4, INK, 2); // mắt nhắm
    p.g.lineStyle(5, INK, 1); p.g.beginPath(); p.g.arc(p.ox + x - 4, p.oy + y + 2, 14, 1.2, 2.9); p.g.strokePath();
    p.g.lineStyle(3, O, 1); p.g.beginPath(); p.g.arc(p.ox + x - 4, p.oy + y + 2, 14, 1.2, 2.9); p.g.strokePath(); // đuôi quấn
    p.shine(x - 10, y - 6, x - 2, y - 8, 2.5);
    // chữ z bay lên
    for (let i = 0; i < 2; i++) {
      const u = (t * 0.45 + i * 0.5) % 1;
      const zx = x + 18 + u * 10, zy = y - 18 - u * 22, s = 4 + u * 3;
      p.g.lineStyle(2, INK, 1 - u); p.g.beginPath();
      p.g.moveTo(p.ox + zx - s, p.oy + zy - s); p.g.lineTo(p.ox + zx + s, p.oy + zy - s); p.g.lineTo(p.ox + zx - s, p.oy + zy + s); p.g.lineTo(p.ox + zx + s, p.oy + zy + s); p.g.strokePath();
    }
    return;
  }
  // vươn vai: chân trước duỗi, mông nhổm, đuôi dựng và vẫy
  const st = Math.sin(Math.min(1, k) * Math.PI);
  const tail = Math.sin(t * 10) * 4;
  p.line(x - 14, y - 2, x - 18 + tail, y - 22, INK, 6); p.line(x - 14, y - 2, x - 18 + tail, y - 22, O, 3);
  p.ell(x, y - 2 - st * 3, 34 + st * 8, 15, O, 3);
  p.line(x - 6, y - 9, x - 3, y + 2, D, 3); p.line(x + 3, y - 9, x + 6, y + 2, D, 3);
  p.line(x + 14 + st * 6, y + 4, x + 22 + st * 8, y + 6, INK, 5); p.line(x + 14 + st * 6, y + 4, x + 22 + st * 8, y + 6, O, 2.5); // chân trước duỗi
  p.ell(x + 18 + st * 4, y - 10 - st * 2, 17, 14, O, 3);
  p.poly([x + 11 + st * 4, y - 15, x + 13 + st * 4, y - 25, x + 17 + st * 4, y - 16], O, 2.5);
  p.poly([x + 19 + st * 4, y - 16, x + 24 + st * 4, y - 25, x + 26 + st * 4, y - 13], O, 2.5);
  p.circ(x + 15 + st * 4, y - 11, 1.8, INK, 0); p.circ(x + 21 + st * 4, y - 11, 1.8, INK, 0);
  p.ell(x + 18 + st * 4, y - 6, 6, 4, L, 1.5);
}
