'use strict';
// Hand-drawn art in the Ian / 小黑 (Xiaohei) style: white paper, black ink with a little wobble, sparse red/orange/blue notes.
// Everything is inline SVG so it works offline and reacts to state. #wob and #hatch are defined in index.html.

const INK = '#141414', RED = '#e5484d', ORANGE = '#f08a24', BLUE = '#2f6fde', LEAF = '#dcefcf';
const f1 = n => +n.toFixed(1);
// plant stem height: fast early growth (visible wins in week one), slower later; caps at level 40
const plantH = L => 22 + Math.sqrt(Math.min(L, 40)) * 24;

/* ---------- line icons (24×24) ---------- */
const ICONS = {
  dumbbell: 'M3 9.5v5M6 7v10M18 7v10M21 9.5v5M6 12h12',
  spine: 'M12 2.5v19M8.5 5.5h7M9 9.5h6M8.5 13.5h7M9 17.5h6',
  mirror: 'M12 2.5c3.3 0 5.5 2.9 5.5 6.5S15.3 15.5 12 15.5 6.5 12.6 6.5 9 8.7 2.5 12 2.5zM12 15.5V21M8.5 21h7M14 6l1.2 1.4',
  shirt: 'M8.5 3.5 3.5 6.5l2 4 2.5-1V20.5h8V9.5l2.5 1 2-4-5-3c-.8 1.6-2 2.4-3.5 2.4S9.3 5.1 8.5 3.5z',
  speech: 'M4 4.5h16v11h-9l-4.5 4v-4H4zM8 9h8M8 12h5',
  moon: 'M19.5 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10 10.5z',
  flame: 'M12 2.5c.8 3.6 5.5 5.3 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.8 1.6-4.3 2.4-6.2 1.2 1.1 1.6 2.2 1.6 3.4 1.4-2 1.9-4.3 1.5-7.7z',
  shield: 'M12 3l7 2.8v5.4c0 4.6-3 7.8-7 9.8-4-2-7-5.2-7-9.8V5.8z',
  flag: 'M5.5 21V3.5M5.5 4.5h12l-2.2 4 2.2 4h-12',
  hex: 'M12 2.8l8 4.6v9.2L12 21.2l-8-4.6V7.4zM12 8l4 2.3v4.4L12 17l-4-2.3v-4.4z',
  scale: 'M5 3.5h14a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5zM8.5 10a3.5 3.5 0 0 1 7 0M12 10l1.4-2.2',
  sprout: 'M12 21v-9M12 12C12 8 9 5.5 4.5 5.5 4.5 9.5 7.5 12 12 12zM12 10.5c0-3.3 2.5-5.5 7-5.5 0 3.5-2.5 5.5-7 5.5z',
  crown: 'M3.5 8l4.5 4 4-6.5 4 6.5 4.5-4-2 11h-13z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  sword: 'M14.5 3.5H20.5v6L9.5 20.5l-6-6zM6.5 11.5l6 6M3.5 20.5l3-3',
  loop: 'M4.5 12a7.5 7.5 0 0 1 13.2-4.9L19.5 9M19.5 4v5h-5M19.5 12a7.5 7.5 0 0 1-13.2 4.9L4.5 15M4.5 20v-5h5',
  up: 'M12 20.5v-17M5.5 10 12 3.5l6.5 6.5',
  check: 'M4 12.5l5 5L20 6.5',
  chart: 'M4 3.5v16.5h16.5M7.5 15l4-5 3 3 5-7',
  pen: 'M4 20l1.2-4.8L16 4.4l3.6 3.6L8.8 18.8zM14 6.4l3.6 3.6',
  calendar: 'M4 6h16v14.5H4zM4 10h16M8.5 3.5v4M15.5 3.5v4',
  gem: 'M6.5 4h11l3.5 5-9 11.5L3 9zM3 9h18M9.5 4 12 20.5 14.5 4',
  trophy: 'M7.5 4h9v5a4.5 4.5 0 0 1-9 0zM7.5 6H4.5c0 3 1.5 4.5 3.5 4.5M16.5 6h3c0 3-1.5 4.5-3.5 4.5M12 13.5V17M8 20.5h8M9.5 17h5v3.5h-5z',
  plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', x: 'M6 6l12 12M18 6 6 18',
  download: 'M12 3.5v12M7 10.5l5 5 5-5M4.5 20.5h15', upload: 'M12 15.5v-12M7 8.5l5-5 5 5M4.5 20.5h15',
  drop: 'M12 3s6 7 6 11.5a6 6 0 0 1-12 0C6 10 12 3 12 3z',
  bolt: 'M13.5 2.5 4.5 14h7l-1 7.5 9-11.5h-7z',
  gift: 'M4 10.5h16v10H4zM3 7h18v3.5H3zM12 7v13.5M12 7C10 3 6 3 6 5.5S12 7 12 7M12 7c2-4 6-4 6-1.5S12 7 12 7',
  sun: 'M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8',
  battery: 'M3 7.5h15v9H3zM18 10.5h2.5v3H18',
  scissors: 'M6 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6 14.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM8.2 8.3 20 18M8.2 15.7 20 6',
  razor: 'M4 6.5h13v4.5H4zM10.5 11v9.5M6.5 6.5V4M9.5 6.5V4M12.5 6.5V4M15.5 6.5V4',
  nail: 'M8.5 21.5V11a3.5 3.5 0 0 1 7 0v10.5M10 9.2c.9-.9 3.1-.9 4 0',
  shoe: 'M2.5 17.5V9l4 1.2 2.8-3.7 4.4 4.8 6.3 2.5c.9.4 1.5 1.2 1.5 2.2v1.5zM2.5 17.5h18.5M10 11l1.5-1.5M12 13l1.5-1.5',
  broom: 'M15 2.5 11 12M7 12h8l3 9H4zM9 16.5 8 21M12.5 16.5V21',
  cloud: 'M7 18.5a4.5 4.5 0 0 1-.7-8.9 6 6 0 0 1 11.5-1.4 4.6 4.6 0 0 1-.3 10.3z',
  key: 'M7.5 15.5a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM11.5 11.5h9.5M17.5 11.5v3.5M20.5 11.5v2.5',
  info: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 11v5.5M12 7.8v.4',
};
function icon(name, { size = 20, color = 'currentColor', sw = 1.8, cls = '', fill = 'none' } = {}) {
  if (name === 'xh') return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="-26 -84 52 70" aria-hidden="true">${xhBody()}${xhEyes()}</svg>`;
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[name] || ICONS.info}"/></svg>`;
}

/* ---------- Xiaohei ---------- */
const xhBody = () => `<path d="M2 -76C18 -76 25 -61 24 -43C23 -25 14 -15 0 -15C-15 -15 -23 -26 -23 -43C-23 -63 -14 -76 2 -76Z" fill="${INK}"/><path d="M-6 -73.5 -4.5 -81 0 -75" fill="${INK}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
const xhEyes = (closed, dead) => closed
  ? `<path d="M-11 -51q4 3 8 0M3 -51q4 3 8 0" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
  : `<circle cx="-7" cy="-52" r="5.2" fill="#fff"/><circle cx="7" cy="-52" r="5.2" fill="#fff"/><g class="pupils"><circle cx="-6" cy="-51.5" r="2.3" fill="${INK}"/><circle cx="8" cy="-51.5" r="2.3" fill="${INK}"/></g>`;
const POSES = {
  stand: { legs: 'M-7 -17-8 0M7 -17 8 0M-8 0h-5M8 0h5', arms: 'M-22 -42Q-28 -34-28 -24M22 -42Q28 -34 28 -24' },
  water: { legs: 'M-7 -17-8 0M7 -17 8 0M-8 0h-5M8 0h5', arms: 'M-22 -42Q-28 -34-28 -24M22 -46Q32 -54 40 -62' },
  cheer: { legs: 'M-7 -17-12 0M7 -17 12 0M-12 0h-5M12 0h5', arms: 'M-20 -52-32 -70M20 -52 32 -70' },
  push:  { legs: 'M-7 -17-14 0M7 -17 6 0M-14 0h-5M6 0h5', arms: 'M22 -46 44 -50M21 -36 44 -40' },
  carry: { legs: 'M-7 -17-8 0M7 -17 8 0M-8 0h-5M8 0h5', arms: 'M-20 -58-17 -84M20 -58 17 -84' },
  sit:   { legs: 'M-8 -17-16 -6-14 0M8 -17 16 -6 14 0', arms: 'M-22 -40Q-26 -30-22 -22M22 -40Q26 -30 22 -22' },
};
function canSVG(x, y, rot) {
  return `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M-9 -7h20l-2 16h-16z" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M11 -1 26 -11" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M24 -14l5 4" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M-9 -3q-8 2-6 9" stroke="${INK}" stroke-width="2" fill="none"/></g>`;
}
function xh({ x = 0, y = 0, s = 1, pose = 'stand', flip = false, can = false, sleep = false, cls = '', poke = false } = {}) {
  const p = POSES[pose] || POSES.stand;
  const canG = !can ? '' : pose === 'water' ? canSVG(44, -64, 28) : canSVG(31, -15, 0);
  return `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})"><g class="xh xh-${pose} ${cls}" ${poke ? 'data-act="poke"' : ''}>
    <rect x="-34" y="-90" width="68" height="92" fill="transparent"/>
    <path d="${p.legs}" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${p.arms}" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    ${canG}${xhBody()}<g class="eyes">${xhEyes(sleep)}</g>
    ${sleep ? `<text x="20" y="-82" class="hand" fill="${BLUE}" font-size="16">z</text><text x="30" y="-94" class="hand" fill="${BLUE}" font-size="12">z</text>` : ''}
  </g></g>`;
}

/* ---------- plant ---------- */
function leaf(x, y, l, a) {
  return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${a})"><path d="M0 0Q${f1(l * .5)} ${f1(-l * .42)} ${f1(l)} 0Q${f1(l * .5)} ${f1(l * .42)} 0 0Z" fill="${LEAF}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><path d="M2 0H${f1(l * .72)}" stroke="${INK}" stroke-width="1"/></g>`;
}
function flower(x, y, r = 8) {
  let g = '';
  for (let i = 0; i < 5; i++) { const a = i * 72 * Math.PI / 180 - Math.PI / 2; g += `<ellipse cx="${f1(x + Math.cos(a) * r * .8)}" cy="${f1(y + Math.sin(a) * r * .8)}" rx="${f1(r * .55)}" ry="${f1(r * .55)}" fill="#ffd6d2" stroke="${INK}" stroke-width="1.5"/>`; }
  return `<g class="flower">${g}<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r * .38)}" fill="${ORANGE}" stroke="${INK}" stroke-width="1.5"/></g>`;
}
const bud = (x, y) => `<path d="M${f1(x)} ${f1(y + 2)}q-5.5-8 0-15q5.5 7 0 15z" fill="${LEAF}" stroke="${INK}" stroke-width="1.6"/>`;
// Height and leaf count grow with level (permanent). Droops until the daily minimum is hit; blooms after.
function plant(px, baseY, L, { droop = false, bloom = 0 } = {}) {
  const lv = Math.min(L, 40), H = plantH(L);
  const tipX = px + (droop ? 24 : 5), tipY = baseY - H + (droop ? H * .12 : 0);
  const cx = px + (droop ? -8 : -12), cy = baseY - H * .6;
  const P = t => [(1 - t) ** 2 * px + 2 * (1 - t) * t * cx + t * t * tipX, (1 - t) ** 2 * baseY + 2 * (1 - t) * t * cy + t * t * tipY];
  let g = `<path d="M${px} ${baseY}Q${f1(cx)} ${f1(cy)} ${f1(tipX)} ${f1(tipY)}" stroke="${INK}" stroke-width="${f1(2 + lv / 14)}" fill="none" stroke-linecap="round"/>`;
  const n = Math.min(2 + Math.floor(L * .6), 16), sc = Math.min(1, .55 + L / 25);
  const spots = [];
  for (let i = 0; i < n; i++) {
    const t = .2 + .7 * (n === 1 ? 0 : i / (n - 1)), [x, y] = P(t), right = i % 2 === 0;
    const len = (10 + 13 * (1 - t)) * sc + 5;
    g += leaf(x, y, len, right ? -30 + (droop ? 58 : 0) : -150 - (droop ? 58 : 0));
    if (t > .45 && t < .8) spots.push([x + (right ? len * .8 : -len * .8), y - len * .4]);
  }
  g += bloom ? flower(tipX, tipY - 4, 8 + Math.min(L, 30) / 6) : bud(tipX, tipY);
  if (bloom > 1) spots.slice(0, 2).forEach(([x, y]) => { g += flower(x, y, 6); });
  return `<g class="plant">${g}</g>`;
}
function pot(px, gy, label = '') {
  const top = gy - 36;
  return `<path d="M${px - 27} ${top}L${px - 21} ${gy}H${px + 21}L${px + 27} ${top}Z" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M${px - 33} ${top - 9}h66v9h-66z" fill="#fff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    ${label ? `<text x="${px}" y="${top + 24}" class="hand" text-anchor="middle" font-size="17" fill="${INK}">${label}</text>` : ''}`;
}
const ground = (x1, x2, y) => `<path d="M${x1} ${y}q${(x2 - x1) / 8} -3 ${(x2 - x1) / 4} 0t${(x2 - x1) / 4} 0t${(x2 - x1) / 4} 0t${(x2 - x1) / 4} 0" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M${x1 + 20} ${y - 1}l-2-6M${x1 + 24} ${y - 1}l2-5M${x2 - 30} ${y - 1}l-2-6M${x2 - 26} ${y - 1}l2-5" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>`;
const dropPath = (x, y, s = 1) => `M${x} ${y}c${3 * s} ${4 * s} ${4.5 * s} ${6 * s} ${4.5 * s} ${8 * s}a${4.5 * s} ${4.5 * s} 0 0 1-${9 * s} 0c0-${2 * s} ${1.5 * s}-${4 * s} ${4.5 * s}-${8 * s}z`;
const arrow = (d, tip, color = ORANGE) => `<path d="${d}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="${tip}" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

/* ---------- main scene: Xiaohei tends the plant ---------- */
function gardenScene({ L, rank, into, need, done, min, perfect, pose, sleep, anim }) {
  const gy = 272, px = 248, droop = done < min, bloom = done >= min ? (perfect ? 2 : 1) : 0;
  const H = plantH(L), tipX = px + (droop ? 24 : 5), tipY = gy - 45 - H;
  const T = Math.max(0, Math.min(100, tipY - 112)); // crop empty sky while the plant is small
  let drops = '';
  for (let i = 0; i < min; i++) drops += `<path d="${dropPath(24 + i * 17, T + 46, 1)}" fill="${i < done ? BLUE : '#fff'}" stroke="${INK}" stroke-width="1.5"/>`;
  return `<svg class="scene garden ${anim || ''}" viewBox="0 ${T} 360 ${290 - T}" role="img" aria-label="Your plant, level ${L}">
    <g filter="url(#wob)">
      ${ground(10, 350, gy)}
      ${plant(px, gy - 45, L, { droop, bloom })}
      ${pot(px, gy, 'lv ' + L)}
      ${xh({ x: 136, y: gy, s: 1.1, pose, can: pose !== 'cheer', sleep, poke: true })}
      <g class="splash">${[0, 1, 2].map(i => `<path d="${dropPath(222 + i * 4, 204, .7)}" fill="${BLUE}" style="animation-delay:${i * .12}s"/>`).join('')}</g>
    </g>
    <g filter="url(#wob)">
      <text x="20" y="${T + 32}" class="hand" font-size="19" fill="${INK}">today</text>${drops}
      <text x="344" y="${T + 36}" class="hand" font-size="27" fill="${RED}" text-anchor="end">${rank}</text>
      <text x="344" y="${T + 58}" class="hand" font-size="17" fill="${BLUE}" text-anchor="end">${into} / ${need} xp</text>
      ${arrow(`M318 ${T + 70}Q${f1(tipX + 50)} ${f1(Math.max(tipY - 10, T + 80))} ${f1(tipX + 16)} ${f1(tipY - 2)}`, `M${f1(tipX + 25)} ${f1(tipY - 9)}L${f1(tipX + 16)} ${f1(tipY - 2)}L${f1(tipX + 26)} ${f1(tipY + 3)}`)}
    </g>
  </svg>`;
}

/* ---------- bosses: lumpy hatched scribble monsters, shape seeded by name ---------- */
function blobPath(seed, r, n = 13) {
  const pts = Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2, rr = r * (.82 + rand(seed + i) * .36); return [Math.cos(a) * rr * 1.08, Math.sin(a) * rr * .92]; });
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let m = mid(pts[n - 1], pts[0]), d = `M${f1(m[0])} ${f1(m[1])}`;
  for (let i = 0; i < n; i++) { const q = pts[i], e = mid(q, pts[(i + 1) % n]); d += `Q${f1(q[0])} ${f1(q[1])} ${f1(e[0])} ${f1(e[1])}`; }
  return d + 'Z';
}
function bossArt(name, { x = 0, y = 0, s = 1, dead = false } = {}) {
  const d = blobPath(name, 44);
  const eyes = dead
    ? `<path d="M-20 -6l8 8M-12 -6l-8 8M8 -6l8 8M16 -6l-8 8" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`
    : `<circle cx="-15" cy="-2" r="7" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="13" cy="-2" r="7" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="-13" cy="0" r="2.6" fill="${INK}"/><circle cx="15" cy="0" r="2.6" fill="${INK}"/><path d="M-24 -13l14 5M22 -13 8 -8" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;
  return `<g transform="translate(${x} ${y}) scale(${s})"><g class="boss-g ${dead ? 'dead' : ''}"><g transform="translate(0 -48)${dead ? ' rotate(84 0 40)' : ''}">
    <path d="M-16 34-18 50h-6M16 34 18 50h6" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="${d}" fill="#fff"/><path d="${d}" fill="url(#hatch)" stroke="${INK}" stroke-width="2.2"/>
    <ellipse cx="-1" cy="2" rx="26" ry="16" fill="#fff"/>
    ${eyes}<path d="M-9 13l4-3 4 3 4-3 4 3" stroke="${INK}" stroke-width="2" fill="none" stroke-linejoin="round"/>
  </g></g></g>`;
}
function bossScene(b) {
  const gy = 200;
  return `<svg class="scene bossscene" viewBox="0 0 360 215" role="img" aria-label="${b.name}"><g filter="url(#wob)">
    ${ground(14, 346, gy)}
    ${b.defeated
      ? `${bossArt(b.name, { x: 232, y: gy, s: 1.15, dead: true })}${xh({ x: 236, y: gy - 56, s: .85, pose: 'cheer' })}<text x="300" y="42" class="hand" font-size="26" fill="${RED}">gg.</text>`
      : `${bossArt(b.name, { x: 250, y: gy, s: 1.15 })}${xh({ x: 112, y: gy, s: 1, pose: 'push' })}
         <path d="M156 154 188 148" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
         <path d="M196 132l8-6M198 146h10M196 160l8 6" stroke="${ORANGE}" stroke-width="2.2" stroke-linecap="round"/>`}
  </g></svg>`;
}

/* ---------- onboarding & reward scenes ---------- */
function seedScene() {
  return `<svg class="scene" viewBox="0 0 360 250"><g filter="url(#wob)">
    ${ground(20, 340, 232)}${plant(232, 187, 1, {})}${pot(232, 232)}
    ${xh({ x: 126, y: 232, s: 1.05, pose: 'water', can: true })}
    <g class="splash on">${[0, 1, 2].map(i => `<path d="${dropPath(204 + i * 4, 166, .7)}" fill="${BLUE}" style="animation-delay:${i * .25}s"/>`).join('')}</g>
    <text x="288" y="98" class="hand" font-size="24" fill="${RED}">day 1</text>
    ${arrow('M292 106Q268 128 248 156', 'M246 145 248 156 258 152')}
  </g></svg>`;
}
function mirrorScene() {
  return `<svg class="scene" viewBox="0 0 360 250"><defs><clipPath id="mclip"><ellipse cx="240" cy="128" rx="58" ry="84"/></clipPath></defs><g filter="url(#wob)">
    ${ground(20, 340, 232)}
    <path d="M222 212l-12 20M258 212l12 20" stroke="${INK}" stroke-width="2"/>
    <g clip-path="url(#mclip)">${xh({ x: 240, y: 205, s: 1.45, pose: 'cheer' })}</g>
    <ellipse cx="240" cy="128" rx="58" ry="84" fill="none" stroke="${INK}" stroke-width="2.4"/>
    ${xh({ x: 108, y: 232, s: .82, pose: 'stand', flip: true })}
    <text x="20" y="62" class="hand" font-size="22" fill="${BLUE}">future you</text>
    ${arrow('M110 70Q160 54 180 86', 'M170 82 180 86 182 76', BLUE)}
  </g></svg>`;
}
function boxesScene() {
  const box = (x, y, w, h) => `<path d="M${x} ${y}h${w}v${h}h-${w}z" fill="#fff" stroke="${INK}" stroke-width="1.8"/><path d="M${x + w / 2} ${y}v${h * .4}" stroke="${INK}" stroke-width="1.2"/>`;
  let tower = ''; for (let i = 0; i < 7; i++) tower += box(236 + (i % 2) * 6 - 4, 214 - i * 24, 56, 24);
  return `<svg class="scene" viewBox="0 0 360 250"><g filter="url(#wob)">
    ${ground(20, 340, 238)}
    ${xh({ x: 112, y: 238, s: 1, pose: 'carry' })}
    ${box(92, 138, 40, 16)}${box(96, 122, 32, 16)}${box(101, 108, 22, 14)}
    <g transform="rotate(5 264 140)">${tower}</g>
    <path d="M222 60 312 220M312 60 222 220" stroke="${RED}" stroke-width="3" stroke-linecap="round"/>
    <text x="40" y="58" class="hand" font-size="24" fill="${ORANGE}">start small</text>
  </g></svg>`;
}
function chestScene(xp) {
  return `<svg class="scene" viewBox="0 0 300 190"><g filter="url(#wob)">
    ${ground(20, 280, 176)}
    <path d="M150 128h70v48h-70z" fill="#fff" stroke="${INK}" stroke-width="2"/><path d="M185 128v48" stroke="${INK}" stroke-width="1.6"/>
    <g class="lid"><path d="M146 110h78v14h-78z" fill="#fff" stroke="${INK}" stroke-width="2" transform="rotate(-24 146 124)"/></g>
    <path d="M168 106l-6-16M186 100v-18M204 106l8-14M218 116l14-6" stroke="${ORANGE}" stroke-width="2.4" stroke-linecap="round"/>
    ${xh({ x: 92, y: 176, s: .95, pose: 'cheer' })}
    <text x="230" y="70" class="hand" font-size="26" fill="${RED}">+${xp}</text>
  </g></svg>`;
}
function levelScene(L) {
  return `<svg class="scene" viewBox="0 0 300 220"><g filter="url(#wob)">
    ${ground(20, 280, 206)}${plant(196, 170, L, { bloom: 1 })}${pot(196, 206)}
    ${xh({ x: 98, y: 200, s: .95, pose: 'cheer', cls: 'hop-loop' })}
    ${arrow('M60 120V40', 'M50 52 60 38 70 52')}
    <text x="72" y="56" class="hand" font-size="26" fill="${RED}">lv ${L}</text>
  </g></svg>`;
}
function perfectScene(L) {
  return `<svg class="scene" viewBox="0 0 300 220"><g filter="url(#wob)">
    ${ground(20, 280, 206)}${plant(190, 170, Math.max(L, 6), { bloom: 2 })}${pot(190, 206)}
    ${xh({ x: 92, y: 206, s: .9, pose: 'sit' })}
    <text x="210" y="44" class="hand" font-size="24" fill="${RED}">flawless</text>
  </g></svg>`;
}
function keyScene() {
  return `<svg class="scene" viewBox="0 0 300 200"><g filter="url(#wob)">
    ${ground(20, 280, 188)}
    ${xh({ x: 96, y: 188, s: .92, pose: 'carry' })}
    <circle cx="96" cy="94" r="13" fill="#fff" stroke="${INK}" stroke-width="2.4"/><circle cx="96" cy="94" r="4" fill="${INK}"/>
    <path d="M109 94h36M136 94v9M144 94v7" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M206 92a17 17 0 0 1 6-33 23 23 0 0 1 42-7 17 17 0 0 1 16 40z" fill="#fff" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
    ${arrow('M152 80Q176 46 204 66', 'M193 64 204 66 201 56')}
    <text x="214" y="122" class="hand" font-size="20" fill="${BLUE}">safe up here</text>
  </g></svg>`;
}
function bossDownScene(b) { return bossScene({ ...b, defeated: true }); }
function stamp(iconName, { got = true, size = 64 } = {}) {
  const c = got ? RED : '#c9c9c9';
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" class="stamp ${got ? 'got' : ''}"><g filter="url(#wob)" transform="rotate(${got ? -8 : 0} 32 32)">
    <circle cx="32" cy="32" r="28" fill="none" stroke="${c}" stroke-width="2.4" ${got ? '' : 'stroke-dasharray="4 5"'}/>
    <circle cx="32" cy="32" r="22.5" fill="none" stroke="${c}" stroke-width="1.2"/>
    <g transform="translate(20 20)">${got ? `<path d="${ICONS[iconName] || ICONS.star}" fill="none" stroke="${c}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>` : `<path d="M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9.5h-13z" fill="none" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"/>`}</g>
  </g></svg>`;
}
