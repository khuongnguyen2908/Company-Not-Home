// Phòng thử mini-game: mở bằng ?minigames. Chơi thử từng mini-game (bản thật và bản Nội gián làm giả),
// bấm giờ, đánh dấu Ổn / Cần sửa, ghi chú, rồi sao chép hoặc tải toàn bộ phản hồi để gửi lại.
import { openMini, closeMini, openFaceId, openCardSwipe, openColorCheck, openV3, TITLES } from '../ui/minigames';
import { STATIONS, TASKS, levelAt, levelName, roomName, TILE, MINI_DIFF, type MiniKind, type MiniDiff } from '../game/map';
import { COLOR_GROUPS } from '../game/data';
import { avatarURL } from '../render/chars';
import { randomLook, lookColor } from '../game/look';
import { iconSvg, stationIcon } from '../ui/icons';
import { sfx } from '../audio';

const KEY = 'noi-gian:mini-feedback';
type Status = 'none' | 'ok' | 'fix';
interface Fb { status: Status; note: string; times: number[] }
type Store = Record<string, Fb>;
const load = (): Store => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const save = (s: Store) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* bỏ qua */ } };
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/**
 * Độ khó (đánh giá theo cách chơi):
 * - Dễ: một thao tác đơn giản hoặc giữ nút, gần như không thể làm sai.
 * - Trung bình: phải đọc hiểu, đếm, kéo thả hoặc canh thời điểm; làm sai thì làm lại phần đó.
 * - Khó: cần phản xạ, độ chính xác hoặc trí nhớ; sai một bước là mất hết tiến độ.
 */
type Diff = MiniDiff;
const DIFF: Record<string, Diff> = { ...MINI_DIFF, sp_colorcheck: 'de', sp_faceid: 'de', sp_pry: 'tb', sp_rescue: 'tb', sp_desk: 'tb', sp_swipe: 'tb' };
const DIFF_LABEL: Record<Diff, string> = { de: 'Dễ', tb: 'Trung bình', kho: 'Khó' };
/** Việc người khác nhìn thấy được khi bạn đang làm (chứng minh trong sạch, như "việc có hình ảnh" của Among Us) */
const VISIBLE = new Set(['fingerprint', 'sp_faceid', 'sp_colorcheck']);

interface Item { id: string; title: string; hint: string; group: string; where: string; icon: string; fake: boolean; run: (root: HTMLElement, done: () => void, fake: boolean) => void }

function stationInfo(kind: string) {
  const sts = STATIONS.filter(s => s.id === kind);
  const tasks = TASKS.filter(t => (t.steps as string[]).includes(kind)).map(t => t.name);
  const places = sts.map(s => `${roomName(s.room)}, ${levelName(levelAt((s.stand.x + 0.5) * TILE, (s.stand.y + 0.5) * TILE))}`);
  return { used: sts.length > 0, where: sts.length ? `${places.join(' · ')}${tasks.length ? ` · Việc: ${tasks.join(', ')}` : ''}` : 'Không có trạm nào dùng trên bản đồ hiện tại', level: sts.length ? levelAt((sts[0].stand.x + 0.5) * TILE, (sts[0].stand.y + 0.5) * TILE) : 99 };
}

function buildItems(): Item[] {
  const items: Item[] = [];
  const kinds = Object.keys(TITLES) as MiniKind[];
  for (const k of kinds) {
    const info = stationInfo(k);
    const group = k.startsWith('mt_') ? 'Bảo trì (Engineer)' : ['darts', 'claw', 'fishfeed'].includes(k) ? 'Khu giải trí' : ['solar', 'antenna', 'acpanel', 'waterplant'].includes(k) ? 'Sân thượng'
      : k === 'router' || k === 'power' ? 'Sửa sự cố' : !info.used ? 'Không còn dùng' : `Việc thường · ${info.level >= 1 && info.level <= 4 ? levelName(info.level) : 'Khác'}`;
    items.push({ id: k, title: TITLES[k].title, hint: TITLES[k].hint, group, where: info.where, icon: stationIcon(k), fake: k !== 'router' && k !== 'power',
      run: (root, done, fake) => openMini(root, k, done, { fake }) });
  }
  const people = () => Array.from({ length: 7 }, (_, i) => { const look = randomLook(); return { id: i, name: ['Lan', 'Tuấn', 'Mai', 'Hùng', 'Vy', 'Đạt', 'Nhi'][i], url: avatarURL(look), bg: lookColor(look) }; });
  items.push(
    { id: 'sp_faceid', title: 'Máy Face ID (HR)', hint: 'Chọn một người rồi giữ nút quét.', group: 'Màn đặc biệt', where: 'Phòng HR, Tầng 3 · chỉ HR dùng', icon: 'idcard', fake: false,
      run: (root, done) => openFaceId(root, people(), () => undefined, () => done()) },
    { id: 'sp_colorcheck', title: 'Máy so màu (Artist)', hint: 'Chọn một nhóm màu rồi giữ nút để kiểm tra.', group: 'Màn đặc biệt', where: 'Studio Art, Tầng 3 · chỉ Artist dùng', icon: 'palette', fake: false,
      run: (root, done) => openColorCheck(root, COLOR_GROUPS.map(g => ({ id: g.id, name: g.name, hex: g.hex })), [], () => undefined, () => { done(); return Math.random() < 0.5; }) },
    { id: 'sp_swipe', title: 'Quẹt thẻ mở cửa bị khóa', hint: 'Quẹt thẻ đúng tốc độ để mở cửa.', group: 'Màn đặc biệt', where: 'Cửa các phòng khi Nội gián khóa cửa', icon: 'keycard', fake: false,
      run: (root, done) => openCardSwipe(root, done) },
    { id: 'sp_pry', title: 'Cạy cửa thang máy', hint: 'Đưa xà beng vào khe cửa rồi bẩy trái, phải xen kẽ cho khe mở rộng.', group: 'Màn đặc biệt', where: 'Trong buồng thang máy khi mất điện', icon: 'crowbar', fake: false,
      run: (root, done) => openV3(root, 'pry', 'Cạy cửa thang máy', 'Thang kẹt vì mất điện. Đưa xà beng vào khe cửa rồi bẩy trái, phải xen kẽ.', done) },
    { id: 'sp_rescue', title: 'Mở cửa thang máy (Engineer)', hint: 'Tra chìa cứu hộ, xoay đúng chiều, kéo cửa sang hai bên.', group: 'Màn đặc biệt', where: 'Cửa thang máy khi mất điện · chỉ Engineer', icon: 'wrench', fake: false,
      run: (root, done) => openV3(root, 'rescue', 'Mở cửa thang máy', 'Bạn là Engineer: tra chìa khóa cứu hộ, xoay đúng chiều, rồi kéo cửa sang hai bên.', done) },
    { id: 'sp_desk', title: 'Giả vờ gõ phím (Sếp đi tuần)', hint: 'Gõ đúng các chữ đang bay tới trước khi chúng chạm vào bạn.', group: 'Màn đặc biệt', where: 'Bàn của bạn, Phòng làm việc Tầng 2 · khi Sếp đi tuần', icon: 'desk', fake: false,
      run: (root, done) => openV3(root, 'desk', 'Giả vờ gõ phím', 'Sếp đi tuần! Gõ đúng các chữ đang bay tới trước khi chúng chạm vào bạn.', done) },
  );
  return items;
}

export function openMinigameLab(root: HTMLElement) {
  document.body.classList.add('content-mode', 'lab-mode');
  const items = buildItems();
  const store = load();
  const fb = (id: string): Fb => (store[id] ??= { status: 'none', note: '', times: [] });
  let filter: 'all' | 'none' | 'fix' | 'ok' = 'all';
  let dfilter: 'all' | Diff | 'vis' = 'all';
  root.innerHTML = `<div class="ct lab">
    <header class="ct-head">
      <div><h1>${iconSvg('gamepad')} Phòng thử mini-game</h1><p class="ct-sub">Bấm "Chơi thử" để mở từng mini-game như trong game thật. Thời gian từ lúc mở tới lúc xong được tự ghi lại. Đánh dấu Ổn hoặc Cần sửa, ghi chú, rồi sao chép phản hồi gửi lại.</p></div>
      <div class="ct-actions">
        <button id="lb-copy" class="ct-btn primary">Sao chép phản hồi</button>
        <button id="lb-dl" class="ct-btn">Tải file phản hồi</button>
        <button id="lb-reset" class="ct-btn">Xóa hết đánh giá</button>
      </div>
    </header>
    <div class="ct-status lb-status"></div>
    <div class="lb-filters"><span class="lb-flabel">Đánh giá</span>${[['all', 'Tất cả'], ['none', 'Chưa xem'], ['fix', 'Cần sửa'], ['ok', 'Ổn']].map(([v, l]) => `<button data-f="${v}" class="${v === 'all' ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="lb-filters lb-dfilters"><span class="lb-flabel">Độ khó</span>${[['all', 'Tất cả'], ['de', 'Dễ'], ['tb', 'Trung bình'], ['kho', 'Khó'], ['vis', 'Người khác thấy được']].map(([v, l]) => `<button data-d="${v}" class="${v === 'all' ? 'on' : ''}">${l}</button>`).join('')}<span class="lb-flabel lb-count"></span></div>
    <p class="ct-sub lb-legend"><b>Dễ:</b> một thao tác hoặc giữ nút, gần như không thể sai. <b>Trung bình:</b> phải đọc, đếm, kéo thả hoặc canh thời điểm. <b>Khó:</b> cần phản xạ, độ chính xác hoặc trí nhớ, sai một bước là làm lại từ đầu. Không có mini-game nào cần nhiều người cùng làm.</p>
    <div class="lb-list"></div>
    <p class="ct-sub lb-tip">Mẹo: mở link này trên điện thoại (thêm ?minigames vào cuối địa chỉ game) để thử cảm giác chạm thật.</p>
  </div>`;
  const $ = <T extends HTMLElement>(s: string) => root.querySelector(s) as T;

  const status = () => {
    const all = items.length, ok = items.filter(i => fb(i.id).status === 'ok').length, fix = items.filter(i => fb(i.id).status === 'fix').length;
    $('.lb-status').innerHTML = `<span>Đã xem ${ok + fix}/${all}</span><span>✅ Ổn: ${ok}</span><span class="${fix ? 'bad' : ''}">🔧 Cần sửa: ${fix}</span>`;
  };
  const card = (it: Item) => {
    const f = fb(it.id);
    const t = f.times.length ? `Lần chơi gần nhất: ${f.times[f.times.length - 1].toFixed(1)} giây${f.times.length > 1 ? ` · trung bình ${(f.times.reduce((a, b) => a + b, 0) / f.times.length).toFixed(1)} giây (${f.times.length} lần)` : ''}` : 'Chưa chơi lần nào';
    return `<article class="lb-card st-${f.status}" data-id="${it.id}">
      <div class="lb-top"><span class="lb-ic">${iconSvg(it.icon)}</span><div><h3>${esc(it.title)}</h3><p class="lb-tags"><span class="lb-diff d-${DIFF[it.id] ?? 'tb'}">${DIFF_LABEL[DIFF[it.id] ?? 'tb']}</span>${VISIBLE.has(it.id) ? '<span class="lb-vis">Người khác thấy được</span>' : ''}</p><p class="lb-where">${esc(it.where)}</p></div></div>
      <p class="lb-hint">${esc(it.hint)}</p>
      <div class="lb-play"><button class="ct-btn primary lb-run">▶ Chơi thử</button>${it.fake ? '<button class="ct-btn lb-fake">Chơi bản Nội gián</button>' : ''}<small class="lb-time">${t}</small></div>
      <div class="lb-judge"><button class="lb-ok${f.status === 'ok' ? ' on' : ''}">✅ Ổn</button><button class="lb-fix${f.status === 'fix' ? ' on' : ''}">🔧 Cần sửa</button></div>
      <textarea class="lb-note" rows="2" placeholder="Ghi chú: khó/dễ quá, chỗ nào khó hiểu, lỗi gì, muốn đổi gì…">${esc(f.note)}</textarea>
    </article>`;
  };
  const render = () => {
    const groups = [...new Set(items.map(i => i.group))];
    const list = items.filter(i => (filter === 'all' || fb(i.id).status === filter) && (dfilter === 'all' || (dfilter === 'vis' ? VISIBLE.has(i.id) : DIFF[i.id] === dfilter)));
    const cnt = root.querySelector('.lb-count'); if (cnt) cnt.textContent = `${list.length} mini-game`;
    $('.lb-list').innerHTML = groups.map(g => {
      const its = list.filter(i => i.group === g);
      return its.length ? `<section class="lb-group"><h2>${esc(g)} <small>${its.length}</small></h2><div class="lb-grid">${its.map(card).join('')}</div></section>` : '';
    }).join('') || '<p class="ct-empty">Không có mini-game nào trong mục này.</p>';
    root.querySelectorAll<HTMLElement>('.lb-card').forEach(el => {
      const it = items.find(i => i.id === el.dataset.id)!;
      const play = (fake: boolean) => {
        sfx.unlock();
        const t0 = performance.now();
        it.run(document.body, () => {
          const sec = (performance.now() - t0) / 1000;
          fb(it.id).times.push(Math.round(sec * 10) / 10);
          if (fb(it.id).times.length > 10) fb(it.id).times.shift();
          save(store);
          // chỉ đóng đúng khung vừa xong (nếu đã mở mini-game khác thì để yên)
          const finishedSheet = document.querySelector('.modal .sheet');
          window.setTimeout(() => { if (finishedSheet?.isConnected) closeMini(); render(); status(); }, 900);
        }, fake);
      };
      (el.querySelector('.lb-run') as HTMLButtonElement).onclick = () => play(false);
      (el.querySelector('.lb-fake') as HTMLButtonElement | null)?.addEventListener('click', () => play(true));
      const setSt = (s: Status) => { const f = fb(it.id); f.status = f.status === s ? 'none' : s; save(store); render(); status(); };
      (el.querySelector('.lb-ok') as HTMLButtonElement).onclick = () => setSt('ok');
      (el.querySelector('.lb-fix') as HTMLButtonElement).onclick = () => setSt('fix');
      (el.querySelector('.lb-note') as HTMLTextAreaElement).oninput = (e) => { fb(it.id).note = (e.target as HTMLTextAreaElement).value; save(store); };
    });
  };
  const report = () => {
    const lines = ['# Phản hồi mini-game', '', `Ngày: ${new Date().toLocaleString('vi-VN')}`, ''];
    for (const g of [...new Set(items.map(i => i.group))]) {
      const its = items.filter(i => i.group === g);
      lines.push(`## ${g}`, '');
      for (const it of its) {
        const f = fb(it.id);
        const st = f.status === 'ok' ? 'Ổn' : f.status === 'fix' ? 'CẦN SỬA' : 'Chưa xem';
        const tm = f.times.length ? ` · ${f.times.length} lần chơi, trung bình ${(f.times.reduce((a, b) => a + b, 0) / f.times.length).toFixed(1)} giây` : '';
        lines.push(`- **${it.title}** (${it.id}, ${DIFF_LABEL[DIFF[it.id] ?? 'tb']}): ${st}${tm}${f.note.trim() ? `\n  - Ghi chú: ${f.note.trim().replace(/\n/g, ' ')}` : ''}`);
      }
      lines.push('');
    }
    return lines.join('\n');
  };
  root.querySelectorAll<HTMLButtonElement>('.lb-filters button[data-f]').forEach(b => b.onclick = () => {
    filter = b.dataset.f as typeof filter;
    root.querySelectorAll('.lb-filters button[data-f]').forEach(x => x.classList.toggle('on', x === b));
    render();
  });
  root.querySelectorAll<HTMLButtonElement>('.lb-filters button[data-d]').forEach(b => b.onclick = () => {
    dfilter = b.dataset.d as typeof dfilter;
    root.querySelectorAll('.lb-filters button[data-d]').forEach(x => x.classList.toggle('on', x === b));
    render();
  });
  $('#lb-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(report()); $('#lb-copy').textContent = 'Đã sao chép!'; }
    catch { const ta = document.createElement('textarea'); ta.value = report(); document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); $('#lb-copy').textContent = 'Đã sao chép!'; }
    window.setTimeout(() => { $('#lb-copy').textContent = 'Sao chép phản hồi'; }, 1600);
  };
  $('#lb-dl').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([report()], { type: 'text/markdown;charset=utf-8' }));
    a.download = 'phan-hoi-mini-game.md'; a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('#lb-reset').onclick = () => {
    if (!confirm('Xóa hết đánh giá, ghi chú và thời gian đã lưu?')) return;
    for (const k of Object.keys(store)) delete store[k];
    save(store); render(); status();
  };
  render(); status();
}
