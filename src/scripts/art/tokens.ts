/**
 * 给 shader 读参数用的小工具。
 *
 * 约定：颜色与尺寸一律从 CSS 令牌读，不在 JS 里写死 —— 这样换主题、
 * 调线宽、调指针推力都只改 tokens.css 一处。
 */

export type RGB = [number, number, number];

/** 读一个数值型令牌（"1.3px" → 1.3） */
export function readCssNumber(el: Element, name: string, fallback: number): number {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** 读墨色令牌：--art-ink: 255, 255, 255 → [1, 1, 1] */
export function readInkColor(el: Element): RGB {
  const raw = getComputedStyle(el).getPropertyValue('--art-ink').trim();
  const parts = raw.split(',').map((s) => Number.parseFloat(s));
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    return [parts[0] / 255, parts[1] / 255, parts[2] / 255];
  }
  return [1, 1, 1];
}
