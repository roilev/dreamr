import sharp from "sharp";

const WIDTH = 4096;
const HEIGHT = 2048;
const LINE_WIDTH = 2;
const GRID_SPACING_DEG = 15;

const buf = Buffer.alloc(WIDTH * HEIGHT * 4);

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const idx = (y * WIDTH + x) * 4;
  buf[idx] = r;
  buf[idx + 1] = g;
  buf[idx + 2] = b;
  buf[idx + 3] = a;
}

function lngToX(lng) { return ((lng + 180) / 360) * WIDTH; }
function latToY(lat) { return ((90 - lat) / 180) * HEIGHT; }

// Background: quadrant colors (NE, NW, SE, SW)
for (let y = 0; y < HEIGHT; y++) {
  const lat = 90 - (y / HEIGHT) * 180;
  for (let x = 0; x < WIDTH; x++) {
    const lng = (x / WIDTH) * 360 - 180;

    let r, g, b;
    if (lat >= 0 && lng >= 0) {
      // NE quadrant — warm red-orange
      r = 60; g = 30; b = 30;
    } else if (lat >= 0 && lng < 0) {
      // NW quadrant — cool blue
      r = 30; g = 30; b = 60;
    } else if (lat < 0 && lng >= 0) {
      // SE quadrant — green
      r = 30; g = 55; b = 30;
    } else {
      // SW quadrant — purple
      r = 50; g = 30; b = 55;
    }

    // Latitude-based gradient (brighter near equator, darker at poles)
    const latFactor = 0.5 + 0.5 * Math.cos((lat / 90) * Math.PI * 0.5);
    r = Math.round(r * (0.6 + 0.4 * latFactor));
    g = Math.round(g * (0.6 + 0.4 * latFactor));
    b = Math.round(b * (0.6 + 0.4 * latFactor));

    setPixel(x, y, r, g, b);
  }
}

// Longitude lines
for (let lng = -180; lng <= 180; lng += GRID_SPACING_DEG) {
  const cx = Math.round(lngToX(lng)) % WIDTH;
  const isPrime = lng % 90 === 0;
  const bright = isPrime ? 220 : 140;
  const thickness = isPrime ? LINE_WIDTH + 1 : LINE_WIDTH;

  for (let y = 0; y < HEIGHT; y++) {
    for (let dx = -Math.floor(thickness / 2); dx <= Math.floor(thickness / 2); dx++) {
      setPixel((cx + dx + WIDTH) % WIDTH, y, bright, bright, bright);
    }
  }
}

// Latitude lines
for (let lat = -90; lat <= 90; lat += GRID_SPACING_DEG) {
  const cy = Math.round(latToY(lat));
  const isPrime = lat % 90 === 0 || lat === 0;
  const bright = isPrime ? 220 : 140;
  const thickness = isPrime ? LINE_WIDTH + 1 : LINE_WIDTH;

  for (let x = 0; x < WIDTH; x++) {
    for (let dy = -Math.floor(thickness / 2); dy <= Math.floor(thickness / 2); dy++) {
      const py = cy + dy;
      if (py >= 0 && py < HEIGHT) {
        setPixel(x, py, bright, bright, bright);
      }
    }
  }
}

// Pole markers: bright circles at north (0, 90) and south (0, -90)
function fillCircle(cxDeg, cyDeg, radiusPx, r, g, b) {
  const cx = Math.round(lngToX(cxDeg));
  const cy = Math.round(latToY(cyDeg));
  for (let dy = -radiusPx; dy <= radiusPx; dy++) {
    for (let dx = -radiusPx; dx <= radiusPx; dx++) {
      if (dx * dx + dy * dy <= radiusPx * radiusPx) {
        setPixel((cx + dx + WIDTH) % WIDTH, cy + dy, r, g, b);
      }
    }
  }
}

// North pole marker (red)
fillCircle(0, 90, 20, 255, 60, 60);
// South pole marker (blue)
fillCircle(0, -90, 20, 60, 60, 255);
// Equator center marker (yellow)
fillCircle(0, 0, 12, 255, 255, 60);
// 180° wrap marker (cyan)
fillCircle(180, 0, 12, 60, 255, 255);
fillCircle(-180, 0, 12, 60, 255, 255);

// Degree labels every 30° (rendered as small colored blocks since we can't do text with raw pixels easily)
for (let lng = -150; lng <= 150; lng += 30) {
  if (lng === 0) continue;
  const cx = Math.round(lngToX(lng));
  const cy = Math.round(latToY(0));
  // Small square marker at equator intersections
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      setPixel((cx + dx + WIDTH) % WIDTH, cy + dy, 255, 200, 60);
    }
  }
}

const img = sharp(buf, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } });
await img.png().toFile("public/test-assets/equirect-grid.png");

console.log("Generated public/test-assets/equirect-grid.png (4096x2048)");

// Also generate a 21:9 version (simulating fal.ai output)
const h219 = Math.round(WIDTH * 9 / 21);
await sharp("public/test-assets/equirect-grid.png")
  .resize(WIDTH, h219, { fit: "cover", position: "centre" })
  .png()
  .toFile("public/test-assets/equirect-grid-21x9.png");
console.log(`Generated public/test-assets/equirect-grid-21x9.png (4096x${h219})`);

// Also generate a 1024x506 version (simulating Gemini upload)
await sharp("public/test-assets/equirect-grid.png")
  .resize(1024, 506, { fit: "fill" })
  .png()
  .toFile("public/test-assets/equirect-grid-1024x506.png");
console.log("Generated public/test-assets/equirect-grid-1024x506.png (1024x506)");
