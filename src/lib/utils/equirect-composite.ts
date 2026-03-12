import sharp from "sharp";

interface PositionedInput {
  imageBuffer: Buffer;
  longitude: number;
  latitude: number;
  angularSize: number;
}

const EQUIRECT_WIDTH = 4096;
const EQUIRECT_HEIGHT = 2048;
const DEFAULT_ANGULAR_SIZE = 90;

interface PreparedImage {
  pixels: Buffer;
  width: number;
  height: number;
  halfAngH: number;
  halfAngV: number;
  rotMatrix: number[];
}

/**
 * Convert (longitude, latitude) to a unit direction vector using the same
 * convention as THREE.js SphereGeometry UV mapping. This matches
 * `sphericalToCartesian` in input-canvas-view.tsx.
 */
function lngLatToDir(lngDeg: number, latDeg: number): [number, number, number] {
  const phi = (90 - latDeg) * (Math.PI / 180);
  const theta = (lngDeg + 180) * (Math.PI / 180);
  return [
    -Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  ];
}

/**
 * Build a 3x3 rotation matrix that transforms world directions into the
 * image's local coordinate frame where the image center maps to (0, 0, -1).
 *
 * Local axes: X = right, Y = up, -Z = forward (toward image center).
 */
function buildInverseRotation(lngDeg: number, latDeg: number): number[] {
  const phi = (90 - latDeg) * (Math.PI / 180);
  const theta = (lngDeg + 180) * (Math.PI / 180);

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const sinTheta = Math.sin(theta);
  const cosTheta = Math.cos(theta);

  // Right: negative tangent along increasing longitude (points right from viewer)
  const rx = -sinTheta;
  const ry = 0;
  const rz = -cosTheta;

  // Up: perpendicular to forward and right, pointing upward on sphere surface
  const ux = cosPhi * cosTheta;
  const uy = sinPhi;
  const uz = -cosPhi * sinTheta;

  // -Forward: negated center direction
  const nfx = sinPhi * cosTheta;
  const nfy = -cosPhi;
  const nfz = -sinPhi * sinTheta;

  return [
    rx, ry, rz,
    ux, uy, uz,
    nfx, nfy, nfz,
  ];
}

function applyMatrix(m: number[], x: number, y: number, z: number): [number, number, number] {
  return [
    m[0] * x + m[1] * y + m[2] * z,
    m[3] * x + m[4] * y + m[5] * z,
    m[6] * x + m[7] * y + m[8] * z,
  ];
}

function bilinearSample(
  pixels: Buffer,
  w: number,
  h: number,
  u: number,
  v: number,
): [number, number, number, number] {
  const px = u * (w - 1);
  const py = v * (h - 1);
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const fx = px - x0;
  const fy = py - y0;

  const i00 = (y0 * w + x0) * 4;
  const i10 = (y0 * w + x1) * 4;
  const i01 = (y1 * w + x0) * 4;
  const i11 = (y1 * w + x1) * 4;

  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;

  return [
    pixels[i00] * w00 + pixels[i10] * w10 + pixels[i01] * w01 + pixels[i11] * w11,
    pixels[i00 + 1] * w00 + pixels[i10 + 1] * w10 + pixels[i01 + 1] * w01 + pixels[i11 + 1] * w11,
    pixels[i00 + 2] * w00 + pixels[i10 + 2] * w10 + pixels[i01 + 2] * w01 + pixels[i11 + 2] * w11,
    pixels[i00 + 3] * w00 + pixels[i10 + 3] * w10 + pixels[i01 + 3] * w01 + pixels[i11 + 3] * w11,
  ];
}

async function prepareImage(input: PositionedInput): Promise<PreparedImage> {
  const angularSize = input.angularSize > 0 ? input.angularSize : DEFAULT_ANGULAR_SIZE;
  const { data, info } = await sharp(input.imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const aspect = info.width / info.height;
  const halfAngH = (angularSize / 2) * (Math.PI / 180);
  const halfAngV = halfAngH / aspect;

  return {
    pixels: data,
    width: info.width,
    height: info.height,
    halfAngH,
    halfAngV,
    rotMatrix: buildInverseRotation(input.longitude, input.latitude),
  };
}

export async function compositeEquirect(inputs: PositionedInput[]): Promise<Buffer> {
  if (inputs.length === 0) {
    throw new Error("No inputs to composite");
  }

  const prepared = await Promise.all(inputs.map(prepareImage));

  const out = Buffer.alloc(EQUIRECT_WIDTH * EQUIRECT_HEIGHT * 4);
  for (let i = 0; i < EQUIRECT_WIDTH * EQUIRECT_HEIGHT; i++) {
    const off = i * 4;
    out[off] = 26;
    out[off + 1] = 26;
    out[off + 2] = 38;
    out[off + 3] = 255;
  }

  for (let y = 0; y < EQUIRECT_HEIGHT; y++) {
    const latDeg = 90 - (y / EQUIRECT_HEIGHT) * 180;
    for (let x = 0; x < EQUIRECT_WIDTH; x++) {
      const lngDeg = (x / EQUIRECT_WIDTH) * 360 - 180;

      const dir = lngLatToDir(lngDeg, latDeg);

      for (let p = prepared.length - 1; p >= 0; p--) {
        const img = prepared[p];
        const [lx, ly, lz] = applyMatrix(img.rotMatrix, dir[0], dir[1], dir[2]);

        if (lz >= 0) continue;

        const projX = lx / -lz;
        const projY = ly / -lz;

        const tanHalfH = Math.tan(img.halfAngH);
        const tanHalfV = Math.tan(img.halfAngV);

        if (Math.abs(projX) > tanHalfH || Math.abs(projY) > tanHalfV) continue;

        const u = (projX / tanHalfH + 1) * 0.5;
        const v = 1 - (projY / tanHalfV + 1) * 0.5;

        if (u < 0 || u > 1 || v < 0 || v > 1) continue;

        const [r, g, b, a] = bilinearSample(img.pixels, img.width, img.height, u, v);
        const alpha = a / 255;

        if (alpha < 0.01) continue;

        const outIdx = (y * EQUIRECT_WIDTH + x) * 4;
        out[outIdx] = Math.round(r * alpha + out[outIdx] * (1 - alpha));
        out[outIdx + 1] = Math.round(g * alpha + out[outIdx + 1] * (1 - alpha));
        out[outIdx + 2] = Math.round(b * alpha + out[outIdx + 2] * (1 - alpha));
        out[outIdx + 3] = 255;
        break;
      }
    }
  }

  return sharp(out, {
    raw: { width: EQUIRECT_WIDTH, height: EQUIRECT_HEIGHT, channels: 4 },
  })
    .png()
    .toBuffer();
}

/**
 * Letterbox a non-2:1 image to exactly 2:1 by adding black bars at top/bottom.
 * Used in the double-pass strategy: the horizon content is preserved and the
 * black pole regions are later inpainted by the AI edit endpoint.
 */
export async function letterboxToEquirect(imageBuffer: Buffer): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata();
  const srcW = meta.width ?? EQUIRECT_WIDTH;
  const srcH = meta.height ?? EQUIRECT_HEIGHT;
  const targetH = Math.round(srcW / 2);

  if (srcH >= targetH) {
    return sharp(imageBuffer)
      .resize(EQUIRECT_WIDTH, EQUIRECT_HEIGHT, { fit: "fill" })
      .png()
      .toBuffer();
  }

  const scaledW = EQUIRECT_WIDTH;
  const scaledH = Math.round((srcH / srcW) * EQUIRECT_WIDTH);
  const topPad = Math.round((EQUIRECT_HEIGHT - scaledH) / 2);

  return sharp(imageBuffer)
    .resize(scaledW, scaledH, { fit: "fill" })
    .extend({
      top: topPad,
      bottom: EQUIRECT_HEIGHT - scaledH - topPad,
      background: { r: 0, g: 0, b: 0, alpha: 255 },
    })
    .png()
    .toBuffer();
}

export async function resizeToEquirect(imageBuffer: Buffer): Promise<Buffer> {
  const meta = await sharp(imageBuffer).metadata();
  const srcW = meta.width ?? EQUIRECT_WIDTH;
  const srcH = meta.height ?? EQUIRECT_HEIGHT;
  const srcRatio = srcW / srcH;
  const targetRatio = EQUIRECT_WIDTH / EQUIRECT_HEIGHT;

  if (Math.abs(srcRatio - targetRatio) < 0.01) {
    return sharp(imageBuffer)
      .resize(EQUIRECT_WIDTH, EQUIRECT_HEIGHT, { fit: "fill" })
      .png()
      .toBuffer();
  }

  // Source is wider than 2:1 (e.g. 21:9 from fal.ai): scale to match height,
  // then center-crop the width to preserve vertical proportions at the poles.
  return sharp(imageBuffer)
    .resize(EQUIRECT_WIDTH, EQUIRECT_HEIGHT, {
      fit: "cover",
      position: "centre",
    })
    .png()
    .toBuffer();
}
