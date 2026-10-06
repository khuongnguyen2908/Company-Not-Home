// Kiểm tra: (A) bot không chat / không tự bỏ phiếu thay người thật; (B) bị gỡ vì mất tín hiệu mà vẫn còn đó thì được trả nhân vật;
// (C) gói trạng thái dồn dập: máy người vào phòng áp gói mới nhất một lần, không mất sự kiện. Cách dùng: npx tsx tests/net_fix_test.ts
import { World } from '../src/game/sim';
import { randomLook } from '../src/game/look';
import { buildFull } from '../src/net/snapshot';
import { setup, actA, ok, finish } from './net_setup';

async function main() {
  console.log('A · Bot không nói thay người thật');
  for (let g = 0; g < 30; g++) {
    const w = new World({ playerName: 'T', playerLook: randomLook(), roles: {}, maxSpecial: 0, playerRole: 'crew', bots: 7, impostors: 1, seed: 7700 + g, headless: true });
    w.setHuman(1, true); w.setHuman(1, false); // người thật mất kết nối, bot tạm cầm lái
    for (const a of w.agents) if (a.id !== 1) a.brain.witnessed = 1; // ai cũng "thấy" #1 để dụ bot nói về/thay #1
    w.agents[1].brain.witnessed = 2;
    w.emergencyCd = 0; w.startMeeting(1, null, 'bell');
    const m = w.meeting!;
    if (m.queue.some(q => q.from === 1)) { ok(false, `ván ${g}: bot xếp câu nói dưới tên người thật`); break; }
    m.t = m.discussEnd + 0.1; for (let i = 0; i < 30 * 40 && !m.result; i++) w.update(1 / 30);
    if (m.chat.some(c => c.from === 1 && !c.system)) { ok(false, `ván ${g}: có câu chat dưới tên người thật`); break; }
    if (m.votes.has(1) && m.votes.get(1) !== 'skip') { ok(false, `ván ${g}: bot tự bỏ phiếu thay người thật (${m.votes.get(1)})`); break; }
    if (g === 29) ok(true, '30 cuộc họp: không câu nào dưới tên người thật, phiếu của ghế đó luôn là "bỏ qua"');
  }

  console.log('B · Bị gỡ vì mất tín hiệu nhưng vẫn còn đó');
  { const c = await setup(81, 'intern');
    let gotNote = false, gotStart = false;
    c.A.tr.onMessage((_f, m) => { const x = m as { t: string; text?: string }; if (x.t === 'note' && x.text?.includes('trả lại nhân vật')) gotNote = true; if (x.t === 'start') gotStart = true; });
    c.host.dropPeer('A'); // chủ phòng tưởng A đã rời (mất tín hiệu)
    ok(!c.w.agents[1].human, 'chủ phòng gỡ A: bot tạm cầm lái nhân vật #1');
    await c.run(1.5); // A vẫn gửi nhịp tim như bình thường
    ok(c.w.agents[1].human && c.host.players.some(p => p.peer === 'A'), 'A vẫn gửi tin tới: được trả lại đúng nhân vật #1');
    ok(gotStart && gotNote, 'A nhận lại toàn bộ trạng thái ván và thông báo "đã trả lại nhân vật"');
    c.inputA = { x: 1, y: 0 }; const x0 = c.w.agents[1].x; await c.run(1); c.inputA = { x: 0, y: 0 };
    ok(c.w.agents[1].x > x0 + 20, 'A điều khiển lại được nhân vật');
    c.A.tr.send('H', { t: 'leave' }); await c.run(0.3); await c.run(1.5);
    ok(!c.w.agents[1].human && !c.host.players.some(p => p.peer === 'A'), 'A tự rời phòng: không bị kéo lại'); }

  console.log('C · Gói trạng thái dồn dập');
  { const c = await setup(82, 'intern');
    const r = c.A.replica!; const ev0 = c.evA.length;
    let flushes = 0; const f0 = c.A.flush.bind(c.A);
    (c.A as unknown as { flush: () => void }).flush = () => { const had = (c.A as unknown as { pendFull: unknown }).pendFull; f0(); if (had) flushes++; };
    for (let i = 0; i < 40; i++) {
      if (i === 39) c.w.doorLocks.set('hr' as never, 9); // chỉ gói cuối cùng có thay đổi này
      const ev = i % 10 === 0 ? [{ type: 'sabotage_end' } as never] : undefined;
      c.host.tr.send('A', ev ? { t: 'full', full: buildFull(c.w, 1), ev } : { t: 'full', full: buildFull(c.w, 1), p: 1 });
    }
    await c.run(0.3);
    ok(r === c.A.replica && c.A.replica!.doorLocks.has('hr' as never), 'máy A có trạng thái của gói mới nhất');
    ok(flushes <= 6, `40 gói nhưng chỉ áp ${flushes} lần (mỗi khung hình nhiều nhất một lần), trình duyệt không bị đơ`);
    const evGot = c.evA.slice(ev0).filter(e => (e as { type: string }).type === 'sabotage_end').length;
    const inReplica = r.events.length >= 0;
    ok(evGot === 4 && inReplica, `không mất sự kiện kèm theo (${evGot}/4)`);
    c.a.itCd = 0; c.a.dept = 'it' as never;
    const err = await actA(c, 'useLaptop');
    ok(err === null && c.A.replica!.player.itCamT > 0, 'kết quả lệnh tới sau trạng thái mới: máy A thấy đúng ngay'); }
  finish();
}
void main();
