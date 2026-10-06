import { netMeter } from './netlog';
// Lớp truyền tin: tách riêng để đổi được cách kết nối mà không đụng phần còn lại của game.
// - TabTransport: các tab cùng trình duyệt nói chuyện trực tiếp (BroadcastChannel), không cần mạng.
// - MemoryHub: dùng trong kiểm tra tự động, giả lập độ trễ và mất gói tin.
// Giai đoạn sau: P2P (WebRTC) và máy chủ chuyển tiếp cũng chỉ cần cài đúng giao diện Transport này.

export interface Envelope { from: string; to: string | '*'; msg: unknown }

export interface Transport {
  readonly peerId: string;
  /** Gửi cho một máy (to = mã máy) hoặc cả phòng ('*') */
  send(to: string | '*', msg: unknown): void;
  onMessage(fn: (from: string, msg: unknown) => void): void;
  close(): void;
  /** đường tới máy này đang tồn đọng (gửi thêm chỉ làm trễ thêm) */
  busy?(to: string): boolean;
}

export function newPeerId(): string {
  const a = new Uint8Array(6);
  (globalThis.crypto ?? { getRandomValues: (x: Uint8Array) => { for (let i = 0; i < x.length; i++) x[i] = Math.floor(Math.random() * 256); return x; } }).getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Các tab cùng trình duyệt: mỗi phòng một kênh riêng theo mã phòng */
export class TabTransport implements Transport {
  readonly peerId: string;
  private ch: BroadcastChannel;
  private handlers: ((from: string, msg: unknown) => void)[] = [];
  private closed = false;
  constructor(room: string, peerId = newPeerId()) {
    this.peerId = peerId;
    this.ch = new BroadcastChannel('ngvp-room-' + room.toUpperCase());
    this.ch.onmessage = (ev: MessageEvent<Envelope>) => {
      const e = ev.data;
      if (!e || e.from === this.peerId || (e.to !== '*' && e.to !== this.peerId)) return;
      for (const h of this.handlers) h(e.from, e.msg);
    };
  }
  send(to: string | '*', msg: unknown) { if (!this.closed) this.ch.postMessage({ from: this.peerId, to, msg } satisfies Envelope); }
  onMessage(fn: (from: string, msg: unknown) => void) { this.handlers.push(fn); }
  close() { this.closed = true; this.ch.close(); this.handlers = []; }
}

/** Mạng giả trong bộ nhớ (kiểm tra tự động): độ trễ ngẫu nhiên trong [latMin, latMax] ms, mất gói theo tỉ lệ loss */
export class MemoryHub {
  private peers = new Map<string, MemoryTransport>();
  now = 0;
  private queue: { at: number; to: MemoryTransport; from: string; msg: unknown; seq: number }[] = [];
  private lastAt = new Map<string, number>();
  private seq = 0;
  constructor(public latMin = 0, public latMax = 0, public loss = 0, private rng: () => number = Math.random) {}
  join(peerId = newPeerId()) { const t = new MemoryTransport(this, peerId); this.peers.set(peerId, t); return t; }
  leave(peerId: string) { this.peers.delete(peerId); }
  post(from: string, to: string | '*', msg: unknown) {
    // tin "quan trọng" (không phải vị trí) không bị mất, giống kênh tin cậy; tin vị trí có thể mất
    const lossy = typeof msg === 'object' && msg !== null && (msg as { t?: string }).t === 'pos';
    const targets = to === '*' ? [...this.peers.values()].filter(p => p.peerId !== from) : [this.peers.get(to)].filter(Boolean) as MemoryTransport[];
    for (const t of targets) {
      if (lossy && this.rng() < this.loss) continue;
      const lat = this.latMin + this.rng() * (this.latMax - this.latMin);
      // kênh tin cậy giữ đúng thứ tự giữa hai máy (như kênh dữ liệu có thứ tự): tin sau không tới trước tin trước
      const key = from + '>' + t.peerId;
      let at = this.now + lat;
      if (!lossy) { at = Math.max(at, this.lastAt.get(key) ?? 0); this.lastAt.set(key, at); }
      // sao chép như qua mạng thật (không chia sẻ tham chiếu)
      this.queue.push({ at, to: t, from, msg: JSON.parse(JSON.stringify(msg)), seq: this.seq++ });
    }
  }
  /** Chạy đồng hồ mạng tới thời điểm ms, giao các tin đã tới hạn (giữ thứ tự cho tin tin cậy) */
  tick(ms: number) {
    this.now = ms;
    this.queue.sort((a, b) => a.at - b.at || a.seq - b.seq);
    while (this.queue.length && this.queue[0].at <= ms) { const q = this.queue.shift()!; q.to.deliver(q.from, q.msg); }
  }
}
export class MemoryTransport implements Transport {
  private handlers: ((from: string, msg: unknown) => void)[] = [];
  constructor(private hub: MemoryHub, readonly peerId: string) {}
  send(to: string | '*', msg: unknown) { this.hub.post(this.peerId, to, msg); }
  onMessage(fn: (from: string, msg: unknown) => void) { this.handlers.push(fn); }
  deliver(from: string, msg: unknown) { for (const h of this.handlers) h(from, msg); }
  close() { this.hub.leave(this.peerId); this.handlers = []; }
}

/**
 * Gộp nhiều đường truyền (kênh nội bộ các tab + P2P): mọi đường dùng chung một mã máy logic.
 * Gửi cho một người thì đi đúng đường người đó đã dùng; gửi cả phòng thì đi mọi đường; chưa biết thì thử mọi đường.
 * Một tin có thể tới qua hai đường (khi người đó ở cùng trình duyệt VÀ nối P2P): bỏ bản trùng nhận sau.
 */
export class MultiTransport implements Transport {
  readonly peerId: string;
  private route = new Map<string, Transport>();
  private heard = new Map<string, number>();
  private handlers: ((from: string, msg: unknown) => void)[] = [];
  private subs: Transport[] = [];
  constructor(first: Transport[]) {
    this.peerId = first[0].peerId;
    for (const t of first) this.add(t);
  }
  /** Thêm một đường truyền (ví dụ bật P2P sau khi kênh nội bộ không thấy chủ phòng) */
  add(t: Transport) {
    this.subs.push(t);
    t.onMessage((from, msg) => {
      const now = Date.now();
      const cur = this.route.get(from);
      // người này đang dùng đường khác: bỏ bản trùng; trừ khi đường cũ đã im quá 3 giây (đường cũ chết) thì chuyển sang đường mới
      if (cur && cur !== t && now - (this.heard.get(from) ?? 0) < 3000) return;
      this.route.set(from, t); this.heard.set(from, now);
      if (netMeter.on) netMeter.down += JSON.stringify(msg)?.length ?? 0;
      for (const h of this.handlers) h(from, msg);
    });
  }
  send(to: string | '*', msg: unknown) {
    if (netMeter.on) netMeter.up += JSON.stringify(msg)?.length ?? 0;
    if (to === '*') { for (const t of this.subs) t.send('*', msg); return; }
    const t = this.route.get(to);
    if (t) t.send(to, msg); else for (const s of this.subs) s.send(to, msg);
  }
  busy(to: string) { const t = this.route.get(to); return !!t?.busy?.(to); }
  forget(id: string) { this.route.delete(id); this.heard.delete(id); }
  onMessage(fn: (from: string, msg: unknown) => void) { this.handlers.push(fn); }
  close() { for (const t of this.subs) t.close(); this.handlers = []; }
}
