import sharp from "sharp";
import { readFile, writeFile, mkdir } from "fs/promises";

const INPUT_FILES = [
  {
    name: "generated-original",
    path: "public/test-assets/existing/generated-original.png",
  },
  {
    name: "generated-reprocessed",
    path: "public/test-assets/existing/generated-reprocessed.png",
  },
];

const OUTPUT_DIR = "public/test-assets/cubemap";

// Horizontal cross layout:
//          [Top]
// [Left]  [Front]  [Right]  [Back]
//          [Bottom]
const FACE_POSITIONS = {
  top:    { col: 1, row: 0 },
  left:   { col: 0, row: 1 },
  front:  { col: 1, row: 1 },
  right:  { col: 2, row: 1 },
  back:   { col: 3, row: 1 },
  bottom: { col: 1, row: 2 },
};

// 3D direction for a pixel on a given cubemap face.
// (u, v) are in [-1, 1], face center is (0,0).
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

// 3D direction to equirectangular (u, v) in [0,1]
function dirToEquirect(x, y, z) {
  const len = Math.sqrt(x * x + y * y + z * z);
  x /= len; y /= len; z /= len;

  const lng = Math.atan2(-z, -x);          // -PI to PI
  const lat = Math.asin(Math.max(-1, Math.min(1, y))); // -PI/2 to PI/2

  const eu = (lng + Math.PI) / (2 * Math.PI);  // 0..1
  const ev = (Math.PI / 2 - lat) / Math.PI;    // 0..1 (top=0, bottom=1)
  return [eu, ev];
}

function bilinearSample(pixels, w, h, channels, u, v) {
  const px = u * (w - 1);
  const py = v * (h - 1);
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const fx = px - x0;
  const fy = py - y0;

  const result = new Array(channels);
  for (let c = 0; c < channels; c++) {
    const i00 = (y0 * w + x0) * channels + c;
    const i10 = (y0 * w + x1) * channels + c;
    const i01 = (y1 * w + x0) * channels + c;
    const i11 = (y1 * w + x1) * channels + c;
    result[c] =
      pixels[i00] * (1 - fx) * (1 - fy) +
      pixels[i10] * fx * (1 - fy) +
      pixels[i01] * (1 - fx) * fy +
      pixels[i11] * fx * fy;
  }
  return result;
}

async function equirectToCubemapCross(inputPath, outputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const eqW = info.width;
  const eqH = info.height;
  const channels = info.channels;

  const faceSize = Math.round(eqW / 4);
  const crossW = faceSize * 4;
  const crossH = faceSize * 3;

  console.log(`  Equirect: ${eqW}x${eqH} -> Cubemap cross: ${crossW}x${crossH} (face=${faceSize})`);

  const out = Buffer.alloc(crossW * crossH * channels);

  for (const [faceName, pos] of Object.entries(FACE_POSITIONS)) {
    const offX = pos.col * faceSize;
    const offY = pos.row * faceSize;

    for (let fy = 0; fy < faceSize; fy++) {
      for (let fx = 0; fx < faceSize; fx++) {
        // (u,v) in [-1, 1] for this face pixel
        const u = (2 * (fx + 0.5)) / faceSize - 1;
        const v = -((2 * (fy + 0.5)) / faceSize - 1); // flip Y: top of image = +Y

        const [dx, dy, dz] = faceUVToDirection(faceName, u, v);
        const [eu, ev] = dirToEquirect(dx, dy, dz);

        const sample = bilinearSample(data, eqW, eqH, channels, eu, ev);

        const outIdx = ((offY + fy) * crossW + (offX + fx)) * channels;
        for (let c = 0; c < channels; c++) {
          out[outIdx + c] = Math.round(sample[c]);
        }
      }
    }
  }

  await sharp(out, { raw: { width: crossW, height: crossH, channels } })
    .png()
    .toFile(outputPath);

  console.log(`  Saved: ${outputPath}`);
}

await mkdir(OUTPUT_DIR, { recursive: true });

for (const f of INPUT_FILES) {
  console.log(`\nConverting: ${f.name}`);
  await equirectToCubemapCross(f.path, `${OUTPUT_DIR}/${f.name}-cubemap-cross.png`);
}

// Also convert the synthetic grid for geometric verification
console.log("\nConverting: synthetic grid");
await equirectToCubemapCross(
  "public/test-assets/equirect-grid.png",
  `${OUTPUT_DIR}/grid-cubemap-cross.png`,
);

console.log("\nDone! Cubemap cross images saved to " + OUTPUT_DIR);
