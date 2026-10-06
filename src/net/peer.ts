// Kết nối qua mạng thật (P2P, WebRTC) bằng PeerJS.
// - Chủ phòng đăng ký tên "ngvp-<mã phòng>" trên máy giới thiệu công cộng của PeerJS; người vào phòng nối tới tên đó.
// - Mỗi tin nhắn mang MÃ MÁY LOGIC của người gửi (cùng mã với kênh nội bộ các tab), nên chủ phòng nhận ra đúng người
//   dù họ vào bằng đường nào, và vào lại đúng nhân vật vẫn hoạt động.
// - Kênh dữ liệu tin cậy, có thứ tự (như kênh nội bộ). Người vào phòng mất kết nối thì tự nối lại mỗi 2 giây.
import type { Transport } from './transport';

/** Phần PeerJS mà ta dùng (để kiểm tra tự động có thể thay bằng bản giả) */
export interface PeerLike {
  on(ev: 'open', fn: (id: string) => void): void;
  on(ev: 'connection', fn: (c: ConnLike) => void): void;
  on(ev: 'error', fn: (e: { type?: string; message?: string }) => void): void;
  on(ev: 'disconnected', fn: () => void): void;
  connect(id: string, opts?: Record<string, unknown>): ConnLike;
  reconnect(): void;
  destroy(): void;
  destroyed: boolean;
  disconnected: boolean;
}
export interface ConnLike {
  open: boolean;
  on(ev: 'open' | 'close', fn: () => void): void;
  on(ev: 'data', fn: (d: unknown) => void): void;
  on(ev: 'error', fn: (e: unknown) => void): void;
  send(d: unknown): void;
  close(): void;
}
export type PeerCtor = new (id?: string, opts?: Record<string, unknown>) => PeerLike;

/** Trạng thái đường P2P để giao diện hiện cho người chơi */
export type P2PStatus = 'connecting' | 'ready' | 'offline' | 'taken' | 'notfound';

/** Chống dồn hàng đợi: PeerJS cho dồn tới 8 MB chưa gửi; mạng chậm hơn lượng gửi thì độ trễ tăng mãi (vài phút sau thành "đứng im").
 *  Gói "chỉ cần bản mới nhất" bị bỏ qua khi kênh còn tồn đọng quá ngưỡng; gói quan trọng (lệnh, sự kiện, bắt đầu/kết thúc...) luôn gửi. */
export const BACKLOG_LIMIT = 16 * 1024; // khoảng 1 giây ở mạng rất chậm (18 KB/giây); Wi-Fi bình thường không chạm tới
export function droppable(m: unknown): boolean {
  const t = (m as { t?: string; p?: number } | null)?.t;
  return t === 'pos' || t === 'input' || t === 'lst' || (t === 'full' && (m as { p?: number }).p === 1);
}
export function backlog(c: ConnLike): number {
  const x = c as unknown as { dataChannel?: { bufferedAmount?: number }; bufferSize?: number };
  return (x.dataChannel?.bufferedAmount ?? 0) + ((x.bufferSize ?? 0) > 0 ? 1e9 : 0);
}
export const hostPeerName = (code: string) => 'ngvp-' + code.toLowerCase().replace(/[^a-z0-9]/g, '');

export class PeerTransport implements Transport {
  private peer: PeerLike | null = null;
  private handlers: ((from: string, msg: unknown) => void)[] = [];
  /** mã máy logic → kết nối */
  private conns = new Map<string, ConnLike>();
  /** chủ phòng: mọi kết nối đang mở (kể cả kết nối mới chưa biết của ai) */
  private all = new Set<ConnLike>();
  private hostConn: ConnLike | null = null;
  private queue: unknown[] = [];
  private closed = false;
  private retry = 0;
  status: P2PStatus = 'connecting';
  onStatus = (_s: P2PStatus) => {};

  constructor(readonly peerId: string, private mode: 'host' | 'client', private code: string, private Ctor: PeerCtor) {
    this.start();
  }
  private setStatus(s: P2PStatus) { if (this.status !== s) { this.status = s; this.onStatus(s); } }

  private start() {
    if (this.closed) return;
    // Chủ phòng: tên cố định theo mã phòng. Người vào phòng: để máy giới thiệu tự đặt tên (tránh trùng khi vào lại nhanh).
    const p = this.mode === 'host' ? new this.Ctor(hostPeerName(this.code), { debug: 0 }) : new this.Ctor(undefined, { debug: 0 });
    this.peer = p;
    p.on('open', () => { if (this.mode === 'host') this.setStatus('ready'); else this.connectHost(); });
    p.on('connection', (c) => { if (this.mode === 'host') this.attach(c); else c.close(); });
    p.on('disconnected', () => { if (!this.closed && !p.destroyed) globalThis.setTimeout(() => { if (!this.closed && p.disconnected && !p.destroyed) p.reconnect(); }, 1500); });
    p.on('error', (e) => {
      const t = e?.type ?? '';
      if (t === 'unavailable-id') this.setStatus('taken');          // mã phòng trùng với phòng khác đang mở
      else if (t === 'peer-unavailable') { this.setStatus('notfound'); this.scheduleRetry(); } // chưa thấy chủ phòng (có thể chưa sẵn sàng)
      else if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed' || t === 'browser-incompatible' || t === 'ssl-unavailable') this.setStatus('offline');
    });
  }

  /** Người vào phòng: nối tới chủ phòng; mất kết nối thì thử lại */
  private connectHost() {
    const p = this.peer;
    if (!p || this.closed) return;
    const c = p.connect(hostPeerName(this.code), { serialization: 'json', reliable: true });
    this.hostConn = c;
    c.on('open', () => {
      this.retry = 0; this.setStatus('ready');
      c.send({ f: this.peerId, m: { t: 'hb' } }); // chào ngay để chủ phòng nhận ra kết nối này là của ai
      for (const m of this.queue.splice(0)) c.send(m);
    });
    c.on('data', (d) => this.deliver(d, c));
    c.on('close', () => { if (this.hostConn === c) { this.hostConn = null; this.setStatus('connecting'); this.scheduleRetry(); } });
    c.on('error', () => undefined);
  }
  private scheduleRetry() {
    if (this.closed || this.mode !== 'client') return;
    const wait = Math.min(4000, 1000 + this.retry++ * 500);
    globalThis.setTimeout(() => { if (!this.closed && !this.hostConn?.open) this.connectHost(); }, wait);
  }

  /** Chủ phòng: có người nối tới */
  private attach(c: ConnLike) {
    this.all.add(c);
    c.on('data', (d) => this.deliver(d, c));
    c.on('close', () => { this.all.delete(c); for (const [id, x] of this.conns) if (x === c) this.conns.delete(id); });
    c.on('error', () => undefined);
  }
  private deliver(d: unknown, c: ConnLike) {
    const e = d as { f?: unknown; m?: unknown };
    if (!e || typeof e.f !== 'string' || e.f.length > 40) return;
    this.conns.set(e.f, c);
    for (const h of this.handlers) h(e.f, e.m);
  }

  send(to: string | '*', msg: unknown) {
    if (this.closed) return;
    const pkt = { f: this.peerId, m: msg };
    const drop = droppable(msg);
    if (this.mode === 'client') {
      // người vào phòng chỉ có một đường: tới chủ phòng (chưa mở thì xếp hàng, tối đa 50 tin)
      if (this.hostConn?.open) { if (!(drop && backlog(this.hostConn) > BACKLOG_LIMIT)) this.hostConn.send(pkt); }
      else if ((msg as { t?: string })?.t !== 'pos' && (msg as { t?: string })?.t !== 'input' && this.queue.length < 50) this.queue.push(pkt);
      return;
    }
    // đường nào đang tồn đọng: bỏ qua gói "chỉ cần bản mới nhất" (vị trí, điều khiển, trạng thái định kỳ), không để hàng đợi phình
    if (to === '*') { for (const c of this.all) if (c.open && !(drop && backlog(c) > BACKLOG_LIMIT)) c.send(pkt); return; }
    const c = this.conns.get(to);
    if (c?.open && !(drop && backlog(c) > BACKLOG_LIMIT)) c.send(pkt);
  }
  /** Chủ phòng: mã máy logic này có đang nối qua P2P không */
  knows(id: string) { return this.conns.has(id); }
  onMessage(fn: (from: string, msg: unknown) => void) { this.handlers.push(fn); }
  close() {
    this.closed = true;
    for (const c of this.all) c.close();
    this.hostConn?.close();
    this.peer?.destroy();
    this.handlers = [];
  }
}
