import sharp from "sharp";
import { mkdir } from "fs/promises";
import { basename, extname } from "path";

const DEFAULT_MASK_WIDTH_PCT = 5;

async function shiftImage(inputPath, outputDir, tag, maskWidthPct) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width, h = info.height, ch = info.channels;
  const halfW = Math.round(w / 2);

  console.log(`  Input: ${w}x${h}`);
  console.log(`  Shifting by ${halfW}px (50%)`);

  const out = Buffer.alloc(w * h * ch);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcX = (x + halfW) % w;
      const srcIdx = (y * w + srcX) * ch;
      const dstIdx = (y * w + x) * ch;
      for (let c = 0; c < ch; c++) out[dstIdx + c] = data[srcIdx + c];
    }
  }

  const maskHalfW = Math.round((w * maskWidthPct) / 100 / 2);
  const centerX = Math.round(w / 2);
  let maskedPixels = 0;

  for (let y = 0; y < h; y++) {
    for (let x = centerX - maskHalfW; x <= centerX + maskHalfW; x++) {
      if (x < 0 || x >= w) continue;
      const idx = (y * w + x) * ch;
      out[idx] = 0;
      out[idx + 1] = 0;
      out[idx + 2] = 0;
      out[idx + 3] = 255;
      maskedPixels++;
    }
  }

  console.log(`  Masked center strip: ${maskHalfW * 2 + 1}px wide (${maskWidthPct}%)`);

  const shiftedPath = `${outputDir}/${tag}-shifted.png`;
  await sharp(out, { raw: { width: w, height: h, channels: ch } })
    .png()
    .toFile(shiftedPath);
  console.log(`  Saved: ${shiftedPath}`);
}

async function unshiftImage(inputPath, outputDir, tag) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width, h = info.height, ch = info.channels;
  const halfW = Math.round(w / 2);

  console.log(`  Input: ${w}x${h}`);
  console.log(`  Unshifting by ${halfW}px (50% back)`);

  const out = Buffer.alloc(w * h * ch);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcX = (x + halfW) % w;
      const srcIdx = (y * w + srcX) * ch;
      const dstIdx = (y * w + x) * ch;
      for (let c = 0; c < ch; c++) out[dstIdx + c] = data[srcIdx + c];
    }
  }

  const outPath = `${outputDir}/${tag}-unshifted.png`;
  await sharp(out, { raw: { width: w, height: h, channels: ch } })
    .png()
    .toFile(outPath);
  console.log(`  Saved: ${outPath}`);
  return outPath;
}

const args = process.argv.slice(2);
const mode = args[0];

const odIdx = args.indexOf("--output-dir");
const defaultOutputDir = "public/test-assets/pipeline/stage2-seams";
const outputDir = odIdx !== -1 ? args[odIdx + 1] : defaultOutputDir;

if (mode === "--shift") {
  const inputPath = args[1];
  if (!inputPath) { console.error("Usage: --shift <image> [--mask-width 5] [--tag name] [--output-dir dir]"); process.exit(1); }

  const mwIdx = args.indexOf("--mask-width");
  const maskWidthPct = mwIdx !== -1 ? parseFloat(args[mwIdx + 1]) : DEFAULT_MASK_WIDTH_PCT;
  const tagIdx = args.indexOf("--tag");
  const tag = tagIdx !== -1 ? args[tagIdx + 1] : basename(inputPath, extname(inputPath));

  await mkdir(outputDir, { recursive: true });
  console.log(`\nShifting + masking: ${inputPath} (tag: ${tag})`);
  await shiftImage(inputPath, outputDir, tag, maskWidthPct);
  console.log("\nDone! Send the shifted image to nano for seam inpainting.");

} else if (mode === "--unshift") {
  const inputPath = args[1];
  if (!inputPath) { console.error("Usage: --unshift <inpainted-image> [--tag name] [--output-dir dir]"); process.exit(1); }

  const tagIdx = args.indexOf("--tag");
  const tag = tagIdx !== -1 ? args[tagIdx + 1] : basename(inputPath, extname(inputPath));

  await mkdir(outputDir, { recursive: true });
  console.log(`\nUnshifting: ${inputPath} (tag: ${tag})`);
  await unshiftImage(inputPath, outputDir, tag);
  console.log("\nDone!");

} else {
  console.error("Usage:");
  console.error("  node scripts/test-shift-seam.mjs --shift <image> [--mask-width 5] [--tag name] [--output-dir dir]");
  console.error("  node scripts/test-shift-seam.mjs --unshift <inpainted-image> [--tag name] [--output-dir dir]");
  process.exit(1);
}
