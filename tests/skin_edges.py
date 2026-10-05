# Kiểm tra: mọi skin (và người với nhiều kiểu đồ), ở cả 3 nhịp bước, không chạm mép khung vẽ (không bị cắt).
# Cách dùng: dựng bản thử (npm run build:single), mở máy chủ ở cổng 8765, rồi: python3 tests/skin_edges.py
import asyncio, re
from playwright.async_api import async_playwright
BODIES = re.findall(r"\{ id: '([a-z]+)', name: '", open('src/game/look.ts', encoding='utf-8').read().split('export const BODIES')[1].split('];')[0])
JS = """(bodies) => {
  const base = __ui.prefs.look, out = [], L = __look;
  const looks = bodies.map(b => ({ name: b, look: { ...structuredClone(base), body: b } }));
  // nhân vật người: từng món đồ ở từng chỗ, từng kiểu tóc
  const human = () => { const l = structuredClone(base); l.body = 'human'; return l; };
  for (const slot of Object.keys(L.ITEMS)) for (const d of L.ITEMS[slot]) { const l = human(); l.items[slot] = { id: d.id, color: L.defaultColor(d, '#2e9cf0') }; looks.push({ name: `người · ${slot}: ${d.id}`, look: l }); }
  for (const h of L.HAIR_STYLES) { const l = human(); l.hairStyle = h.id; looks.push({ name: `người · tóc ${h.id}`, look: l }); }
  for (const { name, look } of looks) for (const frame of [0, 1, 2]) {
    const c = __charCanvas(look, frame, 1); const ctx = c.getContext('2d'); const W = c.width, H = c.height;
    const d = ctx.getImageData(0, 0, W, H).data, a = (x, y) => d[(y * W + x) * 4 + 3];
    const hit = [];
    for (let y = 0; y < H; y++) { if (a(0, y) > 20) { hit.push('trái'); break; } }
    for (let y = 0; y < H; y++) { if (a(W - 1, y) > 20) { hit.push('phải'); break; } }
    for (let x = 0; x < W; x++) { if (a(x, 0) > 20) { hit.push('trên'); break; } }
    for (let x = 0; x < W; x++) { if (a(x, H - 1) > 20) { hit.push('dưới'); break; } }
    if (hit.length) out.push(`${name} (nhịp ${frame}): chạm mép ${hit.join(', ')}`);
  }
  return out;
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--disable-gpu", "--disable-webgl"])
        pg = await b.new_page()
        await pg.goto("http://localhost:8765/index.html?debug"); await pg.wait_for_timeout(1500)
        bad = await pg.evaluate(JS, BODIES)
        n = await pg.evaluate("Object.values(__look.ITEMS).reduce((a, x) => a + x.length, 0) + __look.HAIR_STYLES.length")
        print(f"(nhân vật người: {n} biến thể)")
        print(f"Đã kiểm {len(BODIES)} skin, mọi món đồ và kiểu tóc của nhân vật người, × 3 nhịp bước:")
        print("\n".join("  ✘ " + x for x in bad) if bad else "  ✔ không skin nào bị cắt")
        await b.close()
asyncio.run(main())
