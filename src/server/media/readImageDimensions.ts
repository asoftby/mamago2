import sharp from "sharp";

export type ImageDimensions = { width: number; height: number };

function positiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * Reads display dimensions from the image header only (sharp `metadata()` does
 * not decode pixels). EXIF orientation is applied, so a portrait phone photo
 * stored as landscape + rotate tag reports portrait dimensions.
 *
 * Never throws: returns null for unreadable/non-image input.
 */
export async function readImageDimensions(input: Buffer | string): Promise<ImageDimensions | null> {
  try {
    const meta = await sharp(input, { failOn: "none" }).metadata();
    const width = positiveInt(meta.autoOrient?.width) ?? positiveInt(meta.width);
    const height = positiveInt(meta.autoOrient?.height) ?? positiveInt(meta.height);
    if (!width || !height) return null;
    return { width, height };
  } catch {
    return null;
  }
}
