// Preview the new earthy jewel-tone role palette against the warm app background.
import { createCanvas } from '@napi-rs/canvas';
import { writeFile } from 'node:fs/promises';

const roles = [
  { name: 'Super Admin',          tone: 'Graphite',      a: '#57534e', b: '#292524' },
  { name: 'Account Admin',        tone: 'Plum',          a: '#6d28d9', b: '#581c87' },
  { name: 'Management Manager',   tone: 'Teal',          a: '#0d9488', b: '#115e59' },
  { name: 'Management Rep',       tone: 'Cyan',          a: '#0891b2', b: '#155e75' },
  { name: 'Board Member',         tone: 'Wine',          a: '#be123c', b: '#881337' },
  { name: 'ARC Committee Member', tone: 'Burnt Sienna',  a: '#c2410c', b: '#7c2d12' },
  { name: 'Homeowner',            tone: 'Forest',        a: '#059669', b: '#166534' },
];

const W = 920, rowH = 96, top = 96, PAD = 40;
const H = top + roles.length * (rowH + 16) + 30;
const c = createCanvas(W, H);
const x = c.getContext('2d');
// warm app background (--background 40 30% 98%)
x.fillStyle = '#faf8f4'; x.fillRect(0, 0, W, H);

function rr(c, X, Y, w, h, r){c.beginPath();c.moveTo(X+r,Y);c.arcTo(X+w,Y,X+w,Y+h,r);c.arcTo(X+w,Y+h,X,Y+h,r);c.arcTo(X,Y+h,X,Y,r);c.arcTo(X,Y,X+w,Y,r);c.closePath();}

x.fillStyle = '#1c1917'; x.font = 'bold 32px serif'; x.textAlign = 'left';
x.fillText('Role colors — earthy jewel tones for the warm theme', PAD, 56);

let y = top;
for (const r of roles) {
  const bw = W - PAD * 2;
  // gradient banner (mimics the dashboard welcome card)
  const g = x.createLinearGradient(PAD, 0, PAD + bw, 0);
  g.addColorStop(0, r.a); g.addColorStop(1, r.b);
  x.fillStyle = g; rr(x, PAD, y, bw, rowH, 18); x.fill();
  // icon disk
  x.fillStyle = 'rgba(255,255,255,0.18)';
  x.beginPath(); x.arc(PAD + 50, y + rowH/2, 26, 0, Math.PI*2); x.fill();
  // title + subtitle
  x.fillStyle = '#ffffff'; x.font = 'bold 26px serif'; x.textAlign = 'left';
  x.fillText(`${r.name} Dashboard`, PAD + 92, y + 42);
  x.fillStyle = 'rgba(255,255,255,0.82)'; x.font = '17px sans-serif';
  x.fillText(`${r.tone}`, PAD + 92, y + 68);
  // swatch chips on the right
  let sx = PAD + bw - 150;
  for (const hex of [r.a, r.b]) {
    x.fillStyle = hex; rr(x, sx, y + rowH/2 - 16, 58, 32, 8); x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.4)'; x.lineWidth = 1; x.stroke();
    sx += 66;
  }
  y += rowH + 16;
}
await writeFile('scripts/role-palette.png', c.toBuffer('image/png'));
console.log('wrote scripts/role-palette.png');
