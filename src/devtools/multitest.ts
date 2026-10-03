// Màn chia ô ?multitest=N: N người chơi trên cùng một màn hình để tự thử chơi nhiều người.
// Mỗi ô là một trang game riêng (?mt=k), các ô nói chuyện với nhau trong trình duyệt (không qua mạng).
// Bấm vào ô nào thì điều khiển người đó; chỉ ô đang chọn phát âm thanh.
import { newRoomCode } from '../net/room';

export function openMultitest(root: HTMLElement, n: number) {
  n = Math.max(2, Math.min(6, n));
  const code = newRoomCode();
  document.body.classList.add('mt-mode');
  const base = `${location.origin}${location.pathname}`;
  const cols = n <= 2 ? 2 : n <= 4 ? 2 : 3;
  root.innerHTML = `<div class="mt">
    <div class="mt-bar">
      <b>Thử nhiều người · phòng ${code}</b>
      <button type="button" data-c="start">Bắt đầu ván</button>
      <button type="button" data-c="ready">Cả phòng sẵn sàng</button>
      <button type="button" data-c="meeting">Gọi họp ngay</button>
      <button type="button" data-c="again">Chơi ván mới</button>
      <label>Ép làm Nội gián: <select id="mt-imp"><option value="-1">ngẫu nhiên</option>${Array.from({ length: n }, (_, i) => `<option value="${i}">Người ${i + 1}</option>`).join('')}</select></label>
      <span class="mt-hint">Bấm vào một ô để điều khiển người đó (bàn phím chỉ vào ô đang chọn).</span>
    </div>
    <div class="mt-grid" style="--cols:${cols}">${Array.from({ length: n }, (_, i) => `<div class="mt-cell" data-slot="${i + 1}"><div class="mt-tag"><b>Người ${i + 1}</b>${i === 0 ? ' · chủ phòng' : ''}<span class="mt-st"></span></div><iframe title="Người ${i + 1}" src="${base}?mt=${i + 1}&room=${code}" allow="clipboard-write"></iframe></div>`).join('')}</div>
  </div>`;
  const frames = [...root.querySelectorAll<HTMLIFrameElement>('iframe')];
  const send = (k: number, cmd: string, arg?: number) => frames[k]?.contentWindow?.postMessage({ mt: 'cmd', cmd, arg }, location.origin);
  root.querySelectorAll<HTMLButtonElement>('.mt-bar button').forEach(b => b.onclick = () => {
    const c = b.dataset.c!;
    if (c === 'ready') frames.forEach((_, k) => send(k, 'ready'));
    else send(0, c, c === 'start' ? n : undefined); // các lệnh điều khiển ván gửi cho chủ phòng (ô 1); bắt đầu thì chờ đủ n ô
  });
  (root.querySelector('#mt-imp') as HTMLSelectElement).onchange = (e) => send(0, 'imp', Number((e.target as HTMLSelectElement).value));
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    const d = e.data as { mt?: string; slot?: number; on?: boolean; phase?: string; role?: string; alive?: boolean };
    const cell = root.querySelector(`.mt-cell[data-slot="${d.slot}"]`);
    if (!cell) return;
    if (d.mt === 'focus' && d.on) root.querySelectorAll('.mt-cell').forEach(c => c.classList.toggle('on', c === cell));
    if (d.mt === 'state') {
      const ph = d.phase === 'room' ? 'ở phòng' : d.phase === 'play' ? 'đang chơi' : d.phase === 'meeting' ? 'đang họp' : 'hết ván';
      (cell.querySelector('.mt-st') as HTMLElement).textContent = ` · ${ph}${d.role ? ' · ' + d.role : ''}${d.alive === false ? ' · hồn ma' : ''}`;
    }
  });
  // bấm vào ô (kể cả viền) thì chuyển bàn phím vào ô đó
  root.querySelectorAll<HTMLElement>('.mt-cell').forEach((c, k) => c.addEventListener('pointerdown', () => frames[k].focus()));
}
