// Kiểm tra đường P2P bằng PeerJS GIẢ (máy giới thiệu + kênh WebRTC trong bộ nhớ, có độ trễ):
// vào phòng chỉ qua P2P, mã phòng trùng, gõ cửa trước khi chủ phòng sẵn sàng, rớt kết nối tự nối lại, dùng hai đường không xử lý trùng.
import { World } from '../src/game/sim';
import { randomLook } from '../src/game/look';
import { MemoryHub, MultiTransport } from '../src/net/transport';
import { PeerTransport, type PeerCtor, type ConnLike } from '../src/net/peer';
import { NetHost, NetClient } from '../src/net/room';
import { session } from '../src/session';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
let fails = 0, passes = 0;
const ok = (c: boolean, m: string) => { if (c) { passes++; console.log('  ✔ ' + m); } else { fails++; console.log('  ✘ ' + m); } };

// ---------- PeerJS giả ----------
const registry = new Map<string, FakePeer>();
let autoId = 0;
class FakeConn implements ConnLike {
  open = false; other: FakeConn | null = null;
  private h: Record<string, ((x?: unknown) => void)[]> = {};
  on(ev: string, fn: (x?: unknown) => void) { (this.h[ev] ??= []).push(fn); }
  emit(ev: string, x?: unknown) { for (const f of this.h[ev] ?? []) f(x); }
  send(d: unknown) { const o = this.other; if (!this.open || !o) return; const copy = JSON.parse(JSON.stringify(d)); setTimeout(() => { if (o.open) o.emit('data', copy); }, 8); }
  close() { if (!this.open) return; this.open = false; this.emit('close'); const o = this.other; if (o && o.open) { o.open = false; setTimeout(() => o.emit('close'), 5); } }
}
class FakePeer {
  destroyed = false; disconnected = false; id: string;
  private h: Record<string, ((x?: unknown) => void)[]> = {};
  constructor(id?: string) {
    this.id = id ?? 'auto' + (++autoId);
    setTimeout(() => {
      if (registry.has(this.id)) { this.emit('error', { type: 'unavailable-id' }); return; }
      registry.set(this.id, this); this.emit('open', this.id);
    }, 15);
  }
  on(ev: string, fn: (x?: unknown) => void) { (this.h[ev] ??= []).push(fn); }
  emit(ev: string, x?: unknown) { for (const f of this.h[ev] ?? []) f(x); }
  connect(id: string) {
    const mine = new FakeConn();
    setTimeout(() => {
      const target = registry.get(id);
      if (!target || target.destroyed) { this.emit('error', { type: 'peer-unavailable' }); return; }
      const theirs = new FakeConn();
      mine.other = theirs; theirs.other = mine; mine.open = theirs.open = true;
      target.emit('connection', theirs); mine.emit('open');
    }, 20);
    return mine;
  }
  reconnect() { this.disconnected = false; }
  destroy() { this.destroyed = true; if (registry.get(this.id) === this) registry.delete(this.id); }
}
const Ctor = FakePeer as unknown as PeerCtor;
const prof = (n: string, id: string) => ({ name: n, look: randomLook(), empId: id });

async function main() {
  // ---------- 1. Chỉ qua P2P: vào phòng, bắt đầu ván, điều khiển đồng bộ ----------
  console.log('Chỉ qua P2P');
  {
    const hostT = new PeerTransport('H1', 'host', 'ABC-234', Ctor);
    const host = new NetHost(hostT, 'ABC-234', prof('Chủ', '101'), { timers: false });
    await sleep(40);
    ok(hostT.status === 'ready', `chủ phòng đăng ký được trên máy giới thiệu (${hostT.status})`);
    const c1 = new NetClient(new PeerTransport('P1', 'client', 'ABC-234', Ctor), 'ABC-234', prof('Một', '202'), { timers: false });
    const c2 = new NetClient(new PeerTransport('P2', 'client', 'ABC-234', Ctor), 'ABC-234', prof('Hai', '303'), { timers: false });
    c1.join(); c2.join(); await sleep(150);
    ok(host.players.map(p => p.peer).sort().join() === 'H1,P1,P2', `chủ phòng nhận đúng mã máy logic (${host.players.map(p => p.peer).join(', ')})`);
    ok(!!c1.room && !!c2.room, 'hai người nhận được thông tin phòng');
    const w = new World({ playerName: 'Chủ', playerLook: randomLook(), roles: {}, maxSpecial: 0, playerRole: 'crew', bots: 5, impostors: 1, seed: 5 });
    session.world = w;
    const seat = new Map([['H1', 0], ['P1', 1], ['P2', 2]]);
    for (const [, id] of seat) w.setHuman(id, true);
    host.startGame(w, seat); await sleep(80);
    ok(c1.replica?.meId === 1 && c2.replica?.meId === 2, 'mỗi người nhận đúng nhân vật');
    const x0 = w.agents[1].x;
    c1.sendInput(1, 0, 9999); await sleep(60);
    for (let i = 0; i < 30; i++) w.update(1 / 30);
    host.tick(300, w.drainEvents()); await sleep(80);
    ok(w.agents[1].x > x0 + 60, `chủ phòng di chuyển người 1 theo điều khiển qua P2P (${Math.round(x0)} → ${Math.round(w.agents[1].x)})`);
    host.tick(60, []); await sleep(60); c2.smooth(1000);
    ok(Math.abs((c2.replica?.agents[1].x ?? 0) - w.agents[1].x) < 30, 'người 2 thấy người 1 ở đúng chỗ');

    // ---------- 4. Rớt kết nối P2P: tự nối lại ----------
    console.log('Rớt kết nối P2P');
    const c1t = (c1 as unknown as { tr: PeerTransport }).tr;
    (c1t as unknown as { hostConn: ConnLike }).hostConn.close();
    await sleep(30);
    ok(c1t.status === 'connecting', 'người 1 biết mất kết nối');
    await sleep(1300);
    ok(c1t.status === 'ready', `người 1 tự nối lại (${c1t.status})`);
    let got = false; c1.onNote = () => { got = true; };
    host.note('thử'); await sleep(60);
    ok(got, 'sau khi nối lại, tin của chủ phòng tới được người 1');
    c1.sendAct('chat', ['xin chào']); await sleep(60);
    ok(true, 'gửi lệnh sau khi nối lại không lỗi');
    host.close(); c1.leave(); c2.leave(); await sleep(50);
  }

  // ---------- 2. Mã phòng trùng ----------
  console.log('Mã phòng trùng');
  {
    const a = new PeerTransport('A', 'host', 'DUP-234', Ctor); await sleep(40);
    const b = new PeerTransport('B', 'host', 'DUP-234', Ctor); await sleep(40);
    ok(a.status === 'ready' && b.status === 'taken', `phòng thứ hai cùng mã bị báo trùng (${b.status}) để giao diện đổi mã`);
    a.close(); b.close();
  }

  // ---------- 3. Gõ cửa trước khi chủ phòng sẵn sàng ----------
  console.log('Gõ cửa sớm');
  {
    const ct = new PeerTransport('E1', 'client', 'EAR-234', Ctor);
    const c = new NetClient(ct, 'EAR-234', prof('Sớm', '404'), { timers: false });
    c.join(); await sleep(60);
    ok(ct.status === 'notfound', 'chưa có chủ phòng: báo chưa thấy, tự thử lại');
    const host = new NetHost(new PeerTransport('EH', 'host', 'EAR-234', Ctor), 'EAR-234', prof('Chủ', '111'), { timers: false });
    for (let i = 0; i < 12 && !c.room; i++) { await sleep(300); c.join(); }
    ok(!!c.room && host.players.length === 2, 'chủ phòng mở sau: người gõ cửa sớm vẫn vào được');
    host.close(); c.leave(); await sleep(30);
  }

  // ---------- 5. Dùng cả hai đường cùng lúc: không xử lý trùng ----------
  console.log('Hai đường cùng lúc');
  {
    const hub = new MemoryHub(2, 5, 0);
    let t = 0; const iv = setInterval(() => { t += 5; hub.tick(t); }, 5);
    const host = new NetHost(new MultiTransport([hub.join('HH'), new PeerTransport('HH', 'host', 'TWO-234', Ctor)]), 'TWO-234', prof('Chủ', '121'), { timers: false });
    await sleep(40);
    const multi = new MultiTransport([hub.join('CC')]);
    multi.add(new PeerTransport('CC', 'client', 'TWO-234', Ctor));
    const c = new NetClient(multi, 'TWO-234', prof('Đôi', '505'), { timers: false });
    let hellos = 0;
    (host.tr as MultiTransport).onMessage((_f, m) => { if ((m as { t?: string }).t === 'hello') hellos++; });
    c.join(); await sleep(150);
    ok(host.players.length === 2, 'vào phòng được');
    ok(hellos === 1, `chủ phòng chỉ xử lý 1 lần dù tin tới qua 2 đường (${hellos})`);
    let notes = 0; c.onNote = () => notes++;
    host.note('một lần'); await sleep(80);
    ok(notes === 1, `người vào phòng chỉ nhận 1 lần (${notes})`);
    clearInterval(iv); host.close(); c.leave();
  }
  console.log(fails ? `CÓ ${fails} LỖI (${passes} đạt)` : `Tất cả ${passes} kiểm tra đều đạt`);
  process.exit(fails ? 1 : 0);
}
void main();
