// Tính vùng nhìn thấy (đa giác) từ một điểm, có tường che như Among Us.
// Thuần toán học, không phụ thuộc Phaser.
import { TILE, isOpaque } from './map';

interface Seg { ax: number; ay: number; bx: number; by: number }

/** Trả về đa giác vùng nhìn thấy [x0,y0,x1,y1,...] (pixel), giới hạn trong bán kính */
export function visibilityPolygon(px: number, py: number, radius: number): number[] {
  const R = radius + TILE;
  const tx0 = Math.floor((px - R) / TILE), tx1 = Math.floor((px + R) / TILE);
  const ty0 = Math.floor((py - R) / TILE), ty1 = Math.floor((py + R) / TILE);
  const segs: Seg[] = [];
  const pts: [number, number][] = [];
  // Cạnh của ô che giáp với ô trống (chỉ những cạnh có thể chắn tầm nhìn)
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (!isOpaque(tx, ty)) continue;
    const x = tx * TILE, y = ty * TILE;
    if (!isOpaque(tx, ty - 1)) { segs.push({ ax: x, ay: y, bx: x + TILE, by: y }); }
    if (!isOpaque(tx, ty + 1)) { segs.push({ ax: x, ay: y + TILE, bx: x + TILE, by: y + TILE }); }
    if (!isOpaque(tx - 1, ty)) { segs.push({ ax: x, ay: y, bx: x, by: y + TILE }); }
    if (!isOpaque(tx + 1, ty)) { segs.push({ ax: x + TILE, ay: y, bx: x + TILE, by: y + TILE }); }
  }
  const angles: number[] = [];
  for (const s of segs) {
    for (const [x, y] of [[s.ax, s.ay], [s.bx, s.by]]) {
      if (Math.hypot(x - px, y - py) > R) continue;
      const a = Math.atan2(y - py, x - px);
      angles.push(a - 0.0004, a, a + 0.0004);
    }
  }
  const N = 48;
  for (let i = 0; i < N; i++) angles.push(-Math.PI + (i / N) * Math.PI * 2);
  angles.sort((p, q) => p - q);
  const out: number[] = [];
  // Cho tầm nhìn lấn vào tường một chút để mặt tường vẫn hiện ra
  const BLEED = 14;
  for (const a of angles) {
    const dx = Math.cos(a), dy = Math.sin(a);
    let best = radius;
    for (const s of segs) {
      const t = raySeg(px, py, dx, dy, s);
      if (t !== null && t < best) best = t;
    }
    const d = Math.min(radius, best + BLEED);
    pts.push([px + dx * d, py + dy * d]);
  }
  for (const [x, y] of pts) out.push(x, y);
  return out;
}

function raySeg(px: number, py: number, dx: number, dy: number, s: Seg): number | null {
  const sx = s.bx - s.ax, sy = s.by - s.ay;
  const den = dx * sy - dy * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((s.ax - px) * sy - (s.ay - py) * sx) / den;
  const u = ((s.ax - px) * dy - (s.ay - py) * dx) / den;
  if (t < 0 || u < 0 || u > 1) return null;
  return t;
}
