// Máy chuyển tiếp (TURN) cho kết nối P2P giữa hai mạng khác nhau.
// Trên Cloudflare Pages: /api/turn cấp giấy thông hành tạm thời (xem functions/api/turn.ts).
// Nơi khác (GitHub Pages, file đơn, chạy thử) không có /api/turn: dùng cấu hình mặc định của PeerJS như trước.
import { netLog } from './netlog';

export type IceServer = { urls: string | string[]; username?: string; credential?: string };
let cached: { servers: IceServer[]; until: number } | null = null;
let inflight: Promise<void> | null = null;

/** Lấy sẵn danh sách máy chuyển tiếp (gọi lúc mở game và lúc tạo / vào phòng); lỗi thì bỏ qua im lặng */
export function prefetchIce(fetcher: typeof fetch | undefined = globalThis.fetch): Promise<void> {
  if (cached && Date.now() < cached.until) return Promise.resolve();
  if (inflight || !fetcher || typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return inflight ?? Promise.resolve();
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => ctl?.abort(), 4000);
  inflight = fetcher('./api/turn', { cache: 'no-store', signal: ctl?.signal })
    .then(r => (r.ok ? r.json() : null))
    .then((d: { iceServers?: IceServer[]; ttl?: number } | null) => {
      if (d && Array.isArray(d.iceServers) && d.iceServers.length) {
        // dùng tới khi còn 1 giờ là hết hạn
        cached = { servers: d.iceServers, until: Date.now() + Math.max(600, (d.ttl ?? 43200) - 3600) * 1000 };
        netLog('[P2P] có máy chuyển tiếp TURN của Cloudflare (nối được giữa hai mạng khác nhau)');
      }
    })
    .catch(() => undefined)
    .finally(() => { clearTimeout(timer); inflight = null; });
  return inflight;
}

/** Cấu hình ICE cho PeerJS: có TURN thì dùng (kèm STUN của Cloudflare và Google); chưa có thì null (mặc định của PeerJS) */
export function iceConfig(): { iceServers: IceServer[] } | null {
  if (!cached || Date.now() >= cached.until) return null;
  return { iceServers: [...cached.servers, { urls: 'stun:stun.l.google.com:19302' }] };
}

/** Chỉ dùng cho kiểm tra tự động */
export function _setIceForTest(servers: IceServer[] | null) { cached = servers ? { servers, until: Date.now() + 3600e3 } : null; }
