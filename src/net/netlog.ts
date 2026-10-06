// Nhật ký kết nối + đồng hồ mạng (chỉ admin xem, để team gửi số liệu khi gặp lỗi mạng)
/** Đếm dữ liệu gửi/nhận (chỉ bật ở chế độ admin vì phải đo kích thước từng gói) */
export const netMeter = { on: false, up: 0, down: 0 };
const lines: string[] = [];
const t0 = Date.now();
/** Ghi một dòng nhật ký (giữ 400 dòng gần nhất) */
export function netLog(msg: string) {
  const d = new Date();
  const hh = (n: number) => String(n).padStart(2, '0');
  lines.push(`${hh(d.getHours())}:${hh(d.getMinutes())}:${hh(d.getSeconds())} (+${Math.round((Date.now() - t0) / 1000)}s) ${msg}`);
  if (lines.length > 400) lines.shift();
}
export function netLogText() { return lines.join('\n'); }
export function netLogCount() { return lines.length; }
