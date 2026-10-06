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
/** Im lặng quá 4 giây: mất kết nối. Trong ván, quá 60 giây thì bot chơi thay hẳn; ở phòng chờ, quá 12 giây thì rời phòng. */
export const LOST_MS = 4000, GRACE_GAME_MS = 60000, GRACE_ROOM_MS = 12000;
/** Người vào phòng: không nghe thấy chủ phòng quá 5 giây là báo mất kết nối, quá 15 giây thì coi như phòng đã đóng. */
export const HOST_LOST_MS = 5000, HOST_GONE_MS = 15000;
/** Vị trí chủ phòng gửi (x, y) và vị trí đang vẽ (cx, cy) của một nhân vật khác */
export interface Target { x: number; y: number; cx?: number; cy?: number }
export type NetRole = 'solo' | 'host' | 'client';
export interface Profile { name: string; look: Look; empId: string }
export interface RoomPlayer extends Profile { peer: string; host: boolean; lost?: boolean /* đang mất kết nối */ }
/** Cài đặt ván do chủ phòng chỉnh ở quầy lễ tân (mọi người thấy) */
export interface RoomSettings {
  fillBots: boolean; seats: number; imps: 1 | 2;
  /** vai có kỹ năng được bật, và số vai tối đa mỗi ván */
  roles: Record<string, boolean>; maxSpecial: number;
  /** cuộc họp: thời gian thảo luận / bỏ phiếu (giây), phiếu ẩn danh */
  discussTime: number; voteTime: number; anonVotes: boolean;
  /** hồi chiêu gài bẫy (giây); 0 = tự động theo cỡ ván và số Nội gián */
  killCd: number;
  /** tên phòng (hiện trong danh sách Public); public: hiện trong danh sách Public, tắt = chỉ vào bằng mã / link mời */
  name: string; public: boolean;
}
export const DEFAULT_SETTINGS: RoomSettings = { fillBots: true, seats: 8, imps: 1, roles: {}, maxSpecial: 3, discussTime: 60, voteTime: 30, anonVotes: false, killCd: 0, name: '', public: true };
/** Trạng thái một người trong sảnh tầng G (gửi 10 lần/giây khi chưa vào ca) */
export interface LobbyState { x: number; y: number; f: 1 | -1; m: 0 | 1; seat: number | null; cup: 0 | 1; arrived: 0 | 1 }

// ---------- Tin nhắn ----------
export type ToHost =
  | { t: 'hello'; p: Profile }
  | { t: 'input'; x: number; y: number }
  | { t: 'act'; id: number; name: string; args: unknown[] }
  | { t: 'ready'; on: boolean }
  | { t: 'hb'; ts?: number }
  | { t: 'lst'; s: LobbyState }
  | { t: 'lchat'; text: string }
  | { t: 'lfx'; key: string }
  | { t: 'leave' };
export type ToClient =
  | { t: 'room'; code: string; players: RoomPlayer[]; settings: RoomSettings; inGame: boolean }
  | { t: 'reject'; reason: string }
  | { t: 'start'; full: FullSnap }
  /** p: ảnh chụp định kỳ không kèm sự kiện, được phép bỏ qua khi đường truyền nghẽn (gói sau mang trạng thái mới hơn) */
  | { t: 'full'; full: FullSnap; ev?: GameEvent[]; p?: 1 }
  /** trả lời nhịp tim: người vào phòng tính độ trễ đi về */
  | { t: 'pong'; ts: number }
  | { t: 'pos'; p: PosRow[]; time: number }
  | { t: 'actRes'; id: number; err: string | null }
  | { t: 'ready'; ids: number[] }
  | { t: 'go' }
  | { t: 'end' }
  | { t: 'hb' }
  | { t: 'note'; text: string }
  | { t: 'lst'; all: [string, LobbyState][] }
  | { t: 'lchat'; peer: string; text: string }
  | { t: 'lfx'; peer: string; key: string }
  | { t: 'lgo' }
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

/** Như act() nhưng chờ được kết quả: người vào phòng chờ chủ phòng xử lý xong (bản sao đã cập nhật); một mình / chủ phòng có ngay */
export function actAsync(name: string, ...args: unknown[]): Promise<string | null> {
  const w = session.world;
  if (!w) return Promise.resolve(null);
  if (net.role === 'client' && net.client) return net.client.sendActWait(name, args);
  return Promise.resolve(runAction(w, w.player.id, name, args));
}

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
  settings: RoomSettings = { ...DEFAULT_SETTINGS, roles: {} };
  /** máy → nhân vật trong ván đang chơi */
  agentOf = new Map<string, number>();
  inGame = false;
  onRoomChange = () => {};
  /** thông báo cho cả phòng (chủ phòng cũng hiện) */
  onNote = (_t: string) => {};
  /** Sảnh tầng G: trạng thái từng người, tin chat, nghịch đồ */
  lobby = new Map<string, LobbyState>();
  onLobbyChat = (_peer: string, _text: string) => {};
  onLobbyFx = (_peer: string, _key: string) => {};
  private lobbyT = 0;
  /** tờ phân công đã đóng (ván đang chạy): người vào lại không cần chờ sẵn sàng */
  revealDone = false;
  private timer = 0;
  /** người vào phòng bấm Sẵn sàng / Hủy ở tờ phân công (giao diện chủ phòng giữ danh sách) */
  onReadyMsg = (_id: number, _on: boolean) => {};
  private posT = 0; private fullT = 0;
  private spawnDeadline = new Map<number, number>();
  private lastSeen = new Map<string, number>();
  private lastFull = new Map<string, { key: string; at: number }>();

  /** Đồng hồ (ms). Kiểm tra tự động thay bằng đồng hồ giả và tự gọi watch() */
  clock: () => number = () => performance.now();
  constructor(public tr: Transport, public code: string, public me: Profile, opts: { timers?: boolean } = {}) {
    this.players = [{ ...me, peer: tr.peerId, host: true }];
    tr.onMessage((from, raw) => this.onMsg(from, raw as ToHost));
    // nhịp kiểm tra kết nối (chạy cả ở phòng chờ lẫn trong ván, không phụ thuộc vòng lặp game)
    if (opts.timers !== false) this.timer = setInterval(() => this.watch(), 1000) as unknown as number;
  }
  note(text: string) { this.tr.send('*', { t: 'note', text } satisfies ToClient); this.onNote(text); }
  /** Mỗi giây: gửi nhịp "còn sống"; ai im lặng quá lâu thì đánh dấu mất kết nối, quá thời gian chờ thì cho rời */
  watch() {
    this.tr.send('*', { t: 'hb' } satisfies ToClient);
    const now = this.clock();
    let changed = false;
    for (const p of [...this.players]) {
      if (p.host) continue;
      const quiet = now - (this.lastSeen.get(p.peer) ?? now);
      if (!p.lost && quiet > LOST_MS) {
        p.lost = true; changed = true;
        const id = this.agentOf.get(p.peer);
        if (id !== undefined && session.world) { session.world.agents[id].away = true; session.world.inputs.delete(id); }
        this.note(`${p.name} #${p.empId} mất kết nối${this.inGame ? ', chờ quay lại trong 60 giây' : ''}`);
      }
      if (p.lost && quiet > (this.inGame ? GRACE_GAME_MS : GRACE_ROOM_MS)) {
        this.note(this.inGame ? `${p.name} #${p.empId} không quay lại, bot làm thay` : `${p.name} #${p.empId} đã rời phòng`);
        this.dropPeer(p.peer);
      }
    }
    if (changed) this.broadcastRoom();
  }

  /** Sức chứa phòng = số ghế chủ phòng chọn (tối đa 10) */
  get capacity() { return Math.min(MAX_PLAYERS, Math.max(4, this.settings.seats)); }

  private onMsg(from: string, m: ToHost) {
    if (!m || typeof m !== 'object') return;
    this.lastSeen.set(from, this.clock());
    // bị gỡ vì mất tín hiệu (không phải tự rời) mà vẫn gửi tin tới trong ván: trả lại đúng nhân vật, gửi lại toàn bộ trạng thái
    if (this.inGame && m.t !== 'leave' && this.dropped.has(from) && !this.players.some(p => p.peer === from) && session.world) {
      const d = this.dropped.get(from)!; this.dropped.delete(from);
      const w = session.world;
      this.players.push({ ...d.profile, peer: from, host: false });
      this.agentOf.set(from, d.id); w.setHuman(d.id, true); w.agents[d.id].away = false;
      this.fixEmpIds(); this.broadcastRoom();
      this.tr.send(from, { t: 'start', full: buildFull(w, d.id, true) } satisfies ToClient);
      if (this.revealDone) this.tr.send(from, { t: 'go' } satisfies ToClient);
      this.lastFull.delete(from);
      this.tr.send(from, { t: 'note', text: 'Mạng vừa chập chờn, đã trả lại nhân vật cho bạn.' } satisfies ToClient);
      if (m.t === 'hello') return;
    }
    const pl = this.players.find(p => p.peer === from);
    // người đang mất kết nối gửi tin lại: đã kết nối lại
    if (pl?.lost) {
      pl.lost = false;
      const id = this.agentOf.get(from);
      if (id !== undefined && session.world) session.world.agents[id].away = false;
      this.note(`${pl.name} #${pl.empId} đã kết nối lại`);
      this.broadcastRoom();
    }
    switch (m.t) {
      case 'hello': {
        if (this.inGame && !pl) { this.tr.send(from, { t: 'reject', reason: 'Phòng đang chơi, đợi ván sau nhé.' } satisfies ToClient); return; }
        if (!pl && this.players.length >= this.capacity) { this.tr.send(from, { t: 'reject', reason: `Phòng đã đủ ${this.capacity} người.` } satisfies ToClient); return; }
        const p = sanitizeProfile(m.p);
        if (pl) Object.assign(pl, { name: p.name, look: p.look }); else this.players.push({ ...p, peer: from, host: false });
        this.fixEmpIds();
        this.broadcastRoom();
        // vào lại giữa ván (tải lại trang, rớt mạng): nhận lại đúng nhân vật cũ
        const id = this.agentOf.get(from), w = session.world;
        if (this.inGame && id !== undefined && w) {
          w.setHuman(id, true); w.agents[id].away = false;
          this.tr.send(from, { t: 'start', full: buildFull(w, id, true) } satisfies ToClient);
          if (this.revealDone) this.tr.send(from, { t: 'go' } satisfies ToClient);
          this.lastFull.delete(from);
        }
        return;
      }
      case 'hb': if (typeof m.ts === 'number') this.tr.send(from, { t: 'pong', ts: m.ts } satisfies ToClient); return;
      case 'lst': if (pl && !this.inGame) this.lobby.set(from, sanitizeLobby(m.s)); return;
      case 'lchat': {
        if (!pl || typeof m.text !== 'string') return;
        const text = m.text.replace(/[<>]/g, '').slice(0, 120).trim();
        if (!text) return;
        this.tr.send('*', { t: 'lchat', peer: from, text } satisfies ToClient); this.onLobbyChat(from, text);
        return;
      }
      case 'lfx': if (pl && typeof m.key === 'string' && LOBBY_FX.has(m.key)) { this.tr.send('*', { t: 'lfx', peer: from, key: m.key } satisfies ToClient); this.onLobbyFx(from, m.key); } return;
      case 'leave': { const p = this.players.find(x => x.peer === from); if (p) this.note(this.inGame ? `${p.name} #${p.empId} đã rời phòng, bot làm thay` : `${p.name} #${p.empId} đã rời phòng`); this.dropPeer(from, true); return; }
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
        // gửi trạng thái mới cho riêng người này TRƯỚC, rồi mới gửi kết quả: kênh giữ thứ tự nên lúc nhận kết quả bản sao đã cập nhật
        // (sự kiện của lệnh vẫn nằm trong hàng đợi, vòng lặp chung phát cho mọi người như bình thường)
        this.tr.send(from, { t: 'full', full: buildFull(w, id) } satisfies ToClient);
        this.tr.send(from, { t: 'actRes', id: m.id, err } satisfies ToClient);
        this.fullT = 999; // gửi trạng thái mới cho cả phòng ở khung hình tới
        return;
      }
      case 'ready': this.onReadyMsg(id, m.on !== false); return;
    }
  }

  /** Người rời phòng: trong ván thì bot chơi thay */
  dropPeer(peer: string, voluntary = false) {
    const i = this.players.findIndex(p => p.peer === peer && !p.host);
    if (i < 0) return;
    const [gone] = this.players.splice(i, 1);
    const id = this.agentOf.get(peer);
    // mất tín hiệu (không tự rời): nhớ lại để trả nhân vật nếu họ vẫn còn đó
    if (!voluntary && this.inGame && id !== undefined) this.dropped.set(peer, { id, profile: { name: gone.name, look: gone.look, empId: gone.empId } });
    if (id !== undefined && session.world) { session.world.setHuman(id, false); session.world.agents[id].away = false; this.agentOf.delete(peer); }
    this.lastSeen.delete(peer);
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

  /** Sảnh: chủ phòng cập nhật trạng thái của mình, gom của mọi người phát cho cả phòng 10 lần/giây */
  setMyLobby(s: LobbyState) { this.lobby.set(this.tr.peerId, s); }
  lobbyTick(ms: number) {
    if (this.inGame) return;
    this.lobbyT += ms;
    if (this.lobbyT < 100) return;
    this.lobbyT = 0;
    const live = new Set(this.players.map(p => p.peer));
    for (const k of [...this.lobby.keys()]) if (!live.has(k)) this.lobby.delete(k);
    this.tr.send('*', { t: 'lst', all: [...this.lobby] } satisfies ToClient);
  }
  lobbyChat(text: string) { this.tr.send('*', { t: 'lchat', peer: this.tr.peerId, text } satisfies ToClient); }
  lobbyFx(key: string) { this.tr.send('*', { t: 'lfx', peer: this.tr.peerId, key } satisfies ToClient); }
  /** Chủ phòng bấm vào ca: cả phòng cùng xem cảnh thang máy */
  lobbyGo() { this.tr.send('*', { t: 'lgo' } satisfies ToClient); }
  /** Bắt đầu ván: World đã được tạo ở chủ phòng; ghép mỗi máy với một nhân vật người thật */
  startGame(w: World, seatOf: Map<string, number>) {
    this.inGame = true;
    this.revealDone = false;
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
          this.tr.send(peer, ev.length ? { t: 'full', full, ev } satisfies ToClient : { t: 'full', full, p: 1 } satisfies ToClient);
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
  go() { this.revealDone = true; this.tr.send('*', { t: 'go' } satisfies ToClient); }
  /** Hết ván: cả phòng về màn hình phòng */
  /** người bị gỡ vì mất tín hiệu trong ván (để trả lại nhân vật nếu họ vẫn còn đó) */
  private dropped = new Map<string, { id: number; profile: Profile }>();
  endGame() { this.inGame = false; this.agentOf.clear(); this.dropped.clear(); this.tr.send('*', { t: 'end' } satisfies ToClient); this.broadcastRoom(); }
  close() { clearInterval(this.timer); this.tr.send('*', { t: 'closed' } satisfies ToClient); this.tr.close(); }
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
  onNote = (_t: string) => {};
  /** Sảnh: trạng thái mọi người, chat, nghịch đồ, chủ phòng bấm vào ca */
  lobby = new Map<string, LobbyState>();
  onLobbyChat = (_peer: string, _text: string) => {};
  onLobbyFx = (_peer: string, _key: string) => {};
  onLobbyGo = () => {};
  private lobbyT = 0;
  /** mất / có lại kết nối với chủ phòng */
  onHostLost = (_lost: boolean) => {};
  hostLost = false;
  private lastHost = 0;
  private timer = 0;
  private hostPeer: string | null = null;
  private actId = 0;
  private lastInput = { x: 9, y: 9 }; private inputT = 0;

  clock: () => number = () => performance.now();
  constructor(public tr: Transport, public code: string, public me: Profile, opts: { timers?: boolean } = {}) {
    tr.onMessage((from, raw) => this.onMsg(from, raw as ToClient));
    if (opts.timers !== false) this.timer = setInterval(() => this.watch(), 1000) as unknown as number;
  }
  private gone = false;
  /** Mỗi giây: gửi nhịp "còn sống"; lâu không nghe chủ phòng thì báo mất kết nối, quá lâu thì coi như phòng đóng */
  watch() {
    if (this.gone) return;
    if (this.hostPeer) this.tr.send(this.hostPeer, { t: 'hb', ts: this.clock() } satisfies ToHost);
    if (!this.room) return; // chưa vào được phòng: việc gõ cửa do giao diện lo
    const quiet = this.clock() - this.lastHost;
    if (!this.hostLost && quiet > HOST_LOST_MS) { this.hostLost = true; this.onHostLost(true); }
    if (quiet > HOST_GONE_MS) { this.gone = true; clearInterval(this.timer); this.onClosed(); }
  }
  /** Gõ cửa phòng (gửi lại vài lần phòng khi chủ phòng chưa sẵn sàng) */
  join() { this.tr.send(this.hostPeer ?? '*', { t: 'hello', p: this.me } satisfies ToHost); }

  private onMsg(from: string, m: ToClient) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'room') { this.hostPeer = from; this.room = { code: m.code, players: m.players, settings: m.settings, inGame: m.inGame }; this.heard(); this.onRoom(); return; }
    if (this.hostPeer && from !== this.hostPeer) return; // chỉ nghe chủ phòng
    this.heard();
    switch (m.t) {
      case 'reject': this.onReject(m.reason); return;
      case 'start': {
        this.pendFull = null; this.pendPos = null; this.pendEv = [];
        this.targets.clear();
        this.replica = createReplica(m.full);
        this.onStart(this.replica);
        return;
      }
      case 'full': {
        // gói dồn dập (mạng vừa thông lại): chỉ giữ gói mới nhất, áp một lần mỗi khung hình; sự kiện thì giữ đủ
        if (!this.replica) return;
        this.pendFull = m.full; this.pendPos = null;
        if (m.ev?.length) this.pendEv.push(...m.ev);
        return;
      }
      case 'pos': { if (this.pendFull) { this.pendPos = m; return; } const r = this.replica; if (r) { applyPos(r, m.p, this.targets); r.time = m.time; } return; }

      case 'actRes': {
        this.flush(); // trạng thái mới phải được áp trước khi trả kết quả lệnh
        const res = this.pending.get(m.id);
        if (res) { this.pending.delete(m.id); res(m.err); } else if (m.err) net.onError(m.err);
        return;
      }
      case 'ready': this.onReady(m.ids); return;
      case 'go': this.onGo(); return;
      case 'end': this.flush(); this.replica = null; this.onEnd(); return; // áp hết gói đang chờ trước (không mất sự kiện thắng thua)
      case 'closed': this.flush(); clearInterval(this.timer); this.onClosed(); return;
      case 'note': this.onNote(m.text); return;
      case 'lst': if (Array.isArray(m.all)) this.lobby = new Map(m.all); return;
      case 'lchat': if (m.peer !== this.tr.peerId) this.onLobbyChat(m.peer, m.text); return;
      case 'lfx': if (m.peer !== this.tr.peerId) this.onLobbyFx(m.peer, m.key); return;
      case 'lgo': this.onLobbyGo(); return;
      case 'hb': return;
      case 'pong': if (typeof m.ts === 'number') this.rtt = Math.max(0, this.clock() - m.ts); return;
    }
  }
  /** độ trễ đi về tới chủ phòng (ms), đo bằng nhịp tim mỗi giây */
  rtt = 0;
  private heard() { this.lastHost = this.clock(); if (this.hostLost) { this.hostLost = false; this.onHostLost(false); } }

  /** Sảnh: gửi trạng thái của mình 10 lần/giây */
  sendLobby(s: LobbyState, ms: number) { this.lobbyT += ms; if (this.lobbyT < 100) return; this.lobbyT = 0; this.tr.send(this.hostPeer ?? '*', { t: 'lst', s } satisfies ToHost); }
  sendLobbyChat(text: string) { this.tr.send(this.hostPeer ?? '*', { t: 'lchat', text } satisfies ToHost); }
  sendLobbyFx(key: string) { this.tr.send(this.hostPeer ?? '*', { t: 'lfx', key } satisfies ToHost); }
  sendAct(name: string, args: unknown[]) { this.tr.send(this.hostPeer ?? '*', { t: 'act', id: ++this.actId, name, args } satisfies ToHost); }
  /** Gửi lệnh và chờ chủ phòng trả kết quả (bản sao đã cập nhật khi nhận được). Quá 4 giây không thấy thì coi như không có lỗi. */
  private pending = new Map<number, (err: string | null) => void>();
  sendActWait(name: string, args: unknown[]): Promise<string | null> {
    const id = ++this.actId;
    return new Promise(resolve => {
      this.pending.set(id, resolve);
      this.tr.send(this.hostPeer ?? '*', { t: 'act', id, name, args } satisfies ToHost);
      globalThis.setTimeout(() => { if (this.pending.delete(id)) resolve(null); }, 4000);
    });
  }
  sendReady(on = true) { this.tr.send(this.hostPeer ?? '*', { t: 'ready', on } satisfies ToHost); }
  /** Gửi điều khiển khi đổi hướng, và nhắc lại 5 lần/giây cho chắc */
  sendInput(x: number, y: number, dtMs: number) {
    this.inputT += dtMs;
    if (x === this.lastInput.x && y === this.lastInput.y && this.inputT < 200) return;
    this.inputT = 0; this.lastInput = { x, y };
    this.tr.send(this.hostPeer ?? '*', { t: 'input', x, y } satisfies ToHost);
  }
  /** Mỗi khung hình: các nhân vật khác trượt mượt tới vị trí chủ phòng gửi */
  private pendFull: FullSnap | null = null;
  private pendPos: Extract<ToClient, { t: 'pos' }> | null = null;
  private pendEv: GameEvent[] = [];
  /** Áp gói trạng thái mới nhất đang chờ (và vị trí mới hơn nó), cùng mọi sự kiện đã nhận */
  flush() {
    const r = this.replica;
    if (!r || !this.pendFull) return;
    applyFull(r, this.pendFull); this.pendFull = null;
    // sau khi áp ảnh chụp, các nhân vật khác đứng ở vị trí trượt hiện tại (không giật về vị trí cũ)
    for (const [id, t] of this.targets) { const a = r.agents[id]; if (a && id !== r.meId && t.cx !== undefined && t.cy !== undefined) { a.x = t.cx; a.y = t.cy; } }
    if (this.pendEv.length) { r.events.push(...this.pendEv); this.pendEv = []; }
    const p = this.pendPos; this.pendPos = null;
    if (p) { applyPos(r, p.p, this.targets); r.time = p.time; }
  }
  smooth(dtMs: number) {
    this.flush();
    const r = this.replica; if (!r) return;
    const k = Math.min(1, dtMs / 1000 * 14);
    for (const [id, t] of this.targets) {
      const a = r.agents[id] as unknown as { x: number; y: number }; if (!a || id === r.meId) continue;
      if (Math.hypot(t.x - a.x, t.y - a.y) > 4 * 48) { a.x = t.x; a.y = t.y; } // dịch chuyển (thang, cổng): nhảy luôn
      else { a.x += (t.x - a.x) * k; a.y += (t.y - a.y) * k; }
      t.cx = a.x; t.cy = a.y;
    }
  }
  leave() { clearInterval(this.timer); this.tr.send(this.hostPeer ?? '*', { t: 'leave' } satisfies ToHost); this.tr.close(); }
}

/** Nghịch đồ được báo cho cả phòng (ngồi, cốc nước đi theo trạng thái nên không cần) */
export const LOBBY_FX = new Set(['bell', 'cat', 'fish', 'plant:0', 'plant:1', 'water']);
function sanitizeLobby(s: LobbyState): LobbyState {
  const n = (v: unknown, lo: number, hi: number) => { const x = typeof v === 'number' && Number.isFinite(v) ? v : 0; return Math.max(lo, Math.min(hi, x)); };
  const seat = s?.seat === null || s?.seat === undefined ? null : Math.round(n(s.seat, 0, 20));
  return { x: n(s?.x, 0, 2000), y: n(s?.y, 0, 2000), f: s?.f === -1 ? -1 : 1, m: s?.m ? 1 : 0, seat, cup: s?.cup ? 1 : 0, arrived: s?.arrived ? 1 : 0 };
}
const clamp1 = (v: unknown) => { const n = typeof v === 'number' && Number.isFinite(v) ? v : 0; return Math.max(-1, Math.min(1, n)); };
function sanitizeProfile(p: Profile): Profile {
  const name = String(p?.name ?? 'Khách').replace(/[<>]/g, '').trim().slice(0, 16) || 'Khách';
  const empId = /^\d{3}$/.test(String(p?.empId)) ? String(p.empId) : String(100 + Math.floor(Math.random() * 900));
  return { name, look: p?.look, empId };
}
