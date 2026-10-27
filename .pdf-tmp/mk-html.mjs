/**
 * 把源 Markdown 渲染成适合打印的 HTML（再用 Chrome 打成 PDF）。
 * 复用博客自己的 Astro 7 Markdown 管线（satteri + shiki 双主题），
 * 这样代码高亮、标题层级、图片顺序都和站上一致。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import subsetFont from 'subset-font';

const ROOT = 'G:/badbadblog';
const TMP = path.join(ROOT, '.pdf-tmp');
const MD = path.join(ROOT, 'src/content/blog/2026-WHUCTF-wp.md');
const SATTERI = path.join(
  ROOT,
  'node_modules/.pnpm/@astrojs+markdown-satteri@0.4.4/node_modules/@astrojs/markdown-satteri/dist/satteri-processor.js'
);

/* 过高的长图已经按「接近全白」的行切好（见 slice 步骤），这里给出每片的显示宽度 */
const STRIPS = {
  '2026-10-26-17-31-31.png': { slices: 2, widthMm: 106 },
  '2026-10-26-23-39-39.png': { slices: 10, widthMm: 86 },
};

const LANG_LABELS = {
  python: 'Python',
  py: 'Python',
  text: 'Text',
  plaintext: 'Text',
  sh: 'Shell',
  bash: 'Bash',
  ps: 'PowerShell',
};

const langLabel = {
  name: 'bbs:lang-label',
  pre(node) {
    const raw = this.options.lang || '';
    node.properties['data-lang'] = LANG_LABELS[raw] || raw || 'Text';
  },
};

const decodeEntities = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ── 1. 读文件、拆 front matter ─────────────────────────────────────────── */
const raw = (await fs.readFile(MD, 'utf8')).replace(/\r\n/g, '\n');
const fmMatch = /^---\n([\s\S]*?)\n---\n/.exec(raw);
const frontmatter = fmMatch ? fmMatch[1] : '';
const body = fmMatch ? raw.slice(fmMatch[0].length) : raw;

const pick = (key) => {
  const m = new RegExp(`^${key}:\\s*(.*)$`, 'm').exec(frontmatter);
  return m ? m[1].trim() : '';
};
const title = pick('title');
const date = pick('date');
const summary = pick('summary');
const tags = (pick('tags').replace(/^\[|\]$/g, '') || '')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);
const authors = [...frontmatter.matchAll(/^\s{2,}-\s*(.+)$/gm)].map((m) => m[1].trim());

/* ── 2. 走博客的 Markdown 管线 ─────────────────────────────────────────── */
const { createSatteriMarkdownProcessor } = await import(pathToFileURL(SATTERI).href);

const processor = await createSatteriMarkdownProcessor({
  gfm: true,
  shikiConfig: {
    themes: { dark: 'dark-plus', light: 'light-plus' },
    wrap: false,
    transformers: [langLabel],
  },
});

const { code: rendered, metadata } = await processor.render(body, {
  fileURL: pathToFileURL(MD),
});
let html = rendered;

/* ── 3. 修 HTML ─────────────────────────────────────────────────────────── */

// 3a. <div class="figures" w-30> 这种把宽度写成裸属性的，挪进 class
html = html.replace(/<div class="(figures[^"]*)"([^>]*)>/g, (m, cls, rest) => {
  const extra = [...rest.matchAll(/\b(w-\d+)\b/g)].map((x) => x[1]);
  return `<div class="figures${extra.length ? ' ' + extra.join(' ') : ''}">`;
});

// 3b. 图片：Astro 的图片管线把 src 挪进了 __ASTRO_IMAGE_，这里还原成可访问的路径
const mdDir = path.dirname(MD);
const toUrl = (abs) => '/' + path.relative(ROOT, abs).split(path.sep).join('/');

html = html.replace(/<img[^>]*__ASTRO_IMAGE_="([^"]*)"[^>]*>/g, (m, json) => {
  const info = JSON.parse(decodeEntities(json));
  const abs = path.resolve(mdDir, decodeURI(info.src));
  const base = path.basename(abs);
  const alt = esc(info.alt || '');

  const strip = STRIPS[base];
  if (strip) {
    const parts = [];
    for (let i = 0; i < strip.slices; i++) {
      const url = '/.pdf-tmp/img/' + base.replace(/\.png$/i, '') + `-slice${i}.png`;
      parts.push(`<img class="strip" alt="${alt}" src="${url}" style="width:${strip.widthMm}mm">`);
    }
    return parts.join('\n');
  }

  return `<img alt="${alt}" src="${toUrl(abs)}">`;
});

// 3c. 代码块：包一层带语言标签的框，去掉 shiki 写的内联样式；代码里的汉字包成 .cj 压一点字号
const stripStyle = (attrs) => attrs.replace(/\s*style="[^"]*"/, '');
const CJK_RE =
  /[\u2190-\u21FF\u3040-\u31FF\u2E80-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uFE30-\uFE4F\uFF00-\uFFEF\u2600-\u27BF\u{1F000}-\u{1FAFF}]+/gu;
const wrapCjk = (source) =>
  source
    .split(/(<[^>]+>)/)
    .map((part) =>
      part.startsWith('<') ? part : part.replace(CJK_RE, (m) => `<span class="cj">${m}</span>`)
    )
    .join('');

html = html.replace(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/g, (m, attrs, content) => {
  const langMatch = /\bdata-lang="([^"]*)"/.exec(attrs);
  const lang = langMatch ? langMatch[1] : 'Text';
  const kept = stripStyle(attrs)
    .replace(/\s*\bdata-lang="[^"]*"/, '')
    .replace(/\s*\bdata-language="[^"]*"/, '')
    .replace(/\s*\bclass="[^"]*"/, '')
    .replace(/\s*\btabindex="[^"]*"/, '')
    .trim();
  return (
    '<div class="code">' +
    `<div class="code__bar"><span class="code__lang">${esc(lang)}</span></div>` +
    `<pre class="astro-code" ${kept}>${wrapCjk(content)}</pre>` +
    '</div>'
  );
});

/* ── 4. 标题里的字（得意黑子集，避免 PDF 里标题出现两种字体） ───────────── */
const headingChars = new Set();
for (const h of metadata.headings) for (const c of h.text) headingChars.add(c);
for (const c of title + 'WHUCTF 2026 · 新生赛 Misc 方向') headingChars.add(c);
for (const c of '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,:;!?()[]{}<>/\\|-–—_+=*&%#@~^`"\'') headingChars.add(c);
const fontSrc = await fs.readFile(path.join(ROOT, 'scripts/fonts-src/SmileySans-Oblique.otf'));
const subset = await subsetFont(fontSrc, [...headingChars].join(''), { targetFormat: 'woff2' });
await fs.writeFile(path.join(TMP, 'smiley.woff2'), subset);

/* ── 5. 组装页面（封面只留：栏目名 + 标题 + 日期 + 作者） ───────────────── */
const cover = `
<section class="cover">
  <div class="cover__kicker">WHUCTF 2026 · 新生赛 · Misc 方向</div>
  <h1 class="cover__title">${esc(title)}</h1>
  <div class="cover__rule"></div>
  ${summary ? `<p class="cover__summary">${esc(summary)}</p>` : ''}
  <ul class="cover__meta">
    <li><span>日期</span>${esc(date)}</li>
    <li><span>作者</span>${esc(authors.join(' / ') || 'badbadsheep')}</li>
    ${tags.length ? `<li><span>标签</span>${esc(tags.join(' · '))}</li>` : ''}
  </ul>
</section>`;

const page = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/.pdf-tmp/style.css">
</head>
<body>
${cover}
<article class="prose">
${html}
</article>
</body>
</html>`;

await fs.writeFile(path.join(TMP, 'post.html'), page, 'utf8');
console.log(
  `[html] ${(page.length / 1024).toFixed(1)} KB，图片 ${metadata.localImagePaths.length} 张，章节 ${metadata.headings.filter((h) => h.depth === 1).length} 个，字体子集 ${(subset.length / 1024).toFixed(1)} KB`
);
