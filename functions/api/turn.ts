// Cloudflare Pages Function: /api/turn
// Cấp "giấy thông hành" tạm thời (hết hạn sau 12 giờ) cho máy chuyển tiếp TURN của Cloudflare,
// để người chơi ở mạng khác nhau (4G, mạng công ty chặn kết nối trực tiếp) vẫn nối được với chủ phòng.
// Khóa bí mật nằm trong biến môi trường của Cloudflare Pages, không bao giờ gửi xuống trình duyệt:
//   TURN_KEY_ID         — mã khóa TURN (Turn Token ID)
//   TURN_KEY_API_TOKEN  — API token của khóa TURN đó
// Chưa đặt hai biến này thì trả 404: game tự chơi như cũ (chỉ STUN).

interface Env { TURN_KEY_ID?: string; TURN_KEY_API_TOKEN?: string }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

export async function onRequestGet(context: { env: Env }): Promise<Response> {
  const { TURN_KEY_ID: id, TURN_KEY_API_TOKEN: token } = context.env;
  if (!id || !token) return json({ error: 'TURN chưa được cài đặt' }, 404);
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(id)}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ ttl: 12 * 3600 }),
    });
    if (!r.ok) return json({ error: `Cloudflare trả lỗi ${r.status}` }, 502);
    const data = await r.json() as { iceServers?: unknown };
    const list = Array.isArray(data.iceServers) ? data.iceServers : data.iceServers ? [data.iceServers] : [];
    if (!list.length) return json({ error: 'Không nhận được máy chuyển tiếp' }, 502);
    return json({ iceServers: list, ttl: 12 * 3600 });
  } catch {
    return json({ error: 'Không gọi được Cloudflare' }, 502);
  }
}
