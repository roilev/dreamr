import sharp from "sharp";
import { readFile, writeFile } from "fs/promises";

const EQUIRECT_WIDTH = 4096;
const EQUIRECT_HEIGHT = 2048;

async function resizeToEquirect(imageBuffer) {
  const meta = await sharp(imageBuffer).metadata();
  const srcW = meta.width ?? EQUIRECT_WIDTH;
  const srcH = meta.height ?? EQUIRECT_HEIGHT;
  const srcRatio = srcW / srcH;
  const targetRatio = EQUIRECT_WIDTH / EQUIRECT_HEIGHT;

  console.log(`  Input: ${srcW}x${srcH} (ratio ${srcRatio.toFixed(4)}, target ${targetRatio.toFixed(4)})`);

  if (Math.abs(srcRatio - targetRatio) < 0.01) {
    console.log("  -> No-op path (already 2:1)");
    return sharp(imageBuffer)
      .resize(EQUIRECT_WIDTH, EQUIRECT_HEIGHT, { fit: "fill" })
      .png()
      .toBuffer();
  }

  console.log("  -> Cover-crop path (non-2:1 source)");
  return sharp(imageBuffer)
    .resize(EQUIRECT_WIDTH, EQUIRECT_HEIGHT, {
      fit: "cover",
      position: "centre",
    })
    .png()
    .toBuffer();
}

const testCases = [
  {
    name: "2:1 grid (should be no-op)",
    input: "public/test-assets/equirect-grid.png",
    output: "public/test-assets/processed-grid-2x1.png",
  },
  {
    name: "21:9 grid (simulating fal.ai)",
    input: "public/test-assets/equirect-grid-21x9.png",
    output: "public/test-assets/processed-grid-21x9.png",
  },
  {
    name: "1024x506 grid (simulating Gemini upload)",
    input: "public/test-assets/equirect-grid-1024x506.png",
    output: "public/test-assets/processed-grid-1024x506.png",
  },
];

for (const tc of testCases) {
  console.log(`\nProcessing: ${tc.name}`);
  const buf = await readFile(tc.input);
  const result = await resizeToEquirect(buf);
  await writeFile(tc.output, result);
  const outMeta = await sharp(result).metadata();
  console.log(`  Output: ${outMeta.width}x${outMeta.height} -> ${tc.output}`);
}

console.log("\nDone. All processed images saved to public/test-assets/");
