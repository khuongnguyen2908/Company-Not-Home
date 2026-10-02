// Cân bằng theo cỡ ván: chạy N ván bot với bộ vai mặc định, in tỉ lệ thắng từng phe
// Cách dùng: npx tsx tests/balance.ts <số người> <số Nội gián> <N> [seed]
import { World } from '../src/game/sim';
import { randomLook } from '../src/game/look';
import { SPECIAL_ROLES } from '../src/game/data';

const players = Number(process.argv[2] ?? 8), imps = Number(process.argv[3] ?? 1), N = Number(process.argv[4] ?? 60), seed0 = Number(process.argv[5] ?? 5000);
const cdArg = process.argv[6] ? Number(process.argv[6]) : undefined;
const roles = Object.fromEntries(SPECIAL_ROLES.map(r => [r, true]));
const win: Record<string, number> = {};
let total = 0, stuck = 0, kpi = 0, ejectImp = 0, firstKill = 0;
for (let g = 0; g < N; g++) {
  const w = new World({ playerName: 'T', playerLook: randomLook(), roles, maxSpecial: 3, playerRole: 'random', bots: players - 1, impostors: imps, seed: seed0 + g, headless: true, killCd: cdArg });
  let steps = 0, first = -1;
  while (w.phase !== 'ended' && steps < 30 * 60 * 15) {
    w.update(1 / 30);
    if (w.phase === 'meeting' && w.meeting?.result) w.finishMeeting();
    for (const e of w.drainEvents()) if (e.type === 'kill' && first < 0) first = w.time;
    steps++;
  }
  if (w.phase !== 'ended') { stuck++; continue; }
  const k = w.winReason.startsWith('KPI') ? 'crew-kpi' : w.winner === 'crew' ? 'crew-vote' : String(w.winner);
  win[k] = (win[k] ?? 0) + 1;
  total += w.time; if (first >= 0) firstKill += first;
}
const pct = (n = 0) => `${Math.round(n / N * 100)}%`.padStart(4);
const imp = win.impostor ?? 0, crew = (win['crew-kpi'] ?? 0) + (win['crew-vote'] ?? 0);
console.log(`${String(players).padStart(2)} người ${imps} NG${cdArg ? ' cd' + cdArg : ''} | Nội gián ${pct(imp)} | Nhân viên ${pct(crew)} (KPI ${pct(win['crew-kpi'])}, vote ${pct(win['crew-vote'])}) | phe 3 ${pct((win.gd ?? 0) + (win.climber ?? 0))} | ván TB ${Math.round(total / Math.max(1, N - stuck))}s | vụ đầu ${Math.round(firstKill / N)}s | kẹt ${stuck}`);
