#!/usr/bin/env node
/**
 * One-off art generator for the homepage redesign.
 * Uses fal.ai text-to-image (Flux Pro v1.1 Ultra) — warm, intimate, human-scale.
 * Usage: node scripts/genArt.mjs <jobsFile.json>
 *   jobsFile = [{ name, prompt, aspect_ratio }]
 * Writes JPEGs to attached_assets/generated_images/<name>.jpg
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const FAL_KEY = process.env.FAL_AI_API_KEY || process.env.FAL_KEY || '';
if (!FAL_KEY) { console.error('No FAL key in env'); process.exit(1); }

const MODEL = 'https://fal.run/fal-ai/flux-pro/v1.1-ultra';
const OUT_DIR = 'assets/generated_images'; // matches the vite @assets alias

async function gen({ name, prompt, aspect_ratio = '16:9' }) {
  process.stdout.write(`→ ${name} (${aspect_ratio}) ... `);
  const res = await fetch(MODEL, {
    method: 'POST',
    headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      aspect_ratio,
      num_images: 1,
      output_format: 'jpeg',
      enable_safety_checker: true,
      safety_tolerance: '5',
    }),
  });
  if (!res.ok) { console.log(`FAIL ${res.status}`); console.error(await res.text()); return null; }
  const data = await res.json();
  const url = data?.images?.[0]?.url;
  if (!url) { console.log('no image'); console.error(JSON.stringify(data).slice(0, 400)); return null; }
  const img = await fetch(url);
  const buf = Buffer.from(await img.arrayBuffer());
  const out = join(OUT_DIR, `${name}.jpg`);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, buf);
  console.log(`OK ${(buf.length / 1024).toFixed(0)}kb -> ${out}`);
  return out;
}

const jobsFile = process.argv[2];
const jobs = JSON.parse(await readFile(jobsFile, 'utf8'));
for (const job of jobs) {
  try { await gen(job); } catch (e) { console.log('ERR', e.message); }
}
console.log('done');
