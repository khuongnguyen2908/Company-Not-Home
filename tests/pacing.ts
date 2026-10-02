// Đo nhịp gài bẫy và cân bằng theo số người / số Nội gián (cài đặt mặc định)
import { World } from '../src/game/sim';
import { randomLook } from '../src/game/look';

const N = Number(process.argv[2] ?? 100);
for (const [bots, imps] of [[5, 1], [7, 1], [7, 2], [9, 2]]) {
  let impWins = 0, total = 0, firstKill = 0, gaps: number[] = [];
  for (let g = 0; g < N; g++) {
    const w = new World({ playerName: 'T', playerLook: randomLook(), roles: { hr: true, director: true, it: true, po: true, producer: true, developer: true, artist: true }, maxSpecial: 4, playerRole: 'random', bots, impostors: imps, seed: 3000 + g, headless: true });
    let steps = 0, first = -1, last = -1;
    while (w.phase !== 'ended' && steps < 30 * 60 * 20) {
      w.update(1 / 30);
      if (w.phase === 'meeting' && w.meeting?.result) w.finishMeeting();
      for (const e of w.drainEvents()) if (e.type === 'kill') { if (first < 0) first = w.time; if (last >= 0) gaps.push(w.time - last); last = w.time; }
      steps++;
    }
    total += w.time; if (first >= 0) firstKill += first;
    if (w.winner === 'impostor') impWins++;
  }
  gaps.sort((a, b) => a - b);
  console.log(`${bots + 1} người, ${imps} Nội gián: Nội gián thắng ${(impWins / N * 100).toFixed(0)}% | thời gian chơi TB ${(total / N).toFixed(0)}s (chưa tính họp) | vụ đầu ${(firstKill / N).toFixed(0)}s | giãn cách 2 vụ ${gaps.length ? gaps[Math.floor(gaps.length / 2)].toFixed(0) : '-'}s`);
}
