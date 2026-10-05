// Đợt 2 · kiểm tra hệ thống khi chơi nhiều người: phá hoại, khóa cửa, thang máy, lối trốn, hồn ma, camera.
// A (máy khác) thao tác và đi lại như giao diện thật (dự đoán vị trí trên bản sao), B (máy khác) quan sát.
// Cách dùng: npx tsx tests/net_systems_test.ts
import { PRY_AFTER } from '../src/game/sim';
import { TILE, ROOMS, LOCKABLE_ROOMS, HIDE_SPOTS, LIFT_DOORS, CABIN, roomAt, levelAt, type RoomId } from '../src/game/map';
import { setup, actA, ok, finish } from './net_setup';

const center = (id: string) => { const r = (ROOMS as { id: string; x: number; y: number; w: number; h: number }[]).find(x => x.id === id)!; return { x: (r.x + r.w / 2) * TILE, y: (r.y + r.h / 2) * TILE }; };

async function main() {
  console.log('Cúp điện');
  { const c = await setup(31, 'intern'); const imp = c.w.agents.find(o => o.role === 'impostor')!;
    c.w.sabCd = 0; c.w.triggerSabotage(imp, 'power'); await c.run(0.5);
    ok(c.A.replica!.sabotage?.kind === 'power', 'A thấy cúp điện');
    ok(c.A.replica!.visionOf(c.A.replica!.player) < c.w.visionOf({ ...c.w.agents[1], } as never) + 1 && c.A.replica!.visionOf(c.A.replica!.player) === c.w.visionOf(c.w.agents[1]), 'tầm nhìn của A trên máy A khớp chủ phòng (đã thu nhỏ)');
    await actA(c, 'fixSabotage'); await c.run(0.4);
    ok(!c.w.sabotage && !c.A.replica!.sabotage && !c.B.replica!.sabotage, 'A sửa cầu dao: hết sự cố trên mọi máy');
    ok(c.evB.some(e => e.type === 'sabotage_end'), 'B nhận thông báo đã sửa'); }

  console.log('Rớt mạng');
  { const c = await setup(32, 'intern'); const imp = c.w.agents.find(o => o.role === 'impostor')!;
    c.w.sabCd = 0; c.w.triggerSabotage(imp, 'wifi'); await c.run(0.5);
    ok(c.A.replica!.sabotage?.kind === 'wifi' && c.B.replica!.sabotage?.kind === 'wifi', 'A và B thấy rớt mạng');
    await actA(c, 'fixSabotage'); await c.run(0.4);
    ok(!c.w.sabotage && !c.B.replica!.sabotage, 'A sửa router: hết sự cố trên mọi máy'); }

  console.log('Sếp đi tuần');
  { const c = await setup(33, 'intern'); const imp = c.w.agents.find(o => o.role === 'impostor')!;
    c.w.sabCd = 0; c.w.bossUsed = false; c.w.triggerSabotage(imp, 'boss'); await c.run(0.5);
    ok(c.A.replica!.sabotage?.kind === 'boss', 'A thấy Sếp đi tuần');
    await actA(c, 'bossCheckIn'); await c.run(0.4);
    ok(c.w.agents[1].bossDone && c.B.replica!.agents[1].bossDone, 'A về bàn: chủ phòng ghi nhận, B thấy A đã ngồi');
    const n = c.B.replica!.aliveCrew().filter(x => x.bossDone).length;
    ok(n === c.w.aliveCrew().filter(x => x.bossDone).length, `số người đã về bàn trên máy B khớp chủ phòng (${n})`); }

  console.log('Khóa cửa và quẹt thẻ');
  { const c = await setup(34, 'intern'); const imp = c.w.agents.find(o => o.role === 'impostor')!;
    const room = (LOCKABLE_ROOMS as string[]).find(id => { const p = center(id); return roomAt(p.x, p.y) === id; })! as RoomId;
    const p = center(room); c.w.agents[1].x = p.x; c.w.agents[1].y = p.y; await c.run(0.5);
    c.w.doorCd = new Map(); const err = c.w.lockDoors(imp, room); await c.run(0.4);
    ok(err === null && c.A.replica!.doorLocks.has(room), `phòng ${room} bị khóa, máy A biết (${err ?? 'không lỗi'})`);
    // A cố đi ra theo 4 hướng: vẫn ở trong phòng trên cả chủ phòng lẫn máy A, hai bên không lệch xa
    let outHost = false, outA = false, maxDev = 0;
    for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      c.inputA = { x, y }; await c.run(1.5);
      if (roomAt(c.w.agents[1].x, c.w.agents[1].y) !== room) outHost = true;
      if (roomAt(c.A.replica!.player.x, c.A.replica!.player.y) !== room) outA = true;
      maxDev = Math.max(maxDev, Math.hypot(c.w.agents[1].x - c.A.replica!.player.x, c.w.agents[1].y - c.A.replica!.player.y));
    }
    c.inputA = { x: 0, y: 0 }; await c.run(0.3);
    ok(!outHost && !outA, 'cửa khóa chặn được A (cả chủ phòng lẫn máy A)');
    ok(maxDev < 1.5 * TILE, `vị trí dự đoán của A không lệch xa chủ phòng khi bị chặn (${(maxDev / TILE).toFixed(2)} ô)`);
    await actA(c, 'unlockDoors', room); await c.run(0.3);
    ok(!c.w.doorLocks.has(room) && !c.A.replica!.doorLocks.has(room) && !c.B.replica!.doorLocks.has(room), 'A quẹt thẻ mở cửa: mọi máy thấy cửa mở'); }

  console.log('Thang máy');
  { const c = await setup(35, 'intern');
    // A đứng trong buồng thang (như vừa bước vào), bấm lên tầng 3
    c.w.agents[1].x = (CABIN.x + 2) * TILE; c.w.agents[1].y = (CABIN.y + 1.5) * TILE; await c.run(0.6);
    ok(levelAt(c.A.replica!.player.x, c.A.replica!.player.y) === 0, 'máy A biết mình đang trong buồng thang');
    const err = await actA(c, 'liftPress', 3);
    ok(err === null, `A bấm tầng 3 (${err ?? 'không lỗi'})`);
    await c.run(6);
    ok(Math.round(c.w.lift.pos) === 3 && Math.round(c.A.replica!.lift.pos) === 3, `thang tới tầng 3 trên cả chủ phòng lẫn máy A (${c.w.lift.pos.toFixed(1)} / ${c.A.replica!.lift.pos.toFixed(1)})`);
    // kẹt thang khi cúp điện: cạy cửa sớm thì bị từ chối, đủ 20 giây thì cạy được
    const imp = c.w.agents.find(o => o.role === 'impostor')!;
    c.w.sabCd = 0; c.w.triggerSabotage(imp, 'power'); await c.run(0.5);
    ok(c.w.lift.stuck && c.A.replica!.lift.stuck, 'cúp điện: thang kẹt, máy A biết');
    const early = await actA(c, 'pryOut');
    ok(typeof early === 'string', `cạy cửa sớm: A nhận đúng lý do ("${early}")`);
    c.w.lift.stuckT = PRY_AFTER + 0.1; await c.run(0.2);
    const late = await actA(c, 'pryOut'); await c.run(0.6);
    ok(late === null && levelAt(c.w.agents[1].x, c.w.agents[1].y) !== 0, `đủ ${PRY_AFTER} giây: A cạy cửa ra được`);
    ok(levelAt(c.A.replica!.player.x, c.A.replica!.player.y) !== 0 && Math.hypot(c.w.agents[1].x - c.A.replica!.player.x, c.w.agents[1].y - c.A.replica!.player.y) < TILE, 'máy A đặt nhân vật ra ngoài đúng chỗ chủ phòng'); }

  console.log('Engineer mở cửa thang cho người bị kẹt');
  { const c = await setup(36, 'engineer'); const imp = c.w.agents.find(o => o.role === 'impostor')!;
    c.w.agents[2].x = (CABIN.x + 2) * TILE; c.w.agents[2].y = (CABIN.y + 1.5) * TILE; // B kẹt trong buồng
    c.w.sabCd = 0; c.w.triggerSabotage(imp, 'power'); await c.run(0.5);
    const fl = Math.round(c.w.lift.pos); const ld = LIFT_DOORS.find(d => d.level === fl) ?? LIFT_DOORS[0];
    c.w.agents[1].x = (ld.front.x + 0.5) * TILE; c.w.agents[1].y = (ld.front.y + 0.5) * TILE; await c.run(0.4);
    const err = await actA(c, 'liftRescue'); await c.run(0.4);
    ok(err === null && c.w.lift.rescueFloor !== null, `Engineer (A) mở cửa thang (${err ?? 'không lỗi'})`);
    ok(c.B.replica!.lift.rescueFloor !== null, 'người bị kẹt (B) thấy cửa đã mở'); }

  console.log('Lối trốn của Nội gián');
  { const c = await setup(37, 'impostor'); const s0 = HIDE_SPOTS.findIndex(h => h.level === 1 && h.pair >= 0);
    const h = HIDE_SPOTS[s0]; c.w.agents[1].x = (h.x + 0.5) * TILE; c.w.agents[1].y = (h.y + 0.5) * TILE;
    c.w.agents[2].x = c.w.agents[1].x + 30 * TILE; // B ở xa, không thấy
    await c.run(0.4); c.evB.length = 0;
    await actA(c, 'hide', s0); await c.run(0.3);
    ok(c.w.agents[1].hidden === s0 && c.A.replica!.player.hidden === s0, 'A vào lối trốn');
    ok(!c.evB.some(e => e.type === 'vent') && c.B.replica!.agents[1].hidden === -1, 'B ở xa: không thấy nắp bật, chỉ biết A "không thấy"');
    await actA(c, 'hideMove'); await c.run(0.3);
    ok(c.w.agents[1].hidden !== s0 && c.A.replica!.player.hidden === c.w.agents[1].hidden, `A chuyển sang lối trốn khác (#${c.w.agents[1].hidden}), máy A khớp`);
    await actA(c, 'hide', null); await c.run(0.5);
    ok(c.w.agents[1].hidden === null && c.B.replica!.agents[1].hidden === null && Math.hypot(c.w.agents[1].x - c.A.replica!.player.x, c.w.agents[1].y - c.A.replica!.player.y) < TILE, 'A ra khỏi lối trốn: đúng chỗ trên mọi máy'); }

  console.log('Hồn ma đổi tầng');
  { const c = await setup(38, 'intern'); c.w.agents[1].alive = false; await c.run(0.4);
    const lv0 = levelAt(c.w.agents[1].x, c.w.agents[1].y);
    const err = await actA(c, 'ghostFloor', lv0 >= 3 ? -1 : 1); await c.run(0.5);
    const lv1 = levelAt(c.w.agents[1].x, c.w.agents[1].y);
    ok(err === null && lv1 !== lv0, `hồn ma A bay từ tầng ${lv0} sang tầng ${lv1}`);
    ok(levelAt(c.A.replica!.player.x, c.A.replica!.player.y) === lv1, 'máy A đặt hồn ma đúng tầng mới');
    c.inputA = { x: 1, y: 0 }; await c.run(1); c.inputA = { x: 0, y: 0 }; await c.run(0.4);
    ok(Math.hypot(c.w.agents[1].x - c.A.replica!.player.x, c.w.agents[1].y - c.A.replica!.player.y) < TILE, 'hồn ma đi xuyên tường: chủ phòng và máy A khớp'); }

  console.log('Camera an ninh');
  { const c = await setup(39, 'intern'); await actA(c, 'watch', true); await c.run(0.5);
    ok(c.w.camsInUse(), 'A xem camera: chủ phòng ghi nhận');
    ok(c.B.replica!.camsInUse(), 'B thấy đèn đỏ camera nhấp nháy (có người đang xem)');
    await actA(c, 'watch', false); await c.run(0.5);
    ok(!c.w.camsInUse() && !c.B.replica!.camsInUse(), 'A thôi xem: đèn tắt trên mọi máy'); }

  finish();
}
void main();
