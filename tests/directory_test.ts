// Kiểm tra danh bạ phòng Public (PeerJS giả): nhận quầy, báo danh, Private, đổi người giữ quầy, dọn phòng ma, tên phòng, kênh nội bộ
// Cách dùng: npx tsx tests/directory_test.ts
import type { PeerCtor, ConnLike } from '../src/net/peer';
import { DirectoryAnnouncer, fetchRooms, cleanRoomName, DIR_ID, type RoomEntry } from '../src/net/directory';
let passes = 0, fails = 0;
const ok = (c: boolean, m: string) => { if (c) { passes++; console.log('  ✔ ' + m); } else { fails++; console.log('  ✘ ' + m); } };
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
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
  destroyed = false; disconnected = false; id: string; conns: FakeConn[] = [];
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
      this.conns.push(mine); target.conns.push(theirs);
      target.emit('connection', theirs); mine.emit('open');
    }, 20);
    return mine;
  }
  reconnect() { this.disconnected = false; }
  // như PeerJS thật: hủy máy thì đóng mọi kênh đang mở
  destroy() { this.destroyed = true; for (const c of this.conns) c.close(); if (registry.get(this.id) === this) registry.delete(this.id); }
}
const Ctor = FakePeer as unknown as PeerCtor;
let clockNow = 1_000_000;
const clock = () => clockNow;
const room = (code: string, name: string, players = 1, status: 'wait' | 'play' = 'wait') => ({ code, name, host: 'Chủ ' + code, players, max: 8, status });

async function main() {
  console.log('Nhận quầy và báo danh');
  let a: Omit<RoomEntry, 'at'> | null = room('AAA-111', 'Phòng của An', 3);
  const A = new DirectoryAnnouncer(() => a, { p2p: Ctor, channel: false, clock, intervalMs: 100 }).start();
  await wait(400);
  ok(A.isNode && registry.has(DIR_ID), 'phòng Public đầu tiên tự nhận làm quầy danh bạ');
  let b: Omit<RoomEntry, 'at'> | null = room('BBB-222', 'Team chiều thứ 6', 5, 'play');
  const B = new DirectoryAnnouncer(() => b, { p2p: Ctor, channel: false, clock, intervalMs: 100 }).start();
  await wait(400);
  ok(!B.isNode, 'phòng thứ hai báo danh vào quầy có sẵn (không tranh quầy)');
  const C = new DirectoryAnnouncer(() => null, { p2p: Ctor, channel: false, clock, intervalMs: 100 }).start();
  let list = await fetchRooms({ p2p: Ctor, channel: false });
  ok(list.length === 2 && list[0].code === 'AAA-111' && list[1].code === 'BBB-222', `danh sách có 2 phòng Public, phòng đang chờ lên trước (${list.map(r => r.code).join(', ')})`);
  ok(list[1].name === 'Team chiều thứ 6' && list[1].players === 5 && list[1].status === 'play', 'đủ tên phòng, số người, trạng thái "Đang chơi"');
  ok(!list.some(r => r.code === 'CCC-333'), 'phòng Private không có trong danh sách');

  console.log('Đổi sang Private');
  b = null; await wait(300);
  list = await fetchRooms({ p2p: Ctor, channel: false });
  ok(list.length === 1 && list[0].code === 'AAA-111', 'phòng chuyển sang Private biến khỏi danh sách ngay');

  console.log('Người giữ quầy thoát');
  b = room('BBB-222', 'Team chiều thứ 6', 4);
  A.stop(); await wait(800);
  ok(B.isNode || C.isNode, 'phòng còn lại tự nhận làm quầy mới');
  list = await fetchRooms({ p2p: Ctor, channel: false });
  ok(list.length === 1 && list[0].code === 'BBB-222', `danh sách hồi phục, không còn phòng đã đóng (${list.map(r => r.code).join(', ') || 'trống'})`);

  console.log('Dọn phòng ma');
  const D = new DirectoryAnnouncer(() => room('DDD-444', 'Phòng sắp rớt mạng'), { p2p: Ctor, channel: false, clock, intervalMs: 100 }).start();
  await wait(400);
  ok((await fetchRooms({ p2p: Ctor, channel: false })).some(r => r.code === 'DDD-444'), 'phòng mới có trong danh sách');
  // rớt mạng: không gỡ khỏi danh bạ, chỉ ngừng báo danh
  (D as unknown as { stopped: boolean }).stopped = true;
  clockNow += 25_000; await wait(300);
  list = await fetchRooms({ p2p: Ctor, channel: false });
  ok(!list.some(r => r.code === 'DDD-444') && list.some(r => r.code === 'BBB-222'), 'phòng ngừng báo danh quá 20 giây bị dọn, phòng còn báo danh vẫn ở lại');

  console.log('Tên phòng');
  ok(cleanRoomName('Phòng   đm vui vẻ') === 'Phòng *** vui vẻ', `che từ thô tục ("${cleanRoomName('Phòng   đm vui vẻ')}")`);
  ok(cleanRoomName('Đầm sen') === 'Đầm sen', 'không che nhầm chữ bình thường có chứa ký tự giống (Đầm sen)');
  ok(cleanRoomName('x'.repeat(40)).length === 24 && cleanRoomName('   ') === 'Phòng không tên', 'tối đa 24 ký tự, tên trống thì đặt tên mặc định');
  ok(cleanRoomName('<b>hack</b>') === 'bhack/b', 'bỏ ký tự có thể chèn mã HTML');

  console.log('Chưa có phòng nào');
  B.stop(); C.stop(); D.stop(); await wait(200);
  for (const k of [...registry.keys()]) if (k === DIR_ID) registry.get(k)!.destroy();
  const t0 = Date.now(); list = await fetchRooms({ p2p: Ctor, channel: false });
  ok(list.length === 0 && Date.now() - t0 < 1500, `danh sách trống, trả về nhanh (${Date.now() - t0} ms)`);

  console.log('Kênh nội bộ (các tab cùng trình duyệt)');
  const T = new DirectoryAnnouncer(() => room('TAB-555', 'Phòng tab'), { p2p: null, channel: true, intervalMs: 100 }).start();
  await wait(150);
  list = await fetchRooms({ p2p: null, channel: true });
  ok(list.some(r => r.code === 'TAB-555'), 'tab khác thấy phòng qua kênh nội bộ');
  T.stop(); await wait(100);
  list = await fetchRooms({ p2p: null, channel: true });
  ok(!list.some(r => r.code === 'TAB-555'), 'đóng phòng thì tab khác không còn thấy');

  console.log(fails ? `\nCÓ ${fails} LỖI (${passes} đạt)` : `\nTất cả ${passes} kiểm tra đều đạt`);
  process.exit(fails ? 1 : 0);
}
void main();
