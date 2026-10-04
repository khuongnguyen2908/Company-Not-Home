// Mô phỏng toàn bộ luật chơi. Không phụ thuộc Phaser hay DOM,
// nên sau này có thể chạy trên máy chủ phòng (host) khi làm nhiều người chơi.

import {
  TILE, DESKS, STATIONS, TASKS, HIDE_SPOTS, SPAWNS, BELL, BELL_STAND, MAP_W, MAP_H, station, taskDef,
  PORTAL_AT, LIFT_DOORS, CABIN, CABIN_DOOR, ELEV_BLOCK, LIFT_FLOORS, STAIRS_LEVEL, levelAt,
  canStand, roomAt, roomName, tileCenter, isFloor, ROOMS, lineOfSight, DOOR_BLOCK, DOOR_GROUPS, LOCKABLE_ROOMS, MAP_W as MW, type RoomId, type Station, type MiniKind,
} from './map';
import { findPath, type Pt } from './path';
import { fmt } from '../content/text';
import { type Look, randomLook, lookColor, colors2, itemDef, bodyDef, SLOTS } from './look';
import { CAMERAS, levelName, FLOORS, STAIRWELL, SPAWN_POINTS, MINI_TIME, taskDiff } from './map';
import {
  type RoleDept, SPECIAL_ROLES, NEUTRAL_ROLES, COLOR_GROUPS, colorGroupOf, STICKERS, BOT_NAMES, FILLER_LINES, DEFENSE_LINES, IMPOSTOR_ALIBIS, pick, normalize,
} from './data';

export type Role = 'crew' | 'impostor';
/** Phe thắng: Nhân viên, Nội gián, hoặc một vai phe thứ ba */
export type Winner = Role | 'gd' | 'climber';
export type SabotageKind = 'wifi' | 'power' | 'boss';

export const SPEED = 205;
export const VISION = 3.8 * TILE;      // tầm nhìn Nhân viên ở mức 1x (bản đồ nhiều tầng rộng hơn nên trả về 3,8 ô)
export const VISION_IMP = VISION * 1.5; // Nội gián nhìn xa gấp rưỡi, như Among Us
export const VISION_DARK = 1.2 * TILE;
export const DOOR_TIME = 10;            // cửa khóa trong bao lâu
export const DOOR_CD = 30;              // hồi chiêu khóa cửa của mỗi phòng
export const SWIPE_TIME = 3;
export const LIFT_FLOOR_TIME = 1;   // thang máy: 1 giây mỗi tầng
export const LIFT_DOOR_TIME = 3;    // cửa mở 3 giây mỗi điểm dừng
export const PRY_AFTER = 20;        // kẹt thang 20 giây thì được cạy cửa
export const PRY_TIME = 8;
export const RESCUE_TIME = 5;       // Engineer mở cửa thang kẹt từ bên ngoài
export const NOISE_TIME = 15;     // Sound Engineer: cảnh báo tồn tại 15 giây (tòa nhiều tầng cần thêm thời gian lần theo)
export const ADMIN_BATTERY = 10;  // Admin: pin xem tối đa 10 giây
export const ADMIN_CD = 20;
export const ENG_HIDE_MAX = 15;   // Engineer: mỗi lần trốn tối đa 15 giây
export const ENG_CD = 30;
export const MEDIA_CD = 10;
export const MEDIA_RANGE = 2.2 * 48;
export const CLIMBER_CD = 35;      // Intern tham vọng: hồi chiêu gài bẫy
export const TEST_RANGE = 1.6 * 48; // Tester: đứng cạnh trong khoảng này để gắn test case
export const KILL_RANGE = 1.35 * TILE;
export const KILL_CD = 45;        // như mặc định của Among Us
export const KILL_CD_START = 20;
export const HR_UNLOCK = 60;      // máy Face ID mở sau 60 giây chơi (hoặc sau cuộc họp đầu tiên)
export const SAB_CD = 30;
const WANDER_ROOMS = ROOMS.filter(r => r.id !== 'cabin' && !r.id.startsWith('stair'));
export const BOSS_TIME = 45; // tòa nhiều tầng: cần thêm thời gian để về bàn
/**
 * Hồi chiêu gài bẫy theo cỡ ván (bản đồ 3 tầng + sân thượng).
 * Chọn bằng cách chạy 150 ván bot cho từng cỡ, nhắm tỉ lệ Nội gián thắng khoảng 40–52%.
 */
export function killCooldownFor(players: number, imps: number): number {
  if (imps <= 1) return ({ 5: 57, 6: 35, 7: 23, 8: 18, 9: 12 } as Record<number, number>)[players] ?? (players < 5 ? 60 : 8);
  return ({ 7: 128, 8: 80, 9: 60 } as Record<number, number>)[players] ?? (players < 7 ? 128 : 50);
}
export const USE_RANGE = 1.15 * TILE;
export const REPORT_RANGE = 1.7 * TILE;
export const DISCUSS_TIME = 60;
export const VOTE_TIME = 30;
export const HR_WAIT = 60;      // giây chơi chờ kết quả Face ID
export const HR_SCAN_TIME = 4;  // giây đứng quét ở máy
export const IT_CAM_TIME = 10;
export const IT_CD = 40;
export const CHAT_GAP = 2;

export interface TaskSlot { taskId: string; step: number; done: boolean }

/** Trạm hiện tại của một đầu việc (việc dài có nhiều bước) */
export function slotStation(t: TaskSlot): MiniKind { return taskDef(t.taskId).steps[t.step]; }

interface Brain {
  mode: string;
  path: Pt[];
  goal: string | null;
  workT: number;
  thinkT: number;
  senseT: number;
  targetId: number | null;
  huntT: number;
  lastSeen: Map<number, { room: RoomId | null; t: number; x?: number; y?: number }>;
  companion: Map<number, number>;
  sus: Map<number, number>;
  witnessed: number | null;
  seenBody: number | null;
  nearBody: number[];
  reactT: number;
  fixer: boolean;
  hideT: number;
  skipBias: number;
  cleared: Set<number>; // những người đã thấy chấm công vân tay
  sawHrScan: Set<number>; // những người đã thấy quét máy Face ID (chắc chắn là HR thật)
  hrTarget: number | null; // Nội gián: người bị nghi là HR, cần xử lý trước
  claimedHr: boolean; // Nội gián đã từng nhận là HR
  lockWait: number;
  lift?: { to: Pt; floor: number; stage: 'walk' | 'wait' | 'ride'; t: number } | null;
  adminAlert?: number | null;
  adminT?: number;
  artistSaid?: number;
  devSaid?: boolean;
  lastPos: { x: number; y: number } | null; // Nội gián: nơi cuối cùng thấy con mồi
  lostT: number;
}

export interface Agent {
  id: number;
  name: string;
  look: Look;
  color: string;        // màu thẻ tên (màu áo)
  empId: string;        // mã số nhân viên: 111, 222, ... (không trùng trong ván)
  dept: RoleDept | null; // phòng ban bí mật; Nội gián không có
  isPlayer: boolean;     // người chơi trên máy này (giao diện điều khiển)
  human: boolean;        // người thật (máy này hoặc máy khác trong phòng); bot thì false
  away?: boolean;        // người thật đang mất kết nối (chủ phòng đánh dấu, mọi người thấy)
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
  scanning: boolean; // đang chấm công vân tay (task hiển thị)
  hrScanning: boolean; // đang quét máy Face ID (ai đứng gần cũng thấy)
  hrUsed: boolean;
  hrPending: { target: number; left: number } | null;
  hrResult: { target: number; imp: boolean } | null;
  directorRevealed: boolean;
  poUsed: boolean;          // Product Owner đã gọi họp gấp
  poRevealed: boolean;
  prodLast: number | null;  // Producer: người đã bảo lãnh ở cuộc họp trước
  devBackup: number | null; // Developer: người được backup
  devUsed: boolean;
  artistNext: number;       // Artist: dùng được máy so màu khi số cuộc họp đạt mốc này
  artistScanning: boolean;
  artistResults: { group: string; has: boolean }[];
  adminBattery: number;     // Admin: giây pin còn lại để xem Bảng chấm công
  adminCd: number;
  adminViewing: boolean;
  engHideT: number;         // Engineer: đã trốn bao lâu trong lần này
  engCd: number;
  mediaCd: number;          // Truyền thông (hồn ma): hồi chiêu gửi sticker
  deathRoom: RoomId | null;
  stickerMsg: { stickers: number[]; until: number } | null; // sticker hồn ma gửi cho mình
  killedBy: number | null;  // ai đã gài bẫy (để Animator biết ai là người bị gài)
  animUsed: boolean;        // Animator đã làm lại anim
  testTarget: number | null; // Tester: người đang gắn test case
  testLog: { room: string; t: number; jump?: boolean }[];
  testUsed: boolean;        // đã gắn trong vòng này
  testLast: { x: number; y: number } | null;
  anonUsed: boolean;        // Intern tham vọng: đã tố cáo nặc danh
  knownDead: number[];      // Animator: những người mình đã biết là nghỉ việc (thấy ghế hoặc vào họp)
  portalCd: number;         // vừa đi qua cổng thang bộ / thang máy
  lastPortal: number;       // thời điểm đi qua cổng (để Tester không đánh dấu nhầm là chui ống)
  ghostLv: number;          // hồn ma: tầng đang ở (giữ hồn ma trong phạm vi tầng)
  itCamT: number; // còn bao lâu đang xem camera bằng laptop
  itCd: number;
  brain: Brain;
}

export interface Ctx {
  use: null | { kind: 'task' | 'fix' | 'bell' | 'desk' | 'camera' | 'faceid' | 'door' | 'colorcheck' | 'liftcall' | 'liftpanel' | 'pry' | 'rescue'; station?: Station; label: string; room?: RoomId };
  report: Body | null;
  kill: Agent | null;
  hide: number | null;
}

export interface Body { victim: number; x: number; y: number; room: RoomId | null; t: number }

export type GameEvent =
  | { type: 'kill'; killer: number; victim: number; x: number; y: number }
  | { type: 'vent'; spot: number }   // có người chui vào hoặc chui ra một lối trốn (nắp bật lên)
  | { type: 'meeting'; reporter: number; victim: number | null }
  | { type: 'sabotage'; kind: SabotageKind; by: number }
  | { type: 'sabotage_end'; kind: SabotageKind; by: number | null }
  | { type: 'task'; agent: number; stationId: string }
  | { type: 'boss_ok'; agent: number }
  | { type: 'hr_sent'; agent: number; target: number }
  | { type: 'hr_result'; agent: number; target: number; imp: boolean }
  | { type: 'director_reveal'; agent: number }
  | { type: 'backup_used'; killer: number; victim: number; dev: number }
  | { type: 'artist_result'; agent: number; group: string; has: boolean }
  | { type: 'noise'; victim: number; x: number; y: number }
  | { type: 'eng_sense'; agent: number; spot: number }
  | { type: 'media_msg'; from: number; to: number; stickers: number[] }
  | { type: 'doors'; room: RoomId; locked: boolean; by: number | null }
  | { type: 'gameover'; winner: Winner; reason: string }
  | { type: 'revive'; animator: number; target: number }
  | { type: 'test_tag'; tester: number; target: number }
  | { type: 'anon_accuse'; by: number; target: number }
  | { type: 'lift_arrive'; floor: number }
  | { type: 'lift_pry'; agent: number }
  | { type: 'lift_rescue'; agent: number };

/** Phạm vi hồn ma được bay trong một tầng (điểm ảnh) */
export function ghostRegion(lv: number): { x0: number; y0: number; x1: number; y1: number } {
  if (lv === 0) return { x0: CABIN.x * TILE + 12, y0: CABIN.y * TILE + 12, x1: (CABIN.x + CABIN.w) * TILE - 12, y1: (CABIN.y + CABIN.h) * TILE - 12 };
  if (lv === STAIRS_LEVEL) return { x0: STAIRWELL.x * TILE, y0: STAIRWELL.y * TILE, x1: (STAIRWELL.x + STAIRWELL.w) * TILE, y1: (STAIRWELL.y + STAIRWELL.h) * TILE };
  const F = FLOORS[Math.max(1, Math.min(4, lv)) - 1];
  return { x0: (F.ox + 1) * TILE, y0: (F.oy + 1) * TILE, x1: (F.ox + F.w - 1) * TILE, y1: (F.oy + F.h - 1) * TILE };
}

export interface ChatMsg { from: number; text: string; t: number; system?: boolean; to?: number; anon?: boolean; alert?: boolean; ghost?: boolean /* hồn ma nói: chỉ người đã chết đọc được */ }

interface Effect { target: number; delta: number }

export interface Meeting {
  reporter: number;
  victim: number | null;
  room: RoomId | null;
  t: number;
  duration: number;
  discussEnd: number; // trước mốc này chỉ được thảo luận, sau đó mới mở bỏ phiếu
  chat: ChatMsg[];
  queue: { at: number; from: number; text: string; effects: Effect[]; claim?: { target: number; imp: boolean }; reveal?: boolean }[];
  hrClaims: { by: number; target: number; imp: boolean }[];
  via: 'body' | 'bell' | 'email' | 'po';
  protect: number | null; // Producer bảo lãnh ai trong cuộc họp này
  reactions: { from: number; emoji: string; t: number }[];
  reactQueue: { at: number; from: number; emoji: string }[];
  votes: Map<number, number | 'skip'>;
  voteAt: Map<number, number>;
  result: null | { ejected: number | null; tie: boolean; tally: Map<number | 'skip', number[]>; saved?: number };
  readyVote?: number[]; // người thật đã bấm Sẵn sàng bỏ phiếu
}

export interface WorldOptions {
  playerName: string;
  playerLook: Look;
  roles: Partial<Record<Exclude<RoleDept, 'intern'>, boolean>>;
  /** Số vai có kỹ năng tối đa mỗi ván (bốc ngẫu nhiên trong các vai đang bật) */
  maxSpecial?: number;
  /** Đồng nghiệp bot đã gặp ở sảnh tầng G (giữ nguyên tên và ngoại hình khi vào ca) */
  botProfiles?: { name: string; look: Look; empId?: string }[];
  /** Thang máy: sức chứa và cách thoát khi kẹt (dùng cho chạy thử cân bằng) */
  liftCapacity?: number;
  liftPry?: boolean;
  liftUse?: number;
  /** Mã số nhân viên của người chơi (3 chữ số); trống thì bốc ngẫu nhiên */
  playerEmpId?: string;
  vision?: number;
  killCd?: number;
  killCdStart?: number;
  killCdAfterMeeting?: number;
  shortTasks?: number;
  killFirst?: number;
  buddy?: number;
  seekLead?: number;
  bodySpot?: number;
  playerRole: 'random' | Role;
  /** Chế độ thử nghiệm: ép phòng ban của người chơi (chỉ khi là Nhân viên) */
  playerDept?: RoleDept;
  bots: number;
  impostors: number;
  seed?: number;
  headless?: boolean; // dùng khi chạy thử tự động: người chơi cũng do bot điều khiển
  spawnChoice?: boolean; // chọn nơi xuất hiện sau họp (mặc định bật)
  discussTime?: number;  // thời gian thảo luận mỗi cuộc họp (giây)
  voteTime?: number;     // thời gian bỏ phiếu (giây)
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
    nearBody: [], reactT: 0, fixer: false, hideT: 0, skipBias: 0, cleared: new Set(), sawHrScan: new Set(), hrTarget: null, claimedHr: false, lockWait: 0, lastPos: null, lostT: 0,
  };
}

// Nội gián giả vờ làm ở đây (không giả vờ chấm công vì đó là việc ai cũng nhìn thấy)
const FAKE_STATIONS = STATIONS.filter(s => !['fingerprint', 'camera', 'router', 'power'].includes(s.id));

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
  winner: Winner | null = null;
  winReason = '';
  meeting: Meeting | null = null;
  playerInput = { x: 0, y: 0 };
  rng: () => number;
  headless: boolean;
  meetingCount = 0;
  /** Hồi chiêu gài bẫy (chỉnh được để cân bằng / chạy thử) */
  killCdBase = KILL_CD;
  shortTasks = 3;
  buddyChance = 0;
  seekLead = 6;
  bodySpot = 0; // bot để ý ghế đổ xa hơn tầm nhìn bao nhiêu ô
  killCdAfterMeeting = 1;
  /** Hệ số tầm nhìn của Nhân viên (cài đặt phòng: 0.75x / 1x / 1.25x) */
  visionMul = 1;
  /** Danh sách phòng ban có năng lực trong ván (công khai) */
  roleList: RoleDept[] = [];
  /** Thời gian họp (giây), chủ phòng chỉnh được */
  discussTime = DISCUSS_TIME;
  voteTime = VOTE_TIME;
  /** Số Nội gián trong ván (thông tin công khai, máy người vào phòng dùng để hiện đúng) */
  impostorTotal = 1;

  constructor(opts: WorldOptions) {
    this.rng = mulberry32(opts.seed ?? Math.floor(Math.random() * 1e9));
    this.headless = !!opts.headless;
    if (opts.spawnChoice !== undefined) this.spawnChoice = opts.spawnChoice;
    if (opts.discussTime) this.discussTime = Math.max(15, Math.min(180, opts.discussTime));
    if (opts.voteTime) this.voteTime = Math.max(10, Math.min(120, opts.voteTime));
    this.visionMul = opts.vision ?? 1;
    this.liftCapacity = opts.liftCapacity ?? 4;
    this.liftPry = opts.liftPry ?? true;
    if (opts.liftUse !== undefined) this.liftUse = opts.liftUse;
    ELEV_BLOCK.fill(0); this.applyLiftBlocks();
    if (opts.killCd) this.killCdBase = opts.killCd;
    if (opts.shortTasks) this.shortTasks = opts.shortTasks;
    if (opts.buddy !== undefined) this.buddyChance = opts.buddy;
    if (opts.seekLead !== undefined) this.seekLead = opts.seekLead;
    if (opts.bodySpot !== undefined) this.bodySpot = opts.bodySpot;
    if (opts.killCdAfterMeeting !== undefined) this.killCdAfterMeeting = opts.killCdAfterMeeting;
    DOOR_BLOCK.fill(0);
    const total = opts.bots + 1;
    const names = BOT_NAMES.filter(n => normalize(n) !== normalize(opts.playerName)).sort(() => this.rng() - 0.5);
    const deskOrder = DESKS.map((_, i) => i).sort(() => this.rng() - 0.5);

    for (let i = 0; i < total; i++) {
      const sp = tileCenter(SPAWNS[i % SPAWNS.length].x, SPAWNS[i % SPAWNS.length].y);
      this.agents.push({
        id: i,
        name: i === 0 ? (opts.playerName || 'Bạn') : (opts.botProfiles?.[i - 1]?.name ?? names[i - 1]),
        look: i === 0 ? opts.playerLook : (opts.botProfiles?.[i - 1]?.look ?? randomLook(this.rng)),
        color: '', dept: null, empId: '',
        isPlayer: i === 0, human: i === 0 && !opts.headless,
        role: 'crew', alive: true, ejected: false,
        x: sp.x, y: sp.y, facing: 1, moving: false, walkT: 0,
        tasks: [], desk: deskOrder[i % DESKS.length], hidden: null,
        killCd: KILL_CD_START, emergencyLeft: 1, bossDone: false, scanning: false,
        hrScanning: false, hrUsed: false, hrPending: null, hrResult: null, directorRevealed: false, itCamT: 0, itCd: 15,
        poUsed: false, poRevealed: false, prodLast: null, devBackup: null, devUsed: false, artistNext: 1, artistScanning: false, artistResults: [],
        adminBattery: 10, adminCd: 0, adminViewing: false, engHideT: 0, engCd: 0, mediaCd: 0, deathRoom: null, stickerMsg: null,
        killedBy: null, animUsed: false, testTarget: null, testLog: [], testUsed: false, testLast: null, anonUsed: false, knownDead: [], portalCd: 0, lastPortal: -99, ghostLv: 2,
        brain: newBrain(),
      });
    }
    // Phân vai Nội gián
    // Như Among Us: ván 6 người trở xuống chỉ có 1 Nội gián
    const nImp = Math.max(1, Math.min(opts.impostors, total <= 6 ? 1 : 2));
    const pool = this.agents.map(a => a.id);
    const chosen: number[] = [];
    if (opts.playerRole === 'impostor') chosen.push(0);
    const others = pool.filter(id => !(opts.playerRole !== 'random' && id === 0)).sort(() => this.rng() - 0.5);
    for (const id of others) { if (chosen.length >= nImp) break; if (!chosen.includes(id)) chosen.push(id); }
    for (const id of chosen) this.agents[id].role = 'impostor';
    this.impostorTotal = chosen.length;
    // 2 Nội gián trong ván ít người rất mạnh: kéo dài hồi chiêu để bù
    // Hồi chiêu gài bẫy tự cân theo số Nội gián (đã chạy thử hàng trăm ván để chọn số)
    if (opts.killCd) for (const a of this.agents) a.killCd = opts.killFirst ?? Math.round(opts.killCd / 2);
    if (!opts.killCd) {
      const cd = killCooldownFor(total, nImp);
      this.killCdBase = cd;
      for (const a of this.agents) a.killCd = Math.round(cd * 0.5);
    }
    // Mã số nhân viên 100–999: người chơi tự chọn, bot dùng mã ở sảnh hoặc bốc ngẫu nhiên, không bao giờ trùng
    const used = new Set<string>();
    const valid = (x?: string) => !!x && /^[1-9][0-9]{2}$/.test(x) && !used.has(x);
    const fresh = () => { let x = ''; do { x = String(100 + Math.floor(this.rng() * 900)); } while (used.has(x)); return x; };
    this.agents.forEach((a, i) => {
      const want = i === 0 ? opts.playerEmpId : opts.botProfiles?.[i - 1]?.empId;
      a.empId = valid(want) ? want! : fresh();
      used.add(a.empId);
    });
    for (const a of this.agents) { a.color = lookColor(a.look); if (opts.killCdStart !== undefined) a.killCd = opts.killCdStart; }

    // Bốc phòng ban bí mật cho Nhân viên; Nội gián không có phòng ban thật
    let crew = this.agents.filter(a => a.role === 'crew').sort(() => this.rng() - 0.5);
    let enabled = SPECIAL_ROLES.filter(r => opts.roles[r] && (NEUTRAL_ROLES[r] ?? 0) <= total).sort(() => this.rng() - 0.5);
    let maxS = opts.maxSpecial ?? 3;
    // Chế độ thử nghiệm: người chơi nhận đúng phòng ban đã chọn
    const forced = opts.playerDept && this.agents[0].role === 'crew' ? opts.playerDept : null;
    if (forced) {
      crew = [this.agents[0], ...crew.filter(a => a !== this.agents[0])];
      if (forced !== 'intern') { enabled = [forced, ...enabled.filter(r => r !== forced)]; maxS = Math.max(maxS, 1); }
      else { crew = [...crew.slice(1), this.agents[0]]; }
    }
    const special: RoleDept[] = enabled.slice(0, Math.min(maxS, forced === 'intern' ? crew.length - 1 : crew.length));
    crew.forEach((a, i) => { a.dept = special[i] ?? 'intern'; });
    this.roleList = special;
    // Developer bot chọn ngẫu nhiên một đồng nghiệp để backup (người chơi tự chọn ở màn phân vai)
    // Intern tham vọng hồi chiêu gài bẫy riêng
    for (const a of crew) if (a.dept === 'climber') a.killCd = 20;
    for (const a of crew) if (a.dept === 'developer' && !a.human) {
      const others = this.agents.filter(o => o !== a);
      a.devBackup = pick(others, this.rng).id;
    }

    for (const a of this.agents) {
      // 1 việc chung + 3 việc ngắn + 1 việc dài
      const shuffle = <T,>(arr: T[]) => [...arr].sort(() => this.rng() - 0.5);
      const common = TASKS.filter(t => t.type === 'common');
      // Gom việc theo khu: mỗi người làm ở 2 tầng liền kề (tầng 1–2 hoặc 2–3, sân thượng tính chung với tầng 3)
      const zone = this.rng() < 0.5 ? [1, 2] : [2, 3, 4];
      const floorOfStep = (k: string) => { const st = station(k); return levelAt((st.stand.x + 0.5) * TILE, (st.stand.y + 0.5) * TILE); };
      const inZone = (t: (typeof TASKS)[number]) => t.steps.every(k => zone.includes(floorOfStep(k)));
      // Mỗi người tối đa 1 việc khó (tính cả việc ngắn lẫn việc dài): ưu tiên việc trong khu, bỏ qua việc khó thứ hai
      let hard = 0;
      const take = (list: (typeof TASKS)[number][], n: number) => {
        const out: (typeof TASKS)[number][] = [];
        for (const t of list) { if (out.length >= n) break; const h = taskDiff(t) === 'kho'; if (h && hard >= 1) continue; if (h) hard++; out.push(t); }
        return out;
      };
      const longAll = shuffle(TASKS.filter(t => t.type === 'long'));
      const long = take([...longAll.filter(inZone), ...longAll.filter(t => !inZone(t))], 1);
      const shortAll = shuffle(TASKS.filter(t => t.type === 'short'));
      const short = take([...shortAll.filter(inZone), ...shortAll.filter(t => !inZone(t))], this.shortTasks);
      const maint = a.role === 'crew' && a.dept === 'engineer' ? shuffle(TASKS.filter(t => t.type === 'maint')).slice(0, 2) : [];
      a.tasks = [...common, ...short, ...long, ...maint].map(t => ({ taskId: t.id, step: 0, done: false }));
      a.brain.thinkT = this.rng() * 1.5;
    }
  }

  /** Nhân vật của máy này (chủ phòng: 0; bản sao trên máy người vào phòng: nhân vật của họ) */
  meId = 0;
  get player() { return this.agents[this.meId]; }
  /** Điều khiển di chuyển của người thật ở máy khác (chủ phòng nhận qua mạng) */
  inputs = new Map<number, { x: number; y: number }>();
  /** Biến một nhân vật thành người thật (điều khiển qua mạng) hoặc trả lại cho bot */
  setHuman(id: number, on: boolean) { const a = this.agents[id]; if (a) { a.human = on; if (!on) this.inputs.delete(id); } }

  // ---------- Truy vấn ----------
  crewTasksDone() {
    let done = 0, total = 0;
    for (const a of this.agents) {
      if (a.role !== 'crew' || this.isNeutral(a)) continue; // phe thứ ba làm việc giả
      for (const t of a.tasks) { const n = taskDef(t.taskId).steps.length; total += n; done += t.done ? n : t.step; }
    }
    return { done, total };
  }

  aliveCrew() { return this.agents.filter(a => a.alive && a.role === 'crew' && a.dept !== 'climber'); }
  isNeutral(a: Agent) { return a.role === 'crew' && (a.dept === 'gd' || a.dept === 'climber'); }
  canKill(a: Agent) { return a.alive && (a.role === 'impostor' || (a.role === 'crew' && a.dept === 'climber')); }
  aliveImp() { return this.agents.filter(a => a.alive && a.role === 'impostor'); }

  visionOf(a: Agent): number {
    if (!a.alive) return 99999;
    if (levelAt(a.x, a.y) === STAIRS_LEVEL) return this.visionBase(a) * 0.72; // giếng thang tối, đèn thoát hiểm mờ
    return this.visionBase(a);
  }
  private visionBase(a: Agent): number {
    if (a.role === 'impostor') return VISION_IMP;
    if (this.sabotage?.kind === 'power') return VISION_DARK * this.visionMul;
    return VISION * this.visionMul;
  }

  canSee(obs: Agent, target: { x: number; y: number }, targetAgent?: Agent): boolean {
    if (targetAgent) {
      if (targetAgent.hidden !== null) return false;
      if (!targetAgent.alive && obs.alive) return false;
    }
    return this.sees(obs, target);
  }

  /** Có nhìn thấy điểm này không: trong tầm nhìn và không bị tường hay cửa khóa che */
  sees(obs: Agent, t: { x: number; y: number }, extra = 0): boolean {
    if (!obs.alive) return true;
    if (dist(obs, t) > this.visionOf(obs) + extra) return false;
    return lineOfSight(obs.x, obs.y - 20, t.x, t.y - 20);
  }

  stationById(id: string): Station | undefined {
    return STATIONS.find(s => s.id === id);
  }

  /** Những hành động người chơi đang làm được ở vị trí hiện tại */
  context(a: Agent): Ctx {
    const ctx: Ctx = { use: null, report: null, kill: null, hide: null };
    if (this.phase !== 'play') return ctx;
    if (a.hidden !== null) return ctx;

    // Thang máy: trong buồng thì chọn tầng / cạy cửa; trước cửa thì gọi thang / Engineer mở cửa kẹt
    if (a.alive) {
      const lv = levelAt(a.x, a.y);
      if (lv === 0) {
        if (this.lift.stuck && this.liftPry) { ctx.use = { kind: 'pry', label: this.lift.stuckT >= PRY_AFTER ? 'Cạy cửa' : `Cạy cửa (${Math.ceil(PRY_AFTER - this.lift.stuckT)}s)` }; return this.finishContext(a, ctx); }
        if (dist(a, tileCenter(CABIN.x, CABIN.y)) < 1.8 * TILE) { ctx.use = { kind: 'liftpanel', label: 'Chọn tầng' }; return this.finishContext(a, ctx); }
      } else {
        const ld = LIFT_DOORS.find(l => l.level === lv);
        if (ld && dist(a, { x: (ld.front.x + 0.5) * TILE, y: (ld.front.y + 0.5) * TILE }) < 1.6 * TILE) {
          if (a.role === 'crew' && a.dept === 'engineer' && !this.rescueBlocked(a)) { ctx.use = { kind: 'rescue', label: 'Mở cửa thang' }; return this.finishContext(a, ctx); }
          if (!this.liftOpenAt(lv)) { ctx.use = { kind: 'liftcall', label: this.lift.stuck ? 'Thang máy kẹt' : this.lift.requests.has(lv) ? 'Đang gọi thang…' : 'Gọi thang máy' }; return this.finishContext(a, ctx); }
        }
      }
    }

    // Cửa đang khóa ngay cạnh: quẹt thẻ để mở sớm
    if (a.alive) {
      for (const [room] of this.doorLocks) {
        for (const idx of DOOR_GROUPS.get(room) ?? []) {
          const c = tileCenter(idx % MW, Math.floor(idx / MW));
          if (dist(a, c) < 1.45 * TILE) { ctx.use = { kind: 'door', label: 'Quẹt thẻ', room }; return this.finishContext(a, ctx); }
        }
      }
    }
    // Sếp đi tuần: ưu tiên về bàn
    if (this.sabotage?.kind === 'boss' && a.alive && a.role === 'crew' && !a.bossDone) {
      const seat = DESKS[a.desk].seat;
      const c = tileCenter(seat.x, seat.y);
      if (dist(a, c) < USE_RANGE) ctx.use = { kind: 'desk', label: 'Giả vờ gõ phím' };
    }
    if (!ctx.use && this.sabotage && this.sabotage.kind !== 'boss' && (a.alive || a.role === 'crew')) {
      const st = station(this.sabotage!.kind === 'wifi' ? 'router' : 'power');
      const c = tileCenter(st.stand.x, st.stand.y);
      if (a.alive && dist(a, c) < USE_RANGE) ctx.use = { kind: 'fix', station: st, label: 'Sửa' };
    }
    if (!ctx.use) {
      for (const t of a.tasks) {
        if (t.done) continue;
        const st = station(slotStation(t));
        const c = tileCenter(st.stand.x, st.stand.y);
        if (dist(a, c) < USE_RANGE) { ctx.use = { kind: 'task', station: st, label: a.role === 'impostor' ? 'Giả vờ làm' : 'Làm việc' }; break; }
      }
    }
    if (!ctx.use && a.alive && a.dept === 'hr' && a.role === 'crew' && !a.hrUsed) {
      const fid = station('faceid');
      const c = tileCenter(fid.stand.x, fid.stand.y);
      if (dist(a, c) < USE_RANGE * 1.2) ctx.use = { kind: 'faceid', station: fid, label: 'Face ID' };
    }
    if (!ctx.use && a.alive && a.dept === 'artist' && a.role === 'crew') {
      const cc = station('colorcheck');
      const c = tileCenter(cc.stand.x, cc.stand.y);
      if (dist(a, c) < USE_RANGE * 1.2) ctx.use = { kind: 'colorcheck', station: cc, label: 'So màu' };
    }
    if (!ctx.use) {
      const cam = station('camera');
      const c = tileCenter(cam.stand.x, cam.stand.y);
      if (dist(a, c) < USE_RANGE * 1.3) ctx.use = { kind: 'camera', station: cam, label: 'Xem camera' };
    }
    if (!ctx.use && a.alive) {
      if (Math.abs(a.x - BELL.x * TILE) < 4.2 * TILE && Math.abs(a.y - BELL.y * TILE) < 3.3 * TILE) ctx.use = { kind: 'bell', label: 'Bấm chuông họp' };
    }
    return this.finishContext(a, ctx);
  }

  private finishContext(a: Agent, ctx: Ctx): Ctx {
    if (a.alive) {
      for (const b of this.bodies) if (dist(a, b) < REPORT_RANGE) { ctx.report = b; break; }
    }
    if (this.canKill(a)) {
      let best: Agent | null = null, bd = KILL_RANGE;
      for (const o of this.agents) {
        if (o === a || !o.alive || o.hidden !== null || (a.role === 'impostor' && o.role === 'impostor')) continue;
        const d = dist(a, o);
        if (d < bd) { bd = d; best = o; }
      }
      ctx.kill = best;
    }
    if (this.canHide(a)) {
      for (let i = 0; i < HIDE_SPOTS.length; i++) {
        const h = HIDE_SPOTS[i];
        if (h.id.startsWith('tm_shaft')) continue; // cửa kỹ thuật giếng thang chỉ là lối ra
        if (dist(a, tileCenter(h.x, h.y)) < USE_RANGE) { ctx.hide = i; break; }
      }
    }
    return ctx;
  }

  // ---------- Hành động ----------
  completeTask(a: Agent, stationId: string) {
    const t = a.tasks.find(t => !t.done && slotStation(t) === stationId);
    if (!t) return;
    t.step++;
    if (t.step >= taskDef(t.taskId).steps.length) {
      t.done = true;
      if (a.role === 'crew' && a.dept === 'admin') a.adminBattery = Math.min(ADMIN_BATTERY, a.adminBattery + 5);
    }
    this.events.push({ type: 'task', agent: a.id, stationId });
    this.checkWin();
  }

  tryKill(killer: Agent, victim: Agent): boolean {
    if (this.phase !== 'play') return false;
    if (!this.canKill(killer) || killer.killCd > 0) return false;
    if (!victim.alive || victim === killer || victim.hidden !== null) return false;
    if (killer.role === 'impostor' && victim.role === 'impostor') return false;
    if (dist(killer, victim) > KILL_RANGE + 4) return false;
    // Developer đã backup người này: bẫy thất bại âm thầm, nạn nhân không hề biết
    const dev = this.agents.find(o => o.role === 'crew' && o.dept === 'developer' && o.devBackup === victim.id && !o.devUsed);
    if (dev) {
      dev.devUsed = true;
      killer.killCd = this.killCdBase;
      killer.brain.targetId = null;
      this.events.push({ type: 'backup_used', killer: killer.id, victim: victim.id, dev: dev.id });
      return false;
    }
    victim.alive = false;
    { const lv = levelAt(victim.x, victim.y); victim.ghostLv = lv >= 0 ? lv : 2; }
    victim.brain.path = [];
    victim.deathRoom = roomAt(victim.x, victim.y);
    victim.killedBy = killer.id;
    // Sound Engineer bị gài bẫy: loa hú, mọi người thấy mũi tên chỉ tới ghế trống
    if (victim.role === 'crew' && victim.dept === 'sound') {
      this.noises.push({ victim: victim.id, x: victim.x, y: victim.y, left: NOISE_TIME });
      this.events.push({ type: 'noise', victim: victim.id, x: victim.x, y: victim.y });
    }
    this.bodies.push({ victim: victim.id, x: victim.x, y: victim.y, room: roomAt(victim.x, victim.y), t: this.time });
    // Intern tham vọng gài trúng Nội gián thì hồi chiêu reset ngay
    killer.killCd = killer.role === 'impostor' ? this.killCdBase : victim.role === 'impostor' ? 0 : CLIMBER_CD;
    killer.x = victim.x; killer.y = victim.y + 2;
    this.events.push({ type: 'kill', killer: killer.id, victim: victim.id, x: victim.x, y: victim.y });
    // Nhân chứng
    for (const o of this.agents) {
      if (!o.alive || o === killer || o.role !== 'crew' || o.human) continue;
      const viaCam = o.dept === 'it' && o.itCamT > 0 && this.inCamera(killer.x, killer.y);
      if (this.sees(o, killer) || viaCam) {
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
    this.startMeeting(a.id, null, via);
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
      this.clearDoors();
      for (const a of this.agents) a.bossDone = false;
    }
    // Chọn bot đi sửa
    if (kind !== 'boss') {
      const st = station(kind === 'wifi' ? 'router' : 'power');
      const c = tileCenter(st.stand.x, st.stand.y);
      const crewBots = this.agents.filter(a => !(a.isPlayer || a.human) && a.alive && a.role === 'crew')
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

  canHide(a: Agent) { return a.alive && (a.role === 'impostor' || (a.role === 'crew' && (a.dept === 'engineer' || a.dept === 'climber'))); }
  engineerBlocked(a: Agent): string | null {
    if (a.role === 'crew' && a.dept === 'engineer' && a.hidden === null && a.engCd > 0) return `Chỗ trốn hồi chiêu ${Math.ceil(a.engCd)} giây`;
    return null;
  }
  hide(a: Agent, spot: number | null) {
    if (!this.canHide(a)) return;
    const eng = a.role === 'crew' && a.dept === 'engineer';
    if (spot === null) {
      if (eng && a.hidden !== null) { a.engCd = ENG_CD; a.engHideT = 0; }
      if (a.hidden !== null) this.events.push({ type: 'vent', spot: a.hidden });
      a.hidden = null; return;
    }
    if (eng && a.hidden === null && this.engineerBlocked(a)) return;
    // Nắp chỉ bật khi chui vào từ bên ngoài; đang ở trong mà chuồn sang chỗ khác thì im lặng
    if (a.hidden === null) this.events.push({ type: 'vent', spot });
    if (eng && a.hidden === null) a.engHideT = 0;
    a.hidden = spot;
    if (eng && this.agents.some(o => o !== a && o.role === 'impostor' && o.hidden === spot)) this.events.push({ type: 'eng_sense', agent: a.id, spot });
    const c = tileCenter(HIDE_SPOTS[spot].x, HIDE_SPOTS[spot].y);
    a.x = c.x; a.y = c.y;
  }

  /** Chuồn sang chỗ trốn cùng cặp */
  hideMove(a: Agent) {
    if (a.hidden === null) return;
    const to = this.pairOf(a.hidden);
    if (to < 0) return;
    this.hide(a, to);
  }

  /** Chỗ trốn bên kia. Nắp trần thang máy nối với cửa kỹ thuật giếng thang ở tầng buồng thang đang đứng (hoặc gần nhất nếu đang kẹt) */
  pairOf(spot: number): number {
    const h = HIDE_SPOTS[spot];
    if (h.pair >= 0) return h.pair;
    const near = Math.round(this.lift.pos);
    if (h.id === 'tm_hatch') return HIDE_SPOTS.findIndex(x => x.id === `tm_shaft${near}`);
    // Cửa kỹ thuật chỉ là lối ra (không chui ngược vào nóc thang)
    return -1;
  }

  // ---------- Khóa cửa ----------
  doorLocks = new Map<RoomId, number>();
  doorCd = new Map<RoomId, number>();

  doorBlocked(by: Agent, room: RoomId): string | null {
    if (this.phase !== 'play') return 'Không thể lúc này';
    if (by.role !== 'impostor') return 'Chỉ Nội gián mới khóa cửa được';
    if (!LOCKABLE_ROOMS.includes(room)) return 'Không khóa được phòng này';
    if (this.sabotage?.kind === 'boss') return 'Sếp đang đi tuần, không khóa cửa được';
    if (this.doorLocks.has(room)) return 'Cửa phòng này đang khóa';
    const cd = this.doorCd.get(room) ?? 0;
    if (cd > 0) return `Cửa phòng này hồi chiêu ${Math.ceil(cd)} giây`;
    return null;
  }

  lockDoors(by: Agent, room: RoomId): string | null {
    const err = this.doorBlocked(by, room);
    if (err) return err;
    this.doorLocks.set(room, DOOR_TIME);
    this.doorCd.set(room, DOOR_CD + DOOR_TIME);
    this.applyDoorBlocks();
    // Ai đang đứng ngay khung cửa thì bị đẩy ra ô trống gần nhất
    for (const a of this.agents) if (a.alive && !canStand(a.x, a.y)) this.nudge(a);
    for (const a of this.agents) a.brain.path = a.brain.path.length ? [] : a.brain.path;
    this.events.push({ type: 'doors', room, locked: true, by: by.id });
    return null;
  }

  unlockDoors(room: RoomId, by: Agent | null) {
    if (!this.doorLocks.has(room)) return;
    this.doorLocks.delete(room);
    this.applyDoorBlocks();
    this.events.push({ type: 'doors', room, locked: false, by: by ? by.id : null });
  }

  private applyDoorBlocks() {
    DOOR_BLOCK.fill(0);
    for (const [room] of this.doorLocks) for (const idx of DOOR_GROUPS.get(room) ?? []) DOOR_BLOCK[idx] = 1;
  }

  private nudge(a: Agent) {
    const tx = Math.floor(a.x / TILE), ty = Math.floor(a.y / TILE);
    for (let r = 1; r < 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const c = tileCenter(tx + dx, ty + dy);
      if (isFloor(tx + dx, ty + dy) && canStand(c.x, c.y)) { a.x = c.x; a.y = c.y; return; }
    }
  }

  private doorTick(dt: number) {
    for (const [room, cd] of this.doorCd) { if (cd <= dt) this.doorCd.delete(room); else this.doorCd.set(room, cd - dt); }
    for (const [room, t] of this.doorLocks) {
      if (t <= dt) this.unlockDoors(room, null); else this.doorLocks.set(room, t - dt);
    }
  }

  private clearDoors() {
    for (const [room] of [...this.doorLocks]) this.unlockDoors(room, null);
  }

  // ---------- Năng lực phòng ban ----------
  /** Lý do chưa dùng được máy Face ID (null = dùng được) */
  faceIdBlocked(a: Agent): string | null {
    if (a.dept !== 'hr' || a.role !== 'crew' || !a.alive) return 'Chỉ HR mới dùng được máy này';
    if (a.hrUsed) return 'Bạn đã dùng Face ID trong ván này';
    const wait = this.faceIdUnlockIn();
    if (wait > 0) return `Máy Face ID mở sau ${Math.ceil(wait)} giây nữa (hoặc ngay sau cuộc họp đầu tiên)`;
    if (this.sabotage?.kind === 'wifi') return 'Mất mạng, máy Face ID không kết nối được';
    if (this.sabotage?.kind === 'power') return 'Mất điện, máy Face ID không hoạt động';
    return null;
  }

  /** Còn bao nhiêu giây nữa máy Face ID mới mở (0 = đã mở) */
  faceIdUnlockIn(): number {
    if (this.meetingCount >= 1) return 0;
    return Math.max(0, HR_UNLOCK - this.time);
  }

  /** HR gửi yêu cầu Face ID: kết quả về sau HR_WAIT giây chơi */
  startFaceId(a: Agent, target: number) {
    if (this.faceIdBlocked(a)) return;
    a.hrUsed = true;
    a.hrScanning = false;
    a.hrPending = { target, left: HR_WAIT };
    this.events.push({ type: 'hr_sent', agent: a.id, target });
  }

  revealDirector(a: Agent) {
    const m = this.meeting;
    if (!m || m.result || a.dept !== 'director' || a.role !== 'crew' || !a.alive || a.directorRevealed) return;
    a.directorRevealed = true;
    m.chat.push({ from: a.id, text: `✅ Hệ thống xác nhận: ${a.name} là Director. Phiếu bầu tính gấp đôi.`, t: m.t, system: true });
    for (const l of this.agents) if (l !== a) l.brain.sus.set(a.id, -200);
    // Nội gián sẽ nhắm vào Director
    for (const l of this.agents) if (l.role === 'impostor') l.brain.hrTarget = l.brain.hrTarget ?? a.id;
    this.events.push({ type: 'director_reveal', agent: a.id });
  }

  // ----- Product Owner -----
  poBlocked(a: Agent): string | null {
    if (a.dept !== 'po' || a.role !== 'crew' || !a.alive) return 'Chỉ Product Owner mới có nút này';
    if (a.poUsed) return 'Bạn đã dùng quyền họp gấp trong ván này';
    if (this.phase !== 'play') return 'Không thể lúc này';
    if (this.sabotage?.kind === 'boss') return 'Sếp đang đi tuần, không gọi họp được';
    return null;
  }
  poCall(a: Agent): string | null {
    const err = this.poBlocked(a);
    if (err) return err;
    a.poUsed = true; a.poRevealed = true;
    this.startMeeting(a.id, null, 'po');
    const m = this.meeting!;
    m.chat.push({ from: a.id, text: `✅ Hệ thống xác nhận: ${a.name} #${a.empId} là Product Owner và vừa triệu tập họp gấp.`, t: 0, system: true });
    for (const l of this.agents) if (l !== a) { l.brain.sus.set(a.id, -200); l.brain.cleared.add(a.id); }
    for (const l of this.agents) if (l.role === 'impostor') l.brain.hrTarget = l.brain.hrTarget ?? a.id;
    return null;
  }

  // ----- Producer -----
  protectBlocked(a: Agent, target: number): string | null {
    const m = this.meeting;
    if (!m || m.result) return 'Chỉ bảo lãnh được trong cuộc họp';
    if (a.dept !== 'producer' || a.role !== 'crew' || !a.alive) return 'Chỉ Producer mới bảo lãnh được';
    if (!this.agents[target]?.alive) return 'Người này không còn trong ván';
    if (a.prodLast === target) return 'Không được bảo lãnh cùng một người hai cuộc họp liên tiếp';
    return null;
  }
  setProtect(a: Agent, target: number | null): string | null {
    const m = this.meeting;
    if (target === null) { if (m && !m.result && a.dept === 'producer') m.protect = null; return null; }
    const err = this.protectBlocked(a, target);
    if (err) return err;
    m!.protect = target;
    return null;
  }

  // ----- Developer -----
  setBackup(a: Agent, target: number): string | null {
    if (a.dept !== 'developer' || a.role !== 'crew') return 'Chỉ Developer mới backup được';
    if (target === a.id) return 'Không được backup chính mình';
    if (this.meetingCount > 0 || this.time > 1) return 'Chỉ chọn được lúc đầu ca';
    a.devBackup = target;
    return null;
  }

  // ----- Artist -----
  /** Nhóm màu trên người một nhân vật (tóc, da/skin, áo, quần, phụ kiện đổi màu được) */
  lookGroups(look: Look): Set<string> {
    const out = new Set<string>();
    const add = (c: string) => { if (c && c.startsWith('#')) out.add(colorGroupOf(c)); };
    const body = bodyDef(look.body);
    for (const c of colors2(look.bodyColor)) add(c);
    if (body.human) {
      if (look.hairStyle !== 'bald') add(look.hair);
      for (const sl of SLOTS) {
        const it = look.items[sl];
        if (it.id === 'none') continue;
        const d = itemDef(sl, it.id);
        if (d.color === 'fixed' || !it.color) continue;
        for (const c of colors2(it.color)) add(c);
      }
    }
    return out;
  }
  /** Các nhóm màu đang xuất hiện trên người ai đó trong ván */
  groupsInGame(): string[] {
    const s = new Set<string>();
    for (const a of this.agents) for (const g of this.lookGroups(a.look)) s.add(g);
    return COLOR_GROUPS.map(g => g.id).filter(id => s.has(id));
  }
  artistBlocked(a: Agent): string | null {
    if (a.dept !== 'artist' || a.role !== 'crew' || !a.alive) return 'Chỉ Artist mới dùng được máy so màu';
    if (this.meetingCount < a.artistNext) {
      const n = a.artistNext - this.meetingCount;
      return a.artistNext === 1 ? 'Máy so màu mở sau cuộc họp đầu tiên' : `Máy so màu mở lại sau ${n} cuộc họp nữa`;
    }
    if (this.sabotage?.kind === 'power') return 'Mất điện, máy so màu không hoạt động';
    return null;
  }
  artistCheck(a: Agent, group: string): string | null {
    const err = this.artistBlocked(a);
    if (err) return err;
    const has = this.agents.some(o => o.role === 'impostor' && o.alive && this.lookGroups(o.look).has(group));
    a.artistNext = this.meetingCount + 2;
    a.artistResults.push({ group, has });
    // Artist tự suy luận
    for (const o of this.agents) {
      if (o === a || !o.alive) continue;
      const hasIt = this.lookGroups(o.look).has(group);
      if (!hasIt) continue;
      if (has) a.brain.sus.set(o.id, (a.brain.sus.get(o.id) ?? 0) + 14);
      else { a.brain.sus.set(o.id, Math.min(0, (a.brain.sus.get(o.id) ?? 0) - 20)); }
    }
    this.events.push({ type: 'artist_result', agent: a.id, group, has });
    return null;
  }

  // ----- Thang máy (một buồng duy nhất, chạy như thang máy thật) -----
  liftCapacity = 4;
  liftPry = true;
  liftUse = 0.45; // tỉ lệ bot chọn thang máy khi đổi tầng
  liftStats = { plans: 0, boards: 0, arrive: 0, giveupWait: 0, giveupOther: 0, crossTrips: 0 };
  lift = { pos: 2, dir: 0, target: null as number | null, open: true, doorT: LIFT_DOOR_TIME, requests: new Set<number>(), stuck: false, stuckT: 0, rescueFloor: null as number | null };

  /** Người đang ở trong buồng thang */
  liftRiders(): Agent[] {
    return this.agents.filter(a => a.alive && levelAt(a.x, a.y) === 0);
  }
  /** Tầng buồng thang đang dừng (null nếu đang chạy giữa hai tầng) */
  liftFloor(): number | null { return Math.abs(this.lift.pos - Math.round(this.lift.pos)) < 0.01 ? Math.round(this.lift.pos) : null; }
  liftCall(floor: number) {
    if (!LIFT_FLOORS.includes(floor) || this.lift.stuck) return;
    if (this.liftFloor() === floor && this.lift.open) { this.lift.doorT = Math.max(this.lift.doorT, LIFT_DOOR_TIME); return; }
    this.lift.requests.add(floor);
  }
  /** Cửa thang ở tầng này đang mở (đi vào / ra được) */
  liftOpenAt(floor: number): boolean {
    if (this.lift.rescueFloor === floor) return true;
    return this.lift.open && this.liftFloor() === floor;
  }
  private liftTick(dt: number) {
    const L = this.lift;
    const powerOut = this.sabotage?.kind === 'power';
    // Mất điện: cửa đóng và khóa ngay, ai trong buồng bị nhốt, ngoài không vào được
    if (powerOut && !L.stuck) { L.stuck = true; L.stuckT = 0; L.open = false; }
    if (!powerOut && L.stuck) {
      L.stuck = false; L.stuckT = 0; L.rescueFloor = null;
      if (L.target === null && this.liftFloor() !== null) { L.open = true; L.doorT = LIFT_DOOR_TIME; } // có điện lại: mở cửa thả người ra
    }
    if (L.stuck) { L.stuckT += dt; this.applyLiftBlocks(); return; }
    if (L.open) {
      L.doorT -= dt;
      if (L.doorT <= 0 && L.requests.size) L.open = false;
      if (L.doorT <= 0 && !L.requests.size) L.doorT = 0; // không ai gọi thì cứ mở cửa đứng chờ
    } else if (L.target === null) {
      // Chọn tầng tiếp theo: ưu tiên theo chiều đang chạy, như thang máy thật
      const reqs = [...L.requests];
      const ahead = reqs.filter(f => L.dir >= 0 ? f > L.pos : f < L.pos).sort((p, q) => Math.abs(p - L.pos) - Math.abs(q - L.pos));
      const next = ahead[0] ?? reqs.sort((p, q) => Math.abs(p - L.pos) - Math.abs(q - L.pos))[0];
      if (next === undefined) { /* đứng yên */ }
      else if (Math.abs(next - L.pos) < 0.01) { L.requests.delete(next); L.open = true; L.doorT = LIFT_DOOR_TIME; }
      else { L.target = next; L.dir = next > L.pos ? 1 : -1; }
    } else {
      L.pos += L.dir * dt / LIFT_FLOOR_TIME;
      if ((L.dir > 0 && L.pos >= L.target) || (L.dir < 0 && L.pos <= L.target)) {
        L.pos = L.target; L.requests.delete(L.target); L.target = null;
        L.open = true; L.doorT = LIFT_DOOR_TIME;
        this.events.push({ type: 'lift_arrive', floor: L.pos });
      }
    }
    this.applyLiftBlocks();
  }
  private applyLiftBlocks() {
    for (const ld of LIFT_DOORS) for (const t of ld.tiles) ELEV_BLOCK[t.y * MAP_W + t.x] = this.liftOpenAt(ld.level) && this.liftRiders().length < this.liftCapacity ? 0 : 1;
    const anyOpen = this.lift.rescueFloor !== null || (this.lift.open && this.liftFloor() !== null);
    for (const t of CABIN_DOOR) ELEV_BLOCK[t.y * MAP_W + t.x] = anyOpen ? 0 : 1;
  }
  /** Đi qua cổng: cuối làn thang bộ, cửa thang máy ở tầng, cửa buồng thang */
  private portalTick(a: Agent, dt: number) {
    a.portalCd = Math.max(0, a.portalCd - dt);
    if (a.portalCd > 0 || a.hidden !== null) return;
    if (!a.alive) return; // hồn ma bay qua cửa thang bộ và thang máy như qua tường; đổi tầng chỉ bằng nút riêng
    const tx = Math.floor(a.x / TILE), ty = Math.floor(a.y / TILE), idx = ty * MAP_W + tx;
    const portal = PORTAL_AT.get(idx);
    if (portal) { this.teleport(a, portal.to.x + 0.5, portal.to.y + 0.5); return; }
    if (!a.alive) return; // hồn ma không đi thang máy
    for (const ld of LIFT_DOORS) {
      if (!ld.tiles.some(t => t.x === tx && t.y === ty) || !this.liftOpenAt(ld.level)) continue;
      if (this.liftRiders().length >= this.liftCapacity) { this.teleport(a, ld.front.x + 0.5, ld.front.y + 0.5); return; } // đầy người
      this.teleport(a, CABIN.x + 1.5 + (a.id % 2), CABIN.y + 0.6);
      return;
    }
    if (CABIN_DOOR.some(t => t.x === tx && t.y === ty)) {
      const f = this.lift.rescueFloor ?? this.liftFloor();
      if (f === null) return;
      const ld = LIFT_DOORS.find(l => l.level === f)!;
      this.teleport(a, ld.front.x + 0.5, ld.front.y + 0.4);
    }
  }
  private teleport(a: Agent, tx: number, ty: number) {
    a.x = tx * TILE; a.y = ty * TILE;
    a.portalCd = 0.7; a.lastPortal = this.time;
    // Bỏ các điểm trên lộ trình cho tới điểm vừa dịch chuyển tới (kể cả cổng ở tầng cũ)
    const p = a.brain.path;
    const k = p.findIndex(pt => Math.hypot(pt.x - a.x, pt.y - a.y) < 30);
    a.brain.path = k >= 0 ? p.slice(k + 1) : p.filter(pt => levelAt(pt.x, pt.y) === levelAt(a.x, a.y));
  }
  /** Bảng nút trong buồng thang: chọn tầng */
  liftPress(a: Agent, floor: number): string | null {
    if (levelAt(a.x, a.y) !== 0) return 'Bạn không ở trong thang máy';
    if (this.lift.stuck) return 'Mất điện, thang máy đang kẹt!';
    this.liftCall(floor);
    if (this.lift.open && this.liftFloor() !== floor) this.lift.doorT = Math.min(this.lift.doorT, 1); // bấm tầng: 1 giây sau cửa đóng
    return null;
  }
  /** Cạy cửa khi kẹt lâu: ra tầng gần nhất */
  pryBlocked(a: Agent): string | null {
    if (!this.liftPry) return 'Không cạy được cửa';
    if (levelAt(a.x, a.y) !== 0 || !a.alive) return 'Bạn không ở trong thang máy';
    if (!this.lift.stuck) return 'Thang máy không kẹt';
    if (this.lift.stuckT < PRY_AFTER) return `Cửa còn khóa chặt, thử lại sau ${Math.ceil(PRY_AFTER - this.lift.stuckT)} giây`;
    return null;
  }
  pryOut(a: Agent): string | null {
    const err = this.pryBlocked(a);
    if (err) return err;
    const ld = LIFT_DOORS.find(l => l.level === Math.round(this.lift.pos))!;
    this.teleport(a, ld.front.x + 0.5, ld.front.y + 0.4);
    this.events.push({ type: 'lift_pry', agent: a.id });
    return null;
  }
  /** Engineer mở cửa thang đang kẹt từ bên ngoài (ở tầng gần buồng nhất) */
  rescueBlocked(a: Agent): string | null {
    if (a.role !== 'crew' || a.dept !== 'engineer' || !a.alive) return 'Chỉ Engineer mới mở được cửa thang';
    if (!this.lift.stuck) return 'Thang máy không kẹt';
    const near = Math.round(this.lift.pos);
    const ld = LIFT_DOORS.find(l => l.level === near)!;
    if (dist(a, { x: (ld.front.x + 0.5) * TILE, y: (ld.front.y + 0.5) * TILE }) > 2 * TILE) return `Buồng thang đang kẹt gần ${near === 0 ? '' : 'tầng ' + near}`;
    return null;
  }
  liftRescue(a: Agent): string | null {
    const err = this.rescueBlocked(a);
    if (err) return err;
    this.lift.rescueFloor = Math.round(this.lift.pos);
    this.applyLiftBlocks();
    this.events.push({ type: 'lift_rescue', agent: a.id });
    return null;
  }

  // ----- Sound Engineer -----
  noises: { victim: number; x: number; y: number; left: number }[] = [];

  // ----- Admin -----
  adminBlocked(a: Agent): string | null {
    if (a.dept !== 'admin' || a.role !== 'crew' || !a.alive) return 'Chỉ Admin mới có Bảng chấm công';
    if (this.sabotage?.kind === 'wifi') return 'Rớt mạng, Bảng chấm công không tải được';
    if (a.adminBattery <= 0.05) return 'Hết pin: làm xong việc để sạc thêm';
    if (a.adminCd > 0) return `Bảng chấm công mở lại sau ${Math.ceil(a.adminCd)} giây`;
    return null;
  }
  adminOpen(a: Agent): string | null {
    if (a.adminViewing) return null;
    const err = this.adminBlocked(a);
    if (err) return err;
    a.adminViewing = true;
    return null;
  }
  adminClose(a: Agent) {
    if (!a.adminViewing) return;
    a.adminViewing = false;
    a.adminCd = ADMIN_CD;
  }
  /** Trạng thái từng người trên Bảng chấm công */
  vitals(): { id: number; status: 'alive' | 'dead' | 'ejected' }[] {
    return this.agents.map(o => ({ id: o.id, status: o.alive ? 'alive' : o.ejected ? 'ejected' : 'dead' }));
  }

  // ----- Animator -----
  /** Những người có thể "làm lại anim": đã bị gài bẫy (không phải bị sa thải) */
  reviveCandidates(a: Agent): Agent[] {
    return this.agents.filter(o => o !== a && !o.alive && !o.ejected && o.killedBy !== null && a.knownDead.includes(o.id));
  }
  animatorBlocked(a: Agent): string | null {
    if (a.dept !== 'animator' || a.role !== 'crew' || !a.alive) return 'Chỉ Animator mới làm lại anim được';
    if (a.animUsed) return 'Bạn đã làm lại anim trong ván này';
    if (this.phase !== 'play') return 'Không thể lúc này';
    if (!this.reviveCandidates(a).length) return 'Chưa biết ai nghỉ việc: thấy ghế trống hoặc vào họp mới biết';
    return null;
  }
  animatorRevive(a: Agent, target: number): string | null {
    const err = this.animatorBlocked(a);
    if (err) return err;
    const t = this.agents[target];
    if (!this.reviveCandidates(a).includes(t)) return 'Không làm lại được người này';
    a.animUsed = true;
    // Đổi mạng: Animator thành ghế trống tại chỗ, người kia sống lại đúng chỗ đó
    this.bodies = this.bodies.filter(b => b.victim !== t.id);
    t.alive = true; t.killedBy = null; t.hidden = null;
    t.x = a.x; t.y = a.y; t.brain.path = []; t.brain.goal = null;
    a.alive = false; a.hidden = null; a.killedBy = a.id; a.deathRoom = roomAt(a.x, a.y);
    { const lv = levelAt(a.x, a.y); a.ghostLv = lv >= 0 ? lv : 2; }
    this.bodies.push({ victim: a.id, x: a.x, y: a.y, room: roomAt(a.x, a.y), t: this.time });
    this.events.push({ type: 'revive', animator: a.id, target: t.id });
    this.checkWin();
    return null;
  }

  // ----- Tester -----
  testerTargets(a: Agent): Agent[] {
    return this.agents.filter(o => o !== a && o.alive && o.hidden === null && dist(a, o) <= TEST_RANGE).sort((p, q) => dist(a, p) - dist(a, q));
  }
  testerBlocked(a: Agent): string | null {
    if (a.dept !== 'tester' || a.role !== 'crew' || !a.alive) return 'Chỉ Tester mới viết testcase được';
    if (a.testUsed) return 'Vòng này bạn đã viết testcase rồi, đợi cuộc họp sau';
    if (this.phase !== 'play') return 'Không thể lúc này';
    return null;
  }
  testerTag(a: Agent, target: number): string | null {
    const err = this.testerBlocked(a);
    if (err) return err;
    const t = this.agents[target];
    if (!t?.alive || dist(a, t) > TEST_RANGE * 1.5) return 'Người đó đã đi xa';
    a.testUsed = true; a.testTarget = t.id;
    a.testLog = [{ room: this.placeName(t), t: this.time }];
    a.testLast = { x: t.x, y: t.y };
    this.events.push({ type: 'test_tag', tester: a.id, target: t.id });
    return null;
  }
  private placeName(t: Agent) {
    const lv = levelAt(t.x, t.y);
    const lvn = lv === 0 ? '' : lv === 4 ? '' : `Tầng ${lv}: `;
    return lvn + roomName(roomAt(t.x, t.y));
  }
  /** Ghi lộ trình của người bị gắn test case */
  private testerTick() {
    for (const a of this.agents) {
      if (a.dept !== 'tester' || a.testTarget === null) continue;
      const t = this.agents[a.testTarget];
      if (!t.alive) continue;
      const place = this.placeName(t);
      // Chui chỗ trốn: dịch chuyển tức thời. Đi thang bộ / thang máy là đổi tầng hợp lệ, không tính
      const jump = !!a.testLast && Math.hypot(t.x - a.testLast.x, t.y - a.testLast.y) > 4 * TILE && this.time - t.lastPortal > 0.3;
      a.testLast = { x: t.x, y: t.y };
      const last = a.testLog[a.testLog.length - 1];
      if (!last || last.room !== place || jump) a.testLog.push({ room: place, t: this.time, jump: jump || undefined });
    }
  }
  /** Nội dung log gửi riêng cho Tester khi bắt đầu họp */
  testerReport(a: Agent): string | null {
    if (a.testTarget === null) return null;
    const t = this.agents[a.testTarget];
    const path = a.testLog.slice(-10).map(e => `${e.jump ? '⚡' : ''}${e.room} (${Math.floor(e.t / 60)}:${String(Math.floor(e.t % 60)).padStart(2, '0')})`).join(' → ');
    const jumps = a.testLog.filter(e => e.jump).length;
    return `🧪 Log testcase (chỉ mình bạn thấy): ${t.name} #${t.empId}: ${path}${jumps ? ` · ⚠️ ${jumps} bước dịch chuyển bất thường!` : ''}`;
  }

  // ----- Intern tham vọng -----
  anonBlocked(a: Agent): string | null {
    if (a.dept !== 'climber' || a.role !== 'crew' || !a.alive) return 'Chỉ Intern tham vọng mới dùng được';
    if (a.anonUsed) return 'Bạn đã tố cáo nặc danh trong ván này';
    if (!this.meeting || this.meeting.result) return 'Chỉ dùng được trong cuộc họp';
    return null;
  }
  anonAccuse(a: Agent, target: number): string | null {
    const err = this.anonBlocked(a);
    if (err) return err;
    const t = this.agents[target];
    if (!t?.alive || t === a) return 'Chọn người khác';
    a.anonUsed = true;
    const m = this.meeting!;
    m.chat.push({ from: a.id, text: `"${t.name} #${t.empId} là Nội gián!"`, t: m.t, system: true, anon: true }); // không lộ người gửi
    for (const l of this.agents) if (l.alive && l !== t && !l.brain.cleared.has(t.id)) l.brain.sus.set(t.id, (l.brain.sus.get(t.id) ?? 0) + 14);
    this.events.push({ type: 'anon_accuse', by: a.id, target });
    return null;
  }

  // ----- Truyền thông (hồn ma) -----
  mediaBlocked(a: Agent): string | null {
    if (a.dept !== 'media' || a.role !== 'crew') return 'Chỉ Truyền thông mới liên lạc được';
    if (a.alive) return 'Truyền thông chỉ liên lạc được khi đã thành hồn ma';
    if (this.phase !== 'play') return 'Không thể lúc này';
    if (a.mediaCd > 0) return `Chờ ${Math.ceil(a.mediaCd)} giây nữa`;
    return null;
  }
  mediaTargets(a: Agent): Agent[] {
    return this.agents.filter(o => o.alive && o !== a && dist(a, o) <= MEDIA_RANGE).sort((p, q) => dist(a, p) - dist(a, q));
  }
  mediaSend(a: Agent, to: number, stickers: number[]): string | null {
    const err = this.mediaBlocked(a);
    if (err) return err;
    const t = this.agents[to];
    if (!t?.alive || dist(a, t) > MEDIA_RANGE * 2.5) return 'Người nhận đã đi quá xa, lại gần rồi gửi lại';
    stickers = stickers.filter(i => i >= 0 && i < STICKERS.length);
    if (stickers.length < 1 || stickers.length > 3) return 'Chọn từ 1 đến 3 sticker';
    a.mediaCd = MEDIA_CD;
    t.stickerMsg = { stickers: [...stickers], until: this.time + 5 };
    this.events.push({ type: 'media_msg', from: a.id, to, stickers: [...stickers] });
    // Người nhận là bot: suy luận từ hình
    if (!t.human) {
      const rooms = stickers.map(i => STICKERS[i]).filter(x => x.room).map(x => x.room);
      const bad = stickers.some(i => ['🐍', '⚠️', '🤥', '🎭', '🕵️', '👀', '📂'].includes(STICKERS[i].e));
      for (const [id, seen] of t.brain.lastSeen) {
        if (!this.agents[id].alive || id === t.id) continue;
        if (rooms.includes(seen.room ?? undefined) && this.time - seen.t < 60) t.brain.sus.set(id, (t.brain.sus.get(id) ?? 0) + (bad ? 12 : 4));
      }
    }
    return null;
  }

  itBlocked(a: Agent): string | null {
    if (a.dept !== 'it' || a.role !== 'crew' || !a.alive) return 'Chỉ IT mới có laptop';
    if (this.sabotage?.kind === 'wifi') return 'Mất mạng, laptop không kết nối được camera';
    if (this.sabotage?.kind === 'power') return 'Mất điện, camera không hoạt động';
    if (a.itCd > 0) return `Laptop đang khởi động lại: ${Math.ceil(a.itCd)} giây`;
    return null;
  }

  useLaptop(a: Agent): boolean {
    if (this.itBlocked(a)) return false;
    a.itCamT = IT_CAM_TIME;
    a.itCd = IT_CD + IT_CAM_TIME;
    return true;
  }

  /** Người chơi đang xem camera (giao diện cập nhật) */
  /** Những người thật đang xem camera an ninh */
  watching = new Set<number>();
  get playerWatching() { return this.watching.has(this.meId); }
  set playerWatching(on: boolean) { if (on) this.watching.add(this.meId); else this.watching.delete(this.meId); }
  /** Có ai đang xem camera không: đèn đỏ trên mọi camera sẽ nhấp nháy */
  camsInUse(): boolean {
    if (this.sabotage?.kind === 'wifi' || this.sabotage?.kind === 'power') return false;
    return [...this.watching].some(id => this.agents[id]?.alive) || this.agents.some(a => a.alive && a.itCamT > 0);
  }

  inCamera(x: number, y: number) {
    return CAMERAS.some(c => x >= c.x * TILE && x < (c.x + c.w) * TILE && y >= c.y * TILE && y < (c.y + c.h) * TILE);
  }

  private abilityTick(dt: number) {
    for (const n of this.noises) n.left -= dt;
    this.noises = this.noises.filter(n => n.left > 0);
    for (const a of this.agents) {
      a.adminCd = Math.max(0, a.adminCd - dt);
      a.engCd = a.hidden === null ? Math.max(0, a.engCd - dt) : a.engCd;
      a.mediaCd = Math.max(0, a.mediaCd - dt);
      if (a.adminViewing) {
        a.adminBattery = Math.max(0, a.adminBattery - dt);
        if (a.adminBattery <= 0 || this.sabotage?.kind === 'wifi' || !a.alive) this.adminClose(a);
      }
      if (a.role === 'crew' && a.dept === 'engineer' && a.hidden !== null) {
        a.engHideT += dt;
        if (a.engHideT >= ENG_HIDE_MAX) this.hide(a, null);
      }
      if (a.stickerMsg && this.time > a.stickerMsg.until) a.stickerMsg = null;
      a.itCd = Math.max(0, a.itCd - dt);
      a.itCamT = Math.max(0, a.itCamT - dt);
      if (this.sabotage?.kind === 'wifi' || this.sabotage?.kind === 'power') a.itCamT = 0;
      if (a.hrPending) {
        a.hrPending.left -= dt;
        if (a.hrPending.left <= 0) {
          const t = a.hrPending.target;
          a.hrPending = null;
          // HR bị gài bẫy trước khi có kết quả: kết quả mất theo
          if (a.alive) {
            a.hrResult = { target: t, imp: this.agents[t].role === 'impostor' || this.agents[t].dept === 'climber' };
            if (a.hrResult.imp) a.brain.sus.set(t, 500); else { a.brain.sus.set(t, -200); a.brain.cleared.add(t); }
            this.events.push({ type: 'hr_result', agent: a.id, target: t, imp: a.hrResult.imp });
          }
        }
      }
    }
  }

  // ---------- Vòng lặp ----------
  update(dt: number) {
    if (this.phase === 'meeting') { this.updateMeeting(dt); return; }
    if (this.phase !== 'play') return;
    this.time += dt;
    this.sabCd = Math.max(0, this.sabCd - dt);
    this.emergencyCd = Math.max(0, this.emergencyCd - dt);
    for (const a of this.agents) if (a.hidden === null) a.killCd = Math.max(0, a.killCd - dt);
    this.abilityTick(dt);
    this.doorTick(dt);
    this.liftTick(dt);
    for (const a of this.agents) this.portalTick(a, dt);
    this.testerTick();
    // Animator biết ai đã nghỉ việc khi tận mắt thấy ghế trống
    for (const a of this.agents) {
      if (a.dept !== 'animator' || a.role !== 'crew' || !a.alive) continue;
      for (const bd of this.bodies) if (!a.knownDead.includes(bd.victim) && this.sees(a, bd, 20)) a.knownDead.push(bd.victim);
    }

    if (this.sabotage?.kind === 'boss') {
      this.sabotage.t -= dt;
      if (this.sabotage.t <= 0) {
        const late = this.aliveCrew().filter(c => !c.bossDone);
        if (late.length) {
          this.endGame('impostor', fmt('win.impostor.boss', { names: late.map(l => l.name).join(', ') }));
          return;
        }
        this.fixSabotage(null);
      }
    }

    // Người thật: người chơi trên máy này dùng playerInput, người ở máy khác dùng inputs (nhận qua mạng)
    for (const h of this.agents) {
      if (!h.human) continue;
      const inp = h.id === this.meId ? this.playerInput : (this.inputs.get(h.id) ?? { x: 0, y: 0 });
      if (h.hidden === null) this.moveBy(h, inp.x, inp.y, dt);
      else h.moving = false;
    }
    // Bot
    for (const a of this.agents) {
      if (a.human) continue;
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
      // Hồn ma xuyên tường nhưng chỉ trong phạm vi tầng đang ở; đổi tầng bằng nút riêng (ghostFloor)
      const lv = levelAt(a.x, a.y);
      if (lv >= 0) a.ghostLv = lv;
      const r = ghostRegion(a.ghostLv);
      a.x = Math.max(r.x0, Math.min(r.x1, a.x + dx));
      a.y = Math.max(r.y0, Math.min(r.y1, a.y + dy));
    } else {
      if (canStand(a.x + dx, a.y)) a.x += dx;
      if (canStand(a.x, a.y + dy)) a.y += dy;
    }
    a.moving = true;
    a.walkT += dt;
  }

  /** Hồn ma đổi tầng: dir 1 lên, -1 xuống. Hiện ở vị trí tương ứng trên tầng mới. Trả về lỗi (nếu có) */
  ghostFloor(a: Agent, dir: 1 | -1): string | null {
    if (a.alive) return 'Chỉ hồn ma mới bay đổi tầng được';
    const cur = levelAt(a.x, a.y);
    let base = cur >= 1 && cur <= 4 ? cur : cur === 0 ? Math.round(this.lift.pos) : cur === STAIRS_LEVEL ? Math.max(1, Math.min(4, 4 - Math.floor((a.y / TILE - STAIRWELL.y) / 8))) : a.ghostLv;
    if (base < 1 || base > 4) base = 2;
    const target = base + dir;
    if (target < 1 || target > 4) return dir > 0 ? 'Đã ở tầng cao nhất' : 'Đã ở tầng thấp nhất';
    const F0 = FLOORS[base - 1], F1 = FLOORS[target - 1];
    const inFloor = cur === base;
    const relX = inFloor ? a.x - F0.ox * TILE : (F0.w / 2) * TILE, relY = inFloor ? a.y - F0.oy * TILE : 11.5 * TILE;
    const r = ghostRegion(target);
    const nx = Math.max(r.x0, Math.min(r.x1, F1.ox * TILE + relX)), ny = Math.max(r.y0, Math.min(r.y1, F1.oy * TILE + relY));
    this.teleport(a, nx / TILE, ny / TILE);
    a.ghostLv = target;
    return null;
  }

  private followPath(a: Agent, dt: number): boolean {
    const b = a.brain;
    if (b.lift && this.liftStep(a, dt)) return false;
    if (!b.path.length) { a.moving = false; return true; }
    const target = b.path[0];
    // Hồn ma: điểm kế tiếp ở tầng khác thì hiện luôn ở đó (không bay ngang qua tầng khác)
    if (!a.alive && levelAt(target.x, target.y) !== levelAt(a.x, a.y) && levelAt(target.x, target.y) >= 0) {
      this.teleport(a, target.x / TILE, target.y / TILE);
      b.path.shift();
      return true;
    }
    // Điểm kế tiếp ở tầng khác: đang đứng ở cổng, chờ dịch chuyển
    if (a.alive && levelAt(target.x, target.y) !== levelAt(a.x, a.y)) { a.moving = false; return false; }
    // Cửa vừa bị khóa chắn đường: bỏ lộ trình, lần sau tìm đường khác
    if (a.alive && !isFloor(Math.floor(target.x / TILE), Math.floor(target.y / TILE))) { b.path = []; a.moving = false; return false; }
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

  /** Bot đi thang máy: tới trước cửa, gọi thang, chờ, vào buồng, bấm tầng, ra khi tới nơi */
  private liftStep(a: Agent, dt: number): boolean {
    const b = a.brain, L = b.lift!;
    const lv = levelAt(a.x, a.y);
    L.t += dt;
    const giveUp = (why = 'other') => { if (why === 'wait') this.liftStats.giveupWait++; else if (why === 'arrive') this.liftStats.arrive++; else this.liftStats.giveupOther++; const to = L.to, goal = b.goal ?? 'wander'; b.lift = null; this.goTo(a, to, goal, true); return true; };
    if (L.stage === 'walk') {
      if (b.path.length) return false; // vẫn đang đi tới cửa thang: dùng đi bộ bình thường
      this.liftCall(lv); L.stage = 'wait'; L.t = 0;
    }
    if (L.stage === 'wait') {
      if (lv === 0) {
        this.liftStats.boards++;
        if (L.floor === 0) { const to = L.to, goal = b.goal ?? 'wander'; b.lift = null; const pf = findPath(a, to); b.path = pf ?? []; b.goal = goal; return true; }
        L.stage = 'ride'; L.t = 0; this.liftPress(a, L.floor); return true;
      }
      if (this.lift.stuck || L.t > 12) return giveUp('wait'); // chờ lâu quá thì đi thang bộ
      const ld = LIFT_DOORS.find(l => l.level === lv);
      if (ld && this.liftOpenAt(lv) && this.liftRiders().length < this.liftCapacity) {
        const door = ld.tiles[a.id % 2];
        const c = tileCenter(door.x, door.y);
        const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy), st = SPEED * 0.92 * dt;
        if (d > st) { a.x += dx / d * st; a.y += dy / d * st; a.moving = true; a.walkT += dt; } else { a.x = c.x; a.y = c.y; }
      } else { a.moving = false; if (!this.lift.requests.has(lv) && !this.liftOpenAt(lv)) this.liftCall(lv); }
      return true;
    }
    // Đang trong buồng
    if (lv !== 0) { if (lv === L.floor || L.t > 1) return giveUp(lv === L.floor ? 'arrive' : 'other'); return true; }
    if (this.lift.stuck) {
      if (!this.pryBlocked(a) && L.t > PRY_AFTER + PRY_TIME) this.pryOut(a);
      a.moving = false; return true;
    }
    if (this.liftFloor() === L.floor && this.lift.open) {
      const door = CABIN_DOOR[a.id % 2];
      const c = tileCenter(door.x, door.y);
      const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy), st = SPEED * 0.92 * dt;
      if (d > st) { a.x += dx / d * st; a.y += dy / d * st; a.moving = true; } else { a.x = c.x; a.y = c.y; }
    } else {
      a.moving = false;
      if (!this.lift.requests.has(L.floor) && this.liftFloor() !== L.floor) this.liftPress(a, L.floor);
    }
    return true;
  }

  private goTo(a: Agent, tile: Pt, goal: string, noLift = false): boolean {
    // Đổi tầng: đôi khi đi thang máy thay vì thang bộ
    const fromLv = levelAt(a.x, a.y), toLv = levelAt(tile.x * TILE + 24, tile.y * TILE + 24);
    if (fromLv !== toLv && a.alive) this.liftStats.crossTrips++;
    // Hồn ma: việc ở tầng khác thì hiện thẳng ở tầng đó (không đi cầu thang), rồi bay tới việc
    if (!a.alive && fromLv !== toLv) {
      if (toLv >= 1 && toLv <= 4 && fromLv >= 1 && fromLv <= 4) {
        const F0 = FLOORS[fromLv - 1], F1 = FLOORS[toLv - 1], r = ghostRegion(toLv);
        const nx = Math.max(r.x0, Math.min(r.x1, F1.ox * TILE + (a.x - F0.ox * TILE))), ny = Math.max(r.y0, Math.min(r.y1, F1.oy * TILE + (a.y - F0.oy * TILE)));
        this.teleport(a, nx / TILE, ny / TILE);
      } else {
        const c = tileCenter(tile.x, tile.y); this.teleport(a, c.x / TILE, c.y / TILE);
      }
      a.ghostLv = toLv;
      a.brain.path = [tileCenter(tile.x, tile.y)]; a.brain.goal = goal; a.brain.lift = null; return true;
    }
    // Việc ở trong buồng thang máy: phải gọi thang rồi vào buồng
    if (a.alive && toLv === 0 && fromLv !== 0) {
      if (this.lift.stuck) return false;
      const lv = LIFT_FLOORS.includes(fromLv) ? fromLv : 3;
      const ld = LIFT_DOORS.find(l => l.level === lv)!;
      const pf = findPath(a, { x: Math.floor(ld.front.x), y: ld.front.y });
      if (!pf) return false;
      a.brain.path = pf; a.brain.goal = goal; a.brain.lift = { to: tile, floor: 0, stage: 'walk', t: 0 }; return true;
    }
    // Đang ở trong buồng mà muốn đi nơi khác: bấm tầng rồi chờ tới nơi
    if (a.alive && fromLv === 0 && toLv !== 0) {
      const target = LIFT_FLOORS.includes(toLv) ? toLv : 3;
      a.brain.path = []; a.brain.goal = goal; a.brain.lift = { to: tile, floor: target, stage: 'ride', t: 0 };
      this.liftPress(a, target);
      return true;
    }
    const b0 = a.brain;
    if (b0.lift && b0.lift.floor === toLv) { b0.lift.to = tile; b0.goal = goal; return true; }
    b0.lift = null;
    if (!noLift && a.alive && fromLv !== toLv && LIFT_FLOORS.includes(fromLv) && LIFT_FLOORS.includes(toLv) && !this.lift.stuck
      && !['hunt', 'seek', 'noise', 'bell', 'flee'].includes(goal) && this.rng() < this.liftUse) {
      const ld = LIFT_DOORS.find(l => l.level === fromLv)!;
      const pf = findPath(a, { x: Math.floor(ld.front.x), y: ld.front.y });
      if (pf) { b0.path = pf; b0.goal = goal; b0.lift = { to: tile, floor: toLv, stage: 'walk', t: 0 }; this.liftStats.plans++; return true; }
    }
    const p = findPath(a, tile);
    if (!p) return false;
    a.brain.path = p;
    a.brain.goal = goal;
    return true;
  }

  private randomFloorTile(): Pt {
    for (let i = 0; i < 50; i++) {
      const r = WANDER_ROOMS[Math.floor(this.rng() * WANDER_ROOMS.length)];
      const x = r.x + Math.floor(this.rng() * r.w), y = r.y + Math.floor(this.rng() * r.h);
      if (isFloor(x, y)) return { x, y };
    }
    return SPAWNS[0];
  }

  private sense(a: Agent) {
    const b = a.brain;
    for (const o of this.agents) {
      if (o === a || !o.alive || o.hidden !== null) continue;
      if (this.sees(a, o)) {
        b.lastSeen.set(o.id, { room: roomAt(o.x, o.y), t: this.time });
        if (o.scanning && !b.cleared.has(o.id)) { b.cleared.add(o.id); b.sus.set(o.id, (b.sus.get(o.id) ?? 0) - 45); }
        if (o.hrScanning && !b.sawHrScan.has(o.id)) { b.sawHrScan.add(o.id); b.cleared.add(o.id); b.sus.set(o.id, (b.sus.get(o.id) ?? 0) - 80); }
        b.companion.set(o.id, (b.companion.get(o.id) ?? 0) + 0.25);
      }
    }
    for (const [id, v] of b.companion) b.companion.set(id, v * 0.985);
    // IT xem camera bằng laptop: nhìn thấy người trong vùng camera
    if (a.dept === 'it' && a.itCamT > 0) {
      for (const o of this.agents) {
        if (o === a || !o.alive || o.hidden !== null || !this.inCamera(o.x, o.y)) continue;
        b.lastSeen.set(o.id, { room: roomAt(o.x, o.y), t: this.time });
      }
    }
    if (b.seenBody === null) {
      for (const body of this.bodies) {
        if (this.sees(a, body, this.bodySpot * TILE)) {
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

    // Đang đi thang máy: chuyến đi thang tự lo tới khi xong (trừ khi có ghế trống ngay trước mặt)
    if (b.lift && a.alive && b.workT <= 0 && b.seenBody === null && this.sabotage?.kind !== 'boss') {
      this.followPath(a, dt);
      if (b.lift) return;
    }

    // Đang thao tác tại chỗ
    if (b.workT > 0) {
      a.moving = false;
      a.scanning = a.role === 'crew' && b.goal === 'task:fingerprint';
      a.hrScanning = b.goal === 'faceid';
      a.artistScanning = b.goal === 'artist';
      if (a.artistScanning && this.artistBlocked(a)) { a.artistScanning = false; b.workT = 0; b.goal = null; return; }
      if (a.hrScanning && this.faceIdBlocked(a)) { a.hrScanning = false; b.workT = 0; b.goal = null; return; }
      b.workT -= dt;
      if (b.workT <= 0) { a.scanning = false; a.hrScanning = false; a.artistScanning = false; this.finishWork(a); }
      return;
    }
    // Đang trốn (Nội gián bot)
    if (a.hidden !== null) {
      a.moving = false;
      b.hideT -= dt;
      if (b.hideT <= 0) {
        if (b.mode === 'vent' && this.rng() < 0.7) {
          this.hideMove(a);
          b.mode = 'vent2';
          b.hideT = 0.8;
        } else { this.hide(a, null); b.mode = 'idle'; b.path = []; }
      }
      return;
    }

    if (a.role === 'crew' && a.dept === 'climber' && a.alive) this.climberBrain(a, dt);
    else if (a.role === 'crew') this.crewBrain(a, dt);
    else this.impostorBrain(a, dt);
  }

  private finishWork(a: Agent) {
    const b = a.brain;
    const g = b.goal ?? '';
    if (g.startsWith('task:')) this.completeTask(a, g.slice(5));
    else if (g === 'fix' && this.sabotage && this.sabotage.kind !== 'boss') this.fixSabotage(a);
    else if (g === 'desk') this.bossCheckIn(a);
    else if (g.startsWith('swipe:')) this.unlockDoors(g.slice(6) as RoomId, a);
    else if (g === 'artist') {
      // Chọn màu chia đôi được nhóm nghi phạm (màu có trên khoảng một nửa số người chưa rõ)
      const pool = this.agents.filter(o => o !== a && o.alive && !b.cleared.has(o.id));
      const groups = this.groupsInGame().filter(gid => !a.artistResults.some(r => r.group === gid));
      let best = groups[0], bs = Infinity;
      for (const gid of groups) {
        const n = pool.filter(o => this.lookGroups(o.look).has(gid)).length;
        if (n === 0) continue;
        const score = Math.abs(n - pool.length / 2) + this.rng();
        if (score < bs) { bs = score; best = gid; }
      }
      if (best) this.artistCheck(a, best);
    }
    else if (g === 'faceid') {
      // Chọn người đáng ngờ nhất mà mình chưa chắc chắn
      const cands = this.agents.filter(o => o !== a && o.alive && !b.cleared.has(o.id));
      if (cands.length) {
        cands.sort((p, q) => (b.sus.get(q.id) ?? 0) - (b.sus.get(p.id) ?? 0) + (this.rng() - 0.5) * 10);
        this.startFaceId(a, cands[0].id);
      }
    }
    b.goal = null;
  }

  private crewBrain(a: Agent, dt: number) {
    const b = a.brain;
    // 0. Truyền thông đã thành hồn ma: đi tìm người sống để gửi sticker
    if (!a.alive && a.dept === 'media' && a.mediaCd <= 0 && this.phase === 'play') {
      const near = this.mediaTargets(a);
      const roomIdx = STICKERS.findIndex(x => x.room === a.deathRoom);
      if (near.length) {
        const killerHid = this.agents.some(o => o.role === 'impostor' && o.hidden !== null);
        // Ghép câu bằng hình: tầng + phòng nơi mình bị gài + "kẻ đó chui trốn" hoặc "rắn"
        const lvl = ROOMS.find(r => r.id === a.deathRoom)?.level ?? 0;
        const floorIdx = lvl >= 1 && lvl <= 4 ? STICKERS.findIndex(x => x.e === ['1️⃣', '2️⃣', '3️⃣', '🏙️'][lvl - 1]) : (lvl === 0 ? STICKERS.findIndex(x => x.e === '🛗') : -1);
        const msg = [floorIdx >= 0 ? floorIdx : STICKERS.findIndex(x => x.e === '👀'), roomIdx >= 0 ? roomIdx : STICKERS.findIndex(x => x.e === '❓'),
          STICKERS.findIndex(x => x.e === (killerHid ? '🫥' : this.rng() < 0.5 ? '🐍' : '⚠️'))];
        this.mediaSend(a, near[0].id, msg);
        return;
      }
      if (!b.path.length || this.rng() < dt * 0.3) {
        const alive = this.agents.filter(o => o.alive).sort((p, q) => dist(a, p) - dist(a, q));
        if (alive.length) this.goTo(a, { x: Math.floor(alive[0].x / TILE), y: Math.floor(alive[0].y / TILE) }, 'media');
      }
      this.followPath(a, dt);
      return;
    }
    // 1. Sếp đi tuần
    if (a.alive && this.sabotage?.kind === 'boss' && !a.bossDone) {
      const seat = DESKS[a.desk].seat;
      const c = tileCenter(seat.x, seat.y);
      if (dist(a, c) < 6) { b.goal = 'desk'; b.workT = 6.5 * (0.8 + this.rng() * 0.4); return; } // giả vờ gõ phím ~6,5 giây
      if (b.goal !== 'desk' || !b.path.length) this.goTo(a, seat, 'desk');
      this.followPath(a, dt);
      return;
    }
    // 1b. Bị nhốt trong phòng khóa cửa: chờ chút rồi quẹt thẻ mở
    const myRoom = roomAt(a.x, a.y);
    if (a.alive && myRoom && this.doorLocks.has(myRoom)) {
      b.lockWait += dt;
      if (b.lockWait > 1.5 + (a.id % 3)) {
        let best: Pt | null = null, bd = 1e9;
        for (const idx of DOOR_GROUPS.get(myRoom) ?? []) {
          const dxy = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          for (const [ox, oy] of dxy) {
            const nx = idx % MW + ox, ny = Math.floor(idx / MW) + oy;
            if (!isFloor(nx, ny) || roomAt(nx * TILE + 24, ny * TILE + 24) !== myRoom) continue;
            const c = tileCenter(nx, ny); const d = dist(a, c);
            if (d < bd) { bd = d; best = { x: nx, y: ny }; }
          }
        }
        if (best) {
          if (bd < 10) { b.goal = 'swipe:' + myRoom; b.workT = SWIPE_TIME; return; }
          if (b.goal !== 'swipe' || !b.path.length) this.goTo(a, best, 'swipe');
          this.followPath(a, dt);
          return;
        }
      }
    } else b.lockWait = 0;
    // 1b'. Loa của Sound Engineer hú: chạy tới chỗ ghế trống
    if (a.alive && this.noises.length && this.bodies.some(bd => bd.victim === this.noises[0].victim)) {
      const n = this.noises[0];
      if (dist(a, n) > 1.2 * TILE && (b.goal !== 'noise' || !b.path.length)) this.goTo(a, { x: Math.floor(n.x / TILE), y: Math.floor(n.y / TILE) }, 'noise');
      if (dist(a, n) <= 1.2 * TILE || this.sees(a, n)) {
        const body = this.bodies.find(bd => bd.victim === n.victim)!;
        if (dist(a, body) < REPORT_RANGE) { this.startMeeting(a.id, body.victim); return; }
      }
      this.followPath(a, dt);
      return;
    }
    // 1b''. Admin xem Bảng chấm công định kỳ; thấy người vừa bị đuổi việc mà chưa ai báo thì đi bấm chuông
    if (a.alive && a.dept === 'admin') {
      b.adminT = (b.adminT ?? 0) - dt;
      if (a.adminViewing && b.adminT <= 0) this.adminClose(a);
      if (!a.adminViewing && b.adminT <= -6 && !this.adminBlocked(a) && this.rng() < dt * 0.3) {
        this.adminOpen(a); b.adminT = 2;
        const unseen = this.bodies.find(bd => !this.agents[bd.victim].alive);
        if (unseen && b.adminAlert == null) b.adminAlert = unseen.victim;
      }
      if (b.adminAlert != null && this.bodies.some(bd => bd.victim === b.adminAlert) && a.emergencyLeft > 0 && this.sabotage?.kind !== 'boss') {
        if (Math.abs(a.x - BELL.x * TILE) < 4 * TILE && Math.abs(a.y - BELL.y * TILE) < 3.2 * TILE) {
          if (this.emergencyCd <= 0 && this.callEmergency(a, 'bell') === null) return;
          a.moving = false; return;
        }
        if (b.goal !== 'bell' || !b.path.length) this.goTo(a, BELL_STAND, 'bell');
        this.followPath(a, dt);
        return;
      }
    }
    // 1b'''. Engineer đứng cạnh chỗ trốn: đôi khi chui sang phía bên kia cho nhanh
    if (a.alive && a.dept === 'engineer' && !this.engineerBlocked(a) && a.hidden === null && this.rng() < dt * 0.6) {
      const ctx = this.context(a);
      if (ctx.hide !== null) { this.hide(a, ctx.hide); b.mode = 'vent'; b.hideT = 1 + this.rng(); b.path = []; return; }
    }
    // 1d. Animator: làm lại anim cho người bị gài bẫy mà mình tin là trong sạch (đổi mạng)
    if (a.alive && a.dept === 'animator' && !this.animatorBlocked(a) && this.meetingCount > 0 && this.rng() < dt * 0.04) {
      const cands = this.reviveCandidates(a).filter(o => o.role === 'crew');
      if (cands.length) { this.animatorRevive(a, cands[Math.floor(this.rng() * cands.length)].id); return; }
    }
    // 1e. Tester: đứng cạnh ai đó thì gắn test case (ưu tiên người mình nghi)
    if (a.alive && a.dept === 'tester' && !this.testerBlocked(a)) {
      const near = this.testerTargets(a);
      if (near.length && this.rng() < dt * 0.8) {
        near.sort((p, q) => (b.sus.get(q.id) ?? 0) - (b.sus.get(p.id) ?? 0));
        this.testerTag(a, near[0].id);
      }
    }
    // 1c. Product Owner tận mắt thấy gài bẫy: gọi họp gấp ngay tại chỗ
    if (a.alive && a.dept === 'po' && b.witnessed !== null && this.agents[b.witnessed].alive && !this.poBlocked(a)) {
      this.poCall(a);
      return;
    }
    // 2. Thấy ghế trống -> báo cáo
    if (a.alive && b.seenBody !== null) {
      const body = this.bodies.find(x => x.victim === b.seenBody);
      if (!body) { b.seenBody = null; }
      else {
        if (b.reactT > 0) { b.reactT -= dt; a.moving = false; return; }
        if (dist(a, body) < REPORT_RANGE * 0.9) { this.report(a, body); return; }
        if (b.goal !== 'body' || (!b.path.length && !b.lift)) {
          // Ghế trống không tới được (trong thang máy đang kẹt...): bỏ, để người khác phát hiện
          const ok = this.goTo(a, { x: Math.floor(body.x / TILE), y: Math.floor(body.y / TILE) }, 'body');
          if (!ok || (levelAt(body.x, body.y) === 0 && levelAt(a.x, a.y) !== 0 && this.lift.stuck)) { b.seenBody = null; b.path = []; b.lift = null; b.goal = null; return; }
        }
        if (b.lift) { if (this.liftStep(a, dt)) return; }
        this.followPath(a, dt);
        return;
      }
    }
    // 2b. Thấy tận mắt nhưng xác đã bị dọn -> gọi họp khẩn
    if (a.alive && b.witnessed !== null && this.agents[b.witnessed].alive && a.dept === 'po' && !this.poBlocked(a)) {
      this.poCall(a);
      return;
    }
    if (a.alive && b.witnessed !== null && this.agents[b.witnessed].alive && a.emergencyLeft > 0 && this.sabotage?.kind !== 'boss') {
      // Chạy về Phòng họp bấm chuông (giống nút họp khẩn của Among Us)
      if (Math.abs(a.x - BELL.x * TILE) < 4 * TILE && Math.abs(a.y - BELL.y * TILE) < 3.2 * TILE) {
        if (this.emergencyCd <= 0 && this.callEmergency(a, 'bell') === null) return;
        a.moving = false; return;
      }
      if (b.goal !== 'bell' || !b.path.length) this.goTo(a, BELL_STAND, 'bell');
      this.followPath(a, dt);
      return;
    }
    // 3. Sửa sự cố
    if (a.alive && b.fixer && this.sabotage && this.sabotage.kind !== 'boss') {
      const st = station(this.sabotage!.kind === 'wifi' ? 'router' : 'power');
      const c = tileCenter(st.stand.x, st.stand.y);
      if (dist(a, c) < 8) { b.goal = 'fix'; b.workT = (this.sabotage?.kind === 'wifi' ? 5.4 : 2.8) * (0.8 + this.rng() * 0.4); return; } // router: rút, chờ, cắm lại; cầu dao: gạt (đo bằng phòng thử)
      if (b.goal !== 'fix' || !b.path.length) this.goTo(a, st.stand, 'fix');
      this.followPath(a, dt);
      return;
    }
    // 3b. Năng lực phòng ban
    if (a.alive && a.dept === 'it' && !this.itBlocked(a) && this.rng() < dt * 0.05) this.useLaptop(a);
    if (a.alive && a.dept === 'hr' && !this.faceIdBlocked(a) && b.goal === 'faceid') {
      const fid = station('faceid');
      const c = tileCenter(fid.stand.x, fid.stand.y);
      if (dist(a, c) < 8) { b.goal = 'faceid'; b.workT = HR_SCAN_TIME; return; }
      if (b.goal !== 'faceid' || !b.path.length) this.goTo(a, fid.stand, 'faceid');
      this.followPath(a, dt);
      return;
    }
    if (a.alive && a.dept === 'artist' && !this.artistBlocked(a) && b.goal === 'artist') {
      const cc = station('colorcheck');
      const c = tileCenter(cc.stand.x, cc.stand.y);
      if (dist(a, c) < 8) { b.workT = 3; return; }
      if (!b.path.length) this.goTo(a, cc.stand, 'artist');
      this.followPath(a, dt);
      return;
    }
    // 4. Làm task
    if (b.path.length) {
      const arrived = this.followPath(a, dt);
      if (arrived && b.goal?.startsWith('task:')) b.workT = this.stepTime(b.goal.slice(5));
      else if (arrived) { b.goal = null; b.thinkT = 1 + this.rng() * 3; }
      return;
    }
    a.moving = false;
    b.thinkT -= dt;
    if (b.thinkT > 0) return;
    const next = a.tasks.filter(t => !t.done);
    if (a.alive && a.dept === 'hr' && !this.faceIdBlocked(a) && this.rng() < 0.5) { b.goal = 'faceid'; return; }
    if (a.alive && a.dept === 'artist' && !this.artistBlocked(a) && this.rng() < 0.5) { b.goal = 'artist'; return; }
    if (next.length && this.rng() < 0.2) {
      // dân văn phòng: đi lòng vòng, ghé pantry, lướt điện thoại...
      this.goTo(a, this.randomFloorTile(), 'wander');
      b.thinkT = 2 + this.rng() * 4;
    } else if (next.length) {
      // Dân văn phòng hay đi theo nhóm: đôi khi chọn việc gần đồng nghiệp đang ở cạnh mình
      let t = pick(next, this.rng);
      if (a.alive && this.rng() < this.buddyChance) {
        const mates = this.agents.filter(o => o !== a && o.alive && o.hidden === null && this.sees(a, o));
        if (mates.length) {
          const m = mates[0];
          const mg = m.brain.goal?.startsWith('task:') ? station(m.brain.goal.slice(5)) : null;
          const ref = mg ? tileCenter(mg.stand.x, mg.stand.y) : m;
          t = [...next].sort((p, q) => dist(ref, tileCenter(station(slotStation(p)).stand.x, station(slotStation(p)).stand.y)) - dist(ref, tileCenter(station(slotStation(q)).stand.x, station(slotStation(q)).stand.y)))[0];
        }
      }
      const st = station(slotStation(t));
      const c = tileCenter(st.stand.x, st.stand.y);
      if (dist(a, c) < 8) { b.goal = 'task:' + st.id; b.workT = this.stepTime(st.id); return; }
      if (!this.goTo(a, st.stand, 'task:' + st.id)) b.thinkT = 1;
    } else {
      this.goTo(a, this.randomFloorTile(), 'wander');
      b.thinkT = 2 + this.rng() * 4;
    }
  }

  /** Intern tham vọng (bot): giả vờ làm việc như Nhân viên, rình lúc vắng người để gài bẫy cả hai phe */
  private climberBrain(a: Agent, dt: number) {
    const b = a.brain;
    if (a.killCd <= 0 && this.time > 15) {
      const imps = this.aliveImp();
      const crewN = this.aliveCrew().length;
      // Để Nội gián dọn bớt Nhân viên trước, khi Nhân viên còn ít thì quay sang xử Nội gián
      const huntImp = imps.length > 0 && (crewN <= imps.length + 2 || this.rng() < 0.15);
      const seen = this.agents.filter(o => o !== a && o.alive && o.hidden === null && this.sees(a, o) && (huntImp ? o.role === 'impostor' : o.role !== 'impostor'));
      seen.sort((p, q) => dist(a, p) - dist(a, q));
      const t = seen[0];
      if (t) {
        if (dist(a, t) < KILL_RANGE && this.safeToKillAny(a, t)) { if (this.tryKill(a, t)) { b.path = []; this.goTo(a, this.randomFloorTile(), 'wander'); return; } }
        b.senseT -= dt;
        if (b.senseT <= 0 || !b.path.length) { b.senseT = 0.5; this.goTo(a, { x: Math.floor(t.x / TILE), y: Math.floor(t.y / TILE) }, 'hunt'); }
        if (dist(a, t) < KILL_RANGE * 0.9) { a.moving = false; return; }
        this.followPath(a, dt);
        return;
      }
    }
    this.crewBrain(a, dt);
  }

  /** Không có ai khác nhìn thấy (dùng cho kẻ gài bẫy không phải Nội gián) */
  private safeToKillAny(k: Agent, victim: Agent): boolean {
    if (this.camsInUse() && (this.inCamera(k.x, k.y) || this.inCamera(victim.x, victim.y))) return false;
    for (const o of this.agents) {
      if (o === k || o === victim || !o.alive || o.hidden !== null) continue;
      if (this.sees(o, k, 30)) return false;
    }
    return true;
  }

  private safeToKill(k: Agent, victim: Agent): boolean {
    // Đèn camera đang đỏ và mình đang nằm trong khung hình: không ra tay
    if (this.camsInUse() && (this.inCamera(k.x, k.y) || this.inCamera(victim.x, victim.y))) return false;
    for (const o of this.agents) {
      if (o === k || o === victim || !o.alive || o.role === 'impostor' || o.hidden !== null) continue;
      if (this.sees(o, k, 30)) return false;
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
    // Combo kinh điển: hồi chiêu sắp xong mà một mình -> cúp điện cho dễ ra tay
    if (!this.sabotage && this.sabCd <= 0 && a.killCd <= 3 && this.aliveImp().length === 1 && this.time > 20 && this.rng() < dt * 0.5) {
      this.triggerSabotage(a, 'power');
    }
    if (!this.sabotage && this.sabCd <= 0 && b.thinkT <= 0 && this.rng() < 0.3 && this.time > 25) {
      const r = this.rng();
      let kind: SabotageKind = r < 0.5 ? 'power' : 'wifi';
      if (r > 0.82 && !this.bossUsed && this.time > 50) kind = 'boss';
      this.triggerSabotage(a, kind);
    }
    if (b.thinkT <= 0) b.thinkT = 3 + this.rng() * 3;

    // Thấy ghế trống của nạn nhân người khác -> thỉnh thoảng tự báo cáo
    // Thấy ai đang quét máy Face ID -> đó là HR thật, phải xử lý trước
    for (const o of this.agents) {
      if (o.hrScanning && o.alive && this.sees(a, o)) b.hrTarget = o.id;
    }
    if (b.hrTarget !== null && !this.agents[b.hrTarget].alive) b.hrTarget = null;
    // Săn mồi: Nội gián chỉ biết những gì mình nhìn thấy (không nhìn xuyên tường)
    if (a.killCd <= 0 && this.time > 10) {
      if (b.targetId !== null) {
        const t0 = this.agents[b.targetId];
        if (!t0.alive || t0.hidden !== null) b.targetId = null;
        else if (this.sees(a, t0)) { b.lastPos = { x: t0.x, y: t0.y }; b.lostT = 0; }
        else { b.lostT += dt; if (b.lostT > 6) b.targetId = null; }
      }
      if (b.targetId === null || b.huntT > 18) {
        const seen = this.agents.filter(o => o.alive && o.role === 'crew' && o.hidden === null && this.sees(a, o));
        if (seen.length) {
          const hr = seen.find(o => o.id === b.hrTarget);
          seen.sort((p, q) => dist(a, p) - dist(a, q));
          const t1 = hr ?? (this.rng() < 0.75 ? seen[0] : pick(seen, this.rng));
          if (t1.id !== b.targetId) { b.targetId = t1.id; b.huntT = 0; b.path = []; b.lastPos = { x: t1.x, y: t1.y }; b.lostT = 0; }
        } else if (b.huntT > 18) b.targetId = null;
      }
    }
    if (a.killCd <= 0 && this.time > 10 && b.targetId !== null) {
      const t = this.agents[b.targetId];
      b.huntT += dt;
      // Nhốt con mồi: cùng phòng với nó và không có ai khác -> khóa cửa phòng
      const tr = roomAt(t.x, t.y);
      if (tr && tr === roomAt(a.x, a.y) && dist(a, t) < 4 * TILE && !this.doorBlocked(a, tr) && this.rng() < dt * 0.8
        && !this.agents.some(o => o !== t && o !== a && o.alive && o.role === 'crew' && roomAt(o.x, o.y) === tr)) {
        this.lockDoors(a, tr);
      }
      if (dist(a, t) < KILL_RANGE && t.hidden === null && this.safeToKill(a, t)) {
        if (this.tryKill(a, t)) {
          b.targetId = null;
          b.mode = 'flee';
          b.path = [];
          // Chạy trốn: chui vào chỗ trốn gần nhất nếu đủ gần
          let best = -1, bd = 7 * TILE;
          HIDE_SPOTS.forEach((h, i) => { if (h.id.startsWith('tm_shaft')) return; const d = dist(a, tileCenter(h.x, h.y)); if (d < bd && levelAt(a.x, a.y) === levelAt(h.x * TILE + 24, h.y * TILE + 24)) { bd = d; best = i; } });
          if (best >= 0) { this.goTo(a, { x: HIDE_SPOTS[best].x, y: HIDE_SPOTS[best].y }, 'vent:' + best); }
          else this.goTo(a, this.randomFloorTile(), 'wander');
          return;
        }
      }
      b.senseT -= dt;
      if (b.senseT <= 0 || !b.path.length) {
        b.senseT = 0.5;
        const goal = b.lastPos ?? t;
        this.goTo(a, { x: Math.floor(goal.x / TILE), y: Math.floor(goal.y / TILE) }, 'hunt');
      }
      // Đứng gần nhưng có người nhìn -> lảng vảng chờ
      if (dist(a, t) < KILL_RANGE * 0.9) { a.moving = false; return; }
      this.followPath(a, dt);
      return;
    }

    // Nội gián ghi nhớ nơi vừa thấy Nhân viên (chỉ bằng mắt mình)
    b.senseT -= dt;
    if (b.senseT <= 0) {
      b.senseT = 0.3;
      for (const o of this.agents) {
        if (o.alive && o.role === 'crew' && o.hidden === null && this.sees(a, o)) b.lastSeen.set(o.id, { room: roomAt(o.x, o.y), t: this.time, x: o.x, y: o.y });
      }
    }
    // Sắp hết hồi chiêu mà chưa thấy ai: tới nơi gần nhất vừa thấy Nhân viên để tìm mồi
    if (a.killCd <= this.seekLead && this.time > 8 && b.goal !== 'seek' && (!b.goal?.startsWith('vent:'))) {
      let best: { x: number; y: number } | null = null, bd = Infinity;
      for (const [id, ls] of b.lastSeen) {
        if (ls.x === undefined || this.time - ls.t > 25 || !this.agents[id].alive) continue;
        const d = Math.hypot(ls.x - a.x, ls.y! - a.y);
        if (d < bd && d > 2 * TILE) { bd = d; best = { x: ls.x, y: ls.y! }; }
      }
      if (best && this.goTo(a, { x: Math.floor(best.x / TILE), y: Math.floor(best.y / TILE) }, 'seek')) b.workT = 0;
    }
    // Đi giả vờ làm task / chui chỗ trốn
    if (b.path.length) {
      const arrived = this.followPath(a, dt);
      if (arrived && b.goal?.startsWith('vent:')) {
        this.hide(a, parseInt(b.goal.slice(5)));
        b.mode = 'vent';
        b.hideT = 0.8 + this.rng();
        b.goal = null;
      } else if (arrived && b.goal === 'seek') {
        b.goal = null;
      } else if (arrived && b.goal?.startsWith('fake:')) {
        b.workT = 2 + this.rng() * 3;
        b.goal = null;
      }
      return;
    }
    a.moving = false;
    if (this.rng() < dt * 1.5) {
      const st = pick(FAKE_STATIONS, this.rng);
      this.goTo(a, st.stand, 'fake:' + st.id);
    }
  }

  // ---------- Họp ----------
  startMeeting(reporter: number, victim: number | null, via: 'bell' | 'email' | 'po' = 'email') {
    this.phase = 'meeting';
    this.meetingCount++;
    const body = victim !== null ? this.bodies.find(b => b.victim === victim) : null;
    const room = body ? body.room : null;
    const m: Meeting = {
      reporter, victim, room, t: 0, duration: this.discussTime + this.voteTime, discussEnd: this.discussTime, chat: [], queue: [], via: victim !== null ? 'body' : via, reactions: [], reactQueue: [], hrClaims: [],
      votes: new Map(), voteAt: new Map(), result: null, protect: null,
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
    this.clearDoors();
    this.noises = [];
    this.lift = { pos: 2, dir: 0, target: null, open: true, doorT: LIFT_DOOR_TIME, requests: new Set(), stuck: false, stuckT: 0, rescueFloor: null };
    for (const a of this.agents) { if (a.adminViewing) this.adminClose(a); a.stickerMsg = null; a.brain.lift = null; }
    const mm = this.meeting!;
    // Dòng đầu tiên trong khung chat: lý do cuộc họp (tô đỏ)
    {
      const r = this.agents[reporter];
      const where = room ? `${roomName(room)}, ${levelName(ROOMS.find(x => x.id === room)?.level ?? 0)}` : '';
      const text = mm.via === 'body' ? fmt('chat.reason.body', { reporter: `${r.name} #${r.empId}`, victim: this.agents[victim!].name, room: where })
        : mm.via === 'po' ? fmt('chat.reason.po', { reporter: `${r.name} #${r.empId}` })
        : fmt('chat.reason.bell', { reporter: `${r.name} #${r.empId}` });
      mm.chat.push({ from: reporter, text, t: 0, system: true, alert: true });
    }
    // Vào phòng họp thì ai cũng thấy ai đã nghỉ việc
    for (const a of this.agents) if (a.dept === 'animator') for (const o of this.agents) if (!o.alive && !a.knownDead.includes(o.id)) a.knownDead.push(o.id);
    for (const a of this.agents) {
      if (a.dept !== 'tester' || a.role !== 'crew' || !a.alive) continue;
      const rep = this.testerReport(a);
      if (rep) mm.chat.push({ from: a.id, text: rep, t: 0, system: true, to: a.id });
    }
    this.events.push({ type: 'meeting', reporter, victim });
    this.planStatements(m);
    for (const a of this.agents) {
      if (a.human) continue;
      if (!a.alive) continue;
      m.voteAt.set(a.id, 3 + this.rng() * 22); // tính từ lúc mở bỏ phiếu
    }
  }

  private say(m: Meeting, from: number, text: string, effects: Effect[] = [], at?: number, extra: { claim?: { target: number; imp: boolean }; reveal?: boolean } = {}) {
    const last = m.queue.length ? m.queue[m.queue.length - 1].at : 1.2;
    m.queue.push({ at: at ?? last + 2 + this.rng() * 1.8, from, text, effects, ...extra });
    m.queue.sort((p, q) => p.at - q.at);
    // Mỗi tin nhắn cách nhau tối thiểu 2 giây
    for (let i = 1; i < m.queue.length; i++) {
      if (m.queue[i].at < m.queue[i - 1].at + CHAT_GAP) m.queue[i].at = m.queue[i - 1].at + CHAT_GAP;
    }
  }

  private planStatements(m: Meeting) {
    const A = this.agents;
    const nm = (id: number) => A[id].name;
    const speakers = A.filter(a => a.alive && !a.human);
    const recent = this.time - 35;
    // Người báo cáo nói trước
    const rep = A[m.reporter];
    if (!rep.human) {
      if (m.victim !== null) {
        this.say(m, rep.id, fmt('bot.report.body', { victim: nm(m.victim), room: roomName(m.room) }));
      } else if (rep.brain.witnessed !== null) {
        this.say(m, rep.id, fmt('bot.report.witness', { suspect: nm(rep.brain.witnessed) }), [{ target: rep.brain.witnessed, delta: 45 }]);
      } else {
        this.say(m, rep.id, fmt('bot.report.bell'));
      }
    }
    // Phòng ban lên tiếng
    for (const a of speakers) {
      if (a.role === 'crew' && a.dept === 'hr') {
        if (a.hrResult && A[a.hrResult.target].alive) {
          const r = a.hrResult;
          this.say(m, a.id, r.imp
            ? fmt('bot.hr.imp', { target: nm(r.target) })
            : fmt('bot.hr.crew', { target: nm(r.target) }), [], undefined, { claim: { target: r.target, imp: r.imp } });
        } else if (a.hrPending && this.rng() < 0.25) {
          this.say(m, a.id, fmt('bot.hr.pending', { target: nm(a.hrPending.target) }), [], undefined, { claim: { target: -1, imp: false } });
        }
      }
      if (a.role === 'crew' && a.dept === 'artist' && a.artistResults.length > (a.brain.artistSaid ?? 0)) {
        const r = a.artistResults[a.artistResults.length - 1];
        a.brain.artistSaid = a.artistResults.length;
        const gname = COLOR_GROUPS.find(g => g.id === r.group)!.name.toLowerCase();
        const effects = A.filter(o => o !== a && o.alive && this.lookGroups(o.look).has(r.group)).map(o => ({ target: o.id, delta: r.has ? 10 : -14 }));
        this.say(m, a.id, r.has
          ? fmt('bot.artist.has', { color: gname })
          : fmt('bot.artist.not', { color: gname }), effects);
      }
      if (a.role === 'crew' && a.dept === 'tester' && a.testTarget !== null) {
        const t = A[a.testTarget];
        const jumps = a.testLog.filter(e => e.jump).length;
        const route = a.testLog.slice(-4).map(e => e.room).join(' → ');
        if (t.alive) this.say(m, a.id, jumps
          ? fmt('bot.tester.jump', { target: t.name, route, jumps })
          : fmt('bot.tester.pass', { target: t.name, route }), [{ target: t.id, delta: jumps ? 24 : -6 }]);
      }
      if (a.role === 'crew' && a.dept === 'gd' && this.rng() < 0.75) {
        // Game Designer: người không thể bị sa thải, nhưng cách nói chuyện lại khiến người khác nghi ngờ
        const lines = [
          'Ừ thì tôi có đi ngang chỗ đó, nhưng chỉ để... kiểm tra level design thôi.',
          'Tôi không có alibi. Tôi đi một mình suốt, cho có cảm hứng sáng tạo.',
          'Tôi thấy ghế trống từ nãy rồi, nhưng nghĩ chắc ai đó báo rồi nên thôi.',
          'Mọi người nghi tôi cũng được. Nhưng cứ thử sa thải tôi xem dự án có chạy nổi không.',
          'Thiết kế của tôi thì không ai hiểu đâu, giải thích cũng vô ích.',
        ];
        this.say(m, a.id, pick(lines, this.rng), [{ target: a.id, delta: 12 }]);
      }
      if (a.role === 'crew' && a.dept === 'climber' && !a.anonUsed && this.meetingCount >= 1 && this.rng() < 0.45) {
        // Intern tham vọng: tố nặc danh một Nhân viên đáng gờm để mượn tay công ty loại bỏ
        const victims = A.filter(o => o.alive && o !== a && o.role === 'crew');
        if (victims.length) this.anonAccuse(a, pick(victims, this.rng).id);
      }
      if (a.role === 'crew' && a.dept === 'admin' && a.brain.adminAlert != null) {
        const v = a.brain.adminAlert;
        a.brain.adminAlert = null;
        this.say(m, a.id, fmt('bot.admin', { victim: nm(v) }));
      }
      if (a.role === 'crew' && a.dept === 'sound' && false) { /* Sound Engineer không nói gì khi còn sống */ }
      if (a.role === 'crew' && a.dept === 'developer' && a.devUsed && !a.brain.devSaid && a.devBackup !== null && A[a.devBackup].alive) {
        a.brain.devSaid = true;
        this.say(m, a.id, fmt('bot.developer', { target: nm(a.devBackup) }));
      }
      if (a.role === 'crew' && a.dept === 'director' && !a.directorRevealed) {
        const pressured = [...A].some(o => o.alive && o !== a && (o.brain.sus.get(a.id) ?? 0) > 25);
        if (pressured || (this.meetingCount >= 2 && this.rng() < 0.45)) {
          this.say(m, a.id, '', [], 4 + this.rng() * 18, { reveal: true });
        }
      }
      if (a.role === 'impostor' && !a.brain.claimedHr && this.roleList.includes('hr') && this.meetingCount >= 2 && this.rng() < 0.2) {
        const crew = A.filter(o => o.alive && o.role === 'crew' && !o.directorRevealed);
        if (crew.length) {
          const x = pick(crew, this.rng);
          a.brain.claimedHr = true;
          this.say(m, a.id, fmt('bot.hr.fake', { target: x.name }), [], undefined, { claim: { target: x.id, imp: true } });
        }
      }
    }
    const order = [...speakers].sort(() => this.rng() - 0.5);
    for (const a of order) {
      const b = a.brain;
      if (a.role === 'crew') {
        if (b.witnessed !== null && A[b.witnessed].alive && !(a.id === m.reporter && m.victim === null)) {
          const v = m.victim !== null ? nm(m.victim) : 'đồng nghiệp';
          this.say(m, a.id, fmt('bot.witness', { suspect: nm(b.witnessed), victim: v }), [{ target: b.witnessed, delta: 45 }]);
          continue;
        }
        const near = b.nearBody.filter(id => A[id].alive && id !== a.id);
        if (m.victim !== null && b.seenBody === m.victim && near.length) {
          const x = pick(near, this.rng);
          this.say(m, a.id, fmt('bot.nearBody', { suspect: nm(x) }), [{ target: x, delta: 16 }]);
          continue;
        }
        if (m.room) {
          const seen = [...b.lastSeen.entries()].filter(([id, s]) => id !== a.id && A[id].alive && s.room === m.room && s.t > recent);
          if (seen.length) {
            const [x] = pick(seen, this.rng);
            this.say(m, a.id, fmt('bot.seenInRoom', { suspect: nm(x), room: roomName(m.room) }), [{ target: x, delta: 10 }]);
            continue;
          }
        }
        const cleared = [...b.cleared].filter(id => A[id].alive && id !== a.id);
        if (cleared.length && this.rng() < 0.8) {
          const y = pick(cleared, this.rng);
          this.say(m, a.id, fmt('bot.vouchScan', { target: nm(y) }), [{ target: y, delta: -30 }]);
          continue;
        }
        const comps = [...b.companion.entries()].filter(([id, v]) => v > 3 && A[id].alive && id !== a.id).sort((p, q) => q[1] - p[1]);
        if (comps.length && this.rng() < 0.75) {
          const [y] = comps[0];
          this.say(m, a.id, fmt('bot.vouchBuddy', { target: nm(y) }), [{ target: y, delta: -8 }]);
          continue;
        }
        const room = roomName(roomAt(a.x, a.y));
        const doneTask = a.tasks.find(t => t.done || t.step > 0);
        this.say(m, a.id, doneTask
          ? fmt('bot.alibiTask', { room, task: taskDef(doneTask.taskId).name.toLowerCase() })
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
          this.say(m, a.id, fmt('bot.frame', { suspect: x.name, room: where }), [{ target: x.id, delta: 12 }]);
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

  /** Thả emoji trong cuộc họp (hiện trên ô video của người thả) */
  react(from: number, emoji: string) {
    const m = this.meeting;
    if (!m || m.result) return;
    m.reactions.push({ from, emoji, t: m.t });
  }

  private botReact(m: Meeting, from: number, emoji: string, delay: number) {
    if (this.agents[from].human) return;
    m.reactQueue.push({ at: m.t + delay, from, emoji });
  }

  /** Bot phản ứng bằng emoji khi có người buộc tội hoặc bênh vực */
  private reactToEffects(m: Meeting, from: number, effects: Effect[]) {
    for (const e of effects) {
      const target = this.agents[e.target];
      if (e.delta > 0) {
        if (target.alive) this.botReact(m, target.id, this.rng() < 0.7 ? '😡' : '👎', 0.4 + this.rng() * 0.8);
        for (const l of this.agents) {
          if (!l.alive || l.id === from || l.id === target.id || this.rng() > 0.35) continue;
          const s = l.brain.sus.get(target.id) ?? 0;
          this.botReact(m, l.id, s > 20 ? '👍' : s < -10 ? '👎' : '🤔', 0.6 + this.rng() * 1.6);
        }
      } else if (e.delta < 0 && target.alive) {
        this.botReact(m, target.id, '👍', 0.5 + this.rng());
      }
    }
    if (!effects.length && this.rng() < 0.3) {
      const l = pick(this.agents.filter(a => a.alive && a.id !== from), this.rng);
      if (l) this.botReact(m, l.id, this.rng() < 0.6 ? '😂' : '❓', 0.5 + this.rng() * 1.5);
    }
  }

  /** Có người nhận là HR và công bố kết quả (target = -1 nếu chưa có kết quả) */
  onHrClaim(m: Meeting, by: number, target: number, imp: boolean) {
    const A = this.agents;
    const others = m.hrClaims.filter(c => c.by !== by).map(c => c.by);
    const firstOfSpeaker = !m.hrClaims.some(c => c.by === by);
    m.hrClaims.push({ by, target, imp });
    // Nội gián ghi nhớ: người tự nhận HR (nếu là nhân viên thật) cần bị xử lý sớm
    for (const l of A) if (l.role === 'impostor' && A[by].role === 'crew') l.brain.hrTarget = by;
    for (const l of A) {
      if (!l.alive || l.id === by || l.role !== 'crew' || (l.human)) continue;
      const b = l.brain;
      // Bị tố là Nội gián trong khi mình biết mình trong sạch: người tố chắc chắn nói dối
      if (target === l.id && imp) { b.sus.set(by, (b.sus.get(by) ?? 0) + 150); continue; }
      let trust: number;
      if (b.sawHrScan.has(by)) trust = 1;
      else if (others.some(o => b.sawHrScan.has(o))) trust = -1;
      else if (others.length) {
        trust = 0.3;
        if (firstOfSpeaker) for (const o of [by, ...others]) b.sus.set(o, (b.sus.get(o) ?? 0) + 18);
      } else trust = (b.sus.get(by) ?? 0) > 40 ? 0.3 : 0.85;
      if (trust < 0) { b.sus.set(by, (b.sus.get(by) ?? 0) + 120); continue; }
      if (target >= 0) b.sus.set(target, (b.sus.get(target) ?? 0) + trust * (imp ? 110 : -50));
    }
    if (target >= 0 && imp && A[target].alive) this.botReact(m, target, '😡', 0.5);
    // Phản bác
    const T = target >= 0 ? A[target] : null;
    if (T && imp && T.role === 'impostor' && !T.human && !T.brain.claimedHr && this.rng() < 0.8) {
      T.brain.claimedHr = true;
      this.say(m, T.id, fmt('bot.hr.counterFake', { liar: A[by].name }), [], m.t + 2.2, { claim: { target: by, imp: true } });
    } else if (T && imp && T.role === 'crew' && !T.human) {
      this.say(m, T.id, fmt('bot.hr.deny', { liar: A[by].name }), [{ target: by, delta: 25 }], m.t + 2.2);
    }
    const realHr = A.find(o => o.alive && o.role === 'crew' && o.dept === 'hr' && o.id !== by && !o.human);
    if (realHr && !m.hrClaims.some(c => c.by === realHr.id) && A[by].dept !== 'hr' && this.rng() < 0.9) {
      const r = realHr.hrResult;
      if (r && A[r.target].alive) {
        this.say(m, realHr.id, fmt('bot.hr.realResult', { liar: A[by].name, target: A[r.target].name, verdict: fmt(r.imp ? 'bot.hr.realResult.imp' : 'bot.hr.realResult.crew') }),
          [{ target: by, delta: 40 }], m.t + 3, { claim: { target: r.target, imp: r.imp } });
      } else {
        this.say(m, realHr.id, fmt('bot.hr.realClaim', { liar: A[by].name }), [{ target: by, delta: 40 }], m.t + 3, { claim: { target: -1, imp: false } });
      }
    }
  }

  private applyEffects(from: number, effects: Effect[]) {
    for (const l of this.agents) {
      if (l.human) continue;
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
  playerChat(text: string) { this.chatFrom(this.player, text); }
  /** Một người thật nhắn trong cuộc họp (bot đọc và phản ứng) */
  chatFrom(p: Agent, text: string) {
    const m = this.meeting;
    if (!m || m.result) return;
    m.chat.push({ from: p.id, text, t: m.t, ...(p.alive ? {} : { ghost: true }) });
    if (!p.alive) return; // hồn ma nói không ai nghe
    const n = normalize(text);
    const vouch = /(khong phai|trong sach|vo toi|uy tin|tin .* duoc|clear)/.test(n);
    const idHit = (id: string) => new RegExp(`(^|[^0-9])#?${id}([^0-9]|$)`).test(n);
    const mentioned = this.agents.filter(a => a.id !== p.id && a.alive && (n.includes(normalize(a.name)) || idHit(a.empId)));
    // Người chơi nhận là HR
    if (/(toi|minh|em|tao)\s*(la|lam)\s*hr|\bhr day\b|face ?id/.test(n)) {
      const tgt = mentioned[0] ?? null;
      const imp = /(noi gian|impostor|gian|sus|ke phan boi)/.test(n.replace(/hr/g, ''));
      this.onHrClaim(m, p.id, tgt ? tgt.id : -1, tgt ? imp : false);
      return;
    }
    if (/(skip|bo qua)/.test(n)) for (const a of this.agents) a.brain.skipBias += 10;
    for (const x of mentioned) {
      this.applyEffects(p.id, [{ target: x.id, delta: vouch ? -10 : 13 }]);
      this.reactToEffects(m, p.id, [{ target: x.id, delta: vouch ? -10 : 13 }]);
      if (vouch) {
        this.say(m, x.id, fmt('bot.thanks', { name: p.name }), [], m.t + 1.5 + this.rng() * 1.5);
      } else if (x.role === 'impostor') {
        const counter = this.rng() < 0.5;
        this.say(m, x.id, counter
          ? fmt('bot.counterAccuse', { defense: pick(DEFENSE_LINES, this.rng), name: p.name })
          : pick(DEFENSE_LINES, this.rng),
        counter ? [{ target: p.id, delta: 10 }] : [], m.t + 1.5 + this.rng() * 2);
      } else {
        const comps = [...x.brain.companion.entries()].filter(([id, v]) => v > 2 && this.agents[id].alive && id !== p.id).sort((a, b) => b[1] - a[1]);
        const doneTask = x.tasks.find(t => t.done || t.step > 0);
        let line = pick(DEFENSE_LINES, this.rng);
        if (comps.length) line = fmt('bot.withBuddy', { buddy: this.agents[comps[0][0]].name });
        else if (doneTask) line = fmt('bot.doingTask', { task: taskDef(doneTask.taskId).name.toLowerCase(), defense: pick(DEFENSE_LINES, this.rng) });
        this.say(m, x.id, line, comps.length ? [{ target: x.id, delta: -6 }] : [], m.t + 1.5 + this.rng() * 2);
      }
    }
    if (!mentioned.length && this.rng() < 0.4) {
      const s = this.agents.filter(a => a.alive && !(a.isPlayer || a.human));
      if (s.length) this.say(m, pick(s, this.rng).id, pick(FILLER_LINES, this.rng), [], m.t + 2 + this.rng() * 2);
    }
  }

  vote(voter: Agent, target: number | 'skip') {
    const m = this.meeting;
    if (!m || m.result || !voter.alive || m.votes.has(voter.id) || m.t < m.discussEnd) return;
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
    const crewBots = this.agents.filter(o => o.alive && o.role === 'crew' && !(o.isPlayer || o.human));
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
    const lastT = m.chat.length ? m.chat[m.chat.length - 1].t : -99;
    if (m.queue.length && m.queue[0].at <= m.t && m.t - lastT >= CHAT_GAP) {
      const q = m.queue.shift()!;
      const sp = this.agents[q.from];
      if (sp.alive && q.reveal) {
        if (!sp.directorRevealed) this.revealDirector(sp);
      } else if (sp.alive) {
        m.chat.push({ from: q.from, text: q.text, t: m.t });
        this.applyEffects(q.from, q.effects);
        this.reactToEffects(m, q.from, q.effects);
        if (q.claim) this.onHrClaim(m, q.from, q.claim.target, q.claim.imp);
      }
    }
    m.reactQueue.sort((p, q) => p.at - q.at);
    while (m.reactQueue.length && m.reactQueue[0].at <= m.t) {
      const r = m.reactQueue.shift()!;
      if (this.agents[r.from].alive) m.reactions.push({ from: r.from, emoji: r.emoji, t: m.t });
    }
    for (const [id, at] of m.voteAt) {
      if (m.t >= m.discussEnd + at && !m.votes.has(id) && this.agents[id].alive) {
        m.votes.set(id, this.botVote(this.agents[id]));
      }
    }
    const aliveCount = this.agents.filter(a => a.alive).length;
    const allVoted = m.votes.size >= aliveCount;
    if (m.t >= m.duration || (allVoted && m.t >= m.discussEnd)) this.tally();
  }

  /** Người chơi bấm "Sẵn sàng bỏ phiếu": mở bỏ phiếu ngay */
  /** Một người thật bấm "Sẵn sàng bỏ phiếu": đủ mọi người thật còn sống thì mới mở bỏ phiếu sớm */
  readyToVote(a: Agent) {
    const m = this.meeting;
    if (!m || m.result || m.t >= m.discussEnd || !a.human || !a.alive) return;
    (m.readyVote ??= []).includes(a.id) || m.readyVote.push(a.id);
    if (this.agents.filter(h => h.human && h.alive).every(h => m.readyVote!.includes(h.id))) this.skipDiscussion();
  }
  skipDiscussion() {
    const m = this.meeting;
    if (!m || m.result || m.t >= m.discussEnd) return;
    m.discussEnd = m.t;
    m.duration = m.t + this.voteTime;
  }

  /** Kết thúc phần thảo luận sớm (khi người chơi đã vote và muốn tua nhanh) */
  fastForwardVotes() {
    const m = this.meeting;
    if (!m || m.result || m.t < m.discussEnd) return;
    for (const [id] of m.voteAt) {
      if (!m.votes.has(id) && this.agents[id].alive) m.votes.set(id, this.botVote(this.agents[id]));
    }
  }

  private tally() {
    const m = this.meeting!;
    // Producer bot bảo lãnh người đang bị dồn phiếu mà mình tin là trong sạch (hoặc chính mình)
    for (const a of this.agents) {
      if (a.dept !== 'producer' || a.role !== 'crew' || !a.alive || (a.human)) continue;
      const count = new Map<number, number>();
      for (const [, t] of m.votes) if (t !== 'skip') count.set(t, (count.get(t) ?? 0) + 1);
      const ranked = [...count.entries()].sort((p, q) => q[1] - p[1]).map(([id]) => id);
      const choice = ranked.find(id => id !== a.prodLast && (id === a.id || (a.brain.sus.get(id) ?? 0) < 18));
      m.protect = choice ?? null;
    }
    const tally = new Map<number | 'skip', number[]>();
    for (const [voter, t] of m.votes) {
      if (!tally.has(t)) tally.set(t, []);
      tally.get(t)!.push(voter);
    }
    // Director đã công bố chức vụ: phiếu tính gấp đôi
    const weight = (v: number) => (this.agents[v].directorRevealed ? 2 : 1);
    let max = 0, top: (number | 'skip')[] = [];
    for (const [t, vs] of tally) {
      const w = vs.reduce((acc, v) => acc + weight(v), 0);
      if (w > max) { max = w; top = [t]; }
      else if (w === max) top.push(t);
    }
    const tie = top.length > 1;
    let ejected = !tie && top.length === 1 && top[0] !== 'skip' ? (top[0] as number) : null;
    // Producer đã bảo lãnh đúng người bị bầu: hủy lệnh sa thải
    let saved: number | undefined;
    if (ejected !== null && m.protect === ejected) { saved = ejected; ejected = null; }
    m.result = { ejected, tie, tally, saved };
  }

  /** Gọi sau khi màn hình đuổi việc chạy xong */
  finishMeeting() {
    const m = this.meeting;
    if (!m || !m.result) return;
    for (const a of this.agents) if (a.dept === 'producer') a.prodLast = m.protect;
    if (m.result.ejected !== null) {
      const e = this.agents[m.result.ejected];
      e.alive = false;
      e.ejected = true;
      for (const a of this.agents) if (a.brain.witnessed === e.id) a.brain.witnessed = null;
      if (e.role === 'crew' && e.dept === 'gd') {
        this.meeting = null; this.bodies = [];
        this.phase = 'play';
        this.endGame('gd', fmt('win.gd', { name: e.name, id: e.empId }));
        return;
      }
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
      if (a.role === 'impostor') a.killCd = this.killCdBase * this.killCdAfterMeeting;
      if (a.dept === 'climber' && a.role === 'crew') a.killCd = CLIMBER_CD;
      if (a.dept === 'tester') { a.testTarget = null; a.testLog = []; a.testUsed = false; a.testLast = null; }
      if (a.alive) {
        const sp = tileCenter(SPAWNS[si % SPAWNS.length].x, SPAWNS[si % SPAWNS.length].y);
        si++;
        a.x = sp.x; a.y = sp.y;
      }
    }
    // Chọn nơi xuất hiện (kiểu Airship): mỗi người 3 lựa chọn ngẫu nhiên riêng, không ai biết người khác chọn gì
    this.spawnOffers.clear();
    if (this.spawnChoice) {
      this.spawnUsed = new Map();
      for (const a of this.agents) {
        if (!a.alive) continue;
        // Phòng họp luôn có (lựa chọn đầu tiên), cộng 2 điểm ngẫu nhiên trong các điểm còn lại
        const meet = SPAWN_POINTS.findIndex(sp => sp.id === 'meeting');
        const others = [...SPAWN_POINTS.keys()].filter(i => i !== meet).sort(() => this.rng() - 0.5).slice(0, 2);
        const offers = [meet, ...others];
        if (a.human) { this.spawnOffers.set(a.id, offers); continue; } // người thật tự chọn trên màn hình của mình
        this.placeAtSpawn(a, this.botSpawnPick(a, offers));
      }
    }
    this.emergencyCd = 15;
    this.sabCd = Math.max(this.sabCd, 15);
    this.phase = 'play';
    this.checkWin();
  }

  /** Thời gian bot làm một bước việc: theo thời gian thật của mini-game (đo bằng phòng thử), ±20% */
  stepTime(kind: string) { return (MINI_TIME[kind] ?? 7) * (0.8 + this.rng() * 0.4); }

  /** Lựa chọn nơi xuất hiện đang chờ người chơi (chỉ số trong SPAWN_POINTS), null nếu không có */
  spawnOffers = new Map<number, number[]>();
  /** Lựa chọn của người chơi trên máy này */
  get spawnOffer(): number[] | null { return this.spawnOffers.get(this.meId) ?? null; }
  /** Bật/tắt luật chọn nơi xuất hiện (để so sánh cân bằng) */
  spawnChoice = true;
  private spawnUsed = new Map<number, number>();
  /** Người chơi chọn nơi xuất hiện (i: vị trí trong 3 lựa chọn; -1 = hết giờ, ở lại Phòng họp) */
  chooseSpawn(i: number) { this.chooseSpawnFor(this.player, i); }
  chooseSpawnFor(a: Agent, i: number) {
    const offer = this.spawnOffers.get(a.id);
    if (!offer) return;
    this.spawnOffers.delete(a.id);
    const pick = offer[i >= 0 && i < offer.length ? i : 0];
    this.placeAtSpawn(a, pick);
  }
  /** Bot chọn điểm cùng tầng với việc kế tiếp; không có thì chọn ngẫu nhiên */
  private botSpawnPick(a: Agent, offers: number[]): number {
    const next = a.tasks.find(t => !t.done);
    if (next) {
      const st = station(slotStation(next));
      const lv = levelAt((st.stand.x + 0.5) * TILE, (st.stand.y + 0.5) * TILE);
      const same = offers.filter(o => SPAWN_POINTS[o].level === lv);
      if (same.length) return same[Math.floor(this.rng() * same.length)];
    }
    return offers[Math.floor(this.rng() * offers.length)];
  }
  /** Đặt người vào điểm xuất hiện, rải ra các ô quanh điểm để không chồng lên nhau */
  private placeAtSpawn(a: Agent, idx: number) {
    const sp = SPAWN_POINTS[idx];
    const n = this.spawnUsed.get(idx) ?? 0;
    this.spawnUsed.set(idx, n + 1);
    const ring: [number, number][] = [[0, 0], [1, 0], [-1, 0], [0, 1], [1, 1], [-1, 1], [0, -1], [2, 0], [-2, 0], [2, 1]];
    for (let k = 0; k < ring.length; k++) {
      const [dx, dy] = ring[(n + k) % ring.length];
      const c = tileCenter(sp.x + dx, sp.y + dy);
      if (canStand(c.x, c.y)) { this.teleport(a, (c.x) / TILE, (c.y) / TILE); return; }
    }
    const c = tileCenter(sp.x, sp.y); this.teleport(a, c.x / TILE, c.y / TILE);
  }

  private endGame(winner: Winner, reason: string) {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.winner = winner;
    this.winReason = reason;
    this.events.push({ type: 'gameover', winner, reason });
  }

  checkWin() {
    if (this.phase === 'ended' || this.phase === 'meeting') return;
    const imp = this.aliveImp().length, crew = this.aliveCrew().length;
    const climber = this.agents.find(a => a.alive && a.role === 'crew' && a.dept === 'climber');
    const aliveAll = this.agents.filter(a => a.alive).length;
    // Intern tham vọng: chỉ còn hắn và tối đa một người
    if (climber && aliveAll <= 2) { this.endGame('climber', fmt('win.climber', { name: climber.name, id: climber.empId })); return; }
    if (imp === 0 && !climber) { this.endGame('crew', fmt('win.crew.vote')); return; }
    if (imp > 0 && imp >= crew && !climber) { this.endGame('impostor', fmt('win.impostor.majority')); return; }
    const k = this.crewTasksDone();
    if (k.total > 0 && k.done >= k.total) this.endGame('crew', fmt('win.crew.kpi'));
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}

export type { MiniKind };
