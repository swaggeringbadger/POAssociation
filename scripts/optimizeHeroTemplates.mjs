#!/usr/bin/env node
/**
 * Downscale + recompress the hero starter-library JPEGs in place.
 * The live hero banner is only ~400px tall and the modal shows small thumbs,
 * so a 2752px fal.ai source is overkill. Resize to MAX_W and re-encode.
 * Uses @napi-rs/canvas (already a dep via the PDF rasterizer).
 *
 * Usage: node scripts/optimizeHeroTemplates.mjs
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const DIR = 'client/public/hero-templates';
const MAX_W = 1600; // plenty for a full-width, ~400px-tall hero on retina
const QUALITY = 82; // napi-rs jpeg quality 0-100

const files = (await readdir(DIR)).filter((f) => /\.jpe?g$/i.test(f));
for (const f of files) {
  const path = join(DIR, f);
  const before = (await readFile(path)).length;
  const img = await loadImage(path);
  const scale = Math.min(1, MAX_W / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const buf = canvas.toBuffer('image/jpeg', QUALITY);
  await writeFile(path, buf);
  console.log(
    `${f}: ${img.width}px ${(before / 1024).toFixed(0)}kb -> ${w}px ${(buf.length / 1024).toFixed(0)}kb`,
  );
}
console.log('done');
