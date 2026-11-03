// Keeps public/images deployable: recipe/technique WebPs capped at a web-sized
// resolution, and raw drop-in originals moved out of public/ (Cloudflare Pages
// rejects any asset over 25 MiB, and everything in public/ ships).
//
//   npm run images                       sweep: shrink oversized WebPs, move untracked unreferenced originals
//   npm run images -- <source> <slug>    convert one original to public/images/<slug>.webp, then move it
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const IMAGES_DIR = "public/images";
const SOURCES_DIR = "image-sources"; // gitignored home for originals
const MAX_EDGE = 2000; // px, long edge
const MAX_BYTES = 500 * 1024; // re-encode anything heavier than this
const QUALITY = 78;
const RASTER = /\.(jpe?g|png|jfif)$/i;

// Read via buffers and skip sharp's file cache so Windows never holds a handle
// on a file we are about to overwrite in place.
sharp.cache(false);

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

async function encodeWebp(input, output) {
  const buffer = await sharp(input)
    .rotate() // honor EXIF orientation before it is stripped
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 5 })
    .toBuffer();
  writeFileSync(output, buffer);
  return buffer.length;
}

function moveToSources(file) {
  mkdirSync(SOURCES_DIR, { recursive: true });
  const dest = path.join(SOURCES_DIR, path.basename(file));
  if (existsSync(dest)) throw new Error(`${dest} already exists; not overwriting`);
  renameSync(file, dest);
  return dest;
}

// Every /images/... path mentioned anywhere under src/ - those files stay put.
function referencedImages() {
  const refs = new Set();
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else for (const m of readFileSync(full, "utf8").matchAll(/\/images\/([^"'`)\s]+)/g)) refs.add(m[1]);
    }
  };
  walk("src");
  return refs;
}

// Committed files may be used from outside this repo, so the sweep only ever
// moves drop-ins git doesn't know about.
function trackedImages() {
  const out = execFileSync("git", ["ls-files", "-z", IMAGES_DIR], { encoding: "utf8" });
  return new Set(out.split("\0").filter(Boolean).map((f) => path.basename(f)));
}

async function convertOne(source, slug) {
  if (!existsSync(source)) throw new Error(`No such file: ${source}`);
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`Slug must be lowercase letters, digits and dashes: ${slug}`);
  const output = path.join(IMAGES_DIR, `${slug}.webp`);
  const before = statSync(source).size;
  const after = await encodeWebp(source, output);
  console.log(`${source} (${kb(before)}) -> ${output} (${kb(after)})`);
  if (path.resolve(path.dirname(source)) === path.resolve(IMAGES_DIR)) {
    console.log(`  original moved to ${moveToSources(source)}`);
  }
}

async function sweep() {
  const refs = referencedImages();
  const tracked = trackedImages();
  let saved = 0;
  for (const name of readdirSync(IMAGES_DIR).sort()) {
    const file = path.join(IMAGES_DIR, name);
    const size = statSync(file).size;

    if (name.toLowerCase().endsWith(".webp")) {
      const input = readFileSync(file);
      const { width = 0, height = 0 } = await sharp(input).metadata();
      if (Math.max(width, height) <= MAX_EDGE && size <= MAX_BYTES) continue;
      const after = await encodeWebp(input, file);
      saved += size - after;
      console.log(`shrunk  ${name}: ${width}x${height}, ${kb(size)} -> ${kb(after)}`);
    } else if (RASTER.test(name) && !refs.has(name) && !tracked.has(name)) {
      console.log(`moved   ${name} (${kb(size)}) -> ${moveToSources(file)}`);
      saved += size;
    }
  }
  console.log(`\npublic/images is ${kb(saved)} lighter.`);
}

const [source, slug] = process.argv.slice(2);
await (source ? convertOne(source, slug ?? "") : sweep());
