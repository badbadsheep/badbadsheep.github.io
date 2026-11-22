/**
 * 一次性迁移：把每篇文章的图片收进同级的 `images/` 子目录。
 *
 *   src/content/blog/a/index.md      正文里 ![](x.png)  →  ![](images/x.png)
 *   src/content/blog/a/x.png         →  src/content/blog/a/images/x.png
 *
 * 为什么值得做：一篇文章的文件夹里原来躺着 index.md + 几十张图 + 几个附件，
 * 打开就找不到 index。收进 images/ 之后，文件夹只剩 index.md、images/、附件。
 *
 * 三种引用写法都要认（仓库里并存）：
 *   `./x.png`（第一轮迁移产生的）、`x.png`（飞书导入产生的）、
 *   `attachment/x.png`（临时试验留下的）
 * 并且要认「图片不在根目录」的情况 —— 一并搬到 images/ 下。
 *
 * 安全性：
 *   · 只动代码围栏外的引用；围栏里的是示例
 *   · 已经是 `images/x.png` 的跳过，可重复跑
 *   · 同名文件不覆盖：内容相同时删掉源文件，内容不同则加 -2 后缀并同步改引用
 *   · 没被引用的图（孤儿）也一起搬，避免根目录继续乱
 *   · 行尾（CRLF/LF）与 BOM 原样保留
 *
 * 用法：node scripts/move-images-to-subdir.mjs [--dry-run] [--dir images]
 */
import { readdir, readFile, writeFile, rename, mkdir, unlink, rmdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTENT = path.join(ROOT, 'src/content');
const SECTIONS = ['blog', 'note', 'story', 'gallery'];
const DRY = process.argv.includes('--dry-run');
const SUB = (() => {
  const i = process.argv.indexOf('--dir');
  return i >= 0 ? process.argv[i + 1] : 'images';
})();

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg']);
const isImage = (f) => IMAGE_EXT.has(path.extname(f).toLowerCase());
const isFence = (l) => /^\s*(`{3,}|~{3,})/.test(l);
const toPosix = (p) => p.split(path.sep).join('/');

const report = { posts: 0, moved: 0, rewritten: 0, missing: [], skipped: [] };

const md5 = async (f) => createHash('md5').update(await readFile(f)).digest('hex');

/** 列出文章文件夹里除 md / 除目标子目录以外的所有文件 */
async function listFiles(dir, base = dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (path.join(dir, e.name) === path.join(base, SUB)) continue; // 已经是目标目录
      await listFiles(full, base, out);
      continue;
    }
    out.push(full);
  }
  return out;
}

/** 递归删空目录（自底向上），失败就算了 */
async function pruneEmpty(dir, stop) {
  if (dir === stop) return;
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) await pruneEmpty(path.join(dir, e.name), stop);
  }
  try {
    const left = await readdir(dir);
    if (left.length === 0) await rmdir(dir);
  } catch {
    /* 非空或没权限，跳过 */
  }
}

async function migratePost(postDir) {
  const mdFile = path.join(postDir, 'index.md');
  const raw = await readFile(mdFile);
  const hasBOM = raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf;
  let text = raw.toString('utf8');
  if (hasBOM) text = text.slice(1);

  const files = (await listFiles(postDir)).filter(isImage);
  if (files.length === 0) return;

  // ── 规划：每个图搬到 images/ 下的什么名字 ──────────────────────────
  const subDir = path.join(postDir, SUB);
  const plan = new Map(); // 旧相对路径（posix，无 ./ 前缀） → 新文件名
  const used = new Map(); // 新文件名 → 绝对路径
  const moves = [];

  for (const abs of files) {
    const rel = toPosix(path.relative(postDir, abs));
    const baseName = path.basename(abs);
    const dest = path.join(subDir, baseName);

    if (existsSync(dest)) {
      // 上次跑到一半：内容一样就直接删源，不一样就加后缀
      if ((await md5(dest)) === (await md5(abs))) {
        moves.push({ from: abs, to: null, rel, name: baseName });
        continue;
      }
      const ext = path.extname(baseName);
      const stem = baseName.slice(0, -ext.length);
      let n = 1;
      let name = baseName;
      while (existsSync(path.join(subDir, name)) || used.has(name)) {
        n += 1;
        name = `${stem}-${n}${ext}`;
      }
      used.set(name, abs);
      moves.push({ from: abs, to: path.join(subDir, name), rel, name });
      continue;
    }

    used.set(baseName, abs);
    moves.push({ from: abs, to: dest, rel, name: baseName });
  }

  // ── 改写引用 ────────────────────────────────────────────────────────
  const byRel = new Map(moves.map((m) => [m.rel, `./${SUB}/${m.name}`]));
  let fence = false;
  const lines = text.split(/(?<=\r?\n)/).map((line) => {
    if (isFence(line)) {
      fence = !fence;
      return line;
    }
    if (fence) return line;

    return line.replace(/!\[([^\]]*)\]\(([^)\s]+)(\s+"[^"]*")?\)/g, (whole, alt, ref, title = '') => {
      if (/^(https?:|\/)/i.test(ref)) return whole;

      const clean = ref.replace(/^\.\//, '');
      if (clean.startsWith(`${SUB}/`)) return whole; // 已经就位

      const next = byRel.get(clean);
      if (!next) {
        if (!existsSync(path.join(postDir, clean))) report.missing.push(`${path.basename(postDir)}: ${ref}`);
        return whole;
      }
      report.rewritten++;
      return `![${alt}](${next}${title})`;
    });
  });

  if (DRY) {
    report.posts++;
    report.moved += moves.length;
    return;
  }

  await mkdir(subDir, { recursive: true });
  for (const m of moves) {
    if (m.to) await rename(m.from, m.to);
    else await unlink(m.from);
    report.moved++;
  }

  const nextText = lines.join('');
  if (nextText !== (hasBOM ? '\ufeff' + text : text)) {
    await writeFile(mdFile, hasBOM ? '\ufeff' + nextText : nextText, 'utf8');
  }

  await pruneEmpty(postDir, postDir);
  report.posts++;
}

async function main() {
  for (const section of SECTIONS) {
    const base = path.join(CONTENT, section);
    if (!existsSync(base)) continue;
    for (const e of await readdir(base, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const postDir = path.join(base, e.name);
      if (!existsSync(path.join(postDir, 'index.md'))) continue;
      await migratePost(postDir);
    }
  }

  console.log(`\n处理文章：${report.posts} 篇`);
  console.log(`移动图片：${report.moved} 张 → ${SUB}/`);
  console.log(`改写引用：${report.rewritten} 处`);
  if (report.missing.length) {
    console.log(`\n引用了但文件不存在（未改动）：`);
    for (const m of report.missing) console.log('  · ' + m);
  }
}

await main();
