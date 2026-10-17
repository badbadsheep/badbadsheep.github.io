/**
 * 作品分类 —— 原 hooks/gallery.py 的 CATEGORIES，只服务影像栏目。
 * front matter 里 category 写错会在构建期失败（由 content.config.ts 的 enum 拦下）。
 */
export type CategoryKey = 'painting' | 'video' | 'interactive' | 'project';

export interface Category {
  key: CategoryKey;
  name: string;
  desc: string;
}

export const CATEGORIES: Category[] = [
  { key: 'painting', name: '绘画', desc: '静态图像作品' },
  { key: 'video', name: '视频', desc: '视频 / 动画' },
  { key: 'interactive', name: '交互', desc: '可以动手玩的实验' },
  { key: 'project', name: '项目', desc: '做出来的东西' },
];

export const categoryKeys = CATEGORIES.map((c) => c.key) as [CategoryKey, ...CategoryKey[]];

export const categoryName = (key: string): string =>
  CATEGORIES.find((c) => c.key === key)?.name ?? key;
