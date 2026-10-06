// Kiểm tra chống dồn hàng đợi P2P: mạng chậm hơn lượng gửi (Wi-Fi văn phòng chập chờn).
// PeerJS giả có băng thông giới hạn và bufferedAmount như WebRTC thật. So sánh độ trễ gói vị trí: gửi tất cả (cách cũ) vs bỏ gói cũ khi nghẽn (cách mới).
// Cách dùng: npx tsx tests/p2p_lag_test.ts
import { PeerTransport, type PeerCtor } from '../src/net/peer';
let passes = 0, fails = 0;
const ok = (c: boolean, m: string) => { if (c) { passes++; console.log('  ✔ ' + m); } else { fails++; console.log('  ✘ ' + m); } };
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const BW = 18 * 1024; // byte mỗi giây
const registry = new Map<string, FakePeer>();
class FakeConn {
  open = false; other: FakeConn | null = null;
  dataChannel = { bufferedAmount: 0 };
  private q: { d: unknown; n: number }[] = [];
  private h: Record<string, ((x?: unknown) => void)[]> = {};
  private pump = 0;
  on(ev: string, fn: (x?: unknown) => void) { (this.h[ev] ??= []).push(fn); }
  emit(ev: string, x?: unknown) { for (const f of this.h[ev] ?? []) f(x); }
  send(d: unknown) {
    if (!this.open) return;
    const n = JSON.stringify(d).length; this.q.push({ d: JSON.parse(JSON.stringify(d)), n }); this.dataChannel.bufferedAmount += n;
    if (!this.pump) this.pump = setInterval(() => this.drain(), 20) as unknown as number;
  }
  private drain() { // mỗi 20 ms gửi được BW*0.02 byte, đúng thứ tự (kênh tin cậy)
    let budget = BW * 0.02;
    while (this.q.length && budget >= this.q[0].n) { const x = this.q.shift()!; budget -= x.n; this.dataChannel.bufferedAmount -= x.n; const o = this.other; if (o?.open) o.emit('data', x.d); }
    if (this.q.length && budget > 0) { this.q[0].n -= budget; this.dataChannel.bufferedAmount -= budget; }
  }
  close() { this.open = false; clearInterval(this.pump); }
}
class FakePeer {
  destroyed = false; disconnected = false; id: string;
  private h: Record<string, ((x?: unknown) => void)[]> = {};
  constructor(id?: string) { this.id = id ?? 'p' + Math.random().toString(36).slice(2); setTimeout(() => { registry.set(this.id, this); this.emit('open', this.id); }, 5); }
  on(ev: string, fn: (x?: unknown) => void) { (this.h[ev] ??= []).push(fn); }
  emit(ev: string, x?: unknown) { for (const f of this.h[ev] ?? []) f(x); }
  connect(id: string) {
    const mine = new FakeConn();
    setTimeout(() => { const t = registry.get(id); if (!t) return; const theirs = new FakeConn(); mine.other = theirs; theirs.other = mine; mine.open = theirs.open = true; t.emit('connection', theirs); mine.emit('open'); }, 10);
    return mine;
  }
  reconnect() {} destroy() { this.destroyed = true; registry.delete(this.id); }
}
const Ctor = FakePeer as unknown as PeerCtor;

async function run(label: string, posType: string, fullMsg: (seq: number) => Record<string, unknown>) {
  registry.clear();
  const host = new PeerTransport('H', 'host', 'LAG-123', Ctor);
  const cli = new PeerTransport('A', 'client', 'LAG-123', Ctor);
  const lat: number[] = []; let critical = 0;
  cli.onMessage((_f, m) => { const x = m as { t: string; ts?: number }; if (x.t === posType && x.ts) lat.push(Date.now() - x.ts); if (x.t === 'start') critical++; });
  await wait(100);
  const pad = 'x'.repeat(260), big = 'y'.repeat(4400);
  let seq = 0, sentCritical = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    seq++;
    host.send('*', { t: posType, ts: Date.now(), pad }); // vị trí 20 lần/giây (~300 byte)
    if (seq % 5 === 0) host.send('*', { ...fullMsg(seq), big }); // trạng thái 4 lần/giây (~4,5 KB)
    if (seq % 40 === 0) { host.send('*', { t: 'start', n: seq }); sentCritical++; } // gói quan trọng
    await wait(50);
  }
  await wait(3000);
  const last = lat.slice(-20), avg = last.reduce((a, b) => a + b, 0) / Math.max(1, last.length);
  console.log(`  ${label}: độ trễ gói vị trí lúc cuối ≈ ${(avg / 1000).toFixed(1)} giây; gói quan trọng tới ${critical}/${sentCritical}`);
  host.close(); cli.close();
  return { avg, critical, sentCritical };
}

async function main() {
  console.log('Mạng 18 KB/giây, chủ phòng gửi khoảng 26 KB/giây, chạy 20 giây');
  const old = await run('Cách cũ (gửi tất cả)', 'posOld', () => ({ t: 'fullOld' }));
  const neu = await run('Cách mới (bỏ gói cũ khi nghẽn)', 'pos', () => ({ t: 'full', p: 1 }));
  ok(old.avg > 3000, `cách cũ: độ trễ dồn lên nhiều giây và còn tăng tiếp (${(old.avg / 1000).toFixed(1)} giây sau 20 giây)`);
  ok(neu.avg < 1500 && neu.avg < old.avg / 3, `cách mới: độ trễ giữ ở mức thấp, không dồn (${(neu.avg / 1000).toFixed(1)} giây)`);
  ok(neu.critical === neu.sentCritical, `cách mới: mọi gói quan trọng vẫn tới đủ (${neu.critical}/${neu.sentCritical})`);
  console.log(fails ? `\nCÓ ${fails} LỖI (${passes} đạt)` : `\nTất cả ${passes} kiểm tra đều đạt`);
  process.exit(fails ? 1 : 0);
}
void main();
