// Chạy thử hàng loạt ván đấu toàn bot để kiểm tra luật chơi không bị kẹt
import { World } from '../src/game/sim';
import { TASK_STATIONS, FIX_STATIONS, DESKS, HIDE_SPOTS, SPAWNS, tileCenter } from '../src/game/map';
import { findPath } from '../src/game/path';

// 1. Mọi điểm quan trọng phải đi tới được từ chỗ xuất phát
const from = tileCenter(SPAWNS[0].x, SPAWNS[0].y);
const targets = [
  ...TASK_STATIONS.map(s => [s.id, s.stand] as const),
  ...FIX_STATIONS.map(s => [s.id, s.stand] as const),
  ...DESKS.map((d, i) => ['desk' + i, d.seat] as const),
  ...HIDE_SPOTS.map(h => [h.id, { x: h.x, y: h.y }] as const),
  ...SPAWNS.map((s, i) => ['spawn' + i, s] as const),
];
let bad = 0;
for (const [name, t] of targets) {
  const p = findPath(from, t);
  if (!p) { console.log('KHÔNG TỚI ĐƯỢC:', name, t); bad++; }
}
console.log(`Kiểm tra đường đi: ${targets.length - bad}/${targets.length} điểm OK`);

// 2. Mô phỏng nhiều ván
const N = Number(process.argv[2] ?? 60);
const stats: Record<string, number> = {};
let totalTime = 0, meetings = 0, stuck = 0;
for (let g = 0; g < N; g++) {
  const w = new World({ playerName: 'Test', playerDept: 'it', playerRole: 'random', bots: 7, impostors: g % 3 === 0 ? 2 : 1, seed: g + 1, headless: true });
  const dt = 1 / 30;
  let steps = 0;
  while (w.phase !== 'ended' && steps < 30 * 60 * 15) {
    w.update(dt);
    if (w.phase === 'meeting' && w.meeting?.result) w.finishMeeting();
    w.drainEvents();
    steps++;
  }
  meetings += w.meetingCount;
  if (w.phase !== 'ended') { stuck++; continue; }
  const key = `${w.winner}: ${w.winReason.slice(0, 40)}`;
  stats[key] = (stats[key] ?? 0) + 1;
  totalTime += w.time;
}
console.log(stats);
console.log(`Thời gian chơi trung bình: ${(totalTime / (N - stuck)).toFixed(0)}s, số cuộc họp TB: ${(meetings / N).toFixed(1)}, ván bị kẹt: ${stuck}`);
