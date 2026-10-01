import type { World, GameEvent } from './game/sim';

export const session = {
  world: null as World | null,
  input: { x: 0, y: 0 },
  paused: false, // tạm dừng khi đang mở mini-game? (không: văn phòng không bao giờ dừng)
  onEvents: (_e: GameEvent[]) => {},
  onFrame: (_dt: number) => {},
  newGameId: 0,
  mapImage: null as CanvasImageSource | null, // ảnh bản đồ đã nướng sẵn, dùng cho camera an ninh
};
