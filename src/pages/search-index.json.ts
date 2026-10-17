import type { APIRoute } from 'astro';
import { getPosts, getWorks } from '../lib/content';

/**
 * 搜索索引的生成端点。
 *
 * 构建时它是一个静态文件；astro dev 里每次请求现算（改完文章刷新就能搜到）。
 * 中文切双字（bigram），英文按词；正文里的 Markdown 符号先洗掉再切。
 */

const CJK = /[\u3400-\u9FFF\uF900-\uFAFF]/;

/** 把 Markdown 洗成纯文本，保留中文与英文词 */
function plain(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^[>#\-*+|:=\s]+/gm, ' ')
    .replace(/[*_~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 中英混排文本 → 检索词：中文连续段切双字，英文词整取 */
function tokenize(text: string): string[] {
  const out: string[] = [];
  const chunks = text.toLowerCase().split(/[^\p{Script=Han}a-z0-9]+/u);
  for (const chunk of chunks) {
    if (!chunk) continue;
    if (CJK.test(chunk)) {
      if (chunk.length === 1) out.push(chunk);
      else for (let i = 0; i < chunk.length - 1; i++) out.push(chunk.slice(i, i + 2));
    } else if (chunk.length >= 2) {
      out.push(chunk);
    }
  }
  return out;
}

const push = (map: Record<string, number[]>, term: string, id: number): void => {
  const list = map[term];
  if (!list) map[term] = [id];
  else if (list[list.length - 1] !== id) list.push(id);
};

export const GET: APIRoute = async () => {
  const posts = await getPosts();
  const works = await getWorks();

  const docs = [
    ...posts.map((p) => ({
      u: p.url,
      t: p.title,
      s: p.summary,
      d: p.dateISO,
      k: p.section.key,
      n: p.section.name,
      body: p.entry.body ?? '',
    })),
    ...works.map((w) => ({
      u: w.url,
      t: w.title,
      s: w.summary,
      d: String(w.year),
      k: 'gallery',
      n: w.categoryName,
      body: w.entry.body ?? '',
    })),
  ];

  const title: Record<string, number[]> = {};
  const body: Record<string, number[]> = {};

  docs.forEach((doc, id) => {
    for (const term of new Set(tokenize(doc.t))) push(title, term, id);
    for (const term of new Set(tokenize(`${doc.s} ${plain(doc.body)}`))) push(body, term, id);
  });

  const payload = {
    v: 1,
    docs: docs.map(({ body: _body, ...rest }) => rest),
    title,
    body,
  };

  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
