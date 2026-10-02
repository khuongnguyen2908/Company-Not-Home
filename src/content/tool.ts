// Công cụ nội dung: mở bằng ?content. Xem/sửa mọi câu chữ, xuất ra Excel để sửa trên Google Sheets,
// nhập lại (có kiểm tra lỗi), thử ngay trong game, và tải file content.xlsx để đưa lên GitHub.
import { registry, validate, SHEETS, TEST_KEY, type Entry, type Overrides, type SheetName } from './registry';

const XLSX_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let XLSX: any = null;
async function loadXlsx() {
  if (XLSX) return XLSX;
  await new Promise<void>((res, rej) => {
    const s = document.createElement('script');
    s.src = XLSX_CDN; s.onload = () => res(); s.onerror = () => rej(new Error('Không tải được thư viện Excel (cần có mạng)'));
    document.head.appendChild(s);
  });
  XLSX = (window as unknown as { XLSX: unknown }).XLSX;
  return XLSX;
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const same = (a: string | string[], b: string | string[]) => JSON.stringify(a) === JSON.stringify(b);

export function openContentTool(root: HTMLElement) {
  document.body.classList.add('content-mode');
  const reg = registry();
  // Giá trị đang chỉnh: bắt đầu từ nội dung game đang dùng (mặc định + bản chính thức + bản thử)
  const values = new Map<string, string | string[]>(reg.map(e => [e.key, e.get()]));
  const errors = new Map<string, string[]>();
  let sheet: SheetName = SHEETS[0];
  let query = '';
  let onlyChanged = false;

  root.innerHTML = `<div class="ct">
    <header class="ct-head">
      <div><h1>🛠️ Công cụ nội dung</h1><p class="ct-sub">Sửa mọi câu chữ trong game. Xuất ra Excel để sửa trên Google Sheets, nhập lại, bấm "Thử trong game" để xem ngay.</p></div>
      <div class="ct-actions">
        <button id="ct-export" class="ct-btn">⬇️ Xuất Excel</button>
        <label class="ct-btn">⬆️ Nhập Excel<input id="ct-import" type="file" accept=".xlsx,.xls,.csv" hidden></label>
        <button id="ct-test" class="ct-btn primary">▶️ Thử trong game</button>
        <button id="ct-untest" class="ct-btn">↩️ Bỏ bản thử</button>
        <button id="ct-github" class="ct-btn">💾 Tải file cho GitHub</button>
      </div>
    </header>
    <div class="ct-status"></div>
    <div class="ct-body">
      <nav class="ct-tabs"></nav>
      <section class="ct-main">
        <div class="ct-tools"><input id="ct-q" type="search" placeholder="Tìm theo mã hoặc nội dung…"><label><input id="ct-only" type="checkbox"> Chỉ hiện dòng đã sửa</label></div>
        <div class="ct-table"></div>
      </section>
    </div>
  </div>`;
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;

  const changedCount = (sh?: SheetName) => reg.filter(e => (!sh || e.sheet === sh) && !same(values.get(e.key)!, e.def)).length;
  const errorCount = () => [...errors.values()].filter(x => x.length).length;

  const renderStatus = (msg = '') => {
    const hasTest = !!localStorage.getItem(TEST_KEY);
    $('.ct-status').innerHTML = `<span>📝 ${changedCount()} dòng khác mặc định</span>
      <span class="${errorCount() ? 'bad' : ''}">${errorCount() ? `⚠️ ${errorCount()} dòng lỗi (sửa trước khi lưu)` : '✅ Không có lỗi'}</span>
      <span>${hasTest ? '🧪 Game đang chạy bản thử trên máy này' : 'Game đang dùng nội dung chính thức'}</span>
      ${msg ? `<b class="ct-msg">${esc(msg)}</b>` : ''}`;
  };

  const renderTabs = () => {
    $('.ct-tabs').innerHTML = SHEETS.map(sh => {
      const n = reg.filter(e => e.sheet === sh).length, c = changedCount(sh);
      const bad = reg.some(e => e.sheet === sh && (errors.get(e.key)?.length ?? 0) > 0);
      return `<button data-s="${esc(sh)}" class="${sh === sheet ? 'on' : ''}${bad ? ' bad' : ''}">${esc(sh)}<small>${n} dòng${c ? ` · ${c} đã sửa` : ''}</small></button>`;
    }).join('');
    root.querySelectorAll<HTMLButtonElement>('.ct-tabs button').forEach(b => b.onclick = () => { sheet = b.dataset.s as SheetName; renderTabs(); renderTable(); });
  };

  const rowHtml = (e: Entry) => {
    const v = values.get(e.key)!;
    const changed = !same(v, e.def);
    const errs = errors.get(e.key) ?? [];
    const txt = Array.isArray(v) ? v.join('\n') : v;
    const def = Array.isArray(e.def) ? e.def.join(' · ') : e.def;
    const rows = Array.isArray(v) ? Math.min(14, v.length + 1) : Math.min(6, Math.ceil(txt.length / 70) + 1);
    return `<div class="ct-row${changed ? ' changed' : ''}${errs.length ? ' err' : ''}" data-k="${esc(e.key)}">
      <div class="ct-key"><code>${esc(e.key)}</code><small>${esc(e.note)}${e.max ? ` · tối đa ${e.max} ký tự${e.kind === 'list' ? '/dòng' : ''}` : ''}</small></div>
      <div class="ct-val"><textarea rows="${rows}" spellcheck="false">${esc(txt)}</textarea>
        ${e.kind === 'list' ? '<small class="ct-hint">Mỗi dòng một mục. Thêm/bớt dòng thoải mái.</small>' : ''}
        ${errs.length ? `<p class="ct-errs">${errs.map(esc).join('<br>')}</p>` : ''}
        ${changed ? `<details class="ct-def"><summary>Mặc định</summary>${esc(def)}</details>` : ''}</div>
      <button class="ct-reset" title="Trả về mặc định" ${changed ? '' : 'disabled'}>↺</button>
    </div>`;
  };

  const renderTable = () => {
    const q = query.trim().toLowerCase();
    const list = reg.filter(e => e.sheet === sheet || (q && true)).filter(e => {
      if (onlyChanged && same(values.get(e.key)!, e.def)) return false;
      if (!q) return e.sheet === sheet;
      const v = values.get(e.key)!;
      return e.key.toLowerCase().includes(q) || (Array.isArray(v) ? v.join(' ') : v).toLowerCase().includes(q);
    });
    $('.ct-table').innerHTML = list.length ? list.map(rowHtml).join('') : '<p class="ct-empty">Không có dòng nào.</p>';
    root.querySelectorAll<HTMLElement>('.ct-row').forEach(row => {
      const e = reg.find(x => x.key === row.dataset.k)!;
      const ta = row.querySelector('textarea') as HTMLTextAreaElement;
      ta.oninput = () => {
        const v = e.kind === 'list' ? ta.value.split('\n').map(x => x.trim()).filter(Boolean) : ta.value;
        values.set(e.key, v);
        errors.set(e.key, validate(e, v));
        row.classList.toggle('changed', !same(v, e.def));
        row.classList.toggle('err', (errors.get(e.key) ?? []).length > 0);
        const pe = row.querySelector('.ct-errs');
        const errs = errors.get(e.key)!;
        if (errs.length) { if (pe) pe.innerHTML = errs.map(esc).join('<br>'); else ta.insertAdjacentHTML('afterend', `<p class="ct-errs">${errs.map(esc).join('<br>')}</p>`); }
        else pe?.remove();
        (row.querySelector('.ct-reset') as HTMLButtonElement).disabled = same(v, e.def);
        renderStatus(); renderTabs();
      };
      (row.querySelector('.ct-reset') as HTMLButtonElement).onclick = () => { values.set(e.key, Array.isArray(e.def) ? [...e.def] : e.def); errors.delete(e.key); renderTable(); renderTabs(); renderStatus(); };
    });
  };

  // ----- Excel -----
  const buildWorkbook = async () => {
    const X = await loadXlsx();
    const wb = X.utils.book_new();
    const guide = [
      ['Văn Phòng Hạnh Phúc (có rắn) · File nội dung'],
      [''],
      ['Cách dùng'],
      ['1. Sửa cột "Nội dung" ở các trang tính. Không sửa cột "Mã".'],
      ['2. {tên} là chỗ trống game tự điền (tên người, phòng...). Giữ nguyên, không xóa, không đổi tên.'],
      ['3. Trang "Danh sách": mỗi dòng một mục. Thêm hoặc xóa dòng thoải mái (giữ cột "Danh sách" đúng tên).'],
      ['4. Tải về dạng .xlsx, mở Công cụ nội dung (thêm ?content vào địa chỉ game), bấm "Nhập Excel".'],
      ['5. Công cụ báo lỗi nếu có (câu quá dài, thiếu chỗ trống...). Bấm "Thử trong game" để xem.'],
      ['6. Ưng rồi: bấm "Tải file cho GitHub", đưa file content.xlsx vào thư mục content/ của repo.'],
    ];
    const gs = X.utils.aoa_to_sheet(guide); gs['!cols'] = [{ wch: 110 }];
    X.utils.book_append_sheet(wb, gs, 'Hướng dẫn');
    for (const sh of SHEETS) {
      const es = reg.filter(e => e.sheet === sh);
      let aoa: string[][];
      if (sh === 'Danh sách') {
        aoa = [['Danh sách', 'Nội dung', 'Ghi chú']];
        for (const e of es) (values.get(e.key) as string[]).forEach((item, i) => aoa.push([e.key, item, i === 0 ? e.note : '']));
      } else {
        aoa = [['Mã', 'Nội dung', 'Mặc định', 'Ghi chú']];
        for (const e of es) aoa.push([e.key, values.get(e.key) as string, e.def as string, e.note + (e.max ? ` (tối đa ${e.max} ký tự)` : '')]);
      }
      const ws = X.utils.aoa_to_sheet(aoa);
      ws['!cols'] = sh === 'Danh sách' ? [{ wch: 22 }, { wch: 90 }, { wch: 50 }] : [{ wch: 30 }, { wch: 80 }, { wch: 60 }, { wch: 40 }];
      X.utils.book_append_sheet(wb, ws, sh);
    }
    return { X, wb };
  };
  const download = async (name: string) => {
    const { X, wb } = await buildWorkbook();
    X.writeFile(wb, name);
  };

  const importFile = async (file: File) => {
    const X = await loadXlsx();
    const wb = X.read(await file.arrayBuffer(), { type: 'array' });
    const found: Overrides = {};
    const unknown: string[] = [];
    for (const name of wb.SheetNames) {
      if (name === 'Hướng dẫn') continue;
      const rows: string[][] = X.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false });
      if (!rows.length) continue;
      const head = rows[0].map(x => String(x).trim());
      if (head[0] === 'Danh sách') {
        for (const r of rows.slice(1)) {
          const k = String(r[0] ?? '').trim(), v = String(r[1] ?? '').trim();
          if (!k || !v) continue;
          if (!Array.isArray(found[k])) found[k] = [];
          (found[k] as string[]).push(v);
        }
      } else {
        const ci = Math.max(0, head.indexOf('Nội dung'));
        for (const r of rows.slice(1)) {
          const k = String(r[0] ?? '').trim();
          if (!k) continue;
          found[k] = String(r[ci === 0 ? 1 : ci] ?? '');
        }
      }
    }
    let changed = 0, bad = 0;
    for (const [k, v] of Object.entries(found)) {
      const e = reg.find(x => x.key === k);
      if (!e) { unknown.push(k); continue; }
      if (e.kind === 'list' && !Array.isArray(v)) continue;
      if (e.kind === 'text' && typeof v !== 'string') continue;
      if (!same(values.get(k)!, v)) changed++;
      values.set(k, v);
      const errs = validate(e, v);
      errors.set(k, errs);
      if (errs.length) bad++;
    }
    renderTabs(); renderTable();
    renderStatus(`Đã nhập "${file.name}": ${changed} dòng thay đổi${bad ? `, ${bad} dòng lỗi` : ''}${unknown.length ? `, bỏ qua ${unknown.length} mã không tồn tại` : ''}.`);
    if (bad) { const first = reg.find(e => (errors.get(e.key) ?? []).length); if (first) { sheet = first.sheet; renderTabs(); renderTable(); } }
  };

  const diff = (): Overrides => {
    const o: Overrides = {};
    for (const e of reg) { const v = values.get(e.key)!; if (!same(v, e.def)) o[e.key] = v; }
    return o;
  };

  $('#ct-export').onclick = () => download('noi-dung-van-phong.xlsx').catch(err => renderStatus(String(err.message ?? err)));
  ($('#ct-import') as HTMLInputElement).onchange = (ev) => { const f = (ev.target as HTMLInputElement).files?.[0]; if (f) importFile(f).catch(err => renderStatus('Lỗi đọc file: ' + (err.message ?? err))); (ev.target as HTMLInputElement).value = ''; };
  $('#ct-test').onclick = () => {
    if (errorCount()) { renderStatus('Còn dòng lỗi, sửa xong mới thử được.'); return; }
    localStorage.setItem(TEST_KEY, JSON.stringify(diff()));
    renderStatus('Đã lưu bản thử. Đang mở game trong thẻ mới…');
    window.open(location.pathname, '_blank');
  };
  $('#ct-untest').onclick = () => { localStorage.removeItem(TEST_KEY); location.reload(); };
  $('#ct-github').onclick = async () => {
    if (errorCount()) { renderStatus('Còn dòng lỗi, sửa xong mới tải được.'); return; }
    await download('content.xlsx').catch(err => renderStatus(String(err.message ?? err)));
    renderStatus('Đã tải content.xlsx. Trên GitHub: vào thư mục content/ → Add file → Upload files → thả file này vào → Commit. Trang game tự cập nhật sau vài phút.');
  };
  ($('#ct-q') as HTMLInputElement).oninput = (ev) => { query = (ev.target as HTMLInputElement).value; renderTable(); };
  ($('#ct-only') as HTMLInputElement).onchange = (ev) => { onlyChanged = (ev.target as HTMLInputElement).checked; renderTable(); };

  for (const e of reg) { const er = validate(e, values.get(e.key)!); if (er.length) errors.set(e.key, er); }
  renderTabs(); renderTable(); renderStatus();
}
