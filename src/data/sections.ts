/**
 * 四栏目 —— 原 hooks/_sections.py 的 TS 版本，全站唯一真源。
 *
 * ★ 想改栏目 URL 只改这里的 url 字段。
 *   路由是动态的（src/pages/[section]/…），所以改完 URL 不需要挪任何文件。
 *   改完记得：旧地址若已发布，要在 astro.config.mjs 里加 redirects。
 *
 * key 与 url 是两件事，故意分开：
 *   key = 内容目录名 / 集合名（blog、note、story、gallery）
 *   url = 网址前缀（/blogs/、/notes/、/stories/、/gallery/）
 * 这样 "博客的网址是复数、笔记的目录是单数" 这种别扭事只需要在一个地方承认一次。
 */

export type SectionKey = 'blog' | 'note' | 'story' | 'gallery';
export type SectionKind = 'stream' | 'collection';

export interface Section {
  key: SectionKey;
  /** 界面中文名 */
  name: string;
  /** 门面上的大字标记（带句点，是设计的一部分） */
  mark: string;
  /** URL 前缀，必须前后都带斜杠 */
  url: string;
  /** url 去掉斜杠后的路由段，动态路由用 */
  segment: string;
  /** content 下的子目录名 = key */
  dir: SectionKey;
  kind: SectionKind;
  /** 列表页 / 门面屏的一句话说明 */
  desc: string;
  /** 门面上的编号 */
  index: string;
}

export const SECTIONS: Section[] = [
  {
    key: 'blog',
    name: '博客',
    mark: 'Blog.',
    url: '/blogs/',
    segment: 'blogs',
    dir: 'blog',
    kind: 'stream',
    desc: '正儿八经的博客，献给读者。',
    index: '01',
  },
  {
    key: 'note',
    name: '笔记',
    mark: 'Note.',
    url: '/notes/',
    segment: 'notes',
    dir: 'note',
    kind: 'stream',
    desc: '学习过程中留下来的东西，写给自己。',
    index: '02',
  },
  {
    key: 'story',
    name: '故事',
    mark: 'Story.',
    url: '/stories/',
    segment: 'stories',
    dir: 'story',
    kind: 'stream',
    desc: '虚构的，和不太虚构的。',
    index: '03',
  },
  {
    key: 'gallery',
    name: '影像',
    mark: 'Gallery.',
    url: '/gallery/',
    segment: 'gallery',
    dir: 'gallery',
    kind: 'collection',
    desc: '画、视频、能动的东西、做出来的项目。',
    index: '04',
  },
];

/** 流水栏目：进首页时间流、进归档、进 RSS */
export type StreamSection = Section & { key: 'blog' | 'note' | 'story' };

export const STREAM_SECTIONS = SECTIONS.filter((s) => s.kind === 'stream') as StreamSection[];

/** 集合栏目：不进时间流（影像是独立入口） */
export const COLLECTION_SECTIONS = SECTIONS.filter((s) => s.kind === 'collection');

export const sectionByKey = (key: string): Section | undefined => SECTIONS.find((s) => s.key === key);

export const sectionBySegment = (segment: string): Section | undefined =>
  SECTIONS.find((s) => s.segment === segment);

/** 取栏目中文名，取不到就原样返回（模板里给卡片打标签用） */
export const sectionName = (key: string): string => sectionByKey(key)?.name ?? key;

/** 由条目 id 拼出文章 URL：/notes/basics-of-c-language/ */
export const entryUrl = (key: string, id: string): string => {
  const s = sectionByKey(key);
  if (!s) throw new Error(`未知栏目：${key}`);
  return `${s.url}${id}/`;
};

/** 列表分页：每页条数（可在 SPEC 里改） */
export const PAGE_SIZE = 15;
