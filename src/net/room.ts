// Điều phối phòng nhiều người chơi.
// Chủ phòng (NetHost): chạy World thật, nhận người vào, giao nhân vật, nhận điều khiển và lệnh, gửi ảnh chụp đã lọc.
// Người vào phòng (NetClient): giữ bản sao World để giao diện chạy nguyên vẹn, gửi điều khiển và lệnh lên chủ phòng.
import type { Look } from '../game/look';
import type { World, GameEvent } from '../game/sim';
import type { Transport } from './transport';
import { buildFull, buildPos, createReplica, applyFull, applyPos, filterEvent, type FullSnap, type PosRow } from './snapshot';
import { runAction } from './actions';
import { session } from '../session';

export const MAX_PLAYERS = 10;
/** Vị trí chủ phòng gửi (x, y) và vị trí đang vẽ (cx, cy) của một nhân vật khác */
export interface Target { x: number; y: number; cx?: number; cy?: number }
export type NetRole = 'solo' | 'host' | 'client';
export interface Profile { name: string; look: Look; empId: string }
export interface RoomPlayer extends Profile { peer: string; host: boolean }
export interface RoomSettings { fillBots: boolean; seats: number; imps: 1 | 2 }

// ---------- Tin nhắn ----------
export type ToHost =
  | { t: 'hello'; p: Profile }
  | { t: 'input'; x: number; y: number }
  | { t: 'act'; id: number; name: string; args: unknown[] }
  | { t: 'ready'; on: boolean }
  | { t: 'leave' };
export type ToClient =
  | { t: 'room'; code: string; players: RoomPlayer[]; settings: RoomSettings; inGame: boolean }
  | { t: 'reject'; reason: string }
  | { t: 'start'; full: FullSnap }
  | { t: 'full'; full: FullSnap; ev?: GameEvent[] }
  | { t: 'pos'; p: PosRow[]; time: number }
  | { t: 'actRes'; id: number; err: string }
  | { t: 'ready'; ids: number[] }
  | { t: 'go' }
  | { t: 'end' }
  | { t: 'closed' };

/** Mã phòng 6 ký tự dễ đọc (bỏ các ký tự dễ nhầm như O/0, I/1) */
export function newRoomCode(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ', D = '23456789';
  const r = (s: string) => s[Math.floor(Math.random() * s.length)];
  return r(A) + r(A) + r(A) + '-' + r(D) + r(D) + r(D);
}
export const normalizeCode = (s: string) => {
  const c = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === 6 ? c.slice(0, 3) + '-' + c.slice(3) : s.toUpperCase().trim();
};

// ---------- Trạng thái mạng dùng chung ----------
export const net = {
  role: 'solo' as NetRole,
  host: null as NetHost | null,
  client: null as NetClient | null,
  /** báo lỗi của lệnh (người vào phòng nhận lỗi từ chủ phòng) */
  onError: (_m: string) => {},
};

/** Cửa lệnh duy nhất cho giao diện: chạy thẳng (một mình / chủ phòng) hoặc gửi lên chủ phòng */
export function act(name: string, ...args: unknown[]): string | null {
  const w = session.world;
  if (!w) return null;
  if (net.role === 'client' && net.client) { net.client.sendAct(name, args); return null; }
  return runAction(w, w.player.id, name, args);
}

// =============================================================================================
// CHỦ PHÒNG
// =============================================================================================
export class NetHost {
  players: RoomPlayer[] = [];
  settings: RoomSettings = { fillBots: true, seats: 8, imps: 1 };
  /** máy → nhân vật trong ván đang chơi */
  agentOf = new Map<string, number>();
  inGame = false;
  onRoomChange = () => {};
  /** người vào phòng bấm Sẵn sàng / Hủy ở tờ phân công (giao diện chủ phòng giữ danh sách) */
  onReadyMsg = (_id: number, _on: boolean) => {};
  private posT = 0; private fullT = 0;
  private spawnDeadline = new Map<number, number>();
  private lastSeen = new Map<string, number>();
  private lastFull = new Map<string, { key: string; at: number }>();

  constructor(public tr: Transport, public code: string, me: Profile) {
    this.players = [{ ...me, peer: tr.peerId, host: true }];
    tr.onMessage((from, raw) => this.onMsg(from, raw as ToHost));
  }

  private onMsg(from: string, m: ToHost) {
    if (!m || typeof m !== 'object') return;
    this.lastSeen.set(from, performance.now());
    const pl = this.players.find(p => p.peer === from);
    switch (m.t) {
      case 'hello': {
        if (this.inGame && !pl) { this.tr.send(from, { t: 'reject', reason: 'Phòng đang chơi, đợi ván sau nhé.' } satisfies ToClient); return; }
        if (!pl && this.players.length >= MAX_PLAYERS) { this.tr.send(from, { t: 'reject', reason: `Phòng đã đủ ${MAX_PLAYERS} người.` } satisfies ToClient); return; }
        const p = sanitizeProfile(m.p);
        if (pl) Object.assign(pl, p); else this.players.push({ ...p, peer: from, host: false });
        this.fixEmpIds();
        this.broadcastRoom();
        return;
      }
      case 'leave': this.dropPeer(from); return;
    }
    if (!pl || !this.inGame) return;
    const id = this.agentOf.get(from);
    const w = session.world;
    if (id === undefined || !w) return;
    switch (m.t) {
      case 'input': {
        const x = clamp1(m.x), y = clamp1(m.y);
        w.inputs.set(id, { x, y });
        return;
      }
      case 'act': {
        if (typeof m.name !== 'string') return;
        const err = runAction(w, id, m.name, Array.isArray(m.args) ? m.args : []);
        if (err) this.tr.send(from, { t: 'actRes', id: m.id, err } satisfies ToClient);
        this.fullT = 999; // gửi trạng thái mới ngay
        return;
      }
      case 'ready': this.onReadyMsg(id, m.on !== false); return;
    }
  }

  /** Người rời phòng: trong ván thì bot chơi thay */
  dropPeer(peer: string) {
    const i = this.players.findIndex(p => p.peer === peer && !p.host);
    if (i < 0) return;
    this.players.splice(i, 1);
    const id = this.agentOf.get(peer);
    if (id !== undefined && session.world) { session.world.setHuman(id, false); this.agentOf.delete(peer); }
    this.broadcastRoom();
  }

  /** Mã nhân viên không trùng giữa những người trong phòng */
  private fixEmpIds() {
    const used = new Set<string>();
    for (const p of this.players) {
      while (!/^\d{3}$/.test(p.empId) || used.has(p.empId)) p.empId = String(100 + Math.floor(Math.random() * 900));
      used.add(p.empId);
    }
  }

  broadcastRoom() {
    this.tr.send('*', { t: 'room', code: this.code, players: this.players, settings: this.settings, inGame: this.inGame } satisfies ToClient);
    this.onRoomChange();
  }

  /** Bắt đầu ván: World đã được tạo ở chủ phòng; ghép mỗi máy với một nhân vật người thật */
  startGame(w: World, seatOf: Map<string, number>) {
    this.inGame = true;
    this.agentOf = new Map(seatOf);
    this.spawnDeadline.clear();
    for (const [peer, id] of seatOf) {
      if (peer === this.tr.peerId) continue;
      this.tr.send(peer, { t: 'start', full: buildFull(w, id, true) } satisfies ToClient);
    }
    this.broadcastRoom();
  }

  /** Mỗi khung hình (sau khi World cập nhật): gửi vị trí 20 lần/giây, ảnh chụp đầy đủ 4 lần/giây hoặc ngay khi có sự kiện */
  tick(dtMs: number, events: GameEvent[]) {
    const w = session.world;
    if (!this.inGame || !w) return;
    this.posT += dtMs; this.fullT += dtMs;
    this.autoPickSpawns(w);
    const remote = [...this.agentOf].filter(([peer]) => peer !== this.tr.peerId);
    // Ảnh chụp: gửi ngay khi có sự kiện; còn lại chỉ gửi khi có thay đổi (tối đa 4 lần/giây), lâu không đổi thì 2 giây nhắc một lần
    if (events.length || this.fullT >= 250) {
      const nowMs = performance.now();
      for (const [peer, id] of remote) {
        const v = w.agents[id];
        const ev = events.map(e => filterEvent(w, v, e)).filter((e): e is GameEvent => e !== null);
        const full = buildFull(w, id);
        const key = JSON.stringify(full);
        const last = this.lastFull.get(peer);
        if (ev.length || !last || last.key !== key || nowMs - last.at > 2000) {
          this.tr.send(peer, ev.length ? { t: 'full', full, ev } satisfies ToClient : { t: 'full', full } satisfies ToClient);
          this.lastFull.set(peer, { key, at: nowMs });
        }
      }
      this.fullT = 0;
    }
    if (this.posT >= 50) { this.posT = 0; this.tr.send('*', { t: 'pos', p: buildPos(w), time: Math.round(w.time * 100) / 100 } satisfies ToClient); }
  }

  /** Người ở máy khác không chọn nơi bắt đầu trong 10,5 giây: ở lại Phòng họp */
  private autoPickSpawns(w: World) {
    const now = performance.now();
    for (const [id] of w.spawnOffers) {
      if (id === w.meId) continue;
      if (!this.spawnDeadline.has(id)) this.spawnDeadline.set(id, now + 10500);
      else if (now > this.spawnDeadline.get(id)!) { w.chooseSpawnFor(w.agents[id], -1); this.spawnDeadline.delete(id); }
    }
    for (const id of [...this.spawnDeadline.keys()]) if (!w.spawnOffers.has(id)) this.spawnDeadline.delete(id);
  }

  /** Danh sách đã sẵn sàng (cả bot) để mọi máy hiện nhãn dưới avatar */
  broadcastReady(ids: number[]) { this.tr.send('*', { t: 'ready', ids } satisfies ToClient); }
  /** Cả phòng sẵn sàng ở tờ phân công: báo mọi máy đóng tờ phân công */
  go() { this.tr.send('*', { t: 'go' } satisfies ToClient); }
  /** Hết ván: cả phòng về màn hình phòng */
  endGame() { this.inGame = false; this.agentOf.clear(); this.tr.send('*', { t: 'end' } satisfies ToClient); this.broadcastRoom(); }
  close() { this.tr.send('*', { t: 'closed' } satisfies ToClient); this.tr.close(); }
}

// =============================================================================================
// NGƯỜI VÀO PHÒNG
// =============================================================================================
export class NetClient {
  room: { code: string; players: RoomPlayer[]; settings: RoomSettings; inGame: boolean } | null = null;
  replica: World | null = null;
  /** vị trí mục tiêu của người khác (cảnh vẽ trượt mượt tới) */
  targets = new Map<number, Target>();
  onRoom = () => {};
  onReject = (_r: string) => {};
  onStart = (_w: World) => {};
  onReady = (_ids: number[]) => {};
  onGo = () => {};
  onEnd = () => {};
  onClosed = () => {};
  private hostPeer: string | null = null;
  private actId = 0;
  private lastInput = { x: 9, y: 9 }; private inputT = 0;

  constructor(public tr: Transport, public code: string, public me: Profile) {
    tr.onMessage((from, raw) => this.onMsg(from, raw as ToClient));
  }
  /** Gõ cửa phòng (gửi lại vài lần phòng khi chủ phòng chưa sẵn sàng) */
  join() { this.tr.send(this.hostPeer ?? '*', { t: 'hello', p: this.me } satisfies ToHost); }

  private onMsg(from: string, m: ToClient) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'room') { this.hostPeer = from; this.room = { code: m.code, players: m.players, settings: m.settings, inGame: m.inGame }; this.onRoom(); return; }
    if (this.hostPeer && from !== this.hostPeer) return; // chỉ nghe chủ phòng
    switch (m.t) {
      case 'reject': this.onReject(m.reason); return;
      case 'start': {
        this.targets.clear();
        this.replica = createReplica(m.full);
        this.onStart(this.replica);
        return;
      }
      case 'full': {
        const r = this.replica; if (!r) return;
        applyFull(r, m.full);
        // sau khi áp ảnh chụp, các nhân vật khác đứng ở vị trí trượt hiện tại (không giật về vị trí cũ)
        for (const [id, t] of this.targets) { const a = r.agents[id]; if (a && id !== r.meId && t.cx !== undefined && t.cy !== undefined) { a.x = t.cx; a.y = t.cy; } }
        if (m.ev?.length) r.events.push(...m.ev);
        return;
      }
      case 'pos': { const r = this.replica; if (r) { applyPos(r, m.p, this.targets); r.time = m.time; } return; }
      case 'actRes': net.onError(m.err); return;
      case 'ready': this.onReady(m.ids); return;
      case 'go': this.onGo(); return;
      case 'end': this.replica = null; this.onEnd(); return;
      case 'closed': this.onClosed(); return;
    }
  }

  sendAct(name: string, args: unknown[]) { this.tr.send(this.hostPeer ?? '*', { t: 'act', id: ++this.actId, name, args } satisfies ToHost); }
  sendReady(on = true) { this.tr.send(this.hostPeer ?? '*', { t: 'ready', on } satisfies ToHost); }
  /** Gửi điều khiển khi đổi hướng, và nhắc lại 5 lần/giây cho chắc */
  sendInput(x: number, y: number, dtMs: number) {
    this.inputT += dtMs;
    if (x === this.lastInput.x && y === this.lastInput.y && this.inputT < 200) return;
    this.inputT = 0; this.lastInput = { x, y };
    this.tr.send(this.hostPeer ?? '*', { t: 'input', x, y } satisfies ToHost);
  }
  /** Mỗi khung hình: các nhân vật khác trượt mượt tới vị trí chủ phòng gửi */
  smooth(dtMs: number) {
    const r = this.replica; if (!r) return;
    const k = Math.min(1, dtMs / 1000 * 14);
    for (const [id, t] of this.targets) {
      const a = r.agents[id] as unknown as { x: number; y: number }; if (!a || id === r.meId) continue;
      if (Math.hypot(t.x - a.x, t.y - a.y) > 4 * 48) { a.x = t.x; a.y = t.y; } // dịch chuyển (thang, cổng): nhảy luôn
      else { a.x += (t.x - a.x) * k; a.y += (t.y - a.y) * k; }
      t.cx = a.x; t.cy = a.y;
    }
  }
  leave() { this.tr.send(this.hostPeer ?? '*', { t: 'leave' } satisfies ToHost); this.tr.close(); }
}

const clamp1 = (v: unknown) => { const n = typeof v === 'number' && Number.isFinite(v) ? v : 0; return Math.max(-1, Math.min(1, n)); };
function sanitizeProfile(p: Profile): Profile {
  const name = String(p?.name ?? 'Khách').replace(/[<>]/g, '').trim().slice(0, 16) || 'Khách';
  const empId = /^\d{3}$/.test(String(p?.empId)) ? String(p.empId) : String(100 + Math.floor(Math.random() * 900));
  return { name, look: p?.look, empId };
}
