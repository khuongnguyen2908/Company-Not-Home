// Kiểm tra 15 vai khi chơi nhiều người (mạng giả có độ trễ). Mỗi tình huống: chủ phòng H, người A (máy khác) cầm vai cần thử,
// người B (máy khác) quan sát. A thao tác qua đúng đường giao diện dùng (gửi lệnh lên chủ phòng, chờ kết quả).
// Kiểm: (a) chủ phòng xử lý đúng; (b) A thấy đúng kết quả; (c) B không được biết điều không nên biết.
// Cách dùng: npx tsx tests/net_roles_test.ts
import { HR_WAIT, type Agent } from '../src/game/sim';
import { TILE } from '../src/game/map';
import { setup, actA, near, ok, finish } from './net_setup';

async function main() {
  console.log('HR · Face ID');
  { const c = await setup(11, 'hr'); c.w.meetingCount = 1; near(c.w, c.a, c.w.agents[3]);
    const err = await actA(c, 'startFaceId', 3);
    ok(err === null && !!c.w.agents[1].hrPending, `A gửi Face ID, chủ phòng nhận (${err ?? 'không lỗi'})`);
    await c.run(HR_WAIT + 2);
    ok(c.w.agents[1].hrResult !== null && JSON.stringify(c.A.replica!.player.hrResult) === JSON.stringify(c.w.agents[1].hrResult), 'A nhận đúng kết quả Face ID');
    ok(!c.evB.some(e => e.type === 'hr_result' || e.type === 'hr_sent') && !c.B.replica!.agents[1].hrResult, 'B không biết kết quả Face ID'); }

  console.log('Director · công khai trong họp');
  { const c = await setup(12, 'director'); c.w.startMeeting(0, null, 'bell'); await c.run(0.3);
    await actA(c, 'revealDirector');
    ok(c.w.agents[1].directorRevealed, 'chủ phòng ghi nhận Director công khai');
    await c.run(0.5);
    ok(c.B.replica!.agents[1].dept === 'director', 'B thấy A là Director (thông tin công khai)'); }

  console.log('IT · laptop camera');
  { const c = await setup(13, 'it'); c.a.itCd = 0; // laptop khởi động 15 giây đầu ván (đúng luật): bỏ qua cho nhanh
    const err = await actA(c, 'useLaptop'); await actA(c, 'watch', true);
    ok(err === null && c.w.agents[1].itCamT > 0 && c.w.watching.has(1), 'chủ phòng bật camera cho A');
    ok(c.A.replica!.player.itCamT > 0, 'A thấy laptop đang bật'); }

  console.log('Product Owner · họp gấp');
  { const c = await setup(14, 'po'); const err = await actA(c, 'poCall');
    ok(err === null && c.w.phase === 'meeting', `PO gọi họp gấp (${err ?? 'không lỗi'})`);
    await c.run(0.5);
    ok(c.B.replica!.phase === 'meeting' && c.B.replica!.agents[1].dept === 'po', 'B vào họp, thấy A là PO (công khai)'); }

  console.log('Producer · bảo lãnh trong họp');
  { const c = await setup(15, 'producer'); c.w.startMeeting(0, null, 'bell'); await c.run(0.3);
    const err = await actA(c, 'setProtect', 3);
    ok(err === null && c.w.meeting?.protect === 3, 'chủ phòng ghi nhận bảo lãnh');
    ok(c.A.replica!.meeting?.protect === 3, 'A thấy mình đã bảo lãnh');
    ok(c.B.replica!.meeting?.protect === null, 'B không biết ai được bảo lãnh'); }

  console.log('Developer · backup đầu ca');
  { const c = await setup(16, 'developer'); c.w.time = 0;
    const err = await actA(c, 'setBackup', 3);
    ok(err === null && c.w.agents[1].devBackup === 3, `chủ phòng ghi nhận backup (${err ?? 'không lỗi'})`);
    ok(c.B.replica!.agents[1].devBackup === null, 'B không biết A backup ai'); }

  console.log('Artist · máy so màu');
  { const c = await setup(17, 'artist'); c.w.meetingCount = 1; c.a.artistNext = 0;
    const g = [...(c.w as unknown as { lookGroups: (l: unknown) => Set<string> }).lookGroups(c.w.agents.find(o => o.role === 'impostor')!.look)][0];
    const err = await actA(c, 'artistCheck', g);
    const last = c.A.replica!.player.artistResults.at(-1);
    ok(err === null && !!last && last.group === g && last.has === true, `A nhận đúng kết quả NGAY khi chủ phòng trả lời (${JSON.stringify(last)})`);
    ok((c.B.replica!.agents[1].artistResults ?? []).length === 0, 'B không biết kết quả so màu'); }

  console.log('Admin · bảng chấm công');
  { const c = await setup(18, 'admin'); const err = await actA(c, 'adminOpen');
    ok(err === null && c.w.agents[1].adminViewing && c.A.replica!.player.adminViewing, 'A mở bảng chấm công, bản sao cập nhật ngay khi có kết quả');
    await actA(c, 'adminClose'); ok(!c.w.agents[1].adminViewing, 'đóng bảng chấm công'); }

  console.log('Animator · làm lại anim');
  { const c = await setup(19, 'animator'); const v = c.w.agents[3], k = c.w.agents.find(o => o.role === 'impostor')!;
    v.alive = false; v.killedBy = k.id; c.w.bodies.push({ victim: 3, x: v.x, y: v.y, room: null, t: c.w.time } as never); c.a.knownDead.push(3);
    await c.run(0.5);
    ok(c.A.replica!.reviveCandidates(c.A.replica!.player).some(o => o.id === 3), 'máy A thấy người bị gài để chọn (trước đây luôn trống)');
    ok(c.A.replica!.agents[3].killedBy === -1, 'A KHÔNG biết ai gài (chỉ biết là bị gài)');
    const err = await actA(c, 'animatorRevive', 3);
    ok(err === null && c.w.agents[3].alive && !c.w.agents[1].alive, `làm lại anim thành công (${err ?? 'không lỗi'})`);
    ok(c.B.replica!.agents[3].killedBy === null, 'B không thấy dấu "bị gài" của Animator'); }

  console.log('Tester · viết testcase');
  { const c = await setup(20, 'tester'); near(c.w, c.a, c.w.agents[3]); await c.run(0.3);
    const err = await actA(c, 'testerTag', 3);
    ok(err === null && c.w.agents[1].testTarget === 3, 'chủ phòng ghi nhận testcase');
    ok(c.A.replica!.player.testTarget === 3, 'A thấy mình theo dõi ai');
    ok(!c.evB.some(e => e.type === 'test_tag') && c.B.replica!.agents[1].testTarget === null, 'B không biết Tester theo dõi ai'); }

  console.log('Truyền thông · hồn ma gửi sticker');
  { const c = await setup(21, 'media'); c.a.alive = false; near(c.w, c.a, c.w.agents[2]); await c.run(0.3);
    const err = await actA(c, 'mediaSend', 2, [0, 1]);
    ok(err === null && !!c.w.agents[2].stickerMsg, 'chủ phòng chuyển sticker cho người nhận');
    await c.run(0.4);
    ok(!!c.B.replica!.player.stickerMsg, 'người nhận (B) thấy sticker');
    const far = await (async () => { c.a.mediaCd = 0; c.w.agents[2].x += 30 * TILE; await c.run(0.3); return actA(c, 'mediaSend', 2, [0]); })();
    ok(typeof far === 'string', `gửi khi người nhận quá xa: A nhận đúng lỗi ("${far}") thay vì báo "Đã gửi"`); }

  console.log('Engineer · lối trốn');
  { const c = await setup(22, 'engineer'); const spot = 0; const { HIDE_SPOTS } = await import('../src/game/map');
    c.a.x = (HIDE_SPOTS[spot].x + 0.5) * TILE; c.a.y = (HIDE_SPOTS[spot].y + 0.5) * TILE; await c.run(0.3);
    await actA(c, 'hide', spot);
    ok(c.w.agents[1].hidden === spot && c.A.replica!.player.hidden === spot, 'Engineer vào lối trốn, máy A biết đang trốn ở đâu');
    ok(c.B.replica!.agents[1].hidden === -1, 'B chỉ biết A "không thấy", không biết trốn ở đâu');
    await actA(c, 'hide', null); ok(c.w.agents[1].hidden === null, 'ra khỏi lối trốn'); }

  console.log('Sound Engineer · nghe tiếng động');
  { const c = await setup(23, 'sound'); const k = c.w.agents.find(o => o.role === 'impostor')!;
    // luật: chính Sound Engineer bị gài thì loa hú, cả công ty thấy mũi tên chỉ tới ghế trống
    k.killCd = 0; near(c.w, c.a, k, 0.5); c.w.tryKill(k, c.a); await c.run(1);
    ok(c.evA.some(e => e.type === 'noise') && c.evB.some(e => e.type === 'noise'), 'Sound Engineer bị gài: cả A lẫn B đều nghe loa hú');
    ok((c.B.replica!.noises ?? []).length > 0, 'máy B có mũi tên chỉ tới ghế trống'); }

  console.log('Game Designer · bị sa thải là thắng');
  { const c = await setup(24, 'gd'); c.w.startMeeting(0, null, 'bell'); await c.run(0.3);
    c.w.meeting!.t = c.w.meeting!.discussEnd + 0.1; // mở bỏ phiếu (đang thảo luận thì phiếu chưa được nhận)
    for (const o of c.w.agents) if (o.alive && o.id !== 1) c.w.vote(o, 1);
    c.w.meeting!.t = c.w.meeting!.duration; await c.run(0.5);
    if (c.w.meeting?.result) c.w.finishMeeting(); await c.run(0.6);
    ok(c.w.winner === 'gd', `chủ phòng: Game Designer thắng khi bị sa thải (${c.w.winner})`);
    ok(c.A.replica!.phase === 'ended' && c.A.replica!.winner === 'gd' && c.B.replica!.winner === 'gd', 'A và B đều thấy kết quả'); }

  console.log('Intern tham vọng · gài bẫy');
  { const c = await setup(25, 'climber'); c.a.killCd = 0; near(c.w, c.a, c.w.agents[3]); await c.run(0.3);
    ok(c.A.replica!.agents.filter(o => o.role === 'impostor').length >= 1, 'máy A biết mặt Nội gián');
    await actA(c, 'kill', 3);
    ok(!c.w.agents[3].alive && c.w.agents[1].killCd > 0, 'Intern tham vọng gài được, hồi chiêu đặt lại'); }

  console.log('Nội gián · gài bẫy, phá hoại');
  { const c = await setup(26, 'impostor'); c.a.killCd = 0; near(c.w, c.a, c.w.agents[3]); await c.run(0.3);
    await actA(c, 'kill', 3); ok(!c.w.agents[3].alive, 'Nội gián (máy khác) gài được');
    c.w.sabCd = 0; const err = await actA(c, 'sabotage', 'power');
    ok(err === null && c.w.sabotage?.kind === 'power', 'Nội gián gây cúp điện');
    await c.run(0.4);
    ok(c.B.replica!.sabotage?.kind === 'power' && (c.B.replica!.sabotage as { by?: number }).by === -1, 'B thấy cúp điện nhưng không biết ai gây'); }

  finish();
}
void main();
