// Bản đồ tòa văn phòng 3 tầng + sân thượng: thuần dữ liệu, không phụ thuộc Phaser.
// Các tầng được xếp thành lưới 2×2 trên cùng một bản đồ (không thông nhau);
// đi lại giữa các tầng bằng thang bộ (cổng dịch chuyển ở cuối mỗi đoạn cầu thang) hoặc thang máy (một buồng duy nhất).

export const TILE = 48;
export const MAP_W = 78;
export const MAP_H = 76; // thêm giếng thang bộ riêng ở dưới cùng bản đồ

/** Các tầng: gốc tọa độ (ô) của từng tầng trên bản đồ */
export interface FloorDef { id: number; name: string; short: string; ox: number; oy: number; w: number; h: number }
export const FLOORS: FloorDef[] = [
  { id: 1, name: 'Tầng 1', short: '1', ox: 0, oy: 0, w: 31, h: 19 },
  { id: 2, name: 'Tầng 2', short: '2', ox: 40, oy: 0, w: 31, h: 19 }, // bản đồ mới: tầng nhỏ gọn hơn
  { id: 3, name: 'Tầng 3', short: '3', ox: 0, oy: 24, w: 31, h: 19 },
  { id: 4, name: 'Sân thượng', short: 'S', ox: 40, oy: 24, w: 38, h: 14 },
];
export const ROOF = 4;
/** Buồng thang máy (nằm riêng, dùng chung cho mọi tầng) */
export const CABIN = { x: 67, y: 41, w: 4, h: 3 };
export const LIFT_FLOORS = [1, 2, 3]; // thang máy không lên sân thượng
/** Giếng thang bộ: khu riêng dùng chung cho cả tòa, chiếu nghỉ từ sân thượng (trên cùng) xuống tầng 1 */
/** Bản đồ mới: mỗi tầng chỉ một đoạn thang thẳng (trước: hai đoạn zíc zắc), chiếu nghỉ cách nhau STAIR_STEP hàng */
export const STAIR_STEP = 8; // đoạn thang 5 bậc: thang bộ nhanh gấp đôi trước, thang máy (buồng có sẵn) vẫn nhanh hơn
export const STAIRWELL = { x: 3, y: 48, w: 5, h: 3 * STAIR_STEP + 3 }; // chiếu nghỉ 5 ô (đoạn thang 2 ô sát cửa + chỗ đứng)
export const STAIRS_LEVEL = 5;
/** Chiếu nghỉ từng tầng trong giếng thang (hàng giữa của chiếu nghỉ). Giữa hai chiếu nghỉ là hai đoạn cầu thang gấp khúc */
export const LANDINGS = [4, 3, 2, 1].map((lv, i) => ({ level: lv, y: STAIRWELL.y + i * STAIR_STEP + 1 }));
/** Các ô bậc thang (để vẽ): mỗi tầng hai đoạn chạy ngang hết bề rộng giếng thang */
/** Đoạn thang thẳng đứng sát cửa vào (2 ô × (STAIR_STEP − 3) bậc) giữa hai chiếu nghỉ */
export const STAIR_FLIGHTS: { x: number; y: number; w: number; h: number }[] = [0, 1, 2].map(i => ({ x: STAIRWELL.x, y: STAIRWELL.y + i * STAIR_STEP + 3, w: 2, h: STAIR_STEP - 3 }));

export type RoomId =
  | 'director' | 'hr' | 'meeting' | 'art' | 'server'
  | 'reception' | 'open' | 'qa'
  | 'pantry' | 'fun' | 'print' | 'security' | 'power'
  | 'hall1' | 'hall2' | 'hall3' | 'stairs'
  | 'roof_garden' | 'roof_terrace' | 'roof_ac' | 'cabin';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Room extends Rect { id: RoomId; name: string; floor: number; floor2: number; label: boolean; pattern: 'plain' | 'checker' | 'stripe'; level: number }

/** Gốc tọa độ để đặt phòng, đồ đạc… của từng tầng. Tầng 1–3: tường ngoài phía trên dày 2 ô (hàng trên cùng là đỉnh tường,
 *  hàng thứ hai là mặt tường để treo bảng, cửa sổ), nên gốc tọa độ thấp hơn khung tầng 1 hàng */
export const TOP_WALL = (n: number) => (n >= 1 && n <= 3 ? 1 : 0);
const fl = (n: number) => (TOP_WALL(n) ? { ...FLOORS[n - 1], oy: FLOORS[n - 1].oy + TOP_WALL(n) } : FLOORS[n - 1]);
/** Bản đồ mới: hành lang Tầng 2 cao hơn 2 hàng so với các tầng chưa làm lại (cửa thang máy, cửa thang bộ, camera theo đó) */
const dyHall = (n: number) => (n >= 1 && n <= 3 ? 2 : 0);
const HALL = { floor: 0xd8d2c4, floor2: 0xcfc8b8, label: false, pattern: 'plain' as const };
const STAIR = { floor: 0x8e8a9e, floor2: 0x807c90, label: false, pattern: 'stripe' as const };
const R = (level: number, id: RoomId, name: string, x: number, y: number, w: number, h: number, floor: number, floor2: number, label = true, pattern: Room['pattern'] = 'plain'): Room =>
  ({ id, name, level, x: fl(level).ox + x, y: fl(level).oy + y, w, h, floor, floor2, label, pattern });

export const ROOMS: Room[] = [
  // Tầng 1: Đón tiếp
  R(1, 'reception', 'Lễ tân', 1, 1, 13, 6, 0xe9d9c9, 0xe0cdbb, true, 'checker'),
  R(1, 'security', 'Phòng bảo vệ', 15, 1, 6, 6, 0xb9c0d6, 0xaeb6ce, true, 'checker'),
  R(1, 'fun', 'Khu giải trí', 22, 1, 8, 10, 0xc7e3f2, 0xb8d9eb, true, 'checker'),
  R(1, 'power', 'Kho điện', 1, 12, 7, 5, 0xc9c2b4, 0xbfb7a8, true, 'stripe'),
  { ...R(1, 'hall1', 'Hành lang', 1, 8, 20, 3, 0, 0), ...HALL },
  // Tầng 2: Làm việc (tầng giữa). Bản đồ mới: phòng nhỏ lại, kích thước đa dạng, cửa nối thẳng giữa các phòng phía trên
  R(2, 'open', 'Phòng làm việc', 1, 1, 11, 6, 0xe6d9b8, 0xdccea9),
  R(2, 'meeting', 'Phòng họp', 13, 1, 10, 6, 0xd9d4ee, 0xd0caea),
  R(2, 'print', 'Phòng in ấn', 24, 1, 6, 6, 0xdedfe6, 0xd3d5de),
  R(2, 'pantry', 'Pantry', 1, 12, 11, 5, 0xf3e4b0, 0xe9d593, true, 'checker'),
  { ...R(2, 'hall2', 'Hành lang', 1, 8, 29, 3, 0, 0), ...HALL },
  // Tầng 3: Lãnh đạo và kỹ thuật
  R(3, 'director', 'Phòng Giám đốc', 1, 1, 7, 6, 0xc99a6e, 0xbf8f63, true, 'stripe'),
  R(3, 'hr', 'Phòng HR', 9, 1, 7, 6, 0xf2d4dc, 0xead0d6),
  R(3, 'server', 'Phòng Server', 17, 1, 5, 6, 0x9eb3c9, 0x93a8bf, true, 'checker'),
  R(3, 'qa', 'Phòng QA', 23, 1, 7, 6, 0xcfe8d2, 0xc3e0c7),
  R(3, 'art', 'Studio Art', 1, 12, 10, 5, 0xf6e7c1, 0xefdcae, true, 'stripe'),
  { ...R(3, 'hall3', 'Hành lang', 1, 8, 29, 3, 0, 0), ...HALL },
  // Sân thượng
  R(4, 'roof_garden', 'Vườn mái', 1, 1, 14, 12, 0x9fcf7a, 0x93c56e, true, 'checker'),
  R(4, 'roof_terrace', 'Sân thượng', 16, 1, 6, 7, 0xb8b4a8, 0xaca89c, false, 'checker'),
  R(4, 'roof_ac', 'Khu điều hòa', 23, 1, 14, 12, 0xb8b4a8, 0xaca89c, true, 'checker'),
  // Giếng thang bộ (chiếu nghỉ + các đoạn cầu thang zíc zắc)
  ...[0, 1, 2, 3].map(i => i * STAIR_STEP).map(dy => ({ id: 'stairs' as RoomId, name: 'Thang bộ', level: STAIRS_LEVEL, x: STAIRWELL.x, y: STAIRWELL.y + dy, w: STAIRWELL.w, h: 3, floor: 0x8e8a9e, floor2: 0x86829a, label: false, pattern: 'checker' as const })),
  // Giữa hai chiếu nghỉ: lỗ xuống (trái) → đoạn thang chạy sang phải → lỗ xuống (phải) → đoạn thang chạy sang trái → lỗ xuống (trái)
  ...[0, 1, 2].flatMap(i => {
    const y0 = STAIRWELL.y + i * STAIR_STEP, X = STAIRWELL.x, W = STAIRWELL.w;
    const st = (x: number, y: number, w: number) => ({ id: 'stairs' as RoomId, name: 'Thang bộ', level: STAIRS_LEVEL, x, y, w, h: 1, floor: 0x6f6b80, floor2: 0x67637a, label: false, pattern: 'plain' as const });
    // một đoạn thang thẳng đứng sát cửa vào (2 ô × (STAIR_STEP − 3) bậc): đi thẳng từ chiếu nghỉ này lên/xuống chiếu nghỉ kia
    void W;
    return Array.from({ length: STAIR_STEP - 3 }, (_, k) => st(X, y0 + 3 + k, 2));
  }),
  // Buồng thang máy
  { id: 'cabin', name: 'Thang máy', level: 0, ...CABIN, floor: 0xc9ccd8, floor2: 0xbfc3d0, label: false, pattern: 'checker' },
];

// Cửa giữa các phòng và hành lang (ô khắc xuyên tường)
const D = (level: number, xs: number[], ys: number[], room: RoomId) => xs.flatMap(x => ys.map(y => ({ x: fl(level).ox + x, y: fl(level).oy + y, room })));
export const DOORS: { x: number; y: number; room: RoomId }[] = [
  ...D(1, [3, 4, 10, 11], [7], 'hall1'), ...D(1, [17, 18], [7], 'hall1'), ...D(1, [21], [8, 9], 'hall1'), ...D(1, [4, 5], [11], 'hall1'),
  ...D(1, [14], [3, 4], 'reception'), // cửa nối Lễ tân ↔ Phòng bảo vệ
  ...D(2, [3, 4], [7], 'hall2'), ...D(2, [17, 18], [7], 'hall2'), ...D(2, [26, 27], [7], 'hall2'), ...D(2, [7, 8], [11], 'hall2'),
  // cửa nối thẳng giữa hai phòng (đường vòng): Phòng làm việc ↔ Phòng họp ↔ Phòng in ấn
  ...D(2, [12], [3, 4], 'open'), ...D(2, [23], [3, 4], 'meeting'),
  ...D(3, [3, 4], [7], 'hall3'), ...D(3, [12, 13], [7], 'hall3'), ...D(3, [19, 20], [7], 'hall3'), ...D(3, [26, 27], [7], 'hall3'), ...D(3, [5, 6], [11], 'hall3'),
  ...D(3, [8], [3, 4], 'director'), // cửa nối Phòng Giám đốc ↔ Phòng HR
  ...D(4, [15], [5, 6], 'roof_terrace'), ...D(4, [22], [5, 6], 'roof_terrace'),
];

// ---------- Thang bộ: đi hết đoạn cầu thang là sang tầng kế ----------
// Mỗi giếng thang có làn trái (đi lên) và làn phải (đi xuống). Bước vào ô cuối làn thì dịch chuyển sang tầng kia.
export interface Portal { from: { x: number; y: number }; to: { x: number; y: number }; fromLevel: number; toLevel: number; label: string }
const P = (fl1: number, x1: number, y1: number, fl2: number, x2: number, y2: number, label: string): Portal =>
  ({ from: { x: fl(fl1).ox + x1, y: fl(fl1).oy + y1 }, to: { x: fl(fl2).ox + x2, y: fl(fl2).oy + y2 }, fromLevel: fl1, toLevel: fl2, label });
export const PORTALS: Portal[] = [
  // Cửa thoát hiểm ở mỗi tầng -> chiếu nghỉ tầng đó trong giếng thang, và ngược lại
  ...[1, 2, 3, 4].flatMap(lv => {
    const land = LANDINGS.find(l => l.level === lv)!;
    const door = lv === 4 ? { x: fl(4).ox + 18, y: fl(4).oy + 8 } : { x: fl(lv).ox + 20, y: fl(lv).oy + 13 - dyHall(lv) };
    const front = lv === 4 ? { x: fl(4).ox + 18, y: fl(4).oy + 6 } : { x: fl(lv).ox + 20, y: fl(lv).oy + 11 - dyHall(lv) };
    const name = lv === 4 ? 'Sân thượng' : `Tầng ${lv}`;
    return [
      { from: door, to: { x: STAIRWELL.x + 1, y: land.y }, fromLevel: lv, toLevel: STAIRS_LEVEL, label: 'Thang bộ' },
      { from: { x: STAIRWELL.x - 1, y: land.y }, to: front, fromLevel: STAIRS_LEVEL, toLevel: lv, label: name },
    ];
  }),
];

// ---------- Thang máy ----------
/** Cửa thang máy ở mỗi tầng (2 ô trên tường hành lang) và ô đứng chờ trước cửa */
export const LIFT_DOORS = LIFT_FLOORS.map(n => ({
  level: n,
  tiles: [{ x: fl(n).ox + 16, y: fl(n).oy + 13 - dyHall(n) }, { x: fl(n).ox + 17, y: fl(n).oy + 13 - dyHall(n) }],
  front: { x: fl(n).ox + 16.5, y: fl(n).oy + 12 - dyHall(n) }, // tâm chỗ đứng chờ (đơn vị ô, chưa cộng 0.5)
}));
export const CABIN_DOOR = [{ x: CABIN.x + 1, y: CABIN.y - 1 }, { x: CABIN.x + 2, y: CABIN.y - 1 }];
export const CABIN_PANEL = { x: CABIN.x, y: CABIN.y }; // bảng nút chọn tầng (góc trái trong buồng)

export type FurnitureKind =
  | 'desk' | 'bigdesk' | 'rack' | 'fridge' | 'coffee' | 'copier' | 'computer' | 'meetingtable'
  | 'router' | 'panel' | 'sink' | 'pantrytable' | 'sofa' | 'plant' | 'watercooler'
  | 'counter' | 'scanner' | 'boxes' | 'bigplant' | 'easel' | 'kanban' | 'projector' | 'printer'
  | 'monitors' | 'shelf' | 'paper' | 'whiteboard' | 'hrdesk' | 'tap' | 'faceid' | 'colorcheck'
  | 'dartboard' | 'claw' | 'fishtank' | 'gardenbed' | 'acunit' | 'watertank' | 'liftpanel'
  | 'solar' | 'antenna';

export interface Furniture extends Rect { kind: FurnitureKind; blocking: boolean }

// Bàn làm việc ở Phòng làm việc (tầng 2): mỗi người một bàn, chỗ ngồi là ô ngay dưới bàn
export const DESKS: { x: number; y: number; seat: { x: number; y: number } }[] = [];
// 10 bàn rải 3 tầng văn phòng (giao ngẫu nhiên mỗi ván): Tầng 1: Lễ tân 2, Bảo vệ 1 · Tầng 2: Phòng làm việc 4 · Tầng 3: HR, QA, Studio Art
for (const [lv, x, y] of [[2, 1, 2], [2, 5, 2], [2, 1, 5], [2, 6, 5], [1, 1, 3], [1, 6, 1], [1, 19, 4], [3, 9, 5], [3, 28, 4], [3, 8, 15]] as [number, number, number][]) {
  const gx = fl(lv).ox + x, gy = fl(lv).oy + y;
  DESKS.push({ x: gx, y: gy, seat: { x: gx, y: gy + 1 } });
}

const F = (level: number, kind: FurnitureKind, x: number, y: number, w = 1, h = 1, blocking = true): Furniture =>
  ({ kind, x: (level ? fl(level).ox : 0) + x, y: (level ? fl(level).oy : 0) + y, w, h, blocking });

export const FURNITURE: Furniture[] = [
  // Tầng 1
  F(1, 'counter', 3, 3, 6, 1), F(1, 'scanner', 12, 0, 1, 1, false), F(1, 'boxes', 12, 5, 2, 2), F(1, 'sofa', 6, 6, 3, 1), F(1, 'bigplant', 1, 1),
  F(1, 'monitors', 16, 1, 4, 1),
  F(1, 'dartboard', 23, 0, 1, 1, false), F(1, 'claw', 27, 1, 2, 2), F(1, 'fishtank', 23, 6, 3, 1), F(1, 'sofa', 26, 9, 3, 1), F(1, 'plant', 29, 10),
  F(1, 'panel', 6, 11, 1, 1, false), F(1, 'shelf', 1, 14, 2, 2), F(1, 'boxes', 1, 16, 2, 1),
  // Tầng 2
  ...DESKS.map(d => F(0, 'desk', d.x, d.y, 2, 1)),
  F(2, 'kanban', 9, 0, 3, 1, false), F(2, 'computer', 9, 4, 2, 1), F(2, 'plant', 1, 1), F(2, 'watercooler', 7, 1),
  F(2, 'meetingtable', 15, 2, 6, 3), F(2, 'whiteboard', 13, 0, 2, 1, false), F(2, 'projector', 22, 0, 1, 1, false), F(2, 'plant', 13, 6),
  F(2, 'fridge', 1, 12, 2, 1), F(2, 'coffee', 3, 12, 2, 1), F(2, 'tap', 9, 12, 3, 1), F(2, 'pantrytable', 5, 14, 4, 2),
  F(2, 'copier', 24, 1, 2, 1), F(2, 'printer', 28, 1, 2, 1), F(2, 'shelf', 28, 4, 2, 1),
  // Tầng 3
  F(3, 'bigdesk', 2, 2, 4, 2), F(3, 'sofa', 5, 6, 3, 1), F(3, 'plant', 7, 1),
  F(3, 'hrdesk', 10, 2, 3, 1), F(3, 'faceid', 15, 4), F(3, 'plant', 15, 1),
  F(3, 'rack', 17, 1, 2, 2), F(3, 'rack', 20, 1, 2, 2), F(3, 'router', 21, 4), F(3, 'computer', 17, 4, 2, 1),
  F(3, 'computer', 23, 1, 2, 1), F(3, 'computer', 27, 1, 2, 1), F(3, 'plant', 29, 1),
  F(3, 'easel', 2, 12), F(3, 'easel', 7, 12), F(3, 'pantrytable', 3, 15, 4, 2), F(3, 'colorcheck', 10, 13), F(3, 'plant', 10, 16),
  // Sân thượng
  F(4, 'gardenbed', 2, 2, 4, 2), F(4, 'gardenbed', 9, 2, 4, 2), F(4, 'gardenbed', 2, 8, 4, 2), F(4, 'gardenbed', 9, 8, 4, 2), F(4, 'bigplant', 14, 12),
  F(4, 'acunit', 25, 2, 2, 2), F(4, 'acunit', 29, 2, 2, 2), F(4, 'acunit', 33, 2, 2, 2), F(4, 'watertank', 27, 8, 4, 3),
  F(4, 'solar', 17, 1, 4, 2), F(4, 'antenna', 14, 1),
  // Buồng thang máy
  F(0, 'liftpanel', CABIN_PANEL.x, CABIN_PANEL.y),
];

export type MiniKind =
  | 'fingerprint' | 'delivery' | 'waterplant' | 'excel' | 'backlog' | 'sprite' | 'bug' | 'testbuild'
  | 'interview' | 'balance' | 'projector' | 'coffee' | 'fridge' | 'getwater' | 'copier'
  | 'printdoc' | 'minutes' | 'stamp' | 'wires' | 'pushbuild' | 'router' | 'power'
  | 'mt_lift' | 'mt_cab' | 'mt_desk' | 'mt_floor' | 'mt_wc'
  | 'darts' | 'claw' | 'fishfeed'
  | 'solar' | 'antenna' | 'acpanel';

/**
 * Độ khó của từng mini-game (dùng chung cho chia việc và phòng thử ?minigames):
 * de = một thao tác hoặc giữ nút; tb = đọc, đếm, kéo thả, canh thời điểm; kho = phản xạ, chính xác, trí nhớ.
 */
export type MiniDiff = 'de' | 'tb' | 'kho';
export const MINI_DIFF: Record<string, MiniDiff> = {
  fingerprint: 'de', delivery: 'de', copier: 'de', projector: 'de', backlog: 'de', router: 'de', power: 'de',
  mt_lift: 'de', mt_cab: 'tb', mt_desk: 'tb', mt_floor: 'de', mt_wc: 'tb',
  getwater: 'tb', waterplant: 'tb', fridge: 'tb', minutes: 'tb', wires: 'tb', testbuild: 'tb', antenna: 'tb',
  interview: 'tb', coffee: 'tb', printdoc: 'tb', pushbuild: 'tb', fishfeed: 'tb', solar: 'tb', acpanel: 'tb', claw: 'tb',
  excel: 'kho', stamp: 'kho', balance: 'kho', sprite: 'kho', bug: 'kho', darts: 'kho',
};
/** Thời gian làm trung bình của từng mini-game (giây), đo bằng phòng thử; bot trong mô phỏng làm mất chừng đó (±20%) */
export const MINI_TIME: Record<string, number> = {
  // Cập nhật theo phản hồi lần 3 (đo bằng phòng thử; lần chơi đầu có thời gian làm quen nên lấy khoảng giữa số đo và ước tính)
  fingerprint: 4, delivery: 3, copier: 4, projector: 5, backlog: 8,
  mt_lift: 5, mt_cab: 7, mt_desk: 6.5, mt_floor: 10, mt_wc: 7.5,
  getwater: 3, waterplant: 3.5, fridge: 4, minutes: 6, wires: 7.5, testbuild: 5, antenna: 5.5,
  interview: 13, coffee: 9.5, printdoc: 6, pushbuild: 15, fishfeed: 8.5, solar: 9, acpanel: 8, claw: 7,
  excel: 16, stamp: 17, balance: 8.5, sprite: 13, bug: 14, darts: 8,
};
/** Độ khó của một việc = độ khó của bước khó nhất */
export function taskDiff(t: { steps: readonly string[] }): MiniDiff {
  const r = { de: 0, tb: 1, kho: 2 } as const;
  return t.steps.reduce<MiniDiff>((m, k) => (r[MINI_DIFF[k] ?? 'tb'] > r[m] ? (MINI_DIFF[k] ?? 'tb') : m), 'de');
}

export interface Station {
  id: MiniKind | 'camera' | 'faceid' | 'colorcheck';
  name: string;
  room: RoomId;
  stand: { x: number; y: number };
  mark: { x: number; y: number }; // tâm dấu "!" (đơn vị ô)
}

const S = (level: number, id: Station['id'], name: string, room: RoomId, sx: number, sy: number, mx: number, my: number): Station => {
  const o = level ? fl(level) : { ox: 0, oy: 0 };
  return { id, name, room, stand: { x: o.ox + sx, y: o.oy + sy }, mark: { x: o.ox + mx, y: o.oy + my } };
};

export const STATIONS: Station[] = [
  // Tầng 1
  S(1, 'fingerprint', 'Chấm công vân tay', 'reception', 12, 1, 12.5, 0.4),
  S(1, 'delivery', 'Ký nhận hàng', 'reception', 11, 5, 12, 5),
  S(1, 'camera', 'Xem camera an ninh', 'security', 17, 2, 18, 1),
  S(1, 'power', 'Bật lại cầu dao', 'power', 6, 12, 6.5, 11.4),
  S(1, 'mt_cab', 'Sửa khóa tủ đồ', 'reception', 2, 6, 1.5, 6.5),
  S(1, 'darts', 'Ném phi tiêu', 'fun', 23, 1, 23.5, 0.4), // đứng ngay dưới bia
  S(1, 'claw', 'Gắp thú bông', 'fun', 29, 3, 28, 1),
  S(1, 'fishfeed', 'Cho cá ăn', 'fun', 24, 7, 24.5, 6),
  // Tầng 2
  S(2, 'excel', 'Nhập liệu Excel', 'open', 9, 5, 10, 4),
  S(2, 'backlog', 'Sắp xếp backlog', 'open', 10, 1, 10.5, 0.4),
  S(2, 'balance', 'Cân bằng chỉ số game', 'meeting', 13, 1, 14, 0.4),
  S(2, 'projector', 'Bật máy chiếu', 'meeting', 22, 1, 22.5, 0.4),
  S(2, 'coffee', 'Pha cà phê cho sếp', 'pantry', 3, 13, 4, 12),
  S(2, 'fridge', 'Dọn tủ lạnh mốc', 'pantry', 2, 13, 2, 12),
  S(2, 'getwater', 'Lấy nước tưới cây', 'pantry', 10, 13, 10.5, 12),
  S(2, 'copier', 'Gỡ kẹt photocopy', 'print', 24, 2, 25, 1),
  S(2, 'printdoc', 'In tài liệu', 'print', 28, 2, 29, 1),
  S(2, 'minutes', 'Lấy biên bản họp', 'print', 27, 4, 28, 4), // đứng cạnh tủ, không đứng sau tủ
  S(2, 'mt_desk', 'Gia cố gầm bàn họp', 'meeting', 21, 3, 20.8, 3.5), // đứng sát cạnh bàn họp
  S(2, 'mt_wc', 'Sửa ống gió', 'print', 29, 5, 29.5, 5.5),
  // Tầng 3
  S(3, 'stamp', 'Ký duyệt hồ sơ', 'director', 5, 4, 5, 3),
  S(3, 'interview', 'Xếp lịch phỏng vấn', 'hr', 11, 3, 11.5, 2),
  S(3, 'faceid', 'Máy Face ID', 'hr', 14, 4, 15.5, 4),
  S(3, 'wires', 'Nối lại dây cáp', 'server', 19, 3, 19, 1.5),
  S(3, 'router', 'Khởi động lại router', 'server', 20, 4, 21.5, 4),
  S(3, 'pushbuild', 'Đẩy bản build', 'server', 17, 5, 18, 4), // đứng trước màn hình
  S(3, 'mt_floor', 'Sửa ống cáp', 'server', 21, 5, 21.5, 6),
  S(3, 'bug', 'Tái hiện bug', 'qa', 23, 2, 24, 1),
  S(3, 'testbuild', 'Test bản build', 'qa', 27, 2, 28, 1),
  S(3, 'sprite', 'Tô màu sprite', 'art', 2, 13, 2.5, 12),
  S(3, 'colorcheck', 'Máy so màu', 'art', 9, 13, 10.5, 13),
  // Sân thượng
  S(4, 'waterplant', 'Tưới cây', 'roof_garden', 4, 4, 4, 3),
  S(4, 'solar', 'Lau tấm pin', 'roof_terrace', 18, 3, 18.5, 2),
  S(4, 'antenna', 'Chỉnh ăng-ten', 'roof_garden', 14, 2, 14.5, 1.2),
  S(4, 'acpanel', 'Kiểm tra cục nóng', 'roof_ac', 26, 4, 25.5, 3),
  // Trong buồng thang máy
  S(0, 'mt_lift', 'Bảo trì nóc thang máy', 'cabin', CABIN.x + 3, CABIN.y + 1, CABIN.x + 3.5, CABIN.y + 1.5),
];
export const station = (id: string) => STATIONS.find(s => s.id === id)!;

export type TaskType = 'common' | 'short' | 'long' | 'maint';
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
  { id: 'copier', name: 'Gỡ kẹt photocopy', type: 'short', steps: ['copier'] },
  { id: 'phitieu', name: 'Ném phi tiêu xả stress', type: 'short', steps: ['darts'] },
  { id: 'gapthu', name: 'Gắp thú bông tặng sếp', type: 'short', steps: ['claw'] },
  { id: 'choca', name: 'Cho cá ăn', type: 'short', steps: ['fishfeed'] },
  { id: 'laupin', name: 'Lau tấm pin mặt trời', type: 'short', steps: ['solar'] },
  { id: 'angten', name: 'Chỉnh ăng-ten', type: 'short', steps: ['antenna'] },
  { id: 'cucnong', name: 'Kiểm tra cục nóng điều hòa', type: 'short', steps: ['acpanel'] },
  { id: 'wires', name: 'Nối lại dây cáp', type: 'short', steps: ['wires'] },
  { id: 'trinhky', name: 'Trình ký', type: 'long', steps: ['printdoc', 'stamp'] },
  { id: 'build', name: 'Ra bản build', type: 'long', steps: ['pushbuild', 'testbuild'] },
  { id: 'tuoicay', name: 'Tưới cây', type: 'long', steps: ['getwater', 'waterplant'] },
  { id: 'giaoban', name: 'Họp giao ban', type: 'long', steps: ['projector', 'minutes'] },
  // Việc riêng của Engineer: bảo trì lối trốn
  { id: 'bt_lift', name: 'Bảo trì nóc thang máy', type: 'maint', steps: ['mt_lift'] },
  { id: 'bt_cab', name: 'Sửa khóa tủ đồ', type: 'maint', steps: ['mt_cab'] },
  { id: 'bt_desk', name: 'Gia cố gầm bàn họp', type: 'maint', steps: ['mt_desk'] },
  { id: 'bt_floor', name: 'Sửa ống cáp', type: 'maint', steps: ['mt_floor'] },
  { id: 'bt_wc', name: 'Sửa ống gió', type: 'maint', steps: ['mt_wc'] },
];
export const taskDef = (id: string) => TASKS.find(t => t.id === id)!;

// Phòng họp (tầng 2): chuông họp khẩn giữa bàn, ô đứng bấm chuông ngay dưới bàn
export const BELL = { x: fl(2).ox + 18, y: fl(2).oy + 3, room: 'meeting' as RoomId };
export const BELL_STAND = { x: fl(2).ox + 18, y: fl(2).oy + 5 };

// Chỗ trốn. pair = -1: nối động (nắp trần thang máy ↔ cửa kỹ thuật giếng thang ở tầng buồng thang đang đứng)
const H = (level: number, id: string, name: string, x: number, y: number, pair: number) =>
  ({ id, name, x: (level ? fl(level).ox : 0) + x, y: (level ? fl(level).oy : 0) + y, pair, level });
export const HIDE_SPOTS: { id: string; name: string; x: number; y: number; pair: number; level: number }[] = [
  H(0, 'tm_hatch', 'Nắp trần thang máy', CABIN.x + 3, CABIN.y + 2, -1),
  H(1, 'tm_shaft1', 'Cửa kỹ thuật giếng thang (Tầng 1)', 15, 10, -1),
  H(2, 'tm_shaft2', 'Cửa kỹ thuật giếng thang (Tầng 2)', 15, 10, -1),
  H(3, 'tm_shaft3', 'Cửa kỹ thuật giếng thang (Tầng 3)', 15, 10, -1),
  H(1, 'ong_cap1', 'Ống cáp (Kho điện)', 7, 16, 5),
  H(3, 'ong_cap3', 'Ống cáp (Server)', 21, 6, 4),
  H(2, 'gam_ban_lv', 'Gầm bàn (Phòng làm việc)', 11, 6, 7),
  H(2, 'gam_ban_hop', 'Gầm bàn (Phòng họp)', 22, 6, 6),
  H(2, 'ong_gio2', 'Ống gió (Phòng in ấn)', 29, 6, 9),
  H(4, 'ong_gio_mai', 'Ống gió (Khu điều hòa)', 35, 11, 8),
  H(1, 'tu_do_lt', 'Tủ đồ (Lễ tân)', 1, 6, 11),
  H(1, 'tu_do_gt', 'Tủ đồ (Khu giải trí)', 29, 6, 10),
  H(3, 'tran_gd', 'Trần thạch cao (Giám đốc)', 1, 6, 13),
  H(3, 'tran_qa', 'Trần thạch cao (QA)', 23, 6, 12),
];

// Chỗ đứng quanh bàn họp (đầu ván và sau mỗi cuộc họp)
/** Điểm xuất hiện lại sau họp (kiểu Airship): mỗi người được chọn 3 trong 6 điểm */
export interface SpawnPoint { id: string; room: RoomId; level: number; x: number; y: number; icon: string }
export const SPAWN_POINTS: SpawnPoint[] = [
  { id: 'reception', room: 'reception', level: 1, x: 10, y: 6, icon: 'idcard' },
  { id: 'meeting', room: 'meeting', level: 2, x: 56, y: 7, icon: 'bell' },
  { id: 'pantry', room: 'pantry', level: 2, x: 49, y: 15, icon: 'coffee' },
  { id: 'hall3', room: 'hall3', level: 3, x: 19, y: 34, icon: 'stairs' },
  { id: 'art', room: 'art', level: 3, x: 5, y: 39, icon: 'palette' },
  { id: 'roof', room: 'roof_garden', level: 4, x: 48, y: 31, icon: 'plant' },
];
export const SPAWNS: { x: number; y: number }[] = [
  ...[15, 16, 17, 18, 19, 20].map(x => ({ x: fl(2).ox + x, y: fl(2).oy + 1 })),
  ...[15, 16, 17, 18, 19, 20].map(x => ({ x: fl(2).ox + x, y: fl(2).oy + 5 })),
];

// Camera an ninh: mỗi tầng một chiếc ở hành lang trước lõi thang (thấy cửa thang máy, thang bộ, cửa phòng, không thấy trong phòng)
const CAM = (level: number, name: string, x: number, y: number, w: number, h: number, dx: number, dy: number) =>
  ({ name, level, x: fl(level).ox + x, y: fl(level).oy + y, w, h, dev: { x: fl(level).ox + dx, y: fl(level).oy + dy } });
export const CAMERAS: { name: string; level: number; x: number; y: number; w: number; h: number; dev: { x: number; y: number } }[] = [
  CAM(1, 'Tầng 1 · hành lang trước thang', 8, 7, 13, 5, 13, 7),
  CAM(2, 'Tầng 2 · hành lang trước thang', 9, 7, 20, 5, 25, 7),
  CAM(3, 'Tầng 3 · hành lang trước thang', 8, 7, 20, 5, 22, 7),
  CAM(4, 'Sân thượng · cửa thang bộ', 15, 1, 8, 8, 18, 0),
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
// Cửa thoát hiểm và cửa ra chiếu nghỉ: là ô sàn, đi vào là dịch chuyển
for (const pt of PORTALS) { GRID[pt.from.y * MAP_W + pt.from.x] = 1; ROOM_GRID[pt.from.y * MAP_W + pt.from.x] = pt.fromLevel === STAIRS_LEVEL ? 'stairs' : pt.fromLevel === 4 ? 'roof_terrace' : `hall${pt.fromLevel}` as RoomId; }
// Cửa thang máy ở các tầng và cửa buồng thang: là ô sàn, đóng/mở theo trạng thái thang (ELEV_BLOCK)
for (const ld of LIFT_DOORS) for (const t of ld.tiles) { GRID[t.y * MAP_W + t.x] = 1; ROOM_GRID[t.y * MAP_W + t.x] = `hall${ld.level}` as RoomId; }
for (const t of CABIN_DOOR) { GRID[t.y * MAP_W + t.x] = 1; ROOM_GRID[t.y * MAP_W + t.x] = 'cabin'; }
for (const f of FURNITURE) {
  if (!f.blocking) continue;
  for (let y = f.y; y < f.y + f.h; y++)
    for (let x = f.x; x < f.x + f.w; x++) {
      if (GRID[y * MAP_W + x] === 1) GRID[y * MAP_W + x] = 2;
    }
}

// Cửa đang bị khóa (do mô phỏng cập nhật): chặn cả di chuyển lẫn tầm nhìn
export const DOOR_BLOCK: Uint8Array = new Uint8Array(MAP_W * MAP_H);
// Cửa thang máy đang đóng (mô phỏng cập nhật mỗi khung hình)
export const ELEV_BLOCK: Uint8Array = new Uint8Array(MAP_W * MAP_H);
for (const ld of LIFT_DOORS) for (const t of ld.tiles) ELEV_BLOCK[t.y * MAP_W + t.x] = 1;
for (const t of CABIN_DOOR) ELEV_BLOCK[t.y * MAP_W + t.x] = 1;

export function isFloor(tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
  const i = ty * MAP_W + tx;
  return GRID[i] === 1 && DOOR_BLOCK[i] === 0 && ELEV_BLOCK[i] === 0;
}

/** Ô che tầm nhìn: tường, cửa đang khóa, cửa thang máy (bàn ghế không che) */
export function isOpaque(tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
  const i = ty * MAP_W + tx;
  return GRID[i] === 0 || DOOR_BLOCK[i] === 1 || ELEV_BLOCK[i] === 1 || LIFT_DOOR_SET.has(i) || CABIN_DOOR_SET.has(i);
}
const LIFT_DOOR_SET = new Set(LIFT_DOORS.flatMap(ld => ld.tiles.map(t => t.y * MAP_W + t.x)));
const CABIN_DOOR_SET = new Set(CABIN_DOOR.map(t => t.y * MAP_W + t.x));

/** Đường ngắm giữa hai điểm (pixel): duyệt các ô bằng DDA, gặp ô che là không thấy */
export function lineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
  if (levelAt(x1, y1) !== levelAt(x2, y2)) return false; // khác tầng thì không bao giờ thấy nhau
  let tx = Math.floor(x1 / TILE), ty = Math.floor(y1 / TILE);
  const ex = Math.floor(x2 / TILE), ey = Math.floor(y2 / TILE);
  const dx = x2 - x1, dy = y2 - y1;
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(TILE / dx) : Infinity, tdy = dy !== 0 ? Math.abs(TILE / dy) : Infinity;
  let tmx = dx !== 0 ? ((sx > 0 ? (tx + 1) * TILE - x1 : x1 - tx * TILE) / Math.abs(dx)) : Infinity;
  let tmy = dy !== 0 ? ((sy > 0 ? (ty + 1) * TILE - y1 : y1 - ty * TILE) / Math.abs(dy)) : Infinity;
  for (let n = 0; n < 200; n++) {
    if (tx === ex && ty === ey) return true;
    if (tmx < tmy) { tmx += tdx; tx += sx; } else { tmy += tdy; ty += sy; }
    if (tx === ex && ty === ey) return true;
    if (isOpaque(tx, ty)) return false;
  }
  return true;
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

/** Tầng tại một điểm (pixel): 1–3, 4 = sân thượng, 0 = trong buồng thang máy, -1 = ngoài bản đồ */
export function levelAt(px: number, py: number): number {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (tx >= CABIN.x - 1 && tx <= CABIN.x + CABIN.w && ty >= CABIN.y - 1 && ty <= CABIN.y + CABIN.h) return 0;
  for (const f of FLOORS) if (tx >= f.ox && tx < f.ox + f.w && ty >= f.oy && ty < f.oy + f.h) return f.id;
  if (tx >= STAIRWELL.x - 1 && tx <= STAIRWELL.x + STAIRWELL.w && ty >= STAIRWELL.y - 1 && ty <= STAIRWELL.y + STAIRWELL.h) return STAIRS_LEVEL;
  return -1;
}
export const levelName = (n: number) => n === 0 ? 'Thang máy' : n === STAIRS_LEVEL ? 'Thang bộ' : FLOORS[n - 1]?.name ?? '';

export function tileCenter(tx: number, ty: number) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

// Kiểm tra va chạm với hộp chân nhân vật
/** Hồn ma: chỉ bay trong phạm vi tòa nhà (ô sàn và tường bao quanh, cách sàn tối đa 1 ô), không bay vào khoảng trống ngoài tòa nhà */
let GHOST_OK: Uint8Array | null = null;
export function ghostOk(px: number, py: number): boolean {
  if (!GHOST_OK) {
    GHOST_OK = new Uint8Array(MAP_W * MAP_H);
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      let ok = 0;
      for (let dy = -1; dy <= 1 && !ok; dy++) for (let dx = -1; dx <= 1 && !ok; dx++) if (isFloor(x + dx, y + dy)) ok = 1;
      GHOST_OK[y * MAP_W + x] = ok;
    }
  }
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  return tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H && GHOST_OK[ty * MAP_W + tx] === 1;
}

export function canStand(px: number, py: number): boolean {
  const hw = 11, hh = 7;
  const pts = [[px - hw, py - hh], [px + hw, py - hh], [px - hw, py + hh], [px + hw, py + hh]];
  for (const [x, y] of pts) if (!isFloor(Math.floor(x / TILE), Math.floor(y / TILE))) return false;
  return true;
}

// ---------- Cửa theo phòng (dùng cho phá hoại khóa cửa) ----------
export const LOCKABLE_ROOMS: RoomId[] = ['director', 'hr', 'art', 'server', 'reception', 'open', 'qa', 'pantry', 'fun', 'print', 'security', 'power', 'roof_garden', 'roof_ac'];
/** Các ô cửa thuộc từng phòng (ô cửa nằm sát phòng đó) */
export const DOOR_GROUPS = new Map<RoomId, number[]>();
for (const d of DOORS) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = d.x + dx, ny = d.y + dy;
    if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
    const r = ROOM_GRID[ny * MAP_W + nx];
    if (!r || !LOCKABLE_ROOMS.includes(r)) continue;
    if (!DOOR_GROUPS.has(r)) DOOR_GROUPS.set(r, []);
    const idx = d.y * MAP_W + d.x;
    if (!DOOR_GROUPS.get(r)!.includes(idx)) DOOR_GROUPS.get(r)!.push(idx);
  }
}

/** Cổng thang bộ theo ô (để tìm đường và dịch chuyển) */
export const PORTAL_AT = new Map<number, Portal>();
for (const p of PORTALS) PORTAL_AT.set(p.from.y * MAP_W + p.from.x, p);
