// So sánh các phương án thang máy: sức chứa và cạy cửa khi kẹt
import { World } from '../src/game/sim';
import { randomLook } from '../src/game/look';
import { levelAt } from '../src/game/map';

function run(label: string, cap: number, pry: boolean, imps: number, bots: number, N = 120) {
  let impWin = 0, stuck = 0, total = 0, rides = 0, pries = 0, cabinKills = 0, kills = 0;
  for (let g = 0; g < N; g++) {
    const w = new World({ playerName: 'T', playerLook: randomLook(), roles: { hr: true, director: true, it: true, po: true, producer: true, developer: true, artist: true, sound: true, admin: true, engineer: true }, maxSpecial: 3, playerRole: 'random', bots, impostors: imps, seed: 900 + g, headless: true, liftCapacity: cap, liftPry: pry });
    let steps = 0;
    const inCabin = new Set<number>();
    while (w.phase !== 'ended' && steps < 30 * 60 * 15) {
      w.update(1 / 30);
      if (w.phase === 'meeting' && w.meeting?.result) w.finishMeeting();
      for (const e of w.drainEvents()) {
        if (e.type === 'lift_pry') pries++;
        if (e.type === 'kill') { kills++; if (levelAt(e.x, e.y) === 0) cabinKills++; }
      }
      if (steps % 15 === 0) for (const a of w.agents) { const inside = a.alive && levelAt(a.x, a.y) === 0; if (inside && !inCabin.has(a.id)) { rides++; inCabin.add(a.id); } if (!inside) inCabin.delete(a.id); }
      steps++;
    }
    if (w.phase !== 'ended') stuck++;
    total += w.time;
    if (w.winner === 'impostor') impWin++;
  }
  console.log(`${label.padEnd(30)} | ${bots + 1} người ${imps} NG | Nội gián thắng ${(impWin / N * 100).toFixed(0).padStart(3)}% | ván TB ${(total / N).toFixed(0)}s | kẹt ${stuck} | lượt đi thang ${(rides / N).toFixed(1)}/ván | cạy cửa ${(pries / N).toFixed(2)} | gài trong thang ${cabinKills}/${kills}`);
}
const cases: [string, number, boolean][] = [['Sức chứa 4, có cạy cửa', 4, true], ['Sức chứa 4, không cạy cửa', 4, false], ['Không giới hạn, có cạy cửa', 99, true]];
for (const [imps, bots] of [[1, 6], [2, 9]]) for (const [l, c, p] of cases) run(l, c, p, imps, bots);
