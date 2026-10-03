// Kiểm tra nhiều người chơi trên mạng giả (độ trễ + mất gói), không cần trình duyệt.
// 1 chủ phòng + 2 người vào phòng + bot. "Người chơi giả" tự đi làm việc, gài bẫy (nếu là Nội gián), bỏ phiếu, chọn nơi bắt đầu.
// Kiểm tra: không lộ bí mật trong bất kỳ tin nhắn nào; bản sao khớp chủ phòng; ván kết thúc đúng trên mọi máy.
// Cách dùng: npx tsx tests/net_test.ts [số ván] [độ trễ tối thiểu ms] [độ trễ tối đa ms] [tỉ lệ mất gói vị trí]
import { World, type Agent } from '../src/game/sim';
import { randomLook } from '../src/game/look';
import { station, TILE, levelAt } from '../src/game/map';
import { findPath } from '../src/game/path';
import { MemoryHub } from '../src/net/transport';
import { NetHost, NetClient, type ToClient } from '../src/net/room';
import { session } from '../src/session';
import { slotStation } from '../src/game/sim';
import { runAction } from '../src/net/actions';

const GAMES = Number(process.argv[2] ?? 6), LAT0 = Number(process.argv[3] ?? 30), LAT1 = Number(process.argv[4] ?? 150), LOSS = Number(process.argv[5] ?? 0.1);
let fails = 0;
const fail = (msg: string) => { fails++; if (fails <= 25) console.log('  ✘ ' + msg); };

for (let g = Number(process.env.G0 ?? 0); g < GAMES; g++) {
  let seedR = 1000 + g * 7919;
  const rng = () => { seedR = (seedR * 16807) % 2147483647; return seedR / 2147483647; };
  const hub = new MemoryHub(LAT0, LAT1, LOSS, rng);
  const tH = hub.join('host'), t1 = hub.join('c1'), t2 = hub.join('c2');
  const host = new NetHost(tH, 'ABC-234', { name: 'Chủ', look: randomLook(), empId: '101' });
  const clients = [new NetClient(t1, 'ABC-234', { name: 'Một', look: randomLook(), empId: '202' }), new NetClient(t2, 'ABC-234', { name: 'Hai', look: randomLook(), empId: '202' })];

  // --- soi mọi tin nhắn người vào phòng nhận được: không được lộ bí mật
  let msgs = 0, bytes = 0;
  const peerIds = ['c1', 'c2'];
  [t1, t2].forEach((t, k) => t.onMessage((_f, raw) => {
    const m = raw as ToClient; msgs++; bytes += JSON.stringify(m).length;
    if (m.t !== 'full' && m.t !== 'start') return;
    const me = m.full.me, hw = session.world!;
    const real = hw.agents[me];
    for (const j of m.full.agents as Record<string, unknown>[]) {
      const id = j.id as number;
      if (id === me) {
        if (j.role !== real.role) fail(`ván ${g}: ${peerIds[k]} nhận sai vai của chính mình`);
        if (m.t === 'start' && !(Number.isFinite(j.x as number) && Number.isFinite(j.y as number))) fail(`ván ${g}: ảnh chụp đầu tiên thiếu vị trí của chính mình`);
        continue;
      }
      if (m.t === 'start' && !(Number.isFinite(j.x as number) && j.look)) fail(`ván ${g}: ảnh chụp đầu tiên thiếu vị trí/ngoại hình của #${id}`);
      const o = hw.agents[id];
      const allowed = o.ejected || hw.phase === 'ended' || (o.role === 'impostor' && (real.role === 'impostor' || real.dept === 'climber'));
      if (j.role !== 'crew' && !allowed) fail(`ván ${g}: lộ vai của #${id} cho ${peerIds[k]}`);
      if (j.role === 'crew' && o.role === 'impostor' && allowed && !o.ejected && hw.phase !== 'ended' && real.role === 'impostor') fail(`ván ${g}: Nội gián không thấy đồng bọn`);
      // trường riêng tư: hoặc không gửi, hoặc là giá trị trống
      if (Array.isArray(j.tasks) && (j.tasks as unknown[]).length) fail(`ván ${g}: lộ việc của #${id}`);
      if (j.killCd !== undefined && j.killCd !== 0) fail(`ván ${g}: lộ hồi chiêu của #${id}`);
      for (const k of ['hrResult', 'devBackup', 'killedBy', 'hrPending', 'testTarget', 'prodLast']) if (j[k] !== undefined && j[k] !== null) fail(`ván ${g}: lộ ${k} của #${id}`);
    }
    const mt = m.full.w.meeting as Record<string, unknown> | null;
    if (mt && (mt.queue as unknown[]).length) fail(`ván ${g}: lộ lời thoại bot sắp nói`);
    if (m.t === 'full') for (const e of m.ev ?? []) {
      if ((e.type === 'task' || e.type === 'hr_result' || e.type === 'artist_result') && e.agent !== me) fail(`ván ${g}: lộ sự kiện riêng ${e.type}`);
      if (e.type === 'sabotage' && e.by !== -1 && real.role !== 'impostor') fail(`ván ${g}: lộ người gây sự cố`);
    }
  }));

  // --- vào phòng
  clients.forEach(c => c.join());
  for (let t = 0; t <= 400; t += 20) hub.tick(t);
  if (host.players.length !== 3) fail(`ván ${g}: phòng có ${host.players.length}/3 người`);
  const ids = new Set(host.players.map(p => p.empId)); if (ids.size !== 3) fail(`ván ${g}: mã nhân viên bị trùng`);

  // --- chủ phòng tạo ván (giống giao diện): 3 người thật + 5 bot
  const w = new World({ playerName: 'Chủ', playerLook: randomLook(), roles: { hr: true, it: true, admin: true, producer: true }, maxSpecial: 3, playerRole: 'random', bots: 7, impostors: 1, seed: 500 + g });
  session.world = w;
  const seat = new Map<string, number>([['host', 0], ['c1', 1], ['c2', 2]]);
  for (const [, id] of seat) w.setHuman(id, true);
  let started = 0;
  clients.forEach(c => { c.onStart = () => { started++; }; });
  host.startGame(w, seat);
  let now = 500;
  for (; now <= 1000; now += 20) hub.tick(now);
  if (started !== 2) fail(`ván ${g}: chỉ ${started}/2 máy nhận được lệnh bắt đầu`);

  // --- người chơi giả trên mỗi máy (kể cả chủ phòng): đi làm việc, Nội gián thì gài bẫy, họp thì bỏ phiếu
  const brains = new Map<number, { path: { x: number; y: number }[]; repath: number }>();
  const drive = (r: World, me: Agent, send: (x: number, y: number) => void, act: (n: string, ...a: unknown[]) => void, dt: number) => {
    if (r.phase === 'meeting') {
      const m = r.meeting;
      if (m && !m.result && m.t > m.discussEnd && me.alive && !m.votes.has(me.id)) act('vote', 'skip');
      return;
    }
    if (r.spawnOffer) { act('chooseSpawn', Math.floor(rng() * 3)); return; }
    if (r.phase !== 'play') return;
    const c = r.context(me);
    if (me.role === 'impostor' && c.kill && me.killCd <= 0) { act('kill', c.kill.id); }
    const b = brains.get(me.id) ?? { path: [], repath: 0 };
    brains.set(me.id, b);
    b.repath -= dt;
    // Nội gián (còn sống): đi tìm Nhân viên gần nhất để gài
    if (me.role === 'impostor' && me.alive) {
      const prey = r.agents.filter(o => o.id !== me.id && o.alive && o.role !== 'impostor' && levelAt(o.x, o.y) === levelAt(me.x, me.y))
        .sort((p, q) => Math.hypot(p.x - me.x, p.y - me.y) - Math.hypot(q.x - me.x, q.y - me.y))[0];
      if (prey && (!b.path.length || b.repath <= 0)) { b.path = findPath(me, { x: Math.floor(prey.x / TILE), y: Math.floor(prey.y / TILE) }) ?? []; b.repath = 1; }
    }
    const todo = me.role !== 'impostor' ? me.tasks.find(t => !t.done) : undefined;
    if (todo) {
      const st = station(slotStation(todo));
      const cx = (st.stand.x + 0.5) * TILE, cy = (st.stand.y + 0.5) * TILE;
      if (Math.hypot(me.x - cx, me.y - cy) < 10) { send(0, 0); act('completeTask', st.id); b.path = []; return; }
      if (!me.alive) {
        // hồn ma: đổi tầng bằng nút bay (không đi cầu thang), trong tầng thì bay thẳng xuyên tường
        const myLv = levelAt(me.x, me.y), lv = levelAt(cx, cy);
        if (myLv !== lv && lv >= 1 && lv <= 4) { if (b.repath <= 0) { act('ghostFloor', lv > (myLv >= 1 && myLv <= 4 ? myLv : me.ghostLv) ? 1 : -1); b.repath = 0.6; } send(0, 0); return; }
        const d = Math.hypot(cx - me.x, cy - me.y); send((cx - me.x) / d, (cy - me.y) / d); return;
      }
      if (!b.path.length || b.repath <= 0) { b.path = findPath(me, { x: st.stand.x, y: st.stand.y }) ?? []; b.repath = 2; }
    }
    while (b.path.length && Math.hypot(b.path[0].x - me.x, b.path[0].y - me.y) < 6) b.path.shift();
    if (b.path.length) { const p = b.path[0], d = Math.hypot(p.x - me.x, p.y - me.y); send((p.x - me.x) / d, (p.y - me.y) / d); }
    else send(rng() - 0.5, rng() - 0.5);
  };

  const DT = 1 / 30;
  let maxDev = 0, devSamples = 0, bigDev = 0, resultT = 0;
  const bytes0 = bytes, t0 = now;
  for (let step = 0; step < 30 * 60 * 25 && w.phase !== 'ended'; step++) {
    now += DT * 1000;
    // chủ phòng: điều khiển của mình
    drive(w, w.player, (x, y) => { w.playerInput = { x, y }; }, (n, ...a) => { runAction(w, 0, n, a); }, DT);
    // người vào phòng: dự đoán di chuyển của mình trên bản sao + gửi điều khiển/lệnh lên chủ phòng
    for (const c of clients) {
      const r = c.replica; if (!r) continue;
      const me = r.player;
      let ix = 0, iy = 0;
      drive(r, me, (x, y) => { ix = x; iy = y; }, (n, ...a) => c.sendAct(n, a), DT);
      if (r.phase === 'play' && me.hidden === null) r.moveBy(me, ix, iy, DT);
      c.sendInput(ix, iy, DT * 1000);
      c.smooth(DT * 1000);
    }
    w.update(DT);
    // kết quả họp hiện 4,8 giây rồi về văn phòng (như giao diện chủ phòng)
    if (w.phase === 'meeting' && w.meeting?.result) { resultT += DT; if (resultT > 4.8) { w.finishMeeting(); resultT = 0; } } else resultT = 0;
    host.tick(DT * 1000, w.drainEvents());
    hub.tick(now);
    for (const c of clients) c.replica?.drainEvents();
    // độ khớp vị trí: nhân vật khác trên bản sao so với chủ phòng (bỏ qua ngay sau khi dịch chuyển)
    if (step % 30 === 0 && w.phase === 'play') for (const c of clients) {
      const r = c.replica; if (!r) continue;
      for (const a of w.agents) {
        if (a.id === r.meId || !a.alive || a.hidden !== null || w.time - a.lastPortal < 1.5) continue; // đang trốn thì không được vẽ
        const d = Math.hypot(r.agents[a.id].x - a.x, r.agents[a.id].y - a.y);
        maxDev = Math.max(maxDev, d); devSamples++;
        if (d > 3 * TILE) bigDev++;
      }
    }
  }
  for (let t = 0; t < 600; t += 20) { now += 20; hub.tick(now); }
  const endOk = w.phase === 'ended' && clients.every(c => c.replica?.phase === 'ended');
  if (w.phase !== 'ended') {
    fail(`ván ${g}: ván không kết thúc`);
    for (const a of w.agents.filter(x => x.alive)) {
      const todo = a.tasks.filter(t => !t.done).map(t => `${t.taskId}@${slotStation(t)}`);
      console.log(`     ${a.human ? 'NGƯỜI' : 'bot  '} #${a.id} ${a.role}/${a.dept} tại (${(a.x / TILE).toFixed(1)},${(a.y / TILE).toFixed(1)}) còn: ${todo.join(', ') || '-'} hidden=${a.hidden}`);
    }
    console.log(`     KPI ${JSON.stringify(w.crewTasksDone())} sabotage=${w.sabotage?.kind} phase=${w.phase}`);
  }
  else if (!endOk) fail(`ván ${g}: máy người vào phòng không thấy ván kết thúc`);
  const devPct = devSamples ? (bigDev / devSamples * 100).toFixed(1) : '0';
  const secs = (now - t0) / 1000;
  console.log(`ván ${g}: ${w.winner} thắng sau ${Math.round(w.time)}s chơi · ${msgs} tin · ${((bytes - bytes0) / 1024 / secs / 2).toFixed(1)} KB/giây mỗi máy · lệch vị trí lớn nhất ${(maxDev / TILE).toFixed(2)} ô, lệch > 3 ô: ${devPct}% mẫu`);
  if (Number(devPct) > 2) fail(`ván ${g}: bản sao lệch vị trí nhiều (${devPct}% mẫu lệch > 3 ô)`);
}
console.log(fails ? `CÓ ${fails} LỖI` : 'Tất cả đạt');
process.exit(fails ? 1 : 0);
