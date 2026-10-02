// Đo thời gian đổi tầng: thang bộ (đi bộ thật qua giếng thang) và thang máy (bot đi thang máy trong mô phỏng)
import { findPath } from '../src/game/path';
import { tileCenter, FLOORS } from '../src/game/map';
import { SPEED, World } from '../src/game/sim';
import { randomLook } from '../src/game/look';
const front = (lv: number) => ({ x: FLOORS[lv - 1].ox + 20, y: FLOORS[lv - 1].oy + 11 });
const walk = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const p = findPath(tileCenter(a.x, a.y), b)!; let len = 0, prev = tileCenter(a.x, a.y);
  for (const q of p) { const d = Math.hypot(q.x - prev.x, q.y - prev.y); if (d < 3 * 48) len += d; prev = q; }
  return len / SPEED;
};
for (const [a, b] of [[1, 2], [1, 3], [2, 3]]) console.log(`Thang bộ tầng ${a} → ${b}: ${walk(front(a), front(b)).toFixed(1)}s`);
// Thang máy: một bot đứng trước cửa, buồng đang đứng sẵn ở tầng đó
for (const [a, b] of [[1, 2], [1, 3], [2, 3]]) for (const ready of [true, false]) {
  const w = new World({ playerName: 'T', playerLook: randomLook(), roles: {}, maxSpecial: 0, playerRole: 'crew', bots: 4, impostors: 1, seed: 1, headless: true, liftUse: 1 });
  w.time = 30;
  const bot = w.agents.find(x => x.role === 'crew' && !x.isPlayer)!;
  for (const o of w.agents) if (o !== bot) { o.alive = false; o.x = 5 * 48; o.y = 30 * 48; } // dọn người khác cho khỏi vướng
  const f = front(a); bot.x = (f.x - 3.5) * 48 + 24; bot.y = (f.y + 1) * 48 + 24;
  w.lift.pos = ready ? a : (a === 1 ? 3 : 1); w.lift.open = true; w.lift.doorT = 3;
  const dest = { x: FLOORS[b - 1].ox + 16, y: FLOORS[b - 1].oy + 11 };
  (w as any).goTo(bot, dest, 'test');
  let t = 0;
  while (t < 30) { (w as any).liftTick(1 / 30); (w as any).portalTick(bot, 1 / 30); (w as any).followPath(bot, 1 / 30); if (bot.brain.lift && !bot.brain.path.length && bot.brain.lift.stage === 'walk') (w as any).liftStep(bot, 0); t += 1 / 30; if (Math.floor(bot.y / 48) === dest.y && Math.abs(Math.floor(bot.x / 48) - dest.x) <= 1 && !bot.brain.lift) break; }
  console.log(`Thang máy tầng ${a} → ${b} (${ready ? 'buồng có sẵn' : 'phải chờ buồng'}): ${t.toFixed(1)}s`);
}
