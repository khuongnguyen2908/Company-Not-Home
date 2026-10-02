import type { World, GameEvent } from './game/sim';
import type { Look } from './game/look';

export const session = {
  /** Số mục nội dung thử đang áp dụng (Công cụ nội dung) */
  contentTest: 0,
  world: null as World | null,
  input: { x: 0, y: 0 },
  paused: false, // tạm dừng khi đang mở mini-game? (không: văn phòng không bao giờ dừng)
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
    version: 0, // tăng mỗi khi danh sách người trong sảnh thay đổi
  },
};
