/**
 * 链接检查 —— 替代原来 mkdocs build --strict 的那件事。
 *
 * 规则：
 *   1. 扫 dist 下所有 .html，抽出 href / src
 *   2. 站内链接去目标文件里找（目录形式找 index.html，「/a/」与「/a」都认）
 *   3. 站内锚点检查目标文件里有没有那个 id
 *   4. 外链、mailto、data: 一律跳过
 *
 * 有死链就退出码 1，并把「哪个文件、哪一行、指向哪」列出来。
 * 用法：pnpm build && pnpm links
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');

const isExternal = (url) => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url);

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

const exists = async (file) => {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
};

/** /a/b/ → dist/a/b/index.html；/a/b → dist/a/b 或 dist/a/b/index.html */
async function resolveTarget(pathname) {
  const clean = decodeURIComponent(pathname.split('?')[0]);
  const base = path.join(DIST, clean);
  if (clean.endsWith('/')) return { file: path.join(base, 'index.html') };
  if (await exists(base)) {
    const info = await stat(base);
    if (info.isDirectory()) return { file: path.join(base, 'index.html') };
    return { file: base };
  }
  return { file: path.join(base, 'index.html') };
}

/** 从 HTML 里抽 <a href> 与 <img/src> 等，顺带记行号 */
function collect(html) {
  const found = [];
  const attrRe = /\b(?:href|src)\s*=\s*"([^"]*)"/g;
  const lineStarts = [];
  let at = 0;
  for (const line of html.split('\n')) {
    lineStarts.push(at);
    at += line.length + 1;
  }
  const lineOf = (index) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };

  let match;
  while ((match = attrRe.exec(html))) {
    found.push({ url: match[1].trim(), line: lineOf(match.index) });
  }
  return found;
}

/** 抓目标的 id 表，供锚点校验 */
const idCache = new Map();
async function idsOf(file) {
  if (idCache.has(file)) return idCache.get(file);
  const html = await readFile(file, 'utf8');
  const ids = new Set();
  const re = /\b(?:id|name)\s*=\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) ids.add(m[1]);
  idCache.set(file, ids);
  return ids;
}

if (!(await exists(DIST))) {
  console.error('dist/ 还不存在。先跑 pnpm build。');
  process.exit(1);
}

const htmlFiles = (await walk(DIST)).filter((f) => f.endsWith('.html'));
const problems = [];
let checked = 0;

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const rel = path.relative(DIST, file);

  for (const { url, line } of collect(html)) {
    if (!url || url.startsWith('#') || isExternal(url)) continue;
    // srcset / 内联 data 之类会有脏值，只处理以 / 或字母开头的路径
    if (!/^[./]/.test(url) && !/^[a-z0-9]/i.test(url)) continue;

    const [rawPath, hash] = url.split('#');
    const pathname = rawPath.startsWith('/')
      ? rawPath
      : '/' + path.posix.join(path.posix.dirname(rel.split(path.sep).join('/')), rawPath);

    const target = await resolveTarget(pathname);
    checked++;

    if (!(await exists(target.file))) {
      problems.push(`${rel}:${line}  链接指向不存在的文件 → ${url}`);
      continue;
    }

    if (hash && target.file.endsWith('.html')) {
      const ids = await idsOf(target.file);
      if (!ids.has(hash)) {
        problems.push(`${rel}:${line}  锚点不存在 → ${url}`);
      }
    }
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} 个死链（共检查 ${checked} 条站内链接）\n`);
  for (const p of problems) console.error('  ' + p);
  console.error('');
  process.exit(1);
}

console.log(`✓ 链接检查通过：${htmlFiles.length} 个页面，${checked} 条站内链接，0 死链`);
