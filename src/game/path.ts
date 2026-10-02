import { MAP_W, MAP_H, TILE, isFloor, tileCenter, PORTAL_AT } from './map';

export interface Pt { x: number; y: number }

const DIRS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

const prev = new Int32Array(MAP_W * MAP_H);
const seen = new Uint32Array(MAP_W * MAP_H);
let stamp = 0;

/** Tìm đường BFS 8 hướng (không cắt góc tường), trả về danh sách tâm ô theo pixel */
export function findPath(fromPx: Pt, toTile: Pt): Pt[] | null {
  let sx = Math.floor(fromPx.x / TILE), sy = Math.floor(fromPx.y / TILE);
  if (!isFloor(sx, sy)) {
    // đứng sát mép: tìm ô sàn gần nhất
    let best: Pt | null = null, bd = 1e9;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (isFloor(sx + dx, sy + dy)) {
        const c = tileCenter(sx + dx, sy + dy);
        const d = Math.hypot(c.x - fromPx.x, c.y - fromPx.y);
        if (d < bd) { bd = d; best = { x: sx + dx, y: sy + dy }; }
      }
    }
    if (!best) return null;
    sx = best.x; sy = best.y;
  }
  const gx = toTile.x, gy = toTile.y;
  if (!isFloor(gx, gy)) return null;
  stamp++;
  const start = sy * MAP_W + sx, goal = gy * MAP_W + gx;
  const queue = new Int32Array(MAP_W * MAP_H);
  let qh = 0, qt = 0;
  queue[qt++] = start;
  seen[start] = stamp;
  prev[start] = -1;
  while (qh < qt) {
    const cur = queue[qh++];
    if (cur === goal) break;
    const cx = cur % MAP_W, cy = (cur / MAP_W) | 0;
    // Cổng thang bộ: từ ô cuối làn cầu thang sang tầng kia
    const portal = PORTAL_AT.get(cur);
    if (portal) {
      const ni = portal.to.y * MAP_W + portal.to.x;
      if (seen[ni] !== stamp) { seen[ni] = stamp; prev[ni] = cur; queue[qt++] = ni; }
      continue; // đã bước vào cổng thì chỉ có thể sang tầng kia
    }
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!isFloor(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!isFloor(cx + dx, cy) || !isFloor(cx, cy + dy))) continue;
      const ni = ny * MAP_W + nx;
      if (seen[ni] === stamp) continue;
      seen[ni] = stamp;
      prev[ni] = cur;
      queue[qt++] = ni;
    }
  }
  if (seen[goal] !== stamp) return null;
  const out: Pt[] = [];
  for (let c = goal; c !== -1; c = prev[c]) {
    out.push(tileCenter(c % MAP_W, (c / MAP_W) | 0));
  }
  out.reverse();
  if (out.length > 1) out.shift(); // bỏ ô đang đứng
  return out;
}

export function pathLength(p: Pt[] | null): number {
  if (!p) return Infinity;
  return p.length;
}
