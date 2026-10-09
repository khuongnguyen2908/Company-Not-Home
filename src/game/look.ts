// Ngoại hình nhân vật (bản 3): thuần dữ liệu, dùng được cả khi chạy mô phỏng không có trình duyệt.
// Cấu trúc: Cơ thể (người hoặc skin) + Da + Tóc + Quần áo + Phụ kiện theo từng ô.

/** Cách chọn màu của một món: 'free' = mọi màu trong bảng, 'fixed' = không đổi màu, mảng = các phối màu cài sẵn ("màu1/màu2") */
export type ColorMode = 'free' | 'fixed' | string[];
export interface ItemDef { id: string; name: string; color: ColorMode; def: string }

export type Slot = 'top' | 'bottom' | 'head' | 'eyes' | 'ears' | 'face' | 'neck' | 'hand' | 'back';
export const SLOTS: Slot[] = ['top', 'bottom', 'head', 'eyes', 'ears', 'face', 'neck', 'hand', 'back'];

export interface Look {
  body: string;        // 'human' hoặc một skin
  bodyColor: string;   // màu da người / màu skin
  marks: string[];     // chi tiết da: tàn nhang, sẹo, hình xăm...
  hairStyle: string;
  hair: string;
  items: Record<Slot, { id: string; color: string }>;
}

export const PALETTE = [
  '#e2412f', '#ff7a2f', '#f2b705', '#ffe36e', '#7cc84a', '#2f9e5e', '#16a6a0', '#2e9cf0',
  '#3d5ad6', '#1f2a5c', '#8a4fd8', '#d94f8a', '#ff9ec4', '#8a5a35', '#c9a77c', '#5b6b80',
  '#9aa1b4', '#2b2b38', '#f4f4f4',
];
export const SKINS = ['#fbe0c4', '#f6d0ae', '#f2c49b', '#e3b089', '#c98d63', '#9c6644'];
/** Màu da: 6 tông da tự nhiên + 19 màu như áo (da xanh, da tím... cho vui) */
export const SKIN_TONES = [...SKINS, ...PALETTE];
export const HAIR_COLORS = ['#1c1c22', '#3b2a20', '#6b3e22', '#a0522d', '#d9a441', '#a7a7b2', '#e8eef5', '#ff5fa2', '#2e9cf0', '#7d3fd0', '#2f9e5e', '#e2412f'];

const F = (id: string, name: string, def = '#2e9cf0'): ItemDef => ({ id, name, color: 'free', def });
const X = (id: string, name: string): ItemDef => ({ id, name, color: 'fixed', def: '' });
const P = (id: string, name: string, presets: string[]): ItemDef => ({ id, name, color: presets, def: presets[0] });
const NONE = (name = 'Không'): ItemDef => ({ id: 'none', name, color: 'fixed', def: '' });

// ---------- Cơ thể (Skin) ----------
export interface BodyDef extends ItemDef { hasHair: boolean; human: boolean }
export const BODIES: BodyDef[] = [
  { id: 'human', name: 'Người', color: SKIN_TONES, def: SKINS[2], hasHair: true, human: true },
  { id: 'cat', name: 'Người mèo', color: 'free', def: '#f2b705', hasHair: false, human: false },
  { id: 'frog', name: 'Người ếch', color: 'free', def: '#7cc84a', hasHair: false, human: false },
  { id: 'robot', name: 'Người máy', color: ['#b9c0cf/#5fb8ff', '#e8c547/#ff5d5d', '#2b2b38/#4ee1a0'], def: '#b9c0cf/#5fb8ff', hasHair: false, human: false },
  { id: 'alien', name: 'Người ngoài hành tinh', color: 'free', def: '#7cc84a', hasHair: false, human: false },
  { id: 'ghost', name: 'Con ma', color: ['#ffffff/#c9ccd8', '#ffe9f4/#ff9ec4', '#e6f3ff/#9fd6ff'], def: '#ffffff/#c9ccd8', hasHair: false, human: false },
  { id: 'cactus', name: 'Cây xương rồng', color: ['#2f9e5e/#ff5fa2', '#7cc84a/#ffe36e', '#16a6a0/#ffffff'], def: '#2f9e5e/#ff5fa2', hasHair: false, human: false },
  { id: 'coffee', name: 'Cốc cà phê', color: ['#ffffff/#8a5a35', '#e2412f/#8a5a35', '#2e9cf0/#f4e7cf'], def: '#ffffff/#8a5a35', hasHair: false, human: false },
  { id: 'toast', name: 'Lát bánh mì', color: ['#f6d79c/#b8742f', '#ffe9c4/#8a5a35'], def: '#f6d79c/#b8742f', hasHair: false, human: false },
  { id: 'plant', name: 'Chậu cây', color: ['#d97b4a/#3fa66b', '#2e9cf0/#7cc84a', '#f4f4f4/#2f9e5e'], def: '#d97b4a/#3fa66b', hasHair: false, human: false },
  { id: 'slime', name: 'Cục slime', color: 'free', def: '#4ee1a0', hasHair: false, human: false },
  // skin không tay chân (lạ mắt hơn)
  { id: 'cloud', name: 'Đám mây', color: 'free', def: '#ffffff', hasHair: false, human: false },
  { id: 'drop', name: 'Giọt nước', color: 'free', def: '#5ab8ff', hasHair: false, human: false },
  { id: 'mochi', name: 'Bánh mochi', color: 'free', def: '#ffd6e6', hasHair: false, human: false },
  { id: 'egg', name: 'Quả trứng', color: 'free', def: '#fff4dc', hasHair: false, human: false },
  { id: 'flame', name: 'Ngọn lửa', color: 'free', def: '#ff7a2f', hasHair: false, human: false },
  { id: 'snake', name: 'Con rắn', color: 'free', def: '#7cc84a', hasHair: false, human: false },
  { id: 'matcha', name: 'Ly matcha', color: 'fixed', def: '#7cbf4a/#f4f1e0', hasHair: false, human: false },
  { id: 'banhmi', name: 'Bánh mì Việt Nam', color: 'fixed', def: '#e0a052/#9a5a1f', hasHair: false, human: false },
  { id: 'shark', name: 'Cá mập', color: ['#8a97ad/#f4f4f4', '#3d6fb5/#e6f3ff', '#e889b0/#fff0f6'], def: '#8a97ad/#f4f4f4', hasHair: false, human: false },
  { id: 'penguin', name: 'Chim cánh cụt', color: ['#2b2b38/#ffffff', '#3d5ad6/#ffffff'], def: '#2b2b38/#ffffff', hasHair: false, human: false },
  { id: 'panda', name: 'Gấu trúc', color: 'fixed', def: '#ffffff/#2b2b38', hasHair: false, human: false },
  { id: 'shiba', name: 'Chó Shiba', color: ['#e0883a/#fff3e0', '#3b2a20/#e8b27a', '#f4e7cf/#ffffff'], def: '#e0883a/#fff3e0', hasHair: false, human: false },
  { id: 'zombie', name: 'Zombie văn phòng (OT quá nhiều)', color: ['#9cc27a/#f4f4f4', '#a7b7a0/#cfe3ff'], def: '#9cc27a/#f4f4f4', hasHair: false, human: false },
  { id: 'duck', name: 'Vịt cao su', color: ['#ffd23f/#ff8a2f', '#ff9ec4/#ff8a2f', '#7fc4ff/#ff8a2f'], def: '#ffd23f/#ff8a2f', hasHair: false, human: false },
  { id: 'skeleton', name: 'Bộ xương', color: 'fixed', def: '#f4f1e8/#2b2b38', hasHair: false, human: false },
  { id: 'bearrain', name: 'Gấu trắng áo mưa', color: 'fixed', def: '#fbfbf7/#ffd23f', hasHair: false, human: false },
  { id: 'bearflower', name: 'Gấu Bắc Cực đội hoa', color: 'fixed', def: '#fbfbf7/#ffc928', hasHair: false, human: false },
];

export const MARKS: { id: string; name: string }[] = [
  { id: 'freckles', name: 'Tàn nhang' }, { id: 'blush', name: 'Má hồng đậm' }, { id: 'mole', name: 'Nốt ruồi' },
  { id: 'scar', name: 'Sẹo má' }, { id: 'bandaid', name: 'Băng cá nhân' }, { id: 'tattoo', name: 'Hình xăm tay' },
];

export const HAIR_STYLES: { id: string; name: string }[] = [
  { id: 'short', name: 'Ngắn' }, { id: 'messy', name: 'Bù xù' }, { id: 'side', name: 'Rẽ ngôi' }, { id: 'slick', name: 'Vuốt ngược' },
  { id: 'spiky', name: 'Dựng đứng' }, { id: 'undercut', name: 'Undercut' }, { id: 'curly', name: 'Xoăn' }, { id: 'afro', name: 'Afro' },
  { id: 'bangs', name: 'Mái ngố' }, { id: 'bob', name: 'Bob' }, { id: 'long', name: 'Dài thẳng' }, { id: 'pony', name: 'Đuôi ngựa' },
  { id: 'braid', name: 'Tết đuôi sam' }, { id: 'bun', name: 'Búi' }, { id: 'topknot', name: 'Búi samurai' }, { id: 'spacebuns', name: 'Hai búi tròn' },
  { id: 'balding', name: 'Hói đỉnh' }, { id: 'bald', name: 'Trọc' },
];

// ---------- Quần áo và phụ kiện ----------
export const ITEMS: Record<Slot, ItemDef[]> = {
  top: [
    NONE(), F('tee', 'Áo thun'), F('polo', 'Polo'), F('hoodie', 'Hoodie'), F('turtleneck', 'Len cổ lọ'), F('cardigan', 'Cardigan', '#d94f8a'),
    P('denim', 'Khoác jean', ['#4a78b5/#ffffff', '#2b2b38/#e2412f']), F('shirt', 'Sơ mi cà vạt', '#e2412f'), F('sweatervest', 'Gi-lê len', '#2f9e5e'),
    F('blazer', 'Vest', '#1f2a5c'), F('hawaii', 'Sơ mi hoa', '#16a6a0'), F('teamtee', 'Áo team building', '#ff7a2f'),
    P('ninja', 'Áo ninja', ['#2b2b33/#c0392b', '#1f2a5c/#f4f4f4']), P('idol', 'Áo idol', ['#ff7fb6/#ffe36e', '#7fc4ff/#ffffff']),
    P('jockey', 'Áo kỵ sĩ', ['#2e9cf0/#ffe36e', '#2f9e5e/#ffffff']), P('samurai', 'Giáp samurai', ['#7d2340/#e8c547', '#1f2a5c/#c9ccd8']),
    P('wizard', 'Áo pháp sư', ['#3d3a8a/#ffe36e', '#2f5e3a/#c9ccd8']), P('hero', 'Đồ siêu nhân', ['#2e9cf0/#ffe36e', '#e2412f/#ffe36e']),
    P('pilot', 'Áo khoác phi công', ['#8a5a35/#6b4426', '#2b2b38/#5b6b80']), P('pirate', 'Áo sọc cướp biển', ['#ffffff/#e2412f', '#ffffff/#2e9cf0']),
    P('robotplate', 'Giáp người máy', ['#b9c0cf/#2d3142', '#e8c547/#2d3142']), P('dinosuit', 'Bộ đồ khủng long', ['#5fbf5a/#c8eec0', '#ff9ec4/#ffffff']),
  ],
  bottom: [
    NONE(), F('trousers', 'Quần tây', '#33384a'), P('jeans', 'Quần jean', ['#4a78b5/#2c4f80', '#2b2b38/#1d1a2b']), F('shorts', 'Quần short', '#c9a77c'),
    F('skirt', 'Chân váy', '#2b2b38'), P('idolskirt', 'Váy xếp ly idol', ['#ff9ec4/#ffffff', '#7fc4ff/#ffffff']),
    P('ninjapants', 'Quần ninja', ['#2b2b33/#c0392b', '#1f2a5c/#f4f4f4']), P('breeches', 'Quần kỵ sĩ', ['#ffffff/#2b2b38', '#f4e7cf/#6b4426']),
    P('hakama', 'Hakama samurai', ['#2b2b38/#7d2340', '#5b6b80/#1f2a5c']), P('robotlegs', 'Chân người máy', ['#9aa1b4/#5b6b80', '#e8c547/#8a6d1f']),
    P('dinolegs', 'Chân khủng long', ['#5fbf5a/#3f8a3c', '#ff9ec4/#d94f8a']),
  ],
  head: [
    NONE(), F('cap', 'Mũ lưỡi trai'), F('beret', 'Mũ nồi', '#c0392b'), F('beanie', 'Mũ len', '#ff7a2f'), F('headband', 'Băng đô thể thao', '#e2412f'),
    F('ninjaband', 'Băng trán ninja', '#2b2b38'), F('bow', 'Nơ tóc', '#ff5fa2'), X('pencil', 'Bút chì gài tai'), F('horseears', 'Tai ngựa', '#8a5a35'),
    P('ninjahood', 'Mũ trùm ninja', ['#2b2b33/#c0392b', '#1f2a5c/#f4f4f4']), P('wizardhat', 'Mũ pháp sư', ['#3d3a8a/#ffe36e', '#2f5e3a/#c9ccd8']),
    F('jockeyhelmet', 'Mũ kỵ sĩ'), P('piratehat', 'Mũ cướp biển', ['#1d1a2b/#ffffff', '#6b4426/#e8c547']), X('antenna', 'Ăng-ten'),
    P('dinohood', 'Mũ trùm khủng long', ['#5fbf5a/#ffffff', '#ff9ec4/#ffffff']), X('goggles', 'Kính phi công'),
  ],
  eyes: [
    NONE(), F('glasses', 'Kính', '#1d1a2b'), F('bigglasses', 'Kính dày', '#1d1a2b'), F('roundglasses', 'Kính tròn', '#b8860b'), F('shades', 'Kính râm', '#1d1a2b'),
    X('eyepatch', 'Bịt mắt cướp biển'), F('heromask', 'Mặt nạ siêu nhân', '#1d1a2b'),
  ],
  ears: [NONE(), F('headphones', 'Tai nghe chụp', '#3b3f4a'), F('headset', 'Headset có mic', '#2b2b33'), X('earbuds', 'Tai nghe nhét tai')],
  face: [NONE(), F('mask', 'Khẩu trang', '#bfe6f2'), X('mustache', 'Ria mép'), X('beard', 'Râu quai nón'), F('ninjamask', 'Khăn che mặt ninja', '#2b2b33')],
  neck: [
    NONE(), F('lanyard', 'Dây thẻ', '#1f6feb'), X('rainbow', 'Dây thẻ cầu vồng'), X('clip', 'Thẻ kẹp áo'), F('pins', 'Dây gắn huy hiệu', '#1f6feb'),
    X('vip', 'Thẻ VIP mạ vàng'), F('scarf', 'Khăn quàng', '#ffffff'), F('bowtie', 'Nơ cổ', '#e2412f'), F('necklace', 'Vòng cổ', '#e8c547'),
  ],
  hand: [
    NONE(), X('coffee', 'Cốc cà phê'), X('laptop', 'Laptop'), X('clipboard', 'Bảng kẹp hồ sơ'), F('bottle', 'Bình nước', '#5fb8ff'),
    X('wand', 'Đũa phép'), F('mic', 'Micro', '#c9ccd8'), X('hook', 'Tay móc'), X('whip', 'Roi kỵ sĩ'), X('bokken', 'Kiếm gỗ'), X('shuriken', 'Phi tiêu kẹp giấy'),
  ],
  back: [
    NONE(), F('cape', 'Áo choàng', '#e2412f'), F('dinotail', 'Đuôi khủng long', '#5fbf5a'), F('horsetail', 'Đuôi ngựa', '#8a5a35'),
    F('backpack', 'Ba lô', '#2e9cf0'), F('wings', 'Đôi cánh', '#ffffff'),
  ],
};

export const SLOT_NAMES: Record<Slot, string> = {
  top: 'Áo', bottom: 'Quần', head: 'Đầu', eyes: 'Mắt', ears: 'Tai', face: 'Mặt', neck: 'Cổ', hand: 'Tay cầm', back: 'Lưng',
};

export const itemDef = (slot: Slot, id: string) => ITEMS[slot].find(i => i.id === id) ?? ITEMS[slot][0];
export const bodyDef = (id: string) => BODIES.find(b => b.id === id) ?? BODIES[0];
/** Màu chính và màu phụ của một món (phối cài sẵn dạng "màu1/màu2") */
export const colors2 = (c: string) => { const [a, b] = (c || '#888888').split('/'); return [a, b ?? a] as const; };

const emptyItems = (): Look['items'] => Object.fromEntries(SLOTS.map(s => [s, { id: 'none', color: '' }])) as Look['items'];

export function makeLook(p: Partial<Omit<Look, 'items'>> & { items?: Partial<Look['items']> } = {}): Look {
  const items = emptyItems();
  for (const s of SLOTS) if (p.items?.[s]) items[s] = { ...p.items[s]! };
  const { items: _i, ...rest } = p;
  return { body: 'human', bodyColor: SKINS[2], marks: [], hairStyle: 'short', hair: HAIR_COLORS[1], ...rest, items };
}

/** Chọn màu mặc định hợp lệ khi đổi món */
export function defaultColor(def: ItemDef, prev?: string): string {
  if (def.color === 'fixed') return '';
  if (def.color === 'free') return prev && !prev.includes('/') && prev.startsWith('#') ? prev : def.def;
  return def.def;
}

/** Nhân vật gốc: người, da mặc định, tóc ngắn nâu, không quần áo, không phụ kiện */
export const DEFAULT_LOOK = (): Look => makeLook({});

export const GUARD_LOOK: Look = makeLook({
  bodyColor: '#e3b089', hairStyle: 'short', hair: '#111111',
  items: { top: { id: 'guard', color: '#26283a' }, bottom: { id: 'trousers', color: '#1a1b28' }, head: { id: 'guardcap', color: '#26283a' } },
});

export function randomLook(rng: () => number = Math.random): Look {
  const pick = <T,>(a: T[]) => a[Math.floor(rng() * a.length)];
  const useSkin = rng() < 0.12;
  const body = useSkin ? pick(BODIES.slice(1)) : BODIES[0];
  const items = emptyItems();
  const choose = (slot: Slot, prob: number, pool?: string[]) => {
    if (rng() > prob) return;
    const list = ITEMS[slot].filter(i => i.id !== 'none' && (!pool || pool.includes(i.id)));
    const d = pick(list);
    items[slot] = { id: d.id, color: d.color === 'free' ? pick(PALETTE) : d.color === 'fixed' ? '' : pick(d.color as string[]) };
  };
  // Đồ công sở là chính, thỉnh thoảng có người hóa trang
  const officeTops = ['tee', 'polo', 'hoodie', 'turtleneck', 'cardigan', 'denim', 'shirt', 'sweatervest', 'blazer', 'hawaii', 'teamtee'];
  choose('top', 1, rng() < 0.12 ? undefined : officeTops);
  choose('bottom', 1, rng() < 0.12 ? undefined : ['trousers', 'jeans', 'shorts', 'skirt']);
  choose('head', 0.2); choose('eyes', 0.3); choose('ears', 0.15); choose('face', 0.1);
  choose('neck', 0.75, rng() < 0.7 ? ['lanyard'] : undefined); choose('hand', 0.25); choose('back', 0.08);
  const bodyColor = body.color === 'free' ? pick(PALETTE) : body.color === 'fixed' ? body.def : pick(body.color as string[]);
  return {
    body: body.id, bodyColor, marks: rng() < 0.2 ? [pick(MARKS).id] : [],
    hairStyle: pick(HAIR_STYLES).id, hair: rng() < 0.8 ? pick(HAIR_COLORS.slice(0, 6)) : pick(HAIR_COLORS.slice(6)), items,
  };
}

/** Màu thẻ tên: màu áo, không mặc áo thì lấy màu cơ thể */
export function lookColor(l: Look): string {
  if (l.body !== 'human') return colors2(l.bodyColor)[0];
  const t = l.items.top;
  if (t.id !== 'none' && t.color) return colors2(t.color)[0];
  return colors2(l.bodyColor)[0];
}

/** Chuyển ngoại hình lưu từ các bản cũ sang bản 3 */
export function normalizeLook(raw: any): Look {
  if (!raw || typeof raw !== 'object') return randomLook();
  if (raw.items && raw.body) {
    const l = makeLook(raw);
    for (const s of SLOTS) if (!ITEMS[s].some(i => i.id === l.items[s].id)) l.items[s] = { id: 'none', color: '' };
    if (!BODIES.some(b => b.id === l.body)) l.body = 'human';
    return l;
  }
  if (!raw.hairStyle) return randomLook();
  // Bản 1 và 2: một ô phụ kiện "acc" hoặc các ô eyes/head/ears/face/hand/lanyard/costume
  const items = emptyItems();
  const set = (s: Slot, id: string | undefined, color = '') => {
    if (!id || id === 'none') return;
    const d = ITEMS[s].find(i => i.id === id); if (!d) return;
    items[s] = { id, color: d.color === 'fixed' ? '' : d.color === 'free' ? (color || d.def) : d.def };
  };
  const shirt = raw.shirt ?? '#2e9cf0';
  const costumeTop: Record<string, string> = { ninja: 'ninja', idol: 'idol', jockey: 'jockey', samurai: 'samurai', wizard: 'wizard', hero: 'hero', dino: 'dinosuit', pilot: 'pilot', pirate: 'pirate', robot: 'robotplate' };
  set('top', costumeTop[raw.costume] ?? (raw.outfit === 'guard' ? 'tee' : raw.outfit ?? 'tee'), shirt);
  set('bottom', 'trousers', '#33384a');
  const acc = raw.acc as string | undefined;
  set('eyes', raw.eyes ?? (['glasses', 'bigglasses', 'shades'].includes(acc ?? '') ? acc : undefined));
  set('head', raw.head ?? (['cap', 'beret'].includes(acc ?? '') ? acc : undefined), shirt);
  set('ears', raw.ears ?? (['headphones', 'headset'].includes(acc ?? '') ? acc : undefined));
  set('face', raw.face);
  set('hand', raw.hand);
  const ly = raw.lanyard ?? 'blue';
  if (ly === 'blue') set('neck', 'lanyard', '#1f6feb'); else if (ly === 'red') set('neck', 'lanyard', '#e2412f'); else set('neck', ly);
  return {
    body: 'human', bodyColor: raw.skin ?? SKINS[2], marks: [],
    hairStyle: HAIR_STYLES.some(h => h.id === raw.hairStyle) ? raw.hairStyle : 'short', hair: raw.hair ?? HAIR_COLORS[1], items,
  };
}

export const lookKey = (l: Look) => [l.body, l.bodyColor, l.marks.join(','), l.hairStyle, l.hair, ...SLOTS.map(s => `${l.items[s].id}:${l.items[s].color}`)].join('|');

/** Độ sáng màu (0..1) để chọn màu chữ dễ đọc */
export function lightness(hex: string): number {
  const n = parseInt(hex.slice(1, 7), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
/** Màu chữ trên nền thẻ tên (nền là màu áo) */
export const tagText = (bg: string) => (lightness(bg) > 0.72 ? '#1d1a2b' : '#ffffff');
/** Màu tên khi viết trên nền sáng (khung chat) */
export const nameInk = (c: string) => (lightness(c) > 0.72 ? '#1d1a2b' : c);
