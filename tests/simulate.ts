// Chạy thử hàng loạt ván đấu toàn bot để kiểm tra luật chơi không bị kẹt
import { World } from '../src/game/sim';
import { STATIONS, DESKS, HIDE_SPOTS, SPAWNS, tileCenter } from '../src/game/map';
import { findPath } from '../src/game/path';
import { randomLook } from '../src/game/look';

const from = tileCenter(SPAWNS[0].x, SPAWNS[0].y);
const targets = [
  ...STATIONS.map(s => [s.id, s.stand] as const),
  ...DESKS.map((d, i) => ['desk' + i, d.seat] as const),
  ...HIDE_SPOTS.map(h => [h.id, { x: h.x, y: h.y }] as const),
  ...SPAWNS.map((s, i) => ['spawn' + i, s] as const),
];
let bad = 0, maxLen = 0;
for (const [name, t] of targets) {
  const p = findPath(from, t);
  if (!p) { console.log('KHÔNG TỚI ĐƯỢC:', name, t); bad++; }
  else maxLen = Math.max(maxLen, p.length);
}
console.log(`Kiểm tra đường đi: ${targets.length - bad}/${targets.length} điểm OK, đường xa nhất ${maxLen} ô`);

const N = Number(process.argv[2] ?? 60);
const ROLES = process.argv[3] ?? 'all';
const ab = { hrUsed: 0, hrResults: 0, hrHits: 0, dirReveal: 0, hrClaims: 0, hrKilledPending: 0, doorLocks: 0, doorSwipes: 0, poCalls: 0, producerSaves: 0, backupsUsed: 0, artistChecks: 0, artistHas: 0 };
const stats: Record<string, number> = {};
let totalTime = 0, meetings = 0, stuck = 0;
for (let g = 0; g < N; g++) {
  const on = ROLES !== 'none';
  const roles = { hr: on, director: on, it: on, po: on, producer: on, developer: on, artist: on, sound: on, admin: on, engineer: on, media: on, animator: on, tester: on, gd: on, climber: on };
  const w = new World({ playerName: 'Test', playerLook: randomLook(), roles, maxSpecial: ROLES === 'all' ? 7 : 3, playerRole: 'random', bots: 7, impostors: g % 3 === 0 ? 2 : 1, seed: g + 1, headless: true });
  const dt = 1 / 30;
  let steps = 0;
  while (w.phase !== "ended" && steps < 30 * 60 * 40) { // 40 phút tính cả họp; quá mức này mới là kẹt thật
    w.update(dt);
    if (w.phase === 'meeting' && w.meeting?.result) { ab.hrClaims += w.meeting.hrClaims.length; if (w.meeting.result.saved !== undefined) ab.producerSaves++; w.finishMeeting(); }
    for (const e of w.drainEvents()) {
      if (e.type === 'hr_sent') ab.hrUsed++;
      if (e.type === 'hr_result') { ab.hrResults++; if (e.imp) ab.hrHits++; }
      if (e.type === 'director_reveal') ab.dirReveal++;
      if (e.type === 'doors' && e.locked) ab.doorLocks++;
      if (e.type === 'backup_used') ab.backupsUsed++;
      if (e.type === 'artist_result') { ab.artistChecks++; if (e.has) ab.artistHas++; }
      if (e.type === 'meeting' && w.meeting?.via === 'po') ab.poCalls++;
      if (e.type === 'doors' && !e.locked && e.by !== null) ab.doorSwipes++;
    }
    steps++;
  }
  meetings += w.meetingCount;
  if (w.phase !== 'ended') { stuck++; continue; }
  const key = `${w.winner}: ${w.winReason.slice(0, 40)}`;
  stats[key] = (stats[key] ?? 0) + 1;
  totalTime += w.time;
}
console.log(stats);
console.log(`Thời gian chơi TB (không tính họp): ${(totalTime / Math.max(1, N - stuck)).toFixed(0)}s, số cuộc họp TB: ${(meetings / N).toFixed(1)}, ván bị kẹt: ${stuck}`);

console.log('Năng lực:', ab);
