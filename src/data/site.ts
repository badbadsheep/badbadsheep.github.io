/**
 * 站点身份 —— 原 data/card.yml 的 TS 版本。
 * 界面上凡是出现站名 / 邮箱 / GitHub 的地方都从这里取，改一处全站生效。
 */
export const SITE = {
  name: 'badbadsheep',
  handle: '',
  tagline: 'Welcome to my world',
  focus: '',
  email: '3360421858@qq.com',
  github: 'badbadsheep',
  url: 'https://badbadsheep.github.io',
  lang: 'zh-CN',
  locale: 'zh_CN',
  description: 'Welcome to my world',
  avatar: '/avatars/avatar.png',
  logo: '/logo.png',
  author: 'badbadsheep',
  startYear: 2026,
} as const;

/** 社交与出口链接，页脚、抽屉、关于页共用 */
export const LINKS = [
  { href: '/about/', label: '关于' },
  { href: '/archive/', label: '归档' },
  { href: '/credits/', label: '致谢' },
  { href: '/feed_rss_created.xml', label: 'RSS' },
  { href: `https://github.com/${SITE.github}`, label: 'GitHub', external: true },
  { href: `mailto:${SITE.email}`, label: SITE.email, external: true },
] as const;
