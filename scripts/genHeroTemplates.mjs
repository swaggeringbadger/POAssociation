#!/usr/bin/env node
/**
 * Hero-image starter library generator.
 * Curated, on-brand (warm / editorial / golden-hour) 16:9 banners that a
 * community can pick instead of uploading their own Community Hero Image.
 * Uses fal.ai text-to-image (Flux Pro v1.1 Ultra), same as scripts/genArt.mjs.
 *
 * Usage: node scripts/genHeroTemplates.mjs
 * Writes JPEGs to client/public/hero-templates/<id>.jpg  (served at /hero-templates/<id>.jpg)
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const FAL_KEY = process.env.FAL_AI_API_KEY || process.env.FAL_KEY || '';
if (!FAL_KEY) { console.error('No FAL key in env (FAL_AI_API_KEY / FAL_KEY)'); process.exit(1); }

const MODEL = 'https://fal.run/fal-ai/flux-pro/v1.1-ultra';
const OUT_DIR = 'client/public/hero-templates';

// A geographically varied set so most communities find a fit, all in the same
// warm/editorial treatment for brand consistency. No people-faces, no text.
const COMMON = 'cinematic editorial photography, warm amber and stone tones, golden-hour light, soft and inviting, ultra realistic, high detail, no text, no logos, no watermark';

const JOBS = [
  {
    id: 'golden-street',
    label: 'Tree-Lined Street',
    description: 'A classic neighborhood street at golden hour',
    prompt: `A peaceful tree-lined residential street in a well-kept American neighborhood, mature oak trees arching over the road, warm low sunlight, long soft shadows, tidy lawns and welcoming craftsman homes with lit front porches, ${COMMON}, no people`,
  },
  {
    id: 'front-porches',
    label: 'Welcoming Porches',
    description: 'Craftsman cottages with inviting front porches',
    prompt: `A charming row of craftsman and cottage style homes with inviting covered front porches, flower planters and tidy hedges, soft warm morning light, human-scale and welcoming, real-estate editorial photography, ${COMMON}, no people`,
  },
  {
    id: 'community-green',
    label: 'Community Green',
    description: 'An open park green with a shade tree and path',
    prompt: `A lush community park green with a large shade tree, a gently winding walking path, open lawn and a few wooden benches, warm welcoming suburban community feel, ${COMMON}, distant soft-focus figures far away`,
  },
  {
    id: 'lakeside',
    label: 'Lakeside',
    description: 'A calm waterfront community at dusk',
    prompt: `A serene lakeside residential community at dusk, calm reflective water, a wooden dock reaching into the lake, tasteful homes nestled among trees along the shoreline, warm evening glow on the water, ${COMMON}, no people`,
  },
  {
    id: 'mountain-wooded',
    label: 'Wooded Hills',
    description: 'Homes among pines with morning mist',
    prompt: `Homes nestled in a wooded mountain neighborhood at sunrise, tall pine trees, soft morning mist drifting between the trunks, warm light breaking through, cozy and natural community feel, editorial landscape photography, ${COMMON}, no people`,
  },
  {
    id: 'coastal-palms',
    label: 'Coastal',
    description: 'A sunny coastal neighborhood with palms',
    prompt: `A warm coastal residential community on a bright clear day, tasteful homes lined with tall palm trees, blue sky with soft clouds, gentle warm light, relaxed sunbelt neighborhood feel, ${COMMON}, no people`,
  },
];

async function gen({ id, prompt }) {
  process.stdout.write(`→ ${id} ... `);
  const res = await fetch(MODEL, {
    method: 'POST',
    headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      aspect_ratio: '16:9',
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
  const out = join(OUT_DIR, `${id}.jpg`);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, buf);
  console.log(`OK ${(buf.length / 1024).toFixed(0)}kb -> ${out}`);
  return out;
}

for (const job of JOBS) {
  try { await gen(job); } catch (e) { console.log('ERR', e.message); }
}
console.log('done');
