import type { World, GameEvent } from './game/sim';
import type { Look } from './game/look';

export const session = {
  /** Số mục nội dung thử đang áp dụng (Công cụ nội dung) */
  contentTest: 0,
  world: null as World | null,
  input: { x: 0, y: 0 },
  paused: false,
  /** Hẹn giờ quan trọng của ván (màn giới thiệu họp, kết quả bầu, đếm ngược vào ca...): chạy bằng setTimeout VÀ được
   *  máy bơm nhịp nền kiểm mỗi 50 ms, nên không bị trình duyệt hãm khi tab chủ phòng bị ẩn. Mỗi hẹn chỉ chạy một lần. */
  timers: [] as { at: number; fn: () => void; done: boolean }[],
  later(fn: () => void, ms: number) {
    const t = { at: performance.now() + ms, fn, done: false };
    this.timers.push(t);
    const fire = () => { if (t.done) return; t.done = true; this.timers = this.timers.filter(x => x !== t); fn(); };
    (t as { fire?: () => void }).fire = fire;
    globalThis.setTimeout(fire, ms);
    return { cancel: () => { t.done = true; this.timers = this.timers.filter(x => x !== t); } };
  },
  runDue() { const now = performance.now(); for (const t of [...this.timers]) if (!t.done && now >= t.at) (t as { fire?: () => void }).fire?.(); },
  /** thống kê ván đang chơi (chơi một mình / chủ phòng); null ở máy người vào phòng */
  gameStats: null as null | import('./game/stats').GameStats,
  /** thời điểm khung hình gần nhất của cảnh vẽ (máy bơm nhịp dùng để biết tab có đang bị ẩn không) */
  lastFrameAt: 0, // tạm dừng khi đang mở mini-game? (không: văn phòng không bao giờ dừng)
  onEvents: (_e: GameEvent[]) => {},
  onFrame: (_dt: number) => {},
  newGameId: 0,
  mapImage: null as CanvasImageSource | null, // ảnh bản đồ đã nướng sẵn, dùng cho camera an ninh
  phaser: null as import('phaser').Game | null,
  /** Sảnh chờ tầng G */
  lobby: {
    me: { name: '', look: null as Look | null, empId: '' },
    bots: [] as { name: string; look: Look; empId: string }[],
    near: null as null | 'wardrobe' | 'board' | 'elevator',
    /** Món đồ đang đứng gần (biển lớn hoặc tương tác nhỏ) để nút chính đổi icon/chữ */
    nearInfo: null as null | { key: string; icon: string; label: string; big: boolean },
    version: 0, // tăng mỗi khi danh sách người trong sảnh thay đổi
    /** Thông tin hiện trên màn hình phòng và bảng Nhân viên của tháng */
    info: { title: 'Phòng offline', people: 1, max: 1, imps: 1, roles: 0, wins: 0, played: 0, streak: 0 },
    /** Tin chat trong sảnh (sảnh báo lên giao diện để ghi vào khung chat) */
    onChat: null as null | ((m: { name: string; empId: string; text: string; me: boolean }) => void),
    /** Sảnh online: người khác trong phòng (mã máy → hồ sơ + trạng thái), do giao diện cập nhật từ mạng */
    online: false,
    remote: new Map<string, { name: string; empId: string; look: import('./game/look').Look; lost: boolean; s: import('./net/room').LobbyState | null }>(),
    /** sảnh gửi trạng thái của mình / báo mình vừa chat, nghịch đồ (giao diện chuyển lên mạng) */
    sendState: null as null | ((s: import('./net/room').LobbyState, ms: number) => void),
    sendChat: null as null | ((text: string) => void),
    sendFx: null as null | ((key: string) => void),
  },
};
