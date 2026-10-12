// Máy chuyển tiếp TURN: hàm /api/turn (Cloudflare Pages Function), lấy sẵn ở trình duyệt, truyền vào PeerJS.
// (Đã thử thật với máy TURN cục bộ: chỉ cho phép đi qua TURN vẫn vào phòng được; tắt máy TURN thì không vào được.)
// Cách dùng: npx tsx tests/turn_test.ts
import { onRequestGet } from '../functions/api/turn';
import { prefetchIce, iceConfig, _setIceForTest } from '../src/net/ice';
import { PeerTransport, type PeerCtor } from '../src/net/peer';

let fails = 0, passes = 0;
const ok = (c: boolean, m: string) => { if (c) passes++; else fails++; console.log(`  ${c ? '✔' : '✘'} ${m}`); };

async function main() {
  console.log('Hàm /api/turn trên Cloudflare Pages');
  {
    const r = await onRequestGet({ env: {} });
    ok(r.status === 404, `chưa cài khóa TURN: trả 404 (${r.status}), game chơi như cũ`);
    const realFetch = globalThis.fetch;
    let sent: { url: string; auth: string; body: string } | null = null;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      sent = { url, auth: (init.headers as Record<string, string>).authorization, body: String(init.body) };
      return new Response(JSON.stringify({ iceServers: [{ urls: ['stun:stun.cloudflare.com:3478'] }, { urls: ['turn:turn.cloudflare.com:3478?transport=udp'], username: 'u', credential: 'c' }] }), { status: 201 });
    }) as typeof fetch;
    const r2 = await onRequestGet({ env: { TURN_KEY_ID: 'abc', TURN_KEY_API_TOKEN: 'bí-mật' } });
    const d = await r2.json() as { iceServers: { username?: string }[] };
    ok(r2.status === 200 && d.iceServers.length === 2 && d.iceServers[1].username === 'u', 'có khóa: trả danh sách máy chuyển tiếp cho trình duyệt');
    ok(!!sent && sent!.url.includes('/v1/turn/keys/abc/credentials/generate-ice-servers') && sent!.auth === 'Bearer bí-mật' && JSON.parse(sent!.body).ttl === 43200, 'gọi đúng API của Cloudflare, giấy thông hành 12 giờ');
    ok(!JSON.stringify(d).includes('bí-mật'), 'không lộ API token xuống trình duyệt');
    ok(r2.headers.get('cache-control') === 'no-store', 'không cho lưu đệm giấy thông hành');
    globalThis.fetch = (async () => new Response('x', { status: 401 })) as typeof fetch;
    ok((await onRequestGet({ env: { TURN_KEY_ID: 'abc', TURN_KEY_API_TOKEN: 'sai' } })).status === 502, 'khóa sai: trả lỗi, không làm hỏng game');
    globalThis.fetch = (async () => { throw new Error('mất mạng'); }) as typeof fetch;
    ok((await onRequestGet({ env: { TURN_KEY_ID: 'abc', TURN_KEY_API_TOKEN: 't' } })).status === 502, 'Cloudflare không phản hồi: trả lỗi gọn');
    globalThis.fetch = realFetch;
  }

  console.log('Trình duyệt lấy sẵn máy chuyển tiếp');
  {
    (globalThis as { location?: unknown }).location = { protocol: 'https:' };
    _setIceForTest(null);
    await prefetchIce((async () => new Response('', { status: 404 })) as typeof fetch);
    ok(iceConfig() === null, 'không có /api/turn (GitHub Pages, chạy thử): dùng cấu hình mặc định như trước');
    await prefetchIce((async () => new Response(JSON.stringify({ iceServers: [{ urls: 'turn:x', username: 'a', credential: 'b' }], ttl: 43200 }), { status: 200 })) as typeof fetch);
    const cfg = iceConfig();
    ok(!!cfg && cfg.iceServers.some(s => s.urls === 'turn:x') && cfg.iceServers.some(s => String(s.urls).startsWith('stun:')), 'có /api/turn: dùng máy chuyển tiếp + STUN');
    let opts: Record<string, unknown> | undefined;
    const Fake = class { constructor(_id?: string, o?: Record<string, unknown>) { opts = o; } on() {} connect() { return { on() {}, open: false, send() {}, close() {} }; } reconnect() {} destroy() {} destroyed = false; disconnected = false; } as unknown as PeerCtor;
    const t = new PeerTransport('me', 'host', 'ABC-234', Fake);
    ok(!!opts && (opts.config as { iceServers: unknown[] })?.iceServers?.length === 2, 'mở đường P2P với máy chuyển tiếp đã lấy');
    t.close();
    _setIceForTest(null);
    new PeerTransport('me2', 'client', 'ABC-234', Fake).close();
    ok(!!opts && opts.config === undefined, 'chưa có máy chuyển tiếp: không ép cấu hình (PeerJS tự dùng mặc định)');
  }
  console.log(fails ? `\nCÓ ${fails} LỖI (${passes} đạt)` : `\nTất cả ${passes} kiểm tra đều đạt`);
  process.exit(fails ? 1 : 0);
}
void main();
