import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { categoryKeys } from './data/categories';

/**
 * 内容集合。四栏目 + 一个 pages 集合（关于 / 致谢）。
 *
 * 集合名 = 栏目 key（blog / note / story / gallery），与内容目录同名。
 * 校验规则就是原来 hooks/*.py 干的事：字段写错在构建期失败，而不是悄悄地少一块内容。
 *
 * ── 为什么有一堆 nullish() ──────────────────────────────────────────────
 * 在 YAML 里把字段留空（`summary:` 后面什么都不写），读到的是 **null**，
 * 不是 undefined。而 zod 的 `.optional()` 只放过 undefined，于是会报
 * "Expected type string, received object" —— 因为 `typeof null === 'object'`。
 * 这个报错信息误导性极强，实际原因只是"那一行没填值"。
 * 所以这里统一：空着 = 当没写，交给上层取默认值。
 */

/** 可空字符串：空着就是 undefined */
const text = () => z.string().nullish().transform((v) => v ?? undefined);

/** 可空字符串数组：空着就是 [] */
const list = () => z.array(z.string()).nullish().transform((v) => v ?? []);

/** 可空布尔：空着就是 false */
const flag = () => z.boolean().nullish().transform((v) => v ?? false);

/** 日期：空着要明确报"必填"，而不是被 coerce 成 1970-01-01 */
const when = () => z.preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.date());

/**
 * 流水栏目共用字段。
 * authors 也放这里 —— 文章从 blog 挪到 story 时不该丢字段，
 * 否则挪一次少一个署名，挪第二次就习惯性忽略它了。
 */
const stream = z.object({
  title: text(),
  slug: text(),
  date: when(),
  authors: list(),
  tags: list(),
  draft: flag(),
  summary: text(),
  cover: text(),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: stream,
});

const note = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/note' }),
  schema: stream,
});

const story = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/story' }),
  schema: stream,
});

const gallery = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/gallery' }),
  schema: z.object({
    title: z.string(),
    /** 只能是这四个之一，写错构建失败 */
    category: z.enum(categoryKeys),
    year: z.number().int().min(1990).max(2100),
    /** 媒介 / 工具链，自由文本 */
    medium: text(),
    /** 4:3 建议；不填就用分类名占位 */
    cover: text(),
    /** 视频去平台、项目去仓库 */
    link: text(),
    summary: text(),
    /** 可选：给作品排日期，用于同年内排序 */
    date: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.date().optional()),
    draft: flag(),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    desc: text(),
  }),
});

export const collections = { blog, note, story, gallery, pages };
