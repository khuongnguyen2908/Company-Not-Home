// Đợt 3 · kiểm tra cuộc họp và tình huống khó khi chơi nhiều người.
// A (máy khác) thao tác như giao diện thật, B (máy khác) quan sát. Cách dùng: npx tsx tests/net_meeting_test.ts
import { NetClient } from '../src/net/room';
import { setup, actA, near, ok, finish, type Ctx } from './net_setup';

/** Mở cuộc họp (chuông của chủ phòng) và chờ nó tới các máy */
async function meet(c: Ctx) { c.w.emergencyCd = 0; c.w.startMeeting(0, null, 'bell'); await c.run(0.5); }
/** Tua tới lúc bỏ phiếu */
async function toVote(c: Ctx) { c.w.meeting!.t = c.w.meeting!.discussEnd + 0.1; await c.run(0.3); }
/** Tua tới lúc có kết quả */
async function toResult(c: Ctx) { c.w.meeting!.t = c.w.meeting!.duration; await c.run(0.6); }

async function main() {
  console.log('Thả biểu cảm');
  { const c = await setup(41, 'intern'); await meet(c);
    await actA(c, 'react', '😂'); await c.run(0.4);
    ok((c.w.meeting!.reactions ?? []).some((r: { from?: number; id?: number; e?: string }) => (r.from ?? r.id) === 1), 'chủ phòng nhận biểu cảm của A');
    ok(JSON.stringify(c.B.replica!.meeting?.reactions ?? []).includes('😂'), 'B thấy biểu cảm'); }

  console.log('Tố cáo ẩn danh (kỹ năng của Intern tham vọng)');
  { const c = await setup(42, 'climber'); await meet(c);
    const err = await actA(c, 'anonAccuse', 3); await c.run(0.4);
    const hostMsg = c.w.meeting!.chat.find(m => m.anon);
    ok(err === null && !!hostMsg && hostMsg.from === 1, `chủ phòng ghi nhận tố cáo ẩn danh của A (${err ?? 'không lỗi'})`);
    const bMsg = c.B.replica!.meeting!.chat.find(m => m.anon);
    ok(!!bMsg && bMsg.from !== 1, 'B thấy tố cáo nhưng KHÔNG biết người gửi là A');
    ok(c.A.replica!.meeting!.chat.find(m => m.anon)?.from === 1, 'A thấy tin của chính mình'); }

  console.log('Tin riêng của Tester');
  { const c = await setup(43, 'tester'); near(c.w, c.a, c.w.agents[3]); await c.run(0.3);
    await actA(c, 'testerTag', 3); await c.run(1); await meet(c); await c.run(0.5);
    const priv = c.w.meeting!.chat.filter(m => m.to === 1);
    ok(priv.length > 0, 'chủ phòng tạo tin riêng (nhật ký testcase) cho Tester');
    ok(c.A.replica!.meeting!.chat.some(m => m.to === 1), 'Tester (A) đọc được tin riêng');
    ok(!c.B.replica!.meeting!.chat.some(m => m.to === 1), 'B không thấy tin riêng của Tester'); }

  console.log('Phiếu bầu');
  { const c = await setup(44, 'intern'); await meet(c); await toVote(c);
    await actA(c, 'vote', 3); await c.run(0.4);
    ok(c.w.meeting!.votes.get(1) === 3, 'chủ phòng nhận phiếu của A');
    ok(c.B.replica!.meeting!.votes.has(1) && c.B.replica!.meeting!.votes.get(1) === 'skip', 'đang bầu: B chỉ biết A đã bầu, không biết bầu ai');
    ok(c.A.replica!.meeting!.votes.get(1) === 3, 'A thấy phiếu của chính mình');
    await toResult(c);
    ok(!!c.B.replica!.meeting?.result && c.B.replica!.meeting!.votes.get(1) === 3, 'có kết quả (phiếu công khai): B thấy A bầu ai'); }

  console.log('Phiếu ẩn danh');
  { const c = await setup(45, 'intern'); c.w.anonVotes = true; await meet(c); await toVote(c);
    await actA(c, 'vote', 3); await toResult(c);
    const tally = c.B.replica!.meeting?.result?.tally;
    const leak = tally ? [...tally.values()].some(vs => vs.some(v => v >= 0)) : true;
    ok(!!tally && !leak, 'có kết quả: B chỉ biết số phiếu, không biết ai bầu ai');
    ok(c.B.replica!.meeting!.votes.get(1) === 'skip', 'B không biết A bầu ai kể cả sau kết quả');
    ok(c.A.replica!.meeting!.votes.get(1) === 3, 'A vẫn thấy phiếu của chính mình'); }

  console.log('Producer bảo lãnh');
  { const c = await setup(46, 'producer'); await meet(c);
    await actA(c, 'setProtect', 3); await toVote(c);
    for (const o of c.w.agents) if (o.alive && o.id !== 3) c.w.vote(o, 3);
    await toResult(c);
    ok(c.w.meeting?.result?.saved === 3 && c.w.meeting.result.ejected === null, 'người được bảo lãnh không bị sa thải');
    ok(c.B.replica!.meeting?.result?.saved === 3, 'B thấy "được bảo lãnh" ở kết quả'); }

  console.log('Director bầu gấp đôi');
  { const c = await setup(47, 'director'); await meet(c);
    await actA(c, 'revealDirector'); await toVote(c);
    // Director (A) bầu #4, B bầu #5, mỗi người còn lại bầu một mục khác nhau (mỗi mục 1 phiếu):
    // tính gấp đôi thì #4 có 2 phiếu, cao nhất, bị sa thải; không tính gấp đôi thì hòa nhiều mục, không ai bị sa thải
    await actA(c, 'vote', 4);
    c.w.vote(c.w.agents[2], 5);
    const spread: [number, number | 'skip'][] = [[0, 6], [3, 'skip'], [4, 7], [5, 0], [6, 3], [7, 2]];
    for (const [v, t] of spread) if (c.w.agents[v].alive) c.w.vote(c.w.agents[v], t);
    await toResult(c);
    ok(c.w.meeting?.result?.ejected === 4, `phiếu Director tính gấp đôi: sa thải #4 (thực tế: ${c.w.meeting?.result?.ejected})`);
    ok(c.A.replica!.meeting?.result?.ejected === 4 && c.B.replica!.meeting?.result?.ejected === 4, 'A và B thấy đúng kết quả'); }

  console.log('Vào lại phòng giữa cuộc họp');
  { const c = await setup(48, 'intern'); await meet(c);
    await actA(c, 'chat', 'Tôi thấy #3 ở Pantry'); await c.run(0.3);
    c.A.tr.close(); await c.run(2); // A rớt mạng giữa họp
    ok(c.w.phase === 'meeting', 'cuộc họp vẫn diễn ra khi A mất kết nối');
    const A2 = await c.rejoinA(); // A tải lại trang (cùng mã máy)
    ok(A2.replica?.meId === 1 && A2.replica.phase === 'meeting', 'vào lại: đúng nhân vật cũ, đang ở cuộc họp');
    ok(!!A2.replica?.meeting?.chat.some(m => m.text.includes('Pantry')), 'vào lại: thấy lại tin nhắn đã gửi trong họp');
    await toVote(c); await actA(c, 'vote', 'skip'); await c.run(0.3);
    ok(c.w.meeting!.votes.get(1) === 'skip', 'vào lại rồi vẫn bầu được'); }

  console.log('Vào lại phòng sau khi ván đã kết thúc');
  { const c = await setup(49, 'intern');
    c.A.tr.close(); await c.run(1);
    c.w.endGame('crew', 'KPI đạt 100% (thử)'); await c.run(0.5);
    const A2 = await c.rejoinA();
    ok(A2.replica?.phase === 'ended' && A2.replica.winner === 'crew', 'vào lại sau khi hết ván: thấy đúng kết quả ván');
    ok(A2.replica!.agents.filter(o => o.role === 'impostor').length >= 1, 'hết ván: vai của mọi người đã công khai'); }

  finish();
}
void main();
