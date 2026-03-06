export function getThumbnailUrl(
  publicUrl: string,
  width: number = 200,
  quality: number = 60,
): string {
  if (publicUrl.includes("supabase")) {
    const url = new URL(publicUrl);
    url.searchParams.set("width", String(width));
    url.searchParams.set("quality", String(quality));
    return url.toString();
  }
  return publicUrl;
}

export function getAdaptiveVideoUrl(
  videoUrl: string,
  _quality: "low" | "medium" | "high",
): string {
  return videoUrl;
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === 0) return "\u2014";
  const units = ["B", "KB", "MB", "GB"];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "\u2014";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`;
}

export function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
}

export async function supportsWebP(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0;
}
