/**
 * 图片引用体检 —— 跑在构建之前。
 *
 * 两个用途：
 *   pnpm images          检查所有「活的」图片引用是否都指向真实文件
 *   pnpm images:unused   反过来查：src/assets/images 里有哪些图片没人引用了
 *
 * 为什么需要前者：正文里一个活的图片链接指向不存在的文件时，Astro 会抛
 * `ImageNotFound` 然后整个构建失败，报错里只有一个相对路径，不说哪一篇。
 * 模板里的示例引用更隐蔽（复制模板就中招），所以我踩过两次。
 *
 * 为什么需要后者：彻底删掉一篇文章时，最容易漏的就是"只被那篇引用的图片"。
 * 它们会一直躺在仓库里，越攒越多。
 *
 * 规则：
 *   · 只看不在代码块里的 ![](...)
 *   · 跳过 http(s) 与以 / 开头的（前者走外链，后者走 public/）
 *   · 相对路径解析成真实文件
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTENT_ROOTS = ['src/content', 'scripts/templates'];
const ASSET_DIR = 'src/assets/images';
const UNUSED_MODE = process.argv.includes('--unused');

const problems = [];
const referenced = new Set();
let checked = 0;

async function walk(dir, onFile) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, onFile);
    else await onFile(full);
  }
}

async function scanMarkdown(file) {
  const lines = (await readFile(file, 'utf8')).split(/\r?\n/);
  let fence = false;
  for (const [i, raw] of lines.entries()) {
    const line = raw.trim();
    if (/^```/.test(line)) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    const m = /!\[[^\]]*\]\(([^)]+)\)/.exec(line);
    if (!m) continue;
    const ref = m[1].split(/\s+/)[0];
    if (/^https?:/.test(ref) || ref.startsWith('/')) continue;
    checked++;
    const target = path.resolve(path.dirname(file), ref);
    referenced.add(target.replace(/\\/g, '/'));
    if (!existsSync(target)) {
      problems.push(`${path.relative(ROOT, file)}:${i + 1}  →  ${ref}`);
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
  const assetsDir = path.join(ROOT, ASSET_DIR);
  if (!existsSync(assetsDir)) {
    console.log('没有 src/assets/images 目录。');
    process.exit(0);
  }
  const unused = [];
  let total = 0;
  await walk(assetsDir, async (file) => {
    total++;
    if (!referenced.has(file.replace(/\\/g, '/'))) {
      unused.push(path.relative(ROOT, file));
    }
  });
  if (unused.length === 0) {
    console.log(`✓ ${total} 张图片全部有引用，没有可清理的`);
    process.exit(0);
  }
  console.log(`${total} 张图片里有 ${unused.length} 张没有被任何正文引用：\n`);
  for (const u of unused) console.log('  ' + u);
  console.log('\n确认没用的话可以删掉（删之前先确认它们不是作品封面）。');
  process.exit(0);
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} 个图片引用指向不存在的文件（共检查 ${checked} 条）\n`);
  for (const p of problems) console.error('  ' + p);
  console.error('\n把示例链接放进代码块里，或者补上那张图。\n');
  process.exit(1);
}

console.log(`✓ 图片引用检查通过：${checked} 条相对引用都指向真实文件`);
