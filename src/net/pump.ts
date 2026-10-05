// Máy bơm nhịp chạy nền: trình duyệt NGỪNG vòng lặp vẽ (requestAnimationFrame) của tab bị ẩn và hãm đồng hồ hẹn giờ,
// nên chủ phòng ở tab ẩn sẽ "đứng hình" (không chạy mô phỏng, không gửi trạng thái). Luồng nền (Web Worker) không bị dừng,
// nên ta dùng nó phát nhịp 20 lần/giây:
// - Khi vòng lặp vẽ đang chạy: không làm gì (cảnh vẽ tự chạy mô phỏng như bình thường).
// - Khi vòng lặp vẽ dừng quá 250 ms (tab bị ẩn): máy bơm chạy mô phỏng của chủ phòng và gửi trạng thái thay.
// - Nhịp kiểm tra kết nối (mỗi giây) của cả chủ phòng lẫn người vào phòng cũng chạy ở đây, không phụ thuộc tab có hiện hay không.
import { session } from '../session';
import { net } from './room';

let worker: Worker | null = null;
let last = 0, watchAcc = 0;
/** Cảnh vẽ gọi mỗi khung hình để báo "vòng lặp vẽ đang chạy" */
export function markFrame() { session.lastFrameAt = performance.now(); }

export function startPump() {
  if (worker || typeof Worker === 'undefined') return;
  const src = 'setInterval(() => postMessage(0), 50);';
  worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  last = performance.now();
  worker.onmessage = () => {
    const now = performance.now();
    const ms = Math.min(250, now - last); last = now;
    session.runDue(); // hẹn giờ quan trọng của ván chạy đúng giờ dù tab bị ẩn
    // nhịp kiểm tra kết nối mỗi giây
    watchAcc += ms;
    if (watchAcc >= 1000) { watchAcc = 0; net.host?.watch(); net.client?.watch(); }
    // vòng lặp vẽ vẫn chạy: để cảnh vẽ lo
    if (now - session.lastFrameAt < 250) return;
    const w = session.world, h = net.host;
    if (!w || !h || net.role !== 'host') return;
    // chạy hộ cả vòng cập nhật giao diện của chủ phòng (mở màn kết quả bầu, kết thúc họp, chọn nơi bắt đầu...)
    session.onFrame(ms / 1000);
    if (session.paused) { h.tick(ms, []); return; }
    w.playerInput = { x: 0, y: 0 }; // chủ phòng đang ở tab khác: nhân vật của chủ phòng đứng yên
    w.update(ms / 1000);
    const ev = w.drainEvents();
    if (session.gameStats) { session.gameStats.tick(ms / 1000); if (ev.length) session.gameStats.onEvents(ev); }
    if (ev.length) session.onEvents(ev); // giao diện vẫn xử lý (mở cuộc họp, hết ván...) để khi quay lại thấy đúng
    h.tick(ms, ev);
  };
  // tab bị ẩn: người vào phòng thả hết phím (không để nhân vật trôi mãi theo phím đang giữ dở)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    session.input = { x: 0, y: 0 };
    net.client?.sendInput(0, 0, 9999);
  });
}
