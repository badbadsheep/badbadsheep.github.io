/**
 * CLI：重建中文字体子集。
 *
 * 用法：pnpm fonts
 * 何时需要：其实不用记得 —— `pnpm build` 会自动跑，`pnpm dev` 也会在你改完正文后
 *          自动重跑并刷新页面（见 astro.config.mjs 的 live-font-subset 插件）。
 * 手动跑的场景：只想检查一下现在有多少字、多大。
 */
import { buildSubset } from './lib/font-subset.mjs';

try {
  await buildSubset();
} catch (error) {
  console.warn('✗ 字体子集生成失败，界面会回落到系统字体（不影响构建）：');
  console.warn(String(error));
}
