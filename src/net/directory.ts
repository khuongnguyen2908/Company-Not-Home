// Danh bạ phòng Public (không cần máy chủ riêng).
// P2P: một trình duyệt giữ mã cố định DIR_ID làm "quầy danh bạ". Chủ phòng Public báo danh mỗi ANNOUNCE_MS;
// không thấy quầy thì tự nhận làm quầy (người giữ quầy thoát thì người khác nhận thay, các phòng báo danh lại).
// Người tìm phòng hỏi quầy để lấy danh sách. Kênh nội bộ (BroadcastChannel): các tab cùng trình duyệt / màn chia ô thấy nhau.
import type { PeerCtor, PeerLike, ConnLike } from './peer';

export interface RoomEntry {
  code: string; name: string; host: string;
  players: number; max: number; status: 'wait' | 'play';
  at: number;
}
export const DIR_ID = 'ngvp-dir-v1';
export const ANNOUNCE_MS = 5000;
export const STALE_MS = 20000;

const BAD = ['địt', 'lồn', 'cặc', 'buồi', 'đéo', 'đụ', 'đm', 'đmm', 'vcl', 'vkl', 'clm', 'dcm'];
/** Tên phòng: tối đa 24 ký tự, bỏ ký tự điều khiển, che từ thô tục */
export function cleanRoomName(s: string, fallback = 'Phòng không tên'): string {
  let t = String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  for (const w of BAD) t = t.replace(new RegExp(`(^|[^\\p{L}])${w}(?=$|[^\\p{L}])`, 'giu'), (_m, a: string) => a + '***');
  return t || fallback;
}
/** Kiểm dữ liệu báo danh nhận được (không tin dữ liệu từ máy khác) */
export function validEntry(e: unknown): RoomEntry | null {
  const x = e as Partial<RoomEntry> | null;
  if (!x || typeof x.code !== 'string' || !/^[A-Z]{3}-[0-9]{3}$/.test(x.code)) return null;
  const n = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : lo);
  return {
    code: x.code, name: cleanRoomName(String(x.name ?? '')), host: String(x.host ?? '').slice(0, 24),
    players: n(x.players, 0, 10), max: n(x.max, 1, 10), status: x.status === 'play' ? 'play' : 'wait', at: 0,
  };
}
/** Sắp xếp: phòng đang chờ trước, đông người trước */
export function sortRooms(list: RoomEntry[]): RoomEntry[] {
  return [...list].sort((a, b) => (a.status === b.status ? b.players - a.players || a.name.localeCompare(b.name) : a.status === 'wait' ? -1 : 1));
}

type Msg = { t: 'ann'; e: RoomEntry } | { t: 'ack' } | { t: 'del'; code: string } | { t: 'list' } | { t: 'rooms'; rooms: RoomEntry[] };

/** Quầy danh bạ (P2P) */
class DirNode {
  entries = new Map<string, RoomEntry>();
  constructor(readonly peer: PeerLike, private clock: () => number) {
    peer.on('connection', (c: ConnLike) => c.on('data', (d: unknown) => this.handle(c, d as Msg)));
  }
  put(e: RoomEntry) { this.entries.set(e.code, { ...e, at: this.clock() }); }
  handle(c: ConnLike, m: Msg) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'ann') { const e = validEntry(m.e); if (e) { this.put(e); c.send({ t: 'ack' } satisfies Msg); } } // xác nhận để người báo danh biết quầy còn sống
    else if (m.t === 'del' && typeof m.code === 'string') this.entries.delete(m.code);
    else if (m.t === 'list') c.send({ t: 'rooms', rooms: this.list() } satisfies Msg);
  }
  list(): RoomEntry[] {
    const now = this.clock();
    for (const [k, e] of this.entries) if (now - e.at > STALE_MS) this.entries.delete(k);
    return sortRooms([...this.entries.values()]);
  }
}

export interface DirOpts { clock?: () => number; channel?: boolean; p2p?: PeerCtor | null; intervalMs?: number }

/** Chủ phòng: báo danh phòng Public định kỳ (getEntry trả null = phòng Private, gỡ khỏi danh bạ) */
export class DirectoryAnnouncer {
  private timer = 0;
  private stopped = false;
  private node: DirNode | null = null;
  private peer: PeerLike | null = null;
  private conn: ConnLike | null = null;
  private busy = false;
  private listed: string | null = null;
  private bc: BroadcastChannel | null = null;
  private clock: () => number;
  constructor(private getEntry: () => Omit<RoomEntry, 'at'> | null, private opts: DirOpts = {}) {
    this.clock = opts.clock ?? (() => Date.now());
    if (opts.channel !== false && typeof BroadcastChannel !== 'undefined') {
      this.bc = new BroadcastChannel('ngvp-dir');
      this.bc.onmessage = (ev) => { if ((ev.data as Msg)?.t === 'list') this.postTab(); };
    }
  }
  start() { this.tick(); this.timer = globalThis.setInterval(() => this.tick(), this.opts.intervalMs ?? ANNOUNCE_MS) as unknown as number; return this; }
  /** Gọi ngay khi đổi tên / Public / số người để danh bạ cập nhật sớm */
  now() { this.tick(); }
  stop() {
    this.stopped = true; globalThis.clearInterval(this.timer);
    const code = this.listed;
    if (code) { this.bc?.postMessage({ t: 'del', code } satisfies Msg); if (this.conn?.open) this.conn.send({ t: 'del', code } satisfies Msg); }
    this.bc?.close(); this.conn?.close(); this.peer?.destroy(); this.node?.peer.destroy();
  }
  /** Đang giữ quầy danh bạ (cho bộ thử) */
  get isNode() { return !!this.node; }
  private postTab() { const e = this.getEntry(); if (e) this.bc?.postMessage({ t: 'ann', e: { ...e, at: 0 } } satisfies Msg); }
  private tick() {
    if (this.stopped) return;
    const e = this.getEntry();
    if (!e) {
      if (this.listed) { this.bc?.postMessage({ t: 'del', code: this.listed } satisfies Msg); this.node?.entries.delete(this.listed); if (this.conn?.open) this.conn.send({ t: 'del', code: this.listed } satisfies Msg); this.listed = null; }
      return;
    }
    this.listed = e.code;
    this.postTab();
    if (!this.opts.p2p) return;
    const entry = { ...e, at: 0 };
    if (this.node) { this.node.put(entry); return; }
    // quầy không xác nhận 3 lần báo danh liền (rớt mạng im lặng, quầy đã đóng): bỏ kết nối cũ, nối lại hoặc tự nhận quầy
    if (this.conn && Date.now() - this.lastAck > 3 * (this.opts.intervalMs ?? ANNOUNCE_MS) + 200) { const c = this.conn; this.conn = null; c.close(); }
    if (this.conn?.open) { this.conn.send({ t: 'ann', e: entry } satisfies Msg); return; }
    this.connectOrClaim();
  }
  /** Thử nối tới quầy; không có quầy thì tự nhận làm quầy */
  private connectOrClaim() {
    if (this.busy || this.stopped || !this.opts.p2p) return;
    this.busy = true;
    this.ensurePeer();
    if (this.peerOpen) this.tryConnect();
  }
  private peerOpen = false;
  private lastAck = 0;
  /** Một kết nối riêng cho việc báo danh, đăng ký trình xử lý đúng một lần */
  private ensurePeer() {
    if (this.peer) return;
    const p = new this.opts.p2p!(undefined, { debug: 0 });
    this.peer = p;
    p.on('open', () => { this.peerOpen = true; if (this.busy && !this.node) this.tryConnect(); });
    p.on('error', (err) => {
      if (this.stopped) return;
      if (err?.type === 'peer-unavailable') this.claim(); // chưa có quầy: tự nhận
      else this.busy = false;
    });
  }
  private tryConnect() {
    const c = this.peer!.connect(DIR_ID, { reliable: true });
    c.on('open', () => { this.conn = c; this.busy = false; this.lastAck = Date.now(); this.tick(); });
    c.on('close', () => { if (this.conn === c) this.conn = null; });
    c.on('data', (d: unknown) => { if ((d as Msg)?.t === 'ack') this.lastAck = Date.now(); });
  }
  private claim() {
    const Ctor = this.opts.p2p!;
    const np = new Ctor(DIR_ID, { debug: 0 });
    np.on('open', () => {
      if (this.stopped) { np.destroy(); return; }
      this.node = new DirNode(np, this.clock); this.busy = false;
      // mất kết nối với máy chủ trung gian: bỏ quầy, lần sau nối/nhận lại
      np.on('disconnected', () => { if (this.node?.peer === np) { this.node = null; np.destroy(); } });
      this.tick();
    });
    np.on('error', (err) => {
      // có người vừa nhận quầy trước: lần báo danh tới sẽ nối tới quầy đó
      if (err?.type === 'unavailable-id') { np.destroy(); this.busy = false; }
    });
  }
}

/** Người tìm phòng: lấy danh sách phòng Public (kênh nội bộ + quầy P2P), gộp và sắp xếp */
export function fetchRooms(opts: DirOpts & { timeoutMs?: number } = {}): Promise<RoomEntry[]> {
  const found = new Map<string, RoomEntry>();
  const add = (x: unknown) => { const e = validEntry(x); if (e) found.set(e.code, e); };
  const waits: Promise<void>[] = [];
  if (opts.channel !== false && typeof BroadcastChannel !== 'undefined') {
    waits.push(new Promise(res => {
      const bc = new BroadcastChannel('ngvp-dir');
      const gone = new Set<string>();
      bc.onmessage = (ev) => { const m = ev.data as Msg; if (m?.t === 'ann' && !gone.has(m.e?.code)) add(m.e); if (m?.t === 'del') { gone.add(m.code); found.delete(m.code); } };
      bc.postMessage({ t: 'list' } satisfies Msg);
      globalThis.setTimeout(() => { bc.close(); res(); }, 600);
    }));
  }
  if (opts.p2p) {
    const Ctor = opts.p2p;
    waits.push(new Promise(res => {
      let done = false;
      const p = new Ctor(undefined, { debug: 0 });
      const finish = () => { if (done) return; done = true; globalThis.setTimeout(() => p.destroy(), 50); res(); };
      p.on('error', () => finish()); // không có quầy (chưa có phòng Public nào) hoặc lỗi mạng
      p.on('open', () => {
        const c = p.connect(DIR_ID, { reliable: true });
        c.on('open', () => c.send({ t: 'list' } satisfies Msg));
        c.on('data', (d: unknown) => { const m = d as Msg; if (m?.t === 'rooms' && Array.isArray(m.rooms)) { m.rooms.forEach(add); finish(); } });
      });
      globalThis.setTimeout(finish, opts.timeoutMs ?? 4000);
    }));
  }
  return Promise.all(waits).then(() => sortRooms([...found.values()]));
}
