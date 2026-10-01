// Bản đồ văn phòng: thuần dữ liệu, không phụ thuộc Phaser (dùng được cả ở server/host sau này)

export const TILE = 48;
export const MAP_W = 46;
export const MAP_H = 32;

export type RoomId = 'director' | 'server' | 'hall_top' | 'hall_mid' | 'open' | 'pantry' | 'wc' | 'hall_bottom';

export interface Rect { x: number; y: number; w: number; h: number }

export interface Room extends Rect { id: RoomId; name: string; floor: number; floor2: number; label: boolean }

export const ROOMS: Room[] = [
  { id: 'director', name: 'Phòng Giám đốc', x: 1, y: 1, w: 11, h: 10, floor: 0xc99a6e, floor2: 0xbf8f63, label: true },
  { id: 'server', name: 'Phòng Server', x: 34, y: 1, w: 11, h: 10, floor: 0x9eb3c9, floor2: 0x93a8bf, label: true },
  { id: 'hall_top', name: 'Hành lang', x: 13, y: 4, w: 20, h: 4, floor: 0xd8d2c4, floor2: 0xcfc8b8, label: false },
  { id: 'hall_mid', name: 'Hành lang', x: 20, y: 8, w: 5, h: 4, floor: 0xd8d2c4, floor2: 0xcfc8b8, label: false },
  { id: 'open', name: 'Open Space', x: 6, y: 12, w: 34, h: 11, floor: 0xe6d9b8, floor2: 0xdccea9, label: true },
  { id: 'pantry', name: 'Pantry', x: 1, y: 24, w: 13, h: 7, floor: 0xf3e4b0, floor2: 0xe9d593, label: true },
  { id: 'wc', name: 'Nhà vệ sinh', x: 34, y: 24, w: 11, h: 7, floor: 0xbfe6e2, floor2: 0xaedbd6, label: true },
  { id: 'hall_bottom', name: 'Hành lang', x: 15, y: 26, w: 18, h: 3, floor: 0xd8d2c4, floor2: 0xcfc8b8, label: false },
];

// Cửa và lối đi nối các phòng (ô sàn khắc thêm vào tường)
export const DOORS: { x: number; y: number; room: RoomId }[] = [
  { x: 12, y: 5, room: 'hall_top' }, { x: 12, y: 6, room: 'hall_top' },
  { x: 33, y: 5, room: 'hall_top' }, { x: 33, y: 6, room: 'hall_top' },
  { x: 9, y: 23, room: 'open' }, { x: 10, y: 23, room: 'open' },
  { x: 36, y: 23, room: 'open' }, { x: 37, y: 23, room: 'open' },
  { x: 14, y: 27, room: 'hall_bottom' },
  { x: 33, y: 27, room: 'hall_bottom' },
  { x: 23, y: 23, room: 'hall_bottom' }, { x: 24, y: 23, room: 'hall_bottom' },
  { x: 23, y: 24, room: 'hall_bottom' }, { x: 24, y: 24, room: 'hall_bottom' },
  { x: 23, y: 25, room: 'hall_bottom' }, { x: 24, y: 25, room: 'hall_bottom' },
];

export type FurnitureKind =
  | 'desk' | 'bigdesk' | 'rack' | 'fridge' | 'coffee' | 'copier' | 'computer' | 'meetingtable'
  | 'router' | 'panel' | 'sink' | 'pantrytable' | 'sofa' | 'plant' | 'watercooler';

export interface Furniture extends Rect { kind: FurnitureKind; blocking: boolean }

// Bàn làm việc: mỗi người một bàn, "chỗ ngồi" là ô ngay dưới bàn
export const DESKS: { x: number; y: number; seat: { x: number; y: number } }[] = [];
const deskSpots: [number, number][] = [
  [9, 14], [13, 14], [27, 14], [31, 14],
  [9, 18], [13, 18], [27, 18], [31, 18],
  [27, 21], [31, 21],
];
for (const [x, y] of deskSpots) DESKS.push({ x, y, seat: { x, y: y + 1 } });

export const FURNITURE: Furniture[] = [
  ...DESKS.map(d => ({ kind: 'desk' as const, x: d.x, y: d.y, w: 2, h: 1, blocking: true })),
  { kind: 'meetingtable', x: 21, y: 16, w: 3, h: 3, blocking: true },
  { kind: 'copier', x: 37, y: 13, w: 2, h: 1, blocking: true },
  { kind: 'computer', x: 37, y: 20, w: 2, h: 1, blocking: true },
  { kind: 'plant', x: 6, y: 12, w: 1, h: 1, blocking: true },
  { kind: 'plant', x: 39, y: 22, w: 1, h: 1, blocking: true },
  { kind: 'watercooler', x: 6, y: 22, w: 1, h: 1, blocking: true },
  // Phòng giám đốc
  { kind: 'bigdesk', x: 4, y: 4, w: 4, h: 2, blocking: true },
  { kind: 'sofa', x: 2, y: 8, w: 3, h: 1, blocking: true },
  { kind: 'plant', x: 11, y: 10, w: 1, h: 1, blocking: true },
  // Phòng server
  { kind: 'rack', x: 36, y: 2, w: 2, h: 2, blocking: true },
  { kind: 'rack', x: 40, y: 2, w: 2, h: 2, blocking: true },
  { kind: 'rack', x: 36, y: 7, w: 2, h: 2, blocking: true },
  { kind: 'router', x: 44, y: 5, w: 1, h: 1, blocking: true },
  // Pantry
  { kind: 'fridge', x: 1, y: 24, w: 2, h: 1, blocking: true },
  { kind: 'coffee', x: 5, y: 24, w: 2, h: 1, blocking: true },
  { kind: 'pantrytable', x: 6, y: 27, w: 4, h: 2, blocking: true },
  // WC
  { kind: 'sink', x: 36, y: 24, w: 3, h: 1, blocking: true },
  // Hành lang dưới: tủ điện gắn tường
  { kind: 'panel', x: 30, y: 25, w: 1, h: 1, blocking: true },
];

export type TaskKind = 'excel' | 'wires' | 'fridge' | 'coffee' | 'copier' | 'stamp';
export type FixKind = 'router' | 'power';

export interface Station {
  id: string;
  kind: TaskKind | FixKind;
  name: string;
  room: RoomId;
  stand: { x: number; y: number }; // ô đứng để thao tác
  mark: { x: number; y: number };  // ô hiển thị dấu "!"
}

export const TASK_STATIONS: Station[] = [
  { id: 'excel', kind: 'excel', name: 'Nhập liệu Excel', room: 'open', stand: { x: 37, y: 21 }, mark: { x: 37.5, y: 20 } },
  { id: 'copier', kind: 'copier', name: 'Gỡ kẹt máy photocopy', room: 'open', stand: { x: 37, y: 14 }, mark: { x: 37.5, y: 13 } },
  { id: 'wires', kind: 'wires', name: 'Nối lại dây cáp server', room: 'server', stand: { x: 40, y: 4 }, mark: { x: 40.5, y: 2.5 } },
  { id: 'fridge', kind: 'fridge', name: 'Dọn đồ mốc trong tủ lạnh', room: 'pantry', stand: { x: 2, y: 25 }, mark: { x: 1.5, y: 24 } },
  { id: 'coffee', kind: 'coffee', name: 'Pha cà phê cho sếp', room: 'pantry', stand: { x: 5, y: 25 }, mark: { x: 5.5, y: 24 } },
  { id: 'stamp', kind: 'stamp', name: 'Ký duyệt hồ sơ', room: 'director', stand: { x: 5, y: 6 }, mark: { x: 5.5, y: 4.5 } },
];

export const FIX_STATIONS: Station[] = [
  { id: 'router', kind: 'router', name: 'Khởi động lại Router', room: 'server', stand: { x: 43, y: 5 }, mark: { x: 44, y: 5 } },
  { id: 'power', kind: 'power', name: 'Bật lại cầu dao', room: 'hall_bottom', stand: { x: 30, y: 26 }, mark: { x: 30, y: 25 } },
];

// Bàn họp có chuông báo cháy (gọi họp khẩn)
export const BELL = { x: 22.5, y: 17.5, room: 'open' as RoomId };

// Chỗ trốn của Nội gián: nối thành vòng, trốn ở chỗ này có thể chuồn sang chỗ khác
export const HIDE_SPOTS: { id: string; name: string; x: number; y: number }[] = [
  { id: 'gam_ban', name: 'Gầm bàn', x: 34, y: 17 },
  { id: 'tu_ho_so', name: 'Tủ hồ sơ', x: 43, y: 9 },
  { id: 'thang_may', name: 'Thang máy VIP', x: 2, y: 2 },
  { id: 'tu_do', name: 'Tủ đồ Pantry', x: 12, y: 29 },
  { id: 'buong_wc', name: 'Buồng vệ sinh', x: 43, y: 29 },
];

// Vị trí xuất phát quanh bàn họp
export const SPAWNS: { x: number; y: number }[] = [
  { x: 20, y: 15 }, { x: 22, y: 15 }, { x: 24, y: 15 }, { x: 25, y: 17 }, { x: 24, y: 19 },
  { x: 22, y: 19 }, { x: 20, y: 19 }, { x: 19, y: 17 }, { x: 19, y: 15 }, { x: 25, y: 19 },
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

// Kiểm tra va chạm với hộp chân nhân vật (rộng 24, cao 14)
export function canStand(px: number, py: number): boolean {
  const hw = 11, hh = 7;
  const pts = [
    [px - hw, py - hh], [px + hw, py - hh], [px - hw, py + hh], [px + hw, py + hh],
  ];
  for (const [x, y] of pts) {
    if (!isFloor(Math.floor(x / TILE), Math.floor(y / TILE))) return false;
  }
  return true;
}
