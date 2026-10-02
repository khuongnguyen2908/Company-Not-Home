// Đọc content/content.xlsx (nếu có) và chuyển thành src/content/overrides.json để đóng gói vào game.
// File Excel lấy từ Công cụ nội dung (?content → "Tải file cho GitHub"). Không có file thì game dùng nội dung mặc định.
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const src = path.resolve('content/content.xlsx');
const out = path.resolve('src/content/overrides.json');
if (!fs.existsSync(src)) {
  fs.writeFileSync(out, '{}\n');
  console.log('[nội dung] Không có content/content.xlsx: dùng nội dung mặc định');
  process.exit(0);
}
const wb = XLSX.read(fs.readFileSync(src), { type: 'buffer' });
const o = {};
for (const name of wb.SheetNames) {
  if (name === 'Hướng dẫn') continue;
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false });
  if (!rows.length) continue;
  const head = rows[0].map(x => String(x).trim());
  if (head[0] === 'Danh sách') {
    for (const r of rows.slice(1)) {
      const k = String(r[0] ?? '').trim(), v = String(r[1] ?? '').trim();
      if (!k || !v) continue;
      (o[k] ??= []).push(v);
    }
  } else {
    const ci = Math.max(1, head.indexOf('Nội dung'));
    for (const r of rows.slice(1)) {
      const k = String(r[0] ?? '').trim();
      if (k) o[k] = String(r[ci] ?? '');
    }
  }
}
fs.writeFileSync(out, JSON.stringify(o, null, 1) + '\n');
console.log(`[nội dung] Đã đọc ${Object.keys(o).length} mục từ content/content.xlsx`);
