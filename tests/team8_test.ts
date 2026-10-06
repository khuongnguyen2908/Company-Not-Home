// Đợt sửa sau buổi team test (8 điểm): bot nói thay người, vai người bị sa thải, gói thay đổi, chơi lại.
// Cách dùng: npx tsx tests/team8_test.ts
import { World } from '../src/game/sim';
import { randomLook } from '../src/game/look';
import { runAction } from '../src/net/actions';
import { type ToClient } from '../src/net/room';
import { session } from '../src/session';
import { setup, ok, finish, type Ctx } from './net_setup';

async function meet(c: Ctx) { c.w.emergencyCd = 0; c.w.startMeeting(0, null, 'bell'); await c.run(0.5); }

async function main() {
  console.log('1. Bot không nói thay người thật (kể cả khi bị nhắc tên trong chat)');
  {
    let bad = 0, total = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const w = new World({ playerName: 'Chủ', playerLook: randomLook(), roles: {}, maxSpecial: 3, playerRole: 'crew', bots: 7, impostors: 1, seed });
      w.setHuman(1, true); w.setHuman(2, true);
      for (let t = 0; t < 300; t++) { w.update(0.033); w.drainEvents(); }
      w.startMeeting(0, null, 'bell');
      for (const h of [0, 1, 2]) for (const o of [0, 1, 2]) if (o !== h) w.chatFrom(w.agents[h], `${w.agents[o].name} #${w.agents[o].empId} sus quá`);
      for (let t = 0; t < 30 * 60; t++) w.updateMeeting(0.033);
      for (const c of w.meeting!.chat) { if (c.system) continue; total++; if (w.agents[c.from].human && !/sus quá/.test(c.text)) bad++; }
    }
    ok(bad === 0, `40 cuộc họp, ${total} tin: không tin nào bot nói thay người thật (${bad})`);
    // ghế người thật đang tạm do bot cầm lái (rớt mạng) rồi quay lại: không bị bot tự bỏ phiếu thay
    const w = new World({ playerName: 'Chủ', playerLook: randomLook(), roles: {}, maxSpecial: 0, playerRole: 'crew', bots: 7, impostors: 1, seed: 9 });
    w.setHuman(1, true); w.setHuman(1, false);
    w.startMeeting(0, null, 'bell');
    w.setHuman(1, true);
    w.meeting!.t = w.meeting!.discussEnd + 30; w.updateMeeting(0.033);
    ok(!w.meeting!.votes.has(1), 'người thật quay lại giữa cuộc họp: phiếu vẫn để người đó tự bầu');
  }

  console.log('4. Vai thật của người bị sa thải: mọi máy thấy giống nhau ngay khi có kết quả');
  {
    const c = await setup(81, 'intern');
    const imp = c.w.agents.find(o => o.role === 'impostor')!;
    await meet(c);
    c.w.meeting!.t = c.w.meeting!.discussEnd + 0.1; await c.run(0.3);
    for (const a of c.w.agents) if (a.alive && a.id !== imp.id) c.w.meeting!.votes.set(a.id, imp.id);
    c.w.meeting!.t = c.w.meeting!.duration; await c.run(0.6);
    ok(c.w.meeting!.result?.ejected === imp.id, `chủ phòng: ${imp.name} bị bầu ra`);
    ok(c.B.replica!.agents[imp.id].role === 'impostor', 'B (Nhân viên) thấy người bị bầu là Nội gián ngay lúc có kết quả');
    ok(c.A.replica!.agents[imp.id].role === 'impostor', 'A cũng thấy giống vậy');
    const other = c.w.agents.find(o => o.role === 'crew' && o.id > 2)!;
    ok(c.B.replica!.agents[other.id].role === 'crew', 'người khác vẫn giấu vai');
    const left = (w: World) => Math.max(0, w.aliveImp().length - (w.agents[imp.id].role === 'impostor' && w.agents[imp.id].alive ? 1 : 0));
    ok(left(c.w) === left(c.B.replica!), `số Nội gián còn lại giống nhau: chủ phòng ${left(c.w)}, B ${left(c.B.replica!)}`);
  }

  console.log('6. Gói thay đổi: nhỏ, lỡ gói thì tự xin lại gói đầy đủ');
  {
    const c = await setup(82, 'intern');
    const sizes: Record<string, number> = {};
    c.B.tr.onMessage((_f, m) => { const x = m as ToClient; sizes[x.t] = (sizes[x.t] ?? 0) + JSON.stringify(x).length; });
    await c.run(4);
    ok((sizes.dfull ?? 0) / 4 < 2048, `trạng thái gửi B: ${((sizes.dfull ?? 0) / 4 / 1024).toFixed(2)} KB/giây (trước đây khoảng 18 KB/giây)`);
    // làm rơi một gói thay đổi tới A
    const tr = c.host.tr as unknown as { send: (to: string, m: unknown) => void };
    const orig = tr.send.bind(tr); let dropped = 0;
    tr.send = (to, m) => { if (to === 'A' && (m as ToClient).t === 'dfull' && !dropped) { dropped++; return; } orig(to, m); };
    c.w.agents[4].directorRevealed = true; // một thay đổi công khai
    await c.run(0.5);
    c.w.agents[5].bossDone = true;
    await c.run(1.5);
    tr.send = orig;
    const A = c.A as unknown as { tree: unknown; stats: { miss: number } };
    const hostTree = (c.host as unknown as { sent: Map<string, { tree: unknown }> }).sent.get('A')!.tree;
    ok(dropped === 1 && A.stats.miss > 0, `A phát hiện lỡ gói (${A.stats.miss} gói không khớp)`);
    ok(JSON.stringify(A.tree) === JSON.stringify(hostTree), 'A xin lại gói đầy đủ và khớp lại với chủ phòng');
    ok(c.A.replica!.agents[4].directorRevealed && c.A.replica!.agents[5].bossDone, 'bản sao của A có đủ các thay đổi');
  }

  console.log('6. Chơi ván mới ngay từ màn kết quả');
  {
    const c = await setup(83, 'intern');
    await c.run(2);
    c.w.endGame('crew', 'Thử'); await c.run(1);
    const old = c.A.replica;
    const first: string[] = [];
    c.A.tr.onMessage((_f, m) => { const x = m as ToClient; if (first.length < 3 && (x.t === 'start' || x.t === 'full' || x.t === 'dfull')) first.push(x.t + ((x as { s?: number }).s !== undefined && x.t === 'full' ? '(đầy đủ)' : '')); });
    const w2 = new World({ playerName: 'Chủ', playerLook: randomLook(), roles: {}, maxSpecial: 0, playerRole: 'crew', bots: 7, impostors: 1, seed: 84 });
    const seat = new Map([['H', 0], ['A', 1], ['B', 2]]);
    for (const [, id] of seat) w2.setHuman(id, true);
    session.world = w2; (c as { w: World }).w = w2;
    c.host.startGame(w2, seat); c.host.go();
    await c.run(1.5);
    ok(c.A.replica !== old && c.A.replica?.phase === 'play', 'A nhận ván mới');
    ok(first[0] === 'start' && first[1] === 'full(đầy đủ)', `gói đầu tiên sau khi bắt đầu: ${first.join(' → ')}`);
    const hostTree = (c.host as unknown as { sent: Map<string, { tree: unknown }> }).sent.get('A')!.tree;
    ok(JSON.stringify((c.A as unknown as { tree: unknown }).tree) === JSON.stringify(hostTree), 'trạng thái A khớp chủ phòng ở ván mới');
  }

  console.log('7. Đã bỏ "Sẵn sàng bỏ phiếu"');
  {
    const w = new World({ playerName: 'Chủ', playerLook: randomLook(), roles: {}, maxSpecial: 0, playerRole: 'crew', bots: 5, impostors: 1, seed: 3 });
    w.startMeeting(0, null, 'bell');
    const end = w.meeting!.discussEnd;
    runAction(w, 0, 'skipDiscussion', []);
    ok(w.meeting!.discussEnd === end, 'lệnh cũ không còn tác dụng');
  }
  finish();
}
void main();
