import sharp from "sharp";
import { mkdir } from "fs/promises";
import { basename, extname } from "path";

const PERSPECTIVE_SIZE = 2048;
const DEFAULT_FOV_DEG = 120;
const BLEND_MARGIN_DEG = 5;

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

function cameraToWorldUp(cx, cy, cz) {
  return [cx, -cz, cy];
}

function cameraToWorldDown(cx, cy, cz) {
  return [cx, cz, -cy];
}

function worldToCameraUp(wx, wy, wz) {
  return [wx, wz, -wy];
}

function worldToCameraDown(wx, wy, wz) {
  return [wx, -wz, wy];
}

async function extractPoleViews(inputPath, outputDir, tag, fovDeg) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const eqW = info.width, eqH = info.height, ch = info.channels;
  const ratio = eqW / eqH;
  const vfovDeg = 180 * (2 / ratio);
  const maxLatDeg = vfovDeg / 2;
  const maxLatRad = maxLatDeg * Math.PI / 180;

  console.log(`  Input: ${eqW}x${eqH} (ratio ${ratio.toFixed(3)})`);
  console.log(`  Vertical FOV: ${vfovDeg.toFixed(1)}° (content up to ±${maxLatDeg.toFixed(1)}°)`);
  console.log(`  Perspective FOV: ${fovDeg}°, output: ${PERSPECTIVE_SIZE}x${PERSPECTIVE_SIZE}`);

  const halfFov = Math.tan((fovDeg / 2) * Math.PI / 180);
  const size = PERSPECTIVE_SIZE;

  for (const direction of ["top", "bottom"]) {
    const out = Buffer.alloc(size * size * ch);
    const toWorld = direction === "top" ? cameraToWorldUp : cameraToWorldDown;

    let blackPixels = 0, totalPixels = size * size;

    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const ndx = (2 * (px + 0.5) / size - 1) * halfFov;
        const ndy = (1 - 2 * (py + 0.5) / size) * halfFov;
        const [wx, wy, wz] = toWorld(ndx, ndy, -1);

        const len = Math.sqrt(wx * wx + wy * wy + wz * wz);
        const lat = Math.asin(Math.max(-1, Math.min(1, wy / len)));
        const idx = (py * size + px) * ch;

        if (Math.abs(lat) <= maxLatRad) {
          const [eu, ev] = dirToEquirect(wx, wy, wz);
          const sample = bilinearSample(data, eqW, eqH, ch, eu, ev);
          for (let c = 0; c < ch; c++) out[idx + c] = Math.round(sample[c]);
        } else {
          out[idx] = 0;
          out[idx + 1] = 0;
          out[idx + 2] = 0;
          out[idx + 3] = 255;
          blackPixels++;
        }
      }
    }

    const blackPct = ((blackPixels / totalPixels) * 100).toFixed(1);
    console.log(`  ${direction}: ${blackPct}% black (missing pole data)`);

    const outPath = `${outputDir}/${tag}-pole-${direction}.png`;
    await sharp(out, { raw: { width: size, height: size, channels: ch } })
      .png()
      .toFile(outPath);
    console.log(`  Saved: ${outPath}`);
  }
}

async function reprojectPoleViews(equirectPath, topPath, bottomPath, outputDir, tag, fovDeg) {
  const TARGET_W = 4096, TARGET_H = 2048;

  const origMeta = await sharp(equirectPath).metadata();
  const origRatio = origMeta.width / origMeta.height;
  const vfovDeg = 180 * (2 / origRatio);
  const maxLatDeg = vfovDeg / 2;
  const maxLatRad = maxLatDeg * Math.PI / 180;
  const blendStartRad = (maxLatDeg - BLEND_MARGIN_DEG) * Math.PI / 180;

  console.log(`  Original: ${origMeta.width}x${origMeta.height} (ratio ${origRatio.toFixed(3)})`);
  console.log(`  Content latitude: ±${maxLatDeg.toFixed(1)}°, blend starts at ±${(maxLatDeg - BLEND_MARGIN_DEG).toFixed(1)}°`);

  const { data: eqData, info: eqInfo } = await sharp(equirectPath)
    .resize(TARGET_W, TARGET_H, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ch = eqInfo.channels;

  const topImg = topPath ? await sharp(topPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }) : null;
  const botImg = bottomPath ? await sharp(bottomPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }) : null;

  const halfFov = Math.tan((fovDeg / 2) * Math.PI / 180);
  const out = Buffer.from(eqData);

  for (let ey = 0; ey < TARGET_H; ey++) {
    const lat = Math.PI / 2 - (ey + 0.5) / TARGET_H * Math.PI;
    const absLat = Math.abs(lat);

    if (absLat < blendStartRad) continue;

    for (let ex = 0; ex < TARGET_W; ex++) {
      const lng = ((ex + 0.5) / TARGET_W) * 2 * Math.PI - Math.PI;
      const cosLat = Math.cos(lat);
      const wx = -cosLat * Math.cos(lng);
      const wy = Math.sin(lat);
      const wz = -cosLat * Math.sin(lng);

      const isTop = lat > 0;
      const perspImg = isTop ? topImg : botImg;
      if (!perspImg) continue;

      const toCamera = isTop ? worldToCameraUp : worldToCameraDown;
      const [camX, camY, camZ] = toCamera(wx, wy, wz);

      if (camZ >= 0) continue;
      const projX = camX / (-camZ) / halfFov;
      const projY = camY / (-camZ) / halfFov;

      if (Math.abs(projX) > 1 || Math.abs(projY) > 1) continue;

      const pu = (projX + 1) / 2;
      const pv = (1 - projY) / 2;

      const sample = bilinearSample(
        perspImg.data, perspImg.info.width, perspImg.info.height, ch, pu, pv
      );

      const eqIdx = (ey * TARGET_W + ex) * ch;

      let blend = 1.0;
      if (absLat < maxLatRad) {
        blend = (absLat - blendStartRad) / (maxLatRad - blendStartRad);
        blend = Math.max(0, Math.min(1, blend));
        blend = blend * blend * (3 - 2 * blend);
      }

      for (let c = 0; c < ch; c++) {
        out[eqIdx + c] = Math.round(
          eqData[eqIdx + c] * (1 - blend) + sample[c] * blend
        );
      }
    }
  }

  const outPath = `${outputDir}/${tag}-reprojected.png`;
  await sharp(out, { raw: { width: TARGET_W, height: TARGET_H, channels: ch } })
    .png()
    .toFile(outPath);
  console.log(`  Saved reprojected equirect: ${outPath}`);
  return outPath;
}

const args = process.argv.slice(2);
const mode = args[0];

const odIdx = args.indexOf("--output-dir");
const defaultOutputDir = "public/test-assets/pipeline/stage3-poles";
const outputDir = odIdx !== -1 ? args[odIdx + 1] : defaultOutputDir;

if (mode === "--extract") {
  const inputPath = args[1];
  if (!inputPath) { console.error("Usage: --extract <equirect> [--fov N] [--tag name] [--output-dir dir]"); process.exit(1); }

  const fovIdx = args.indexOf("--fov");
  const fovDeg = fovIdx !== -1 ? parseInt(args[fovIdx + 1]) : DEFAULT_FOV_DEG;
  const tagIdx = args.indexOf("--tag");
  const tag = tagIdx !== -1 ? args[tagIdx + 1] : basename(inputPath, extname(inputPath));

  await mkdir(outputDir, { recursive: true });
  console.log(`\nExtracting pole views: ${inputPath} (tag: ${tag})`);
  await extractPoleViews(inputPath, outputDir, tag, fovDeg);
  console.log("\nDone! Send the pole images to nano for inpainting.");

} else if (mode === "--reproject") {
  const equirectPath = args[1];
  const topIdx = args.indexOf("--top");
  const botIdx = args.indexOf("--bottom");
  const topPath = topIdx !== -1 ? args[topIdx + 1] : null;
  const bottomPath = botIdx !== -1 ? args[botIdx + 1] : null;

  if (!equirectPath || (!topPath && !bottomPath)) {
    console.error("Usage: --reproject <equirect> --top <top.png> --bottom <bottom.png> [--fov N] [--tag name] [--output-dir dir]");
    process.exit(1);
  }

  const fovIdx = args.indexOf("--fov");
  const fovDeg = fovIdx !== -1 ? parseInt(args[fovIdx + 1]) : DEFAULT_FOV_DEG;
  const tagIdx = args.indexOf("--tag");
  const tag = tagIdx !== -1 ? args[tagIdx + 1] : "tB";
  const evalDir = "public/test-assets/pipeline/eval";

  await mkdir(outputDir, { recursive: true });
  await mkdir(evalDir, { recursive: true });
  console.log(`\nReprojecting pole views onto: ${equirectPath} (tag: ${tag})`);
  const outPath = await reprojectPoleViews(equirectPath, topPath, bottomPath, outputDir, tag, fovDeg);

  console.log("\nRunning evaluation on reprojected result...");
  const { execSync } = await import("child_process");
  execSync(`node scripts/test-evaluate.mjs "${outPath}" "${tag}" --output-dir "${evalDir}"`, { stdio: "inherit" });

} else {
  console.error("Usage:");
  console.error("  node scripts/test-pole-perspective.mjs --extract <equirect> [--fov 120] [--tag name] [--output-dir dir]");
  console.error("  node scripts/test-pole-perspective.mjs --reproject <equirect> --top <top.png> --bottom <bottom.png> [--fov 120] [--tag name] [--output-dir dir]");
  process.exit(1);
}
