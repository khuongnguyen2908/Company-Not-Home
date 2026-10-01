// Mô phỏng toàn bộ luật chơi. Không phụ thuộc Phaser hay DOM,
// nên sau này có thể chạy trên máy chủ phòng (host) khi làm nhiều người chơi.

import {
  TILE, DESKS, TASK_STATIONS, FIX_STATIONS, HIDE_SPOTS, SPAWNS, BELL, MAP_W, MAP_H,
  canStand, roomAt, roomName, tileCenter, isFloor, ROOMS, type RoomId, type Station, type TaskKind,
} from './map';
import { findPath, type Pt } from './path';
import {
  type DeptId, DEPTS, BOT_NAMES, FILLER_LINES, DEFENSE_LINES, IMPOSTOR_ALIBIS, TASK_VERBS, pick, normalize,
} from './data';

export type Role = 'crew' | 'impostor';
export type SabotageKind = 'wifi' | 'power' | 'boss';

export const SPEED = 205;
export const VISION = 4.6 * TILE;
export const VISION_IMP = 6.2 * TILE;
export const VISION_DARK = 1.7 * TILE;
export const KILL_RANGE = 1.35 * TILE;
export const KILL_CD = 30;
export const SAB_CD = 30;
export const BOSS_TIME = 30;
export const USE_RANGE = 1.15 * TILE;
export const REPORT_RANGE = 1.7 * TILE;
export const MEETING_TIME = 75;

export interface TaskSlot { stationId: string; done: boolean }

interface Brain {
  mode: string;
  path: Pt[];
  goal: string | null;
  workT: number;
  thinkT: number;
  senseT: number;
  targetId: number | null;
  huntT: number;
  lastSeen: Map<number, { room: RoomId | null; t: number }>;
  companion: Map<number, number>;
  sus: Map<number, number>;
  witnessed: number | null;
  seenBody: number | null;
  nearBody: number[];
  reactT: number;
  fixer: boolean;
  hideT: number;
  skipBias: number;
}

export interface Agent {
  id: number;
  name: string;
  dept: DeptId;
  isPlayer: boolean;
  role: Role;
  alive: boolean;
  ejected: boolean;
  x: number; y: number;
  facing: 1 | -1;
  moving: boolean;
  walkT: number;
  tasks: TaskSlot[];
  desk: number;
  hidden: number | null;
  killCd: number;
  emergencyLeft: number;
  bossDone: boolean;
  brain: Brain;
}

export interface Body { victim: number; x: number; y: number; room: RoomId | null; t: number }

export type GameEvent =
  | { type: 'kill'; killer: number; victim: number; x: number; y: number }
  | { type: 'meeting'; reporter: number; victim: number | null }
  | { type: 'sabotage'; kind: SabotageKind; by: number }
  | { type: 'sabotage_end'; kind: SabotageKind; by: number | null }
  | { type: 'task'; agent: number; stationId: string }
  | { type: 'boss_ok'; agent: number }
  | { type: 'gameover'; winner: Role; reason: string };

export interface ChatMsg { from: number; text: string; t: number; system?: boolean }

interface Effect { target: number; delta: number }

export interface Meeting {
  reporter: number;
  victim: number | null;
  room: RoomId | null;
  t: number;
  duration: number;
  chat: ChatMsg[];
  queue: { at: number; from: number; text: string; effects: Effect[] }[];
  votes: Map<number, number | 'skip'>;
  voteAt: Map<number, number>;
  result: null | { ejected: number | null; tie: boolean; tally: Map<number | 'skip', number[]> };
}

export interface WorldOptions {
  playerName: string;
  playerDept: DeptId;
  playerRole: 'random' | Role;
  bots: number;
  impostors: number;
  seed?: number;
  headless?: boolean; // dùng khi chạy thử tự động: người chơi cũng do bot điều khiển
}

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function newBrain(): Brain {
  return {
    mode: 'idle', path: [], goal: null, workT: 0, thinkT: 0, senseT: 0, targetId: null, huntT: 0,
    lastSeen: new Map(), companion: new Map(), sus: new Map(), witnessed: null, seenBody: null,
    nearBody: [], reactT: 0, fixer: false, hideT: 0, skipBias: 0,
  };
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export class World {
  agents: Agent[] = [];
  bodies: Body[] = [];
  phase: 'play' | 'meeting' | 'ended' = 'play';
  time = 0;
  sabotage: null | { kind: SabotageKind; t: number; by: number } = null;
  sabCd = 20;
  bossUsed = false;
  emergencyCd = 15;
  events: GameEvent[] = [];
  winner: Role | null = null;
  winReason = '';
  meeting: Meeting | null = null;
  playerInput = { x: 0, y: 0 };
  rng: () => number;
  headless: boolean;
  meetingCount = 0;

  constructor(opts: WorldOptions) {
    this.rng = mulberry32(opts.seed ?? Math.floor(Math.random() * 1e9));
    this.headless = !!opts.headless;
    const total = opts.bots + 1;
    const names = [...BOT_NAMES].sort(() => this.rng() - 0.5);
    const depts = DEPTS.map(d => d.id).filter(d => d !== opts.playerDept).sort(() => this.rng() - 0.5);
    const deskOrder = DESKS.map((_, i) => i).sort(() => this.rng() - 0.5);

    for (let i = 0; i < total; i++) {
      const sp = tileCenter(SPAWNS[i % SPAWNS.length].x, SPAWNS[i % SPAWNS.length].y);
      this.agents.push({
        id: i,
        name: i === 0 ? (opts.playerName || 'Bạn') : names[i - 1],
        dept: i === 0 ? opts.playerDept : depts[(i - 1) % depts.length],
        isPlayer: i === 0,
        role: 'crew', alive: true, ejected: false,
        x: sp.x, y: sp.y, facing: 1, moving: false, walkT: 0,
        tasks: [], desk: deskOrder[i % DESKS.length], hidden: null,
        killCd: 12, emergencyLeft: 1, bossDone: false, brain: newBrain(),
      });
    }
    // Phân vai Nội gián
    const nImp = Math.max(1, Math.min(opts.impostors, Math.floor((total - 1) / 2)));
    const pool = this.agents.map(a => a.id);
    const chosen: number[] = [];
    if (opts.playerRole === 'impostor') chosen.push(0);
    const others = pool.filter(id => !(opts.playerRole !== 'random' && id === 0)).sort(() => this.rng() - 0.5);
    for (const id of others) { if (chosen.length >= nImp) break; if (!chosen.includes(id)) chosen.push(id); }
    for (const id of chosen) this.agents[id].role = 'impostor';

    for (const a of this.agents) {
      const st = [...TASK_STATIONS].sort(() => this.rng() - 0.5).slice(0, 5);
      a.tasks = st.map(s => ({ stationId: s.id, done: false }));
      a.brain.thinkT = this.rng() * 1.5;
    }
  }

  get player() { return this.agents[0]; }

  // ---------- Truy vấn ----------
  crewTasksDone() {
    let done = 0, total = 0;
    for (const a of this.agents) {
      if (a.role !== 'crew') continue;
      for (const t of a.tasks) { total++; if (t.done) done++; }
    }
    return { done, total };
  }

  aliveCrew() { return this.agents.filter(a => a.alive && a.role === 'crew'); }
  aliveImp() { return this.agents.filter(a => a.alive && a.role === 'impostor'); }

  visionOf(a: Agent): number {
    if (!a.alive) return 99999;
    if (a.role === 'impostor') return VISION_IMP;
    if (this.sabotage?.kind === 'power') return VISION_DARK;
    return VISION;
  }

  canSee(obs: Agent, target: { x: number; y: number }, targetAgent?: Agent): boolean {
    if (targetAgent) {
      if (targetAgent.hidden !== null) return false;
      if (!targetAgent.alive && obs.alive) return false;
    }
    return dist(obs, target) <= this.visionOf(obs);
  }

  stationById(id: string): Station | undefined {
    return TASK_STATIONS.find(s => s.id === id) ?? FIX_STATIONS.find(s => s.id === id);
  }

  /** Những hành động người chơi đang làm được ở vị trí hiện tại */
  context(a: Agent) {
    const ctx: {
      use: null | { kind: 'task' | 'fix' | 'bell' | 'desk'; station?: Station; label: string };
      report: Body | null;
      kill: Agent | null;
      hide: number | null;
    } = { use: null, report: null, kill: null, hide: null };
    if (this.phase !== 'play') return ctx;
    if (a.hidden !== null) return ctx;

    // Sếp đi tuần: ưu tiên về bàn
    if (this.sabotage?.kind === 'boss' && a.alive && a.role === 'crew' && !a.bossDone) {
      const seat = DESKS[a.desk].seat;
      const c = tileCenter(seat.x, seat.y);
      if (dist(a, c) < USE_RANGE) ctx.use = { kind: 'desk', label: 'Giả vờ gõ phím' };
    }
    if (!ctx.use && this.sabotage && this.sabotage.kind !== 'boss' && (a.alive || a.role === 'crew')) {
      const st = FIX_STATIONS.find(s => s.id === (this.sabotage!.kind === 'wifi' ? 'router' : 'power'))!;
      const c = tileCenter(st.stand.x, st.stand.y);
      if (a.alive && dist(a, c) < USE_RANGE) ctx.use = { kind: 'fix', station: st, label: 'Sửa' };
    }
    if (!ctx.use) {
      for (const t of a.tasks) {
        if (t.done) continue;
        const st = this.stationById(t.stationId)!;
        const c = tileCenter(st.stand.x, st.stand.y);
        if (dist(a, c) < USE_RANGE) { ctx.use = { kind: 'task', station: st, label: a.role === 'impostor' ? 'Giả vờ làm' : 'Làm việc' }; break; }
      }
    }
    if (!ctx.use && a.alive) {
      const b = { x: BELL.x * TILE, y: BELL.y * TILE };
      if (dist(a, b) < 2.4 * TILE) ctx.use = { kind: 'bell', label: 'Bấm chuông họp' };
    }
    if (a.alive) {
      for (const b of this.bodies) if (dist(a, b) < REPORT_RANGE) { ctx.report = b; break; }
    }
    if (a.alive && a.role === 'impostor') {
      let best: Agent | null = null, bd = KILL_RANGE;
      for (const o of this.agents) {
        if (o === a || !o.alive || o.role === 'impostor' || o.hidden !== null) continue;
        const d = dist(a, o);
        if (d < bd) { bd = d; best = o; }
      }
      ctx.kill = best;
      for (let i = 0; i < HIDE_SPOTS.length; i++) {
        const h = HIDE_SPOTS[i];
        if (dist(a, tileCenter(h.x, h.y)) < USE_RANGE) { ctx.hide = i; break; }
      }
    }
    return ctx;
  }

  // ---------- Hành động ----------
  completeTask(a: Agent, stationId: string) {
    const t = a.tasks.find(t => t.stationId === stationId && !t.done);
    if (!t) return;
    t.done = true;
    this.events.push({ type: 'task', agent: a.id, stationId });
    this.checkWin();
  }

  tryKill(killer: Agent, victim: Agent): boolean {
    if (this.phase !== 'play') return false;
    if (!killer.alive || killer.role !== 'impostor' || killer.killCd > 0) return false;
    if (!victim.alive || victim.role === 'impostor' || victim.hidden !== null) return false;
    if (dist(killer, victim) > KILL_RANGE + 4) return false;
    victim.alive = false;
    victim.brain.path = [];
    this.bodies.push({ victim: victim.id, x: victim.x, y: victim.y, room: roomAt(victim.x, victim.y), t: this.time });
    killer.killCd = KILL_CD;
    killer.x = victim.x; killer.y = victim.y + 2;
    this.events.push({ type: 'kill', killer: killer.id, victim: victim.id, x: victim.x, y: victim.y });
    // Nhân chứng
    for (const o of this.agents) {
      if (!o.alive || o === killer || o.role !== 'crew' || o.isPlayer && !this.headless) continue;
      if (dist(o, killer) <= this.visionOf(o)) {
        o.brain.witnessed = killer.id;
        o.brain.sus.set(killer.id, (o.brain.sus.get(killer.id) ?? 0) + 100);
        o.brain.seenBody = victim.id;
        o.brain.nearBody = [killer.id];
        o.brain.reactT = 0.4 + this.rng() * 0.6;
        o.brain.path = [];
      }
    }
    this.checkWin();
    return true;
  }

  report(a: Agent, body: Body | null) {
    if (this.phase !== 'play' || !a.alive) return;
    this.startMeeting(a.id, body ? body.victim : null);
  }

  callEmergency(a: Agent, via: 'bell' | 'email'): string | null {
    if (this.phase !== 'play') return 'Không thể gọi lúc này';
    if (!a.alive) return 'Hồn ma không gọi họp được';
    if (a.emergencyLeft <= 0) return 'Bạn đã dùng hết quyền gọi họp khẩn';
    if (this.emergencyCd > 0) return `Chờ ${Math.ceil(this.emergencyCd)} giây nữa`;
    if (this.sabotage?.kind === 'boss') return 'Sếp đang đi tuần, về bàn ngay!';
    if (via === 'email' && this.sabotage?.kind === 'wifi') return 'Mất WiFi, không gửi được email';
    a.emergencyLeft--;
    this.startMeeting(a.id, null);
    return null;
  }

  triggerSabotage(by: Agent, kind: SabotageKind): string | null {
    if (this.phase !== 'play') return 'Không thể lúc này';
    if (by.role !== 'impostor') return 'Chỉ Nội gián mới phá hoại được';
    if (this.sabotage) return 'Đang có sự cố khác';
    if (this.sabCd > 0) return `Hồi chiêu ${Math.ceil(this.sabCd)} giây`;
    if (kind === 'boss' && this.bossUsed) return 'Sếp chỉ đi tuần một lần mỗi ván';
    this.sabotage = { kind, t: kind === 'boss' ? BOSS_TIME : 0, by: by.id };
    if (kind === 'boss') {
      this.bossUsed = true;
      for (const a of this.agents) a.bossDone = false;
    }
    // Chọn bot đi sửa
    if (kind !== 'boss') {
      const st = FIX_STATIONS.find(s => s.id === (kind === 'wifi' ? 'router' : 'power'))!;
      const c = tileCenter(st.stand.x, st.stand.y);
      const crewBots = this.agents.filter(a => !a.isPlayer && a.alive && a.role === 'crew')
        .sort((p, q) => dist(p, c) - dist(q, c));
      crewBots.forEach((b, i) => { b.brain.fixer = i < (kind === 'power' ? 2 : 1); if (b.brain.fixer) b.brain.path = []; });
    } else {
      for (const a of this.agents) a.brain.path = [];
    }
    this.events.push({ type: 'sabotage', kind, by: by.id });
    return null;
  }

  fixSabotage(by: Agent | null) {
    if (!this.sabotage) return;
    const kind = this.sabotage.kind;
    this.sabotage = null;
    this.sabCd = SAB_CD;
    for (const a of this.agents) a.brain.fixer = false;
    this.events.push({ type: 'sabotage_end', kind, by: by ? by.id : null });
  }

  bossCheckIn(a: Agent) {
    if (this.sabotage?.kind !== 'boss' || a.bossDone) return;
    a.bossDone = true;
    this.events.push({ type: 'boss_ok', agent: a.id });
    if (this.aliveCrew().every(c => c.bossDone)) this.fixSabotage(null);
  }

  hide(a: Agent, spot: number | null) {
    if (a.role !== 'impostor' || !a.alive) return;
    if (spot === null) { a.hidden = null; return; }
    a.hidden = spot;
    const c = tileCenter(HIDE_SPOTS[spot].x, HIDE_SPOTS[spot].y);
    a.x = c.x; a.y = c.y;
  }

  hideMove(a: Agent, dir: 1 | -1) {
    if (a.hidden === null) return;
    const n = (a.hidden + dir + HIDE_SPOTS.length) % HIDE_SPOTS.length;
    this.hide(a, n);
  }

  // ---------- Vòng lặp ----------
  update(dt: number) {
    if (this.phase === 'meeting') { this.updateMeeting(dt); return; }
    if (this.phase !== 'play') return;
    this.time += dt;
    this.sabCd = Math.max(0, this.sabCd - dt);
    this.emergencyCd = Math.max(0, this.emergencyCd - dt);
    for (const a of this.agents) if (a.hidden === null) a.killCd = Math.max(0, a.killCd - dt);

    if (this.sabotage?.kind === 'boss') {
      this.sabotage.t -= dt;
      if (this.sabotage.t <= 0) {
        const late = this.aliveCrew().filter(c => !c.bossDone);
        if (late.length) {
          this.endGame('impostor', `Sếp bắt quả tang ${late.map(l => l.name).join(', ')} không ngồi ở bàn. Cả team bị cắt thưởng!`);
          return;
        }
        this.fixSabotage(null);
      }
    }

    // Người chơi
    const p = this.player;
    if (!this.headless) {
      if (p.hidden === null) this.moveBy(p, this.playerInput.x, this.playerInput.y, dt);
      else p.moving = false;
    }
    // Bot
    for (const a of this.agents) {
      if (a.isPlayer && !this.headless) continue;
      this.botUpdate(a, dt);
      if (this.phase !== 'play') return;
    }
  }

  moveBy(a: Agent, ix: number, iy: number, dt: number) {
    const len = Math.hypot(ix, iy);
    if (len < 0.05) { a.moving = false; return; }
    const sp = (a.alive ? SPEED : SPEED * 1.1) * dt;
    const dx = (ix / len) * sp * Math.min(1, len), dy = (iy / len) * sp * Math.min(1, len);
    if (dx !== 0) a.facing = dx > 0 ? 1 : -1;
    if (!a.alive) {
      a.x = Math.max(TILE, Math.min((MAP_W - 1) * TILE, a.x + dx));
      a.y = Math.max(TILE, Math.min((MAP_H - 1) * TILE, a.y + dy));
    } else {
      if (canStand(a.x + dx, a.y)) a.x += dx;
      if (canStand(a.x, a.y + dy)) a.y += dy;
    }
    a.moving = true;
    a.walkT += dt;
  }

  private followPath(a: Agent, dt: number): boolean {
    const b = a.brain;
    if (!b.path.length) { a.moving = false; return true; }
    const target = b.path[0];
    const dx = target.x - a.x, dy = target.y - a.y;
    const d = Math.hypot(dx, dy);
    const step = (a.alive ? SPEED * 0.92 : SPEED) * dt;
    if (d <= step) {
      a.x = target.x; a.y = target.y;
      b.path.shift();
    } else {
      a.x += (dx / d) * step; a.y += (dy / d) * step;
    }
    if (Math.abs(dx) > 1) a.facing = dx > 0 ? 1 : -1;
    a.moving = true;
    a.walkT += dt;
    return b.path.length === 0;
  }

  private goTo(a: Agent, tile: Pt, goal: string): boolean {
    const p = findPath(a, tile);
    if (!p) return false;
    a.brain.path = p;
    a.brain.goal = goal;
    return true;
  }

  private randomFloorTile(): Pt {
    for (let i = 0; i < 50; i++) {
      const r = ROOMS[Math.floor(this.rng() * ROOMS.length)];
      const x = r.x + Math.floor(this.rng() * r.w), y = r.y + Math.floor(this.rng() * r.h);
      if (isFloor(x, y)) return { x, y };
    }
    return SPAWNS[0];
  }

  private sense(a: Agent) {
    const b = a.brain;
    for (const o of this.agents) {
      if (o === a || !o.alive || o.hidden !== null) continue;
      if (dist(a, o) <= this.visionOf(a)) {
        b.lastSeen.set(o.id, { room: roomAt(o.x, o.y), t: this.time });
        b.companion.set(o.id, (b.companion.get(o.id) ?? 0) + 0.25);
      }
    }
    for (const [id, v] of b.companion) b.companion.set(id, v * 0.985);
    if (b.seenBody === null) {
      for (const body of this.bodies) {
        if (dist(a, body) <= this.visionOf(a)) {
          b.seenBody = body.victim;
          b.nearBody = this.agents.filter(o => o !== a && o.alive && o.hidden === null && dist(o, body) < 3 * TILE).map(o => o.id);
          for (const id of b.nearBody) b.sus.set(id, (b.sus.get(id) ?? 0) + 18);
          b.reactT = 0.5 + this.rng() * 0.8;
          b.path = [];
          break;
        }
      }
    }
  }

  private botUpdate(a: Agent, dt: number) {
    const b = a.brain;
    if (a.alive && a.role === 'crew') {
      b.senseT -= dt;
      if (b.senseT <= 0) { b.senseT = 0.25; this.sense(a); }
    }

    // Đang thao tác tại chỗ
    if (b.workT > 0) {
      a.moving = false;
      b.workT -= dt;
      if (b.workT <= 0) this.finishWork(a);
      return;
    }
    // Đang trốn (Nội gián bot)
    if (a.hidden !== null) {
      a.moving = false;
      b.hideT -= dt;
      if (b.hideT <= 0) {
        if (b.mode === 'vent' && this.rng() < 0.7) {
          this.hide(a, Math.floor(this.rng() * HIDE_SPOTS.length));
          b.mode = 'vent2';
          b.hideT = 0.8;
        } else { this.hide(a, null); b.mode = 'idle'; b.path = []; }
      }
      return;
    }

    if (a.role === 'crew') this.crewBrain(a, dt);
    else this.impostorBrain(a, dt);
  }

  private finishWork(a: Agent) {
    const b = a.brain;
    const g = b.goal ?? '';
    if (g.startsWith('task:')) this.completeTask(a, g.slice(5));
    else if (g === 'fix' && this.sabotage && this.sabotage.kind !== 'boss') this.fixSabotage(a);
    else if (g === 'desk') this.bossCheckIn(a);
    b.goal = null;
  }

  private crewBrain(a: Agent, dt: number) {
    const b = a.brain;
    // 1. Sếp đi tuần
    if (a.alive && this.sabotage?.kind === 'boss' && !a.bossDone) {
      const seat = DESKS[a.desk].seat;
      const c = tileCenter(seat.x, seat.y);
      if (dist(a, c) < 6) { b.goal = 'desk'; b.workT = 0.6; return; }
      if (b.goal !== 'desk' || !b.path.length) this.goTo(a, seat, 'desk');
      this.followPath(a, dt);
      return;
    }
    // 2. Thấy ghế trống -> báo cáo
    if (a.alive && b.seenBody !== null) {
      const body = this.bodies.find(x => x.victim === b.seenBody);
      if (!body) { b.seenBody = null; }
      else {
        if (b.reactT > 0) { b.reactT -= dt; a.moving = false; return; }
        if (dist(a, body) < REPORT_RANGE * 0.9) { this.report(a, body); return; }
        if (b.goal !== 'body' || !b.path.length) {
          this.goTo(a, { x: Math.floor(body.x / TILE), y: Math.floor(body.y / TILE) }, 'body');
        }
        this.followPath(a, dt);
        return;
      }
    }
    // 2b. Thấy tận mắt nhưng xác đã bị dọn -> gọi họp khẩn
    if (a.alive && b.witnessed !== null && this.agents[b.witnessed].alive && a.emergencyLeft > 0 && this.emergencyCd <= 0 && this.sabotage?.kind !== 'boss') {
      if (this.callEmergency(a, 'email') === null) return;
    }
    // 3. Sửa sự cố
    if (a.alive && b.fixer && this.sabotage && this.sabotage.kind !== 'boss') {
      const st = FIX_STATIONS.find(s => s.id === (this.sabotage!.kind === 'wifi' ? 'router' : 'power'))!;
      const c = tileCenter(st.stand.x, st.stand.y);
      if (dist(a, c) < 8) { b.goal = 'fix'; b.workT = 2 + this.rng() * 1.5; return; }
      if (b.goal !== 'fix' || !b.path.length) this.goTo(a, st.stand, 'fix');
      this.followPath(a, dt);
      return;
    }
    // 4. Làm task
    if (b.path.length) {
      const arrived = this.followPath(a, dt);
      if (arrived && b.goal?.startsWith('task:')) b.workT = 6 + this.rng() * 6;
      else if (arrived) { b.goal = null; b.thinkT = 1 + this.rng() * 3; }
      return;
    }
    a.moving = false;
    b.thinkT -= dt;
    if (b.thinkT > 0) return;
    const next = a.tasks.filter(t => !t.done);
    if (next.length && this.rng() < 0.35) {
      // dân văn phòng: đi lòng vòng, ghé pantry, lướt điện thoại...
      this.goTo(a, this.randomFloorTile(), 'wander');
      b.thinkT = 2 + this.rng() * 4;
    } else if (next.length) {
      const t = pick(next, this.rng);
      const st = this.stationById(t.stationId)!;
      const c = tileCenter(st.stand.x, st.stand.y);
      if (dist(a, c) < 8) { b.goal = 'task:' + st.id; b.workT = 6 + this.rng() * 5; return; }
      if (!this.goTo(a, st.stand, 'task:' + st.id)) b.thinkT = 1;
    } else {
      this.goTo(a, this.randomFloorTile(), 'wander');
      b.thinkT = 2 + this.rng() * 4;
    }
  }

  private safeToKill(k: Agent, victim: Agent): boolean {
    for (const o of this.agents) {
      if (o === k || o === victim || !o.alive || o.role === 'impostor' || o.hidden !== null) continue;
      if (dist(o, k) <= this.visionOf(o) + 30) return false;
    }
    return true;
  }

  private impostorBrain(a: Agent, dt: number) {
    const b = a.brain;
    if (!a.alive) { a.moving = false; return; }
    // Hòa nhập khi sếp đi tuần
    if (this.sabotage?.kind === 'boss') {
      const seat = DESKS[a.desk].seat;
      if (b.goal !== 'desk_fake') this.goTo(a, seat, 'desk_fake');
      this.followPath(a, dt);
      return;
    }
    // Phá hoại
    b.thinkT -= dt;
    if (!this.sabotage && this.sabCd <= 0 && b.thinkT <= 0 && this.rng() < 0.3 && this.time > 25) {
      const r = this.rng();
      let kind: SabotageKind = r < 0.5 ? 'power' : 'wifi';
      if (r > 0.82 && !this.bossUsed && this.time > 50) kind = 'boss';
      this.triggerSabotage(a, kind);
    }
    if (b.thinkT <= 0) b.thinkT = 3 + this.rng() * 3;

    // Thấy ghế trống của nạn nhân người khác -> thỉnh thoảng tự báo cáo
    // Săn mồi
    if (a.killCd <= 0 && this.time > 10) {
      if (b.targetId === null || !this.agents[b.targetId].alive || b.huntT > 14) {
        const targets = this.agents.filter(o => o.alive && o.role === 'crew' && o.hidden === null);
        if (!targets.length) return;
        targets.sort((p, q) => dist(a, p) - dist(a, q));
        b.targetId = (this.rng() < 0.7 ? targets[0] : pick(targets, this.rng)).id;
        b.huntT = 0;
        b.path = [];
      }
      const t = this.agents[b.targetId];
      b.huntT += dt;
      if (dist(a, t) < KILL_RANGE && t.hidden === null && this.safeToKill(a, t)) {
        if (this.tryKill(a, t)) {
          b.targetId = null;
          b.mode = 'flee';
          b.path = [];
          // Chạy trốn: chui vào chỗ trốn gần nhất nếu đủ gần
          let best = -1, bd = 7 * TILE;
          HIDE_SPOTS.forEach((h, i) => { const d = dist(a, tileCenter(h.x, h.y)); if (d < bd) { bd = d; best = i; } });
          if (best >= 0) { this.goTo(a, { x: HIDE_SPOTS[best].x, y: HIDE_SPOTS[best].y }, 'vent:' + best); }
          else this.goTo(a, this.randomFloorTile(), 'wander');
          return;
        }
      }
      b.senseT -= dt;
      if (b.senseT <= 0 || !b.path.length) {
        b.senseT = 0.5;
        this.goTo(a, { x: Math.floor(t.x / TILE), y: Math.floor(t.y / TILE) }, 'hunt');
      }
      // Đứng gần nhưng có người nhìn -> lảng vảng chờ
      if (dist(a, t) < KILL_RANGE * 0.9) { a.moving = false; return; }
      this.followPath(a, dt);
      return;
    }

    // Đi giả vờ làm task / chui chỗ trốn
    if (b.path.length) {
      const arrived = this.followPath(a, dt);
      if (arrived && b.goal?.startsWith('vent:')) {
        this.hide(a, parseInt(b.goal.slice(5)));
        b.mode = 'vent';
        b.hideT = 0.8 + this.rng();
        b.goal = null;
      } else if (arrived && b.goal?.startsWith('fake:')) {
        b.workT = 2 + this.rng() * 3;
        b.goal = null;
      }
      return;
    }
    a.moving = false;
    if (this.rng() < dt * 1.5) {
      const st = pick(TASK_STATIONS, this.rng);
      this.goTo(a, st.stand, 'fake:' + st.id);
    }
  }

  // ---------- Họp ----------
  startMeeting(reporter: number, victim: number | null) {
    this.phase = 'meeting';
    this.meetingCount++;
    const body = victim !== null ? this.bodies.find(b => b.victim === victim) : null;
    const room = body ? body.room : null;
    const m: Meeting = {
      reporter, victim, room, t: 0, duration: MEETING_TIME, chat: [], queue: [],
      votes: new Map(), voteAt: new Map(), result: null,
    };
    this.meeting = m;
    // Những người phát hiện ghế trống sau khi chết cũng được thấy
    for (const a of this.agents) {
      a.moving = false;
      if (a.hidden !== null) a.hidden = null;
      a.brain.path = [];
      a.brain.workT = 0;
    }
    if (this.sabotage) { const k = this.sabotage.kind; this.sabotage = null; this.events.push({ type: 'sabotage_end', kind: k, by: null }); }
    this.events.push({ type: 'meeting', reporter, victim });
    this.planStatements(m);
    for (const a of this.agents) {
      if (a.isPlayer && !this.headless) continue;
      if (!a.alive) continue;
      m.voteAt.set(a.id, 26 + this.rng() * 30);
    }
  }

  private say(m: Meeting, from: number, text: string, effects: Effect[] = [], at?: number) {
    const last = m.queue.length ? m.queue[m.queue.length - 1].at : 1.2;
    m.queue.push({ at: at ?? last + 1.6 + this.rng() * 2.2, from, text, effects });
    m.queue.sort((p, q) => p.at - q.at);
  }

  private planStatements(m: Meeting) {
    const A = this.agents;
    const nm = (id: number) => A[id].name;
    const speakers = A.filter(a => a.alive && (!a.isPlayer || this.headless));
    const recent = this.time - 35;
    // Người báo cáo nói trước
    const rep = A[m.reporter];
    if (!rep.isPlayer || this.headless) {
      if (m.victim !== null) {
        this.say(m, rep.id, `Ghế của ${nm(m.victim)} trống trơn ở ${roomName(m.room)}! Đơn sa thải còn nằm trên ghế.`);
      } else if (rep.brain.witnessed !== null) {
        this.say(m, rep.id, `Tôi gọi họp vì tôi TẬN MẮT thấy ${nm(rep.brain.witnessed)} chơi xấu đồng nghiệp!`, [{ target: rep.brain.witnessed, delta: 45 }]);
      } else {
        this.say(m, rep.id, 'Tôi gọi họp vì thấy không khí dạo này sai sai. Ai giải thích đi?');
      }
    }
    const order = [...speakers].sort(() => this.rng() - 0.5);
    for (const a of order) {
      const b = a.brain;
      if (a.role === 'crew') {
        if (b.witnessed !== null && A[b.witnessed].alive && !(a.id === m.reporter && m.victim === null)) {
          const v = m.victim !== null ? nm(m.victim) : 'đồng nghiệp';
          this.say(m, a.id, `Tôi tận mắt thấy ${nm(b.witnessed)} ném hồ sơ lỗi vào mặt ${v}! Vote ${nm(b.witnessed)} đi!`, [{ target: b.witnessed, delta: 45 }]);
          continue;
        }
        const near = b.nearBody.filter(id => A[id].alive && id !== a.id);
        if (m.victim !== null && b.seenBody === m.victim && near.length) {
          const x = pick(near, this.rng);
          this.say(m, a.id, `Lúc tôi thấy ghế trống thì ${nm(x)} đang đứng ngay gần đó.`, [{ target: x, delta: 16 }]);
          continue;
        }
        if (m.room) {
          const seen = [...b.lastSeen.entries()].filter(([id, s]) => id !== a.id && A[id].alive && s.room === m.room && s.t > recent);
          if (seen.length) {
            const [x] = pick(seen, this.rng);
            this.say(m, a.id, `Lúc nãy tôi thấy ${nm(x)} lảng vảng ở ${roomName(m.room)}.`, [{ target: x, delta: 10 }]);
            continue;
          }
        }
        const comps = [...b.companion.entries()].filter(([id, v]) => v > 3 && A[id].alive && id !== a.id).sort((p, q) => q[1] - p[1]);
        if (comps.length && this.rng() < 0.75) {
          const [y] = comps[0];
          this.say(m, a.id, `Tôi ở với ${nm(y)} nãy giờ, ${nm(y)} chạy KPI nghiêm túc lắm.`, [{ target: y, delta: -8 }]);
          continue;
        }
        const room = roomName(roomAt(a.x, a.y));
        const doneTask = a.tasks.find(t => t.done);
        this.say(m, a.id, doneTask
          ? `Tôi ở ${room}, vừa ${TASK_VERBS[doneTask.stationId]} xong. Không thấy gì lạ.`
          : pick(FILLER_LINES, this.rng));
      } else {
        // Nội gián: bịa chứng cứ ngoại phạm hoặc đổ vấy
        const crew = A.filter(o => o.alive && o.role === 'crew' && o.id !== a.id);
        if (!crew.length) continue;
        if (this.rng() < 0.55) {
          this.say(m, a.id, pick(IMPOSTOR_ALIBIS, this.rng));
        } else {
          const x = pick(crew, this.rng);
          const where = m.room ? roomName(m.room) : roomName(roomAt(x.x, x.y));
          this.say(m, a.id, `Tôi thấy ${x.name} đi ra từ ${where}, mặt rất gian.`, [{ target: x.id, delta: 12 }]);
        }
      }
    }
    // Thêm vài câu "văn hóa công sở"
    const extra = Math.min(2, speakers.length);
    for (let i = 0; i < extra; i++) {
      const s = pick(speakers, this.rng);
      this.say(m, s.id, pick(FILLER_LINES, this.rng));
    }
  }

  private applyEffects(from: number, effects: Effect[]) {
    for (const l of this.agents) {
      if (l.isPlayer && !this.headless) continue;
      if (!l.alive || l.id === from) continue;
      const trustSpeaker = (l.brain.sus.get(from) ?? 0) < 40;
      for (const e of effects) {
        if (e.target === l.id) continue;
        if (!trustSpeaker && e.delta > 0) continue;
        l.brain.sus.set(e.target, (l.brain.sus.get(e.target) ?? 0) + e.delta * (0.7 + this.rng() * 0.6));
      }
    }
  }

  /** Người chơi gõ chat trong phòng họp */
  playerChat(text: string) {
    const m = this.meeting;
    if (!m || m.result) return;
    const p = this.player;
    m.chat.push({ from: p.id, text, t: m.t });
    if (!p.alive) return; // hồn ma nói không ai nghe
    const n = normalize(text);
    const vouch = /(khong phai|trong sach|vo toi|uy tin|tin .* duoc|clear)/.test(n);
    const mentioned = this.agents.filter(a => a.id !== p.id && a.alive && n.includes(normalize(a.name)));
    if (/(skip|bo qua)/.test(n)) for (const a of this.agents) a.brain.skipBias += 10;
    for (const x of mentioned) {
      this.applyEffects(p.id, [{ target: x.id, delta: vouch ? -10 : 13 }]);
      if (vouch) {
        this.say(m, x.id, `Cảm ơn ${p.name}, cuối cùng cũng có người hiểu tôi.`, [], m.t + 1.5 + this.rng() * 1.5);
      } else if (x.role === 'impostor') {
        const counter = this.rng() < 0.5;
        this.say(m, x.id, counter
          ? `${pick(DEFENSE_LINES, this.rng)} Mà sao ${p.name} hăng hái đổ lỗi thế, có tật giật mình à?`
          : pick(DEFENSE_LINES, this.rng),
        counter ? [{ target: p.id, delta: 10 }] : [], m.t + 1.5 + this.rng() * 2);
      } else {
        const comps = [...x.brain.companion.entries()].filter(([id, v]) => v > 2 && this.agents[id].alive && id !== p.id).sort((a, b) => b[1] - a[1]);
        const doneTask = x.tasks.find(t => t.done);
        let line = pick(DEFENSE_LINES, this.rng);
        if (comps.length) line = `Tôi ở cùng ${this.agents[comps[0][0]].name} suốt, hỏi ${this.agents[comps[0][0]].name} đi!`;
        else if (doneTask) line = `Tôi đang ${TASK_VERBS[doneTask.stationId]} mà! ${pick(DEFENSE_LINES, this.rng)}`;
        this.say(m, x.id, line, comps.length ? [{ target: x.id, delta: -6 }] : [], m.t + 1.5 + this.rng() * 2);
      }
    }
    if (!mentioned.length && this.rng() < 0.4) {
      const s = this.agents.filter(a => a.alive && !a.isPlayer);
      if (s.length) this.say(m, pick(s, this.rng).id, pick(FILLER_LINES, this.rng), [], m.t + 2 + this.rng() * 2);
    }
  }

  vote(voter: Agent, target: number | 'skip') {
    const m = this.meeting;
    if (!m || m.result || !voter.alive || m.votes.has(voter.id)) return;
    if (target !== 'skip' && !this.agents[target].alive) return;
    m.votes.set(voter.id, target);
  }

  private botVote(a: Agent): number | 'skip' {
    const b = a.brain;
    const alive = this.agents.filter(o => o.alive && o.id !== a.id);
    if (a.role === 'crew') {
      let best: Agent | null = null, bs = -1e9;
      for (const o of alive) {
        const s = b.sus.get(o.id) ?? 0;
        if (s > bs) { bs = s; best = o; }
      }
      return best && bs >= 24 + b.skipBias ? best.id : 'skip';
    }
    // Nội gián: hùa theo người bị nghi nhiều nhất (không phải đồng bọn)
    const crewBots = this.agents.filter(o => o.alive && o.role === 'crew' && !o.isPlayer);
    let best: Agent | null = null, bs = -1e9;
    for (const o of alive) {
      if (o.role === 'impostor') continue;
      let s = 0;
      for (const c of crewBots) s += c.brain.sus.get(o.id) ?? 0;
      s /= Math.max(1, crewBots.length);
      s += this.rng() * 6;
      if (s > bs) { bs = s; best = o; }
    }
    return best && bs >= 12 ? best.id : 'skip';
  }

  updateMeeting(dt: number) {
    const m = this.meeting;
    if (!m || m.result) return;
    m.t += dt;
    while (m.queue.length && m.queue[0].at <= m.t) {
      const q = m.queue.shift()!;
      if (!this.agents[q.from].alive) continue;
      m.chat.push({ from: q.from, text: q.text, t: m.t });
      this.applyEffects(q.from, q.effects);
    }
    for (const [id, at] of m.voteAt) {
      if (m.t >= at && !m.votes.has(id) && this.agents[id].alive) {
        m.votes.set(id, this.botVote(this.agents[id]));
      }
    }
    const aliveCount = this.agents.filter(a => a.alive).length;
    const allVoted = m.votes.size >= aliveCount;
    if (m.t >= m.duration || (allVoted && m.t > 8)) this.tally();
  }

  /** Kết thúc phần thảo luận sớm (khi người chơi đã vote và muốn tua nhanh) */
  fastForwardVotes() {
    const m = this.meeting;
    if (!m || m.result) return;
    for (const [id] of m.voteAt) {
      if (!m.votes.has(id) && this.agents[id].alive) m.votes.set(id, this.botVote(this.agents[id]));
    }
  }

  private tally() {
    const m = this.meeting!;
    const tally = new Map<number | 'skip', number[]>();
    for (const [voter, t] of m.votes) {
      if (!tally.has(t)) tally.set(t, []);
      tally.get(t)!.push(voter);
    }
    let max = 0, top: (number | 'skip')[] = [];
    for (const [t, vs] of tally) {
      if (vs.length > max) { max = vs.length; top = [t]; }
      else if (vs.length === max) top.push(t);
    }
    const tie = top.length > 1;
    const ejected = !tie && top.length === 1 && top[0] !== 'skip' ? (top[0] as number) : null;
    m.result = { ejected, tie, tally };
  }

  /** Gọi sau khi màn hình đuổi việc chạy xong */
  finishMeeting() {
    const m = this.meeting;
    if (!m || !m.result) return;
    if (m.result.ejected !== null) {
      const e = this.agents[m.result.ejected];
      e.alive = false;
      e.ejected = true;
      for (const a of this.agents) if (a.brain.witnessed === e.id) a.brain.witnessed = null;
    }
    this.bodies = [];
    this.meeting = null;
    let si = 0;
    for (const a of this.agents) {
      a.brain.seenBody = null;
      a.brain.nearBody = [];
      a.brain.path = [];
      a.brain.goal = null;
      a.brain.workT = 0;
      a.brain.targetId = null;
      a.brain.thinkT = this.rng() * 2;
      a.brain.skipBias = 0;
      for (const [id, v] of a.brain.sus) a.brain.sus.set(id, v * 0.6);
      if (a.role === 'impostor') a.killCd = KILL_CD * 0.8;
      if (a.alive) {
        const sp = tileCenter(SPAWNS[si % SPAWNS.length].x, SPAWNS[si % SPAWNS.length].y);
        si++;
        a.x = sp.x; a.y = sp.y;
      }
    }
    this.emergencyCd = 15;
    this.sabCd = Math.max(this.sabCd, 15);
    this.phase = 'play';
    this.checkWin();
  }

  private endGame(winner: Role, reason: string) {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.winner = winner;
    this.winReason = reason;
    this.events.push({ type: 'gameover', winner, reason });
  }

  checkWin() {
    if (this.phase === 'ended' || this.phase === 'meeting') return;
    const imp = this.aliveImp().length, crew = this.aliveCrew().length;
    if (imp === 0) { this.endGame('crew', 'Toàn bộ Nội gián đã bị sa thải. Văn phòng lại yên bình… cho đến đợt tái cấu trúc tiếp theo.'); return; }
    if (imp >= crew) { this.endGame('impostor', 'Nội gián chiếm đa số. Công ty "tái cấu trúc", nhân viên còn lại nhận quyết định nghỉ việc.'); return; }
    const k = this.crewTasksDone();
    if (k.total > 0 && k.done >= k.total) this.endGame('crew', 'KPI đạt 100%! Cả team được thưởng… một tấm giấy khen và một tràng pháo tay.');
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}

export type { TaskKind };
