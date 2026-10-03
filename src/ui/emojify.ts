// Tự đổi emoji trong giao diện thành icon vẽ cùng phong cách game.
// Áp dụng cho mọi chữ hiện lên (nút, tiêu đề, menu, thông báo...), kể cả chữ sửa bằng Công cụ nội dung.
// Những chỗ emoji là nội dung (sticker, nút cảm xúc, đồ vật trong mini-game, chat) được giữ nguyên.
import { iconSvg } from './icons';

const MAP: Record<string, string> = {
  '✅': 'check', '✔': 'check', '🎲': 'dice', '🛡': 'shield', '🧪': 'flask', '🛗': 'lift', '📶': 'router', '🎮': 'gamepad',
  '⚡': 'sabotage', '🎬': 'clapper', '📸': 'photo', '📷': 'camera', '📖': 'book', '🔊': 'sound', '🔇': 'mute', '🐍': 'snake',
  '🔒': 'lock', '📰': 'newspaper', '👞': 'shoe', '🚪': 'door', '🎵': 'music', '📹': 'camera', '🔔': 'bell', '🪪': 'idcard',
  '🔄': 'refresh', '📢': 'report', '📣': 'megaphone', '📍': 'pin', '🪜': 'stairs', '💡': 'breaker', '🏢': 'building',
  '🌐': 'globe', '🏆': 'trophy', '✏': 'pencil', '🗺': 'map', '✉': 'envelope', '⏳': 'hourglass', '⚠': 'warn', '📊': 'clipboard',
  '😨': 'warn', '📦': 'box', '🎙': 'mic', '📄': 'paper', '📈': 'chartUp', '🎨': 'palette', '↩': 'undo', '🧹': 'broom',
  '💇': 'hair', '🧴': 'lotion', '👕': 'shirt', '🕶': 'glasses', '🐸': 'frog', '👔': 'tie', '💻': 'laptop', '💾': 'floppy',
  '🔧': 'wrench', '🧃': 'juice', '🎯': 'dart', '🧸': 'claw', '🐠': 'fish', '⚙': 'gear', '🗓': 'calendar', '💼': 'work',
  '🟢': 'dotGreen', '🔴': 'dotRed', '⚪': 'dotGray', '❗': 'warn', '🛠': 'wrench', '📝': 'pencil', '🧭': 'map',
  '🔍': 'info', '🔑': 'keycard', '🧩': 'gamepad', '👆': 'work', '🏃': 'stairs', '💦': 'water',
};
const RE = new RegExp(`(${Object.keys(MAP).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\uFE0F?`, 'gu');
const KEEP = '[data-keep-emoji], .mini-body, .md-hand, .md-slots, .emoji-bar, .ct, textarea, input, script, style';

function convertText(node: Text) {
  const t = node.nodeValue ?? '';
  RE.lastIndex = 0;
  if (!RE.test(t)) return;
  const parent = node.parentElement;
  if (!parent || parent.closest(KEEP)) return;
  if (parent.tagName === 'OPTION' || parent.closest('svg')) { node.nodeValue = t.replace(RE, '').replace(/^\s+/, ''); return; }
  const frag = document.createDocumentFragment();
  let last = 0;
  RE.lastIndex = 0;
  for (let m = RE.exec(t); m; m = RE.exec(t)) {
    if (m.index > last) frag.appendChild(document.createTextNode(t.slice(last, m.index)));
    const span = document.createElement('span');
    span.className = 'ui-ico';
    span.innerHTML = iconSvg(MAP[m[1]]);
    frag.appendChild(span);
    last = m.index + m[0].length;
  }
  if (last < t.length) frag.appendChild(document.createTextNode(t.slice(last)));
  parent.replaceChild(frag, node);
}

function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) { convertText(root as Text); return; }
  if (!(root instanceof Element) || root.closest(KEEP)) return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const list: Text[] = [];
  for (let n = tw.nextNode(); n; n = tw.nextNode()) list.push(n as Text);
  for (const n of list) convertText(n);
}

/** Bật bộ đổi emoji cho một vùng giao diện */
export function startEmojify(root: HTMLElement) {
  walk(root);
  new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'characterData') walk(m.target);
      else m.addedNodes.forEach(n => walk(n));
    }
  }).observe(root, { childList: true, subtree: true, characterData: true });
}
