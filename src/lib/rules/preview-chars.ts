export const PREVIEW_CHARS_MIN = 40;
export const PREVIEW_CHARS_MAX = 2000;
export const PREVIEW_CHARS_DEFAULT = 280;

export function clampPreviewChars(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return PREVIEW_CHARS_DEFAULT;
  return Math.min(PREVIEW_CHARS_MAX, Math.max(PREVIEW_CHARS_MIN, Math.round(parsed)));
}
