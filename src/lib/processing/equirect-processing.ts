import sharp from "sharp";

const EQUIRECT_WIDTH = 4096;
const EQUIRECT_HEIGHT = 2048;

// --- Low-level pixel helpers ---

function bilinearSample(
  px: Uint8ClampedArray,
  w: number,
  h: number,
  sx: number,
  sy: number,
): [number, number, number, number] {
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const fx = sx - x0;
  const fy = sy - y0;

  const i00 = (y0 * w + x0) * 4;
  const i10 = (y0 * w + x1) * 4;
  const i01 = (y1 * w + x0) * 4;
  const i11 = (y1 * w + x1) * 4;

  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;

  return [
    Math.round(px[i00] * w00 + px[i10] * w10 + px[i01] * w01 + px[i11] * w11),
    Math.round(px[i00 + 1] * w00 + px[i10 + 1] * w10 + px[i01 + 1] * w01 + px[i11 + 1] * w11),
    Math.round(px[i00 + 2] * w00 + px[i10 + 2] * w10 + px[i01 + 2] * w01 + px[i11 + 2] * w11),
    Math.round(px[i00 + 3] * w00 + px[i10 + 3] * w10 + px[i01 + 3] * w01 + px[i11 + 3] * w11),
  ];
}

function dirToEquirect(
  x: number,
  y: number,
  z: number,
): [number, number] {
  const l = Math.sqrt(x * x + y * y + z * z);
  x /= l;
  y /= l;
  z /= l;
  return [
    (Math.atan2(-z, -x) + Math.PI) / (2 * Math.PI),
    (Math.PI / 2 - Math.asin(Math.max(-1, Math.min(1, y)))) / Math.PI,
  ];
}

function detectBlackRows(
  px: Uint8ClampedArray,
  w: number,
  h: number,
): { top: number; bot: number } {
  let top = 0;
  for (let y = 0; y < h; y++) {
    let black = true;
    for (let x = 0; x < w; x += 10) {
      const i = (y * w + x) * 4;
      if (px[i] > 5 || px[i + 1] > 5 || px[i + 2] > 5) {
        black = false;
        break;
      }
    }
    if (black) top++;
    else break;
  }
  let bot = 0;
  for (let y = h - 1; y >= 0; y--) {
    let black = true;
    for (let x = 0; x < w; x += 10) {
      const i = (y * w + x) * 4;
      if (px[i] > 5 || px[i + 1] > 5 || px[i + 2] > 5) {
        black = false;
        break;
      }
    }
    if (black) bot++;
    else break;
  }
  return { top, bot };
}

// --- Buffer <-> pixels conversion via sharp ---

async function bufferToPixels(buf: Buffer): Promise<{
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}> {
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    pixels: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    width: info.width,
    height: info.height,
  };
}

function pixelsToBuffer(
  px: Uint8ClampedArray,
  w: number,
  h: number,
): Promise<Buffer> {
  return sharp(Buffer.from(px.buffer, px.byteOffset, px.byteLength), {
    raw: { width: w, height: h, channels: 4 },
  })
    .png()
    .toBuffer();
}

// --- Processing functions (ported from workflows-spec.html) ---

/**
 * Shift image horizontally by `frac` (0..1 = fraction of width).
 * Optionally add a feathered transparent strip at the center seam.
 */
export function shiftImage(
  px: Uint8ClampedArray,
  w: number,
  h: number,
  frac: number,
  strip = false,
  stripPct = 10,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(px.length);
  const sh = Math.round(w * frac);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = ((x - sh) % w + w) % w;
      const si = (y * w + sx) * 4;
      const di = (y * w + x) * 4;
      out[di] = px[si];
      out[di + 1] = px[si + 1];
      out[di + 2] = px[si + 2];
      out[di + 3] = px[si + 3];
    }
  }

  if (strip) {
    const sw = Math.round(w * stripPct / 100);
    const cx = Math.floor(w / 2);
    const half = Math.floor(sw / 2);
    const fw = Math.round(half * 0.6);
    const th = half + fw;
    for (let y = 0; y < h; y++) {
      for (let x = cx - th; x <= cx + th; x++) {
        if (x < 0 || x >= w) continue;
        const d = Math.abs(x - cx);
        let t = d <= half ? 1 : 1 - (d - half) / fw;
        t = Math.max(0, Math.min(1, t));
        if (t <= 0) continue;
        const di = (y * w + x) * 4;
        for (let c = 0; c < 4; c++) {
          out[di + c] = Math.round(out[di + c] * (1 - t));
        }
      }
    }
  }

  return out;
}

/**
 * Crop a rectangular region from pixel data.
 */
export function cropRegion(
  px: Uint8ClampedArray,
  sw: number,
  _sh: number,
  cx: number,
  cy: number,
  cw: number,
  ch: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = ((cy + y) * sw + (cx + x)) * 4;
      const di = (y * cw + x) * 4;
      out[di] = px[si];
      out[di + 1] = px[si + 1];
      out[di + 2] = px[si + 2];
      out[di + 3] = px[si + 3];
    }
  }
  return out;
}

/**
 * Composite a patch onto a base image with horizontal feathering.
 */
export function compositeWithFeather(
  base: Uint8ClampedArray,
  bw: number,
  bh: number,
  patch: Uint8ClampedArray,
  pw: number,
  ph: number,
  ox: number,
  oy: number,
  stripPct: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(base);
  const sw = Math.round(bw * (stripPct || 10) / 100);
  const f = Math.round(sw * 0.6);
  const cx = Math.floor(pw / 2);
  const hs = Math.floor(sw / 2);
  const th = hs + f;

  for (let y = 0; y < ph; y++) {
    for (let x = cx - th; x <= cx + th; x++) {
      if (x < 0 || x >= pw) continue;
      const bx = ox + x;
      const by = oy + y;
      if (bx < 0 || bx >= bw || by < 0 || by >= bh) continue;
      const d = Math.abs(x - cx);
      let a = d <= hs ? 1 : 1 - (d - hs) / f;
      a = Math.max(0, Math.min(1, a));
      if (a <= 0) continue;
      const bi = (by * bw + bx) * 4;
      const pi = (y * pw + x) * 4;
      for (let c = 0; c < 4; c++) {
        out[bi + c] = Math.round(base[bi + c] * (1 - a) + patch[pi + c] * a);
      }
    }
  }
  return out;
}

/**
 * Render a perspective view from an equirect looking up or down (for pole capture).
 * Returns square pixel data of size `sz x sz`.
 */
export function renderPerspFromEquirect(
  eq: Uint8ClampedArray,
  ew: number,
  eh: number,
  dir: "up" | "down",
  fov: number,
  sz: number,
): Uint8ClampedArray {
  const th = Math.tan((fov * Math.PI) / 360);
  const out = new Uint8ClampedArray(sz * sz * 4);
  const { top: tB, bot: bB } = detectBlackRows(eq, ew, eh);

  for (let py = 0; py < sz; py++) {
    for (let px = 0; px < sz; px++) {
      const u = (2 * (px + 0.5) / sz - 1) * th;
      const v = (2 * (py + 0.5) / sz - 1) * th;
      const dx = u;
      const dy = dir === "up" ? 1 : -1;
      const dz = dir === "up" ? v : -v;
      const [eu, ev] = dirToEquirect(dx, dy, dz);
      const eqY = ev * (eh - 1);
      const oi = (py * sz + px) * 4;
      if ((dir === "up" && eqY < tB) || (dir === "down" && eqY > eh - 1 - bB)) {
        out[oi] = 0;
        out[oi + 1] = 0;
        out[oi + 2] = 0;
        out[oi + 3] = 0;
      } else {
        const s = bilinearSample(eq, ew, eh, eu * (ew - 1), ev * (eh - 1));
        out[oi] = s[0];
        out[oi + 1] = s[1];
        out[oi + 2] = s[2];
        out[oi + 3] = s[3];
      }
    }
  }
  return out;
}

/**
 * Reproject a filled perspective pole image back onto the equirect.
 */
export function reprojectPole(
  eq: Uint8ClampedArray,
  ew: number,
  eh: number,
  persp: Uint8ClampedArray,
  pSz: number,
  dir: "up" | "down",
  fov: number,
  feathDeg: number,
): Uint8ClampedArray {
  const th = Math.tan((fov * Math.PI) / 360);
  const fr = (feathDeg * Math.PI) / 180;
  const out = new Uint8ClampedArray(eq);
  const { top: tB } = detectBlackRows(eq, ew, eh);
  const poleLat = Math.PI / 2 - (tB / eh) * Math.PI;

  for (let ey = 0; ey < eh; ey++) {
    for (let ex = 0; ex < ew; ex++) {
      const lng = (ex / ew) * 2 * Math.PI - Math.PI;
      const lat = Math.PI / 2 - (ey / eh) * Math.PI;
      const al = Math.abs(lat);
      if (al < poleLat - fr) continue;

      const cL = Math.cos(lat);
      const dx = -cL * Math.cos(lng);
      const dy = Math.sin(lat);
      const dz = -cL * Math.sin(lng);
      let pu: number, pv: number;

      if (lat > 0 && dir === "up") {
        pu = dx / dy;
        pv = dz / dy;
      } else if (lat < 0 && dir === "down") {
        pu = dx / -dy;
        pv = -dz / -dy;
      } else {
        continue;
      }

      if (Math.abs(pu) > th || Math.abs(pv) > th) continue;

      const ppx = (pu / th + 1) / 2 * (pSz - 1);
      const ppy = (pv / th + 1) / 2 * (pSz - 1);
      if (ppx < 0 || ppx >= pSz || ppy < 0 || ppy >= pSz) continue;

      const s = bilinearSample(persp, pSz, pSz, ppx, ppy);
      let bl = 1;
      if (al < poleLat) {
        bl = (al - poleLat + fr) / fr;
        bl = Math.max(0, Math.min(1, bl));
        bl = bl * bl * (3 - 2 * bl); // smoothstep
      }
      const oi = (ey * ew + ex) * 4;
      for (let c = 0; c < 4; c++) {
        out[oi + c] = Math.round(eq[oi + c] * (1 - bl) + s[c] * bl);
      }
    }
  }
  return out;
}

/**
 * Wrap a panoramic strip (cylindrical projection) to equirectangular.
 * Used by the panorama workflow.
 */
export function wrapStripToEquirect(
  sp: Uint8ClampedArray,
  sw: number,
  sh: number,
  ew: number,
  eh: number,
  vDeg: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(ew * eh * 4);
  const hv = ((vDeg / 2) * Math.PI) / 180;
  const thv = Math.tan(hv);

  for (let ey = 0; ey < eh; ey++) {
    const lat = Math.PI / 2 - (ey / eh) * Math.PI;
    if (lat > hv || lat < -hv) continue;
    const sv = ((1 - Math.tan(lat) / thv) / 2) * (sh - 1);
    if (sv < 0 || sv >= sh) continue;
    for (let ex = 0; ex < ew; ex++) {
      const su = (ex / ew) * (sw - 1);
      const s = bilinearSample(sp, sw, sh, su, sv);
      const oi = (ey * ew + ex) * 4;
      out[oi] = s[0];
      out[oi + 1] = s[1];
      out[oi + 2] = s[2];
      out[oi + 3] = s[3];
    }
  }
  return out;
}

/**
 * Render a general perspective view from equirect at arbitrary yaw/pitch.
 * Used by panorama workflow for pole captures.
 */
export function renderPerspGeneral(
  eq: Uint8ClampedArray,
  ew: number,
  eh: number,
  yawD: number,
  pitchD: number,
  fovD: number,
  sz: number,
): Uint8ClampedArray {
  const th = Math.tan((fovD * Math.PI) / 360);
  const yaw = (yawD * Math.PI) / 180;
  const pitch = (pitchD * Math.PI) / 180;
  const out = new Uint8ClampedArray(sz * sz * 4);

  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);

  for (let py = 0; py < sz; py++) {
    for (let px = 0; px < sz; px++) {
      const u = (2 * (px + 0.5) / sz - 1) * th;
      const v = (2 * (py + 0.5) / sz - 1) * th;
      const dx = u;
      const dy2 = -v * cp - (-1) * sp;
      const dz2 = -v * sp + (-1) * cp;
      const dx3 = dx * cy + dz2 * sy;
      const dy3 = dy2;
      const dz3 = -dx * sy + dz2 * cy;
      const [eu, ev] = dirToEquirect(dx3, dy3, dz3);
      const s = bilinearSample(eq, ew, eh, eu * (ew - 1), ev * (eh - 1));
      const oi = (py * sz + px) * 4;
      out[oi] = s[0];
      out[oi + 1] = s[1];
      out[oi + 2] = s[2];
      out[oi + 3] = s[3];
    }
  }
  return out;
}

/**
 * Reproject a filled capture back onto an equirect image.
 * Used by panorama workflow for pole reprojection.
 */
export function reprojectCapture(
  out: Uint8ClampedArray,
  ew: number,
  eh: number,
  cap: Uint8ClampedArray,
  cS: number,
  yawD: number,
  pitchD: number,
  fovD: number,
): void {
  const fov = (fovD * Math.PI) / 180;
  const th = Math.tan(fov / 2);
  const yaw = (yawD * Math.PI) / 180;
  const pitch = (pitchD * Math.PI) / 180;

  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);

  for (let ey = 0; ey < eh; ey++) {
    for (let ex = 0; ex < ew; ex++) {
      const lng = (ex / ew) * 2 * Math.PI - Math.PI;
      const lat = Math.PI / 2 - (ey / eh) * Math.PI;
      const cL = Math.cos(lat);
      const wx = -cL * Math.cos(lng);
      const wy = Math.sin(lat);
      const wz = -cL * Math.sin(lng);

      const rx = wx * cy - wz * sy;
      const ry = wy;
      const rz = wx * sy + wz * cy;

      const cx2 = rx;
      const cy2 = ry * cp + rz * sp;
      const cz2 = -ry * sp + rz * cp;

      if (cz2 >= 0) continue;

      const pu = cx2 / -cz2;
      const pv = -cy2 / -cz2;
      if (Math.abs(pu) > th || Math.abs(pv) > th) continue;

      const ppx = (pu / th + 1) / 2 * (cS - 1);
      const ppy = (pv / th + 1) / 2 * (cS - 1);
      if (ppx < 0 || ppx >= cS || ppy < 0 || ppy >= cS) continue;

      const s = bilinearSample(cap, cS, cS, ppx, ppy);
      const edge = Math.min(ppx, ppy, cS - 1 - ppx, cS - 1 - ppy) / (cS * 0.1);
      const bl = Math.min(1, edge);
      const oi = (ey * ew + ex) * 4;
      for (let c = 0; c < 4; c++) {
        out[oi + c] = Math.round(out[oi + c] * (1 - bl) + s[c] * bl);
      }
    }
  }
}

// --- High-level pipeline operations (Buffer in/out) ---

export interface SeamFixResult {
  seamCropBuffer: Buffer;
  seamCropWidth: number;
  seamCropHeight: number;
  shiftedPixels: Uint8ClampedArray;
  sourceWidth: number;
  sourceHeight: number;
}

/**
 * Step 2a: Prepare the seam fix input.
 * Shifts the image by 50%, adds a feathered transparent strip,
 * and crops a 4:3 region centered on the seam.
 */
export async function prepareSeamCrop(
  imageBuffer: Buffer,
  stripWidthPct: number,
): Promise<SeamFixResult> {
  const { pixels, width, height } = await bufferToPixels(imageBuffer);
  const shifted = shiftImage(pixels, width, height, 0.5, true, stripWidthPct);
  const cropH = height;
  const cropW = Math.round(cropH * 4 / 3);
  const x0 = Math.floor((width - cropW) / 2);
  const cropped = cropRegion(shifted, width, height, x0, 0, cropW, cropH);
  const cropBuffer = await pixelsToBuffer(cropped, cropW, cropH);

  return {
    seamCropBuffer: cropBuffer,
    seamCropWidth: cropW,
    seamCropHeight: cropH,
    shiftedPixels: shiftImage(pixels, width, height, 0.5),
    sourceWidth: width,
    sourceHeight: height,
  };
}

/**
 * Step 2b: Apply the inpainted seam patch back onto the shifted image and unshift.
 */
export async function applySeamFix(
  shiftedPixels: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  inpaintedBuffer: Buffer,
  stripWidthPct: number,
): Promise<Buffer> {
  const { pixels: patchPx, width: pw, height: ph } = await bufferToPixels(inpaintedBuffer);

  const cropH = sourceHeight;
  const cropW = Math.round(cropH * 4 / 3);

  let scaledPx: Uint8ClampedArray;
  let scaledW = pw;
  let scaledH = ph;
  if (pw !== cropW || ph !== cropH) {
    const scaledBuf = await sharp(inpaintedBuffer)
      .resize(cropW, cropH, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer();
    scaledPx = new Uint8ClampedArray(scaledBuf.buffer, scaledBuf.byteOffset, scaledBuf.byteLength);
    scaledW = cropW;
    scaledH = cropH;
  } else {
    scaledPx = patchPx;
  }

  const x0 = Math.floor((sourceWidth - scaledW) / 2);
  const composited = compositeWithFeather(
    shiftedPixels, sourceWidth, sourceHeight,
    scaledPx, scaledW, scaledH,
    x0, 0, stripWidthPct,
  );
  const unshifted = shiftImage(composited, sourceWidth, sourceHeight, -0.5);
  return pixelsToBuffer(unshifted, sourceWidth, sourceHeight);
}

/**
 * Step 3a (equirect): Letterbox to 2:1 and render perspective pole views.
 */
export async function letterboxAndRenderPoles(
  imageBuffer: Buffer,
  poleFov: number,
): Promise<{
  letterboxedBuffer: Buffer;
  poleTopBuffer: Buffer;
  poleBottomBuffer: Buffer;
  eqWidth: number;
  eqHeight: number;
}> {
  const meta = await sharp(imageBuffer).metadata();
  const w = meta.width!;
  const h = meta.height!;
  const tH = Math.round(w / 2);
  const pad = Math.round((tH - h) / 2);

  const letterboxedBuf = await sharp(imageBuffer)
    .extend({
      top: Math.max(0, pad),
      bottom: Math.max(0, tH - h - pad),
      background: { r: 0, g: 0, b: 0, alpha: 255 },
    })
    .resize(w, tH, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer();

  const letterboxedPx = new Uint8ClampedArray(
    letterboxedBuf.buffer, letterboxedBuf.byteOffset, letterboxedBuf.byteLength,
  );
  const letterboxedPng = await pixelsToBuffer(letterboxedPx, w, tH);

  const sz = Math.min(4096, w);
  const topPx = renderPerspFromEquirect(letterboxedPx, w, tH, "up", poleFov, sz);
  const botPx = renderPerspFromEquirect(letterboxedPx, w, tH, "down", poleFov, sz);

  return {
    letterboxedBuffer: letterboxedPng,
    poleTopBuffer: await pixelsToBuffer(topPx, sz, sz),
    poleBottomBuffer: await pixelsToBuffer(botPx, sz, sz),
    eqWidth: w,
    eqHeight: tH,
  };
}

/**
 * Step 4 (equirect): Reproject filled poles back onto the letterboxed equirect.
 */
export async function reprojectFilledPoles(
  letterboxedBuffer: Buffer,
  filledTopBuffer: Buffer,
  filledBottomBuffer: Buffer,
  poleFov: number,
  featherDeg: number,
): Promise<Buffer> {
  const { pixels: eqPx, width: ew, height: eh } = await bufferToPixels(letterboxedBuffer);
  const { pixels: topPx, width: topSz } = await bufferToPixels(filledTopBuffer);
  const { pixels: botPx, width: botSz } = await bufferToPixels(filledBottomBuffer);

  let result = reprojectPole(eqPx, ew, eh, topPx, topSz, "up", poleFov, featherDeg);
  result = reprojectPole(result, ew, eh, botPx, botSz, "down", poleFov, featherDeg);

  return sharp(
    Buffer.from(result.buffer, result.byteOffset, result.byteLength),
    { raw: { width: ew, height: eh, channels: 4 } },
  )
    .resize(EQUIRECT_WIDTH, EQUIRECT_HEIGHT, { fit: "fill" })
    .png()
    .toBuffer();
}

/**
 * Step 3a (panorama): Wrap strip to equirect and render perspective captures.
 */
export async function wrapAndRenderCaptures(
  stripBuffer: Buffer,
  vertCoverage: number,
  captureFov: number,
  captureYaw: number,
): Promise<{
  wrappedBuffer: Buffer;
  captureTopBuffer: Buffer;
  captureBottomBuffer: Buffer;
  eqWidth: number;
  eqHeight: number;
}> {
  const { pixels: stripPx, width: sw, height: sh } = await bufferToPixels(stripBuffer);
  const eqW = sw;
  const eqH = Math.round(sw / 2);

  const wrappedPx = wrapStripToEquirect(stripPx, sw, sh, eqW, eqH, vertCoverage);
  const wrappedBuf = await pixelsToBuffer(wrappedPx, eqW, eqH);

  const sz = Math.min(4096, eqW);
  const topPx = renderPerspGeneral(wrappedPx, eqW, eqH, captureYaw, 90, captureFov, sz);
  const botPx = renderPerspGeneral(wrappedPx, eqW, eqH, captureYaw, -90, captureFov, sz);

  return {
    wrappedBuffer: wrappedBuf,
    captureTopBuffer: await pixelsToBuffer(topPx, sz, sz),
    captureBottomBuffer: await pixelsToBuffer(botPx, sz, sz),
    eqWidth: eqW,
    eqHeight: eqH,
  };
}

/**
 * Step 4 (panorama): Reproject filled captures back onto the wrapped equirect.
 */
export async function reprojectFilledCaptures(
  wrappedBuffer: Buffer,
  filledTopBuffer: Buffer,
  filledBottomBuffer: Buffer,
  captureFov: number,
  captureYaw: number,
): Promise<Buffer> {
  const { pixels: eqPx, width: ew, height: eh } = await bufferToPixels(wrappedBuffer);
  const { pixels: topPx, width: topSz } = await bufferToPixels(filledTopBuffer);
  const { pixels: botPx, width: botSz } = await bufferToPixels(filledBottomBuffer);

  const out = new Uint8ClampedArray(eqPx);
  reprojectCapture(out, ew, eh, topPx, topSz, captureYaw, 90, captureFov);
  reprojectCapture(out, ew, eh, botPx, botSz, captureYaw, -90, captureFov);

  return sharp(
    Buffer.from(out.buffer, out.byteOffset, out.byteLength),
    { raw: { width: ew, height: eh, channels: 4 } },
  )
    .resize(EQUIRECT_WIDTH, EQUIRECT_HEIGHT, { fit: "fill" })
    .png()
    .toBuffer();
}

/**
 * Letterbox a non-2:1 image to 2:1 by adding black bars.
 */
export async function letterboxTo2x1(imageBuffer: Buffer): Promise<Buffer> {
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

/**
 * Resize any image to exactly 4096x2048 (equirect standard).
 */
export async function resizeToEquirect(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(EQUIRECT_WIDTH, EQUIRECT_HEIGHT, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
}
