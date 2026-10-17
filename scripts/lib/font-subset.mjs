/**
 * 字体子集化（可复用的核心，不是 CLI）。
 *
 * 被两处调用：
 *   · scripts/subset-fonts.mjs  —— 构建前 / 手动 pnpm fonts
 *   · astro.config.mjs 的 dev 插件 —— 改完正文自动重建并刷新页面
 *
 * 为什么必须能"再跑一次"：子集是按当前源码里的字切出来的。
 * 你新写一篇中文标题，那些字一开始不在子集里，会回落到宋体 ——
 * 表现就是一个标题里两种字体。所以 dev 里必须自动重建，
 * 否则每次都要记得手动 pnpm fonts。
 */
import { readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import subsetFont from 'subset-font';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SRC = path.join(ROOT, 'scripts/fonts-src/SmileySans-Oblique.otf');
const OUT_DIR = path.join(ROOT, 'public/fonts');
const OUT = path.join(OUT_DIR, 'smiley-sans-subset.woff2');

/** 兜底字：只在源码扫描漏掉时起作用，别往这里堆没用的字（每个汉字约 150 字节） */
const EXTRA = '未来这里将繁花满地博客笔记故事影像绘画视频交互项目目录评论更多文章全部搜索归档关于致谢';

const EXTS = new Set(['.astro', '.md', '.ts', '.tsx', '.js', '.mjs', '.css', '.json']);

/** 去掉注释再收字：这个仓库的注释写得比代码多，注释里的汉字等于白背体积 */
function stripComments(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:\w])\/\/[^\n]*/g, '$1');
}

async function walk(dir, out) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (EXTS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

/**
 * 只收「会被得意黑渲染」的字：
 *   · .astro / .ts / .css / .json —— 界面文案（栏目名、闸门词、空态句子）
 *   · .md —— 只收 front matter 的 title 和各级标题；正文走系统字体，不收
 */
export async function collectChars() {
  const files = await walk(path.join(ROOT, 'src'), []);
  const chars = new Set([...EXTRA]);

  for (const file of files) {
    const raw = await readFile(file, 'utf8');
    let source = stripComments(raw);

    if (file.endsWith('.md')) {
      const picked = [];
      let inFront = false;
      let frontDone = false;
      for (const line of source.split(/\r?\n/)) {
        if (line.trim() === '---') {
          if (!frontDone) {
            inFront = !inFront;
            if (!inFront) frontDone = true;
          }
          continue;
        }
        if (inFront) {
          if (/^\s*title\s*:/.test(line)) picked.push(line.replace(/^\s*title\s*:/, ''));
          continue;
        }
        if (/^#{1,6}\s/.test(line)) picked.push(line);
      }
      source = picked.join('\n');
    }

    for (const ch of source) {
      if (/[\u3000-\u9FFF\uFF00-\uFFEF]/.test(ch)) chars.add(ch);
    }
  }

  // ASCII 里会被展示字体渲染的部分也带上，省得中英混排时跳字体
  for (const ch of '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,:;!?()[]{}<>/\\|-–—_+=*&%#@~^`"\'') {
    chars.add(ch);
  }

  return chars;
}

/**
 * 重建子集。返回 { changed, charCount, kb }。
 * changed=false 表示这次的字集和上次一样，调用方可以据此决定要不要刷新页面。
 */
export async function buildSubset({ quiet = false } = {}) {
  const chars = await collectChars();
  const text = [...chars].sort().join('');

  const before = await stat(OUT).catch(() => null);

  const source = await readFile(SRC);
  const subset = await subsetFont(source, text, { targetFormat: 'woff2' });
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT, subset);

  const kb = (subset.length / 1024).toFixed(1);
  // 体积+字符数都没变就当没变（subset 字节可能是确定性的）
  const changed = !before || before.size !== subset.length;

  if (!quiet) {
    console.log(
      `✓ 得意黑子集：${chars.size} 个字符 → ${kb} KB` +
        `（源字体 ${(source.length / 1024 / 1024).toFixed(1)} MB）`
    );
  }

  return { changed, charCount: chars.size, kb };
}
