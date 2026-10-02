// Kiểm tra bản đồ nhiều tầng: mọi điểm quan trọng nằm trên sàn và đi tới được (qua thang bộ)
import { STATIONS, HIDE_SPOTS, DESKS, SPAWNS, isFloor, GRID, MAP_W, levelAt, tileCenter, BELL_STAND, LIFT_DOORS, PORTALS, CABIN } from '../src/game/map';
import { findPath } from '../src/game/path';
let bad = 0;
const start = tileCenter(SPAWNS[0].x, SPAWNS[0].y);
const check = (name: string, x: number, y: number, needPath = true) => {
  const ok = isFloor(x, y);
  const lvl = levelAt(x * 48 + 24, y * 48 + 24);
  let reach = true;
  if (ok && needPath && lvl !== 0) reach = !!findPath(start, { x, y });
  if (!ok || !reach) { bad++; console.log('✘', name, x, y, 'tầng', lvl, ok ? '' : 'KHÔNG PHẢI SÀN (' + GRID[y * MAP_W + x] + ')', reach ? '' : 'KHÔNG ĐI TỚI ĐƯỢC'); }
};
for (const s of STATIONS) check('trạm ' + s.id, s.stand.x, s.stand.y, s.room !== 'cabin');
for (const h of HIDE_SPOTS) check('trốn ' + h.id, h.x, h.y, h.level !== 0);
DESKS.forEach((d, i) => check('ghế ' + i, d.seat.x, d.seat.y));
SPAWNS.forEach((s, i) => check('spawn ' + i, s.x, s.y));
check('chuông', BELL_STAND.x, BELL_STAND.y);
for (const ld of LIFT_DOORS) check('trước thang máy tầng ' + ld.level, Math.floor(ld.front.x), ld.front.y);
for (const p of PORTALS) { check('cổng ' + p.label, p.from.x, p.from.y); check('đến ' + p.label, p.to.x, p.to.y); }
const roofTarget = { x: 40 + 4, y: 24 + 4 };
const pth = findPath(start, roofTarget);
console.log('Đường từ phòng họp lên vườn mái:', pth ? pth.length + ' bước' : 'KHÔNG CÓ');
const t1 = findPath(start, { x: 34, y: 15 });
console.log('Đường từ phòng họp xuống cầu dao tầng 1:', t1 ? t1.length + ' bước' : 'KHÔNG CÓ');
console.log(bad ? `${bad} lỗi` : 'Bản đồ ổn: mọi điểm đều trên sàn và đi tới được');
