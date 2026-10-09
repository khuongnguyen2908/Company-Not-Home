// Đợt sau buổi team test lần 2: Sẵn sàng bỏ phiếu, lịch sử chat sảnh, bộ chỉnh ít người, tầm nhìn theo cỡ ván.
// Cách dùng: npx tsx tests/round3_test.ts
import { World, VISION, SMALL_VISION, MID_VISION } from '../src/game/sim';
import { randomLook } from '../src/game/look';
import { station, TILE, levelAt, ROOF, TASKS } from '../src/game/map';
import { SPECIAL_ROLES } from '../src/game/data';
import { MemoryHub } from '../src/net/transport';
import { NetHost, NetClient } from '../src/net/room';
import { setup, actA, ok, finish, type Ctx } from './net_setup';

async function meet(c: Ctx) { c.w.emergencyCd = 0; c.w.startMeeting(0, null, 'bell'); await c.run(0.5); }
const open = (c: Ctx) => { const m = c.w.meeting!; return m.t >= m.discussEnd; };

async function main() {
  console.log('Sẵn sàng bỏ phiếu');
  {
    const c = await setup(91, 'intern'); await meet(c);
    await actA(c, 'readyVote', true); await c.run(0.3);
    ok(c.w.meeting!.ready?.includes(1) === true && !open(c), 'A sẵn sàng: chủ phòng ghi nhận, chưa mở bỏ phiếu (còn 2 người)');
    ok(c.B.replica!.meeting!.ready?.includes(1) === true, 'B thấy A đã sẵn sàng (dấu ✓)');
    await actA(c, 'readyVote', false); await c.run(0.3);
    ok(!c.w.meeting!.ready?.includes(1), 'A bấm lần nữa: hủy sẵn sàng');
    await actA(c, 'readyVote', true);
    c.w.setReadyVote(c.w.agents[2], true); await c.run(0.2);
    ok(!open(c), 'A và B sẵn sàng, chủ phòng chưa: vẫn đang thảo luận');
    c.w.setReadyVote(c.w.agents[0], true); await c.run(0.3);
    ok(open(c), 'đủ cả 3 người thật: mở bỏ phiếu ngay');
    ok(c.A.replica!.meeting!.t >= c.A.replica!.meeting!.discussEnd, 'máy A cũng sang phần bỏ phiếu');
  }
  {
    const c = await setup(92, 'intern'); await meet(c);
    await actA(c, 'readyVote', true); c.w.setReadyVote(c.w.agents[0], true); await c.run(0.2);
    ok(!open(c), 'B chưa sẵn sàng: chưa mở');
    c.w.agents[2].away = true; await c.run(0.3);
    ok(open(c), 'B rớt mạng (đang chờ quay lại): không tính B, mở bỏ phiếu');
  }
  {
    const c = await setup(93, 'intern');
    c.w.agents[2].alive = false; await meet(c);
    await actA(c, 'readyVote', true); c.w.setReadyVote(c.w.agents[0], true); await c.run(0.3);
    ok(open(c), 'hồn ma (B) không tính: 2 người còn sống sẵn sàng là mở');
    c.w.setReadyVote(c.w.agents[2], true);
    ok(!c.w.meeting!.ready?.includes(2), 'hồn ma bấm không có tác dụng');
  }

  console.log('Lịch sử chat sảnh cho người mới vào');
  {
    let now = 0;
    const hub = new MemoryHub(10, 20, 0, () => 0.5);
    const prof = (n: string, id: string) => ({ name: n, look: randomLook(), empId: id });
    const host = new NetHost(hub.join('H'), 'CHT-234', prof('Chủ', '101'), { timers: false }); host.clock = () => now;
    const A = new NetClient(hub.join('A'), 'CHT-234', prof('An', '202'), { timers: false }); A.clock = () => now;
    const tick = (ms: number) => { for (let t = 0; t < ms; t += 20) { now += 20; hub.tick(now); } };
    A.join(); tick(300);
    host.lobbyChat('chào cả nhà');
    A.sendLobbyChat('vào ca thôi'); tick(300);
    const B = new NetClient(hub.join('B'), 'CHT-234', prof('Bình', '303'), { timers: false }); B.clock = () => now;
    let got: { name: string; text: string }[] = [];
    B.onLobbyHistory = (items) => { got = items; };
    B.join(); tick(400);
    ok(got.length === 2 && got[0].name === 'Chủ' && got[1].name === 'An' && got[1].text === 'vào ca thôi', `người mới vào nhận 2 tin cũ kèm tên (${got.map(x => x.name + ': ' + x.text).join(' | ')})`);
    ok(B.lobbyHist.length === 2, 'giữ lại để giao diện sảnh dựng xong vẫn đọc được');
    for (let i = 0; i < 30; i++) host.lobbyChat('tin ' + i);
    const C = new NetClient(hub.join('C'), 'CHT-234', prof('Cúc', '404'), { timers: false }); C.clock = () => now;
    C.join(); tick(400);
    ok(C.lobbyHist.length === 20 && C.lobbyHist[19].text === 'tin 29', 'chỉ gửi 20 tin gần nhất');
  }

  console.log('Bộ chỉnh ít người và tầm nhìn theo cỡ ván');
  {
    const roles = Object.fromEntries(SPECIAL_ROLES.map(r => [r, true]));
    const mk = (players: number, seed: number, small?: boolean) => new World({ playerName: 'T', playerLook: randomLook(), roles, maxSpecial: 4, playerRole: 'random', bots: players - 1, impostors: 2, seed, headless: true, small });
    const floorOf = (k: string) => { const st = station(k); return levelAt((st.stand.x + 0.5) * TILE, (st.stand.y + 0.5) * TILE); };
    let roofTasks = 0, maxSp = 0, shortOk = true, neutral = 0;
    for (let s = 1; s <= 60; s++) {
      const w = mk(5 + (s % 2), s);
      maxSp = Math.max(maxSp, w.roleList.length);
      for (const a of w.agents) {
        for (const t of a.tasks) { const d = TASKS.find(x => x.id === t.taskId)!; if (d.steps.some(k => floorOf(k) === ROOF)) roofTasks++; }
        if (a.tasks.filter(t => TASKS.find(x => x.id === t.taskId)!.type === 'short').length !== 5) shortOk = false;
        if (a.dept === 'gd' || a.dept === 'climber') neutral++;
      }
    }
    ok(maxSp <= 2, `5–6 người: tối đa 2 vai đặc biệt (lớn nhất gặp: ${maxSp})`);
    ok(roofTasks === 0, `5–6 người: không ai được giao việc trên sân thượng (${roofTasks})`);
    ok(shortOk, '5–6 người: mỗi người 5 việc ngắn');
    ok(neutral === 0, 'không có phe thứ 3 ở ván 5–6 người');
    const w5 = mk(5, 7), w8 = mk(8, 7), w10 = mk(10, 7), off = mk(5, 7, false);
    const crew = (w: World) => w.agents.find(a => a.role === 'crew')!;
    const imp = (w: World) => w.agents.find(a => a.role === 'impostor')!;
    ok(Math.abs(w5.visionOf(crew(w5)) - SMALL_VISION) < 1, `5 người: Nhân viên nhìn ${(w5.visionOf(crew(w5)) / TILE).toFixed(1)} ô`);
    ok(Math.abs(w8.visionOf(crew(w8)) - MID_VISION) < 1, `8 người: Nhân viên nhìn ${(w8.visionOf(crew(w8)) / TILE).toFixed(1)} ô`);
    ok(Math.abs(w10.visionOf(crew(w10)) - VISION) < 1, `10 người: giữ ${(w10.visionOf(crew(w10)) / TILE).toFixed(1)} ô`);
    ok(Math.abs(w5.visionOf(imp(w5)) / w5.visionOf(crew(w5)) - 1.5) < 0.01, 'Nội gián vẫn nhìn xa gấp 1,5 lần Nhân viên');
    w5.sabotage = { kind: 'power' } as never;
    ok(w5.visionOf(crew(w5)) < 1.3 * TILE, 'mất điện vẫn tối như cũ');
    ok(!off.small && off.shortTasks === 3, 'chủ phòng tắt chế độ ít người: chơi như ván thường (3 việc ngắn)');
    ok(!w8.small, '8 người: không bật chế độ ít người');
  }
  finish();
}
void main();
