/**
 * image-encoder.ts
 *
 * Convert browser File → Anthropic image content block (base64 + media_type).
 *
 * Used by Wolfclaw Parser Mode 1 + Mode 2 to attach screenshot evidence
 * alongside raw promo text. Ephemeral only — not persisted.
 *
 * Constraints:
 * - Anthropic max ~5 MB per image. We compress > 1 MB via canvas to JPEG q=0.85,
 *   capped at 1920px on the longest side.
 * - Supported types: image/png, image/jpeg, image/webp, image/gif.
 *   HEIC / BMP / unknown → rejected at caller (UI side).
 */

import type { AIContentBlock } from "@/lib/ai-client";

const COMPRESS_THRESHOLD_BYTES = 1024 * 1024; // 1 MB
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.85;

const SUPPORTED_MEDIA_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

function dataURLToBase64(dataUrl: string): { mediaType: string; data: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("[image-encoder] Failed to parse data URL");
  }
  return { mediaType: match[1], data: match[2] };
}

async function compressIfNeeded(file: File): Promise<Blob> {
  if (file.size <= COMPRESS_THRESHOLD_BYTES) return file;

  const dataUrl = await readAsDataURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("[image-encoder] Image decode failed"));
    el.src = dataUrl;
  });

  const longest = Math.max(img.width, img.height);
  const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  return blob ?? file;
}

/**
 * Convert one File → AIContentBlock (image / base64).
 * Throws if the file's media type is unsupported.
 */
export async function fileToImageBlock(file: File): Promise<AIContentBlock> {
  const blob = await compressIfNeeded(file);
  const dataUrl = await readAsDataURL(blob);
  const { mediaType, data } = dataURLToBase64(dataUrl);

  // Anthropic supports png/jpeg/webp/gif. If the compressed blob is JPEG but
  // the original was something exotic, the parsed mediaType already reflects
  // the actual encoding.
  if (!SUPPORTED_MEDIA_TYPES.has(mediaType)) {
    throw new Error(
      `[image-encoder] Unsupported image type: ${mediaType}. Use PNG, JPEG, WebP, or GIF.`,
    );
  }

  return {
    type: "image",
    source: {
      type: "base64",
      media_type: mediaType,
      data,
    },
  };
}

/**
 * Convert array of Files → array of AIContentBlocks (image only).
 * Skips files that fail (logs a warning) instead of aborting the batch.
 */
export async function filesToImageBlocks(
  files: File[],
): Promise<AIContentBlock[]> {
  const blocks: AIContentBlock[] = [];
  for (const f of files) {
    try {
      blocks.push(await fileToImageBlock(f));
    } catch (err) {
      console.warn(
        `[image-encoder] Skipping "${f.name}":`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return blocks;
}
