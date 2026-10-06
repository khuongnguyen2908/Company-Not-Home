// Dựng ván chơi nhiều người trên mạng giả cho các bộ thử (đợt 1: vai, đợt 2: hệ thống, đợt 3: họp).
// H = chủ phòng (#0), A = người vào phòng (#1, cầm vai cần thử), B = người vào phòng (#2, quan sát). Bot đứng yên.
import { World, type Agent, type GameEvent } from '../src/game/sim';
import { randomLook } from '../src/game/look';
import { TILE } from '../src/game/map';
import { MemoryHub } from '../src/net/transport';
import { NetHost, NetClient, type ToClient } from '../src/net/room';
import { session } from '../src/session';

let fails = 0, passes = 0;
export const ok = (c: boolean, m: string) => { if (c) passes++; else fails++; console.log(`  ${c ? '✔' : '✘'} ${m}`); };
export const finish = () => { console.log(fails ? `\nCÓ ${fails} LỖI (${passes} đạt)` : `\nTất cả ${passes} kiểm tra đều đạt`); process.exit(fails ? 1 : 0); };
const prof = (n: string, id: string) => ({ name: n, look: randomLook(), empId: id });

export interface Ctx { w: World; host: NetHost; A: NetClient; B: NetClient; evA: GameEvent[]; evB: GameEvent[]; run: (sec: number) => Promise<void>; a: Agent;
  /** điều khiển di chuyển của A (A tự dự đoán vị trí trên bản sao như giao diện thật) */
  inputA: { x: number; y: number };
  /** A tải lại trang: dựng lại A với CÙNG mã máy và vào lại phòng */
  rejoinA: () => Promise<NetClient>; }

/** Dựng ván 8 người: H = #0, A = #1 (vai cần thử), B = #2; bot đứng yên để thử ổn định */
export async function setup(seed: number, dept: string | 'impostor'): Promise<Ctx> {
  let now = 0;
  const hub = new MemoryHub(20, 60, 0, () => 0.5);
  const host = new NetHost(hub.join('H'), 'ROL-234', prof('Chủ', '101'), { timers: false });
  host.clock = () => now;
  const A = new NetClient(hub.join('A'), 'ROL-234', prof('An', '202'), { timers: false });
  const B = new NetClient(hub.join('B'), 'ROL-234', prof('Bình', '303'), { timers: false });
  A.clock = B.clock = () => now;
  const evA: GameEvent[] = [], evB: GameEvent[] = [];
  A.tr.onMessage((_f, m) => { const x = m as ToClient; if ((x.t === 'full' || x.t === 'dfull') && x.ev) evA.push(...x.ev); });
  B.tr.onMessage((_f, m) => { const x = m as ToClient; if ((x.t === 'full' || x.t === 'dfull') && x.ev) evB.push(...x.ev); });
  A.join(); B.join();
  for (let t = 0; t < 400; t += 20) { now += 20; hub.tick(now); }
  const w = new World({ playerName: 'Chủ', playerLook: randomLook(), roles: {}, maxSpecial: 0, playerRole: 'crew', bots: 7, impostors: 1, seed });
  // bot đứng yên (không tự gài, không tự đi) để tình huống thử ổn định
  for (const k of ['crewBrain', 'impostorBrain', 'climberBrain', 'gdBrain', 'ghostBrain']) if (typeof (w as unknown as Record<string, unknown>)[k] === 'function') (w as unknown as Record<string, unknown>)[k] = () => {};
  const a = w.agents[1];
  // giao vai cho A (đổi vai với người đang giữ vai đó nếu có)
  const imp = w.agents.find(o => o.role === 'impostor')!;
  if (dept === 'impostor') { if (a.role !== 'impostor') { imp.role = 'crew'; imp.dept = 'intern'; a.role = 'impostor'; a.dept = null as unknown as Agent['dept']; } }
  else { if (a.role === 'impostor') { const o = w.agents[5]; o.role = 'impostor'; o.dept = null as unknown as Agent['dept']; } a.role = 'crew'; a.dept = dept as Agent['dept']; if (!w.roleList.includes(dept as never)) w.roleList.push(dept as never); }
  w.agents[0].role = 'crew'; w.agents[2].role = 'crew';
  if (w.agents.filter(o => o.role === 'impostor').length === 0) { w.agents[6].role = 'impostor'; w.agents[6].dept = null as unknown as Agent['dept']; }
  for (const o of w.agents) if (o.role === 'impostor') o.killCd = 999;
  session.world = w;
  const seat = new Map([['H', 0], ['A', 1], ['B', 2]]);
  for (const [, id] of seat) w.setHuman(id, true);
  host.startGame(w, seat); host.go();
  const run = async (sec: number) => {
    const steps = Math.round(sec * 30);
    for (let i = 0; i < steps; i++) {
      now += 1000 / 30;
      // A đi lại như giao diện thật: dự đoán trên bản sao + gửi điều khiển lên chủ phòng
      const r = ctx.A.replica;
      if (r && r.phase === 'play' && r.player.hidden === null) r.moveBy(r.player, ctx.inputA.x, ctx.inputA.y, 1 / 30);
      ctx.A.sendInput(ctx.inputA.x, ctx.inputA.y, 1000 / 30);
      ctx.A.smooth(1000 / 30); B.smooth(1000 / 30);
      if (w.phase === 'play' || w.phase === 'meeting') w.update(1 / 30);
      host.tick(1000 / 30, w.drainEvents());
      hub.tick(now);
      ctx.A.flush(); B.flush(); // như một khung hình: áp gói trạng thái mới nhất
      ctx.A.replica?.drainEvents(); B.replica?.drainEvents();
      if (i % 6 === 0) await new Promise(r => setTimeout(r, 0)); // cho các Promise chờ kết quả chạy
    }
  };
  const ctx: Ctx = { w, host, A, B, evA, evB, run, a, inputA: { x: 0, y: 0 }, rejoinA: async () => {
    ctx.A.tr.close();
    const A2 = new NetClient(hub.join('A'), 'ROL-234', ctx.A.me, { timers: false });
    A2.clock = () => now;
    A2.tr.onMessage((_f, m) => { const x = m as ToClient; if ((x.t === 'full' || x.t === 'dfull') && x.ev) evA.push(...x.ev); });
    ctx.A = A2;
    A2.join(); await run(0.6);
    return A2;
  } };
  await run(0.5);
  return ctx;
}
export const near = (w: World, a: Agent, b: Agent, dx = 0.6) => { b.x = a.x + dx * TILE; b.y = a.y; };
/** Gửi lệnh từ A và chờ kết quả, trong lúc mạng vẫn chạy */
export async function actA(c: Ctx, name: string, ...args: unknown[]) { const p = c.A.sendActWait(name, args); let r: string | null | undefined; void p.then(x => { r = x; }); for (let i = 0; i < 40 && r === undefined; i++) await c.run(0.05); return r; }

