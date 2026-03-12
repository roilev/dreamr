import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EQUIRECT_WIDTH = 4096;
const EQUIRECT_HEIGHT = 2048;
const ORIGINAL_ASPECT = 21 / 9;

const sceneShortId = process.argv[2];
if (!sceneShortId) {
  console.error("Usage: node scripts/reprocess-equirect.mjs <sceneShortId>");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const { data: scene } = await supabase
  .from("scenes")
  .select("id")
  .eq("short_id", sceneShortId)
  .single();

if (!scene) {
  console.error("Scene not found:", sceneShortId);
  process.exit(1);
}

console.log("Scene UUID:", scene.id);

const { data: asset } = await supabase
  .from("assets")
  .select("*")
  .eq("scene_id", scene.id)
  .eq("type", "equirect_image")
  .order("created_at", { ascending: false })
  .limit(1)
  .single();

if (!asset) {
  console.error("No equirect_image asset found for scene");
  process.exit(1);
}

console.log("Asset:", asset.id, "| Path:", asset.storage_path);
console.log("Current size:", asset.width, "x", asset.height);

const { data: fileData, error: dlError } = await supabase.storage
  .from("generated-assets")
  .download(asset.storage_path);

if (dlError || !fileData) {
  console.error("Download failed:", dlError?.message);
  process.exit(1);
}

const buffer = Buffer.from(await fileData.arrayBuffer());
const meta = await sharp(buffer).metadata();
console.log("Actual image size:", meta.width, "x", meta.height);

const srcRatio = meta.width / meta.height;
console.log("Aspect ratio:", srcRatio.toFixed(4), "(target: 2.0000)");

if (Math.abs(srcRatio - 2.0) > 0.01) {
  console.log("Image is NOT 2:1 — applying cover crop directly...");
  const reprocessed = await sharp(buffer)
    .resize(EQUIRECT_WIDTH, EQUIRECT_HEIGHT, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  await upload(reprocessed);
} else {
  console.log("Image IS 2:1 — reversing old 21:9 stretch, then cover-cropping...");

  const restoredHeight = Math.round(meta.width / ORIGINAL_ASPECT);
  console.log(`Restoring to ${meta.width}x${restoredHeight} (un-stretch)`);

  const restored = await sharp(buffer)
    .resize(meta.width, restoredHeight, { fit: "fill" })
    .toBuffer();

  const reprocessed = await sharp(restored)
    .resize(EQUIRECT_WIDTH, EQUIRECT_HEIGHT, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  await upload(reprocessed);
}

async function upload(reprocessed) {
  const { error: uploadError } = await supabase.storage
    .from("generated-assets")
    .upload(asset.storage_path, reprocessed, {
      upsert: true,
      contentType: "image/png",
    });

  if (uploadError) {
    console.error("Upload failed:", uploadError.message);
    process.exit(1);
  }

  const { data: urlData } = supabase.storage
    .from("generated-assets")
    .getPublicUrl(asset.storage_path);

  await supabase
    .from("assets")
    .update({
      width: EQUIRECT_WIDTH,
      height: EQUIRECT_HEIGHT,
      file_size_bytes: reprocessed.length,
      metadata: { source: "reprocessed", original_size: `${meta.width}x${meta.height}` },
    })
    .eq("id", asset.id);

  console.log("\nReprocessed successfully!");
  console.log("New size:", EQUIRECT_WIDTH, "x", EQUIRECT_HEIGHT);
  console.log("File size:", (reprocessed.length / 1024 / 1024).toFixed(1), "MB");
  console.log("URL:", urlData.publicUrl + "?t=" + Date.now());
  console.log("\nRefresh the scene page to see the updated image.");
}
