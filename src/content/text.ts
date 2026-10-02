// Các câu chữ nằm rải rác trong logic game (lời thoại bot, lý do thắng, thông báo...).
// Sửa qua Công cụ nội dung (?content). {tên} là chỗ trống game tự điền, không được xóa hay đổi tên.
export const TEXT: Record<string, string> = {
  // ----- Lý do thắng -----
  'win.crew.kpi': 'KPI đạt 100%! Cả team được thưởng… một tấm giấy khen và một tràng pháo tay.',
  'win.crew.vote': 'Toàn bộ Nội gián đã bị sa thải. Văn phòng lại yên bình… cho đến đợt tái cấu trúc tiếp theo.',
  'win.impostor.majority': 'Nội gián chiếm đa số. Công ty "tái cấu trúc", nhân viên còn lại nhận quyết định nghỉ việc.',
  'win.impostor.boss': 'Sếp bắt quả tang {names} không ngồi ở bàn. Cả team bị cắt thưởng!',
  'win.gd': 'Công ty vừa sa thải Game Designer {name} #{id}, người không thể bị sa thải! Mất đầu tàu, dự án sụp đổ ngay lập tức. Cả công ty thua, chỉ {name} thắng.',
  'win.climber': 'Intern tham vọng {name} #{id} leo lên đỉnh: cả công ty chỉ còn lại hắn. Chức Giám đốc đã trong tầm tay!',
  // ----- Lời thoại bot trong phòng họp -----
  'bot.report.body': 'Ghế của {victim} trống trơn ở {room}! Đơn sa thải còn nằm trên ghế.',
  'bot.report.witness': 'Tôi gọi họp vì tôi TẬN MẮT thấy {suspect} chơi xấu đồng nghiệp!',
  'bot.report.bell': 'Tôi gọi họp vì thấy không khí dạo này sai sai. Ai giải thích đi?',
  'bot.hr.imp': 'Tôi là HR. Kết quả Face ID đã về: {target} LÀ NỘI GIÁN! Vote ngay!',
  'bot.hr.crew': 'Tôi là HR. Face ID cho thấy {target} là nhân viên thật, đừng vote nhầm.',
  'bot.hr.pending': 'Tôi là HR, đang chờ kết quả Face ID của {target}. Mọi người bảo vệ tôi nhé.',
  'bot.hr.fake': 'Tôi là HR, tôi đã Face ID rồi: {target} là Nội gián!',
  'bot.hr.counterFake': 'Nói dối! Tôi mới là HR thật, và tôi Face ID {liar} rồi: {liar} mới là Nội gián!',
  'bot.hr.deny': 'Vô lý! Tôi là nhân viên thật. {liar} đang nhận bừa là HR để đổ tội cho tôi!',
  'bot.hr.realResult': '{liar} nói dối, tôi mới là HR thật! Kết quả Face ID của tôi: {target} {verdict}.',
  'bot.hr.realResult.imp': 'LÀ NỘI GIÁN',
  'bot.hr.realResult.crew': 'là nhân viên thật',
  'bot.hr.realClaim': 'Khoan! Tôi mới là HR thật. {liar} đang mạo danh HR!',
  'bot.artist.has': 'Tôi là Artist. Máy so màu báo: trên người Nội gián CÓ màu {color}. Ai mặc màu {color} giải thích đi!',
  'bot.artist.not': 'Tôi là Artist. Máy so màu báo: Nội gián KHÔNG có màu {color} trên người. Những ai có màu {color} tạm an toàn.',
  'bot.tester.jump': 'Tôi là Tester. Testcase tôi viết cho {target}: {route}... có {jumps} lần dịch chuyển tức thời giữa hai nơi xa nhau. Bug này chỉ có Nội gián chui chỗ trốn mới tái hiện được!',
  'bot.tester.pass': 'Tôi là Tester, đã viết testcase cho {target}: {route}. Lộ trình bình thường, testcase pass.',
  'bot.admin': 'Tôi là Admin. Bảng chấm công báo {victim} đã bị đuổi việc, mà lúc đó chưa ai thấy ghế trống!',
  'bot.developer': 'Tôi là Developer. Bản backup tôi đặt cho {target} vừa được dùng: đã có người định gài {target}!',
  'bot.witness': 'Tôi tận mắt thấy {suspect} ném hồ sơ lỗi vào mặt {victim}! Vote {suspect} đi!',
  'bot.nearBody': 'Lúc tôi thấy ghế trống thì {suspect} đang đứng ngay gần đó.',
  'bot.seenInRoom': 'Lúc nãy tôi thấy {suspect} lảng vảng ở {room}.',
  'bot.vouchScan': 'Tôi tận mắt thấy {target} chấm công vân tay, đèn xanh hẳn hoi. {target} là nhân viên thật.',
  'bot.vouchBuddy': 'Tôi ở với {target} nãy giờ, {target} chạy KPI nghiêm túc lắm.',
  'bot.alibiTask': 'Tôi ở {room}, vừa làm xong việc "{task}". Không thấy gì lạ.',
  'bot.frame': 'Tôi thấy {suspect} đi ra từ {room}, mặt rất gian.',
  'bot.thanks': 'Cảm ơn {name}, cuối cùng cũng có người hiểu tôi.',
  'bot.counterAccuse': '{defense} Mà sao {name} hăng hái đổ lỗi thế, có tật giật mình à?',
  'bot.withBuddy': 'Tôi ở cùng {buddy} suốt, hỏi {buddy} đi!',
  'bot.doingTask': 'Tôi đang làm "{task}" mà! {defense}',
  // ----- Màn hình lớn -----
  'ui.splash.body.title': 'Phát hiện ghế trống!',
  'ui.splash.body.sub': '{reporter} báo cáo ghế của {victim} ở {room}',
  'ui.splash.bell.title': 'Họp khẩn!',
  'ui.splash.bell.sub': '{reporter} bấm chuông họp khẩn ở Phòng họp',
  'ui.splash.po.title': 'Họp gấp!',
  'ui.splash.po.sub': 'Product Owner {reporter} #{id} triệu tập họp gấp từ xa',
  'ui.eject.imp': '{name} #{id} là Nội gián.',
  'ui.eject.crew': '{name} #{id} không phải Nội gián.',
  'ui.eject.left': 'Còn {n} Nội gián trong công ty.',
  'ui.eject.saved': 'Lệnh sa thải bị hủy! Có người đã được bảo lãnh.',
  'ui.eject.savedSub': 'Không ai bị sa thải lần này. Producer là ai thì... chỉ Producer biết.',
  'ui.eject.tie': 'Hòa phiếu. Không ai bị sa thải.',
  'ui.eject.skip': 'Đa số chọn bỏ qua. Không ai bị sa thải.',
  'ui.eject.skipSub': '"Thôi để họp tiếp vào thứ Hai."',
  'ui.fired.title': 'Bạn đã bị đuổi việc',
  'ui.fired.body': 'Một kẻ giấu mặt đã ném hồ sơ lỗi vào mặt bạn. Mọi thứ diễn ra quá nhanh, bạn không kịp nhìn rõ.',
  'ui.fired.ok': 'Ôm thùng carton đi tiếp',
  'ui.go.crew': 'Nhân viên thắng',
  'ui.go.impostor': 'Nội gián thắng',
  'ui.go.gd': '🎲 Game Designer thắng',
  'ui.go.climber': '📈 Intern tham vọng thắng',
  'ui.go.laugh': 'Ha ha ha!',
  'ui.reveal.kicker': 'Quyết định phân công',
  'ui.reveal.envelope': 'Quyết định phân công · Mật',
  'ui.reveal.imp': 'Bạn là Nội gián',
  'ui.reveal.ready': '✅ Sẵn sàng',
  // ----- Sự cố -----
  'ui.sab.power': 'Cúp điện! Tầm nhìn giảm, thang máy kẹt, camera và máy Face ID ngừng chạy. Bật lại cầu dao ở Kho điện, Tầng 1.',
  'ui.sab.wifi': 'Rớt mạng! Khởi động lại router ở Phòng Server, Tầng 3.',
  'ui.sab.boss': 'Sếp đi tuần! Về bàn và giả vờ gõ phím: {s}s ({done}/{total} đã ngồi)',
  'ui.sab.bossLeft': 'Sếp đi rồi. Thở phào.',
  'ui.sab.powerBack': 'Có điện lại rồi!',
  // ----- Tầng -----
  'ui.floor.sub.1': 'Đón tiếp',
  'ui.floor.sub.2': 'Làm việc',
  'ui.floor.sub.3': 'Lãnh đạo và kỹ thuật',
  'ui.floor.sub.4': 'Ngoài trời, vắng người',
  // ----- Màn hình chính -----
  'ui.title.line1': 'Văn Phòng',
  'ui.title.line2': 'Hạnh Phúc',
  'ui.title.snake': 'có rắn',
  'ui.title.tagline': 'Một trong số đồng nghiệp đang âm thầm phá dự án. Chấm công vào ca rồi tìm ra kẻ đó.',
  'ui.title.tower': 'THE COMPANY',
};

/** Ghi chú cho từng câu (hiện trong công cụ nội dung) */
export const TEXT_NOTES: Record<string, string> = {
  'win.impostor.boss': '{names} = danh sách người không về bàn kịp',
  'bot.hr.realResult': '{verdict} lấy từ 2 dòng ngay dưới',
  'ui.title.tower': 'Biển tên trên tòa tháp, nên viết hoa, tối đa 14 ký tự',
};

/** Lấy câu theo mã, điền các chỗ trống {tên} */
export function fmt(key: string, vars: Record<string, string | number> = {}): string {
  const tpl = TEXT[key] ?? key;
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}
