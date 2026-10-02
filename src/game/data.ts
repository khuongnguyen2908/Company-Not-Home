export type DeptId = 'gd' | 'artist' | 'tester' | 'po' | 'pd' | 'hr' | 'director' | 'acc' | 'it' | 'intern';

export interface Dept { id: DeptId; name: string; color: string; desc: string }

export const DEPTS: Dept[] = [
  { id: 'gd', name: 'GD', color: '#16a6a0', desc: 'Game Designer: hoodie in tay cầm, "cái này cân bằng lại là vui"' },
  { id: 'artist', name: 'Artist', color: '#e8a400', desc: 'Mũ nồi, bút chì gài tai, áo dính màu vẽ' },
  { id: 'tester', name: 'Tester', color: '#4fa83d', desc: 'Kính lúp trên tay, áo in con bug, "em repro được rồi anh"' },
  { id: 'po', name: 'PO', color: '#2e7fd9', desc: 'Product Owner: kẹp giấy đầy sticky note, backlog không bao giờ hết' },
  { id: 'pd', name: 'PD', color: '#8a4fd8', desc: 'Producer: blazer tím, kính râm cài đầu, deadline là chân lý' },
  { id: 'hr', name: 'HR', color: '#d94f8a', desc: 'Vest chỉnh tề, nụ cười "chúng ta là một gia đình"' },
  { id: 'director', name: 'Director', color: '#2b2b38', desc: 'Vest đen cà vạt đỏ, tóc bạc, "anh chỉ góp ý thôi"' },
  { id: 'acc', name: 'Kế toán', color: '#2f9e6e', desc: 'Kính dày cộp, nhớ từng đồng tạm ứng' },
  { id: 'it', name: 'IT', color: '#5b6b80', desc: 'Áo thun xuyệt tông, tai nghe không bao giờ tháo' },
  { id: 'intern', name: 'Thực tập sinh', color: '#ff6b4a', desc: 'Mũ lưỡi trai ngược, thẻ tên to nhất công ty' },
];

/** Phòng ban có năng lực trong đợt 1 (các phòng ban còn lại thuộc đợt 2) */
export type RoleDept = 'hr' | 'director' | 'it' | 'po' | 'producer' | 'developer' | 'artist' | 'sound' | 'admin' | 'engineer' | 'media' | 'animator' | 'tester' | 'gd' | 'climber' | 'intern';
/** Các vai có kỹ năng (bật/tắt ở máy tính lễ tân) */
export const SPECIAL_ROLES: Exclude<RoleDept, 'intern'>[] = ['hr', 'director', 'it', 'po', 'producer', 'developer', 'artist', 'sound', 'admin', 'engineer', 'media', 'animator', 'tester', 'gd', 'climber'];
/** Vai phe thứ ba (có điều kiện thắng riêng) và số người tối thiểu để xuất hiện */
export const NEUTRAL_ROLES: Partial<Record<RoleDept, number>> = { gd: 7, climber: 8 };

export const ROLE_INFO: Record<RoleDept, { name: string; icon: string; short: string; ability: string; rules: string[] }> = {
  hr: {
    name: 'HR', icon: '🪪', short: 'Quét Face ID',
    ability: 'Quét Face ID một đồng nghiệp ở Phòng HR để biết người đó là Nhân viên hay Nội gián.',
    rules: [
      'Dùng 1 lần mỗi ván. Máy mở sau 60 giây chơi, hoặc ngay sau cuộc họp đầu tiên.',
      'Chọn người rồi giữ nút quét 4 giây. Máy phát sáng hồng, ai đứng gần đều thấy bạn đang quét.',
      'Kết quả về sau 60 giây chơi (đồng hồ dừng khi họp). Bị gài bẫy trước khi có kết quả thì mất kết quả.',
      'Mất điện hoặc rớt mạng thì máy ngừng hoạt động.',
    ],
  },
  director: {
    name: 'Director', icon: '👔', short: 'Công bố chức vụ',
    ability: 'Trong phòng họp, công bố chức vụ để hệ thống xác nhận bạn là Director. Từ đó phiếu của bạn tính gấp đôi.',
    rules: [
      'Bấm "Công bố chức vụ" trong cuộc họp, hệ thống xác nhận công khai cho cả phòng.',
      'Sau khi công bố, mọi phiếu bầu của bạn tính là 2 phiếu cho tới hết ván.',
      'Cả công ty biết bạn là ai, kể cả Nội gián: bạn thành mục tiêu số một.',
    ],
  },
  it: {
    name: 'IT', icon: '💻', short: 'Laptop camera',
    ability: 'Mở camera an ninh bằng laptop ở bất kỳ đâu.',
    rules: [
      'Mỗi lần xem được 10 giây, hồi chiêu 40 giây.',
      'Mất điện hoặc rớt mạng thì không xem được.',
      'Khi bạn đang xem, đèn đỏ trên mọi camera nhấp nháy: ai cũng biết có người đang canh.',
    ],
  },
  po: {
    name: 'Product Owner', icon: '📣', short: 'Họp gấp từ xa',
    ability: 'Gọi họp khẩn ở bất kỳ đâu bằng nút đặc biệt, không cần chạy về Phòng họp bấm chuông.',
    rules: [
      'Dùng 1 lần mỗi ván.',
      'Vẫn gọi được khi mất điện hay rớt mạng. Không gọi được khi Sếp đang đi tuần.',
      'Cả phòng sẽ biết bạn là Product Owner thật (Nội gián không giả được), nên sau đó bạn dễ thành mục tiêu.',
    ],
  },
  producer: {
    name: 'Producer', icon: '🛡️', short: 'Bảo lãnh trong họp',
    ability: 'Trong mỗi cuộc họp, bí mật bảo lãnh một người. Nếu người đó bị bầu nhiều phiếu nhất, lệnh sa thải bị hủy.',
    rules: [
      'Chọn người bảo lãnh trước khi hết giờ bỏ phiếu, có thể đổi ý tới phút chót.',
      'Được bảo lãnh chính mình.',
      'Không được bảo lãnh cùng một người (kể cả chính mình) trong hai cuộc họp liên tiếp.',
      'Hệ thống chỉ báo "có người đã được bảo lãnh", không ai biết Producer là ai.',
    ],
  },
  developer: {
    name: 'Developer', icon: '💾', short: 'Backup đồng nghiệp',
    ability: 'Đầu ván chọn một đồng nghiệp để backup. Lần đầu người đó bị gài bẫy, bản backup tự khôi phục và họ không bị đuổi việc.',
    rules: [
      'Bắt buộc chọn ngay ở màn phân vai (trước khi bấm Sẵn sàng), không chọn được chính mình.',
      'Chỉ cứu được 1 lần. Lần gài bẫy hụt diễn ra âm thầm: người được backup không hề biết.',
      'Nội gián thấy "Bẫy thất bại!" và mất lượt hồi chiêu. Bạn nhận tin bản backup vừa được dùng.',
      'Bản backup vẫn có hiệu lực kể cả khi bạn đã bị đuổi việc.',
    ],
  },
  artist: {
    name: 'Artist', icon: '🎨', short: 'Máy so màu',
    ability: 'Ở máy so màu trong Studio Art, chọn một màu để kiểm tra trên người Nội gián có màu đó ở bất kỳ đâu không.',
    rules: [
      'Màu được tính ở mọi chỗ: tóc, da hoặc skin, áo, quần, phụ kiện. Không tính viền nét vẽ.',
      'Danh sách chỉ gồm các nhóm màu đang có trên người ai đó trong ván.',
      'Kết quả: "Có" nếu ít nhất một Nội gián còn trong ván mang màu đó, ngược lại là "Không có".',
      'Máy mở sau cuộc họp đầu tiên. Mỗi lần dùng xong phải đợi thêm 2 cuộc họp. Máy phát sáng khi đang so màu.',
    ],
  },
  sound: {
    name: 'Sound Engineer', icon: '🔊', short: 'Báo động khi bị gài',
    ability: 'Khi bị gài bẫy, loa của bạn hú lên: mọi người còn sống thấy cảnh báo và mũi tên chỉ tới ghế trống của bạn.',
    rules: [
      'Tự động kích hoạt, không cần bấm gì. Chỉ khi bị gài bẫy; bị sa thải trong họp thì không.',
      'Cảnh báo tồn tại 15 giây, kèm mũi tên có hình loa phát sóng âm. Ghế trống ở tầng khác thì mũi tên chỉ về thang bộ trước.',
      'Nội gián cũng thấy cảnh báo, nên kẻ vừa gài bẫy sẽ phải chạy thật nhanh.',
    ],
  },
  admin: {
    name: 'Admin', icon: '📊', short: 'Bảng chấm công',
    ability: 'Mở Bảng chấm công ở bất kỳ đâu để xem ai đang làm việc, ai vừa bị đuổi việc, ai đã bị sa thải.',
    rules: [
      'Bảng hiện cả những người vừa bị gài bẫy mà ghế trống chưa ai phát hiện.',
      'Pin xem tối đa 10 giây. Mỗi lần đóng bảng phải chờ 20 giây mới mở lại.',
      'Pin chỉ sạc lại khi bạn làm xong việc: mỗi việc xong sạc thêm 5 giây.',
      'Rớt mạng thì bảng không tải được.',
    ],
  },
  engineer: {
    name: 'Engineer', icon: '🔧', short: 'Đi chỗ trốn',
    ability: 'Dùng được 5 cặp chỗ trốn như Nội gián để di chuyển nhanh, nhưng có thêm việc bảo trì chỗ trốn.',
    rules: [
      'Mỗi lần trốn tối đa 15 giây thì tự chui ra. Hai lần trốn cách nhau 30 giây.',
      'Đang trốn thì không ai gài bẫy được bạn.',
      'Chui vào đúng chỗ đang có Nội gián nấp thì bạn nhận cảnh báo "Có ai đó trong này!" (không biết là ai).',
      'Có thêm 2 việc bảo trì chỗ trốn, tính vào KPI như việc thường.',
      'Ai thấy bạn chui ra từ tủ cũng sẽ nghi bạn là Nội gián: chuẩn bị tinh thần giải thích!',
    ],
  },
  media: {
    name: 'Truyền thông', icon: '📸', short: 'Hồn ma gửi sticker',
    ability: 'Khi đã thành hồn ma, đứng gần người còn sống để gửi cho họ 1 đến 3 sticker hình ảnh, hiện trên đầu người nhận.',
    rules: [
      'Chỉ có kỹ năng sau khi bị gài bẫy hoặc bị sa thải.',
      'Mỗi lần liên lạc, hệ thống bốc ngẫu nhiên 6 sticker. Chọn 1 đến 3 cái theo thứ tự để ghép thành ý.',
      'Được đổi bộ 6 sticker khác, mỗi lần đổi cách nhau 10 giây. Mỗi lần gửi cách nhau 10 giây.',
      'Chỉ người nhận thấy sticker, và không biết ai gửi. Người sống không trả lời lại được.',
      'Sticker chỉ có hình, không có chữ, không có màu, số hay quần áo để không chỉ thẳng ra ai.',
    ],
  },
  animator: {
    name: 'Animator', icon: '🎬', short: 'Hồi sinh đổi mạng',
    ability: 'Một lần mỗi ván, "làm lại anim" cho một đồng nghiệp đã bị gài bẫy: người đó sống lại, còn bạn đổi mạng thành ghế trống.',
    rules: [
      'Dùng lúc nào cũng được khi đang làm việc (ngoài phòng họp), chọn trong danh sách người đã bị gài bẫy.',
      'Không làm lại được người bị sa thải trong họp.',
      'Người được làm lại sống lại ngay chỗ bạn đứng. Bạn thành ghế trống tại đó, ai thấy có thể báo cáo.',
      'Cân nhắc kỹ: người sống lại có thể đã thấy kẻ gài bẫy mình, nhưng cũng có thể chẳng thấy gì.',
    ],
  },
  tester: {
    name: 'Tester', icon: '🧪', short: 'Viết testcase',
    ability: 'Mỗi vòng, đứng cạnh một người và bấm nút để viết testcase cho họ. Cuộc họp sau, bạn nhận log các phòng người đó đã đi qua.',
    rules: [
      'Bấm là viết ngay cho người đứng gần nhất. Mỗi vòng (giữa hai cuộc họp) viết được cho 1 người, viết xong nút khóa tới cuộc họp sau.',
      'Người được viết testcase không hề biết.',
      'Log ghi lần lượt các phòng và hành lang người đó đi qua kể từ lúc viết, kèm thời điểm.',
      'Ai chui chỗ trốn sẽ để lộ những bước nhảy vô lý, ví dụ đang ở Phòng Giám đốc bỗng xuất hiện ở Lễ tân.',
      'Log chỉ mình bạn xem được. Muốn thuyết phục cả phòng thì phải tự kể ra.',
    ],
  },
  gd: {
    name: 'Game Designer', icon: '🎲', short: 'Phe thứ ba: người không thể bị sa thải',
    ability: 'Bạn là đầu tàu của dự án, người cả công ty không thể để mất. Nếu bạn bị sa thải trong họp, dự án sụp đổ ngay lập tức: cả công ty thua, chỉ mình bạn thắng.',
    rules: [
      'Phe thứ ba: không thuộc Nhân viên, cũng không thuộc Nội gián.',
      'Bị bầu sa thải trong cuộc họp: dự án sụp đổ, ván kết thúc, bạn thắng và mọi người khác thua.',
      'Bị gài bẫy chết là thua. Việc của bạn chỉ là việc giả, không tính vào KPI.',
      'HR quét Face ID ra "Nhân viên". Cả công ty phải cẩn thận khi bỏ phiếu, vì người trông đáng ngờ nhất có thể chính là bạn.',
      'Chỉ xuất hiện ở ván từ 7 người.',
    ],
  },
  climber: {
    name: 'Intern tham vọng', icon: '📈', short: 'Phe thứ ba: sống sót cuối cùng',
    ability: 'Kẻ leo thang nguy hiểm: giả làm đồng nghiệp, ngấm ngầm hạ cả Nhân viên lẫn Nội gián. Thắng khi chỉ còn bạn và tối đa một người khác.',
    rules: [
      'Phe thứ ba. Bạn biết mặt Nội gián ngay từ đầu, nhưng họ không biết bạn.',
      'Gài bẫy được cả Nhân viên lẫn Nội gián, hồi chiêu 35 giây. Gài trúng Nội gián thì hồi chiêu reset ngay.',
      'Dùng được chỗ trốn như Nội gián, nhưng không phá hoại được.',
      'Một lần mỗi ván, trong phòng họp gửi một tin "nguồn giấu tên" tố ai đó là Nội gián, thật hay bịa tùy bạn.',
      'Nội gián chỉ thắng khi bạn đã chết; Nhân viên phải loại cả Nội gián lẫn bạn (hoặc xong KPI). HR quét bạn ra "Nội gián".',
      'Việc của bạn là việc giả, không tính KPI. Chỉ xuất hiện ở ván từ 8 người.',
    ],
  },
  intern: {
    name: 'Thực tập sinh', icon: '🧃', short: 'Không có',
    ability: 'Không có kỹ năng đặc biệt. Làm việc chăm chỉ và quan sát thật kỹ.',
    rules: ['Là vai đông nhất, nên Nội gián rất hay nhận bừa là Thực tập sinh để trà trộn.'],
  },
};

/** 12 nhóm màu dùng cho máy so màu của Artist */
export const COLOR_GROUPS: { id: string; name: string; hex: string; anchors: string[] }[] = [
  { id: 'red', name: 'Đỏ', hex: '#e2412f', anchors: ['#e2412f', '#c0392b', '#ff5d5d', '#e2412f', '#7d2340'] },
  { id: 'orange', name: 'Cam', hex: '#ff7a2f', anchors: ['#ff7a2f', '#ff8a2f', '#e0883a', '#d97b4a'] },
  { id: 'yellow', name: 'Vàng', hex: '#f2b705', anchors: ['#f2b705', '#ffe36e', '#ffd23f', '#e8c547', '#d9a441'] },
  { id: 'green', name: 'Xanh lá', hex: '#4fb86b', anchors: ['#7cc84a', '#2f9e5e', '#5fbf5a', '#3fa66b', '#9cc27a', '#7cbf4a', '#2f5e3a'] },
  { id: 'teal', name: 'Xanh ngọc', hex: '#16a6a0', anchors: ['#16a6a0', '#4ee1a0', '#bfe6f2'] },
  { id: 'blue', name: 'Xanh dương', hex: '#2e9cf0', anchors: ['#2e9cf0', '#3d5ad6', '#5fb8ff', '#7fc4ff', '#4a78b5', '#1f6feb', '#9fd6ff', '#3d6fb5'] },
  { id: 'navy', name: 'Xanh đậm', hex: '#1f2a5c', anchors: ['#1f2a5c', '#3d3a8a', '#2c4f80'] },
  { id: 'purple', name: 'Tím', hex: '#8a4fd8', anchors: ['#8a4fd8', '#7d3fd0'] },
  { id: 'pink', name: 'Hồng', hex: '#ff9ec4', anchors: ['#d94f8a', '#ff9ec4', '#ff5fa2', '#ff7fb6', '#e889b0', '#ffe9f4'] },
  { id: 'brown', name: 'Nâu', hex: '#8a5a35', anchors: ['#8a5a35', '#6b4426', '#3b2a20', '#6b3e22', '#a0522d', '#9c6644', '#c98d63', '#c9a77c', '#b8742f', '#e0a052', '#9a5a1f'] },
  { id: 'black', name: 'Đen', hex: '#2b2b38', anchors: ['#2b2b38', '#1c1c22', '#1d1a2b', '#2b2b33', '#33384a', '#5b6b80', '#111111'] },
  { id: 'white', name: 'Trắng', hex: '#f4f4f4', anchors: ['#f4f4f4', '#ffffff', '#e8eef5', '#a7a7b2', '#9aa1b4', '#b9c0cf', '#f4f1e8', '#fbe0c4', '#f6d0ae', '#f2c49b', '#e3b089', '#f6d79c', '#fff3e0', '#f4e7cf', '#fff0f6', '#e6f3ff', '#f4f1e0', '#c8eec0'] },
];

export function dept(id: DeptId): Dept {
  return DEPTS.find(d => d.id === id)!;
}

export const PLAYER_NAMES = ['Cát', 'Minh', 'Lan', 'Anh', 'Hoàng', 'Linh', 'Thắm', 'Pikachu', 'HurryK', 'Khoa', 'Nhi'];
export const BOT_NAMES = ['Tuấn', 'Hùng', 'Mai', 'Phúc', 'Trang', 'Ngọc', 'Bảo', 'Vy', 'Đạt', 'Hà', 'Quân', 'Thảo', 'Lan', 'Nhi'];

export const FILLER_LINES = [
  'Mình xin phép tắt cam, đang ăn trưa.',
  'Ai chưa cập nhật Jira thì người đó đáng ngờ.',
  'Cái này không phải lỗi của mình, ticket mình assign rồi mà.',
  'Mình nghĩ cần thêm một cuộc họp để bàn về cuộc họp này.',
  'Ok mọi người, mình sẽ note lại và follow-up sau nha.',
  'Có ai thấy cái bánh mì của mình trong tủ lạnh không?',
  'Em bị lag, mọi người nghe em nói không ạ?',
  'Theo quy trình thì phải có biên bản trước khi vote.',
  'Mình đang làm 3 task cùng lúc, nói nhanh giúp mình.',
  'Nói thật là từ hôm teambuilding mình đã thấy có gì đó sai sai.',
  'Thôi skip đi, deadline đang dí sau lưng kìa.',
  'Mình chỉ muốn nhắc là hôm nay là thứ Sáu.',
];

export const DEFENSE_LINES = [
  'Ơ, sao lại là tôi? Tôi đang chạy KPI sấp mặt mà!',
  'Đổ lỗi vô căn cứ thế này là tôi báo HR đấy nhé.',
  'Tôi có log làm việc đầy đủ, ai cần tôi gửi file Excel.',
  'Bằng chứng đâu? Không có bằng chứng thì đừng nói.',
  'Tôi cống hiến cho công ty 5 năm, đừng nghi oan tôi.',
];

export const IMPOSTOR_ALIBIS = [
  'Nãy giờ tôi ở Pantry pha cà phê cho sếp, không biết gì hết.',
  'Tôi đi vệ sinh, ra thì nghe chuông họp luôn.',
  'Tôi ở phòng server nối dây cáp, trong đó ồn lắm không nghe gì.',
  'Tôi đang gõ báo cáo ở bàn mình, cả Open Space thấy mà.',
  'Tôi bận photocopy hồ sơ, máy kẹt giấy suốt.',
];

export const TASK_VERBS: Record<string, string> = {
  excel: 'nhập Excel',
  copier: 'gỡ kẹt máy photocopy',
  wires: 'nối dây cáp server',
  fridge: 'dọn tủ lạnh',
  coffee: 'pha cà phê cho sếp',
  stamp: 'ký duyệt hồ sơ',
};

export function pick<T>(arr: T[], rng: () => number = Math.random): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

/** Xếp một mã màu vào nhóm màu gần nhất */
export function colorGroupOf(hex: string): string {
  const rgb = (h: string) => { const n = parseInt(h.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const [r, g, b] = rgb(hex);
  let best = 'black', bd = Infinity;
  for (const grp of COLOR_GROUPS) for (const a of grp.anchors) {
    const [r2, g2, b2] = rgb(a);
    const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
    if (d < bd) { bd = d; best = grp.id; }
  }
  return best;
}

/** Bộ sticker của Truyền thông: chỉ có hình. Tránh màu, số, quần áo, phụ kiện và các hình trùng skin nhân vật. */
export interface Sticker { e: string; room?: string; hide?: number; kind: 'place' | 'hide' | 'act' | 'judge' | 'feel' }
export const STICKERS: Sticker[] = [
  // Địa điểm (đồ vật đặc trưng của từng phòng)
  { e: '🏆', room: 'director', kind: 'place' }, { e: '🪪', room: 'hr', kind: 'place' }, { e: '🔔', room: 'meeting', kind: 'place' },
  { e: '🎨', room: 'art', kind: 'place' }, { e: '🖥️', room: 'server', kind: 'place' }, { e: '🛎️', room: 'reception', kind: 'place' },
  { e: '📊', room: 'open', kind: 'place' }, { e: '🐞', room: 'qa', kind: 'place' }, { e: '🍱', room: 'pantry', kind: 'place' },
  { e: '🎯', room: 'fun', kind: 'place' }, { e: '🖨️', room: 'print', kind: 'place' }, { e: '📹', room: 'security', kind: 'place' },
  { e: '⚡', room: 'power', kind: 'place' }, { e: '🌱', room: 'roof_garden', kind: 'place' }, { e: '❄️', room: 'roof_ac', kind: 'place' },
  // Tầng, thang máy, thang bộ
  { e: '1️⃣', kind: 'place' }, { e: '2️⃣', kind: 'place' }, { e: '3️⃣', kind: 'place' }, { e: '🏙️', kind: 'place' },
  { e: '🛗', room: 'cabin', kind: 'place' }, { e: '🪜', kind: 'place' },
  // Lối trốn
  { e: '🔌', hide: 4, kind: 'hide' }, { e: '🪑', hide: 6, kind: 'hide' }, { e: '🌀', hide: 8, kind: 'hide' }, { e: '🗄️', hide: 10, kind: 'hide' }, { e: '🕳️', hide: 12, kind: 'hide' },
  // Hành động
  { e: '👀', kind: 'act' }, { e: '🏃', kind: 'act' }, { e: '🫥', kind: 'act' }, { e: '🔒', kind: 'act' }, { e: '🕯️', kind: 'act' }, { e: '📵', kind: 'act' },
  { e: '📂', kind: 'act' }, { e: '📣', kind: 'act' }, { e: '🤝', kind: 'act' }, { e: '✋', kind: 'act' }, { e: '⏰', kind: 'act' }, { e: '🔁', kind: 'act' },
  // Đánh giá
  { e: '⚠️', kind: 'judge' }, { e: '✅', kind: 'judge' }, { e: '❌', kind: 'judge' }, { e: '🤥', kind: 'judge' }, { e: '🎭', kind: 'judge' },
  { e: '🕵️', kind: 'judge' }, { e: '🛡️', kind: 'judge' }, { e: '🗳️', kind: 'judge' }, { e: '⏭️', kind: 'judge' }, { e: '🐍', kind: 'judge' },
  // Cảm xúc
  { e: '😱', kind: 'feel' }, { e: '😡', kind: 'feel' }, { e: '😭', kind: 'feel' }, { e: '😂', kind: 'feel' }, { e: '🤔', kind: 'feel' },
  { e: '👍', kind: 'feel' }, { e: '👎', kind: 'feel' }, { e: '❓', kind: 'feel' }, { e: '🙏', kind: 'feel' }, { e: '🤫', kind: 'feel' }, { e: '🫡', kind: 'feel' }, { e: '😴', kind: 'feel' },
];
