// Logo concept explorer — renders 3 directions as SVG, rasterizes a contact sheet.
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { writeFile } from 'node:fs/promises';

// --- Palette (from the redesign) ---
const STONE900 = '#1c1917', STONE50 = '#fafaf9', STONE400 = '#a8a29e';
const AMBER600 = '#d97706';

/* =====================================================================
   CONCEPT A — "Porch Light"
   Warm app-tile, cream house in negative space, a glowing lit doorway.
   ===================================================================== */
const conceptA = (mono = false) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="aG" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${mono ? '#44403c' : '#f59e0b'}"/>
      <stop offset="1" stop-color="${mono ? '#1c1917' : '#ea580c'}"/>
    </linearGradient>
    <radialGradient id="aGlow" cx="0.5" cy="0.55" r="0.55">
      <stop offset="0" stop-color="#fffbeb"/>
      <stop offset="0.7" stop-color="#fde68a"/>
      <stop offset="1" stop-color="#fcd34d"/>
    </radialGradient>
  </defs>
  <rect width="64" height="64" rx="15" fill="url(#aG)"/>
  <!-- soft light spill from the doorway -->
  <ellipse cx="32" cy="50" rx="15" ry="6" fill="#fde68a" opacity="0.30"/>
  <!-- house: pitched roof + body, cream -->
  <path d="M32 13 L51 30.5 L46.5 30.5 L46.5 49 L17.5 49 L17.5 30.5 L13 30.5 Z"
        fill="#fffaf3"/>
  <!-- glowing doorway -->
  <path d="M27 49 L27 39 a5 5 0 0 1 10 0 L37 49 Z" fill="url(#aGlow)"/>
</svg>`;

/* =====================================================================
   CONCEPT B — "Doorway P"
   Monogram P whose bowl is a craftsman arched door with warm light.
   ===================================================================== */
const conceptB = (mono = false) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="bDoor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fcd34d"/>
      <stop offset="1" stop-color="${mono ? '#a8a29e' : '#ea580c'}"/>
    </linearGradient>
  </defs>
  <!-- P body (stem + bowl) -->
  <path d="M16 52 L16 12 L36 12
           a17 17 0 0 1 0 34 L26 46 L26 52 Z"
        fill="${mono ? STONE900 : '#292524'}"/>
  <!-- arched doorway cut into the bowl, glowing -->
  <path d="M28 41 L28 28 a8 8 0 0 1 16 0 L44 41 Z" fill="url(#bDoor)"/>
  <!-- door threshold light spill -->
  <rect x="28" y="41" width="16" height="2.5" rx="1.2" fill="#fde68a" opacity="0.8"/>
  <!-- little brass knob -->
  <circle cx="40" cy="35" r="1.4" fill="#fffaf3"/>
</svg>`;

/* =====================================================================
   CONCEPT C — "Gathered Rooflines"
   Three rooftops rising together; top one warm, a porch-light spark above.
   ===================================================================== */
const conceptC = (mono = false) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="5.5">
    <path d="M11 47 L32 31 L53 47" stroke="${mono ? '#78716c' : '#78716c'}"/>
    <path d="M15 39 L32 25 L49 39" stroke="${mono ? '#44403c' : '#a8a29e'}"/>
    <path d="M19 31 L32 20 L45 31" stroke="${mono ? STONE900 : AMBER600}"/>
  </g>
  <!-- porch-light spark -->
  <circle cx="32" cy="12.5" r="3.4" fill="${mono ? STONE900 : '#f59e0b'}"/>
  <circle cx="32" cy="12.5" r="6.5" fill="${mono ? '#a8a29e' : '#fcd34d'}" opacity="0.30"/>
</svg>`;

const concepts = [
  { id: 'A', name: 'Porch Light', svg: conceptA, tile: true },
  { id: 'B', name: 'Doorway P', svg: conceptB, tile: false },
  { id: 'C', name: 'Gathered Rooflines', svg: conceptC, tile: false },
];

// --- Contact sheet ---
const COLW = 400, ROWH = 900, PAD = 40;
const canvas = createCanvas(COLW * 3, ROWH);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, canvas.width, canvas.height);

function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

for (let i = 0; i < concepts.length; i++) {
  const { id, name, svg, tile } = concepts[i];
  const x0 = i * COLW;

  // Title
  ctx.fillStyle = STONE900;
  ctx.font = 'bold 30px serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${id} · ${name}`, x0 + COLW / 2, 60);

  // --- Big hero mark (240px) ---
  const bigColor = await loadImage(Buffer.from(svg(false)));
  const S = 240, bx = x0 + (COLW - S) / 2, by = 110;
  if (tile) {
    ctx.drawImage(bigColor, bx, by, S, S);
  } else {
    // marks without their own container sit on a soft cream tile for context
    ctx.fillStyle = '#fdf6ec';
    roundRect(ctx, bx, by, S, S, 36); ctx.fill();
    const inset = 34;
    ctx.drawImage(bigColor, bx + inset, by + inset, S - inset * 2, S - inset * 2);
  }

  // --- Light nav strip (36px logo + wordmark), as it appears in the navbar ---
  let ny = by + S + 50;
  await drawNavStrip(ctx, x0, ny, svg, false, tile);

  // --- Dark footer strip ---
  ny += 110;
  await drawNavStrip(ctx, x0, ny, svg, true, tile);

  // --- Monochrome (favicon / stamp legibility) ---
  ny += 110;
  const monoImg = await loadImage(Buffer.from(svg(true)));
  ctx.fillStyle = STONE400; ctx.font = '18px serif'; ctx.textAlign = 'center';
  ctx.fillText('one-color', x0 + COLW / 2, ny - 14);
  const ms = 56, mx = x0 + COLW / 2 - ms / 2;
  ctx.drawImage(monoImg, mx, ny, ms, ms);
}

async function drawNavStrip(c, x0, y, svg, dark, tile) {
  const STRIP_H = 86;
  c.fillStyle = dark ? STONE900 : STONE50;
  roundRect(c, x0 + PAD, y, COLW - PAD * 2, STRIP_H, 14); c.fill();
  if (!dark) { c.strokeStyle = '#e7e5e4'; c.lineWidth = 1; c.stroke(); }
  const img = await loadImage(Buffer.from(svg(false)));
  const L = 38, lx = x0 + PAD + 22, ly = y + (STRIP_H - L) / 2;
  if (tile) {
    c.drawImage(img, lx, ly, L, L);
  } else {
    // tiny cream chip behind container-less marks so they read in the bar
    c.fillStyle = dark ? '#292524' : '#fdf6ec';
    roundRect(c, lx, ly, L, L, 9); c.fill();
    c.drawImage(img, lx + 6, ly + 6, L - 12, L - 12);
  }
  c.fillStyle = dark ? '#ffffff' : STONE900;
  c.font = 'bold 26px serif'; c.textAlign = 'left';
  c.fillText('POAssociation', lx + L + 14, ly + L / 2 + 9);
}

await writeFile('scripts/logo-concepts.png', canvas.toBuffer('image/png'));
console.log('wrote scripts/logo-concepts.png');
