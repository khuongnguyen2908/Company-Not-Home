export type DeptId = 'it' | 'mkt' | 'acc' | 'hr' | 'sales' | 'design' | 'admin' | 'legal' | 'intern' | 'cs';

export interface Dept { id: DeptId; name: string; color: string; desc: string }

export const DEPTS: Dept[] = [
  { id: 'it', name: 'IT', color: '#5b6b80', desc: 'Áo thun xuyệt tông, tai nghe không bao giờ tháo' },
  { id: 'mkt', name: 'Marketing', color: '#ff5fa2', desc: 'Đồ trendy, kính râm cài đầu trong nhà' },
  { id: 'acc', name: 'Kế toán', color: '#4fb86b', desc: 'Kính dày cộp, nhớ từng đồng tạm ứng' },
  { id: 'hr', name: 'HR', color: '#30418c', desc: 'Vest chỉnh tề, nụ cười "chúng ta là gia đình"' },
  { id: 'sales', name: 'Sales', color: '#e2412f', desc: 'Cà vạt đỏ, gọi điện bằng giọng sang sảng' },
  { id: 'design', name: 'Design', color: '#f2b705', desc: 'Mũ nồi, "cái logo này cần to hơn nhưng nhỏ lại"' },
  { id: 'admin', name: 'Hành chính', color: '#f2832f', desc: 'Cardigan, chùm chìa khóa mở mọi phòng' },
  { id: 'legal', name: 'Pháp chế', color: '#7d2340', desc: 'Vest đỏ đô, câu nào cũng "theo điều khoản"' },
  { id: 'intern', name: 'Thực tập sinh', color: '#2e9cf0', desc: 'Mũ lưỡi trai ngược, làm việc không lương sẵn rồi' },
  { id: 'cs', name: 'CSKH', color: '#8a5cf5', desc: 'Headset dính liền, "dạ em xin phép hỗ trợ ạ"' },
];

export function dept(id: DeptId): Dept {
  return DEPTS.find(d => d.id === id)!;
}

export const BOT_NAMES = ['Tuấn', 'Linh', 'Hùng', 'Mai', 'Phúc', 'Trang', 'Khoa', 'Ngọc', 'Bảo', 'Vy', 'Đạt', 'Hà', 'Quân', 'Thảo'];

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
