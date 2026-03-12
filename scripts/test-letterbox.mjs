import sharp from "sharp";
import { mkdir } from "fs/promises";
import { basename, extname } from "path";

const TARGET_WIDTH = 4096;
const TARGET_HEIGHT = 2048;

async function letterbox(inputPath, outputPath) {
  const meta = await sharp(inputPath).metadata();
  const srcW = meta.width, srcH = meta.height;
  const srcRatio = srcW / srcH;
  console.log(`  Input: ${srcW}x${srcH} (ratio ${srcRatio.toFixed(3)})`);

  const scaledW = TARGET_WIDTH;
  const scaledH = Math.round((srcH / srcW) * TARGET_WIDTH);
  const topPad = Math.round((TARGET_HEIGHT - scaledH) / 2);
  const bottomPad = TARGET_HEIGHT - scaledH - topPad;

  if (topPad <= 0) {
    console.log("  Image already covers 2:1 or taller -- just resizing to 2:1");
    await sharp(inputPath)
      .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "fill" })
      .png()
      .toFile(outputPath);
  } else {
    console.log(`  Scaling to ${scaledW}x${scaledH}, padding: top=${topPad}px bottom=${bottomPad}px`);
    await sharp(inputPath)
      .resize(scaledW, scaledH, { fit: "fill" })
      .extend({
        top: topPad,
        bottom: bottomPad,
        background: { r: 0, g: 0, b: 0, alpha: 255 },
      })
      .png()
      .toFile(outputPath);
  }

  console.log(`  Output: ${outputPath} (${TARGET_WIDTH}x${TARGET_HEIGHT})`);
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/test-letterbox.mjs <image-path> [output-path]");
  process.exit(1);
}

const outputDir = "public/test-assets/eval";
await mkdir(outputDir, { recursive: true });

const tag = basename(inputPath, extname(inputPath));
const outputPath = process.argv[3] || `${outputDir}/${tag}-letterboxed.png`;

console.log(`\nLetterboxing: ${inputPath}`);
await letterbox(inputPath, outputPath);
console.log("Done!");
