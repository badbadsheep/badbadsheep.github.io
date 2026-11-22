/**
 * 图片引用体检 —— 跑在构建之前。
 *
 * 两个用途：
 *   pnpm images          检查所有「活的」图片引用是否都指向真实文件
 *   pnpm images:unused   反过来查：哪些图片没有任何正文在引用
 *
 * 为什么需要前者：正文里一个活的图片链接指向不存在的文件时，Astro 会抛
 * `ImageNotFound` 然后整个构建失败，报错里只有一个相对路径，不说哪一篇。
 * 模板里的示例引用更隐蔽（复制模板就中招），所以我踩过两次。
 *
 * 为什么需要后者：删文章 / 换图时最容易漏的就是"只被那篇引用的图片"。
 * 现在图片跟着文章放在同一个文件夹里，删文章时整个文件夹一起走，但单独换图
 * 仍会留下孤儿。它们会一直躺在仓库里，越攒越多。
 *
 * 规则：
 *   · 只看不在代码块里的 ![](...)
 *   · 跳过 http(s) 与以 / 开头的（前者走外链，后者走 public/）
 *   · 相对路径解析成真实文件（先 URL 解码：粘贴图片插件会把空格写成 %20）
 *
 * 图片现在的两个去处：
 *   · src/content/<栏目>/<文章>/xxx.png   ← 主流，和 md 同级
 *   · src/assets/images/xxx.png           ← 历史遗留 / 跨文章共用
 * 两种情况都算「在仓库里」，unused 检查统一按绝对路径比对。
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTENT_ROOTS = ['src/content', 'scripts/templates'];
const IMAGE_ROOTS = ['src/content', 'src/assets/images'];
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg']);
const UNUSED_MODE = process.argv.includes('--unused');

const problems = [];
const referenced = new Set();
let checked = 0;

const toPosix = (p) => p.replace(/\\/g, '/');
const isImage = (file) => IMAGE_EXT.has(path.extname(file).toLowerCase());
const isFence = (line) => /^\s*(`{3,}|~{3,})/.test(line);

async function walk(dir, onFile) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, onFile);
    else await onFile(full);
  }
}

/** 一行里可能有多张图（飞书那种「文字 ![](a.png) 文字 ![](b.png)」），全都要看到 */
async function scanMarkdown(file) {
  const lines = (await readFile(file, 'utf8')).split(/\r?\n/);
  let fence = false;
  for (const [i, raw] of lines.entries()) {
    if (isFence(raw)) {
      fence = !fence;
      continue;
    }
    if (fence) continue;

    for (const m of raw.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
      // 路径里有空格时会被编码成 %20，先解回真实文件名
      let ref = m[1].split(/\s+/)[0];
      try {
        ref = decodeURIComponent(ref);
      } catch {
        /* 解不开就按原样查，下面的 existsSync 会给结论 */
      }
      if (/^https?:/i.test(ref) || ref.startsWith('/')) continue;

      checked++;
      const target = path.resolve(path.dirname(file), ref);
      referenced.add(toPosix(target));
      if (!existsSync(target)) {
        problems.push(`${path.relative(ROOT, file)}:${i + 1}  →  ${ref}`);
      }
    }
  }
}

for (const root of CONTENT_ROOTS) {
  const abs = path.join(ROOT, root);
  if (!existsSync(abs)) continue;
  await walk(abs, async (file) => {
    if (file.endsWith('.md')) await scanMarkdown(file);
  });
}

if (UNUSED_MODE) {
  const images = [];
  for (const root of IMAGE_ROOTS) {
    const abs = path.join(ROOT, root);
    if (!existsSync(abs)) continue;
    await walk(abs, async (file) => {
      if (isImage(file)) images.push(file);
    });
  }

  const unused = images.filter((file) => !referenced.has(toPosix(file)));
  if (unused.length === 0) {
    console.log(`✓ ${images.length} 张图片全部有引用，没有可清理的`);
    process.exit(0);
  }

  // 按所在文件夹分组：同组的孤儿图通常是一起产生的，删起来能连锁判断
  const groups = new Map();
  for (const file of unused) {
    const dir = path.dirname(file);
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir).push(path.basename(file));
  }

  console.log(`${images.length} 张图片里有 ${unused.length} 张没有被任何正文引用：\n`);
  for (const [dir, names] of groups) {
    console.log(`  ${path.relative(ROOT, dir)}/`);
    for (const n of names) console.log(`    ${n}`);
  }
  console.log('\n确认没用的话可以删掉（删之前先确认它们不是作品封面或组件里的图）。');
  process.exit(0);
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} 个图片引用指向不存在的文件（共检查 ${checked} 条）\n`);
  for (const p of problems) console.error('  ' + p);
  console.error('\n把示例链接放进代码块里，或者补上那张图。\n');
  process.exit(1);
}

console.log(`✓ 图片引用检查通过：${checked} 条相对引用都指向真实文件`);
