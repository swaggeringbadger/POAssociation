// Refined "Doorway P" — the shippable mark. Renders a multi-size proof sheet.
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFile } from 'node:fs/promises';

const STONE900 = '#1c1917', STONE50 = '#fafaf9', STONE400 = '#a8a29e';

/* The mark. variant: 'tile' (amber ground, cream P) | 'ink' (charcoal P, transparent) */
function doorwayP(variant = 'tile') {
  const onTile = variant === 'tile';
  const P = onTile ? '#fffaf3' : '#292524';          // letterform
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="ground" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fbbf24"/>
      <stop offset="0.55" stop-color="#f59e0b"/>
      <stop offset="1" stop-color="#ea580c"/>
    </linearGradient>
    <radialGradient id="lit" cx="0.5" cy="0.42" r="0.62">
      <stop offset="0" stop-color="#fffdf7"/>
      <stop offset="0.45" stop-color="#fde68a"/>
      <stop offset="1" stop-color="#f59e0b"/>
    </radialGradient>
  </defs>

  ${onTile ? `<rect width="64" height="64" rx="15" fill="url(#ground)"/>
  <!-- warm vignette / light bloom -->
  <ellipse cx="31" cy="24" rx="20" ry="20" fill="#fde68a" opacity="0.18"/>` : ''}

  <!-- P silhouette: stem + bowl disk, one solid fill -->
  <g fill="${P}">
    <rect x="17" y="12" width="9.5" height="40" rx="4.6"/>
    <circle cx="30.5" cy="24" r="13.2"/>
  </g>

  <!-- the doorway: arched opening set into the bowl, glowing -->
  <path d="M25 35 L25 24 a6.4 6.4 0 0 1 12.8 0 L37.8 35 Z" fill="url(#lit)"/>
  <!-- inner door reveal line -->
  <path d="M25 35 L25 24 a6.4 6.4 0 0 1 12.8 0 L37.8 35"
        fill="none" stroke="#c2410c" stroke-width="0.7" opacity="0.55"/>
  <!-- threshold light spill -->
  <rect x="24.4" y="35" width="14" height="2.1" rx="1" fill="#fde68a" opacity="0.9"/>
  <!-- brass knob -->
  <circle cx="34.4" cy="27.5" r="1.5" fill="${onTile ? '#7c2d12' : '#f59e0b'}"/>
</svg>`;
}

// ---------- proof sheet ----------
const W = 1160, H = 760;
const c = createCanvas(W, H);
const x = c.getContext('2d');
x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
function rr(c, X, Y, w, h, r){c.beginPath();c.moveTo(X+r,Y);c.arcTo(X+w,Y,X+w,Y+h,r);c.arcTo(X+w,Y+h,X,Y+h,r);c.arcTo(X,Y+h,X,Y,r);c.arcTo(X,Y,X+w,Y,r);c.closePath();}

const tile = await loadImage(Buffer.from(doorwayP('tile')));
const ink  = await loadImage(Buffer.from(doorwayP('ink')));

// Title
x.fillStyle = STONE900; x.font = 'bold 34px serif'; x.textAlign = 'left';
x.fillText('Doorway P  ·  refined', 60, 58);
x.fillStyle = STONE400; x.font = '20px serif';
x.fillText('your initial, secretly a lit craftsman doorway', 60, 88);

// Hero
x.drawImage(tile, 60, 120, 240, 240);

// Size ramp on light
const sizes = [96, 64, 48, 36, 24];
let sx = 340; const sy = 250;
x.fillStyle = STONE400; x.font = '17px serif'; x.textAlign='left';
x.fillText('size ramp — 96 / 64 / 48 / 36 / 24 px', 340, 150);
for (const s of sizes){ x.drawImage(tile, sx, sy - s + 40, s, s); sx += s + 26; }

// Light nav lockup
function lockup(yTop, dark){
  const PADX=60, h=92, w=W-120;
  x.fillStyle = dark ? STONE900 : STONE50;
  rr(x, PADX, yTop, w, h, 16); x.fill();
  if(!dark){ x.strokeStyle='#e7e5e4'; x.lineWidth=1; x.stroke(); }
  const L=44, lx=PADX+28, ly=yTop+(h-L)/2;
  x.drawImage(tile, lx, ly, L, L);
  x.fillStyle = dark ? '#ffffff' : STONE900;
  x.font='bold 30px serif'; x.textAlign='left';
  x.fillText('POAssociation', lx+L+16, ly+L/2+10);
  // small caption
  x.fillStyle = dark ? STONE400 : STONE400; x.font='16px serif'; x.textAlign='right';
  x.fillText(dark ? 'footer / dark' : 'navbar / light', PADX+w-22, yTop+h/2+6);
}
lockup(410, false);
lockup(520, true);

// One-color + ink variant row
x.fillStyle = STONE400; x.font='17px serif'; x.textAlign='left';
x.fillText('one-color (favicon)            ink variant (no ground)', 60, 655);
const monoTile = await loadImage(Buffer.from(doorwayP('tile')));
// charcoal stamp: draw ink on light
x.drawImage(ink, 60, 670, 56, 56);
x.drawImage(ink, 300, 670, 56, 56);
// ink on dark chip
x.fillStyle = STONE900; rr(x, 380, 666, 64, 64, 12); x.fill();
const inkLight = await loadImage(Buffer.from(doorwayP('tile')));
x.drawImage(inkLight, 384, 670, 56, 56);

await writeFile('scripts/logo-doorwayP.png', c.toBuffer('image/png'));
console.log('wrote scripts/logo-doorwayP.png');
