// Bản đồ văn phòng 13 phòng: thuần dữ liệu, không phụ thuộc Phaser

export const TILE = 48;
export const MAP_W = 66;
export const MAP_H = 46;

export type RoomId =
  | 'director' | 'hr' | 'meeting' | 'art' | 'server'
  | 'reception' | 'open' | 'qa'
  | 'pantry' | 'wc' | 'print' | 'security' | 'power'
  | 'hall_top' | 'hall_bottom' | 'hall_left' | 'hall_right';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Room extends Rect { id: RoomId; name: string; floor: number; floor2: number; label: boolean; pattern: 'plain' | 'checker' | 'stripe' }

const HALL = { floor: 0xd8d2c4, floor2: 0xcfc8b8, label: false, pattern: 'plain' as const };
export const ROOMS: Room[] = [
  { id: 'director', name: 'Phòng Giám đốc', x: 1, y: 1, w: 12, h: 10, floor: 0xc99a6e, floor2: 0xbf8f63, label: true, pattern: 'stripe' },
  { id: 'hr', name: 'Phòng HR', x: 14, y: 1, w: 12, h: 10, floor: 0xf2d4dc, floor2: 0xead0d6, label: true, pattern: 'plain' },
  { id: 'meeting', name: 'Phòng họp', x: 27, y: 1, w: 12, h: 10, floor: 0xd9d4ee, floor2: 0xd0caea, label: true, pattern: 'plain' },
  { id: 'art', name: 'Studio Art', x: 40, y: 1, w: 12, h: 10, floor: 0xf6e7c1, floor2: 0xefdcae, label: true, pattern: 'stripe' },
  { id: 'server', name: 'Phòng Server', x: 53, y: 1, w: 12, h: 10, floor: 0x9eb3c9, floor2: 0x93a8bf, label: true, pattern: 'checker' },
  { id: 'reception', name: 'Lễ tân', x: 1, y: 17, w: 12, h: 14, floor: 0xe9d9c9, floor2: 0xe0cdbb, label: true, pattern: 'checker' },
  { id: 'open', name: 'Open Space', x: 17, y: 17, w: 32, h: 14, floor: 0xe6d9b8, floor2: 0xdccea9, label: true, pattern: 'plain' },
  { id: 'qa', name: 'Phòng QA', x: 53, y: 17, w: 12, h: 14, floor: 0xcfe8d2, floor2: 0xc3e0c7, label: true, pattern: 'plain' },
  { id: 'pantry', name: 'Pantry', x: 1, y: 37, w: 12, h: 8, floor: 0xf3e4b0, floor2: 0xe9d593, label: true, pattern: 'checker' },
  { id: 'wc', name: 'Nhà vệ sinh', x: 14, y: 37, w: 12, h: 8, floor: 0xbfe6e2, floor2: 0xaedbd6, label: true, pattern: 'checker' },
  { id: 'print', name: 'Phòng in ấn', x: 27, y: 37, w: 12, h: 8, floor: 0xdedfe6, floor2: 0xd3d5de, label: true, pattern: 'plain' },
  { id: 'security', name: 'Phòng bảo vệ', x: 40, y: 37, w: 12, h: 8, floor: 0xb9c0d6, floor2: 0xaeb6ce, label: true, pattern: 'checker' },
  { id: 'power', name: 'Kho điện', x: 53, y: 37, w: 12, h: 8, floor: 0xc9c2b4, floor2: 0xbfb7a8, label: true, pattern: 'stripe' },
  { id: 'hall_top', name: 'Hành lang trên', x: 1, y: 12, w: 64, h: 4, ...HALL },
  { id: 'hall_bottom', name: 'Hành lang dưới', x: 1, y: 32, w: 64, h: 4, ...HALL },
  { id: 'hall_left', name: 'Hành lang trái', x: 14, y: 16, w: 2, h: 16, ...HALL },
  { id: 'hall_right', name: 'Hành lang phải', x: 50, y: 16, w: 2, h: 16, ...HALL },
];

// Cửa: các ô khắc xuyên tường
const door = (xs: number[], ys: number[], room: RoomId) => xs.flatMap(x => ys.map(y => ({ x, y, room })));
export const DOORS: { x: number; y: number; room: RoomId }[] = [
  // dãy trên -> hành lang trên (tường hàng 11)
  ...door([6, 7], [11], 'hall_top'), ...door([19, 20], [11], 'hall_top'), ...door([32, 33], [11], 'hall_top'),
  ...door([45, 46], [11], 'hall_top'), ...door([58, 59], [11], 'hall_top'),
  // dãy giữa <-> hành lang trên (tường hàng 16)
  ...door([5, 6], [16], 'hall_top'), ...door([34, 35], [16], 'hall_top'), ...door([58, 59], [16], 'hall_top'),
  // dãy giữa <-> hành lang dưới (tường hàng 31)
  ...door([5, 6], [31], 'hall_bottom'), ...door([34, 35], [31], 'hall_bottom'), ...door([58, 59], [31], 'hall_bottom'),
  // cửa hông
  ...door([13], [23, 24], 'hall_left'), ...door([16], [23, 24], 'hall_left'),
  ...door([49], [23, 24], 'hall_right'), ...door([52], [23, 24], 'hall_right'),
  // dãy dưới -> hành lang dưới (tường hàng 36)
  ...door([6, 7], [36], 'hall_bottom'), ...door([19, 20], [36], 'hall_bottom'), ...door([32, 33], [36], 'hall_bottom'),
  ...door([41, 42], [36], 'hall_bottom'), ...door([58, 59], [36], 'hall_bottom'),
];

export type FurnitureKind =
  | 'desk' | 'bigdesk' | 'rack' | 'fridge' | 'coffee' | 'copier' | 'computer' | 'meetingtable'
  | 'router' | 'panel' | 'sink' | 'pantrytable' | 'sofa' | 'plant' | 'watercooler'
  | 'counter' | 'scanner' | 'boxes' | 'bigplant' | 'easel' | 'kanban' | 'projector' | 'printer'
  | 'monitors' | 'shelf' | 'paper' | 'whiteboard' | 'hrdesk' | 'tap';

export interface Furniture extends Rect { kind: FurnitureKind; blocking: boolean }

// Bàn làm việc ở Open Space: mỗi người một bàn, chỗ ngồi là ô ngay dưới bàn
export const DESKS: { x: number; y: number; seat: { x: number; y: number } }[] = [];
for (const y of [19, 25]) for (const x of [20, 24, 28, 37, 41, 45]) DESKS.push({ x, y, seat: { x, y: y + 1 } });

const F = (kind: FurnitureKind, x: number, y: number, w = 1, h = 1, blocking = true): Furniture => ({ kind, x, y, w, h, blocking });

export const FURNITURE: Furniture[] = [
  ...DESKS.map(d => F('desk', d.x, d.y, 2, 1)),
  // Open Space
  F('kanban', 29, 17, 3, 1), F('computer', 46, 29, 2, 1), F('plant', 17, 17), F('plant', 48, 17), F('watercooler', 17, 30),
  // Giám đốc
  F('bigdesk', 4, 3, 4, 2), F('sofa', 2, 8, 3, 1), F('plant', 12, 9),
  // HR
  F('hrdesk', 17, 3, 3, 1), F('shelf', 22, 1, 2, 1), F('plant', 25, 9),
  // Phòng họp
  F('meetingtable', 30, 4, 6, 4), F('whiteboard', 28, 1, 2, 1), F('projector', 37, 1, 1, 1),
  // Studio Art
  F('easel', 43, 3), F('easel', 47, 3), F('pantrytable', 43, 7, 4, 2), F('plant', 51, 9),
  // Server
  F('rack', 55, 2, 2, 2), F('rack', 59, 2, 2, 2), F('rack', 55, 6, 2, 2), F('router', 64, 5), F('computer', 61, 8, 2, 1),
  // Lễ tân
  F('counter', 3, 20, 6, 1), F('scanner', 10, 17), F('boxes', 2, 27, 2, 2), F('bigplant', 11, 29), F('sofa', 7, 26, 3, 1),
  // QA
  F('computer', 55, 19, 2, 1), F('computer', 60, 19, 2, 1), F('shelf', 55, 29, 3, 1), F('plant', 64, 17),
  // Pantry
  F('fridge', 1, 37, 2, 1), F('coffee', 3, 37, 2, 1), F('tap', 9, 37, 3, 1), F('pantrytable', 5, 41, 4, 2),
  // WC
  F('sink', 16, 37, 3, 1), F('paper', 24, 37),
  // In ấn
  F('copier', 29, 37, 2, 1), F('printer', 35, 37, 2, 1), F('shelf', 36, 44, 2, 1),
  // Bảo vệ
  F('monitors', 44, 37, 6, 1), F('plant', 51, 44),
  // Kho điện
  F('panel', 62, 37), F('shelf', 60, 41, 4, 2),
];

export type MiniKind =
  | 'fingerprint' | 'delivery' | 'waterplant' | 'excel' | 'backlog' | 'sprite' | 'bug' | 'testbuild'
  | 'interview' | 'balance' | 'projector' | 'coffee' | 'fridge' | 'getwater' | 'toilet' | 'copier'
  | 'printdoc' | 'minutes' | 'stamp' | 'wires' | 'pushbuild' | 'router' | 'power';

export interface Station {
  id: MiniKind | 'camera';
  name: string;
  room: RoomId;
  stand: { x: number; y: number };
  mark: { x: number; y: number }; // tâm dấu "!" (đơn vị ô)
}

const S = (id: Station['id'], name: string, room: RoomId, sx: number, sy: number, mx: number, my: number): Station =>
  ({ id, name, room, stand: { x: sx, y: sy }, mark: { x: mx, y: my } });

export const STATIONS: Station[] = [
  S('fingerprint', 'Chấm công vân tay', 'reception', 10, 18, 10.5, 17),
  S('delivery', 'Ký nhận hàng', 'reception', 4, 28, 3, 27),
  S('waterplant', 'Tưới cây', 'reception', 10, 29, 11.5, 29),
  S('excel', 'Nhập liệu Excel', 'open', 46, 28, 47, 29),
  S('backlog', 'Sắp xếp backlog', 'open', 30, 18, 30.5, 17),
  S('sprite', 'Tô màu sprite', 'art', 43, 4, 43.5, 3),
  S('bug', 'Tái hiện bug', 'qa', 55, 20, 56, 19),
  S('testbuild', 'Test bản build', 'qa', 60, 20, 61, 19),
  S('interview', 'Xếp lịch phỏng vấn', 'hr', 18, 4, 18.5, 3),
  S('balance', 'Cân bằng chỉ số game', 'meeting', 28, 2, 29, 1),
  S('projector', 'Bật máy chiếu', 'meeting', 37, 2, 37.5, 1),
  S('coffee', 'Pha cà phê cho sếp', 'pantry', 3, 38, 4, 37),
  S('fridge', 'Dọn tủ lạnh mốc', 'pantry', 2, 38, 2, 37),
  S('getwater', 'Lấy nước tưới cây', 'pantry', 10, 38, 10.5, 37),
  S('toilet', 'Thay cuộn giấy', 'wc', 24, 38, 24.5, 37),
  S('copier', 'Gỡ kẹt photocopy', 'print', 29, 38, 30, 37),
  S('printdoc', 'In tài liệu', 'print', 35, 38, 36, 37),
  S('minutes', 'Lấy biên bản họp', 'print', 36, 43, 37, 44),
  S('stamp', 'Ký duyệt hồ sơ', 'director', 5, 5, 6, 3.5),
  S('wires', 'Nối lại dây cáp', 'server', 59, 4, 60, 2.5),
  S('pushbuild', 'Đẩy bản build', 'server', 61, 9, 62, 8),
  S('router', 'Khởi động lại router', 'server', 63, 5, 64.5, 5),
  S('power', 'Bật lại cầu dao', 'power', 62, 38, 62.5, 37),
  S('camera', 'Xem camera an ninh', 'security', 46, 38, 47, 37),
];
export const station = (id: string) => STATIONS.find(s => s.id === id)!;

export type TaskType = 'common' | 'short' | 'long';
export interface TaskDef { id: string; name: string; type: TaskType; steps: MiniKind[]; visual?: boolean }

export const TASKS: TaskDef[] = [
  { id: 'chamcong', name: 'Chấm công vân tay', type: 'common', steps: ['fingerprint'], visual: true },
  { id: 'excel', name: 'Nhập liệu Excel', type: 'short', steps: ['excel'] },
  { id: 'backlog', name: 'Sắp xếp backlog', type: 'short', steps: ['backlog'] },
  { id: 'sprite', name: 'Tô màu sprite', type: 'short', steps: ['sprite'] },
  { id: 'bug', name: 'Tái hiện bug', type: 'short', steps: ['bug'] },
  { id: 'interview', name: 'Xếp lịch phỏng vấn', type: 'short', steps: ['interview'] },
  { id: 'balance', name: 'Cân bằng chỉ số game', type: 'short', steps: ['balance'] },
  { id: 'coffee', name: 'Pha cà phê cho sếp', type: 'short', steps: ['coffee'] },
  { id: 'fridge', name: 'Dọn tủ lạnh mốc', type: 'short', steps: ['fridge'] },
  { id: 'delivery', name: 'Ký nhận hàng', type: 'short', steps: ['delivery'] },
  { id: 'toilet', name: 'Thay cuộn giấy', type: 'short', steps: ['toilet'] },
  { id: 'copier', name: 'Gỡ kẹt photocopy', type: 'short', steps: ['copier'] },
  { id: 'wires', name: 'Nối lại dây cáp', type: 'short', steps: ['wires'] },
  { id: 'trinhky', name: 'Trình ký', type: 'long', steps: ['printdoc', 'stamp'] },
  { id: 'build', name: 'Ra bản build', type: 'long', steps: ['pushbuild', 'testbuild'] },
  { id: 'tuoicay', name: 'Tưới cây', type: 'long', steps: ['getwater', 'waterplant'] },
  { id: 'giaoban', name: 'Họp giao ban', type: 'long', steps: ['projector', 'minutes'] },
];
export const taskDef = (id: string) => TASKS.find(t => t.id === id)!;

// Phòng họp: chuông họp khẩn ở giữa bàn
export const BELL = { x: 33, y: 6, room: 'meeting' as RoomId };

// Chỗ trốn theo cặp: trốn ở chỗ này chỉ chuồn được sang chỗ cùng cặp
export const HIDE_SPOTS: { id: string; name: string; x: number; y: number; pair: number }[] = [
  { id: 'thang_may_gd', name: 'Thang máy VIP (Giám đốc)', x: 2, y: 2, pair: 1 },
  { id: 'thang_may_lt', name: 'Thang máy VIP (Lễ tân)', x: 2, y: 18, pair: 0 },
  { id: 'tu_hs_hr', name: 'Tủ hồ sơ (HR)', x: 24, y: 2, pair: 3 },
  { id: 'tu_hs_in', name: 'Tủ hồ sơ (In ấn)', x: 28, y: 43, pair: 2 },
  { id: 'gam_ban_os', name: 'Gầm bàn dài (Open Space)', x: 33, y: 22, pair: 5 },
  { id: 'gam_ban_hop', name: 'Gầm bàn dài (Phòng họp)', x: 37, y: 9, pair: 4 },
  { id: 'san_kt_sv', name: 'Sàn kỹ thuật (Server)', x: 63, y: 9, pair: 7 },
  { id: 'san_kt_qa', name: 'Sàn kỹ thuật (QA)', x: 63, y: 29, pair: 6 },
  { id: 'buong_wc', name: 'Buồng vệ sinh', x: 24, y: 43, pair: 9 },
  { id: 'kho', name: 'Góc kho điện', x: 54, y: 43, pair: 8 },
];

// Chỗ đứng quanh bàn họp (đầu ván và sau mỗi cuộc họp)
export const SPAWNS: { x: number; y: number }[] = [
  ...[30, 31, 32, 33, 34, 35].map(x => ({ x, y: 3 })),
  ...[30, 31, 32, 33, 34, 35].map(x => ({ x, y: 8 })),
];

// Camera an ninh: vùng nhìn theo ô
export const CAMERAS: { name: string; x: number; y: number; w: number; h: number }[] = [
  { name: 'Lễ tân', x: 1, y: 17, w: 12, h: 14 },
  { name: 'Open Space', x: 17, y: 17, w: 32, h: 14 },
  { name: 'Pantry', x: 1, y: 37, w: 12, h: 8 },
  { name: 'Hành lang trên', x: 20, y: 11, w: 26, h: 6 },
];

// ---------- Lưới va chạm ----------
// 0 = tường, 1 = sàn, 2 = đồ nội thất chặn đường
export const GRID: Uint8Array = new Uint8Array(MAP_W * MAP_H);
export const ROOM_GRID: (RoomId | null)[] = new Array(MAP_W * MAP_H).fill(null);

for (const r of ROOMS) {
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) {
      GRID[y * MAP_W + x] = 1;
      ROOM_GRID[y * MAP_W + x] = r.id;
    }
}
for (const d of DOORS) {
  GRID[d.y * MAP_W + d.x] = 1;
  ROOM_GRID[d.y * MAP_W + d.x] = d.room;
}
for (const f of FURNITURE) {
  if (!f.blocking) continue;
  for (let y = f.y; y < f.y + f.h; y++)
    for (let x = f.x; x < f.x + f.w; x++) {
      if (GRID[y * MAP_W + x] === 1) GRID[y * MAP_W + x] = 2;
    }
}

export function isFloor(tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
  return GRID[ty * MAP_W + tx] === 1;
}

export function isWallTile(tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
  return GRID[ty * MAP_W + tx] === 0;
}

export function roomAt(px: number, py: number): RoomId | null {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return null;
  return ROOM_GRID[ty * MAP_W + tx];
}

export function roomName(id: RoomId | null): string {
  if (!id) return 'Hành lang';
  return ROOMS.find(r => r.id === id)?.name ?? 'Hành lang';
}

export function tileCenter(tx: number, ty: number) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

// Kiểm tra va chạm với hộp chân nhân vật
export function canStand(px: number, py: number): boolean {
  const hw = 11, hh = 7;
  const pts = [[px - hw, py - hh], [px + hw, py - hh], [px - hw, py + hh], [px + hw, py + hh]];
  for (const [x, y] of pts) if (!isFloor(Math.floor(x / TILE), Math.floor(y / TILE))) return false;
  return true;
}
