// Chỉnh ván ít người: chạy N ván bot với bộ chỉnh ít người, thay số việc ngắn và hồi chiêu gài
// Cách dùng: npx tsx tests/tune_small.ts <số người> <việc ngắn> <hồi chiêu> <N> [seed]
import { World, setSmallShortTasks } from '../src/game/sim';
import { randomLook } from '../src/game/look';
import { SPECIAL_ROLES } from '../src/game/data';
const players = Number(process.argv[2] ?? 5), shortN = Number(process.argv[3] ?? 4), cd = Number(process.argv[4] ?? 0), N = Number(process.argv[5] ?? 100), seed0 = Number(process.argv[6] ?? 9000);
setSmallShortTasks(shortN);
const roles = Object.fromEntries(SPECIAL_ROLES.map(r => [r, true]));
let imp = 0, kpi = 0, vote = 0, total = 0, stuck = 0, meetings = 0, ejectImp = 0;
for (let g = 0; g < N; g++) {
  const w = new World({ playerName: 'T', playerLook: randomLook(), roles, maxSpecial: 3, playerRole: 'random', bots: players - 1, impostors: 1, seed: seed0 + g, headless: true, killCd: cd || undefined });
  let steps = 0;
  while (w.phase !== 'ended' && steps < 30 * 60 * 40) {
    w.update(1 / 30);
    if (w.phase === 'meeting' && w.meeting?.result) { if (w.meeting.result.ejected !== null && w.agents[w.meeting.result.ejected].role === 'impostor') ejectImp++; w.finishMeeting(); }
    steps++;
  }
  if (w.phase !== 'ended') { stuck++; continue; }
  meetings += w.meetingCount;
  if (w.winner === 'impostor') imp++; else if (w.winReason.startsWith('KPI')) kpi++; else vote++;
  total += w.time;
}
const n = N - stuck, pct = (x: number) => `${Math.round(x / Math.max(1, n) * 100)}%`.padStart(4);
console.log(`${players} người · việc ngắn ${shortN} · hồi chiêu ${cd || 'mặc định'} | Nội gián ${pct(imp)} | KPI ${pct(kpi)} vote ${pct(vote)} | ván TB ${Math.round(total / Math.max(1, n))}s | họp TB ${(meetings / Math.max(1, n)).toFixed(1)} | kẹt ${stuck}`);
