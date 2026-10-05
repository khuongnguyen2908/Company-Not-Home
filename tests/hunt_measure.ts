// Cách dùng: npx tsx tests/hunt_measure.ts [số ván]
// Đo (không sửa game): hồi chiêu xong rồi thì Nội gián mất bao lâu mới gài được; tỉ lệ thắng; ván thua vì KPI chạy xong khi nào
import { World } from '../src/game/sim';
import { randomLook } from '../src/game/look';
import { SPECIAL_ROLES } from '../src/game/data';
const roles = Object.fromEntries(SPECIAL_ROLES.map(r => [r, true]));
const N = Number(process.argv[2] ?? 120);
for (const [total, imps, cd] of [[8, 1, 0], [8, 2, 0], [8, 1, 25], [8, 2, 25], [10, 2, 25]] as [number, number, number][]) {
  const waits: number[] = []; let impWin = 0, kpiLoss = 0, games = 0; const kpiT: number[] = [];
  for (let g = 0; g < N; g++) {
    const w = new World({ playerName: 'T', playerLook: randomLook(), roles, maxSpecial: 3, playerRole: 'random', bots: total - 1, impostors: imps, seed: 70000 + g, headless: true, killCd: cd || undefined });
    const readyAt = new Map<number, number>();
    let steps = 0;
    while (w.phase !== 'ended' && steps < 30 * 60 * 40) {
      const ph = w.phase;
      w.update(1 / 30); steps++;
      // xử lý sự kiện gài bẫy TRƯỚC (hồi chiêu được đặt lại ngay trong khung hình gài)
      for (const e of w.drainEvents()) if (e.type === 'kill' && readyAt.has(e.killer)) { waits.push(w.time - readyAt.get(e.killer)!); readyAt.delete(e.killer); }
      if (w.phase === 'meeting') readyAt.clear();
      else if (ph === 'play') for (const a of w.agents) if (a.role === 'impostor' && a.alive && a.killCd <= 0 && !readyAt.has(a.id)) readyAt.set(a.id, w.time);
      if (w.phase === 'meeting' && w.meeting?.result) w.finishMeeting();
    }
    games++;
    if (w.winner === 'impostor') impWin++;
    else if (w.winner === 'crew' && w.winReason.startsWith('KPI')) { kpiLoss++; kpiT.push(w.time); }
  }
  const avg = (a: number[]) => a.length ? (a.reduce((x, y) => x + y, 0) / a.length) : 0;
  const med = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
  console.log(`${total} người ${imps} NG, hồi chiêu ${cd || 'tự động'}: Nội gián thắng ${Math.round(impWin / games * 100)}% | thua vì KPI ${Math.round(kpiLoss / games * 100)}% (KPI xong lúc TB ${avg(kpiT).toFixed(0)}s chơi) | sẵn sàng → gài được: TB ${avg(waits).toFixed(1)}s, trung vị ${med(waits).toFixed(1)}s (${waits.length} lần)`);
}
