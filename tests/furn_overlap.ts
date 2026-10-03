// Kiểm tra phần nhô lên của đồ đạc (góc nhìn 3/4) không che lối trốn, chỗ đứng làm việc, cửa, cửa thang máy
import { FURNITURE, HIDE_SPOTS, STATIONS, LIFT_DOORS, PORTALS, TILE, GRID, MAP_W } from '../src/game/map';
import { furnitureArt } from '../src/render/furniture';
let bad = 0;
const covers = (f: typeof FURNITURE[0], tx: number, ty: number) => {
  let low = true; for (let x = f.x; x < f.x + f.w; x++) if (GRID[(f.y + f.h) * MAP_W + x] !== 0) low = false;
  const art = furnitureArt(f.kind, f.w * TILE, f.h * TILE, { low });
  const x0 = f.x * TILE - art.left, x1 = (f.x + f.w) * TILE + art.right, y0 = f.y * TILE - art.up, y1 = f.y * TILE;
  // ô (tx,ty) nằm trong phần nhô lên phía trên chân đế (không tính chính chân đế)
  const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
  return cx > x0 + 6 && cx < x1 - 6 && cy > y0 && cy < y1;
};
for (const f of FURNITURE) {
  for (const h of HIDE_SPOTS) if (covers(f, h.x, h.y)) { bad++; console.log('Che lối trốn:', f.kind, `(${f.x},${f.y})`, '→', h.id); }
  for (const s of STATIONS) if (covers(f, s.stand.x, s.stand.y)) { bad++; console.log('Che chỗ đứng làm việc:', f.kind, `(${f.x},${f.y})`, '→', s.id); }
  for (const d of LIFT_DOORS) for (const t of d.tiles) if (covers(f, t.x, t.y)) { bad++; console.log('Che cửa thang máy:', f.kind, d.level); }
  for (const p of PORTALS) if (covers(f, p.from.x, p.from.y)) { bad++; console.log('Che cửa thoát hiểm:', f.kind, p.label); }
}
console.log(bad ? `CÓ ${bad} CHỖ CHE SAI` : 'Không có chỗ nào bị che sai');
