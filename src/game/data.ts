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
