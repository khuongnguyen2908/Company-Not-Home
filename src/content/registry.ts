// Sổ đăng ký nội dung: mọi câu chữ của game đều đăng ký ở đây để Công cụ nội dung xuất ra Excel, nhập lại và áp dụng.
// Mỗi mục biết cách đọc và ghi giá trị vào đúng chỗ trong dữ liệu game, nên sửa ở đây là game đổi theo.
import { ROLE_INFO, BOT_NAMES, PLAYER_NAMES, FILLER_LINES, DEFENSE_LINES, IMPOSTOR_ALIBIS, TASK_VERBS, COLOR_GROUPS, LOBBY_LINES, LOBBY_REPLIES, BUS_JOKES, type RoleDept } from '../game/data';
import { TASKS, STATIONS, ROOMS, FLOORS, HIDE_SPOTS, CAMERAS } from '../game/map';
import { BODIES, HAIR_STYLES, MARKS, ITEMS, SLOT_NAMES, SLOTS } from '../game/look';
import { TITLES } from '../ui/minigames';
import { SAB_INFO } from '../ui/ui';
import { TEXT, TEXT_NOTES } from './text';
import bundled from './overrides.json';

export const SHEETS = ['Vai trò', 'Việc & mini-game', 'Bản đồ', 'Trang phục', 'Lời thoại', 'Thông báo & màn hình', 'Danh sách'] as const;
export type SheetName = typeof SHEETS[number];

export interface TextEntry { kind: 'text'; sheet: SheetName; key: string; note: string; max?: number; def: string; get(): string; set(v: string): void }
export interface ListEntry { kind: 'list'; sheet: 'Danh sách'; key: string; note: string; max?: number; def: string[]; get(): string[]; set(v: string[]): void }
export type Entry = TextEntry | ListEntry;

let REG: Entry[] | null = null;

function build(): Entry[] {
  const out: Entry[] = [];
  // Giới hạn độ dài không bao giờ nhỏ hơn câu mặc định (câu gốc luôn hợp lệ)
  const text = (sheet: SheetName, key: string, get: () => string, set: (v: string) => void, note = '', max?: number) =>
    out.push({ kind: 'text', sheet, key, note, max: max && Math.max(max, get().length), def: get(), get, set });
  const list = (key: string, arr: string[], note: string, max?: number) =>
    out.push({ kind: 'list', sheet: 'Danh sách', key, note, max: max && Math.max(max, ...arr.map(x => x.length)), def: [...arr], get: () => [...arr], set: v => { arr.splice(0, arr.length, ...v); } });

  // Vai trò
  for (const id of Object.keys(ROLE_INFO) as RoleDept[]) {
    const r = ROLE_INFO[id];
    text('Vai trò', `role.${id}.name`, () => r.name, v => { r.name = v; }, 'Tên vai', 22);
    text('Vai trò', `role.${id}.short`, () => r.short, v => { r.short = v; }, 'Mô tả ngắn ở máy tính lễ tân', 36);
    text('Vai trò', `role.${id}.ability`, () => r.ability, v => { r.ability = v; }, 'Giới thiệu kỹ năng (màn phân vai, luật chơi)', 240);
    r.rules.forEach((_, i) => text('Vai trò', `role.${id}.rule.${i + 1}`, () => r.rules[i], v => { r.rules[i] = v; }, `Luật ${i + 1}`, 220));
  }
  // Việc & mini-game
  for (const t of TASKS) text('Việc & mini-game', `task.${t.id}.name`, () => t.name, v => { t.name = v; }, 'Tên việc trong bảng việc', 34);
  for (const st of STATIONS) text('Việc & mini-game', `station.${st.id}.name`, () => st.name, v => { st.name = v; }, 'Tên trạm / bước việc', 32);
  for (const k of Object.keys(TITLES) as (keyof typeof TITLES)[]) {
    text('Việc & mini-game', `mini.${k}.title`, () => TITLES[k].title, v => { TITLES[k].title = v; }, 'Tiêu đề mini-game', 40);
    text('Việc & mini-game', `mini.${k}.hint`, () => TITLES[k].hint, v => { TITLES[k].hint = v; }, 'Hướng dẫn mini-game', 200);
  }
  for (const k of Object.keys(TASK_VERBS)) text('Việc & mini-game', `verb.${k}`, () => TASK_VERBS[k], v => { TASK_VERBS[k] = v; }, 'Động từ bot dùng khi kể việc', 40);
  // Bản đồ
  const seenRoom = new Set<string>();
  for (const r of ROOMS) {
    if (seenRoom.has(r.id)) continue; seenRoom.add(r.id);
    text('Bản đồ', `room.${r.id}`, () => r.name, v => { for (const x of ROOMS) if (x.id === r.id) x.name = v; }, 'Tên phòng', 22);
  }
  for (const f of FLOORS) text('Bản đồ', `floor.${f.id}`, () => f.name, v => { f.name = v; }, 'Tên tầng', 14);
  for (const h of HIDE_SPOTS) text('Bản đồ', `hide.${h.id}`, () => h.name, v => { h.name = v; }, 'Tên lối trốn', 40);
  CAMERAS.forEach((c, i) => text('Bản đồ', `camera.${i + 1}`, () => c.name, v => { c.name = v; }, 'Tên kênh camera', 40));
  for (const k of Object.keys(SAB_INFO) as (keyof typeof SAB_INFO)[]) {
    text('Bản đồ', `sab.${k}.name`, () => SAB_INFO[k].name, v => { SAB_INFO[k].name = v; }, 'Tên sự cố (nút phá hoại)', 18);
    text('Bản đồ', `sab.${k}.desc`, () => SAB_INFO[k].desc, v => { SAB_INFO[k].desc = v; }, 'Mô tả sự cố', 80);
  }
  for (const g of COLOR_GROUPS) text('Bản đồ', `color.${g.id}`, () => g.name, v => { g.name = v; }, 'Tên nhóm màu (máy so màu)', 14);
  // Trang phục
  for (const b of BODIES) text('Trang phục', `body.${b.id}`, () => b.name, v => { b.name = v; }, 'Tên skin', 20);
  for (const h of HAIR_STYLES) text('Trang phục', `hair.${h.id}`, () => h.name, v => { h.name = v; }, 'Kiểu tóc', 20);
  for (const m of MARKS) text('Trang phục', `mark.${m.id}`, () => m.name, v => { m.name = v; }, 'Chi tiết trên da', 20);
  for (const sl of SLOTS) {
    text('Trang phục', `slot.${sl}`, () => SLOT_NAMES[sl], v => { SLOT_NAMES[sl] = v; }, 'Tên nhóm đồ', 14);
    for (const it of ITEMS[sl]) text('Trang phục', `item.${sl}.${it.id}`, () => it.name, v => { it.name = v; }, `Món đồ (${SLOT_NAMES[sl]})`, 22);
  }
  // Lời thoại và thông báo
  for (const k of Object.keys(TEXT)) {
    const sheet: SheetName = k.startsWith('bot.') ? 'Lời thoại' : 'Thông báo & màn hình';
    text(sheet, k, () => TEXT[k], v => { TEXT[k] = v; }, TEXT_NOTES[k] ?? '');
  }
  // Danh sách (thêm/bớt dòng thoải mái)
  list('list.botNames', BOT_NAMES, 'Tên đồng nghiệp bot (tối đa 12 ký tự mỗi tên)', 12);
  list('list.playerNames', PLAYER_NAMES, 'Tên gợi ý khi bấm xí ngầu (tối đa 12 ký tự)', 12);
  list('list.filler', FILLER_LINES, 'Câu nói vu vơ của bot trong họp', 140);
  list('list.defense', DEFENSE_LINES, 'Câu bot tự bào chữa khi bị buộc tội', 140);
  list('list.alibis', IMPOSTOR_ALIBIS, 'Chứng cứ ngoại phạm Nội gián bot bịa ra', 140);
  list('list.lobbyLines', LOBBY_LINES, 'Sảnh chờ: bot nói vu vơ', 100);
  list('list.lobbyReplies', LOBBY_REPLIES, 'Sảnh chờ: bot đáp lại khi được nhắc tên', 100);
  list('list.busJokes', BUS_JOKES, 'Sảnh chờ: câu đùa trên bảng giờ xe buýt', 100);
  return out;
}

export function registry(): Entry[] { if (!REG) REG = build(); return REG; }

/** Kiểm tra một giá trị: trả về danh sách lỗi (chuỗi rỗng nếu ổn) */
export function validate(e: Entry, v: string | string[]): string[] {
  const errs: string[] = [];
  if (e.kind === 'list') {
    const arr = v as string[];
    if (!arr.length) errs.push('Danh sách không được để trống');
    if (e.max) arr.forEach((x, i) => { if (x.length > e.max!) errs.push(`Dòng ${i + 1} dài ${x.length} ký tự (tối đa ${e.max})`); });
    if (e.key === 'list.botNames' && arr.length < 9) errs.push('Cần ít nhất 9 tên bot (ván tối đa 10 người)');
    return errs;
  }
  const s = (v as string) ?? '';
  if (!s.trim()) errs.push('Không được để trống');
  if (e.max && s.length > e.max) errs.push(`Dài ${s.length} ký tự, tối đa ${e.max}`);
  const need = new Set((e.def.match(/\{\w+\}/g) ?? []));
  const have = new Set((s.match(/\{\w+\}/g) ?? []));
  for (const t of need) if (!have.has(t)) errs.push(`Thiếu chỗ trống ${t}`);
  for (const t of have) if (!need.has(t)) errs.push(`Chỗ trống lạ ${t} (chỉ được dùng: ${[...need].join(', ') || 'không có'})`);
  return errs;
}

export type Overrides = Record<string, string | string[]>;

/** Áp dụng bản sửa (bỏ qua mã không tồn tại và giá trị lỗi). Trả về số mục đã đổi */
export function applyOverrides(o: Overrides | null | undefined): number {
  if (!o) return 0;
  let n = 0;
  for (const e of registry()) {
    if (!(e.key in o)) continue;
    const v = o[e.key];
    if (e.kind === 'list' ? !Array.isArray(v) : typeof v !== 'string') continue;
    if (validate(e, v).length) continue;
    (e.set as (x: typeof v) => void)(v);
    n++;
  }
  return n;
}

export const TEST_KEY = 'noi-gian:content-test';
/** Lúc mở game: áp dụng nội dung chính thức (từ file Excel trên GitHub), rồi đến bản thử trên máy (nếu có) */
export function applyStartupContent(): { official: number; test: number } {
  registry(); // chụp nội dung mặc định trước khi sửa
  const official = applyOverrides(bundled as Overrides);
  let test = 0;
  try { const raw = localStorage.getItem(TEST_KEY); if (raw) test = applyOverrides(JSON.parse(raw)); } catch { /* bỏ qua */ }
  return { official, test };
}
