// Kiểm tra quản lý kết nối (đồng hồ giả, không phải chờ thật):
// sức chứa theo số ghế, tin hồn ma, mất kết nối, vào lại đúng nhân vật, quá hạn thì bot thay, mất chủ phòng, từ chối người lạ.
import { World } from '../src/game/sim';
import { randomLook } from '../src/game/look';
import { MemoryHub } from '../src/net/transport';
import { NetHost, NetClient, type ToClient } from '../src/net/room';
import { session } from '../src/session';

let fails = 0, passes = 0;
const ok = (c: boolean, m: string) => { if (c) { passes++; console.log('  ✔ ' + m); } else { fails++; console.log('  ✘ ' + m); } };
let now = 0;
const hub = new MemoryHub(5, 20, 0);
const clockFn = () => now;
const step = (ms: number, host?: NetHost, clients: NetClient[] = []) => {
  const end = now + ms;
  while (now < end) {
    now = Math.min(end, now + 50);
    hub.tick(now);
    if (now % 1000 < 50) { host?.watch(); clients.forEach(c => c.watch()); }
  }
};
const prof = (name: string, empId: string) => ({ name, look: randomLook(), empId });

// ---------- 1. Sức chứa = số ghế ----------
console.log('Sức chứa phòng');
{
  const host = new NetHost(hub.join('h1'), 'CAP-234', prof('Chủ', '101'), { timers: false }); host.clock = clockFn;
  host.settings.seats = 4;
  const cs = ['a', 'b', 'c', 'd'].map((id, i) => { const c = new NetClient(hub.join('cap-' + id), 'CAP-234', prof('K' + i, String(200 + i)), { timers: false }); c.clock = clockFn; return c; });
  let rejected = '';
  cs[3].onReject = (r) => { rejected = r; };
  for (const c of cs.slice(0, 3)) { c.join(); step(100); }
  cs[3].join(); step(200);
  ok(host.players.length === 4, `ghế 4: vào được 4 người (có ${host.players.length})`);
  ok(rejected.includes('đủ 4'), `người thứ 5 bị từ chối ("${rejected}")`);
  host.close(); cs.forEach(c => c.leave()); step(100);
}

// ---------- 2–5. Trong ván ----------
console.log('Trong ván: hồn ma, mất kết nối, vào lại, quá hạn');
{
  const host = new NetHost(hub.join('h2'), 'NET-234', prof('Chủ', '111'), { timers: false }); host.clock = clockFn;
  const c1 = new NetClient(hub.join('p1'), 'NET-234', prof('Một', '222'), { timers: false }); c1.clock = clockFn;
  let c2 = new NetClient(hub.join('p2'), 'NET-234', prof('Hai', '333'), { timers: false }); c2.clock = clockFn;
  const notes: string[] = [];
  c1.onNote = (t) => notes.push(t);
  c1.join(); c2.join(); step(300, host, [c1, c2]);
  const w = new World({ playerName: 'Chủ', playerLook: randomLook(), roles: {}, maxSpecial: 0, playerRole: 'crew', bots: 5, impostors: 1, seed: 77 });
  session.world = w;
  const seat = new Map<string, number>([['h2', 0], ['p1', 1], ['p2', 2]]);
  for (const [, id] of seat) w.setHuman(id, true);
  host.startGame(w, seat); host.go();
  step(300, host, [c1, c2]);
  ok(!!c1.replica && !!c2.replica, 'hai người vào phòng nhận được ván');

  // 2. tin của hồn ma
  w.agents[1].alive = false; // người 1 đã nghỉ việc
  w.startMeeting(0, null, 'bell');
  const seenBy = new Map<string, unknown[]>();
  for (const [t, id] of [['p1', 'p1'], ['p2', 'p2']]) void t, void id;
  host.tick(300, []); step(200, host, [c1, c2]);
  c1.sendAct('chat', ['Tôi bị gài ở Pantry!']); step(200, host, [c1, c2]);
  host.tick(300, w.drainEvents()); step(300, host, [c1, c2]);
  const g1 = (c1.replica?.meeting?.chat ?? []).some(c => c.text.includes('Pantry'));
  const g2 = (c2.replica?.meeting?.chat ?? []).some(c => c.text.includes('Pantry'));
  seenBy.set('x', []);
  ok(w.meeting!.chat.some(c => c.ghost && c.text.includes('Pantry')), 'tin của người đã nghỉ việc được đánh dấu là tin hồn ma');
  ok(g1 && !g2, `chỉ người đã chết đọc được tin hồn ma (người chết thấy: ${g1}, người sống thấy: ${g2})`);
  w.meeting = null; w.phase = 'play';

  // 3. người 2 mất kết nối (đóng kết nối, không kịp báo rời)
  c2.tr.close();
  step(5200, host, [c1]);
  const p2 = host.players.find(p => p.peer === 'p2');
  ok(!!p2?.lost, 'sau 4 giây im lặng: chủ phòng đánh dấu người 2 mất kết nối');
  ok(w.agents[2].away === true, 'nhân vật của người 2 bị đánh dấu "mất kết nối" (mọi người thấy trên thẻ tên)');
  host.tick(300, []); step(200, host, [c1]);
  ok(c1.replica?.agents[2].away === true, 'người 1 thấy người 2 đang mất kết nối');
  ok(notes.some(n => n.includes('Hai') && n.includes('mất kết nối')), `người 1 nhận thông báo ("${notes.at(-1)}")`);

  // 4. người 2 tải lại trang trong 60 giây: cùng mã máy, vào lại đúng nhân vật
  c2 = new NetClient(hub.join('p2'), 'NET-234', prof('Hai', '333'), { timers: false }); c2.clock = clockFn;
  let resumed = false, gotGo = false;
  c2.onStart = () => { resumed = true; };
  c2.onGo = () => { gotGo = true; };
  c2.join(); step(400, host, [c1, c2]);
  ok(resumed && c2.replica?.meId === 2, `vào lại đúng nhân vật cũ (#${c2.replica?.meId})`);
  ok(gotGo, 'ván đang chạy: không phải chờ tờ phân công');
  ok(w.agents[2].human && !w.agents[2].away && !host.players.find(p => p.peer === 'p2')?.lost, 'chủ phòng coi người 2 đã kết nối lại');
  ok(notes.some(n => n.includes('kết nối lại')), 'mọi người nhận thông báo "đã kết nối lại"');

  // 5. người 2 mất kết nối quá 60 giây: bot chơi thay hẳn
  c2.tr.close();
  step(62000, host, [c1]);
  ok(!host.players.some(p => p.peer === 'p2'), 'quá 60 giây: người 2 bị cho rời phòng');
  ok(!w.agents[2].human, 'nhân vật của người 2 do bot chơi tiếp');
  ok(notes.some(n => n.includes('bot làm thay')), 'mọi người nhận thông báo "bot làm thay"');

  // 7. người lạ vào giữa ván: bị từ chối
  const c3 = new NetClient(hub.join('p3'), 'NET-234', prof('Ba', '444'), { timers: false }); c3.clock = clockFn;
  let rej = '';
  c3.onReject = (r) => { rej = r; };
  c3.join(); step(300, host, [c1, c3]);
  ok(rej.includes('đang chơi'), `người lạ vào giữa ván bị từ chối ("${rej}")`);

  // 6. chủ phòng mất kết nối (không kịp báo đóng phòng)
  let lostAt = -1, goneAt = -1;
  c1.onHostLost = (l) => { if (l && lostAt < 0) lostAt = now; };
  c1.onClosed = () => { if (goneAt < 0) goneAt = now; };
  const t0 = now;
  host.tr.close();
  step(17000, undefined, [c1]);
  ok(lostAt > 0 && lostAt - t0 >= 5000 && lostAt - t0 <= 7000, `người vào phòng báo mất chủ phòng sau ${((lostAt - t0) / 1000).toFixed(0)} giây`);
  ok(goneAt > 0 && goneAt - t0 >= 15000 && goneAt - t0 <= 17000, `quá 15 giây thì coi như phòng đóng (sau ${((goneAt - t0) / 1000).toFixed(0)} giây)`);
}
console.log(fails ? `CÓ ${fails} LỖI (${passes} đạt)` : `Tất cả ${passes} kiểm tra đều đạt`);
process.exit(fails ? 1 : 0);
