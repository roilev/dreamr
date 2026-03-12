import sharp from "sharp";
import { mkdir } from "fs/promises";

const EQUIRECT_WIDTH = 4096;
const EQUIRECT_HEIGHT = 2048;

const FACE_POSITIONS = {
  top:    { col: 1, row: 0 },
  left:   { col: 0, row: 1 },
  front:  { col: 1, row: 1 },
  right:  { col: 2, row: 1 },
  back:   { col: 3, row: 1 },
  bottom: { col: 1, row: 2 },
};

const FACE_NAMES = ["front", "back", "left", "right", "top", "bottom"];

function directionToFaceUV(dx, dy, dz) {
  const ax = Math.abs(dx), ay = Math.abs(dy), az = Math.abs(dz);

  let face, u, v;
  if (ax >= ay && ax >= az) {
    if (dx > 0) {
      face = "right";  u = dz / dx;  v = dy / dx;
    } else {
      face = "left";   u = dz / dx;  v = -dy / dx;
    }
  } else if (ay >= ax && ay >= az) {
    if (dy > 0) {
      face = "top";    u = dx / dy;  v = -dz / dy;
    } else {
      face = "bottom"; u = dx / (-dy); v = dz / (-dy);
    }
  } else {
    if (dz > 0) {
      face = "back";   u = -dx / dz; v = dy / dz;
    } else {
      face = "front";  u = dx / (-dz); v = dy / (-dz);
    }
  }

  const px = (u + 1) / 2;
  const py = (1 - v) / 2;
  return { face, px, py };
}

function bilinearSample(pixels, w, h, ch, u, v) {
  u = Math.max(0, Math.min(1, u));
  v = Math.max(0, Math.min(1, v));
  const fpx = u * (w - 1), fpy = v * (h - 1);
  const x0 = Math.floor(fpx), y0 = Math.floor(fpy);
  const x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1);
  const fx = fpx - x0, fy = fpy - y0;
  const result = new Array(ch);
  for (let c = 0; c < ch; c++) {
    result[c] =
      pixels[(y0 * w + x0) * ch + c] * (1 - fx) * (1 - fy) +
      pixels[(y0 * w + x1) * ch + c] * fx * (1 - fy) +
      pixels[(y1 * w + x0) * ch + c] * (1 - fx) * fy +
      pixels[(y1 * w + x1) * ch + c] * fx * fy;
  }
  return result;
}

async function loadFace(path, faceSize) {
  const { data, info } = await sharp(path)
    .resize(faceSize, faceSize, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { pixels: data, width: info.width, height: info.height, channels: info.channels };
}

async function assembleCubemapCross(facePaths, faceSize) {
  const crossW = faceSize * 4, crossH = faceSize * 3;
  const ch = 4;
  const out = Buffer.alloc(crossW * crossH * ch);

  for (const [faceName, pos] of Object.entries(FACE_POSITIONS)) {
    if (!facePaths[faceName]) continue;
    const face = await loadFace(facePaths[faceName], faceSize);
    const offX = pos.col * faceSize, offY = pos.row * faceSize;

    for (let fy = 0; fy < faceSize; fy++) {
      for (let fx = 0; fx < faceSize; fx++) {
        const srcIdx = (fy * faceSize + fx) * ch;
        const dstIdx = ((offY + fy) * crossW + (offX + fx)) * ch;
        for (let c = 0; c < ch; c++) out[dstIdx + c] = face.pixels[srcIdx + c];
      }
    }
  }

  return { pixels: out, width: crossW, height: crossH, channels: ch };
}

async function cubemapCrossToEquirect(facePaths, faceSize) {
  const faces = {};
  for (const name of FACE_NAMES) {
    if (facePaths[name]) faces[name] = await loadFace(facePaths[name], faceSize);
  }

  const ch = 4;
  const out = Buffer.alloc(EQUIRECT_WIDTH * EQUIRECT_HEIGHT * ch);

  for (let y = 0; y < EQUIRECT_HEIGHT; y++) {
    const lat = Math.PI / 2 - (y / EQUIRECT_HEIGHT) * Math.PI;
    for (let x = 0; x < EQUIRECT_WIDTH; x++) {
      const lng = (x / EQUIRECT_WIDTH) * 2 * Math.PI - Math.PI;

      const cosLat = Math.cos(lat);
      const dx = -cosLat * Math.cos(lng);
      const dy = Math.sin(lat);
      const dz = -cosLat * Math.sin(lng);

      const { face, px, py } = directionToFaceUV(dx, dy, dz);

      if (!faces[face]) continue;
      const f = faces[face];
      const sample = bilinearSample(f.pixels, f.width, f.height, ch, px, py);

      const idx = (y * EQUIRECT_WIDTH + x) * ch;
      for (let c = 0; c < ch; c++) out[idx + c] = Math.round(sample[c]);
    }
  }

  return { pixels: out, width: EQUIRECT_WIDTH, height: EQUIRECT_HEIGHT, channels: ch };
}

function printUsage() {
  console.log(`
Usage:
  Mode 1 - Hybrid (4 side faces from equirect + separate top/bottom):
    node scripts/test-assemble-cubemap.mjs hybrid <equirect> <top-image> <bottom-image> [tag]

  Mode 2 - Full 6-face:
    node scripts/test-assemble-cubemap.mjs 6face <front> <back> <left> <right> <top> <bottom> [tag]
`);
  process.exit(1);
}

const mode = process.argv[2];
if (!mode) printUsage();

const OUTPUT_DIR = "public/test-assets/eval";
await mkdir(OUTPUT_DIR, { recursive: true });

if (mode === "hybrid") {
  const equirectPath = process.argv[3];
  const topPath = process.argv[4];
  const bottomPath = process.argv[5];
  const tag = process.argv[6] || "hybrid";

  if (!equirectPath || !topPath || !bottomPath) printUsage();

  console.log(`\nHybrid assembly: equirect=${equirectPath}, top=${topPath}, bottom=${bottomPath}`);

  const { data, info } = await sharp(equirectPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const eqW = info.width, eqH = info.height, ch = info.channels;
  const faceSize = Math.round(eqW / 4);
  console.log(`  Equirect: ${eqW}x${eqH}, face size: ${faceSize}`);

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

  const sideFaces = {};
  for (const faceName of ["front", "back", "left", "right"]) {
    const pos = FACE_POSITIONS[faceName];
    const facePixels = Buffer.alloc(faceSize * faceSize * ch);

    for (let fy = 0; fy < faceSize; fy++) {
      for (let fx = 0; fx < faceSize; fx++) {
        const u = (2 * (fx + 0.5)) / faceSize - 1;
        const v = -((2 * (fy + 0.5)) / faceSize - 1);
        const [dx, dy, dz] = faceUVToDirection(faceName, u, v);
        const [eu, ev] = dirToEquirect(dx, dy, dz);
        const sample = bilinearSample(data, eqW, eqH, ch, eu, ev);
        const idx = (fy * faceSize + fx) * ch;
        for (let c = 0; c < ch; c++) facePixels[idx + c] = Math.round(sample[c]);
      }
    }

    const facePath = `${OUTPUT_DIR}/${tag}-${faceName}.png`;
    await sharp(facePixels, { raw: { width: faceSize, height: faceSize, channels: ch } })
      .png()
      .toFile(facePath);
    sideFaces[faceName] = facePath;
    console.log(`  Extracted ${faceName}: ${facePath}`);
  }

  const facePaths = {
    ...sideFaces,
    top: topPath,
    bottom: bottomPath,
  };

  console.log("\n  Assembling cubemap cross...");
  const cross = await assembleCubemapCross(facePaths, faceSize);
  const crossPath = `${OUTPUT_DIR}/${tag}-cubemap-cross.png`;
  await sharp(cross.pixels, { raw: { width: cross.width, height: cross.height, channels: cross.channels } })
    .png()
    .toFile(crossPath);
  console.log(`  Cross: ${crossPath}`);

  console.log("  Converting cubemap to equirect...");
  const equirect = await cubemapCrossToEquirect(facePaths, faceSize);
  const equirectOutPath = `${OUTPUT_DIR}/${tag}-equirect.png`;
  await sharp(equirect.pixels, { raw: { width: equirect.width, height: equirect.height, channels: equirect.channels } })
    .png()
    .toFile(equirectOutPath);
  console.log(`  Equirect: ${equirectOutPath}`);

  console.log("\nDone! Files saved to " + OUTPUT_DIR);

} else if (mode === "6face") {
  const [frontP, backP, leftP, rightP, topP, bottomP] = process.argv.slice(3, 9);
  const tag = process.argv[9] || "6face";

  if (!frontP || !backP || !leftP || !rightP || !topP || !bottomP) printUsage();

  const meta = await sharp(frontP).metadata();
  const faceSize = meta.width || 1024;
  console.log(`\n6-face assembly (face size: ${faceSize})`);

  const facePaths = { front: frontP, back: backP, left: leftP, right: rightP, top: topP, bottom: bottomP };

  console.log("  Assembling cubemap cross...");
  const cross = await assembleCubemapCross(facePaths, faceSize);
  const crossPath = `${OUTPUT_DIR}/${tag}-cubemap-cross.png`;
  await sharp(cross.pixels, { raw: { width: cross.width, height: cross.height, channels: cross.channels } })
    .png()
    .toFile(crossPath);
  console.log(`  Cross: ${crossPath}`);

  console.log("  Converting cubemap to equirect...");
  const equirect = await cubemapCrossToEquirect(facePaths, faceSize);
  const equirectOutPath = `${OUTPUT_DIR}/${tag}-equirect.png`;
  await sharp(equirect.pixels, { raw: { width: equirect.width, height: equirect.height, channels: equirect.channels } })
    .png()
    .toFile(equirectOutPath);
  console.log(`  Equirect: ${equirectOutPath}`);

  console.log("\nDone! Files saved to " + OUTPUT_DIR);

} else {
  printUsage();
}
