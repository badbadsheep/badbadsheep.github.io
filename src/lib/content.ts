/**
 * 内容读取层。原来 hooks/content_index.py 干的活，现在全在这里。
 *
 * 三条约定：
 *   1. 排序、分组、摘要、阅读时长只在这里算一次，页面不重复实现
 *   2. 草稿在开发时可见、构建时剔除（draft: true）
 *   3. 所有 URL 由 data/sections.ts 拼出来，不手写字符串
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { STREAM_SECTIONS, entryUrl, sectionByKey, type Section, type SectionKey } from '../data/sections';
import { categoryName, type CategoryKey } from '../data/categories';

export type StreamKey = 'blog' | 'note' | 'story';
export type StreamEntry =
  | CollectionEntry<'blog'>
  | CollectionEntry<'note'>
  | CollectionEntry<'story'>;
export type GalleryEntry = CollectionEntry<'gallery'>;

/* ── 文本工具 ─────────────────────────────────────────────────────────── */

const CJK_RANGE = '\\u3400-\\u9FFF\\uF900-\\uFAFF';
const RE_CJK_ALL = new RegExp(`[${CJK_RANGE}]`, 'g');

/** 中文字数 + 英文词数，去掉代码块与标记符号 */
export function countChars(markdown: string): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const cjk = (text.match(RE_CJK_ALL) || []).length;
  const words = (text.replace(RE_CJK_ALL, ' ').match(/[A-Za-z0-9]+/g) || []).length;
  return cjk + words;
}

/** 350 字/分钟，是最保守的中文长文速度 */
export const readingMinutes = (chars: number): number => Math.max(1, Math.ceil(chars / 350));

/** 正文里第一个 H1（跳过代码围栏），没有就返回 undefined */
export function firstHeading(markdown: string): string | undefined {
  let fence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^```/.test(line.trim())) fence = !fence;
    if (fence) continue;
    const m = /^#\s+(.+?)\s*$/.exec(line);
    if (m) return m[1].trim();
  }
  return undefined;
}

/** 正文第一段可读文字（跳过标题、围栏、HTML、图片） */
export function firstParagraph(markdown: string): string {
  let fence = false;
  const lines = markdown.split(/\r?\n/);
  const buf: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (/^```/.test(line)) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    if (!line) {
      if (buf.length) break;
      continue;
    }
    if (/^#{1,6}\s/.test(line)) continue;
    if (/^<[a-z!/]/i.test(line)) continue;
    if (/^[-*+]\s/.test(line)) continue;
    if (/^\|/.test(line)) continue;
    if (/^!\[/.test(line)) continue;
    if (/^>\s?/.test(line)) {
      buf.push(line.replace(/^>\s?/, ''));
      continue;
    }
    buf.push(line);
  }
  return buf.join(' ').trim();
}

/** 截断到 n 个字符，不切开成对的标点 */
function clip(text: string, n = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= n) return flat;
  return flat.slice(0, n).replace(/[，。、；：,.;:\s]+$/, '') + '…';
}

const pad = (n: number): string => String(n).padStart(2, '0');
export const dateISO = (d: Date): string =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

const SHOW_DRAFTS = import.meta.env.DEV;

/* ── 流水内容 ─────────────────────────────────────────────────────────── */

export interface Post {
  id: string;
  section: Section;
  url: string;
  title: string;
  date: Date;
  dateISO: string;
  summary: string;
  tags: string[];
  draft: boolean;
  chars: number;
  minutes: number;
  entry: StreamEntry;
}

function toPost(section: Section, entry: StreamEntry): Post {
  // 写了 slug 就必须和文件名一致，否则等于悄悄换网址
  if (entry.data.slug && entry.data.slug !== entry.id) {
    throw new Error(
      `[${section.key}/${entry.id}] front matter 里的 slug="${entry.data.slug}" 与文件名不一致。` +
        `改 slug 等于换网址，会让旧链接失效；确认要改就把文件名一起改。`
    );
  }
  const chars = countChars(entry.body ?? '');
  return {
    id: entry.id,
    section,
    url: entryUrl(section.key, entry.id),
    title: entry.data.title ?? firstHeading(entry.body ?? '') ?? entry.id,
    date: entry.data.date,
    dateISO: dateISO(entry.data.date),
    summary: clip(entry.data.summary ?? firstParagraph(entry.body ?? '')),
    tags: entry.data.tags,
    draft: entry.data.draft,
    chars,
    minutes: readingMinutes(chars),
    entry,
  };
}

async function loadStream(key: StreamKey): Promise<Post[]> {
  const section = sectionByKey(key)!;
  let entries: StreamEntry[];
  if (key === 'blog') entries = await getCollection('blog');
  else if (key === 'note') entries = await getCollection('note');
  else entries = await getCollection('story');
  // 以 _ 开头的文件是写作模板，永远不进构建
  return entries.filter((e) => !e.id.startsWith('_')).map((e) => toPost(section, e));
}

/** 全部流水内容（博客 + 笔记 + 故事），日期倒序。草稿只在开发时出现。 */
export async function getPosts(): Promise<Post[]> {
  const all = (await Promise.all(STREAM_SECTIONS.map((s) => loadStream(s.key as StreamKey)))).flat();
  return all
    .filter((p) => SHOW_DRAFTS || !p.draft)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

/** 某个栏目的内容，日期倒序 */
export async function getSectionPosts(key: StreamKey): Promise<Post[]> {
  const posts = await loadStream(key);
  return posts
    .filter((p) => SHOW_DRAFTS || !p.draft)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

/** 某个主题下的全部流水内容（标签原文匹配） */
export async function getPostsByTag(tag: string): Promise<Post[]> {
  const posts = await getPosts();
  return posts.filter((p) => p.tags.includes(tag));
}

/** 同栏目内的上一篇 / 下一篇（上一篇 = 更新的那篇） */
export async function getNeighbours(
  key: StreamKey,
  id: string
): Promise<{ newer?: Post; older?: Post }> {
  const list = await getSectionPosts(key);
  const i = list.findIndex((p) => p.id === id);
  if (i < 0) return {};
  return { newer: list[i - 1], older: list[i + 1] };
}

export interface MonthGroup {
  key: string;
  year: string;
  month: string;
  label: string;
  items: Post[];
}

/** 归档用：按年月分组（已经是日期倒序，分组后顺序天然正确） */
export function groupByMonth(posts: Post[]): MonthGroup[] {
  const map = new Map<string, Post[]>();
  for (const p of posts) {
    const key = p.dateISO.slice(0, 7);
    const bucket = map.get(key);
    if (bucket) bucket.push(p);
    else map.set(key, [p]);
  }
  return [...map.entries()].map(([key, items]) => {
    const [year, month] = key.split('-');
    return { key, year, month, label: `${year} 年 ${Number(month)} 月`, items };
  });
}

/* ── 影像作品 ─────────────────────────────────────────────────────────── */

export interface Work {
  id: string;
  url: string;
  title: string;
  category: CategoryKey;
  categoryName: string;
  year: number;
  medium?: string;
  cover?: string;
  link?: string;
  summary: string;
  draft: boolean;
  entry: GalleryEntry;
}

export async function getWorks(): Promise<Work[]> {
  const entries = await getCollection('gallery');
  return entries
    .filter((e) => !e.id.startsWith('_'))
    .filter((e) => SHOW_DRAFTS || !e.data.draft)
    .map((e) => ({
      id: e.id,
      url: entryUrl('gallery', e.id),
      title: e.data.title,
      category: e.data.category,
      categoryName: categoryName(e.data.category),
      year: e.data.year,
      medium: e.data.medium,
      cover: e.data.cover,
      link: e.data.link,
      summary: clip(e.data.summary ?? firstParagraph(e.body ?? ''), 90),
      draft: e.data.draft,
      entry: e,
    }))
    .sort((a, b) => b.year - a.year || a.title.localeCompare(b.title, 'zh'));
}

/** 每个分类的作品数（计数为 0 的分类在界面上不显示） */
export function countByCategory(works: Work[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const w of works) out[w.category] = (out[w.category] ?? 0) + 1;
  return out;
}

/* ── 静态页面（关于 / 致谢） ──────────────────────────────────────────── */

export async function getPage(id: string) {
  const pages = await getCollection('pages');
  return pages.find((p) => p.id === id);
}

export type { SectionKey };
