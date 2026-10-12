// Giữ màn hình điện thoại sáng khi đang ở sảnh / trong ca.
// Điện thoại tự khóa sau 30 giây không chạm (iPhone mặc định) → trình duyệt ngừng chạy game → người đó rớt mạng;
// nếu là máy chủ phòng thì cả phòng dừng. Lúc họp mọi người chỉ đọc và nói chuyện nên rất dễ bị khóa màn hình.
// Dùng Screen Wake Lock (Chrome/Android, Safari iOS 16.4+). Trình duyệt không hỗ trợ thì bỏ qua, game vẫn chạy như cũ.
type Lock = { release(): Promise<void>; addEventListener?(ev: 'release', fn: () => void): void };
type WakeLockNav = Navigator & { wakeLock?: { request(type: 'screen'): Promise<Lock> } };

let want = false;
let lock: Lock | null = null;
let pending = false;
let bound = false;

async function acquire() {
  if (!want || lock || pending || document.hidden) return;
  const wl = (navigator as WakeLockNav).wakeLock;
  if (!wl) return;
  pending = true;
  try {
    const l = await wl.request('screen');
    l.addEventListener?.('release', () => { if (lock === l) lock = null; }); // hệ thống tự nhả (chuyển tab, tắt màn hình)
    if (want) lock = l; else void l.release().catch(() => undefined);
  } catch { /* bị từ chối (pin yếu, chưa có thao tác của người dùng): thử lại ở lần chạm kế tiếp */ }
  finally { pending = false; }
}

/** Bật/tắt giữ màn hình sáng */
export function keepAwake(on: boolean) {
  want = on;
  if (!bound && typeof document !== 'undefined') {
    bound = true;
    // quay lại tab / mở lại màn hình: hệ thống đã nhả khóa, xin lại
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void acquire(); });
    // một số trình duyệt chỉ cho xin ngay sau khi người dùng chạm
    window.addEventListener('pointerdown', () => { void acquire(); }, { passive: true });
  }
  if (on) void acquire();
  else if (lock) { const l = lock; lock = null; void l.release().catch(() => undefined); }
}

/** Đang giữ màn hình sáng không (để kiểm tra tự động) */
export function isAwakeHeld() { return !!lock; }
