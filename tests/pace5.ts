// Đo nhịp ván 5 người: 1 Nội gián + 3 nhân viên thường + 1 nhân viên có kỹ năng.
// Tính cả thời gian họp thật (thảo luận + bỏ phiếu + màn kết quả 4,8 giây + chọn nơi bắt đầu ~5 giây).
// Cách dùng: npx tsx tests/pace5.ts <N> <seed> [hồi chiêu] [hồi chiêu đầu ván]
import { World } from '../src/game/sim';
import { randomLook } from '../src/game/look';
import { SPECIAL_ROLES, NEUTRAL_ROLES } from '../src/game/data';
const N = Number(process.argv[2] ?? 150), seed0 = Number(process.argv[3] ?? 1);
const cd = process.argv[4] ? Number(process.argv[4]) : undefined, first = process.argv[5] ? Number(process.argv[5]) : undefined;
const roles = Object.fromEntries(SPECIAL_ROLES.filter(r => !(r in NEUTRAL_ROLES)).map(r => [r, true]));
const res = { imp: 0, kpi: 0, vote: 0, other: 0 };
const play: number[] = [], full: number[] = [], fk: number[] = [], fm: number[] = [], meets: number[] = [];
const kinds: Record<string, number> = {};
let stuck = 0;
for (let g = 0; g < N; g++) {
  const w = new World({ playerName: 'T', playerLook: randomLook(), roles, maxSpecial: 1, playerRole: 'random', bots: 4, impostors: 1, seed: seed0 + g, headless: true, killCd: cd, killFirst: first });
  let playT = 0, meetT = 0, firstKill = -1, firstMeet = -1, nMeet = 0, steps = 0;
  while (w.phase !== 'ended' && steps < 30 * 60 * 25) {
    const dt = 1 / 30;
    const wasMeeting = w.phase === 'meeting';
    w.update(dt); steps++;
    if (wasMeeting) meetT += dt; else playT += dt;
    if (w.phase === 'meeting' && w.meeting?.result) { meetT += 4.8 + 5; w.finishMeeting(); if (w.spawnOffer) w.chooseSpawn(-1); }
    for (const e of w.drainEvents()) {
      if (e.type === 'kill' && firstKill < 0) firstKill = playT;
      if (e.type === 'meeting') { nMeet++; if (firstMeet < 0) { firstMeet = playT; const v = w.meeting?.via ?? '?'; kinds[v] = (kinds[v] ?? 0) + 1; } }
    }
  }
  if (w.phase !== 'ended') { stuck++; continue; }
  if (w.winner === 'impostor') res.imp++; else if (w.winner === 'crew') { if (w.winReason.startsWith('KPI')) res.kpi++; else res.vote++; } else res.other++;
  play.push(playT); full.push(playT + meetT); meets.push(nMeet);
  if (firstKill >= 0) fk.push(firstKill); if (firstMeet >= 0) fm.push(firstMeet);
}
const n = N - stuck, pct = (x: number) => `${Math.round(x / n * 100)}%`;
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
console.log(JSON.stringify({
  cauHinh: cd ? `hồi chiêu ${cd}s, đầu ván ${first ?? Math.round(cd / 2)}s` : 'thông số hiện tại',
  ván: n, kẹt: stuck,
  nộiGiánThắng: pct(res.imp), nhânViênThắng: pct(res.kpi + res.vote), trongĐóKPI: pct(res.kpi), trongĐóVote: pct(res.vote),
  vụGàiĐầu: mmss(avg(fk)), cuộcHọpĐầu: mmss(avg(fm)), lýDoHọpĐầu: kinds, sốCuộcHọp: avg(meets).toFixed(1),
  thờiGianChơiKhôngTínhHọp: mmss(avg(play)), cảVánTínhHọp: mmss(avg(full)),
}));
