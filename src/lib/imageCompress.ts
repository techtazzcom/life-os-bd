const DEFAULT_MAX_SIZE = 300 * 1024; // 300KB for good quality

/**
 * Compress an image file maintaining quality as much as possible.
 * Uses canvas to resize and reduce quality iteratively.
 * @param file - The image file to compress
 * @param maxSize - Maximum size in bytes (default 300KB)
 */
export async function compressImage(file: File, maxSize: number = DEFAULT_MAX_SIZE): Promise<Blob> {
  // If already under limit, return as-is
  if (file.size <= maxSize) {
    return file;
  }

  const img = await createImageFromFile(file);
  
  // Start with original dimensions and high quality
  let quality = 0.92;
  let scale = 1;
  let blob: Blob | null = null;

  // Calculate optimal scale based on target size
  const sizeRatio = maxSize / file.size;
  if (sizeRatio < 0.5) {
    scale = Math.sqrt(sizeRatio) * 1.2; // Start with smaller dimensions
    scale = Math.max(scale, 0.3); // Don't go below 30%
  }

  // First try reducing quality at calculated scale
  for (quality = 0.92; quality >= 0.4; quality -= 0.08) {
    blob = await canvasToBlob(img, img.width * scale, img.height * scale, quality);
    if (blob.size <= maxSize) return blob;
  }

  // Progressively reduce scale
  for (scale = 0.8; scale >= 0.2; scale -= 0.1) {
    for (quality = 0.85; quality >= 0.3; quality -= 0.1) {
      blob = await canvasToBlob(img, img.width * scale, img.height * scale, quality);
      if (blob.size <= maxSize) return blob;
    }
  }

  // Last resort: small but still viewable
  blob = await canvasToBlob(img, Math.min(img.width * 0.15, 400), Math.min(img.height * 0.15, 400), 0.5);
  return blob!;
}

function createImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src); // Clean up
      resolve(img);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(img: HTMLImageElement, width: number, height: number, quality: number): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(Math.max(width, 100)); // Minimum 100px
    canvas.height = Math.round(Math.max(height, 100));
    const ctx = canvas.getContext("2d")!;
    // Use better image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => resolve(blob!),
      "image/jpeg",
      quality
    );
  });
}
