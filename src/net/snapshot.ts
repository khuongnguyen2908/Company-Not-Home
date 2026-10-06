// Ảnh chụp trạng thái: chủ phòng gửi cho từng người, đã LỌC theo người xem (không lộ vai, phòng ban, việc,
// hồi chiêu, kết quả kỹ năng của người khác). Máy người vào phòng dùng nó để cập nhật một bản sao World,
// nhờ vậy giao diện và cảnh vẽ hiện có chạy nguyên vẹn.
import { World, type Agent, type GameEvent } from '../game/sim';
import { HIDE_SPOTS, TILE, levelAt } from '../game/map';

// ---------- Mã hóa Map / Set qua JSON ----------
type J = unknown;
export function enc(v: unknown): J {
  if (v instanceof Map) return { __m: [...v.entries()].map(([k, x]) => [k, enc(x)]) };
  if (v instanceof Set) return { __s: [...v].map(enc) };
  if (Array.isArray(v)) return v.map(enc);
  if (v && typeof v === 'object') { const o: Record<string, J> = {}; for (const [k, x] of Object.entries(v)) if (typeof x !== 'function') o[k] = enc(x); return o; }
  return v;
}
export function dec(v: J): unknown {
  if (Array.isArray(v)) return v.map(dec);
  if (v && typeof v === 'object') {
    const o = v as Record<string, J>;
    if ('__m' in o) return new Map((o.__m as [unknown, J][]).map(([k, x]) => [k, dec(x)]));
    if ('__s' in o) return new Set((o.__s as J[]).map(dec));
    const r: Record<string, unknown> = {}; for (const [k, x] of Object.entries(o)) r[k] = dec(x); return r;
  }
  return v;
}

/** Các trường của World KHÔNG gửi đi (nội bộ chủ phòng, hoặc xử lý riêng) */
const SKIP = new Set(['agents', 'events', 'inputs', 'watching', 'spawnOffers', 'playerInput', 'meId', 'headless', 'liftStats', 'spawnUsed', 'rng', 'time']);

/** Thông tin cố định của nhân vật: chỉ gửi một lần lúc bắt đầu ván */
const STATIC: (keyof Agent)[] = ['look', 'name', 'empId', 'color', 'desk'];
/** Vị trí: đi trong gói vị trí 20 lần/giây, không lặp trong ảnh chụp */
const MOTION: (keyof Agent)[] = ['x', 'y', 'facing', 'moving', 'walkT'];
/** Trường công khai của người khác (phần còn lại là riêng tư, máy nhận tự điền giá trị trống) */
const PUBLIC: (keyof Agent)[] = ['id', 'role', 'dept', 'alive', 'ejected', 'hidden', 'scanning', 'hrScanning', 'artistScanning', 'bossDone', 'directorRevealed', 'poRevealed', 'deathRoom', 'lastPortal', 'ghostLv', 'human', 'isPlayer', 'away'];
const round2 = (v: unknown) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 100) / 100 : v);
/** Đồng hồ đếm ngược: giao diện chỉ hiện theo giây nên làm tròn 0,5 giây (đỡ phải gửi ảnh chụp mỗi khung hình) */
const COUNTDOWN = new Set(['killCd', 'adminCd', 'engCd', 'mediaCd', 'itCd', 'itCamT', 'adminBattery', 'portalCd', 'engHideT', 'artistNext']);
const half = (v: number) => Math.ceil(v * 2) / 2;

/** Trường riêng tư của một nhân vật: người khác nhận giá trị trung tính */
const PRIVATE_NEUTRAL: Partial<Record<keyof Agent, unknown>> = {
  tasks: [], killCd: 0, hrUsed: false, hrPending: null, hrResult: null, poUsed: false, prodLast: null, devBackup: null, devUsed: false,
  artistNext: 0, artistResults: [], adminBattery: 0, adminCd: 0, adminViewing: false, engHideT: 0, engCd: 0, mediaCd: 0, stickerMsg: null,
  killedBy: null, animUsed: false, testTarget: null, testLog: [], testUsed: false, testLast: null, anonUsed: false, knownDead: [],
  itCd: 0, itCamT: 0, portalCd: 0, emergencyLeft: 1,
};

/** Người xem v có được biết vai thật của o không */
function knowsRole(w: World, v: Agent, o: Agent) {
  if (o.id === v.id || w.phase === 'ended' || o.ejected) return true;
  if (w.meeting?.result?.ejected === o.id) return true; // vừa bị bầu ra: cả phòng thấy vai thật cùng lúc (không chờ hết đoạn kéo ra cửa)
  if (o.role === 'impostor' && (v.role === 'impostor' || (v.role === 'crew' && v.dept === 'climber'))) return true; // đồng bọn; Intern tham vọng biết mặt Nội gián
  return false;
}
function knowsDept(w: World, v: Agent, o: Agent) {
  return o.id === v.id || w.phase === 'ended' || o.ejected || (o.dept === 'director' && o.directorRevealed) || (o.dept === 'po' && o.poRevealed);
}

function maskAgent(w: World, v: Agent, o: Agent, withStatic: boolean): J {
  const out: Record<string, unknown> = {};
  if (o.id === v.id) {
    // chính mình: đủ mọi trường (trừ não bot, vị trí; thông tin cố định chỉ lúc bắt đầu)
    // ảnh chụp đầu tiên (withStatic) mang đủ cả vị trí; các lần sau vị trí đi trong gói vị trí
    for (const [k, x] of Object.entries(o)) if (k !== 'brain' && (withStatic || (!MOTION.includes(k as keyof Agent) && !STATIC.includes(k as keyof Agent)))) out[k] = COUNTDOWN.has(k) && typeof x === 'number' ? half(x) : round2(x);
    out.brain = brainStub(o);
    return enc(out);
  }
  for (const k of PUBLIC) out[k] = round2(o[k]);
  if (withStatic) { for (const k of STATIC) out[k] = o[k]; for (const k of MOTION) out[k] = round2(o[k]); Object.assign(out, PRIVATE_NEUTRAL); }
  // Animator: được biết người này "bị gài" (để chọn làm lại anim) nhưng KHÔNG được biết ai gài (-1)
  if (v.dept === 'animator' && v.role === 'crew' && o.killedBy !== null && !o.alive) out.killedBy = -1;
  // đồng bọn Nội gián: thấy hồi chiêu của nhau (để biết ai sẵn sàng gài); người khác không thấy
  if (v.role === 'impostor' && o.role === 'impostor') out.killCd = half(o.killCd);
  if (!knowsRole(w, v, o)) out.role = 'crew';
  if (!knowsDept(w, v, o)) out.dept = out.role === 'impostor' ? null : 'intern';
  // đang trốn: chỉ đồng bọn Nội gián biết trốn ở đâu; người khác chỉ biết "không thấy"
  if (o.hidden !== null && !(v.role === 'impostor' && o.role === 'impostor')) out.hidden = -1;
  if (out.brain === undefined) out.brain = brainStub(o);
  return enc(out);
}
/** Phần "não" bot mà người khác nhìn thấy được: đang làm việc ở máy nào (cả Nội gián làm giả), có thấy ghế trống không */
function brainStub(o: Agent) {
  const b = o.brain;
  const g = b?.goal ?? null;
  const goal = g && (g.startsWith('task:') || g.startsWith('fake:')) ? 'task:' + g.slice(5) : g === 'fix' ? 'fix' : null;
  return { goal, workT: b && b.workT > 0 ? 1 : 0, seenBody: b?.seenBody ?? null, path: [], thinkT: 0, mode: 'idle' };
}

export interface FullSnap {
  w: Record<string, J>;
  agents: J[];
  kpi: { done: number; total: number };
  impAlive: number;
  crewAlive: { n: number; bossDone: number };
  /** có người đang xem camera (đèn đỏ trên camera nhấp nháy: thông tin công khai, ai đi ngang cũng thấy) */
  camsOn: boolean;
  spawnOffer: number[] | null;
  me: number;
}

/** Ảnh chụp đầy đủ cho người xem viewerId */
export function buildFull(w: World, viewerId: number, withStatic = false): FullSnap {
  const v = w.agents[viewerId];
  const out: Record<string, J> = {};
  for (const [k, x] of Object.entries(w)) { if (SKIP.has(k) || typeof x === 'function') continue; out[k] = enc(x); }
  // đồng hồ của ván: làm tròn (giao diện hiện theo giây)
  out.sabCd = Math.ceil(w.sabCd); out.emergencyCd = Math.ceil(w.emergencyCd);
  // kẻ gây sự cố: chỉ Nội gián biết
  if (w.sabotage) out.sabotage = enc({ ...w.sabotage, t: half(w.sabotage.t), by: v.role === 'impostor' ? w.sabotage.by : -1 });
  // cuộc họp: giấu lời thoại bot sắp nói, phiếu bầu chưa công bố, bảo lãnh của Producer, tin nhắn riêng của người khác
  if (w.meeting) {
    const m = w.meeting;
    const votes = new Map<number, number | 'skip'>();
    // trước khi có kết quả: chỉ biết ai đã bầu; phiếu ẩn danh: kể cả sau kết quả cũng không biết ai bầu ai
    for (const [k, x] of m.votes) votes.set(k, (m.result && !w.anonVotes) || k === viewerId ? x : 'skip');
    const result = m.result && w.anonVotes ? { ...m.result, tally: new Map([...m.result.tally].map(([t, vs]) => [t, vs.map(() => -1)])) } : m.result;
    out.meeting = enc({
      ...m, t: Math.round(m.t * 4) / 4, queue: [], reactQueue: [], votes, result,
      protect: v.dept === 'producer' ? m.protect : null,
      // tin riêng chỉ người nhận thấy; tin của hồn ma chỉ người đã chết thấy
      chat: m.chat.filter(c => (c.to === undefined || c.to === viewerId) && (!c.ghost || !v.alive || c.from === viewerId)).map(c => (c.anon && c.from !== viewerId ? { ...c, from: viewerId } : c)),
    });
  }
  const crew = w.aliveCrew();
  return {
    w: out,
    agents: w.agents.map(o => maskAgent(w, v, o, withStatic)),
    kpi: w.crewTasksDone(),
    impAlive: w.aliveImp().length,
    crewAlive: { n: crew.length, bossDone: crew.filter(c => c.bossDone).length },
    camsOn: w.camsInUse(),
    spawnOffer: w.spawnOffers.get(viewerId) ?? null,
    me: viewerId,
  };
}

/** Vị trí gửi 20 lần/giây: [id, x, y, facing, moving, walkT, alive, ẩn] */
export type PosRow = [number, number, number, 1 | -1, 0 | 1, number, 0 | 1, 0 | 1];
export function buildPos(w: World): PosRow[] {
  // (đồng hồ ván đi kèm gói vị trí, xem room.ts)
  return w.agents.map(a => [a.id, Math.round(a.x * 10) / 10, Math.round(a.y * 10) / 10, a.facing, a.moving ? 1 : 0, Math.round(a.walkT * 100) / 100, a.alive ? 1 : 0, a.hidden !== null ? 1 : 0]);
}

/** Bản sao World trên máy người vào phòng */
export function createReplica(full: FullSnap): World {
  const n = full.agents.length;
  const first = dec(full.agents[full.me]) as Agent;
  const r = new World({ playerName: first.name, playerLook: first.look, roles: {}, maxSpecial: 0, playerRole: 'crew', bots: n - 1, impostors: 1, seed: 1, headless: true });
  r.events = [];
  r.agents = full.agents.map(j => dec(j) as Agent); // ảnh chụp đầu tiên có đủ thông tin cố định
  applyFull(r, full);
  return r;
}

/** Áp ảnh chụp đầy đủ lên bản sao; giữ vị trí dự đoán của chính mình nếu lệch ít */
export function applyFull(r: World, full: FullSnap) {
  const meOld = r.agents[full.me];
  for (const [k, x] of Object.entries(full.w)) (r as unknown as Record<string, unknown>)[k] = dec(x);
  // ghép vào nhân vật đang có: giữ thông tin cố định và vị trí (gói vị trí lo), trường riêng tư của người khác về giá trị trống
  r.agents = full.agents.map(j => {
    const d = dec(j) as Record<string, unknown>;
    const prev = r.agents[d.id as number] as unknown as Record<string, unknown> | undefined;
    if (!prev) return d as unknown as Agent;
    const merged: Record<string, unknown> = { ...prev };
    if (d.id !== full.me) Object.assign(merged, PRIVATE_NEUTRAL);
    for (const k of MOTION) if (k in d) merged[k] = d[k]; // ảnh chụp đầu tiên mang vị trí
    Object.assign(merged, d);
    if (!(MOTION[0] in d)) for (const k of MOTION) merged[k] = prev[k];
    return merged as unknown as Agent;
  });
  r.meId = full.me;
  for (const a of r.agents) a.isPlayer = a.id === full.me;
  if (meOld && r.agents[full.me]) reconcileMe(meOld, r.agents[full.me]);
  r.spawnOffers = new Map(full.spawnOffer ? [[full.me, full.spawnOffer]] : []);
  // các con số tổng hợp do chủ phòng tính (bản sao không có đủ dữ liệu bí mật để tự tính)
  const kpi = full.kpi, impN = full.impAlive, crew = full.crewAlive, camsOn = !!full.camsOn;
  r.camsInUse = () => camsOn;
  r.crewTasksDone = () => kpi;
  r.aliveImp = () => Array.from({ length: impN }, (_, i) => ({ id: -1 - i, alive: true, role: 'impostor' }) as unknown as Agent);
  r.aliveCrew = () => Array.from({ length: crew.n }, (_, i) => ({ id: -100 - i, alive: true, role: 'crew', bossDone: i < crew.bossDone }) as unknown as Agent);
}

/** Vị trí người khác: đặt mục tiêu để cảnh vẽ trượt mượt tới; vị trí của mình thì đối chiếu dự đoán */
export function applyPos(r: World, rows: PosRow[], targets: Map<number, { x: number; y: number; cx?: number; cy?: number }>) {
  for (const [id, x, y, f, m, wt, al, hid] of rows) {
    const a = r.agents[id];
    if (!a) continue;
    a.alive = !!al;
    if (hid && a.hidden === null) a.hidden = -1; else if (!hid && a.hidden !== null) a.hidden = null;
    if (id === r.meId) { reconcileMe(a, { ...a, x, y } as Agent); continue; }
    a.facing = f; a.moving = !!m; a.walkT = wt;
    const t = targets.get(id);
    if (t) { t.x = x; t.y = y; } else targets.set(id, { x, y, cx: a.x, cy: a.y });
  }
}
/** Đối chiếu vị trí dự đoán của mình với vị trí chủ phòng: lệch ít thì giữ (mượt), lệch nhiều thì kéo về */
function reconcileMe(local: Agent, server: Agent) {
  const d = Math.hypot(local.x - server.x, local.y - server.y);
  if (d > 1.5 * TILE) { local.x = server.x; local.y = server.y; } // bị đẩy (dịch chuyển, cạy cửa, chọn nơi bắt đầu...)
  else if (d > 6) { local.x += (server.x - local.x) * 0.25; local.y += (server.y - local.y) * 0.25; }
  server.x = local.x; server.y = local.y;
}

/**
 * Lọc sự kiện cho từng người xem: chỉ gửi điều người đó được biết.
 * Trả về null nếu người xem không được biết sự kiện này.
 */
export function filterEvent(w: World, v: Agent, e: GameEvent): GameEvent | null {
  const mate = v.role === 'impostor';
  switch (e.type) {
    case 'kill': {
      // chỉ nạn nhân, kẻ gài, đồng bọn, người tận mắt thấy (hoặc hồn ma cùng tầng) mới nhận; người khác thấy ghế trống qua ảnh chụp
      const witnessed = v.alive ? w.sees(v, { x: e.x, y: e.y }, 40) : levelAt(e.x, e.y) === levelAt(v.x, v.y);
      return e.victim === v.id || e.killer === v.id || mate || witnessed ? e : null;
    }
    case 'vent': {
      const h = HIDE_SPOTS[e.spot], c = { x: (h.x + 0.5) * TILE, y: (h.y + 0.5) * TILE };
      const seen = v.alive ? w.sees(v, c, 30) : levelAt(c.x, c.y) === levelAt(v.x, v.y);
      return seen ? e : null;
    }
    case 'sabotage': return mate ? e : { ...e, by: -1 };
    case 'doors': return mate || e.by === v.id ? e : { ...e, by: e.by === null ? null : -1 };
    case 'task': case 'hr_sent': case 'hr_result': case 'artist_result': case 'eng_sense': return e.agent === v.id ? e : null;
    case 'backup_used': return e.killer === v.id || e.dev === v.id ? e : null;
    case 'media_msg': return e.to === v.id || e.from === v.id ? e : null;
    case 'test_tag': return e.tester === v.id ? e : null;
    case 'anon_accuse': return e.by === v.id ? e : null;
    default: return e;
  }
}

// =============================================================================================
// GÓI THAY ĐỔI: chỉ gửi phần khác so với gói trước đã gửi cho máy đó (gói đầy đủ ~5 KB → thường vài trăm byte)
// =============================================================================================
/** Ảnh chụp ở dạng cây (danh sách nhân vật thành đối tượng theo số thứ tự) để so từng trường */
export type SnapTree = Record<string, J>;
export interface Patch { s?: Record<string, J>; d?: string[]; o?: Record<string, Patch> }
export function toTree(f: FullSnap): SnapTree {
  const agents: Record<string, J> = {};
  f.agents.forEach((a, i) => { agents[i] = a; });
  return { ...(f as unknown as Record<string, J>), agents };
}
export function fromTree(t: SnapTree): FullSnap {
  const ag = t.agents as Record<string, J>;
  const agents = Object.keys(ag).map(Number).sort((a, b) => a - b).map(i => ag[i]);
  return { ...(t as unknown as FullSnap), agents };
}
const isObj = (x: J): x is Record<string, J> => !!x && typeof x === 'object' && !Array.isArray(x);
/** Phần khác giữa hai cây (đi sâu tối đa `depth` tầng đối tượng); giống hệt thì trả về null */
export function diffTree(a: Record<string, J>, b: Record<string, J>, depth = 3): Patch | null {
  const p: Patch = {};
  for (const k of Object.keys(b)) {
    const x = a[k], y = b[k];
    if (k in a && x === y) continue;
    if (k in a && depth > 0 && isObj(x) && isObj(y)) { const sub = diffTree(x, y, depth - 1); if (sub) (p.o ??= {})[k] = sub; continue; }
    if (k in a && JSON.stringify(x) === JSON.stringify(y)) continue;
    (p.s ??= {})[k] = y;
  }
  for (const k of Object.keys(a)) if (!(k in b)) (p.d ??= []).push(k);
  return p.s || p.d || p.o ? p : null;
}
/** Áp phần khác vào cây (sửa tại chỗ) */
export function applyPatch(t: Record<string, J>, p: Patch) {
  if (p.d) for (const k of p.d) delete t[k];
  if (p.s) for (const [k, v] of Object.entries(p.s)) t[k] = v;
  if (p.o) for (const [k, sub] of Object.entries(p.o)) { const x = t[k]; if (isObj(x)) applyPatch(x, sub); else throw new Error('patch base'); }
}
