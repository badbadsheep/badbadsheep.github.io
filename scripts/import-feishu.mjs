/**
 * 把飞书导出的竞赛文档切成「一个方向一篇博客」，直接产出一篇符合本仓库约定的文章。
 *
 * 用法：
 *   node scripts/import-feishu.mjs \
 *     --md       .tmp-isctf/ISCTF2026.md \
 *     --assets   .tmp-isctf/图片和附件 \
 *     --doc-section Misc \
 *     --content-dir blog \
 *     --slug     isctf2026-misc \
 *     --title    "ISCTF2026 Misc 方向题解" \
 *     --date     2026-11-19 \
 *     --tags     "CTF,Misc" \
 *     --exclude  "recovered.wav,192.168.56.88_C$" \
 *     --draft
 *
 * 它替飞书补的那几件事（每一条都踩过）：
 *   · **转义**：飞书把 `. - ( ) [ ] _ * | + # ! ~ < > { } = &` 全加了反斜杠，
 *     203 处。整篇搬过来读着像乱码，而且 `\+`、`\*` 会把公式和强调搞坏。
 *     只在代码围栏外、行内代码外、并且表格行里的 `\|` 不还原（还原了表格就散架）。
 *   · **代码块语言**：`Plain Text` / `Python` / `C` 这种大小写，Shiki 一个都不认，
 *     也不符合「语言标记写小写」的规矩。这里统一映射成小写。
 *   · **标题里的状态列**：`## 题目 | Solved | 谁谁` 是协作文档的管理字段，
 *     博客里不该出现。解出者不是博主本人的，折成一行斜体署名。
 *   · **图片名**：飞书导出的是 `image 94.png` 这种带空格的全局编号，而
 *     CommonMark 的链接目标不能有空格、`check-images` 也不认 `%20`。
 *     这里改成本篇内的 `img-094.png`（保留原编号，方便回溯源文档），
 *     并存进 `images/` 子目录，正文写成 `![](images/img-094.png)`。
 *     （`--image-subdir ''` 可以退回平铺）
 *   · **同一张图/同一个附件被重复上传**：按内容哈希去重，两个链接指向同一份。
 *   · **大文件**：`--exclude` 里的文件不复制，原位留一行「未随文发布」的说明。
 *     git 里塞 47MB 的 wav 是永久负担，删都删不掉。
 *
 * 不做的事（必须人工看一眼）：
 *   · 判断哪些题该发（未解出的、只写了一半的，脚本照搬）
 *   · 排版审美、图注、章节顺序
 *   · `$` 与 KaTeX 的冲突（正文里的 `C$` 这种）
 */
import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

/* ── 参数 ─────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const arg = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
};
const has = (name) => argv.includes(`--${name}`);

const DOC = arg('md');
const ASSETS = arg('assets');
const DOC_SECTION = arg('doc-section');
const CONTENT_DIR = arg('content-dir', 'blog');
const SLUG = arg('slug');
const TITLE = arg('title');
const DATE = arg('date', new Date().toISOString().slice(0, 10));
const TAGS = String(arg('tags', '')).split(',').map((s) => s.trim()).filter(Boolean);
const AUTHOR = arg('author', 'badbadsheep');
const SUMMARY = arg('summary');
const IMAGE_SUBDIR = arg('image-subdir', 'images');
const EXCLUDE = String(arg('exclude', '')).split(',').map((s) => s.trim()).filter(Boolean);
const DRAFT = has('draft');

if (!DOC || !ASSETS || !DOC_SECTION || !SLUG || !TITLE) {
  console.error(`缺少参数。最少要：
  --md <飞书导出的 .md> --assets <图片和附件目录> --doc-section <文档里的方向标题>
  --slug <文件夹名/网址> --title "<文章标题>"`);
  process.exit(2);
}

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'src/content', CONTENT_DIR, SLUG);

/* ── 文本工具 ─────────────────────────────────────────────────────────── */

const isFence = (line) => /^\s*(`{3,}|~{3,})/.test(line);
const fenceLang = (line) => (/^\s*`{3,}(.*)$/.exec(line)?.[1] ?? '').trim();

/** 飞书会转义的标点。`<` `>` 只在后面跟 URL 时才还原（否则会变成 HTML 标签）。 */
const ESCAPABLE = new Set(['.', '-', '(', ')', '[', ']', '_', '*', '|', '+', '#', '!', '~', '{', '}', '=', '&']);

/**
 * 行内清洗：还原飞书转义。
 *
 * 关键观察：飞书对**行内代码也会转义**（`ISCTF 2\.minecraft\assets\...`），
 * 所以不能"见到反引号就跳过"，否则代码里的 `\.` 会原样留在页面上。
 * 好在它的规则是自洽的：作者打的每个 `\` 会写成 `\\`，所以先还原 `\\` → `\`，
 * 再还原 `\.` → `.`，两个方向都对得上。代码围栏（```）里的内容是原样导出的，
 * 那条路径不走这个函数。
 *
 * @param {string} s
 * @param {{table?: boolean}} [opts] 表格行里的 `\|` 不能动，否则列会多出来
 */
function cleanInline(s, opts = {}) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length) {
      const n = s[i + 1];
      if (n === '`') {
        out += '`';
        i++;
        continue;
      }
      if (n === '\\') {
        // 飞书把真的反斜杠写成 \\ —— Windows 路径里就是这个情形
        out += '\\';
        i++;
        continue;
      }
      if (n === '<') {
        // \<https://...\> 是自动链接，还原；别的（\<admin的sid\> 之类）留着，
        // 否则会被当作 HTML 标签吞掉
        if (/^https?:\/\//.test(s.slice(i + 2))) {
          out += '<';
          i++;
          continue;
        }
        out += c;
        continue;
      }
      if (n === '>') {
        // `--\>` → `-->`。行首的 `>` 会变成引用块，所以行首那个不动
        if (i > 0) {
          out += '>';
          i++;
          continue;
        }
        out += c;
        continue;
      }
      if (ESCAPABLE.has(n) && !(opts.table && n === '|')) {
        out += n;
        i++;
        continue;
      }
      out += c;
      continue;
    }
    out += c;
  }
  return out;
}

/** 代码块语言 → Shiki 认的小写名 */
const LANG_MAP = {
  'plain text': 'text',
  plaintext: 'text',
  text: 'text',
  python: 'python',
  py: 'python',
  c: 'c',
  'c++': 'cpp',
  cpp: 'cpp',
  csharp: 'cs',
  'c#': 'cs',
  yaml: 'yaml',
  yml: 'yaml',
  json: 'json',
  bash: 'bash',
  shell: 'sh',
  sh: 'sh',
  zsh: 'sh',
  powershell: 'powershell',
  ps1: 'powershell',
  javascript: 'js',
  js: 'js',
  typescript: 'ts',
  ts: 'ts',
  go: 'go',
  golang: 'go',
  html: 'html',
  css: 'css',
  http: 'http',
  sql: 'sql',
  xml: 'xml',
  java: 'java',
  rust: 'rust',
  php: 'php',
  ruby: 'ruby',
};

function normLang(raw) {
  const key = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!key) return '';
  return LANG_MAP[key] ?? key.split(/\s+/)[0];
}

/** 文件名安全化：不要空格（CommonMark 链接目标不能有空格） */
function safeName(name) {
  return name.replace(/\s+/g, '-').replace(/[#?%]/g, '');
}

const md5 = async (file) => createHash('md5').update(await readFile(file)).digest('hex');

/* ── 1. 切片 ──────────────────────────────────────────────────────────── */

const docText = await readFile(DOC, 'utf8');
const lines = docText.split(/\r?\n/);

let fence = false;
let start = -1;
let end = lines.length;
for (let i = 0; i < lines.length; i++) {
  if (isFence(lines[i])) {
    fence = !fence;
    continue;
  }
  if (fence) continue;
  if (/^#\s+/.test(lines[i]) && lines[i].replace(/^#\s+/, '').trim() === DOC_SECTION) {
    start = i;
    break;
  }
}
if (start < 0) {
  console.error(`文档里找不到一级标题「# ${DOC_SECTION}」`);
  process.exit(2);
}
fence = false;
for (let i = start + 1; i < lines.length; i++) {
  if (isFence(lines[i])) {
    fence = !fence;
    continue;
  }
  if (fence) continue;
  if (/^#\s+/.test(lines[i])) {
    end = i;
    break;
  }
}

const body = lines.slice(start + 1, end);
console.log(`切片：L${start + 2}–L${end}，共 ${body.length} 行`);

/* ── 2. 资源清单：先把图片/附件收齐，再逐行替换 ──────────────────────── */

const IMG_RE = /!\[[^\]]*\]\(图片和附件\/([^)]+)\)/g;
const LINK_RE = /(?<!!)\[([^\]]*)\]\(图片和附件\/([^)]+)\)/g;

const excluded = new Set(EXCLUDE);
const imageTargets = new Map(); // 源文件名 → 本篇文件名
const attachTargets = new Map(); // 源文件名 → 本篇文件名
const hashToName = new Map(); // md5 → 本篇文件名（去重用）
const copies = []; // { from, to, kind }
const missing = [];
const skippedBig = [];

function resolveAsset(ref) {
  let name = ref;
  try {
    name = decodeURIComponent(ref);
  } catch {
    /* 解不开就按原样找 */
  }
  return { name, abs: path.join(ASSETS, name) };
}

/** 图片：保留源编号 → img-094.png；没有编号的（截图/哈希名）降级成安全名 */
function imageTargetName(srcName) {
  const numbered = /^image[ -](\d+)\.(\w+)$/i.exec(srcName);
  if (numbered) return `img-${numbered[1].padStart(3, '0')}.${numbered[2].toLowerCase()}`;
  return safeName(srcName);
}

const pendingImages = [];
const pendingLinks = [];

for (let i = 0; i < body.length; i++) {
  const line = body[i];
  if (isFence(line)) {
    // 围栏内也可能有引用（比如贴的命令），但那些是示例，不搬
    fence = !fence;
    continue;
  }
  if (fence) continue;
  for (const m of line.matchAll(IMG_RE)) pendingImages.push({ i, ref: m[1] });
  for (const m of line.matchAll(LINK_RE)) pendingLinks.push({ i, ref: m[2], text: m[1] });
}

async function plan(targets, pending, kind) {
  for (const { ref } of pending) {
    const { name, abs } = resolveAsset(ref);
    if (targets.has(name)) continue;
    if (excluded.has(name)) {
      if (!skippedBig.some((s) => s.name === name)) {
        const size = existsSync(abs) ? (await readFile(abs)).length : 0;
        skippedBig.push({ name, size });
      }
      targets.set(name, null); // null = 不复制
      continue;
    }
    if (!existsSync(abs)) {
      missing.push(`${kind}: ${name}`);
      targets.set(name, null);
      continue;
    }
    const hash = await md5(abs);
    if (hashToName.has(hash)) {
      targets.set(name, hashToName.get(hash)); // 同内容已经搬过，复用
      continue;
    }
    let dest = kind === 'image' ? imageTargetName(name) : safeName(name);
    // 名字撞了（不同内容同名）就加后缀
    const taken = new Set([...hashToName.values(), ...targets.values()].filter(Boolean));
    if (taken.has(dest)) {
      const ext = path.extname(dest);
      dest = `${dest.slice(0, -ext.length)}-${hash.slice(0, 4)}${ext}`;
    }
    targets.set(name, dest);
    hashToName.set(hash, dest);
    copies.push({
      from: abs,
      // 图片进 images/，其他附件留在文章根目录
      to: path.join(OUT_DIR, kind === 'image' ? IMAGE_SUBDIR : '', dest),
      kind,
      bytes: (await readFile(abs)).length,
    });
  }
}

await plan(imageTargets, pendingImages, 'image');
await plan(attachTargets, pendingLinks, 'attach');

/* ── 3. 逐行改写 ──────────────────────────────────────────────────────── */

const STATUS = /^(solved|working|closed|tried)$/i;

/**
 * 每道题自己的 `###` 小节名，用来判断「是不是按人分节」。
 * 必须是**按题目分块**统计：全局收集的话，上一题的 `### 橘子` 会让后面所有
 * 橘子解出的题都误判成"分头解出"。
 */
const h3ByChunk = [];
{
  let chunk = -1;
  let inFence = false;
  for (const l of body) {
    if (isFence(l)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (/^##\s+/.test(l)) {
      chunk++;
      h3ByChunk[chunk] = new Set();
      continue;
    }
    if (/^###\s+/.test(l) && chunk >= 0) {
      // 统一小写：文档里写 `### Badbadsheep`，标题里写 `badbadsheep`
      h3ByChunk[chunk].add(l.replace(/^###\s+/, '').split('\\|')[0].trim().toLowerCase());
    }
  }
}

const out = [];
fence = false;
let chunk = -1;

for (const raw of body) {
  if (isFence(raw)) {
    const lang = normLang(fenceLang(raw));
    fence = !fence;
    out.push(fence ? (lang ? '```' + lang : '```') : '```');
    continue;
  }

  if (fence) {
    out.push(raw);
    continue;
  }

  let line = raw;

  // 标题：拆掉协作文档的状态列
  const h = /^(#{1,6})\s+(.*)$/.exec(line);
  if (h) {
    if (h[1] === '##') chunk++;
    const parts = h[2].split('\\|').map((s) => s.trim()).filter(Boolean);
    const title = parts.shift() ?? '';
    const status = parts.find((p) => STATUS.test(p));
    const solvers = parts
      .filter((p) => !STATUS.test(p))
      .flatMap((p) => p.split(/\s+/))
      .filter(Boolean);

    out.push(`${h[1]} ${cleanInline(title)}`);

    if (h[1].length === 2) {
      // 只有二级标题（= 一道题）才写署名
      const own = h3ByChunk[chunk] ?? new Set();
      if (status && /^working$/i.test(status)) {
        out.push('', '*本题未解出 —— 以下是当时的思路。*');
      } else if (solvers.length && !(solvers.length === 1 && solvers[0] === AUTHOR)) {
        const others = solvers.filter((s) => s !== AUTHOR);
        if (solvers.length === 1) {
          out.push('', `*本题由 ${solvers[0]} 解出。*`);
        } else if (solvers.every((s) => own.has(s.toLowerCase()))) {
          out.push('', `*与 ${others.join('、')} 分头解出，下面按人分节。*`);
        } else {
          out.push('', `*本题由 ${solvers.join('、')} 合力解出。*`);
        }
      }
    }
    continue;
  }

  // 图片 / 附件
  line = line.replace(IMG_RE, (whole, ref) => {
    const { name } = resolveAsset(ref);
    const dest = imageTargets.get(name);
    return dest ? `![](${IMAGE_SUBDIR}/${dest})` : '';
  });
  line = line.replace(LINK_RE, (whole, text, ref) => {
    const { name } = resolveAsset(ref);
    const dest = attachTargets.get(name);
    const cleanText = cleanInline(text.trim() || name);
    if (dest) return `[${cleanText}](${dest})`;
    const big = skippedBig.find((s) => s.name === name);
    if (big) return `\`${name}\`（${(big.size / 1024 / 1024).toFixed(1)} MB，未随文发布）`;
    return `\`${name}\`（文件缺失）`;
  });

  line = cleanInline(line, { table: /^\s*\|/.test(line) });
  out.push(line);
}

/* ── 4. 收尾：空行、引用块尾部空行 ───────────────────────────────────── */

const tidy = [];
fence = false;
for (const line of out) {
  if (isFence(line)) {
    fence = !fence;
    tidy.push(line);
    continue;
  }
  if (fence) {
    tidy.push(line);
    continue;
  }
  // 飞书每个引用块后面爱补两行空的 `>`，留着会让引用框拖出一截空白
  if (/^>\s*$/.test(line)) {
    let j = tidy.length - 1;
    while (j >= 0 && tidy[j] === '') j--;
    if (j >= 0 && /^>/.test(tidy[j])) continue;
  }
  // 连续空行压成一行
  if (line === '' && tidy[tidy.length - 1] === '') continue;
  tidy.push(line);
}

// 去掉开头结尾的空行
while (tidy[0] === '') tidy.shift();
while (tidy[tidy.length - 1] === '') tidy.pop();

/* ── 5. 落盘 ──────────────────────────────────────────────────────────── */

const front = [
  '---',
  `title: ${TITLE}`,
  `date: ${DATE}`,
  'authors:',
  `  - ${AUTHOR}`,
  TAGS.length ? `tags: [${TAGS.map((t) => `"${t}"`).join(', ')}]` : 'tags: []',
  `draft: ${DRAFT ? 'true' : 'false'}`,
  ...(SUMMARY ? [`summary: ${SUMMARY}`] : []),
  '---',
  '',
  '',
];

await mkdir(OUT_DIR, { recursive: true });
await writeFile(path.join(OUT_DIR, 'index.md'), front.join('\n') + tidy.join('\n') + '\n', 'utf8');

for (const c of copies) {
  await mkdir(path.dirname(c.to), { recursive: true });
  await copyFile(c.from, c.to);
}

/* ── 6. 报告 ──────────────────────────────────────────────────────────── */

const images = copies.filter((c) => c.kind === 'image');
const attaches = copies.filter((c) => c.kind === 'attach');
const sum = (list) => list.reduce((a, c) => a + c.bytes, 0);

console.log(`\n写出：${path.relative(ROOT, path.join(OUT_DIR, 'index.md')).replace(/\\/g, '/')}`);
console.log(`正文：${tidy.length} 行`);
console.log(`图片：${images.length} 张（${(sum(images) / 1024 / 1024).toFixed(1)} MB）`);
console.log(`附件：${attaches.length} 个（${(sum(attaches) / 1024 / 1024).toFixed(1)} MB）`);
if (skippedBig.length) {
  console.log(`\n未复制（--exclude）：`);
  for (const s of skippedBig) console.log(`  · ${s.name}  ${(s.size / 1024 / 1024).toFixed(1)} MB`);
}
if (missing.length) {
  console.log(`\n引用了但文件不存在：`);
  for (const m of missing) console.log('  · ' + m);
}
