import { fal } from "@fal-ai/client";
import { writeFile, mkdir } from "fs/promises";

fal.config({ credentials: process.env.FAL_KEY });

const MODEL = "fal-ai/nano-banana-2";
const PROMPT =
  "Generate a seamless 360-degree equirectangular panoramic image. " +
  "The image must have a 2:1 aspect ratio with the full 360 horizontal field of view. " +
  "The left edge and right edge must connect seamlessly when wrapped into a sphere. " +
  "The top represents the zenith (straight up) and the bottom the nadir (straight down). " +
  "Avoid visible seams, distortion artifacts, or repeated patterns at the wrap boundary. " +
  "The scene: A retro-futuristic cityscape at sunset";

await mkdir("public/test-assets/fal-raw", { recursive: true });

const testCases = [
  { label: "21:9", aspect_ratio: "21:9" },
  { label: "auto", aspect_ratio: "auto" },
];

for (const tc of testCases) {
  console.log(`\n=== Testing aspect_ratio: "${tc.label}" ===`);
  console.log("Generating...");

  const result = await fal.subscribe(MODEL, {
    input: {
      prompt: PROMPT,
      aspect_ratio: tc.aspect_ratio,
      resolution: "4K",
      output_format: "png",
      limit_generations: true,
    },
    logs: true,
  });

  const img = result.data.images[0];
  console.log(`Raw output dimensions: ${img.width}x${img.height}`);
  console.log(`Aspect ratio: ${(img.width / img.height).toFixed(4)}`);
  console.log(`URL: ${img.url}`);
  console.log(`Description: ${result.data.description}`);

  const response = await fetch(img.url);
  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = `public/test-assets/fal-raw/raw-${tc.label.replace(/[:/]/g, "-")}.png`;
  await writeFile(filename, buffer);
  console.log(`Saved to ${filename}`);
}

console.log("\nDone! Check public/test-assets/fal-raw/ for raw outputs.");
