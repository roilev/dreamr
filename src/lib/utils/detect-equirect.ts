const ASPECT_RATIO = 2;
const ASPECT_TOLERANCE = 0.05;
const MIN_WIDTH = 1000;

export interface ImageDimensions {
  width: number;
  height: number;
}

export function isEquirectangularDimensions(
  width: number,
  height: number,
): boolean {
  if (width < MIN_WIDTH) return false;
  const ratio = width / height;
  return Math.abs(ratio - ASPECT_RATIO) <= ASPECT_TOLERANCE;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

export function getImageDimensions(file: File): Promise<ImageDimensions> {
  return loadImage(file).then((img) => ({
    width: img.naturalWidth,
    height: img.naturalHeight,
  }));
}

/**
 * Resizes an image to exact 2:1 equirectangular dimensions using canvas.
 * Keeps the original width and adjusts height to width/2.
 */
function normalizeToEquirect(img: HTMLImageElement): Promise<Blob> {
  const width = img.naturalWidth;
  const height = Math.round(width / ASPECT_RATIO);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      "image/png",
    );
  });
}

export interface EquirectDetectionResult {
  isEquirect: boolean;
  width: number;
  height: number;
  /** When equirect, a normalized 2:1 file ready for upload. */
  normalizedFile?: File;
}

export async function detectEquirectangular(
  file: File,
): Promise<EquirectDetectionResult> {
  const img = await loadImage(file);
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const isEquirect = isEquirectangularDimensions(width, height);

  if (!isEquirect) {
    return { isEquirect: false, width, height };
  }

  const exactHeight = Math.round(width / ASPECT_RATIO);
  if (height === exactHeight) {
    return { isEquirect: true, width, height };
  }

  const blob = await normalizeToEquirect(img);
  const normalizedFile = new File([blob], file.name, { type: "image/png" });
  return {
    isEquirect: true,
    width,
    height: exactHeight,
    normalizedFile,
  };
}
