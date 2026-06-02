// Export "Doorway P": tile master (big) + transparent mark + favicon + proof sheet.
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFile, mkdir } from 'node:fs/promises';

const defs = `
  <defs>
    <linearGradient id="ground" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fbbf24"/><stop offset="0.55" stop-color="#f59e0b"/><stop offset="1" stop-color="#ea580c"/>
    </linearGradient>
    <linearGradient id="pAmber" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f59e0b"/><stop offset="1" stop-color="#ea580c"/>
    </linearGradient>
    <radialGradient id="lit" cx="0.5" cy="0.42" r="0.62">
      <stop offset="0" stop-color="#fffdf7"/><stop offset="0.45" stop-color="#fde68a"/><stop offset="1" stop-color="#f59e0b"/>
    </radialGradient>
  </defs>`;

// Shared letterform + glowing doorway. pFill = how the P is painted.
const markBody = (pFill, knob) => `
  <g fill="${pFill}">
    <rect x="17" y="12" width="9.5" height="40" rx="4.6"/>
    <circle cx="30.5" cy="24" r="13.2"/>
  </g>
  <path d="M25 35 L25 24 a6.4 6.4 0 0 1 12.8 0 L37.8 35 Z" fill="url(#lit)"/>
  <path d="M25 35 L25 24 a6.4 6.4 0 0 1 12.8 0 L37.8 35" fill="none" stroke="#c2410c" stroke-width="0.7" opacity="0.55"/>
  <rect x="24.4" y="35" width="14" height="2.1" rx="1" fill="#fde68a" opacity="0.9"/>
  <circle cx="34.4" cy="27.5" r="1.5" fill="${knob}"/>`;

// TILE master — amber ground, cream P (the in-app logo)
const SVG_TILE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="POAssociation">${defs}
  <rect width="64" height="64" rx="15" fill="url(#ground)"/>
  <ellipse cx="31" cy="24" rx="20" ry="20" fill="#fde68a" opacity="0.18"/>
  ${markBody('#fffaf3', '#7c2d12')}
</svg>`;

// TRANSPARENT mark — no tile, amber-gradient P (legible on light AND dark)
const SVG_MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="POAssociation">${defs}
  ${markBody('url(#pAmber)', '#7c2d12')}
</svg>`;

async function png(svg, size) {
  const img = await loadImage(Buffer.from(svg));
  const c = createCanvas(size, size);
  c.getContext('2d').drawImage(img, 0, 0, size, size);
  return c.toBuffer('image/png');
}

await mkdir('assets/brand', { recursive: true });
await writeFile('assets/brand/poa-logo.svg', SVG_TILE);
await writeFile('assets/brand/poa-logo-mark.svg', SVG_MARK);

const tile1024 = await png(SVG_TILE, 1024);
const tile512  = await png(SVG_TILE, 512);
const mark1024 = await png(SVG_MARK, 1024);
const favMark  = await png(SVG_MARK, 256);

const outs = [
  ['assets/brand/poa-logo.png', tile1024],                 // big tile master
  ['assets/brand/poa-logo-mark.png', mark1024],            // big transparent mark
  ['assets/generated_images/abstract_geometric_building_logo_concept.png', tile512], // in-app logo (tile)
  ['assets/generated_images/POAssociationLogo.png', tile512],
  ['client/public/favicon.png', favMark],                  // favicon = transparent mark (per request)
];
for (const [p, b] of outs) { await writeFile(p, b); console.log('wrote', p, (b.length/1024|0)+'kb'); }

// ---- proof sheet ----
const W=1000,H=620,c=createCanvas(W,H),x=c.getContext('2d');
x.fillStyle='#fff';x.fillRect(0,0,W,H);
function rr(c,X,Y,w,h,r){c.beginPath();c.moveTo(X+r,Y);c.arcTo(X+w,Y,X+w,Y+h,r);c.arcTo(X+w,Y+h,X,Y+h,r);c.arcTo(X,Y+h,X,Y,r);c.arcTo(X,Y,X+w,Y,r);c.closePath();}
const tImg=await loadImage(tile1024), mImg=await loadImage(mark1024);
x.fillStyle='#1c1917';x.font='bold 30px serif';x.textAlign='left';
x.fillText('Doorway P — deliverables', 50, 52);
// big tile
x.fillStyle='#a8a29e';x.font='17px serif';x.fillText('tile master (1024px)',50,95);
x.drawImage(tImg,50,110,210,210);
// transparent mark on white
x.fillStyle='#a8a29e';x.fillText('transparent mark — on light',300,95);
x.drawImage(mImg,300,110,210,210);
// transparent mark on dark
x.fillStyle='#a8a29e';x.fillText('transparent mark — on dark',560,95);
x.fillStyle='#1c1917';rr(x,560,110,210,210,18);x.fill();
x.drawImage(mImg,560,110,210,210);
// favicon tab simulations
x.fillStyle='#a8a29e';x.font='17px serif';x.fillText('favicon (transparent) — light tab & dark tab', 50, 380);
// light tab
x.fillStyle='#f3f4f6';rr(x,50,400,260,54,10);x.fill();
x.drawImage(mImg,64,408,38,38);
x.fillStyle='#374151';x.font='18px sans-serif';x.fillText('POAssociation — Home',112,433);
// dark tab
x.fillStyle='#27272a';rr(x,330,400,260,54,10);x.fill();
x.drawImage(mImg,344,408,38,38);
x.fillStyle='#e5e7eb';x.font='18px sans-serif';x.fillText('POAssociation — Home',392,433);
// favicon size ramp
x.fillStyle='#a8a29e';x.font='17px serif';x.fillText('16 / 24 / 32 / 48 px',50,500);
let fx=50;for(const s of [16,24,32,48]){x.drawImage(mImg,fx,512,s,s);fx+=s+22;}
await writeFile('scripts/logo-deliverables.png', c.toBuffer('image/png'));
console.log('wrote scripts/logo-deliverables.png');
