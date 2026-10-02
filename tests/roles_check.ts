// Kiểm tra nhanh luật của các vai mới
import { World, slotStation } from '../src/game/sim';
import { randomLook } from '../src/game/look';
const mk = () => new World({ playerName: 'T', playerLook: randomLook(), roles: { po: true, producer: true, developer: true, artist: true }, maxSpecial: 4, playerRole: 'crew', bots: 7, impostors: 1, seed: 42, headless: true });
const ok = (c: boolean, msg: string) => console.log(c ? '✔' : '✘', msg);

let w = mk();
const po = w.agents.find(a => a.dept === 'po')!;
ok(!!po, 'có Product Owner');
w.time = 30; ok(w.poCall(po) === null && w.meeting?.via === 'po', 'PO gọi họp gấp từ xa');
ok(w.meeting!.chat.some(c => c.system && c.text.includes('Product Owner')), 'hệ thống xác nhận PO');
w.meeting!.t = w.meeting!.duration; w.update(0.1); w.finishMeeting();
ok(w.poCall(po) !== null, 'PO không gọi được lần hai');

w = mk();
const prod = w.agents.find(a => a.dept === 'producer')!;
w.startMeeting(0, null, 'bell');
const target = w.agents.find(a => a !== prod && a.alive)!;
prod.isPlayer = false;
for (const a of w.agents) if (a.alive) w.meeting!.votes.set(a.id, target.id);
(w as any).tally();
ok(w.meeting!.result!.saved === target.id || w.meeting!.protect !== target.id, 'Producer bot bảo lãnh người bị dồn phiếu (nếu tin người đó)');
w.meeting!.protect = target.id; (w as any).tally();
ok(w.meeting!.result!.ejected === null && w.meeting!.result!.saved === target.id, 'bảo lãnh hủy lệnh sa thải');
w.finishMeeting();
w.startMeeting(0, null, 'bell');
ok(w.protectBlocked(prod, target.id) !== null, 'không bảo lãnh cùng người 2 cuộc họp liên tiếp');
ok(w.protectBlocked(prod, prod.id) === null, 'được bảo lãnh chính mình');

w = mk();
const dev = w.agents.find(a => a.dept === 'developer')!;
const imp = w.agents.find(a => a.role === 'impostor')!;
const victim = w.agents.find(a => a.id === dev.devBackup)!;
ok(dev.devBackup !== null && dev.devBackup !== dev.id, 'Developer bot đã chọn backup người khác');
w.time = 30; imp.killCd = 0; imp.x = victim.x + 10; imp.y = victim.y;
if (victim.role !== 'impostor') {
  ok(w.tryKill(imp, victim) === false && victim.alive, 'bẫy đầu tiên thất bại');
  ok(w.drainEvents().some(e => e.type === 'backup_used'), 'có sự kiện backup');
  imp.killCd = 0; ok(w.tryKill(imp, victim) === true, 'bẫy lần hai thành công');
}

w = mk();
const art = w.agents.find(a => a.dept === 'artist')!;
ok(w.artistBlocked(art) !== null, 'máy so màu khóa trước cuộc họp đầu');
w.startMeeting(0, null, 'bell'); w.meeting!.t = w.meeting!.duration; w.finishMeeting();
ok(w.artistBlocked(art) === null, 'mở sau cuộc họp đầu');
const groups = w.groupsInGame();
const impGroups = w.lookGroups(w.agents.find(a => a.role === 'impostor')!.look);
const g = groups[0];
w.artistCheck(art, g);
ok(art.artistResults[0].has === impGroups.has(g), `kết quả so màu đúng (${g}: ${art.artistResults[0].has})`);
ok(w.artistBlocked(art) !== null, 'phải chờ thêm 2 cuộc họp');
console.log('Nhóm màu trong ván:', groups.join(', '));

// ---- Đợt 2: Sound Engineer, Admin, Engineer, Truyền thông ----
const mk2 = () => new World({ playerName: 'T', playerLook: randomLook(), roles: { sound: true, admin: true, engineer: true, media: true }, maxSpecial: 4, playerRole: 'crew', bots: 7, impostors: 1, seed: 7, headless: true });
{
  const w = mk2(); w.time = 30;
  const se = w.agents.find(a => a.dept === 'sound')!;
  const imp = w.agents.find(a => a.role === 'impostor')!;
  imp.killCd = 0; imp.x = se.x + 10; imp.y = se.y;
  ok(w.tryKill(imp, se) && w.noises.length === 1, 'Sound Engineer bị gài: có cảnh báo');
  for (let i = 0; i < 11 * 30 && w.phase === 'play'; i++) w.update(1 / 30);
  ok(w.noises.length === 0, 'cảnh báo hết sau 10 giây (hoặc đã có người báo cáo)');
}
{
  const w = mk2(); w.time = 30;
  const ad = w.agents.find(a => a.dept === 'admin')!;
  ok(w.adminOpen(ad) === null && ad.adminViewing, 'Admin mở Bảng chấm công');
  for (let i = 0; i < 11 * 30; i++) (w as any).abilityTick(1 / 30);
  ok(!ad.adminViewing && ad.adminBattery <= 0.01, 'hết pin thì bảng tự đóng');
  ok(w.adminBlocked(ad) !== null, 'hết pin không mở được');
  const st = ad.tasks.find(x => !x.done && x.taskId !== 'chamcong' && x.taskId !== 'trinhky' && x.taskId !== 'build' && x.taskId !== 'tuoicay' && x.taskId !== 'giaoban')!;
  w.completeTask(ad, slotStation(st));
  ok(ad.adminBattery >= 5, 'làm xong việc sạc thêm pin');
}
{
  const w = mk2(); w.time = 30;
  const en = w.agents.find(a => a.dept === 'engineer')!;
  ok(en.tasks.filter(t => t.taskId.startsWith('bt_')).length === 2, 'Engineer có 2 việc bảo trì');
  w.hide(en, 0); ok(en.hidden === 0, 'Engineer chui được chỗ trốn');
  for (let i = 0; i < 16 * 30; i++) (w as any).abilityTick(1 / 30);
  ok(en.hidden === null && en.engCd > 0, 'tự chui ra sau 15 giây, có hồi chiêu');
  w.hide(en, 0); ok(en.hidden === null, 'đang hồi chiêu thì không chui được');
}
{
  const w = mk2(); w.time = 30;
  const md = w.agents.find(a => a.dept === 'media')!;
  ok(w.mediaBlocked(md) !== null, 'Truyền thông còn sống thì chưa liên lạc được');
  md.alive = false;
  const t = w.agents.find(a => a !== md && a.alive)!; md.x = t.x + 20; md.y = t.y;
  ok(w.mediaSend(md, t.id, [0, 18, 30]) === null && !!t.stickerMsg, 'hồn ma gửi 3 sticker');
  ok(w.mediaSend(md, t.id, [1]) !== null, 'phải chờ 10 giây mới gửi tiếp');
}

// ---- Đợt 3: Animator, Tester, Game Designer, Intern tham vọng ----
const mk3 = (seed = 11) => new World({ playerName: 'T', playerLook: randomLook(), roles: { animator: true, tester: true, gd: true, climber: true }, maxSpecial: 4, playerRole: 'crew', bots: 9, impostors: 1, seed, headless: true });
{
  const w = mk3(); w.time = 30;
  const an = w.agents.find(a => a.dept === 'animator')!;
  const imp = w.agents.find(a => a.role === 'impostor')!;
  const v = w.agents.find(a => a.role === 'crew' && a !== an && a.dept !== 'climber')!;
  ok(w.animatorBlocked(an) !== null, 'Animator chưa dùng được khi chưa ai bị gài');
  an.x = 2 * 48; an.y = 40 * 48; // đứng xa, không thấy ghế
  imp.killCd = 0; imp.x = v.x + 10; imp.y = v.y; w.tryKill(imp, v);
  ok(w.animatorBlocked(an) !== null, 'Animator chưa biết ai nghỉ việc thì chưa làm lại anim được');
  an.x = v.x + 40; an.y = v.y; w.update(1 / 30);
  ok(w.animatorBlocked(an) === null || !an.knownDead.includes(v.id) === false, 'thấy ghế trống thì biết người đó nghỉ việc');
  if (!an.knownDead.includes(v.id)) { w.startMeeting(an.id, null, 'bell'); w.meeting!.t = w.meeting!.duration; w.finishMeeting(); }
  ok(an.knownDead.includes(v.id), 'vào họp thì biết mọi người đã nghỉ việc');
  w.phase = 'play';
  ok(w.animatorRevive(an, v.id) === null && v.alive && !an.alive, 'Animator đổi mạng hồi sinh người bị gài');
  ok(w.bodies.some(b => b.victim === an.id) && !w.bodies.some(b => b.victim === v.id), 'Animator thành ghế trống, ghế của người kia biến mất');
}
{
  const w = mk3(); w.time = 30;
  const te = w.agents.find(a => a.dept === 'tester')!;
  const t = w.agents.find(a => a !== te && a.alive)!;
  t.x = te.x + 20; t.y = te.y;
  ok(w.testerTag(te, t.id) === null, 'Tester gắn test case');
  ok(w.testerTag(te, t.id) !== null, 'mỗi vòng chỉ gắn 1 lần');
  t.x = 2 * 48 + 24; t.y = 2 * 48 + 24; (w as any).testerTick(); t.x = 2 * 48 + 24; t.y = 18 * 48 + 24; (w as any).testerTick();
  ok(te.testLog.some(e => e.jump), 'phát hiện bước dịch chuyển bất thường');
  w.startMeeting(te.id, null, 'bell');
  ok(w.meeting!.chat.some(c => c.to === te.id && c.text.includes('Log testcase')), 'log gửi riêng cho Tester khi họp');
}
{
  const w = mk3(); w.time = 30;
  const gd = w.agents.find(a => a.dept === 'gd')!;
  ok(!!gd, 'có Game Designer (ván 10 người)');
  w.startMeeting(0, null, 'bell');
  for (const a of w.agents) if (a.alive) w.meeting!.votes.set(a.id, gd.id);
  w.meeting!.protect = null; (w as any).tally(); if (w.meeting!.result!.saved !== undefined) { w.meeting!.protect = null; (w as any).tally(); }
  w.finishMeeting();
  ok(w.phase === 'ended' && w.winner === 'gd', 'GD bị sa thải: GD thắng, ván kết thúc');
}
{
  const w = mk3(5); w.time = 30;
  const cl = w.agents.find(a => a.dept === 'climber')!;
  const imp = w.agents.find(a => a.role === 'impostor')!;
  ok(!!cl, 'có Intern tham vọng (ván 10 người)');
  cl.killCd = 0; cl.x = imp.x + 10; cl.y = imp.y;
  ok(w.tryKill(cl, imp) && cl.killCd === 0, 'gài trúng Nội gián thì hồi chiêu reset');
  ok(w.phase !== 'ended', 'hết Nội gián nhưng Intern tham vọng còn sống: chưa kết thúc');
  for (const a of w.agents) if (a.alive && a !== cl) { a.alive = false; }
  w.agents.find(a => a !== cl)!.alive = true;
  w.checkWin();
  ok(w.winner === 'climber', 'chỉ còn Intern tham vọng và 1 người: Intern tham vọng thắng');
}

// ---- Thang máy khi mất điện ----
{
  const w = mk(); w.time = 30;
  w.lift.pos = 2; w.lift.open = true; w.lift.doorT = 3; (w as any).applyLiftBlocks();
  ok(w.liftOpenAt(2), 'thang đứng ở tầng 2, cửa mở');
  const imp = w.agents.find(a => a.role === 'impostor')!;
  w.sabCd = 0; w.triggerSabotage(imp, 'power'); (w as any).liftTick(0.1);
  ok(!w.liftOpenAt(2) && w.lift.stuck, 'mất điện: cửa đóng và khóa ngay, kể cả khi đang mở');
  w.liftCall(1); ok(!w.lift.requests.has(1), 'mất điện: gọi thang không được');
  w.fixSabotage(null); (w as any).liftTick(0.1);
  ok(!w.lift.stuck && w.liftOpenAt(2), 'có điện lại: cửa mở thả người ra');
}
