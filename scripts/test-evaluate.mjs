import sharp from "sharp";
import { mkdir } from "fs/promises";
import { basename, extname } from "path";

const FACE_POSITIONS = {
  top:    { col: 1, row: 0 },
  left:   { col: 0, row: 1 },
  front:  { col: 1, row: 1 },
  right:  { col: 2, row: 1 },
  back:   { col: 3, row: 1 },
  bottom: { col: 1, row: 2 },
};

function faceUVToDirection(face, u, v) {
  switch (face) {
    case "front":  return [  u,  v, -1 ];
    case "back":   return [ -u,  v,  1 ];
    case "left":   return [ -1,  v, -u ];
    case "right":  return [  1,  v,  u ];
    case "top":    return [  u,  1, -v ];
    case "bottom": return [  u, -1,  v ];
  }
}

function dirToEquirect(x, y, z) {
  const len = Math.sqrt(x * x + y * y + z * z);
  x /= len; y /= len; z /= len;
  const lng = Math.atan2(-z, -x);
  const lat = Math.asin(Math.max(-1, Math.min(1, y)));
  return [(lng + Math.PI) / (2 * Math.PI), (Math.PI / 2 - lat) / Math.PI];
}

function bilinearSample(pixels, w, h, ch, u, v) {
  const px = u * (w - 1);
  const py = v * (h - 1);
  const x0 = Math.floor(px), y0 = Math.floor(py);
  const x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1);
  const fx = px - x0, fy = py - y0;
  const result = new Array(ch);
  for (let c = 0; c < ch; c++) {
    const i00 = (y0 * w + x0) * ch + c;
    const i10 = (y0 * w + x1) * ch + c;
    const i01 = (y1 * w + x0) * ch + c;
    const i11 = (y1 * w + x1) * ch + c;
    result[c] =
      pixels[i00] * (1 - fx) * (1 - fy) +
      pixels[i10] * fx * (1 - fy) +
      pixels[i01] * (1 - fx) * fy +
      pixels[i11] * fx * fy;
  }
  return result;
}

async function equirectToCubemapCross(inputPath, outputDir, tag) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const eqW = info.width, eqH = info.height, ch = info.channels;
  const faceSize = Math.round(eqW / 4);
  const crossW = faceSize * 4, crossH = faceSize * 3;

  console.log(`  Input: ${eqW}x${eqH} (ratio ${(eqW / eqH).toFixed(3)}) -> Cross: ${crossW}x${crossH} (face=${faceSize})`);

  const out = Buffer.alloc(crossW * crossH * ch);

  for (const [faceName, pos] of Object.entries(FACE_POSITIONS)) {
    const offX = pos.col * faceSize, offY = pos.row * faceSize;
    const facePixels = Buffer.alloc(faceSize * faceSize * ch);

    for (let fy = 0; fy < faceSize; fy++) {
      for (let fx = 0; fx < faceSize; fx++) {
        const u = (2 * (fx + 0.5)) / faceSize - 1;
        const v = -((2 * (fy + 0.5)) / faceSize - 1);
        const [dx, dy, dz] = faceUVToDirection(faceName, u, v);
        const [eu, ev] = dirToEquirect(dx, dy, dz);
        const sample = bilinearSample(data, eqW, eqH, ch, eu, ev);

        const crossIdx = ((offY + fy) * crossW + (offX + fx)) * ch;
        const faceIdx = (fy * faceSize + fx) * ch;
        for (let c = 0; c < ch; c++) {
          out[crossIdx + c] = Math.round(sample[c]);
          facePixels[faceIdx + c] = Math.round(sample[c]);
        }
      }
    }

    if (faceName === "top" || faceName === "bottom") {
      const facePath = `${outputDir}/${tag}-${faceName}.png`;
      await sharp(facePixels, { raw: { width: faceSize, height: faceSize, channels: ch } })
        .png()
        .toFile(facePath);
      console.log(`  Extracted ${faceName} face: ${facePath}`);
    }
  }

  const crossPath = `${outputDir}/${tag}-cubemap-cross.png`;
  await sharp(out, { raw: { width: crossW, height: crossH, channels: ch } })
    .png()
    .toFile(crossPath);
  console.log(`  Full cross: ${crossPath}`);
}

const args = process.argv.slice(2);
const inputPath = args[0];
if (!inputPath) {
  console.error("Usage: node scripts/test-evaluate.mjs <equirect-image-path> [tag] [--output-dir dir]");
  process.exit(1);
}

const odIdx = args.indexOf("--output-dir");
const outputDir = odIdx !== -1 ? args[odIdx + 1] : "public/test-assets/pipeline/eval";
const tag = (args[1] && !args[1].startsWith("--")) ? args[1] : basename(inputPath, extname(inputPath));

await mkdir(outputDir, { recursive: true });
console.log(`\nEvaluating: ${inputPath} (tag: ${tag})`);
await equirectToCubemapCross(inputPath, outputDir, tag);
console.log("\nDone! Check the extracted top/bottom faces for pole quality.");
