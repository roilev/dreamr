/**
 * Double-pass pole fill test script.
 * Requires FAL_KEY with sufficient balance.
 *
 * Usage:
 *   export $(grep -v '^#' .env.local | xargs)
 *   node scripts/test-double-pass.mjs
 *
 * What it does:
 *   1. Generates a 360 image at "auto" aspect ratio
 *   2. Letterboxes it to 2:1 (black bars at poles)
 *   3. Sends the letterboxed image to the edit endpoint for pole fill
 *   4. Saves all intermediate and final outputs for comparison
 */

import { fal } from "@fal-ai/client";
import sharp from "sharp";
import { writeFile, mkdir } from "fs/promises";

fal.config({ credentials: process.env.FAL_KEY });

const MODEL = "fal-ai/nano-banana-2";
const MODEL_EDIT = "fal-ai/nano-banana-2/edit";
const OUTPUT_DIR = "public/test-assets/double-pass";
const EQUIRECT_WIDTH = 4096;
const EQUIRECT_HEIGHT = 2048;

const PROMPT =
  "Generate a seamless 360-degree equirectangular panoramic image. " +
  "The image must have a 2:1 aspect ratio with the full 360 horizontal field of view. " +
  "The left edge and right edge must connect seamlessly when wrapped into a sphere. " +
  "The top represents the zenith (straight up) and the bottom the nadir (straight down). " +
  "The scene: A retro-futuristic cityscape at sunset with neon signs and flying vehicles";

const POLE_FILL_PROMPT =
  "Complete the zenith and nadir of this equirectangular panoramic image. " +
  "The black regions at the top and bottom represent missing pole content. " +
  "Fill them with natural sky content (top) and ground/floor content (bottom) " +
  "that seamlessly blends with the existing scene. " +
  "Maintain consistent lighting, color palette, and artistic style. " +
  "The output must be a valid equirectangular projection at 2:1 aspect ratio. " +
  "Scene context: A retro-futuristic cityscape at sunset with neon signs and flying vehicles";

await mkdir(OUTPUT_DIR, { recursive: true });

// Pass 1: Generate
console.log("=== Pass 1: Generate at auto aspect ratio ===");
const gen = await fal.subscribe(MODEL, {
  input: {
    prompt: PROMPT,
    aspect_ratio: "auto",
    resolution: "4K",
    output_format: "png",
    limit_generations: true,
  },
  logs: true,
});

const rawImg = gen.data.images[0];
console.log(`Raw output: ${rawImg.width}x${rawImg.height} (ratio ${(rawImg.width / rawImg.height).toFixed(4)})`);

const rawResp = await fetch(rawImg.url);
const rawBuf = Buffer.from(await rawResp.arrayBuffer());
await writeFile(`${OUTPUT_DIR}/1-raw.png`, rawBuf);
console.log("Saved 1-raw.png");

// Letterbox to 2:1
console.log("\n=== Letterboxing to 2:1 ===");
const meta = await sharp(rawBuf).metadata();
const srcW = meta.width;
const srcH = meta.height;
const scaledW = EQUIRECT_WIDTH;
const scaledH = Math.round((srcH / srcW) * EQUIRECT_WIDTH);
const topPad = Math.round((EQUIRECT_HEIGHT - scaledH) / 2);
console.log(`Scaling ${srcW}x${srcH} → ${scaledW}x${scaledH}, padding top=${topPad} bottom=${EQUIRECT_HEIGHT - scaledH - topPad}`);

const letterboxed = await sharp(rawBuf)
  .resize(scaledW, scaledH, { fit: "fill" })
  .extend({
    top: topPad,
    bottom: EQUIRECT_HEIGHT - scaledH - topPad,
    background: { r: 0, g: 0, b: 0, alpha: 255 },
  })
  .png()
  .toBuffer();

await writeFile(`${OUTPUT_DIR}/2-letterboxed.png`, letterboxed);
console.log("Saved 2-letterboxed.png");

// Upload letterboxed to fal for editing
console.log("\n=== Pass 2: Pole fill via edit endpoint ===");
const uploadedUrl = await fal.storage.upload(new Blob([letterboxed], { type: "image/png" }));
console.log(`Uploaded letterboxed to: ${uploadedUrl}`);

const edit = await fal.subscribe(MODEL_EDIT, {
  input: {
    prompt: POLE_FILL_PROMPT,
    image_urls: [uploadedUrl],
    aspect_ratio: "auto",
    resolution: "4K",
    output_format: "png",
    limit_generations: true,
  },
  logs: true,
});

const fillImg = edit.data.images[0];
console.log(`Pole fill output: ${fillImg.width}x${fillImg.height} (ratio ${(fillImg.width / fillImg.height).toFixed(4)})`);

const fillResp = await fetch(fillImg.url);
const fillBuf = Buffer.from(await fillResp.arrayBuffer());
await writeFile(`${OUTPUT_DIR}/3-pole-filled.png`, fillBuf);
console.log("Saved 3-pole-filled.png");

// Final resize to exact 4096x2048
const final = await sharp(fillBuf)
  .resize(EQUIRECT_WIDTH, EQUIRECT_HEIGHT, { fit: "cover", position: "centre" })
  .png()
  .toBuffer();
await writeFile(`${OUTPUT_DIR}/4-final.png`, final);
console.log("Saved 4-final.png");

// Also generate a single-pass cover-crop baseline for comparison
console.log("\n=== Baseline: single-pass cover-crop ===");
const baseline = await sharp(rawBuf)
  .resize(EQUIRECT_WIDTH, EQUIRECT_HEIGHT, { fit: "cover", position: "centre" })
  .png()
  .toBuffer();
await writeFile(`${OUTPUT_DIR}/5-baseline-covercrop.png`, baseline);
console.log("Saved 5-baseline-covercrop.png");

console.log("\n=== Done! Compare files in " + OUTPUT_DIR + " ===");
console.log("Key comparison: 4-final.png (double-pass) vs 5-baseline-covercrop.png (single-pass)");
