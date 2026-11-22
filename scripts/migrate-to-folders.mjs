/**
 * 一次性迁移：把「一篇一个 .md」改成「一篇一个文件夹」。
 *
 *   src/content/blog/a.md            →  src/content/blog/a/index.md
 *   src/assets/images/x.png（被 a 引用）→  src/content/blog/a/x.png
 *   正文 `../../assets/images/x.png`  →  `./x.png`
 *
 * 为什么要脚本而不是手工：
 *   77 处引用要改，且必须和文件移动一一对应 —— 漏一处就是构建期
 *   ImageNotFound，而报错只给你一个相对路径，不说哪一篇。
 *
 * 安全性：
 *   · 只处理**代码围栏外**的引用（围栏里是示例，可能是假路径）
 *   · 已存在 `<名>/index.md` 的跳过，可重复跑
 *   · 目标文件夹里已有同名文件时不覆盖，改名加后缀并同步改引用
 *   · 一张图被两篇共用时不动它（留在 assets/，报出来人工决定）
 *   · 行尾（CRLF/LF）与 BOM 原样保留，避免整篇 diff
 *   · 先规划、后落盘：任何一步报错都会中断，不会留下「图走了、md 还指着旧路」
 *
 * 用法：node scripts/migrate-to-folders.mjs [--dry-run]
 */
import { readdir, readFile, writeFile, rename, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTENT = path.join(ROOT, 'src/content');
const ASSETS = path.join(ROOT, 'src/assets/images');
const SECTIONS = ['blog', 'note', 'story', 'gallery'];
const DRY = process.argv.includes('--dry-run');

/** 正文里的图片引用：](../../assets/images/x.png) 或带 title 的写法 */
const REF = /\]\(\.\.\/\.\.\/assets\/images\/([^)\s]+)(\s+"[^"]*")?\)/g;

const report = { posts: 0, assets: 0, rewritten: 0, missing: [], shared: [], skipped: [] };

/** 保留原行尾：按行切但把行尾留在元素里，join 后与原文逐字节相同 */
const splitLines = (text) => text.split(/(?<=\r?\n)/);
const isFence = (line) => /^\s*(`{3,}|~{3,})/.test(line);

/** 资源名 → 归属文件夹。跨篇共用时只有第一个占有者能搬 */
const owners = new Map();

/**
 * 规划一篇的改写方案，不碰磁盘。
 * @returns {Promise<{folder: string, target: string, text: string, moves: {from: string, to: string}[]}>}
 */
async function planPost(file, dir) {
  const slug = path.basename(file).replace(/\.md$/i, '');
  const folder = path.join(dir, slug);

  const raw = await readFile(file);
  const hasBOM = raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf;
  let text = raw.toString('utf8');
  if (hasBOM) text = text.slice(1);

  const moves = [];
  const taken = new Set(); // 本次已规划的目标文件名，避免自己和自己撞名
  const planned = new Map(); // 资源名 → 最终文件名，同一张图被引用两次时只搬一次
  let fence = false;

  const lines = splitLines(text).map((line) => {
    if (isFence(line)) {
      fence = !fence;
      return line;
    }
    if (fence) return line;

    return line.replace(REF, (whole, name, title = '') => {
      let decoded;
      try {
        decoded = decodeURIComponent(name);
      } catch {
        decoded = name;
      }

      const source = path.join(ASSETS, ...decoded.split('/'));
      if (!existsSync(source)) {
        report.missing.push(`${slug}: ${decoded}`);
        return whole;
      }

      const owner = owners.get(decoded);
      if (owner && owner !== folder) {
        report.shared.push(`${slug}: ${decoded}（已被 ${path.basename(owner)} 占用）`);
        return whole;
      }

      // 同一张图本篇第二次出现：直接复用已规划的目标名，不再搬一遍
      const already = planned.get(decoded);
      if (already) {
        report.rewritten++;
        return `](./${already}${title})`;
      }

      // 目标重名就加 -2、-3，并把引用一起改掉
      const ext = path.extname(decoded);
      const stem = decoded.slice(0, -ext.length);
      let finalName = decoded;
      let n = 1;
      while (taken.has(finalName) || existsSync(path.join(folder, finalName))) {
        n += 1;
        finalName = `${stem}-${n}${ext}`;
      }
      taken.add(finalName);
      planned.set(decoded, finalName);
      owners.set(decoded, folder);

      moves.push({ from: source, to: path.join(folder, finalName) });
      report.rewritten++;
      return `](./${finalName}${title})`;
    });
  });

  return {
    folder,
    target: path.join(folder, 'index.md'),
    text: hasBOM ? '\ufeff' + lines.join('') : lines.join(''),
    moves,
  };
}

async function main() {
  const posts = [];
  for (const section of SECTIONS) {
    const dir = path.join(CONTENT, section);
    if (!existsSync(dir)) continue;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      // 只处理平铺在这一层的 .md；已经进文件夹的、子目录一律跳过
      if (entry.isFile() && /\.md$/i.test(entry.name)) posts.push({ file: path.join(dir, entry.name), dir });
    }
  }

  for (const { file, dir } of posts) {
    const plan = await planPost(file, dir);
    if (existsSync(plan.target)) {
      report.skipped.push(path.relative(CONTENT, plan.target).replace(/\\/g, '/'));
      continue;
    }

    if (DRY) {
      report.posts++;
      report.assets += plan.moves.length;
      console.log(`[dry] ${path.basename(file)} → ${path.basename(plan.folder)}/index.md（搬 ${plan.moves.length} 个文件）`);
      continue;
    }

    await mkdir(plan.folder, { recursive: true });
    // 先搬文件再写 md：万一失败，旧 md 还在、引用还是旧路径，一眼看得出没迁移完
    for (const move of plan.moves) {
      await rename(move.from, move.to);
      report.assets++;
    }
    await writeFile(plan.target, plan.text, 'utf8');
    await unlink(file);
    report.posts++;
  }

  console.log(`\n迁移文章：${report.posts} 篇`);
  console.log(`搬迁图片：${report.assets} 张`);
  console.log(`重写引用：${report.rewritten} 处`);

  if (report.skipped.length) {
    console.log(`\n跳过（已是文件夹结构）：${report.skipped.length}`);
    for (const s of report.skipped) console.log('  · ' + s);
  }
  if (report.missing.length) {
    console.log(`\n引用了但文件不存在（未改动）：${report.missing.length}`);
    for (const s of report.missing) console.log('  · ' + s);
  }
  if (report.shared.length) {
    console.log(`\n多篇共用、留在 assets/（需人工）：${report.shared.length}`);
    for (const s of report.shared) console.log('  · ' + s);
  }

  // 剩下的：没人引用，或者只被 .astro / 脚本引用。只报不删。
  if (existsSync(ASSETS) && !DRY) {
    const left = [];
    async function walk(dir) {
      for (const e of await readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) await walk(full);
        else left.push(path.relative(ASSETS, full).replace(/\\/g, '/'));
      }
    }
    await walk(ASSETS);
    if (left.length) {
      console.log(`\nsrc/assets/images/ 剩余 ${left.length} 个文件（未自动删除）：`);
      for (const f of left) console.log('  · ' + f);
    } else {
      console.log('\nsrc/assets/images/ 已清空（可以整个目录删掉）');
    }
  }
}

await main();
