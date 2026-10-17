/**
 * 主题登记表 —— 原 data/topics.yml。
 *
 * 文章 front matter 里的 tags 是自由的，写什么都不会报错。
 * 只有登记在这里的标签，才会生成 /topics/<slug>/ 聚合页。
 * 中文标签直接进网址会变成 %E4%B8%AD 那种长串，所以 slug 必须是你指定的 ASCII。
 *
 * ── 现在为什么是空的 ────────────────────────────────────────────────────
 * 原本登记了 MkDocs，但带那个标签的唯一一篇文章已经删了，
 * 于是 /topics/mkdocs/ 变成一个只有空态句的空页挂在 sitemap 里。
 * 空主题页没有意义，所以撤掉了这条登记。
 *
 * ── 怎么加回来 / 加新的 ────────────────────────────────────────────────
 *   1. 在下面的对象里加一条：
 *
 *        MkDocs: { slug: 'mkdocs', name: 'MkDocs', desc: '可选：一句话说明' },
 *
 *      slug 只能用小写字母、数字、连字符。
 *   2. 文章 front matter 的 tags 里写同样的原文（这里是 `MkDocs`）。
 *   3. 构建时会自动生成 /topics/mkdocs/，文章页里的那个标签也会变成可点链接。
 *
 * 没登记的标签不会生成聚合页，在文章页渲染成不可点的纯文本 —— 这是故意的：
 * 只有一两篇文章的时候，一堆空主题页比没有主题页更难看。
 */

export interface Topic {
  slug: string;
  name: string;
  desc?: string;
}

export const TOPICS: Record<string, Topic> = {};

/** 标签原文 → 登记信息（没登记返回 undefined） */
export const topicOf = (tag: string): Topic | undefined => TOPICS[tag];

/** 全部登记主题，附带它们的 slug */
export const topicList = (): { tag: string; topic: Topic }[] =>
  Object.entries(TOPICS).map(([tag, topic]) => ({ tag, topic }));
