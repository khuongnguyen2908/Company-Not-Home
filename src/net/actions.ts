// Cửa lệnh duy nhất: mọi thao tác của người chơi vào mô phỏng đều đi qua đây.
// Chơi một mình / chủ phòng: chạy thẳng trên World. Người vào phòng: gửi lên chủ phòng, chủ phòng chạy và báo lỗi (nếu có).
// Tham số chỉ là số / chuỗi / null (gửi qua mạng được); nhân vật luôn là người gửi lệnh, không ai ra lệnh thay người khác được.
import type { World, Agent, SabotageKind } from '../game/sim';
import type { RoomId } from '../game/map';

type R = string | null | void | boolean;
type Fn = (w: World, a: Agent, args: unknown[]) => R;
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
const agentArg = (w: World, v: unknown) => { const n = num(v); return Number.isInteger(n) && w.agents[n] ? w.agents[n] : null; };

/** Danh sách lệnh hợp lệ. Lệnh không có trong danh sách bị bỏ qua (chống gửi lệnh lạ). */
export const ACTIONS: Record<string, Fn> = {
  // di chuyển đặc biệt / trốn
  ghostFloor: (w, a, [d]) => w.ghostFloor(a, num(d) > 0 ? 1 : -1),
  hide: (w, a, [s]) => { const n = s === null ? null : num(s); if (n !== null && !Number.isInteger(n)) return; w.hide(a, n); },
  hideMove: (w, a) => w.hideMove(a),
  // việc, sự cố, sếp
  completeTask: (w, a, [st]) => { if (typeof st === 'string') w.completeTask(a, st); },
  fixSabotage: (w, a) => { if (w.sabotage && w.sabotage.kind !== 'boss') w.fixSabotage(a); },
  bossCheckIn: (w, a) => w.bossCheckIn(a),
  // gài bẫy, báo cáo, họp
  kill: (w, a, [t]) => { const v = agentArg(w, t); if (v) w.tryKill(a, v); },
  report: (w, a, [victim]) => { const b = w.bodies.find(x => x.victim === num(victim)); if (b) w.report(a, b); },
  callEmergency: (w, a) => w.callEmergency(a, 'bell'),
  vote: (w, a, [t]) => { const v = t === 'skip' ? 'skip' : num(t); if (v === 'skip' || Number.isInteger(v)) w.vote(a, v as number | 'skip'); },
  chat: (w, a, [text]) => { if (typeof text === 'string' && text.trim()) w.chatFrom(a, text.slice(0, 160)); },
  react: (w, a, [e]) => { if (typeof e === 'string' && e.length <= 8) w.react(a.id, e); },
  skipDiscussion: (w, a) => w.readyToVote(a),
  chooseSpawn: (w, a, [i]) => w.chooseSpawnFor(a, Number.isInteger(num(i)) ? num(i) : -1),
  // phá hoại, cửa, thang máy
  sabotage: (w, a, [k]) => (typeof k === 'string' ? w.triggerSabotage(a, k as SabotageKind) : 'Lệnh sai'),
  lockDoors: (w, a, [room]) => (typeof room === 'string' ? w.lockDoors(a, room as RoomId) : 'Lệnh sai'),
  unlockDoors: (w, a, [room]) => { if (typeof room === 'string') w.unlockDoors(room as RoomId, a); },
  liftCall: (w, _a, [lv]) => { if (Number.isInteger(num(lv))) w.liftCall(num(lv)); },
  liftPress: (w, a, [f]) => w.liftPress(a, num(f)),
  pryOut: (w, a) => w.pryOut(a),
  liftRescue: (w, a) => w.liftRescue(a),
  // kỹ năng phòng ban
  setBackup: (w, a, [id]) => { if (Number.isInteger(num(id))) w.setBackup(a, num(id)); },
  useLaptop: (w, a) => w.useLaptop(a),
  adminOpen: (w, a) => w.adminOpen(a),
  adminClose: (w, a) => w.adminClose(a),
  startFaceId: (w, a, [t]) => { if (Number.isInteger(num(t))) w.startFaceId(a, num(t)); },
  artistCheck: (w, a, [g]) => (typeof g === 'string' ? w.artistCheck(a, g) : 'Lệnh sai'),
  animatorRevive: (w, a, [t]) => w.animatorRevive(a, num(t)),
  testerTag: (w, a, [t]) => w.testerTag(a, num(t)),
  mediaSend: (w, a, [t, st]) => (Array.isArray(st) ? w.mediaSend(a, num(t), st.map(num).filter(Number.isInteger)) : 'Lệnh sai'),
  poCall: (w, a) => w.poCall(a),
  revealDirector: (w, a) => w.revealDirector(a),
  setProtect: (w, a, [t]) => w.setProtect(a, t === null ? null : num(t)),
  anonAccuse: (w, a, [t]) => w.anonAccuse(a, num(t)),
  // trạng thái đang làm (đèn máy sáng cho người khác thấy), đang xem camera
  flag: (_w, a, [k, on]) => {
    if (k === 'scanning' || k === 'hrScanning' || k === 'artistScanning') (a as unknown as Record<string, boolean>)[k] = !!on && a.alive;
  },
  watch: (w, a, [on]) => { if (on) w.watching.add(a.id); else w.watching.delete(a.id); },
};

/** Chạy một lệnh cho nhân vật agentId; trả về chuỗi lỗi (nếu có) để báo cho người chơi */
export function runAction(w: World, agentId: number, name: string, args: unknown[]): string | null {
  const fn = ACTIONS[name];
  const a = w.agents[agentId];
  if (!fn || !a || !Array.isArray(args)) return null;
  const r = fn(w, a, args);
  return typeof r === 'string' ? r : null;
}
